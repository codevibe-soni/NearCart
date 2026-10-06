import express from 'express';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';
import {
  createOrder,
  getStudentOrders,
  getOrderById,
  applyCoupon,
  cancelOrder,
  estimateDeliveryFee,
} from '../controllers/orderController.js';
import {
  getOrderPaymentQr,
  generateReceiptPdf,
} from '../controllers/paymentController.js';

const router = express.Router();

router.use(protect);

// Student endpoints
router.post('/delivery-estimate', authorizeRoles('STUDENT'), estimateDeliveryFee);
router.post('/apply-coupon', authorizeRoles('STUDENT'), applyCoupon);
router.post('/', authorizeRoles('STUDENT'), createOrder);
router.get('/', authorizeRoles('STUDENT'), getStudentOrders);
router.patch('/:id/cancel', authorizeRoles('STUDENT'), cancelOrder);
router.get('/:orderId/payment-qr', getOrderPaymentQr);
router.get('/:orderId/receipt', generateReceiptPdf);
router.get('/:id', getOrderById); // Order details verification handles role check inside controller

export default router;
