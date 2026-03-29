import React from 'react';
import { Routes, Route, Navigate, useLocation, matchPath } from 'react-router-dom';
import { EcomAuthProvider } from './hooks/useEcomAuth.jsx';
import { CurrencyProvider } from './contexts/CurrencyContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { useEcomAuth } from './hooks/useEcomAuth.jsx';
import { trackPageView } from './services/analytics.js';
import { usePosthogPageViews } from './hooks/usePosthogPageViews.js';
import { useSubdomain } from './hooks/useSubdomain.js';
import { setDocumentMeta } from './utils/pageMeta.js';

// Layout principal
import EcomLayout from './components/EcomLayout.jsx';
import PrivacyBanner from './components/PrivacyBanner.jsx';

// Pages - Imports directs (pas de lazy loading)
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ProductsList from './pages/ProductsList.jsx';
import ProductForm from './pages/ProductForm.jsx';
import OrdersList from './pages/OrdersList.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import ClientsList from './pages/ClientsList.jsx';
import ClientForm from './pages/ClientForm.jsx';
import ReportsList from './pages/ReportsList.jsx';
import ReportForm from './pages/ReportForm.jsx';
import Profile from './pages/Profile.jsx';
import Settings from './pages/Settings.jsx';
import CampaignsList from './pages/CampaignsList.jsx';
import CampaignForm from './pages/CampaignForm.jsx';
import CampaignDetail from './pages/CampaignDetail.jsx';
import EcomLandingPage from './pages/LandingPage.jsx';
import SourcingList from './pages/SourcingList.jsx';
import SupplierDetail from './pages/SupplierDetail.jsx';
import ImportOrders from './pages/ImportOrders.jsx';
import StatsPage from './pages/StatsPage.jsx';
import StockOrdersList from './pages/StockOrdersList.jsx';
import StockManagement from './pages/StockManagement.jsx';
import TransactionsList from './pages/TransactionsList.jsx';
import TeamChat from './pages/TeamChat.jsx';

import CloseuseDashboard from './pages/CloseuseDashboard.jsx';
import ComptaDashboard from './pages/ComptaDashboard.jsx';
import ReportsInsightsPage from './pages/ReportsInsightsPage.jsx';
import ReportDetail from './pages/ReportDetail.jsx';
import ProductReportDetail from './pages/ProductReportDetail.jsx';
import StockOrderForm from './pages/StockOrderForm.jsx';
import DecisionsList from './pages/DecisionsList.jsx';
import DecisionForm from './pages/DecisionForm.jsx';
import TransactionForm from './pages/TransactionForm.jsx';
import TransactionDetail from './pages/TransactionDetail.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import UserManagement from './pages/UserManagement.jsx';
import CampaignStats from './pages/CampaignStats.jsx';
import TeamPerformance from './pages/TeamPerformance.jsx';
import WhatsAppPostulation from './pages/WhatsAppPostulation.jsx';
import WhatsAppEnSavoirPlus from './pages/WhatsAppEnSavoirPlus.jsx';
import AssignmentsManager from './pages/AssignmentsManager.jsx';
import CloseuseProduits from './pages/CloseuseProduits.jsx';
import SuperAdminDashboard from './pages/SuperAdminDashboard.jsx';
import SuperAdminUsers from './pages/SuperAdminUsers.jsx';
import SuperAdminUserDetail from './pages/SuperAdminUserDetail.jsx';
import SuperAdminWorkspaces from './pages/SuperAdminWorkspaces.jsx';
import SuperAdminActivity from './pages/SuperAdminActivity.jsx';
import SuperAdminSettings from './pages/SuperAdminSettings.jsx';
import SetupSuperAdmin from './pages/SetupSuperAdmin.jsx';
import Data from './pages/Data.jsx';
import Goals from './pages/Goals.jsx';
import LivreurDashboard from './pages/LivreurDashboard.jsx';
import LivreurAvailable from './pages/LivreurAvailable.jsx';
import LivreurDeliveries from './pages/LivreurDeliveries.jsx';
import LivreurDeliveryDetail from './pages/LivreurDeliveryDetail.jsx';
import LivreurHistoryPage from './pages/LivreurHistoryPage.jsx';
import LivreurEarningsPage from './pages/LivreurEarningsPage.jsx';
import LivreurManagement from './pages/LivreurManagement.jsx';
import ProductResearchList from './pages/ProductResearchList.jsx';
import ProductFinder from './pages/ProductFinder.jsx';
import ProductFinderEdit from './pages/ProductFinderEdit.jsx';
import StatsRapports from './pages/StatsRapports.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import WorkspaceSetup from './pages/WorkspaceSetup.jsx';
import InviteAccept from './pages/InviteAccept.jsx';
import PrivacyPolicy from './pages/PrivacyPolicy.jsx';
import TermsOfService from './pages/TermsOfService.jsx';
import SecurityDashboard from './pages/SecurityDashboard.jsx';
import Commissions from './pages/Commissions.jsx';
import SuppliersList from './pages/SuppliersList.jsx';
import SuperAdminAnalytics from './pages/SuperAdminAnalytics.jsx';
import Marketing from './pages/Marketing.jsx';
import SuperAdminWhatsAppPostulations from './pages/SuperAdminWhatsAppPostulations.jsx';
import SuperAdminWhatsAppLogs from './pages/SuperAdminWhatsAppLogs.jsx';
import SuperAdminPushCenter from './pages/SuperAdminPushCenter.jsx';
import SuperAdminSupport from './pages/SuperAdminSupport.jsx';
import SuperAdminBilling from './pages/SuperAdminBilling.jsx';
import WhyScalor from './pages/WhyScalor.jsx';
import Tarifs from './pages/Tarifs.jsx';
import SourcingStats from './pages/SourcingStats.jsx';
import WhatsAppService from './pages/WhatsAppService.jsx';
import DeveloperSection from './pages/DeveloperSection.jsx';
import WhatsAppInstancesList from './pages/WhatsAppInstancesList.jsx';
import RitaFlows from './pages/RitaFlows.jsx';
import AgentConfig from './pages/AgentConfig.jsx';
import AgentIAList from './pages/AgentIAList.jsx';
import RitaConversations from './pages/RitaConversations.jsx';
import AgentOnboarding from './pages/AgentOnboarding.jsx';
import ConnectShopify from './pages/ConnectShopify.jsx';
import BillingPage from './pages/BillingPage.jsx';
import BillingSuccess from './pages/BillingSuccess.jsx';
import ProviderService from './pages/ProviderService.jsx';

// Store pages
import StoreSetup from './pages/StoreSetup.jsx';
import StoreProductsList from './pages/StoreProductsList.jsx';
import StoreProductForm from './pages/StoreProductForm.jsx';
import StoreAnalytics from './pages/StoreAnalytics.jsx';
import StoreOrdersDashboard from './pages/StoreOrdersDashboard.jsx';
import PublicStorefront, { StoreAllProducts } from './pages/PublicStorefront.jsx';
import StoreProductPage from './pages/StoreProductPage.jsx';
import StoreCheckout from './pages/StoreCheckout.jsx';
import StoreFront from './pages/StoreFront.jsx';

// Boutique
import BoutiqueLayout from './components/BoutiqueLayout.jsx';
import BoutiqueDashboard from './pages/BoutiqueDashboard.jsx';
import BoutiquePixel from './pages/BoutiquePixel.jsx';
import BoutiquePayments from './pages/BoutiquePayments.jsx';
import BoutiqueDomains from './pages/BoutiqueDomains.jsx';
import BoutiqueSettings from './pages/BoutiqueSettings.jsx';
import BoutiqueDeliveryZones from './pages/BoutiqueDeliveryZones.jsx';
import StoreCreationWizard from './pages/StoreCreationWizard.jsx';

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
  { path: '/ecom/super-admin/activity', title: 'Activité super admin' },
  { path: '/ecom/super-admin/settings', title: 'Paramètres super admin' },
  { path: '/ecom/super-admin/whatsapp-postulations', title: 'Postulations WhatsApp' },
  { path: '/ecom/super-admin/whatsapp-logs', title: 'Logs WhatsApp' },
  { path: '/ecom/super-admin/push', title: 'Push Center' },
  { path: '/ecom/super-admin/support', title: 'Support super admin' },
  { path: '/ecom/super-admin/billing', title: 'Facturation super admin' },
  { path: '/ecom/super-admin', title: 'Dashboard super admin' },
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
        'ecom_livreur': '/ecom/livreur',
        'livreur': '/ecom/livreur'
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

const LayoutRoute = ({ children, requiredRole, requireRitaAgentAccess = false }) => (
  <ProtectedRoute requiredRole={requiredRole} requireRitaAgentAccess={requireRitaAgentAccess}>
    <EcomLayout>
      {children}
    </EcomLayout>
  </ProtectedRoute>
);

// ═══════════════════════════════════════════════════════════════
// TRACKING
// ═══════════════════════════════════════════════════════════════

const PageViewTracker = () => {
  const location = useLocation();
  usePosthogPageViews();

  React.useEffect(() => {
    trackPageView(location.pathname);

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
  const { subdomain } = useSubdomain();
  
  return (
    <ThemeProvider subdomain={subdomain}>
      <div className="min-h-screen">
        <Routes>
          <Route path="/" element={<PublicStorefront />} />
          <Route path="/products" element={<StoreAllProducts />} />
          <Route path="/product/:slug" element={<StoreProductPage />} />
          <Route path="/checkout" element={<StoreCheckout />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </ThemeProvider>
  );
};

// ═══════════════════════════════════════════════════════════════
// APP PRINCIPAL
// ═══════════════════════════════════════════════════════════════

const EcomApp = () => {
  const { isStoreDomain } = useSubdomain();

  if (isStoreDomain) {
    return <StoreApp />;
  }

  return (
    <CurrencyProvider>
      <ThemeProvider>
        <div className="min-h-screen bg-gray-50">
          <PageViewTracker />
          <PlatformPageMeta enabled={!isStoreDomain} />
          
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
            <Route path="/ecom/billing" element={<LayoutRoute requiredRole="ecom_admin"><BillingPage /></LayoutRoute>} />
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

            {/* Routes boutique - Utilise sa propre sidebar via BoutiqueLayout */}
            <Route path="/ecom/boutique/wizard" element={<ProtectedRoute requiredRole="ecom_admin"><StoreCreationWizard /></ProtectedRoute>} />
            <Route element={<ProtectedRoute requiredRole="ecom_admin"><BoutiqueLayout /></ProtectedRoute>}>
              <Route path="/ecom/boutique" element={<BoutiqueDashboard />} />
              <Route path="/ecom/boutique/products" element={<StoreProductsList />} />
              <Route path="/ecom/boutique/products/new" element={<StoreProductForm />} />
              <Route path="/ecom/boutique/products/:id/edit" element={<StoreProductForm />} />
              <Route path="/ecom/boutique/orders" element={<StoreOrdersDashboard />} />
              <Route path="/ecom/boutique/pixel" element={<BoutiquePixel />} />
              <Route path="/ecom/boutique/payments" element={<BoutiquePayments />} />
              <Route path="/ecom/boutique/domains" element={<BoutiqueDomains />} />
              <Route path="/ecom/boutique/delivery-zones" element={<BoutiqueDeliveryZones />} />
              <Route path="/ecom/boutique/settings" element={<BoutiqueSettings />} />
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

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/ecom/login" replace />} />
          </Routes>
          
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
