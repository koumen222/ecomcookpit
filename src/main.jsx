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
if ('requestIdleCallback' in window) {
  requestIdleCallback(_initAnalytics, { timeout: 3000 });
} else {
  setTimeout(_initAnalytics, 1500);
}
