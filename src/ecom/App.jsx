import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { EcomAuthProvider } from './hooks/useEcomAuth.jsx';
import { CurrencyProvider } from './contexts/CurrencyContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { useEcomAuth } from './hooks/useEcomAuth.jsx';
import { trackPageView } from './services/analytics.js';
import { usePosthogPageViews } from './hooks/usePosthogPageViews.js';
import { useSubdomain } from './hooks/useSubdomain.js';

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
import WhyScalor from './pages/WhyScalor.jsx';
import Tarifs from './pages/Tarifs.jsx';
import SourcingStats from './pages/SourcingStats.jsx';
import WhatsAppConnexion from './pages/WhatsAppConnexion.jsx';
import WhatsAppInstancesList from './pages/WhatsAppInstancesList.jsx';

// Store pages
import StoreSetup from './pages/StoreSetup.jsx';
import StoreProductsList from './pages/StoreProductsList.jsx';
import StoreProductForm from './pages/StoreProductForm.jsx';
import StoreAnalytics from './pages/StoreAnalytics.jsx';
import StoreOrdersDashboard from './pages/StoreOrdersDashboard.jsx';
import PublicStorefront from './pages/PublicStorefront.jsx';
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

// ═══════════════════════════════════════════════════════════════
// PROTECTION DES ROUTES
// ═══════════════════════════════════════════════════════════════

const ProtectedRoute = ({ children, requiredRole }) => {
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

const LayoutRoute = ({ children, requiredRole }) => (
  <ProtectedRoute requiredRole={requiredRole}>
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
          <Route path="/" element={<StoreFront />} />
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
          
          <Routes>
            {/* Routes racines */}
            <Route path="/" element={<RootRedirect />} />
            <Route path="/ecom" element={<RootRedirect />} />

            {/* Routes publiques */}
            <Route path="/ecom/landing" element={<EcomLandingPage />} />
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
            <Route path="/ecom/whatsapp/connexion" element={<LayoutRoute requiredRole={['ecom_admin', 'ecom_closeuse']}><WhatsAppConnexion /></LayoutRoute>} />
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

            {/* Routes boutique - Utilise sa propre sidebar via BoutiqueLayout */}
            <Route element={<ProtectedRoute requiredRole="ecom_admin"><BoutiqueLayout /></ProtectedRoute>}>
              <Route path="/ecom/boutique" element={<BoutiqueDashboard />} />
              <Route path="/ecom/boutique/products" element={<StoreProductsList />} />
              <Route path="/ecom/boutique/products/new" element={<StoreProductForm />} />
              <Route path="/ecom/boutique/products/:id/edit" element={<StoreProductForm />} />
              <Route path="/ecom/boutique/orders" element={<StoreOrdersDashboard />} />
              <Route path="/ecom/boutique/pixel" element={<BoutiquePixel />} />
              <Route path="/ecom/boutique/payments" element={<BoutiquePayments />} />
              <Route path="/ecom/boutique/domains" element={<BoutiqueDomains />} />
              <Route path="/ecom/boutique/settings" element={<BoutiqueSettings />} />
            </Route>

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
