import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCategories, getShops } from '../services/studentService';
import {
  SearchBar,
  CategoryCard,
  ShopCard,
  LoadingSpinner,
} from '../components/StudentUIComponents';
import { Store, Compass, ArrowRight } from 'lucide-react';

export default function Student() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialCat = searchParams.get('category') || '';
  const initialSearch = searchParams.get('search') || '';

  const [shops, setShops] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [submittedSearch, setSubmittedSearch] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState(initialCat);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Sync state from URL parameters when URL changes (e.g. back/forward nav)
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

  const fetchData = async (activeCat = selectedCategory, activeQuery = submittedSearch) => {
    setLoading(true);
    setError('');
    try {
      const shopParams = {};
      if (activeQuery) shopParams.search = activeQuery;
      if (activeCat) shopParams.category = activeCat;

      const queryString = new URLSearchParams(shopParams).toString();
      const [shopsRes, catRes] = await Promise.all([
        getShops(queryString ? `?${queryString}` : ''),
        getCategories(),
      ]);

      if (shopsRes.success) setShops(shopsRes.shops || []);
      if (catRes.success) setCategories(catRes.categories || []);
    } catch (err) {
      setError(err.message || 'Failed to load NearCart shops');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedCategory, submittedSearch);
  }, [selectedCategory, submittedSearch]);

  const handleCategorySelect = (catId) => {
    const nextCat = selectedCategory === catId ? '' : catId;
    setSelectedCategory(nextCat);
    updateUrlParams(nextCat, submittedSearch);
  };

  const handleSearchSubmit = (query) => {
    const finalQuery = (query !== undefined ? query : searchInput).trim();
    setSubmittedSearch(finalQuery);
    updateUrlParams(selectedCategory, finalQuery);
  };

  const handleSearchInputChange = (val) => {
    setSearchInput(val);
    if (val.trim() === '' && submittedSearch !== '') {
      setSubmittedSearch('');
      updateUrlParams(selectedCategory, '');
    }
  };

  const handleShopClick = (shopId) => {
    const navUrl = selectedCategory
      ? `/student/shops/${shopId}?category=${encodeURIComponent(selectedCategory)}`
      : `/student/shops/${shopId}`;
    navigate(navUrl);
  };

  const selectedCategoryObj = categories.find(
    (c) => c._id === selectedCategory || c.name.toLowerCase() === selectedCategory.toLowerCase()
  );
  const categoryTitle = selectedCategoryObj ? selectedCategoryObj.name : 'Shops';

  return (
    <div className="container" style={{ padding: '2rem 0.5rem 4rem 0.5rem' }}>
      {/* Welcome Banner */}
      <div
        className="glass-card"
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          padding: '2rem 1.5rem',
          marginBottom: '2rem',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ maxWidth: '650px', position: 'relative', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            
            <span
              style={{
                padding: '0.2rem 0.6rem',
                borderRadius: '9999px',
                background: '#e0f2fe',
                color: 'var(--primary)',
                fontSize: '0.75rem',
                fontWeight: '800',
              }}
            >
              STUDENT MARKETPLACE
            </span>
          </div>

          <h1 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
            Welcome back, {user?.name ? user.name.split(' ')[0] : 'Student'}! 👋
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            Select a nearby shop or hotel to browse its products and menu.
          </p>

          <SearchBar
            value={searchInput}
            onChange={handleSearchInputChange}
            onSubmit={handleSearchSubmit}
            placeholder="Search shops & hotels by name or description..."
          />
        </div>
      </div>

      {/* Categories Horizontal Selector */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-primary)' }}>
            Categories
          </h3>
          {(selectedCategory || submittedSearch) && (
            <button
              onClick={() => {
                setSelectedCategory('');
                setSubmittedSearch('');
                setSearchInput('');
                updateUrlParams('', '');
              }}
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700' }}
            >
              Clear Filter
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
          <CategoryCard
            category={{ name: 'All Shops' }}
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

      {/* Guidance Banner */}
      <div
        className="glass-card"
        style={{
          padding: '1.25rem 1.5rem',
          marginBottom: '2rem',
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
          border: '1px solid #bae6fd',
          borderRadius: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          color: '#0369a1',
        }}
      >
        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(3, 105, 161, 0.15)' }}>
          <Store size={22} style={{ color: 'var(--primary)' }} />
        </div>
        <div>
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: '#0c4a6e' }}>
            Shop-First Ordering
          </h4>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#0369a1' }}>
            Select a shop or hotel below to view its full product menu and place an order.
          </p>
        </div>
      </div>

      {/* Nearby Shops Section */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
              {selectedCategory ? `Shops in ${categoryTitle}` : submittedSearch ? `Shops matching "${submittedSearch}"` : 'Nearby Shops & Hotels'}
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.2rem 0 0 0' }}>
              Select a shop to view its exclusive items and menu
            </p>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : shops.length === 0 ? (
          <div className="glass-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            No shops available {selectedCategory ? `under category "${categoryTitle}"` : submittedSearch ? `matching "${submittedSearch}"` : 'at the moment'}.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }}>
            {shops.map((shopItem) => (
              <ShopCard
                key={shopItem._id}
                shop={shopItem}
                onClick={() => handleShopClick(shopItem._id)}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
