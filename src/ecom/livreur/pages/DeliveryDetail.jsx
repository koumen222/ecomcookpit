import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Phone,
  Package,
  User,
  Navigation,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Truck,
  Clock,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { livreurApi } from '../services/livreurApi.js';
import { useEcomAuth } from '../../hooks/useEcomAuth.jsx';

const STATUS_FLOW = {
  confirmed: {
    label: 'Acceptée',
    color: 'bg-blue-100 text-blue-800',
    icon: '📦',
    description: 'Vous devez récupérer le colis au point de départ.',
    actions: [
      { id: 'pickup_confirmed', label: 'Confirmer la récupération', color: 'bg-amber-500 hover:bg-amber-600', icon: CheckCircle2 },
      { id: 'refused', label: 'Refuser la course', color: 'bg-red-100 text-red-600 border border-red-200', icon: XCircle },
    ],
  },
  shipped: {
    label: 'En transit',
    color: 'bg-indigo-100 text-indigo-800',
    icon: '🚚',
    description: 'Le colis est en route vers le client.',
    actions: [
      { id: 'delivered', label: 'Marquer comme livré', color: 'bg-green-600 hover:bg-green-700', icon: CheckCircle2 },
      { id: 'issue', label: 'Signaler un problème', color: 'bg-orange-100 text-orange-700 border border-orange-200', icon: AlertCircle },
    ],
  },
  delivered: {
    label: 'Livré ✓',
    color: 'bg-green-100 text-green-800',
    icon: '✅',
    description: 'Cette commande a été livrée avec succès.',
    actions: [],
  },
  returned: {
    label: 'Retour',
    color: 'bg-orange-100 text-orange-800',
    icon: '↩️',
    description: 'Cette commande est en retour.',
    actions: [],
  },
  pending: {
    label: 'En attente',
    color: 'bg-gray-100 text-gray-700',
    icon: '⏳',
    description: 'En attente d\'assignation.',
    actions: [],
  },
};

export default function DeliveryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useEcomAuth();
  const localUser = user || JSON.parse(localStorage.getItem('ecomUser') || 'null');

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [copied, setCopied] = useState(false);

  const loadOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await livreurApi.getOrder(id);
      setOrder(res.data?.data || res.data);
    } catch {
      setError('Commande introuvable.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
  }, [id]);

  const handleAction = async (action) => {
    setActionLoading(action);
    setError(null);
    try {
      const res = await livreurApi.livreurAction(id, action);
      const updated = res.data?.data;
      setOrder(updated);
      const messages = {
        pickup_confirmed: 'Récupération confirmée ! Bonne route.',
        delivered: 'Livraison confirmée ! Bravo.',
        refused: 'Course refusée.',
        issue: 'Problème signalé.',
      };
      setSuccess(messages[action] || 'Action enregistrée.');
      if (action === 'refused') {
        setTimeout(() => navigate('/ecom/livreur/available'), 1500);
      }
      if (action === 'delivered') {
        setTimeout(() => navigate('/ecom/livreur/history'), 1500);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible d\'effectuer cette action.');
    } finally {
      setActionLoading(null);
    }
  };

  const copyPhone = () => {
    if (order?.clientPhone) {
      navigator.clipboard.writeText(order.clientPhone).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const callPhone = () => {
    if (order?.clientPhone) {
      window.location.href = `tel:${order.clientPhone}`;
    }
  };

  const openMaps = () => {
    const addr = order?.address || order?.city || '';
    if (addr) {
      window.open(`https://maps.google.com/?q=${encodeURIComponent(addr)}`, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <XCircle size={48} className="text-red-300 mb-3" />
        <p className="text-gray-600 font-medium">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 text-indigo-600 text-sm"
        >
          ← Retour
        </button>
      </div>
    );
  }

  if (!order) return null;

  const config = STATUS_FLOW[order.status] || STATUS_FLOW.pending;
  const isMyOrder = order.assignedLivreur?.toString() === localUser?._id?.toString() ||
    ['ecom_admin', 'super_admin'].includes(localUser?.role);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center active:scale-95"
          >
            <ArrowLeft size={18} className="text-gray-600" />
          </button>
          <div className="flex-1">
            <p className="text-xs text-gray-400 font-mono">{order.orderId}</p>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Détail livraison</h1>
          </div>
          <Link
            to={`/ecom/livreur/delivery/${id}/map`}
            className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center active:scale-95"
          >
            <Navigation size={18} className="text-indigo-600" />
          </Link>
        </div>

        {/* Status badge */}
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${config.color}`}>
          <span>{config.icon}</span>
          {config.label}
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Feedback */}
        {success && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 text-green-700 text-sm">
            <CheckCircle2 size={18} />
            {success}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">
            <XCircle size={18} />
            {error}
          </div>
        )}

        {/* Status description */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
          <p className="text-indigo-700 text-sm">{config.description}</p>
        </div>

        {/* Client info */}
        <InfoCard title="Client" icon={<User size={16} className="text-indigo-500" />}>
          <p className="font-semibold text-gray-900">{order.clientName || 'Non renseigné'}</p>
          {order.clientPhone && (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={callPhone}
                className="flex items-center gap-2 flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium active:scale-95 justify-center"
              >
                <Phone size={15} />
                Appeler
              </button>
              <button
                onClick={copyPhone}
                className="flex items-center gap-2 flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium active:scale-95 justify-center"
              >
                <Copy size={15} />
                {copied ? 'Copié !' : 'Copier'}
              </button>
            </div>
          )}
        </InfoCard>

        {/* Address */}
        <InfoCard title="Adresse de livraison" icon={<MapPin size={16} className="text-indigo-500" />}>
          <p className="text-gray-700 text-sm">{order.address || order.city || 'Non renseignée'}</p>
          {order.city && order.city !== order.address && (
            <p className="text-gray-400 text-xs mt-0.5">{order.city}</p>
          )}
          {(order.address || order.city) && (
            <button
              onClick={openMaps}
              className="flex items-center gap-2 mt-3 py-2.5 w-full rounded-xl bg-gray-100 text-gray-700 text-sm font-medium active:scale-95 justify-center"
            >
              <ExternalLink size={15} />
              Ouvrir dans Maps
            </button>
          )}
        </InfoCard>

        {/* Product */}
        <InfoCard title="Colis" icon={<Package size={16} className="text-indigo-500" />}>
          {order.product ? (
            <div className="space-y-1">
              <p className="text-gray-800 font-medium">{order.product}</p>
              {order.quantity && (
                <p className="text-gray-500 text-sm">Quantité : {order.quantity}</p>
              )}
              {order.price && (
                <p className="text-indigo-600 font-semibold text-base mt-1">
                  {Number(order.price).toLocaleString('fr-FR')} FCFA
                </p>
              )}
            </div>
          ) : (
            <p className="text-gray-400 text-sm">Non renseigné</p>
          )}
        </InfoCard>

        {/* Notes */}
        {order.notes && (
          <InfoCard title="Notes" icon={<Clock size={16} className="text-indigo-500" />}>
            <p className="text-gray-700 text-sm">{order.notes}</p>
          </InfoCard>
        )}

        {/* Delivery info */}
        {(order.deliveryLocation || order.deliveryTime) && (
          <InfoCard title="Infos livraison" icon={<Truck size={16} className="text-indigo-500" />}>
            {order.deliveryLocation && (
              <p className="text-gray-700 text-sm">{order.deliveryLocation}</p>
            )}
            {order.deliveryTime && (
              <p className="text-gray-500 text-xs mt-0.5">{order.deliveryTime}</p>
            )}
          </InfoCard>
        )}

        {/* Actions */}
        {isMyOrder && config.actions.length > 0 && (
          <div className="space-y-2 pt-2">
            <h3 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">Actions</h3>
            {config.actions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => handleAction(action.id)}
                  disabled={actionLoading === action.id}
                  className={`w-full py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60 ${action.color}`}
                >
                  <Icon size={18} />
                  {actionLoading === action.id ? 'En cours...' : action.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}

function InfoCard({ title, icon, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-2.5">
        {icon}
        <h3 className="font-semibold text-gray-700 text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}
