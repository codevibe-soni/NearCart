import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCategories, getShops } from '../services/studentService';
import {
  SearchBar,
  CategoryCard,
  ShopCard,
  LoadingSpinner,
  isShopOpen,
  ClosedShopModal,
} from '../components/StudentUIComponents';
import { Store, Compass, ArrowRight } from 'lucide-react';
import heroPoster from '../assets/hero-poster.jpg';
import AnnouncementPoster from '../components/AnnouncementPoster';
import './Student.css';

export default function Student() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialSearch = searchParams.get('search') || '';

  const [shops, setShops] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [submittedSearch, setSubmittedSearch] = useState(initialSearch);
  // selectedCategory always holds a category ObjectId (or '' for All)
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [closedModalShop, setClosedModalShop] = useState(null);

  // Helper: resolve a category URL param (name or ID) to an ObjectId using the loaded categories list
  const resolveCategoryId = (catParam, catList) => {
    if (!catParam) return '';
    // If it already matches an ID in the list, use it directly
    const byId = catList.find((c) => c._id === catParam);
    if (byId) return byId._id;
    // Otherwise try matching by name (case-insensitive)
    const byName = catList.find((c) => c.name.toLowerCase() === catParam.trim().toLowerCase());
    if (byName) return byName._id;
    return ''; // Unknown category — treat as "All"
  };

  // Helper: get category name from ID for URL display
  const getCategoryName = (catId) => {
    if (!catId) return '';
    const cat = categories.find((c) => c._id === catId);
    return cat ? cat.name : '';
  };

  const updateUrlParams = (catId, searchVal) => {
    const params = {};
    // Store human-readable category name in URL, not ObjectId
    const catName = getCategoryName(catId);
    if (catName) params.category = catName;
    if (searchVal) params.search = searchVal;
    setSearchParams(params);
  };

  // Sync state from URL parameters when URL changes (e.g. back/forward nav)
  useEffect(() => {
    if (!categoriesLoaded) return; // Wait until categories are loaded to resolve names→IDs
    const catParam = searchParams.get('category') || '';
    const q = searchParams.get('search') || '';
    const resolvedId = resolveCategoryId(catParam, categories);
    if (resolvedId !== selectedCategory) setSelectedCategory(resolvedId);
    if (q !== submittedSearch) {
      setSubmittedSearch(q);
      setSearchInput(q);
    }
  }, [searchParams, categoriesLoaded, categories]);

  // Load categories first, then resolve URL param and fetch shops
  useEffect(() => {
    let cancelled = false;
    const loadCategories = async () => {
      try {
        const catRes = await getCategories();
        if (!cancelled && catRes.success) {
          const catList = catRes.categories || [];
          setCategories(catList);
          // Resolve initial URL category param → ObjectId
          const urlCatParam = searchParams.get('category') || '';
          const resolvedId = resolveCategoryId(urlCatParam, catList);
          setSelectedCategory(resolvedId);
          setCategoriesLoaded(true);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load categories');
      }
    };
    loadCategories();
    return () => { cancelled = true; };
  }, []);

  // Fetch shops whenever category or search changes (but only after categories are loaded)
  useEffect(() => {
    if (!categoriesLoaded) return;
    let cancelled = false;
    const fetchShops = async () => {
      setLoading(true);
      setError('');
      try {
        const shopParams = {};
        if (submittedSearch) shopParams.search = submittedSearch;
        // Always send the ObjectId to the backend
        if (selectedCategory) shopParams.category = selectedCategory;

        const queryString = new URLSearchParams(shopParams).toString();
        const shopsRes = await getShops(queryString ? `?${queryString}` : '');

        if (!cancelled && shopsRes.success) setShops(shopsRes.shops || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load NearCart shops');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchShops();
    return () => { cancelled = true; };
  }, [selectedCategory, submittedSearch, categoriesLoaded]);

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

  const handleShopClick = (shopItem) => {
    if (!shopItem) return;
    if (!isShopOpen(shopItem)) {
      setClosedModalShop(shopItem);
      return;
    }
    const navUrl = selectedCategory
      ? `/student/shops/${shopItem._id}?category=${encodeURIComponent(selectedCategory)}`
      : `/student/shops/${shopItem._id}`;
    navigate(navUrl);
  };

  const handleBrowseClosedShop = (shopItem) => {
    if (!shopItem) return;
    const navUrl = selectedCategory
      ? `/student/shops/${shopItem._id}?category=${encodeURIComponent(selectedCategory)}`
      : `/student/shops/${shopItem._id}`;
    navigate(navUrl);
  };

  const selectedCategoryObj = categories.find((c) => c._id === selectedCategory);
  const categoryTitle = selectedCategoryObj ? selectedCategoryObj.name : 'Shops';

  return (


<div className="container" style={{ padding: '2rem 0.5rem 4rem 0.5rem' }}>
      {/* Promotional Poster Hero Banner & Search */}
      <div className="hero-poster-wrapper">
        <div className="hero-poster-card">
          <img
            src={heroPoster}
            alt="NearCart - Everything You Need Just Around the Corner"
            className="hero-poster-img"
          />
        </div>

        <div className="hero-search-container">
          <SearchBar
            value={searchInput}
            onChange={handleSearchInputChange}
            onSubmit={handleSearchSubmit}
            placeholder="Search shops & hotels by name or description..."
          />
        </div>
      </div>

      {/* Published Student Announcements & Posters */}
      <AnnouncementPoster portal="STUDENT" />

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
              isSelected={selectedCategory === cat._id}
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
          <div className="shops-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }}>
            {shops.map((shopItem) => (
              <ShopCard
                key={shopItem._id}
                shop={shopItem}
                onClick={() => handleShopClick(shopItem)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Closed Shop Modal */}
      <ClosedShopModal
        shop={closedModalShop}
        isOpen={Boolean(closedModalShop)}
        onClose={() => setClosedModalShop(null)}
        onBrowseMenu={() => handleBrowseClosedShop(closedModalShop)}
      />

    </div>
  );
}
