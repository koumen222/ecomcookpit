import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';

const STATUS_LABELS = {
  pending: 'En attente', confirmed: 'Confirmée', shipped: 'En transit',
  delivered: 'Livrée', returned: 'Retour', cancelled: 'Annulée',
};
const STATUS_META = {
  confirmed: { bg: '#eff6ff', text: '#053326' },
  shipped: { bg: '#eef2ff', text: '#3730a3' },
  delivered: { bg: '#ecfdf5', text: '#065f46' },
  returned: { bg: '#fff7ed', text: '#9a3412' },
  cancelled: { bg: '#fef2f2', text: '#991b1b' },
  pending: { bg: '#fffbeb', text: '#92400e' },
};

const LivreurDeliveryDetail = () => {
  const { id } = useParams();
  const { user } = useEcomAuth();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { loadOrder(); }, [id]);

  const loadOrder = async () => {
    setLoading(true);
    try {
      const res = await ecomApi.get(`/orders/${id}`);
      setOrder(res.data?.data || null);
    } catch { setError('Commande introuvable.'); }
    finally { setLoading(false); }
  };

  const handleAction = async (action) => {
    setActing(true); setError('');
    try {
      await ecomApi.patch(`/orders/${id}/livreur-action`, { action });
      setSuccess(action === 'delivered' ? 'Livraison confirmée !' : action === 'pickup_confirmed' ? 'Récupération confirmée !' : 'Action enregistrée.');
      loadOrder();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur.');
    } finally { setActing(false); }
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-amber-600 animate-spin" />
      <p className="text-sm text-gray-400">Chargement…</p>
    </div>
  );

  if (!order) return (
    <div className="p-6 text-center">
      <p className="text-gray-500">Commande introuvable</p>
      <button onClick={() => navigate(-1)} className="text-sm text-[#0F6B4F] font-medium mt-3 inline-block">← Retour</button>
    </div>
  );

  const sm = STATUS_META[order.status] || { bg: '#f9fafb', text: '#374151' };
  const isMyOrder = order.assignedLivreur === user?._id || order.assignedLivreur?._id === user?._id;

  return (
    <div className="p-3 sm:p-6 max-w-[700px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">Détail de la commande</h1>
          <p className="text-xs text-gray-400">#{order.orderId || id.slice(-8)}</p>
        </div>
        <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: sm.bg, color: sm.text }}>
          {STATUS_LABELS[order.status] || order.status}
        </span>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">{success}</div>}

      {/* Client Info */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">👤 Client</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Nom</span>
            <span className="text-sm font-semibold text-gray-900">{order.clientName || '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Téléphone</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">{order.clientPhone || '—'}</span>
              {order.clientPhone && (
                <a href={`tel:${order.clientPhone}`} className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition">📞</a>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Ville</span>
            <span className="text-sm text-gray-700">{order.city || '—'}</span>
          </div>
          {order.address && (
            <div className="flex items-start justify-between">
              <span className="text-xs text-gray-400">Adresse</span>
              <span className="text-sm text-gray-700 text-right max-w-[60%]">{order.address}</span>
            </div>
          )}
        </div>
      </div>

      {/* Produit */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">📦 Produit</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Article</span>
            <span className="text-sm font-semibold text-gray-900">{order.product || '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Quantité</span>
            <span className="text-sm text-gray-700">{order.quantity || 1}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Prix</span>
            <span className="text-sm font-bold text-[#0F6B4F]">{order.price ? Number(order.price).toLocaleString('fr-FR') + ' FCFA' : '—'}</span>
          </div>
        </div>
      </div>

      {/* Dates */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">📅 Chronologie</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">Créée le</span>
            <span className="text-xs text-gray-600">{fmtDate(order.date || order.createdAt)}</span>
          </div>
          {order.confirmedAt && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Confirmée le</span>
              <span className="text-xs text-gray-600">{fmtDate(order.confirmedAt)}</span>
            </div>
          )}
          {order.shippedAt && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Expédiée le</span>
              <span className="text-xs text-gray-600">{fmtDate(order.shippedAt)}</span>
            </div>
          )}
          {order.deliveredAt && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Livrée le</span>
              <span className="text-xs text-emerald-600 font-medium">{fmtDate(order.deliveredAt)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">📝 Notes</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{order.notes}</p>
        </div>
      )}

      {/* Actions */}
      {isMyOrder && ['confirmed', 'shipped'].includes(order.status) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">⚡ Actions</h2>
          {order.status === 'confirmed' && (
            <button onClick={() => handleAction('pickup_confirmed')} disabled={acting} className="w-full py-3 bg-amber-500 text-white rounded-xl font-semibold text-sm hover:bg-amber-600 transition disabled:opacity-50">
              {acting ? 'Traitement…' : '📦 Confirmer la récupération'}
            </button>
          )}
          {order.status === 'shipped' && (
            <button onClick={() => handleAction('delivered')} disabled={acting} className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold text-sm hover:bg-green-700 transition disabled:opacity-50">
              {acting ? 'Traitement…' : '✅ Confirmer la livraison'}
            </button>
          )}
          <button onClick={() => handleAction('issue')} disabled={acting} className="w-full py-2.5 bg-gray-100 text-gray-600 rounded-xl font-medium text-xs hover:bg-gray-200 transition disabled:opacity-50">
            ⚠️ Signaler un problème
          </button>
        </div>
      )}

      {/* Navigation Map */}
      {order.address && (order.city || order.address) && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((order.address || '') + ' ' + (order.city || ''))}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition text-center"
        >
          <p className="text-sm font-semibold text-[#0F6B4F]">🗺️ Ouvrir dans Google Maps</p>
          <p className="text-xs text-gray-400 mt-0.5">{order.address}, {order.city}</p>
        </a>
      )}
    </div>
  );
};

export default LivreurDeliveryDetail;
