import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './KarwaChauthPromo.css';

// Campaign dates in Asia/Kolkata timezone (UTC+5:30)
// Start: 2026-10-29 00:00:00+05:30
// End:   2026-10-30 00:00:00+05:30
const CAMPAIGN_START = new Date('2026-10-29T00:00:00+05:30');
const CAMPAIGN_END = new Date('2026-10-30T00:00:00+05:30');

export default function KarwaChauthPromo() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  // Determine if the campaign is active
  const isActive = () => {
    const now = new Date();
    return now >= CAMPAIGN_START && now < CAMPAIGN_END;
  };

  useEffect(() => {
    if (!isActive()) return; // campaign expired
    const dismissed = localStorage.getItem('karwaChauthPromoDismissed');
    if (!dismissed) {
      setVisible(true);
    }
  }, []);

  const handleClose = () => {
    setVisible(false);
    localStorage.setItem('karwaChauthPromoDismissed', 'true');
  };

  const handleShopNow = () => {
    // Navigate to the main shopping page. Adjust if a specific route is needed.
    navigate('/');
    handleClose();
  };

  if (!visible) return null;

  return (
    <div className="karwa-promo-overlay" role="dialog" aria-modal="true">
      <div className="karwa-promo-backdrop" onClick={handleClose} />
      <div className="karwa-promo-content" data-testid="karwa-promo">
        <button className="karwa-promo-close" onClick={handleClose} aria-label="Close promotion">
          ✕
        </button>
        <div className="karwa-promo-visuals" aria-hidden="true">
          {/* Simple decorative emojis – lightweight, no extra assets */}
          <span className="karwa-moon">🌙</span>
          <span className="karwa-diya">🪔</span>
          <span className="karwa-thali">🍽️</span>
        </div>
        <h2 className="karwa-promo-title">Happy Karwa Chauth 🌙 — Celebrate Love with Discounts up to 20%!</h2>
        <button className="karwa-promo-cta" onClick={handleShopNow}>Shop Now</button>
      </div>
    </div>
  );
}
