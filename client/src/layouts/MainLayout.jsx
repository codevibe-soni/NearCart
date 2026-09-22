import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import api from '../services/api';
import { 
  House, 
  Store, 
  ClipboardList, 
  ShoppingCart, 
  Bell, 
  CircleUserRound, 
  LogOut, 
  Menu, 
  X, 
  Check, 
  ExternalLink, 
  Sparkles, 
  Info, 
  ShieldCheck, 
  LogIn, 
  UserPlus,
  LayoutDashboard
} from 'lucide-react';
import NearCartLogo from '../components/NearCartLogo';
import PwaInstallButton from '../components/PwaInstallButton';
import PwaInstallBanner from '../components/PwaInstallBanner';
import Footer from '../components/Footer';
import { registerPwaInstallation } from '../utils/pwaInstallTracker';
import AutoReviewPopup from '../components/AutoReviewPopup';

export default function MainLayout() {
  const { user, isAuthenticated, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, fetchNotifications } = useNotifications();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  const recentNotifications = notifications.slice(0, 5);

  useEffect(() => {
    // Fetch live cart item count if authenticated student
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

  useEffect(() => {
    // Check if app is running in standalone mode (already installed PWA app icon launch)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    if (isStandalone) {
      registerPwaInstallation();
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setNotifDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = () => {
    if (!notifDropdownOpen) {
      fetchNotifications();
    }
    setNotifDropdownOpen(!notifDropdownOpen);
  };

  const handleNotificationClick = async (notif) => {
    setNotifDropdownOpen(false);
    if (!notif.isRead) {
      await markAsRead(notif._id);
    }
    if (notif.relatedOrder) {
      const orderId = typeof notif.relatedOrder === 'object' ? notif.relatedOrder._id : notif.relatedOrder;
      navigate(`/orders/${orderId}`);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getDashboardPath = () => {
    if (!user) return '/';
    switch (user.role) {
      case 'STUDENT':
        return '/student';
      case 'SHOPKEEPER':
        return '/shopkeeper';
      case 'DELIVERY_BOY':
        return '/delivery';
      case 'ADMIN':
        return '/admin';
      default:
        return '/';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-dark)' }}>
      {/* Header Navbar */}
      <header
        style={{
          borderBottom: '1px solid var(--border-color)',
          background: '#ffffff',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          className="container"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: '4.5rem',
          }}
        >
          {/* Logo */}
        <Link to="/" style={{ textDecoration: 'none' }}>
  <NearCartLogo size="medium" showFoodDisk={true} />
</Link>

          {/* Desktop Icon-Based Navigation */}
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}
            className="desktop-nav"
          >
            {/* Primary Nav Links */}
            <NavLink
              to="/"
              end
              className={({ isActive }) => `nav-icon-link ${isActive ? 'active' : ''}`}
              title="Home"
              aria-label="Home"
            >
              <House size={19} />
              <span>Home</span>
            </NavLink>

            {isAuthenticated && user?.role === 'STUDENT' && (
              <NavLink
                to="/student"
                className={({ isActive }) => `nav-icon-link ${isActive ? 'active' : ''}`}
                title="Shops Marketplace"
                aria-label="Shops Marketplace"
              >
                <Store size={19} />
                <span>Shops</span>
              </NavLink>
            )}

            <NavLink
              to="/about"
              className={({ isActive }) => `nav-icon-link ${isActive ? 'active' : ''}`}
              title="About NearCart"
              aria-label="About NearCart"
            >
              <Info size={19} />
              <span>About</span>
            </NavLink>

            <PwaInstallButton />

            {isAuthenticated ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginLeft: '0.5rem', paddingLeft: '0.5rem', borderLeft: '1px solid #e2e8f0' }}>
                {user.role === 'STUDENT' && (
                  <>
                    <NavLink
                      to="/orders"
                      className={({ isActive }) => `nav-icon-link ${isActive ? 'active' : ''}`}
                      title="My Orders"
                      aria-label="My Orders"
                    >
                      <ClipboardList size={19} />
                      <span>Orders</span>
                    </NavLink>

                    <NavLink
                      to="/cart"
                      className={({ isActive }) => `nav-icon-link cart-link ${isActive ? 'active' : ''}`}
                      title="Shopping Cart"
                      aria-label="Shopping Cart"
                      style={{ position: 'relative' }}
                    >
                      <ShoppingCart size={19} style={{ color: 'var(--primary)' }} />
                      <span>Cart</span>
                      {cartCount > 0 && (
                        <span className="nav-badge cart-badge">
                          {cartCount > 99 ? '99+' : cartCount}
                        </span>
                      )}
                    </NavLink>
                  </>
                )}

                {/* Notification Bell Dropdown */}
                <div ref={dropdownRef} style={{ position: 'relative' }}>
                  <button
                    onClick={toggleDropdown}
                    className={`nav-icon-btn ${notifDropdownOpen ? 'active' : ''}`}
                    title="Notifications"
                    aria-label="Notifications"
                  >
                    <Bell size={19} />
                    {unreadCount > 0 && (
                      <span className="nav-badge">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {notifDropdownOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: '2.75rem',
                        width: '320px',
                        background: '#ffffff',
                        border: '1px solid var(--border-color)',
                        borderRadius: '0.75rem',
                        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.12)',
                        zIndex: 200,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          padding: '0.75rem 1rem',
                          borderBottom: '1px solid var(--border-color)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          background: '#f8fafc',
                        }}
                      >
                        <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          Notifications
                        </h4>
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllRead}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--primary)',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                            }}
                          >
                            <Check size={12} /> Mark all read
                          </button>
                        )}
                      </div>

                      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {recentNotifications.length === 0 ? (
                          <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            No notifications yet
                          </div>
                        ) : (
                          recentNotifications.map((n) => (
                            <div
                              key={n._id}
                              onClick={() => handleNotificationClick(n)}
                              style={{
                                padding: '0.75rem 1rem',
                                borderBottom: '1px solid var(--border-color)',
                                background: n.isRead ? 'transparent' : '#f0f9ff',
                                cursor: 'pointer',
                                transition: 'background 0.2s',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: n.isRead ? '600' : '700', color: 'var(--text-primary)' }}>
                                  {n.title}
                                </span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                                {n.message}
                              </p>
                            </div>
                          ))
                        )}
                      </div>

                      <Link
                        to="/notifications"
                        onClick={() => setNotifDropdownOpen(false)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.4rem',
                          padding: '0.65rem',
                          textAlign: 'center',
                          fontSize: '0.8rem',
                          color: 'var(--primary)',
                          fontWeight: '600',
                          borderTop: '1px solid var(--border-color)',
                          textDecoration: 'none',
                          background: '#f8fafc',
                        }}
                      >
                        <span>View all notifications</span>
                        <ExternalLink size={12} />
                      </Link>
                    </div>
                  )}
                </div>

                {/* Dashboard / Profile Portal Link */}
                <NavLink
                  to={getDashboardPath()}
                  className={({ isActive }) => `nav-icon-link ${isActive ? 'active' : ''}`}
                  title={`Dashboard (${user.role})`}
                  aria-label={`Dashboard (${user.role})`}
                >
                  {user.profileImage ? (
                    <img src={user.profileImage} alt={user.name} style={{ width: '1.35rem', height: '1.35rem', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <CircleUserRound size={19} />
                  )}
                  <span>{user.name.split(' ')[0]}</span>
                </NavLink>

                {/* Logout Action Button */}
                <button
                  onClick={handleLogout}
                  className="nav-icon-btn logout-btn"
                  title="Logout"
                  aria-label="Logout"
                >
                  <LogOut size={19} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem' }}>
                <Link to="/login" className="nav-icon-link" style={{ background: '#f1f5f9' }} aria-label="Login">
                  <LogIn size={18} />
                  <span>Login</span>
                </Link>
                <Link to="/register" className="nav-icon-link primary-action" aria-label="Register">
                  <UserPlus size={18} />
                  <span>Register</span>
                </Link>
              </div>
            )}
          </nav>

          {/* Mobile Right Container */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} className="mobile-header-right">
            {/* Mobile Quick Cart Link if logged in student */}
            {isAuthenticated && user?.role === 'STUDENT' && (
              <NavLink
                to="/cart"
                className="nav-icon-btn"
                title="Cart"
                aria-label="Cart"
                style={{ position: 'relative' }}
              >
                <ShoppingCart size={20} style={{ color: 'var(--primary)' }} />
                {cartCount > 0 && (
                  <span className="nav-badge cart-badge">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </NavLink>
            )}

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                display: 'none',
                background: '#f8fafc',
                border: '1px solid var(--border-color)',
                borderRadius: '0.5rem',
                padding: '0.45rem',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
              className="mobile-toggle"
              aria-label="Toggle navigation menu"
              title="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div
            style={{
              padding: '1rem 1.25rem 1.25rem 1.25rem',
              background: '#ffffff',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.6rem',
              boxShadow: '0 8px 20px rgba(0,0,0,0.06)',
            }}
          >
            <NavLink
              to="/"
              end
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
            >
              <House size={20} />
              <span>Home</span>
            </NavLink>

            {isAuthenticated && user?.role === 'STUDENT' && (
              <NavLink
                to="/student"
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
              >
                <Store size={20} />
                <span>Shops Marketplace</span>
              </NavLink>
            )}

            <NavLink
              to="/about"
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
            >
              <Info size={20} />
              <span>About NearCart</span>
            </NavLink>

            <PwaInstallButton variant="mobile" />

            {isAuthenticated ? (
              <>
                {user.role === 'STUDENT' && (
                  <>
                    <NavLink
                      to="/orders"
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
                    >
                      <ClipboardList size={20} />
                      <span>My Orders</span>
                    </NavLink>
                    <NavLink
                      to="/cart"
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
                    >
                      <ShoppingCart size={20} />
                      <span>Shopping Cart ({cartCount})</span>
                    </NavLink>
                  </>
                )}
                <NavLink
                  to="/notifications"
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
                >
                  <Bell size={20} />
                  <span>Notifications {unreadCount > 0 && `(${unreadCount})`}</span>
                </NavLink>

                <NavLink
                  to={getDashboardPath()}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}
                  style={{ background: '#f0f9ff', color: 'var(--primary)', fontWeight: '700' }}
                >
                  <LayoutDashboard size={20} />
                  <span>Dashboard ({user.role})</span>
                </NavLink>

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="mobile-nav-link"
                  style={{
                    background: '#fef2f2',
                    color: 'var(--danger)',
                    border: 'none',
                    width: '100%',
                    justifyContent: 'flex-start',
                    cursor: 'pointer',
                    fontWeight: '600',
                  }}
                >
                  <LogOut size={20} />
                  <span>Logout</span>
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn-secondary"
                  style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}
                >
                  <LogIn size={17} /> Login
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn-primary"
                  style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}
                >
                  <UserPlus size={17} /> Register
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Responsive Scoped Styles */}
      <style>{`
        .nav-icon-link {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.45rem 0.85rem;
          border-radius: 0.6rem;
          color: var(--text-secondary);
          text-decoration: none;
          transition: background 200ms ease, color 200ms ease, transform 200ms ease, box-shadow 200ms ease;
        }
        .nav-icon-link:hover {
          background: #f1f5f9;
          color: var(--primary);
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(2, 132, 199, 0.08);
        }
        .nav-icon-link:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 2px;
        }
        .nav-icon-link.active {
          background: #e0f2fe;
          color: #0284c7;
          font-weight: 700;
          box-shadow: inset 0 0 0 1px #bae6fd;
        }
        .nav-icon-link.primary-action {
          background: var(--primary-gradient);
          color: #ffffff;
        }
        .nav-icon-link.primary-action:hover {
          opacity: 0.94;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);
        }
        .nav-icon-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 2.35rem;
          height: 2.35rem;
          border-radius: 0.6rem;
          background: #f8fafc;
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          cursor: pointer;
          transition: background 200ms ease, color 200ms ease, transform 200ms ease, border-color 200ms ease;
          position: relative;
        }
        .nav-icon-btn:hover {
          background: #f1f5f9;
          color: var(--primary);
          border-color: #cbd5e1;
          transform: translateY(-1px);
        }
        .nav-icon-btn:focus-visible {
          outline: 2px solid var(--primary);
          outline-offset: 2px;
        }
        .nav-icon-btn.logout-btn:hover {
          background: #fef2f2;
          color: var(--danger);
          border-color: #fca5a5;
        }
        .nav-badge {
          position: absolute;
          top: -0.35rem;
          right: -0.35rem;
          background: #ef4444;
          color: #ffffff;
          font-size: 0.65rem;
          font-weight: 800;
          border-radius: 9999px;
          padding: 0.12rem 0.35rem;
          min-width: 1.1rem;
          text-align: center;
          line-height: 1;
          box-shadow: 0 2px 4px rgba(239, 68, 68, 0.3);
        }
        .cart-badge {
          background: #0284c7;
          box-shadow: 0 2px 4px rgba(2, 132, 199, 0.3);
        }
        .mobile-nav-link {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0.65rem 0.85rem;
          border-radius: 0.5rem;
          color: var(--text-primary);
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 600;
          transition: background 0.15s ease;
        }
        .mobile-nav-link:hover, .mobile-nav-link.active {
          background: #f0f9ff;
          color: var(--primary);
        }
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-toggle { display: block !important; }
        }
        @media (min-width: 769px) {
          .mobile-header-right { display: none !important; }
        }
      `}</style>

      {/* Main Outlet */}
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      <PwaInstallBanner />

      {/* Auto Review Popup for Delivered Orders */}
      {isAuthenticated && user?.role === 'STUDENT' && <AutoReviewPopup />}

      {/* Footer */}
      <Footer />
    </div>
  );
}
