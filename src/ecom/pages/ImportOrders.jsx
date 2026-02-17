import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { importApi } from '../services/ecommApi.js';
import ecomApi from '../services/ecommApi.js';

// ─── Status badge colors ────────────────────────────────────────────────────
const STATUS_COLORS = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  in_progress: 'bg-blue-50 text-blue-700 border-blue-200',
  pending: 'bg-gray-50 text-gray-500 border-gray-200',
  cancelled: 'bg-gray-50 text-gray-500 border-gray-200'
};
const STATUS_LABELS = {
  success: 'Succès', partial: 'Partiel', failed: 'Échoué',
  in_progress: 'En cours', pending: 'En attente', cancelled: 'Annulé'
};

// ─── Column field labels ────────────────────────────────────────────────────
const FIELD_LABELS = {
  orderId: 'ID Commande', date: 'Date', clientName: 'Nom client', clientPhone: 'Téléphone',
  city: 'Ville', product: 'Produit', price: 'Prix', quantity: 'Quantité',
  status: 'Statut', notes: 'Notes', address: 'Adresse'
};

const ImportOrders = () => {
  const navigate = useNavigate();
  const { user } = useEcomAuth();
  const eventSourceRef = useRef(null);

  // ── State ──
  const [currentStep, setCurrentStep] = useState(1);
  const [sources, setSources] = useState([]);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [manualSheetId, setManualSheetId] = useState('');
  const [manualSheetName, setManualSheetName] = useState('Sheet1');
  const [manualSourceName, setManualSourceName] = useState('');
  const [useManualInput, setUseManualInput] = useState(false);

  // Step 1
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);

  // Step 2
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  // Step 3
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ percentage: 0, status: '', current: 0, total: 0 });

  // Step 4
  const [importResult, setImportResult] = useState(null);

  // History
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Feedback
  const [error, setError] = useState('');

  // ── Load sources on mount ──
  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    try {
      const res = await ecomApi.get('/orders/settings');
      if (res.data.success) {
        let allSources = res.data.data.sources || [];
        if (res.data.data.googleSheets?.spreadsheetId) {
          allSources = [
            {
              _id: 'legacy',
              name: 'Source par défaut',
              sheetName: res.data.data.googleSheets.sheetName || 'Sheet1',
              spreadsheetId: res.data.data.googleSheets.spreadsheetId,
              isActive: true,
              lastSyncAt: res.data.data.googleSheets.lastSyncAt
            },
            ...allSources
          ];
        }
        setSources(allSources);
        if (allSources.length === 1) setSelectedSourceId(allSources[0]._id);
      }
    } catch (err) {
      console.error('Error fetching sources:', err);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await importApi.getHistory({ limit: 15 });
      setHistory(res.data.data.imports || []);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ── Step 1: Validate ──
  const handleValidate = async () => {
    setError('');
    setValidating(true);
    setValidationResult(null);
    try {
      let payload;
      if (useManualInput) {
        if (!manualSheetId.trim()) { setError('Veuillez entrer un ID ou URL de spreadsheet'); setValidating(false); return; }
        payload = { spreadsheetId: manualSheetId.trim(), sheetName: manualSheetName || 'Sheet1' };
      } else {
        if (!selectedSourceId) { setError('Veuillez sélectionner une source'); setValidating(false); return; }
        const source = sources.find(s => s._id === selectedSourceId);
        payload = { spreadsheetId: source?.spreadsheetId, sheetName: source?.sheetName || 'Sheet1' };
      }
      const res = await importApi.validate(payload);
      setValidationResult(res.data.data);
      if (res.data.data.valid) setCurrentStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur de validation');
    } finally {
      setValidating(false);
    }
  };

  // ── Step 2: Preview ──
  const handlePreview = async () => {
    setError('');
    setPreviewing(true);
    setPreviewData(null);
    try {
      let payload;
      if (useManualInput) {
        payload = { spreadsheetId: manualSheetId.trim(), sheetName: manualSheetName || 'Sheet1' };
      } else {
        payload = { sourceId: selectedSourceId };
      }
      const res = await importApi.preview(payload);
      setPreviewData(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur de prévisualisation');
    } finally {
      setPreviewing(false);
    }
  };

  useEffect(() => {
    if (currentStep === 2 && !previewData && !previewing) handlePreview();
  }, [currentStep]);

  // ── Step 3: Import ──
  const handleImport = async () => {
    setError('');
    setImporting(true);
    setImportResult(null);
    setImportProgress({ percentage: 0, status: 'Démarrage...', current: 0, total: 0 });
    setCurrentStep(3);

    // SSE for progress
    const resolvedSourceId = useManualInput ? 'manual' : selectedSourceId;
    try {
      const baseUrl = window.location.origin;
      const ws = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
      const wsId = ws?._id || user?.workspaceId?._id || user?.workspaceId;
      const sseUrl = `${baseUrl}/api/import/progress?workspaceId=${wsId}&sourceId=${resolvedSourceId}`;
      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setImportProgress({
            percentage: Math.round(data.percentage || 0),
            status: data.status || '',
            current: data.current || 0,
            total: data.total || 0
          });
          if (data.completed) {
            setTimeout(() => es.close(), 1500);
          }
        } catch {}
      };
      es.onerror = () => {
        if (es.readyState !== EventSource.CLOSED) es.close();
      };
      setTimeout(() => { if (es.readyState !== EventSource.CLOSED) es.close(); }, 180000);
    } catch {}

    // Run import
    try {
      const payload = { sourceId: resolvedSourceId };
      if (useManualInput) {
        payload.spreadsheetId = manualSheetId.trim();
        payload.sheetName = manualSheetName || 'Sheet1';
        payload.sourceName = manualSourceName.trim() || '';
      }
      const res = await importApi.run(payload);
      setImportResult(res.data.data);
      setCurrentStep(4);
    } catch (err) {
      const msg = err.response?.data?.message || 'Erreur lors de l\'import';
      setError(msg);
      setImportResult(err.response?.data?.data || null);
      setCurrentStep(4);
    } finally {
      setImporting(false);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    }
  };

  // ── Reset ──
  const handleReset = () => {
    setCurrentStep(1);
    setValidationResult(null);
    setPreviewData(null);
    setImportResult(null);
    setImportProgress({ percentage: 0, status: '', current: 0, total: 0 });
    setManualSourceName('');
    setError('');
  };

  // ── Relaunch ──
  const handleRelaunch = () => {
    setImportResult(null);
    setError('');
    setCurrentStep(2);
    handlePreview();
  };

  // ── Steps config ──
  const steps = [
    { num: 1, label: 'Source', icon: LinkIcon },
    { num: 2, label: 'Aperçu', icon: EyeIcon },
    { num: 3, label: 'Import', icon: DownloadIcon },
    { num: 4, label: 'Résultat', icon: CheckCircleIcon }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Importation des commandes</h1>
          <p className="text-sm text-gray-500 mt-1">Importez vos commandes depuis Google Sheets en quelques étapes</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchHistory(); }}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <ClockIcon className="w-4 h-4" />
            Historique
          </button>
        </div>
      </div>

      {/* Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, i) => (
            <React.Fragment key={step.num}>
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                  currentStep > step.num
                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200'
                    : currentStep === step.num
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-200 ring-4 ring-blue-100'
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {currentStep > step.num ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <step.icon className="w-5 h-5" />
                  )}
                </div>
                <span className={`mt-2 text-xs font-medium ${currentStep >= step.num ? 'text-gray-900' : 'text-gray-400'}`}>
                  {step.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 mt-[-18px] transition-all duration-500 ${
                  currentStep > step.num ? 'bg-emerald-400' : 'bg-gray-200'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div className="flex-1">
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {/* ── STEP 1: Source Selection ── */}
        {currentStep === 1 && (
          <div className="p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Sélectionnez la source</h2>
              <p className="text-sm text-gray-500 mt-1">Choisissez un Google Sheet configuré ou entrez un nouveau lien</p>
            </div>

            {/* Toggle */}
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setUseManualInput(false)}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition ${
                  !useManualInput ? 'bg-blue-50 text-blue-700 border-2 border-blue-200' : 'bg-gray-50 text-gray-600 border-2 border-transparent hover:bg-gray-100'
                }`}
              >
                Sources configurées
              </button>
              <button
                onClick={() => setUseManualInput(true)}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition ${
                  useManualInput ? 'bg-blue-50 text-blue-700 border-2 border-blue-200' : 'bg-gray-50 text-gray-600 border-2 border-transparent hover:bg-gray-100'
                }`}
              >
                Nouveau lien
              </button>
            </div>

            {!useManualInput ? (
              <div className="space-y-3">
                {sources.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <LinkIcon className="w-7 h-7 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-500 mb-3">Aucune source configurée</p>
                    <button onClick={() => setUseManualInput(true)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                      Ajouter un lien manuellement
                    </button>
                  </div>
                ) : (
                  sources.filter(s => s.isActive).map(source => (
                    <label
                      key={source._id}
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedSourceId === source._id
                          ? 'border-blue-300 bg-blue-50/50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="source"
                        value={source._id}
                        checked={selectedSourceId === source._id}
                        onChange={() => setSelectedSourceId(source._id)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{source.name}</p>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {source.sheetName || 'Sheet1'}
                          {source.lastSyncAt && (
                            <> · Dernier sync: {new Date(source.lastSyncAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</>
                          )}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-md">Actif</span>
                      </div>
                    </label>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom de la source</label>
                  <input
                    type="text"
                    value={manualSourceName}
                    onChange={(e) => setManualSourceName(e.target.value)}
                    placeholder="Ex: Commandes Facebook, Leads Janvier..."
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Ce nom apparaitra dans la liste des sources sur la page Commandes</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">URL ou ID du Google Sheet</label>
                  <input
                    type="text"
                    value={manualSheetId}
                    onChange={(e) => setManualSheetId(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/... ou ID"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nom de l'onglet</label>
                  <input
                    type="text"
                    value={manualSheetName}
                    onChange={(e) => setManualSheetName(e.target.value)}
                    placeholder="Sheet1"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
                <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-xs text-amber-700">Le spreadsheet doit être partagé en mode "Toute personne disposant du lien peut consulter".</p>
                </div>
              </div>
            )}

            {/* Validation result */}
            {validationResult && (
              <div className={`mt-6 p-4 rounded-xl border ${validationResult.valid ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                {validationResult.valid ? (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-emerald-800">Spreadsheet accessible</p>
                      <p className="text-xs text-emerald-600 mt-0.5">
                        {validationResult.rowCount || 0} lignes · {validationResult.columnCount || 0} colonnes
                        {validationResult.empty && ' · Spreadsheet vide'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-red-800">Connexion échouée</p>
                      <p className="text-xs text-red-600 mt-0.5">{validationResult.error}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="mt-8 flex justify-end">
              <button
                onClick={handleValidate}
                disabled={validating || (!useManualInput && !selectedSourceId) || (useManualInput && !manualSheetId.trim())}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
              >
                {validating ? (
                  <><Spinner /> Vérification...</>
                ) : (
                  <>Vérifier et continuer <ArrowRightIcon className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Preview ── */}
        {currentStep === 2 && (
          <div className="p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Aperçu des données</h2>
                <p className="text-sm text-gray-500 mt-1">Vérifiez que les colonnes sont correctement détectées</p>
              </div>
              <button onClick={() => setCurrentStep(1)} className="text-sm text-gray-500 hover:text-gray-700 font-medium">
                ← Retour
              </button>
            </div>

            {previewing ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Spinner size="lg" />
                <p className="text-sm text-gray-500 mt-4">Chargement de l'aperçu...</p>
              </div>
            ) : previewData ? (
              <>
                {/* Column mapping */}
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Colonnes détectées</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {Object.entries(previewData.columnMapping).map(([field, colIdx]) => (
                      <div key={field} className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <svg className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                        <span className="text-xs font-medium text-emerald-800">{FIELD_LABELS[field] || field}</span>
                        <span className="text-[10px] text-emerald-500 ml-auto">Col {colIdx + 1}</span>
                      </div>
                    ))}
                  </div>
                  {/* Warnings for missing recommended columns */}
                  {previewData.validation?.warnings?.length > 0 && (
                    <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-100">
                      <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                      <p className="text-xs text-amber-700">
                        Colonnes recommandées non détectées: {previewData.validation.warnings.map(w => FIELD_LABELS[w] || w).join(', ')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Data preview table */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-700">Aperçu des données ({previewData.totalRows} lignes)</h3>
                  </div>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            {previewData.headers.slice(0, 8).map((h, i) => (
                              <th key={i} className="px-3 py-2.5 text-left font-medium text-gray-600 whitespace-nowrap">{h || `Col ${i + 1}`}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {previewData.preview.map((row, i) => (
                            <tr key={i} className="hover:bg-gray-50/50">
                              {previewData.headers.slice(0, 8).map((h, j) => (
                                <td key={j} className="px-3 py-2 text-gray-700 max-w-[180px] truncate">{row[h] || '-'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {previewData.headers.length > 8 && (
                    <p className="text-xs text-gray-400 mt-2 text-center">+ {previewData.headers.length - 8} colonnes supplémentaires non affichées</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <button onClick={() => setCurrentStep(1)} className="text-sm text-gray-500 hover:text-gray-700 font-medium">
                    ← Changer de source
                  </button>
                  <button
                    onClick={handleImport}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition shadow-sm"
                  >
                    Lancer l'import <ArrowRightIcon className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-sm text-gray-500">Aucun aperçu disponible</p>
                <button onClick={handlePreview} className="mt-3 text-sm text-blue-600 font-medium hover:text-blue-700">Réessayer</button>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: Import in progress ── */}
        {currentStep === 3 && (
          <div className="p-6 sm:p-8">
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mb-6">
                <div className="animate-spin">
                  <svg className="w-10 h-10 text-blue-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              </div>

              <h2 className="text-lg font-semibold text-gray-900 mb-2">Import en cours</h2>
              <p className="text-sm text-gray-500 mb-8 text-center max-w-sm">
                Veuillez ne pas fermer cette page pendant l'import.
              </p>

              {/* Progress bar */}
              <div className="w-full max-w-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">{importProgress.percentage}%</span>
                  {importProgress.total > 0 && (
                    <span className="text-xs text-gray-500">{importProgress.current}/{importProgress.total} lignes</span>
                  )}
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${importProgress.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-3 text-center min-h-[20px]">{importProgress.status}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 4: Results ── */}
        {currentStep === 4 && (
          <div className="p-6 sm:p-8">
            <div className="flex flex-col items-center text-center mb-8">
              {importResult && !error ? (
                <>
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
                    importResult.errorCount > 0 && importResult.successCount === 0
                      ? 'bg-red-50'
                      : importResult.errorCount > 0
                      ? 'bg-amber-50'
                      : 'bg-emerald-50'
                  }`}>
                    {importResult.errorCount > 0 && importResult.successCount === 0 ? (
                      <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    ) : importResult.errorCount > 0 ? (
                      <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                    ) : (
                      <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    )}
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {importResult.errorCount > 0 && importResult.successCount === 0
                      ? 'Import échoué'
                      : importResult.errorCount > 0
                      ? 'Import partiel'
                      : 'Import réussi'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {importResult.duration ? `Terminé en ${importResult.duration}s` : ''}
                    {importResult.sourceName && <span className="ml-1">— Source : <strong>{importResult.sourceName}</strong></span>}
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">Erreur</h2>
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                </>
              )}
            </div>

            {/* Stats cards */}
            {importResult && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                <StatCard label="Importées" value={importResult.successCount || 0} color="emerald" icon="+" />
                <StatCard label="Mises à jour" value={importResult.updatedCount || 0} color="blue" icon="↻" />
                <StatCard label="Doublons" value={importResult.duplicateCount || 0} color="amber" icon="⊘" />
                <StatCard label="Erreurs" value={importResult.errorCount || 0} color="red" icon="!" />
              </div>
            )}

            {/* Error details */}
            {importResult?.errors?.length > 0 && (
              <ErrorDetails errors={importResult.errors} />
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-6 border-t border-gray-100">
              <button
                onClick={handleRelaunch}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition shadow-sm w-full sm:w-auto justify-center"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Relancer l'import
              </button>
              <button
                onClick={() => navigate('/ecom/orders')}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition w-full sm:w-auto justify-center"
              >
                Voir les commandes
              </button>
              <button
                onClick={handleReset}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium"
              >
                Nouvel import
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Import History Panel ── */}
      {showHistory && (
        <div className="mt-8 bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Historique des imports</h3>
            <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          {historyLoading ? (
            <div className="flex items-center justify-center py-12"><Spinner /></div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-400">Aucun historique d'import</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {history.map(imp => (
                <div key={imp._id} className="px-6 py-4 hover:bg-gray-50/50 transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md border ${STATUS_COLORS[imp.status]}`}>
                        {STATUS_LABELS[imp.status]}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{imp.sourceName || 'Import'}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(imp.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          {imp.triggeredBy && <> · par {imp.triggeredBy.name || imp.triggeredBy.email}</>}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        {imp.successCount > 0 && <span className="text-emerald-600">+{imp.successCount}</span>}
                        {imp.updatedCount > 0 && <span className="text-blue-600">↻{imp.updatedCount}</span>}
                        {imp.errorCount > 0 && <span className="text-red-600">!{imp.errorCount}</span>}
                        {imp.duration > 0 && <span>{imp.duration}s</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Sub-components ─────────────────────────────────────────────────────────

const StatCard = ({ label, value, color, icon }) => {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    red: 'bg-red-50 text-red-700 border-red-100'
  };
  return (
    <div className={`p-4 rounded-xl border ${colors[color]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-2xl font-bold">{value}</span>
        <span className="text-lg opacity-50">{icon}</span>
      </div>
      <p className="text-xs font-medium opacity-70">{label}</p>
    </div>
  );
};

const ErrorDetails = ({ errors }) => {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? errors : errors.slice(0, 3);

  return (
    <div className="mb-6">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
        <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        Détails des erreurs ({errors.length})
      </button>
      <div className="space-y-2">
        {shown.map((err, i) => (
          <div key={i} className="flex items-start gap-3 p-3 bg-red-50/50 border border-red-100 rounded-lg">
            <span className="text-xs font-mono text-red-400 flex-shrink-0 mt-0.5">L{err.row}</span>
            <p className="text-xs text-red-700">{err.message}</p>
          </div>
        ))}
        {!expanded && errors.length > 3 && (
          <button onClick={() => setExpanded(true)} className="text-xs text-gray-500 hover:text-gray-700 font-medium">
            + {errors.length - 3} autres erreurs
          </button>
        )}
      </div>
    </div>
  );
};

const Spinner = ({ size = 'sm' }) => (
  <svg className={`animate-spin ${size === 'lg' ? 'w-8 h-8' : 'w-4 h-4'} text-blue-600`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

// ─── Icons ──────────────────────────────────────────────────────────────────

const LinkIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
);

const EyeIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
);

const DownloadIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
);

const CheckCircleIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);

const ArrowRightIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
);

const ClockIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
);

export default ImportOrders;
