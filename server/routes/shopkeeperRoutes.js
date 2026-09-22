import express from 'express';

import {
  createShop,
  getMyShop,
  getMyShops,
  updateShop,
  getShopkeeperStats,
  getShopkeeperProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getInventory,
  getShopkeeperOrders,
  updateOrderStatus,
  getShopkeeperCoupons,
  createShopkeeperCoupon,
  updateShopkeeperCoupon,
  toggleShopkeeperCoupon,
  deleteShopkeeperCoupon,
  getCloudinarySignature,
} from '../controllers/shopkeeperController.js';

import {
  protect,
  authorizeRoles,
} from '../middleware/authMiddleware.js';

import upload from '../middleware/uploadMiddleware.js';

import {
  verifyShopkeeperUpiPayment,
  rejectShopkeeperUpiPayment,
} from '../controllers/paymentController.js';

const router = express.Router();

// All routes require authentication & SHOPKEEPER role
router.use(protect, authorizeRoles('SHOPKEEPER'));

router.post('/cloudinary/sign', getCloudinarySignature);

router.get('/stats', getShopkeeperStats);

router.get('/shops', getMyShops);

router.post('/shop', createShop);

router.get('/shop', getMyShop);

router.put('/shop', updateShop);

router.get('/products', getShopkeeperProducts);

// Product creation with Cloudinary image upload
router.post(
  '/products',
  upload.array('images', 5),
  createProduct
);

router.put('/products/:id', updateProduct);

router.delete('/products/:id', deleteProduct);

router.get('/inventory', getInventory);

router.get('/orders', getShopkeeperOrders);

router.patch('/orders/:id/status', updateOrderStatus);

router.patch(
  '/orders/:orderId/verify-payment',
  verifyShopkeeperUpiPayment
);

router.patch(
  '/orders/:orderId/reject-payment',
  rejectShopkeeperUpiPayment
);

// Coupon management routes
router.get('/coupons', getShopkeeperCoupons);

router.post('/coupons', createShopkeeperCoupon);

router.put('/coupons/:id', updateShopkeeperCoupon);

router.patch(
  '/coupons/:id/toggle',
  toggleShopkeeperCoupon
);

router.delete(
  '/coupons/:id',
  deleteShopkeeperCoupon
);

export default router;