import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Product reference is required'],
    },
    name: {
      type: String,
      required: [true, 'Product snapshot name is required'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [1, 'Quantity must be at least 1'],
    },
    price: {
      type: Number,
      required: [true, 'Product snapshot price is required'],
      min: [0, 'Price cannot be negative'],
    },
    subtotal: {
      type: Number,
      required: [true, 'Item subtotal is required'],
      min: [0, 'Subtotal cannot be negative'],
    },

  gstPercentage: {
    type: Number,
    default: 0,
    min: [0, 'GST percentage cannot be negative'],
    max: [100, 'GST percentage cannot exceed 100'],
  },
  packingCharges: {
    type: Number,
    default: 0,
    min: [0, 'Item packing charges cannot be negative'],
  },
  },
  { _id: true }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: [true, 'Order number is required'],
      unique: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student user reference is required'],
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: [true, 'Shop reference is required'],
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: function (val) {
          return val && val.length > 0;
        },
        message: 'Order must contain at least one item',
      },
    },
    address: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Address',
      required: [true, 'Delivery address reference is required'],
    },
    subtotal: {
      type: Number,
      required: [true, 'Order subtotal is required'],
      min: [0, 'Subtotal cannot be negative'],
    },
    deliveryFee: {
      type: Number,
      required: [true, 'Delivery fee is required'],
      min: [0, 'Delivery fee cannot be negative'],
    },
    deliveryDistance: {
      type: Number,
      default: null,
      min: [0, 'Delivery distance cannot be negative'],
    },
    packingCharges: {
      type: Number,
      default: 0,
      min: [0, 'Packing charges cannot be negative'],
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
    },
  gstAmount: {
  type: Number,
  default: 0,
  min: [0, 'GST amount cannot be negative'],
},
    idempotencyKey: {
      type: String,
      trim: true,
      default: null,
    },
    totalAmount: {
      type: Number,
      required: [true, 'Total amount is required'],
      min: [0, 'Total amount cannot be negative'],
    },
    paymentMethod: {
      type: String,
      enum: {
        values: ['COD', 'UPI', 'ONLINE'],
        message: '{VALUE} is not a valid payment method',
      },
      default: 'COD',
    },
    paymentStatus: {
      type: String,
      enum: {
        values: ['PENDING', 'USER_CONFIRMED', 'PAID', 'FAILED', 'REFUNDED'],
        message: '{VALUE} is not a valid payment status',
      },
      default: 'PENDING',
    },
    upiQrSnapshot: {
      imageUrl: { type: String, default: '' },
      upiId: { type: String, default: '' },
    },
    orderStatus: {
      type: String,
      enum: {
        values: [
          'PLACED',
          'SHOP_ACCEPTED',
          'SHOP_REJECTED',
          'PREPARING',
          'READY_FOR_PICKUP',
          'DELIVERY_ASSIGNED',
          'PICKED_UP',
          'OUT_FOR_DELIVERY',
          'DELIVERED',
          'CANCELLED',
        ],
        message: '{VALUE} is not a valid order status',
      },
      default: 'PLACED',
    },
    cancellationReason: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
orderSchema.index({ user: 1 });
orderSchema.index({ shop: 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

export default Order;
