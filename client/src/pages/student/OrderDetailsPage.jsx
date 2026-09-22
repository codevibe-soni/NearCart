import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';
import { useNotifications } from '../../context/NotificationContext';
import { ArrowLeft, MapPin, Store, CreditCard, Clock, Package, Phone, User, ShieldCheck, Eye, EyeOff, Star } from 'lucide-react';
import RateOrderModal from '../../components/RateOrderModal';
import { QRCodeSVG } from 'qrcode.react';

const LiveDeliveryMap = React.lazy(() => import('../../components/LiveDeliveryMap'));

export default function OrderDetailsPage() {
  const { orderId } = useParams();
  const { socket: globalSocket } = useNotifications();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReasonOption, setCancelReasonOption] = useState('Ordered by mistake');
  const [customReason, setCustomReason] = useState('');
  const [showPhone, setShowPhone] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);

  // UPI payment data from server (amount-locked URI)
  const [upiPaymentData, setUpiPaymentData] = useState(null);

  // Socket & Live Tracking state
  const [driverLocation, setDriverLocation] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  // Socket.IO lifecycle for live delivery tracking & status updates using globalSocket
  useEffect(() => {
    if (!orderId || !globalSocket) return;

    globalSocket.emit('delivery:join', { orderId });

    // Real-time location update listener
    const handleLocationUpdate = (data) => {
      if (data.latitude && data.longitude) {
        setDriverLocation([data.latitude, data.longitude]);
        setLastUpdated(data.timestamp || Date.now());
        setIsLive(true);
      }
    };

    // Real-time status update listener
    const handleStatusUpdate = (data) => {
      setOrder((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          orderStatus: data.orderStatus || prev.orderStatus,
        };
      });
    };

    // Real-time delivery boy assignment listener
    const handleAssigned = (data) => {
      console.log('Real-time delivery partner assigned:', data);
      setOrder((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          orderStatus: data.orderStatus || 'DELIVERY_ASSIGNED',
          deliveryBoy: data.deliveryBoy || prev.deliveryBoy,
        };
      });
    };

    globalSocket.on('delivery:location:update', handleLocationUpdate);
    globalSocket.on('delivery:status:update', handleStatusUpdate);
    globalSocket.on('delivery:assigned', handleAssigned);

    return () => {
      globalSocket.off('delivery:location:update', handleLocationUpdate);
      globalSocket.off('delivery:status:update', handleStatusUpdate);
      globalSocket.off('delivery:assigned', handleAssigned);
      globalSocket.emit('delivery:leave', { orderId });
    };
  }, [orderId, globalSocket]);

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/orders/${orderId}`);
      if (res && res.success) {
        setOrder(res.data);
      }
    } catch (err) {
      console.error('Failed to load order details:', err);
      setError(err.message || 'Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  // Fetch server-built UPI payment URI (with exact amount) when order is UPI and unpaid
  useEffect(() => {
    if (!order) return;
    if (order.paymentMethod !== 'UPI') return;
    if (order.paymentStatus === 'PAID') return;
    if (['CANCELLED', 'SHOP_REJECTED'].includes(order.orderStatus)) return;

    const fetchUpiPayment = async () => {
      try {
        const res = await api.get(`/payments/qr/${order._id}`);
        if (res && res.success) {
          setUpiPaymentData(res);
        }
      } catch (err) {
        console.warn('Could not fetch UPI payment data:', err.message);
      }
    };
    fetchUpiPayment();
  }, [order?._id, order?.paymentMethod, order?.paymentStatus, order?.orderStatus]);

  const handleConfirmCancel = async () => {
    try {
      setCancelling(true);
      const reasonToSubmit = cancelReasonOption === 'Other' ? customReason : cancelReasonOption;
      const res = await api.patch(`/orders/${orderId}/cancel`, {
        cancellationReason: reasonToSubmit,
      });

      if (res && res.success) {
        setOrder(res.data);
        setShowCancelModal(false);
      }
    } catch (err) {
      alert(err.message || 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
        <p style={{ color: 'var(--text-muted)' }}>Loading order details...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="container" style={{ padding: '4rem 1rem', maxWidth: '500px', textAlign: 'center' }}>
        <div style={{ background: 'var(--surface)', padding: '2rem', borderRadius: '1rem', border: '1px solid var(--border-color)' }}>
          <p style={{ color: 'var(--danger)', marginBottom: '1.5rem' }}>{error || 'Order not found'}</p>
          <Link to="/orders" className="btn-primary" style={{ padding: '0.6rem 1.25rem' }}>
            Back to My Orders
          </Link>
        </div>
      </div>
    );
  }

  const shop = order.shop || {};
  const address = order.address || {};
  const orderDate = new Date(order.createdAt).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isCancellable = ['PLACED', 'SHOP_ACCEPTED'].includes(order.orderStatus);

  return (
    <div className="container" style={{ padding: '2.5rem 1rem', maxWidth: '750px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/orders" style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          <ArrowLeft size={16} /> Back to My Orders
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
            Order {order.orderNumber}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{
              background: ['CANCELLED', 'SHOP_REJECTED'].includes(order.orderStatus) ? '#fee2e2' : 'var(--primary-gradient)',
              color: ['CANCELLED', 'SHOP_REJECTED'].includes(order.orderStatus) ? '#b91c1c' : '#ffffff',
              border: ['CANCELLED', 'SHOP_REJECTED'].includes(order.orderStatus) ? '1px solid #fca5a5' : 'none',
              fontWeight: '800',
              fontSize: '0.85rem',
              padding: '0.25rem 0.75rem',
              borderRadius: '1rem',
            }}>
              {order.orderStatus}
            </span>
            {order.orderStatus === 'DELIVERED' && (
              <button
                onClick={() => setShowRateModal(true)}
                className="btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.4rem 0.9rem',
                  fontSize: '0.85rem',
                  fontWeight: '700',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#ffffff',
                  boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)',
                }}
              >
                <Star size={16} fill="#ffffff" /> Rate Your Order
              </button>
            )}
            {isCancellable && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="btn-secondary"
                style={{ color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
              >
                Cancel Order
              </button>
            )}
          </div>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          Placed on {orderDate}
        </p>
      </div>

      {/* Cancellation / Rejection Banner */}
      {['CANCELLED', 'SHOP_REJECTED'].includes(order.orderStatus) && (
        <div style={{
          background: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: '0.75rem',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          color: '#b91c1c',
        }}>
          <strong style={{ fontSize: '0.95rem', display: 'block', marginBottom: '0.25rem' }}>
            {order.orderStatus === 'SHOP_REJECTED' ? 'Order Rejected by Shop' : 'Order Cancelled'}
          </strong>
          <span style={{ fontSize: '0.85rem' }}>
            Reason: {order.cancellationReason || 'No reason specified'}
          </span>
        </div>
      )}

      {/* Order Status Progress Timeline */}
      {!['CANCELLED', 'SHOP_REJECTED'].includes(order.orderStatus) && (
        <div style={{ background: '#ffffff', borderRadius: '0.75rem', border: '1px solid var(--border-color)', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={16} style={{ color: 'var(--primary)' }} /> Delivery Progress Tracker
          </h3>
          {(() => {
            const steps = [
              { key: 'PLACED', label: 'Order Placed' },
              { key: 'SHOP_ACCEPTED', label: 'Shop Accepted' },
              { key: 'PREPARING', label: 'Preparing' },
              { key: 'READY_FOR_PICKUP', label: 'Ready for Pickup' },
              { key: 'DELIVERY_ASSIGNED', label: 'Delivery Assigned' },
              { key: 'PICKED_UP', label: 'Picked Up' },
              { key: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
              { key: 'DELIVERED', label: 'Delivered' },
            ];

            const statusOrder = [
              'PLACED',
              'SHOP_ACCEPTED',
              'PREPARING',
              'READY_FOR_PICKUP',
              'DELIVERY_ASSIGNED',
              'ARRIVED_AT_SHOP',
              'PICKED_UP',
              'OUT_FOR_DELIVERY',
              'DELIVERED',
            ];

            const currentIndex = statusOrder.indexOf(order.orderStatus);

            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                {steps.map((step, idx) => {
                  const stepIndex = statusOrder.indexOf(step.key);
                  const isDone = currentIndex >= stepIndex;
                  const isCurrent = order.orderStatus === step.key || (order.orderStatus === 'ARRIVED_AT_SHOP' && step.key === 'DELIVERY_ASSIGNED');

                  return (
                    <div
                      key={step.key}
                      style={{
                        padding: '0.6rem 0.75rem',
                        borderRadius: '0.5rem',
                        background: isCurrent ? '#e0f2fe' : isDone ? '#d1fae5' : '#f8fafc',
                        border: isCurrent ? '1px solid var(--primary)' : isDone ? '1px solid #a7f3d0' : '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                    >
                      <div
                        style={{
                          width: '1rem',
                          height: '1rem',
                          borderRadius: '50%',
                          background: isDone ? '#10b981' : '#cbd5e1',
                          color: '#ffffff',
                          fontSize: '0.65rem',
                          fontWeight: '800',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {isDone ? '✓' : idx + 1}
                      </div>
                      <span style={{ fontSize: '0.78rem', fontWeight: isCurrent ? '700' : '500', color: isDone ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Delivery Partner Contact Card */}
      {!['CANCELLED', 'SHOP_REJECTED'].includes(order.orderStatus) && (
        <div style={{
          background: '#ffffff',
          borderRadius: '0.75rem',
          border: order.deliveryBoy ? '1px solid #bae6fd' : '1px solid var(--border-color)',
          padding: '1.25rem',
          marginBottom: '1.5rem',
          boxShadow: order.deliveryBoy ? '0 4px 16px rgba(2, 132, 199, 0.08)' : 'none',
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>🚚</span> DELIVERY PARTNER
          </h3>

          {order.deliveryBoy ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: '3.25rem',
                  height: '3.25rem',
                  borderRadius: '50%',
                  background: 'var(--primary-gradient)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: '800',
                  fontSize: '1.25rem',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}>
                  {order.deliveryBoy.profileImage ? (
                    <img src={order.deliveryBoy.profileImage} alt={order.deliveryBoy.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    (order.deliveryBoy.name || 'D').charAt(0).toUpperCase()
                  )}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {order.deliveryBoy.name}
                    </h4>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '1rem',
                    }}>
                      <ShieldCheck size={12} /> Verified
                    </span>
                  </div>

                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Status: <strong style={{ color: 'var(--primary)' }}>
                      {order.orderStatus === 'DELIVERED' ? 'Delivered' : order.orderStatus === 'OUT_FOR_DELIVERY' ? 'Out for Delivery' : 'Assigned'}
                    </strong>
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
                    <Phone size={14} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontFamily: 'monospace', fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                      {order.deliveryBoy.phone
                        ? (showPhone
                            ? order.deliveryBoy.phone
                            : order.deliveryBoy.phone.length > 4
                              ? `${order.deliveryBoy.phone.slice(0, 2)}XXXXXX${order.deliveryBoy.phone.slice(-2)}`
                              : order.deliveryBoy.phone)
                        : 'Phone unavailable'}
                    </span>

                    {order.deliveryBoy.phone && (
                      <button
                        onClick={() => setShowPhone(!showPhone)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.2rem',
                          fontSize: '0.75rem',
                          padding: '0 0.25rem',
                        }}
                        title={showPhone ? "Hide Phone Number" : "Show Phone Number"}
                      >
                        {showPhone ? <EyeOff size={14} /> : <Eye size={14} />}
                        <span>{showPhone ? 'Hide' : 'Show'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {order.deliveryBoy.phone && (
                <a
                  href={`tel:${order.deliveryBoy.phone}`}
                  className="btn-primary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.6rem 1.2rem',
                    fontSize: '0.9rem',
                    fontWeight: '700',
                    textDecoration: 'none',
                    borderRadius: '0.5rem',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#ffffff',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                  }}
                >
                  <Phone size={16} /> Call Delivery Partner
                </a>
              )}
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '0.5rem',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#fbbf24',
            }}>
              <Clock size={18} />
              <span style={{ fontSize: '0.9rem', fontWeight: '600' }}>
                Waiting for delivery partner assignment...
              </span>
            </div>
          )}
        </div>
      )}

      {/* Live Delivery Map Section (Visible when OUT_FOR_DELIVERY) */}
      {order.orderStatus === 'OUT_FOR_DELIVERY' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '1.1rem' }}>🛵</span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
              LIVE DELIVERY MAP TRACKING
            </h3>
          </div>

          <React.Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', background: '#f8fafc', borderRadius: '0.75rem', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>Loading live tracking map...</div>}>
            <LiveDeliveryMap
              driverLocation={driverLocation}
              shopLocation={
                shop.location && shop.location.coordinates
                  ? [shop.location.coordinates[1], shop.location.coordinates[0]]
                  : null
              }
              destinationLocation={
                address.location && address.location.coordinates
                  ? [address.location.coordinates[1], address.location.coordinates[0]]
                  : null
              }
              lastUpdated={lastUpdated}
              isLive={isLive}
              shopName={shop.name}
              destinationAddress={address.fullAddress}
            />
          </React.Suspense>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Shop Info Card */}
        <div style={{ background: 'var(--surface)', borderRadius: '0.75rem', border: '1px solid var(--border-color)', padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Store size={18} style={{ color: 'var(--primary)' }} /> Shop Information
          </h3>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontWeight: '600' }}>{shop.name || 'Campus Shop'}</p>
          {shop.address && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>{shop.address}</p>}
          {shop.phone && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.2rem 0 0 0' }}>Phone: {shop.phone}</p>}
        </div>

        {/* Ordered Items Table */}
        <div style={{ background: 'var(--surface)', borderRadius: '0.75rem', border: '1px solid var(--border-color)', padding: '1.25rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Package size={18} style={{ color: 'var(--primary)' }} /> Order Items
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {order.items && order.items.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: idx < order.items.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                <div>
                  <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{item.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    ₹{item.price} x {item.quantity}
                    {Number(item.packingCharges) > 0 && (
                      <span style={{ marginLeft: '0.5rem', color: '#0369a1', fontWeight: '600' }}>
                        (Packing: ₹{item.packingCharges}/item)
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>₹{item.subtotal.toFixed(2)}</div>
              </div>
            ))}
          </div>

          {/* Pricing Breakdown */}
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px dashed var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span>Subtotal</span>
              <span>₹{order.subtotal.toFixed(2)}</span>
            </div>
            {order.packingCharges !== undefined && order.packingCharges !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span>Packing Charges</span>
                <span>₹{order.packingCharges.toFixed(2)}</span>
              </div>
            )}
            {order.deliveryDistance !== undefined && order.deliveryDistance !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span>Delivery Distance</span>
                <span>{order.deliveryDistance} km</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
              <span>Delivery Fee</span>
              <span>₹{order.deliveryFee.toFixed(2)}</span>
            </div>
            {order.discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}>
                <span>Discount</span>
                <span>-₹{order.discount.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '1.1rem', color: 'var(--primary)', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
              <span>Total Amount</span>
              <span>₹{order.totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Address & Payment Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          <div style={{ background: 'var(--surface)', borderRadius: '0.75rem', border: '1px solid var(--border-color)', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MapPin size={16} style={{ color: 'var(--primary)' }} /> Delivery Address
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
              {address.hostelName ? `${address.hostelName} (Room ${address.roomNumber})` : ''}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
              {address.fullAddress}
            </p>
            {address.landmark && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.2rem 0 0 0' }}>
                Landmark: {address.landmark}
              </p>
            )}
          </div>

          <div style={{ background: 'var(--surface)', borderRadius: '0.75rem', border: '1px solid var(--border-color)', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CreditCard size={16} style={{ color: 'var(--primary)' }} /> Payment Info
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
              Method: <strong>{order.paymentMethod}</strong>
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0 0' }}>
              Payment Status: <strong style={{
                color: order.paymentStatus === 'PAID' ? 'var(--success)' : order.paymentStatus === 'USER_CONFIRMED' ? 'var(--warning)' : order.paymentStatus === 'FAILED' ? 'var(--danger)' : 'var(--warning)'
              }}>
                {order.paymentStatus === 'USER_CONFIRMED' ? 'Payment Claimed (Pending Shopkeeper Verification)' : order.paymentStatus}
              </strong>
            </p>

            {/* Download PDF Receipt button */}
            <div style={{ marginTop: '0.75rem' }}>
              <a
                href={`/api/orders/${order._id}/receipt`}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.85rem',
                  width: '100%',
                  justifyContent: 'center',
                  textDecoration: 'none',
                  borderColor: 'rgba(56, 189, 248, 0.4)',
                  color: 'var(--primary)'
                }}
              >
                📄 Download PDF Receipt
              </a>
            </div>

            {/* UPI Payment Box — Dynamic QR with Server-Calculated Amount */}
            {order.paymentMethod === 'UPI' && order.paymentStatus !== 'PAID' && !['CANCELLED', 'SHOP_REJECTED'].includes(order.orderStatus) && (
              <div style={{
                marginTop: '1rem',
                padding: '1.25rem',
                borderRadius: '0.75rem',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
              }}>
                {/* Amount Header */}
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Pay to {upiPaymentData?.shopName || order.shop?.name || 'Shopkeeper'}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#059669' }}>
                    ₹{upiPaymentData?.formattedAmount || order.totalAmount?.toFixed(2) || '0.00'}
                  </div>
                </div>

                {/* Dynamic QR Code (with amount baked in) */}
                {upiPaymentData?.upiPaymentUri ? (
                  <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: '#047857', fontWeight: '600', marginBottom: '0.5rem' }}>
                      Order Payment QR — Amount Included
                    </div>
                    <div style={{
                      display: 'inline-block',
                      padding: '0.75rem',
                      background: '#ffffff',
                      borderRadius: '0.75rem',
                      border: '2px solid #a7f3d0',
                    }}>
                      <QRCodeSVG
                        value={upiPaymentData.upiPaymentUri}
                        size={200}
                        level="M"
                        includeMargin={false}
                      />
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                      Scan with any UPI app — amount auto-fills to ₹{upiPaymentData.formattedAmount}
                    </div>
                  </div>
                ) : (
                  /* Static QR Fallback if no dynamic URI */
                  order.upiQrSnapshot?.imageUrl ? (
                    <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#92400e', fontWeight: '600', marginBottom: '0.5rem' }}>
                        Shopkeeper's General QR — Enter amount manually
                      </div>
                      <img
                        src={order.upiQrSnapshot.imageUrl}
                        alt="Shopkeeper UPI QR"
                        style={{ width: '180px', height: '180px', objectFit: 'contain', borderRadius: '0.5rem', border: '2px solid var(--border-color)', margin: '0 auto' }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                      <div style={{ fontSize: '0.7rem', color: '#b45309', marginTop: '0.5rem' }}>
                        ⚠ This QR does not include the amount. Enter ₹{order.totalAmount?.toFixed(2)} manually.
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '0.75rem', textAlign: 'center', background: '#fef3c7', borderRadius: '0.4rem', marginBottom: '0.75rem' }}>
                      <p style={{ color: '#92400e', fontSize: '0.8rem', margin: 0 }}>QR unavailable — use UPI ID below to pay</p>
                    </div>
                  )
                )}

                {/* UPI ID Display */}
                {(upiPaymentData?.upiId || order.upiQrSnapshot?.upiId) && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    background: '#ffffff',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border-color)',
                  }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      UPI ID: <strong>{upiPaymentData?.upiId || order.upiQrSnapshot.upiId}</strong>
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(upiPaymentData?.upiId || order.upiQrSnapshot?.upiId || '');
                        alert('UPI ID copied to clipboard!');
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}
                    >
                      Copy
                    </button>
                  </div>
                )}

                {/* Pay via UPI Deeplink Button (mobile) */}
                {upiPaymentData?.upiPaymentUri && order.paymentStatus === 'PENDING' && (
                  <a
                    href={upiPaymentData.upiPaymentUri}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '0.65rem',
                      fontSize: '0.9rem',
                      fontWeight: '700',
                      color: '#ffffff',
                      background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
                      border: 'none',
                      borderRadius: '0.5rem',
                      textAlign: 'center',
                      textDecoration: 'none',
                      cursor: 'pointer',
                      marginBottom: '0.5rem',
                    }}
                  >
                    💳 Pay ₹{upiPaymentData.formattedAmount} via UPI App
                  </a>
                )}

                {/* I Have Paid Button */}
                {order.paymentStatus === 'PENDING' && (
                  <button
                    onClick={async () => {
                      try {
                        setLoading(true);
                        const res = await api.post('/payments/upi/confirm', { orderId: order._id });
                        if (res && res.success) {
                          alert('Payment confirmation submitted! The shopkeeper will verify your payment.');
                          fetchOrder();
                        }
                      } catch (err) {
                        alert(err.message || 'Failed to submit payment confirmation');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="btn-primary"
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                  >
                    ✅ I Have Paid
                  </button>
                )}

                {order.paymentStatus === 'USER_CONFIRMED' && (
                  <div style={{
                    padding: '0.5rem',
                    borderRadius: '0.4rem',
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    color: '#b45309',
                    fontSize: '0.8rem',
                    textAlign: 'center',
                    fontWeight: '600'
                  }}>
                    ⏳ Payment claimed — Waiting for Shopkeeper verification
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancellation Modal */}
      {showCancelModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justify: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid var(--border-color)',
            borderRadius: '0.75rem',
            padding: '1.75rem',
            maxWidth: '460px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              Cancel Order {order.orderNumber}?
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Are you sure you want to cancel this order? Please select a cancellation reason.
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Reason for cancellation</label>
              <select
                value={cancelReasonOption}
                onChange={(e) => setCancelReasonOption(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', background: '#ffffff', border: '1px solid #cbd5e1', color: 'var(--text-primary)', borderRadius: '0.4rem' }}
              >
                <option value="Ordered by mistake">Ordered by mistake</option>
                <option value="No longer needed">No longer needed</option>
                <option value="Wrong product">Wrong product</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {cancelReasonOption === 'Other' && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Specify Reason</label>
                <input
                  type="text"
                  maxLength={100}
                  placeholder="Enter brief reason..."
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', background: '#ffffff', border: '1px solid #cbd5e1', color: 'var(--text-primary)', borderRadius: '0.4rem' }}
                />
              </div>
            )}


            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button onClick={() => setShowCancelModal(false)} className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                Keep Order
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={cancelling}
                className="btn-primary"
                style={{ background: 'var(--danger)', padding: '0.5rem 1rem' }}
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Rate Order Modal */}
      <RateOrderModal
        order={order}
        isOpen={showRateModal}
        onClose={() => setShowRateModal(false)}
        onReviewSubmitted={() => fetchOrder()}
      />
    </div>
  );
}
