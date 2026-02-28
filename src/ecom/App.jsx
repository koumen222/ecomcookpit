import React, { useEffect, useState, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { EcomAuthProvider } from './hooks/useEcomAuth.jsx';
import { CurrencyProvider } from './contexts/CurrencyContext.jsx';
import { useEcomAuth } from './hooks/useEcomAuth.jsx';
import { trackPageView } from './services/analytics.js';
import { usePosthogPageViews } from './hooks/usePosthogPageViews.js';
import { useSubdomain } from './hooks/useSubdomain.js';
import EcomLayout from './components/EcomLayout.jsx';
import PrivacyBanner from './components/PrivacyBanner.jsx';

// Lazy load toutes les pages (code splitting → bundle initial 10x plus petit)
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'));
const CloseuseDashboard = lazy(() => import('./pages/CloseuseDashboard.jsx'));
const ComptaDashboard = lazy(() => import('./pages/ComptaDashboard.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const ProductsList = lazy(() => import('./pages/ProductsList.jsx'));
const ProductForm = lazy(() => import('./pages/ProductForm.jsx'));
const ReportsList = lazy(() => import('./pages/ReportsList.jsx'));
const ReportsInsightsPage = lazy(() => import('./pages/ReportsInsightsPage.jsx'));
const ReportForm = lazy(() => import('./pages/ReportForm.jsx'));
const ReportDetail = lazy(() => import('./pages/ReportDetail.jsx'));
const ProductReportDetail = lazy(() => import('./pages/ProductReportDetail.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const StockOrdersList = lazy(() => import('./pages/StockOrdersList.jsx'));
const StockOrderForm = lazy(() => import('./pages/StockOrderForm.jsx'));
const StockManagement = lazy(() => import('./pages/StockManagement.jsx'));
const DecisionsList = lazy(() => import('./pages/DecisionsList.jsx'));
const DecisionForm = lazy(() => import('./pages/DecisionForm.jsx'));
const TransactionsList = lazy(() => import('./pages/TransactionsList.jsx'));
const TransactionForm = lazy(() => import('./pages/TransactionForm.jsx'));
const TransactionDetail = lazy(() => import('./pages/TransactionDetail.jsx'));
const ProductDetail = lazy(() => import('./pages/ProductDetail.jsx'));
const UserManagement = lazy(() => import('./pages/UserManagement.jsx'));
const ClientsList = lazy(() => import('./pages/ClientsList.jsx'));
const ClientForm = lazy(() => import('./pages/ClientForm.jsx'));
const OrdersList = lazy(() => import('./pages/OrdersList.jsx'));
const OrderDetail = lazy(() => import('./pages/OrderDetail.jsx'));
const CampaignsList = lazy(() => import('./pages/CampaignsList.jsx'));
const CampaignForm = lazy(() => import('./pages/CampaignForm.jsx'));
const CampaignStats = lazy(() => import('./pages/CampaignStats.jsx'));
const CampaignDetail = lazy(() => import('./pages/CampaignDetail.jsx'));
const TeamPerformance = lazy(() => import('./pages/TeamPerformance.jsx'));
const WhatsAppPostulation = lazy(() => import('./pages/WhatsAppPostulation.jsx'));
const WhatsAppEnSavoirPlus = lazy(() => import('./pages/WhatsAppEnSavoirPlus.jsx'));
const AssignmentsManager = lazy(() => import('./pages/AssignmentsManager.jsx'));
const CloseuseProduits = lazy(() => import('./pages/CloseuseProduits.jsx'));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard.jsx'));
const SuperAdminUsers = lazy(() => import('./pages/SuperAdminUsers.jsx'));
const SuperAdminUserDetail = lazy(() => import('./pages/SuperAdminUserDetail.jsx'));
const SuperAdminWorkspaces = lazy(() => import('./pages/SuperAdminWorkspaces.jsx'));
const SuperAdminActivity = lazy(() => import('./pages/SuperAdminActivity.jsx'));
const SuperAdminSettings = lazy(() => import('./pages/SuperAdminSettings.jsx'));
const SetupSuperAdmin = lazy(() => import('./pages/SetupSuperAdmin.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const Data = lazy(() => import('./pages/Data.jsx'));
const Goals = lazy(() => import('./pages/Goals.jsx'));
const LivreurDashboard = lazy(() => import('./pages/LivreurDashboard.jsx'));
const EcomLandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const ProductResearchList = lazy(() => import('./pages/ProductResearchList.jsx'));
const ProductFinder = lazy(() => import('./pages/ProductFinder.jsx'));
const ProductFinderEdit = lazy(() => import('./pages/ProductFinderEdit.jsx'));
const ImportOrders = lazy(() => import('./pages/ImportOrders.jsx'));
const StatsPage = lazy(() => import('./pages/StatsPage.jsx'));
const StatsRapports = lazy(() => import('./pages/StatsRapports.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));
const WorkspaceSetup = lazy(() => import('./pages/WorkspaceSetup.jsx'));
const InviteAccept = lazy(() => import('./pages/InviteAccept.jsx'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy.jsx'));
const TermsOfService = lazy(() => import('./pages/TermsOfService.jsx'));
const SecurityDashboard = lazy(() => import('./pages/SecurityDashboard.jsx'));
const TeamChat = lazy(() => import('./pages/TeamChat.jsx'));
const Commissions = lazy(() => import('./pages/Commissions.jsx'));
const SuppliersList = lazy(() => import('./pages/SuppliersList.jsx'));
const SuperAdminAnalytics = lazy(() => import('./pages/SuperAdminAnalytics.jsx'));
const Marketing = lazy(() => import('./pages/Marketing.jsx'));
const SuperAdminWhatsAppPostulations = lazy(() => import('./pages/SuperAdminWhatsAppPostulations.jsx'));
const SuperAdminWhatsAppLogs = lazy(() => import('./pages/SuperAdminWhatsAppLogs.jsx'));
const SuperAdminPushCenter = lazy(() => import('./pages/SuperAdminPushCenter.jsx'));
const WhyScalor = lazy(() => import('./pages/WhyScalor.jsx'));
const Tarifs = lazy(() => import('./pages/Tarifs.jsx'));

// ─── Store / Storefront pages ─────────────────────────────────────────────
const StoreSetup = lazy(() => import('./pages/StoreSetup.jsx'));
const StoreProductsList = lazy(() => import('./pages/StoreProductsList.jsx'));
const StoreProductForm = lazy(() => import('./pages/StoreProductForm.jsx'));
const StoreAnalytics = lazy(() => import('./pages/StoreAnalytics.jsx'));
const StoreOrdersDashboard = lazy(() => import('./pages/StoreOrdersDashboard.jsx'));
const StoreFront = lazy(() => import('./pages/StoreFront.jsx'));
const StoreProductPage = lazy(() => import('./pages/StoreProductPage.jsx'));
const StoreCheckout = lazy(() => import('./pages/StoreCheckout.jsx'));

const IconFillLoader = ({ backgroundClassName = 'bg-white' }) => {
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
    <div className={`fixed inset-0 ${backgroundClassName} z-50 flex items-center justify-center`}>
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

// Lightweight spinner for page transitions — pure CSS, no image loads, no RAF
const SpinnerLoader = () => (
  <div className="fixed inset-0 bg-gray-50 z-50 flex items-center justify-center">
    <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#0F6B4F', animation: 'spin 0.7s linear infinite' }} />
  </div>
);

// Alias used by Suspense fallback
const PageLoader = SpinnerLoader;



class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Ecom UI error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h1 className="text-lg font-semibold text-gray-900">Une erreur est survenue</h1>
            <p className="mt-2 text-sm text-gray-600">
              La page a rencontré un problème. Tu peux rafraîchir ou revenir au dashboard.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Rafraîchir
              </button>
              <a
                href="/ecom/dashboard"
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Dashboard
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Composant de protection des routes
const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, isAuthenticated, loading } = useEcomAuth();

  // Session active : JAMAIS de loader, affichage instantané
  // Le loader n'apparaît QUE si pas de session locale ET en cours de chargement
  const hasLocalSession = !!localStorage.getItem('ecomToken') && !!localStorage.getItem('ecomUser');
  // Désactivé : plus de loader pour les sessions actives
  // if (loading && !hasLocalSession) {
  //   return <SpinnerLoader />;
  // }

  // Après le chargement : vérifier l'authentification
  // Utiliser isAuthenticated du contexte OU les données locales en fallback
  const hasToken = !!localStorage.getItem('ecomToken');
  const localUser = !user ? JSON.parse(localStorage.getItem('ecomUser') || 'null') : user;
  const effectiveAuth = isAuthenticated || (hasToken && localUser);
  const effectiveUser = user || localUser;

  if (!effectiveAuth) {
    return <Navigate to="/ecom/login" replace />;
  }

  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    // Le Super Admin peut accéder à toutes les routes
    if (effectiveUser?.role === 'super_admin') {
      return children;
    }
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

// Composant pour rediriger automatiquement vers le bon dashboard
const DashboardRedirect = () => {
  const { user, isAuthenticated, loading } = useEcomAuth();

  const hasLocalSession = !!localStorage.getItem('ecomToken') && !!localStorage.getItem('ecomUser');
  // Désactivé : plus de loader, redirection instantanée
  // if (loading && !hasLocalSession) {
  //   return <SpinnerLoader />;
  // }

  const hasToken = !!localStorage.getItem('ecomToken');
  const localUser = !user ? JSON.parse(localStorage.getItem('ecomUser') || 'null') : user;
  const effectiveAuth = isAuthenticated || (hasToken && localUser);
  const effectiveUser = user || localUser;

  if (!effectiveAuth) {
    return <Navigate to="/ecom/login" replace />;
  }

  // Rediriger vers le dashboard selon le rôle
  const roleDashboardMap = {
    'super_admin': '/ecom/super-admin',
    'ecom_admin': '/ecom/dashboard/admin',
    'ecom_closeuse': '/ecom/dashboard/closeuse',
    'ecom_compta': '/ecom/dashboard/compta',
    'livreur': '/ecom/livreur'
  };

  const dashboardPath = roleDashboardMap[user?.role] || '/ecom/dashboard';
  return <Navigate to={dashboardPath} replace />;
};

// Layout stable mémorisé — sidebar/header ne se remontent JAMAIS lors de la navigation.
// Suspense est INSIDE le layout: seul le contenu de page suspend, pas le shell.
const StableLayout = React.memo(({ children }) => (
  <EcomLayout>
    <Suspense fallback={<SpinnerLoader />}>
      <ErrorBoundary>{children}</ErrorBoundary>
    </Suspense>
  </EcomLayout>
));
StableLayout.displayName = 'StableLayout';

// Wrapper qui ajoute le layout aux routes protégées
const LayoutRoute = ({ children, requiredRole }) => (
  <ProtectedRoute requiredRole={requiredRole}>
    <StableLayout>{children}</StableLayout>
  </ProtectedRoute>
);

// Redirection racine: dashboard si connecté, landing page sinon
const RootRedirect = () => {
  const { isAuthenticated, user, loading } = useEcomAuth();
  const hasLocalSession = !!localStorage.getItem('ecomToken') && !!localStorage.getItem('ecomUser');

  if (loading && !hasLocalSession) {
    return <IconFillLoader backgroundClassName="bg-white" />;
  }

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

  const dest = roleDashboardMap[effectiveUser?.role] || '/ecom/dashboard';
  return <Navigate to={dest} replace />;
};

// Track page views on route change (existing analytics + PostHog)
const PageViewTracker = () => {
  const location = useLocation();
  usePosthogPageViews();
  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);
  return null;
};

// Prefetch likely routes on idle — makes navigation feel instant
const PREFETCH_ROUTES = [
  () => import('./pages/AdminDashboard.jsx'),
  () => import('./pages/OrdersList.jsx'),
  () => import('./pages/ProductsList.jsx'),
  () => import('./pages/ClientsList.jsx'),
  () => import('./pages/ReportsList.jsx'),
];
let _prefetched = false;
const PrefetchOnIdle = () => {
  useEffect(() => {
    if (_prefetched) return;
    _prefetched = true;
    const run = () => PREFETCH_ROUTES.forEach(fn => fn().catch(() => {}));
    if ('requestIdleCallback' in window) {
      requestIdleCallback(run, { timeout: 5000 });
    } else {
      setTimeout(run, 3000);
    }
  }, []);
  return null;
};

/**
 * StoreApp — Rendered when accessing via subdomain (e.g., koumen.scalor.net).
 * Only loads public store routes. No SaaS dashboard, no auth required.
 * Routes: / (store home), /product/:slug, /checkout
 */
const StoreApp = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Suspense fallback={<SpinnerLoader />}><StoreFront /></Suspense>} />
          <Route path="/product/:slug" element={<Suspense fallback={<SpinnerLoader />}><StoreProductPage /></Suspense>} />
          <Route path="/checkout" element={<Suspense fallback={<SpinnerLoader />}><StoreCheckout /></Suspense>} />
          {/* Fallback: redirect unknown paths to store home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    </div>
  );
};

const EcomApp = () => {
  const { subdomain, isStoreDomain } = useSubdomain();

  // Subdomain detected → render public store app (no auth, no dashboard)
  if (isStoreDomain) {
    return <StoreApp />;
  }

  // Root domain → render full SaaS application
  return (
    <EcomAuthProvider>
      <CurrencyProvider>
        <div className="min-h-screen bg-gray-50">
          <ErrorBoundary>
            <PageViewTracker />
            <PrefetchOnIdle />
            <Routes>
              {/* Route racine - redirection auto selon session */}
              <Route path="/" element={<RootRedirect />} />
              <Route path="/ecom" element={<RootRedirect />} />

              {/* Routes publiques (sans layout) — wrapped in leur propre Suspense */}
              <Route path="/ecom/landing" element={<Suspense fallback={<SpinnerLoader />}><EcomLandingPage /></Suspense>} />
              <Route path="/ecom/why-scalor" element={<Suspense fallback={<SpinnerLoader />}><WhyScalor /></Suspense>} />
              <Route path="/ecom/tarifs" element={<Suspense fallback={<SpinnerLoader />}><Tarifs /></Suspense>} />
              <Route path="/ecom/privacy" element={<Suspense fallback={<SpinnerLoader />}><PrivacyPolicy /></Suspense>} />
              <Route path="/ecom/terms" element={<Suspense fallback={<SpinnerLoader />}><TermsOfService /></Suspense>} />
              <Route path="/ecom/security" element={<LayoutRoute><SecurityDashboard /></LayoutRoute>} />
              <Route path="/ecom/login" element={<Suspense fallback={<SpinnerLoader />}><Login /></Suspense>} />
              <Route path="/ecom/register" element={<Suspense fallback={<SpinnerLoader />}><Register /></Suspense>} />
              <Route path="/ecom/forgot-password" element={<Suspense fallback={<SpinnerLoader />}><ForgotPassword /></Suspense>} />
              <Route path="/ecom/reset-password" element={<Suspense fallback={<SpinnerLoader />}><ResetPassword /></Suspense>} />
              <Route path="/ecom/setup-admin" element={<Suspense fallback={<SpinnerLoader />}><SetupSuperAdmin /></Suspense>} />
              <Route path="/ecom/invite/:token" element={<Suspense fallback={<SpinnerLoader />}><InviteAccept /></Suspense>} />
              <Route path="/ecom/workspace-setup" element={<Suspense fallback={<SpinnerLoader />}><WorkspaceSetup /></Suspense>} />
              <Route path="/ecom/dashboard" element={<LayoutRoute><Dashboard /></LayoutRoute>} />

              {/* Routes produits */}
              <Route path="/ecom/products" element={<LayoutRoute requiredRole="ecom_admin"><ProductsList /></LayoutRoute>} />
              <Route path="/ecom/products/new" element={<LayoutRoute requiredRole="ecom_admin"><ProductForm /></LayoutRoute>} />
              <Route path="/ecom/products/:id" element={<LayoutRoute><ProductDetail /></LayoutRoute>} />
              <Route path="/ecom/products/:id/edit" element={<LayoutRoute requiredRole="ecom_admin"><ProductForm /></LayoutRoute>} />

              {/* Routes rapports */}
              <Route path="/ecom/reports" element={<LayoutRoute><ReportsList /></LayoutRoute>} />
              <Route path="/ecom/reports/insights" element={<LayoutRoute><ReportsInsightsPage /></LayoutRoute>} />
              <Route path="/ecom/reports/new" element={<LayoutRoute><ReportForm /></LayoutRoute>} />
              <Route path="/ecom/reports/product/:productId" element={<LayoutRoute><ProductReportDetail /></LayoutRoute>} />
              <Route path="/ecom/reports/:id/edit" element={<LayoutRoute><ReportForm /></LayoutRoute>} />
              <Route path="/ecom/reports/:id" element={<LayoutRoute><ReportDetail /></LayoutRoute>} />

              {/* Route profil */}
              <Route path="/ecom/profile" element={<LayoutRoute><Profile /></LayoutRoute>} />

              {/* Route Data */}
              <Route path="/ecom/data" element={<LayoutRoute><Data /></LayoutRoute>} />

              {/* Route Objectifs */}
              <Route path="/ecom/goals" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse', 'ecom_compta']}><Goals /></LayoutRoute>} />

              {/* Route Recherche Produits */}
              <Route path="/ecom/product-research" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse', 'ecom_compta']}><ProductResearchList /></LayoutRoute>} />
              <Route path="/ecom/product-finder" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse', 'ecom_compta']}><ProductFinder /></LayoutRoute>} />
              <Route path="/ecom/product-finder/:id" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse', 'ecom_compta']}><ProductFinderEdit /></LayoutRoute>} />

              {/* Routes stock - accessible par admin et closeuse */}
              <Route path="/ecom/stock" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><StockOrdersList /></LayoutRoute>} />
              <Route path="/ecom/stock/orders" element={<LayoutRoute requiredRole="ecom_admin"><StockOrdersList /></LayoutRoute>} />
              <Route path="/ecom/stock/orders/new" element={<LayoutRoute requiredRole="ecom_admin"><StockOrdersList /></LayoutRoute>} />
              <Route path="/ecom/stock/orders/:id/edit" element={<LayoutRoute requiredRole="ecom_admin"><StockOrdersList /></LayoutRoute>} />
              <Route path="/ecom/stock-locations" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><StockManagement /></LayoutRoute>} />

              {/* Routes transactions (compta + admin) */}
              <Route path="/ecom/transactions" element={<LayoutRoute><TransactionsList /></LayoutRoute>} />
              <Route path="/ecom/transactions/new" element={<LayoutRoute><TransactionForm /></LayoutRoute>} />
              <Route path="/ecom/transactions/:id" element={<LayoutRoute><TransactionDetail /></LayoutRoute>} />
              <Route path="/ecom/transactions/:id/edit" element={<LayoutRoute><TransactionForm /></LayoutRoute>} />

              {/* Routes décisions */}
              <Route path="/ecom/decisions" element={<LayoutRoute requiredRole="ecom_admin"><DecisionsList /></LayoutRoute>} />
              <Route path="/ecom/decisions/new" element={<LayoutRoute requiredRole="ecom_admin"><DecisionForm /></LayoutRoute>} />

              {/* Routes clients (admin + closeuse) */}
              <Route path="/ecom/clients" element={<LayoutRoute><ClientsList /></LayoutRoute>} />
              <Route path="/ecom/clients/new" element={<LayoutRoute><ClientForm /></LayoutRoute>} />
              <Route path="/ecom/clients/:id/edit" element={<LayoutRoute><ClientForm /></LayoutRoute>} />


              {/* Routes commandes (admin + closeuse) */}
              <Route path="/ecom/orders" element={<LayoutRoute><OrdersList /></LayoutRoute>} />
              <Route path="/ecom/orders/:id" element={<LayoutRoute><OrderDetail /></LayoutRoute>} />
              <Route path="/ecom/stats" element={<LayoutRoute requiredRole="ecom_admin"><StatsPage /></LayoutRoute>} />
              <Route path="/ecom/stats/rapports" element={<LayoutRoute requiredRole="ecom_admin"><StatsRapports /></LayoutRoute>} />

              {/* Route import commandes (admin) */}
              <Route path="/ecom/import" element={<LayoutRoute requiredRole="ecom_admin"><ImportOrders /></LayoutRoute>} />

              {/* Routes campagnes marketing (admin + closeuse) */}
              <Route path="/ecom/campaigns" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><CampaignsList /></LayoutRoute>} />
              <Route path="/ecom/campaigns/stats" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><CampaignStats /></LayoutRoute>} />
              <Route path="/ecom/campaigns/new" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><CampaignForm /></LayoutRoute>} />
              <Route path="/ecom/campaigns/:id" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><CampaignDetail /></LayoutRoute>} />
              <Route path="/ecom/campaigns/:id/edit" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><CampaignForm /></LayoutRoute>} />

              {/* Route postulation WhatsApp */}
              <Route path="/ecom/whatsapp-postulation" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><WhatsAppPostulation /></LayoutRoute>} />

              {/* Route WhatsApp en savoir plus */}
              <Route path="/ecom/whatsapp-en-savoir-plus" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><WhatsAppEnSavoirPlus /></LayoutRoute>} />

              {/* Routes gestion utilisateurs (admin) */}
              <Route path="/ecom/users" element={<LayoutRoute requiredRole="ecom_admin"><UserManagement /></LayoutRoute>} />
              <Route path="/ecom/users/team/performance" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><TeamPerformance /></LayoutRoute>} />

              {/* Routes gestion affectations (admin) */}
              <Route path="/ecom/assignments" element={<LayoutRoute requiredRole="ecom_admin"><AssignmentsManager /></LayoutRoute>} />

              {/* Routes fournisseurs (admin) */}
              <Route path="/ecom/suppliers" element={<LayoutRoute requiredRole="ecom_admin"><SuppliersList /></LayoutRoute>} />

              {/* Route produits affectés (closeuse) */}
              <Route path="/ecom/assignments/produits" element={<LayoutRoute requiredRole="ecom_closeuse"><CloseuseProduits /></LayoutRoute>} />

              {/* Route Commissions (closeuse) */}
              <Route path="/ecom/commissions" element={<LayoutRoute requiredRole="ecom_closeuse"><Commissions /></LayoutRoute>} />

              {/* Route Chat Équipe */}
              <Route path="/ecom/chat" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse', 'ecom_compta', 'ecom_livreur', 'super_admin']}><TeamChat /></LayoutRoute>} />

              {/* Route Paramètres */}
              <Route path="/ecom/settings" element={<LayoutRoute><Settings /></LayoutRoute>} />

              {/* Route Livreur */}
              <Route path="/ecom/livreur" element={<LayoutRoute requiredRole="livreur"><LivreurDashboard /></LayoutRoute>} />

              {/* Routes Super Admin */}
              <Route path="/ecom/super-admin" element={<LayoutRoute requiredRole="super_admin"><SuperAdminDashboard /></LayoutRoute>} />
              <Route path="/ecom/super-admin/users" element={<LayoutRoute requiredRole="super_admin"><SuperAdminUsers /></LayoutRoute>} />
              <Route path="/ecom/super-admin/users/:userId" element={<LayoutRoute requiredRole="super_admin"><SuperAdminUserDetail /></LayoutRoute>} />
              <Route path="/ecom/super-admin/workspaces" element={<LayoutRoute requiredRole="super_admin"><SuperAdminWorkspaces /></LayoutRoute>} />
              <Route path="/ecom/super-admin/activity" element={<LayoutRoute requiredRole="super_admin"><SuperAdminActivity /></LayoutRoute>} />
              <Route path="/ecom/super-admin/settings" element={<LayoutRoute requiredRole="super_admin"><SuperAdminSettings /></LayoutRoute>} />
              <Route path="/ecom/super-admin/analytics" element={<LayoutRoute requiredRole="super_admin"><SuperAdminAnalytics /></LayoutRoute>} />
              <Route path="/ecom/super-admin/push" element={<LayoutRoute requiredRole="super_admin"><SuperAdminPushCenter /></LayoutRoute>} />
              <Route path="/ecom/super-admin/whatsapp-postulations" element={<LayoutRoute requiredRole="super_admin"><SuperAdminWhatsAppPostulations /></LayoutRoute>} />
              <Route path="/ecom/super-admin/whatsapp-logs" element={<LayoutRoute requiredRole="super_admin"><SuperAdminWhatsAppLogs /></LayoutRoute>} />

              {/* Route Marketing Email (super_admin + ecom_admin) */}
              <Route path="/ecom/marketing" element={<LayoutRoute requiredRole={['super_admin', 'ecom_admin']}><Marketing /></LayoutRoute>} />

              {/* Route de redirection automatique */}
              <Route path="/ecom/dashboard" element={<DashboardRedirect />} />

              {/* Dashboards protégés par rôle */}
              <Route path="/ecom/dashboard/admin" element={<LayoutRoute requiredRole="ecom_admin"><AdminDashboard /></LayoutRoute>} />
              <Route path="/ecom/dashboard/closeuse" element={<LayoutRoute requiredRole="ecom_closeuse"><CloseuseDashboard /></LayoutRoute>} />
              <Route path="/ecom/dashboard/compta" element={<LayoutRoute requiredRole="ecom_compta"><ComptaDashboard /></LayoutRoute>} />

              {/* ─── Store Dashboard Routes (authenticated, admin) ──────── */}
              <Route path="/ecom/store" element={<LayoutRoute requiredRole="ecom_admin"><StoreAnalytics /></LayoutRoute>} />
              <Route path="/ecom/store/setup" element={<LayoutRoute requiredRole="ecom_admin"><StoreSetup /></LayoutRoute>} />
              <Route path="/ecom/store/products" element={<LayoutRoute requiredRole="ecom_admin"><StoreProductsList /></LayoutRoute>} />
              <Route path="/ecom/store/products/new" element={<LayoutRoute requiredRole="ecom_admin"><StoreProductForm /></LayoutRoute>} />
              <Route path="/ecom/store/products/:id/edit" element={<LayoutRoute requiredRole="ecom_admin"><StoreProductForm /></LayoutRoute>} />
              <Route path="/ecom/store/orders" element={<LayoutRoute requiredRole="ecom_admin"><StoreOrdersDashboard /></LayoutRoute>} />

              {/* ─── Public Store Routes (no auth, customer-facing) ─────── */}
              <Route path="/store/:subdomain" element={<Suspense fallback={<SpinnerLoader />}><StoreFront /></Suspense>} />
              <Route path="/store/:subdomain/product/:slug" element={<Suspense fallback={<SpinnerLoader />}><StoreProductPage /></Suspense>} />
              <Route path="/store/:subdomain/checkout" element={<Suspense fallback={<SpinnerLoader />}><StoreCheckout /></Suspense>} />

              {/* Route catch-all */}
              <Route path="*" element={<Navigate to="/ecom/login" replace />} />
            </Routes>
          </ErrorBoundary>
          <PrivacyBanner />
        </div>
      </CurrencyProvider>
    </EcomAuthProvider>
  );
};

export default EcomApp;
