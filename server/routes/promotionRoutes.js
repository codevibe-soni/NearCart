import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getPromotionsForShop,
  getDismissedPromotions,
  dismissPromotion,
} from '../controllers/promotionController.js';

const router = express.Router();

// Get active promotions for a shop (including global)
router.get('/shop/:shopId', protect, getPromotionsForShop);

// Get list of promotions dismissed by the current user
router.get('/dismissed', protect, getDismissedPromotions);

// Dismiss a promotion for the current user
router.post('/dismiss', protect, dismissPromotion);

export default router;
