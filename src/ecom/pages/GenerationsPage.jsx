import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Trash2,
  Eye,
  ArrowRight,
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Plus,
  RotateCw,
  Layers3,
  Wand2,
  Crown,
  FileText,
} from 'lucide-react';
import DigitalProductEbookModal from '../components/DigitalProductEbookModal.jsx';
import { storeManageApi } from '../services/storeApi.js';

const API_ORIGIN = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');

const statusConfig = {
  pending: { label: 'En attente', color: 'bg-amber-100 text-amber-700', icon: Clock },
  generating_text: { label: 'Texte en cours', color: 'bg-blue-100 text-blue-700', icon: Loader2, animate: true },
  generating_images: { label: 'Images en cours', color: 'bg-purple-100 text-purple-700', icon: Loader2, animate: true },
  done: { label: 'Terminee', color: 'bg-primary-100 text-primary-700', icon: CheckCircle },
  error: { label: 'Echec partiel', color: 'bg-red-100 text-red-700', icon: XCircle },
};

function getPageMeta(pathname) {
  if (pathname.includes('/product-page-studio/errors')) {
    return {
      title: 'Echecs et reprise',
      description: 'Retrouve les generations interrompues, ouvre le contenu deja sauve, puis relance la suite.',
      defaultFilter: 'recoverable',
      emptyTitle: 'Aucun echec a reprendre',
      emptyDescription: 'Les generations en erreur avec contenu partiel apparaitront ici.',
    };
  }

  return {
    title: 'Toutes les generations',
    description: 'Historique complet des generations de pages produits, avec ouverture, reprise et suppression.',
    defaultFilter: 'all',
    emptyTitle: 'Aucune generation',
    emptyDescription: 'Lance une premiere generation pour remplir ton studio.',
  };
}

function formatTaskDate(value) {
  if (!value) return 'Date inconnue';
  return new Date(value).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTaskThumbnail(task) {
  return task.product?.heroImage
    || task.product?.premiumImages?.hero
    || task.images?.premiumImages?.hero
    || task.images?.heroImage
    || task.product?.heroPosterImage
    || task.images?.heroPosterImage
    || task.product?.realPhotos?.[0]
    || null;
}

export default function GenerationsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [retrying, setRetrying] = useState(null);
  const [creditsInfo, setCreditsInfo] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [digitalProductLoading, setDigitalProductLoading] = useState(null);
  const [digitalProductTarget, setDigitalProductTarget] = useState(null);
  const [digitalProductError, setDigitalProductError] = useState('');
  const [digitalProductResult, setDigitalProductResult] = useState(null);
  const [storeTemplate, setStoreTemplate] = useState('classic');
  const pageMeta = useMemo(() => getPageMeta(location.pathname), [location.pathname]);
  const [activeFilter, setActiveFilter] = useState(pageMeta.defaultFilter);

  useEffect(() => {
    setActiveFilter(pageMeta.defaultFilter);
  }, [pageMeta.defaultFilter]);

  useEffect(() => {
    storeManageApi.getTheme()
      .then((res) => setStoreTemplate(res.data?.data?.template || 'classic'))
      .catch(() => {});
  }, []);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem('ecomToken');
    const headers = { Authorization: `Bearer ${token}` };
    try {
      const workspace = (() => { try { return JSON.parse(localStorage.getItem('ecomWorkspace') || 'null'); } catch { return null; } })();
      const workspaceId = workspace?._id || workspace?.id || '';
      if (workspaceId) headers['X-Workspace-Id'] = workspaceId;
    } catch {}
    return headers;
  }, []);

  const fetchTasks = useCallback(async () => {
    const headers = getHeaders();
    if (!headers.Authorization || headers.Authorization === 'Bearer null') return;
    try {
      const response = await fetch(`${API_ORIGIN}/api/ai/product-generator/tasks`, { headers });
      if (!response.ok) return;
      const data = await response.json();
      if (data.success) setTasks(data.tasks || []);
    } catch (error) {
      console.error('[Generations] tasks error:', error);
    }
  }, [getHeaders]);

  const fetchCredits = useCallback(async () => {
    const headers = getHeaders();
    if (!headers.Authorization || headers.Authorization === 'Bearer null') return;
    try {
      const response = await fetch(`${API_ORIGIN}/api/ai/product-generator/info`, { headers });
      if (!response.ok) return;
      const data = await response.json();
      if (data.success) setCreditsInfo(data.generations);
    } catch (error) {
      console.error('[Generations] credits error:', error);
    }
  }, [getHeaders]);

  useEffect(() => {
    Promise.all([fetchTasks(), fetchCredits()]).finally(() => setLoading(false));
  }, [fetchTasks, fetchCredits]);

  useEffect(() => {
    const hasActiveTask = tasks.some((task) => !['done', 'error'].includes(task.status));
    if (!hasActiveTask) return undefined;
    const interval = window.setInterval(fetchTasks, 8000);
    return () => window.clearInterval(interval);
  }, [tasks, fetchTasks]);

  const counts = useMemo(() => {
    const active = tasks.filter((task) => !['done', 'error'].includes(task.status)).length;
    const done = tasks.filter((task) => task.status === 'done').length;
    const error = tasks.filter((task) => task.status === 'error').length;
    const recoverable = tasks.filter((task) => task.status === 'error' && task.product).length;
    return {
      all: tasks.length,
      active,
      done,
      error,
      recoverable,
    };
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    switch (activeFilter) {
      case 'active':
        return tasks.filter((task) => !['done', 'error'].includes(task.status));
      case 'done':
        return tasks.filter((task) => task.status === 'done');
      case 'error':
        return tasks.filter((task) => task.status === 'error');
      case 'recoverable':
        return tasks.filter((task) => task.status === 'error' && task.product);
      default:
        return tasks;
    }
  }, [activeFilter, tasks]);

  const filterOptions = useMemo(() => ([
    { id: 'all', label: 'Tout', count: counts.all },
    { id: 'active', label: 'En cours', count: counts.active },
    { id: 'done', label: 'Terminees', count: counts.done },
    { id: 'recoverable', label: 'Reprise', count: counts.recoverable },
    { id: 'error', label: 'Echecs', count: counts.error },
  ]), [counts]);

  const openTask = useCallback((taskId) => {
    const task = tasks.find((item) => item._id === taskId);
    const isPremium = task?.product?.pageStyle === 'premium'
      || task?.product?.layout === 'premium_product_page'
      || task?.product?.theme === 'premium_product'
      || Boolean(task?.product?.premium_page);
    navigate(isPremium ? '/ecom/boutique/products/premium-generator' : '/ecom/boutique/products/generator', {
      state: { loadTaskId: taskId, from: location.pathname },
    });
  }, [location.pathname, navigate, tasks]);

  const handleDelete = async (taskId) => {
    if (!window.confirm('Supprimer cette generation ?')) return;
    setDeleting(taskId);
    try {
      const response = await fetch(`${API_ORIGIN}/api/ai/product-generator/tasks/${taskId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (response.ok) {
        setTasks((current) => current.filter((task) => task._id !== taskId));
      }
    } finally {
      setDeleting(null);
    }
  };

  const syncCredits = useCallback(async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const response = await fetch(`${API_ORIGIN}/api/ecom/billing/sync-pending-generations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
      });
      const data = await response.json();
      if (data.success) {
        setSyncResult(data.credited > 0 ? `✓ ${data.credited} crédit(s) récupéré(s) !` : 'Aucun paiement en attente trouvé.');
        await fetchCredits();
      } else {
        setSyncResult('Erreur lors de la synchronisation.');
      }
    } catch {
      setSyncResult('Erreur réseau.');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 5000);
    }
  }, [getHeaders, fetchCredits]);

  const handleRetry = async (taskId) => {
    setRetrying(taskId);
    try {
      const response = await fetch(`${API_ORIGIN}/api/ai/product-generator/tasks/${taskId}/retry`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || 'Impossible de reprendre cette generation');
      }
      await fetchTasks();
      setActiveFilter('active');
    } catch (error) {
      window.alert(error.message || 'Erreur lors de la reprise');
    } finally {
      setRetrying(null);
    }
  };

  const openDigitalProductModal = (task) => {
    setDigitalProductTarget(task);
    setDigitalProductError('');
    setDigitalProductResult(null);
  };

  const handleGenerateDigitalProduct = async (brief = {}) => {
    const taskId = digitalProductTarget?._id;
    if (!taskId) return;
    setDigitalProductLoading(taskId);
    setDigitalProductError('');
    setDigitalProductResult(null);
    try {
      const response = await fetch(`${API_ORIGIN}/api/ai/product-generator/tasks/${taskId}/digital-product`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders(),
        },
        body: JSON.stringify({ brief }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data?.message || 'Impossible de générer le produit digital');
      }
      setTasks((current) => current.map((task) => (
        task._id === taskId
          ? { ...task, product: data.product || { ...(task.product || {}), ebook: data.ebook } }
          : task
      )));
      setDigitalProductResult({
        ebook: data.ebook,
        digitalProduct: data.digitalProduct,
        pdf: data.ebook?.pdf,
      });
    } catch (error) {
      setDigitalProductError(error.message || 'Erreur lors de la génération du produit digital');
    } finally {
      setDigitalProductLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-700 border border-primary-100">
            <Layers3 className="w-3.5 h-3.5" />
            Product Page Studio
          </div>
          <h1 className="mt-3 text-2xl font-black text-gray-900">{pageMeta.title}</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">{pageMeta.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={fetchTasks}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
            title="Rafraichir"
          >
            <RefreshCw className="w-4 h-4" />
            Rafraichir
          </button>
          <button
            onClick={() => navigate('/ecom/boutique/product-page-studio')}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
          >
            <Wand2 className="w-4 h-4" />
            Vue studio
          </button>
          {storeTemplate === 'magazine' ? (
            <button
              onClick={() => navigate('/ecom/boutique/products/premium-generator', { state: { from: location.pathname } })}
              className="inline-flex items-center gap-2 px-4 py-2 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-sm font-black rounded-xl transition"
            >
              <Crown className="w-4 h-4" />
              Nouvelle page Premium
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate('/ecom/boutique/products/generator', { state: { from: location.pathname } })}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition"
              >
                <Plus className="w-4 h-4" />
                Nouvelle generation
              </button>
              <button
                onClick={() => navigate('/ecom/boutique/products/premium-generator', { state: { from: location.pathname } })}
                className="inline-flex items-center gap-2 px-4 py-2 border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-sm font-black rounded-xl transition"
              >
                <Crown className="w-4 h-4" />
                Nouvelle premium
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StudioCard label="En cours" value={counts.active} hint="Generations actives" tone="blue" icon={<Loader2 className="w-4 h-4 animate-spin" />} />
        <StudioCard label="Terminees" value={counts.done} hint="Pages pretes a utiliser" tone="emerald" icon={<CheckCircle className="w-4 h-4" />} />
        <StudioCard label="Echecs" value={counts.error} hint="Taches a verifier" tone="red" icon={<XCircle className="w-4 h-4" />} />
        <div className="relative">
          <StudioCard
            label="Credits"
            value={creditsInfo?.remaining ?? 0}
            hint={creditsInfo ? `${creditsInfo.totalUsed || 0} generation(s) utilisee(s)` : 'Credits generes'}
            tone="amber"
            icon={<Sparkles className="w-4 h-4" />}
          />
          <button
            onClick={syncCredits}
            disabled={syncing}
            title="J'ai payé mais mes crédits n'ont pas été ajoutés"
            className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 text-[10px] font-bold transition disabled:opacity-60"
          >
            <RotateCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sync…' : 'Sync crédits'}
          </button>
          {syncResult && (
            <div className={`absolute -bottom-8 left-0 right-0 text-center text-[11px] font-semibold px-2 py-1 rounded-lg ${syncResult.startsWith('✓') ? 'bg-primary-50 text-primary-700' : 'bg-red-50 text-red-600'}`}>
              {syncResult}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {filterOptions.map((filter) => {
            const active = activeFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveFilter(filter.id)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition ${
                  active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span>{filter.label}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${active ? 'bg-white/20 text-white' : 'bg-white text-gray-500'}`}>
                  {filter.count}
                </span>
              </button>
            );
          })}
        </div>

        {visibleTasks.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary-50 rounded-2xl flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{pageMeta.emptyTitle}</h3>
            <p className="text-sm text-gray-500 mb-6">{pageMeta.emptyDescription}</p>
            <button
              onClick={() => navigate(
                storeTemplate === 'magazine'
                  ? '/ecom/boutique/products/premium-generator'
                  : '/ecom/boutique/products/generator',
                { state: { from: location.pathname } }
              )}
              className={`inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition ${
                storeTemplate === 'magazine'
                  ? 'border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800'
                  : 'bg-primary-600 hover:bg-primary-700 text-white'
              }`}
            >
              {storeTemplate === 'magazine' ? <Crown className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              {storeTemplate === 'magazine' ? 'Lancer une generation Premium' : 'Lancer une generation'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleTasks.map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                deleting={deleting}
                retrying={retrying}
                onDelete={handleDelete}
                onOpen={openTask}
                onApply={openTask}
                onRetry={handleRetry}
                onGenerateDigitalProduct={openDigitalProductModal}
                digitalProductLoading={digitalProductLoading}
              />
            ))}
          </div>
        )}
      </div>
      <DigitalProductEbookModal
        open={Boolean(digitalProductTarget)}
        productName={digitalProductTarget?.productName || digitalProductTarget?.product?.title || ''}
        existingEbook={digitalProductTarget?.product?.ebook || null}
        loading={digitalProductLoading === digitalProductTarget?._id}
        error={digitalProductError}
        generatedResult={digitalProductResult}
        onClose={() => {
          if (!digitalProductLoading) {
            setDigitalProductTarget(null);
            setDigitalProductResult(null);
          }
        }}
        onGenerate={handleGenerateDigitalProduct}
        onRegenerate={() => setDigitalProductResult(null)}
      />
    </div>
  );
}

function StudioCard({ label, value, hint, tone, icon }) {
  const toneClass = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    emerald: 'bg-primary-50 text-primary-700 border-primary-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
  }[tone] || 'bg-gray-50 text-gray-700 border-gray-100';

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
          <p className="mt-2 text-2xl font-black text-gray-900">{value}</p>
          <p className="mt-1 text-xs text-gray-500">{hint}</p>
        </div>
        <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl border ${toneClass}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function TaskCard({ task, deleting, retrying, digitalProductLoading, onDelete, onOpen, onApply, onRetry, onGenerateDigitalProduct }) {
  const config = statusConfig[task.status] || statusConfig.pending;
  const StatusIcon = config.icon;
  const isActive = !['done', 'error'].includes(task.status);
  const isDone = task.status === 'done';
  const isError = task.status === 'error';
  const hasSavedContent = Boolean(task.product);
  const hasDigitalProduct = Boolean(task.product?.ebook || task.product?.digitalProduct);
  const isPremium = task.product?.pageStyle === 'premium'
    || task.product?.layout === 'premium_product_page'
    || task.product?.theme === 'premium_product'
    || Boolean(task.product?.premium_page);
  const thumbnail = getTaskThumbnail(task);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-sm transition">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center shrink-0">
          {thumbnail ? (
            <img src={thumbnail} alt="Apercu generation" className="w-full h-full object-cover" />
          ) : (
            <Sparkles className="w-6 h-6 text-gray-300" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 truncate max-w-full">
              {task.productName || task.product?.title || 'Generation sans nom'}
            </h3>
            <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${config.color}`}>
              <StatusIcon className={`w-3 h-3 ${config.animate ? 'animate-spin' : ''}`} />
              {config.label}
            </span>
            {isPremium && (
              <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                <Crown className="w-3 h-3" />
                Premium
              </span>
            )}
            {hasDigitalProduct && (
              <span className="inline-flex items-center gap-1 text-[11px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                <FileText className="w-3 h-3" />
                Digital
              </span>
            )}
            {isError && hasSavedContent && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                <AlertCircle className="w-3 h-3" />
                Contenu sauve
              </span>
            )}
          </div>

          {isActive && (
            <div>
              <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                <span>{task.currentStep || 'En cours...'}</span>
                <span>{task.progressPercent || 0}%</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full transition-all duration-500"
                  style={{ width: `${task.progressPercent || 0}%` }}
                />
              </div>
            </div>
          )}

          {isError && (
            <div className="space-y-1">
              <p className="text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {task.errorMessage || 'La generation s\'est arretee avant la fin.'}
              </p>
              {hasSavedContent && (
                <p className="text-xs text-gray-500">
                  Le texte et les elements deja generes restent disponibles. Tu peux ouvrir le contenu ou relancer la suite.
                </p>
              )}
            </div>
          )}

          <p className="text-[11px] text-gray-400">
            Creee le {formatTaskDate(task.createdAt)}
            {task.updatedAt ? ` · mise a jour ${formatTaskDate(task.updatedAt)}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 lg:justify-end">
          {hasSavedContent && (
            <button
              onClick={() => onOpen(task._id)}
              className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-semibold rounded-xl transition"
              title="Ouvrir le contenu genere"
            >
              <Eye className="w-3.5 h-3.5" />
              Voir contenu
            </button>
          )}

          {hasSavedContent && (
            <button
              onClick={() => onGenerateDigitalProduct(task)}
              disabled={digitalProductLoading === task._id}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition disabled:opacity-60 ${
                hasDigitalProduct
                  ? 'border border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
              title="Produit digital de ce produit"
            >
              {digitalProductLoading === task._id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileText className="w-3.5 h-3.5" />
              )}
              Produit digital de ce produit
            </button>
          )}

          {isDone && (
            <button
              onClick={() => onApply(task._id)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-xl transition"
              title="Utiliser cette generation"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Utiliser
            </button>
          )}

          {isError && (
            <button
              onClick={() => onRetry(task._id)}
              disabled={retrying === task._id}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-xs font-semibold rounded-xl transition"
              title="Reprendre cette generation"
            >
              {retrying === task._id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RotateCw className="w-3.5 h-3.5" />
              )}
              Reprendre
            </button>
          )}

          <button
            onClick={() => onDelete(task._id)}
            disabled={deleting === task._id}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-red-100 text-red-500 hover:bg-red-50 disabled:opacity-50 text-xs font-semibold rounded-xl transition"
            title="Supprimer"
          >
            {deleting === task._id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}
