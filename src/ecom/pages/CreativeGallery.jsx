import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Download, Trash2, Loader2, AlertCircle, Sparkles, Image, RefreshCw, ExternalLink } from 'lucide-react';
import ecomApi from '../services/ecommApi.js';

const PAGE_SIZE = 20;

const CreativeGallery = () => {
  const [assets, setAssets] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [lightbox, setLightbox] = useState(null); // { imageUrl, label, productName }

  const fetchAssets = useCallback(async (p = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await ecomApi.get('/ai/creative-generator/gallery', {
        params: { page: p, limit: PAGE_SIZE },
      });
      setAssets(res.data.assets || []);
      setTotal(res.data.total || 0);
      setPage(res.data.page || 1);
      setPages(res.data.pages || 1);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAssets(1); }, [fetchAssets]);

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer ce visuel ?')) return;
    setDeletingId(id);
    try {
      await ecomApi.delete(`/ai/creative-generator/gallery/${id}`);
      setAssets(prev => prev.filter(a => a._id !== id));
      setTotal(prev => Math.max(0, prev - 1));
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur suppression');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownload = async (url, label, productName) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${productName || 'creative'}-${label || 'visuel'}.png`.replace(/\s+/g, '-').toLowerCase();
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, '_blank');
    }
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="fixed top-0 left-0 lg:left-[220px] right-0 z-20 bg-scalor-black">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-scalor-green/20 flex items-center justify-center">
              <Image size={14} className="text-scalor-green" />
            </div>
            <div>
              <h1 className="text-white font-black text-base tracking-tight leading-none">Mes Visuels</h1>
              <p className="text-gray-400 text-[10px] mt-0.5">Bibliothèque de créatives générées</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-scalor-green bg-scalor-green/10 border border-scalor-green/20 px-2.5 py-1 rounded-full">
              {total} visuel{total !== 1 ? 's' : ''}
            </span>
            <Link
              to="/ecom/creatives"
              className="flex items-center gap-1.5 text-[11px] font-semibold bg-scalor-green text-white px-3 py-1.5 rounded-lg hover:bg-scalor-green-light transition-colors"
            >
              <Sparkles size={11} />
              Générer
            </Link>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-scalor-green/40 to-transparent" />
      </div>

      {/* Content */}
      <div className="pt-[60px] px-4 lg:px-8 py-6 max-w-7xl mx-auto">

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-6 text-sm">
            <AlertCircle size={16} className="shrink-0" />
            {error}
            <button onClick={() => fetchAssets(page)} className="ml-auto text-red-500 hover:text-red-700">
              <RefreshCw size={14} />
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden border border-gray-100 animate-pulse">
                <div className="aspect-square bg-gray-100" />
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-gray-100 rounded w-3/4" />
                  <div className="h-2 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && assets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 bg-scalor-green/10 rounded-3xl flex items-center justify-center mb-6">
              <Image size={32} className="text-scalor-green/60" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Aucun visuel stocké</h2>
            <p className="text-gray-400 text-sm max-w-xs mb-6">
              Générez vos premières créatives produit pour les retrouver ici et les télécharger.
            </p>
            <Link
              to="/ecom/creatives"
              className="flex items-center gap-2 bg-scalor-green text-white font-semibold px-6 py-3 rounded-xl hover:bg-scalor-green-light transition-colors text-sm"
            >
              <Sparkles size={15} />
              Créer mes premiers visuels
            </Link>
          </div>
        )}

        {/* Grid */}
        {!loading && assets.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {assets.map(asset => (
                <div
                  key={asset._id}
                  className="group bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Image */}
                  <div
                    className="aspect-square relative overflow-hidden bg-gray-50 cursor-pointer"
                    onClick={() => setLightbox(asset)}
                  >
                    <img
                      src={asset.imageUrl}
                      alt={asset.label}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="w-9 h-9 bg-white/90 rounded-full flex items-center justify-center">
                        <ExternalLink size={15} className="text-gray-700" />
                      </div>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="p-3">
                    <p className="text-xs font-bold text-gray-800 truncate">{asset.label || asset.formatId}</p>
                    {asset.productName && (
                      <p className="text-[10px] text-gray-400 truncate mt-0.5">{asset.productName}</p>
                    )}
                    <p className="text-[10px] text-gray-300 mt-1">{formatDate(asset.createdAt)}</p>
                  </div>

                  {/* Actions */}
                  <div className="px-3 pb-3 flex gap-2">
                    <button
                      onClick={() => handleDownload(asset.imageUrl, asset.label, asset.productName)}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-scalor-green text-white text-[10px] font-semibold rounded-lg hover:bg-scalor-green-light transition-colors"
                    >
                      <Download size={11} />
                      Télécharger
                    </button>
                    <button
                      onClick={() => handleDelete(asset._id)}
                      disabled={deletingId === asset._id}
                      className="w-8 h-8 flex items-center justify-center bg-red-50 border border-red-100 text-red-400 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 shrink-0"
                    >
                      {deletingId === asset._id
                        ? <Loader2 size={12} className="animate-spin" />
                        : <Trash2 size={12} />
                      }
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => { setPage(p => p - 1); fetchAssets(page - 1); }}
                  disabled={page <= 1}
                  className="px-4 py-2 text-sm font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Précédent
                </button>
                <span className="text-sm text-gray-500 px-2">
                  Page {page} / {pages}
                </span>
                <button
                  onClick={() => { setPage(p => p + 1); fetchAssets(page + 1); }}
                  disabled={page >= pages}
                  className="px-4 py-2 text-sm font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Suivant →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div
            className="bg-white rounded-2xl overflow-hidden max-w-xl w-full shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={lightbox.imageUrl}
              alt={lightbox.label}
              className="w-full aspect-square object-contain bg-gray-50"
            />
            <div className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-gray-800">{lightbox.label}</p>
                {lightbox.productName && (
                  <p className="text-xs text-gray-400 mt-0.5">{lightbox.productName}</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => handleDownload(lightbox.imageUrl, lightbox.label, lightbox.productName)}
                  className="flex items-center gap-1.5 bg-scalor-green text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-scalor-green-light transition-colors"
                >
                  <Download size={14} />
                  Télécharger
                </button>
                <button
                  onClick={() => setLightbox(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreativeGallery;
