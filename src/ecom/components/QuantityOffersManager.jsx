import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit3, Loader2, Package, EyeOff } from 'lucide-react';
import { quantityOffersApi } from '../services/storeApi.js';
import { Link } from 'react-router-dom';

/**
 * QuantityOffersManager — Affiche les campagnes d'offres liées à un produit
 * 
 * Props:
 *  - productId: string (ID du StoreProduct)
 *  - readOnly?: boolean
 */
const QuantityOffersManager = ({ productId, readOnly = false }) => {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOffers = useCallback(async () => {
    if (!productId) return;
    try {
      setLoading(true);
      const res = await quantityOffersApi.getOffers({ productId });
      setOffers(res.data?.data || []);
    } catch {
      setError('Impossible de charger les offres');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  if (!productId) {
    return (
      <div className="text-sm text-gray-400 italic py-4">
        Enregistrez le produit pour gérer les offres de quantité.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-purple-600" />
          <h3 className="text-sm font-bold text-gray-800">Offres de quantité</h3>
          <span className="text-xs text-gray-400">({offers.length})</span>
        </div>
        {!readOnly && (
          <Link
            to={`/ecom/boutique/form-builder/quantity-offers/wizard/new`}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Créer
          </Link>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : offers.length === 0 ? (
        <div className="text-sm text-gray-500 text-center py-6">
          Aucune offre configurée pour ce produit.
        </div>
      ) : (
        /* Offers list */
        <div className="space-y-2">
          {offers.map(offer => (
            <div
              key={offer._id}
              className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3"
            >
              <div className="flex flex-col gap-1">
                <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  {offer.name}
                  {!offer.isActive && (
                    <span className="flex items-center gap-1 text-[10px] bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded-full">
                      <EyeOff className="w-3 h-3" /> Inactif
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {offer.offers?.length || 0} palier(s) configuré(s)
                </div>
              </div>
              {!readOnly && (
                <div className="flex items-center gap-1">
                  <Link
                    to={`/ecom/boutique/form-builder/quantity-offers/wizard/${offer._id}`}
                    className="flex items-center gap-2 px-3 py-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors text-xs font-semibold"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Modifier
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuantityOffersManager;
