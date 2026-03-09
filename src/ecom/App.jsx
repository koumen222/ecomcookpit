/**
 * AppOptimized.jsx - Version optimisée de l'application avec navigation instantanée
 * 
 * Optimisations intégrées :
 * - Préchargement intelligent des pages au hover
 * - Cache agressif des données API
 * - Suspense sans loader visible
 * - Transitions de page fluides
 * - Fallbacks transparents
 */

import React, { useEffect, useState, Suspense, lazy, useCallback, useRef } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { EcomAuthProvider } from './hooks/useEcomAuth.jsx';
import { CurrencyProvider } from './contexts/CurrencyContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { useEcomAuth } from './hooks/useEcomAuth.jsx';
import { trackPageView } from './services/analytics.js';
import { usePosthogPageViews } from './hooks/usePosthogPageViews.js';
import { useSubdomain } from './hooks/useSubdomain.js';

// Composants d'optimisation
import { SmartCacheProvider } from './components/SmartCache.jsx';
import { InstantNavigationProvider, CriticalDataPreloader } from './components/InstantNavigation.jsx';
import { InvisibleSuspense, PageTransition, MinimalErrorBoundary } from './components/LoadingOptimizations.jsx';
import { usePrefetch, useLinkPrefetching } from './hooks/usePrefetch.js';

// Layout principal
import EcomLayout from './components/EcomLayout.jsx';
import PrivacyBanner from './components/PrivacyBanner.jsx';

// ═══════════════════════════════════════════════════════════════
// LAZY LOADING DES PAGES - Avec préchargement intelligent
// ═══════════════════════════════════════════════════════════════

const createLazyPage = (importFn, prefetchData = null) => {
  const LazyComponent = lazy(importFn);
  LazyComponent.preload = () => {
    const promise = importFn();
    if (prefetchData) prefetchData();
    return promise;
  };
  return LazyComponent;
};

// Routes principales avec préchargement
const Login = createLazyPage(() => import('./pages/Login.jsx'));
const Register = createLazyPage(() => import('./pages/Register.jsx'));
const AdminDashboard = createLazyPage(() => import('./pages/AdminDashboard.jsx'));
const Dashboard = createLazyPage(() => import('./pages/Dashboard.jsx'));
const ProductsList = createLazyPage(() => import('./pages/ProductsList.jsx'));
const ProductForm = createLazyPage(() => import('./pages/ProductForm.jsx'));
const OrdersList = createLazyPage(() => import('./pages/OrdersList.jsx'));
const OrderDetail = createLazyPage(() => import('./pages/OrderDetail.jsx'));
const ClientsList = createLazyPage(() => import('./pages/ClientsList.jsx'));
const ClientForm = createLazyPage(() => import('./pages/ClientForm.jsx'));
const ReportsList = createLazyPage(() => import('./pages/ReportsList.jsx'));
const ReportForm = createLazyPage(() => import('./pages/ReportForm.jsx'));
const Profile = createLazyPage(() => import('./pages/Profile.jsx'));
const Settings = createLazyPage(() => import('./pages/Settings.jsx'));
const CampaignsList = createLazyPage(() => import('./pages/CampaignsList.jsx'));
const CampaignForm = createLazyPage(() => import('./pages/CampaignForm.jsx'));
const CampaignDetail = createLazyPage(() => import('./pages/CampaignDetail.jsx'));
const EcomLandingPage = createLazyPage(() => import('./pages/LandingPage.jsx'));
const SourcingList = createLazyPage(() => import('./pages/SourcingList.jsx'));
const SupplierDetail = createLazyPage(() => import('./pages/SupplierDetail.jsx'));
const ImportOrders = createLazyPage(() => import('./pages/ImportOrders.jsx'));
const StatsPage = createLazyPage(() => import('./pages/StatsPage.jsx'));
const StockOrdersList = createLazyPage(() => import('./pages/StockOrdersList.jsx'));
const StockManagement = createLazyPage(() => import('./pages/StockManagement.jsx'));
const TransactionsList = createLazyPage(() => import('./pages/TransactionsList.jsx'));
const TeamChat = createLazyPage(() => import('./pages/TeamChat.jsx'));

// Autres routes (lazy loading standard)
const CloseuseDashboard = createLazyPage(() => import('./pages/CloseuseDashboard.jsx'));
const ComptaDashboard = createLazyPage(() => import('./pages/ComptaDashboard.jsx'));
const ReportsInsightsPage = createLazyPage(() => import('./pages/ReportsInsightsPage.jsx'));
const ReportDetail = createLazyPage(() => import('./pages/ReportDetail.jsx'));
const ProductReportDetail = createLazyPage(() => import('./pages/ProductReportDetail.jsx'));
const StockOrderForm = createLazyPage(() => import('./pages/StockOrderForm.jsx'));
const DecisionsList = createLazyPage(() => import('./pages/DecisionsList.jsx'));
const DecisionForm = createLazyPage(() => import('./pages/DecisionForm.jsx'));
const TransactionForm = createLazyPage(() => import('./pages/TransactionForm.jsx'));
const TransactionDetail = createLazyPage(() => import('./pages/TransactionDetail.jsx'));
const ProductDetail = createLazyPage(() => import('./pages/ProductDetail.jsx'));
const UserManagement = createLazyPage(() => import('./pages/UserManagement.jsx'));
const CampaignStats = createLazyPage(() => import('./pages/CampaignStats.jsx'));
const TeamPerformance = createLazyPage(() => import('./pages/TeamPerformance.jsx'));
const WhatsAppPostulation = createLazyPage(() => import('./pages/WhatsAppPostulation.jsx'));
const WhatsAppEnSavoirPlus = createLazyPage(() => import('./pages/WhatsAppEnSavoirPlus.jsx'));
const AssignmentsManager = createLazyPage(() => import('./pages/AssignmentsManager.jsx'));
const CloseuseProduits = createLazyPage(() => import('./pages/CloseuseProduits.jsx'));
const SuperAdminDashboard = createLazyPage(() => import('./pages/SuperAdminDashboard.jsx'));
const SuperAdminUsers = createLazyPage(() => import('./pages/SuperAdminUsers.jsx'));
const SuperAdminUserDetail = createLazyPage(() => import('./pages/SuperAdminUserDetail.jsx'));
const SuperAdminWorkspaces = createLazyPage(() => import('./pages/SuperAdminWorkspaces.jsx'));
const SuperAdminActivity = createLazyPage(() => import('./pages/SuperAdminActivity.jsx'));
const SuperAdminSettings = createLazyPage(() => import('./pages/SuperAdminSettings.jsx'));
const SetupSuperAdmin = createLazyPage(() => import('./pages/SetupSuperAdmin.jsx'));
const Data = createLazyPage(() => import('./pages/Data.jsx'));
const Goals = createLazyPage(() => import('./pages/Goals.jsx'));
const LivreurDashboard = createLazyPage(() => import('./pages/LivreurDashboard.jsx'));
const ProductResearchList = createLazyPage(() => import('./pages/ProductResearchList.jsx'));
const ProductFinder = createLazyPage(() => import('./pages/ProductFinder.jsx'));
const ProductFinderEdit = createLazyPage(() => import('./pages/ProductFinderEdit.jsx'));
const StatsRapports = createLazyPage(() => import('./pages/StatsRapports.jsx'));
const ForgotPassword = createLazyPage(() => import('./pages/ForgotPassword.jsx'));
const ResetPassword = createLazyPage(() => import('./pages/ResetPassword.jsx'));
const WorkspaceSetup = createLazyPage(() => import('./pages/WorkspaceSetup.jsx'));
const InviteAccept = createLazyPage(() => import('./pages/InviteAccept.jsx'));
const PrivacyPolicy = createLazyPage(() => import('./pages/PrivacyPolicy.jsx'));
const TermsOfService = createLazyPage(() => import('./pages/TermsOfService.jsx'));
const SecurityDashboard = createLazyPage(() => import('./pages/SecurityDashboard.jsx'));
const Commissions = createLazyPage(() => import('./pages/Commissions.jsx'));
const SuppliersList = createLazyPage(() => import('./pages/SuppliersList.jsx'));
const SuperAdminAnalytics = createLazyPage(() => import('./pages/SuperAdminAnalytics.jsx'));
const Marketing = createLazyPage(() => import('./pages/Marketing.jsx'));
const SuperAdminWhatsAppPostulations = createLazyPage(() => import('./pages/SuperAdminWhatsAppPostulations.jsx'));
const SuperAdminWhatsAppLogs = createLazyPage(() => import('./pages/SuperAdminWhatsAppLogs.jsx'));
const SuperAdminPushCenter = createLazyPage(() => import('./pages/SuperAdminPushCenter.jsx'));
const WhyScalor = createLazyPage(() => import('./pages/WhyScalor.jsx'));
const Tarifs = createLazyPage(() => import('./pages/Tarifs.jsx'));
const SourcingStats = createLazyPage(() => import('./pages/SourcingStats.jsx'));
const WhatsAppConnexion = createLazyPage(() => import('./pages/WhatsAppConnexion.jsx'));
const WhatsAppInstancesList = createLazyPage(() => import('./pages/WhatsAppInstancesList.jsx'));
const TestBackend = createLazyPage(() => import('./components/TestBackend.jsx'));

// Store / Storefront pages
const StoreSetup = createLazyPage(() => import('./pages/StoreSetup.jsx'));
const StoreProductsList = createLazyPage(() => import('./pages/StoreProductsList.jsx'));
const StoreProductForm = createLazyPage(() => import('./pages/StoreProductForm.jsx'));
const StoreAnalytics = createLazyPage(() => import('./pages/StoreAnalytics.jsx'));
const StoreOrdersDashboard = createLazyPage(() => import('./pages/StoreOrdersDashboard.jsx'));
const PublicStorefront = createLazyPage(() => import('./pages/PublicStorefront.jsx'));
const StoreProductPage = createLazyPage(() => import('./pages/StoreProductPage.jsx'));
const StoreCheckout = createLazyPage(() => import('./pages/StoreCheckout.jsx'));
const StoreFront = createLazyPage(() => import('./pages/StoreFront.jsx'));

// Boutique Module
const BoutiqueLayout = createLazyPage(() => import('./components/BoutiqueLayout.jsx'));
const BoutiqueDashboard = createLazyPage(() => import('./pages/BoutiqueDashboard.jsx'));
const BoutiquePixel = createLazyPage(() => import('./pages/BoutiquePixel.jsx'));
const ThemeTest = createLazyPage(() => import('./components/ThemeTest.jsx'));
const BoutiquePayments = createLazyPage(() => import('./pages/BoutiquePayments.jsx'));
const BoutiqueDomains = createLazyPage(() => import('./pages/BoutiqueDomains.jsx'));
const BoutiqueSettings = createLazyPage(() => import('./pages/BoutiqueSettings.jsx'));

// ═══════════════════════════════════════════════════════════════
// FALLBACKS INVISIBLES - Aucun loader visible
// ═══════════════════════════════════════════════════════════════

const InvisibleFallback = () => (
  <div style={{ opacity: 0, height: 0, overflow: 'hidden', position: 'absolute' }} />
);

// ═══════════════════════════════════════════════════════════════
// PREFETCHING INTELLIGENT - Pages liées aux routes principales
// ═══════════════════════════════════════════════════════════════

const PREFETCH_ROUTES = [
  { component: AdminDashboard, delay: 0 },
  { component: OrdersList, delay: 100 },
  { component: ProductsList, delay: 200 },
  { component: ClientsList, delay: 300 },
  { component: ReportsList, delay: 400 },
];

/**
 * Composant de préchargement en arrière-plan
 */
const PrefetchOnIdle = () => {
  const [prefetched, setPrefetched] = useState(false);

  useEffect(() => {
    if (prefetched) return;

    const runPrefetch = () => {
      PREFETCH_ROUTES.forEach(({ component, delay }) => {
        setTimeout(() => {
          component.preload?.().catch(() => {});
        }, delay);
      });
      setPrefetched(true);
    };

    // Précharger quand le navigateur est inactif
    if ('requestIdleCallback' in window) {
      requestIdleCallback(runPrefetch, { timeout: 3000 });
    } else {
      setTimeout(runPrefetch, 2000);
    }
  }, [prefetched]);

  return null;
};

// ═══════════════════════════════════════════════════════════════
// PROTECTION DES ROUTES - Sans loader visible
// ═══════════════════════════════════════════════════════════════

const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, isAuthenticated } = useEcomAuth();

  // Session locale
  const hasLocalSession = !!localStorage.getItem('ecomToken') && !!localStorage.getItem('ecomUser');
  const hasToken = !!localStorage.getItem('ecomToken');
  const localUser = !user ? JSON.parse(localStorage.getItem('ecomUser') || 'null') : user;
  const effectiveAuth = isAuthenticated || (hasToken && localUser);
  const effectiveUser = user || localUser;

  if (!effectiveAuth) {
    return <Navigate to="/ecom/login" replace />;
  }

  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (effectiveUser?.role === 'super_admin') return children;
    if (!roles.includes(effectiveUser?.role)) {
      const roleDashboardMap = {
        'super_admin': '/ecom/super-admin',
        'ecom_admin': '/ecom/dashboard/admin',
        'ecom_closeuse': '/ecom/dashboard/closeuse',
        'ecom_compta': '/ecom/dashboard/compta'
      };
      return <Navigate to={roleDashboardMap[effectiveUser?.role] || '/ecom/login'} replace />;
    }
  }

  return children;
};

const DashboardRedirect = () => {
  const { user, isAuthenticated } = useEcomAuth();
  const hasLocalSession = !!localStorage.getItem('ecomToken') && !!localStorage.getItem('ecomUser');
  const hasToken = !!localStorage.getItem('ecomToken');
  const localUser = !user ? JSON.parse(localStorage.getItem('ecomUser') || 'null') : user;
  const effectiveAuth = isAuthenticated || (hasToken && localUser);
  const effectiveUser = user || localUser;

  if (!effectiveAuth) {
    return <Navigate to="/ecom/login" replace />;
  }

  const roleDashboardMap = {
    'super_admin': '/ecom/super-admin',
    'ecom_admin': '/ecom/dashboard/admin',
    'ecom_closeuse': '/ecom/dashboard/closeuse',
    'ecom_compta': '/ecom/dashboard/compta',
    'livreur': '/ecom/livreur'
  };

  return <Navigate to={roleDashboardMap[effectiveUser?.role] || '/ecom/dashboard'} replace />;
};

const RootRedirect = () => {
  const { isAuthenticated, user } = useEcomAuth();
  const hasLocalSession = !!localStorage.getItem('ecomToken') && !!localStorage.getItem('ecomUser');
  const effectiveUser = user || JSON.parse(localStorage.getItem('ecomUser') || 'null');
  const effectiveAuth = isAuthenticated || hasLocalSession;

  if (!effectiveAuth) {
    return <Navigate to="/ecom/landing" replace />;
  }

  const roleDashboardMap = {
    'super_admin': '/ecom/super-admin',
    'ecom_admin': '/ecom/dashboard/admin',
    'ecom_closeuse': '/ecom/dashboard/closeuse',
    'ecom_compta': '/ecom/dashboard/compta',
    'livreur': '/ecom/livreur'
  };

  return <Navigate to={roleDashboardMap[effectiveUser?.role] || '/ecom/dashboard'} replace />;
};

// ═══════════════════════════════════════════════════════════════
// LAYOUT AVEC SUSPENSE INVISIBLE
// ═══════════════════════════════════════════════════════════════

const StableLayout = React.memo(({ children }) => (
  <EcomLayout>
    <InvisibleSuspense fallback={<InvisibleFallback />}>
      <MinimalErrorBoundary>
        {children}
      </MinimalErrorBoundary>
    </InvisibleSuspense>
  </EcomLayout>
));

StableLayout.displayName = 'StableLayout';

const LayoutRoute = ({ children, requiredRole }) => (
  <ProtectedRoute requiredRole={requiredRole}>
    <StableLayout>{children}</StableLayout>
  </ProtectedRoute>
);

// ═══════════════════════════════════════════════════════════════
// TRACKING ET ANALYTICS
// ═══════════════════════════════════════════════════════════════

const PageViewTracker = () => {
  const location = useLocation();
  usePosthogPageViews();
  
  useEffect(() => {
    // Tracking sans bloquer la navigation
    requestIdleCallback?.(() => trackPageView(location.pathname));
  }, [location.pathname]);

  return null;
};

// ═══════════════════════════════════════════════════════════════
// STORE APP - Subdomain (Optimisé avec navigation instantanée)
// ═══════════════════════════════════════════════════════════════

import StoreAppOptimized from './StoreAppOptimized.jsx';

// Alias pour compatibilité
const StoreApp = StoreAppOptimized;

// ═══════════════════════════════════════════════════════════════
// APP PRINCIPAL - Navigation instantanée
// ═══════════════════════════════════════════════════════════════

const EcomApp = () => {
  const location = useLocation();
  const { isStoreDomain } = useSubdomain();

  // Préchargement intelligent des liens
  useLinkPrefetching();

  // Nettoyage cache local au démarrage
  useEffect(() => {
    try {
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('ecom_cache_')) {
          localStorage.removeItem(key);
        }
      });
    } catch {}
  }, []);

  if (isStoreDomain) {
    return <StoreApp />;
  }

  return (
    <SmartCacheProvider>
      <InstantNavigationProvider>
        <CurrencyProvider>
          <ThemeProvider>
            <div className="min-h-screen bg-gray-50">
              <CriticalDataPreloader>
                <PageViewTracker />
                <PrefetchOnIdle />
                
                <PageTransition locationKey={location.key}>
                  <Routes>
                    {/* Routes racines */}
                    <Route path="/" element={<RootRedirect />} />
                    <Route path="/ecom" element={<RootRedirect />} />

                    {/* Routes publiques */}
                    <Route path="/ecom/landing" element={<InvisibleSuspense><EcomLandingPage /></InvisibleSuspense>} />
                    <Route path="/ecom/why-scalor" element={<InvisibleSuspense><WhyScalor /></InvisibleSuspense>} />
                    <Route path="/ecom/tarifs" element={<InvisibleSuspense><Tarifs /></InvisibleSuspense>} />
                    <Route path="/ecom/privacy" element={<InvisibleSuspense><PrivacyPolicy /></InvisibleSuspense>} />
                    <Route path="/ecom/terms" element={<InvisibleSuspense><TermsOfService /></InvisibleSuspense>} />
                    <Route path="/ecom/login" element={<InvisibleSuspense><Login /></InvisibleSuspense>} />
                    <Route path="/ecom/register" element={<InvisibleSuspense><Register /></InvisibleSuspense>} />
                    <Route path="/ecom/forgot-password" element={<InvisibleSuspense><ForgotPassword /></InvisibleSuspense>} />
                    <Route path="/ecom/reset-password" element={<InvisibleSuspense><ResetPassword /></InvisibleSuspense>} />
                    <Route path="/ecom/setup-admin" element={<InvisibleSuspense><SetupSuperAdmin /></InvisibleSuspense>} />
                    <Route path="/ecom/invite/:token" element={<InvisibleSuspense><InviteAccept /></InvisibleSuspense>} />
                    <Route path="/ecom/workspace-setup" element={<InvisibleSuspense><WorkspaceSetup /></InvisibleSuspense>} />

                    {/* Routes protégées avec layout */}
                    <Route path="/ecom/dashboard" element={<DashboardRedirect />} />
                    <Route path="/ecom/dashboard/admin" element={<LayoutRoute requiredRole="ecom_admin"><AdminDashboard /></LayoutRoute>} />
                    <Route path="/ecom/dashboard/closeuse" element={<LayoutRoute requiredRole="ecom_closeuse"><CloseuseDashboard /></LayoutRoute>} />
                    <Route path="/ecom/dashboard/compta" element={<LayoutRoute requiredRole="ecom_compta"><ComptaDashboard /></LayoutRoute>} />

                    {/* Routes produits */}
                    <Route path="/ecom/products" element={<LayoutRoute requiredRole="ecom_admin"><ProductsList /></LayoutRoute>} />
                    <Route path="/ecom/products/new" element={<LayoutRoute requiredRole="ecom_admin"><ProductForm /></LayoutRoute>} />
                    <Route path="/ecom/products/:id" element={<LayoutRoute><ProductDetail /></LayoutRoute>} />
                    <Route path="/ecom/products/:id/edit" element={<LayoutRoute requiredRole="ecom_admin"><ProductForm /></LayoutRoute>} />

                    {/* Routes commandes */}
                    <Route path="/ecom/orders" element={<LayoutRoute><OrdersList /></LayoutRoute>} />
                    <Route path="/ecom/orders/:id" element={<LayoutRoute><OrderDetail /></LayoutRoute>} />
                    <Route path="/ecom/import" element={<LayoutRoute requiredRole="ecom_admin"><ImportOrders /></LayoutRoute>} />

                    {/* Routes clients */}
                    <Route path="/ecom/clients" element={<LayoutRoute><ClientsList /></LayoutRoute>} />
                    <Route path="/ecom/clients/new" element={<LayoutRoute><ClientForm /></LayoutRoute>} />
                    <Route path="/ecom/clients/:id/edit" element={<LayoutRoute><ClientForm /></LayoutRoute>} />

                    {/* Routes rapports */}
                    <Route path="/ecom/reports" element={<LayoutRoute><ReportsList /></LayoutRoute>} />
                    <Route path="/ecom/reports/new" element={<LayoutRoute><ReportForm /></LayoutRoute>} />
                    <Route path="/ecom/reports/:id" element={<LayoutRoute><ReportDetail /></LayoutRoute>} />
                    <Route path="/ecom/reports/:id/edit" element={<LayoutRoute><ReportForm /></LayoutRoute>} />

                    {/* Routes sourcing */}
                    <Route path="/ecom/sourcing" element={<LayoutRoute><SourcingList /></LayoutRoute>} />
                    <Route path="/ecom/sourcing/stats" element={<LayoutRoute><SourcingStats /></LayoutRoute>} />
                    <Route path="/ecom/sourcing/:id" element={<LayoutRoute><SupplierDetail /></LayoutRoute>} />

                    {/* Routes stock */}
                    <Route path="/ecom/stock" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><StockOrdersList /></LayoutRoute>} />
                    <Route path="/ecom/stock-locations" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><StockManagement /></LayoutRoute>} />

                    {/* Routes transactions */}
                    <Route path="/ecom/transactions" element={<LayoutRoute><TransactionsList /></LayoutRoute>} />
                    <Route path="/ecom/transactions/new" element={<LayoutRoute><TransactionForm /></LayoutRoute>} />
                    <Route path="/ecom/transactions/:id" element={<LayoutRoute><TransactionDetail /></LayoutRoute>} />

                    {/* Routes campagnes */}
                    <Route path="/ecom/campaigns" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><CampaignsList /></LayoutRoute>} />
                    <Route path="/ecom/campaigns/new" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><CampaignForm /></LayoutRoute>} />
                    <Route path="/ecom/campaigns/:id" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><CampaignDetail /></LayoutRoute>} />
                    <Route path="/ecom/campaigns/:id/edit" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><CampaignForm /></LayoutRoute>} />

                    {/* Routes stats */}
                    <Route path="/ecom/stats" element={<LayoutRoute requiredRole="ecom_admin"><StatsPage /></LayoutRoute>} />

                    {/* Routes WhatsApp */}
                    <Route path="/ecom/whatsapp-postulation" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><WhatsAppPostulation /></LayoutRoute>} />
                    <Route path="/ecom/whatsapp/instances" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><WhatsAppInstancesList /></LayoutRoute>} />

                    {/* Routes utilisateurs */}
                    <Route path="/ecom/users" element={<LayoutRoute requiredRole="ecom_admin"><UserManagement /></LayoutRoute>} />
                    <Route path="/ecom/profile" element={<LayoutRoute><Profile /></LayoutRoute>} />
                    <Route path="/ecom/settings" element={<LayoutRoute><Settings /></LayoutRoute>} />

                    {/* Routes chat */}
                    <Route path="/ecom/chat" element={<LayoutRoute><TeamChat /></LayoutRoute>} />

                    {/* Routes Super Admin */}
                    <Route path="/ecom/super-admin" element={<LayoutRoute requiredRole="super_admin"><SuperAdminDashboard /></LayoutRoute>} />
                    <Route path="/ecom/super-admin/users" element={<LayoutRoute requiredRole="super_admin"><SuperAdminUsers /></LayoutRoute>} />

                    {/* Routes boutique */}
                    <Route path="/ecom/boutique/*" element={<LayoutRoute requiredRole="ecom_admin"><BoutiqueLayout /></LayoutRoute>} />

                    {/* Store public */}
                    <Route path="/store/:subdomain" element={<InvisibleSuspense><PublicStorefront /></InvisibleSuspense>} />

                    {/* Catch-all */}
                    <Route path="*" element={<Navigate to="/ecom/login" replace />} />
                  </Routes>
                </PageTransition>
              </CriticalDataPreloader>
              <PrivacyBanner />
            </div>
          </ThemeProvider>
        </CurrencyProvider>
      </InstantNavigationProvider>
    </SmartCacheProvider>
  );
};

// Wrapper avec AuthProvider
const EcomAppWithAuth = () => (
  <EcomAuthProvider>
    <EcomApp />
  </EcomAuthProvider>
);

export default EcomAppWithAuth;
