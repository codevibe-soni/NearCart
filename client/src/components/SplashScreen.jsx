import React, { useEffect, useState } from 'react';
import NearCartLogo from './NearCartLogo';
import './SplashScreen.css';

/**
 * SplashScreen – displayed only on the very first page load or full refresh.
 * It animates the NearCart logo (image) and then reveals the brand name
 * letter‑by‑letter. The component respects `prefers-reduced-motion` and
 * automatically hides after the animation duration.
 */
export default function SplashScreen() {
  const [showText, setShowText] = useState(false);
  const [hide, setHide] = useState(false);

  // Start text animation shortly after the logo finishes scaling.
  useEffect(() => {
    const textTimer = setTimeout(() => setShowText(true), 800); // matches logo animation
    const hideTimer = setTimeout(() => setHide(true), 2500); // total duration
    return () => {
      clearTimeout(textTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (hide) return null;

  return (
    <div className="splash-overlay" data-testid="splash-screen">
      <div className="splash-content">
        {/* Logo image – we keep the image separate so we can apply a scale animation */}
        <div className="logo-wrapper">
          <NearCartLogo size="large" showText={false} variant="light" />
        </div>
        {/* Brand name – each letter animates when `showText` becomes true */}
        {showText && (
          <div className="brand-name" aria-label="NearCart">
            {Array.from('NearCart').map((char, idx) => (
              <span key={idx} className="brand-letter" style={{ animationDelay: `${0.1 * idx}s` }}>
                {char}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
