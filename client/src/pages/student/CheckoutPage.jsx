import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { detectUserLocality } from '../../utils/locationService';
import { isShopOpen } from '../../components/StudentUIComponents';
import { MapPin, Plus, Check, Tag, CreditCard, ShoppingBag, ShieldCheck, AlertCircle, ArrowLeft, CheckCircle, Zap, Compass, Loader2, Lock } from 'lucide-react';

export default function CheckoutPage() {
  const { user } = useAuth();
  const location = useLocation();
  const buyNowItem = location.state?.buyNowItem || null;

  const [cart, setCart] = useState(null);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [couponApplying, setCouponApplying] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Location Detection State
  const [locationDetecting, setLocationDetecting] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [detectedLocalityInfo, setDetectedLocalityInfo] = useState(null);

  // Automatic Delivery Estimation State
  const [calculatedDistanceInfo, setCalculatedDistanceInfo] = useState(null);
  const [estimatingDelivery, setEstimatingDelivery] = useState(false);
  const [estimateError, setEstimateError] = useState('');

  // Address Form Modal State

  const [showAddressModal, setShowAddressModal] = useState(false);
  const [hostelsList, setHostelsList] = useState([]);
  const [addressFormData, setAddressFormData] = useState({
    label: user?.customerType === 'ATITHI' ? 'HOME' : 'HOSTEL',
    hostelName: '',
    roomNumber: '',
    fullAddress: '',
    landmark: '',
    city: 'Campus Town',
    state: 'State',
    postalCode: '100001',
    latitude: '',
    longitude: '',
    isDefault: true,
  });

  const navigate = useNavigate();

  const isValidLat = (val) => {
    if (val === null || val === undefined || val === '') return false;
    const num = Number(val);
    return !isNaN(num) && isFinite(num) && num >= -90 && num <= 90;
  };

  const isValidLng = (val) => {
    if (val === null || val === undefined || val === '') return false;
    const num = Number(val);
    return !isNaN(num) && isFinite(num) && num >= -180 && num <= 180;
  };

  const hasValidLocation =
    isValidLat(addressFormData.latitude) &&
    isValidLng(addressFormData.longitude) &&
    !(Number(addressFormData.latitude) === 0 && Number(addressFormData.longitude) === 0);

  let items = [];
  let shop = null;

  if (buyNowItem) {
    const effectivePrice =
      buyNowItem.product.discountPrice != null && buyNowItem.product.discountPrice < buyNowItem.product.price
        ? buyNowItem.product.discountPrice
        : buyNowItem.product.price;

    items = [
      {
        product: buyNowItem.product,
        quantity: buyNowItem.quantity,
        price: effectivePrice,
        shop: buyNowItem.shop,
      },
    ];
    shop = buyNowItem.shop;
  } else {
    items = cart?.items || [];
    shop = items.length > 0 ? items[0].shop : null;
  }

  const subtotal = items.reduce(
    (sum, item) => sum + (item.price || 0) * item.quantity,
    0
  );

  const handleDetectLocality = async () => {
    setLocationDetecting(true);
    setLocationMessage('');
    try {
      const result = await detectUserLocality();
      if (result && result.success) {
        setDetectedLocalityInfo(result);
        setAddressFormData((prev) => ({
          ...prev,
          label: 'HOME',
          fullAddress: result.fullAddress,
          city: result.city || prev.city,
          state: result.state || prev.state,
          postalCode: result.postalCode || prev.postalCode,
          landmark: result.locality ? `Locality: ${result.locality}` : prev.landmark,
          latitude: result.lat,
          longitude: result.lng,
          isDefault: true,
        }));
        setShowAddressModal(true);
      }
    } catch (err) {
      setLocationMessage(err.message || "Location access wasn't available. You can enter your address manually.");
    } finally {
      setLocationDetecting(false);
    }
  };

  useEffect(() => {
    fetchCheckoutData();
  }, []);

  const fetchCheckoutData = async () => {
    try {
      setLoading(true);
      setError('');

      const DEFAULT_HOSTELS = ['Bhabha Hostel', 'Hostel 1', 'Hostel 5', 'Block A', 'Block B', 'Block C'];

      if (buyNowItem) {
        // Buy Now flow: Fetch delivery addresses and hostels list
        const [addrRes, hostelRes] = await Promise.all([
          api.get('/addresses'),
          api.get('/addresses/hostels').catch((err) => {
            console.warn('Hostels list fetch failed, using fallback list:', err);
            return { success: false, data: [] };
          }),
        ]);
        if (addrRes && addrRes.success) {
          const addrList = addrRes.data || [];
          setAddresses(addrList);
          const defaultAddr = addrList.find((a) => a.isDefault) || addrList[0];
          if (defaultAddr) {
            setSelectedAddressId(defaultAddr._id);
          } else {
            setSelectedAddressId('');
          }
        }
        if (hostelRes && hostelRes.success && Array.isArray(hostelRes.data) && hostelRes.data.length > 0) {
          setHostelsList(hostelRes.data);
        } else {
          setHostelsList(DEFAULT_HOSTELS);
        }
      } else {
        // Cart flow: Fetch cart, addresses, and hostels list
        const [cartRes, addrRes, hostelRes] = await Promise.all([
          api.get('/cart'),
          api.get('/addresses'),
          api.get('/addresses/hostels').catch((err) => {
            console.warn('Hostels list fetch failed, using fallback list:', err);
            return { success: false, data: [] };
          }),
        ]);

        if (hostelRes && hostelRes.success && Array.isArray(hostelRes.data) && hostelRes.data.length > 0) {
          setHostelsList(hostelRes.data);
        } else {
          setHostelsList(DEFAULT_HOSTELS);
        }

        if (cartRes && cartRes.success) {
          setCart(cartRes.data);
          if (!cartRes.data.items || cartRes.data.items.length === 0) {
            navigate('/cart');
            return;
          }
        }

        if (addrRes && addrRes.success) {
          const addrList = addrRes.data || [];
          setAddresses(addrList);
          const defaultAddr = addrList.find((a) => a.isDefault) || addrList[0];
          if (defaultAddr) {
            setSelectedAddressId(defaultAddr._id);
          } else {
            setSelectedAddressId('');
          }
        }
      }
    } catch (err) {
      console.error('Failed to load checkout data:', err);
      setError(err.message || 'Failed to load checkout data');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCoupon = async (e) => {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setCouponError('');
    setCouponApplying(true);
    try {
      const res = await api.post('/orders/apply-coupon', {
        couponCode: couponCode.trim(),
        subtotal,
        shopId: shop?._id,
      });

      if (res && res.success) {
        setAppliedCoupon(res.data);
      }
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(err.message || 'Invalid coupon code');
    } finally {
      setCouponApplying(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  const handleCreateAddress = async (e) => {
    e.preventDefault();
    if (!addressFormData.fullAddress.trim()) {
      alert('Full address is required');
      return;
    }

    if (!hasValidLocation) {
      alert('Please pin your exact location on the map before saving the address.');
      return;
    }

    try {
      const payload = {
        ...addressFormData,
        label: user?.customerType === 'ATITHI' ? 'HOME' : addressFormData.label,
        hostelName: (user?.customerType === 'ATITHI' || addressFormData.label === 'HOME') ? '' : addressFormData.hostelName,
        roomNumber: (user?.customerType === 'ATITHI' || addressFormData.label === 'HOME') ? '' : addressFormData.roomNumber,
      };
      const res = await api.post('/addresses', payload);
      if (res && res.success) {
        const newAddress = res.data;
        setAddresses([newAddress, ...addresses]);
        setSelectedAddressId(newAddress._id);
        setShowAddressModal(false);
        setAddressFormData({
          label: user?.customerType === 'ATITHI' ? 'HOME' : 'HOSTEL',
          hostelName: '',
          roomNumber: '',
          fullAddress: '',
          landmark: '',
          city: 'Campus Town',
          state: 'State',
          postalCode: '100001',
          isDefault: true,
        });
      }
    } catch (err) {
      alert(err.message || 'Failed to save address');
    }
  };

  useEffect(() => {
    const fetchDeliveryEstimate = async () => {
      const targetShopId = shop?._id || shop;
      if (!selectedAddressId || !targetShopId) {
        setCalculatedDistanceInfo(null);
        setEstimateError('');
        return;
      }

      try {
        setEstimatingDelivery(true);
        setEstimateError('');
        const res = await api.post('/orders/delivery-estimate', {
          shopId: typeof targetShopId === 'object' ? targetShopId._id : targetShopId,
          addressId: selectedAddressId,
        });

        if (res && res.success) {
          setCalculatedDistanceInfo({
            distanceKm: res.distanceKm,
            deliveryFee: res.deliveryFee,
          });
        } else {
          setCalculatedDistanceInfo(null);
          setEstimateError(res.message || 'Failed to calculate delivery fee');
        }
      } catch (err) {
        setCalculatedDistanceInfo(null);
        setEstimateError(err.message || 'Location is not configured for this address/shop.');
      } finally {
        setEstimatingDelivery(false);
      }
    };

    fetchDeliveryEstimate();
  }, [selectedAddressId, shop]);

  const handlePlaceOrder = async () => {
    if (submitting) return;

    if (shop && !isShopOpen(shop)) {
      setError('This shop is currently closed. Orders cannot be placed at this time.');
      return;
    }

    if (!selectedAddressId) {
      setError('Please select or add a delivery address');
      return;
    }

    if (estimateError) {
      setError(estimateError);
      return;
    }

    if (!calculatedDistanceInfo) {
      setError('Please select a valid delivery address with location configured.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const orderKey = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'ord-' + Date.now() + '-' + Math.random().toString(36).substring(2);

      const payload = {
        addressId: selectedAddressId,
        paymentMethod,
        couponCode: appliedCoupon ? appliedCoupon.code : undefined,
        notes,
        idempotencyKey: orderKey,
        ...(buyNowItem
          ? {
              isBuyNow: true,
              buyNowItem: {
                productId: buyNowItem.product._id,
                quantity: buyNowItem.quantity,
              },
            }
          : {}),
      };

      // 1. Create Order Server-Side
      const res = await api.post('/orders', payload);

      if (res && res.success) {
        const createdOrder = res.data;

        if (['COD', 'UPI', 'ONLINE'].includes(paymentMethod)) {
          navigate(`/orders/${createdOrder._id}/success`);
          return;
        }
      }
    } catch (err) {
      console.error('Failed to place order:', err);
      setError(err.message || 'Failed to place order. Please try again.');
      setSubmitting(false);
    }
  };




  // const subtotal = items.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0);
  // const deliveryFee = shop?.deliveryFee !== undefined ? shop.deliveryFee : 0;
  // const discountAmount = appliedCoupon ? appliedCoupon.discountAmount : 0;
  // const finalTotal = Math.max(0, subtotal + deliveryFee - discountAmount);



  const packingCharges = items.reduce(
    (sum, item) => sum + (Number(item.product?.packingCharges) || 0) * item.quantity,
    0
  );

  const discountAmount = appliedCoupon
    ? Number(appliedCoupon.discountAmount) || 0
    : 0;

  // Calculate GST from effective selling price
  const gstAmount = items.reduce((sum, item) => {
    const itemSubtotal = (Number(item.price) || 0) * (Number(item.quantity) || 0);
    const gstPercentage = Number(item.product?.gstPercentage) || 0;

    return sum + (itemSubtotal * gstPercentage) / 100;
  }, 0);

  const roundedGstAmount = Math.round(gstAmount * 100) / 100;

  const deliveryFee = calculatedDistanceInfo ? Number(calculatedDistanceInfo.deliveryFee) : 0;

  const finalTotal = Math.max(
    0,
    subtotal + packingCharges + roundedGstAmount + (calculatedDistanceInfo ? deliveryFee : 0) - discountAmount
  );


  if (loading) {
    return (
      <div className="container" style={{ padding: '4rem 1rem', textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
        <p style={{ color: 'var(--text-muted)' }}>Preparing checkout details...</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 1rem' }}>
      {/* Back button & Title */}
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to={buyNowItem ? `/student/products/${buyNowItem.product._id}` : "/cart"} style={{ color: 'var(--text-muted)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          <ArrowLeft size={16} /> {buyNowItem ? 'Back to Product' : 'Back to Cart'}
        </Link>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Checkout {buyNowItem && <span style={{ fontSize: '0.8rem', fontWeight: '700', padding: '0.2rem 0.6rem', borderRadius: '1rem', background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)', border: '1px solid var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><Zap size={12} /> BUY NOW</span>}
        </h1>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }} className="checkout-grid grid-responsive-2">
        {/* Left Column: Address & Payment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* 1. Delivery Address Section */}
          <div style={{
            background: 'var(--surface)',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-color)',
            padding: '1.5rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <MapPin size={20} style={{ color: 'var(--primary)' }} /> 1. Select Delivery Address
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleDetectLocality}
                  disabled={locationDetecting}
                  className="btn-secondary"
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', color: 'var(--primary)', borderColor: 'var(--primary)' }}
                >
                  {locationDetecting ? <Loader2 size={14} className="spin" /> : <Compass size={14} />}
                  <span>{locationDetecting ? 'Detecting...' : 'Detect my locality'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddressModal(true)}
                  className="btn-secondary"
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                >
                  <Plus size={14} /> Add New Address
                </button>
              </div>
            </div>

            {locationMessage && (
              <div style={{ padding: '0.65rem 0.85rem', background: '#fffbebe6', border: '1px solid #fef3c7', color: '#b45309', borderRadius: '0.4rem', fontSize: '0.825rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{locationMessage}</span>
              </div>
            )}

            {addresses.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', border: '1px dashed var(--border-color)', borderRadius: '0.5rem' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  No saved default address found. You can detect your locality or enter your address manually below.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleDetectLocality}
                    disabled={locationDetecting}
                    className="btn-primary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                  >
                    <Compass size={16} />
                    <span>{locationDetecting ? 'Detecting Locality...' : 'Use my current location'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddressModal(true)}
                    className="btn-secondary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                  >
                    <Plus size={16} /> Enter Address Manually
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {addresses.map((addr) => {
                  const isSelected = selectedAddressId === addr._id;
                  return (
                    <div
                      key={addr._id}
                      onClick={() => setSelectedAddressId(addr._id)}
                      style={{
                        padding: '1rem',
                        borderRadius: '0.5rem',
                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        background: isSelected ? 'rgba(56, 189, 248, 0.05)' : 'var(--surface-hover)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.75rem',
                      }}
                    >
                      <div style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        border: isSelected ? '6px solid var(--primary)' : '2px solid #cbd5e1',
                        background: '#ffffff',
                        marginTop: '0.2rem',
                        flexShrink: 0,
                      }}></div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{
                            background: 'var(--primary-gradient)',
                            color: '#ffffff',
                            fontSize: '0.7rem',
                            fontWeight: '800',
                            padding: '0.15rem 0.4rem',
                            borderRadius: '0.25rem',
                            textTransform: 'uppercase',
                          }}>
                            {addr.label || 'HOSTEL'}
                          </span>
                          {addr.isDefault && (
                            <span style={{
                              background: '#d1fae5',
                              color: '#047857',
                              fontSize: '0.68rem',
                              fontWeight: '700',
                              padding: '0.15rem 0.4rem',
                              borderRadius: '0.25rem',
                            }}>
                              DEFAULT
                            </span>
                          )}
                          {addr.label === 'HOSTEL' && addr.hostelName && !['SELECT HOSTEL', 'SELECT', 'N/A', 'NONE', 'CHOOSE HOSTEL'].includes(addr.hostelName.toUpperCase().trim()) && (
                            <span style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                              {addr.hostelName} {addr.roomNumber ? `(Room ${addr.roomNumber})` : ''}
                            </span>
                          )}
                        </div>

                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0.4rem 0 0 0' }}>
                          {addr.fullAddress}
                        </p>
                        {addr.landmark && (
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0.2rem 0 0 0' }}>
                            Landmark: {addr.landmark}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Automatic Delivery Distance Section */}
          <div style={{
            background: 'var(--surface)',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-color)',
            padding: '1.5rem',
          }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Compass size={20} style={{ color: 'var(--primary)' }} /> 2. Delivery Distance & Fee
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Delivery distance and fee are calculated automatically based on shop and address locations.
            </p>

            {estimatingDelivery && (
              <div style={{ padding: '0.75rem 1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Calculating delivery distance & fee...
              </div>
            )}

            {estimateError && !estimatingDelivery && (
              <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', color: 'var(--danger)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} />
                <span>{estimateError}</span>
              </div>
            )}

            {calculatedDistanceInfo && !estimatingDelivery && (
              <div style={{ padding: '0.75rem 1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.5rem', color: '#166534', fontSize: '0.9rem' }}>
                <div style={{ fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CheckCircle size={16} style={{ color: '#16a34a' }} /> Distance calculated automatically
                </div>
                <div style={{ marginTop: '0.35rem', fontSize: '0.875rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <span>✓ Delivery distance: <strong>{calculatedDistanceInfo.distanceKm} km</strong></span>
                  <span>✓ Delivery fee: <strong>₹{calculatedDistanceInfo.deliveryFee}</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* 3. Payment Method Section */}
          <div style={{
            background: 'var(--surface)',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-color)',
            padding: '1.5rem',
          }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CreditCard size={20} style={{ color: 'var(--primary)' }} /> 3. Select Payment Method
            </h3>


            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* COD Option */}
              <div
                onClick={() => setPaymentMethod('COD')}
                style={{
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  border: paymentMethod === 'COD' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  background: paymentMethod === 'COD' ? '#e0f2fe' : '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  border: paymentMethod === 'COD' ? '6px solid var(--primary)' : '2px solid #cbd5e1',
                  background: '#ffffff',
                  flexShrink: 0,
                }}></div>
                <div>
                  <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                    Cash on Delivery (COD)
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Pay in cash or UPI when your order is delivered to your hostel.
                  </div>
                </div>
              </div>

              {/* UPI Option */}
              <div
                onClick={() => {
                  if (shop?.upiEnabled === false) {
                    alert('This shop does not have UPI payments enabled. Please select Cash on Delivery (COD).');
                    return;
                  }

                  if (!shop?.upiId && !shop?.upiQrImage) {
                    alert('This shop has not configured UPI payment details. Please select Cash on Delivery (COD).');
                    return;
                  }

                  setPaymentMethod('UPI');
                }}
                style={{
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  border: paymentMethod === 'UPI' ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                  background: paymentMethod === 'UPI' ? '#e0f2fe' : '#ffffff',
                  cursor: shop?.upiEnabled === false ? 'not-allowed' : 'pointer',
                  opacity: shop?.upiEnabled === false ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  border: paymentMethod === 'UPI' ? '6px solid var(--primary)' : '2px solid #cbd5e1',
                  background: '#ffffff',
                  flexShrink: 0,
                }}></div>
                <div>
                  <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    Shopkeeper UPI QR <span style={{ fontSize: '0.75rem', background: '#d1fae5', color: '#047857', padding: '0.1rem 0.4rem', borderRadius: '0.25rem' }}>Direct Pay</span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {shop?.upiEnabled === false
                      ? 'Shopkeeper has not enabled UPI QR payment.'
                      : `Scan & pay directly to ${shop?.name || 'Shopkeeper'}'s UPI QR code.`}
                  </div>
                </div>
              </div>
          
              {/* UPI Payment Details */}
              {paymentMethod === 'UPI' && (
                <div
                  style={{
                    marginTop: '1rem',
                    padding: '1.25rem',
                    borderRadius: '0.75rem',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(16, 185, 129, 0.06)',
                    textAlign: 'center',
                  }}
                >
                  <h4
                    style={{
                      margin: '0 0 0.75rem',
                      color: 'var(--text-primary)',
                      fontSize: '1rem',
                      fontWeight: '800',
                    }}
                  >
                    Pay {shop?.name || 'Shopkeeper'} Directly
                  </h4>

                  {/* UPI ID */}
                  {shop?.upiId ? (
                    <div
                      style={{
                        marginBottom: '1rem',
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        background: '#f8fafc',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div
                        style={{
                          color: 'var(--text-muted)',
                          fontSize: '0.75rem',
                          marginBottom: '0.25rem',
                        }}
                      >
                        UPI ID
                      </div>

                      <div
                        style={{
                          color: 'var(--primary)',
                          fontSize: '1rem',
                          fontWeight: '800',
                          wordBreak: 'break-all',
                        }}
                      >
                        {shop.upiId}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        color: 'var(--danger)',
                        fontSize: '0.85rem',
                        marginBottom: '1rem',
                      }}
                    >
                      Shopkeeper UPI ID is not available.
                    </div>
                  )}

                  {/* QR Image */}
                  {shop?.upiQrImage ? (
                    <div>
                      <p
                        style={{
                          color: 'var(--text-secondary)',
                          fontSize: '0.85rem',
                          marginBottom: '0.75rem',
                        }}
                      >
                        Scan this QR code to pay
                      </p>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <img
                          src={shop.upiQrImage}
                          alt={`${shop.name || 'Shopkeeper'} UPI QR`}
                          style={{
                            width: '220px',
                            height: '220px',
                            objectFit: 'contain',
                            background: '#ffffff',
                            padding: '0.5rem',
                            borderRadius: '0.75rem',
                            border: '1px solid var(--border-color)',
                          }}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1px solid var(--danger)',
                        color: 'var(--danger)',
                        fontSize: '0.85rem',
                      }}
                    >
                      Shopkeeper has not uploaded a UPI QR code.
                      Please select Cash on Delivery.
                    </div>
                  )}

                  <div
                    style={{
                      marginTop: '1rem',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      lineHeight: 1.5,
                    }}
                  >
                    Please make the payment directly to the shopkeeper using the
                    displayed UPI ID or QR code.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. Delivery Notes Section */}
          <div style={{
            background: 'var(--surface)',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-color)',
            padding: '1.5rem',
            marginTop: '1.5rem',
          }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              3. Delivery Instructions (Optional)
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Please leave at hostel reception if not in room..."
              rows={2}
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '0.5rem',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
              }}
            />
          </div>

        </div>

        {/* Right Column: Checkout Summary */}
        <div>
          <div style={{
            background: 'var(--surface)',
            borderRadius: '0.75rem',
            border: '1px solid var(--border-color)',
            padding: '1.5rem',
            position: 'sticky',
            top: '5.5rem',
          }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              Order Items ({items.length})
            </h3>

            {/* Item list snapshot */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '200px', overflowY: 'auto', marginBottom: '1.25rem', paddingRight: '0.25rem' }}>
              {items.map((item) => (
                <div key={item.product?._id || item._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: '700', color: 'var(--primary)' }}>{item.quantity}x</span>
                    <span style={{ color: 'var(--text-primary)' }}>{item.product?.name}</span>
                  </div>
                  <span style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>₹{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            {/* Coupon Code Section */}
            <div className="cpn-checkout-section">
              <label className="cpn-checkout-label" htmlFor="checkout-coupon-input">
                <Tag size={16} aria-hidden="true" />
                Apply Coupon
              </label>

              {appliedCoupon ? (
                <div className="cpn-checkout-applied" role="status" aria-live="polite">
                  <div className="cpn-checkout-applied-info">
                    <span className="cpn-checkout-applied-title">
                      <CheckCircle size={15} aria-hidden="true" />
                      <span className="cpn-checkout-applied-code">{appliedCoupon.code}</span>
                      <span>applied</span>
                    </span>
                    <span className="cpn-checkout-savings">You saved ₹{discountAmount.toFixed(2)}</span>
                  </div>
                  <button
                    onClick={handleRemoveCoupon}
                    className="cpn-checkout-remove"
                    aria-label="Remove coupon"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyCoupon} className="cpn-checkout-form">
                  <input
                    id="checkout-coupon-input"
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="Enter coupon code"
                    className="cpn-checkout-input"
                    autoComplete="off"
                    aria-label="Coupon code"
                  />
                  <button
                    type="submit"
                    className="cpn-checkout-apply"
                    disabled={couponApplying || !couponCode.trim()}
                    aria-label="Apply coupon"
                  >
                    {couponApplying ? 'Applying...' : 'Apply'}
                  </button>
                </form>
              )}

              {couponError && (
                <p className="cpn-checkout-error" role="alert">{couponError}</p>
              )}
            </div>

            {/* Price Summary */}
            <div className="cpn-price-summary">
              <div className="cpn-price-row">
                <span className="cpn-price-label">Subtotal</span>
                <span className="cpn-price-value">₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="cpn-price-row">
                <span className="cpn-price-label">Packing Charges</span>
                <span className="cpn-price-value">₹{packingCharges.toFixed(2)}</span>
              </div>
              <div className="cpn-price-row">
                <span className="cpn-price-label">Delivery Distance</span>
                <span className="cpn-price-value">
                  {estimatingDelivery
                    ? 'Calculating...'
                    : calculatedDistanceInfo
                      ? `${calculatedDistanceInfo.distanceKm} km`
                      : (estimateError ? '—' : 'Select address')}
                </span>
              </div>
              <div className="cpn-price-row">
                <span className="cpn-price-label">Delivery Fee</span>
                <span className="cpn-price-value" style={{ color: calculatedDistanceInfo ? 'inherit' : 'var(--text-muted)', fontStyle: calculatedDistanceInfo ? 'normal' : 'italic' }}>
                  {estimatingDelivery
                    ? 'Calculating...'
                    : calculatedDistanceInfo
                      ? (deliveryFee > 0 ? `₹${deliveryFee.toFixed(2)}` : 'FREE')
                      : (estimateError ? '—' : 'Select address')}
                </span>
              </div>
              <div className="cpn-price-row">
                <span className="cpn-price-label">GST</span>
                <span className="cpn-price-value">₹{roundedGstAmount.toFixed(2)}</span>
              </div>

              {appliedCoupon && (
                <div className="cpn-price-row cpn-price-row--discount" aria-label={`Coupon discount: minus ₹${discountAmount.toFixed(2)}`}>
                  <span className="cpn-price-label">
                    <Tag size={13} aria-hidden="true" />
                    Coupon Discount
                  </span>
                  <span className="cpn-price-value">-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <hr className="cpn-price-divider" />
              <div className="cpn-price-row cpn-price-row--total">
                <span className="cpn-price-label">Total</span>
                <span className="cpn-price-value">₹{finalTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Place Order Button */}
            <button
              onClick={handlePlaceOrder}
              disabled={submitting || !selectedAddressId}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '0.85rem',
                fontSize: '1.05rem',
                fontWeight: '800',
                marginTop: '1.5rem',
                justifyContent: 'center',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? 'Placing Order...' : 'Place Order Now'}
            </button>
          </div>
        </div>
      </div>

      {/* Add Address Modal */}
      {showAddressModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid var(--border-color)',
            borderRadius: '0.75rem',
            padding: '1.75rem',
            width: '100%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
          }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '1.25rem' }}>
              Add Delivery Address
            </h2>

            {detectedLocalityInfo && (
              <div style={{
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '0.5rem',
                padding: '0.85rem 1rem',
                marginBottom: '1rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', fontWeight: '700', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                  <Compass size={16} />
                  <span>📍 Detected Location</span>
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {detectedLocalityInfo.locality}
                  {detectedLocalityInfo.city ? `, ${detectedLocalityInfo.city}` : ''}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {detectedLocalityInfo.state} {detectedLocalityInfo.postalCode}
                </div>
              </div>
            )}

            <form onSubmit={handleCreateAddress} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Address Type</label>
                <select
                  value={user?.customerType === 'ATITHI' ? 'HOME' : addressFormData.label}
                  onChange={(e) => {
                    const nextLabel = e.target.value;
                    setAddressFormData((prev) => ({
                      ...prev,
                      label: nextLabel,
                      // Clear hostel info if switching to HOME
                      hostelName: nextLabel === 'HOME' ? '' : prev.hostelName,
                      roomNumber: nextLabel === 'HOME' ? '' : prev.roomNumber,
                    }));
                  }}
                  disabled={user?.customerType === 'ATITHI'}
                  style={{ width: '100%', padding: '0.6rem', background: '#ffffff', border: '1px solid #cbd5e1', color: 'var(--text-primary)', borderRadius: '0.4rem' }}
                >
                  {user?.customerType === 'ATITHI' ? (
                    <option value="HOME">Home</option>
                  ) : (
                    <>
                      <option value="HOSTEL">Hostel</option>
                      <option value="HOME">Home</option>
                      <option value="OTHER">Other</option>
                    </>
                  )}
                </select>
              </div>

              {/* Render Hostel Selector only for STUDENT + Hostel address */}
              {user?.customerType !== 'ATITHI' && addressFormData.label === 'HOSTEL' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Hostel Name</label>
                    <select
                      value={addressFormData.hostelName}
                      onChange={(e) => setAddressFormData({ ...addressFormData, hostelName: e.target.value })}
                      style={{ width: '100%', padding: '0.6rem', background: '#ffffff', border: '1px solid #cbd5e1', color: 'var(--text-primary)', borderRadius: '0.4rem' }}
                    >
                      <option value="">Select Hostel</option>
                      {hostelsList.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Room Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 302"
                      value={addressFormData.roomNumber}
                      onChange={(e) => setAddressFormData({ ...addressFormData, roomNumber: e.target.value })}
                      style={{ width: '100%', padding: '0.6rem', background: '#ffffff', border: '1px solid #cbd5e1', color: 'var(--text-primary)', borderRadius: '0.4rem' }}
                    />
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Full Address *</label>
                <textarea
                  required
                  placeholder="Block / Floor / Full Hostel Address..."
                  value={addressFormData.fullAddress}
                  onChange={(e) => setAddressFormData({ ...addressFormData, fullAddress: e.target.value })}
                  rows={2}
                  style={{ width: '100%', padding: '0.6rem', background: '#ffffff', border: '1px solid #cbd5e1', color: 'var(--text-primary)', borderRadius: '0.4rem' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Landmark</label>
                <input
                  type="text"
                  placeholder="Near Mess / Main Gate"
                  value={addressFormData.landmark}
                  onChange={(e) => setAddressFormData({ ...addressFormData, landmark: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem', background: '#ffffff', border: '1px solid #cbd5e1', color: 'var(--text-primary)', borderRadius: '0.4rem' }}
                />
              </div>

              {/* Location Pin Section */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.4rem', padding: '0.75rem 0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span>Location</span>
                    <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  {hasValidLocation ? (
                    <span style={{ fontSize: '0.78rem', color: '#16a34a', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      ✓ Location pinned
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Pin required to save
                    </span>
                  )}
                </div>

                {hasValidLocation ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Coordinates: {Number(addressFormData.latitude).toFixed(4)}, {Number(addressFormData.longitude).toFixed(4)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
                        navigator.geolocation.getCurrentPosition(
                          (p) => setAddressFormData((prev) => ({ ...prev, latitude: parseFloat(p.coords.latitude.toFixed(7)), longitude: parseFloat(p.coords.longitude.toFixed(7)) })),
                          (err) => alert('Location error: ' + err.message),
                          { enableHighAccuracy: true, timeout: 10000 }
                        );
                      }}
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '0.3rem', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      Update
                    </button>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 0.5rem 0' }}>
                      Pin your location on the map to save this address.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
                        navigator.geolocation.getCurrentPosition(
                          (p) => setAddressFormData((prev) => ({ ...prev, latitude: parseFloat(p.coords.latitude.toFixed(7)), longitude: parseFloat(p.coords.longitude.toFixed(7)) })),
                          (err) => alert('Could not get location: ' + err.message),
                          { enableHighAccuracy: true, timeout: 10000 }
                        );
                      }}
                      className="btn-secondary"
                      style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: '#ffffff', border: '1px solid #cbd5e1', color: 'var(--text-primary)', fontWeight: '600' }}
                    >
                      <Compass size={14} /> 📍 Pin My Location
                    </button>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowAddressModal(false)} className="btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!hasValidLocation}
                  className="btn-primary"
                  style={{
                    padding: '0.5rem 1rem',
                    opacity: !hasValidLocation ? 0.5 : 1,
                    cursor: !hasValidLocation ? 'not-allowed' : 'pointer',
                    background: !hasValidLocation ? '#94a3b8' : undefined,
                  }}
                  title={!hasValidLocation ? 'Please pin your location on the map first' : 'Save Address'}
                >
                  Save Address
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @media (min-width: 900px) {
          .checkout-grid {
            grid-template-columns: 1fr 360px !important;
          }
        }
      `}</style>
    </div>
  );
}
