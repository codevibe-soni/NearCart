import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { House, Store, Info, ShoppingCart, CircleUserRound } from 'lucide-react';
import api from '../services/api';

export default function Footer() {
  const { user, isAuthenticated } = useAuth();
  const [cartCount, setCartCount] = React.useState(0);

  // Fetch live cart item count for students
  React.useEffect(() => {
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
    <nav className="footer-bar" aria-label="NearCart Navigation">
      <div className="footer-inner">
        <NavLink
          to="/"
          end
          className={({ isActive }) => `footer-item ${isActive ? 'active' : ''}`}
          title="Home"
          aria-label="Home"
        >
          <div className="footer-icon-wrapper">
            <House size={19} strokeWidth={2} className="footer-icon" />
          </div>
          <span className="footer-label">Home</span>
        </NavLink>

        <NavLink
          to="/student"
          className={({ isActive }) => `footer-item ${isActive ? 'active' : ''}`}
          title="Shop"
          aria-label="Shop"
        >
          <div className="footer-icon-wrapper">
            <Store size={19} strokeWidth={2} className="footer-icon" />
          </div>
          <span className="footer-label">Shop</span>
        </NavLink>

        <NavLink
          to="/about"
          className={({ isActive }) => `footer-item ${isActive ? 'active' : ''}`}
          title="About NearCart"
          aria-label="About NearCart"
        >
          <div className="footer-icon-wrapper">
            <Info size={19} strokeWidth={2} className="footer-icon" />
          </div>
          <span className="footer-label">About</span>
        </NavLink>

        <NavLink
          to="/cart"
          className={({ isActive }) => `footer-item ${isActive ? 'active' : ''}`}
          title="Cart"
          aria-label="Cart"
        >
          <div className="footer-icon-wrapper">
            <ShoppingCart size={19} strokeWidth={2} className="footer-icon" />
            {cartCount > 0 && (
              <span className="footer-cart-badge" aria-live="polite">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </div>
          <span className="footer-label">Cart</span>
        </NavLink>

        <NavLink
          to="/profile"
          className={({ isActive }) => `footer-item ${isActive ? 'active' : ''}`}
          title="Profile"
          aria-label="Profile"
        >
          <div className="footer-icon-wrapper">
            <CircleUserRound size={19} strokeWidth={2} className="footer-icon" />
          </div>
          <span className="footer-label">Profile</span>
        </NavLink>
      </div>
      <style>{`
        .footer-bar {
          width: 100%;
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
        .footer-inner {
          display: flex;
          justify-content: space-around;
          align-items: center;
          width: 100%;
          max-width: 820px;
          gap: 0.5rem;
          box-sizing: border-box;
        }
        .footer-item {
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
        .footer-icon-wrapper { position: relative; display: inline-flex; align-items: center; justify-content: center; color: #ffffff; }
        .footer-icon { width: var(--nav-icon-size) !important; height: var(--nav-icon-size) !important; color: #ffffff; flex-shrink: 0; transition: transform 0.22s ease, color 0.22s ease; }
        .footer-label { font-size: 0.7rem; font-weight: 600; color: #ffffff; line-height: 1.15; letter-spacing: 0.01em; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; transition: color 0.22s ease; }
        .footer-item:hover { background-color: #0D6EFD !important; border-color: #0D6EFD !important; transform: translateY(-2px); box-shadow: 0 4px 16px rgba(13, 110, 253, 0.45); }
        .footer-item:hover .footer-icon, .footer-item:hover .footer-label { color: #ffffff !important; }
        .footer-item:hover .footer-icon { transform: scale(1.08); }
        .footer-item.active { background-color: #0D6EFD !important; border-color: #0D6EFD !important; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(13, 110, 253, 0.45); }
        .footer-item.active .footer-icon { color: #ffffff !important; transform: scale(1.05); }
        .footer-item.active .footer-label { font-weight: 700; color: #ffffff !important; }
        .footer-item:focus-visible { outline: 2px solid #0D6EFD; outline-offset: 2px; }
        .footer-cart-badge {
          position: absolute;
          top: var(--nav-badge-top);
          right: var(--nav-badge-right);
          background: #ef4444;
          color: #ffffff;
          font-size: var(--nav-badge-font);
          font-weight: 800;
          border-radius: 9999px;
          padding: 0.08rem 0.28rem;
          min-width: var(--nav-badge-size);
          height: var(--nav-badge-size);
          display: flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
          box-shadow: 0 2px 4px rgba(239, 68, 68, 0.4);
          border: 1.5px solid #000000;
          pointer-events: none;
          transition: border-color 0.22s ease;
        }
        .footer-item.active .footer-cart-badge,
        .footer-item:hover .footer-cart-badge { border-color: #0D6EFD; }
        /* Mobile breakpoints */
        @media (max-width: 640px) {
          .footer-bar { padding: 0.35rem 12px calc(0.35rem + env(safe-area-inset-bottom, 0px)) 12px; }
          .footer-inner { gap: 0.38rem; }
          .footer-item { padding: 0.42rem 0.35rem; border-radius: 0.7rem; }
          .footer-label { font-size: 0.66rem; }
        }
        @media (max-width: 480px) {
          .footer-bar { padding: 0.32rem 8px calc(0.32rem + env(safe-area-inset-bottom, 0px)) 8px; }
          .footer-inner { gap: 0.25rem; }
          .footer-item { padding: 0.38rem 0.25rem; border-radius: 0.65rem; gap: 0.18rem; }
          .footer-label { font-size: 0.62rem; }
        }
        @media (max-width: 360px) {
          .footer-bar { padding: 0.28rem 4px calc(0.28rem + env(safe-area-inset-bottom, 0px)) 4px; }
          .footer-inner { gap: 0.18rem; }
          .footer-item { padding: 0.32rem 0.18rem; border-radius: 0.55rem; gap: 0.15rem; }
          .footer-label { font-size: 0.58rem; }
        }
        /* Larger breakpoints – reuse scaling from MobileBottomNav */
        @media (min-width: 768px) {
          .footer-bar { padding: 0.5rem 24px calc(0.5rem + env(safe-area-inset-bottom, 0px)) 24px; --nav-icon-size: 21px; --nav-badge-size: 1.05rem; --nav-badge-font: 0.62rem; --nav-badge-top: -0.36rem; --nav-badge-right: -0.6rem; }
          .footer-inner { max-width: 720px; gap: 0.75rem; }
          .footer-item { padding: 0.55rem 0.75rem; border-radius: 0.85rem; gap: 0.28rem; }
          .footer-label { font-size: 0.78rem; letter-spacing: 0.015em; }
        }
        @media (min-width: 1024px) {
          .footer-bar { padding: 0.55rem 32px; --nav-icon-size: 22px; --nav-badge-size: 1.1rem; --nav-badge-font: 0.64rem; --nav-badge-top: -0.38rem; --nav-badge-right: -0.62rem; }
          .footer-inner { max-width: 820px; gap: 0.95rem; }
          .footer-item { padding: 0.58rem 0.95rem; border-radius: 0.9rem; gap: 0.32rem; }
          .footer-label { font-size: 0.82rem; letter-spacing: 0.02em; }
        }
        @media (min-width: 1366px) {
          .footer-bar { padding: 0.6rem 36px; --nav-icon-size: 23px; --nav-badge-size: 1.15rem; --nav-badge-font: 0.66rem; --nav-badge-top: -0.4rem; --nav-badge-right: -0.65rem; }
          .footer-inner { max-width: 900px; gap: 1.15rem; }
          .footer-item { padding: 0.62rem 1.05rem; border-radius: 0.95rem; gap: 0.35rem; }
          .footer-label { font-size: 0.85rem; letter-spacing: 0.02em; }
        }
        @media (min-width: 1440px) {
          .footer-bar { padding: 0.65rem 40px; --nav-icon-size: 24px; --nav-badge-size: 1.2rem; --nav-badge-font: 0.68rem; --nav-badge-top: -0.42rem; --nav-badge-right: -0.68rem; }
          .footer-inner { max-width: 960px; gap: 1.35rem; }
          .footer-item { padding: 0.65rem 1.2rem; border-radius: 1rem; gap: 0.38rem; }
          .footer-label { font-size: 0.88rem; letter-spacing: 0.02em; }
        }
        @media (min-width: 1920px) {
          .footer-inner { max-width: 1020px; gap: 1.5rem; }
          .footer-item { padding: 0.7rem 1.3rem; border-radius: 1.05rem; gap: 0.4rem; }
          .footer-label { font-size: 0.9rem; }
        }
      `}</style>
    </nav>
  );
}
