import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';

const STATUS_LABELS = {
  pending: 'En attente', confirmed: 'Acceptée', shipped: 'En transit',
  delivered: 'Livrée', returned: 'Retour', cancelled: 'Annulée',
  unreachable: 'Injoignable', called: 'Appelé', postponed: 'Reporté',
};
const STATUS_META = {
  confirmed:   { dot: 'bg-blue-500',    pill: 'bg-blue-50 text-blue-700 border border-blue-100' },
  shipped:     { dot: 'bg-indigo-500',  pill: 'bg-indigo-50 text-indigo-700 border border-indigo-100' },
  delivered:   { dot: 'bg-emerald-500', pill: 'bg-emerald-50 text-emerald-700 border border-emerald-100' },
  returned:    { dot: 'bg-orange-500',  pill: 'bg-orange-50 text-orange-700 border border-orange-100' },
  cancelled:   { dot: 'bg-red-400',     pill: 'bg-red-50 text-red-700 border border-red-100' },
  pending:     { dot: 'bg-yellow-400',  pill: 'bg-yellow-50 text-yellow-700 border border-yellow-100' },
  unreachable: { dot: 'bg-gray-400',    pill: 'bg-gray-50 text-gray-600 border border-gray-200' },
  called:      { dot: 'bg-sky-400',     pill: 'bg-sky-50 text-sky-700 border border-sky-100' },
  postponed:   { dot: 'bg-violet-400',  pill: 'bg-violet-50 text-violet-700 border border-violet-100' },
};

const TABS = [
  { key: '', label: 'Tout' },
  { key: 'confirmed', label: 'Acceptées' },
  { key: 'shipped', label: 'En transit' },
  { key: 'delivered', label: 'Livrées' },
  { key: 'returned', label: 'Retours' },
  { key: 'cancelled', label: 'Annulées' },
];

const CHANGEABLE_STATUSES = ['confirmed', 'shipped', 'delivered', 'returned', 'cancelled', 'pending'];

function timeAgo(date) {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

const Loader = () => (
  <div className="flex flex-col items-center justify-center h-64 gap-4">
    <div className="w-10 h-10 rounded-full border-4 border-gray-200 border-t-amber-600 animate-spin" />
    <p className="text-sm text-gray-400 font-medium">Chargement…</p>
  </div>
);

// ─── Modal Reassign Livreur ────────────────────────────────────────────────────
const ReassignModal = ({ order, livreurs, onClose, onSave }) => {
  const [selected, setSelected] = useState(
    typeof order.assignedLivreur === 'object' ? order.assignedLivreur?._id : order.assignedLivreur || ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await ecomApi.put(`/orders/${order._id}`, { assignedLivreur: selected || null });
      onSave(order._id, selected, livreurs.find(l => l._id === selected));
      onClose();
    } catch (e) {
      setError(e.response?.data?.message || 'Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">Réassigner le livreur</h3>
            <p className="text-xs text-gray-400 mt-0.5">{order.clientName} · #{order.orderId}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5 space-y-3">
          {error && <div className="bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg">{error}</div>}
          <div className="space-y-2">
            <button
              onClick={() => setSelected('')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm transition ${!selected ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs">—</div>
              <span className="font-medium">Aucun livreur</span>
              {!selected && <svg className="w-4 h-4 ml-auto text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
            </button>
            {livreurs.map(l => (
              <button
                key={l._id}
                onClick={() => setSelected(l._id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm transition ${selected === l._id ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">
                  {(l.name || l.email).charAt(0).toUpperCase()}
                </div>
                <div className="text-left">
                  <div className="font-medium text-gray-900">{l.name || l.email}</div>
                  {l.name && <div className="text-[11px] text-gray-400">{l.email}</div>}
                </div>
                {selected === l._id && <svg className="w-4 h-4 ml-auto text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
              </button>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Status Dropdown ──────────────────────────────────────────────────────────
const StatusDropdown = ({ order, onClose, onSave }) => {
  const [saving, setSaving] = useState(false);

  const handleSelect = async (newStatus) => {
    if (newStatus === order.status) return onClose();
    setSaving(true);
    try {
      await ecomApi.patch(`/orders/${order._id}/status`, { status: newStatus });
      onSave(order._id, newStatus);
      onClose();
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-xs shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Changer le statut</p>
          <p className="text-sm font-medium text-gray-800 mt-0.5">{order.clientName}</p>
        </div>
        {saving ? (
          <div className="flex justify-center py-6"><div className="w-6 h-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : (
          <div className="py-1">
            {CHANGEABLE_STATUSES.map(s => {
              const m = STATUS_META[s] || STATUS_META.pending;
              const active = order.status === s;
              return (
                <button
                  key={s}
                  onClick={() => handleSelect(s)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition hover:bg-gray-50 ${active ? 'font-semibold text-amber-700 bg-amber-50' : 'text-gray-700'}`}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${m.dot}`} />
                  {STATUS_LABELS[s] || s}
                  {active && <svg className="w-4 h-4 ml-auto text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Order Row ────────────────────────────────────────────────────────────────
const OrderRow = ({ order, navigate, livreurs, onStatusChange, onLivreurChange, onUnassign }) => {
  const { fmt } = useMoney();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [unassigning, setUnassigning] = useState(false);
  const menuRef = useRef(null);

  const sm = STATUS_META[order.status] || STATUS_META.pending;
  const livreur = order.assignedLivreur;
  const livreurName = typeof livreur === 'object' ? (livreur?.name || livreur?.email || '—') : '—';
  const livreurId = typeof livreur === 'object' ? livreur?._id : livreur;
  const total = (order.price || 0) * (order.quantity || 1);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleUnassign = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Désassigner ${livreurName} de cette commande ?`)) return;
    setUnassigning(true);
    try {
      await ecomApi.put(`/orders/${order._id}`, { assignedLivreur: null });
      onUnassign(order._id);
    } catch { /* silent */ }
    finally { setUnassigning(false); setMenuOpen(false); }
  };

  return (
    <>
      <div className="bg-white border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all rounded-xl p-3 flex items-center gap-3 group">
        {/* Status dot */}
        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${sm.dot}`} />

        {/* Main content - clickable to order detail */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/ecom/orders/${order._id}`)}>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 truncate">{order.clientName || 'Client'}</span>
            {order.orderId && <span className="text-[11px] text-gray-300 flex-shrink-0">#{order.orderId}</span>}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 flex-wrap">
            <span className="font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md">{livreurName}</span>
            {order.city && <span>· {order.city}</span>}
            {order.product && <span className="truncate max-w-[100px]">· {order.product}</span>}
          </div>
        </div>

        {/* Right side: price + status + time + menu */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {total > 0 && (
            <span className="hidden sm:block text-xs font-semibold text-gray-700">{fmt(total)}</span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setShowStatusModal(true); }}
            className={`text-[11px] px-2 py-0.5 rounded-full font-medium border transition hover:opacity-80 ${sm.pill}`}
          >
            {STATUS_LABELS[order.status] || order.status}
          </button>
          <span className="text-[11px] text-gray-300 w-6 text-right">{timeAgo(order.updatedAt)}</span>

          {/* 3-dot menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-7 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); navigate(`/ecom/orders/${order._id}`); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  Voir la commande
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setShowStatusModal(true); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                  Changer le statut
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); setShowReassignModal(true); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                  Réassigner livreur
                </button>
                {livreurId && (
                  <>
                    <div className="my-1 border-t border-gray-100" />
                    <button
                      onClick={handleUnassign}
                      disabled={unassigning}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" /></svg>
                      {unassigning ? 'En cours…' : 'Désassigner'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showStatusModal && (
        <StatusDropdown
          order={order}
          onClose={() => setShowStatusModal(false)}
          onSave={(id, status) => { onStatusChange(id, status); setShowStatusModal(false); }}
        />
      )}
      {showReassignModal && (
        <ReassignModal
          order={order}
          livreurs={livreurs}
          onClose={() => setShowReassignModal(false)}
          onSave={(id, livreurId, livreurObj) => { onLivreurChange(id, livreurId, livreurObj); }}
        />
      )}
    </>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const LivreurManagement = () => {
  const { user } = useEcomAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [livreurs, setLivreurs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [tab, setTab] = useState('');
  const [filterLivreur, setFilterLivreur] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const pollingRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const params = { page, limit: 50 };
      if (tab) params.status = tab;
      if (filterLivreur) params.livreurId = filterLivreur;
      if (debouncedSearch) params.search = debouncedSearch;

      const res = await ecomApi.get('/orders/livreur-tracking', { params });
      const d = res.data?.data || {};
      setOrders(d.orders || []);
      setStats(d.stats || {});
      setLivreurs(d.livreurs || []);
      setPagination(d.pagination || { page: 1, pages: 1, total: 0 });
    } catch {
      if (!silent) setError('Erreur de chargement.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [tab, filterLivreur, debouncedSearch, page]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    const id = setInterval(() => {
      if (!pollingRef.current) {
        pollingRef.current = true;
        loadData(true).finally(() => { pollingRef.current = false; });
      }
    }, 15000);
    return () => clearInterval(id);
  }, [loadData]);

  useEffect(() => {
    const handleOrderStatusChanged = (event) => {
      const { _id, status, updatedAt } = event.detail || {};
      if (!_id || !status) return;
      setOrders(prev => prev.map(o =>
        String(o._id) === String(_id) ? { ...o, status, updatedAt: updatedAt ?? o.updatedAt } : o
      ));
    };
    window.addEventListener('ecom:orderStatusChanged', handleOrderStatusChanged);
    return () => window.removeEventListener('ecom:orderStatusChanged', handleOrderStatusChanged);
  }, []);

  useEffect(() => { setPage(1); }, [tab, filterLivreur, debouncedSearch]);
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 4000); return () => clearTimeout(t); } }, [success]);

  const handleStatusChange = useCallback((orderId, newStatus) => {
    setOrders(prev => prev.map(o => String(o._id) === String(orderId) ? { ...o, status: newStatus, updatedAt: new Date().toISOString() } : o));
    setStats(prev => {
      const oldOrder = orders.find(o => String(o._id) === String(orderId));
      if (!oldOrder) return prev;
      return { ...prev, [oldOrder.status]: Math.max(0, (prev[oldOrder.status] || 0) - 1), [newStatus]: (prev[newStatus] || 0) + 1 };
    });
    setSuccess('Statut mis à jour.');
  }, [orders]);

  const handleLivreurChange = useCallback((orderId, newLivreurId, livreurObj) => {
    setOrders(prev => prev.map(o =>
      String(o._id) === String(orderId)
        ? { ...o, assignedLivreur: livreurObj ? { _id: newLivreurId, name: livreurObj.name, email: livreurObj.email } : null }
        : o
    ));
    setSuccess('Livreur réassigné.');
  }, []);

  const handleUnassign = useCallback((orderId) => {
    setOrders(prev => prev.filter(o => String(o._id) !== String(orderId)));
    setSuccess('Livreur désassigné.');
  }, []);

  const totalAssigned = (stats.confirmed || 0) + (stats.shipped || 0) + (stats.delivered || 0) + (stats.returned || 0) + (stats.cancelled || 0);

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 flex-shrink-0">
        <div className="px-4 sm:px-6 pt-4 pb-3">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-white flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-gray-900">Suivi des livraisons</h1>
              <p className="text-xs text-gray-400">{pagination.total} commande{pagination.total !== 1 ? 's' : ''} · {stats.livreursActifs || 0} livreur{(stats.livreursActifs || 0) !== 1 ? 's' : ''} actifs</p>
            </div>
            <button onClick={() => loadData()} className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          </div>

          {/* Stats row */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mb-3">
            {[
              { label: 'Total', value: totalAssigned, dot: 'bg-gray-400' },
              { label: 'Acceptées', value: stats.confirmed || 0, dot: STATUS_META.confirmed.dot },
              { label: 'En transit', value: stats.shipped || 0, dot: STATUS_META.shipped.dot },
              { label: 'Livrées', value: stats.delivered || 0, dot: STATUS_META.delivered.dot },
              { label: 'Retours', value: (stats.returned || 0) + (stats.cancelled || 0), dot: STATUS_META.returned.dot },
            ].map(({ label, value, dot }) => (
              <div key={label} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-3 py-1.5 flex-shrink-0 border border-gray-100">
                <span className={`w-2 h-2 rounded-full ${dot}`} />
                <span className="text-xs font-bold text-gray-700">{value}</span>
                <span className="text-[11px] text-gray-400">{label}</span>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto scrollbar-hide mb-3">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  tab === t.key
                    ? 'bg-amber-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {t.label}
                {t.key && stats[t.key] ? <span className={`ml-1 text-[10px] ${tab === t.key ? 'text-amber-200' : 'text-gray-400'}`}>({stats[t.key]})</span> : null}
              </button>
            ))}
          </div>

          {/* Search + filter */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Rechercher client, téléphone, ville, produit…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-transparent"
              />
              <svg className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
            <select
              value={filterLivreur}
              onChange={e => setFilterLivreur(e.target.value)}
              className="text-sm bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500/30 min-w-0 max-w-[150px] sm:max-w-[200px]"
            >
              <option value="">Tous les livreurs</option>
              {livreurs.map(l => (
                <option key={l._id} value={l._id}>{l.name || l.email}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {success && (
        <div className="mx-4 sm:mx-6 mt-3 flex-shrink-0 bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm px-4 py-2.5 rounded-xl flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          {success}
        </div>
      )}
      {error && (
        <div className="mx-4 sm:mx-6 mt-3 flex-shrink-0 bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-2.5 rounded-xl">{error}</div>
      )}

      {/* ── List ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 pt-3 pb-6 space-y-1.5">
        {loading ? (
          <Loader />
        ) : orders.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-3">🚚</div>
            <p className="text-gray-500 font-medium">Aucune commande trouvée</p>
            <p className="text-gray-400 text-sm mt-1">
              {search || tab || filterLivreur ? 'Modifiez vos filtres.' : 'Aucune commande n\'a encore été assignée à un livreur.'}
            </p>
          </div>
        ) : (
          <>
            {orders.map(order => (
              <OrderRow
                key={order._id}
                order={order}
                navigate={navigate}
                livreurs={livreurs}
                onStatusChange={handleStatusChange}
                onLivreurChange={handleLivreurChange}
                onUnassign={handleUnassign}
              />
            ))}

            {pagination.pages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-4">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-4 py-2 text-xs font-medium bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 transition"
                >
                  ← Précédent
                </button>
                <span className="text-xs text-gray-500 font-medium">{page} / {pagination.pages}</span>
                <button
                  onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                  disabled={page >= pagination.pages}
                  className="px-4 py-2 text-xs font-medium bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 transition"
                >
                  Suivant →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default LivreurManagement;
