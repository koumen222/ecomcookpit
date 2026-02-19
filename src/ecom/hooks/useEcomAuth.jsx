import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { authApi } from '../services/ecommApi.js';
import { logAuthEvent, logWorkspace, logUserAction } from '../services/prodLogger.js';

// Contexte d'authentification e-commerce
const EcomAuthContext = createContext();

// État initial - charger les données locales pour une persistance immédiate
const storedToken = localStorage.getItem('ecomToken');
const storedUser = JSON.parse(localStorage.getItem('ecomUser') || 'null');
const storedWorkspace = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');

const initialState = {
  user: storedUser,
  workspace: storedWorkspace,
  token: storedToken,
  // Si on a un token ET un user stocké, on est potentiellement authentifié
  isAuthenticated: !!(storedToken && storedUser),
  loading: !!storedToken, // Ne charger que si on a un token à vérifier
  error: null,
  // Mode incarnation pour Super Admin
  isImpersonating: false,
  originalUser: JSON.parse(localStorage.getItem('ecomOriginalUser') || 'null'),
  impersonatedUser: JSON.parse(localStorage.getItem('ecomImpersonatedUser') || 'null')
};

// Reducer pour gérer les états d'authentification
const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_START':
      return {
        ...state,
        loading: true,
        error: null
      };
    
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        workspace: action.payload.workspace || state.workspace,
        token: action.payload.token,
        isAuthenticated: true,
        loading: false,
        error: null
      };
    
    case 'LOGIN_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
        error: action.payload
      };
    
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        workspace: null,
        token: null,
        isAuthenticated: false,
        loading: false,
        error: null
      };
    
    case 'LOAD_USER_SUCCESS':
      return {
        ...state,
        user: action.payload.user || action.payload,
        workspace: action.payload.workspace || state.workspace,
        isAuthenticated: true,
        loading: false,
        error: null
      };
    
    case 'LOAD_USER_FAILURE':
      // Ne pas effacer le token du state si on veut juste signaler l'échec du chargement
      // Le token sera effacé explicitement par clearToken() si nécessaire
      return {
        ...state,
        user: null,
        workspace: null,
        token: null,
        isAuthenticated: false,
        loading: false,
        error: null
      };
    
    case 'LOAD_USER_FAILURE_KEEP_TOKEN':
      // Garder le token mais marquer comme non authentifié temporairement
      return {
        ...state,
        loading: false,
        error: null
      };
    
    case 'UPDATE_USER':
      return {
        ...state,
        user: { ...state.user, ...action.payload },
      };

    case 'UPDATE_TOKEN':
      return {
        ...state,
        token: action.payload?.token || state.token,
        isAuthenticated: true
      };
    
    case 'START_IMPERSONATION':
      return {
        ...state,
        isImpersonating: true,
        originalUser: action.payload.originalUser,
        impersonatedUser: action.payload.targetUser,
        user: action.payload.targetUser,
        workspace: action.payload.targetWorkspace
      };
    
    case 'STOP_IMPERSONATION':
      return {
        ...state,
        isImpersonating: false,
        originalUser: null,
        impersonatedUser: null,
        user: action.payload.originalUser,
        workspace: action.payload.originalWorkspace
      };
    
    default:
      return state;
  }
};

// Provider d'authentification
export const EcomAuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Effacer le token du localStorage
  const clearToken = () => {
    logAuthEvent('token_cleared', { reason: 'explicit_clear' });
    localStorage.removeItem('ecomToken');
    localStorage.removeItem('ecomUser');
    localStorage.removeItem('ecomWorkspace');
    localStorage.removeItem('ecomOriginalUser');
    localStorage.removeItem('ecomImpersonatedUser');
  };

  // Sauvegarder le token dans le localStorage
  const saveToken = (token, user, workspace) => {
    logAuthEvent('token_saved', { userEmail: user?.email, userRole: user?.role, hasWorkspace: !!workspace });
    localStorage.setItem('ecomToken', token);
    localStorage.setItem('ecomUser', JSON.stringify(user));
    if (workspace) {
      localStorage.setItem('ecomWorkspace', JSON.stringify(workspace));
      logWorkspace('saved', workspace);
    }
  };

  // Sauvegarder l'état d'incarnation
  const saveImpersonation = (originalUser, targetUser, targetWorkspace) => {
    localStorage.setItem('ecomOriginalUser', JSON.stringify(originalUser));
    localStorage.setItem('ecomImpersonatedUser', JSON.stringify(targetUser));
    if (targetWorkspace) localStorage.setItem('ecomWorkspace', JSON.stringify(targetWorkspace));
  };

  // Effacer l'incarnation
  const clearImpersonation = () => {
    localStorage.removeItem('ecomOriginalUser');
    localStorage.removeItem('ecomImpersonatedUser');
  };

  // Charger l'utilisateur depuis le token
  const loadUser = async () => {
    const token = localStorage.getItem('ecomToken');
    logAuthEvent(token ? 'token_found' : 'token_missing', {
      tokenPrefix: token ? token.slice(0, 20) + '…' : null
    });
    
    if (!token) {
      dispatch({ type: 'LOAD_USER_FAILURE' });
      return;
    }

    try {
      logAuthEvent('load_user_start', { tokenPrefix: token.slice(0, 20) + '…' });
      const response = await authApi.getProfile();
      
      const wsData = response.data.data.workspace;
      if (wsData) {
        localStorage.setItem('ecomWorkspace', JSON.stringify(wsData));
        logWorkspace('loaded', wsData);
      }

      const userData = response.data.data.user;
      logAuthEvent('load_user_success', {
        userEmail: userData?.email,
        userRole: userData?.role,
        userId: userData?._id,
        workspaceId: wsData?._id,
        workspaceName: wsData?.name,
      });
      
      dispatch({
        type: 'LOAD_USER_SUCCESS',
        payload: { user: userData, workspace: wsData }
      });
    } catch (error) {
      logAuthEvent('load_user_failure', {
        status: error.response?.status,
        message: error.message,
        isNetwork: !error.response,
      });
      
      // NE déconnecter que pour les vraies erreurs 401 (token invalide)
      // PAS pour les erreurs réseau (backend inaccessible)
      if (error.response?.status === 401) {
        clearToken();
        dispatch({ type: 'LOAD_USER_FAILURE' });
      } else if (!error.response) {
        // Erreur réseau - garder l'utilisateur connecté avec les données locales
        logAuthEvent('load_user_network', { message: error.message });
        const userData = JSON.parse(localStorage.getItem('ecomUser') || 'null');
        const workspaceData = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
        if (userData) {
          logAuthEvent('session_restored', { userEmail: userData?.email, source: 'localStorage' });
          dispatch({
            type: 'LOAD_USER_SUCCESS',
            payload: { user: userData, workspace: workspaceData }
          });
        } else {
          dispatch({ type: 'LOAD_USER_FAILURE' });
        }
      } else {
        // Autre erreur serveur (500, etc) - garder la session
        const userData = JSON.parse(localStorage.getItem('ecomUser') || 'null');
        const workspaceData = JSON.parse(localStorage.getItem('ecomWorkspace') || 'null');
        if (userData) {
          logAuthEvent('session_restored', { userEmail: userData?.email, source: 'localStorage_server_error', status: error.response?.status });
          dispatch({
            type: 'LOAD_USER_SUCCESS',
            payload: { user: userData, workspace: workspaceData }
          });
        } else {
          dispatch({ type: 'LOAD_USER_FAILURE' });
        }
      }
    }
  };

  // Connexion
  const login = async (email, password) => {
    dispatch({ type: 'LOGIN_START' });
    logAuthEvent('login_start', { email });

    try {
      const response = await authApi.login({ email, password });
      const { token, user, workspace } = response.data.data;

      saveToken(token, user, workspace);
      logAuthEvent('login_success', {
        userEmail: user?.email,
        userRole: user?.role,
        userId: user?._id,
        workspaceId: workspace?._id,
        workspaceName: workspace?.name,
      });

      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: { token, user, workspace }
      });

      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Erreur de connexion';
      logAuthEvent('login_failure', {
        email,
        status: error.response?.status,
        message: errorMessage,
      });
      dispatch({
        type: 'LOGIN_FAILURE',
        payload: errorMessage
      });
      throw error;
    }
  };

  // Déconnexion
  const logout = () => {
    logAuthEvent('logout', { userEmail: state.user?.email, userRole: state.user?.role });
    clearToken();
    dispatch({ type: 'LOGOUT' });
  };

  // Inscription (création espace ou rejoindre)
  const register = async (userData) => {
    try {
      logUserAction('register_attempt', { email: userData.email });
      const response = await authApi.register(userData);
      const { token, user, workspace } = response.data.data;
      
      // Auto-login après inscription
      saveToken(token, user, workspace);
      logAuthEvent('login_success', { userEmail: user?.email, userRole: user?.role, source: 'register' });
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: { token, user, workspace }
      });
      
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Erreur d\'inscription';
      logUserAction('register_failure', { email: userData.email, message: errorMessage });
      throw new Error(errorMessage);
    }
  };

  // Changer le mot de passe
  const changePassword = async (currentPassword, newPassword) => {
    try {
      const response = await authApi.changePassword({
        currentPassword,
        newPassword
      });
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Erreur lors du changement de mot de passe';
      throw new Error(errorMessage);
    }
  };

  // Changer la devise
  const changeCurrency = async (currency) => {
    try {
      const response = await authApi.changeCurrency({ currency });
      
      // Update state
      dispatch({
        type: 'UPDATE_USER',
        payload: { currency }
      });
      
      // Update localStorage with new currency
      const storedUser = JSON.parse(localStorage.getItem('ecomUser') || '{}');
      storedUser.currency = currency;
      localStorage.setItem('ecomUser', JSON.stringify(storedUser));
      
      // Reload page to force all components to update with new currency
      window.location.reload();
      
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Erreur lors du changement de devise';
      throw new Error(errorMessage);
    }
  };

  // Incarnation : Super Admin peut devenir n'importe quel utilisateur
  const impersonateUser = async (targetUserId, targetUserData = null) => {
    // Vérifier que l'utilisateur actuel est un Super Admin
    if (state.user?.role !== 'super_admin') {
      throw new Error('Seul le Super Admin peut utiliser l\'incarnation');
    }

    try {
      let targetUser, targetWorkspace;

      if (targetUserData) {
        // Utiliser les données fournies directement (depuis la liste des utilisateurs)
        targetUser = targetUserData;
        targetWorkspace = targetUserData.workspaceId;
        logAuthEvent('impersonate_start', { targetEmail: targetUser.email, targetWorkspace: targetWorkspace?.name });
      } else {
        // Approche de secours avec données simulées
        targetUser = {
          _id: targetUserId,
          email: 'user_' + targetUserId.substring(0, 8) + '@example.com',
          role: 'ecom_admin',
          workspaceId: null
        };
        targetWorkspace = null;
      logAuthEvent('impersonate_start', { targetId: targetUserId, mode: 'simulated' });
      }

      // Démarrer l'incarnation
      dispatch({
        type: 'START_IMPERSONATION',
        payload: {
          originalUser: state.user,
          targetUser,
          targetWorkspace
        }
      });

      // Sauvegarder l'état d'incarnation et le workspace
      saveImpersonation(state.user, targetUser, targetWorkspace);
      
      // Mettre à jour le workspace actif dans localStorage
      if (targetWorkspace) {
        localStorage.setItem('ecomWorkspace', JSON.stringify(targetWorkspace));
        logWorkspace('impersonation_active', targetWorkspace);
      }

      return { success: true, targetUser, targetWorkspace };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Erreur lors de l\'incarnation';
      throw new Error(errorMessage);
    }
  };

  // Arrêter l'incarnation et revenir au Super Admin
  const stopImpersonation = () => {
    if (!state.isImpersonating) {
      throw new Error('Aucune incarnation en cours');
    }

    // Restaurer l'utilisateur original
    dispatch({
      type: 'STOP_IMPERSONATION',
      payload: {
        originalUser: state.originalUser,
        originalWorkspace: state.originalUser?.workspace
      }
    });

    // Effacer l'état d'incarnation
    clearImpersonation();
    
    logAuthEvent('impersonate_stop', { originalEmail: state.originalUser?.email });
    // Restaurer le workspace original du Super Admin
    if (state.originalUser?.workspace) {
      localStorage.setItem('ecomWorkspace', JSON.stringify(state.originalUser.workspace));
      logWorkspace('restored', state.originalUser.workspace);
    } else {
      localStorage.removeItem('ecomWorkspace');
    }

    // Naviguer vers le dashboard Super Admin
    window.location.href = '/ecom/super-admin';
  };

  // Restaurer l'incarnation au chargement
  const restoreImpersonation = () => {
    const originalUser = JSON.parse(localStorage.getItem('ecomOriginalUser') || 'null');
    const impersonatedUser = JSON.parse(localStorage.getItem('ecomImpersonatedUser') || 'null');

    if (originalUser && impersonatedUser && originalUser.role === 'super_admin') {
      dispatch({
        type: 'START_IMPERSONATION',
        payload: {
          originalUser,
          targetUser: impersonatedUser,
          targetWorkspace: impersonatedUser.workspace
        }
      });
    }
  };

  // Vérifier les permissions de l'utilisateur
  const hasPermission = (permission) => {
    if (!state.user) return false;

    const permissions = {
      'ecom_admin': ['*'],
      'ecom_closeuse': ['orders:read', 'orders:write'],
      'ecom_compta': ['finance:read'],
      'ecom_livreur': ['orders:read']
    };

    const userPermissions = permissions[state.user.role] || [];
    return userPermissions.includes('*') || userPermissions.includes(permission);
  };

  // Vérifier si l'utilisateur a un rôle spécifique
  const hasRole = (role) => {
    return state.user?.role === role;
  };

  // Effacer les erreurs
  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  // Charger l'utilisateur au montage du composant
  useEffect(() => {
    logAuthEvent('provider_mounted', { url: window.location.pathname });
    loadUser();
    // Restaurer l'incarnation si elle existe
    restoreImpersonation();
  }, []);

  // Enregistrer un appareil pour la connexion permanente
  const registerDevice = async (deviceInfo) => {
    try {
      const normalizedDeviceInfo = deviceInfo || {
        userAgent: navigator?.userAgent || 'unknown',
        platform: navigator?.platform || 'unknown'
      };

      const response = await authApi.registerDevice({ deviceInfo: normalizedDeviceInfo });
      if (response.data.success) {
        const { permanentToken } = response.data.data;
        localStorage.setItem('ecomToken', permanentToken);
        dispatch({ 
          type: 'UPDATE_TOKEN', 
          payload: { token: permanentToken } 
        });
        return response.data;
      }
    } catch (error) {
      console.error('Erreur enregistrement appareil:', error);
      throw error;
    }
  };

  const value = {
    ...state,
    login,
    logout,
    register,
    registerDevice,
    changePassword,
    changeCurrency,
    hasPermission,
    hasRole,
    clearError,
    loadUser,
    impersonateUser,
    stopImpersonation
  };

  return (
    <EcomAuthContext.Provider value={value}>
      {children}
    </EcomAuthContext.Provider>
  );
};

// Hook pour vérifier l'état d'authentification (debug)
export const EcomAuthDebug = () => {
  const { isAuthenticated, user, loading, token } = useEcomAuth();
  
  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'black',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      zIndex: 9999
    }}>
      <div>🔐 Debug Auth:</div>
      <div>Loading: {loading ? 'Oui' : 'Non'}</div>
      <div>Auth: {isAuthenticated ? 'Oui' : 'Non'}</div>
      <div>User: {user ? user.email : 'Null'}</div>
      <div>Role: {user ? user.role : 'Null'}</div>
      <div>Token: {token ? 'Présent' : 'Absent'}</div>
    </div>
  );
};

// Hook personnalisé pour utiliser l'authentification
export const useEcomAuth = () => {
  const context = useContext(EcomAuthContext);
  
  if (!context) {
    throw new Error('useEcomAuth doit être utilisé dans un EcomAuthProvider');
  }
  
  return context;
};

// Hook pour vérifier l'authentification avant d'accéder à une page
export const useRequireAuth = () => {
  const { isAuthenticated, loading, user } = useEcomAuth();
  
  return {
    isAuthenticated,
    loading,
    user,
    // Fonction pour rediriger si non authentifié
    requireAuth: () => {
      if (!loading && !isAuthenticated) {
        window.location.href = '/ecom/login';
        return false;
      }
      return true;
    }
  };
};

// Hook pour vérifier les permissions spécifiques
export const useRequirePermission = (permission) => {
  const { hasPermission, user } = useEcomAuth();
  
  return {
    hasPermission: hasPermission(permission),
    user,
    // Fonction pour vérifier et rediriger si permission manquante
    requirePermission: () => {
      if (!hasPermission(permission)) {
        // Rediriger vers le dashboard approprié ou page d'erreur
        const dashboardMap = {
          'ecom_admin': '/ecom/dashboard',
          'ecom_closeuse': '/ecom/dashboard',
          'ecom_compta': '/ecom/dashboard'
        };
        
        window.location.href = dashboardMap[user?.role] || '/ecom/login';
        return false;
      }
      return true;
    }
  };
};

// Hook pour obtenir le dashboard approprié selon le rôle
export const useRoleBasedDashboard = () => {
  const { user, isAuthenticated } = useEcomAuth();
  
  const getDashboardPath = () => {
    if (!isAuthenticated || !user) return '/ecom/login';
    
    const dashboardMap = {
      'ecom_admin': '/ecom/dashboard/admin',
      'ecom_closeuse': '/ecom/dashboard/closeuse',
      'ecom_compta': '/ecom/dashboard/compta'
    };
    
    return dashboardMap[user.role] || '/ecom/login';
  };
  
  const getDashboardComponent = () => {
    if (!isAuthenticated || !user) return null;
    
    // Ces composants seront importés dynamiquement selon le besoin
    const componentMap = {
      'ecom_admin': 'AdminDashboard',
      'ecom_closeuse': 'CloseuseDashboard',
      'ecom_compta': 'ComptaDashboard'
    };
    
    return componentMap[user.role] || null;
  };
  
  return {
    dashboardPath: getDashboardPath(),
    dashboardComponent: getDashboardComponent(),
    userRole: user?.role
  };
};

export default EcomAuthContext;
