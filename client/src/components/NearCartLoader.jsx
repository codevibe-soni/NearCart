import React from 'react';
import NearCartLogo from './NearCartLogo';
import './NearCartLoader.css';

/**
 * NearCart Branded Loading / Splash Screen Component
 * Lightweight, accessible, pure CSS animated loader.
 * @param {boolean} fullScreen - Whether loader covers full viewport (default: true)
 * @param {string} message - Accessible loading message (default: "Loading NearCart")
 */
export default function NearCartLoader({ fullScreen = true, message = "Loading NearCart" }) {
  return (
    <div
      className={`nearcart-loader-container ${fullScreen ? 'nearcart-loader-fullscreen' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="nearcart-loader-content">
        {/* Animated Branded Logo */}
        <div className="nearcart-loader-logo-wrap">
          <NearCartLogo size="large" showText={false} />
        </div>

        {/* Sequential 3 Animated Dots */}
        <div className="nearcart-loader-dots" aria-hidden="true">
          <span className="nearcart-loader-dot"></span>
          <span className="nearcart-loader-dot"></span>
          <span className="nearcart-loader-dot"></span>
        </div>

        {/* Accessible Message */}
        <p className="nearcart-loader-text">{message}</p>
      </div>
    </div>
  );
}
