import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';
import { useMoney } from '../hooks/useMoney.js';

const COST_PER_KM = 200;

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

// ── Haversine distance (km) ─────────────────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Progress Step ────────────────────────────────────────────────────────
const Step = ({ label, done, active, icon }) => (
  <div className="flex items-center gap-3">
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 transition-all ${done ? 'bg-emerald-500 text-white' : active ? 'bg-amber-500 text-white animate-pulse' : 'bg-gray-200 text-gray-400'}`}>
      {done ? '✓' : icon}
    </div>
    <span className={`text-sm font-medium ${done ? 'text-emerald-700' : active ? 'text-amber-700' : 'text-gray-400'}`}>{label}</span>
  </div>
);

// ── Leaflet MiniMap ───────────────────────────────────────────────────────
const MiniMap = ({ startLat, startLng, destLat, destLng, currentLat, currentLng }) => {
  const containerRef = React.useRef(null);
  const mapRef = React.useRef(null);
  const currentMarkerRef = React.useRef(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const init = (L) => {
      if (cancelled || !L || !containerRef.current || mapRef.current) return;
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      const map = L.map(containerRef.current, { zoomControl: true, attributionControl: false })
        .fitBounds([[startLat, startLng], [destLat, destLng]], { padding: [30, 30] });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
      const mkIcon = (color) => L.divIcon({ className: '', html: `<div style="width:14px;height:14px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`, iconSize: [14, 14], iconAnchor: [7, 7] });
      L.marker([startLat, startLng], { icon: mkIcon('#22c55e') }).addTo(map).bindPopup('Départ');
      L.marker([destLat, destLng], { icon: mkIcon('#ef4444') }).addTo(map).bindPopup('Destination');
      L.polyline([[startLat, startLng], [destLat, destLng]], { color: '#6366f1', weight: 4, dashArray: '8 6', opacity: 0.9 }).addTo(map);
      const blueIcon = L.divIcon({ className: '', html: '<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 0 6px rgba(59,130,246,0.3)"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
      currentMarkerRef.current = L.marker([currentLat || startLat, currentLng || startLng], { icon: blueIcon }).addTo(map);
      mapRef.current = map;
      setReady(true);
    };
    if (window.L) { init(window.L); }
    else {
      if (!document.getElementById('lf-css')) {
        const link = Object.assign(document.createElement('link'), { id: 'lf-css', rel: 'stylesheet', href: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' });
        document.head.appendChild(link);
      }
      if (!document.getElementById('lf-js')) {
        const sc = Object.assign(document.createElement('script'), { id: 'lf-js', src: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js' });
        sc.onload = () => init(window.L);
        document.head.appendChild(sc);
      } else {
        const wait = setInterval(() => { if (window.L) { clearInterval(wait); init(window.L); } }, 100);
      }
    }
    return () => { cancelled = true; if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  React.useEffect(() => {
    if (mapRef.current && currentMarkerRef.current && currentLat && currentLng) {
      currentMarkerRef.current.setLatLng([currentLat, currentLng]);
    }
  }, [currentLat, currentLng]);

  return (
    <div className="relative">
      <div ref={containerRef} style={{ height: '220px', borderRadius: '12px', overflow: 'hidden', background: '#e5e7eb' }} />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-xl">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex gap-2 text-[10px]">
        <span className="bg-white/90 px-2 py-0.5 rounded-full shadow font-medium" style={{ color: '#22c55e' }}>● Départ</span>
        <span className="bg-white/90 px-2 py-0.5 rounded-full shadow font-medium" style={{ color: '#ef4444' }}>● Arrivée</span>
        <span className="bg-white/90 px-2 py-0.5 rounded-full shadow font-medium" style={{ color: '#3b82f6' }}>● Vous</span>
      </div>
    </div>
  );
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

  // GPS state
  const [myPosition, setMyPosition] = useState(null); // { lat, lng }
  const [gpsError, setGpsError] = useState('');
  const [destination, setDestination] = useState('');
  const [destCoords, setDestCoords] = useState(null); // { lat, lng }
  const [distance, setDistance] = useState(null); // km
  const [liveDistance, setLiveDistance] = useState(null); // remaining km
  const [courseStarted, setCourseStarted] = useState(false);
  const watchIdRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => { loadOrder(); }, [id]);

  const loadOrder = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await ecomApi.get(`/orders/${id}`);
      const o = res.data?.data || null;
      setOrder(o);
      if (o) {
        // Restore GPS tracking state from saved order
        if (o.deliveryStartedAt && o.deliveryEndLat && o.deliveryEndLng) {
          setCourseStarted(true);
          setDestCoords({ lat: o.deliveryEndLat, lng: o.deliveryEndLng });
          if (o.deliveryEndAddress) setDestination(o.deliveryEndAddress);
          if (o.deliveryDistanceKm) setDistance(o.deliveryDistanceKm);
        }
        if (o.deliveryStartLat && o.deliveryStartLng && !myPosition) {
          setMyPosition({ lat: o.deliveryStartLat, lng: o.deliveryStartLng });
        }
      }
    } catch { if (!silent) setError('Commande introuvable.'); }
    finally { if (!silent) setLoading(false); }
  };

  // ── Watch GPS ─────────────────────────────────
  const startWatchingPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('La géolocalisation n\'est pas supportée.');
      return;
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setMyPosition(p);
        setGpsError('');
      },
      () => setGpsError('Position GPS indisponible.'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }, []);

  useEffect(() => {
    startWatchingPosition();
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [startWatchingPosition]);

  // ── Live distance to destination ──────────────
  useEffect(() => {
    if (myPosition && destCoords) {
      const d = haversineKm(myPosition.lat, myPosition.lng, destCoords.lat, destCoords.lng);
      setLiveDistance(Math.round(d * 100) / 100);
    }
  }, [myPosition, destCoords]);

  // ── Geocode destination text to coords ────────
  const geocodeDestination = async (text) => {
    if (!text.trim()) return null;
    try {
      const q = encodeURIComponent(text.trim());
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1`);
      const data = await r.json();
      if (data.length > 0) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
      }
    } catch { /* silent */ }
    return null;
  };

  // ── Commencer la course ───────────────────────
  const handleStartDelivery = async () => {
    if (!myPosition) {
      setError('Position GPS non disponible. Activez la localisation.');
      return;
    }
    if (!destination.trim()) {
      setError('Entrez la destination (adresse d\'arrivée).');
      return;
    }

    setActing(true);
    setError('');
    try {
      // Geocode destination
      const geo = await geocodeDestination(destination);
      if (!geo) {
        setError('Adresse de destination introuvable. Essayez avec plus de détails.');
        setActing(false);
        return;
      }

      const dc = { lat: geo.lat, lng: geo.lng };
      setDestCoords(dc);
      const dist = haversineKm(myPosition.lat, myPosition.lng, dc.lat, dc.lng);
      const roundedDist = Math.round(dist * 100) / 100;
      setDistance(roundedDist);

      // Save to backend
      await ecomApi.patch(`/orders/${id}/livreur-action`, {
        action: 'start_delivery',
        startLat: myPosition.lat,
        startLng: myPosition.lng,
        endLat: dc.lat,
        endLng: dc.lng,
        endAddress: geo.display || destination,
        distanceKm: roundedDist,
      });

      setCourseStarted(true);
      setSuccess('Course démarrée !');
      loadOrder(true);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors du démarrage.');
    } finally {
      setActing(false);
    }
  };

  // ── Actions livreur ───────────────────────────
  const handleAction = async (action) => {
    setActing(true);
    setError('');
    try {
      const body = { action };
      if (action === 'delivered' && distance) {
        body.distanceKm = distance;
      }
      await ecomApi.patch(`/orders/${id}/livreur-action`, body);
      setSuccess(action === 'delivered' ? 'Livraison confirmée !' : action === 'pickup_confirmed' ? 'Récupération confirmée !' : 'Action enregistrée.');
      loadOrder(true);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur.');
    } finally {
      setActing(false);
    }
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
  const isMyOrder = String(order.assignedLivreur?._id || order.assignedLivreur) === String(user?._id);
  const deliveryCost = distance != null ? Math.round(distance * COST_PER_KM) : (order.deliveryCostFcfa || null);
  const savedDistance = distance || order.deliveryDistanceKm;

  // Progression steps
  const isConfirmed = ['confirmed', 'shipped', 'delivered'].includes(order.status);
  const isStarted = courseStarted || !!order.deliveryStartedAt;
  const isDelivered = order.status === 'delivered';

  return (
    <div className="p-3 sm:p-6 max-w-[700px] mx-auto space-y-5 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition">
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex-1">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">Détail de la course</h1>
          <p className="text-xs text-gray-400">#{order.orderId || id.slice(-8)}</p>
        </div>
        <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: sm.bg, color: sm.text }}>
          {STATUS_LABELS[order.status] || order.status}
        </span>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">{success}</div>}

      {/* ── Progression GPS ──────────────────────────────────────────────── */}
      {isMyOrder && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 px-5 py-4">
            <h2 className="text-white font-bold text-sm uppercase tracking-wide flex items-center gap-2">
              <span>📍</span> Suivi GPS
            </h2>
            {myPosition && (
              <p className="text-indigo-200 text-xs mt-1">
                Position : {myPosition.lat.toFixed(4)}, {myPosition.lng.toFixed(4)}
              </p>
            )}
            {gpsError && <p className="text-red-300 text-xs mt-1">⚠️ {gpsError}</p>}
          </div>

          <div className="p-5 space-y-4">
            {/* Steps */}
            <div className="space-y-3">
              <Step label="Commande acceptée" done={isConfirmed} icon="1" />
              <div className="ml-4 border-l-2 border-dashed border-gray-200 h-3" />
              <Step label="Course démarrée" done={isStarted} active={isConfirmed && !isStarted} icon="2" />
              <div className="ml-4 border-l-2 border-dashed border-gray-200 h-3" />
              <Step label="Livraison confirmée" done={isDelivered} active={isStarted && !isDelivered} icon="3" />
            </div>

            {/* Destination input + Start button */}
            {isConfirmed && !isStarted && order.status !== 'delivered' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-amber-800">🚀 Commencer la course</p>
                <p className="text-xs text-amber-700">Entrez l'adresse d'arrivée pour calculer le trajet et le coût.</p>
                <input
                  type="text"
                  placeholder="Ex: Marché central, Douala"
                  value={destination}
                  onChange={e => setDestination(e.target.value)}
                  className="w-full px-4 py-3 text-sm border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/40 bg-white"
                />
                <button
                  onClick={handleStartDelivery}
                  disabled={acting || !destination.trim()}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {acting ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Calcul en cours…</>
                  ) : (
                    <>📍 Commencer la course</>
                  )}
                </button>
              </div>
            )}

            {/* Active tracking card */}
            {isStarted && !isDelivered && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-indigo-800">🗺️ Course en cours</p>
                  <span className="flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-green-400 opacity-75" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" /></span>
                </div>

                {(order.deliveryEndAddress || destination) && (
                  <div className="text-xs text-indigo-700">
                    <span className="font-medium">Destination :</span> {order.deliveryEndAddress || destination}
                  </div>
                )}

                    {/* Leaflet Map */}
                    {order.deliveryStartLat && order.deliveryEndLat && (
                      <MiniMap
                        startLat={order.deliveryStartLat}
                        startLng={order.deliveryStartLng}
                        destLat={order.deliveryEndLat}
                        destLng={order.deliveryEndLng}
                        currentLat={myPosition?.lat}
                        currentLng={myPosition?.lng}
                      />
                    )}

                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                        <p className="text-2xl font-black text-indigo-700">{savedDistance ? savedDistance.toFixed(1) : '—'}</p>
                        <p className="text-[10px] text-gray-400 font-medium">KM TOTAL</p>
                      </div>
                      <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                        <p className="text-2xl font-black text-amber-600">{liveDistance != null ? liveDistance.toFixed(1) : '—'}</p>
                        <p className="text-[10px] text-gray-400 font-medium">KM RESTANT</p>
                      </div>
                      <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                        <p className="text-2xl font-black text-emerald-600">{deliveryCost != null ? deliveryCost.toLocaleString('fr-FR') : '—'}</p>
                        <p className="text-[10px] text-gray-400 font-medium">{symbol}</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    {savedDistance && liveDistance != null && (
                      <div>
                        <div className="flex justify-between text-[10px] text-indigo-600 font-medium mb-1">
                          <span>Progression</span>
                          <span>{Math.max(0, Math.min(100, Math.round(((savedDistance - liveDistance) / savedDistance) * 100)))}%</span>
                        </div>
                        <div className="w-full bg-indigo-200 rounded-full h-2.5">
                          <div
                            className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-2.5 rounded-full transition-all duration-1000"
                            style={{ width: `${Math.max(0, Math.min(100, ((savedDistance - liveDistance) / savedDistance) * 100))}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {myPosition && (
                      <p className="text-[10px] text-green-700 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />GPS actif · {myPosition.lat.toFixed(4)}, {myPosition.lng.toFixed(4)}
                      </p>
                    )}

                    <div className="flex gap-2">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1${myPosition ? `&origin=${myPosition.lat},${myPosition.lng}` : ''}&destination=${order.deliveryEndLat},${order.deliveryEndLng}&travelmode=driving`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition"
                      >
                        🗺️ Naviguer
                      </a>
                      {order.clientPhone && (
                        <a href={`tel:${order.clientPhone}`} className="px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-sm hover:bg-emerald-100 transition">
                          📞
                        </a>
                      )}
                    </div>

                    <p className="text-[10px] text-indigo-400 text-center">Coût calculé à {COST_PER_KM} {symbol} / km</p>
                  </div>
                )}

            {/* Delivered summary */}
            {isDelivered && savedDistance && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
                <p className="text-sm font-bold text-emerald-800">✅ Livraison terminée</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                    <p className="text-xl font-black text-emerald-700">{savedDistance.toFixed(1)} km</p>
                    <p className="text-[10px] text-gray-400">DISTANCE</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 text-center shadow-sm">
                    <p className="text-xl font-black text-emerald-700">{fmt(deliveryCost || 0)}</p>
                    <p className="text-[10px] text-gray-400">COÛT LIVRAISON</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
            <span className="text-sm font-bold text-[#0F6B4F]">{order.price ? fmt(order.price) : '—'}</span>
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
          {order.deliveryStartedAt && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Course démarrée</span>
              <span className="text-xs text-indigo-600 font-medium">{fmtDate(order.deliveryStartedAt)}</span>
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
          {order.status === 'confirmed' && !isStarted && (
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
      {(order.address || order.city || destCoords) && (
        <a
          href={destCoords
            ? `https://www.google.com/maps/dir/?api=1&destination=${destCoords.lat},${destCoords.lng}${myPosition ? `&origin=${myPosition.lat},${myPosition.lng}` : ''}&travelmode=driving`
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((order.address || '') + ' ' + (order.city || ''))}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition text-center"
        >
          <p className="text-sm font-semibold text-[#0F6B4F]">🗺️ {destCoords ? 'Naviguer vers la destination' : 'Ouvrir dans Google Maps'}</p>
          <p className="text-xs text-gray-400 mt-0.5">{order.deliveryEndAddress || destination || `${order.address || ''}, ${order.city || ''}`}</p>
        </a>
      )}
    </div>
  );
};

export default LivreurDeliveryDetail;
