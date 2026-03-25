import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getPaymentStatus } from '../services/billingApi.js';

/**
 * BillingSuccess — landing page after MoneyFusion payment redirect.
 * Polls the payment status and shows feedback.
 */
export default function BillingSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || sessionStorage.getItem('mf_pending_token');

  const [status, setStatus] = useState('checking'); // checking | paid | failure | pending

  useEffect(() => {
    if (!token) {
      setStatus('paid'); // no token — just show success fallback
      return;
    }

    let attempts = 0;
    const maxAttempts = 20; // ~60s total

    const poll = async () => {
      try {
        const res = await getPaymentStatus(token);
        if (res.status === 'paid') {
          sessionStorage.removeItem('mf_pending_token');
          setStatus('paid');
        } else if (res.status === 'failure' || res.status === 'no paid') {
          sessionStorage.removeItem('mf_pending_token');
          setStatus('failure');
        } else {
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(poll, 3000);
          } else {
            setStatus('pending');
          }
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
            <p className="text-gray-500 text-sm">Nous confirmons votre transaction, cela peut prendre quelques secondes.</p>
          </>
        )}

        {status === 'paid' && (
          <>
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Paiement confirmé !</h1>
            <p className="text-gray-600 text-sm mb-6">
              Votre plan <strong>Pro</strong> est maintenant actif. Profitez de toutes les fonctionnalités WhatsApp & IA.
            </p>
            <button
              onClick={() => navigate('/ecom/dashboard')}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition"
            >
              Aller au tableau de bord
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
              onClick={() => navigate('/ecom/billing')}
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
              Votre paiement est en cours de traitement. Votre plan sera automatiquement activé dès confirmation. Vous pouvez fermer cette page.
            </p>
            <button
              onClick={() => navigate('/ecom/billing')}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition"
            >
              Voir l'état de l'abonnement
            </button>
          </>
        )}
      </div>
    </div>
  );
}
