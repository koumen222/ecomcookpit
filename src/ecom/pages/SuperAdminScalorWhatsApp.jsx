import React, { useState, useEffect } from 'react';
import ecomApi from '../services/ecommApi.js';
import { getContextualError } from '../utils/errorMessages';

const PLAN_LABELS = { starter: 'Starter', pro: 'Pro', business: 'Business', enterprise: 'Enterprise' };
const PLAN_COLORS = {
  starter:    'bg-gray-100 text-gray-600',
  pro:        'bg-primary-100 text-primary-700',
  business:   'bg-blue-100 text-blue-700',
  enterprise: 'bg-amber-100 text-amber-700',
};
const STATUS_COLORS = {
  sent:    'bg-primary-100 text-primary-700',
  failed:  'bg-red-100 text-red-700',
  skipped: 'bg-amber-100 text-amber-700',
};
const fmt = d => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

export default function SuperAdminScalorWhatsApp() {
  const [allUsers, setAllUsers] = useState([]);
  const [adminInstance, setAdminInstance] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState('');
  const [filterHasPhone, setFilterHasPhone] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [message, setMessage] = useState('');
  const [sendAll, setSendAll] = useState(false);
  const [sendAllPlan, setSendAllPlan] = useState('');
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoadingUsers(true);
      setError('');
      try {
        const res = await ecomApi.get('/super-admin/scalor-users/whatsapp');
        setAllUsers(res.data.data.users || []);
        setAdminInstance(res.data.data.adminInstance || null);
      } catch (e) {
        setError(getContextualError(e, 'load_users'));
      } finally {
        setLoadingUsers(false);
      }
    };
    load();
  }, []);

  // Filtrage côté client
  const users = allUsers.filter(u => {
    if (filterPlan && u.plan !== filterPlan) return false;
    if (filterHasPhone && !u.phone) return false;
    if (search) {
      const q = search.toLowerCase();
      return (u.name || '').toLowerCase().includes(q)
        || (u.email || '').toLowerCase().includes(q)
        || (u.phone || '').toLowerCase().includes(q);
    }
    return true;
  });

  const toggleUser = id => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const withPhone = users.filter(u => u.phone);
    if (selected.size === withPhone.length && withPhone.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(withPhone.map(u => u._id)));
    }
  };

  const handleSend = async () => {
    setError('');
    setResults(null);
    if (!message.trim()) { setError('Rédigez un message avant d\'envoyer.'); return; }
    if (!sendAll && selected.size === 0) { setError('Sélectionnez au moins un destinataire.'); return; }

    const count = sendAll ? '(tous les utilisateurs avec numéro)' : `${selected.size} utilisateur(s)`;
    if (!window.confirm(`Envoyer ce message à ${count} via ${adminInstance?.customName || adminInstance?.instanceName} ?`)) return;

    setSending(true);
    try {
      const body = { message };
      if (sendAll) {
        body.allUsers = true;
        if (sendAllPlan) body.plan = sendAllPlan;
      } else {
        body.userIds = Array.from(selected);
      }
      const res = await ecomApi.post('/super-admin/scalor-users/whatsapp/send', body);
      setResults(res.data.data);
      setSelected(new Set());
    } catch (e) {
      setError(getContextualError(e, 'load_stats'));
    } finally {
      setSending(false);
    }
  };

  const usersWithPhone = users.filter(u => u.phone);
  const totalWithPhone = allUsers.filter(u => u.phone).length;

  const instanceOk = adminInstance && ['connected', 'active', 'configured'].includes(adminInstance.status);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp — Utilisateurs Scalor</h1>
          <p className="text-sm text-gray-500 mt-1">Envoyez des messages WhatsApp aux utilisateurs de la plateforme Scalor.</p>
        </div>
        {/* Badge instance */}
        {adminInstance ? (
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium ${instanceOk ? 'bg-primary-50 border-primary-200 text-primary-700' : 'bg-red-50 border-red-200 text-red-600'}`}>
            <span className={`w-2 h-2 rounded-full ${instanceOk ? 'bg-primary-500' : 'bg-red-400'}`} />
            {adminInstance.customName || adminInstance.instanceName}
            <span className="text-[10px] font-bold uppercase opacity-60">{adminInstance.status}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border bg-amber-50 border-amber-200 text-amber-700 text-sm font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Aucune instance configurée
            <a href="/ecom/super-admin/support" className="underline text-xs">Configurer</a>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Liste utilisateurs */}
        <div className="lg:col-span-2 space-y-3">
          {/* Filtres */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Nom, email, téléphone…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              />
              <select
                value={filterPlan}
                onChange={e => setFilterPlan(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              >
                <option value="">Tous les plans</option>
                {Object.entries(PLAN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer whitespace-nowrap">
                <input type="checkbox" checked={filterHasPhone} onChange={e => setFilterHasPhone(e.target.checked)} className="rounded" />
                Avec téléphone
              </label>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>
                {users.length}/{allUsers.length} utilisateur(s) —{' '}
                <span className="text-primary-600 font-semibold">{usersWithPhone.length} avec téléphone</span>
                {allUsers.length > 0 && <span className="text-gray-300 ml-1">({totalWithPhone} total)</span>}
              </span>
              {!sendAll && usersWithPhone.length > 0 && (
                <button onClick={toggleAll} className="text-gray-500 hover:text-gray-900 font-medium transition">
                  {selected.size === usersWithPhone.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
              )}
            </div>
          </div>

          {/* Liste */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {loadingUsers ? (
              <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Chargement…</div>
            ) : users.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Aucun utilisateur trouvé.</div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[440px] overflow-y-auto">
                {users.map(u => {
                  const hasPhone = !!u.phone;
                  const isChecked = selected.has(u._id);
                  return (
                    <div
                      key={u._id}
                      onClick={() => !sendAll && hasPhone && toggleUser(u._id)}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors ${!sendAll && hasPhone ? 'cursor-pointer hover:bg-gray-50' : ''} ${!hasPhone ? 'opacity-40' : ''} ${isChecked ? 'bg-primary-50/50' : ''}`}
                    >
                      {!sendAll && (
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={!hasPhone}
                          onChange={() => toggleUser(u._id)}
                          onClick={e => e.stopPropagation()}
                          className="rounded flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900 truncate">{u.name}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${PLAN_COLORS[u.plan] || 'bg-gray-100 text-gray-600'}`}>
                            {PLAN_LABELS[u.plan] || u.plan}
                          </span>
                          {!u.isActive && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">Inactif</span>}
                        </div>
                        <p className="text-xs text-gray-400 truncate">{u.email}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {hasPhone
                          ? <p className="text-xs font-medium text-gray-700">{u.phone}</p>
                          : <p className="text-xs text-gray-300 italic">Pas de numéro</p>
                        }
                        <p className="text-[10px] text-gray-300">{fmt(u.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Panneau de composition */}
        <div className="space-y-4">
          {/* Destinataires */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <h3 className="text-sm font-bold text-gray-900">Destinataires</h3>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={sendAll}
                onChange={e => { setSendAll(e.target.checked); setSelected(new Set()); }}
                className="rounded"
              />
              Tous les utilisateurs
            </label>
            {sendAll ? (
              <select
                value={sendAllPlan}
                onChange={e => setSendAllPlan(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              >
                <option value="">Tous les plans</option>
                {Object.entries(PLAN_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            ) : (
              <p className="text-xs text-gray-400">
                {selected.size === 0 ? 'Aucun sélectionné' : `${selected.size} sélectionné(s)`}
              </p>
            )}
          </div>

          {/* Message */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
            <h3 className="text-sm font-bold text-gray-900">Message</h3>
            <textarea
              rows={7}
              placeholder="Rédigez votre message…"
              value={message}
              onChange={e => setMessage(e.target.value)}
              maxLength={4000}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 resize-none"
            />
            <p className="text-[10px] text-gray-300 text-right">{message.length}/4000</p>
          </div>

          <button
            onClick={handleSend}
            disabled={sending || !instanceOk}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 text-white rounded-xl text-sm font-semibold transition"
          >
            {sending ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Envoi en cours…</>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Envoyer
              </>
            )}
          </button>

          {!instanceOk && !sending && (
            <p className="text-xs text-amber-600 text-center">
              {adminInstance ? 'Instance déconnectée.' : 'Aucune instance configurée.'}{' '}
              <a href="/ecom/super-admin/support" className="underline font-semibold">Configurer →</a>
            </p>
          )}
        </div>
      </div>

      {/* Résultats */}
      {results && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="text-sm font-bold text-gray-900">Rapport d'envoi</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Envoyés', value: results.sent, cls: 'bg-primary-50 text-primary-600' },
              { label: 'Échoués', value: results.failed, cls: 'bg-red-50 text-red-500' },
              { label: 'Ignorés', value: results.skipped, cls: 'bg-amber-50 text-amber-500' },
            ].map(s => (
              <div key={s.label} className={`text-center rounded-lg p-3 ${s.cls}`}>
                <p className="text-2xl font-black">{s.value}</p>
                <p className="text-[10px] font-bold uppercase opacity-70">{s.label}</p>
              </div>
            ))}
          </div>
          {results.results?.length > 0 && (
            <div className="max-h-56 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg text-xs">
              {results.results.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 gap-3">
                  <div className="min-w-0">
                    <span className="font-semibold text-gray-800">{r.name}</span>
                    <span className="text-gray-400 ml-2">{r.phone}</span>
                    {r.error && <span className="text-red-500 ml-2">— {r.error}</span>}
                  </div>
                  <span className={`flex-shrink-0 font-bold px-2 py-0.5 rounded-full text-[10px] uppercase ${STATUS_COLORS[r.status] || 'bg-gray-100 text-gray-500'}`}>
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
