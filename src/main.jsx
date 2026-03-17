import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './ecom/App.jsx';
import './ecom/tailwind-base.css';
import './ecom/index.css';

// Render first, analytics later (non-blocking)
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

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
