import React, { useEffect, useState } from 'react';
import NearCartLogo from './NearCartLogo';
import './SplashScreen.css';

export default function SplashScreen() {
  const [showText, setShowText] = useState(false);
  const [hide, setHide] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const textTimer = setTimeout(() => setShowText(true), 800);
    const hideTimer = setTimeout(() => setHide(true), 2500);
    const finishTimer = setTimeout(() => setFinished(true), 2000);
    return () => {
      clearTimeout(textTimer);
      clearTimeout(hideTimer);
      clearTimeout(finishTimer);
    };
  }, []);

  if (hide) return null;

  return (
    <div className={`splash-overlay ${finished ? 'finished' : ''}`} data-testid="splash-screen">
      <div className="splash-content">
        <div className="logo-wrapper">
          <NearCartLogo size="large" showText={false} variant="light" />
        </div>
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
