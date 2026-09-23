import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { checkHealth } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  ShoppingBag,
  Store,
  Truck,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Zap,
  Clock,
  Shield,
  Search,
  ArrowRight,
  Sparkles,
  Layers,
  Code,
} from 'lucide-react';

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [apiStatus, setApiStatus] = useState({ loading: true, success: false, message: '' });

  const getDashboardPath = () => {
    if (!user) return '/student';
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
        return '/student';
    }
  };

  useEffect(() => {
    async function verifyBackend() {
      const result = await checkHealth();
      setApiStatus({
        loading: false,
        success: result.success,
        message: result.message,
      });
    }
    verifyBackend();
  }, []);

  const whatsNewItems = [
    {
      title: 'Official NearCart Rebranding',
      desc: 'Sleek new product identity built for modern local shopping & delivery.',
      badge: 'Brand',
    },
    {
      title: '4-Card Dense Mobile Grid',
      desc: 'Optimized 4-product-cards-per-row grid on mobile screens (360px–414px) with zero horizontal overflow.',
      badge: 'Mobile UI',
    },
    {
      title: 'Shop-Focused Student Browsing',
      desc: 'Primary student view prioritizes direct product items. Full shop details open only on intentional shop selection.',
      badge: 'UX Fix',
    },
    {
      title: 'Lightning-Fast Page Load',
      desc: 'Route-level code splitting, lazy-loaded map tracking, and optimized lean database query projections.',
      badge: 'Performance',
    },
    {
      title: 'Instant Real-Time Notifications',
      desc: 'Consolidated real-time delivery tracker with background push notifications.',
      badge: 'Real-Time',
    },
  ];

  const features = [
    {
      title: 'Nearby Local Shops',
      desc: 'Access local canteens, stationery stores, and daily grocery stalls instantly.',
      icon: Store,
    },
    {
      title: 'Direct Product Browsing',
      desc: 'Browse categorized products directly and place quick orders straight to your location.',
      icon: Search,
    },
    {
      title: 'Fast Local Delivery',
      desc: 'Hyperlocal delivery partners who know every street and hostel block.',
      icon: Zap,
    },
    {
      title: 'Secure COD & UPI QR',
      desc: 'Multiple convenient payment options including Cash on Delivery and direct shopkeeper UPI QR scan.',
      icon: Shield,
    },
    {
      title: 'Live Map GPS Tracking',
      desc: 'Real-time GPS tracking on your order lifecycle from shop acceptance to doorstep delivery.',
      icon: Clock,
    },
    {
      title: 'Progressive Web App (PWA)',
      desc: 'Installable mobile-first web app with offline capabilities and push alerts.',
      icon: ShoppingBag,
    },
  ];

  const steps = [
    { step: '01', title: 'Browse Products', desc: 'Explore items from verified nearby shops with clear discount pricing.' },
    { step: '02', title: 'Place Order', desc: 'Select items or use instant Buy Now for rapid single-item checkout.' },
    { step: '03', title: 'Track & Receive', desc: 'Follow your delivery partner on live GPS right to your doorstep.' },
  ];

  return (
    <div>
      {/* Hero Section */}
      <section style={{ padding: '4.5rem 0 3.5rem 0', textAlign: 'center', position: 'relative' }}>
        <div className="container">
          {/* Status badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.4rem 1rem',
              borderRadius: '9999px',
              background: '#f1f5f9',
              border: '1px solid var(--border-color)',
              fontSize: '0.85rem',
              marginBottom: '2rem',
            }}
          >
            {apiStatus.loading ? (
              <span style={{ color: 'var(--text-muted)' }}>Connecting to NearCart network...</span>
            ) : apiStatus.success ? (
              <>
                <CheckCircle2 style={{ width: '0.9rem', height: '0.9rem', color: 'var(--success)' }} />
                <span style={{ color: 'var(--success)', fontWeight: '500' }}>{apiStatus.message}</span>
              </>
            ) : (
              <>
                <AlertCircle style={{ width: '0.9rem', height: '0.9rem', color: 'var(--danger)' }} />
                <span style={{ color: 'var(--danger)', fontWeight: '500' }}>API Offline (Run Backend Server)</span>
              </>
            )}
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            
          </div>

          <h1
            style={{
              fontSize: 'clamp(2.2rem, 5vw, 3.6rem)',
              fontWeight: '800',
              lineHeight: '1.15',
              letterSpacing: '-0.03em',
              marginBottom: '1.25rem',
              maxWidth: '850px',
              margin: '0 auto 1.25rem auto',
            }}
          >
            Everything You Need.{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Right Around You.
            </span>
          </h1>

          <p
            style={{
              fontSize: '1.15rem',
              color: 'var(--text-secondary)',
              maxWidth: '650px',
              margin: '0 auto 2.5rem auto',
              fontWeight: '400',
            }}
          >
            NearCart connects students & customers with nearby local shops for fast, convenient, and reliable local delivery.
          </p>

          <div
            style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            {isAuthenticated ? (
              <Link to={getDashboardPath()} className="btn-primary" style={{ padding: '0.85rem 1.75rem', fontSize: '1rem' }}>
                Go to My Portal ({user?.role}) <ArrowRight size={18} />
              </Link>
            ) : (
              <>
                <Link to="/student" className="btn-primary" style={{ padding: '0.85rem 1.75rem', fontSize: '1rem' }}>
                  Browse Marketplace <ArrowRight size={18} />
                </Link>
                <Link to="/login" className="btn-secondary" style={{ padding: '0.85rem 1.75rem', fontSize: '1rem' }}>
                  Partner Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* What's New / Latest Updates Section */}
      <section style={{ padding: '2.5rem 0', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem', justifyContent: 'center' }}>
            <Sparkles size={22} style={{ color: 'var(--primary)' }} />
            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
              What's New in NearCart
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
            {whatsNewItems.map((item, idx) => (
              <div key={idx} className="glass-card" style={{ padding: '1.25rem', background: '#ffffff', position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    color: 'var(--primary)',
                    background: '#e0f2fe',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '0.25rem',
                  }}
                >
                  {item.badge}
                </span>
                <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.4rem', paddingRight: '4rem' }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Role Cards Section */}
      <section style={{ padding: '3.5rem 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '0.5rem' }}>Built for the Entire Ecosystem</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Tailored portals for customers, shopkeepers, delivery partners, and admins.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
            <div className="glass-card">
              <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '0.5rem', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <ShoppingBag style={{ color: 'var(--primary)' }} size={22} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '0.4rem' }}>Student / Customer</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Order snacks, grocery items, stationery, and daily essentials straight to your hostel or location.
              </p>
              <Link to="/student" style={{ color: 'var(--primary)', fontSize: '0.875rem', fontWeight: '700' }}>
                Access Marketplace →
              </Link>
            </div>

            <div className="glass-card">
              <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '0.5rem', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Store style={{ color: 'var(--success)' }} size={22} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '0.4rem' }}>Shopkeeper</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Manage inventory, process instant incoming orders, set discount pricing, and accept direct UPI QR payments.
              </p>
              <Link to="/shopkeeper" style={{ color: 'var(--success)', fontSize: '0.875rem', fontWeight: '700' }}>
                Access Portal →
              </Link>
            </div>

            <div className="glass-card">
              <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '0.5rem', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Truck style={{ color: 'var(--warning)' }} size={22} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '0.4rem' }}>Delivery Partner</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Earn by completing localized orders with real-time GPS location sharing and transparent payouts.
              </p>
              <Link to="/delivery" style={{ color: 'var(--warning)', fontSize: '0.875rem', fontWeight: '700' }}>
                Access Portal →
              </Link>
            </div>

            <div className="glass-card">
              <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '0.5rem', background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <ShieldCheck style={{ color: '#9333ea' }} size={22} />
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '0.4rem' }}>Admin</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Onboard store vendors, verify delivery staff, monitor orders, and oversee platform health.
              </p>
              <Link to="/admin" style={{ color: '#9333ea', fontSize: '0.875rem', fontWeight: '700' }}>
                Access Portal →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" style={{ padding: '4rem 0', background: '#ffffff', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '0.5rem' }}>How NearCart Works</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Simple, streamlined three-step delivery experience.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
            {steps.map((s) => (
              <div key={s.step} className="glass-card" style={{ textAlign: 'center', position: 'relative' }}>
                <span
                  style={{
                    fontSize: '2.5rem',
                    fontWeight: '800',
                    color: 'var(--primary)',
                    opacity: 0.3,
                    display: 'block',
                    marginBottom: '0.5rem',
                  }}
                >
                  {s.step}
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.5rem' }}>{s.title}</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" style={{ padding: '4rem 0' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '0.5rem' }}>Platform Features</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Engineered for university & local community micro-delivery.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {features.map((f) => {
              const IconComp = f.icon;
              return (
                <div key={f.title} className="glass-card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div style={{ padding: '0.6rem', borderRadius: '0.5rem', background: '#e0f2fe', color: 'var(--primary)', flexShrink: 0 }}>
                    <IconComp size={20} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.25rem' }}>{f.title}</h4>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{f.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* About NearCart / Built With Purpose Section */}
      <section id="about-nearcart" style={{ padding: '4rem 0', background: '#ffffff', borderTop: '1px solid var(--border-color)' }}>
        <div className="container">
          <div className="glass-card" style={{ padding: '2.5rem', background: '#f8fafc', border: '1px solid var(--border-color)' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                ABOUT NEARCART
              </span>
              <h2 style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '0.5rem', marginBottom: '1rem' }}>
                Built with Purpose
              </h2>
              <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '2rem' }}>
                NearCart connects customers and students with nearby local shops for convenient ordering and fast, reliable delivery. Designed to empower local vendors and deliver everyday essentials with speed and transparency.
              </p>

              <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'center', marginBottom: '2rem' }}>
                {['Hyperlocal Delivery', 'Fast Checkout', 'Live Order Tracking', 'Mobile First', 'Push Alerts', 'Secure Payments'].map((tech) => (
                  <span
                    key={tech}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      padding: '0.35rem 0.85rem',
                      borderRadius: '1rem',
                      fontSize: '0.85rem',
                      fontWeight: '700',
                      color: 'var(--text-primary)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                  >
                    {tech}
                  </span>
                ))}
              </div>

              <div
                style={{
                  padding: '1.5rem',
                  background: '#ffffff',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.25rem',
                  flexWrap: 'wrap',
                }}
              >
                <div
                  style={{
                    width: '3.5rem',
                    height: '3.5rem',
                    borderRadius: '50%',
                    background: 'var(--primary-gradient)',
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'center',
                    color: '#ffffff',
                    fontWeight: '800',
                    fontSize: '1.3rem',
                    flexShrink: 0,
                  }}
                >
                  NC
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                    NearCart Platform Engineering
                  </h4>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Developer & Product Architecture Team • Full-Stack Local Delivery Infrastructure
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
