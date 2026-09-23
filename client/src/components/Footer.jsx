import React from 'react';
import { Link } from 'react-router-dom';
import NearCartLogo from './NearCartLogo';
import {
  ShieldCheck,
  Lock,
  Instagram,
  Linkedin,
  Github,
  Youtube,
  Twitter,
  ExternalLink,
  Heart,
} from 'lucide-react';

/**
 * Centralized Social Links Configuration
 * Populate valid URLs to display official social media buttons with hover tooltips and accessibility labels.
 * Unconfigured / empty URLs are safely omitted to avoid fake/broken external links.
 */
export const SOCIAL_LINKS_CONFIG = [
  {
    id: 'instagram',
    name: 'Instagram',
    url: import.meta.env.VITE_SOCIAL_INSTAGRAM || '',
    icon: Instagram,
    ariaLabel: 'NearCart on Instagram',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    url: import.meta.env.VITE_SOCIAL_LINKEDIN || '',
    icon: Linkedin,
    ariaLabel: 'NearCart on LinkedIn',
  },
  {
    id: 'github',
    name: 'GitHub',
    url: import.meta.env.VITE_SOCIAL_GITHUB || '',
    icon: Github,
    ariaLabel: 'NearCart on GitHub',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    url: import.meta.env.VITE_SOCIAL_YOUTUBE || '',
    icon: Youtube,
    ariaLabel: 'NearCart on YouTube',
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    url: import.meta.env.VITE_SOCIAL_TWITTER || '',
    icon: Twitter,
    ariaLabel: 'NearCart on X (Twitter)',
  },
];

export default function Footer() {
  const currentYear = new Date().getFullYear();

  // Filter only configured social links with valid URLs
  const activeSocialLinks = SOCIAL_LINKS_CONFIG.filter(
    (item) => item.url && typeof item.url === 'string' && item.url.trim() !== ''
  );

  return (
    <>
    <footer
      className="main-footer"
      style={{
        background: '#0f172a',
        color: '#f8fafc',
        borderTop: '1px solid rgba(2, 132, 199, 0.3)',
        position: 'relative',
        marginTop: 'auto',
        overflow: 'hidden',
      }}
    >
      {/* Top Gradient Accent Line */}
      <div
        style={{
          height: '3px',
          width: '100%',
          background: 'linear-gradient(90deg, #38bdf8 0%, #0284c7 50%, #1e3a8a 100%)',
        }}
      />

      <div
        className="footer-container"
        style={{
          padding: '1.25rem 1.25rem 1rem 1.25rem',
          maxWidth: '1200px',
          margin: '0 auto',
        }}
      >
        {/* Main Footer Grid */}
        <div
          className="footer-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem 1.25rem',
            marginBottom: '1rem',
          }}
        >
          {/* Column 1: Brand & Tagline */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
              <NearCartLogo size="small" variant="dark" />
            </div>

            <p style={{ fontSize: '0.78rem', fontWeight: '700', color: '#38bdf8', margin: '0 0 0.25rem 0' }}>
              "Your nearby shops, delivered."
            </p>

            <p style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: '1.35', margin: '0 0 0.5rem 0' }}>
              NearCart connects customers with nearby local shops for fast, convenient, and reliable ordering & delivery straight to your doorstep.
            </p>

            {/* Social Links Section */}
            {activeSocialLinks.length > 0 && (
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: '700', color: '#a7f3d0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.3rem' }}>
                  Connect With Us
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {activeSocialLinks.map((social) => {
                    const IconComp = social.icon;
                    return (
                      <a
                        key={social.id}
                        href={social.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={social.ariaLabel}
                        title={social.name}
                        className="social-icon-btn"
                        style={{
                          width: '1.75rem',
                          height: '1.75rem',
                          borderRadius: '50%',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(56, 189, 248, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#e2e8f0',
                          textDecoration: 'none',
                          transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                      >
                        <IconComp size={13} />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Column 2: Quick Navigation */}
          <div>
            <h4
              style={{
                fontSize: '0.8rem',
                fontWeight: '800',
                color: '#ffffff',
                marginBottom: '0.45rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }} />
              Quick Links
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.78rem' }}>
              <li>
                <Link to="/" className="footer-link">
                  Home
                </Link>
              </li>
              <li>
                <Link to="/student" className="footer-link">
                  Customer Marketplace
                </Link>
              </li>
              <li>
                <Link to="/orders" className="footer-link">
                  My Orders
                </Link>
              </li>
              <li>
                <Link to="/cart" className="footer-link">
                  Shopping Cart
                </Link>
              </li>
              <li>
                <Link to="/notifications" className="footer-link">
                  Notifications
                </Link>
              </li>
              <li>
                <Link to="/about" className="footer-link">
                  About NearCart
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Platform Portals */}
          <div>
            <h4
              style={{
                fontSize: '0.8rem',
                fontWeight: '800',
                color: '#ffffff',
                marginBottom: '0.45rem',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#0284c7', display: 'inline-block' }} />
              Platform Portals
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.78rem' }}>
              <li>
                <Link to="/student" className="footer-link">
                  Customer Marketplace
                </Link>
              </li>
              <li>
                <Link to="/shopkeeper" className="footer-link">
                  Shop Partner Portal
                </Link>
              </li>
              <li>
                <Link to="/delivery" className="footer-link">
                  Delivery Partner Hub
                </Link>
              </li>
              <li>
                <Link to="/admin" className="footer-link">
                  Admin Governance
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Privacy & Safety Trust Section */}
          <div>
            <div
              style={{
                background: 'rgba(56, 189, 248, 0.05)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                borderRadius: '0.5rem',
                padding: '0.65rem 0.85rem',
              }}
            >
              <h4
                style={{
                  fontSize: '0.8rem',
                  fontWeight: '800',
                  color: '#38bdf8',
                  margin: '0 0 0.3rem 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                }}
              >
                <ShieldCheck size={14} style={{ color: '#38bdf8' }} />
                Privacy & Safety
              </h4>

              <p style={{ fontSize: '0.75rem', color: '#cbd5e1', lineHeight: '1.3', margin: '0 0 0.3rem 0' }}>
                Your privacy matters to us. NearCart only uses data needed to process your orders.
              </p>

              <div
                style={{
                  fontSize: '0.72rem',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  marginTop: '0.3rem',
                  paddingTop: '0.3rem',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <Lock size={11} style={{ color: '#38bdf8', flexShrink: 0 }} />
                <span>Secure account protection enabled.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Copyright Row */}
        <div
          style={{
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            paddingTop: '0.65rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.4rem',
            fontSize: '0.75rem',
            color: '#64748b',
          }}
        >
          <div>
            © {currentYear} NearCart. All rights reserved.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#94a3b8' }}>
            <ShieldCheck size={12} style={{ color: '#38bdf8' }} />
            <span>Secure & Private Local Ordering</span>
          </div>
        </div>
      </div>

      {/* Footer Scoped Hover & Responsive Styles */}
      <style>{`
        .footer-link {
          color: #94a3b8;
          text-decoration: none;
          transition: color 0.2s ease, transform 0.2s ease;
          display: inline-block;
        }
        .footer-link:hover, .footer-link:focus-visible {
          color: #38bdf8 !important;
          transform: translateX(3px);
          outline: none;
        }
        .social-icon-btn:hover, .social-icon-btn:focus-visible {
          background: #0284c7 !important;
          color: #ffffff !important;
          border-color: #38bdf8 !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35);
          outline: none;
        }
        @media (max-width: 768px) {
          .main-footer {
            display: none !important;
          }
          .mobile-footer-spacer {
            display: block !important;
            height: 5.5rem;
          }
        }
      `}</style>
    </footer>
    <div className="mobile-footer-spacer" style={{ display: 'none' }}></div>
    </>
  );
}
