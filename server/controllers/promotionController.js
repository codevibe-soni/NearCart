import mongoose from 'mongoose';
import Coupon from '../models/Coupon.js';
import UserPromotionDismissal from '../models/UserPromotionDismissal.js';

/**
 * @desc Get active promotions for a specific shop (including GLOBAL promotions)
 * @route GET /api/promotions/shop/:shopId
 * @access Private (any authenticated user)
 */
export const getPromotionsForShop = async (req, res, next) => {
  try {
    const { shopId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(shopId)) {
      return res.status(400).json({ success: false, message: 'Invalid shop ID format' });
    }

    const now = new Date();
    // Match GLOBAL coupons or SHOP_SPECIFIC for this shop
    const query = {
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gt: now }, // treat now >= endDate as expired => exclude
      $or: [
        { couponType: 'GLOBAL' },
        { couponType: 'SHOP_SPECIFIC', shopId: mongoose.Types.ObjectId(shopId) },
      ],
    };

    const promotions = await Coupon.find(query).lean();
    return res.status(200).json({ success: true, data: promotions });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Get list of promotion (coupon) IDs dismissed by the current user
 * @route GET /api/promotions/dismissed
 * @access Private
 */
export const getDismissedPromotions = async (req, res, next) => {
  try {
    const dismissals = await UserPromotionDismissal.find({ user: req.user._id })
      .select('coupon')
      .lean();
    const dismissedIds = dismissals.map((d) => d.coupon);
    return res.status(200).json({ success: true, data: dismissedIds });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Dismiss a promotion for the current user
 * @route POST /api/promotions/dismiss
 * @access Private
 * @body { couponId }
 */
export const dismissPromotion = async (req, res, next) => {
  try {
    const { couponId } = req.body;
    if (!mongoose.Types.ObjectId.isValid(couponId)) {
      return res.status(400).json({ success: false, message: 'Invalid coupon ID' });
    }

    // Ensure coupon exists and is active (optional but helpful)
    const coupon = await Coupon.findById(couponId);
    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Coupon not found' });
    }

    // Upsert dismissal – duplicate attempts are idempotent
    await UserPromotionDismissal.findOneAndUpdate(
      { user: req.user._id, coupon: couponId },
      { $setOnInsert: { user: req.user._id, coupon: couponId, dismissedAt: new Date() } },
      { upsert: true, new: true }
    );

    return res.status(200).json({ success: true, message: 'Promotion dismissed' });
  } catch (err) {
    // Duplicate key error (shouldn't happen due to upsert) – treat as success
    if (err.code === 11000) {
      return res.status(200).json({ success: true, message: 'Promotion already dismissed' });
    }
    next(err);
  }
};
