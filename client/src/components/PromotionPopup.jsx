import React from 'react';
import { X } from 'lucide-react';
import DiscountBadge from './DiscountBadge';

/**
 * PromotionPopup – shows detailed promotion info on the shop detail page.
 * Props:
 *   promotion: promotion object (must contain _id, discountType, discountValue, maximumDiscount, description, code, minimumOrderAmount, endDate)
 *   onDismiss: () => void – called when user clicks the close button.
 */
export default function PromotionPopup({ promotion, onDismiss }) {
  if (!promotion) return null;

  const { discountType, discountValue, maximumDiscount, description, code, minimumOrderAmount, endDate } = promotion;
  const expiry = new Date(endDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="cpn-modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="cpn-modal" style={{ background: '#fff', borderRadius: '0.5rem', padding: '1.5rem', maxWidth: '90%', width: '360px', position: 'relative' }}>
        <button
          onClick={onDismiss}
          aria-label="Dismiss promotion"
          style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          <X size={20} />
        </button>
        <DiscountBadge discountType={discountType} discountValue={discountValue} maximumDiscount={maximumDiscount || 0} />
        <div style={{ marginTop: '1rem' }}>
          {description && <p style={{ marginBottom: '0.5rem' }}>{description}</p>}
          <p style={{ marginBottom: '0.25rem' }}><strong>Code:</strong> {code}</p>
          {minimumOrderAmount != null && (
            <p style={{ marginBottom: '0.25rem' }}><strong>Min Order:</strong> ₹{minimumOrderAmount}</p>
          )}
          <p style={{ marginBottom: '0.25rem' }}><strong>Expires:</strong> {expiry}</p>
        </div>
      </div>
    </div>
  );
}
