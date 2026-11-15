import mongoose from 'mongoose';

const userPromotionDismissalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      required: true,
    },
    dismissedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Unique compound index to prevent duplicate dismissals per user-coupon
userPromotionDismissalSchema.index({ user: 1, coupon: 1 }, { unique: true, name: 'uniq_user_coupon' });

const UserPromotionDismissal = mongoose.models.UserPromotionDismissal || mongoose.model('UserPromotionDismissal', userPromotionDismissalSchema);

export default UserPromotionDismissal;
