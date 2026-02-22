import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';

const SL = { pending: 'En attente', confirmed: 'Confirmé', shipped: 'Expédié', delivered: 'Livré', returned: 'Retour', cancelled: 'Annulé' };
const SC = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
  shipped: 'bg-purple-100 text-purple-800 border-purple-200',
  delivered: 'bg-green-100 text-green-800 border-green-200',
  returned: 'bg-orange-100 text-orange-800 border-orange-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200'
};

const OrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, workspace } = useEcomAuth();
  const { fmt } = useMoney();
  const isAdmin = user?.role === 'ecom_admin';
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

  const fetchOrder = async () => {
    try {
      const res = await ecomApi.get(`/orders/${id}`);
      setOrder(res.data.data);
      setEditData(res.data.data);
    } catch {
      setError('Commande introuvable');
    } finally {
      setLoading(false);
    }
  };

  const fetchLivreurs = async () => {
    try {
      const res = await ecomApi.get('/users/livreurs/list');
      setLivreurs(res.data.data || []);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchOrder(); fetchLivreurs(); }, [id]);
  useEffect(() => { if (success) { const t = setTimeout(() => setSuccess(''), 4000); return () => clearTimeout(t); } }, [success]);

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
      ['status', 'notes', 'clientName', 'clientPhone', 'city', 'product', 'quantity', 'price', 'deliveryLocation', 'deliveryTime'].forEach(f => {
        if (editData[f] !== undefined) updates[f] = editData[f];
      });
      await ecomApi.put(`/orders/${id}`, updates);
      setSuccess('Commande mise à jour');
      setEditing(false);
      fetchOrder();
    } catch { setError('Erreur sauvegarde'); }
    finally { setSaving(false); }
  };

  const buildDeliveryMessage = () => {
    const total = (order.price || 0) * (order.quantity || 1);
    const brandName = workspace?.name || 'Notre boutique';
    const now = new Date();
    const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
    const todayName = dayNames[now.getDay()];

    let msg = `*${brandName}*\n\n`;
    msg += `Nom du client : ${order.clientName || '—'}\n\n`;
    msg += `Ville : ${order.city || '—'}\n\n`;
    msg += `Lieu de la livraison : ${editData.deliveryLocation || order.deliveryLocation || order.rawData?.['Address 1'] || '—'}\n\n`;
    msg += `Jour de la livraison : aujourd'hui ${todayName}\n\n`;
    msg += `Numéro : ${order.clientPhone || '—'}\n\n`;
    msg += `Heure de livraison : ${editData.deliveryTime || order.deliveryTime || 'Disponible maintenant'}\n\n`;
    const productName = (!order.product || !isNaN(order.product)) ? '' : order.product;
    const rawProduct = order.rawData ? Object.entries(order.rawData).find(([k, v]) => v && isNaN(v) && /produit|product|article|item|désignation|designation/i.test(k))?.[1] : '';
    msg += `Article : ${productName || rawProduct || '—'}\n\n`;
    msg += `Quantité : ${String(order.quantity || 1).padStart(2, '0')}\n\n`;
    msg += `Montant : ${total.toLocaleString('fr-FR')}fcfa`;
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
  }, [showDeliveryModal, deliveryNote, editData.deliveryLocation, editData.deliveryTime]);

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

  const handleSendToDelivery = async () => {
    try {
      const livreur = livreurs.find(l => l._id === selectedLivreur);
      const phone = livreur?.phone || '';
      if (phone) {
        await ecomApi.post(`/orders/${id}/send-whatsapp`, {
          phoneNumber: phone,
          message: deliveryMessage
        });
        await ecomApi.post(`/orders/${id}/send-whatsapp`, { phone, message: deliveryMessage });
      }
      await ecomApi.put(`/orders/${id}`, {
        status: 'shipped',
        assignedLivreur: selectedLivreur || null,
        notes: deliveryNote ? `${order.notes ? order.notes + ' | ' : ''}Livraison: ${deliveryNote}` : order.notes,
        deliveryLocation: editData.deliveryLocation || order.deliveryLocation || '',
        deliveryTime: editData.deliveryTime || order.deliveryTime || ''
      });
      setSuccess(`Commande envoyée${livreur ? ' à ' + (livreur.name || livreur.email) : ''} + statut expédié`);
      setShowDeliveryModal(false);
      setDeliveryNote('');
      fetchOrder();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Erreur envoi livreur');
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
          .status-confirmed { background: #dbeafe; color: #1e40af; }
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

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '-';
  const fmtDateTime = (d) => d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-4xl mx-auto">
      {success && <div className="mb-3 p-2.5 bg-green-50 text-green-800 rounded-lg text-sm border border-green-200 flex items-center gap-2"><svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>{success}</div>}

      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/ecom/orders')} className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">{order.orderId || `Commande`}</h1>
              <span className={`text-[10px] font-medium px-2.5 py-0.5 rounded-full border ${SC[order.status]}`}>{SL[order.status]}</span>
            </div>
            <p className="text-xs text-gray-400">{fmtDateTime(order.createdAt)}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Imprimer facture */}
          <button onClick={handlePrint} className="px-3 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition text-xs font-medium flex items-center gap-1.5" title="Imprimer facture">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            <span className="hidden sm:inline">Facture</span>
          </button>

          {/* Envoyer au livreur */}
          {(order.status === 'confirmed' || order.status === 'pending') && (
            <button onClick={openDeliveryModal} className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-xs font-medium flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/></svg>
              <span className="hidden sm:inline">Envoyer livreur</span>
            </button>
          )}

          {/* Envoyer détails WhatsApp personnalisé */}
          <button onClick={() => setShowCustomWhatsAppModal(true)} className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-xs font-medium flex items-center gap-1.5">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            <span className="hidden sm:inline">WhatsApp</span>
          </button>

          {/* Modifier */}
          {isAdmin && !editing && (
            <button onClick={() => setEditing(true)} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs font-medium flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              <span className="hidden sm:inline">Modifier</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick status actions */}
      <div className="bg-white rounded-xl shadow-sm border p-3 mb-4">
        <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Changer le statut</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(SL).map(([key, label]) => (
            <button key={key} onClick={() => handleStatusChange(key)} disabled={order.status === key}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border ${order.status === key ? `${SC[key]} ring-2 ring-offset-1 ring-gray-300` : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}>
              {label}
            </button>
          ))}
        </div>
        {(order.tags || []).length > 0 && (
          <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-gray-100">
            <span className="text-[10px] font-semibold text-gray-400 uppercase">Tags</span>
            <div className="flex flex-wrap gap-1.5">
              {order.tags.map(tag => (
                <span key={tag} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                  tag === 'Client' ? 'bg-emerald-100 text-emerald-700' :
                  tag === 'En attente' ? 'bg-amber-100 text-amber-700' :
                  tag === 'Annulé' ? 'bg-red-100 text-red-700' :
                  tag === 'Confirmé' ? 'bg-blue-100 text-blue-700' :
                  tag === 'Expédié' ? 'bg-violet-100 text-violet-700' :
                  tag === 'Retour' ? 'bg-orange-100 text-orange-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{tag}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left: Order info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Client info */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase mb-3">Informations client</p>
            {editing ? (
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Nom</label>
                  <input type="text" value={editData.clientName || ''} onChange={e => setEditData(p => ({ ...p, clientName: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Téléphone</label>
                  <input type="text" value={editData.clientPhone || ''} onChange={e => setEditData(p => ({ ...p, clientPhone: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Ville</label>
                  <input type="text" value={editData.city || ''} onChange={e => setEditData(p => ({ ...p, city: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Produit</label>
                  <input type="text" value={editData.product || ''} onChange={e => setEditData(p => ({ ...p, product: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Prix</label>
                  <input type="number" value={editData.price || 0} onChange={e => setEditData(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Quantité</label>
                  <input type="number" value={editData.quantity || 1} onChange={e => setEditData(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Lieu de livraison</label>
                  <input type="text" value={editData.deliveryLocation || ''} onChange={e => setEditData(p => ({ ...p, deliveryLocation: e.target.value }))} placeholder="Ex: Neptune Mbalgong" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Heure de livraison</label>
                  <input type="text" value={editData.deliveryTime || ''} onChange={e => setEditData(p => ({ ...p, deliveryTime: e.target.value }))} placeholder="Ex: Disponible maintenant" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-medium text-gray-500 mb-1">Notes</label>
                  <textarea value={editData.notes || ''} onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium disabled:opacity-50">{saving ? 'Sauvegarde...' : 'Sauvegarder'}</button>
                  <button onClick={() => { setEditing(false); setEditData(order); }} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-xs font-medium">Annuler</button>
                </div>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-400 uppercase font-medium">Client</p>
                    <p className="text-sm font-semibold text-gray-900">{order.clientName || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-400 uppercase font-medium">Téléphone</p>
                    <p className="text-sm font-semibold text-gray-900">{order.clientPhone || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-400 uppercase font-medium">Ville</p>
                    <p className="text-sm font-semibold text-gray-900">{order.city || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 bg-orange-50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-400 uppercase font-medium">Date</p>
                    <p className="text-sm font-semibold text-gray-900">{fmtDate(order.date)}</p>
                  </div>
                </div>
                {order.deliveryLocation && (
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase font-medium">Lieu de livraison</p>
                      <p className="text-sm font-semibold text-gray-900">{order.deliveryLocation}</p>
                    </div>
                  </div>
                )}
                {order.deliveryTime && (
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-teal-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    </div>
                    <div>
                      <p className="text-[9px] text-gray-400 uppercase font-medium">Heure de livraison</p>
                      <p className="text-sm font-semibold text-gray-900">{order.deliveryTime}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* All sheet data */}
          {rawEntries.length > 0 && !editing && (
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase mb-3">Données Google Sheet</p>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                {rawEntries.map(([key, val]) => (
                  <div key={key} className="flex justify-between py-1.5 border-b border-gray-50">
                    <span className="text-[11px] text-gray-500 font-medium">{key}</span>
                    <span className="text-[11px] text-gray-900 font-medium text-right max-w-[60%] truncate" title={val}>{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {order.notes && !editing && (
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Notes</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Right: Summary + actions */}
        <div className="space-y-4">
          {/* Order summary */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase mb-3">Résumé commande</p>
            <div className="space-y-2.5">
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Produit</span>
                <span className="text-xs font-medium text-gray-900">{order.product || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Prix unitaire</span>
                <span className="text-xs font-medium text-gray-900">{fmt(order.price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-500">Quantité</span>
                <span className="text-xs font-medium text-gray-900">x{order.quantity || 1}</span>
              </div>
              <div className="border-t border-gray-100 pt-2.5 flex justify-between">
                <span className="text-sm font-bold text-gray-900">Total</span>
                <span className="text-sm font-bold text-gray-900">{fmt((order.price || 0) * (order.quantity || 1))}</span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase mb-3">Historique</p>
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <div className="w-2 h-2 rounded-full bg-gray-400 mt-1.5 flex-shrink-0"></div>
                <div>
                  <p className="text-xs font-medium text-gray-900">Commande créée</p>
                  <p className="text-[10px] text-gray-400">{fmtDateTime(order.createdAt)}</p>
                </div>
              </div>
              {order.updatedAt !== order.createdAt && (
                <div className="flex items-start gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0"></div>
                  <div>
                    <p className="text-xs font-medium text-gray-900">Dernière modification</p>
                    <p className="text-[10px] text-gray-400">{fmtDateTime(order.updatedAt)}</p>
                  </div>
                </div>
              )}
              {order.source === 'google_sheets' && (
                <div className="flex items-start gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0"></div>
                  <div>
                    <p className="text-xs font-medium text-gray-900">Importée depuis Google Sheets</p>
                    <p className="text-[10px] text-gray-400">Ligne {order.sheetRowId?.replace('row_', '')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase mb-3">Actions rapides</p>
            <div className="space-y-2">
              <button onClick={handlePrint} className="w-full px-3 py-2.5 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition text-xs font-medium flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
                Imprimer la facture
              </button>
              {(order.status === 'pending' || order.status === 'confirmed') && (
                <button onClick={openDeliveryModal} className="w-full px-3 py-2.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition text-xs font-medium flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/></svg>
                  Envoyer au livreur
                </button>
              )}
              {order.status === 'shipped' && (
                <button onClick={() => handleStatusChange('delivered')} className="w-full px-3 py-2.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition text-xs font-medium flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                  Marquer comme livré
                </button>
              )}
              {order.clientPhone && (
                <a href={`https://wa.me/${order.clientPhone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="w-full px-3 py-2.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition text-xs font-medium flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Contacter sur WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delivery Modal */}
      {showDeliveryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDeliveryModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/></svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Envoyer au livreur</h3>
                <p className="text-[11px] text-gray-400">Le statut passera à "Expédié"</p>
              </div>
            </div>

            {/* Sélection du livreur */}
            <div className="mb-3">
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Assigner un livreur</label>
              {livreurs.length > 0 ? (
                <select
                  value={selectedLivreur}
                  onChange={e => setSelectedLivreur(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
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

            <div className="grid sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Lieu de livraison</label>
                <input type="text" value={editData.deliveryLocation || ''} onChange={e => { setEditData(p => ({ ...p, deliveryLocation: e.target.value })); }} placeholder="Ex: Neptune Mbalgong" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Heure de livraison</label>
                <input type="text" value={editData.deliveryTime || ''} onChange={e => { setEditData(p => ({ ...p, deliveryTime: e.target.value })); }} placeholder="Ex: Disponible maintenant" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
            </div>

            <div className="mb-3">
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Instructions supplémentaires (optionnel)</label>
              <textarea value={deliveryNote} onChange={e => setDeliveryNote(e.target.value)} rows={2} placeholder="Ex: Appeler avant livraison, fragile..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-medium text-gray-500">Message pour le livreur</label>
                <button onClick={handleCopyMessage} className={`text-[10px] font-medium px-2 py-0.5 rounded-md transition ${copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {copied ? 'Copié !' : 'Copier'}
                </button>
              </div>
              <textarea value={deliveryMessage} onChange={e => setDeliveryMessage(e.target.value)} rows={12} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50" />
            </div>

            <div className="flex gap-2">
              <button onClick={handleSendToDelivery} className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-xs font-medium flex items-center justify-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
                Confirmer l'envoi
              </button>
              <button onClick={handleSendWhatsApp} disabled={sendingWhatsApp || whatsAppSent} className={`flex-1 px-4 py-2.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition ${whatsAppSent ? 'bg-green-100 text-green-700' : 'bg-green-600 text-white hover:bg-green-700'} disabled:opacity-60`}>
                {sendingWhatsApp ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Envoi...</>
                ) : whatsAppSent ? (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>Envoyé !</>
                ) : (
                  <><svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>Envoyer WhatsApp</>
                )}
              </button>
              <button onClick={() => setShowDeliveryModal(false)} className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 text-xs font-medium">Annuler</button>
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
              <div className="info-item"><label>Téléphone</label><span>{order.clientPhone || '—'}</span></div>
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
                  <td>{order.product || '—'}</td>
                  <td style={{textAlign: 'center'}}>{order.quantity || 1}</td>
                  <td style={{textAlign: 'right'}}>{fmt(order.price)}</td>
                  <td style={{textAlign: 'right'}}>{fmt((order.price || 0) * (order.quantity || 1))}</td>
                </tr>
                <tr className="total-row">
                  <td colSpan="3">TOTAL</td>
                  <td style={{textAlign: 'right'}}>{fmt((order.price || 0) * (order.quantity || 1))}</td>
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
                      <td>{val}</td>
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

      {/* Modal WhatsApp personnalisé */}
      {showCustomWhatsAppModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCustomWhatsAppModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-4">📱 Envoyer par WhatsApp</h3>
            <p className="text-sm text-gray-600 mb-4">
              Envoyer les détails complets de la commande #{order.orderId || order._id} à un numéro WhatsApp personnalisé
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Numéro WhatsApp</label>
                <input
                  type="text"
                  value={customPhoneNumber}
                  onChange={(e) => setCustomPhoneNumber(e.target.value)}
                  placeholder="Ex: 237612345678"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">Format: 237 + numéro (sans + ni espaces)</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-700 mb-2">Message qui sera envoyé :</p>
                <div className="text-xs text-gray-600 space-y-1">
                  <p>📦 DÉTAILS COMMANDE</p>
                  <p>🔢 Référence: #{order.orderId || 'N/A'}</p>
                  <p>👤 Client: {order.clientName}</p>
                  <p>📞 Téléphone: {order.clientPhone}</p>
                  <p>📍 Ville: {order.city}</p>
                  <p>📦 Produit: {order.product}</p>
                  <p>🔢 Quantité: {order.quantity}</p>
                  <p>💰 Total: {fmt((order.price || 0) * (order.quantity || 1))}</p>
                  <p>📋 Statut: {order.status}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCustomWhatsAppModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleSendCustomWhatsApp}
                disabled={sendingCustomWhatsApp}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
              >
                {sendingCustomWhatsApp ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Envoi...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    Envoyer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderDetail;
