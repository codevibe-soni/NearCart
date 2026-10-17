import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { getCategories } from '../services/studentService';
import heroPoster from '../assets/hero-poster.jpg';
import { CategoryCard } from '../components/StudentUIComponents';
import ShoppingDemo from '../components/ShoppingDemo';

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [apiStatus, setApiStatus] = useState({ loading: true, success: false, message: '' });
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

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

  // Load categories for home navigation
  useEffect(() => {
    const load = async () => {
      try {
        const res = await getCategories();
        if (res && res.success) {
          setCategories(res.categories || []);
        }
      } catch (_) {}
      setCategoriesLoading(false);
    };
    load();
  }, []);

  const handleHomeCategorySelect = (cat) => {
    // Navigate to student listing with category name in URL (Student page resolves name -> ID)
    const url = cat.name ? `/student?category=${encodeURIComponent(cat.name)}` : '/student';
    navigate(url);
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
      <section className="home-hero">
  <div className="container">
    <h1 className="hero-title">
      Shop Local. <span className="hero-highlight">Right Around You.</span>
    </h1>
    <p className="hero-subtitle">
      Fast, convenient delivery from nearby shops.
    </p>
    <div className="hero-actions">
      {isAuthenticated ? (
        <Link to={getDashboardPath()} className="btn-primary">
          Go to My Portal ({user?.role}) <ArrowRight size={18} />
        </Link>
      ) : (
        <Link to="/student" className="btn-primary">
          Explore Shops <ArrowRight size={18} />
        </Link>
      )}
    </div>
    <div className="hero-poster-wrapper">
      <img src={heroPoster} alt="NearCart hero" className="hero-poster-img" />
      <ShoppingDemo />
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
