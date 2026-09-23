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
    small: { iconBg: '1.8rem', iconSize: 14, fontSize: '1.1rem', badge: '0.7rem' },
    medium: { iconBg: '2.2rem', iconSize: 18, fontSize: '1.35rem', badge: '0.75rem' },
    large: { iconBg: '2.8rem', iconSize: 24, fontSize: '1.75rem', badge: '0.85rem' },
  }[size] || { iconBg: '2.2rem', iconSize: 18, fontSize: '1.35rem', badge: '0.75rem' };

  // Determine text colors based on variant
  const isDark = variant === 'dark';
  const nearColor = textColor || (isDark ? '#ffffff' : 'var(--text-primary)');
  const cartGradient = isDark
    ? 'linear-gradient(135deg, #38bdf8 0%, #a5f3fc 100%)'
    : 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)';

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', userSelect: 'none' }}>
      <img src="/logo.png" alt="NearCart logo" style={{ width: dimensions.iconBg, height: dimensions.iconBg }} />

      {showText && (
        <span
          style={{
            fontSize: dimensions.fontSize,
            fontWeight: '800',
            color: nearColor,
            letterSpacing: '-0.03em',
            fontFamily: "'Inter', sans-serif",
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.15rem',
            marginTop: '0.25rem',
            width: '100%',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
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
          </span>
          <span style={{
            fontSize: '0.73rem',
            fontWeight: '600',
            fontStyle: 'italic',
            color: '#64748b',
            marginTop: '0.1rem'
          }}>Food · Grocery · More</span>
        </span>
      )}
    </div>
  );
}
