import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import { formatMoney } from '../utils/currency.js';
import ecomApi from '../services/ecommApi.js';

const SL = { pending: 'En attente', confirmed: 'Confirmé', shipped: 'Expédié', delivered: 'Livré', returned: 'Retour', cancelled: 'Annulé', unreachable: 'Injoignable', called: 'Appelé', postponed: 'Reporté', reported: 'Reporté' };
const SC = {
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  confirmed: 'bg-primary-50 text-primary-700 border-primary-100',
  shipped: 'bg-primary-50 text-primary-800 border-primary-100',
  delivered: 'bg-green-50 text-green-700 border-green-100',
  returned: 'bg-orange-50 text-orange-700 border-orange-100',
  cancelled: 'bg-red-50 text-red-700 border-red-100',
  unreachable: 'bg-gray-100 text-gray-700 border-gray-200',
  called: 'bg-blue-50 text-blue-700 border-blue-100',
  postponed: 'bg-purple-50 text-purple-700 border-purple-100',
  reported: 'bg-purple-50 text-purple-700 border-purple-100'
};

// Résout le nom du produit depuis order.product ou rawData.line_items (Shopify/Skelo)
const getDisplayProduct = (order) => {
  if (!order) return '—';
  const isValid = (v) => v && typeof v === 'string' && v.trim() && isNaN(v.trim());
  if (isValid(order.product)) return order.product.trim();
  if (order.rawData?.line_items?.length) {
    const names = order.rawData.line_items
      .map(li => { const t = li.title || li.name || ''; const q = li.quantity > 1 ? ` x${li.quantity}` : ''; return t ? `${t}${q}` : null; })
      .filter(Boolean);
    if (names.length) return names.join(', ');
  }
  return '—';
};

// Extrait le téléphone depuis rawData quand clientPhone est vide
const getEffectivePhone = (order) => {
  if (!order) return '';
  if (order.clientPhone) return order.clientPhone;
  if (!order.rawData || typeof order.rawData !== 'object') return '';
  const phoneKeyRe = /^(tel|telephone|phone|mobile|whatsapp|gsm|portable|contact|numero|cellulaire)/i;
  const phoneValRe = /^\+?\d[\d\s().\-]{7,}\d$/;
  // D'abord: chercher par nom de clé
  for (const [k, v] of Object.entries(order.rawData)) {
    if (phoneKeyRe.test(k.trim()) && v) {
      const clean = String(v).replace(/\D/g, '');
      if (clean.length >= 8) return clean;
    }
  }
  // Ensuite: chercher par valeur ressemblant à un numéro
  for (const [, v] of Object.entries(order.rawData)) {
    if (v && phoneValRe.test(String(v).trim())) {
      const clean = String(v).replace(/\D/g, '');
      if (clean.length >= 8) return clean;
    }
  }
  return '';
};

const OrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, workspace } = useEcomAuth();
  const { fmt, symbol } = useMoney();
  // Affiche le montant avec conversion vers la devise de l'utilisateur
  const fmtOrder = (amount, orderCurrency) => fmt(amount, orderCurrency || 'XAF');
  const isAdmin = user?.role === 'ecom_admin' || user?.role === 'ecom_closeuse';
  const invoiceRef = useRef(null);

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryNote, setDeliveryNote] = useState('');
  const [deliveryMessage, setDeliveryMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [whatsAppSent, setWhatsAppSent] = useState(false);
  const [livreurs, setLivreurs] = useState([]);
  const [selectedLivreur, setSelectedLivreur] = useState('');
  const [customPhoneNumber, setCustomPhoneNumber] = useState('');
  const [showCustomWhatsAppModal, setShowCustomWhatsAppModal] = useState(false);
  const [sendingCustomWhatsApp, setSendingCustomWhatsApp] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showLivreurMenu, setShowLivreurMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sendingToPool, setSendingToPool] = useState(false);
  const [sendingToGroup, setSendingToGroup] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [deliveryGroups, setDeliveryGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [copiedOrder, setCopiedOrder] = useState(false);
  const optionsMenuRef = useRef(null);
  const livreurMenuRef = useRef(null);

  const fetchOrder = async () => {
    if (!id || !/^[a-f0-9]{24}$/i.test(id)) {
      setError('ID de commande invalide');
      setLoading(false);
      return;
    }
    const MAX_ATTEMPTS = 5;
    const DELAYS = [1000, 2000, 3000, 5000]; // ms entre chaque tentative
    let lastErr = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const res = await ecomApi.get(`/orders/${id}`);
        setOrder(res.data.data);
        setEditData(res.data.data);
        setLoading(false);
        return; // succès
      } catch (err) {
        lastErr = err;
        const status = err?.response?.status;
        // Erreur définitive : pas de retry
        if (status === 403) {
          setError('Accès refusé: cette commande ne vous est pas assignée.');
          setLoading(false);
          return;
        }
        // Dernière tentative : afficher l'erreur
        if (attempt === MAX_ATTEMPTS - 1) break;
        // Attendre avant de réessayer
        await new Promise((r) => setTimeout(r, DELAYS[attempt] ?? 5000));
      }
    }
    // Toutes les tentatives ont échoué
    const status = lastErr?.response?.status;
    if (status === 404) {
      setError('Commande introuvable');
    } else {
      setError('Erreur lors du chargement de la commande');
    }
    setLoading(false);
  };

  const fetchLivreurs = async () => {
    try {
      const res = await ecomApi.get('/users/livreurs/list');
      setLivreurs(res.data.data || []);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchOrder(); fetchLivreurs(); }, [id]);
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 4000); return () => clearTimeout(t); } }, [success]);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(e.target)) {
        setShowOptionsMenu(false);
      }
      if (livreurMenuRef.current && !livreurMenuRef.current.contains(e.target)) {
        setShowLivreurMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStatusChange = async (newStatus) => {
    try {
      await ecomApi.put(`/orders/${id}`, { status: newStatus });
      setSuccess(`Statut changé: ${SL[newStatus]}`);
      fetchOrder();
    } catch { setError('Erreur changement statut'); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = {};
      ['status', 'notes', 'clientName', 'clientPhone', 'city', 'product', 'quantity', 'price', 'currency', 'deliveryLocation', 'deliveryTime'].forEach(f => {
        if (editData[f] !== undefined) updates[f] = editData[f];
      });
      await ecomApi.put(`/orders/${id}`, updates);
      setSuccess('Commande mise à jour');
      setEditing(false);
      fetchOrder();
    } catch { setError('Erreur sauvegarde'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette commande ?')) return;
    setDeleting(true);
    try {
      await ecomApi.delete(`/orders/${id}`);
      setSuccess('Commande supprimée');
      setTimeout(() => navigate('/ecom/orders'), 1000);
    } catch {
      setError('Erreur lors de la suppression');
      setDeleting(false);
    }
  };

  const buildDeliveryMessage = () => {
    const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const todayName = dayNames[new Date().getDay()];
    const deliveryDay = editData.deliveryDay || order.deliveryDay || `aujourd'hui ${todayName}`;

    const quantity = editData.quantity ?? order.quantity ?? 1;
    const price    = editData.price    ?? order.price    ?? 0;
    const total    = price * quantity;

    const brandName = workspace?.name || 'Notre boutique';

    let msg = `*${brandName}*\n\n`;
    msg += `Nom du client : ${order.clientName || '—'}\n\n`;
    msg += `Ville : ${order.city || '—'}\n\n`;
    msg += `Lieu de la livraison : ${editData.deliveryLocation || order.deliveryLocation || order.rawData?.['Address 1'] || '—'}\n\n`;
    msg += `Jour de la livraison : ${deliveryDay}\n\n`;
    msg += `Numéro : ${getEffectivePhone(order) || '—'}\n\n`;
    msg += `Heure de livraison : ${editData.deliveryTime || order.deliveryTime || 'Disponible maintenant'}\n\n`;
    msg += `Article : ${getDisplayProduct(order)}\n\n`;
    msg += `Quantité : ${String(quantity).padStart(2, '0')}\n\n`;
    msg += `Montant : ${total.toLocaleString('fr-FR')} ${order.currency || symbol}`;
    if (order.notes) msg += `\n\nNotes : ${order.notes}`;
    if (deliveryNote) msg += `\n\nInstructions : ${deliveryNote}`;
    return msg;
  };

  const openDeliveryModal = () => {
    setDeliveryNote('');
    setCopied(false);
    setShowDeliveryModal(true);
  };

  useEffect(() => {
    if (showDeliveryModal && order) {
      setDeliveryMessage(buildDeliveryMessage());
    }
  }, [showDeliveryModal, deliveryNote, editData.deliveryLocation, editData.deliveryTime, editData.deliveryDay, editData.price, editData.quantity]);

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(deliveryMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback */ }
  };

  const handleSendWhatsApp = async () => {
    setSendingWhatsApp(true);
    try {
      await ecomApi.post(`/orders/${id}/send-whatsapp`, {
        message: deliveryMessage
      });
      setWhatsAppSent(true);
      setSuccess('Message WhatsApp envoyé avec succès');
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur envoi WhatsApp');
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const handleSendCustomWhatsApp = async () => {
    if (!customPhoneNumber.trim()) {
      setError('Numéro de téléphone requis');
      return;
    }
    
    setSendingCustomWhatsApp(true);
    setError('');
    try {
      await ecomApi.post(`/orders/${id}/send-whatsapp`, {
        phoneNumber: customPhoneNumber.trim()
      });
      setSuccess(`Détails de la commande envoyés à ${customPhoneNumber.trim()}`);
      setShowCustomWhatsAppModal(false);
      setCustomPhoneNumber('');
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur envoi WhatsApp');
    } finally {
      setSendingCustomWhatsApp(false);
    }
  };

  const handleSendToDelivery = async (withWhatsApp = false) => {
    try {
      if (!selectedLivreur) {
        setError('Sélectionnez un livreur.');
        return;
      }

      const livreur = livreurs.find(l => l._id === selectedLivreur);
      await ecomApi.post(`/orders/${id}/delivery-offer`, {
        mode: 'targeted',
        livreurId: selectedLivreur,
        message: deliveryMessage,
        note: deliveryNote,
        deliveryLocation: editData.deliveryLocation || order.deliveryLocation || '',
        deliveryTime: editData.deliveryTime || order.deliveryTime || '',
        sendWhatsApp: withWhatsApp
      });
      setSuccess(`Offre envoyée${livreur ? ' à ' + (livreur.name || livreur.email) : ''}. Le livreur doit accepter dans l'application.`);
      setShowDeliveryModal(false);
      setDeliveryNote('');
      setSelectedLivreur('');
      fetchOrder();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Erreur envoi livreur');
    }
  };

  const openGroupModal = async () => {
    setShowGroupModal(true);
    setLoadingGroups(true);
    setSelectedGroups([]);
    try {
      const res = await ecomApi.get('/orders/config/whatsapp');
      const groups = (res.data.data?.deliveryGroupNumbers || []).filter(g => g.isActive !== false && g.phoneNumber);
      setDeliveryGroups(groups);
      setSelectedGroups(groups.map((_, i) => i)); // tout sélectionné par défaut
    } catch (err) {
      setDeliveryGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleSendToGroup = async () => {
    setSendingToGroup(true);
    setError('');
    try {
      const targets = selectedGroups.map(i => deliveryGroups[i]).filter(Boolean);
      if (targets.length === 0) { setError('Sélectionnez au moins un groupe.'); setSendingToGroup(false); return; }
      await ecomApi.post(`/orders/${id}/send-to-delivery-groups`, {
        message: deliveryMessage || buildDeliveryMessage(),
        targetJids: targets.map(g => g.phoneNumber)
      });
      setSuccess(`✅ Message envoyé à ${targets.length} groupe(s).`);
      setShowGroupModal(false);
      setShowDeliveryModal(false);
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Erreur envoi groupe');
    } finally {
      setSendingToGroup(false);
    }
  };

  const handleTogglePool = async () => {
    setSendingToPool(true);
    setError('');
    try {
      const newReady = !order.readyForDelivery;
      await ecomApi.patch(`/orders/${id}/ready-for-delivery`, { ready: newReady });
      setSuccess(newReady ? '✅ Commande passée au livreur — visible par les livreurs disponibles.' : 'Commande retirée du livreur.');
      fetchOrder();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur.');
    } finally {
      setSendingToPool(false);
    }
  };

  const handlePrint = () => {
    const printContent = invoiceRef.current;
    if (!printContent) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Facture ${order.orderId || id}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #1a1a1a; font-size: 13px; }
          .invoice-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
          .invoice-title { font-size: 28px; font-weight: 800; color: #111; letter-spacing: -0.5px; }
          .invoice-subtitle { font-size: 11px; color: #6b7280; margin-top: 4px; }
          .invoice-meta { text-align: right; font-size: 12px; color: #6b7280; }
          .invoice-meta strong { color: #111; display: block; font-size: 13px; }
          .section { margin-bottom: 24px; }
          .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 8px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .info-item label { font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 2px; }
          .info-item span { font-size: 13px; color: #111; font-weight: 500; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th { background: #f9fafb; padding: 10px 12px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
          td { padding: 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
          .total-row td { font-weight: 700; font-size: 15px; border-top: 2px solid #111; border-bottom: none; padding-top: 14px; }
          .status-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
          .status-pending { background: #fef3c7; color: #92400e; }
          .status-confirmed { background: #dbeafe; color: #053326; }
          .status-shipped { background: #e9d5ff; color: #6b21a8; }
          .status-delivered { background: #d1fae5; color: #065f46; }
          .status-returned { background: #fed7aa; color: #9a3412; }
          .status-cancelled { background: #fecaca; color: #991b1b; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 11px; color: #9ca3af; }
          .raw-data { margin-top: 20px; }
          .raw-data table td:first-child { font-weight: 600; color: #6b7280; font-size: 11px; text-transform: uppercase; width: 35%; }
          @media print { body { padding: 15px; } }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  const handleCopyOrder = () => {
    const brandName = workspace?.name || 'Notre boutique';
    const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const todayName = dayNames[new Date().getDay()];
    const deliveryDay = order.deliveryDay || `aujourd'hui ${todayName}`;
    const phone = getEffectivePhone(order);
    const quantity = order.quantity || 1;
    const total = (order.price || 0) * quantity;

    let msg = `*${brandName}*\n\n`;
    msg += `Nom du client : ${order.clientName || '—'}\n\n`;
    msg += `Ville : ${order.city || '—'}\n\n`;
    msg += `Lieu de la livraison : ${order.deliveryLocation || order.rawData?.['Address 1'] || '—'}\n\n`;
    msg += `Jour de la livraison : ${deliveryDay}\n\n`;
    msg += `Numéro : ${phone || '—'}\n\n`;
    msg += `Heure de livraison : ${order.deliveryTime || 'Disponible maintenant'}\n\n`;
    msg += `Article : ${getDisplayProduct(order)}\n\n`;
    msg += `Quantité : ${String(quantity).padStart(2, '0')}\n\n`;
    msg += `Montant : ${total.toLocaleString('fr-FR')} ${order.currency || symbol}`;
    if (order.notes) msg += `\n\nNotes : ${order.notes}`;

    navigator.clipboard.writeText(msg).then(() => {
      setCopiedOrder(true);
      setTimeout(() => setCopiedOrder(false), 2500);
    }).catch(() => {
      setError('Impossible de copier dans le presse-papier');
    });
  };

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';
  const fmtDateTime = (d) => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
  const cleanPhone = (phone) => phone ? phone.replace(/^'+/, '').trim() : '';

  if (loading) return (
    <div className="p-4 sm:p-6">
      <div className="h-8 w-44 bg-gray-200 rounded-lg animate-pulse mb-6" />
      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    </div>
  );

  if (error && !order) return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="bg-red-50 text-red-800 rounded-xl p-6 text-center border border-red-200">
        <p className="font-medium">{error}</p>
        <Link to="/ecom/orders" className="text-sm text-red-600 underline mt-2 inline-block">Retour aux commandes</Link>
      </div>
    </div>
  );

  if (!order) return null;

  const rawEntries = order.rawData ? Object.entries(order.rawData).filter(([, v]) => v) : [];

  // Icône SVG réutilisable — taille uniforme w-5 h-5 partout
  const Icon = ({ d, d2, className = 'w-5 h-5' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d={d}/>{d2 && <path d={d2}/>}
    </svg>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-5 max-w-4xl mx-auto">

      {success && (
        <div className="mb-4 px-4 py-3 bg-green-50 text-green-800 rounded-xl text-sm border border-green-100 flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>
          {success}
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate('/ecom/orders')} aria-label="Retour" className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">#{order.orderId || 'Commande'}</h1>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${SC[order.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>{SL[order.status] || order.status}</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">{fmtDateTime(order.createdAt)}</p>
        </div>
        {/* Overflow menu */}
        <div className="relative" ref={optionsMenuRef}>
          <button onClick={() => setShowOptionsMenu(!showOptionsMenu)} aria-label="Plus d'options" className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/></svg>
          </button>
          {showOptionsMenu && (
            <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
              <button onClick={() => { setShowOptionsMenu(false); handleCopyOrder(); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 cursor-pointer">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                Copier la commande
              </button>
              <button onClick={() => { setShowOptionsMenu(false); handlePrint(); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 cursor-pointer">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                Imprimer facture
              </button>
              {isAdmin && <>
                <div className="my-1 mx-3 border-t border-gray-100"/>
                <button onClick={() => { setShowOptionsMenu(false); handleDelete(); }} disabled={deleting} className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 flex items-center gap-3 disabled:opacity-50 cursor-pointer">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  {deleting ? 'Suppression...' : 'Supprimer'}
                </button>
              </>}
            </div>
          )}
        </div>
      </div>

      {/* ── Action bar ── */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        <button onClick={handlePrint} className="h-10 px-4 bg-gray-900 text-white rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-gray-800 transition-colors cursor-pointer">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
          <span>Facture</span>
        </button>

        {(isAdmin || user?.role === 'super_admin') && (
          order.assignedLivreur ? (
            <span className="h-10 px-4 bg-gray-100 text-gray-600 rounded-xl text-sm font-medium flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
              Livreur assigné
            </span>
          ) : (
            <div className="relative" ref={livreurMenuRef}>
              <button onClick={() => setShowLivreurMenu(!showLivreurMenu)} className="h-10 px-4 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-gray-50 transition-colors cursor-pointer">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                <span>Livreur</span>
                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/></svg>
              </button>
              {showLivreurMenu && (
                <div className="absolute left-0 mt-1.5 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                  {(order.status === 'pending' || order.status === 'confirmed') && (
                    <button onClick={() => { setShowLivreurMenu(false); openDeliveryModal(); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 cursor-pointer">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                      Livreur spécifique
                    </button>
                  )}
                  <button onClick={() => { setShowLivreurMenu(false); handleTogglePool(); }} disabled={sendingToPool} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 disabled:opacity-50 cursor-pointer">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    {sendingToPool ? '...' : order.readyForDelivery ? 'Retirer du pool' : 'Tous les livreurs'}
                  </button>
                  <div className="my-1 mx-3 border-t border-gray-100"/>
                  <button onClick={() => { setShowLivreurMenu(false); openGroupModal(); }} disabled={sendingToGroup} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 disabled:opacity-50 cursor-pointer">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    {sendingToGroup ? '...' : 'Envoyer au groupe'}
                  </button>
                </div>
              )}
            </div>
          )
        )}

        {getEffectivePhone(order) ? (
          <a
            href={`https://wa.me/${getEffectivePhone(order).replace(/\D/g, '')}?text=${encodeURIComponent(`Bonjour${order.clientName ? ' ' + order.clientName : ''}, nous avons essayé de vous contacter concernant votre commande de *${getDisplayProduct(order)}*.\n\nMerci de nous recontacter dès que possible afin de finaliser votre livraison.\n\nCordialement,\n${workspace?.name || 'Notre équipe'}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-10 px-4 bg-green-600 text-white rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-green-700 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            <span>WhatsApp</span>
          </a>
        ) : (
          <button onClick={() => { setCustomPhoneNumber(''); setShowCustomWhatsAppModal(true); }} className="h-10 px-4 bg-green-600 text-white rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-green-700 transition-colors cursor-pointer">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            <span>WhatsApp</span>
          </button>
        )}

        {isAdmin && !editing && (
          <button onClick={() => setEditing(true)} className="h-10 px-4 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-gray-50 transition-colors cursor-pointer">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            <span>Modifier</span>
          </button>
        )}
      </div>

      {/* ── Statut ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</p>
          {(order.tags || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {order.tags.map(tag => (
                <span key={tag} className="text-xs font-medium px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">{tag}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(SL).map(([key, label]) => (
            <button key={key} onClick={() => handleStatusChange(key)} disabled={order.status === key}
              className={`h-9 px-3.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${order.status === key ? `${SC[key]} shadow-sm` : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
          <button onClick={() => { const c = prompt('Statut personnalisé :'); if (c?.trim()) handleStatusChange(c.trim()); }}
            className="h-9 px-3.5 rounded-lg text-sm font-medium text-gray-400 border border-dashed border-gray-300 hover:border-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
            + Personnalisé
          </button>
        </div>
      </div>

      {/* ── Main grid ── */}
      <div className="grid lg:grid-cols-5 gap-4">

        {/* ─ Left col ─ */}
        <div className="lg:col-span-3 space-y-4">

          {/* Client */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Client</p>

            {editing ? (
              <div className="grid sm:grid-cols-2 gap-3">
                {[
                  { label: 'Nom', key: 'clientName' },
                  { label: 'Téléphone', key: 'clientPhone' },
                  { label: 'Ville', key: 'city' },
                  { label: 'Adresse', key: 'address', placeholder: 'Ex: 123 rue…' },
                  { label: 'Produit', key: 'product' },
                  { label: 'Prix', key: 'price', type: 'number' },
                  { label: 'Quantité', key: 'quantity', type: 'number' },
                  { label: 'Lieu de livraison', key: 'deliveryLocation', placeholder: 'Ex: Neptune Mbalgong' },
                  { label: 'Heure de livraison', key: 'deliveryTime', placeholder: 'Ex: Disponible maintenant' },
                ].map(({ label, key, type = 'text', placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                    <input type={type} value={editData[key] ?? ''} placeholder={placeholder}
                      onChange={e => setEditData(p => ({ ...p, [key]: type === 'number' ? (parseFloat(e.target.value) || (key === 'quantity' ? 1 : 0)) : e.target.value }))}
                      className="w-full h-10 px-3 bg-gray-50 rounded-lg text-sm border-0 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:bg-white transition-all placeholder:text-gray-300" />
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                  <textarea value={editData.notes || ''} onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full px-3 py-2.5 bg-gray-50 rounded-lg text-sm border-0 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:bg-white transition-all resize-none" />
                </div>
                <div className="sm:col-span-2 flex gap-2 pt-1">
                  <button onClick={handleSave} disabled={saving} className="h-10 px-5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors cursor-pointer">{saving ? 'Sauvegarde...' : 'Sauvegarder'}</button>
                  <button onClick={() => { setEditing(false); setEditData(order); }} className="h-10 px-5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors cursor-pointer">Annuler</button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Avatar row */}
                <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                  <div className="w-11 h-11 bg-gray-900 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-base">{(order.clientName || '?')[0].toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-base font-semibold text-gray-900">{order.clientName || '—'}</p>
                    <p className="text-sm text-gray-400">{order.city || '—'}</p>
                  </div>
                </div>

                {/* Info rows — icônes grises uniformes w-5 h-5 */}
                {(() => { const phone = getEffectivePhone(order); return phone ? (
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                    <div className="flex items-center gap-2">
                      <a href={`tel:${cleanPhone(phone)}`} className="text-sm font-medium text-gray-900 hover:text-green-600 transition-colors">{cleanPhone(phone)}</a>
                      <a href={`https://wa.me/${cleanPhone(phone).replace(/\D/g, '')}?text=${encodeURIComponent(`Bonjour${order.clientName ? ' ' + order.clientName : ''}, nous avons essayé de vous contacter concernant votre commande de *${getDisplayProduct(order)}*.\n\nMerci de nous recontacter dès que possible afin de finaliser votre livraison.\n\nCordialement,\n${workspace?.name || 'Notre équipe'}`)}`}
                        target="_blank" rel="noopener noreferrer"
                        className="h-6 px-2 bg-green-50 text-green-700 rounded-md text-xs font-medium hover:bg-green-100 transition-colors flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        WA
                      </a>
                    </div>
                  </div>
                ) : null; })()}

                {order.clientEmail && (
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                    <a href={`mailto:${order.clientEmail}`} className="text-sm font-medium text-gray-900 hover:text-gray-600 transition-colors truncate">{order.clientEmail}</a>
                  </div>
                )}

                {order.address && (
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{order.address}</p>
                      {order.city && (
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${order.address}, ${order.city}`)}`} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-gray-400 hover:text-gray-600 transition-colors mt-0.5 inline-block">
                          Voir sur Maps →
                        </a>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  <p className="text-sm font-medium text-gray-900">{fmtDate(order.date)}</p>
                </div>

                {order.deliveryLocation && (
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
                    <p className="text-sm font-medium text-gray-900">{order.deliveryLocation}</p>
                  </div>
                )}

                {order.deliveryTime && (
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <p className={`text-sm font-medium ${(order.status === 'postponed' || order.status === 'reported') ? 'text-yellow-700' : 'text-gray-900'}`}>{order.deliveryTime}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Données source */}
          {rawEntries.length > 0 && !editing && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Données source</p>
              <div className="divide-y divide-gray-50">
                {rawEntries.map(([key, val]) => (
                  <div key={key} className="flex justify-between py-2 gap-4">
                    <span className="text-sm text-gray-400 shrink-0">{key}</span>
                    <span className="text-sm text-gray-800 font-medium text-right truncate" title={typeof val === 'object' ? JSON.stringify(val) : val}>{typeof val === 'object' ? JSON.stringify(val) : val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {order.notes && !editing && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{order.notes}</p>
            </div>
          )}
        </div>

        {/* ─ Right col ─ */}
        <div className="lg:col-span-2 space-y-4">

          {/* Résumé commande */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Résumé</p>
            <p className="text-sm font-medium text-gray-800 mb-4 leading-snug">{getDisplayProduct(order)}</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Prix unitaire</span>
                <span className="font-medium text-gray-800">{fmtOrder(order.price, order.currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Quantité</span>
                <span className="font-medium text-gray-800">×{order.quantity || 1}</span>
              </div>
              <div className="border-t border-gray-100 pt-2 flex justify-between">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="font-bold text-gray-900">{fmtOrder((order.price || 0) * (order.quantity || 1), order.currency)}</span>
              </div>
            </div>
          </div>

          {/* Historique */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Historique</p>
            <div className="space-y-3 pl-1">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-gray-300 mt-1.5 flex-shrink-0 ring-2 ring-white ring-offset-1"></div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Commande créée</p>
                  <p className="text-xs text-gray-400">{fmtDateTime(order.createdAt)}</p>
                </div>
              </div>
              {order.updatedAt !== order.createdAt && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-gray-500 mt-1.5 flex-shrink-0 ring-2 ring-white ring-offset-1"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">Dernière modification</p>
                    <p className="text-xs text-gray-400">{fmtDateTime(order.updatedAt)}</p>
                  </div>
                </div>
              )}
              {order.source === 'google_sheets' && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0 ring-2 ring-white ring-offset-1"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">Import Google Sheets</p>
                    <p className="text-xs text-gray-400">Ligne {order.sheetRowId?.replace('row_', '')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Actions</p>
            <div className="space-y-2">
              <button onClick={handleCopyOrder} className={`w-full h-10 rounded-lg text-sm font-medium flex items-center gap-2.5 px-3 transition-colors cursor-pointer ${copiedOrder ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'}`}>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                {copiedOrder ? 'Copié !' : 'Copier la commande'}
              </button>
              <button onClick={handlePrint} className="w-full h-10 rounded-lg bg-gray-50 text-gray-700 text-sm font-medium flex items-center gap-2.5 px-3 hover:bg-gray-100 transition-colors cursor-pointer">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                Imprimer la facture
              </button>
              {(isAdmin || user?.role === 'super_admin') && (
                order.assignedLivreur ? (
                  <div className="w-full h-10 rounded-lg bg-gray-50 text-gray-500 text-sm font-medium flex items-center gap-2.5 px-3">
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    Livreur assigné
                  </div>
                ) : (
                  <>
                    {(order.status === 'pending' || order.status === 'confirmed') && (
                      <button onClick={openDeliveryModal} className="w-full h-10 rounded-lg bg-gray-50 text-gray-700 text-sm font-medium flex items-center gap-2.5 px-3 hover:bg-gray-100 transition-colors cursor-pointer">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                        Livreur spécifique
                      </button>
                    )}
                    <button onClick={handleTogglePool} disabled={sendingToPool} className="w-full h-10 rounded-lg bg-gray-50 text-gray-700 text-sm font-medium flex items-center gap-2.5 px-3 hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                      {sendingToPool ? '...' : order.readyForDelivery ? 'Retirer du pool' : 'Tous les livreurs'}
                    </button>
                  </>
                )
              )}
              {order.status === 'shipped' && (
                <button onClick={() => handleStatusChange('delivered')} className="w-full h-10 rounded-lg bg-green-600 text-white text-sm font-semibold flex items-center gap-2.5 px-3 hover:bg-green-700 transition-colors cursor-pointer">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                  Marquer comme livré
                </button>
              )}
              {cleanPhone(getEffectivePhone(order)) && (
                <a href={`https://wa.me/${cleanPhone(getEffectivePhone(order)).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Bonjour${order.clientName ? ' ' + order.clientName : ''}, nous avons essayé de vous contacter concernant votre commande de *${getDisplayProduct(order)}*.\n\nMerci de nous recontacter dès que possible afin de finaliser votre livraison.\n\nCordialement,\n${workspace?.name || 'Notre équipe'}`)}`} target="_blank" rel="noopener noreferrer"
                  className="w-full h-10 rounded-lg bg-green-50 text-green-700 text-sm font-medium flex items-center gap-2.5 px-3 hover:bg-green-100 transition-colors cursor-pointer">
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Contacter sur WhatsApp
                </a>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Group Picker Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" onClick={() => setShowGroupModal(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl max-w-sm w-full p-5 pb-8 sm:pb-5" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5 sm:hidden"/>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Envoyer au groupe WhatsApp</h3>
                <p className="text-xs text-gray-400">Sélectionnez les groupes destinataires</p>
              </div>
            </div>
            {loadingGroups ? (
              <div className="py-8 flex justify-center"><div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"/></div>
            ) : deliveryGroups.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-sm text-gray-500 mb-4">Aucun groupe de livraison configuré.</p>
                <button
                  onClick={() => { setShowGroupModal(false); navigate('/ecom/settings?tab=delivery_groups'); }}
                  className="inline-flex items-center gap-2 h-10 px-4 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                  Configurer les groupes
                </button>
              </div>
            ) : (
              <div className="space-y-2 mb-5">
                {deliveryGroups.map((g, i) => (
                  <label key={i} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selectedGroups.includes(i) ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input
                      type="checkbox"
                      checked={selectedGroups.includes(i)}
                      onChange={() => setSelectedGroups(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
                      className="w-4 h-4 accent-gray-900"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{g.label || 'Groupe sans nom'}</p>
                      <p className="text-xs font-mono text-gray-400 truncate">{g.phoneNumber}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-2.5">
              {deliveryGroups.length > 0 && (
                <button
                  onClick={handleSendToGroup}
                  disabled={sendingToGroup || selectedGroups.length === 0}
                  className="flex-1 h-11 bg-green-600 text-white rounded-2xl text-sm font-semibold hover:bg-green-700 disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
                >
                  {sendingToGroup ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : null}
                  {sendingToGroup ? 'Envoi...' : `Envoyer (${selectedGroups.length})`}
                </button>
              )}
              <button onClick={() => setShowGroupModal(false)} className="h-11 px-5 bg-gray-100 text-gray-700 rounded-2xl text-sm font-medium hover:bg-gray-200 transition-colors">Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Delivery Modal */}
      {showDeliveryModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" onClick={() => setShowDeliveryModal(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-xl max-w-lg w-full max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-5 pt-4 pb-3 border-b border-gray-100 z-10">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4 sm:hidden"/>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/></svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Envoyer au livreur</h3>
                  <p className="text-xs text-gray-400">Le livreur recevra une proposition dans l'application</p>
                </div>
              </div>
            </div>

            <div className="px-5 pt-4 pb-5 space-y-4">
              {/* Livreur */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Assigner un livreur</label>
                {livreurs.length > 0 ? (
                  <select
                    value={selectedLivreur}
                    onChange={e => setSelectedLivreur(e.target.value)}
                    className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white cursor-pointer"
                  >
                    <option value="">-- Choisir un livreur --</option>
                    {livreurs.map(l => (
                      <option key={l._id} value={l._id}>
                        {l.name || l.email} {l.phone ? `(${l.phone})` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-xs text-gray-400 italic py-2">Aucun livreur dans l'équipe. Ajoutez-en un dans Gestion Équipe.</p>
                )}
              </div>

              {/* Infos livraison */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Lieu de livraison</label>
                  <input type="text" value={editData.deliveryLocation || ''} onChange={e => setEditData(p => ({ ...p, deliveryLocation: e.target.value }))} placeholder="Ex: Neptune Mbalgong" className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Heure de livraison</label>
                  <input type="text" value={editData.deliveryTime || ''} onChange={e => setEditData(p => ({ ...p, deliveryTime: e.target.value }))} placeholder="Ex: Disponible maintenant" className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Jour de livraison</label>
                  <input type="text" value={editData.deliveryDay || ''} onChange={e => setEditData(p => ({ ...p, deliveryDay: e.target.value }))} placeholder={`Ex: aujourd'hui lundi`} className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Quantité</label>
                    <input type="number" min="1" value={editData.quantity ?? order?.quantity ?? 1} onChange={e => setEditData(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))} className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Prix unitaire</label>
                    <input type="number" min="0" value={editData.price ?? order?.price ?? 0} onChange={e => setEditData(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))} className="w-full h-10 px-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent" />
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Instructions supplémentaires</label>
                <textarea value={deliveryNote} onChange={e => setDeliveryNote(e.target.value)} rows={2} placeholder="Ex: Appeler avant livraison, fragile..." className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none" />
              </div>

              {/* Message */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Message pour le livreur</label>
                  <button onClick={handleCopyMessage} className={`text-xs font-medium h-6 px-2.5 rounded-lg transition-colors ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {copied ? 'Copié !' : 'Copier'}
                  </button>
                </div>
                <textarea value={deliveryMessage} onChange={e => setDeliveryMessage(e.target.value)} rows={10} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-gray-50 resize-none" />
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2 pt-1 pb-3 sm:pb-0">
                <button onClick={() => handleSendToDelivery(false)} className="w-full sm:flex-1 h-11 bg-gray-900 text-white rounded-2xl text-sm font-semibold hover:bg-gray-800 flex items-center justify-center gap-2 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/></svg>
                  Application
                </button>
                <button onClick={() => handleSendToDelivery(true)} className="w-full sm:flex-1 h-11 bg-green-600 text-white rounded-2xl text-sm font-semibold hover:bg-green-700 flex items-center justify-center gap-2 transition-colors">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  App + WhatsApp
                </button>
                <button onClick={handleSendToGroup} disabled={sendingToGroup} className="w-full sm:flex-1 h-11 bg-gray-100 text-gray-700 rounded-2xl text-sm font-semibold hover:bg-gray-200 disabled:opacity-40 flex items-center justify-center gap-2 transition-colors">
                  {sendingToGroup ? <div className="w-4 h-4 border-2 border-gray-700 border-t-transparent rounded-full animate-spin"/> : <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>}
                  Groupe
                </button>
                <button onClick={() => setShowDeliveryModal(false)} className="w-full sm:w-auto h-11 px-5 bg-gray-100 text-gray-700 rounded-2xl text-sm font-medium hover:bg-gray-200 transition-colors">Annuler</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden invoice for print */}
      <div className="hidden">
        <div ref={invoiceRef}>
          <div className="invoice-header">
            <div>
              <div className="invoice-title">FACTURE</div>
              <div className="invoice-subtitle">Commande {order.orderId || `#${order.sheetRowId?.replace('row_', '')}`}</div>
            </div>
            <div className="invoice-meta">
              <strong>{fmtDate(order.date)}</strong>
              Statut: <span className={`status-badge status-${order.status}`}>{SL[order.status]}</span>
            </div>
          </div>

          <div className="section">
            <div className="section-title">Client</div>
            <div className="info-grid">
              <div className="info-item"><label>Nom</label><span>{order.clientName || '—'}</span></div>
              <div className="info-item"><label>Téléphone</label><span>{getEffectivePhone(order) || '—'}</span></div>
              <div className="info-item"><label>Ville</label><span>{order.city || '—'}</span></div>
              {order.rawData?.['Address 1'] && <div className="info-item"><label>Adresse</label><span>{order.rawData['Address 1']}</span></div>}
            </div>
          </div>

          <div className="section">
            <div className="section-title">Détail commande</div>
            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th style={{textAlign: 'center'}}>Qté</th>
                  <th style={{textAlign: 'right'}}>Prix unit.</th>
                  <th style={{textAlign: 'right'}}>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{getDisplayProduct(order)}</td>
                  <td style={{textAlign: 'center'}}>{order.quantity || 1}</td>
                  <td style={{textAlign: 'right'}}>{fmtOrder(order.price, order.currency)}</td>
                  <td style={{textAlign: 'right'}}>{fmtOrder((order.price || 0) * (order.quantity || 1), order.currency)}</td>
                </tr>
                <tr className="total-row">
                  <td colSpan="3">TOTAL</td>
                  <td style={{textAlign: 'right'}}>{fmtOrder((order.price || 0) * (order.quantity || 1), order.currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {rawEntries.length > 0 && (
            <div className="section raw-data">
              <div className="section-title">Informations complémentaires</div>
              <table>
                <tbody>
                  {rawEntries.map(([key, val]) => (
                    <tr key={key}>
                      <td>{key}</td>
                      <td>{typeof val === 'object' ? JSON.stringify(val) : val}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {order.notes && (
            <div className="section">
              <div className="section-title">Notes</div>
              <p style={{fontSize: '12px', color: '#374151'}}>{order.notes}</p>
            </div>
          )}

          <div className="footer">
            <p>Facture générée le {new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
      </div>

      {/* Modal relance WhatsApp */}
      {showCustomWhatsAppModal && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50" onClick={() => setShowCustomWhatsAppModal(false)}>
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 sm:hidden"/>

            <div className="px-5 pt-4 pb-7 sm:pb-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Relance client</h3>
                    <p className="text-xs text-gray-400">{order.clientName || 'Client'} · #{order.orderId || order._id?.slice(-6)}</p>
                  </div>
                </div>
                <button onClick={() => setShowCustomWhatsAppModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>

              {/* Phone input */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Numéro WhatsApp</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={customPhoneNumber}
                  onChange={(e) => setCustomPhoneNumber(e.target.value)}
                  placeholder="237612345678"
                  className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent focus:bg-white transition-all placeholder:text-gray-300"
                />
                <p className="text-[11px] text-gray-400 mt-1.5 ml-0.5">Indicatif pays + numéro, sans + ni espaces</p>
              </div>

              {/* Aperçu message */}
              <div className="bg-gray-50 rounded-xl p-4 mb-5 border border-gray-100">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Message envoyé</p>
                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line">
                  {`Bonjour${order.clientName ? ' ' + order.clientName : ''}, nous avons essayé de vous contacter concernant votre commande de *${getDisplayProduct(order)}*.\n\nMerci de nous recontacter dès que possible afin de finaliser votre livraison.\n\nCordialement,\n${workspace?.name || 'Notre équipe'}`}
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCustomWhatsAppModal(false)}
                  className="flex-1 h-12 bg-gray-100 text-gray-700 rounded-2xl text-sm font-semibold hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSendCustomWhatsApp}
                  disabled={sendingCustomWhatsApp || !customPhoneNumber.trim()}
                  className="flex-1 h-12 bg-green-600 text-white rounded-2xl text-sm font-semibold hover:bg-green-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {sendingCustomWhatsApp ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  )}
                  {sendingCustomWhatsApp ? 'Envoi...' : 'Envoyer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderDetail;
