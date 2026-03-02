import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ecomApi from '../services/ecommApi';
import { useMoney } from '../hooks/useMoney';
import { getContextualError } from '../utils/errorMessages';

const I = {
  plus: 'M12 4v16m8-8H4',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  building: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  phone: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  link: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1',
  box: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  mail: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  chevronRight: 'M9 5l7 7-7 7'
};

const Ico = ({d, className="w-5 h-5"}) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={d}/></svg>
);

export default function SourcingList() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '', phone: '', link: '', email: '', notes: ''
  });
  
  const navigate = useNavigate();
  const { formatMoney } = useMoney();

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const res = await ecomApi.get('/sourcing/suppliers');
      setSuppliers(res.data.data);
      setError(null);
    } catch (err) {
      setError(getContextualError(err, 'load_sourcing'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    (s.phone && s.phone.includes(search))
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await ecomApi.put(`/sourcing/suppliers/${editingId}`, formData);
      } else {
        await ecomApi.post('/sourcing/suppliers', formData);
      }
      closeModal();
      loadSuppliers();
    } catch (err) {
      alert(getContextualError(err, 'save_sourcing'));
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Supprimer ce fournisseur ? Toutes ses commandes seront également supprimées. Cette action est irréversible.")) {
      return;
    }
    
    try {
      await ecomApi.delete(`/sourcing/suppliers/${id}`);
      loadSuppliers();
    } catch (err) {
      alert(getContextualError(err, 'delete_sourcing'));
    }
  };

  const openModal = (supplier = null) => {
    if (supplier) {
      setEditingId(supplier._id);
      setFormData({
        name: supplier.name || '',
        phone: supplier.phone || '',
        link: supplier.link || '',
        email: supplier.email || '',
        notes: supplier.notes || ''
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', phone: '', link: '', email: '', notes: '' });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20 lg:pb-8">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <Ico d={I.building} className="w-6 h-6 text-gray-400" />
                Sourcing & Fournisseurs
              </h1>
              <p className="text-sm text-gray-500 mt-1 font-medium">Gérez vos fournisseurs et commandes d'approvisionnement</p>
            </div>
            <button onClick={() => openModal()}
              className="inline-flex items-center justify-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-800 transition active:scale-95 shadow-sm">
              <Ico d={I.plus} className="w-4 h-4" />
              Nouveau fournisseur
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium flex items-center gap-2 border border-red-100">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            {error}
          </div>
        )}

        {/* Stats globales (optionnel, pour plus tard) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <Ico d={I.building} className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total fournisseurs</p>
              <p className="text-2xl font-black text-gray-900">{suppliers.length}</p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <Ico d={I.box} className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Commandes passées</p>
              <p className="text-2xl font-black text-gray-900">
                {suppliers.reduce((acc, s) => acc + (s.stats?.totalOrders || 0), 0)}
              </p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
              <span className="text-xl font-black">XAF</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total dépensé</p>
              <p className="text-2xl font-black text-gray-900">
                {formatMoney(suppliers.reduce((acc, s) => acc + (s.stats?.totalSpent || 0), 0))}
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6 relative">
          <Ico d={I.search} className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un fournisseur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300 transition-all font-medium"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-12 text-gray-500 font-medium animate-pulse">Chargement...</div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
              <Ico d={I.building} className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Aucun fournisseur</h3>
            <p className="text-gray-500 text-sm font-medium mb-6">Commencez par ajouter votre premier fournisseur.</p>
            <button onClick={() => openModal()} className="inline-flex bg-gray-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-800 transition">
              Ajouter un fournisseur
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSuppliers.map(supplier => (
              <div key={supplier._id} 
                onClick={() => navigate(`/ecom/sourcing/${supplier._id}`)}
                className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-300 hover:shadow-md transition-all cursor-pointer group relative">
                
                <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); openModal(supplier); }} className="p-2 bg-gray-50 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition">
                    <Ico d={I.edit} className="w-4 h-4" />
                  </button>
                  <button onClick={(e) => handleDelete(supplier._id, e)} className="p-2 bg-red-50 text-red-500 hover:text-red-700 rounded-lg hover:bg-red-100 transition">
                    <Ico d={I.trash} className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-start gap-4 pr-20">
                  <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center flex-shrink-0 text-gray-500 font-bold text-lg">
                    {supplier.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg mb-1">{supplier.name}</h3>
                    
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 font-medium mt-2">
                      {supplier.phone && (
                        <div className="flex items-center gap-1.5">
                          <Ico d={I.phone} className="w-4 h-4" />
                          <span>{supplier.phone}</span>
                        </div>
                      )}
                      {supplier.email && (
                        <div className="flex items-center gap-1.5">
                          <Ico d={I.mail} className="w-4 h-4" />
                          <span className="truncate max-w-[150px]">{supplier.email}</span>
                        </div>
                      )}
                      {supplier.link && (
                        <a href={supplier.link.startsWith('http') ? supplier.link : `https://${supplier.link}`} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} className="flex items-center gap-1.5 text-blue-600 hover:underline">
                          <Ico d={I.link} className="w-4 h-4" />
                          <span>Lien externe</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="mt-5 pt-4 border-t border-gray-50 flex items-center justify-between">
                  <div className="flex gap-6">
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Commandes</p>
                      <p className="font-bold text-gray-900">{supplier.stats?.totalOrders || 0}</p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Dépenses</p>
                      <p className="font-bold text-gray-900 text-emerald-600">{formatMoney(supplier.stats?.totalSpent || 0)}</p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-gray-900 group-hover:text-white transition-colors">
                    <Ico d={I.chevronRight} className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Ajout/Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="font-bold text-gray-900 text-lg">
                {editingId ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Nom du fournisseur *</label>
                  <input type="text" required value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 outline-none transition-all font-medium text-sm" 
                    placeholder="Ex: Alibaba, Yiwu Tech, etc."/>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Téléphone / WhatsApp</label>
                    <input type="text" value={formData.phone} onChange={e=>setFormData({...formData, phone: e.target.value})}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 outline-none transition-all font-medium text-sm" 
                      placeholder="+86..."/>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Email</label>
                    <input type="email" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 outline-none transition-all font-medium text-sm" 
                      placeholder="contact@..."/>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Lien (Site, Alibaba...)</label>
                  <input type="text" value={formData.link} onChange={e=>setFormData({...formData, link: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 outline-none transition-all font-medium text-sm" 
                    placeholder="https://..."/>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Notes internes</label>
                  <textarea value={formData.notes} onChange={e=>setFormData({...formData, notes: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400 outline-none transition-all font-medium text-sm resize-none" 
                    rows="3" placeholder="Informations importantes..."></textarea>
                </div>
              </div>

              <div className="mt-8 flex gap-3">
                <button type="button" onClick={closeModal} className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-bold hover:bg-gray-50 transition">Annuler</button>
                <button type="submit" className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition active:scale-95">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
