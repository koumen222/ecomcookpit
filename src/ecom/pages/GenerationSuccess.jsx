import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_ORIGIN = import.meta.env.VITE_BACKEND_URL || '';

export default function GenerationSuccess() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem('mf_pending_generation_token');
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    if (!token) {
      // No token — most likely already handled; go back to products
      setStatus('paid');
      return;
    }

    let attempts = 0;
    const maxAttempts = 30; // ~90s total

    const getHeaders = () => {
      const t = localStorage.getItem('ecomToken');
      const ws = (() => { try { return JSON.parse(localStorage.getItem('ecomWorkspace') || 'null'); } catch { return null; } })();
      const h = { 'Content-Type': 'application/json' };
      if (t) h['Authorization'] = `Bearer ${t}`;
      if (ws?._id || ws?.id) h['X-Workspace-Id'] = ws._id || ws.id;
      return h;
    };

    const poll = async () => {
      try {
        const res = await fetch(`${API_ORIGIN}/api/ecom/billing/generation-status/${token}`, {
          headers: getHeaders(),
        });
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();

        if (data.status === 'paid') {
          sessionStorage.removeItem('mf_pending_generation_token');
          sessionStorage.removeItem('mf_pending_generation_payment');
          setStatus('paid');
        } else if (data.status === 'failure' || data.status === 'no paid') {
          sessionStorage.removeItem('mf_pending_generation_token');
          sessionStorage.removeItem('mf_pending_generation_payment');
          setStatus('failure');
        } else {
          attempts++;
          if (attempts < maxAttempts) setTimeout(poll, 3000);
          else setStatus('pending');
        }
      } catch {
        attempts++;
        if (attempts < maxAttempts) setTimeout(poll, 3000);
        else setStatus('pending');
      }
    };

    poll();
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">

        {status === 'checking' && (
          <>
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="animate-spin w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Vérification du paiement…</h1>
            <p className="text-gray-500 text-sm">Tes crédits seront ajoutés automatiquement dès confirmation.</p>
          </>
        )}

        {status === 'paid' && (
          <>
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Crédits ajoutés !</h1>
            <p className="text-gray-600 text-sm mb-6">
              Tes crédits de génération ont bien été ajoutés à ton compte. Tu peux maintenant générer tes pages produit.
            </p>
            <button
              onClick={() => navigate('/ecom/products')}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition"
            >
              Générer mes pages produit
            </button>
          </>
        )}

        {status === 'failure' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Paiement échoué</h1>
            <p className="text-gray-600 text-sm mb-6">
              La transaction n'a pas abouti. Vérifiez votre solde Mobile Money et réessayez.
            </p>
            <button
              onClick={() => navigate('/ecom/products')}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition"
            >
              Réessayer
            </button>
          </>
        )}

        {status === 'pending' && (
          <>
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Paiement en attente</h1>
            <p className="text-gray-600 text-sm mb-6">
              Ton paiement est en cours de traitement. Tes crédits seront ajoutés automatiquement dès confirmation. Tu peux fermer cette page.
            </p>
            <button
              onClick={() => navigate('/ecom/products')}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition"
            >
              Retour aux produits
            </button>
          </>
        )}

      </div>
    </div>
  );
}
