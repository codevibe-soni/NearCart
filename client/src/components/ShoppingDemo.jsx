import React, { useEffect, useState } from 'react';
import { ShoppingBag, CheckCircle2, Store } from 'lucide-react';

// Simple mock data for demonstration (no real API calls)
const mockShops = [
  { id: 1, name: 'Campus Mart', icon: <Store size={20} /> },
  { id: 2, name: 'FoodStop', icon: <Store size={20} /> },
];

const mockProducts = [
  { id: 1, title: 'Coffee', price: '₹30' },
  { id: 2, title: 'Notebook', price: '₹50' },
];

export default function ShoppingDemo() {
  const [cartCount, setCartCount] = useState(0);

  // timing checkpoints (ms) for each stage within a loop
  const checkpoints = [800, 2000, 3200, 4400]; // when each step becomes visible
  const totalCycle = checkpoints[checkpoints.length - 1] + 800; // extra pause before repeat

  const [step, setStep] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const start = Date.now();
    const tick = () => {
      const elapsed = (Date.now() - start) % totalCycle;
      const newStep = checkpoints.findIndex(t => elapsed < t) + 1; // 1‑4, 0 before first
      setStep(newStep);
    };
    tick();
    const intervalId = setInterval(tick, 200);
    return () => clearInterval(intervalId);
  }, []);

  // Update cart count when entering step 3
  useEffect(() => {
    if (step === 3) {
      setCartCount(c => c + 1);
    }
    if (step === 0) {
      setCartCount(0);
    }
  }, [step]);

  // Randomly highlight a product during the product stage
  const highlightedIdx = step === 2 ? Math.floor(Math.random() * mockProducts.length) : -1;

  return (
    <div className="shopping-demo" aria-label="shopping demo animation">
      {/* Step 1 – shop cards */}
      {step >= 1 && (
        <div className="demo-section shops-section">
          {mockShops.map((shop) => (
            <div key={shop.id} className="demo-shop-card">
              {shop.icon}
              <span>{shop.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Step 2 – product cards with subtle highlight */}
      {step >= 2 && (
        <div className="demo-section products-section">
          {mockProducts.map((p, idx) => (
            <div
              key={p.id}
              className="demo-product-card"
              style={idx === highlightedIdx ? { boxShadow: '0 0 12px var(--primary)', transform: 'scale(1.04)' } : {}}
            >
              <span>{p.title}</span>
              <span className="price">{p.price}</span>
            </div>
          ))}
        </div>
      )}

      {/* Step 3 – cart badge increments */}
      {step >= 3 && (
        <div className="demo-section cart-section">
          <div className="cart-icon"><ShoppingBag size={24} className="cart-bag" /></div>
          <div className="cart-badge" aria-live="polite">{cartCount}</div>
        </div>
      )}

      {/* Step 4 – checkout confirmation */}
      {step >= 4 && (
        <div className="demo-section checkout-section">
          <CheckCircle2 size={28} className="check-icon" />
          <span className="checkout-text">Order Placed!</span>
        </div>
      )}
    </div>
  );
}
