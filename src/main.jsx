import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './ecom/App.jsx';
import { initAnalytics } from './ecom/services/posthog.js';
import './ecom/tailwind-base.css';
import './ecom/index.css';

// Initialize PostHog before first render (no-op if VITE_POSTHOG_KEY is missing)
initAnalytics();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
