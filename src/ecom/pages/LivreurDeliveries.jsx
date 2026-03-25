import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';
import { useMoney } from '../hooks/useMoney.js';

const COST_PER_KM = 200;

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Carte Leaflet (CDN) ─────────────────────────────────────────────────
const MiniMap = ({ startLat, startLng, destLat, destLng, currentLat, currentLng, fullHeight }) => {
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
      L.polyline([[startLat, startLng], [destLat, destLng]], { color: '#f59e0b', weight: 4, dashArray: '8 6', opacity: 0.9 }).addTo(map);
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
    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  React.useEffect(() => {
    if (mapRef.current && currentMarkerRef.current && currentLat && currentLng) {
      currentMarkerRef.current.setLatLng([currentLat, currentLng]);
    }
  }, [currentLat, currentLng]);

  return (
    <div className="relative">
      <div ref={containerRef} style={{ height: fullHeight ? '100%' : '220px', minHeight: fullHeight ? '200px' : undefined, borderRadius: '12px', overflow: 'hidden', background: '#e5e7eb' }} />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-xl">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-amber-500 rounded-full animate-spin" />
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

const STATUS_LABELS = {
  confirmed: 'Acceptée', shipped: 'En cours', delivered: 'Livrée',
  returned: 'Retour', cancelled: 'Annulée', pending: 'En attente',
};
const STATUS_META = {
  confirmed: { bg: '#eff6ff', text: '#053326' },
  shipped: { bg: '#eef2ff', text: '#3730a3' },
  delivered: { bg: '#ecfdf5', text: '#065f46' },
  returned: { bg: '#fff7ed', text: '#9a3412' },
  cancelled: { bg: '#fef2f2', text: '#991b1b' },
  pending: { bg: '#fffbeb', text: '#92400e' },
};

const TABS = [
  { key: 'all', label: 'Tout' },
  { key: 'confirmed', label: 'Acceptées' },
  { key: 'shipped', label: 'En transit' },
];

const LivreurDeliveries = () => {
  const { user } = useEcomAuth();
  const { symbol } = useMoney();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState('all');

  // Course modal state
  const [courseModal, setCourseModal] = useState(null);
  const [courseAddr, setCourseAddr] = useState('');
  const [courseGps, setCourseGps] = useState(null);
  const [courseGpsErr, setCourseGpsErr] = useState('');
  const [courseSaving, setCourseSaving] = useState(false);
  const [addrSuggestions, setAddrSuggestions] = useState([]);
  const [selectedDest, setSelectedDest] = useState(null);
  const [addrLoading, setAddrLoading] = useState(false);
  const addrDebounce = useRef(null);
  const watchRef = useRef(null);

  // Inline card tracking
  const [expandedCard, setExpandedCard] = useState(null);
  const [liveGps, setLiveGps] = useState(null);
  const liveWatchRef = useRef(null);

  // Full-screen tracking (after starting a course)
  const [fullTrack, setFullTrack] = useState(null); // { orderId, startLat, startLng, destLat, destLng, destAddr, distKm }

  // Delivery confirmation modal
  const [deliveryModal, setDeliveryModal] = useState(null); // { orderId }
  const [deliveryNote, setDeliveryNote] = useState('');
  const [nonDeliveredReason, setNonDeliveredReason] = useState('');
  const [nonDeliveredCustom, setNonDeliveredCustom] = useState('');
  const [deliveryTab, setDeliveryTab] = useState('livré'); // 'livré' | 'non-livré'

  const fetchSuggestions = useCallback((text) => {
    setSelectedDest(null);
    if (addrDebounce.current) clearTimeout(addrDebounce.current);
    if (text.trim().length < 3) { setAddrSuggestions([]); return; }
    addrDebounce.current = setTimeout(async () => {
      setAddrLoading(true);
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&limit=5&addressdetails=1`);
        const data = await r.json();
        setAddrSuggestions(data.map(d => ({ lat: parseFloat(d.lat), lng: parseFloat(d.lon), display: d.display_name, short: d.display_name.split(',').slice(0, 3).join(', ') })));
      } catch { setAddrSuggestions([]); }
      finally { setAddrLoading(false); }
    }, 450);
  }, []);

  const openTrackingModal = useCallback((order) => {
    setFullTrack({
      orderId: order._id,
      startLat: order.deliveryStartLat,
      startLng: order.deliveryStartLng,
      destLat: order.deliveryEndLat,
      destLng: order.deliveryEndLng,
      destAddr: order.deliveryEndAddress || '',
      distKm: order.deliveryDistanceKm || 0,
    });
  }, []);

  const openCourseModal = useCallback((order) => {
    const prefill = [order.address, order.city].filter(Boolean).join(', ');
    setCourseModal({ phase: 'input', orderId: order._id });
    setCourseAddr(prefill);
    setCourseGps(null);
    setCourseGpsErr('');
    setAddrSuggestions([]);
    setSelectedDest(null);
    if (!navigator.geolocation) { setCourseGpsErr('GPS non disponible.'); return; }
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => setCourseGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setCourseGpsErr('Position GPS introuvable. Vérifiez vos permissions.'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }, []);

  const closeCourseModal = useCallback(() => {
    setCourseModal(null);
    if (watchRef.current !== null) { navigator.geolocation.clearWatch(watchRef.current); watchRef.current = null; }
  }, []);

  const submitCourse = async () => {
    if (!courseGps) { setCourseGpsErr('En attente du GPS…'); return; }
    if (!courseAddr.trim()) return;
    setCourseSaving(true);
    try {
      let destLat, destLng, destDisplay;
      if (selectedDest) {
        destLat = selectedDest.lat; destLng = selectedDest.lng; destDisplay = selectedDest.display;
      } else {
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(courseAddr.trim())}&limit=1`);
          const data = await r.json();
          if (data.length > 0) { destLat = parseFloat(data[0].lat); destLng = parseFloat(data[0].lon); destDisplay = data[0].display_name; }
        } catch { /* silent */ }
      }
      if (!destLat) { setCourseGpsErr('Adresse introuvable. Choisissez une suggestion.'); setCourseSaving(false); return; }
      const dist = Math.round(haversineKm(courseGps.lat, courseGps.lng, destLat, destLng) * 100) / 100;
      const startSnap = { lat: courseGps.lat, lng: courseGps.lng };
      await ecomApi.patch(`/orders/${courseModal.orderId}/livreur-action`, {
        action: 'start_delivery',
        startLat: startSnap.lat, startLng: startSnap.lng,
        endLat: destLat, endLng: destLng,
        endAddress: destDisplay || courseAddr,
        distanceKm: dist,
      });
      // Update local orders state immediately so card shows "Voir la course"
      const savedOrderId = courseModal.orderId;
      setOrders(prev => prev.map(o =>
        o._id === savedOrderId
          ? { ...o, status: 'shipped', deliveryStartedAt: new Date().toISOString(), deliveryStartLat: startSnap.lat, deliveryStartLng: startSnap.lng, deliveryEndLat: destLat, deliveryEndLng: destLng, deliveryEndAddress: destDisplay || courseAddr, deliveryDistanceKm: dist }
          : o
      ));
      // Transition to full-screen GPS tracking
      closeCourseModal();
      setFullTrack({ orderId: savedOrderId, startLat: startSnap.lat, startLng: startSnap.lng, destLat, destLng, destAddr: destDisplay || courseAddr, distKm: dist });
      loadOrders(true);
    } catch (err) {
      setCourseGpsErr(err.response?.data?.message || 'Erreur lors du démarrage.');
    } finally { setCourseSaving(false); }
  };

  const loadOrders = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await ecomApi.get('/orders', { params: { assignedLivreur: user._id, limit: 100 } });
      const all = res.data?.data?.orders || res.data?.data || [];
      setOrders(all.filter(o => ['confirmed', 'shipped'].includes(o.status)));
    } catch { if (!silent) setError('Erreur de chargement.'); }
    finally { if (!silent) setLoading(false); }
  };

  const handleAction = async (orderId, action, extra = {}) => {
    setAssigning(p => ({ ...p, [orderId]: true }));
    setError('');
    try {
      await ecomApi.patch(`/orders/${orderId}/livreur-action`, { action, ...extra });
      setSuccess(action === 'delivered' ? 'Livraison confirmée !' : 'Action enregistrée.');
      loadOrders(true);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur.');
    } finally {
      setAssigning(p => ({ ...p, [orderId]: false }));
    }
  };

  const openDeliveryModal = useCallback((orderId) => {
    setDeliveryModal({ orderId });
    setDeliveryNote('');
    setNonDeliveredReason('');
    setNonDeliveredCustom('');
    setDeliveryTab('livré');
  }, []);

  const submitDelivery = async () => {
    const orderId = deliveryModal.orderId;
    await handleAction(orderId, 'delivered', { deliveryNote: deliveryNote.trim() });
    setDeliveryModal(null);
    if (fullTrack?.orderId === orderId) setFullTrack(null);
  };

  const submitNonDelivery = async () => {
    const orderId = deliveryModal.orderId;
    const reason = nonDeliveredReason === 'autre' ? nonDeliveredCustom.trim() : nonDeliveredReason;
    if (!reason) { setError('Veuillez préciser la raison.'); return; }
    await handleAction(orderId, 'issue', { nonDeliveryReason: reason });
    setDeliveryModal(null);
    if (fullTrack?.orderId === orderId) setFullTrack(null);
  };

  useEffect(() => {
    loadOrders();
    const pollId = setInterval(() => loadOrders(true), 10000);
    const onNotification = (event) => {
      const detail = event.detail || {};
      if (detail.type === 'course' || detail.type === 'order_taken' || detail.type === 'order_status') {
        loadOrders(true);
      }
    };
    window.addEventListener('ecom:notification', onNotification);
    return () => {
      clearInterval(pollId);
      window.removeEventListener('ecom:notification', onNotification);
      if (liveWatchRef.current !== null) { navigator.geolocation?.clearWatch(liveWatchRef.current); liveWatchRef.current = null; }
    };
  }, []);

  // Always-on GPS when there are active courses
  useEffect(() => {
    const hasActive = orders.some(o => o.deliveryStartedAt && o.deliveryEndLat);
    if (hasActive && liveWatchRef.current === null && navigator.geolocation) {
      liveWatchRef.current = navigator.geolocation.watchPosition(
        pos => setLiveGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
      );
    } else if (!hasActive && liveWatchRef.current !== null) {
      navigator.geolocation.clearWatch(liveWatchRef.current);
      liveWatchRef.current = null;
    }
  }, [orders]);

  const filtered = tab === 'all' ? orders : orders.filter(o => o.status === tab);

  return (
    <div className="p-3 sm:p-6 max-w-[900px] mx-auto space-y-5">

      {/* ── Full-screen GPS tracking (after starting a course, not closable) ── */}
      {fullTrack && (() => {
        const { orderId: trackOrderId, startLat, startLng, destLat, destLng, destAddr, distKm } = fullTrack;
        const trackOrder = orders.find(o => o._id === trackOrderId);
        const trackStatus = trackOrder?.status || 'shipped';
        const trackSm = STATUS_META[trackStatus] || { bg: '#eef2ff', text: '#3730a3' };
        const gps = liveGps || courseGps;
        const remaining = gps ? Math.max(0, Math.round(haversineKm(gps.lat, gps.lng, destLat, destLng) * 100) / 100) : distKm;
        const pct = distKm > 0 ? Math.max(0, Math.min(100, Math.round(((distKm - remaining) / distKm) * 100))) : 0;
        const cost = Math.round(distKm * COST_PER_KM);
        return (
          <div className="fixed inset-0 z-50 bg-white flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-indigo-600 to-indigo-800 flex-shrink-0">
              <div className="flex-1 min-w-0 mr-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-white font-bold text-lg">📍 Course en cours</h2>
                  <span className="flex h-2.5 w-2.5 relative flex-shrink-0"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"/><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"/></span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: trackSm.bg, color: trackSm.text }}>{STATUS_LABELS[trackStatus] || trackStatus}</span>
                </div>
                <p className="text-indigo-200 text-xs mt-0.5 truncate">{trackOrder?.clientName || 'Client'} — {destAddr}</p>
              </div>
            </div>
            {/* Map */}
            <div className="flex-1 min-h-0 p-4">
              <div style={{ height: '100%' }}>
                <MiniMap startLat={startLat} startLng={startLng} destLat={destLat} destLng={destLng} currentLat={gps?.lat} currentLng={gps?.lng} fullHeight />
              </div>
            </div>
            {/* Stats panel */}
            <div className="flex-shrink-0 px-4 pb-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-gray-800">{distKm.toFixed(1)}</p>
                  <p className="text-[9px] text-gray-400 font-semibold uppercase">KM TOTAL</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-amber-600">{remaining.toFixed(1)}</p>
                  <p className="text-[9px] text-amber-400 font-semibold uppercase">KM RESTANT</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-emerald-600">{cost.toLocaleString('fr-FR')}</p>
                  <p className="text-[9px] text-emerald-400 font-semibold uppercase">{symbol}</p>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                  <span>Progression</span><span className="font-bold">{pct}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className="bg-gradient-to-r from-amber-400 to-emerald-500 h-2.5 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
                </div>
              </div>
              {gps && (
                <div className="flex items-center gap-1.5 text-[10px] text-green-700 bg-green-50 rounded-full px-3 py-1 w-fit">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />GPS actif · {gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}
                </div>
              )}
              {/* Action buttons */}
              {trackOrder && (
                <div className="flex gap-2">
                  {trackStatus === 'confirmed' && (
                    <button
                      onClick={() => { handleAction(trackOrderId, 'pickup_confirmed'); }}
                      disabled={assigning[trackOrderId]}
                      className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 transition disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {assigning[trackOrderId] ? '…' : '📦 Colis récupéré'}
                    </button>
                  )}
                  {trackStatus === 'shipped' && (
                    <button
                      onClick={() => openDeliveryModal(trackOrderId)}
                      disabled={assigning[trackOrderId]}
                      className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {assigning[trackOrderId] ? '…' : '✅ Marquer livré'}
                    </button>
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <a
                  href={`https://www.google.com/maps/dir/?api=1${gps ? `&origin=${gps.lat},${gps.lng}` : ''}&destination=${destLat},${destLng}&travelmode=driving`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition"
                >
                  🗺️ Naviguer
                </a>
                {trackOrder?.clientPhone && (
                  <a href={`tel:${trackOrder.clientPhone}`} className="px-4 py-3 bg-emerald-50 text-emerald-700 rounded-xl font-bold text-sm hover:bg-emerald-100 transition flex items-center gap-1">
                    📞
                  </a>
                )}
                <button onClick={() => { setFullTrack(null); loadOrders(true); }} className="px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition">
                  ← Retour
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Delivery Confirmation Modal ── */}
      {deliveryModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={e => { if (e.target === e.currentTarget) setDeliveryModal(null); }}>
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">📋 Confirmer la livraison</h2>
                <button onClick={() => setDeliveryModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200">✕</button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                <button onClick={() => setDeliveryTab('livré')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${deliveryTab === 'livré' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  ✅ Livré
                </button>
                <button onClick={() => setDeliveryTab('non-livré')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${deliveryTab === 'non-livré' ? 'bg-red-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  ❌ Non livré
                </button>
              </div>

              {/* Tab: Livré */}
              {deliveryTab === 'livré' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Précisions sur la course (optionnel)</label>
                    <textarea
                      rows={3}
                      placeholder="Ex: Livré en main propre, client satisfait, code d'entrée B12…"
                      value={deliveryNote}
                      onChange={e => setDeliveryNote(e.target.value)}
                      className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/40 focus:border-green-400 resize-none"
                    />
                  </div>
                  <button
                    onClick={submitDelivery}
                    disabled={assigning[deliveryModal.orderId]}
                    className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-bold text-sm hover:from-green-600 hover:to-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {assigning[deliveryModal.orderId] ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Enregistrement…</>
                    ) : <>✅ On livre !</>}
                  </button>
                </div>
              )}

              {/* Tab: Non livré */}
              {deliveryTab === 'non-livré' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Raison de non-livraison</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Client absent', 'Mauvaise adresse', 'Colis refusé', 'Zone inaccessible', 'Client injoignable', 'Autre'].map(r => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setNonDeliveredReason(r === 'Autre' ? 'autre' : r)}
                          className={`text-xs px-3 py-2.5 rounded-xl border font-medium transition text-left ${(r === 'Autre' ? 'autre' : r) === nonDeliveredReason ? 'bg-red-50 border-red-400 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                    {nonDeliveredReason === 'autre' && (
                      <textarea
                        rows={2}
                        placeholder="Précisez la raison…"
                        value={nonDeliveredCustom}
                        onChange={e => setNonDeliveredCustom(e.target.value)}
                        className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-400 resize-none mt-2"
                        autoFocus
                      />
                    )}
                  </div>
                  <button
                    onClick={submitNonDelivery}
                    disabled={assigning[deliveryModal.orderId] || !nonDeliveredReason || (nonDeliveredReason === 'autre' && !nonDeliveredCustom.trim())}
                    className="w-full py-3.5 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl font-bold text-sm hover:from-red-600 hover:to-rose-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {assigning[deliveryModal.orderId] ? (
                      <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Enregistrement…</>
                    ) : <>❌ Marquer non livré</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Course Modal (address input) */}
      {courseModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={(e) => { if (e.target !== e.currentTarget) return; if (courseModal.phase === 'input') closeCourseModal(); }}>
          <div className={`bg-white w-full ${courseModal.phase === 'tracking' ? 'sm:max-w-lg' : 'sm:max-w-md'} rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden`}>

            {/* ── Phase 1 : Saisie destination ── */}
            {courseModal.phase === 'input' && (
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900">🚀 Commencer la course</h2>
                  <button onClick={closeCourseModal} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200">✕</button>
                </div>
                {/* GPS status */}
                <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm ${courseGps ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                  {courseGps ? (
                    <><span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" /><span className="font-medium">GPS actif</span><span className="text-green-600 text-xs ml-1">{courseGps.lat.toFixed(4)}, {courseGps.lng.toFixed(4)}</span></>
                  ) : (
                    <><div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin flex-shrink-0" /><span>Localisation en cours…</span></>
                  )}
                </div>
                {courseGpsErr && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{courseGpsErr}</p>}
                {/* Destination */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Adresse de destination</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Ex: Marché central, Douala"
                      value={courseAddr}
                      onChange={e => { setCourseAddr(e.target.value); fetchSuggestions(e.target.value); }}
                      onKeyDown={e => e.key === 'Enter' && courseGps && selectedDest && submitCourse()}
                      className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400"
                      autoFocus
                      autoComplete="off"
                    />
                    {addrLoading && <div className="absolute right-3 top-3.5 w-4 h-4 border-2 border-gray-300 border-t-amber-500 rounded-full animate-spin" />}
                    {addrSuggestions.length > 0 && !selectedDest && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                        {addrSuggestions.map((s, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => { setCourseAddr(s.short); setSelectedDest(s); setAddrSuggestions([]); }}
                            className="w-full text-left px-4 py-3 text-sm hover:bg-amber-50 border-b border-gray-100 last:border-0 flex items-start gap-2"
                          >
                            <span className="text-amber-500 mt-0.5 flex-shrink-0">📍</span>
                            <span className="text-gray-800 line-clamp-2">{s.short}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedDest && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-1.5">
                        <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                        <span className="truncate">{selectedDest.short || selectedDest.display}</span>
                        <button type="button" onClick={() => { setSelectedDest(null); setCourseAddr(''); setTimeout(() => document.querySelector('input[autocomplete=off]')?.focus(), 50); }} className="ml-auto text-gray-400 hover:text-red-500 flex-shrink-0">✕</button>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={submitCourse}
                  disabled={courseSaving || !courseGps || !courseAddr.trim() || !!addrSuggestions.length}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-sm hover:from-amber-600 hover:to-orange-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {courseSaving ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Calcul en cours…</>
                  ) : !courseGps ? <>⏳ En attente du GPS</> : <>🚀 Lancer la course</>}
                </button>
                <p className="text-center text-[10px] text-gray-400">Coût calculé à {COST_PER_KM} {symbol} / km</p>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">🚚 Mes livraisons</h1>
          <p className="text-sm text-gray-400 mt-0.5">{orders.length} livraison{orders.length !== 1 ? 's' : ''} active{orders.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={loadOrders} className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition text-gray-600">↻ Actualiser</button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}<button onClick={() => setError('')} className="float-right font-bold">&times;</button></div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">{success}</div>}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition ${tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label} ({t.key === 'all' ? orders.length : orders.filter(o => o.status === t.key).length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <div className="w-8 h-8 rounded-full border-4 border-gray-200 border-t-amber-600 animate-spin" />
          <p className="text-sm text-gray-400">Chargement…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <p className="text-gray-500 font-medium">Aucune livraison active</p>
          <Link to="/ecom/livreur/available" className="text-xs text-[#0F6B4F] font-medium mt-2 inline-block">Accepter une course →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const sm = STATUS_META[order.status] || { bg: '#f9fafb', text: '#374151' };
            return (
              <div key={order._id} className={`bg-white rounded-2xl border shadow-sm p-4 hover:shadow-md transition ${order.deliveryStartedAt && order.deliveryEndLat ? 'border-indigo-200' : 'border-gray-100'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-900">{order.clientName || order.clientPhone || 'Client'}</span>
                  <div className="flex items-center gap-2">
                    {order.deliveryStartedAt && order.deliveryEndLat && (
                      <span className="flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"/><span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"/></span>
                    )}
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: sm.bg, color: sm.text }}>
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-gray-500 mb-3">
                  {order.clientPhone && <p>📞 {order.clientPhone}</p>}
                  {(order.city || order.address) && <p>📍 {order.city}{order.address ? `, ${order.address}` : ''}</p>}
                  {order.product && <p>📦 {order.product}{order.quantity > 1 ? ` × ${order.quantity}` : ''}</p>}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {order.status === 'confirmed' && !order.deliveryStartedAt && (
                    <button onClick={() => openCourseModal(order)} className="text-xs px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-bold hover:from-amber-600 hover:to-orange-600 transition shadow-sm flex items-center gap-1">
                      🚀 Commencer la course
                    </button>
                  )}
                  {order.status === 'confirmed' && order.deliveryStartedAt && order.deliveryEndLat && (
                    <button onClick={() => openTrackingModal(order)} className="text-xs px-3 py-2 bg-gradient-to-r from-indigo-500 to-indigo-700 text-white rounded-lg font-bold hover:from-indigo-600 hover:to-indigo-800 transition shadow-sm flex items-center gap-1">
                      📍 Voir la course
                    </button>
                  )}
                  {order.status === 'confirmed' && (
                    <>
                      <button onClick={() => handleAction(order._id, 'pickup_confirmed')} disabled={assigning[order._id]} className="text-xs px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg font-medium hover:bg-amber-100 transition disabled:opacity-50">
                        {assigning[order._id] ? '…' : '📦 Récupéré'}
                      </button>
                      <button onClick={() => handleAction(order._id, 'refused')} disabled={assigning[order._id]} className="text-xs px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg font-medium hover:bg-red-100 transition disabled:opacity-50">
                        {assigning[order._id] ? '…' : '✕ Refuser'}
                      </button>
                    </>
                  )}
                  {order.status === 'shipped' && !order.deliveryStartedAt && (
                    <button onClick={() => openCourseModal(order)} className="text-xs px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-bold hover:from-amber-600 hover:to-orange-600 transition shadow-sm flex items-center gap-1">
                      🚀 Commencer la course
                    </button>
                  )}
                  {order.status === 'shipped' && order.deliveryStartedAt && order.deliveryEndLat && (
                    <button onClick={() => openTrackingModal(order)} className="text-xs px-3 py-2 bg-gradient-to-r from-indigo-500 to-indigo-700 text-white rounded-lg font-bold hover:from-indigo-600 hover:to-indigo-800 transition shadow-sm flex items-center gap-1">
                      📍 Voir la course
                    </button>
                  )}
                  {order.status === 'shipped' && (
                    <button onClick={() => openDeliveryModal(order._id)} disabled={assigning[order._id]} className="text-xs px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg font-medium hover:bg-green-100 transition disabled:opacity-50">
                      {assigning[order._id] ? '…' : '✅ Livré'}
                    </button>
                  )}
                  <Link to={`/ecom/livreur/delivery/${order._id}`} className="text-xs px-3 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg font-medium hover:bg-gray-100 transition">
                    Détails
                  </Link>
                  {order.clientPhone && (
                    <a href={`tel:${order.clientPhone}`} className="text-xs px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg font-medium hover:bg-blue-100 transition">
                      📞 Appeler
                    </a>
                  )}
                </div>

                {/* ── Inline tracking panel ── */}
                {order.deliveryStartedAt && order.deliveryEndLat && expandedCard === order._id && (() => {
                  const distKm = order.deliveryDistanceKm || 0;
                  const remaining = liveGps ? Math.max(0, Math.round(haversineKm(liveGps.lat, liveGps.lng, order.deliveryEndLat, order.deliveryEndLng) * 100) / 100) : distKm;
                  const pct = distKm > 0 ? Math.max(0, Math.min(100, Math.round(((distKm - remaining) / distKm) * 100))) : 0;
                  const cost = Math.round(distKm * COST_PER_KM);
                  return (
                    <div className="mt-3 space-y-3 border-t border-indigo-100 pt-3">
                      <MiniMap
                        startLat={order.deliveryStartLat} startLng={order.deliveryStartLng}
                        destLat={order.deliveryEndLat} destLng={order.deliveryEndLng}
                        currentLat={liveGps?.lat} currentLng={liveGps?.lng}
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-gray-50 rounded-xl p-2.5 text-center">
                          <p className="text-base font-black text-gray-800">{distKm.toFixed(1)}</p>
                          <p className="text-[9px] text-gray-400 font-semibold uppercase">KM TOTAL</p>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-2.5 text-center">
                          <p className="text-base font-black text-amber-600">{remaining.toFixed(1)}</p>
                          <p className="text-[9px] text-amber-400 font-semibold uppercase">KM RESTANT</p>
                        </div>
                        <div className="bg-emerald-50 rounded-xl p-2.5 text-center">
                          <p className="text-base font-black text-emerald-600">{cost.toLocaleString('fr-FR')}</p>
                          <p className="text-[9px] text-emerald-400 font-semibold uppercase">{symbol}</p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-gradient-to-r from-amber-400 to-emerald-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
                      </div>
                      {order.deliveryEndAddress && (
                        <p className="text-[10px] text-indigo-600 truncate">📍 {order.deliveryEndAddress}</p>
                      )}
                      <a
                        href={`https://www.google.com/maps/dir/?api=1${liveGps ? `&origin=${liveGps.lat},${liveGps.lng}` : ''}&destination=${order.deliveryEndLat},${order.deliveryEndLng}&travelmode=driving`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition"
                      >
                        🗺️ Naviguer (Google Maps)
                      </a>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LivreurDeliveries;
