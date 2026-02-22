import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';

const Dashboard = () => {
  const { user } = useEcomAuth();

  // Si pas de workspace : afficher un CTA
  if (!user?.workspaceId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Aucun espace configuré</h2>
          <p className="text-gray-600 mb-6">
            Créez votre propre espace ou rejoignez une équipe pour commencer à utiliser Ecom Cockpit.
          </p>
          <div className="space-y-3">
            <Link to="/ecom/workspace-setup" className="block w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition">
              Créer un espace
            </Link>
            {user?.role !== 'ecom_admin' && (
              <div className="p-3 bg-gray-100 rounded-lg text-xs text-gray-600">
                Pour rejoindre une équipe, demandez un lien d'invitation à votre administrateur
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
