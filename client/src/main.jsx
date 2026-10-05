import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { NotificationProvider } from './context/NotificationContext.jsx';
import './index.css';
import './theme.css';
import './coupon.css';

// Global capture for beforeinstallprompt (must run before React mounts)
window.__nearCartDeferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  window.__nearCartDeferredInstallPrompt = event;
});

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

if (!googleClientId) {
  console.warn('[NearCart] VITE_GOOGLE_CLIENT_ID is not set. Google Sign-In will not work.');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <GoogleOAuthProvider clientId={googleClientId}>
        <AuthProvider>
          <NotificationProvider>
            <App />
          </NotificationProvider>
        </AuthProvider>
      </GoogleOAuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('NearCart Service Worker registered:', registration.scope);
        // Force update check to ensure users get the latest sw.js immediately
        registration.update().catch(() => {});
      })
      .catch((error) => {
        console.error('NearCart Service Worker registration failed:', error);
      });
  });
}
