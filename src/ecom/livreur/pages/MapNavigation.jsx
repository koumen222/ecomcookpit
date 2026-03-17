import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Navigation,
  MapPin,
  Phone,
  ExternalLink,
  Copy,
  Truck,
} from 'lucide-react';
import { livreurApi } from '../services/livreurApi.js';

export default function MapNavigation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    livreurApi
      .getOrder(id)
      .then((res) => setOrder(res.data?.data || res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const address = order?.address || order?.city || '';
  const phone = order?.clientPhone || '';

  const openGoogleMaps = () => {
    if (address) window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, '_blank');
  };
  const openWaze = () => {
    if (address) window.open(`https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`, '_blank');
  };
  const callClient = () => { if (phone) window.location.href = `tel:${phone}`; };
  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const mapUrl = address
    ? `https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed&z=15`
    : null;

  return (
    <div className="flex flex-col min-h-screen bg-gray-900">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/60 to-transparent px-4 pt-12 pb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center active:scale-95"
          >
            <ArrowLeft size={20} className="text-white" />
          </button>
          <div>
            <p className="text-white/80 text-xs">{order?.orderId}</p>
            <h1 className="text-white font-bold text-lg leading-tight">Navigation</h1>
          </div>
        </div>
      </div>

      {/* Map embed */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        ) : mapUrl ? (
          <iframe
            src={mapUrl}
            className="w-full h-full min-h-[50vh]"
            style={{ border: 0, minHeight: '60vh' }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Carte de livraison"
          />
        ) : (
          <div className="absolute inset-0 bg-gray-800 flex flex-col items-center justify-center text-center px-8">
            <MapPin size={48} className="text-gray-500 mb-3" />
            <p className="text-gray-400 text-sm">Adresse non disponible pour afficher la carte</p>
          </div>
        )}
      </div>

      {/* Bottom panel */}
      <div className="bg-white rounded-t-3xl px-4 pt-5 pb-8 shadow-2xl">
        {/* Handle */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

        {order ? (
          <>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                <Truck size={18} className="text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-gray-900">{order.clientName || 'Client'}</h2>
                {address && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <MapPin size={13} className="text-gray-400 shrink-0" />
                    <p className="text-gray-500 text-sm truncate">{address}</p>
                  </div>
                )}
                {phone && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Phone size={13} className="text-gray-400 shrink-0" />
                    <p className="text-gray-500 text-sm">{phone}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={openGoogleMaps}
                className="py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-95"
              >
                <Navigation size={16} />
                Google Maps
              </button>
              <button
                onClick={openWaze}
                className="py-3 rounded-xl bg-sky-500 text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-95"
              >
                <ExternalLink size={16} />
                Waze
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={callClient}
                disabled={!phone}
                className="py-3 rounded-xl bg-green-600 text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40"
              >
                <Phone size={16} />
                Appeler
              </button>
              <button
                onClick={copyAddress}
                disabled={!address}
                className="py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40"
              >
                <Copy size={16} />
                {copied ? 'Copié !' : 'Copier adresse'}
              </button>
            </div>
          </>
        ) : (
          <p className="text-center text-gray-400 text-sm py-4">Données introuvables</p>
        )}
      </div>
    </div>
  );
}
