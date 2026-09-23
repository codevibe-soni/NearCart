import React, { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { House, Store, Info, ShoppingCart, CircleUserRound, LogIn, LogOut } from 'lucide-react';
import api from '../services/api';

export default function MobileBottomNav() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
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

  const handleLogout = async () => {
    await logout();
    navigate('/login');
    setShowProfile(false);
  };

  return (
    <>
      {/* Profile Pop‑over */}
      {showProfile && (
        <div className="mobile-profile-popover" role="dialog" aria-modal="true" style={{ position: 'absolute', bottom: '4rem', left: 0, right: 0, margin: '0 auto', maxWidth: '200px', background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.75rem', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          {isAuthenticated ? (
            <div className="profile-authenticated" style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontWeight: '600' }}>{user?.name?.split(' ')[0] ?? 'User'}</p>
              <button
                onClick={handleLogout}
                className="nav-icon-btn logout-btn"
                style={{ marginTop: '0.4rem', background: '#fef2f2', color: 'var(--danger)' }}
              >
                <LogOut size={16} /> Logout
              </button>
            </div>
          ) : (
            <Link to="/login" className="nav-icon-link" onClick={() => setShowProfile(false)}>
              <LogIn size={16} /> Login
            </Link>
          )}
        </div>
      )}

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '4rem', background: '#ffffff', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 1000 }}>
        <NavLink to="/" end className={({ isActive }) => `nav-icon-link ${isActive ? 'active' : ''}`} title="Home" aria-label="Home">
          <House size={20} />
        </NavLink>
        {isAuthenticated && user?.role === 'STUDENT' && (
          <NavLink to="/student" className={({ isActive }) => `nav-icon-link ${isActive ? 'active' : ''}`} title="Shops Marketplace" aria-label="Shops Marketplace">
            <Store size={20} />
          </NavLink>
        )}
        <NavLink to="/about" className={({ isActive }) => `nav-icon-link ${isActive ? 'active' : ''}`} title="About NearCart" aria-label="About NearCart">
          <Info size={20} />
        </NavLink>
        {isAuthenticated && user?.role === 'STUDENT' && (
          <NavLink to="/cart" className="nav-icon-btn" title="Cart" aria-label="Cart">
            <ShoppingCart size={20} />
            {cartCount > 0 && (
              <span className="nav-badge cart-badge" aria-live="polite">{cartCount > 99 ? '99+' : cartCount}</span>
            )}
          </NavLink>
        )}
        {/* Profile / Login button */}
        <button
          onClick={() => setShowProfile((prev) => !prev)}
          className="nav-icon-btn"
          aria-label={isAuthenticated ? 'Profile' : 'Login'}
          title={isAuthenticated ? 'Profile' : 'Login'}
        >
          <CircleUserRound size={20} />
        </button>
      </nav>
    </>
  );
}
