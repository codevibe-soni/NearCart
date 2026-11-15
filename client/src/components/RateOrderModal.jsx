import React, { useState, useEffect } from 'react';
import { Star, CheckCircle, X, Store, Truck, Package, MessageSquare, AlertCircle } from 'lucide-react';
import api from '../services/api';

export default function RateOrderModal({ order, isOpen, onClose, onReviewSubmitted }) {
  const [existingReviews, setExistingReviews] = useState([]);
  const [loadingExisting, setLoadingExisting] = useState(true);

  // Ratings & comments state keyed by target ID / key
  // shop: { rating: 0, comment: '' }
  // delivery: { rating: 0, comment: '' }
  // products: { [productId]: { rating: 0, comment: '' } }
  const [shopReview, setShopReview] = useState({ rating: 5, comment: '' });
  const [deliveryReview, setDeliveryReview] = useState({ rating: 5, comment: '' });
  const [productReviews, setProductReviews] = useState({});
  const [submittingKey, setSubmittingKey] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (isOpen && order?._id) {
      fetchOrderReviews();
      // Initialize product reviews state
      if (order.items && order.items.length > 0) {
        const initialProds = {};
        order.items.forEach((item) => {
          if (item.product) {
            const prodId = typeof item.product === 'object' ? item.product._id : item.product;
            initialProds[prodId] = { rating: 5, comment: '' };
          }
        });
        setProductReviews(initialProds);
      }
    }
  }, [isOpen, order]);

  const fetchOrderReviews = async () => {
    setLoadingExisting(true);
    setErrorMsg('');
    try {
      const res = await api.get(`/reviews/order/${order._id}`);
      if (res && res.success) {
        setExistingReviews(res.data || []);
      } else {
        setExistingReviews([]);
      }
    } catch (err) {
      console.error('Failed to load order reviews:', err);
    } finally {
      setLoadingExisting(false);
    }
  };

  if (!isOpen || !order) return null;

  const shopDoc = order.shop || {};
  const deliveryBoy = order.deliveryBoy || null;

  // Check reviewed status
  const existingShopReview = existingReviews.find((r) => r.type === 'SHOP');
  const existingDeliveryReview = existingReviews.find((r) => r.type === 'DELIVERY');
  const existingProductReviewsMap = {};
  existingReviews
    .filter((r) => r.type === 'PRODUCT' && r.product)
    .forEach((r) => {
      const pId = typeof r.product === 'object' ? r.product._id : r.product;
      existingProductReviewsMap[pId] = r;
    });

  const submitSingleReview = async (type, payload, targetKey) => {
    try {
      setSubmittingKey(targetKey);
      setErrorMsg('');
      setSuccessMsg('');

      const res = await api.post('/reviews', {
        type,
        orderId: order._id,
        ...payload,
      });

      if (res && res.success) {
        setSuccessMsg('Review submitted successfully!');
        await fetchOrderReviews();
        if (onReviewSubmitted) onReviewSubmitted(res.data);
      } else if (res && !res.success && res.message && /already submitted/i.test(res.message)) {
        // Duplicate review – refresh existing reviews to hide this target
        setErrorMsg('You have already submitted this review.');
        await fetchOrderReviews();
      } else {
        setErrorMsg(res && res.message ? res.message : 'Failed to submit review');
      }
    } catch (err) {
      console.error('Review submit error:', err);
      const msg = err?.response?.data?.message || err.message || 'Failed to submit review';
      if (/already submitted/i.test(msg)) {
        setErrorMsg('You have already submitted this review.');
        await fetchOrderReviews();
      } else {
        setErrorMsg(msg);
      }
    } finally {
      setSubmittingKey(null);
    }
  };

  const renderStarRating = (currentRating, onRatingChange, disabled = false) => {
    return (
      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onRatingChange(star)}
            style={{
              background: 'none',
              border: 'none',
              padding: '0.2rem',
              cursor: disabled ? 'default' : 'pointer',
              color: star <= currentRating ? '#f59e0b' : '#cbd5e1',
              transition: 'transform 0.15s ease',
            }}
          >
            <Star size={24} fill={star <= currentRating ? '#f59e0b' : 'none'} strokeWidth={1.5} />
          </button>
        ))}
        <span style={{ fontSize: '0.9rem', fontWeight: '700', marginLeft: '0.4rem', color: '#f59e0b' }}>
          {currentRating} / 5
        </span>
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: 'var(--surface, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '1rem',
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border-color, #e2e8f0)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'var(--surface-hover, #f8fafc)',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              Rate Your Order #{order.orderNumber}
            </h2>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              Share your feedback for shop, delivery partner, and items
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: '0.5rem',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {errorMsg && (
            <div
              style={{
                background: '#fee2e2',
                border: '1px solid #fca5a5',
                color: '#b91c1c',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <AlertCircle size={16} /> {errorMsg}
            </div>
          )}

          {successMsg && (
            <div
              style={{
                background: '#d1fae5',
                border: '1px solid #a7f3d0',
                color: '#047857',
                padding: '0.75rem 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <CheckCircle size={16} /> {successMsg}
            </div>
          )}

          {loadingExisting ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div className="spinner" style={{ margin: '0 auto 0.5rem auto' }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading review status...</p>
            </div>
          ) : (
            <>
              {/* SECTION 1: SHOP REVIEW */}
              <div
                style={{
                  background: 'var(--surface-hover, #f8fafc)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: '0.75rem',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Store size={18} style={{ color: 'var(--primary)' }} />
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      Shop: {shopDoc.name || 'Campus Shop'}
                    </h3>
                  </div>
                  {existingShopReview && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        background: '#d1fae5',
                        color: '#047857',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '1rem',
                      }}
                    >
                      <CheckCircle size={13} /> Reviewed ({existingShopReview.rating}★)
                    </span>
                  )}
                </div>

                {existingShopReview ? (
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    "{existingShopReview.comment || 'No comment provided'}"
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {renderStarRating(shopReview.rating, (val) => setShopReview({ ...shopReview, rating: val }))}
                    <textarea
                      rows={2}
                      placeholder="Optional comment about the shop service..."
                      value={shopReview.comment}
                      onChange={(e) => setShopReview({ ...shopReview, comment: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.6rem',
                        borderRadius: '0.5rem',
                        border: '1px solid var(--border-color, #cbd5e1)',
                        fontSize: '0.85rem',
                        resize: 'vertical',
                      }}
                    />
                    <button
                      type="button"
                      disabled={submittingKey === 'shop'}
                      onClick={() =>
                        submitSingleReview(
                          'SHOP',
                          { shopId: shopDoc._id, rating: shopReview.rating, comment: shopReview.comment },
                          'shop'
                        )
                      }
                      className="btn-primary"
                      style={{ alignSelf: 'flex-end', padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                    >
                      {submittingKey === 'shop' ? 'Submitting...' : 'Submit Shop Review'}
                    </button>
                  </div>
                )}
              </div>

              {/* SECTION 2: DELIVERY BOY REVIEW */}
              {deliveryBoy && (
                <div
                  style={{
                    background: 'var(--surface-hover, #f8fafc)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '0.75rem',
                    padding: '1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Truck size={18} style={{ color: 'var(--primary)' }} />
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                        Delivery Partner: {deliveryBoy.name || 'Delivery Boy'}
                      </h3>
                    </div>
                    {existingDeliveryReview && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          background: '#d1fae5',
                          color: '#047857',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '1rem',
                        }}
                      >
                        <CheckCircle size={13} /> Reviewed ({existingDeliveryReview.rating}★)
                      </span>
                    )}
                  </div>

                  {existingDeliveryReview ? (
                    <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      "{existingDeliveryReview.comment || 'No comment provided'}"
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {renderStarRating(deliveryReview.rating, (val) => setDeliveryReview({ ...deliveryReview, rating: val }))}
                      <textarea
                        rows={2}
                        placeholder="Optional comment about delivery experience..."
                        value={deliveryReview.comment}
                        onChange={(e) => setDeliveryReview({ ...deliveryReview, comment: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.6rem',
                          borderRadius: '0.5rem',
                          border: '1px solid var(--border-color, #cbd5e1)',
                          fontSize: '0.85rem',
                          resize: 'vertical',
                        }}
                      />
                      <button
                        type="button"
                        disabled={submittingKey === 'delivery'}
                        onClick={() =>
                          submitSingleReview(
                            'DELIVERY',
                            { deliveryBoyId: deliveryBoy._id, rating: deliveryReview.rating, comment: deliveryReview.comment },
                            'delivery'
                          )
                        }
                        className="btn-primary"
                        style={{ alignSelf: 'flex-end', padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                      >
                        {submittingKey === 'delivery' ? 'Submitting...' : 'Submit Delivery Review'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 3: PRODUCTS REVIEWS */}
              <div
                style={{
                  background: 'var(--surface-hover, #f8fafc)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: '0.75rem',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <Package size={18} style={{ color: 'var(--primary)' }} />
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                    Product Ratings
                  </h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {order.items &&
                    order.items.map((item, idx) => {
                      if (!item.product) return null;
                      const prodId = typeof item.product === 'object' ? item.product._id : item.product;
                      const existingPReview = existingProductReviewsMap[prodId];
                      const pState = productReviews[prodId] || { rating: 5, comment: '' };

                      return (
                        <div
                          key={idx}
                          style={{
                            background: '#ffffff',
                            padding: '1rem',
                            borderRadius: '0.5rem',
                            border: '1px solid var(--border-color, #e2e8f0)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ fontWeight: '700', fontSize: '0.925rem', color: 'var(--text-primary)' }}>
                              {item.name}
                            </span>
                            {existingPReview && (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.2rem',
                                  background: '#d1fae5',
                                  color: '#047857',
                                  fontSize: '0.75rem',
                                  fontWeight: '700',
                                  padding: '0.15rem 0.5rem',
                                  borderRadius: '1rem',
                                }}
                              >
                                <CheckCircle size={12} /> Reviewed ({existingPReview.rating}★)
                              </span>
                            )}
                          </div>
                          {existingPReview ? (
                            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              "{existingPReview.comment || 'No comment provided'}"
                            </p>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                              {renderStarRating(pState.rating, (val) =>
                                setProductReviews({
                                  ...productReviews,
                                  [prodId]: { ...pState, rating: val },
                                })
                              )}
                              <input
                                type="text"
                                placeholder="Optional comment for this product..."
                                value={pState.comment}
                                onChange={(e) =>
                                  setProductReviews({
                                    ...productReviews,
                                    [prodId]: { ...pState, comment: e.target.value },
                                  })
                                }
                                style={{
                                  width: '100%',
                                  padding: '0.5rem',
                                  borderRadius: '0.4rem',
                                  border: '1px solid var(--border-color, #cbd5e1)',
                                  fontSize: '0.825rem',
                                }}
                              />
                              <button
                                type="button"
                                disabled={submittingKey === `product_${prodId}`}
                                onClick={() =>
                                  submitSingleReview(
                                    'PRODUCT',
                                    { productId: prodId, rating: pState.rating, comment: pState.comment },
                                    `product_${prodId}`
                                  )
                                }
                                className="btn-primary"
                                style={{ alignSelf: 'flex-end', padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}
                              >
                                {submittingKey === `product_${prodId}` ? 'Submitting...' : 'Submit Product Review'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border-color, #e2e8f0)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            background: 'var(--surface-hover, #f8fafc)',
          }}
        >
          <button onClick={onClose} className="btn-secondary" style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}>
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
