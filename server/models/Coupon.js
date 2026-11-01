import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      uppercase: true,
      trim: true,
    },
    couponType: {
      type: String,
      enum: {
        values: ['GLOBAL', 'SHOP_SPECIFIC'],
        message: '{VALUE} is not a valid coupon type',
      },
      default: 'GLOBAL',
      required: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    discountType: {
      type: String,
      enum: {
        values: ['PERCENTAGE', 'FIXED'],
        message: '{VALUE} is not a valid discount type',
      },
      required: [true, 'Discount type is required'],
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [0, 'Discount value cannot be negative'],
      validate: {
        validator: function (val) {
          if (this.discountType === 'PERCENTAGE') {
            return val <= 100;
          }
          return true;
        },
        message: 'Percentage discount cannot exceed 100%',
      },
    },
    minimumOrderAmount: {
      type: Number,
      default: 0,
      min: [0, 'Minimum order amount cannot be negative'],
    },
    maximumDiscount: {
      type: Number,
      min: [0, 'Maximum discount cannot be negative'],
      default: null,
    },
    usageLimit: {
      type: Number,
      min: [1, 'Usage limit must be at least 1'],
      default: null,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: [0, 'Used count cannot be negative'],
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
      validate: {
        validator: function (val) {
          return val >= this.startDate;
        },
        message: 'End date must be greater than or equal to start date',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Scoped Unique Indexes:
// 1. GLOBAL coupons: code must be globally unique
couponSchema.index(
  { code: 1 },
  {
    unique: true,
    partialFilterExpression: { couponType: 'GLOBAL' },
    name: 'unique_global_coupon_code',
  }
);

// 2. SHOP_SPECIFIC coupons: code unique per shop (different shops can reuse same code)
couponSchema.index(
  { code: 1, shopId: 1 },
  {
    unique: true,
    partialFilterExpression: { couponType: 'SHOP_SPECIFIC' },
    name: 'unique_shop_coupon_code',
  }
);

couponSchema.index({ isActive: 1 });
couponSchema.index({ shopId: 1, isActive: 1 });
couponSchema.index({ couponType: 1, isActive: 1 });

const Coupon = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);

export default Coupon;
