import React from 'react';

export function SearchBar({ value, onChange, onSubmit, placeholder = 'Search products, shops...' }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) onSubmit(value);
  };

  return (
    <form onSubmit={handleSubmit} style={{ position: 'relative', width: '100%' }}>
      <input
        type="text"
        className="form-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          paddingLeft: '2.5rem',
          paddingRight: '3rem',
          borderRadius: 'var(--radius-md)',
          background: '#ffffff',
          border: '1px solid #cbd5e1',
        }}
      />
      <svg
        style={{
          position: 'absolute',
          left: '0.9rem',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-muted)',
          pointerEvents: 'none',
        }}
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <button
        type="submit"
        style={{
          position: 'absolute',
          right: '0.5rem',
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'var(--primary)',
          color: '#ffffff',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          padding: '0.3rem 0.6rem',
          fontSize: '0.75rem',
          fontWeight: '700',
          cursor: 'pointer',
        }}
      >
        Search
      </button>
    </form>
  );
}

export function CategoryCard({ category, onClick, isSelected }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '0.85rem 1.25rem',
        borderRadius: 'var(--radius-md)',
        background: isSelected ? 'var(--primary-gradient)' : '#ffffff',
        border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}`,
        color: isSelected ? '#ffffff' : 'var(--text-primary)',
        fontWeight: isSelected ? '700' : '500',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        transition: 'all 0.2s ease',
        boxShadow: isSelected ? '0 4px 14px rgba(2, 132, 199, 0.25)' : 'none',
      }}
    >
      <span>{category.name}</span>
    </div>
  );
}

export function formatTimeAMPM(timeStr) {
  if (!timeStr) return '';
  if (timeStr.toUpperCase().includes('AM') || timeStr.toUpperCase().includes('PM')) return timeStr;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return timeStr;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strHours = hours < 10 ? '0' + hours : hours;
  return `${strHours}:${minutes} ${ampm}`;
}

export function isShopOpen(shop) {
  if (!shop) return false;
  if (shop.isActive === false || shop.isApproved === false) return false;
  if (shop.isOpen === false) return false;
  if (!shop.openingTime || !shop.closingTime) return shop.isOpen !== false;

  const parseMinutes = (tStr) => {
    if (!tStr) return null;
    let time = tStr.trim();
    let isPM = false;
    let isAM = false;
    if (time.toUpperCase().includes('PM')) { isPM = true; time = time.replace(/PM/i, '').trim(); }
    if (time.toUpperCase().includes('AM')) { isAM = true; time = time.replace(/AM/i, '').trim(); }
    const parts = time.split(':');
    if (parts.length < 2) return null;
    let h = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;
    return h * 60 + m;
  };

  const openMin = parseMinutes(shop.openingTime);
  const closeMin = parseMinutes(shop.closingTime);

  if (openMin === null || closeMin === null) return shop.isOpen !== false;

  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();

  if (openMin < closeMin) {
    return currentMin >= openMin && currentMin < closeMin;
  } else if (openMin > closeMin) {
    return currentMin >= openMin || currentMin < closeMin;
  }
  return true;
}

export function ShopCard({ shop, onClick }) {
  const hasTiming = Boolean(shop.openingTime && shop.closingTime);
  const currentlyOpen = isShopOpen(shop);
  const shopImage = shop.logo || shop.coverImage;
  const openTimeFormatted = hasTiming ? formatTimeAMPM(shop.openingTime) : '';
  const closeTimeFormatted = hasTiming ? formatTimeAMPM(shop.closingTime) : '';

  return (
    <div
      onClick={onClick}
      className="glass-card"
      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
          {shopImage ? (
            <img
              src={shopImage}
              alt={shop.name}
              style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.5rem',
                objectFit: 'cover',
                border: '1px solid var(--border-color)',
              }}
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div
            style={{
              width: '3rem',
              height: '3rem',
              borderRadius: '0.5rem',
              background: '#e0f2fe',
              display: shopImage ? 'none' : 'flex',
              alignItems: 'center',
              justify: 'center',
              fontWeight: '700',
              color: 'var(--primary)',
              fontSize: '1.2rem',
              border: '1px solid #bae6fd',
            }}
          >
            {shop.name ? shop.name.charAt(0).toUpperCase() : 'S'}
          </div>
          <div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)' }}>{shop.name}</h4>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {shop.category?.name || 'General Store'}{shop.foodType ? ` • ${shop.foodType}` : ''}
            </span>
          </div>
        </div>

        <span
          style={{
            padding: '0.2rem 0.6rem',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: '600',
            background: !hasTiming ? '#f1f5f9' : currentlyOpen ? '#d1fae5' : '#fee2e2',
            color: !hasTiming ? '#64748b' : currentlyOpen ? '#047857' : '#b91c1c',
            border: `1px solid ${!hasTiming ? '#cbd5e1' : currentlyOpen ? '#a7f3d0' : '#fca5a5'}`,
          }}
        >
          {!hasTiming ? 'Hours not set' : currentlyOpen ? 'OPEN' : 'CLOSED'}
        </span>
      </div>

      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.85rem', flex: 1 }}>
        {shop.description || 'Campus shop providing essential goods.'}
      </p>

      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <span>🕐</span>
        <span>{hasTiming ? `${openTimeFormatted} – ${closeTimeFormatted}` : 'Hours not set'}</span>
      </div>

      <div
        style={{
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          fontSize: '0.8rem',
          color: 'var(--text-muted)',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '0.75rem',
        }}
      >
        <span>⭐ {shop.rating?.toFixed(1) || '4.5'} ({shop.totalRatings || 0})</span>
        <span>Delivery: ₹{shop.deliveryFee || 0}</span>
      </div>
    </div>
  );
}

export const ProductCard = React.memo(function ProductCard({ product, onClick, onShopClick }) {
  const hasDiscount = product.discountPrice !== undefined && product.discountPrice !== null && product.discountPrice < product.price;
  const discountPercent = hasDiscount ? Math.round(((product.price - product.discountPrice) / product.price) * 100) : 0;

  const handleShopClick = (e) => {
    if (onShopClick && product.shop?._id) {
      onShopClick(e, product.shop._id);
    }
  };

  return (
    <div
      onClick={onClick}
      className="glass-card product-card-dense"
      style={{
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
        padding: '0.65rem',
        borderRadius: 'var(--radius-sm, 0.5rem)',
        background: '#ffffff',
        boxSizing: 'border-box',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      {hasDiscount && (
        <span
          style={{
            position: 'absolute',
            top: '0.4rem',
            right: '0.4rem',
            background: 'var(--danger, #ef4444)',
            color: '#fff',
            fontSize: '0.625rem',
            fontWeight: '800',
            padding: '0.15rem 0.4rem',
            borderRadius: '0.25rem',
            zIndex: 2,
            boxShadow: '0 2px 4px rgba(239, 68, 68, 0.25)',
          }}
        >
          {discountPercent}% OFF
        </span>
      )}

      {/* Compact Image Frame */}
      <div
        style={{
          width: '100%',
          height: '135px',
          maxHeight: '140px',
          borderRadius: '0.35rem',
          background: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '0.45rem',
          border: '1px solid var(--border-color, #e2e8f0)',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {product.images && product.images.length > 0 ? (
          <img
            src={product.images[0]}
            alt={product.name}
            loading="lazy"
            decoding="async"
            style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '0.25rem' }}
          />
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>No Image</span>
        )}
      </div>

      {/* Shop Name Badge */}
      <span
        onClick={handleShopClick}
        title={product.shop?.name ? `View ${product.shop.name}` : undefined}
        style={{
          fontSize: '0.68rem',
          color: 'var(--primary, #0284c7)',
          fontWeight: '700',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: 'block',
          cursor: product.shop?._id ? 'pointer' : 'default',
          marginBottom: '0.15rem',
        }}
      >
        {product.shop?.name || 'Local Store'}
      </span>

      {/* Clamped Product Title */}
      <h4
        style={{
          fontSize: '0.825rem',
          fontWeight: '700',
          color: 'var(--text-primary, #0f172a)',
          margin: '0 0 0.35rem 0',
          lineHeight: '1.2',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          minHeight: '2.0rem',
        }}
      >
        {product.name}
      </h4>

      {/* Price & Discount */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--text-primary, #0f172a)' }}>
          ₹{hasDiscount ? product.discountPrice : product.price}
        </span>
        {hasDiscount && (
          <span style={{ fontSize: '0.725rem', color: 'var(--text-muted, #94a3b8)', textDecoration: 'line-through' }}>
            ₹{product.price}
          </span>
        )}
        {product.unit && <span style={{ fontSize: '0.68rem', color: 'var(--text-muted, #94a3b8)' }}>/ {product.unit}</span>}
      </div>

      {product.gstPercentage > 0 && (
        <span style={{ fontSize: '0.625rem', color: '#475569', background: '#f1f5f9', padding: '0.1rem 0.35rem', borderRadius: '0.2rem', marginBottom: '0.35rem', display: 'inline-block', width: 'fit-content' }}>
          incl. {product.gstPercentage}% GST
        </span>
      )}

      {Number(product.packingCharges) > 0 && (
        <span style={{ fontSize: '0.625rem', color: '#0369a1', background: '#e0f2fe', padding: '0.1rem 0.35rem', borderRadius: '0.2rem', marginBottom: '0.35rem', display: 'inline-block', width: 'fit-content' }}>
          Packing: ₹{product.packingCharges} / item
        </span>
      )}

      {/* Card Footer Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.4rem', borderTop: '1px dashed #f1f5f9' }}>
        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: '700',
            color: product.stock > 0 ? '#047857' : '#b91c1c',
          }}
        >
          {product.stock > 0 ? 'In Stock' : 'Out of Stock'}
        </span>

        <button
          className="btn-primary"
          style={{
            padding: '0.25rem 0.55rem',
            fontSize: '0.725rem',
            fontWeight: '700',
            pointerEvents: 'none',
            borderRadius: '0.3rem',
            lineHeight: '1',
            boxShadow: 'none',
          }}
        >
          + ADD
        </button>
      </div>
    </div>
  );
});

export function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '3rem 0' }}>
      <div
        style={{
          width: '2.5rem',
          height: '2.5rem',
          border: '3px solid var(--border-color)',
          borderTopColor: 'var(--primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export function EmptyState({ message, onReset }) {
  return (
    <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 1.5rem', margin: '2rem 0' }}>
      <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No Items Found</h3>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{message}</p>
      {onReset && (
        <button onClick={onReset} className="btn-secondary">
          Reset Search & Filters
        </button>
      )}
    </div>
  );
}

