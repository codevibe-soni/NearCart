import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import api from '../services/api';
import { getCategories } from '../services/studentService';
import {
  Store,
  Plus,
  Package,
  ShoppingBag,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  User,
  List,
  Upload,
  X,
  Star,
  Tag,
} from 'lucide-react';
import CouponManagement from '../components/CouponManagement';

export default function Shopkeeper() {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState('DASHBOARD');

  const [shops, setShops] = useState([]);
  const [selectedShopId, setSelectedShopId] = useState('');
  const [isCreatingNewShop, setIsCreatingNewShop] = useState(false);

  const [shop, setShop] = useState(null);
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [orders, setOrders] = useState([]);
  const [categories, setCategories] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search & Filters for Products
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');

  // Shop Form State
  const [shopForm, setShopForm] = useState({
    name: '',
    description: '',
    phone: '',
    category: '',
    address: '',
    openingTime: '',
    closingTime: '',
    minimumOrderAmount: 0,
    deliveryFee: 0,
    deliveryChargeSlabs: [],
    packingCharges: 0,
    logo: '',
    coverImage: '',
    isOpen: true,
  });

  const [newSlab, setNewSlab] = useState({ minDistanceKm: '', maxDistanceKm: '', charge: '' });

  const handleAddSlab = () => {
    const min = Number(newSlab.minDistanceKm);
    const max = Number(newSlab.maxDistanceKm);
    const charge = Number(newSlab.charge);

    if (isNaN(min) || min < 0) {
      alert('Please enter a valid minimum distance (0 or greater).');
      return;
    }
    if (isNaN(max) || max <= min) {
      alert('Maximum distance must be greater than minimum distance.');
      return;
    }
    if (isNaN(charge) || charge < 0) {
      alert('Delivery charge cannot be negative.');
      return;
    }

    const currentSlabs = shopForm.deliveryChargeSlabs || [];
    const overlap = currentSlabs.some(
      (s) =>
        (min >= s.minDistanceKm && min < s.maxDistanceKm) ||
        (max > s.minDistanceKm && max <= s.maxDistanceKm) ||
        (min <= s.minDistanceKm && max >= s.maxDistanceKm)
    );
    if (overlap) {
      alert('Distance slab overlaps with an existing range.');
      return;
    }

    const updatedSlabs = [...currentSlabs, { minDistanceKm: min, maxDistanceKm: max, charge }].sort(
      (a, b) => a.minDistanceKm - b.minDistanceKm
    );
    setShopForm({ ...shopForm, deliveryChargeSlabs: updatedSlabs });
    setNewSlab({ minDistanceKm: '', maxDistanceKm: '', charge: '' });
  };

  const [productSubmitting, setProductSubmitting] = useState(false);

  // Product Add/Edit Modal & Multi-Image State
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);

  // Product Details View Modal State (Click State)
  const [showProductDetailModal, setShowProductDetailModal] = useState(false);
  const [selectedDetailProduct, setSelectedDetailProduct] = useState(null);
  const [activeDetailImageIndex, setActiveDetailImageIndex] = useState(0);

  const openProductDetailModal = (p) => {
    setSelectedDetailProduct(p);
    setActiveDetailImageIndex(0);
    setShowProductDetailModal(true);
  };

  const [productForm, setProductForm] = useState({

    name: '',
    description: '',
    category: '',
    price: '',
    discountPrice: '',
    unit: 'piece',
    stock: 10,
    sku: '',
    isAvailable: true,
    images: [],
    gstPercentage: 0,
    packingCharges: 0,
  });

  const [imageInput, setImageInput] = useState('');

  const fetchData = async (targetShopId = null) => {
    setLoading(true);
    setError('');
    try {
      const [shopsRes, catRes] = await Promise.all([
        api.get('/shopkeeper/shops'),
        getCategories(),
      ]);

      if (catRes.success) {
        setCategories(catRes.categories);
      }

      const ownedShops = shopsRes.success ? (shopsRes.shops || []) : [];
      setShops(ownedShops);

      const activeShopId = targetShopId || selectedShopId || (ownedShops.length > 0 ? ownedShops[0]._id : '');
      if (activeShopId) {
        setSelectedShopId(activeShopId);
        setIsCreatingNewShop(false);

        const [shopRes, statsRes, prodRes, invRes, ordRes] = await Promise.all([
          api.get(`/shopkeeper/shop?shopId=${activeShopId}`),
          api.get(`/shopkeeper/stats?shopId=${activeShopId}`),
          api.get(`/shopkeeper/products?shopId=${activeShopId}`),
          api.get(`/shopkeeper/inventory?shopId=${activeShopId}`),
          api.get(`/shopkeeper/orders?shopId=${activeShopId}`),
        ]);

        if (shopRes.success && shopRes.shop) {
          setShop(shopRes.shop);
          setShopForm({
            name: shopRes.shop.name || '',
            description: shopRes.shop.description || '',
            phone: shopRes.shop.phone || '',
            category: shopRes.shop.category?._id || shopRes.shop.category || '',
            address: shopRes.shop.address || '',
            openingTime: shopRes.shop.openingTime || '',
            closingTime: shopRes.shop.closingTime || '',
            minimumOrderAmount: shopRes.shop.minimumOrderAmount || 0,
            deliveryFee: shopRes.shop.deliveryFee || 0,
            deliveryChargeSlabs: shopRes.shop.deliveryChargeSlabs || [],
            packingCharges: shopRes.shop.packingCharges || 0,
            logo: shopRes.shop.logo || shopRes.shop.coverImage || '',
            coverImage: shopRes.shop.coverImage || shopRes.shop.logo || '',
            isOpen: shopRes.shop.isOpen !== undefined ? shopRes.shop.isOpen : true,
            upiEnabled: shopRes.shop.upiEnabled !== undefined ? shopRes.shop.upiEnabled : true,
            upiId: shopRes.shop.upiId || '',
            upiQrImage: shopRes.shop.upiQrImage || '',
          });
        } else {
          setShop(null);
        }

        if (statsRes.success) setStats(statsRes.stats);
        if (prodRes.success) setProducts(prodRes.products);
        if (invRes.success) setInventory(invRes.inventory);
        if (ordRes.success) setOrders(ordRes.orders);
      } else {
        setShop(null);
        setStats(null);
        setProducts([]);
        setInventory([]);
        setOrders([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load shopkeeper data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const { socket } = useNotifications();

  // Listen to real-time order events for Shopkeeper
  useEffect(() => {
    if (!socket || !selectedShopId) return;

    const handleNewOrder = async (data) => {
      console.log('⚡ [Shopkeeper Realtime] order:new received:', data);
      try {
        const ordRes = await api.get(`/shopkeeper/orders?shopId=${selectedShopId}`);
        if (ordRes.success) setOrders(ordRes.orders);
        const statsRes = await api.get(`/shopkeeper/stats?shopId=${selectedShopId}`);
        if (statsRes.success) setStats(statsRes.stats);
      } catch (err) {
        console.warn('Realtime shopkeeper refresh notice:', err.message);
      }
    };

    const handleOrderUpdated = async (data) => {
      console.log('⚡ [Shopkeeper Realtime] order:updated received:', data);
      try {
        const ordRes = await api.get(`/shopkeeper/orders?shopId=${selectedShopId}`);
        if (ordRes.success) setOrders(ordRes.orders);
        const statsRes = await api.get(`/shopkeeper/stats?shopId=${selectedShopId}`);
        if (statsRes.success) setStats(statsRes.stats);
      } catch (err) {
        console.warn('Realtime shopkeeper refresh notice:', err.message);
      }
    };

    socket.on('order:new', handleNewOrder);
    socket.on('order:updated', handleOrderUpdated);

    return () => {
      socket.off('order:new', handleNewOrder);
      socket.off('order:updated', handleOrderUpdated);
    };
  }, [socket, selectedShopId]);

  // Handle Shop Create / Edit
  const handleSaveShop = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!shopForm.category) {
      setError('Please select a valid shop category.');
      return;
    }

    try {
      let res;
      if (shop && !isCreatingNewShop) {
        res = await api.put(`/shopkeeper/shop?shopId=${shop._id}`, shopForm);
      } else {
        res = await api.post('/shopkeeper/shop', shopForm);
      }

      if (res.success) {
        setSuccess(`Shop ${shop && !isCreatingNewShop ? 'updated' : 'created'} successfully!`);
        setIsCreatingNewShop(false);
        setSelectedShopId(res.shop._id);
        fetchData(res.shop._id);
      }
    } catch (err) {
      setError(err.message || 'Failed to save shop.');
    }
  };

  const [selectedVariants, setSelectedVariants] = useState({ Half: false, Full: false, Small: false, Medium: false, Large: false, Custom: false });
  const [variantPrices, setVariantPrices] = useState({ Half: '', Full: '', Small: '', Medium: '', Large: '' });
  const [variantStocks, setVariantStocks] = useState({ Half: 10, Full: 10, Small: 10, Medium: 10, Large: 10 });
  const [variantPackingCharges, setVariantPackingCharges] = useState({ Half: 0, Full: 0, Small: 0, Medium: 0, Large: 0 });
  const [customVariantRows, setCustomVariantRows] = useState([{ name: '', price: '', stock: 10, packingCharges: 0 }]);

  // Open Modal for Add/Edit Product
  const openProductModal = (product = null) => {
    setError('');
    setSuccess('');
    setImageInput('');
    setSelectedVariants({ Half: false, Full: false, Small: false, Medium: false, Large: false, Custom: false });
    setVariantPrices({ Half: '', Full: '', Small: '', Medium: '', Large: '' });
    setVariantStocks({ Half: 10, Full: 10, Small: 10, Medium: 10, Large: 10 });
    setVariantPackingCharges({ Half: 0, Full: 0, Small: 0, Medium: 0, Large: 0 });
    setCustomVariantRows([{ name: '', price: '', stock: 10, packingCharges: 0 }]);

    if (product) {
      setEditingProductId(product._id);
      setProductForm({
        name: product.name || '',
        variantName: product.variantName || '',
        description: product.description || '',
        category: product.category?._id || product.category || '',
        price: product.price,
        discountPrice: product.discountPrice !== undefined ? product.discountPrice : '',
        unit: product.unit || 'piece',
        stock: product.stock,
        sku: product.sku || '',
        isAvailable: product.isAvailable,
        images: Array.isArray(product.images) ? [...product.images] : [],
        gstPercentage: product.gstPercentage || 0,
        packingCharges: product.packingCharges !== undefined ? product.packingCharges : 0,
      });
    } else {
      setEditingProductId(null);
      setProductForm({
        name: '',
        variantName: '',
        description: '',
        category: categories.length > 0 ? categories[0]._id : '',
        price: '',
        discountPrice: '',
        unit: 'piece',
        stock: 10,
        sku: '',
        isAvailable: true,
        images: [],
        gstPercentage: 0,
        packingCharges: 0,
      });
    }
    setShowProductModal(true);
  };

  // Add image URL or File Data URL to form list (Max 5)
  const handleAddImageUrl = () => {
    if (!imageInput.trim()) return;
    if (productForm.images.length >= 5) {
      setError('You can upload up to 5 images per product.');
      return;
    }
    setProductForm({
      ...productForm,
      images: [...productForm.images, imageInput.trim()],
    });
    setImageInput('');
  };

  // Direct Browser -> Cloudinary upload helper using server signature
  const uploadDirectToCloudinary = async (fileItem) => {
    if (typeof fileItem === 'string') {
      return fileItem; // Already a Cloudinary URL or remote URL
    }
    const file = fileItem.file;
    if (!file) {
      throw new Error('Invalid file object');
    }

    // 1. Get signed params from server
    const signRes = await api.post('/shopkeeper/cloudinary/sign', { folder: 'nearcart/products' });
    if (!signRes.success || !signRes.signature) {
      throw new Error('Failed to get Cloudinary upload signature from server');
    }

    // 2. Prepare FormData with raw File object (NO Base64 conversion)
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', signRes.apiKey);
    formData.append('timestamp', signRes.timestamp);
    formData.append('signature', signRes.signature);
    formData.append('folder', signRes.folder);

    // 3. Upload directly from browser to Cloudinary upload endpoint
    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${signRes.cloudName}/image/upload`;
    const response = await fetch(cloudinaryUrl, {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();
    if (!response.ok || !result.secure_url) {
      throw new Error(result.error?.message || 'Direct Cloudinary upload failed');
    }

    return result.secure_url;
  };

  // Handle local File selection (Store File object + URL.createObjectURL for fast local preview)
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    if (productForm.images.length + files.length > 5) {
      setError('You can upload up to 5 images per product.');
      return;
    }

    const newImageItems = [];
    for (const file of files) {
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
        setError('Only JPG, PNG and WEBP images are allowed.');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB.');
        return;
      }
      const previewUrl = URL.createObjectURL(file);
      newImageItems.push({ file, previewUrl });
    }

    setProductForm((prev) => ({
      ...prev,
      images: [...prev.images, ...newImageItems],
    }));
  };

  // Remove Image from product images list
  const handleRemoveImage = (index) => {
    setProductForm((prev) => {
      const target = prev.images[index];
      if (target && typeof target === 'object' && target.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return {
        ...prev,
        images: prev.images.filter((_, i) => i !== index),
      };
    });
  };

  // Save Product
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (productSubmitting) return;

    setError('');
    setSuccess('');

    if (productForm.price !== undefined && productForm.price !== '') {
      const p = parseFloat(productForm.price);
      if (productForm.discountPrice !== '' && productForm.discountPrice !== null && productForm.discountPrice !== undefined) {
        const dp = parseFloat(productForm.discountPrice);
        if (!isNaN(dp)) {
          if (dp < 0) {
            setError('Discount price cannot be negative.');
            return;
          }
          if (dp > p) {
            setError('Discount price cannot be greater than regular price.');
            return;
          }
        }
      }
    }

    try {
      setProductSubmitting(true);

      // Upload raw File objects DIRECTLY to Cloudinary before calling Product API
      const uploadedCloudinaryUrls = await Promise.all(
        productForm.images.map((imgItem) => uploadDirectToCloudinary(imgItem))
      );

      // Clean up object URLs
      productForm.images.forEach((imgItem) => {
        if (typeof imgItem === 'object' && imgItem.previewUrl) {
          URL.revokeObjectURL(imgItem.previewUrl);
        }
      });

      const sanitizedProductForm = {
        ...productForm,
        images: uploadedCloudinaryUrls,
      };

      let res;
      const shopParam = selectedShopId ? `?shopId=${selectedShopId}` : '';
      if (editingProductId) {
        res = await api.put(`/shopkeeper/products/${editingProductId}${shopParam}`, sanitizedProductForm);
      } else {
        const clientKey = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'prod-' + Date.now() + '-' + Math.random().toString(36).substring(2);
        
        let variants = null;
        const hasVariantSelection = Object.values(selectedVariants).some(Boolean);
        if (hasVariantSelection) {
          variants = [];
          const standardSizes = ['Half', 'Full', 'Small', 'Medium', 'Large'];
          for (const sz of standardSizes) {
            if (selectedVariants[sz]) {
              const pVal = parseFloat(variantPrices[sz]);
              if (isNaN(pVal) || pVal < 0) {
                setError(`Please enter a valid price for size ${sz}`);
                setProductSubmitting(false);
                return;
              }
              variants.push({
                variantName: sz,
                price: pVal,
                stock: Number(variantStocks[sz] !== undefined ? variantStocks[sz] : 10),
                packingCharges: Number(variantPackingCharges[sz] !== undefined ? variantPackingCharges[sz] : 0),
              });
            }
          }
          if (selectedVariants.Custom) {
            for (const cRow of customVariantRows) {
              if (!cRow.name.trim()) {
                setError('Please provide a name for all custom variants.');
                setProductSubmitting(false);
                return;
              }
              const pVal = parseFloat(cRow.price);
              if (isNaN(pVal) || pVal < 0) {
                setError(`Please enter a valid price for variant "${cRow.name}".`);
                setProductSubmitting(false);
                return;
              }
              variants.push({
                variantName: cRow.name.trim(),
                price: pVal,
                stock: Number(cRow.stock !== undefined ? cRow.stock : 10),
                packingCharges: Number(cRow.packingCharges !== undefined ? cRow.packingCharges : 0),
              });
            }
          }
          if (variants.length === 0) {
            setError('Please select at least one variant size or add a custom variant.');
            setProductSubmitting(false);
            return;
          }
        }

        res = await api.post(`/shopkeeper/products${shopParam}`, {
          ...sanitizedProductForm,
          variants,
          idempotencyKey: clientKey,
        });
      }

      if (res.success) {
        setSuccess(`Product ${editingProductId ? 'updated' : 'added'} successfully!`);
        setShowProductModal(false);
        fetchData(selectedShopId);
      }
    } catch (err) {
      setError(err.message || 'Failed to save product.');
    } finally {
      setProductSubmitting(false);
    }
  };

  // Delete Product
  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      const shopParam = selectedShopId ? `?shopId=${selectedShopId}` : '';
      const res = await api.delete(`/shopkeeper/products/${id}${shopParam}`);
      if (res.success) {
        setSuccess('Product deleted successfully.');
        fetchData(selectedShopId);
      }
    } catch (err) {
      setError(err.message || 'Failed to delete product.');
    }
  };

  // Update Order Status
  const handleUpdateOrderStatus = async (orderId, nextStatus, cancellationReason = '') => {
    setError('');
    setSuccess('');
    try {
      const shopParam = selectedShopId ? `?shopId=${selectedShopId}` : '';
      const res = await api.patch(`/shopkeeper/orders/${orderId}/status${shopParam}`, {
        orderStatus: nextStatus,
        cancellationReason,
      });
      if (res && res.success) {
        setSuccess(`Order status updated to ${nextStatus}`);
        fetchData(selectedShopId);
      }
    } catch (err) {
      setError(err.message || 'Failed to update order status.');
    }
  };

  // Filter Products for Tab
  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase());
    const matchesCat = !selectedCategoryFilter || (p.category?._id || p.category) === selectedCategoryFilter;
    return matchesSearch && matchesCat;
  });

  if (loading) {
    return <div className="container" style={{ padding: '4rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading Shopkeeper Business Portal...</div>;
  }

  return (
    <div className="container" style={{ padding: '3rem 1.5rem 5rem 1.5rem' }}>
      {/* Header Banner */}
      <div className="glass-card" style={{ padding: '2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '3.5rem', height: '3.5rem', borderRadius: '0.75rem', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Store size={32} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                {isCreatingNewShop ? 'Create New Shop' : shop ? shop.name : 'Shopkeeper Portal'}
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                Owner: <strong>{user?.name}</strong> • Account Status: <strong style={{ color: 'var(--success)' }}>{user?.accountStatus}</strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {shops.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Current Shop:</label>
                <select
                  value={isCreatingNewShop ? '__NEW__' : (selectedShopId || shop?._id || '')}
                  onChange={(e) => {
                    if (e.target.value === '__NEW__') {
                      setIsCreatingNewShop(true);
                      setShop(null);
                      setShopForm({
                        name: '',
                        description: '',
                        phone: '',
                        category: categories.length > 0 ? categories[0]._id : '',
                        address: '',
                        openingTime: '09:00 AM',
                        closingTime: '09:00 PM',
                        minimumOrderAmount: 0,
                        deliveryFee: 0,
                        isOpen: true,
                      });
                    } else {
                      setIsCreatingNewShop(false);
                      setSelectedShopId(e.target.value);
                      fetchData(e.target.value);
                    }
                  }}
                  className="form-input"
                  style={{ padding: '0.4rem 0.75rem', fontSize: '0.9rem', fontWeight: '700', width: 'auto', background: '#ffffff', cursor: 'pointer' }}
                >
                  {shops.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                  <option value="__NEW__">+ Add New Shop</option>
                </select>
              </div>
            )}

            {!isCreatingNewShop && (
              <button
                onClick={() => {
                  setIsCreatingNewShop(true);
                  setShop(null);
                  setShopForm({
                    name: '',
                    description: '',
                    phone: '',
                    category: categories.length > 0 ? categories[0]._id : '',
                    address: '',
                    openingTime: '',
                    closingTime: '',
                    minimumOrderAmount: 0,
                    deliveryFee: 0,
                    packingCharges: 0,
                    logo: '',
                    coverImage: '',
                    isOpen: true,
                  });
                }}
                className="btn-secondary"
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}
              >
                <Plus size={14} /> Add New Shop
              </button>
            )}

            {shop && !isCreatingNewShop && (
              <span style={{ padding: '0.3rem 0.75rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: '700', background: shop.isOpen ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: shop.isOpen ? 'var(--success)' : 'var(--danger)', border: `1px solid ${shop.isOpen ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}` }}>
                SHOP {shop.isOpen ? 'OPEN' : 'CLOSED'}
              </span>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', marginBottom: '1.5rem' }}>
          <AlertCircle size={18} /> <span>{error}</span>
        </div>
      )}

      {success && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 'var(--radius-sm)', color: 'var(--success)', marginBottom: '1.5rem' }}>
          <CheckCircle2 size={18} /> <span>{success}</span>
        </div>
      )}

      {/* Case 1: No Shop Created Yet OR Creating New Shop */}
      {(!shop || isCreatingNewShop) ? (
        <div className="glass-card" style={{ maxWidth: '600px', margin: '0 auto', padding: '2.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem', color: 'var(--text-primary)' }}>
            {isCreatingNewShop ? 'Create Another Campus Shop' : 'Register Your Campus Shop'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            {isCreatingNewShop
              ? 'Add a new shop to your account. All your shops are managed from this single shopkeeper account.'
              : 'Create your store profile to start adding products and accepting orders.'}
          </p>

          <form onSubmit={handleSaveShop}>
            <div className="form-group">
              <label className="form-label">Shop Name</label>
              <input type="text" className="form-input" placeholder="e.g. Campus Central Store" value={shopForm.name} onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })} required />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <input type="text" className="form-input" placeholder="e.g. Snacks, groceries, stationery" value={shopForm.description} onChange={(e) => setShopForm({ ...shopForm, description: e.target.value })} />
            </div>

            <div className="form-group">
              <label className="form-label">Shop Category / Type</label>
              <select
                name="category"
                className="form-input"
                value={shopForm.category}
                onChange={(e) => setShopForm({ ...shopForm, category: e.target.value })}
                required
              >
                <option value="">-- Select Category --</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Campus Address</label>
              <input type="text" className="form-input" placeholder="e.g. SAC Building, Room 102" value={shopForm.address} onChange={(e) => setShopForm({ ...shopForm, address: e.target.value })} required />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Min Order (₹)</label>
                <input type="number" className="form-input" value={shopForm.minimumOrderAmount} onChange={(e) => setShopForm({ ...shopForm, minimumOrderAmount: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Delivery Fee (₹)</label>
                <input type="number" className="form-input" value={shopForm.deliveryFee} onChange={(e) => setShopForm({ ...shopForm, deliveryFee: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button type="submit" className="btn-primary" style={{ flex: 1 }}>
                {isCreatingNewShop ? 'Create Shop' : 'Create Campus Shop'}
              </button>
              {shops.length > 0 && isCreatingNewShop && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNewShop(false);
                    if (shops.length > 0) {
                      setSelectedShopId(shops[0]._id);
                      fetchData(shops[0]._id);
                    }
                  }}
                  className="btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      ) : (
        /* Case 2: Full Business Portal with Sub-Navigation */
        <div>
          {/* Sub-Navigation Tabs */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
            {[
              { id: 'DASHBOARD', label: 'Overview', icon: TrendingUp },
              { id: 'PRODUCTS', label: 'Products', icon: Package },
              { id: 'INVENTORY', label: 'Inventory', icon: Layers },
              { id: 'ORDERS', label: 'Orders', icon: ShoppingBag },
              { id: 'COUPONS', label: 'Coupons', icon: Tag },
              { id: 'REVIEWS', label: 'Reviews & Ratings', icon: Star },
              { id: 'PAYMENT_SETTINGS', label: 'Payment Settings', icon: DollarSign },
              { id: 'MY_SHOP', label: 'Shop Settings', icon: Store },
              { id: 'PROFILE', label: 'My Profile', icon: User },
            ].map((tab) => {
              const IconComponent = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                >
                  <IconComponent size={16} /> {tab.label}
                </button>
              );
            })}
          </div>

          {/* TAB 1: OVERVIEW DASHBOARD */}
          {activeTab === 'DASHBOARD' && stats && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Total Products</span>
                  <strong style={{ fontSize: '2rem', color: 'var(--primary)' }}>{stats.totalProducts}</strong>
                </div>
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Pending Orders</span>
                  <strong style={{ fontSize: '2rem', color: 'var(--warning)' }}>{stats.pendingOrders}</strong>
                </div>
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Today's Orders</span>
                  <strong style={{ fontSize: '2rem', color: 'var(--success)' }}>{stats.todaysOrders}</strong>
                </div>
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Today's Sales</span>
                  <strong style={{ fontSize: '2rem', color: 'var(--text-primary)' }}>₹{stats.todaysSales}</strong>
                </div>
                <div className="glass-card" style={{ padding: '1.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>Low Stock Alert</span>
                  <strong style={{ fontSize: '2rem', color: stats.lowStock > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{stats.lowStock}</strong>
                </div>
              </div>
            </div>
          )}

          {/* COUPONS TAB */}
          {activeTab === 'COUPONS' && <CouponManagement shop={shop} />}

          {/* REVIEWS & RATINGS TAB */}
          {activeTab === 'REVIEWS' && <ShopkeeperReviewsTab shop={shop} />}

          {/* TAB 2: PRODUCTS MANAGEMENT */}
          {activeTab === 'PRODUCTS' && (
            <div className="glass-card sk-products-card-container" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ fontSize: '1.3rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                  Product Inventory ({filteredProducts.length})
                </h3>

                <div className="sk-product-header-controls" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    className="form-input sk-product-search-input"
                    placeholder="Search products..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    style={{ width: '200px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                  />
                  <select
                    className="form-input sk-product-category-select"
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    style={{ width: '160px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                  >
                    <option value="">All Categories</option>
                    {categories.map((c) => (<option key={c._id} value={c._id}>{c.name}</option>))}
                  </select>
                  <button onClick={() => openProductModal(null)} className="btn-primary" style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}>
                    <Plus size={16} /> Add Product
                  </button>
                </div>
              </div>

              {filteredProducts.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No products added yet.</p>
              ) : (
                <>
                  {/* DESKTOP TABLE VIEW (Visible on Desktop >= 769px) */}
                  <div className="sk-products-desktop-table" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '0.75rem' }}>Main Image</th>
                          <th style={{ padding: '0.75rem' }}>Product Name</th>
                          <th style={{ padding: '0.75rem' }}>Category</th>
                          <th style={{ padding: '0.75rem' }}>Price</th>
                          <th style={{ padding: '0.75rem' }}>Stock</th>
                          <th style={{ padding: '0.75rem' }}>Status</th>
                          <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.map((p) => (
                          <tr key={p._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '0.75rem', cursor: 'pointer' }} onClick={() => openProductDetailModal(p)}>
                              <div style={{ width: '45px', height: '45px', borderRadius: '0.375rem', background: '#f1f5f9', border: '1px solid var(--border-color)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {p.images && p.images.length > 0 ? (
                                  <img src={p.images[0]} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>No img</span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '0.75rem', color: 'var(--text-primary)', fontWeight: '600', cursor: 'pointer' }} onClick={() => openProductDetailModal(p)}>
                              {p.name}
                              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.unit} ({p.images ? p.images.length : 0} imgs)</span>
                            </td>
                            <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>{p.category?.name || 'General'}</td>
                            <td style={{ padding: '0.75rem' }}>
                              ₹{p.discountPrice != null && p.discountPrice < p.price ? p.discountPrice : p.price}
                              {p.discountPrice != null && p.discountPrice < p.price && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textDecoration: 'line-through', marginLeft: '0.4rem' }}>₹{p.price}</span>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem' }}>{p.stock}</td>
                            <td style={{ padding: '0.75rem' }}>
                              <span style={{ padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: '700', background: p.stock > 0 && p.isAvailable ? '#d1fae5' : '#fee2e2', color: p.stock > 0 && p.isAvailable ? '#047857' : '#b91c1c' }}>
                                {p.stock === 0 ? 'OUT OF STOCK' : p.stock <= 5 ? 'LOW STOCK' : 'IN STOCK'}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                              <button onClick={() => openProductModal(p)} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', marginRight: '0.5rem' }}>
                                <Edit2 size={14} /> Edit
                              </button>
                              <button onClick={() => handleDeleteProduct(p._id)} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: 'var(--danger)' }}>
                                <Trash2 size={14} /> Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* MOBILE CARDS VIEW (Visible on Mobile <= 768px) */}
                  <div className="sk-products-mobile-cards">
                    {filteredProducts.map((p) => {
                      const effectivePrice = p.discountPrice != null && p.discountPrice < p.price ? p.discountPrice : p.price;
                      return (
                        <div
                          key={p._id}
                          style={{
                            background: '#ffffff',
                            border: '1px solid var(--border-color)',
                            borderRadius: '0.75rem',
                            overflow: 'hidden',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                            display: 'flex',
                            flexDirection: 'column',
                            width: '100%',
                            boxSizing: 'border-box',
                          }}
                        >
                          {/* Image Container */}
                          <div
                            onClick={() => openProductDetailModal(p)}
                            style={{
                              position: 'relative',
                              width: '100%',
                              height: '160px',
                              background: '#f8fafc',
                              borderBottom: '1px solid var(--border-color)',
                              overflow: 'hidden',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {p.images && p.images.length > 0 ? (
                              <img
                                src={p.images[0]}
                                alt={p.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No Image</div>
                            )}

                            {/* Category Badge */}
                            <span
                              style={{
                                position: 'absolute',
                                top: '0.5rem',
                                left: '0.5rem',
                                background: 'rgba(15, 23, 42, 0.75)',
                                backdropFilter: 'blur(4px)',
                                color: '#ffffff',
                                fontSize: '0.7rem',
                                fontWeight: '700',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '0.25rem',
                                maxWidth: '140px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {p.category?.name || 'General'}
                            </span>

                            {/* Stock Badge */}
                            <span
                              style={{
                                position: 'absolute',
                                top: '0.5rem',
                                right: '0.5rem',
                                padding: '0.2rem 0.55rem',
                                borderRadius: '0.25rem',
                                fontSize: '0.7rem',
                                fontWeight: '800',
                                background: p.stock > 0 && p.isAvailable ? '#d1fae5' : '#fee2e2',
                                color: p.stock > 0 && p.isAvailable ? '#047857' : '#b91c1c',
                              }}
                            >
                              {p.stock === 0 ? 'OUT OF STOCK' : p.stock <= 5 ? 'LOW STOCK' : 'IN STOCK'}
                            </span>
                          </div>

                          {/* Content Section */}
                          <div
                            onClick={() => openProductDetailModal(p)}
                            style={{ padding: '0.85rem 1rem', flex: 1, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}
                          >
                            <h4
                              style={{
                                margin: 0,
                                fontSize: '0.95rem',
                                fontWeight: '700',
                                color: 'var(--text-primary)',
                                overflowWrap: 'break-word',
                                wordBreak: 'break-word',
                                lineHeight: '1.3',
                              }}
                            >
                              {p.name}
                            </h4>

                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--primary)' }}>
                                ₹{effectivePrice}
                              </span>
                              {p.discountPrice != null && p.discountPrice < p.price && (
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                                  ₹{p.price}
                                </span>
                              )}
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                                Unit: {p.unit || 'piece'}
                              </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '0.2rem', flexWrap: 'wrap', gap: '0.25rem' }}>
                              <span>Stock: <strong>{p.stock}</strong></span>
                              <span>Packing: <strong>₹{p.packingCharges || 0} / item</strong></span>
                            </div>
                          </div>

                          {/* Actions Footer */}
                          <div
                            style={{
                              padding: '0.65rem 1rem',
                              borderTop: '1px solid var(--border-color)',
                              background: '#f8fafc',
                              display: 'flex',
                              gap: '0.5rem',
                            }}
                          >
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); openProductModal(p); }}
                              className="btn-secondary"
                              style={{ flex: 1, minHeight: '40px', padding: '0.45rem', fontSize: '0.85rem' }}
                            >
                              <Edit2 size={15} /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleDeleteProduct(p._id); }}
                              className="btn-secondary"
                              style={{ flex: 1, minHeight: '40px', padding: '0.45rem', fontSize: '0.85rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                            >
                              <Trash2 size={15} /> Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}


          {/* TAB 3: INVENTORY TRACKING */}
          {activeTab === 'INVENTORY' && (
            <div className="glass-card" style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                Inventory & Stock Control ({inventory.length})
              </h3>

              {inventory.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No inventory records.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '0.75rem' }}>Item</th>
                        <th style={{ padding: '0.75rem' }}>SKU</th>
                        <th style={{ padding: '0.75rem' }}>Category</th>
                        <th style={{ padding: '0.75rem' }}>Current Stock</th>
                        <th style={{ padding: '0.75rem' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventory.map((inv) => (
                        <tr key={inv._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '0.75rem', fontWeight: '600', color: 'var(--text-primary)' }}>{inv.name}</td>
                          <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>{inv.sku}</td>
                          <td style={{ padding: '0.75rem' }}>{inv.category}</td>
                          <td style={{ padding: '0.75rem', fontWeight: '700' }}>{inv.stock}</td>
                          <td style={{ padding: '0.75rem' }}>
                            <span style={{ padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: '700', background: inv.stockStatus === 'OUT_OF_STOCK' ? '#fee2e2' : inv.stockStatus === 'LOW_STOCK' ? '#fef3c7' : '#d1fae5', color: inv.stockStatus === 'OUT_OF_STOCK' ? '#b91c1c' : inv.stockStatus === 'LOW_STOCK' ? '#b45309' : '#047857' }}>
                              {inv.stockStatus}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ORDERS */}
          {activeTab === 'ORDERS' && (
            <div className="glass-card" style={{ padding: '2rem' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                Incoming Campus Orders ({orders.length})
              </h3>

              {orders.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No orders received yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {orders.map((ord) => (
                    <div key={ord._id} style={{ padding: '1.25rem', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <strong>Order #{ord.orderNumber}</strong>
                        <span style={{
                          color: ['CANCELLED', 'SHOP_REJECTED'].includes(ord.orderStatus) ? 'var(--danger)' : 'var(--primary)',
                          fontWeight: '700',
                        }}>
                          {ord.orderStatus}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Student: {ord.user?.name} ({ord.user?.phone}) • Total: ₹{ord.totalAmount}
                      </p>
                      <div style={{ margin: '0.35rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.825rem' }}>
                        <span>Payment: <strong>{ord.paymentMethod}</strong></span>
                        <span style={{
                          padding: '0.15rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.75rem',
                          fontWeight: '700',
                          background: ord.paymentStatus === 'PAID' ? '#d1fae5' : ord.paymentStatus === 'USER_CONFIRMED' ? '#fef3c7' : 'rgba(255, 255, 255, 0.05)',
                          color: ord.paymentStatus === 'PAID' ? '#047857' : ord.paymentStatus === 'USER_CONFIRMED' ? '#b45309' : 'var(--text-muted)',
                        }}>
                          {ord.paymentStatus === 'USER_CONFIRMED' ? '🟡 Payment Claimed — Verification Required' : ord.paymentStatus === 'PAID' ? '🟢 PAID / VERIFIED' : ord.paymentStatus}
                        </span>
                      </div>
                      {/* Ordered Products */}
                      {Array.isArray(ord.items) && ord.items.length > 0 && (
                        <div
                          style={{
                            marginTop: '1rem',
                            padding: '1rem',
                            background: '#f1f5f9',
                            border: '1px solid var(--border-color)',
                            borderRadius: '0.5rem',
                          }}
                        >
                          <h4
                            style={{
                              margin: '0 0 0.75rem 0',
                              color: 'var(--text-primary)',
                              fontSize: '0.95rem',
                            }}
                          >
                            Ordered Items ({ord.items.length})
                          </h4>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {ord.items.map((item, index) => (
                              <div
                                key={item._id || item.product?._id || index}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: '1rem',
                                  padding: '0.65rem',
                                  background: 'rgba(255, 255, 255, 0.5)',
                                  borderRadius: '0.4rem',
                                }}
                              >
                                <div>
                                  <strong
                                    style={{
                                      color: 'var(--text-primary)',
                                      display: 'block',
                                    }}
                                  >
                                    {item.name || item.product?.name || 'Product'}
                                  </strong>

                                  <span
                                    style={{
                                      color: 'var(--text-muted)',
                                      fontSize: '0.8rem',
                                    }}
                                  >
                                    Quantity: {item.quantity}
                                  </span>
                                </div>

                                <div
                                  style={{
                                    color: 'var(--text-primary)',
                                    fontWeight: '700',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  ₹{item.subtotal ?? ((item.price || 0) * (item.quantity || 0))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {ord.cancellationReason && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--danger)', marginTop: '0.25rem' }}>
                          Reason: {ord.cancellationReason}
                        </p>
                      )}
                      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {ord.paymentStatus === 'USER_CONFIRMED' && (
                          <>
                            <button
                              onClick={async () => {
                                try {
                                  setLoading(true);
                                  const res = await api.patch(`/shopkeeper/orders/${ord._id}/verify-payment`);
                                  if (res && res.success) {
                                    setSuccess(`Payment for Order #${ord.orderNumber} verified successfully!`);
                                    fetchData();
                                  }
                                } catch (err) {
                                  setError(err.message || 'Failed to verify payment');
                                } finally {
                                  setLoading(false);
                                }
                              }}
                              className="btn-primary"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
                            >
                              ✓ Verify Payment
                            </button>

                            <button
                              onClick={async () => {
                                if (!window.confirm('Mark this payment as NOT received?')) return;
                                try {
                                  setLoading(true);
                                  const res = await api.patch(`/shopkeeper/orders/${ord._id}/reject-payment`);
                                  if (res && res.success) {
                                    setError(`Payment for Order #${ord.orderNumber} marked as NOT received.`);
                                    fetchData();
                                  }
                                } catch (err) {
                                  setError(err.message || 'Failed to reject payment');
                                } finally {
                                  setLoading(false);
                                }
                              }}
                              className="btn-secondary"
                              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                            >
                              ✕ Payment Not Received
                            </button>
                          </>
                        )}
                        {ord.orderStatus === 'PLACED' && (
                          <>
                            <button onClick={() => handleUpdateOrderStatus(ord._id, 'SHOP_ACCEPTED')} className="btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>Accept Order</button>
                            <button onClick={() => {
                              const reason = window.prompt('Reason for rejecting this order (e.g. Product out of stock):', 'Product out of stock');
                              if (reason !== null) {
                                handleUpdateOrderStatus(ord._id, 'SHOP_REJECTED', reason);
                              }
                            }} className="btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>Reject Order</button>
                          </>
                        )}
                        {ord.orderStatus === 'SHOP_ACCEPTED' && (
                          <>
                            <button onClick={() => handleUpdateOrderStatus(ord._id, 'PREPARING')} className="btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>Start Preparing</button>
                            <button onClick={() => {
                              const reason = window.prompt('Reason for cancelling order:', 'Shop unable to fulfill order');
                              if (reason !== null) {
                                handleUpdateOrderStatus(ord._id, 'CANCELLED', reason);
                              }
                            }} className="btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>Cancel Order</button>
                          </>
                        )}
                        {ord.orderStatus === 'PREPARING' && (
                          <button onClick={() => handleUpdateOrderStatus(ord._id, 'READY_FOR_PICKUP')} className="btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>Mark Ready for Pickup</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: PAYMENT SETTINGS */}
          {activeTab === 'PAYMENT_SETTINGS' && (
            <div className="glass-card" style={{ maxWidth: '600px', padding: '2rem' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                Payment Settings & UPI QR
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                Manage your shop's UPI payments and payment QR code for student online orders.
              </p>

              <form onSubmit={handleSaveShop}>
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '0.5rem', marginBottom: '1.25rem' }}>
                  <div>
                    <strong style={{ color: 'var(--text-primary)', display: 'block', fontSize: '0.95rem' }}>UPI Payments</strong>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Allow students to pay via your shop's UPI QR</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShopForm({ ...shopForm, upiEnabled: !shopForm.upiEnabled })}
                    className={shopForm.upiEnabled ? 'btn-primary' : 'btn-secondary'}
                    style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}
                  >
                    {shopForm.upiEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label">UPI ID (VPA)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 9876543210@upi or shopname@okaxis"
                    value={shopForm.upiId}
                    onChange={(e) => setShopForm({ ...shopForm, upiId: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ marginTop: '1.25rem' }}>
                  <label className="form-label">UPI QR Code Image</label>
                  
                  {shopForm.upiQrImage ? (
                    <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', textAlign: 'center', marginBottom: '1rem' }}>
                      <div style={{ width: '180px', height: '180px', margin: '0 auto 1rem auto', borderRadius: '0.5rem', overflow: 'hidden', border: '2px solid var(--primary)', background: '#ffffff', padding: '0.5rem' }}>
                        <img src={shopForm.upiQrImage} alt="Shop UPI QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                        <label className="btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                          <Upload size={14} /> Replace QR
                          <input
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (!file) return;
                              if (file.size > 5 * 1024 * 1024) {
                                setError('QR image size must be less than 5MB');
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = () => setShopForm((prev) => ({ ...prev, upiQrImage: reader.result }));
                              reader.readAsDataURL(file);
                            }}
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => setShopForm({ ...shopForm, upiQrImage: '' })}
                          className="btn-secondary"
                          style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                        >
                          <Trash2 size={14} /> Remove QR
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ border: '2px dashed var(--border-color)', padding: '1.5rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                      <Upload size={28} style={{ color: 'var(--primary)', marginBottom: '0.5rem' }} />
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 0.75rem 0' }}>
                        Upload your shop's official UPI QR Code (JPG, PNG, WEBP max 5MB)
                      </p>
                      <label className="btn-primary" style={{ display: 'inline-flex', padding: '0.45rem 1rem', fontSize: '0.85rem', cursor: 'pointer' }}>
                        Upload QR Image
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            if (file.size > 5 * 1024 * 1024) {
                              setError('QR image size must be less than 5MB');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = () => setShopForm((prev) => ({ ...prev, upiQrImage: reader.result }));
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>

                <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1.5rem' }}>
                  Save Payment Settings
                </button>
              </form>
            </div>
          )}

          {/* TAB 5: MY SHOP SETTINGS */}
          {activeTab === 'MY_SHOP' && (
            <div className="glass-card" style={{ maxWidth: '600px', padding: '2rem' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Shop Settings & Details</h3>
              <form onSubmit={handleSaveShop}>
                <div className="form-group"><label className="form-label">Shop Name</label><input type="text" className="form-input" value={shopForm.name} onChange={(e) => setShopForm({ ...shopForm, name: e.target.value })} required /></div>
                <div className="form-group"><label className="form-label">Description</label><input type="text" className="form-input" value={shopForm.description} onChange={(e) => setShopForm({ ...shopForm, description: e.target.value })} /></div>

                {/* Shop Photo Upload */}
                <div className="form-group" style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
                  <label className="form-label">Shop / Hotel Photo</label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.75rem' }}>
                    Upload your shop logo / photo (JPG, PNG, WEBP max 5MB) displayed to customers.
                  </span>
                  {shopForm.logo ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                      <img
                        src={shopForm.logo}
                        alt="Shop Logo"
                        style={{ width: '80px', height: '80px', borderRadius: '0.5rem', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <label className="btn-secondary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                          <Upload size={14} /> Change Photo
                          <input
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/webp"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 5 * 1024 * 1024) {
                                setError('Image size must be less than 5MB.');
                                return;
                              }
                              const reader = new FileReader();
                              reader.onload = () => setShopForm((prev) => ({ ...prev, logo: reader.result, coverImage: reader.result }));
                              reader.readAsDataURL(file);
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setShopForm({ ...shopForm, logo: '', coverImage: '' })}
                          className="btn-secondary"
                          style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                        >
                          <Trash2 size={14} /> Remove Photo
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ border: '2px dashed var(--border-color)', padding: '1.25rem', borderRadius: '0.5rem', textAlign: 'center' }}>
                      <Upload size={24} style={{ color: 'var(--primary)', marginBottom: '0.35rem' }} />
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 0.5rem 0' }}>
                        No photo uploaded yet for this shop.
                      </p>
                      <label className="btn-primary" style={{ display: 'inline-flex', padding: '0.4rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                        Upload Shop Photo
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 5 * 1024 * 1024) {
                              setError('Image size must be less than 5MB.');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onload = () => setShopForm((prev) => ({ ...prev, logo: reader.result, coverImage: reader.result }));
                            reader.readAsDataURL(file);
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Shop Category / Type</label>
                  <select
                    name="category"
                    className="form-input"
                    value={shopForm.category}
                    onChange={(e) => setShopForm({ ...shopForm, category: e.target.value })}
                    required
                  >
                    <option value="">-- Select Category --</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group"><label className="form-label">Campus Address</label><input type="text" className="form-input" value={shopForm.address} onChange={(e) => setShopForm({ ...shopForm, address: e.target.value })} required /></div>

                {/* Shop Timings */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Opening Time</label>
                    <input
                      type="time"
                      className="form-input"
                      value={shopForm.openingTime}
                      onChange={(e) => setShopForm({ ...shopForm, openingTime: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Closing Time</label>
                    <input
                      type="time"
                      className="form-input"
                      value={shopForm.closingTime}
                      onChange={(e) => setShopForm({ ...shopForm, closingTime: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group"><label className="form-label">Min Order (₹)</label><input type="number" className="form-input" value={shopForm.minimumOrderAmount} onChange={(e) => setShopForm({ ...shopForm, minimumOrderAmount: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Default Delivery Fee (₹)</label><input type="number" className="form-input" value={shopForm.deliveryFee} onChange={(e) => setShopForm({ ...shopForm, deliveryFee: e.target.value })} /></div>
                </div>

                {/* Distance-Based Delivery Charges Section */}
                <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
                  <h4 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                    Distance-Based Delivery Charges
                  </h4>

                  {(!shopForm.deliveryChargeSlabs || shopForm.deliveryChargeSlabs.length === 0) ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                      No distance slabs configured. Orders will use the default delivery fee (₹{shopForm.deliveryFee || 0}).
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      {shopForm.deliveryChargeSlabs.map((slab, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                            {slab.minDistanceKm}–{slab.maxDistanceKm} km
                          </span>
                          <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--primary)' }}>
                            ₹{slab.charge}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = shopForm.deliveryChargeSlabs.filter((_, i) => i !== idx);
                              setShopForm({ ...shopForm, deliveryChargeSlabs: updated });
                            }}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="number"
                      placeholder="Min (km)"
                      className="form-input"
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                      value={newSlab.minDistanceKm}
                      onChange={(e) => setNewSlab({ ...newSlab, minDistanceKm: e.target.value })}
                    />
                    <input
                      type="number"
                      placeholder="Max (km)"
                      className="form-input"
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                      value={newSlab.maxDistanceKm}
                      onChange={(e) => setNewSlab({ ...newSlab, maxDistanceKm: e.target.value })}
                    />
                    <input
                      type="number"
                      placeholder="Fee (₹)"
                      className="form-input"
                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                      value={newSlab.charge}
                      onChange={(e) => setNewSlab({ ...newSlab, charge: e.target.value })}
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                      onClick={handleAddSlab}
                    >
                      Add Slab
                    </button>
                  </div>
                </div>

                <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1.25rem' }}>Save Delivery Charges</button>
              </form>
            </div>
          )}

          {/* TAB 6: MY PROFILE */}
          {activeTab === 'PROFILE' && user && (
            <div className="glass-card" style={{ maxWidth: '560px', padding: '2rem' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
                Shopkeeper Profile
              </h3>

              {/* Avatar / Photo Display */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  background: 'var(--surface-hover)',
                  border: '2px solid var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '2rem',
                  fontWeight: '800',
                  color: 'var(--primary)',
                  flexShrink: 0,
                }}>
                  {user.profileImage ? (
                    <img src={user.profileImage} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span>{user.name ? user.name.charAt(0).toUpperCase() : 'S'}</span>
                  )}
                </div>

                <div>
                  <h4 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>
                    {user.name}
                  </h4>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.75rem' }}>
                    Role: {user.role} • Status: <strong style={{ color: 'var(--success)' }}>{user.accountStatus}</strong>
                  </span>

                  <label className="btn-secondary" style={{ display: 'inline-flex', padding: '0.4rem 0.85rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <Upload size={14} /> Change Photo
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
                          setError('Only JPG, PNG and WEBP images are allowed.');
                          return;
                        }
                        if (file.size > 5 * 1024 * 1024) {
                          setError('Image size must be less than 5MB.');
                          return;
                        }

                        const reader = new FileReader();
                        reader.onload = async () => {
                          try {
                            setError('');
                            setSuccess('');
                            const res = await api.put('/auth/profile', { profileImage: reader.result });
                            if (res && res.success) {
                              setSuccess('Profile photo updated successfully!');
                              refreshUser();
                            }
                          } catch (err) {
                            setError(err.message || 'Failed to update profile photo');
                          }
                        };
                        reader.readAsDataURL(file);
                      }}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>

              {/* Profile Details Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.95rem' }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.2rem' }}>Full Name</label>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{user.name}</div>
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.2rem' }}>Email Address</label>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{user.email}</div>
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.2rem' }}>Phone Number</label>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{user.phone}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Product Details View Modal (Click State for Shopkeeper Products) */}
      {showProductDetailModal && selectedDetailProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '0.75rem' }}>
          <div style={{ width: 'min(100% - 1.5rem, 540px)', maxWidth: '540px', background: '#ffffff', borderRadius: '0.85rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            {/* Header */}
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0, overflowWrap: 'break-word', wordBreak: 'break-word', paddingRight: '0.5rem' }}>
                {selectedDetailProduct.name}
              </h3>
              <button
                type="button"
                onClick={() => setShowProductDetailModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.35rem', borderRadius: '0.375rem', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '36px', minHeight: '36px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '1.25rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
              {/* Images gallery / preview */}
              {selectedDetailProduct.images && selectedDetailProduct.images.length > 0 ? (
                <div>
                  <div style={{ width: '100%', height: '200px', borderRadius: '0.5rem', overflow: 'hidden', background: '#f1f5f9', border: '1px solid var(--border-color)', marginBottom: '0.5rem' }}>
                    <img
                      src={selectedDetailProduct.images[activeDetailImageIndex || 0] || selectedDetailProduct.images[0]}
                      alt={selectedDetailProduct.name}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>
                  {selectedDetailProduct.images.length > 1 && (
                    <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                      {selectedDetailProduct.images.map((img, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveDetailImageIndex(idx)}
                          style={{
                            width: '50px',
                            height: '50px',
                            borderRadius: '0.375rem',
                            overflow: 'hidden',
                            border: (activeDetailImageIndex || 0) === idx ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                            padding: 0,
                            background: '#f8fafc',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ width: '100%', height: '120px', borderRadius: '0.5rem', background: '#f8fafc', border: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  No Product Images
                </div>
              )}

              {/* Product Details summary */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--primary)' }}>
                    ₹{selectedDetailProduct.discountPrice != null && selectedDetailProduct.discountPrice < selectedDetailProduct.price ? selectedDetailProduct.discountPrice : selectedDetailProduct.price}
                    {selectedDetailProduct.discountPrice != null && selectedDetailProduct.discountPrice < selectedDetailProduct.price && (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textDecoration: 'line-through', marginLeft: '0.5rem' }}>
                        ₹{selectedDetailProduct.price}
                      </span>
                    )}
                  </span>

                  <span style={{ padding: '0.25rem 0.6rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: '800', background: selectedDetailProduct.stock > 0 && selectedDetailProduct.isAvailable ? '#d1fae5' : '#fee2e2', color: selectedDetailProduct.stock > 0 && selectedDetailProduct.isAvailable ? '#047857' : '#b91c1c' }}>
                    {selectedDetailProduct.stock === 0 ? 'OUT OF STOCK' : selectedDetailProduct.stock <= 5 ? 'LOW STOCK' : 'IN STOCK'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Category</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{selectedDetailProduct.category?.name || 'General'}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Unit / Portion</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{selectedDetailProduct.unit || 'piece'}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Stock Quantity</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{selectedDetailProduct.stock}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>Packing Charges</span>
                    <strong style={{ color: 'var(--text-primary)' }}>₹{selectedDetailProduct.packingCharges || 0} / item</strong>
                  </div>
                  {selectedDetailProduct.gstPercentage > 0 && (
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>GST Rate</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{selectedDetailProduct.gstPercentage}%</strong>
                    </div>
                  )}
                </div>

                {selectedDetailProduct.description && (
                  <div>
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.2rem' }}>Description</span>
                    <p style={{ color: 'var(--text-primary)', fontSize: '0.875rem', margin: 0, lineHeight: 1.4, wordBreak: 'break-word' }}>
                      {selectedDetailProduct.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowProductDetailModal(false);
                    openProductModal(selectedDetailProduct);
                  }}
                  className="btn-primary"
                  style={{ flex: 1, minHeight: '42px', fontSize: '0.9rem' }}
                >
                  <Edit2 size={16} /> Edit Product
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowProductDetailModal(false);
                    handleDeleteProduct(selectedDetailProduct._id);
                  }}
                  className="btn-secondary"
                  style={{ flex: 1, minHeight: '42px', fontSize: '0.9rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                >
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal with Multi-Image Management */}
      {showProductModal && (

        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '0.75rem' }}>
          <div style={{ width: '100%', maxWidth: '640px', background: '#ffffff', borderRadius: '0.85rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid var(--border-color)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Package size={20} style={{ color: 'var(--primary)' }} />
                {editingProductId ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem', borderRadius: '0.375rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveProduct} style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1 }}>
              {/* Product Name */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: '700', fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.35rem', display: 'block' }}>Product Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Masala Dosa, Spiral Notebook, Coffee"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  required
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                />
              </div>

              {/* Category & Unit/Portion */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: '700', fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.35rem', display: 'block' }}>Category *</label>
                  <select
                    className="form-input"
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    required
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                  >
                    <option value="">Select Category</option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: '700', fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.35rem', display: 'block' }}>Unit / Portion *</label>
                  <select
                    className="form-input"
                    value={['piece','kg','gram','litre','ml','packet','bottle','plate','half','full','box','dozen'].includes(productForm.unit) ? productForm.unit : '_custom'}
                    onChange={(e) => {
                      if (e.target.value === '_custom') {
                        setProductForm({ ...productForm, unit: '' });
                      } else {
                        setProductForm({ ...productForm, unit: e.target.value });
                      }
                    }}
                    required
                    style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                  >
                    <option value="piece">Piece</option>
                    <option value="kg">Kg</option>
                    <option value="gram">Gram</option>
                    <option value="litre">Litre</option>
                    <option value="ml">ml</option>
                    <option value="packet">Packet</option>
                    <option value="bottle">Bottle</option>
                    <option value="plate">Plate</option>
                    <option value="half">Half</option>
                    <option value="full">Full</option>
                    <option value="box">Box</option>
                    <option value="dozen">Dozen</option>
                    <option value="_custom">Custom...</option>
                  </select>
                  {!['piece','kg','gram','litre','ml','packet','bottle','plate','half','full','box','dozen'].includes(productForm.unit) && (
                    <input
                      type="text"
                      className="form-input"
                      style={{ marginTop: '0.5rem', width: '100%', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                      placeholder="Enter custom unit"
                      value={productForm.unit}
                      onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                      required
                    />
                  )}
                </div>
              </div>

              {/* Editing single variant indicator */}
              {editingProductId && productForm.variantName && (
                <div style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#1d4ed8', border: '1px solid rgba(59, 130, 246, 0.25)', padding: '0.6rem 0.85rem', borderRadius: '0.5rem', fontSize: '0.85rem', fontWeight: '700' }}>
                  Variant: {productForm.variantName}
                </div>
              )}

              {/* Size / Variant Options Selection (only when creating new product) */}
              {!editingProductId && (
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontWeight: '700', fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.25rem', display: 'block' }}>
                      Size / Variant Options (Create multiple size products in 1 click)
                    </label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                      Select sizes below to create separate variants simultaneously, or leave empty for a single product.
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem', padding: '0.5rem 0' }}>
                    {['Half', 'Full', 'Small', 'Medium', 'Large', 'Custom'].map((size) => (
                      <label key={size} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        <input
                          type="checkbox"
                          checked={selectedVariants[size] || false}
                          onChange={(e) => setSelectedVariants({ ...selectedVariants, [size]: e.target.checked })}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                        />
                        {size}
                      </label>
                    ))}
                  </div>

                  {/* Standard Selected Variants Table / Rows */}
                  {['Half', 'Full', 'Small', 'Medium', 'Large'].map((size) => {
                    if (!selectedVariants[size]) return null;
                    return (
                      <div key={size} style={{ background: '#ffffff', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr', gap: '0.75rem', alignItems: 'center' }}>
                        <span style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--primary)' }}>{size}</span>
                        <div>
                          <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: '600' }}>Price (₹) *</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="₹ Price"
                            className="form-input"
                            style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}
                            value={variantPrices[size] || ''}
                            onChange={(e) => setVariantPrices({ ...variantPrices, [size]: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: '600' }}>Stock *</label>
                          <input
                            type="number"
                            min="0"
                            placeholder="Stock"
                            className="form-input"
                            style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}
                            value={variantStocks[size] !== undefined ? variantStocks[size] : 10}
                            onChange={(e) => setVariantStocks({ ...variantStocks, [size]: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: '600' }}>Packing (₹)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="₹ Packing"
                            className="form-input"
                            style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}
                            value={variantPackingCharges[size] !== undefined ? variantPackingCharges[size] : 0}
                            onChange={(e) => setVariantPackingCharges({ ...variantPackingCharges, [size]: e.target.value })}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {/* Custom Variant Rows */}
                  {selectedVariants.Custom && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginTop: '0.25rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-secondary)' }}>Custom Variants:</span>
                      {customVariantRows.map((row, idx) => (
                        <div key={idx} style={{ background: '#ffffff', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
                          <div>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: '600' }}>Variant Name *</label>
                            <input
                              type="text"
                              placeholder="e.g. Family Pack"
                              className="form-input"
                              style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}
                              value={row.name}
                              onChange={(e) => {
                                const updated = [...customVariantRows];
                                updated[idx].name = e.target.value;
                                setCustomVariantRows(updated);
                              }}
                              required
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: '600' }}>Price (₹) *</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="₹ Price"
                              className="form-input"
                              style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}
                              value={row.price}
                              onChange={(e) => {
                                const updated = [...customVariantRows];
                                updated[idx].price = e.target.value;
                                setCustomVariantRows(updated);
                              }}
                              required
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: '600' }}>Stock *</label>
                            <input
                              type="number"
                              min="0"
                              placeholder="Stock"
                              className="form-input"
                              style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}
                              value={row.stock}
                              onChange={(e) => {
                                const updated = [...customVariantRows];
                                updated[idx].stock = e.target.value;
                                setCustomVariantRows(updated);
                              }}
                              required
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', fontWeight: '600' }}>Packing (₹)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="₹ Packing"
                              className="form-input"
                              style={{ padding: '0.4rem 0.5rem', fontSize: '0.85rem' }}
                              value={row.packingCharges}
                              onChange={(e) => {
                                const updated = [...customVariantRows];
                                updated[idx].packingCharges = e.target.value;
                                setCustomVariantRows(updated);
                              }}
                            />
                          </div>
                          {customVariantRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setCustomVariantRows(customVariantRows.filter((_, i) => i !== idx))}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', alignSelf: 'flex-start' }}
                        onClick={() => setCustomVariantRows([...customVariantRows, { name: '', price: '', stock: 10, packingCharges: 0 }])}
                      >
                        + Add Custom Variant
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Price & Discount Price (For single product mode or default fallback) */}
              {(!Object.values(selectedVariants).some(Boolean) || editingProductId) && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontWeight: '700', fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.35rem', display: 'block' }}>Regular Price (₹) *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-input"
                        value={productForm.price}
                        onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                        placeholder="0.00"
                        required={!editingProductId ? !Object.values(selectedVariants).some(Boolean) : true}
                        style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontWeight: '700', fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.35rem', display: 'block' }}>Discount Price (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-input"
                        value={productForm.discountPrice}
                        onChange={(e) => setProductForm({ ...productForm, discountPrice: e.target.value })}
                        placeholder="Optional sale price"
                        style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontWeight: '700', fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.35rem', display: 'block' }}>Stock Quantity *</label>
                      <input
                        type="number"
                        min="0"
                        className="form-input"
                        value={productForm.stock}
                        onChange={(e) => setProductForm({ ...productForm, stock: e.target.value })}
                        required={!editingProductId ? !Object.values(selectedVariants).some(Boolean) : true}
                        style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontWeight: '700', fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.35rem', display: 'block' }}>Packing Charges (per item) (₹)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="form-input"
                        value={productForm.packingCharges}
                        onChange={(e) => setProductForm({ ...productForm, packingCharges: e.target.value })}
                        placeholder="0"
                        style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* GST */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: '700', fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.35rem', display: 'block' }}>GST Rate (included in price)</label>
                <select
                  className="form-input"
                  value={productForm.gstPercentage}
                  onChange={(e) => setProductForm({ ...productForm, gstPercentage: Number(e.target.value) })}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.95rem' }}
                >
                  <option value={0}>No GST (0%)</option>
                  <option value={5}>5% GST</option>
                  <option value={12}>12% GST</option>
                  <option value={18}>18% GST</option>
                  <option value={28}>28% GST</option>
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>GST is informational — product price includes GST.</span>
              </div>

              {/* Description */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: '700', fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.35rem', display: 'block' }}>Description</label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="Describe ingredients, taste, size, or usage..."
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', fontSize: '0.95rem', resize: 'vertical' }}
                />
              </div>

              {/* Product Images */}
              <div className="form-group" style={{ margin: 0, background: '#f8fafc', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
                <label className="form-label" style={{ fontWeight: '700', fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.25rem', display: 'block' }}>Product Images (Max 5)</label>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.75rem' }}>
                  First image will be used as the main cover image.
                </span>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <label className="btn-secondary" style={{ display: 'inline-flex', padding: '0.45rem 0.85rem', fontSize: '0.825rem', cursor: 'pointer', alignItems: 'center', gap: '0.4rem' }}>
                    <Upload size={15} /> Choose Files (JPG, PNG, WEBP)
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      multiple
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <input
                    type="url"
                    className="form-input"
                    placeholder="Or enter Image URL..."
                    value={imageInput}
                    onChange={(e) => setImageInput(e.target.value)}
                    style={{ flex: 1, padding: '0.45rem 0.75rem', fontSize: '0.85rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1' }}
                  />
                  <button type="button" onClick={handleAddImageUrl} className="btn-secondary" style={{ padding: '0.45rem 0.85rem', fontSize: '0.825rem', flexShrink: 0 }}>
                    Add URL
                  </button>
                </div>

                {productForm.images.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {productForm.images.map((imgItem, index) => {
                      const displaySrc = typeof imgItem === 'object' ? imgItem.previewUrl : imgItem;
                      return (
                        <div
                          key={index}
                          style={{
                            width: '70px',
                            height: '70px',
                            borderRadius: '0.375rem',
                            border: index === 0 ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                            position: 'relative',
                            overflow: 'hidden',
                            background: '#f1f5f9',
                            flexShrink: 0,
                          }}
                        >
                          <img src={displaySrc} alt={`Preview ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        {index === 0 && (
                          <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(2, 132, 199, 0.9)', color: '#ffffff', fontSize: '0.6rem', fontWeight: '800', textAlign: 'center' }}>
                            MAIN
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          style={{
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            background: 'rgba(239, 68, 68, 0.9)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '50%',
                            width: '18px',
                            height: '18px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                )}
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                <button type="submit" disabled={productSubmitting} className="btn-primary" style={{ flex: 1, padding: '0.75rem', fontSize: '0.95rem', fontWeight: '700', opacity: productSubmitting ? 0.7 : 1 }}>
                  {productSubmitting ? (editingProductId ? 'Saving...' : 'Adding...') : (editingProductId ? 'Save Product' : 'Add Product')}
                </button>
                <button type="button" onClick={() => setShowProductModal(false)} className="btn-secondary" style={{ flex: 1, padding: '0.75rem', fontSize: '0.95rem' }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .sk-products-desktop-table {
            display: none !important;
          }
          .sk-products-mobile-cards {
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 1rem !important;
            width: 100% !important;
          }
          .sk-product-header-controls {
            width: 100% !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 0.5rem !important;
          }
          .sk-product-search-input,
          .sk-product-category-select {
            width: 100% !important;
          }
          .sk-products-card-container {
            padding: 1rem !important;
          }
        }
        @media (min-width: 480px) and (max-width: 768px) {
          .sk-products-mobile-cards {
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)) !important;
          }
        }
        @media (min-width: 769px) {
          .sk-products-desktop-table {
            display: block !important;
          }
          .sk-products-mobile-cards {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}


function ShopkeeperReviewsTab({ shop }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [shopRating, setShopRating] = useState(shop?.rating || 0);
  const [totalRatings, setTotalRatings] = useState(shop?.totalRatings || 0);

  useEffect(() => {
    async function fetchReviews() {
      try {
        setLoading(true);
        const res = await api.get('/reviews/shopkeeper/overview');
        if (res && res.success) {
          setReviews(res.data || []);
          if (res.shopRating !== undefined) setShopRating(res.shopRating);
          if (res.totalShopRatings !== undefined) setTotalRatings(res.totalShopRatings);
        }
      } catch (err) {
        console.error('Failed to load shopkeeper reviews:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchReviews();
  }, []);

  return (
    <div className="glass-card" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h3 style={{ fontSize: '1.3rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
            Customer Ratings & Feedback
          </h3>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Reviews for your shop and products left by campus students
          </p>
        </div>

        <div style={{ background: '#f8fafc', border: '1px solid var(--border-color)', padding: '0.75rem 1.25rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Star size={24} fill="#f59e0b" style={{ color: '#f59e0b' }} />
          <div>
            <div style={{ fontWeight: '900', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
              {shopRating > 0 ? shopRating.toFixed(1) : '0.0'} / 5.0
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{totalRatings} Total Shop Ratings</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ margin: '0 auto 0.5rem auto' }}></div>
          <p style={{ color: 'var(--text-muted)' }}>Loading reviews...</p>
        </div>
      ) : reviews.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px dashed var(--border-color)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>
            No customer reviews received yet for your shop or products.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {reviews.map((rev) => {
            const uName = rev.user?.name || 'Verified Student';
            const uImg = rev.user?.profileImage;
            const targetName = rev.type === 'SHOP' ? 'Shop Feedback' : rev.product?.name ? `Product: ${rev.product.name}` : 'Product Review';
            const dateStr = new Date(rev.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div key={rev._id} style={{ padding: '1.25rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)', background: '#ffffff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: 'var(--primary-gradient)', color: '#ffffff', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', overflow: 'hidden' }}>
                      {uImg ? <img src={uImg} alt={uName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : uName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>{uName}</h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{dateStr}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', background: rev.type === 'SHOP' ? '#e0f2fe' : '#fef3c7', color: rev.type === 'SHOP' ? '#0369a1' : '#b45309', padding: '0.15rem 0.6rem', borderRadius: '1rem' }}>
                      {targetName}
                    </span>
                    <div style={{ display: 'flex', gap: '0.15rem', color: '#f59e0b' }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} size={15} fill={s <= rev.rating ? '#f59e0b' : 'none'} strokeWidth={1.5} />
                      ))}
                    </div>
                  </div>
                </div>

                {rev.comment && (
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    "{rev.comment}"
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
