import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import ecomApi from '../services/ecommApi';
import { useMoney } from '../hooks/useMoney';
import { getContextualError } from '../utils/errorMessages';
import {
  Plus, Search, BarChart3, Building2, X, ChevronRight,
  MoreHorizontal, Mail, Phone, Link as LinkIcon, Package2,
  AlertTriangle, CheckCircle2, Clock, ArrowRight, Circle,
  Plane, Check, XCircle,
} from 'lucide-react';

// ═════════════════════════════════════════════════════════════════════════════
//  DESIGN SYSTEM (strict) — aligné sur ReportsList V2
//  spacing : 4 / 8 / 12 / 16 / 24 / 32 / 48
//  radius  : 12px (rounded-xl) / 16px (rounded-2xl) / full pour pills
//  text    : xs(12) / sm(14) / base(16) / lg(18) / xl(20) / 2xl(24) / 5xl(48)
//  colors  : gray-900 / 700 / 500 / 400 / 200 / 100 / 50
//            primary-500 (#0F6B4F) accent unique pour positif
//            red-600 état négatif / orange-600 warning
//  motion  : transition-all duration-200 ease-out
// ═════════════════════════════════════════════════════════════════════════════

const T = 'transition-all duration-200 ease-out';

const EMPTY_ORDER_FORM = {
  productId: '', productName: '', sourcing: 'local', quantity: '',
  weightKg: '', pricePerKg: '', purchasePrice: '', sellingPrice: '',
  supplierName: '', expectedArrival: '', trackingNumber: '', notes: '',
  paidPurchase: false, paidTransport: false, paid: false
};

// ─── Skeleton ──
const Skeleton = () => (
  <div className="px-4 sm:px-6 py-6 space-y-6 max-w-7xl mx-auto">
    <div className="h-10 w-32 bg-gray-100 rounded-xl animate-pulse" />
    <div className="h-24 bg-gray-50 rounded-2xl animate-pulse" />
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-20 bg-gray-50 rounded-xl animate-pulse" />
      ))}
    </div>
    {[...Array(5)].map((_, i) => (
      <div key={i} className="h-16 bg-gray-50 rounded-xl animate-pulse" />
    ))}
  </div>
);

// ─── Compact stat (no colored icon box) ──
const Stat = ({ label, value, sub }) => (
  <div className="py-3">
    <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
    <p className="text-xl font-semibold text-gray-900 tabular-nums tracking-tight">{value}</p>
    {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
  </div>
);

// ─── Period/tab chip — Scalor green pour actif ──
const Chip = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`shrink-0 px-4 h-9 inline-flex items-center text-sm font-medium rounded-full ${T} ${
      active ? 'bg-primary-500 text-white' : 'text-gray-700 hover:bg-gray-100'
    }`}
  >
    {children}
  </button>
);

// ─── Sheet (modal mobile-first) ──
const Sheet = ({ open, onClose, title, children, size = 'sm' }) => {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;
  const maxW = size === 'sm' ? 'sm:max-w-md' : size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-gray-900/40"
        onClick={onClose}
        style={{ animation: 'fadeIn 200ms ease-out' }}
      />
      <div
        className={`relative w-full ${maxW} bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] flex flex-col`}
        style={{ animation: 'slideUp 220ms cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        <div className="sm:hidden flex justify-center pt-3">
          <div className="w-9 h-1 bg-gray-200 rounded-full" />
        </div>
        <div className="px-6 pt-4 pb-3 flex items-center justify-between border-b border-gray-100 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className={`w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 ${T}`} aria-label="Fermer">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};

// ─── Status pill — pill propre avec bg + icône (style Linear/Stripe) ──
const StatusPill = ({ status }) => {
  const cfg = {
    in_transit: { bg: 'bg-amber-50',    text: 'text-amber-800',   ring: 'ring-amber-200/60',   Icon: Plane,   label: 'En transit' },
    received:   { bg: 'bg-primary-50',  text: 'text-primary-700', ring: 'ring-primary-200/60', Icon: Check,   label: 'Reçue' },
    cancelled:  { bg: 'bg-gray-100',    text: 'text-gray-600',    ring: 'ring-gray-200',       Icon: XCircle, label: 'Annulée' },
  }[status] || { bg: 'bg-gray-100', text: 'text-gray-600', ring: 'ring-gray-200', Icon: Circle, label: status };
  const { bg, text, ring, Icon, label } = cfg;

  return (
    <span className={`inline-flex items-center gap-1 px-2 h-[22px] rounded-md text-[11px] font-semibold ring-1 ring-inset ${bg} ${text} ${ring}`}>
      <Icon size={11} strokeWidth={2.5} />
      {label}
    </span>
  );
};

// ─── Payment pill — pill propre ──
const PaymentPill = ({ paid, label }) => (
  <span className={`inline-flex items-center gap-1 px-2 h-[22px] rounded-md text-[11px] font-semibold ring-1 ring-inset ${
    paid
      ? 'bg-primary-50 text-primary-700 ring-primary-200/60'
      : 'bg-red-50 text-red-700 ring-red-200/60'
  }`}>
    {paid ? <Check size={11} strokeWidth={2.5} /> : <XCircle size={11} strokeWidth={2.5} />}
    {label || (paid ? 'Payé' : 'Impayé')}
  </span>
);

// ─── Sourcing pill — neutre, gris ──
const SourcingPill = ({ sourcing }) => (
  <span className="inline-flex items-center gap-1 px-2 h-[22px] rounded-md text-[11px] font-medium bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200">
    <span className="text-[10px]">{sourcing === 'chine' ? '🇨🇳' : '🇨🇲'}</span>
    {sourcing === 'chine' ? 'Chine' : 'Local'}
  </span>
);

// ─── Row action menu ──
const RowMenu = ({ order, onOpen, onStatusChange, onDelete }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 border border-gray-200 ${T}`}
        aria-label="Actions"
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-9 z-20 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[170px]">
            <button onClick={() => { setOpen(false); onOpen(order); }}
              className={`flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 ${T}`}>
              Modifier
            </button>
            {order.status === 'in_transit' && (
              <button onClick={() => { setOpen(false); onStatusChange(order._id, 'receive'); }}
                className={`flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-sm text-primary-700 hover:bg-primary-50 border-t border-gray-100 ${T}`}>
                Marquer reçue
              </button>
            )}
            {order.status === 'received' && (
              <button onClick={() => { setOpen(false); onStatusChange(order._id, 'back-to-transit'); }}
                className={`flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-sm text-amber-700 hover:bg-amber-50 border-t border-gray-100 ${T}`}>
                Repasser en transit
              </button>
            )}
            <button onClick={() => { setOpen(false); onDelete(order._id); }}
              className={`flex items-center gap-2.5 w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 border-t border-gray-100 ${T}`}>
              Supprimer
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// ─── Orders Table — spreadsheet layout ──
const OrdersTable = ({ orders, fmt, onOpen, onStatusChange, onDelete }) => (
  <>
  {/* ── Mobile : cartes empilées ── */}
  <div className="sm:hidden divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
    {orders.map(order => {
      const purchaseTotal = (order.purchasePrice || 0) * (order.quantity || 0);
      const transport = order.transportCost || 0;
      const total = purchaseTotal + transport;
      return (
        <div key={order._id} className="bg-white px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900 text-sm leading-tight">{order.productName || 'Produit sans nom'}</p>
              {order.supplierName && <p className="text-xs text-gray-400 mt-0.5">{order.supplierName}</p>}
            </div>
            <RowMenu order={order} onOpen={onOpen} onStatusChange={onStatusChange} onDelete={onDelete} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <SourcingPill sourcing={order.sourcing} />
            <StatusPill status={order.status} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {order.sourcing === 'chine' ? (
              <>
                <PaymentPill paid={order.paidPurchase} label={order.paidPurchase ? 'Achat payé' : 'Achat impayé'} />
                <PaymentPill paid={order.paidTransport} label={order.paidTransport ? 'Transport payé' : 'Transport impayé'} />
              </>
            ) : (
              <PaymentPill paid={order.paid} label={order.paid ? 'Payé' : 'Impayé'} />
            )}
          </div>
          <div className="mt-2.5 flex items-center gap-4 text-xs text-gray-500">
            <span className="tabular-nums">{order.quantity || 0} unités</span>
            {order.weightKg > 0 && <span className="tabular-nums">{order.weightKg} kg</span>}
            <span className="ml-auto font-black text-gray-900 tabular-nums text-sm">{fmt(total)}</span>
          </div>
        </div>
      );
    })}
  </div>

  {/* ── Desktop : tableau ── */}
  <div className="hidden sm:block overflow-x-auto border border-gray-200 rounded-xl">
    <table className="w-full table-fixed divide-y divide-gray-200 text-sm">
      <colgroup>
        <col className="w-[220px]" />
        <col className="w-[90px]" />
        <col className="w-[80px]" />
        <col className="w-[120px]" />
        <col className="w-[120px]" />
        <col className="w-[130px]" />
        <col className="w-[160px]" />
        <col className="w-[110px]" />
        <col className="w-[60px]" />
      </colgroup>
      <thead>
        <tr className="bg-gray-50">
          {['Produit', 'Sourcing', 'Qté', 'Achat', 'Transport', 'Total', 'Paiement', 'Statut', 'Actions'].map(h => (
            <th key={h} className="px-3 py-2.5 text-left text-xs font-bold text-gray-500 uppercase tracking-widest whitespace-nowrap border-b border-gray-200">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 bg-white">
        {orders.map((order, idx) => {
          const purchaseTotal = (order.purchasePrice || 0) * (order.quantity || 0);
          const transport = order.transportCost || 0;
          const total = purchaseTotal + transport;
          return (
            <tr key={order._id} className={`hover:bg-primary-50/30 ${T} ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}>

              {/* Produit */}
              <td className="px-3 py-3 align-top">
                <p className="font-semibold text-gray-900 leading-tight break-words">
                  {order.productName || 'Produit sans nom'}
                </p>
                {order.supplierName && (
                  <p className="text-xs text-gray-400 mt-0.5 break-words">{order.supplierName}</p>
                )}
              </td>

              {/* Sourcing */}
              <td className="px-3 py-3 align-top">
                <SourcingPill sourcing={order.sourcing} />
              </td>

              {/* Qté */}
              <td className="px-3 py-3 align-top tabular-nums text-gray-700 font-medium">
                <span>{order.quantity || 0}</span>
                {order.weightKg > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">{order.weightKg} kg</p>
                )}
              </td>

              {/* Achat */}
              <td className="px-3 py-3 align-top tabular-nums text-gray-700 font-medium whitespace-nowrap">
                {fmt(purchaseTotal)}
              </td>

              {/* Transport */}
              <td className="px-3 py-3 align-top tabular-nums text-gray-700 font-medium whitespace-nowrap">
                {transport > 0 ? fmt(transport) : <span className="text-gray-300">—</span>}
              </td>

              {/* Total */}
              <td className="px-3 py-3 align-top tabular-nums font-black text-gray-900 whitespace-nowrap">
                {fmt(total)}
              </td>

              {/* Paiement */}
              <td className="px-3 py-3 align-top">
                {order.sourcing === 'chine' ? (
                  <div className="flex flex-col gap-1">
                    <PaymentPill paid={order.paidPurchase} label={order.paidPurchase ? 'Achat payé' : 'Achat impayé'} />
                    <PaymentPill paid={order.paidTransport} label={order.paidTransport ? 'Transport payé' : 'Transport impayé'} />
                  </div>
                ) : (
                  <PaymentPill paid={order.paid} label={order.paid ? 'Payé' : 'Impayé'} />
                )}
              </td>

              {/* Statut */}
              <td className="px-3 py-3 align-top">
                <StatusPill status={order.status} />
              </td>

              {/* Actions */}
              <td className="px-3 py-3 align-top">
                <RowMenu order={order} onOpen={onOpen} onStatusChange={onStatusChange} onDelete={onDelete} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
  </>
);

// ─── Supplier row — same hairline pattern ──
const SupplierRow = ({ supplier, fmt, onOpen, onEdit, onDelete }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div
      onClick={onOpen}
      className={`group flex items-center gap-4 px-4 sm:px-5 py-4 border-b border-gray-100 hover:bg-gray-50 active:bg-gray-100 cursor-pointer ${T}`}
    >
      {/* Avatar initial */}
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-gray-600 font-semibold text-sm">
        {supplier.name?.charAt(0).toUpperCase()}
      </div>

      {/* Name + contact */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{supplier.name}</p>
        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
          {supplier.phone && (
            <span className="inline-flex items-center gap-1 truncate">
              <Phone size={10} strokeWidth={2} /> {supplier.phone}
            </span>
          )}
          {supplier.email && (
            <span className="inline-flex items-center gap-1 truncate">
              <Mail size={10} strokeWidth={2} /> <span className="truncate max-w-[140px]">{supplier.email}</span>
            </span>
          )}
          {supplier.link && (
            <a
              href={supplier.link.startsWith('http') ? supplier.link : `https://${supplier.link}`}
              target="_blank" rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`inline-flex items-center gap-1 text-primary-500 hover:underline ${T}`}
            >
              <LinkIcon size={10} strokeWidth={2} /> Lien
            </a>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="hidden sm:flex items-center gap-6 shrink-0">
        <div className="text-right">
          <p className="text-xs text-gray-500">Commandes</p>
          <p className="text-sm font-semibold text-gray-900 tabular-nums">{supplier.stats?.totalOrders || 0}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Dépenses</p>
          <p className="text-sm font-semibold text-gray-900 tabular-nums">{fmt(supplier.stats?.totalSpent || 0)}</p>
        </div>
      </div>

      {/* Menu */}
      <div className="shrink-0 relative">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(m => !m); }}
          className={`w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center text-gray-400 ${T}`}
          aria-label="Actions"
        >
          <MoreHorizontal size={16} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }} />
            <div className="absolute right-0 top-9 z-20 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden min-w-[160px]">
              <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(); }}
                className={`block w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 ${T}`}>
                Modifier
              </button>
              <button onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}
                className={`block w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 border-t border-gray-100 ${T}`}>
                Supprimer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN
// ═════════════════════════════════════════════════════════════════════════════
export default function SourcingList() {
  const navigate = useNavigate();
  const { fmt } = useMoney();

  const [activeTab, setActiveTab] = useState('commandes');

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: '', phone: '', link: '', email: '', notes: '' });

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [products, setProducts] = useState([]);

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [orderFormData, setOrderFormData] = useState(EMPTY_ORDER_FORM);
  const [orderFormLoading, setOrderFormLoading] = useState(false);
  const [orderFormError, setOrderFormError] = useState('');

  useEffect(() => {
    loadSuppliers();
    loadOrders();
    loadProducts();
  }, []);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const res = await ecomApi.get('/sourcing/suppliers');
      setSuppliers(res.data.data || []);
      setError(null);
    } catch (err) {
      setError(getContextualError(err, 'load_sourcing'));
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    try {
      setOrdersLoading(true);
      const response = await ecomApi.get('/sourcing/orders');
      const ordersData = response.data?.data?.orders || response.data?.data || [];
      setOrders(Array.isArray(ordersData) ? ordersData : []);
    } catch (err) {
      console.error('Erreur chargement commandes:', err);
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const r = await ecomApi.get('/products', { params: { isActive: true } });
      const d = r.data?.data || [];
      setProducts(Array.isArray(d) ? d : []);
    } catch { setProducts([]); }
  };

  const filteredSuppliers = suppliers.filter(s =>
    s.name?.toLowerCase().includes(search.toLowerCase()) ||
    (s.phone && s.phone.includes(search))
  );

  const { amountToPlan, chinaPurchaseToPlan, chinaTransportToPlan, localToPlan, potentialRevenue, totalSpent, inTransitCount, receivedCount } = useMemo(() => {
    const inTransitOrders = orders.filter(o => o.status === 'in_transit');
    let chinaPurchase = 0, chinaTransport = 0, local = 0, revenue = 0;
    inTransitOrders.forEach(order => {
      revenue += (order.sellingPrice || 0) * (order.quantity || 0);
      if (order.sourcing === 'chine') {
        if (!order.paidPurchase) chinaPurchase += (order.purchasePrice || 0) * (order.quantity || 0);
        if (!order.paidTransport) chinaTransport += order.transportCost || 0;
      } else if (order.sourcing === 'local') {
        if (!order.paid) local += (order.purchasePrice || 0) * (order.quantity || 0);
      }
    });
    return {
      amountToPlan: chinaPurchase + chinaTransport + local,
      chinaPurchaseToPlan: chinaPurchase,
      chinaTransportToPlan: chinaTransport,
      localToPlan: local,
      potentialRevenue: revenue,
      totalSpent: orders.reduce((acc, o) => acc + ((o.purchasePrice || 0) * (o.quantity || 0) + (o.transportCost || 0)), 0),
      inTransitCount: orders.filter(o => o.status === 'in_transit').length,
      receivedCount: orders.filter(o => o.status === 'received').length,
    };
  }, [orders]);

  // Supplier handlers
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) await ecomApi.put(`/sourcing/suppliers/${editingId}`, formData);
      else await ecomApi.post('/sourcing/suppliers', formData);
      closeSupplierModal();
      loadSuppliers();
    } catch (err) {
      alert(getContextualError(err, 'save_sourcing'));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce fournisseur ?')) return;
    try {
      await ecomApi.delete(`/sourcing/suppliers/${id}`);
      loadSuppliers();
    } catch (err) {
      alert(getContextualError(err, 'delete_sourcing'));
    }
  };

  const openSupplierModal = (supplier = null) => {
    if (supplier) {
      setEditingId(supplier._id);
      setFormData({ name: supplier.name || '', phone: supplier.phone || '', link: supplier.link || '', email: supplier.email || '', notes: supplier.notes || '' });
    } else {
      setEditingId(null);
      setFormData({ name: '', phone: '', link: '', email: '', notes: '' });
    }
    setShowSupplierModal(true);
  };

  const closeSupplierModal = () => {
    setShowSupplierModal(false);
    setEditingId(null);
  };

  // Order handlers
  const openOrderModal = (order = null) => {
    if (order) {
      setEditingOrderId(order._id);
      setOrderFormData({
        productId: order.productId?._id || order.productId || '',
        productName: order.productName || '',
        sourcing: order.sourcing || 'local',
        quantity: order.quantity?.toString() || '',
        weightKg: order.weightKg?.toString() || '',
        pricePerKg: order.pricePerKg?.toString() || '',
        purchasePrice: order.purchasePrice?.toString() || '',
        sellingPrice: order.sellingPrice?.toString() || '',
        supplierName: order.supplierName || '',
        expectedArrival: order.expectedArrival ? new Date(order.expectedArrival).toISOString().split('T')[0] : '',
        trackingNumber: order.trackingNumber || '',
        notes: order.notes || '',
        paidPurchase: order.paidPurchase || false,
        paidTransport: order.paidTransport || false,
        paid: order.paid || false
      });
    } else {
      setEditingOrderId(null);
      setOrderFormData(EMPTY_ORDER_FORM);
    }
    setOrderFormError('');
    setShowOrderModal(true);
  };

  const closeOrderModal = () => {
    setShowOrderModal(false);
    setEditingOrderId(null);
    setOrderFormData(EMPTY_ORDER_FORM);
    setOrderFormError('');
  };

  const handleOrderSubmit = async (e) => {
    e.preventDefault();
    setOrderFormLoading(true);
    setOrderFormError('');
    const qty = parseInt(orderFormData.quantity) || 0;
    const wKg = parseFloat(orderFormData.weightKg) || 0;
    const pKg = parseFloat(orderFormData.pricePerKg) || 0;
    const pp = parseFloat(orderFormData.purchasePrice) || 0;
    const sp = parseFloat(orderFormData.sellingPrice) || 0;
    const tc = wKg * pKg;
    const payload = {
      productId: orderFormData.productId || undefined,
      productName: orderFormData.productName,
      sourcing: orderFormData.sourcing,
      quantity: qty, weightKg: wKg, pricePerKg: pKg,
      purchasePrice: pp, sellingPrice: sp, transportCost: tc,
      supplierName: orderFormData.supplierName,
      expectedArrival: orderFormData.expectedArrival || undefined,
      trackingNumber: orderFormData.trackingNumber,
      notes: orderFormData.notes,
      paidPurchase: orderFormData.paidPurchase,
      paidTransport: orderFormData.paidTransport,
      paid: orderFormData.paid
    };
    try {
      if (editingOrderId) await ecomApi.put(`/sourcing/orders/${editingOrderId}`, payload);
      else await ecomApi.post('/sourcing/orders', payload);
      closeOrderModal();
      loadOrders();
    } catch (err) {
      setOrderFormError(getContextualError(err, 'save_order'));
    } finally {
      setOrderFormLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, action) => {
    try {
      if (action === 'receive') {
        await ecomApi.put(`/sourcing/orders/${orderId}`, { status: 'received', paidPurchase: true, paidTransport: true, paid: true });
      } else if (action === 'back-to-transit') {
        await ecomApi.put(`/sourcing/orders/${orderId}`, { status: 'in_transit' });
      } else {
        await ecomApi.put(`/sourcing/orders/${orderId}/${action}`);
      }
      loadOrders();
    } catch (err) {
      setError(getContextualError(err, 'save_order'));
    }
  };

  const deleteOrder = async (orderId) => {
    if (!window.confirm('Supprimer cette commande ? Cette action est irréversible.')) return;
    try {
      await ecomApi.delete(`/sourcing/orders/${orderId}`);
      loadOrders();
    } catch (err) {
      setError(getContextualError(err, 'delete_order'));
    }
  };

  const inputCls = `w-full h-10 px-3 border border-gray-200 rounded-xl text-sm focus:border-gray-900 focus:ring-0 outline-none bg-white ${T}`;
  const labelCls = 'block text-xs font-medium text-gray-500 mb-2';

  if (loading && ordersLoading) return <Skeleton />;

  return (
    <div className="min-h-screen bg-white pb-24">

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* ─── Sticky Header ────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="py-4 flex items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Sourcing</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/ecom/sourcing/stats')}
                className={`hidden sm:inline-flex items-center gap-1.5 px-3 h-9 rounded-full text-sm font-medium text-gray-700 hover:bg-gray-100 ${T}`}
              >
                <BarChart3 size={14} strokeWidth={2} />
                Stats
              </button>
              <button
                onClick={() => activeTab === 'commandes' ? openOrderModal() : openSupplierModal()}
                className={`inline-flex items-center gap-1.5 px-4 h-9 rounded-full bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 ${T}`}
              >
                <Plus size={15} strokeWidth={2.5} />
                <span className="hidden xs:inline">{activeTab === 'commandes' ? 'Commande' : 'Fournisseur'}</span>
              </button>
            </div>
          </div>

          {/* Tab chips */}
          <div className="pb-3 -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-1 w-max">
              <Chip active={activeTab === 'commandes'} onClick={() => setActiveTab('commandes')}>
                Commandes <span className="ml-1.5 text-xs opacity-60 tabular-nums">{orders.length}</span>
              </Chip>
              <Chip active={activeTab === 'fournisseurs'} onClick={() => setActiveTab('fournisseurs')}>
                Fournisseurs <span className="ml-1.5 text-xs opacity-60 tabular-nums">{suppliers.length}</span>
              </Chip>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6">

        {error && (
          <div className="mt-6 p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl flex items-start gap-2 text-sm">
            <AlertTriangle size={15} className="shrink-0 text-red-500 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <X size={14} />
            </button>
          </div>
        )}

        {/* ═══ CONTENT TAB ═══════════════════════════════════════════════════ */}
        <section className="py-8">

          {activeTab === 'commandes' && (
            <>
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Commandes</p>
                {orders.length > 0 && (
                  <p className="text-xs text-gray-400 tabular-nums">{orders.length}</p>
                )}
              </div>

              {ordersLoading ? (
                <div className="py-16 text-center text-sm text-gray-400">Chargement...</div>
              ) : orders.length === 0 ? (
                <div className="py-16 text-center">
                  <Package2 size={28} className="text-gray-200 mx-auto mb-4" strokeWidth={1.5} />
                  <p className="text-sm font-medium text-gray-700 mb-1">Aucune commande</p>
                  <p className="text-sm text-gray-500 mb-6">Créez votre première commande fournisseur</p>
                  <button
                    onClick={() => openOrderModal()}
                    className={`inline-flex items-center gap-1.5 px-4 h-9 rounded-full bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 ${T}`}
                  >
                    <Plus size={14} strokeWidth={2.5} /> Nouvelle commande
                  </button>
                </div>
              ) : (
                <OrdersTable
                  orders={orders}
                  fmt={fmt}
                  onOpen={openOrderModal}
                  onStatusChange={updateOrderStatus}
                  onDelete={deleteOrder}
                />
              )}

              {/* ═══ STATS COMPACT ══════════════════════════════════════════ */}
              <section className="grid grid-cols-2 sm:grid-cols-4 gap-0 sm:gap-8 border-y border-gray-100 divide-x divide-gray-100 sm:divide-x-0 mt-8">
                <div className="px-4 sm:px-0">
                  <Stat label="Total dépensé" value={fmt(totalSpent)} sub="Achat + transport" />
                </div>
                <div className="px-4 sm:px-0">
                  <Stat label="CA potentiel" value={fmt(potentialRevenue)} sub={`${inTransitCount} en transit`} />
                </div>
                <div className="px-4 sm:px-0">
                  <Stat label="En transit" value={inTransitCount} />
                </div>
                <div className="px-4 sm:px-0">
                  <Stat label="Reçues" value={receivedCount} />
                </div>
              </section>

              {/* ═══ HERO METRIC — À prévoir ════════════════════════════════ */}
              <section className="pt-8 pb-2">
                <p className="text-xs font-medium text-primary-600 uppercase tracking-wider mb-2">À prévoir</p>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <h2 className={`text-3xl sm:text-4xl font-semibold tracking-tight tabular-nums leading-none ${amountToPlan > 0 ? 'text-primary-600' : 'text-gray-400'}`}>
                    {fmt(amountToPlan)}
                  </h2>
                </div>
                <p className="text-sm text-gray-500 mt-3">
                  {inTransitCount} commande{inTransitCount > 1 ? 's' : ''} en transit · {amountToPlan > 0 ? 'paiements à effectuer' : 'tout est à jour'}
                </p>
                {(chinaPurchaseToPlan > 0 || chinaTransportToPlan > 0 || localToPlan > 0) && (
                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs">
                    {chinaPurchaseToPlan > 0 && (
                      <span className="text-gray-700">Achat Chine <strong className="font-semibold text-gray-900 tabular-nums">{fmt(chinaPurchaseToPlan)}</strong></span>
                    )}
                    {chinaTransportToPlan > 0 && (
                      <span className="text-gray-700">Transport <strong className="font-semibold text-gray-900 tabular-nums">{fmt(chinaTransportToPlan)}</strong></span>
                    )}
                    {localToPlan > 0 && (
                      <span className="text-gray-700">Local <strong className="font-semibold text-gray-900 tabular-nums">{fmt(localToPlan)}</strong></span>
                    )}
                  </div>
                )}
              </section>
            </>
          )}

          {activeTab === 'fournisseurs' && (
            <>
              {/* Search */}
              <div className="relative mb-6">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" strokeWidth={2} />
                <input
                  type="text"
                  placeholder="Rechercher un fournisseur..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={`w-full h-10 pl-9 pr-3 border border-gray-200 rounded-xl text-sm focus:border-gray-900 focus:ring-0 outline-none bg-white ${T}`}
                />
              </div>

              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Fournisseurs</p>
                {filteredSuppliers.length > 0 && (
                  <p className="text-xs text-gray-400 tabular-nums">{filteredSuppliers.length}</p>
                )}
              </div>

              {loading ? (
                <div className="py-16 text-center text-sm text-gray-400">Chargement...</div>
              ) : filteredSuppliers.length === 0 ? (
                <div className="py-16 text-center">
                  <Building2 size={28} className="text-gray-200 mx-auto mb-4" strokeWidth={1.5} />
                  <p className="text-sm font-medium text-gray-700 mb-1">Aucun fournisseur</p>
                  <p className="text-sm text-gray-500 mb-6">
                    {search ? 'Aucun résultat pour cette recherche' : 'Ajoutez votre premier fournisseur'}
                  </p>
                  {!search && (
                    <button
                      onClick={() => openSupplierModal()}
                      className={`inline-flex items-center gap-1.5 px-4 h-9 rounded-full bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 ${T}`}
                    >
                      <Plus size={14} strokeWidth={2.5} /> Nouveau fournisseur
                    </button>
                  )}
                </div>
              ) : (
                <div className="border-t border-gray-100">
                  {filteredSuppliers.map(s => (
                    <SupplierRow
                      key={s._id}
                      supplier={s}
                      fmt={fmt}
                      onOpen={() => navigate(`/ecom/sourcing/${s._id}`)}
                      onEdit={() => openSupplierModal(s)}
                      onDelete={() => handleDelete(s._id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* Mobile FAB — stats */}
      <button
        onClick={() => navigate('/ecom/sourcing/stats')}
        className={`sm:hidden fixed bottom-6 right-5 z-20 w-12 h-12 rounded-full bg-primary-500 text-white shadow-lg active:scale-95 flex items-center justify-center ${T}`}
        aria-label="Statistiques"
      >
        <BarChart3 size={18} strokeWidth={2} />
      </button>

      {/* ═══ SUPPLIER SHEET ════════════════════════════════════════════════ */}
      <Sheet
        open={showSupplierModal}
        onClose={closeSupplierModal}
        title={editingId ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
      >
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
          <div>
            <label className={labelCls}>Nom *</label>
            <input
              type="text" required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className={inputCls}
              placeholder="Ex: Alibaba"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Téléphone</label>
              <input
                type="text"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className={inputCls}
                placeholder="+237..."
              />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className={inputCls}
                placeholder="contact@..."
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Lien</label>
            <input
              type="text"
              value={formData.link}
              onChange={e => setFormData({ ...formData, link: e.target.value })}
              className={inputCls}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className={`w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:border-gray-900 focus:ring-0 outline-none bg-white resize-none ${T}`}
              rows="3"
              placeholder="Notes..."
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={closeSupplierModal}
              className={`flex-1 h-10 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 ${T}`}
            >
              Annuler
            </button>
            <button
              type="submit"
              className={`flex-1 h-10 rounded-xl bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 ${T}`}
            >
              Enregistrer
            </button>
          </div>
        </form>
      </Sheet>

      {/* ═══ ORDER SHEET ════════════════════════════════════════════════════ */}
      <Sheet
        open={showOrderModal}
        onClose={closeOrderModal}
        title={editingOrderId ? 'Modifier la commande' : 'Nouvelle commande'}
        size="lg"
      >
        <form id="order-form" onSubmit={handleOrderSubmit} className="px-6 py-6 space-y-6">
          {orderFormError && (
            <div className="bg-red-50 border border-red-100 text-red-700 px-3 py-2.5 rounded-xl text-sm flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5 text-red-500" />
              {orderFormError}
            </div>
          )}

          {/* Section: Produit & sourcing */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Produit</p>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Produit *</label>
                <select
                  required
                  value={orderFormData.productId}
                  onChange={(e) => {
                    const sel = products.find(p => p._id === e.target.value);
                    setOrderFormData(prev => ({ ...prev, productId: e.target.value, productName: sel?.name || prev.productName }));
                  }}
                  className={inputCls}
                >
                  <option value="">Sélectionnez un produit</option>
                  {products.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Sourcing *</label>
                  <select
                    value={orderFormData.sourcing}
                    onChange={(e) => setOrderFormData(prev => ({ ...prev, sourcing: e.target.value }))}
                    className={inputCls}
                  >
                    <option value="local">🇨🇲 Local</option>
                    <option value="chine">🇨🇳 Chine</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Quantité *</label>
                  <input
                    type="number" required min="1"
                    value={orderFormData.quantity}
                    onChange={(e) => setOrderFormData(prev => ({ ...prev, quantity: e.target.value }))}
                    className={inputCls}
                    placeholder="100"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Fournisseur</label>
                <input
                  type="text"
                  value={orderFormData.supplierName}
                  onChange={(e) => setOrderFormData(prev => ({ ...prev, supplierName: e.target.value }))}
                  className={inputCls}
                  placeholder="Nom du fournisseur"
                />
              </div>
            </div>
          </div>

          {/* Section: Prix */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Prix &amp; poids</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Poids total (kg)</label>
                <input
                  type="number" step="0.01"
                  value={orderFormData.weightKg}
                  onChange={(e) => setOrderFormData(prev => ({ ...prev, weightKg: e.target.value }))}
                  className={inputCls}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className={labelCls}>Prix par kg (FCFA)</label>
                <input
                  type="number"
                  value={orderFormData.pricePerKg}
                  onChange={(e) => setOrderFormData(prev => ({ ...prev, pricePerKg: e.target.value }))}
                  className={inputCls}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={labelCls}>Prix d'achat unitaire *</label>
                <input
                  type="number" required
                  value={orderFormData.purchasePrice}
                  onChange={(e) => setOrderFormData(prev => ({ ...prev, purchasePrice: e.target.value }))}
                  className={inputCls}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={labelCls}>Prix de vente unitaire *</label>
                <input
                  type="number" required
                  value={orderFormData.sellingPrice}
                  onChange={(e) => setOrderFormData(prev => ({ ...prev, sellingPrice: e.target.value }))}
                  className={inputCls}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

          {/* Section: Paiement */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Statut de paiement</p>
            {orderFormData.sourcing === 'chine' ? (
              <div className="space-y-2">
                <label className={`flex items-start gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 ${T}`}>
                  <input
                    type="checkbox"
                    checked={orderFormData.paidPurchase}
                    onChange={(e) => setOrderFormData(prev => ({ ...prev, paidPurchase: e.target.checked }))}
                    className="w-4 h-4 mt-0.5 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Achat Chine payé</p>
                    <p className="text-xs text-gray-500 mt-0.5">L'achat en Chine a été payé</p>
                  </div>
                </label>
                <label className={`flex items-start gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 ${T}`}>
                  <input
                    type="checkbox"
                    checked={orderFormData.paidTransport}
                    onChange={(e) => setOrderFormData(prev => ({ ...prev, paidTransport: e.target.checked }))}
                    className="w-4 h-4 mt-0.5 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Transport payé</p>
                    <p className="text-xs text-gray-500 mt-0.5">Le transport a été payé</p>
                  </div>
                </label>
              </div>
            ) : (
              <label className={`flex items-start gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 ${T}`}>
                <input
                  type="checkbox"
                  checked={orderFormData.paid}
                  onChange={(e) => setOrderFormData(prev => ({ ...prev, paid: e.target.checked }))}
                  className="w-4 h-4 mt-0.5 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Commande payée</p>
                  <p className="text-xs text-gray-500 mt-0.5">La commande locale a été payée</p>
                </div>
              </label>
            )}
          </div>

          {/* Section: Compléments */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Informations complémentaires</p>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Date d'arrivée prévue</label>
                <input
                  type="date"
                  value={orderFormData.expectedArrival}
                  onChange={(e) => setOrderFormData(prev => ({ ...prev, expectedArrival: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Numéro de suivi</label>
                <input
                  type="text"
                  value={orderFormData.trackingNumber}
                  onChange={(e) => setOrderFormData(prev => ({ ...prev, trackingNumber: e.target.value }))}
                  className={inputCls}
                  placeholder="Tracking..."
                />
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <textarea
                  value={orderFormData.notes}
                  onChange={(e) => setOrderFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className={`w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:border-gray-900 focus:ring-0 outline-none bg-white resize-none ${T}`}
                  rows="2"
                  placeholder="Notes..."
                />
              </div>
            </div>
          </div>
        </form>

        <div className="border-t border-gray-100 px-6 py-4 flex items-center gap-2 sticky bottom-0 bg-white shrink-0">
          <button
            type="button"
            onClick={closeOrderModal}
            className={`flex-1 h-10 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 ${T}`}
          >
            Annuler
          </button>
          <button
            type="submit"
            form="order-form"
            disabled={orderFormLoading}
            className={`flex-[2] h-10 rounded-xl bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 disabled:opacity-40 inline-flex items-center justify-center gap-2 ${T}`}
          >
            {orderFormLoading ? 'Enregistrement...' : <>Enregistrer <ArrowRight size={14} strokeWidth={2.5} /></>}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
