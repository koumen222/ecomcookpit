import React, { useEffect, useState } from 'react';
import { affiliateAdminApi } from '../services/affiliateAdminApi.js';

const fmt = (n) => (n || 0).toLocaleString('fr-FR');

export default function AffiliatesAdmin() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [config, setConfig] = useState(null);
  const [affiliates, setAffiliates] = useState([]);
  const [conversions, setConversions] = useState([]);
  const [form, setForm] = useState({ name: '', email: '', password: '', commissionType: 'fixed', commissionValue: 500 });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [cfg, aff, conv] = await Promise.all([
        affiliateAdminApi.getConfig(),
        affiliateAdminApi.getAffiliates(),
        affiliateAdminApi.getConversions({ page: 1, limit: 100 })
      ]);
      setConfig(cfg.data?.data || null);
      setAffiliates(aff.data?.data || []);
      setConversions(conv.data?.data?.items || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const saveConfig = async () => {
    try {
      await affiliateAdminApi.updateConfig({
        baseCommissionType: config.baseCommissionType,
        baseCommissionValue: Number(config.baseCommissionValue || 0),
        defaultLandingUrl: config.defaultLandingUrl
      });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Sauvegarde configuration impossible');
    }
  };

  const createAffiliate = async (e) => {
    e.preventDefault();
    try {
      await affiliateAdminApi.createAffiliate(form);
      setForm({ name: '', email: '', password: '', commissionType: 'fixed', commissionValue: 500 });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Création affilié impossible');
    }
  };

  const updateAffiliate = async (a, patch) => {
    try {
      await affiliateAdminApi.updateAffiliate(a.id || a._id, patch);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Mise à jour affilié impossible');
    }
  };

  const updateConversionStatus = async (id, status) => {
    try {
      await affiliateAdminApi.updateConversionStatus(id, { status });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Mise à jour conversion impossible');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Programme d'affiliation</h1>
          <p className="text-sm text-gray-500">Gestion complète des affiliés, liens et commissions.</p>
        </div>

        {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

        {loading ? <div className="p-6 bg-white rounded-xl border text-sm text-gray-500">Chargement...</div> : (
          <>
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-700">Configuration globale</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select value={config?.baseCommissionType || 'fixed'} onChange={(e) => setConfig((p) => ({ ...p, baseCommissionType: e.target.value }))} className="px-3 py-2 border rounded-lg">
                  <option value="fixed">Montant fixe</option>
                  <option value="percentage">Pourcentage</option>
                </select>
                <input value={config?.baseCommissionValue ?? 500} onChange={(e) => setConfig((p) => ({ ...p, baseCommissionValue: Number(e.target.value || 0) }))} type="number" className="px-3 py-2 border rounded-lg" />
                <input value={config?.defaultLandingUrl || ''} onChange={(e) => setConfig((p) => ({ ...p, defaultLandingUrl: e.target.value }))} placeholder="URL destination par défaut" className="px-3 py-2 border rounded-lg" />
              </div>
              <button onClick={saveConfig} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">Sauvegarder config</button>
              <p className="text-xs text-gray-500">Commission de base actuelle: {fmt(config?.baseCommissionValue)} {config?.baseCommissionType === 'fixed' ? 'FCFA' : '%'}</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Créer un affilié</h2>
                <form onSubmit={createAffiliate} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                  <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Nom" required className="px-3 py-2 border rounded-lg" />
                  <input value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="Email" type="email" required className="px-3 py-2 border rounded-lg" />
                  <input value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="Mot de passe initial" className="px-3 py-2 border rounded-lg" />
                  <select value={form.commissionType} onChange={(e) => setForm((p) => ({ ...p, commissionType: e.target.value }))} className="px-3 py-2 border rounded-lg">
                    <option value="fixed">Fixe</option>
                    <option value="percentage">%</option>
                  </select>
                  <input value={form.commissionValue} onChange={(e) => setForm((p) => ({ ...p, commissionValue: Number(e.target.value || 0) }))} type="number" className="px-3 py-2 border rounded-lg" />
                  <button className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">Créer affilié</button>
                </form>
            </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Affiliés ({affiliates.length})</h2>
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {affiliates.map((a) => {
                    const s = a.stats || {};
                    return (
                      <div key={a.id || a._id} className="p-4 border rounded-lg text-sm">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-semibold text-gray-800">{a.name} • <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{a.referralCode}</span></p>
                            <p className="text-xs text-gray-500">{a.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${a.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                              {a.isActive ? 'Actif' : 'Inactif'}
                            </span>
                            <button onClick={() => updateAffiliate(a, { isActive: !a.isActive })} className="px-2 py-1 text-xs rounded border hover:bg-gray-50">
                              {a.isActive ? 'Désactiver' : 'Activer'}
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                          <div className="bg-blue-50 rounded-lg p-2 text-center">
                            <p className="text-lg font-bold text-blue-700">{fmt(s.totalClicks)}</p>
                            <p className="text-[10px] text-blue-600">Clics</p>
                          </div>
                          <div className="bg-purple-50 rounded-lg p-2 text-center">
                            <p className="text-lg font-bold text-purple-700">{fmt(s.totalConversions)}</p>
                            <p className="text-[10px] text-purple-600">Conversions</p>
                          </div>
                          <div className="bg-amber-50 rounded-lg p-2 text-center">
                            <p className="text-lg font-bold text-amber-700">{fmt(s.totalSales)}</p>
                            <p className="text-[10px] text-amber-600">Ventes (FCFA)</p>
                          </div>
                          <div className="bg-emerald-50 rounded-lg p-2 text-center">
                            <p className="text-lg font-bold text-emerald-700">{fmt(s.totalCommissions)}</p>
                            <p className="text-[10px] text-emerald-600">Commissions (FCFA)</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500">
                          <span>{s.totalLinks || 0} lien{(s.totalLinks || 0) > 1 ? 's' : ''}</span>
                          <span>•</span>
                          <span>Commission: {a.commissionValue} {a.commissionType === 'fixed' ? 'FCFA' : '%'}</span>
                          {s.totalConversions > 0 && s.totalClicks > 0 && (
                            <>
                              <span>•</span>
                              <span>Taux conversion: {((s.totalConversions / s.totalClicks) * 100).toFixed(1)}%</span>
                            </>
                          )}
                        </div>

                        {(s.pendingCommissions > 0 || s.approvedCommissions > 0 || s.paidCommissions > 0) && (
                          <div className="flex items-center gap-3 mt-1 text-[10px]">
                            {s.pendingCommissions > 0 && <span className="text-yellow-600">En attente: {fmt(s.pendingCommissions)}</span>}
                            {s.approvedCommissions > 0 && <span className="text-blue-600">Approuvées: {fmt(s.approvedCommissions)}</span>}
                            {s.paidCommissions > 0 && <span className="text-emerald-600">Payées: {fmt(s.paidCommissions)}</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Conversions ({conversions.length})</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="px-2 py-2 text-left">Affilié</th>
                      <th className="px-2 py-2 text-left">Commande</th>
                      <th className="px-2 py-2 text-right">Montant</th>
                      <th className="px-2 py-2 text-right">Commission</th>
                      <th className="px-2 py-2 text-left">Statut</th>
                      <th className="px-2 py-2 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conversions.map((c) => (
                      <tr key={c._id} className="border-b">
                        <td className="px-2 py-2">{c.affiliateId?.name || c.affiliateCode}</td>
                        <td className="px-2 py-2">{c.orderNumber || '—'}</td>
                        <td className="px-2 py-2 text-right">{fmt(c.orderAmount)}</td>
                        <td className="px-2 py-2 text-right text-emerald-700 font-semibold">{fmt(c.commissionAmount)}</td>
                        <td className="px-2 py-2">{c.status}</td>
                        <td className="px-2 py-2">
                          <div className="flex gap-1">
                            {['pending', 'approved', 'paid', 'rejected'].map((s) => (
                              <button key={s} onClick={() => updateConversionStatus(c._id, s)} className="px-2 py-1 border rounded text-[10px]">{s}</button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
