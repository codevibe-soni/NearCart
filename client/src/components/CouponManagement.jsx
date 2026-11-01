import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Percent,
  ToggleLeft,
  ToggleRight,
  X,
  Copy,
  Check,
  Zap,
} from 'lucide-react';

export default function CouponManagement({ shop, isAdmin = false }) {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [copiedCode, setCopiedCode] = useState('');

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, code }

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    description: '',
    discountType: 'PERCENTAGE',
    discountValue: '',
    minimumOrderAmount: '0',
    maximumDiscount: '',
    usageLimit: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    isActive: true,
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isAdmin || shop?._id) {
      fetchCoupons();
    }
  }, [isAdmin, shop?._id]);

  const fetchCoupons = async () => {
    try {
      setLoading(true);
      setError('');
      const endpoint = isAdmin
        ? '/admin/coupons'
        : `/shopkeeper/coupons${shop?._id ? `?shopId=${shop._id}` : ''}`;
      const res = await api.get(endpoint);
      if (res.success) {
        setCoupons(res.coupons || []);
      } else {
        setError(res.message || 'Failed to fetch coupons');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch coupons');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (coupon = null) => {
    setError('');
    setSuccess('');
    if (coupon) {
      setEditingCoupon(coupon);
      setFormData({
        code: coupon.code,
        description: coupon.description || '',
        discountType: coupon.discountType || 'PERCENTAGE',
        discountValue: coupon.discountValue || '',
        minimumOrderAmount: coupon.minimumOrderAmount || '0',
        maximumDiscount: coupon.maximumDiscount !== null ? coupon.maximumDiscount : '',
        usageLimit: coupon.usageLimit !== null ? coupon.usageLimit : '',
        startDate: coupon.startDate ? new Date(coupon.startDate).toISOString().split('T')[0] : '',
        endDate: coupon.endDate ? new Date(coupon.endDate).toISOString().split('T')[0] : '',
        isActive: coupon.isActive ?? true,
      });
    } else {
      setEditingCoupon(null);
      setFormData({
        code: '',
        description: '',
        discountType: 'PERCENTAGE',
        discountValue: '',
        minimumOrderAmount: '0',
        maximumDiscount: '',
        usageLimit: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        isActive: true,
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingCoupon(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.code.trim()) {
      setError('Coupon code is required');
      return;
    }

    if (!formData.discountValue || Number(formData.discountValue) <= 0) {
      setError('Please enter a valid discount value greater than 0');
      return;
    }

    if (formData.discountType === 'PERCENTAGE' && Number(formData.discountValue) > 100) {
      setError('Percentage discount cannot exceed 100%');
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      setError('Start date and end date are required');
      return;
    }

    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      setError('End date must be on or after start date');
      return;
    }

    try {
      setSaving(true);
      let res;
      if (isAdmin) {
        if (editingCoupon) {
          res = await api.put(`/admin/coupons/${editingCoupon._id}`, formData);
        } else {
          res = await api.post('/admin/coupons', formData);
        }
      } else {
        const shopParam = shop?._id ? `?shopId=${shop._id}` : '';
        if (editingCoupon) {
          res = await api.put(`/shopkeeper/coupons/${editingCoupon._id}${shopParam}`, formData);
        } else {
          res = await api.post(`/shopkeeper/coupons${shopParam}`, formData);
        }
      }

      if (res.success) {
        setSuccess(res.message || (editingCoupon ? 'Coupon updated' : 'Coupon created'));
        handleCloseModal();
        fetchCoupons();
      } else {
        setError(res.message || 'Failed to save coupon');
      }
    } catch (err) {
      setError(err.message || 'Failed to save coupon');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (couponId, currentStatus) => {
    try {
      const endpoint = isAdmin
        ? `/admin/coupons/${couponId}/toggle`
        : `/shopkeeper/coupons/${couponId}/toggle${shop?._id ? `?shopId=${shop._id}` : ''}`;
      const res = await api.patch(endpoint);
      if (res.success) {
        setCoupons((prev) =>
          prev.map((c) => (c._id === couponId ? { ...c, isActive: !currentStatus } : c))
        );
        setSuccess(res.message);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.message || 'Failed to update coupon status');
    }
  };

  // Opens the custom delete confirmation modal
  const handleDeleteRequest = (couponId, code) => {
    setDeleteTarget({ id: couponId, code });
  };

  // Called when user confirms delete in the modal
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const { id, code } = deleteTarget;
    setDeleteTarget(null);
    try {
      const endpoint = isAdmin
        ? `/admin/coupons/${id}`
        : `/shopkeeper/coupons/${id}${shop?._id ? `?shopId=${shop._id}` : ''}`;
      const res = await api.delete(endpoint);
      if (res.success) {
        setCoupons((prev) => prev.filter((c) => c._id !== id));
        setSuccess(`Coupon "${code}" deleted successfully`);
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.message || 'Failed to delete coupon');
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  // Compute live preview discount label
  const getPreviewDiscount = () => {
    if (!formData.discountValue) return null;
    if (formData.discountType === 'PERCENTAGE') {
      return `${formData.discountValue}% OFF`;
    }
    return `₹${formData.discountValue} OFF`;
  };

  const getStatusInfo = (coupon) => {
    const isExpired = new Date(coupon.endDate) < new Date();
    const isUpcoming = new Date(coupon.startDate) > new Date();
    if (!coupon.isActive) return { label: 'Inactive', cls: 'cpn-status--inactive' };
    if (isExpired) return { label: 'Expired', cls: 'cpn-status--expired' };
    if (isUpcoming) return { label: 'Upcoming', cls: 'cpn-status--upcoming' };
    return { label: 'Active', cls: 'cpn-status--active' };
  };

  const getCardClass = (coupon) => {
    const isExpired = new Date(coupon.endDate) < new Date();
    if (!coupon.isActive) return 'cpn-card cpn-card--inactive';
    if (isExpired) return 'cpn-card cpn-card--expired';
    return 'cpn-card';
  };

  if (!isAdmin && !shop) {
    return (
      <div className="cpn-no-shop">
        <AlertCircle style={{ width: '2.25rem', height: '2.25rem', color: 'var(--cpn-warning)', margin: '0 auto' }} />
        <h3 className="cpn-no-shop-title">Shop Setup Required</h3>
        <p className="cpn-no-shop-desc">
          Please create and setup your shop profile first before creating coupon codes.
        </p>
      </div>
    );
  }

  const previewDiscount = getPreviewDiscount();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header Banner */}
      <div className="cpn-header">
        <div>
          <h2 className="cpn-header-title">
            <Tag style={{ width: '1.25rem', height: '1.25rem', color: 'rgba(255,255,255,0.85)' }} />
            {isAdmin ? 'Global Coupons' : 'Coupons'}
          </h2>
          <p className="cpn-header-subtitle">
            {isAdmin
              ? 'Create and manage platform-wide coupons usable across all NearCart shops'
              : 'Create and manage discount coupons for your shop'}
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="cpn-btn-create"
          aria-label={isAdmin ? 'Create new global coupon' : 'Create new coupon'}
        >
          <Plus style={{ width: '1rem', height: '1rem' }} />
          {isAdmin ? 'Create Global Coupon' : 'Create Coupon'}
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="cpn-alert cpn-alert-error" role="alert">
          <AlertCircle style={{ width: '1rem', height: '1rem', flexShrink: 0 }} />
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            className="cpn-alert-dismiss"
            aria-label="Dismiss error"
          >
            <X style={{ width: '0.875rem', height: '0.875rem' }} />
          </button>
        </div>
      )}

      {success && (
        <div className="cpn-alert cpn-alert-success" role="status">
          <CheckCircle2 style={{ width: '1rem', height: '1rem', flexShrink: 0 }} />
          <span>{success}</span>
          <button
            onClick={() => setSuccess('')}
            className="cpn-alert-dismiss"
            aria-label="Dismiss message"
          >
            <X style={{ width: '0.875rem', height: '0.875rem' }} />
          </button>
        </div>
      )}

      {/* Coupons List */}
      {loading ? (
        <div className="cpn-loading">
          <div className="cpn-spinner" role="status" aria-label="Loading coupons"></div>
          <p style={{ color: 'var(--cpn-text-muted)', fontSize: '0.875rem' }}>Loading coupons...</p>
        </div>
      ) : coupons.length === 0 ? (
        <div className="cpn-empty">
          <div className="cpn-empty-icon" aria-hidden="true">
            <Tag style={{ width: '1.75rem', height: '1.75rem' }} />
          </div>
          <h3 className="cpn-empty-title">No coupons yet</h3>
          <p className="cpn-empty-desc">
            Create your first coupon and offer discounts to your customers.
          </p>
          <button
            onClick={() => handleOpenModal()}
            className="cpn-btn-empty"
          >
            <Plus style={{ width: '1rem', height: '1rem' }} />
            Create Coupon
          </button>
        </div>
      ) : (
        <div className="cpn-grid">
          {coupons.map((coupon) => {
            const status = getStatusInfo(coupon);
            const cardClass = getCardClass(coupon);

            return (
              <div key={coupon._id} className={cardClass}>
                {/* Card Body */}
                <div className="cpn-card-body">
                  {/* Top: Code + Status */}
                  <div className="cpn-card-top">
                    <span className="cpn-code-badge">
                      {coupon.code}
                      <button
                        onClick={() => handleCopyCode(coupon.code)}
                        className="cpn-copy-btn"
                        aria-label={`Copy coupon code ${coupon.code}`}
                        title="Copy code"
                      >
                        {copiedCode === coupon.code ? (
                          <>
                            <Check style={{ width: '0.8rem', height: '0.8rem' }} />
                            <span className="cpn-copy-tooltip">Copied!</span>
                          </>
                        ) : (
                          <Copy style={{ width: '0.8rem', height: '0.8rem' }} />
                        )}
                      </button>
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.45rem',
                          borderRadius: '9999px',
                          background: coupon.couponType === 'GLOBAL' ? '#e0f2fe' : '#f1f5f9',
                          color: coupon.couponType === 'GLOBAL' ? '#0284c7' : '#475569',
                          border: `1px solid ${coupon.couponType === 'GLOBAL' ? '#bae6fd' : '#e2e8f0'}`,
                        }}
                      >
                        {coupon.couponType === 'GLOBAL' ? '🌐 Global' : '🏪 Shop'}
                      </span>
                      <span className={`cpn-status ${status.cls}`} aria-label={`Status: ${status.label}`}>
                        <span className="cpn-status-dot" aria-hidden="true"></span>
                        {status.label}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  {coupon.description && (
                    <p className="cpn-card-desc">{coupon.description}</p>
                  )}

                  {/* Discount Banner */}
                  <div className="cpn-discount-banner">
                    <div className="cpn-discount-main">
                      {coupon.discountType === 'PERCENTAGE' ? (
                        <Percent style={{ width: '1.1rem', height: '1.1rem', flexShrink: 0 }} />
                      ) : (
                        <Zap style={{ width: '1.1rem', height: '1.1rem', flexShrink: 0 }} />
                      )}
                      <div>
                        <p className="cpn-discount-label">Discount</p>
                        <p className="cpn-discount-value">
                          {coupon.discountType === 'PERCENTAGE'
                            ? `${coupon.discountValue}% OFF`
                            : `₹${coupon.discountValue} OFF`}
                        </p>
                      </div>
                    </div>
                    {coupon.maximumDiscount > 0 && coupon.discountType === 'PERCENTAGE' && (
                      <div className="cpn-discount-cap">
                        <p className="cpn-discount-cap-label">Max Discount</p>
                        <p className="cpn-discount-cap-val">₹{coupon.maximumDiscount}</p>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="cpn-card-details">
                    <div className="cpn-detail-row">
                      <span className="cpn-detail-label">Min Order</span>
                      <span className="cpn-detail-value">₹{coupon.minimumOrderAmount || 0}</span>
                    </div>
                    <div className="cpn-detail-row">
                      <span className="cpn-detail-label">Usage</span>
                      <span className="cpn-detail-value">
                        {coupon.usedCount || 0}
                        {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ' uses'}
                      </span>
                    </div>
                    <hr className="cpn-detail-divider" />
                    <div className="cpn-detail-dates">
                      <Calendar style={{ width: '0.75rem', height: '0.75rem' }} aria-hidden="true" />
                      <span>
                        {new Date(coupon.startDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                        {' — '}
                        {new Date(coupon.endDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="cpn-card-footer">
                  <button
                    onClick={() => handleToggleActive(coupon._id, coupon.isActive)}
                    className={`cpn-toggle-btn ${coupon.isActive ? 'cpn-toggle-btn--deactivate' : 'cpn-toggle-btn--activate'}`}
                    aria-label={coupon.isActive ? `Deactivate coupon ${coupon.code}` : `Activate coupon ${coupon.code}`}
                  >
                    {coupon.isActive ? (
                      <>
                        <ToggleRight style={{ width: '1.1rem', height: '1.1rem', color: 'var(--cpn-accent)' }} />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <ToggleLeft style={{ width: '1.1rem', height: '1.1rem' }} />
                        Activate
                      </>
                    )}
                  </button>

                  <div className="cpn-card-actions">
                    <button
                      onClick={() => handleOpenModal(coupon)}
                      className="cpn-action-btn cpn-action-btn--edit"
                      aria-label={`Edit coupon ${coupon.code}`}
                      title="Edit"
                    >
                      <Edit2 style={{ width: '0.9rem', height: '0.9rem' }} />
                    </button>
                    <button
                      onClick={() => handleDeleteRequest(coupon._id, coupon.code)}
                      className="cpn-action-btn cpn-action-btn--delete"
                      aria-label={`Delete coupon ${coupon.code}`}
                      title="Delete"
                    >
                      <Trash2 style={{ width: '0.9rem', height: '0.9rem' }} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <div className="cpn-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
          <div className="cpn-delete-modal">
            <div className="cpn-delete-icon" aria-hidden="true">
              <Trash2 style={{ width: '1.25rem', height: '1.25rem' }} />
            </div>
            <h3 className="cpn-delete-title" id="delete-modal-title">Delete Coupon?</h3>
            <p className="cpn-delete-desc">
              Are you sure you want to delete coupon{' '}
              <span className="cpn-delete-code">{deleteTarget.code}</span>?
              This action cannot be undone.
            </p>
            <div className="cpn-delete-actions">
              <button
                onClick={() => setDeleteTarget(null)}
                className="cpn-btn-delete-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="cpn-btn-delete-confirm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ── */}
      {showModal && (
        <div
          className="cpn-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="coupon-modal-title"
        >
          <div className="cpn-modal">
            {/* Modal Header */}
            <div className="cpn-modal-header">
              <div className="cpn-modal-header-text">
                <Tag style={{ width: '1.1rem', height: '1.1rem', color: 'rgba(255,255,255,0.85)' }} />
                <h3 className="cpn-modal-title" id="coupon-modal-title">
                  {editingCoupon ? 'Edit Coupon' : 'Create Coupon'}
                </h3>
              </div>
              <button
                onClick={handleCloseModal}
                className="cpn-modal-close"
                aria-label="Close modal"
              >
                <X style={{ width: '1.1rem', height: '1.1rem' }} />
              </button>
            </div>

            {/* Error inside modal */}
            {error && (
              <div className="cpn-alert cpn-alert-error" style={{ margin: '0.75rem 1.5rem 0', borderRadius: 'var(--cpn-radius-sm)' }} role="alert">
                <AlertCircle style={{ width: '0.9rem', height: '0.9rem', flexShrink: 0 }} />
                <span>{error}</span>
                <button onClick={() => setError('')} className="cpn-alert-dismiss" aria-label="Dismiss">
                  <X style={{ width: '0.8rem', height: '0.8rem' }} />
                </button>
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="cpn-modal-form" noValidate>

              {/* ── COUPON DETAILS ── */}
              <div className="cpn-form-section">
                <p className="cpn-form-section-title">Coupon Details</p>

                <div className="cpn-field">
                  <label htmlFor="cpn-code" className="cpn-label">
                    Coupon Code <span className="cpn-label-required" aria-hidden="true">*</span>
                  </label>
                  <input
                    id="cpn-code"
                    type="text"
                    required
                    placeholder="e.g. WELCOME20"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="cpn-input cpn-input--code"
                    autoComplete="off"
                    aria-required="true"
                  />
                </div>

                <div className="cpn-field">
                  <label htmlFor="cpn-desc" className="cpn-label">Description</label>
                  <input
                    id="cpn-desc"
                    type="text"
                    placeholder="e.g. Get 20% off on your first order"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="cpn-input"
                  />
                </div>
              </div>

              {/* ── DISCOUNT ── */}
              <div className="cpn-form-section">
                <p className="cpn-form-section-title">Discount</p>

                <div className="cpn-form-row">
                  <div className="cpn-field">
                    <label htmlFor="cpn-type" className="cpn-label">
                      Discount Type <span className="cpn-label-required" aria-hidden="true">*</span>
                    </label>
                    <select
                      id="cpn-type"
                      value={formData.discountType}
                      onChange={(e) => setFormData({ ...formData, discountType: e.target.value })}
                      className="cpn-select"
                      aria-required="true"
                    >
                      <option value="PERCENTAGE">Percentage (%)</option>
                      <option value="FIXED">Flat Amount (₹)</option>
                    </select>
                  </div>

                  <div className="cpn-field">
                    <label htmlFor="cpn-value" className="cpn-label">
                      Discount Value {formData.discountType === 'PERCENTAGE' ? '(%)' : '(₹)'}
                      <span className="cpn-label-required" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="cpn-value"
                      type="number"
                      required
                      min="0.01"
                      max={formData.discountType === 'PERCENTAGE' ? '100' : undefined}
                      step="any"
                      placeholder={formData.discountType === 'PERCENTAGE' ? 'e.g. 20' : 'e.g. 50'}
                      value={formData.discountValue}
                      onChange={(e) => setFormData({ ...formData, discountValue: e.target.value })}
                      className="cpn-input"
                      aria-required="true"
                    />
                  </div>
                </div>

                <div className="cpn-field">
                  <label htmlFor="cpn-maxdiscount" className="cpn-label">
                    Maximum Discount (₹)
                    {formData.discountType === 'FIXED' && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--cpn-text-muted)', fontWeight: 400, marginLeft: '0.25rem' }}>
                        (applies to % only)
                      </span>
                    )}
                  </label>
                  <input
                    id="cpn-maxdiscount"
                    type="number"
                    min="0"
                    placeholder="Optional max cap"
                    disabled={formData.discountType === 'FIXED'}
                    value={formData.maximumDiscount}
                    onChange={(e) => setFormData({ ...formData, maximumDiscount: e.target.value })}
                    className="cpn-input"
                    aria-disabled={formData.discountType === 'FIXED'}
                  />
                </div>
              </div>

              {/* ── ORDER REQUIREMENTS ── */}
              <div className="cpn-form-section">
                <p className="cpn-form-section-title">Order Requirements</p>

                <div className="cpn-field">
                  <label htmlFor="cpn-minorder" className="cpn-label">Minimum Order Amount (₹)</label>
                  <input
                    id="cpn-minorder"
                    type="number"
                    min="0"
                    placeholder="0 for no minimum"
                    value={formData.minimumOrderAmount}
                    onChange={(e) => setFormData({ ...formData, minimumOrderAmount: e.target.value })}
                    className="cpn-input"
                  />
                </div>
              </div>

              {/* ── USAGE ── */}
              <div className="cpn-form-section">
                <p className="cpn-form-section-title">Usage</p>

                <div className="cpn-field">
                  <label htmlFor="cpn-usagelimit" className="cpn-label">Usage Limit</label>
                  <input
                    id="cpn-usagelimit"
                    type="number"
                    min="1"
                    placeholder="Leave empty for unlimited"
                    value={formData.usageLimit}
                    onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value })}
                    className="cpn-input"
                  />
                </div>
              </div>

              {/* ── VALIDITY ── */}
              <div className="cpn-form-section">
                <p className="cpn-form-section-title">Validity</p>

                <div className="cpn-form-row">
                  <div className="cpn-field">
                    <label htmlFor="cpn-startdate" className="cpn-label">
                      Start Date <span className="cpn-label-required" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="cpn-startdate"
                      type="date"
                      required
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="cpn-input"
                      aria-required="true"
                    />
                  </div>

                  <div className="cpn-field">
                    <label htmlFor="cpn-enddate" className="cpn-label">
                      End Date <span className="cpn-label-required" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="cpn-enddate"
                      type="date"
                      required
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="cpn-input"
                      aria-required="true"
                    />
                  </div>
                </div>
              </div>

              {/* ── STATUS ── */}
              <div className="cpn-form-section">
                <p className="cpn-form-section-title">Status</p>

                <div className="cpn-toggle-field">
                  <input
                    type="checkbox"
                    id="cpn-isactive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="cpn-checkbox"
                  />
                  <label htmlFor="cpn-isactive" className="cpn-toggle-label">
                    Activate coupon immediately
                  </label>
                </div>
              </div>

              {/* ── LIVE PREVIEW ── */}
              {(formData.code || previewDiscount) && (
                <div className="cpn-form-section">
                  <p className="cpn-form-section-title">Preview</p>
                  <div className="cpn-preview" aria-live="polite" aria-label="Coupon preview">
                    {formData.code && (
                      <span className="cpn-preview-code">{formData.code}</span>
                    )}
                    {previewDiscount && (
                      <p className="cpn-preview-discount">{previewDiscount}</p>
                    )}
                    {Number(formData.minimumOrderAmount) > 0 && (
                      <p className="cpn-preview-detail">
                        Min. order ₹{formData.minimumOrderAmount}
                      </p>
                    )}
                    {formData.endDate && (
                      <p className="cpn-preview-detail">
                        Valid until{' '}
                        {new Date(formData.endDate).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ── Modal Footer ── */}
              <div className="cpn-modal-footer" style={{ padding: '0', borderTop: '1px solid var(--cpn-border-light)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="cpn-btn-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="cpn-btn-submit"
                >
                  {saving ? 'Saving...' : editingCoupon ? 'Update Coupon' : 'Create Coupon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
