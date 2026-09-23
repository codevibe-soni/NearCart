import React from 'react';
// Icon imports removed – using PNG logo

/**
 * NearCart Professional Logo Component
 * Design Concept: Modern location pin integrated with shopping cart / bag icon
 * @param {'small'|'medium'|'large'} size - Logo size preset
 * @param {boolean} showText - Whether to show the text portion
 * @param {string} textColor - Custom text color override (used when variant is not set)
 * @param {'light'|'dark'} variant - 'light' for white/light backgrounds (default), 'dark' for dark backgrounds
 */
export default function NearCartLogo({ size = 'medium', showText = true, textColor, variant = 'light' }) {
  const dimensions = {
    small: { iconBg: '1.75rem', iconSize: 20 },
    medium: { iconBg: '2.1rem', iconSize: 28 },
    large: { iconBg: '3.5rem', iconSize: 36 },
  }[size] || { iconBg: '2.1rem', iconSize: 28 };

  // Determine text colors based on variant
  const isDark = variant === 'dark';
  const nearColor = textColor || (isDark ? '#ffffff' : 'var(--text-primary)');
  const cartGradient = isDark
    ? 'linear-gradient(135deg, #38bdf8 0%, #a5f3fc 100%)'
    : 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)';

  return (
    <div style={{
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.15rem',
      userSelect: 'none',
      width: '100%',
      maxWidth: '160px',
      margin: '0 auto',
      textAlign: 'center'
    }}>
      <img src="/logo.png" alt="NearCart logo" style={{
        width: dimensions.iconBg,
        height: 'auto',
        objectFit: 'contain',
        maxWidth: '100%',
        flexShrink: 0
      }} />

      {showText && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            textAlign: 'center'
          }}
        >
          <div style={{
            fontSize: 'clamp(0.62rem, 2.5vw, 0.9rem)',
            fontWeight: '800',
            color: nearColor,
            letterSpacing: '-0.02em',
            fontFamily: "'Inter', sans-serif",
            lineHeight: '1.1',
            whiteSpace: 'nowrap',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.1rem'
          }}>
            <span>NearCart+</span>
            <span
              style={{
                background: cartGradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              FoodDisk
            </span>
          </div>
          <div style={{
            fontSize: 'clamp(0.5rem, 2vw, 0.65rem)',
            fontWeight: '600',
            fontStyle: 'italic',
            color: '#64748b',
            marginTop: '0.1rem',
            lineHeight: '1.1',
            whiteSpace: 'nowrap',
            width: '100%'
          }}>Food · Grocery · More</div>
        </div>
      )}
    </div>
  );
}
