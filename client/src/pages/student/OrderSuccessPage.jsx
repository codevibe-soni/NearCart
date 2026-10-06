import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';
import { CheckCircle, ShoppingBag, MapPin, CreditCard, Clock, ArrowLeft, Package } from 'lucide-react';

export default function OrderSuccessPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/orders/${orderId}`);
      if (res && res.success) {
        setOrder(res.data);
      }
    } catch (err) {
      console.error('Failed to load order:', err);
      setError(err.message || 'Failed to load order confirmation details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
        <p style={{ color: 'var(--text-muted)' }}>Fetching order confirmation...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container" style={{ padding: '4rem 1rem', maxWidth: '500px', textAlign: 'center' }}>
        <div style={{ background: 'var(--surface)', padding: '2rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
          <p style={{ color: 'var(--danger)', marginBottom: '1.5rem' }}>{error || 'Order not found'}</p>
          <Link to="/orders" className="btn-primary" style={{ padding: '0.6rem 1.25rem' }}>
            View My Orders
          </Link>
        </div>
      </div>
    );
  }

  const shop = order.shop || {};
  const address = order.address || {};

  return (
    <div className="container" style={{ padding: '3rem 1rem', maxWidth: '680px', margin: '0 auto' }}>
      <div style={{
        background: 'var(--surface)',
        borderRadius: '1rem',
        border: '1px solid var(--border-color)',
        padding: '2.5rem 2rem',
        textAlign: 'center',
      }}>
        {/* Success Icon */}
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: 'rgba(16, 185, 129, 0.15)',
          color: 'var(--success)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.25rem auto',
        }}>
          <CheckCircle size={44} />
        </div>

        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
          Order Placed Successfully!
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: '0 0 1.5rem 0' }}>
          Thank you for ordering with CampusCart. Your shop has received the order.
        </p>

        {/* Order Number Badge */}
        <div style={{
          display: 'inline-block',
          background: 'rgba(56, 189, 248, 0.1)',
          border: '1px solid var(--primary)',
          color: 'var(--primary)',
          fontWeight: '800',
          fontSize: '1.1rem',
          padding: '0.5rem 1.25rem',
          borderRadius: '2rem',
          marginBottom: '2rem',
          letterSpacing: '0.05em',
        }}>
          Order Number: {order.orderNumber}
        </div>

        {/* Details Grid */}
        <div style={{
          textAlign: 'left',
          background: '#f8fafc',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          fontSize: '0.9rem',
          marginBottom: '2rem',
        }}>
          {/* Shop */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Shop Name</span>
            <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{shop.name || 'Campus Shop'}</span>
          </div>

          {/* Status */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Order Status</span>
            <span style={{
              background: 'var(--primary-gradient)',
              color: '#ffffff',
              padding: '0.15rem 0.5rem',
              borderRadius: '0.25rem',
              fontWeight: '800',
              fontSize: '0.8rem',
            }}>
              {order.orderStatus}
            </span>
          </div>


          {/* Payment Method & Status */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Payment</span>
            <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
              {order.paymentMethod} ({order.paymentStatus})
            </span>
          </div>

          {/* Delivery Address */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Delivery Address</span>
            <span style={{ fontWeight: '600', color: 'var(--text-primary)', textAlign: 'right', maxWidth: '280px' }}>
              {address.label === 'HOSTEL' && address.hostelName && !['SELECT HOSTEL', 'SELECT', 'N/A', 'NONE', 'CHOOSE HOSTEL'].includes(address.hostelName.toUpperCase().trim()) ? `${address.hostelName}${address.roomNumber ? ` (Room ${address.roomNumber})` : ''}, ` : ''}{address.fullAddress}
            </span>
          </div>

          {/* Items Summary */}
          <div>
            <div style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Ordered Items:</div>
            {order.items && order.items.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', padding: '0.25rem 0' }}>
                <span>{item.quantity}x {item.name}</span>
                <span>₹{item.subtotal.toFixed(2)}</span>
              </div>
            ))}
          </div>

          {/* Total Amount */}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', fontSize: '1.1rem', fontWeight: '800' }}>
            <span style={{ color: 'var(--text-primary)' }}>Total Paid / Due</span>
            <span style={{ color: 'var(--primary)' }}>₹{order.totalAmount.toFixed(2)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to="/orders" className="btn-primary" style={{ padding: '0.75rem 1.5rem' }}>
            <Package size={18} /> View My Orders
          </Link>
          <Link to="/student" className="btn-secondary" style={{ padding: '0.75rem 1.5rem' }}>
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
