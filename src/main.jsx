import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './ecom/App.jsx';
import './ecom/tailwind-base.css';
import './ecom/index.css';

// Render first, analytics later (non-blocking)
try {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
} catch (err) {
  console.error('[main] Critical render error:', err);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f9fafb;font-family:Inter,sans-serif;text-align:center;padding:24px"><div><div style="font-size:48px;margin-bottom:16px">⚠️</div><h2 style="font-size:18px;font-weight:600;color:#1f2937;margin:0 0 8px">Erreur de chargement</h2><p style="font-size:14px;color:#6b7280;margin:0 0 20px">Rechargez la page pour continuer.</p><button onclick="location.reload()" style="background:#0F6B4F;color:#fff;border:none;border-radius:8px;padding:10px 24px;font-size:14px;font-weight:600;cursor:pointer">Recharger</button></div></div>';
  }
}

// Defer analytics to idle time — never blocks first paint
const _initAnalytics = () => import('./ecom/services/posthog.js').then(m => m.initAnalytics());

// Initialize our custom analytics service
const _initCustomAnalytics = () => import('./utils/analytics.js').then(m => {
  const analytics = m.default;
  analytics.trackPageView(window.location.pathname, { initial_load: true });
});

// Initialize performance monitoring
const _initPerformanceMonitoring = () => import('./ecom/services/PerformanceMonitor.js').then(m => {
  const monitor = new m.default();
  monitor.init();
});

if ('requestIdleCallback' in window) {
  requestIdleCallback(_initAnalytics, { timeout: 3000 });
  requestIdleCallback(_initCustomAnalytics, { timeout: 3500 });
  requestIdleCallback(_initPerformanceMonitoring, { timeout: 2000 });
} else {
  setTimeout(_initAnalytics, 1500);
  setTimeout(_initCustomAnalytics, 2000);
  setTimeout(_initPerformanceMonitoring, 1000);
}
