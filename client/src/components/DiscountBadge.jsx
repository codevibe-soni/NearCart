import React from 'react';
import { Percent, Zap } from 'lucide-react';

/**
 * DiscountBadge component – displays a concise discount label such as "₹50 OFF" or "20% OFF".
 * Reuses the visual styling from the existing CouponManagement discount banner.
 *
 * Props:
 *  - discountType: 'PERCENTAGE' | 'FIXED'
 *  - discountValue: number (percentage or amount)
 *  - maximumDiscount?: number (only relevant for percentage discounts)
 */
export default function DiscountBadge({ discountType, discountValue, maximumDiscount = 0 }) {
  const displayValue = discountType === 'PERCENTAGE' ? `${discountValue}% OFF` : `₹${discountValue} OFF`;
  return (
    <div className="cpn-discount-banner" style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', zIndex: 2 }}>
      <div className="cpn-discount-main">
        {discountType === 'PERCENTAGE' ? (
          <Percent style={{ width: '1.1rem', height: '1.1rem', flexShrink: 0 }} />
        ) : (
          <Zap style={{ width: '1.1rem', height: '1.1rem', flexShrink: 0 }} />
        )}
        <div>
          <p className="cpn-discount-label" style={{ margin: 0 }}>Discount</p>
          <p className="cpn-discount-value" style={{ margin: 0 }}>{displayValue}</p>
        </div>
      </div>
      {maximumDiscount > 0 && discountType === 'PERCENTAGE' && (
        <div className="cpn-discount-cap">
          <p className="cpn-discount-cap-label">Max Discount</p>
          <p className="cpn-discount-cap-val">₹{maximumDiscount}</p>
        </div>
      )}
    </div>
  );
}
