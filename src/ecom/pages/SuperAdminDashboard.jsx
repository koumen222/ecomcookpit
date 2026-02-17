import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth';
import ecomApi from '../services/ecommApi.js';

const roleLabels = {
  super_admin: 'Super Admin',
  ecom_admin: 'Admin',
  ecom_closeuse: 'Closeuse',
  ecom_compta: 'Comptable',
  ecom_livreur: 'Livreur'
};

const roleColors = {
  super_admin: 'bg-red-100 text-red-800',
  ecom_admin: 'bg-purple-100 text-purple-800',
  ecom_closeuse: 'bg-blue-100 text-blue-800',
  ecom_compta: 'bg-green-100 text-green-800',
  ecom_livreur: 'bg-orange-100 text-orange-800'
};

const SuperAdminDashboard = () => {
  const { user: currentUser, impersonateUser, stopImpersonation, isImpersonating, impersonatedUser } = useEcomAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState('personnes');
  const [users, setUsers] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterWorkspace, setFilterWorkspace] = useState('');
  const [interfaceSearch, setInterfaceSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [personSearch, setPersonSearch] = useState('');
  const [selectedUserRole, setSelectedUserRole] = useState('');

  const fetchUsers = async () => {
    try {
      const params = { limit: 1000 };
      if (search) params.search = search;
      if (filterRole) params.role = filterRole;
      if (filterWorkspace) params.workspaceId = filterWorkspace;

      const res = await ecomApi.get('/super-admin/users', { params });
      setUsers(res.data.data.users);
      setStats(res.data.data.stats);
    } catch (err) {
      setError('Erreur chargement utilisateurs');
    }
  };

  const filterInterfaces = (interfaces, roleName) => {
    return interfaces.filter(iface => {
      const matchesSearch = !interfaceSearch || 
        iface.name.toLowerCase().includes(interfaceSearch.toLowerCase()) ||
        iface.desc.toLowerCase().includes(interfaceSearch.toLowerCase());
      const matchesRole = !selectedRole || selectedRole === roleName;
      return matchesSearch && matchesRole;
    });
  };

  const shouldShowSection = (roleName) => {
    return !selectedRole || selectedRole === roleName;
  };

  const getInterfacesForRole = (role) => {
    const interfaces = {
      super_admin: [
        { name: 'Dashboard', path: '/super-admin', desc: 'Vue principale' },
        { name: 'Utilisateurs', path: '/super-admin/users', desc: 'Gestion users' },
        { name: 'Espaces', path: '/super-admin/workspaces', desc: 'Gestion espaces' },
        { name: 'Paramètres', path: '/super-admin/settings', desc: 'Configuration' },
        { name: 'Activité', path: '/super-admin/activity', desc: 'Logs activité' },
        { name: 'Setup Initial', path: '/setup-admin', desc: 'Configuration initiale' }
      ],
      ecom_admin: [
        { name: 'Dashboard', path: '/dashboard/admin', desc: 'Vue principale' },
        { name: 'Produits', path: '/products', desc: 'Gestion produits' },
        { name: 'Commandes', path: '/orders', desc: 'Gestion commandes' },
        { name: 'Clients', path: '/clients', desc: 'Gestion clients' },
        { name: 'Stock', path: '/stock', desc: 'Gestion stock' },
        { name: 'Campagnes', path: '/campaigns', desc: 'Marketing' },
        { name: 'Utilisateurs', path: '/user-management', desc: 'Gestion users' },
        { name: 'Données', path: '/data', desc: 'Analytics' },
        { name: 'Objectifs', path: '/goals', desc: 'KPIs' },
        { name: 'Rapports', path: '/reports', desc: 'Rapports' },
        { name: 'Décisions', path: '/decisions', desc: 'Prises décision' },
        { name: 'Prospects', path: '/prospects', desc: 'Leads' }
      ],
      ecom_closeuse: [
        { name: 'Dashboard', path: '/dashboard/admin', desc: 'Vue principale' },
        { name: 'Produits', path: '/products', desc: 'Gestion produits' },
        { name: 'Commandes', path: '/orders', desc: 'Gestion commandes' },
        { name: 'Clients', path: '/clients', desc: 'Gestion clients' },
        { name: 'Stock', path: '/stock', desc: 'Gestion stock' },
        { name: 'Campagnes', path: '/campaigns', desc: 'Marketing' },
        { name: 'Utilisateurs', path: '/user-management', desc: 'Gestion users' },
        { name: 'Données', path: '/data', desc: 'Analytics' },
        { name: 'Objectifs', path: '/goals', desc: 'KPIs' },
        { name: 'Rapports', path: '/reports', desc: 'Rapports' },
        { name: 'Décisions', path: '/decisions', desc: 'Prises décision' },
        { name: 'Prospects', path: '/prospects', desc: 'Leads' }
      ],
      ecom_compta: [
        { name: 'Dashboard', path: '/dashboard/compta', desc: 'Vue financière' },
        { name: 'Transactions', path: '/transactions', desc: 'Gestion transactions' },
        { name: 'Rapports', path: '/reports', desc: 'Rapports financiers' },
        { name: 'Données', path: '/data', desc: 'Analytics finance' },
        { name: 'Objectifs', path: '/goals', desc: 'KPIs financiers' }
      ],
      ecom_livreur: [
        { name: 'Dashboard', path: '/livreur', desc: 'Livraisons jour' },
        { name: 'Commandes', path: '/orders', desc: 'Détail livraisons' },
        { name: 'Clients', path: '/clients', desc: 'Info contact' }
      ]
    };
    return interfaces[role] || [];
  };

  const getInterfaceColor = (role) => {
    const colors = {
      super_admin: 'bg-red-50 text-red-700 border-red-200',
      ecom_admin: 'bg-purple-50 text-purple-700 border-purple-200',
      ecom_closeuse: 'bg-blue-50 text-blue-700 border-blue-200',
      ecom_compta: 'bg-green-50 text-green-700 border-green-200',
      ecom_livreur: 'bg-orange-50 text-orange-700 border-orange-200'
    };
    return colors[role] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  // Fonction pour naviguer vers une interface en incarnant l'utilisateur
  const navigateAsUser = async (user, interfacePath) => {
    try {
      console.log('🎯 Navigation vers interface:', interfacePath, 'pour utilisateur:', user.email);
      console.log('🏢 Workspace de l\'utilisateur:', user.workspaceId?.name || 'Sans workspace');
      
      // Si on est déjà en train d'incarner cet utilisateur, naviguer directement
      if (isImpersonating && impersonatedUser?._id === user._id) {
        console.log('✅ Déjà incarné, navigation directe');
        navigate(interfacePath);
        return;
      }

      // Si on est en train d'incarner un autre utilisateur, arrêter d'abord
      if (isImpersonating) {
        console.log('🔄 Arrêt de l\'incarnation précédente');
        await stopImpersonation();
      }

      // Incarner l'utilisateur cible avec ses données complètes
      console.log('👤 Début incarnation de:', user.email, 'avec workspace:', user.workspaceId?.name);
      
      // Utiliser les données complètes de l'utilisateur et de son workspace
      await impersonateUser(user._id, user);
      
      // Naviguer vers l'interface
      console.log('🚀 Navigation vers:', interfacePath, 'avec contexte du workspace');
      navigate(interfacePath);
      
      setSuccess(`Incarnation de ${user.email} réussie - Workspace: ${user.workspaceId?.name || 'Non défini'}`);
    } catch (error) {
      console.error('❌ Erreur lors de l\'incarnation:', error);
      setError(error.message || 'Erreur lors de l\'incarnation');
    }
  };

  const fetchWorkspaces = async () => {
    try {
      const res = await ecomApi.get('/super-admin/workspaces');
      setWorkspaces(res.data.data.workspaces);
    } catch (err) {
      setError('Erreur chargement espaces');
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchUsers(), fetchWorkspaces()]);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (!loading) fetchUsers();
  }, [search, filterRole, filterWorkspace]);

  const handleToggleUser = async (userId) => {
    try {
      const res = await ecomApi.put(`/super-admin/users/${userId}/toggle`);
      setSuccess(res.data.message);
      fetchUsers();
    } catch (err) {
      setError('Erreur modification utilisateur');
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    try {
      const res = await ecomApi.put(`/super-admin/users/${userId}/role`, { role: newRole });
      setSuccess(res.data.message);
      fetchUsers();
    } catch (err) {
      setError('Erreur changement de rôle');
    }
  };

  const handleDeleteUser = async (userId, email) => {
    if (!confirm(`Supprimer définitivement ${email} ?`)) return;
    try {
      await ecomApi.delete(`/super-admin/users/${userId}`);
      setSuccess('Utilisateur supprimé');
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur suppression');
    }
  };

  const handleToggleWorkspace = async (wsId) => {
    try {
      const res = await ecomApi.put(`/super-admin/workspaces/${wsId}/toggle`);
      setSuccess(res.data.message);
      fetchWorkspaces();
    } catch (err) {
      setError('Erreur modification espace');
    }
  };

  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(''), 3000); return () => clearTimeout(t); }
  }, [success]);
  useEffect(() => {
    if (error) { const t = setTimeout(() => setError(''), 4000); return () => clearTimeout(t); }
  }, [error]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  const getRoleStat = (role) => {
    const found = stats.byRole?.find(s => s._id === role);
    return found?.count || 0;
  };

  return (
    <div className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Messages */}
      {success && (
        <div className="mb-4 p-3 bg-green-50 text-green-800 rounded-lg text-sm border border-green-200">{success}</div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-800 rounded-lg text-sm border border-red-200">{error}</div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Super Administration</h1>
            <p className="text-sm text-gray-500 mt-1">Vue globale de tous les espaces et utilisateurs</p>
          </div>
          
          {/* Indicateur d'incarnation */}
          {isImpersonating ? (
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-purple-600 to-red-600 text-white px-4 py-2 rounded-lg border-2 border-purple-300">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    <span className="text-sm font-medium">Incarné en tant que:</span>
                    <span className="font-bold">{impersonatedUser?.email}</span>
                  </div>
                  {impersonatedUser?.workspaceId && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-1.5 h-1.5 bg-blue-300 rounded-full"></span>
                      <span>Workspace: {impersonatedUser.workspaceId.name}</span>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={stopImpersonation}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                🔄 Revenir SA
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              <span>Mode Super Admin</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3 mb-6">
        <div className="bg-white rounded-lg shadow p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{stats.totalUsers || 0}</p>
          <p className="text-[10px] text-gray-500 uppercase font-medium mt-1">Total</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.totalActive || 0}</p>
          <p className="text-[10px] text-gray-500 uppercase font-medium mt-1">Actifs</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{getRoleStat('super_admin')}</p>
          <p className="text-[10px] text-gray-500 uppercase font-medium mt-1">Super Admin</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 text-center">
          <p className="text-2xl font-bold text-purple-600">{getRoleStat('ecom_admin')}</p>
          <p className="text-[10px] text-gray-500 uppercase font-medium mt-1">Admins</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{getRoleStat('ecom_closeuse')}</p>
          <p className="text-[10px] text-gray-500 uppercase font-medium mt-1">Closeuses</p>
        </div>
        <div className="bg-white rounded-lg shadow p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{getRoleStat('ecom_compta')}</p>
          <p className="text-[10px] text-gray-500 uppercase font-medium mt-1">Comptables</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg bg-gray-100 p-1 mb-4 max-w-md">
        <button
          onClick={() => setTab('personnes')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
            tab === 'personnes' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-500'
          }`}
        >
          Personnes
        </button>
        <button
          onClick={() => setTab('interfaces')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
            tab === 'interfaces' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-500'
          }`}
        >
          Interfaces
        </button>
        <button
          onClick={() => setTab('users')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
            tab === 'users' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-500'
          }`}
        >
          Utilisateurs
        </button>
        <button
          onClick={() => setTab('workspaces')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition ${
            tab === 'workspaces' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-500'
          }`}
        >
          Espaces
        </button>
      </div>

      {/* Personnes Tab */}
      {tab === 'personnes' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-purple-600 to-red-600 text-white rounded-lg p-4 border-2 border-purple-300">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">🔑</span>
              <h2 className="text-lg font-semibold">Accès Universel Super Admin</h2>
            </div>
            <p className="text-sm text-white/90 mb-3">
              En tant que Super Admin, vous avez un accès direct à TOUTES les interfaces de TOUS les rôles sans restriction.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 text-xs bg-white/20 text-white px-2 py-1 rounded-full backdrop-blur">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                Accès illimité
              </span>
              <span className="inline-flex items-center gap-1 text-xs bg-white/20 text-white px-2 py-1 rounded-full backdrop-blur">
                <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                Navigation directe
              </span>
              <span className="inline-flex items-center gap-1 text-xs bg-white/20 text-white px-2 py-1 rounded-full backdrop-blur">
                <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                Contournement des permissions
              </span>
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-purple-900 mb-2">👥 Vue des personnes et interfaces</h2>
            <p className="text-sm text-purple-700">Explorez toutes les personnes inscrites et accédez aux interfaces disponibles selon leur rôle.</p>
          </div>

          {/* Filtres pour les personnes */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="Rechercher une personne..."
                value={personSearch}
                onChange={(e) => setPersonSearch(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <select
                value={selectedUserRole}
                onChange={(e) => setSelectedUserRole(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Tous les rôles</option>
                <option value="super_admin">Super Admin</option>
                <option value="ecom_admin">Admin</option>
                <option value="ecom_closeuse">Closeuse</option>
                <option value="ecom_compta">Comptable</option>
                <option value="ecom_livreur">Livreur</option>
              </select>
            </div>
          </div>

          {/* Liste des personnes avec leurs interfaces */}
          <div className="space-y-4">
            {/* Compteur d'utilisateurs affichés */}
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600 flex items-center justify-between">
              <span>
                Affichage de <strong>
                  {users.filter(user => {
                    const matchesSearch = !personSearch || 
                      user.email.toLowerCase().includes(personSearch.toLowerCase());
                    const matchesRole = !selectedUserRole || user.role === selectedUserRole;
                    return matchesSearch && matchesRole;
                  }).length}
                </strong> sur <strong>{users.length}</strong> personnes
              </span>
              {(personSearch || selectedUserRole) && (
                <button 
                  onClick={() => { setPersonSearch(''); setSelectedUserRole(''); }}
                  className="text-red-600 hover:text-red-800 text-xs font-medium"
                >
                  Réinitialiser les filtres
                </button>
              )}
            </div>
            
            {users
              .filter(user => {
                const matchesSearch = !personSearch || 
                  user.email.toLowerCase().includes(personSearch.toLowerCase());
                const matchesRole = !selectedUserRole || user.role === selectedUserRole;
                return matchesSearch && matchesRole;
              })
              .map(user => (
                <div key={user._id} className="bg-white rounded-lg shadow overflow-hidden">
                  {/* En-tête de la personne */}
                  <div className={`${roleColors[user.role]} px-4 py-3 border-b`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold">
                          {user.email?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">{user.email}</h3>
                          <p className="text-white/80 text-sm">{roleLabels[user.role]} • {user.workspaceId?.name || 'Sans espace'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${user.isActive ? 'text-white' : 'text-white/70'}`}>
                          <span className={`w-2 h-2 rounded-full ${user.isActive ? 'bg-white' : 'bg-white/50'}`}></span>
                          {user.isActive ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Interfaces accessibles pour cette personne */}
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-gray-700">Interfaces accessibles :</h4>
                      {currentUser?.role === 'super_admin' && (
                        <span className="inline-flex items-center gap-1 text-xs bg-gradient-to-r from-purple-600 to-red-600 text-white px-2 py-1 rounded-full">
                          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                          Accès SA
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                      {getInterfacesForRole(user.role).map((iface, idx) => (
                        <button
                          key={idx}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🔘 Clic sur interface:', iface.name, 'pour:', user.email);
                            navigateAsUser(user, iface.path);
                          }}
                          className={`${getInterfaceColor(user.role)} hover:opacity-80 border rounded-lg p-2 text-left transition-all hover:shadow-md group relative cursor-pointer`}
                          title={iface.desc}
                        >
                          {currentUser?.role === 'super_admin' && (
                            <div className="absolute top-1 right-1 w-2 h-2 bg-gradient-to-r from-purple-600 to-red-600 rounded-full animate-pulse"></div>
                          )}
                          <div className="font-medium text-xs group-hover:text-gray-900 truncate">{iface.name}</div>
                          <div className="text-[10px] opacity-75 mt-1 truncate">{iface.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            
            {users.filter(user => {
              const matchesSearch = !personSearch || 
                user.email.toLowerCase().includes(personSearch.toLowerCase());
              const matchesRole = !selectedUserRole || user.role === selectedUserRole;
              return matchesSearch && matchesRole;
            }).length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-2">🔍</div>
                <p>Aucune personne trouvée pour ces critères</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Interfaces Tab */}
      {tab === 'interfaces' && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-blue-900 mb-2">🎯 Vue d'ensemble des interfaces</h2>
            <p className="text-sm text-blue-700">Accédez à toutes les interfaces de chaque espace de rôle. En tant que Super Admin, vous pouvez naviguer vers n'importe quelle interface.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                Accès direct
              </span>
              <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                Navigation rapide
              </span>
            </div>
          </div>

          {/* Interface Stats & Filters */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">6</p>
                <p className="text-xs text-gray-500">Super Admin</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">12</p>
                <p className="text-xs text-gray-500">Admin</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">12</p>
                <p className="text-xs text-gray-500">Closeuses</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">5</p>
                <p className="text-xs text-gray-500">Comptable</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">3</p>
                <p className="text-xs text-gray-500">Livreur</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-600">7</p>
                <p className="text-xs text-gray-500">Client</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="Rechercher une interface..."
                value={interfaceSearch}
                onChange={(e) => setInterfaceSearch(e.target.value)}
                className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="">Tous les rôles</option>
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="closeuse">Closeuse</option>
                <option value="compta">Comptable</option>
                <option value="livreur">Livreur</option>
                <option value="client">Client</option>
              </select>
            </div>
          </div>

          {/* Super Admin Interfaces */}
          {shouldShowSection('super_admin') && (
            <div className="bg-white rounded-lg shadow">
              <div className="bg-red-100 px-4 py-3 rounded-t-lg border-b border-red-200">
                <h3 className="font-semibold text-red-900 flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                  Super Admin
                </h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {filterInterfaces([
                    { name: 'Dashboard', path: '/super-admin', desc: 'Vue principale' },
                    { name: 'Utilisateurs', path: '/super-admin/users', desc: 'Gestion users' },
                    { name: 'Espaces', path: '/super-admin/workspaces', desc: 'Gestion espaces' },
                    { name: 'Paramètres', path: '/super-admin/settings', desc: 'Configuration' },
                    { name: 'Activité', path: '/super-admin/activity', desc: 'Logs activité' },
                    { name: 'Setup Initial', path: '/setup-admin', desc: 'Configuration initiale' }
                  ], 'super_admin').map((iface, idx) => (
                    <button
                      key={idx}
                      onClick={() => navigate(iface.path)}
                      className="bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg p-3 text-left transition-all hover:shadow-md group"
                    >
                      <div className="font-medium text-red-900 text-sm group-hover:text-red-700">{iface.name}</div>
                      <div className="text-xs text-red-600 mt-1">{iface.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Admin Interfaces */}
          {shouldShowSection('admin') && (
            <div className="bg-white rounded-lg shadow">
              <div className="bg-purple-100 px-4 py-3 rounded-t-lg border-b border-purple-200">
                <h3 className="font-semibold text-purple-900 flex items-center gap-2">
                  <span className="w-3 h-3 bg-purple-500 rounded-full"></span>
                  Admin E-commerce
                </h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {filterInterfaces([
                    { name: 'Dashboard', path: '/dashboard/admin', desc: 'Vue principale' },
                    { name: 'Produits', path: '/products', desc: 'Gestion produits' },
                    { name: 'Commandes', path: '/orders', desc: 'Gestion commandes' },
                    { name: 'Clients', path: '/clients', desc: 'Gestion clients' },
                    { name: 'Stock', path: '/stock', desc: 'Gestion stock' },
                    { name: 'Campagnes', path: '/campaigns', desc: 'Marketing' },
                    { name: 'Utilisateurs', path: '/user-management', desc: 'Gestion users' },
                    { name: 'Données', path: '/data', desc: 'Analytics' },
                    { name: 'Objectifs', path: '/goals', desc: 'KPIs' },
                    { name: 'Rapports', path: '/reports', desc: 'Rapports' },
                    { name: 'Décisions', path: '/decisions', desc: 'Prises décision' },
                    { name: 'Prospects', path: '/prospects', desc: 'Leads' }
                  ], 'admin').map((iface, idx) => (
                    <button
                      key={idx}
                      onClick={() => navigate(iface.path)}
                      className="bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg p-3 text-left transition-all hover:shadow-md group"
                    >
                      <div className="font-medium text-purple-900 text-sm group-hover:text-purple-700">{iface.name}</div>
                      <div className="text-xs text-purple-600 mt-1">{iface.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Closeuse Interfaces */}
          {shouldShowSection('closeuse') && (
            <div className="bg-white rounded-lg shadow">
              <div className="bg-blue-100 px-4 py-3 rounded-t-lg border-b border-blue-200">
                <h3 className="font-semibold text-blue-900 flex items-center gap-2">
                  <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                  Closeuse
                </h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {filterInterfaces([
                    { name: 'Dashboard', path: '/dashboard/admin', desc: 'Vue principale' },
                    { name: 'Produits', path: '/products', desc: 'Gestion produits' },
                    { name: 'Commandes', path: '/orders', desc: 'Gestion commandes' },
                    { name: 'Clients', path: '/clients', desc: 'Gestion clients' },
                    { name: 'Stock', path: '/stock', desc: 'Gestion stock' },
                    { name: 'Campagnes', path: '/campaigns', desc: 'Marketing' },
                    { name: 'Utilisateurs', path: '/user-management', desc: 'Gestion users' },
                    { name: 'Données', path: '/data', desc: 'Analytics' },
                    { name: 'Objectifs', path: '/goals', desc: 'KPIs' },
                    { name: 'Rapports', path: '/reports', desc: 'Rapports' },
                    { name: 'Décisions', path: '/decisions', desc: 'Prises décision' },
                    { name: 'Prospects', path: '/prospects', desc: 'Leads' }
                  ], 'closeuse').map((iface, idx) => (
                    <button
                      key={idx}
                      onClick={() => navigate(iface.path)}
                      className="bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg p-3 text-left transition-all hover:shadow-md group"
                    >
                      <div className="font-medium text-blue-900 text-sm group-hover:text-blue-700">{iface.name}</div>
                      <div className="text-xs text-blue-600 mt-1">{iface.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Comptable Interfaces */}
          {shouldShowSection('compta') && (
            <div className="bg-white rounded-lg shadow">
              <div className="bg-green-100 px-4 py-3 rounded-t-lg border-b border-green-200">
                <h3 className="font-semibold text-green-900 flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                  Comptable
                </h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {filterInterfaces([
                    { name: 'Dashboard', path: '/dashboard/compta', desc: 'Vue financière' },
                    { name: 'Transactions', path: '/transactions', desc: 'Gestion transactions' },
                    { name: 'Rapports', path: '/reports', desc: 'Rapports financiers' },
                    { name: 'Données', path: '/data', desc: 'Analytics finance' },
                    { name: 'Objectifs', path: '/goals', desc: 'KPIs financiers' }
                  ], 'compta').map((iface, idx) => (
                    <button
                      key={idx}
                      onClick={() => navigate(iface.path)}
                      className="bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg p-3 text-left transition-all hover:shadow-md group"
                    >
                      <div className="font-medium text-green-900 text-sm group-hover:text-green-700">{iface.name}</div>
                      <div className="text-xs text-green-600 mt-1">{iface.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Livreur Interfaces */}
          {shouldShowSection('livreur') && (
            <div className="bg-white rounded-lg shadow">
              <div className="bg-orange-100 px-4 py-3 rounded-t-lg border-b border-orange-200">
                <h3 className="font-semibold text-orange-900 flex items-center gap-2">
                  <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
                  Livreur
                </h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {filterInterfaces([
                    { name: 'Dashboard', path: '/livreur', desc: 'Livraisons jour' },
                    { name: 'Commandes', path: '/orders', desc: 'Détail livraisons' },
                    { name: 'Clients', path: '/clients', desc: 'Info contact' }
                  ], 'livreur').map((iface, idx) => (
                    <button
                      key={idx}
                      onClick={() => navigate(iface.path)}
                      className="bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg p-3 text-left transition-all hover:shadow-md group"
                    >
                      <div className="font-medium text-orange-900 text-sm group-hover:text-orange-700">{iface.name}</div>
                      <div className="text-xs text-orange-600 mt-1">{iface.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Client Interfaces */}
          {shouldShowSection('client') && (
            <div className="bg-white rounded-lg shadow">
              <div className="bg-gray-100 px-4 py-3 rounded-t-lg border-b border-gray-200">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <span className="w-3 h-3 bg-gray-500 rounded-full"></span>
                  Client (Public)
                </h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {filterInterfaces([
                    { name: 'Accueil', path: '/', desc: 'Page principale' },
                    { name: 'Connexion', path: '/login', desc: 'Identification' },
                    { name: 'Inscription', path: '/register', desc: 'Création compte' },
                    { name: 'Produits', path: '/products', desc: 'Catalogue' },
                    { name: 'Recherche', path: '/product-finder', desc: 'Recherche produits' },
                    { name: 'Profil', path: '/profile', desc: 'Mon compte' },
                    { name: 'Paramètres', path: '/settings', desc: 'Préférences' }
                  ], 'client').map((iface, idx) => (
                    <button
                      key={idx}
                      onClick={() => navigate(iface.path)}
                      className="bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg p-3 text-left transition-all hover:shadow-md group"
                    >
                      <div className="font-medium text-gray-900 text-sm group-hover:text-gray-700">{iface.name}</div>
                      <div className="text-xs text-gray-600 mt-1">{iface.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Users Tab */}
      {tab === 'users' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            <input
              type="text"
              placeholder="Rechercher par email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[180px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">Tous les rôles</option>
              <option value="super_admin">Super Admin</option>
              <option value="ecom_admin">Admin</option>
              <option value="ecom_closeuse">Closeuse</option>
              <option value="ecom_compta">Comptable</option>
            </select>
            <select
              value={filterWorkspace}
              onChange={(e) => setFilterWorkspace(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">Tous les espaces</option>
              {workspaces.map(ws => (
                <option key={ws._id} value={ws._id}>{ws.name}</option>
              ))}
            </select>
          </div>

          {/* Users Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rôle</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Espace</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden md:table-cell">Statut</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase hidden lg:table-cell">Dernière connexion</th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-3 py-8 text-center text-gray-400 text-sm">Aucun utilisateur trouvé</td>
                    </tr>
                  ) : (
                    users.map(u => (
                      <tr key={u._id} className={`hover:bg-gray-50 ${!u.isActive ? 'opacity-50' : ''}`}>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                              {u.email?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 truncate max-w-[150px] sm:max-w-none">{u.email}</p>
                              <p className="text-[10px] text-gray-400 sm:hidden">
                                {u.workspaceId?.name || 'Sans espace'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <select
                            value={u.role}
                            onChange={(e) => handleChangeRole(u._id, e.target.value)}
                            disabled={u._id === currentUser?.id}
                            className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${roleColors[u.role]} disabled:cursor-not-allowed`}
                          >
                            <option value="super_admin">Super Admin</option>
                            <option value="ecom_admin">Admin</option>
                            <option value="ecom_closeuse">Closeuse</option>
                            <option value="ecom_compta">Comptable</option>
                            <option value="ecom_livreur">Livreur</option>
                          </select>
                        </td>
                        <td className="px-3 py-3 hidden sm:table-cell">
                          <span className="text-sm text-gray-600 truncate max-w-[120px] block">
                            {u.workspaceId?.name || <span className="text-gray-400 italic">Sans espace</span>}
                          </span>
                        </td>
                        <td className="px-3 py-3 hidden md:table-cell">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium ${u.isActive ? 'text-green-600' : 'text-red-500'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${u.isActive ? 'bg-green-500' : 'bg-red-400'}`}></span>
                            {u.isActive ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td className="px-3 py-3 hidden lg:table-cell">
                          <span className="text-xs text-gray-500">
                            {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Jamais'}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleToggleUser(u._id)}
                              disabled={u._id === currentUser?.id}
                              className={`px-2 py-1 text-xs rounded-md font-medium transition disabled:opacity-30 ${
                                u.isActive
                                  ? 'text-orange-700 bg-orange-50 hover:bg-orange-100'
                                  : 'text-green-700 bg-green-50 hover:bg-green-100'
                              }`}
                              title={u.isActive ? 'Désactiver' : 'Activer'}
                            >
                              {u.isActive ? 'Désactiver' : 'Activer'}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u._id, u.email)}
                              disabled={u._id === currentUser?.id}
                              className="px-2 py-1 text-xs rounded-md font-medium text-red-700 bg-red-50 hover:bg-red-100 transition disabled:opacity-30"
                              title="Supprimer"
                            >
                              Suppr.
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Workspaces Tab */}
      {tab === 'workspaces' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.length === 0 ? (
            <div className="col-span-full text-center py-12 text-gray-400">Aucun espace créé</div>
          ) : (
            workspaces.map(ws => (
              <div key={ws._id} className={`bg-white rounded-lg shadow p-4 border-l-4 ${ws.isActive ? 'border-green-500' : 'border-red-400'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{ws.name}</h3>
                    <p className="text-xs text-gray-400">{ws.slug}</p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ws.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {ws.isActive ? 'Actif' : 'Inactif'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-gray-50 rounded p-2 text-center">
                    <p className="text-lg font-bold text-gray-900">{ws.memberCount}</p>
                    <p className="text-[10px] text-gray-500">Membres</p>
                  </div>
                  <div className="bg-gray-50 rounded p-2 text-center">
                    <p className="text-xs font-mono text-gray-700 truncate">{ws.inviteCode}</p>
                    <p className="text-[10px] text-gray-500">Code invite</p>
                  </div>
                </div>

                <div className="text-xs text-gray-500 mb-3">
                  <span className="font-medium">Owner:</span> {ws.owner?.email || 'N/A'}
                </div>
                <div className="text-xs text-gray-400 mb-3">
                  Créé le {new Date(ws.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleWorkspace(ws._id)}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                      ws.isActive
                        ? 'bg-orange-50 text-orange-700 hover:bg-orange-100'
                        : 'bg-green-50 text-green-700 hover:bg-green-100'
                    }`}
                  >
                    {ws.isActive ? 'Désactiver' : 'Activer'}
                  </button>
                  <button
                    onClick={() => { setFilterWorkspace(ws._id); setTab('users'); }}
                    className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
                  >
                    Voir membres
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
