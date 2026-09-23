import React, { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { House, Store, Info, ShoppingCart, CircleUserRound, LogIn, LogOut } from 'lucide-react';
import api from '../services/api';

export default function MobileBottomNav() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [cartCount, setCartCount] = useState(0);

  // Fetch cart count for student users
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
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation" style={{ 
        position: 'fixed', 
        bottom: 0, 
        left: 0, 
        right: 0, 
        height: 'calc(4.5rem + env(safe-area-inset-bottom))',
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'linear-gradient(to right, #f8fafc, #f0f9ff)', 
        borderTop: '1px solid #bae6fd', 
        display: 'flex', 
        justifyContent: 'space-around', 
        alignItems: 'center', 
        zIndex: 1000,
        boxShadow: '0 -4px 12px rgba(2, 132, 199, 0.05)'
      }}>
        <NavLink to="/" end className={({ isActive }) => `mobile-tab-link ${isActive ? 'active' : ''}`} title="Home" aria-label="Home">
          <House size={22} className="tab-icon" />
          <span className="tab-label">Home</span>
        </NavLink>
        {isAuthenticated && user?.role === 'STUDENT' && (
          <NavLink to="/student" className={({ isActive }) => `mobile-tab-link ${isActive ? 'active' : ''}`} title="Shops Marketplace" aria-label="Shops Marketplace">
            <Store size={22} className="tab-icon" />
            <span className="tab-label">Shops</span>
          </NavLink>
        )}
        <NavLink to="/about" className={({ isActive }) => `mobile-tab-link ${isActive ? 'active' : ''}`} title="About NearCart" aria-label="About NearCart">
          <Info size={22} className="tab-icon" />
          <span className="tab-label">About</span>
        </NavLink>
        {isAuthenticated && user?.role === 'STUDENT' && (
          <NavLink to="/cart" className={({ isActive }) => `mobile-tab-link ${isActive ? 'active' : ''}`} title="Cart" aria-label="Cart">
            <div style={{ position: 'relative' }}>
              <ShoppingCart size={22} className="tab-icon" />
              {cartCount > 0 && (
                <span className="nav-badge cart-badge" aria-live="polite">{cartCount > 99 ? '99+' : cartCount}</span>
              )}
            </div>
            <span className="tab-label">Cart</span>
          </NavLink>
        )}
        {/* Profile Link */}
        <NavLink to="/profile" className={({ isActive }) => `mobile-tab-link ${isActive ? 'active' : ''}`} title="Profile" aria-label="Profile">
          <CircleUserRound size={22} className="tab-icon" />
          <span className="tab-label">Profile</span>
        </NavLink>

        <style>{`
          .mobile-tab-link {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 0.2rem;
            color: #64748b;
            text-decoration: none;
            flex: 1;
            padding: 0.5rem 0;
            transition: all 0.2s ease;
          }
          .mobile-tab-link .tab-icon {
            transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
          }
          .mobile-tab-link.active {
            color: #0284c7;
          }
          .mobile-tab-link.active .tab-icon {
            transform: scale(1.15);
            color: #0284c7;
            stroke-width: 2.5px;
          }
          .mobile-tab-link .tab-label {
            font-size: 0.65rem;
            font-weight: 600;
          }
        `}</style>
      </nav>
    </>
  );
}
