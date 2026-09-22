import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ShoppingCart, Trash2, Plus, Minus, ArrowLeft, ArrowRight, Store, AlertCircle, ShoppingBag } from 'lucide-react';

export default function CartPage() {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    try {
      setLoading(true);
      const res = await api.get('/cart');
      if (res && res.success) {
        setCart(res.data);
      }
    } catch (err) {
      console.error('Failed to load cart:', err);
      setError(err.message || 'Failed to load cart');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateQuantity = async (productId, newQuantity) => {
    try {
      setUpdatingId(productId);
      setError('');
      const res = await api.put(`/cart/item/${productId}`, { quantity: newQuantity });
      if (res && res.success) {
        setCart(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to update quantity');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRemoveItem = async (productId) => {
    try {
      setUpdatingId(productId);
      setError('');
      const res = await api.delete(`/cart/item/${productId}`);
      if (res && res.success) {
        setCart(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to remove item');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleClearCart = async () => {
    if (!window.confirm('Are you sure you want to clear your cart?')) return;
    try {
      setLoading(true);
      const res = await api.delete('/cart/clear');
      if (res && res.success) {
        setCart(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to clear cart');
    } finally {
      setLoading(false);
    }
  };

  // Calculate Subtotal & Totals
  const items = cart?.items || [];
  const subtotal = items.reduce((acc, item) => acc + (item.price || 0) * item.quantity, 0);
  const packingCharges = items.reduce(
    (acc, item) => acc + (Number(item.product?.packingCharges) || 0) * item.quantity,
    0
  );
  const shop = items.length > 0 ? items[0].shop : null;
  const deliveryFee = shop?.deliveryFee !== undefined ? shop.deliveryFee : 0;
  const total = subtotal + packingCharges + (items.length > 0 ? deliveryFee : 0);

  if (loading) {
    return (
      <div className="container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
        <p style={{ color: 'var(--text-muted)' }}>Loading your CampusCart...</p>
      </div>
    );
  }

  if (!cart || items.length === 0) {
    return (
      <div className="container" style={{ padding: '4rem 1rem', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{
          background: 'var(--surface)',
          borderRadius: '1rem',
          border: '1px solid var(--border-color)',
          padding: '3rem 2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.25rem'
        }}>
          <div style={{
            background: 'var(--surface-hover)',
            padding: '1.25rem',
            borderRadius: '50%',
            color: 'var(--primary)'
          }}>
            <ShoppingBag size={48} />
          </div>
          <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', margin: 0 }}>Your cart is empty</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>
            Looks like you haven't added any products from campus shops yet.
          </p>
          <Link to="/student" className="btn-primary" style={{ padding: '0.75rem 1.5rem', marginTop: '0.5rem' }}>
            <ArrowLeft size={18} /> Explore Campus Shops
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
            Shopping Cart
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Ordering from <strong style={{ color: 'var(--primary)' }}>{shop?.name || 'Campus Shop'}</strong>
          </p>
        </div>
        <button
          onClick={handleClearCart}
          className="btn-secondary"
          style={{ color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
        >
          <Trash2 size={16} /> Clear Cart
        </button>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--danger)',
          color: '#f87171',
          padding: '0.85rem 1.25rem',
          borderRadius: '0.5rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }} className="cart-grid">
        {/* Left Column: Cart Items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {items.map((item) => {
            const product = item.product || {};
            const itemImage = product.images && product.images.length > 0 ? product.images[0] : null;

            return (
              <div
                key={item.product?._id || item._id}
                style={{
                  background: 'var(--surface)',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--border-color)',
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.25rem',
                  flexWrap: 'wrap',
                  opacity: updatingId === (product._id || item.product) ? 0.6 : 1,
                  transition: 'opacity 0.2s',
                }}
              >
                {/* Product Image */}
                <div style={{ width: '80px', height: '80px', borderRadius: '0.5rem', overflow: 'hidden', background: '#f1f5f9', border: '1px solid var(--border-color)', flexShrink: 0 }}>

                  {itemImage ? (
                    <img src={itemImage} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      <ShoppingBag size={28} />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <Link to={`/student/products/${product._id}`} style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '1.05rem', textDecoration: 'none' }}>
                    {product.name || 'Product'}
                  </Link>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                    Unit: {product.unit || 'Item'}
                  </div>
                  {Number(product.packingCharges) > 0 && (
                    <div style={{ color: '#0369a1', fontSize: '0.8rem', marginTop: '0.2rem', fontWeight: '600' }}>
                      Packing: ₹{product.packingCharges} × {item.quantity} = ₹{(product.packingCharges * item.quantity).toFixed(2)}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '0.4rem' }}>
                    <span style={{ color: 'var(--primary)', fontWeight: '700', fontSize: '1rem' }}>
                      ₹{item.price}
                    </span>
                    {product.discountPrice != null && product.discountPrice < product.price && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                        ₹{product.price}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quantity Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--surface-hover)', padding: '0.25rem 0.5rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                  <button
                    onClick={() => handleUpdateQuantity(product._id, item.quantity - 1)}
                    disabled={updatingId === product._id}
                    style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '0.25rem', display: 'flex' }}
                  >
                    <Minus size={16} />
                  </button>
                  <span style={{ fontWeight: '700', minWidth: '24px', textAlign: 'center', fontSize: '0.95rem' }}>
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => handleUpdateQuantity(product._id, item.quantity + 1)}
                    disabled={updatingId === product._id || (product.stock !== undefined && item.quantity >= product.stock)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '0.25rem', display: 'flex' }}
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {/* Item Subtotal & Remove */}
                <div style={{ textAlign: 'right', minWidth: '90px' }}>
                  <div style={{ fontWeight: '800', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                    ₹{(item.price * item.quantity).toFixed(2)}
                  </div>
                  <button
                    onClick={() => handleRemoveItem(product._id)}
                    disabled={updatingId === product._id}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--danger)',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      marginTop: '0.4rem',
                      padding: 0,
                    }}
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </div>
            );
          })}

          <div style={{ marginTop: '0.5rem' }}>
            <Link to="/student" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <ArrowLeft size={16} /> Add more items from shop
            </Link>
          </div>
        </div>

        {/* Right Column: Order Summary */}
        <div>
          <div style={{
            background: 'var(--surface)',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-color)',
            padding: '1.5rem',
            position: 'sticky',
            top: '5.5rem',
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', pb: '0.75rem' }}>
              Order Summary
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.95rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Item Subtotal ({items.reduce((sum, i) => sum + i.quantity, 0)} items)</span>
                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>₹{subtotal.toFixed(2)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Packing Charges</span>
                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                  ₹{packingCharges.toFixed(2)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Delivery Fee</span>
                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                  {deliveryFee > 0 ? `₹${deliveryFee.toFixed(2)}` : 'FREE'}
                </span>
              </div>

              <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.5rem 0' }}></div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: '800' }}>
                <span style={{ color: 'var(--text-primary)' }}>Total Amount</span>
                <span style={{ color: 'var(--primary)' }}>₹{total.toFixed(2)}</span>
              </div>
            </div>

            {shop?.minimumOrder > 0 && subtotal < shop.minimumOrder && (
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem', marginTop: '1rem' }}>
                Minimum order amount for {shop.name} is ₹{shop.minimumOrder}. Add ₹{(shop.minimumOrder - subtotal).toFixed(2)} more to proceed.
              </div>
            )}

            <button
              onClick={() => navigate('/checkout')}
              disabled={shop?.minimumOrder > 0 && subtotal < shop.minimumOrder}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '0.85rem',
                fontSize: '1rem',
                fontWeight: '700',
                marginTop: '1.5rem',
                justifyContent: 'center',
              }}
            >
              Proceed to Checkout <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 900px) {
          .cart-grid {
            grid-template-columns: 1fr 340px !important;
          }
        }
      `}</style>
    </div>
  );
}
