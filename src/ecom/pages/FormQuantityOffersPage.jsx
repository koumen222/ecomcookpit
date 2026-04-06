import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, Trash2, Edit3, Copy, Loader2, EyeOff, LayoutTemplate } from 'lucide-react';
import { quantityOffersApi } from '../services/storeApi';
import { useStore } from '../contexts/StoreContext.jsx';

const FormQuantityOffersPage = () => {
  const navigate = useNavigate();
  const { activeStore } = useStore();
  const [allOffers, setAllOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOffers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await quantityOffersApi.getOffers();
      setAllOffers(res.data?.data || []);
    } catch {
      setError('Impossible de charger les offres');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOffers(); }, [loadOffers]);

  const handleDelete = async (id) => {
    if (!confirm('Supprimer définitivement cette offre ?')) return;
    try {
      await quantityOffersApi.deleteOffer(id);
      await loadOffers();
    } catch {
      setError('Erreur lors de la suppression');
    }
  };

  const handleDuplicate = async (id) => {
    try {
      await quantityOffersApi.duplicateOffer(id);
      await loadOffers();
    } catch {
      setError('Erreur lors de la duplication');
    }
  };

  const activeCount = allOffers.filter(o => o.isActive).length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="w-7 h-7 text-purple-600 bg-purple-100 p-1.5 rounded-lg" />
            Offres de quantité
          </h1>
          <p className="text-sm text-gray-500 mt-2">
            Créez des offres de quantité et des réductions dynamiques pour augmenter votre panier moyen.
          </p>
        </div>
        <button
          onClick={() => navigate('/ecom/boutique/form-builder/quantity-offers/wizard/new')}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-bold rounded-xl transition shadow-sm"
        >
          <Plus className="w-4 h-4" /> Créer une offre
        </button>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
            <LayoutTemplate className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{allOffers.length}</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Offres créées</div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
            <Package className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{activeCount}</div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Actives en ligne</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {/* Offers list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : allOffers.length === 0 ? (
        <div className="text-center py-20 bg-white border border-dashed border-gray-300 rounded-2xl">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 mb-1">Aucune offre configurée</h3>
          <p className="text-sm text-gray-500 mb-6">Lancez le créateur pour concevoir votre première offre de quantité.</p>
          <button
            onClick={() => navigate('/ecom/boutique/form-builder/quantity-offers/wizard/new')}
            className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition shadow flex-shrink-0 mx-auto"
          >
            <Plus className="w-4 h-4" /> Créer une offre
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {allOffers.map((campaign) => (
            <div key={campaign._id} className={`bg-white rounded-2xl border transition hover:border-purple-200 overflow-hidden ${!campaign.isActive ? 'opacity-70 grayscale-[30%]' : 'border-gray-200 shadow-sm'}`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center p-5 gap-4">
                
                {/* Image */}
                <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 border border-gray-200">
                  {campaign.productId?.images?.[0]?.url ? (
                    <img src={campaign.productId.images[0].url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-6 h-6 text-gray-300" />
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-bold text-gray-900 truncate">{campaign.name || 'Offre sans nom'}</h3>
                    {!campaign.isActive && (
                      <span className="flex items-center gap-1 text-[10px] bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-full">
                        <EyeOff className="w-3 h-3" /> Inactif
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500">
                    S'applique sur : <span className="font-medium text-gray-700">{campaign.productId?.name || 'Produit inconnu'}</span>
                  </div>
                  <div className="text-xs text-purple-600 font-medium mt-1.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                    Contient {campaign.offers?.length || 0} paliers de prix configurés
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-0 border-gray-100">
                  <button onClick={() => navigate(`/ecom/boutique/form-builder/quantity-offers/wizard/${campaign._id}`)}
                    className="flex-1 sm:flex-none flex justify-center items-center p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition" title="Éditer le design et les prix">
                    <Edit3 className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleDuplicate(campaign._id)}
                    className="flex-1 sm:flex-none flex justify-center items-center p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition" title="Dupliquer l'offre">
                    <Copy className="w-5 h-5" />
                  </button>
                  <button onClick={() => handleDelete(campaign._id)}
                    className="flex-1 sm:flex-none flex justify-center items-center p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Supprimer l'offre">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FormQuantityOffersPage;
