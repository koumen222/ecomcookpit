import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation, matchPath } from 'react-router-dom';
import { EcomAuthProvider } from './hooks/useEcomAuth.jsx';
import { CurrencyProvider } from './contexts/CurrencyContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { StoreProvider } from './contexts/StoreContext.jsx';
import { useEcomAuth } from './hooks/useEcomAuth.jsx';
// analytics imported lazily in PageViewTracker — keeps axios out of the critical bundle
import { usePosthogPageViews } from './hooks/usePosthogPageViews.js';
import { useSubdomain } from './hooks/useSubdomain.js';
import { setDocumentMeta } from './utils/pageMeta.js';
import {
  preloadPublicStorefrontRoute,
  preloadStoreAllProductsRoute,
  preloadStoreCheckoutRoute,
  preloadStoreProductRoute,
  preloadStoreRoutesOnIdle,
} from './utils/routePrefetch.js';

// Layout principal
import EcomLayout from './components/EcomLayout.jsx';
import PrivacyBanner from './components/PrivacyBanner.jsx';

// Pages - Imports directs (pas de lazy loading)
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const ProductsList = lazy(() => import('./pages/ProductsList.jsx'));
const ProductForm = lazy(() => import('./pages/ProductForm.jsx'));
const OrdersList = lazy(() => import('./pages/OrdersList.jsx'));
const OrderDetail = lazy(() => import('./pages/OrderDetail.jsx'));
const ClientsList = lazy(() => import('./pages/ClientsList.jsx'));
const ClientForm = lazy(() => import('./pages/ClientForm.jsx'));
const ReportsList = lazy(() => import('./pages/ReportsList.jsx'));
const ReportForm = lazy(() => import('./pages/ReportForm.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const CampaignsList = lazy(() => import('./pages/CampaignsList.jsx'));
const CampaignForm = lazy(() => import('./pages/CampaignForm.jsx'));
const CampaignDetail = lazy(() => import('./pages/CampaignDetail.jsx'));
const EcomLandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const SourcingList = lazy(() => import('./pages/SourcingList.jsx'));
const SupplierDetail = lazy(() => import('./pages/SupplierDetail.jsx'));
const ImportOrders = lazy(() => import('./pages/ImportOrders.jsx'));
const StatsPage = lazy(() => import('./pages/StatsPage.jsx'));
const StockOrdersList = lazy(() => import('./pages/StockOrdersList.jsx'));
const StockManagement = lazy(() => import('./pages/StockManagement.jsx'));
const TransactionsList = lazy(() => import('./pages/TransactionsList.jsx'));
const TeamChat = lazy(() => import('./pages/TeamChat.jsx'));

const CloseuseDashboard = lazy(() => import('./pages/CloseuseDashboard.jsx'));
const ComptaDashboard = lazy(() => import('./pages/ComptaDashboard.jsx'));
const ReportsInsightsPage = lazy(() => import('./pages/ReportsInsightsPage.jsx'));
const ReportDetail = lazy(() => import('./pages/ReportDetail.jsx'));
const ProductReportDetail = lazy(() => import('./pages/ProductReportDetail.jsx'));
const StockOrderForm = lazy(() => import('./pages/StockOrderForm.jsx'));
const DecisionsList = lazy(() => import('./pages/DecisionsList.jsx'));
const DecisionForm = lazy(() => import('./pages/DecisionForm.jsx'));
const TransactionForm = lazy(() => import('./pages/TransactionForm.jsx'));
const TransactionDetail = lazy(() => import('./pages/TransactionDetail.jsx'));
const ProductDetail = lazy(() => import('./pages/ProductDetail.jsx'));
const UserManagement = lazy(() => import('./pages/UserManagement.jsx'));
const CampaignStats = lazy(() => import('./pages/CampaignStats.jsx'));
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
const Data = lazy(() => import('./pages/Data.jsx'));
const Goals = lazy(() => import('./pages/Goals.jsx'));
const LivreurDashboard = lazy(() => import('./pages/LivreurDashboard.jsx'));
const LivreurAvailable = lazy(() => import('./pages/LivreurAvailable.jsx'));
const LivreurDeliveries = lazy(() => import('./pages/LivreurDeliveries.jsx'));
const LivreurDeliveryDetail = lazy(() => import('./pages/LivreurDeliveryDetail.jsx'));
const LivreurHistoryPage = lazy(() => import('./pages/LivreurHistoryPage.jsx'));
const LivreurEarningsPage = lazy(() => import('./pages/LivreurEarningsPage.jsx'));
const LivreurManagement = lazy(() => import('./pages/LivreurManagement.jsx'));
const ProductResearchList = lazy(() => import('./pages/ProductResearchList.jsx'));
const ProductFinder = lazy(() => import('./pages/ProductFinder.jsx'));
const ProductFinderEdit = lazy(() => import('./pages/ProductFinderEdit.jsx'));
const StatsRapports = lazy(() => import('./pages/StatsRapports.jsx'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'));
const ResetPassword = lazy(() => import('./pages/ResetPassword.jsx'));
const WorkspaceSetup = lazy(() => import('./pages/WorkspaceSetup.jsx'));
const InviteAccept = lazy(() => import('./pages/InviteAccept.jsx'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy.jsx'));
const TermsOfService = lazy(() => import('./pages/TermsOfService.jsx'));
const SecurityDashboard = lazy(() => import('./pages/SecurityDashboard.jsx'));
const Commissions = lazy(() => import('./pages/Commissions.jsx'));
const SuppliersList = lazy(() => import('./pages/SuppliersList.jsx'));
const SuperAdminAnalytics = lazy(() => import('./pages/SuperAdminAnalytics.jsx'));
const Marketing = lazy(() => import('./pages/Marketing.jsx'));
const SuperAdminWhatsAppPostulations = lazy(() => import('./pages/SuperAdminWhatsAppPostulations.jsx'));
const SuperAdminWhatsAppLogs = lazy(() => import('./pages/SuperAdminWhatsAppLogs.jsx'));
const SuperAdminPushCenter = lazy(() => import('./pages/SuperAdminPushCenter.jsx'));
const SuperAdminSupport = lazy(() => import('./pages/SuperAdminSupport.jsx'));
const SuperAdminBilling = lazy(() => import('./pages/SuperAdminBilling.jsx'));
const SuperAdminFeatureAnalytics = lazy(() => import('./pages/SuperAdminFeatureAnalytics.jsx'));
const WhyScalor = lazy(() => import('./pages/WhyScalor.jsx'));
const Tarifs = lazy(() => import('./pages/Tarifs.jsx'));
const SourcingStats = lazy(() => import('./pages/SourcingStats.jsx'));
const WhatsAppService = lazy(() => import('./pages/WhatsAppService.jsx'));
const DeveloperSection = lazy(() => import('./pages/DeveloperSection.jsx'));
const WhatsAppInstancesList = lazy(() => import('./pages/WhatsAppInstancesList.jsx'));
const RitaFlows = lazy(() => import('./pages/RitaFlows.jsx'));
const AgentConfig = lazy(() => import('./pages/AgentConfig.jsx'));
const AgentIAList = lazy(() => import('./pages/AgentIAList.jsx'));
const RitaConversations = lazy(() => import('./pages/RitaConversations.jsx'));
const AgentOnboarding = lazy(() => import('./pages/AgentOnboarding.jsx'));
const ConnectShopify = lazy(() => import('./pages/ConnectShopify.jsx'));
const BillingPage = lazy(() => import('./pages/BillingPage.jsx'));
const BillingSuccess = lazy(() => import('./pages/BillingSuccess.jsx'));
const ProviderService = lazy(() => import('./pages/ProviderService.jsx'));
const ProductSettingsPage = lazy(() => import('./pages/ProductSettingsPage.jsx'));
const ProductThemePage = lazy(() => import('./pages/ProductThemePage.jsx'));
const CreativeGenerator = lazy(() => import('./pages/CreativeGenerator.jsx'));

// Store pages
const StoreSetup = lazy(() => import('./pages/StoreSetup.jsx'));
const StoreProductsList = lazy(() => import('./pages/StoreProductsList.jsx'));
const StoreProductForm = lazy(() => import('./pages/StoreProductForm.jsx'));
const ProductPageGeneratorWizard = lazy(() => import('./pages/ProductPageGeneratorWizard.jsx'));
const ProductPageBuilder = lazy(() => import('./pages/ProductPageBuilder.jsx'));
const StoreAnalytics = lazy(() => import('./pages/StoreAnalytics.jsx'));
const StoreDashboard = lazy(() => import('./pages/StoreDashboard.jsx'));
const StoreOrdersDashboard = lazy(() => import('./pages/StoreOrdersDashboard.jsx'));
const PublicStorefront = lazy(preloadPublicStorefrontRoute);
const StoreLegalPage = lazy(() => import('./pages/PublicStorefront.jsx').then(m => ({ default: m.StoreLegalPage })));
const StoreAllProducts = lazy(() => preloadStoreAllProductsRoute().then((module) => ({ default: module.StoreAllProducts })));
const StoreProductPage = lazy(preloadStoreProductRoute);
const StoreCheckout = lazy(preloadStoreCheckoutRoute);
const StoreFront = lazy(() => import('./pages/StoreFront.jsx'));

// Boutique
const BoutiqueLayout = lazy(() => import('./components/BoutiqueLayout.jsx'));
const BoutiqueDashboard = lazy(() => import('./pages/BoutiqueDashboard.jsx'));
const BoutiquePages = lazy(() => import('./pages/BoutiquePages.jsx'));
const BoutiquePixel = lazy(() => import('./pages/BoutiquePixel.jsx'));
const BoutiquePayments = lazy(() => import('./pages/BoutiquePayments.jsx'));
const BoutiqueDomains = lazy(() => import('./pages/BoutiqueDomains.jsx'));
const BoutiqueSettings = lazy(() => import('./pages/BoutiqueSettings.jsx'));
const BoutiqueDeliveryZones = lazy(() => import('./pages/BoutiqueDeliveryZones.jsx'));
const BoutiqueFormBuilder = lazy(() => import('./pages/BoutiqueFormBuilder.jsx'));
const FormQuantityOffersPage = lazy(() => import('./pages/FormQuantityOffersPage.jsx'));
const FormQuantityOffersWizard = lazy(() => import('./pages/quantityOffers/FormQuantityOffersWizard.jsx'));
const FormUpsellsPage = lazy(() => import('./pages/FormUpsellsPage.jsx'));
const FormIntegrationsPage = lazy(() => import('./pages/FormIntegrationsPage.jsx'));
const FormAnalyticsPage = lazy(() => import('./pages/FormAnalyticsPage.jsx'));
const FormSettingsPage = lazy(() => import('./pages/FormSettingsPage.jsx'));
const FormPlanPage = lazy(() => import('./pages/FormPlanPage.jsx'));
const StoreCreationWizard = lazy(() => import('./pages/StoreCreationWizard.jsx'));

// ═══════════════════════════════════════════════════════════════
// PROTECTION DES ROUTES
// ═══════════════════════════════════════════════════════════════

const hasRitaAgentAccess = (user) => {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  if (user.role !== 'ecom_admin') return false;
  return user.canAccessRitaAgent !== false;
};

const DEFAULT_PLATFORM_DESCRIPTION = 'Scalor — Growth. Structure. Intelligence. The Operating System for African Ecommerce.';

const PLATFORM_TITLE_RULES = [
  { path: '/provider', title: 'Provider' },
  { path: '/ecom/provider', title: 'Provider' },
  { path: '/ecom/landing', title: 'Accueil' },
  { path: '/ecom/why-scalor', title: 'Pourquoi Scalor ?' },
  { path: '/ecom/tarifs', title: 'Tarifs' },
  { path: '/ecom/privacy', title: 'Confidentialité' },
  { path: '/ecom/terms', title: 'Conditions d\'utilisation' },
  { path: '/ecom/login', title: 'Connexion' },
  { path: '/ecom/register', title: 'Inscription' },
  { path: '/ecom/forgot-password', title: 'Mot de passe oublié' },
  { path: '/ecom/reset-password', title: 'Réinitialisation du mot de passe' },
  { path: '/ecom/setup-admin', title: 'Configuration admin' },
  { path: '/ecom/workspace-setup', title: 'Configuration workspace' },
  { path: '/ecom/invite/:token', title: 'Invitation' },
  { path: '/ecom/dashboard/admin', title: 'Dashboard Admin' },
  { path: '/ecom/dashboard/closeuse', title: 'Dashboard Closeuse' },
  { path: '/ecom/dashboard/compta', title: 'Dashboard Compta' },
  { path: '/ecom/products/new', title: 'Nouveau produit' },
  { path: '/ecom/products/:id/edit', title: 'Modifier le produit' },
  { path: '/ecom/products/:id', title: 'Détail produit' },
  { path: '/ecom/products', title: 'Produits' },
  { path: '/ecom/orders/:id', title: 'Détail commande' },
  { path: '/ecom/orders', title: 'Commandes' },
  { path: '/ecom/import', title: 'Import commandes' },
  { path: '/ecom/clients/new', title: 'Nouveau client' },
  { path: '/ecom/clients/:id/edit', title: 'Modifier le client' },
  { path: '/ecom/clients', title: 'Clients' },
  { path: '/ecom/reports/new', title: 'Nouveau rapport' },
  { path: '/ecom/reports/insights', title: 'Insights Rapports' },
  { path: '/ecom/reports/product/:productId', title: 'Rapport produit' },
  { path: '/ecom/reports/:id/edit', title: 'Modifier le rapport' },
  { path: '/ecom/reports/:id', title: 'Détail rapport' },
  { path: '/ecom/reports', title: 'Rapports' },
  { path: '/ecom/sourcing/stats', title: 'Statistiques sourcing' },
  { path: '/ecom/sourcing/:id', title: 'Détail fournisseur' },
  { path: '/ecom/sourcing', title: 'Sourcing' },
  { path: '/ecom/stock/orders/new', title: 'Nouvel ordre de stock' },
  { path: '/ecom/stock/orders/:id', title: 'Détail ordre de stock' },
  { path: '/ecom/stock/orders', title: 'Ordres de stock' },
  { path: '/ecom/stock-locations', title: 'Emplacements de stock' },
  { path: '/ecom/stock', title: 'Stock' },
  { path: '/ecom/transactions/new', title: 'Nouvelle transaction' },
  { path: '/ecom/transactions/:id', title: 'Détail transaction' },
  { path: '/ecom/transactions', title: 'Transactions' },
  { path: '/ecom/campaigns/new', title: 'Nouvelle campagne' },
  { path: '/ecom/campaigns/:id/edit', title: 'Modifier la campagne' },
  { path: '/ecom/campaigns/:id', title: 'Détail campagne' },
  { path: '/ecom/campaigns', title: 'Campagnes' },
  { path: '/ecom/stats', title: 'Statistiques' },
  { path: '/ecom/whatsapp-postulation', title: 'Postulation WhatsApp' },
  { path: '/ecom/whatsapp/service', title: 'Service WhatsApp' },
  { path: '/ecom/whatsapp/instances', title: 'Instances WhatsApp' },
  { path: '/ecom/whatsapp/agent-config', title: 'Configuration agent WhatsApp' },
  { path: '/ecom/whatsapp/conversations/:agentId', title: 'Conversations Rita' },
  { path: '/ecom/whatsapp/conversations', title: 'Conversations Rita' },
  { path: '/ecom/integrations/shopify', title: 'Intégration Shopify' },
  { path: '/ecom/billing/success', title: 'Paiement réussi' },
  { path: '/ecom/billing', title: 'Facturation' },
  { path: '/ecom/assignments', title: 'Affectations' },
  { path: '/ecom/users/team/performance', title: 'Performance équipe' },
  { path: '/ecom/users', title: 'Utilisateurs' },
  { path: '/ecom/profile', title: 'Profil' },
  { path: '/ecom/settings', title: 'Paramètres' },
  { path: '/ecom/data', title: 'Data' },
  { path: '/ecom/goals', title: 'Objectifs' },
  { path: '/ecom/product-research', title: 'Recherche produits' },
  { path: '/ecom/suppliers', title: 'Fournisseurs' },
  { path: '/ecom/product-finder/:id/edit', title: 'Modifier Product Finder' },
  { path: '/ecom/product-finder', title: 'Product Finder' },
  { path: '/ecom/stats-rapports', title: 'Stats Rapports' },
  { path: '/ecom/chat', title: 'Chat équipe' },
  { path: '/ecom/marketing', title: 'Marketing' },
  { path: '/ecom/super-admin/users/:id', title: 'Détail utilisateur' },
  { path: '/ecom/super-admin/users', title: 'Utilisateurs super admin' },
  { path: '/ecom/super-admin/workspaces', title: 'Workspaces super admin' },
  { path: '/ecom/super-admin/analytics', title: 'Analytics super admin' },
  { path: '/ecom/super-admin/feature-analytics', title: 'Features super admin' },
  { path: '/ecom/super-admin/activity', title: 'Activité super admin' },
  { path: '/ecom/super-admin/settings', title: 'Paramètres super admin' },
  { path: '/ecom/super-admin/whatsapp-postulations', title: 'Postulations WhatsApp' },
  { path: '/ecom/super-admin/whatsapp-logs', title: 'Logs WhatsApp' },
  { path: '/ecom/super-admin/push', title: 'Push Center' },
  { path: '/ecom/super-admin/support', title: 'Support super admin' },
  { path: '/ecom/super-admin/billing', title: 'Facturation super admin' },
  { path: '/ecom/super-admin', title: 'Dashboard super admin' },
  { path: '/ecom/boutique/analyses', title: 'Analyses de données' },
  { path: '/ecom/boutique/wizard', title: 'Création boutique' },
  { path: '/ecom/boutique/products/new', title: 'Nouveau produit boutique' },
  { path: '/ecom/boutique/products/:id/edit', title: 'Modifier produit boutique' },
  { path: '/ecom/boutique/products', title: 'Produits boutique' },
  { path: '/ecom/boutique/orders', title: 'Commandes boutique' },
  { path: '/ecom/boutique/pixel', title: 'Pixel boutique' },
  { path: '/ecom/boutique/payments', title: 'Paiements boutique' },
  { path: '/ecom/boutique/domains', title: 'Domaines boutique' },
  { path: '/ecom/boutique/delivery-zones', title: 'Zones de livraison' },
  { path: '/ecom/boutique/settings', title: 'Paramètres boutique' },
  { path: '/ecom/boutique/product-settings', title: 'Paramètres page produit' },
  { path: '/ecom/boutique/theme', title: 'Thème page produit' },
  { path: '/ecom/boutique', title: 'Boutique' },
  { path: '/ecom/developer', title: 'Développeur' },
  { path: '/ecom/agent-ia', title: 'Agents IA' },
  { path: '/ecom/agent-onboarding', title: 'Onboarding agent' },
  { path: '/ecom/rita-flows', title: 'Rita Flows' },
  { path: '/ecom/livreur/available', title: 'Disponibilité livreur' },
  { path: '/ecom/livreur/deliveries', title: 'Livraisons livreur' },
  { path: '/ecom/livreur/delivery/:id', title: 'Détail livraison' },
  { path: '/ecom/livreur/history', title: 'Historique livreur' },
  { path: '/ecom/livreur/earnings', title: 'Revenus livreur' },
  { path: '/ecom/livreur/revenus', title: 'Revenus livreur' },
  { path: '/ecom/livreur-management', title: 'Gestion livreurs' },
  { path: '/ecom/livreur', title: 'Dashboard livreur' },
];

function getPlatformDocumentTitle(pathname) {
  if (!pathname || pathname.startsWith('/store/')) return null;
  const matchedRule = PLATFORM_TITLE_RULES.find((rule) => matchPath({ path: rule.path, end: true }, pathname));
  if (matchedRule) return `${matchedRule.title} — Scalor`;
  if (pathname === '/' || pathname === '/ecom') return 'Scalor';
  return pathname.startsWith('/ecom/') ? 'Scalor — Plateforme e-commerce' : 'Scalor';
}

const PlatformPageMeta = ({ enabled = true }) => {
  const location = useLocation();

  React.useEffect(() => {
    if (!enabled) return;
    const title = getPlatformDocumentTitle(location.pathname);
    if (!title) return;
    setDocumentMeta({
      title,
      description: DEFAULT_PLATFORM_DESCRIPTION,
      image: 'https://scalor.net/icon.png',
      icon: '/icon.png',
      siteName: 'Scalor',
      appTitle: 'Scalor',
      type: 'website',
    });
  }, [enabled, location.pathname]);

  return null;
};

const ProtectedRoute = ({ children, requiredRole, requireRitaAgentAccess = false }) => {
  const { user, isAuthenticated } = useEcomAuth();

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
        'ecom_compta': '/ecom/dashboard/compta',
        'livreur': '/ecom/livreur',
        'ecom_livreur': '/ecom/livreur'
      };
      return <Navigate to={roleDashboardMap[effectiveUser?.role] || '/ecom/login'} replace />;
    }
  }

  if (requireRitaAgentAccess && !hasRitaAgentAccess(effectiveUser)) {
    return <Navigate to="/ecom/whatsapp/service" replace />;
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
    'livreur': '/ecom/livreur',
    'ecom_livreur': '/ecom/livreur'
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
    'livreur': '/ecom/livreur',
    'ecom_livreur': '/ecom/livreur'
  };

  return <Navigate to={roleDashboardMap[effectiveUser?.role] || '/ecom/dashboard'} replace />;
};

const PageLoader = ({ storeMode = false }) => (
  <div style={{
    minHeight: '100dvh',
    backgroundColor: storeMode ? '#FFFFFF' : '#0F1115',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  }}>
    <div style={{
      width: 40,
      height: 40,
      borderRadius: '50%',
      border: storeMode
        ? '3px solid rgba(15,107,79,0.15)'
        : '3px solid rgba(15,107,79,0.2)',
      borderTopColor: '#0F6B4F',
      animation: '_page-spin 0.6s linear infinite',
    }} />
    <style>{`@keyframes _page-spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

const StableLayout = React.memo(({ children }) => (
  <EcomLayout>
    <Suspense fallback={<PageLoader />}>
      {children}
    </Suspense>
  </EcomLayout>
));

StableLayout.displayName = 'StableLayout';

const LayoutRoute = ({ children, requiredRole, requireRitaAgentAccess = false }) => (
  <ProtectedRoute requiredRole={requiredRole} requireRitaAgentAccess={requireRitaAgentAccess}>
    <StableLayout>{children}</StableLayout>
  </ProtectedRoute>
);

// ═══════════════════════════════════════════════════════════════
// TRACKING
// ═══════════════════════════════════════════════════════════════

const PageViewTracker = () => {
  const location = useLocation();
  usePosthogPageViews();

  React.useEffect(() => {
    // Lazy-import analytics — keeps axios/ecommApi out of the critical bundle
    import('./services/analytics.js').then(m => m.trackPageView(location.pathname)).catch(() => {});

    // Also track with our custom analytics service
    import('../utils/analytics.js').then(m => {
      const analytics = m.default;
      analytics.trackPageView(location.pathname, {
        title: document.title,
        referrer: document.referrer
      });
    }).catch(() => {
      // Ignore import errors for analytics - non-critical
    });
  }, [location.pathname]);

  return null;
};

/**
 * StoreApp — Rendered when accessing via subdomain (e.g., koumen.scalor.net).
 * Only loads public store routes. No SaaS dashboard, no auth required.
 */
const StoreApp = () => {
  const { subdomain, loading } = useSubdomain();

  React.useEffect(() => {
    preloadStoreRoutesOnIdle();
  }, []);

  // Show loader while resolving custom domain
  if (loading) {
    return <PageLoader storeMode />;
  }

  return (
    <ThemeProvider subdomain={subdomain}>
      <div className="min-h-screen">
        <Suspense fallback={<PageLoader storeMode />}>
          <Routes>
            <Route path="/" element={<PublicStorefront />} />
            <Route path="/products" element={<StoreAllProducts />} />
            <Route path="/product/:slug" element={<StoreProductPage />} />
            <Route path="/legal/:pageType" element={<StoreLegalPage />} />
            <Route path="/checkout" element={<StoreCheckout />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>
    </ThemeProvider>
  );
};

// ═══════════════════════════════════════════════════════════════
// APP PRINCIPAL
// ═══════════════════════════════════════════════════════════════

const EcomApp = () => {
  const { isStoreDomain, loading } = useSubdomain();

  if (loading) {
    return <PageLoader storeMode />;
  }

  if (isStoreDomain) {
    return <StoreApp />;
  }

  return (
    <CurrencyProvider>
      <ThemeProvider>
        <div className="min-h-screen">
          <PageViewTracker />
          <PlatformPageMeta enabled={!isStoreDomain} />

          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Routes racines */}
              <Route path="/" element={<RootRedirect />} />
              <Route path="/ecom" element={<RootRedirect />} />

              {/* Routes publiques */}
              <Route path="/ecom/landing" element={<EcomLandingPage />} />
              <Route path="/provider" element={<ProviderService />} />
              <Route path="/ecom/provider" element={<ProviderService />} />
              <Route path="/ecom/why-scalor" element={<WhyScalor />} />
              <Route path="/ecom/tarifs" element={<Tarifs />} />
              <Route path="/ecom/privacy" element={<PrivacyPolicy />} />
              <Route path="/ecom/terms" element={<TermsOfService />} />
              <Route path="/ecom/login" element={<Login />} />
              <Route path="/ecom/register" element={<Register />} />
              <Route path="/ecom/forgot-password" element={<ForgotPassword />} />
              <Route path="/ecom/reset-password" element={<ResetPassword />} />
              <Route path="/ecom/setup-admin" element={<SetupSuperAdmin />} />
              <Route path="/ecom/invite/:token" element={<InviteAccept />} />
              <Route path="/ecom/workspace-setup" element={<WorkspaceSetup />} />

              {/* Routes protégées avec layout */}
              <Route path="/ecom/dashboard" element={<DashboardRedirect />} />
              <Route path="/ecom/dashboard/admin" element={<LayoutRoute requiredRole="ecom_admin"><AdminDashboard /></LayoutRoute>} />
              <Route path="/ecom/dashboard/closeuse" element={<LayoutRoute requiredRole="ecom_closeuse"><CloseuseDashboard /></LayoutRoute>} />
              <Route path="/ecom/commissions" element={<LayoutRoute requiredRole="ecom_closeuse"><Commissions /></LayoutRoute>} />
              <Route path="/ecom/dashboard/compta" element={<LayoutRoute requiredRole="ecom_compta"><ComptaDashboard /></LayoutRoute>} />

              {/* Routes produits */}
              <Route path="/ecom/products" element={<LayoutRoute requiredRole="ecom_admin"><ProductsList /></LayoutRoute>} />
              <Route path="/ecom/products/new" element={<LayoutRoute requiredRole="ecom_admin"><ProductForm /></LayoutRoute>} />
              <Route path="/ecom/products/:id" element={<LayoutRoute><ProductDetail /></LayoutRoute>} />
              <Route path="/ecom/products/:id/edit" element={<LayoutRoute requiredRole="ecom_admin"><ProductForm /></LayoutRoute>} />

              {/* Routes commandes */}
              <Route path="/ecom/orders" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><OrdersList /></LayoutRoute>} />
              <Route path="/ecom/orders/:id" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><OrderDetail /></LayoutRoute>} />
              <Route path="/ecom/import" element={<LayoutRoute requiredRole="ecom_admin"><ImportOrders /></LayoutRoute>} />

              {/* Routes clients */}
              <Route path="/ecom/clients" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><ClientsList /></LayoutRoute>} />
              <Route path="/ecom/clients/new" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><ClientForm /></LayoutRoute>} />
              <Route path="/ecom/clients/:id/edit" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><ClientForm /></LayoutRoute>} />

              {/* Routes rapports */}
              <Route path="/ecom/reports" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><ReportsList /></LayoutRoute>} />
              <Route path="/ecom/reports/new" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><ReportForm /></LayoutRoute>} />
              <Route path="/ecom/reports/insights" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><ReportsInsightsPage /></LayoutRoute>} />
              <Route path="/ecom/reports/product/:productId" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><ProductReportDetail /></LayoutRoute>} />
              <Route path="/ecom/reports/:id" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><ReportDetail /></LayoutRoute>} />
              <Route path="/ecom/reports/:id/edit" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><ReportForm /></LayoutRoute>} />

              {/* Routes sourcing */}
              <Route path="/ecom/sourcing" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_compta']}><SourcingList /></LayoutRoute>} />
              <Route path="/ecom/sourcing/stats" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_compta']}><SourcingStats /></LayoutRoute>} />
              <Route path="/ecom/sourcing/:id" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_compta']}><SupplierDetail /></LayoutRoute>} />

              {/* Routes stock */}
              <Route path="/ecom/stock" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><StockOrdersList /></LayoutRoute>} />
              <Route path="/ecom/stock/orders" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><StockOrdersList /></LayoutRoute>} />
              <Route path="/ecom/stock/orders/new" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><StockOrdersList /></LayoutRoute>} />
              <Route path="/ecom/stock/orders/:id" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><StockOrdersList /></LayoutRoute>} />
              <Route path="/ecom/stock-locations" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><StockManagement /></LayoutRoute>} />

              {/* Routes transactions */}
              <Route path="/ecom/transactions" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_compta']}><TransactionsList /></LayoutRoute>} />
              <Route path="/ecom/transactions/new" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_compta']}><TransactionForm /></LayoutRoute>} />
              <Route path="/ecom/transactions/:id" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_compta']}><TransactionDetail /></LayoutRoute>} />

              {/* Routes campagnes */}
              <Route path="/ecom/campaigns" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><CampaignsList /></LayoutRoute>} />
              <Route path="/ecom/campaigns/new" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><CampaignForm /></LayoutRoute>} />
              <Route path="/ecom/campaigns/:id" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><CampaignDetail /></LayoutRoute>} />
              <Route path="/ecom/campaigns/:id/edit" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><CampaignForm /></LayoutRoute>} />

              {/* Routes stats */}
              <Route path="/ecom/stats" element={<LayoutRoute requiredRole="ecom_admin"><StatsPage /></LayoutRoute>} />

              {/* Routes WhatsApp */}
              <Route path="/ecom/whatsapp-postulation" element={<LayoutRoute><WhatsAppPostulation /></LayoutRoute>} />
              <Route path="/ecom/whatsapp/service" element={<LayoutRoute><WhatsAppService /></LayoutRoute>} />
              <Route path="/ecom/whatsapp/connexion" element={<Navigate to="/ecom/whatsapp/service" replace />} />
              <Route path="/ecom/whatsapp/instances" element={<LayoutRoute><WhatsAppInstancesList /></LayoutRoute>} />

              {/* Routes Intégrations */}
              <Route path="/ecom/integrations/shopify" element={<LayoutRoute requiredRole="ecom_admin"><ConnectShopify /></LayoutRoute>} />

              {/* Routes Billing / Abonnement */}
              <Route path="/ecom/billing" element={<BillingPage />} />
              <Route path="/ecom/billing/success" element={<BillingSuccess />} />

              {/* Routes affectations */}
              <Route path="/ecom/assignments" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><AssignmentsManager /></LayoutRoute>} />

              {/* Routes utilisateurs */}
              <Route path="/ecom/users" element={<LayoutRoute requiredRole="ecom_admin"><UserManagement /></LayoutRoute>} />
              <Route path="/ecom/users/team/performance" element={<LayoutRoute requiredRole="ecom_admin"><TeamPerformance /></LayoutRoute>} />
              <Route path="/ecom/profile" element={<LayoutRoute><Profile /></LayoutRoute>} />
              <Route path="/ecom/settings" element={<LayoutRoute><Settings /></LayoutRoute>} />

              {/* Routes Data, Objectifs, Recherche Produits et Fournisseurs */}
              <Route path="/ecom/data" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_compta', 'super_admin']}><Data /></LayoutRoute>} />
              <Route path="/ecom/goals" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse', 'ecom_compta']}><Goals /></LayoutRoute>} />
              <Route path="/ecom/product-research" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse', 'ecom_compta']}><ProductResearchList /></LayoutRoute>} />
              <Route path="/ecom/suppliers" element={<LayoutRoute requiredRole="ecom_admin"><SuppliersList /></LayoutRoute>} />
              <Route path="/ecom/product-finder" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><ProductFinder /></LayoutRoute>} />
              <Route path="/ecom/product-finder/:id/edit" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><ProductFinderEdit /></LayoutRoute>} />
              <Route path="/ecom/stats-rapports" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse', 'ecom_compta']}><StatsRapports /></LayoutRoute>} />

              {/* Routes chat */}
              <Route path="/ecom/chat" element={<LayoutRoute><TeamChat /></LayoutRoute>} />

              {/* Route marketing */}
              <Route path="/ecom/marketing" element={<LayoutRoute requiredRole="super_admin"><Marketing /></LayoutRoute>} />

              {/* Routes Super Admin */}
              <Route path="/ecom/super-admin" element={<LayoutRoute requiredRole="super_admin"><SuperAdminDashboard /></LayoutRoute>} />
              <Route path="/ecom/super-admin/users" element={<LayoutRoute requiredRole="super_admin"><SuperAdminUsers /></LayoutRoute>} />
              <Route path="/ecom/super-admin/users/:id" element={<LayoutRoute requiredRole="super_admin"><SuperAdminUserDetail /></LayoutRoute>} />
              <Route path="/ecom/super-admin/workspaces" element={<LayoutRoute requiredRole="super_admin"><SuperAdminWorkspaces /></LayoutRoute>} />
              <Route path="/ecom/super-admin/analytics" element={<LayoutRoute requiredRole="super_admin"><SuperAdminAnalytics /></LayoutRoute>} />
              <Route path="/ecom/super-admin/activity" element={<LayoutRoute requiredRole="super_admin"><SuperAdminActivity /></LayoutRoute>} />
              <Route path="/ecom/super-admin/settings" element={<LayoutRoute requiredRole="super_admin"><SuperAdminSettings /></LayoutRoute>} />
              <Route path="/ecom/super-admin/whatsapp-postulations" element={<LayoutRoute requiredRole="super_admin"><SuperAdminWhatsAppPostulations /></LayoutRoute>} />
              <Route path="/ecom/super-admin/whatsapp-logs" element={<LayoutRoute requiredRole="super_admin"><SuperAdminWhatsAppLogs /></LayoutRoute>} />
              <Route path="/ecom/super-admin/push" element={<LayoutRoute requiredRole="super_admin"><SuperAdminPushCenter /></LayoutRoute>} />
              <Route path="/ecom/super-admin/support" element={<LayoutRoute requiredRole="super_admin"><SuperAdminSupport /></LayoutRoute>} />
              <Route path="/ecom/super-admin/billing" element={<LayoutRoute requiredRole="super_admin"><SuperAdminBilling /></LayoutRoute>} />
              <Route path="/ecom/super-admin/feature-analytics" element={<LayoutRoute requiredRole="super_admin"><SuperAdminFeatureAnalytics /></LayoutRoute>} />

              {/* Routes boutique - StoreProvider persists across wizard + layout navigations */}
              <Route element={<StoreProvider />}>
                <Route path="/ecom/boutique/wizard" element={<ProtectedRoute requiredRole="ecom_admin"><StoreCreationWizard /></ProtectedRoute>} />
                <Route path="/ecom/boutique/nouvelle" element={<ProtectedRoute requiredRole="ecom_admin"><StoreCreationWizard /></ProtectedRoute>} />
                {/* Builder — full screen, outside BoutiqueLayout */}
                <Route path="/ecom/boutique/products/generator" element={<ProtectedRoute requiredRole="ecom_admin"><ProductPageGeneratorWizard /></ProtectedRoute>} />
                <Route path="/ecom/boutique/products/:id/builder" element={<ProtectedRoute requiredRole="ecom_admin"><ProductPageBuilder /></ProtectedRoute>} />
                <Route element={<ProtectedRoute requiredRole="ecom_admin"><BoutiqueLayout /></ProtectedRoute>}>
                  <Route path="/ecom/boutique" element={<StoreDashboard />} />
                  <Route path="/ecom/boutique/analytics" element={<StoreDashboard />} />
                  <Route path="/ecom/boutique/products" element={<StoreProductsList />} />
                  <Route path="/ecom/boutique/products/categories" element={<StoreProductsList />} />
                  <Route path="/ecom/boutique/products/stock" element={<StoreProductsList />} />
                  <Route path="/ecom/boutique/products/new" element={<StoreProductForm />} />
                  <Route path="/ecom/boutique/products/:id/edit" element={<StoreProductForm />} />
                  <Route path="/ecom/boutique/orders" element={<StoreOrdersDashboard />} />
                  <Route path="/ecom/boutique/old-analytics" element={<StoreAnalytics />} />
                  <Route path="/ecom/boutique/analyses" element={<StoreAnalytics />} />
                  <Route path="/ecom/boutique/pages" element={<BoutiquePages />} />
                  <Route path="/ecom/boutique/pixel" element={<BoutiquePixel />} />
                  <Route path="/ecom/boutique/payments" element={<BoutiquePayments />} />
                  <Route path="/ecom/boutique/domains" element={<BoutiqueDomains />} />
                  <Route path="/ecom/boutique/delivery-zones" element={<BoutiqueDeliveryZones />} />
                  <Route path="/ecom/boutique/settings" element={<BoutiqueSettings />} />
                  <Route path="/ecom/boutique/product-settings" element={<ProductSettingsPage />} />
                  <Route path="/ecom/boutique/theme" element={<ProductThemePage />} />
                  <Route path="/ecom/boutique/form-builder" element={<BoutiqueFormBuilder />} />
                  <Route path="/ecom/boutique/form-builder/quantity-offers" element={<FormQuantityOffersPage />} />
                  <Route path="/ecom/boutique/form-builder/quantity-offers/wizard/:id" element={<FormQuantityOffersWizard />} />
                  <Route path="/ecom/boutique/form-builder/upsells" element={<FormUpsellsPage />} />
                  <Route path="/ecom/boutique/form-builder/integrations" element={<FormIntegrationsPage />} />
                  <Route path="/ecom/boutique/form-builder/analytics" element={<FormAnalyticsPage />} />
                  <Route path="/ecom/boutique/form-builder/settings" element={<FormSettingsPage />} />
                  <Route path="/ecom/boutique/form-builder/plan" element={<FormPlanPage />} />
                </Route>
              </Route>

              {/* Routes Developer & Rita - Accessibles à tous */}
              <Route path="/ecom/developer" element={<LayoutRoute><DeveloperSection /></LayoutRoute>} />
              <Route path="/ecom/agent-ia" element={<LayoutRoute><AgentIAList /></LayoutRoute>} />
              <Route path="/ecom/agent-onboarding" element={<LayoutRoute><AgentOnboarding /></LayoutRoute>} />
              <Route path="/ecom/rita-flows" element={<LayoutRoute><RitaFlows /></LayoutRoute>} />
              <Route path="/ecom/whatsapp/agent-config" element={<LayoutRoute><AgentConfig /></LayoutRoute>} />
              <Route path="/ecom/whatsapp/conversations/:agentId" element={<LayoutRoute><RitaConversations /></LayoutRoute>} />
              <Route path="/ecom/whatsapp/conversations" element={<LayoutRoute><RitaConversations /></LayoutRoute>} />

              {/* Routes Livreur */}
              <Route path="/ecom/livreur" element={<LayoutRoute requiredRole="ecom_livreur"><LivreurDashboard /></LayoutRoute>} />
              <Route path="/ecom/livreur/available" element={<LayoutRoute requiredRole="ecom_livreur"><LivreurAvailable /></LayoutRoute>} />
              <Route path="/ecom/livreur/deliveries" element={<LayoutRoute requiredRole="ecom_livreur"><LivreurDeliveries /></LayoutRoute>} />
              <Route path="/ecom/livreur/delivery/:id" element={<LayoutRoute requiredRole="ecom_livreur"><LivreurDeliveryDetail /></LayoutRoute>} />
              <Route path="/ecom/livreur/history" element={<LayoutRoute requiredRole="ecom_livreur"><LivreurHistoryPage /></LayoutRoute>} />
              <Route path="/ecom/livreur/earnings" element={<LayoutRoute requiredRole="ecom_livreur"><LivreurEarningsPage /></LayoutRoute>} />
              <Route path="/ecom/livreur/revenus" element={<LayoutRoute requiredRole="ecom_livreur"><LivreurEarningsPage /></LayoutRoute>} />
              <Route path="/ecom/livreur-management" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><LivreurManagement /></LayoutRoute>} />

              {/* Scalor standalone routes → redirigées vers la section Développeur intégrée */}
              <Route path="/scalor/login" element={<Navigate to="/ecom/developer" replace />} />
              <Route path="/scalor/register" element={<Navigate to="/ecom/developer" replace />} />
              <Route path="/scalor/dashboard" element={<Navigate to="/ecom/developer" replace />} />

              {/* Public Store Routes (no auth, for iframe previews & dev) */}
              <Route path="/store/:subdomain" element={<Suspense fallback={<PageLoader storeMode />}><PublicStorefront /></Suspense>} />
              <Route path="/store/:subdomain/products" element={<Suspense fallback={<PageLoader storeMode />}><StoreAllProducts /></Suspense>} />
              <Route path="/store/:subdomain/product/:slug" element={<Suspense fallback={<PageLoader storeMode />}><StoreProductPage /></Suspense>} />
              <Route path="/store/:subdomain/legal/:pageType" element={<Suspense fallback={<PageLoader storeMode />}><StoreLegalPage /></Suspense>} />
              <Route path="/store/:subdomain/checkout" element={<Suspense fallback={<PageLoader storeMode />}><StoreCheckout /></Suspense>} />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to="/ecom/login" replace />} />
            </Routes>
          </Suspense>

          <PrivacyBanner />
        </div>
      </ThemeProvider>
    </CurrencyProvider>
  );
};

// Wrapper avec AuthProvider
const EcomAppWithAuth = () => (
  <EcomAuthProvider>
    <EcomApp />
  </EcomAuthProvider>
);

export default EcomAppWithAuth;
