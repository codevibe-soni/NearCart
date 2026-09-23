import React from 'react';
import { Link } from 'react-router-dom';
import {
  Store,
  ShoppingCart,
  Truck,
  PackageCheck,
  Search,
  ShieldCheck,
  Lock,
  CreditCard,
  Tag,
  Clock,
  Navigation,
  Bell,
  Star,
  Smartphone,
  CheckCircle2,
  ArrowRight,
  Code2,
  Users,
  Building2,
  Compass,
  Sparkles,
} from 'lucide-react';

export default function About() {
  return (
    <div style={{ background: 'var(--bg-dark, #f8fafc)', minHeight: '100vh', paddingBottom: '5rem' }}>
      {/* 1. Hero Section */}
      <section
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
          color: '#ffffff',
          padding: '4rem 1.5rem 4.5rem 1.5rem',
          borderBottom: '3px solid #0284c7',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          className="container"
          style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 2 }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.35rem 0.85rem',
              borderRadius: '9999px',
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              fontSize: '0.8rem',
              fontWeight: '800',
              marginBottom: '1.25rem',
              letterSpacing: '0.5px',
            }}
          >
            <span>HYPERLOCAL SHOPPING PLATFORM</span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(2rem, 5vw, 3rem)',
              fontWeight: '800',
              marginBottom: '0.5rem',
              letterSpacing: '-0.5px',
              color: '#ffffff',
            }}
          >
            About NearCart  + FoodDisk
          </h1>

          <p
            style={{
              fontSize: 'clamp(1.1rem, 2.5vw, 1.4rem)',
              fontWeight: '700',
              color: '#38bdf8',
              marginBottom: '1.5rem',
            }}
          >
            "Your nearby shops, delivered."
          </p>

          <p
            style={{
              fontSize: '1.05rem',
              color: '#cbd5e1',
              lineHeight: '1.65',
              maxWidth: '750px',
              margin: '0 auto 2rem auto',
            }}
          >
            NearCart is a hyperlocal delivery platform designed to connect customers with nearby shops and make everyday shopping faster, simpler, and more convenient.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <Link
              to="/student"
              className="btn-primary"
              style={{
                padding: '0.75rem 1.5rem',
                fontSize: '0.95rem',
                fontWeight: '700',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                color: '#ffffff',
                textDecoration: 'none',
                borderRadius: '0.5rem',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
              }}
            >
              Explore Products <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      <div className="container" style={{ maxWidth: '1100px', margin: '0 auto', padding: '3rem 1.5rem 0 1.5rem' }}>
        {/* 2. Why NearCart? / What is NearCart? */}
        <section style={{ marginBottom: '3.5rem' }}>
          <div
            className="glass-card"
            style={{
              background: '#ffffff',
              borderRadius: '1rem',
              border: '1px solid var(--border-color, #e2e8f0)',
              padding: '2.5rem',
              boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Compass size={22} style={{ color: 'var(--primary, #0284c7)' }} />
              <h2 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-primary, #0f172a)', margin: 0 }}>
                Why NearCart?
              </h2>
            </div>

            <p style={{ fontSize: '1rem', color: 'var(--text-secondary, #334155)', lineHeight: '1.7', marginBottom: '1.5rem' }}>
              NearCart helps customers discover nearby campus and neighborhood stores, enabling fast local ordering for everyday essential products including:
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '1rem',
                marginBottom: '2rem',
              }}
            >
              {[
                { label: 'Groceries & Staples', icon: <ShoppingCart size={20} /> },
                { label: 'Stationery & Supplies', icon: <Store size={20} /> },
                { label: 'Personal Care Essentials', icon: <Sparkles size={20} /> },
                { label: 'Fruits & Beverages', icon: <Tag size={20} /> },
                { label: 'Daily Use Products', icon: <PackageCheck size={20} /> },
                { label: 'Local Store Specialties', icon: <Navigation size={20} /> },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: '0.6rem',
                    background: '#f8fafc',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    fontSize: '0.9rem',
                    fontWeight: '700',
                    color: 'var(--text-primary, #0f172a)',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', color: '#0284c7' }}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            {/* Seamless 4-Node Flow Bar */}
            <div
              style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                color: '#ffffff',
                padding: '1.25rem 1.5rem',
                borderRadius: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Fulfillment Connection Flow:
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  fontSize: '0.9rem',
                  fontWeight: '700',
                  flexWrap: 'wrap',
                }}
              >
                <span>Customer</span>
                <span style={{ color: '#38bdf8' }}>➔</span>
                <span>Local Shop</span>
                <span style={{ color: '#38bdf8' }}>➔</span>
                <span>Delivery Partner</span>
                <span style={{ color: '#38bdf8' }}>➔</span>
                <span style={{ color: '#38bdf8' }}>Doorstep Delivery</span>
              </div>
            </div>
          </div>
        </section>

        {/* 3. How NearCart Works (4-Step Visual Grid) */}
        <section style={{ marginBottom: '3.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary, #0f172a)', marginBottom: '0.4rem' }}>
              How NearCart Works
            </h2>
            <p style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.95rem' }}>
              Simple 4-step ordering & delivery process
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {[
              {
                step: '1',
                title: 'Discover',
                desc: 'Browse nearby shops and search for products in your local area.',
                icon: Search,
                color: '#0284c7',
                bgColor: '#e0f2fe',
              },
              {
                step: '2',
                title: 'Order',
                desc: 'Add items to your cart, apply available coupons, and checkout easily.',
                icon: ShoppingCart,
                color: '#7c3aed',
                bgColor: '#f3e8ff',
              },
              {
                step: '3',
                title: 'Prepare',
                desc: 'The shop receives your order and packages the items for pickup.',
                icon: PackageCheck,
                color: '#d97706',
                bgColor: '#fef3c7',
              },
              {
                step: '4',
                title: 'Deliver',
                desc: 'A delivery partner picks up the order and delivers it directly to you.',
                icon: Truck,
                color: '#059669',
                bgColor: '#d1fae5',
              },
            ].map((s) => {
              const IconComponent = s.icon;
              return (
                <div
                  key={s.step}
                  className="glass-card"
                  style={{
                    background: '#ffffff',
                    borderRadius: '0.85rem',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    padding: '1.75rem 1.25rem',
                    position: 'relative',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '3.25rem',
                      height: '3.25rem',
                      borderRadius: '50%',
                      background: s.bgColor,
                      color: s.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 1.25rem auto',
                      fontWeight: '800',
                      fontSize: '1.2rem',
                    }}
                  >
                    <IconComponent size={24} />
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      top: '1rem',
                      right: '1rem',
                      fontSize: '0.75rem',
                      fontWeight: '800',
                      color: s.color,
                      background: s.bgColor,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '9999px',
                    }}
                  >
                    STEP {s.step}
                  </div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary, #0f172a)', marginBottom: '0.5rem' }}>
                    {s.title}
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary, #475569)', lineHeight: '1.5', margin: 0 }}>
                    {s.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 4. What NearCart Offers (Verified Key Features Grid) */}
        <section style={{ marginBottom: '3.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary, #0f172a)', marginBottom: '0.4rem' }}>
              What NearCart Offers
            </h2>
            <p style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.95rem' }}>
              Built-in features powering local ordering & delivery
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '1.25rem',
            }}
          >
            {[
              { name: 'Nearby Shop Discovery', icon: Store, desc: 'Find active local merchants near you.' },
              { name: 'Product Browsing', icon: Search, desc: 'Search items across multiple categories.' },
              { name: 'Shopping Cart', icon: ShoppingCart, desc: 'Manage your cart items before checkout.' },
              { name: 'Online UPI Payments', icon: CreditCard, desc: 'Pay via dynamic, locked UPI QR or intent.' },
              { name: 'Cash on Delivery (COD)', icon: CheckCircle2, desc: 'Pay when your order arrives.' },
              { name: 'Coupon Discounts', icon: Tag, desc: 'Apply available promo codes for savings.' },
              { name: 'Order Status Tracking', icon: Clock, desc: 'Follow real-time status updates.' },
              { name: 'Live Delivery Tracking', icon: Navigation, desc: 'Track your delivery partner on live maps.' },
              { name: 'Instant Notifications', icon: Bell, desc: 'Receive real-time order alerts.' },
              { name: 'Ratings & Reviews', icon: Star, desc: 'Rate completed orders and share feedback.' },
              { name: 'PWA App Support', icon: Smartphone, desc: 'Install NearCart directly on your device.' },
              { name: 'Secure Authentication', icon: Lock, desc: 'HTTP-only cookie protected access.' },
            ].map((f, i) => {
              const IconComp = f.icon;
              return (
                <div
                  key={i}
                  style={{
                    background: '#ffffff',
                    borderRadius: '0.75rem',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    padding: '1.25rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.85rem',
                  }}
                >
                  <div
                    style={{
                      width: '2.5rem',
                      height: '2.5rem',
                      borderRadius: '0.5rem',
                      background: 'rgba(2, 132, 199, 0.1)',
                      color: '#0284c7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <IconComp size={20} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary, #0f172a)', margin: '0 0 0.25rem 0' }}>
                      {f.name}
                    </h4>
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-muted, #64748b)', margin: 0, lineHeight: '1.4' }}>
                      {f.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 5. Stakeholder Capabilities (For Customers, Shopkeepers, Delivery Partners) */}
        <section style={{ marginBottom: '3.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary, #0f172a)', marginBottom: '0.4rem' }}>
              Built for Every Stakeholder
            </h2>
            <p style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.95rem' }}>
              Connecting customers, merchants, and delivery partners seamlessly
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {/* For Customers */}
            <div
              className="glass-card"
              style={{
                background: '#ffffff',
                borderRadius: '0.85rem',
                border: '1px solid var(--border-color, #e2e8f0)',
                padding: '1.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.5rem', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={20} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary, #0f172a)', margin: 0 }}>
                  For Customers
                </h3>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.875rem', color: 'var(--text-secondary, #334155)' }}>
                <li>✓ Browse nearby shops and product listings</li>
                <li>✓ View detailed item descriptions and prices</li>
                <li>✓ Add items to cart and apply discount coupons</li>
                <li>✓ Choose between UPI payment or Cash on Delivery</li>
                <li>✓ Track order progress and live delivery map</li>
                <li>✓ Rate completed orders and leave reviews</li>
              </ul>
            </div>

            {/* For Shopkeepers */}
            <div
              className="glass-card"
              style={{
                background: '#ffffff',
                borderRadius: '0.85rem',
                border: '1px solid var(--border-color, #e2e8f0)',
                padding: '1.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.5rem', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={20} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary, #0f172a)', margin: 0 }}>
                  For Shopkeepers
                </h3>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.875rem', color: 'var(--text-secondary, #334155)' }}>
                <li>✓ Manage shop profile, details, and operating hours</li>
                <li>✓ Add, edit, and categorize catalog products</li>
                <li>✓ Receive incoming customer orders in real time</li>
                <li>✓ Update order preparation statuses</li>
                <li>✓ Configure shop UPI payment information</li>
                <li>✓ Create and manage shop discount coupons</li>
              </ul>
            </div>

            {/* For Delivery Partners */}
            <div
              className="glass-card"
              style={{
                background: '#ffffff',
                borderRadius: '0.85rem',
                border: '1px solid var(--border-color, #e2e8f0)',
                padding: '1.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.5rem', background: '#d1fae5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Truck size={20} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary, #0f172a)', margin: 0 }}>
                  For Delivery Partners
                </h3>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.875rem', color: 'var(--text-secondary, #334155)' }}>
                <li>✓ View assigned orders available for pickup</li>
                <li>✓ Access shop pickup and delivery destination details</li>
                <li>✓ Update delivery status (Picked Up, Out for Delivery)</li>
                <li>✓ Share real-time location for live tracking</li>
                <li>✓ Contact customer when allowed for smooth handoff</li>
                <li>✓ Mark orders as successfully delivered</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 6. Privacy, Security & Vision Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.5rem',
            marginBottom: '3.5rem',
          }}
        >
          {/* Privacy & Safety Section */}
          <div
            style={{
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              color: '#ffffff',
              borderRadius: '0.85rem',
              padding: '1.75rem',
              border: '1px solid rgba(2, 132, 199, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <ShieldCheck size={22} style={{ color: '#38bdf8' }} />
              <h3 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#ffffff', margin: 0 }}>
                Your Privacy Matters
              </h3>
            </div>
            <p style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.6', marginBottom: '1rem' }}>
              NearCart is designed with privacy in mind. The application uses account authentication and only uses information needed to provide and manage the services available through the platform.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.825rem', color: '#38bdf8', fontWeight: '700' }}>
              <Lock size={14} />
              <span>Never share your password or OTP with anyone.</span>
            </div>
          </div>

          {/* Our Vision Section */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '0.85rem',
              border: '1px solid var(--border-color, #e2e8f0)',
              padding: '1.75rem',
            }}
          >
            <h3 style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--text-primary, #0f172a)', marginBottom: '0.75rem' }}>
              Our Vision
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary, #334155)', lineHeight: '1.6', marginBottom: '0.75rem' }}>
              NearCart aims to make local shopping more convenient while helping nearby shops reach customers through a simple digital platform.
            </p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary, #334155)', lineHeight: '1.6', margin: 0 }}>
              Instead of making customers travel from shop to shop, NearCart brings local products and services closer to them through technology.
            </p>
          </div>
        </div>
        {/* 8. Developer Corner ("Built By") */}
        <section style={{ marginBottom: '2rem' }}>
          <div
            style={{
              maxWidth: '480px',
              margin: '0 auto',
              background: 'linear-gradient(135deg, #0f172a 0%, #0f172a 100%)',
              color: '#ffffff',
              borderRadius: '1rem',
              padding: '1.75rem 1.5rem',
              textAlign: 'center',
              border: '1px solid rgba(2, 132, 199, 0.25)',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.2)',
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.75rem',
                fontWeight: '800',
                color: '#38bdf8',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: '0.75rem',
              }}
            >
              <Code2 size={14} />
              <span>BUILT BY</span>
            </div>

            <div style={{ fontSize: '1.35rem', fontWeight: '800', color: '#ffffff', marginBottom: '0.5rem' }}>
              Built by NearCart Team
            </div>

            <p
              style={{
                fontSize: '0.875rem',
                color: '#cbd5e1',
                lineHeight: '1.5',
                margin: '0 0 0.85rem 0',
              }}
            >
              Built by the NearCart Team with a focus on simple, reliable and convenient local delivery.
            </p>

            <div
              style={{
                fontSize: '0.8rem',
                color: '#94a3b8',
                fontWeight: '600',
                paddingTop: '0.65rem',
                borderTop: '1px dashed rgba(255, 255, 255, 0.15)',
              }}
            >
              Team NearCart
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
