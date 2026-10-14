import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

let app = null;
let messaging = null;

const isConfigValid = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

try {
  if (isConfigValid) {
    app = initializeApp(firebaseConfig);
    console.log('[FCM] Firebase initialized: PASS');
  } else {
    console.warn('⚠️ [FCM] Firebase Web config environment variables not fully set');
  }
} catch (err) {
  console.warn('⚠️ [FCM] Firebase App initialization notice:', err.message);
}

/**
 * Register FCM device token with CampusCart backend
 */
export const requestAndRegisterFCMToken = async (apiInstance) => {
  try {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      console.log('[FCM] Push notifications not supported in this browser environment');
      return null;
    }

    const supported = await isSupported().catch(() => false);
    if (!supported) {
      console.log('[FCM] Messaging supported: FAIL (Browser does not support FCM Messaging)');
      return null;
    }
    console.log('[FCM] Messaging supported: PASS');

    if (!app && isConfigValid) {
      app = initializeApp(firebaseConfig);
    }

    if (!app) {
      console.warn('⚠️ [FCM] Firebase App not initialized due to missing web config');
      return null;
    }

    if (!messaging) {
      messaging = getMessaging(app);
    }

    let permission = Notification.permission;
    console.log('[FCM] Current notification permission:', permission);

    if (permission === 'default') {
      permission = await Notification.requestPermission();
      console.log('[FCM] Requested notification permission:', permission);
    }

    if (permission !== 'granted') {
      console.warn('[FCM] Notification permission status: denied/dismissed');
      return null;
    }
    console.log('[FCM] Notification permission: GRANTED');

    // Acquire active Service Worker registration
    let swRegistration = null;
    try {
      swRegistration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('SW ready timeout')), 3000)
        ),
      ]);
      console.log('[FCM] Service worker ready: PASS (Scope:', swRegistration.scope, ')');
    } catch (swErr) {
      console.warn('[FCM] SW ready notice:', swErr.message, '- falling back to direct registration');
      swRegistration = await navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('[FCM] Direct SW registration failed:', err.message);
        return null;
      });
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined;

    const tokenOptions = {
      vapidKey,
    };
    if (swRegistration) {
      tokenOptions.serviceWorkerRegistration = swRegistration;
    }

    const token = await getToken(messaging, tokenOptions).catch((err) => {
      console.warn('⚠️ [FCM] getToken notice:', err.message);
      return null;
    });

    if (token) {
      console.log('[FCM] Token obtained: PASS');
      if (apiInstance) {
        await apiInstance.post('/notifications/device-token', {
          token,
          platform: 'web',
        }).then(() => {
          console.log('[FCM] Token registered with backend: PASS');
        }).catch((err) => {
          console.warn('⚠️ [FCM] Backend device-token registration notice:', err.message);
        });
      }
      return token;
    } else {
      console.warn('⚠️ [FCM] Token obtained: FAIL (Empty token returned)');
      return null;
    }
  } catch (error) {
    console.warn('⚠️ [FCM] Token registration error:', error.message);
    return null;
  }
};

/**
 * Foreground FCM Message Listener
 */
export const setupForegroundFCMListener = async (onForegroundMessage) => {
  try {
    const supported = await isSupported().catch(() => false);
    if (!supported || !app) return null;
    if (!messaging) messaging = getMessaging(app);

    return onMessage(messaging, (payload) => {
      console.log('🔔 [FCM] Foreground message received:', payload);
      if (typeof onForegroundMessage === 'function') {
        onForegroundMessage(payload);
      }
    });
  } catch (err) {
    console.warn('⚠️ [FCM] Foreground listener setup notice:', err.message);
    return null;
  }
};

