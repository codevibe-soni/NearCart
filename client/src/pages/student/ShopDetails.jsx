import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getShopById, getProducts, getCategories } from '../../services/studentService';
import { ProductCard, LoadingSpinner, EmptyState, SearchBar, CategoryCard, formatTimeAMPM, isShopOpen } from '../../components/StudentUIComponents';
import { Store, ArrowLeft, Phone, MapPin, Star, Clock, Tag } from 'lucide-react';
import api from '../../services/api';

export default function ShopDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialCat = searchParams.get('category') || '';
  const initialSearch = searchParams.get('search') || '';

  const [shop, setShop] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(initialCat);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0, limit: 24 });
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [submittedSearch, setSubmittedSearch] = useState(initialSearch);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(false);
  const [error, setError] = useState('');

  // When shop ID changes, immediately reset shop and product state to avoid stale flash
  useEffect(() => {
    setShop(null);
    setProducts([]);
    setLoading(true);
  }, [id]);

  // Sync category & search state from URL search parameters
  useEffect(() => {
    const cat = searchParams.get('category') || '';
    const q = searchParams.get('search') || '';
    if (cat !== selectedCategory) setSelectedCategory(cat);
    if (q !== submittedSearch) {
      setSubmittedSearch(q);
      setSearchInput(q);
    }
  }, [searchParams]);

  const updateUrlParams = (catVal, searchVal) => {
    const params = {};
    if (catVal) params.category = catVal;
    if (searchVal) params.search = searchVal;
    setSearchParams(params);
  };

  const fetchShopData = async (activeCat = selectedCategory, activeQuery = submittedSearch, activePage = page) => {
    if (!shop) setLoading(true);
    else setProductsLoading(true);
    setError('');

    try {
      const prodParams = {
        shop: id,
        page: activePage,
        limit: 24,
      };
      if (activeQuery) prodParams.search = activeQuery.trim();
      if (activeCat) prodParams.category = activeCat;

      const [shopRes, prodRes, catRes] = await Promise.all([
        getShopById(id),
        getProducts(prodParams),
        getCategories(),
      ]);

      if (shopRes && shopRes.success) {
        setShop(shopRes.shop);
      }
      if (prodRes && prodRes.success) {
        setProducts(prodRes.products || []);
        if (prodRes.pagination) setPagination(prodRes.pagination);
      }
      if (catRes && catRes.success) {
        setCategories(catRes.categories || []);
      }
    } catch (err) {
      setError(err.message || 'Shop is currently unavailable.');
    } finally {
      setLoading(false);
      setProductsLoading(false);
    }
  };

  useEffect(() => {
    fetchShopData(selectedCategory, submittedSearch, page);
  }, [id, selectedCategory, submittedSearch, page]);

  const handleCategorySelect = (catId) => {
    const nextCat = selectedCategory === catId ? '' : catId;
    setPage(1);
    setSelectedCategory(nextCat);
    updateUrlParams(nextCat, submittedSearch);
  };

  const handleSearchSubmit = (query) => {
    const finalQuery = (query !== undefined ? query : searchInput).trim();
    setPage(1);
    setSubmittedSearch(finalQuery);
    updateUrlParams(selectedCategory, finalQuery);
  };

  const handleSearchInputChange = (val) => {
    setSearchInput(val);
    if (val.trim() === '' && submittedSearch !== '') {
      setPage(1);
      setSubmittedSearch('');
      updateUrlParams(selectedCategory, '');
    }
  };

  if (loading && !shop) return <LoadingSpinner message="Loading shop catalog..." />;

  if (error || !shop) {
    return (
      <div className="container" style={{ padding: '4rem 1.5rem', textAlign: 'center' }}>
        <div className="glass-card" style={{ maxWidth: '500px', margin: '0 auto' }}>
          <h3 style={{ fontSize: '1.5rem', color: 'var(--danger)', marginBottom: '1rem' }}>{error || 'Shop Unavailable'}</h3>
          <button onClick={() => navigate('/student')} className="btn-secondary">
            Back to NearCart Stores
          </button>
        </div>
      </div>
    );
  }

  const hasTiming = Boolean(shop.openingTime && shop.closingTime);
  const currentlyOpen = isShopOpen(shop);
  const shopImage = shop.logo || shop.coverImage;
  const openTimeFormatted = hasTiming ? formatTimeAMPM(shop.openingTime) : '';
  const closeTimeFormatted = hasTiming ? formatTimeAMPM(shop.closingTime) : '';

  const selectedCategoryObj = categories.find(
    (c) => c._id === selectedCategory || c.name.toLowerCase() === selectedCategory.toLowerCase()
  );
  const categoryTitle = selectedCategoryObj ? selectedCategoryObj.name : 'Category Items';

  return (
    <div className="container" style={{ padding: '2.5rem 1.5rem 5rem 1.5rem' }}>
      <button
        onClick={() => navigate('/student')}
        className="btn-secondary"
        style={{ marginBottom: '1.5rem', padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
      >
        <ArrowLeft size={16} /> Back to Shops
      </button>

      {/* Shop Info Banner */}
      <div
        className="glass-card"
        style={{
          padding: '1.75rem',
          marginBottom: '2rem',
          width: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden',
          maxWidth: '100%',
        }}
      >
        <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap', minWidth: 0, width: '100%' }}>
          {shopImage ? (
            <img
              src={shopImage}
              alt={shop.name}
              style={{
                width: '4rem',
                height: '4rem',
                borderRadius: '0.75rem',
                objectFit: 'cover',
                border: '1px solid var(--border-color)',
                flexShrink: 0,
              }}
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div
            style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '0.75rem',
              background: 'var(--surface-light)',
              display: shopImage ? 'none' : 'flex',
              alignItems: 'center',
              justify: 'center',
              fontWeight: '800',
              color: 'var(--primary)',
              fontSize: '1.8rem',
              border: '1px solid var(--border-color)',
              flexShrink: 0,
            }}
          >
            {shop.name ? shop.name.charAt(0).toUpperCase() : 'S'}
          </div>
          <div style={{ flex: 1, minWidth: 0, maxWidth: '100%', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem', flexWrap: 'wrap', minWidth: 0 }}>
              <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0, overflowWrap: 'anywhere', wordBreak: 'break-word', minWidth: 0 }}>
                {shop.name}
              </h1>
              <span
                style={{
                  padding: '0.2rem 0.6rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  background: !hasTiming ? 'rgba(100, 116, 139, 0.15)' : currentlyOpen ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: !hasTiming ? '#64748b' : currentlyOpen ? 'var(--success)' : 'var(--danger)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {!hasTiming ? 'Hours not set' : currentlyOpen ? 'OPEN' : 'CLOSED'}
              </span>
              {shop.foodType && (
                <span
                  style={{
                    padding: '0.2rem 0.6rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#d97706',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {shop.foodType}
                </span>
              )}
            </div>

            <p style={{
              color: 'var(--text-secondary)',
              fontSize: '0.95rem',
              marginBottom: '0.75rem',
              lineHeight: '1.5',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
              maxWidth: '100%',
            }}>
              {shop.description || 'Campus partner store'}
            </p>

            <div style={{ display: 'flex', gap: '0.75rem 1.5rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)', overflowWrap: 'anywhere', wordBreak: 'break-word', maxWidth: '100%' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <Clock size={14} style={{ flexShrink: 0 }} />
                <span>{hasTiming ? <>Opening Hours: <strong>{openTimeFormatted} – {closeTimeFormatted}</strong></> : 'Hours not set'}</span>
              </span>
              {shop.address && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                  <MapPin size={14} style={{ flexShrink: 0 }} /> <span>{shop.address}</span>
                </span>
              )}
              {shop.phone && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Phone size={14} style={{ flexShrink: 0 }} /> <span>{shop.phone}</span>
                </span>
              )}
              <span>⭐ {shop.rating?.toFixed(1) || '4.5'} ({shop.totalRatings || 0} ratings)</span>
              <span>Min Order: ₹{shop.minimumOrderAmount || 0}</span>
              <span>Delivery: ₹{shop.deliveryFee || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Shop-Scoped Categories Horizontal Selector */}
      {categories.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Tag size={18} style={{ color: 'var(--primary)' }} /> Shop Categories
            </h3>
            {(selectedCategory || submittedSearch) && (
              <button
                onClick={() => {
                  setSelectedCategory('');
                  setSubmittedSearch('');
                  setSearchInput('');
                  setPage(1);
                  updateUrlParams('', '');
                }}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700' }}
              >
                Clear Shop Filters
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
            <CategoryCard
              category={{ name: 'All Products' }}
              isSelected={selectedCategory === ''}
              onClick={() => handleCategorySelect('')}
            />
            {categories.map((cat) => (
              <CategoryCard
                key={cat._id}
                category={cat}
                isSelected={selectedCategory === cat._id || selectedCategory.toLowerCase() === cat.name.toLowerCase()}
                onClick={() => handleCategorySelect(cat._id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Shop Products Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              {selectedCategory ? `${categoryTitle} at ${shop.name}` : submittedSearch ? `Search Results in ${shop.name}` : `Products at ${shop.name}`}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
              {selectedCategory ? `Showing ${categoryTitle} items available in ${shop.name}` : `Browse all available items in ${shop.name}`}
            </p>
          </div>
          <div style={{ maxWidth: '300px', width: '100%' }}>
            <SearchBar
              value={searchInput}
              onChange={handleSearchInputChange}
              onSubmit={handleSearchSubmit}
              placeholder={`Search in ${shop.name}...`}
            />
          </div>
        </div>

        {productsLoading ? (
          <LoadingSpinner message={`Loading products for ${shop.name}...`} />
        ) : products.length === 0 ? (
          <EmptyState
            message={
              selectedCategory
                ? `No items available under "${categoryTitle}" in ${shop.name}.`
                : submittedSearch
                ? `No products matching "${submittedSearch}" found in ${shop.name}.`
                : `No products currently available in ${shop.name}.`
            }
          />
        ) : (
          <>
            <div className="product-grid-responsive">
              {products.map((prod) => (
                <ProductCard
                  key={prod._id}
                  product={prod}
                  onClick={() => navigate(`/student/products/${prod._id}`)}
                />
              ))}
            </div>

            {pagination.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="btn-secondary"
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', opacity: page <= 1 ? 0.5 : 1 }}
                >
                  Previous
                </button>
                <span style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  Page {page} of {pagination.totalPages}
                </span>
                <button
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  className="btn-primary"
                  style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', opacity: page >= pagination.totalPages ? 0.5 : 1 }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Shop Reviews Section */}
      <ShopReviewsSection shopId={id} shopName={shop.name} />
    </div>
  );
}

function ShopReviewsSection({ shopId, shopName }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ avgRating: 0, totalRatings: 0 });

  useEffect(() => {
    async function fetchShopReviews() {
      try {
        setLoading(true);
        const res = await api.get(`/reviews/shop/${shopId}`);
        if (res && res.success) {
          setReviews(res.data || []);
          setStats({
            avgRating: res.avgRating || 0,
            totalRatings: res.totalRatings || 0,
          });
        }
      } catch (err) {
        console.error('Failed to load shop reviews:', err);
      } finally {
        setLoading(false);
      }
    }
    if (shopId) fetchShopReviews();
  }, [shopId]);

  return (
    <div
      style={{
        marginTop: '3rem',
        background: 'var(--surface, #ffffff)',
        border: '1px solid var(--border-color, #e2e8f0)',
        borderRadius: '1rem',
        padding: '1.75rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Star size={20} fill="#f59e0b" style={{ color: '#f59e0b' }} /> Customer Reviews for {shopName}
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '800', fontSize: '1.1rem', color: '#f59e0b' }}>
          <span>{stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '0.0'}</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>({stats.totalRatings} ratings)</span>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '1.5rem' }}>
          <div className="spinner" style={{ margin: '0 auto 0.5rem auto' }}></div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading shop reviews...</p>
        </div>
      ) : reviews.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', background: '#f8fafc', borderRadius: '0.75rem', border: '1px dashed var(--border-color)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
            No shop reviews submitted yet.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {reviews.map((rev) => {
            const uName = rev.user?.name || 'Verified Student';
            const uImg = rev.user?.profileImage;
            const dateStr = new Date(rev.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });

            return (
              <div key={rev._id} style={{ padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)', background: '#ffffff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'var(--primary-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontWeight: '800', fontSize: '0.85rem', overflow: 'hidden' }}>
                      {uImg ? <img src={uImg} alt={uName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : uName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-primary)' }}>{uName}</h4>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{dateStr}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.1rem', color: '#f59e0b' }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} size={13} fill={s <= rev.rating ? '#f59e0b' : 'none'} strokeWidth={1.5} />
                    ))}
                  </div>
                </div>

                {rev.comment && (
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
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
