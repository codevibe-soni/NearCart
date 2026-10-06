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

      <div className="footer-container">
        {/* Main Footer Grid */}
        <div className="footer-grid">
          {/* Column 1: Brand & Tagline */}
          <div className="footer-col-brand">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
              <NearCartLogo size="small" variant="dark" />
            </div>

            <p className="footer-brand-tagline" style={{ fontSize: '0.78rem', fontWeight: '700', color: '#38bdf8', margin: '0 0 0.2rem 0' }}>
              "Your nearby shops, delivered."
            </p>

            <p className="footer-brand-desc" style={{ fontSize: '0.74rem', color: '#94a3b8', lineHeight: '1.35', margin: '0 0 0.4rem 0' }}>
              NearCart connects customers with nearby local shops for fast, convenient, and reliable ordering & delivery straight to your doorstep.
            </p>

            {/* Social Links Section */}
            {activeSocialLinks.length > 0 && (
              <div>
                <div style={{ fontSize: '0.65rem', fontWeight: '700', color: '#a7f3d0', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>
                  Connect With Us
                </div>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
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
          <div className="footer-col-quicklinks">
            <h4 className="footer-heading">
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }} />
              Quick Links
            </h4>
            <ul className="footer-links-list">
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
          <div className="footer-col-portals">
            <h4 className="footer-heading">
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#0284c7', display: 'inline-block' }} />
              Platform Portals
            </h4>
            <ul className="footer-links-list">
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
          <div className="footer-col-trust">
            <div className="footer-trust-box">
              <h4
                className="footer-heading"
                style={{
                  color: '#38bdf8',
                  margin: '0 0 0.25rem 0',
                }}
              >
                <ShieldCheck size={14} style={{ color: '#38bdf8', flexShrink: 0 }} />
                Privacy & Safety
              </h4>

              <p className="footer-trust-text" style={{ fontSize: '0.73rem', color: '#cbd5e1', lineHeight: '1.3', margin: '0 0 0.25rem 0' }}>
                Your privacy matters to us. NearCart only uses data needed to process your orders.
              </p>

              <div
                style={{
                  fontSize: '0.68rem',
                  color: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  marginTop: '0.25rem',
                  paddingTop: '0.25rem',
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
        <div className="footer-bottom-row">
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
        .footer-container {
          padding: 1.25rem 1.25rem 0.85rem 1.25rem;
          max-width: 1200px;
          margin: 0 auto;
        }
        .footer-grid {
          display: grid;
          grid-template-columns: 1.3fr 1fr 1fr 1.1fr;
          gap: 1.25rem;
          margin-bottom: 0.85rem;
        }
        .footer-heading {
          font-size: 0.8rem;
          font-weight: 800;
          color: #ffffff;
          margin-bottom: 0.45rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }
        .footer-links-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          font-size: 0.78rem;
        }
        .footer-link {
          color: #94a3b8;
          text-decoration: none;
          transition: color 0.2s ease, transform 0.2s ease;
          display: inline-block;
          word-break: break-word;
        }
        .footer-link:hover, .footer-link:focus-visible {
          color: #38bdf8 !important;
          transform: translateX(3px);
          outline: none;
        }
        .social-icon-btn {
          width: 1.75rem;
          height: 1.75rem;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(56, 189, 248, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #e2e8f0;
          text-decoration: none;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .social-icon-btn:hover, .social-icon-btn:focus-visible {
          background: #0284c7 !important;
          color: #ffffff !important;
          border-color: #38bdf8 !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35);
          outline: none;
        }
        .footer-trust-box {
          background: rgba(56, 189, 248, 0.05);
          border: 1px solid rgba(56, 189, 248, 0.2);
          border-radius: 0.5rem;
          padding: 0.65rem 0.85rem;
        }
        .footer-bottom-row {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          padding-top: 0.65rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.4rem;
          font-size: 0.75rem;
          color: #64748b;
        }

        /* Tablet Screens (641px to 1024px) */
        @media (max-width: 1024px) {
          .footer-container {
            padding: 1rem 1rem 0.75rem 1rem;
          }
          .footer-grid {
            grid-template-columns: 1.2fr 1fr 1fr 1.1fr;
            gap: 1rem;
            margin-bottom: 0.75rem;
          }
        }

        /* Mobile Screens (<= 640px) */
        @media (max-width: 640px) {
          .footer-container {
            padding: 0.75rem 0.85rem 0.5rem 0.85rem !important;
          }
          .footer-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 0.65rem 0.75rem !important;
            margin-bottom: 0.5rem !important;
          }
          .footer-col-brand {
            grid-column: 1 / -1 !important;
          }
          .footer-col-quicklinks {
            grid-column: 1 !important;
          }
          .footer-col-portals {
            grid-column: 2 !important;
          }
          .footer-col-trust {
            grid-column: 1 / -1 !important;
          }
          .footer-heading {
            font-size: 0.72rem !important;
            margin-bottom: 0.3rem !important;
          }
          .footer-links-list {
            gap: 0.18rem !important;
            font-size: 0.72rem !important;
          }
          .footer-brand-tagline {
            font-size: 0.72rem !important;
            margin-bottom: 0.15rem !important;
          }
          .footer-brand-desc {
            font-size: 0.7rem !important;
            line-height: 1.3 !important;
            margin-bottom: 0.35rem !important;
          }
          .footer-trust-box {
            padding: 0.5rem 0.65rem !important;
          }
          .footer-trust-text {
            font-size: 0.68rem !important;
            line-height: 1.25 !important;
          }
          .social-icon-btn {
            width: 1.55rem !important;
            height: 1.55rem !important;
          }
          .footer-bottom-row {
            font-size: 0.68rem !important;
            padding-top: 0.4rem !important;
          }
        }

        /* Very Small Mobile Screens (<= 360px) */
        @media (max-width: 360px) {
          .footer-container {
            padding: 0.65rem 0.65rem 0.4rem 0.65rem !important;
          }
          .footer-grid {
            gap: 0.5rem 0.5rem !important;
          }
          .footer-links-list {
            font-size: 0.7rem !important;
          }
        }
      `}</style>
    </footer>
    </>
  );
}
