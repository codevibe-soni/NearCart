import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getProductById } from '../../services/studentService';
import api from '../../services/api';
import { LoadingSpinner } from '../../components/StudentUIComponents';
import { ArrowLeft, ChevronLeft, ChevronRight, X, Maximize2, ShoppingCart, Zap, Plus, Minus, Star, MessageSquare, User } from 'lucide-react';

export default function ProductDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Quantity state
  const [selectedQuantity, setSelectedQuantity] = useState(1);

  // Cart action state
  const [addingToCart, setAddingToCart] = useState(false);
  const [showShopConflictModal, setShowShopConflictModal] = useState(false);
  const [conflictMessage, setConflictMessage] = useState('');

  // Gallery state
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);

  const handleAddToCart = async (clearCartFirst = false) => {
    try {
      setAddingToCart(true);
      setShowShopConflictModal(false);
      const res = await api.post('/cart/add', {
        productId: product._id,
        quantity: selectedQuantity,
        clearCartFirst,
      });

      if (res && res.success) {
        navigate('/cart');
      }
    } catch (err) {
      if (err.status === 409 || err.response?.status === 409 || err.differentShop) {
        setConflictMessage(err.message || err.response?.data?.message);
        setShowShopConflictModal(true);
      } else {
        alert(err.message || err.response?.data?.message || 'Failed to add item to cart');
      }
    } finally {
      setAddingToCart(false);
    }
  };

  const handleBuyNow = () => {
    if (!product || product.stock <= 0) return;
    const effectivePrice =
      product.discountPrice != null && product.discountPrice < product.price
        ? product.discountPrice
        : product.price;

    // const buyNowItem = {
    //   product: {
    //     _id: product._id,
    //     name: product.name,
    //     price: product.price,
    //     discountPrice: product.discountPrice,
    //     images: product.images,
    //     unit: product.unit,
    //     stock: product.stock,
    //     shop: product.shop,
    //   },
    //   quantity: selectedQuantity,
    //   effectivePrice,
    //   shop: product.shop,
    // };
    const buyNowItem = {
      product: {
        _id: product._id,
        name: product.name,
        price: product.price,
        discountPrice: product.discountPrice,
        images: product.images,
        unit: product.unit,
        stock: product.stock,
        gstPercentage: Number(product.gstPercentage) || 0,
        packingCharges: Number(product.packingCharges) || 0,
        shop: product.shop,
      },
      quantity: selectedQuantity,
      effectivePrice,
      shop: product.shop,
    };

    navigate('/checkout', { state: { buyNowItem } });
  };

  // Reviews state
  const [reviews, setReviews] = useState([]);
  const [reviewStats, setReviewStats] = useState({ avgRating: 0, totalRatings: 0, starCounts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } });
  const [reviewsLoading, setReviewsLoading] = useState(false);

  useEffect(() => {
    async function fetchProduct() {
      setLoading(true);
      setError('');
      try {
        const res = await getProductById(id);
        if (res.success && res.product) {
          setProduct(res.product);
          setSelectedImageIndex(0);
        } else {
          setError(res.message || 'Product not found');
        }
      } catch (err) {
        setError(err.message || 'Product details unavailable');
      } finally {
        setLoading(false);
      }
    }

    async function fetchReviews() {
      try {
        setReviewsLoading(true);
        const res = await api.get(`/reviews/product/${id}`);
        if (res && res.success) {
          setReviews(res.data || []);
          setReviewStats({
            avgRating: res.avgRating || 0,
            totalRatings: res.totalRatings || 0,
            starCounts: res.starCounts || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
          });
        }
      } catch (err) {
        console.error('Failed to fetch product reviews:', err);
      } finally {
        setReviewsLoading(false);
      }
    }

    fetchProduct();
    fetchReviews();
  }, [id]);

  if (loading) return <LoadingSpinner />;

  if (error || !product) {
    return (
      <div className="container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        <div className="glass-card" style={{ maxWidth: '500px', margin: '0 auto' }}>
          <h3 style={{ fontSize: '1.5rem', color: 'var(--danger)', marginBottom: '1rem' }}>{error || 'Product Unavailable'}</h3>
          <button onClick={() => navigate('/student')} className="btn-secondary">
            Back to Student Dashboard
          </button>
        </div>
      </div>
    );
  }

  const imagesList = Array.isArray(product.images) && product.images.length > 0 ? product.images : [];
  const currentImage = imagesList[selectedImageIndex] || null;

  const hasDiscount = product.discountPrice !== undefined && product.discountPrice !== null && product.discountPrice < product.price;
  const discountPercent = hasDiscount ? Math.round(((product.price - product.discountPrice) / product.price) * 100) : 0;

  const handlePrevImage = (e) => {
    if (e) e.stopPropagation();
    setSelectedImageIndex((prev) => (prev === 0 ? imagesList.length - 1 : prev - 1));
  };

  const handleNextImage = (e) => {
    if (e) e.stopPropagation();
    setSelectedImageIndex((prev) => (prev === imagesList.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem 5rem 1.5rem' }}>
      <button
        onClick={() => navigate(-1)}
        className="btn-secondary"
        style={{ marginBottom: '2rem', padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div
        className="glass-card"
        style={{
          padding: '2.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '2.5rem',
          alignItems: 'start',
        }}
      >
        {/* Product Image Gallery Box */}
        <div>
          <div
            onClick={() => currentImage && setShowLightbox(true)}
            style={{
              width: '100%',
              height: '340px',
              borderRadius: 'var(--radius-md)',
              background: '#f1f5f9',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              overflow: 'hidden',
              position: 'relative',
              cursor: currentImage ? 'pointer' : 'default',
            }}
          >
            {currentImage ? (
              <>
                <img
                  src={currentImage}
                  alt={product.name}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '0.75rem',
                    right: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.85)',
                    padding: '0.35rem',
                    borderRadius: '0.375rem',
                    color: 'var(--text-primary)',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                  }}
                >
                  <Maximize2 size={16} />
                </div>
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>No Image Available</span>
            )}

            {/* Prev / Next controls on Main Image */}
            {imagesList.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrevImage}
                  style={{
                    position: 'absolute',
                    left: '0.5rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid var(--border-color)',
                    color: '#0f172a',
                    borderRadius: '50%',
                    padding: '0.4rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                  }}
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={handleNextImage}
                  style={{
                    position: 'absolute',
                    right: '0.5rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'rgba(255, 255, 255, 0.9)',
                    border: '1px solid var(--border-color)',
                    color: '#0f172a',
                    borderRadius: '50%',
                    padding: '0.4rem',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                  }}
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>

          {/* Thumbnail Strip */}
          {imagesList.length > 1 && (
            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
              {imagesList.map((imgUrl, idx) => (
                <div
                  key={idx}
                  onClick={() => setSelectedImageIndex(idx)}
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '0.375rem',
                    border: idx === selectedImageIndex ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                    background: '#f1f5f9',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    flexShrink: 0,
                    opacity: idx === selectedImageIndex ? 1 : 0.6,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <img src={imgUrl} alt={`Thumb ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Product Info Column */}
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {product.category?.name || 'Category'}
          </span>

          <h1 style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--text-primary)', margin: '0.5rem 0 1rem 0' }}>
            {product.name}
          </h1>

          {/* Pricing */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '2.2rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              ₹{hasDiscount ? product.discountPrice : product.price}
            </span>
            {hasDiscount && (
              <>
                <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                  ₹{product.price}
                </span>
                <span style={{ background: 'var(--danger)', color: '#fff', fontSize: '0.75rem', fontWeight: '700', padding: '0.25rem 0.6rem', borderRadius: '0.25rem' }}>
                  SAVE {discountPercent}%
                </span>
              </>
            )}
            {product.unit && <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>per {product.unit}</span>}
          </div>

          {/* GST Info */}
          {product.gstPercentage > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#6b7280', background: '#f3f4f6', padding: '0.2rem 0.6rem', borderRadius: '0.25rem', display: 'inline-block' }}>
                Price inclusive of {product.gstPercentage}% GST
              </span>
            </div>
          )}

          {/* Packing Charges Info */}
          {Number(product.packingCharges) > 0 && (
            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#0369a1', background: '#e0f2fe', padding: '0.25rem 0.65rem', borderRadius: '0.25rem', display: 'inline-block' }}>
                Packing: ₹{product.packingCharges} / item
              </span>
            </div>
          )}

          {/* Status badge */}
          <div style={{ marginBottom: '1.5rem' }}>
            <span
              style={{
                padding: '0.3rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.8rem',
                fontWeight: '700',
                background: product.stock > 0 ? '#d1fae5' : '#fee2e2',
                color: product.stock > 0 ? '#047857' : '#b91c1c',
                border: `1px solid ${product.stock > 0 ? '#a7f3d0' : '#fca5a5'}`,
              }}
            >
              {product.stock > 0 ? `In Stock (${product.stock} available)` : 'Currently Out of Stock'}
            </span>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '2rem' }}>
            {product.description || 'No detailed product description available.'}
          </p>

          {/* Associated Shop Card */}
          {product.shop && (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '1.25rem',
                marginBottom: '2rem',
                display: 'flex',
                justify: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Sold & Fulfilled by</span>
                <strong style={{ color: 'var(--text-primary)', fontSize: '1rem' }}>{product.shop.name}</strong>
                <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  📍 {product.shop.address}
                </span>
              </div>
              <button
                onClick={() => navigate(`/student/shops/${product.shop._id}`)}
                className="btn-secondary"
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
              >
                View Shop
              </button>
            </div>
          )}

          {/* Quantity Selector & Buy Now / Add to Cart Actions */}
          {product.stock > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', marginTop: '1.5rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)' }}>Quantity:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#f1f5f9', padding: '0.3rem 0.6rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => setSelectedQuantity((prev) => Math.max(1, prev - 1))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem', display: 'flex', color: 'var(--text-primary)' }}
                >
                  <Minus size={16} />
                </button>
                <span style={{ fontWeight: '800', minWidth: '28px', textAlign: 'center', fontSize: '1rem', color: 'var(--text-primary)' }}>
                  {selectedQuantity}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedQuantity((prev) => Math.min(product.stock, prev + 1))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem', display: 'flex', color: 'var(--text-primary)' }}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
            <button
              onClick={() => handleAddToCart(false)}
              disabled={addingToCart || product.stock <= 0}
              className="btn-secondary"
              style={{
                width: '100%',
                padding: '0.85rem',
                fontSize: '0.95rem',
                fontWeight: '700',
                justifyContent: 'center',
                opacity: addingToCart || product.stock <= 0 ? 0.6 : 1,
              }}
            >
              <ShoppingCart size={18} />
              {product.stock <= 0 ? 'Out of Stock' : addingToCart ? 'Adding...' : 'Add to Cart'}
            </button>

            <button
              onClick={handleBuyNow}
              disabled={product.stock <= 0}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '0.85rem',
                fontSize: '0.95rem',
                fontWeight: '800',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                opacity: product.stock <= 0 ? 0.6 : 1,
              }}
            >
              <Zap size={18} />
              BUY NOW
            </button>
          </div>
        </div>
      </div>

      {/* Product Reviews & Ratings Section */}
      <div
        style={{
          marginTop: '2.5rem',
          background: 'var(--surface, #ffffff)',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: '1rem',
          padding: '1.75rem',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MessageSquare size={20} style={{ color: 'var(--primary)' }} /> Customer Reviews & Ratings
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* Aggregate Card */}
          <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', fontWeight: '900', color: 'var(--text-primary)', lineHeight: '1' }}>
              {reviewStats.avgRating > 0 ? reviewStats.avgRating.toFixed(1) : (product.rating || 0).toFixed(1)}
              <span style={{ fontSize: '1.5rem', color: '#f59e0b', marginLeft: '0.2rem' }}>★</span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.5rem 0 0 0' }}>
              Based on {reviewStats.totalRatings || product.totalRatings || 0} customer ratings
            </p>
          </div>

          {/* Star Distribution Breakdown */}
          <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', justifyContent: 'center' }}>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = reviewStats.starCounts[star] || 0;
              const pct = reviewStats.totalRatings > 0 ? Math.round((count / reviewStats.totalRatings) * 100) : 0;
              return (
                <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                  <span style={{ width: '35px', color: 'var(--text-secondary)', fontWeight: '600' }}>{star} ★</span>
                  <div style={{ flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: '#f59e0b', borderRadius: '4px' }}></div>
                  </div>
                  <span style={{ width: '35px', textAlign: 'right', color: 'var(--text-muted)' }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Reviews List */}
        {reviewsLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="spinner" style={{ margin: '0 auto 0.5rem auto' }}></div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading reviews...</p>
          </div>
        ) : reviews.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px dashed var(--border-color)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
              No reviews submitted for this product yet.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {reviews.map((rev) => {
              const uName = rev.user?.name || 'Verified Student';
              const uImg = rev.user?.profileImage;
              const dateStr = new Date(rev.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              });

              return (
                <div key={rev._id} style={{ padding: '1rem 1.25rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)', background: '#ffffff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '50%', background: 'var(--primary-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontWeight: '800', fontSize: '0.9rem', overflow: 'hidden' }}>
                        {uImg ? <img src={uImg} alt={uName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : uName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.925rem', fontWeight: '700', color: 'var(--text-primary)' }}>{uName}</h4>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{dateStr}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.15rem', color: '#f59e0b' }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} size={15} fill={s <= rev.rating ? '#f59e0b' : 'none'} strokeWidth={1.5} />
                      ))}
                    </div>
                  </div>

                  {rev.comment && (
                    <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                      "{rev.comment}"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Different Shop Confirmation Modal */}
      {showShopConflictModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justify: 'center',
          zIndex: 1000,
          padding: '1rem',
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid var(--border-color)',
            borderRadius: '0.75rem',
            padding: '1.75rem',
            maxWidth: '450px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
          }}>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              Items from another shop in cart
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
              {conflictMessage || 'Your cart contains products from another shop. Clear existing cart and add this product?'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
              <button
                onClick={() => setShowShopConflictModal(false)}
                className="btn-secondary"
                style={{ padding: '0.6rem 1.25rem' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleAddToCart(true)}
                className="btn-primary"
                style={{ padding: '0.6rem 1.25rem' }}
              >
                Clear Cart & Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {showLightbox && currentImage && (
        <div
          onClick={() => setShowLightbox(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justify: 'center',
            zIndex: 300,
            padding: '2rem',
          }}
        >
          <button
            onClick={() => setShowLightbox(false)}
            style={{
              position: 'absolute',
              top: '1.5rem',
              right: '1.5rem',
              background: 'none',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            <X size={28} />
          </button>

          {imagesList.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrevImage}
                style={{
                  position: 'absolute',
                  left: '1.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid var(--border-color)',
                  color: '#fff',
                  borderRadius: '50%',
                  padding: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                <ChevronLeft size={28} />
              </button>
              <button
                type="button"
                onClick={handleNextImage}
                style={{
                  position: 'absolute',
                  right: '1.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid var(--border-color)',
                  color: '#fff',
                  borderRadius: '50%',
                  padding: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                <ChevronRight size={28} />
              </button>
            </>
          )}

          <img
            src={currentImage}
            alt={product.name}
            style={{ maxWidth: '90%', maxHeight: '85vh', objectFit: 'contain', borderRadius: '0.5rem' }}
          />
        </div>
      )}
    </div>
  );
}
