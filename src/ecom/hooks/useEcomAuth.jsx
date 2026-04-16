import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { authApi } from '../services/ecommApi.js';
import { logAuthEvent, logWorkspace, logUserAction } from '../services/prodLogger.js';
// Lazy posthog — keeps posthog-js out of the critical auth bundle
const _ph = () => import('../services/posthog.js');
const phIdentify = (...a) => _ph().then(m => m.identifyUser(...a)).catch(() => {});
const phTrack = (...a) => _ph().then(m => m.track(...a)).catch(() => {});
const phReset = () => _ph().then(m => m.resetAnalytics()).catch(() => {});

// Contexte d'authentification e-commerce
const EcomAuthContext = createContext();

const normalizeWorkspace = (workspace) => {
  if (!workspace) return null;

  const normalizedId = workspace._id || workspace.id || null;
  return {
    ...workspace,
    _id: normalizedId,
    id: workspace.id || normalizedId,
  };
};

// État initial - charger les données locales pour une persistance immédiate
const storedToken = localStorage.getItem('ecomToken');
const storedUser = JSON.parse(localStorage.getItem('ecomUser') || 'null');
const storedWorkspace = normalizeWorkspace(JSON.parse(localStorage.getItem('ecomWorkspace') || 'null'));

const initialState = {
  user: storedUser,
  workspace: storedWorkspace,
  token: storedToken,
  // Si on a un token ET un user stocké, on est potentiellement authentifié
  isAuthenticated: !!(storedToken && storedUser),
  loading: !!storedToken, // Ne charger que si on a un token à vérifier
  error: null
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
        workspace: normalizeWorkspace(action.payload.workspace) || state.workspace,
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
        workspace: normalizeWorkspace(action.payload.workspace) || state.workspace,
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
    
    default:
      return state;
  }
};

// Provider d'authentification
export const EcomAuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  
  // CRITICAL: Ref to prevent concurrent loadUser calls
  const loadingRef = useRef(false);

  // Effacer le token du localStorage
  const clearToken = () => {
    logAuthEvent('token_cleared', { reason: 'explicit_clear' });
    localStorage.removeItem('ecomToken');
    localStorage.removeItem('ecomUser');
    localStorage.removeItem('ecomWorkspace');
  };

  // Sauvegarder le token dans le localStorage
  const saveToken = (token, user, workspace) => {
    const normalizedWorkspace = normalizeWorkspace(workspace);
    logAuthEvent('token_saved', { userEmail: user?.email, userRole: user?.role, hasWorkspace: !!workspace });
    localStorage.setItem('ecomToken', token);
    localStorage.setItem('ecomUser', JSON.stringify(user));
    if (normalizedWorkspace) {
      localStorage.setItem('ecomWorkspace', JSON.stringify(normalizedWorkspace));
      logWorkspace('saved', normalizedWorkspace);
    }
  };

  // Charger l'utilisateur depuis le token
  const loadUser = async () => {
    const token = localStorage.getItem('ecomToken');
    logAuthEvent(token ? 'token_found' : 'token_missing', {
      tokenPrefix: token ? token.slice(0, 20) + '…' : null
    });
    
    if (!token) {
      dispatch({ type: 'LOAD_USER_FAILURE' });
      loadingRef.current = false;
      return;
    }

    // CRITICAL: Use ref instead of state to prevent concurrent calls
    if (loadingRef.current) {
      logAuthEvent('load_user_already_loading', {});
      return;
    }

    loadingRef.current = true;

    try {
      logAuthEvent('load_user_start', { tokenPrefix: token.slice(0, 20) + '…' });
      const response = await authApi.getProfile();
      
      const wsData = normalizeWorkspace(response.data.data.workspace);
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

      // PostHog: re-identify returning user
      phIdentify(userData, wsData);
    } catch (error) {
      logAuthEvent('load_user_failure', {
        status: error.response?.status,
        message: error.message,
        isNetwork: !error.response,
      });
      
      // NE déconnecter que pour les vraies erreurs 401 (token invalide)
      // PAS pour les erreurs réseau (backend inaccessible)
      if (error.response?.status === 401) {
        logAuthEvent('token_invalid_401', { message: 'Token invalide ou expiré, déconnexion' });
        clearToken();
        dispatch({ type: 'LOAD_USER_FAILURE' });
      } else if (!error.response) {
        // Erreur réseau - garder l'utilisateur connecté avec les données locales
        logAuthEvent('load_user_network', { message: error.message });
        const userData = JSON.parse(localStorage.getItem('ecomUser') || 'null');
        const workspaceData = normalizeWorkspace(JSON.parse(localStorage.getItem('ecomWorkspace') || 'null'));
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
    } finally {
      // CRITICAL: Always reset loading ref
      loadingRef.current = false;
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

      // PostHog: identify user + track login
      phIdentify(user, workspace);
      phTrack('login_success', { workspaceId: workspace?._id || workspace?.id });

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
    phReset();
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

      // PostHog: identify user + track register
      phIdentify(user, workspace);
      phTrack('register_success', { workspaceId: workspace?._id || workspace?.id });
      
      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Erreur d\'inscription';
      logUserAction('register_failure', { email: userData.email, message: errorMessage });
      throw new Error(errorMessage);
    }
  };

  // Connexion / inscription via Google
  const googleLogin = async (credential, affiliateCode) => {
    dispatch({ type: 'LOGIN_START' });
    logAuthEvent('google_login_start');

    try {
      const response = await authApi.googleAuth({ credential, affiliateCode: affiliateCode || undefined });
      const { token, user, workspace } = response.data.data;

      saveToken(token, user, workspace);
      logAuthEvent('google_login_success', { userEmail: user?.email, userRole: user?.role });

      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: { token, user, workspace }
      });

      // PostHog: identify user + track google login
      phIdentify(user, workspace);
      phTrack('login_success', { workspaceId: workspace?._id || workspace?.id, method: 'google' });

      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Erreur de connexion Google';
      logAuthEvent('google_login_failure', { message: errorMessage });
      dispatch({ type: 'LOGIN_FAILURE', payload: errorMessage });
      throw new Error(errorMessage);
    }
  };

  // Créer un workspace (utilisateur déjà authentifié)
  const createWorkspace = async (workspaceName, role = 'ecom_admin') => {
    try {
      logUserAction('create_workspace_attempt', { workspaceName, role });
      const response = await authApi.createWorkspace({ workspaceName, role });
      const { token, user, workspace } = response.data.data;

      saveToken(token, user, workspace);
      logAuthEvent('login_success', { userEmail: user?.email, userRole: user?.role, source: 'create_workspace' });
      dispatch({ type: 'LOGIN_SUCCESS', payload: { token, user, workspace } });

      // PostHog: re-identify with new workspace group
      phIdentify(user, workspace);
      phTrack('workspace_created', { workspaceId: workspace?._id || workspace?.id });

      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Erreur création espace';
      throw new Error(errorMessage);
    }
  };

  // Rejoindre un workspace (utilisateur déjà authentifié)
  const joinWorkspace = async (inviteCode, selectedRole) => {
    try {
      logUserAction('join_workspace_attempt', { inviteCode, selectedRole });
      const response = await authApi.joinWorkspace({ inviteCode, selectedRole });
      const { token, user, workspace } = response.data.data;

      saveToken(token, user, workspace);
      logAuthEvent('login_success', { userEmail: user?.email, userRole: user?.role, source: 'join_workspace' });
      dispatch({ type: 'LOGIN_SUCCESS', payload: { token, user, workspace } });

      // PostHog: re-identify with joined workspace group
      phIdentify(user, workspace);
      phTrack('workspace_joined', { workspaceId: workspace?._id || workspace?.id });

      return response.data;
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Erreur pour rejoindre l\'espace';
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

  // Changer de workspace actif
  const switchWorkspace = async (newToken, updatedUser, newWorkspace) => {
    try {
      // Sauvegarder le nouveau token et les données utilisateur
      saveToken(newToken, updatedUser, newWorkspace);
      
      logAuthEvent('workspace_switched', {
        userEmail: updatedUser?.email,
        newWorkspaceId: newWorkspace?._id,
        newWorkspaceName: newWorkspace?.name,
        newRole: updatedUser?.role
      });

      // Mettre à jour le state
      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: { token: newToken, user: updatedUser, workspace: newWorkspace }
      });

      // PostHog: track workspace switch
      phIdentify(updatedUser, newWorkspace);
      phTrack('workspace_switched', { 
        workspaceId: newWorkspace?._id,
        workspaceName: newWorkspace?.name,
        role: updatedUser?.role
      });

      return { success: true };
    } catch (error) {
      logAuthEvent('workspace_switch_error', { message: error.message });
      throw error;
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
  // CRITICAL: Only run ONCE on mount, never again
  // Use global flag to prevent multiple instances
  useEffect(() => {
    if (window.__ecomAuthInitialized) {
      console.warn('[EcomAuth] Provider already initialized, skipping loadUser');
      return;
    }
    window.__ecomAuthInitialized = true;
    
    logAuthEvent('provider_mounted', { url: window.location.pathname });
    loadUser();

    return () => {
      // Ne pas reset le flag au unmount pour éviter re-init
      // window.__ecomAuthInitialized = false;
    };
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
    googleLogin,
    createWorkspace,
    joinWorkspace,
    changePassword,
    changeCurrency,
    hasPermission,
    hasRole,
    clearError,
    loadUser,
    switchWorkspace
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
