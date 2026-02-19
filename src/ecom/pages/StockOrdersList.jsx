import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useMoney } from '../hooks/useMoney.js';
import ecomApi from '../services/ecommApi.js';

const EMPTY_FORM = {
  productId: '', productName: '', sourcing: 'local', quantity: '',
  weightKg: '', pricePerKg: '', purchasePrice: '', sellingPrice: '',
  supplierName: '', expectedArrival: '', trackingNumber: '', notes: ''
};

const StockOrdersList = () => {
  const { user } = useEcomAuth();
  const { fmt, symbol } = useMoney();
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeId } = useParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [products, setProducts] = useState([]);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formInitLoading, setFormInitLoading] = useState(false);

  useEffect(() => {
    loadOrders();
    if (location.pathname.endsWith('/new')) {
      openNewModal();
    } else if (routeId) {
      openEditModal(routeId);
    }
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await ecomApi.get('/stock/orders');
      const ordersData = response.data?.data?.orders || response.data?.data || [];
      setOrders(Array.isArray(ordersData) ? ordersData : []);
    } catch { setError('Erreur chargement'); setOrders([]); }
    finally { setLoading(false); }
  };

  const loadProducts = async () => {
    try {
      const r = await ecomApi.get('/products', { params: { isActive: true } });
      const d = r.data?.data || [];
      setProducts(Array.isArray(d) ? d : []);
    } catch { setProducts([]); }
  };

  const openNewModal = () => {
    setEditingId(null); setFormData(EMPTY_FORM); setFormError('');
    loadProducts(); setShowModal(true);
  };

  const openEditModal = async (orderId) => {
    setEditingId(orderId); setFormData(EMPTY_FORM); setFormError('');
    setFormInitLoading(true); loadProducts(); setShowModal(true);
    try {
      const res = await ecomApi.get(`/stock/orders/${orderId}`);
      const o = res.data.data;
      setFormData({
        productId: o.productId?._id || o.productId || '', productName: o.productName || '',
        sourcing: o.sourcing || 'local', quantity: o.quantity?.toString() || '',
        weightKg: o.weightKg?.toString() || '', pricePerKg: o.pricePerKg?.toString() || '',
        purchasePrice: o.purchasePrice?.toString() || '', sellingPrice: o.sellingPrice?.toString() || '',
        supplierName: o.supplierName || '',
        expectedArrival: o.expectedArrival ? new Date(o.expectedArrival).toISOString().split('T')[0] : '',
        trackingNumber: o.trackingNumber || '', notes: o.notes || ''
      });
    } catch { setFormError('Erreur chargement commande'); }
    finally { setFormInitLoading(false); }
  };

  const closeModal = () => {
    setShowModal(false); setEditingId(null); setFormData(EMPTY_FORM); setFormError('');
    if (location.pathname.endsWith('/new') || routeId) {
      navigate('/ecom/stock/orders', { replace: true });
    }
  };

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setFormLoading(true); setFormError('');
    const qty = parseInt(formData.quantity) || 0;
    const wKg = parseFloat(formData.weightKg) || 0;
    const pKg = parseFloat(formData.pricePerKg) || 0;
    const pp = parseFloat(formData.purchasePrice) || 0;
    const sp = parseFloat(formData.sellingPrice) || 0;
    const tc = wKg * pKg;
    const payload = {
      productId: formData.productId || undefined, productName: formData.productName,
      sourcing: formData.sourcing, quantity: qty, weightKg: wKg, pricePerKg: pKg,
      purchasePrice: pp, sellingPrice: sp, transportCost: tc,
      supplierName: formData.supplierName, expectedArrival: formData.expectedArrival || undefined,
      trackingNumber: formData.trackingNumber, notes: formData.notes
    };
    try {
      if (editingId) await ecomApi.put(`/stock/orders/${editingId}`, payload);
      else await ecomApi.post('/stock/orders', payload);
      closeModal(); loadOrders();
    } catch (err) { setFormError(err.response?.data?.message || 'Erreur sauvegarde'); }
    finally { setFormLoading(false); }
  };

  const updateOrderStatus = async (orderId, action) => {
    try { await ecomApi.put(`/stock/orders/${orderId}/${action}`); loadOrders(); }
    catch { setError('Erreur mise à jour'); }
  };

  const qty = parseInt(formData.quantity) || 0;
  const wKg = parseFloat(formData.weightKg) || 0;
  const pKg = parseFloat(formData.pricePerKg) || 0;
  const pp = parseFloat(formData.purchasePrice) || 0;
  const sp = parseFloat(formData.sellingPrice) || 0;
  const tc = wKg * pKg;
  const totalCostCalcForm = pp * qty + tc;
  const totalSelling = sp * qty;
  const estProfit = totalSelling - totalCostCalcForm;

  const iCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Gestion des fournisseurs</h1>
        <button onClick={openNewModal} className="bg-blue-600 text-white px-3 py-2 sm:px-4 rounded-lg hover:bg-blue-700 text-sm font-medium">
          + Commande fournisseur
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">{error}</div>}

      <div className="bg-white shadow rounded-lg overflow-hidden overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produit</th>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Sourcing</th>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qté</th>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Achat</th>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Vente</th>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Transport</th>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
              <th className="px-3 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {orders.length === 0 ? (
              <tr><td colSpan="9" className="px-4 py-8 text-center text-gray-500">Aucune commande fournisseur trouvée</td></tr>
            ) : orders.map((order) => {
              const totalPurchase = (order.purchasePrice || 0) * (order.quantity || 0);
              const totalCostCalc = totalPurchase + (order.transportCost || 0);
              return (
                <tr key={order._id} className="hover:bg-gray-50">
                  <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
                    <button onClick={() => openEditModal(order._id)} className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline text-left">{order.productName || 'N/A'}</button>
                    {order.supplierName && <div className="text-[10px] sm:text-xs text-gray-500">{order.supplierName}</div>}
                  </td>
                  <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap hidden sm:table-cell">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${order.sourcing === 'chine' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                      {order.sourcing === 'chine' ? 'Chine' : 'Local'}
                    </span>
                  </td>
                  <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap">
                    <div className="text-xs sm:text-sm font-bold text-gray-900">{order.quantity || 0}</div>
                    {order.weightKg > 0 && <div className="text-[10px] sm:text-xs text-gray-500">{order.weightKg} kg</div>}
                  </td>
                  <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap hidden md:table-cell"><div className="text-xs sm:text-sm text-gray-900">{fmt(order.purchasePrice)}</div></td>
                  <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap hidden md:table-cell"><div className="text-xs sm:text-sm text-gray-900">{fmt(order.sellingPrice)}</div></td>
                  <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap hidden lg:table-cell"><div className="text-xs sm:text-sm text-gray-900">{fmt(order.transportCost)}</div></td>
                  <td className="px-3 sm:px-4 py-3 sm:py-4 whitespace-nowrap"><div className="text-xs sm:text-sm font-semibold text-gray-900">{fmt(totalCostCalc)}</div></td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${order.status === 'received' ? 'bg-green-100 text-green-800' : order.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {order.status === 'received' ? 'Reçue' : order.status === 'cancelled' ? 'Annulée' : 'En transit'}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                    <button onClick={() => openEditModal(order._id)} className="text-blue-600 hover:text-blue-900 mr-3">Modifier</button>
                    {order.status === 'in_transit' && (
                      <>
                        <button onClick={() => updateOrderStatus(order._id, 'receive')} className="text-green-600 hover:text-green-900 mr-3">Recevoir</button>
                        <button onClick={() => updateOrderStatus(order._id, 'cancel')} className="text-red-600 hover:text-red-900">Annuler</button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Modal popup ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-lg font-bold text-gray-900">{editingId ? 'Modifier la commande' : 'Nouvelle commande de stock'}</h2>
              <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition text-gray-400 hover:text-gray-700 text-2xl leading-none">&times;</button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-6 py-5">
              {formInitLoading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <form id="stock-order-form" onSubmit={handleSubmit} className="space-y-5">
                  {formError && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">{formError}</div>}

                  {/* Section: Produit & Sourcing */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Produit et sourcing</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Produit *</label>
                        <select name="productId" required value={formData.productId}
                          onChange={(e) => {
                            const sel = products.find(p => p._id === e.target.value);
                            setFormData(prev => ({
                              ...prev,
                              productId: e.target.value,
                              productName: sel?.name || prev.productName,
                              purchasePrice: sel?.productCost ? sel.productCost.toString() : prev.purchasePrice,
                              sellingPrice: sel?.sellingPrice ? sel.sellingPrice.toString() : prev.sellingPrice,
                            }));
                          }}
                          className={iCls}>
                          <option value="">Sélectionnez un produit</option>
                          {products.map(p => (
                            <option key={p._id} value={p._id}>
                              {p.name}{p.stock !== undefined ? ` — stock: ${p.stock}` : ''}{p.status ? ` (${p.status})` : ''}
                            </option>
                          ))}
                        </select>
                        {formData.productId && (() => {
                          const sel = products.find(p => p._id === formData.productId);
                          if (!sel) return null;
                          return (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <span className="inline-flex items-center gap-1 text-[11px] bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                                Stock actuel: <strong className={sel.stock <= (sel.reorderThreshold || 10) ? 'text-red-600' : 'text-emerald-600'}>{sel.stock} unités</strong>
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] bg-blue-50 text-blue-700 px-2 py-1 rounded-md">
                                Coût achat: <strong>{fmt(sel.productCost)}</strong>
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md">
                                Prix vente: <strong>{fmt(sel.sellingPrice)}</strong>
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] bg-orange-50 text-orange-700 px-2 py-1 rounded-md">
                                Livraison: <strong>{fmt(sel.deliveryCost)}</strong>
                              </span>
                              {sel.avgAdsCost > 0 && (
                                <span className="inline-flex items-center gap-1 text-[11px] bg-purple-50 text-purple-700 px-2 py-1 rounded-md">
                                  Moy. pub: <strong>{fmt(sel.avgAdsCost)}</strong>
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Sourcing *</label>
                        <select name="sourcing" required value={formData.sourcing} onChange={handleChange} className={iCls}>
                          <option value="local">Local</option>
                          <option value="chine">Chine</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Quantité *</label>
                        <input type="number" name="quantity" required min="1" value={formData.quantity} onChange={handleChange} className={iCls} placeholder="100" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Fournisseur</label>
                        <input type="text" name="supplierName" value={formData.supplierName} onChange={handleChange} className={iCls} placeholder="Nom du fournisseur" />
                      </div>
                    </div>
                  </div>

                  {/* Section: Prix & Poids */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Prix et poids</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Poids total (kg) *</label>
                        <input type="number" name="weightKg" required min="0" step="0.01" value={formData.weightKg} onChange={handleChange} className={iCls} placeholder="0.00" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Prix par kg ({symbol}) *</label>
                        <input type="number" name="pricePerKg" required min="0" step="0.01" value={formData.pricePerKg} onChange={handleChange} className={iCls} placeholder="0" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Prix d'achat unitaire ({symbol}) *
                          {formData.productId && products.find(p => p._id === formData.productId)?.productCost > 0 && (
                            <span className="ml-1 text-[10px] font-normal text-blue-500">auto-rempli depuis le produit</span>
                          )}
                        </label>
                        <input type="number" name="purchasePrice" required min="0" step="0.01" value={formData.purchasePrice} onChange={handleChange} className={iCls} placeholder="0" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Prix de vente unitaire ({symbol}) *
                          {formData.productId && products.find(p => p._id === formData.productId)?.sellingPrice > 0 && (
                            <span className="ml-1 text-[10px] font-normal text-blue-500">auto-rempli depuis le produit</span>
                          )}
                        </label>
                        <input type="number" name="sellingPrice" required min="0" step="0.01" value={formData.sellingPrice} onChange={handleChange} className={iCls} placeholder="0" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Coût transport (calculé)</label>
                        <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700">{fmt(tc)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Section: Livraison */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Livraison</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Date d'arrivée prévue</label>
                        <input type="date" name="expectedArrival" value={formData.expectedArrival} onChange={handleChange} className={iCls} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Numéro de suivi</label>
                        <input type="text" name="trackingNumber" value={formData.trackingNumber} onChange={handleChange} className={iCls} placeholder="Ex: CN123456789" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                      <textarea name="notes" rows="2" value={formData.notes} onChange={handleChange} className={iCls} placeholder="Notes supplémentaires..." />
                    </div>
                  </div>

                  {/* Financial preview */}
                  {qty > 0 && pp > 0 && (() => {
                    const selProd = products.find(p => p._id === formData.productId);
                    const delivCost = selProd?.deliveryCost || 0;
                    const netProfitPerUnit = sp - pp - delivCost;
                    const netProfit = netProfitPerUnit * qty - tc;
                    const marginPct = sp > 0 ? Math.round((netProfitPerUnit / sp) * 100) : 0;
                    return (
                      <div className={`rounded-xl p-4 border ${netProfit >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <p className="text-xs font-semibold text-gray-600 uppercase mb-3">Aperçu financier</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                          <div><span className="text-gray-500 text-xs">Coût achat total</span><p className="font-bold text-red-600">{fmt(totalCostCalcForm)}</p></div>
                          <div><span className="text-gray-500 text-xs">Valeur vente totale</span><p className="font-bold text-blue-600">{fmt(totalSelling)}</p></div>
                          <div><span className="text-gray-500 text-xs">Marge brute</span><p className={`font-bold ${estProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(estProfit)}</p></div>
                          {delivCost > 0 && (
                            <div><span className="text-gray-500 text-xs">Livraison ({fmt(delivCost)}/u)</span><p className="font-semibold text-orange-600">−{fmt(delivCost * qty)}</p></div>
                          )}
                          <div><span className="text-gray-500 text-xs">Profit net réel</span><p className={`font-bold text-lg ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(netProfit)}</p></div>
                          <div><span className="text-gray-500 text-xs">Marge nette/u ({marginPct}%)</span><p className={`font-semibold ${netProfitPerUnit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(netProfitPerUnit)}</p></div>
                        </div>
                      </div>
                    );
                  })()}
                </form>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
              <button type="button" onClick={closeModal} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition">Annuler</button>
              <button type="submit" form="stock-order-form" disabled={formLoading || formInitLoading}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
                {formLoading ? (editingId ? 'Modification…' : 'Création…') : (editingId ? 'Modifier' : 'Créer la commande')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockOrdersList;
