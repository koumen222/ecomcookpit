import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { authApi } from '../services/ecommApi';

const InviteAccept = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useEcomAuth();
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState('');
  const [inviteData, setInviteData] = useState(null);
  const [selectedRole, setSelectedRole] = useState('ecom_closeuse');

  useEffect(() => {
    validateInvite();
  }, [token]);

  const validateInvite = async () => {
    try {
      setLoading(true);
      const res = await authApi.validateInvite(token);
      setInviteData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Lien d\'invitation invalide ou expiré');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async () => {
    if (!isAuthenticated) {
      // Rediriger vers register avec le token
      navigate(`/ecom/register?invite=${token}`);
      return;
    }

    try {
      setValidating(true);
      setError('');
      await authApi.acceptInvite({ token, role: selectedRole });
      // Rediriger vers le dashboard selon le rôle
      const roleMap = {
        ecom_admin: '/ecom/dashboard/admin',
        ecom_closeuse: '/ecom/dashboard/closeuse',
        ecom_compta: '/ecom/dashboard/compta',
        livreur: '/ecom/livreur'
      };
      navigate(roleMap[selectedRole] || '/ecom/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de l\'acceptation de l\'invitation');
    } finally {
      setValidating(false);
    }
  };

  const roles = [
    { value: 'ecom_closeuse', label: 'Closeuse', desc: 'Commandes & ventes' },
    { value: 'ecom_admin', label: 'Administrateur', desc: 'Accès complet' },
    { value: 'ecom_compta', label: 'Comptable', desc: 'Finances & rapports' },
    { value: 'livreur', label: 'Livreur', desc: 'Livraisons' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 border border-red-500/30 mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Lien invalide</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button onClick={() => navigate('/ecom/login')} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition">
            Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-[440px] relative">
        <div className="text-center mb-8">
          <button onClick={() => navigate('/ecom')} className="inline-block">
            <img src="/ecom-logo (1).png" alt="Ecom Cockpit" className="h-10 object-contain mx-auto" />
          </button>
        </div>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/30 mb-4">
            <svg className="w-7 h-7 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white">Invitation à rejoindre</h1>
          <p className="text-gray-400 text-sm mt-1">
            {inviteData?.workspaceName ? `Vous êtes invité à rejoindre « ${inviteData.workspaceName} »` : 'Rejoignez une équipe'}
          </p>
          {inviteData?.invitedBy && (
            <p className="text-gray-500 text-xs mt-1">Invité par {inviteData.invitedBy}</p>
          )}
        </div>

        <div className="bg-gray-900/70 border border-white/8 rounded-2xl p-6 backdrop-blur-xl shadow-2xl">
          {!isAuthenticated ? (
            <div className="text-center">
              <p className="text-gray-300 mb-4">Vous devez d'abord créer un compte ou vous connecter</p>
              <div className="space-y-3">
                <button onClick={() => navigate(`/ecom/register?invite=${token}`)}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 transition">
                  Créer un compte
                </button>
                <button onClick={() => navigate(`/ecom/login?invite=${token}`)}
                  className="w-full py-3 rounded-xl text-sm font-medium text-gray-300 border border-gray-700 hover:border-gray-600 transition">
                  Se connecter
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">Votre rôle</label>
                <div className="grid grid-cols-2 gap-2">
                  {roles.map(r => (
                    <button key={r.value} type="button" onClick={() => setSelectedRole(r.value)}
                      className={`text-left px-3 py-2.5 rounded-xl border text-xs transition ${selectedRole === r.value ? 'border-blue-500/60 bg-blue-500/10 text-white' : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600 hover:text-gray-200'}`}>
                      <span className="font-semibold block">{r.label}</span>
                      <span className="opacity-60 text-[10px]">{r.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={handleAcceptInvite} disabled={validating}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20">
                {validating ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Acceptation...
                  </>
                ) : (
                  <>
                    <span>Accepter l'invitation</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-700">
          <button onClick={() => navigate('/ecom/privacy')} className="hover:text-gray-500 transition">Confidentialité</button>
          <span>•</span>
          <span>&copy; {new Date().getFullYear()} Ecom Cockpit</span>
        </div>
      </div>
    </div>
  );
};

export default InviteAccept;
