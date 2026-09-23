import React, { useState, useEffect, useRef } from 'react';
import { Download } from 'lucide-react';
import { registerPwaInstallation } from '../utils/pwaInstallTracker';

/**
 * PwaInstallButton Component
 * Listens for standard browser 'beforeinstallprompt' event.
 * Renders a user-friendly "Install App" button in NearCart UI when installable.
 */
export default function PwaInstallButton({ style, className, variant = 'navbar' }) {
  const deferredPromptRef = useRef(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed)
    const inStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    setIsStandalone(inStandalone);

    // If already installed, nothing to do
    if (inStandalone) return;

    // Recover any globally captured beforeinstallprompt event (may have fired before component mounted)
    if (window.__nearCartDeferredInstallPrompt) {
      deferredPromptRef.current = window.__nearCartDeferredInstallPrompt;
      setIsInstallable(true);
      console.log('💡 [PWA] beforeinstallprompt event recovered from global');
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setIsInstallable(true);
      console.log('💡 [PWA] beforeinstallprompt event captured');
    };

    const handleAppInstalled = () => {
      console.log('🎉 [PWA] App installed successfully');
      setIsInstallable(false);
      deferredPromptRef.current = null;
      setIsStandalone(true);
      registerPwaInstallation();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPromptRef.current) return;
    try {
      await deferredPromptRef.current.prompt();
      const { outcome } = await deferredPromptRef.current.userChoice;
      console.log(`[PWA] User response to install prompt: ${outcome}`);
      if (outcome === 'accepted') {
        setIsInstallable(false);
        deferredPromptRef.current = null;
        registerPwaInstallation();
      }
    } catch (err) {
      console.warn('⚠️ [PWA] Install prompt error:', err);
    }
  };

  if (!isInstallable || isStandalone || !deferredPromptRef.current) {
    return null;
  }

  const isMobileVariant = variant === 'mobile';

  return (
    <button
      onClick={handleInstallClick}
      className={className || ''}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: isMobileVariant ? 'center' : 'flex-start',
        gap: '0.4rem',
        padding: isMobileVariant ? '0.65rem 1rem' : '0.45rem 0.85rem',
        fontSize: isMobileVariant ? '0.9rem' : '0.85rem',
        fontWeight: '600',
        borderRadius: '0.5rem',
        background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
        color: '#ffffff',
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
        transition: 'all 0.2s ease',
        width: isMobileVariant ? '100%' : 'auto',
        ...style,
      }}
      title="Install NearCart on your device"
    >
      <Download style={{ width: '0.95rem', height: '0.95rem' }} />
      <span>Install App</span>
    </button>
  );
}
