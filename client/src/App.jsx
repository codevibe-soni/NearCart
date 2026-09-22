import React, { lazy, Suspense, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Student from './pages/Student';
import Unauthorized from './pages/Unauthorized';
import NotFound from './pages/NotFound';
import ProtectedRoute from './components/ProtectedRoute';
import PublicOnlyRoute from './components/PublicOnlyRoute';

// Lazy-loaded routes for performance & bundle splitting
const ShopDetails = lazy(() => import('./pages/student/ShopDetails'));
const ProductDetails = lazy(() => import('./pages/student/ProductDetails'));
const CartPage = lazy(() => import('./pages/student/CartPage'));
const CheckoutPage = lazy(() => import('./pages/student/CheckoutPage'));
const OrderSuccessPage = lazy(() => import('./pages/student/OrderSuccessPage'));
const OrderHistoryPage = lazy(() => import('./pages/student/OrderHistoryPage'));
const OrderDetailsPage = lazy(() => import('./pages/student/OrderDetailsPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const Shopkeeper = lazy(() => import('./pages/Shopkeeper'));
const Delivery = lazy(() => import('./pages/Delivery'));
const Admin = lazy(() => import('./pages/Admin'));
const About = lazy(() => import('./pages/About'));
import NearCartLoader from './components/NearCartLoader';

const PageFallback = () => (
  <NearCartLoader fullScreen={true} message="Loading NearCart..." />
);

/**
 * GlobalRouteLoader: Listens to location changes across ALL routes inside BrowserRouter
 * and triggers a brief, perceptible NearCartLoader transition overlay.
 */
function GlobalRouteLoader({ children }) {
  const location = useLocation();
  const [isRouteChanging, setIsRouteChanging] = useState(false);

  useEffect(() => {
    // Whenever location (pathname or search query) changes, show loader transition overlay
    setIsRouteChanging(true);

    // Give browser paint cycle + brief animation window so loader is visually perceptible
    const timer = setTimeout(() => {
      setIsRouteChanging(false);
    }, 120);

    return () => clearTimeout(timer);
  }, [location.pathname, location.search]);

  return (
    <>
      {isRouteChanging && (
        <NearCartLoader fullScreen={true} message="Loading NearCart..." />
      )}
      {children}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <GlobalRouteLoader>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<MainLayout />}>
            <Route index element={<Home />} />
            <Route
              path="login"
              element={
                <PublicOnlyRoute>
                  <Login />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="register"
              element={
                <PublicOnlyRoute>
                  <Register />
                </PublicOnlyRoute>
              }
            />
            <Route path="unauthorized" element={<Unauthorized />} />
            <Route path="about" element={<About />} />

            {/* Protected Student Routes */}
            <Route
              path="student"
              element={
                <ProtectedRoute allowedRoles={['STUDENT']}>
                  <Student />
                </ProtectedRoute>
              }
            />
            <Route
              path="student/shops/:id"
              element={
                <ProtectedRoute allowedRoles={['STUDENT']}>
                  <ShopDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="student/products/:id"
              element={
                <ProtectedRoute allowedRoles={['STUDENT']}>
                  <ProductDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="cart"
              element={
                <ProtectedRoute allowedRoles={['STUDENT']}>
                  <CartPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="checkout"
              element={
                <ProtectedRoute allowedRoles={['STUDENT']}>
                  <CheckoutPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="orders"
              element={
                <ProtectedRoute allowedRoles={['STUDENT']}>
                  <OrderHistoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="orders/:orderId"
              element={
                <ProtectedRoute allowedRoles={['STUDENT', 'SHOPKEEPER', 'ADMIN', 'DELIVERY_BOY']}>
                  <OrderDetailsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="orders/:orderId/success"
              element={
                <ProtectedRoute allowedRoles={['STUDENT']}>
                  <OrderSuccessPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="notifications"
              element={
                <ProtectedRoute allowedRoles={['STUDENT', 'SHOPKEEPER', 'ADMIN', 'DELIVERY_BOY']}>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />

            {/* Staff & Admin Protected Routes */}
            <Route
              path="shopkeeper"
              element={
                <ProtectedRoute allowedRoles={['SHOPKEEPER']}>
                  <Shopkeeper />
                </ProtectedRoute>
              }
            />
            <Route
              path="delivery"
              element={
                <ProtectedRoute allowedRoles={['DELIVERY_BOY']}>
                  <Delivery />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <Admin />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </GlobalRouteLoader>
  </BrowserRouter>
);
}

export default App;
