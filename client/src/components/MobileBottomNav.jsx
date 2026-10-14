import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { House, Store, Info, ShoppingCart, CircleUserRound } from 'lucide-react';
import api from '../services/api';

export default function MobileBottomNav() {
  const { user, isAuthenticated } = useAuth();
  const [cartCount, setCartCount] = useState(0);

  // Fetch live cart item count for students
  useEffect(() => {
    if (isAuthenticated && user?.role === 'STUDENT') {
      api.get('/cart')
        .then((res) => {
          if (res && res.success && res.data && res.data.items) {
            const count = res.data.items.reduce((acc, item) => acc + (item.quantity || 1), 0);
            setCartCount(count);
          }
        })
        .catch(() => setCartCount(0));
    } else {
      setCartCount(0);
    }
  }, [isAuthenticated, user?.role]);

  return (
    <>
      <nav className="bottom-nav-bar" aria-label="NearCart Navigation">
        <div className="bottom-nav-inner">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
            title="Home"
            aria-label="Home"
          >
            <div className="bottom-nav-icon-wrapper">
              <House size={19} strokeWidth={2} className="bottom-nav-icon" />
            </div>
            <span className="bottom-nav-label">Home</span>
          </NavLink>

          <NavLink
            to="/student"
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
            title="Shop"
            aria-label="Shop"
          >
            <div className="bottom-nav-icon-wrapper">
              <Store size={19} strokeWidth={2} className="bottom-nav-icon" />
            </div>
            <span className="bottom-nav-label">Shop</span>
          </NavLink>

          <NavLink
            to="/about"
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
            title="About NearCart"
            aria-label="About NearCart"
          >
            <div className="bottom-nav-icon-wrapper">
              <Info size={19} strokeWidth={2} className="bottom-nav-icon" />
            </div>
            <span className="bottom-nav-label">About</span>
          </NavLink>

          <NavLink
            to="/cart"
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
            title="Cart"
            aria-label="Cart"
          >
            <div className="bottom-nav-icon-wrapper">
              <ShoppingCart size={19} strokeWidth={2} className="bottom-nav-icon" />
              {cartCount > 0 && (
                <span className="bottom-nav-cart-badge" aria-live="polite">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </div>
            <span className="bottom-nav-label">Cart</span>
          </NavLink>

          <NavLink
            to="/profile"
            className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
            title="Profile"
            aria-label="Profile"
          >
            <div className="bottom-nav-icon-wrapper">
              <CircleUserRound size={19} strokeWidth={2} className="bottom-nav-icon" />
            </div>
            <span className="bottom-nav-label">Profile</span>
          </NavLink>
        </div>

        <style>{`
          .bottom-nav-bar {
            .bottom-nav-bar {
  position: static;
  width: 100%;
  z-index: 1000;
  background: #0f172a;
  border-top: 1px solid rgba(13, 110, 253, 0.28);
  box-shadow: 0 -4px 24px rgba(11, 31, 77, 0.35);
  padding: 0.38rem 16px calc(0.38rem + env(safe-area-inset-bottom, 0px)) 16px;
  box-sizing: border-box;
}
            bottom: 0;
            left: 0;
            right: 0;
            width: 100%;
            z-index: 1000;
            background: #0f172a;
            border-top: 1px solid rgba(13, 110, 253, 0.28);
            box-shadow: 0 -4px 24px rgba(11, 31, 77, 0.35);
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 0.38rem 16px calc(0.38rem + env(safe-area-inset-bottom, 0px)) 16px;
            box-sizing: border-box;
            --nav-icon-size: 19px;
            --nav-badge-size: 0.95rem;
            --nav-badge-font: 0.58rem;
            --nav-badge-top: -0.34rem;
            --nav-badge-right: -0.55rem;
          }
          .bottom-nav-inner {
            display: flex;
            justify-content: space-around;
            align-items: center;
            width: 100%;
            max-width: 820px;
            gap: 0.5rem;
            box-sizing: border-box;
          }
          .bottom-nav-item {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            flex: 1 1 0%;
            min-width: 0;
            gap: 0.22rem;
            background-color: #000000;
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.16);
            border-radius: 0.75rem;
            text-decoration: none;
            padding: 0.48rem 0.5rem;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
            transition: background-color 0.22s ease, border-color 0.22s ease, transform 0.22s ease, box-shadow 0.22s ease, color 0.22s ease;
            outline: none;
            cursor: pointer;
            box-sizing: border-box;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
          }
          .bottom-nav-icon-wrapper {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
          }
          .bottom-nav-icon {
            width: var(--nav-icon-size, 19px) !important;
            height: var(--nav-icon-size, 19px) !important;
            color: #ffffff;
            flex-shrink: 0;
            transition: transform 0.22s ease, color 0.22s ease;
          }
          .bottom-nav-label {
            font-size: 0.7rem;
            font-weight: 600;
            color: #ffffff;
            line-height: 1.15;
            letter-spacing: 0.01em;
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
            transition: color 0.22s ease;
          }
          .bottom-nav-item:hover {
            background-color: #0D6EFD !important;
            border-color: #0D6EFD !important;
            transform: translateY(-2px);
            box-shadow: 0 4px 16px rgba(13, 110, 253, 0.45);
          }
          .bottom-nav-item:hover .bottom-nav-icon,
          .bottom-nav-item:hover .bottom-nav-label {
            color: #ffffff !important;
          }
          .bottom-nav-item:hover .bottom-nav-icon {
            transform: scale(1.08);
          }
          .bottom-nav-item.active {
            background-color: #0D6EFD !important;
            border-color: #0D6EFD !important;
            transform: translateY(-1px);
            box-shadow: 0 4px 16px rgba(13, 110, 253, 0.45);
          }
          .bottom-nav-item.active .bottom-nav-icon {
            color: #ffffff !important;
            transform: scale(1.05);
          }
          .bottom-nav-item.active .bottom-nav-label {
            font-weight: 700;
            color: #ffffff !important;
          }
          .bottom-nav-item:focus-visible {
            outline: 2px solid #0D6EFD;
            outline-offset: 2px;
          }
          .bottom-nav-cart-badge {
            position: absolute;
            top: var(--nav-badge-top, -0.34rem);
            right: var(--nav-badge-right, -0.55rem);
            background: #ef4444;
            color: #ffffff;
            font-size: var(--nav-badge-font, 0.58rem);
            font-weight: 800;
            border-radius: 9999px;
            padding: 0.08rem 0.28rem;
            min-width: var(--nav-badge-size, 0.95rem);
            height: var(--nav-badge-size, 0.95rem);
            display: flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
            box-shadow: 0 2px 4px rgba(239, 68, 68, 0.4);
            border: 1.5px solid #000000;
            pointer-events: none;
            transition: border-color 0.22s ease;
          }
          .bottom-nav-item.active .bottom-nav-cart-badge,
          .bottom-nav-item:hover .bottom-nav-cart-badge {
            border-color: #0D6EFD;
          }

          /* ── Mobile Breakpoints (Preserves exact existing mobile layout) ── */
          @media (max-width: 640px) {
            .bottom-nav-bar {
              padding: 0.35rem 12px calc(0.35rem + env(safe-area-inset-bottom, 0px)) 12px;
            }
            .bottom-nav-inner {
              gap: 0.38rem;
            }
            .bottom-nav-item {
              padding: 0.42rem 0.35rem;
              border-radius: 0.7rem;
            }
            .bottom-nav-label {
              font-size: 0.66rem;
            }
          }
          @media (max-width: 480px) {
            .bottom-nav-bar {
              padding: 0.32rem 8px calc(0.32rem + env(safe-area-inset-bottom, 0px)) 8px;
            }
            .bottom-nav-inner {
              gap: 0.25rem;
            }
            .bottom-nav-item {
              padding: 0.38rem 0.25rem;
              border-radius: 0.65rem;
              gap: 0.18rem;
            }
            .bottom-nav-label {
              font-size: 0.62rem;
            }
          }
          @media (max-width: 360px) {
            .bottom-nav-bar {
              padding: 0.28rem 4px calc(0.28rem + env(safe-area-inset-bottom, 0px)) 4px;
            }
            .bottom-nav-inner {
              gap: 0.18rem;
            }
            .bottom-nav-item {
              padding: 0.32rem 0.18rem;
              border-radius: 0.55rem;
              gap: 0.15rem;
            }
            .bottom-nav-label {
              font-size: 0.58rem;
            }
          }

          /* ── Tablet (768px - 1023px) ── */
          @media (min-width: 768px) {
            .bottom-nav-bar {
              padding: 0.5rem 24px calc(0.5rem + env(safe-area-inset-bottom, 0px)) 24px;
              --nav-icon-size: 21px;
              --nav-badge-size: 1.05rem;
              --nav-badge-font: 0.62rem;
              --nav-badge-top: -0.36rem;
              --nav-badge-right: -0.6rem;
            }
            .bottom-nav-inner {
              max-width: 720px;
              gap: 0.75rem;
            }
            .bottom-nav-item {
              padding: 0.55rem 0.75rem;
              border-radius: 0.85rem;
              gap: 0.28rem;
            }
            .bottom-nav-label {
              font-size: 0.78rem;
              letter-spacing: 0.015em;
            }
          }

          /* ── Small Laptop / Tablet Landscape (1024px - 1365px) ── */
          @media (min-width: 1024px) {
            .bottom-nav-bar {
              padding: 0.55rem 32px;
              --nav-icon-size: 22px;
              --nav-badge-size: 1.1rem;
              --nav-badge-font: 0.64rem;
              --nav-badge-top: -0.38rem;
              --nav-badge-right: -0.62rem;
            }
            .bottom-nav-inner {
              max-width: 820px;
              gap: 0.95rem;
            }
            .bottom-nav-item {
              padding: 0.58rem 0.95rem;
              border-radius: 0.9rem;
              gap: 0.32rem;
            }
            .bottom-nav-label {
              font-size: 0.82rem;
              letter-spacing: 0.02em;
            }
          }

          /* ── Standard Laptop (1366px - 1439px) ── */
          @media (min-width: 1366px) {
            .bottom-nav-bar {
              padding: 0.6rem 36px;
              --nav-icon-size: 23px;
              --nav-badge-size: 1.15rem;
              --nav-badge-font: 0.66rem;
              --nav-badge-top: -0.4rem;
              --nav-badge-right: -0.65rem;
            }
            .bottom-nav-inner {
              max-width: 900px;
              gap: 1.15rem;
            }
            .bottom-nav-item {
              padding: 0.62rem 1.05rem;
              border-radius: 0.95rem;
              gap: 0.35rem;
            }
            .bottom-nav-label {
              font-size: 0.85rem;
              letter-spacing: 0.02em;
            }
          }

          /* ── Desktop & Large Desktop (1440px - 1920px+) ── */
          @media (min-width: 1440px) {
            .bottom-nav-bar {
              padding: 0.65rem 40px;
              --nav-icon-size: 24px;
              --nav-badge-size: 1.2rem;
              --nav-badge-font: 0.68rem;
              --nav-badge-top: -0.42rem;
              --nav-badge-right: -0.68rem;
            }
            .bottom-nav-inner {
              max-width: 960px;
              gap: 1.35rem;
            }
            .bottom-nav-item {
              padding: 0.65rem 1.2rem;
              border-radius: 1rem;
              gap: 0.38rem;
            }
            .bottom-nav-label {
              font-size: 0.88rem;
              letter-spacing: 0.02em;
            }
          }

          @media (min-width: 1920px) {
            .bottom-nav-inner {
              max-width: 1020px;
              gap: 1.5rem;
            }
            .bottom-nav-item {
              padding: 0.7rem 1.3rem;
              border-radius: 1.05rem;
              gap: 0.4rem;
            }
            .bottom-nav-label {
              font-size: 0.9rem;
            }
          }
        `}</style>
      </nav>
    </>
  );
}
