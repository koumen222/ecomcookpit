import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useEcomAuth } from '../hooks/useEcomAuth.jsx';
import LivreurLayout from './components/LivreurLayout.jsx';
import LivreurHome from './pages/LivreurHome.jsx';
import AvailableOrders from './pages/AvailableOrders.jsx';
import MyDeliveries from './pages/MyDeliveries.jsx';
import DeliveryDetail from './pages/DeliveryDetail.jsx';
import MapNavigation from './pages/MapNavigation.jsx';
import LivreurHistory from './pages/LivreurHistory.jsx';
import LivreurEarnings from './pages/LivreurEarnings.jsx';
import LivreurProfile from './pages/LivreurProfile.jsx';

export default function LivreurApp() {
  const { user, isAuthenticated } = useEcomAuth();
  const localUser = user || JSON.parse(localStorage.getItem('ecomUser') || 'null');
  const effectiveAuth = isAuthenticated || !!localStorage.getItem('ecomToken');

  if (!effectiveAuth) return <Navigate to="/ecom/login" replace />;
  if (localUser && !['ecom_livreur', 'super_admin', 'ecom_admin'].includes(localUser.role)) {
    return <Navigate to="/ecom/dashboard" replace />;
  }

  return (
    <LivreurLayout>
      <Routes>
        <Route index element={<LivreurHome />} />
        <Route path="available" element={<AvailableOrders />} />
        <Route path="deliveries" element={<MyDeliveries />} />
        <Route path="delivery/:id" element={<DeliveryDetail />} />
        <Route path="delivery/:id/map" element={<MapNavigation />} />
        <Route path="history" element={<LivreurHistory />} />
        <Route path="earnings" element={<LivreurEarnings />} />
        <Route path="profile" element={<LivreurProfile />} />
        <Route path="*" element={<Navigate to="/ecom/livreur" replace />} />
      </Routes>
    </LivreurLayout>
  );
}
