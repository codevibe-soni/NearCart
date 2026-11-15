import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import RateOrderModal from './RateOrderModal';

export default function AutoReviewPopup() {
  const { user, isAuthenticated } = useAuth();
  const { socket: globalSocket } = useNotifications();

  const [eligibleOrder, setEligibleOrder] = useState(null);
  const [dismissedOrderIds, setDismissedOrderIds] = useState([]);
  const isFetchingRef = useRef(false);
  // Cache of fetched reviews per order to avoid stale GET after a POST
  const [orderReviewsCache, setOrderReviewsCache] = useState({});

  // Helper to get delivered timestamp (uses Delivery.deliveredAt if present)
const getDeliveredAt = (order) => {
  // Prefer delivery subdocument's deliveredAt, otherwise fall back to order.deliveredAt
  return order.delivery?.deliveredAt || order.deliveredAt || null;
};

// Check if a specific delivered order is fully reviewed across all targets
// and also respects the 4‑day eligibility window.
const checkIfFullyReviewed = async (orderId, orderItems, order, skipCache = false) => {
    // ---- 4‑day eligibility window (96 h) ----
    const deliveredAt = getDeliveredAt(order);
    if (!deliveredAt) return true; // missing timestamp => never eligible
    const deliveredDate = new Date(deliveredAt);
    if (Number.isNaN(deliveredDate.getTime())) return true; // invalid timestamp => treat as fully reviewed
    const now = new Date();
    const FOUR_DAYS_MS = 4 * 24 * 60 * 60 * 1000;
    if (now - deliveredDate >= FOUR_DAYS_MS) {
      return true; // past eligibility window → exclude
    }

    // Use cache unless explicitly skipping it
    if (!skipCache && orderReviewsCache[orderId]) {
      const existingReviews = orderReviewsCache[orderId];
      const hasShopReview = existingReviews.some((r) => r.type === 'SHOP');
      let allProductsReviewed = true;
      if (orderItems && orderItems.length > 0) {
        allProductsReviewed = orderItems.every((item) => {
          if (!item.product) return true;
          const pId = typeof item.product === 'object' ? item.product._id : item.product;
          return existingReviews.some(
            (r) => r.type === 'PRODUCT' && String(r.product?._id || r.product) === String(pId)
          );
        });
      }
      return hasShopReview && allProductsReviewed;
    }

    // Fallback – fetch fresh review data when cache miss or skipCache
    try {
      const res = await api.get(`/reviews/order/${orderId}`);
      if (!res || !res.success) return false;
      const existingReviews = res.data || [];
      // Update cache for future calls (unless we are skipping to avoid race)
      if (!skipCache) {
        setOrderReviewsCache((prev) => ({ ...prev, [orderId]: existingReviews }));
      }
      const hasShopReview = existingReviews.some((r) => r.type === 'SHOP');
      let allProductsReviewed = true;
      if (orderItems && orderItems.length > 0) {
        allProductsReviewed = orderItems.every((item) => {
          if (!item.product) return true;
          const pId = typeof item.product === 'object' ? item.product._id : item.product;
          return existingReviews.some(
            (r) => r.type === 'PRODUCT' && String(r.product?._id || r.product) === String(pId)
          );
        });
      }
      return hasShopReview && allProductsReviewed;
    } catch (err) {
      console.warn('Error checking order reviews eligibility:', err.message);
      return false;
    }
  };



  // Find the newest unreviewed delivered order
  const checkUnreviewedDeliveredOrders = useCallback(async () => {
    if (!isAuthenticated || !user || user.role !== 'STUDENT') return;
    if (isFetchingRef.current) return;

    try {
      isFetchingRef.current = true;
      const res = await api.get('/orders');
      if (!res || !res.success || !Array.isArray(res.data)) return;

      // Filter delivered orders
      const deliveredOrders = res.data.filter(
        (o) => o.orderStatus === 'DELIVERED' && !dismissedOrderIds.includes(o._id)
      );

      if (deliveredOrders.length === 0) {
        setEligibleOrder(null);
        return;
      }

      // Check newest delivered orders first
      for (const candidateOrder of deliveredOrders) {
        const isFullyReviewed = await checkIfFullyReviewed(candidateOrder._id, candidateOrder.items, candidateOrder, false);
        if (!isFullyReviewed) {
          setEligibleOrder(candidateOrder);
          return; // Show 1 modal at a time for the newest unreviewed order
        }
      }

      setEligibleOrder(null);
    } catch (err) {
      console.error('Failed to check eligible review orders:', err.message);
    } finally {
      isFetchingRef.current = false;
    }
  }, [isAuthenticated, user, dismissedOrderIds]);

  // Initial check when entering dashboard or changing user
  useEffect(() => {
    checkUnreviewedDeliveredOrders();
  }, [checkUnreviewedDeliveredOrders]);

  // Real-time socket listener for live delivery completion
  useEffect(() => {
    if (!globalSocket || !isAuthenticated || user?.role !== 'STUDENT') return;

    const handleOrderUpdated = (data) => {
      if (data && (data.orderStatus === 'DELIVERED' || data.deliveryStatus === 'DELIVERED')) {
        console.log('🔔 Real-time delivery completed event received for review popup:', data);
        setTimeout(() => {
          checkUnreviewedDeliveredOrders();
        }, 1000);
      }
    };

    const handleNotificationNew = (notif) => {
      if (notif && (notif.title?.toLowerCase().includes('delivered') || notif.message?.toLowerCase().includes('delivered'))) {
        console.log('🔔 Notification for delivery received:', notif);
        setTimeout(() => {
          checkUnreviewedDeliveredOrders();
        }, 1000);
      }
    };

    globalSocket.on('order:updated', handleOrderUpdated);
    globalSocket.on('notification:new', handleNotificationNew);

    return () => {
      globalSocket.off('order:updated', handleOrderUpdated);
      globalSocket.off('notification:new', handleNotificationNew);
    };
  }, [globalSocket, isAuthenticated, user, checkUnreviewedDeliveredOrders]);

  const handleClose = () => {
    if (eligibleOrder) {
      setDismissedOrderIds((prev) => [...prev, eligibleOrder._id]);
    }
    setEligibleOrder(null);
  };

  const handleReviewSubmitted = async () => {
      if (eligibleOrder) {
        // Invalidate cache for this order to ensure fresh check after submission
        setOrderReviewsCache((prev) => {
          const { [eligibleOrder._id]: _, ...rest } = prev;
          return rest;
        });
        // Re-verify if order is now fully reviewed
        const isFullyReviewed = await checkIfFullyReviewed(eligibleOrder._id, eligibleOrder.items, eligibleOrder, true);
        if (isFullyReviewed) {
          setEligibleOrder(null);
          // Check next eligible order
          checkUnreviewedDeliveredOrders();
        }
      }
    };

  if (!eligibleOrder) return null;

  return (
    <RateOrderModal
      order={eligibleOrder}
      isOpen={Boolean(eligibleOrder)}
      onClose={handleClose}
      onReviewSubmitted={handleReviewSubmitted}
    />
  );
}
