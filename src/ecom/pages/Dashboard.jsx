import React, { useState, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';

const IconFillLoader = ({ backgroundClassName = 'bg-gray-50' }) => {
  const [p, setP] = useState(0);

  useEffect(() => {
    let raf;
    let start;
    const durationMs = 1200;
    const tick = (t) => {
      if (!start) start = t;
      const elapsed = t - start;
      const progress = (elapsed % durationMs) / durationMs;
      setP(Math.min(100, Math.round(progress * 100)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={`w-full h-full min-h-screen ${backgroundClassName} flex items-center justify-center`}>
      <div className="relative w-20 h-20">
        <img
          src="/icon.png"
          alt="Loading"
          className="w-20 h-20 object-contain opacity-20"
        />
        <div
          className="absolute inset-0 overflow-hidden transition-all duration-200 ease-out"
          style={{ clipPath: `inset(${100 - p}% 0 0 0)` }}
        >
          <img
            src="/icon.png"
            alt="Loading"
            className="w-20 h-20 object-contain"
          />
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { user, loading: authLoading } = useEcomAuth();

  // Afficher le loader pendant la vérification de l'authentification
  if (authLoading) {
    return <IconFillLoader />;
  }

  // Si pas de workspace : afficher un CTA
  if (!user?.workspaceId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100 mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Aucun espace configuré</h2>
          <p className="text-gray-600 mb-6">
            Créez votre propre espace ou rejoignez une équipe pour commencer ù  utiliser Scalor.
          </p>
          <div className="space-y-3">
            <Link to="/ecom/workspace-setup" className="block w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition">
              Créer un espace
            </Link>
            {user?.role !== 'ecom_admin' && (
              <div className="p-3 bg-gray-100 rounded-lg text-xs text-gray-600">
                Pour rejoindre une équipe, demandez un lien d'invitation ù  votre administrateur
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Rediriger selon le rôle si workspaceId existe
  const roleDashboardMap = {
    super_admin: '/ecom/super-admin',
    ecom_admin: '/ecom/dashboard/admin',
    ecom_closeuse: '/ecom/dashboard/closeuse',
    ecom_compta: '/ecom/dashboard/compta',
    livreur: '/ecom/livreur',
  };
  const dest = roleDashboardMap[user?.role] || '/ecom/workspace-setup';
  return <Navigate to={dest} replace />;
};

export default Dashboard;
