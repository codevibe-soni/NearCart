import crypto from 'crypto';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import Shop from '../models/Shop.js';
import Address from '../models/Address.js';
import Coupon from '../models/Coupon.js';
import Payment from '../models/Payment.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import Delivery from '../models/Delivery.js';
import { getIO } from '../config/socket.js';
import { sendPushToUser, sendPushToTokens } from '../services/pushNotificationService.js';
import { sendOrderPlacedEmailToShopkeeper } from '../services/emailService.js';
import { calculateDeliveryFeeForShopAndAddress, calculateDeliveryFeeFromDistance } from '../utils/distanceCalculator.js';


/**
 * Helper to generate human-readable unique order number: CC-2026-XXXXXX
 */
const generateOrderNumber = () => {
  const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `CC-2026-${randomHex}`;
};

/**
 * @desc    Validate and apply a coupon
 * @route   POST /api/orders/apply-coupon
 * @access  Private (Student)
 */
export const applyCoupon = async (req, res) => {
  try {
    const { couponCode, subtotal, shopId } = req.body;

    if (!couponCode || !couponCode.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code is required',
      });
    }

    const orderSubtotal = parseFloat(subtotal);
    if (isNaN(orderSubtotal) || orderSubtotal <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid subtotal is required to apply coupon',
      });
    }

    const query = {
      code: couponCode.trim().toUpperCase(),
      isActive: true,
    };

    if (shopId) {
      query.$or = [{ shopId: null }, { shopId: shopId }];
    }

    const coupon = await Coupon.findOne(query);

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or inactive coupon code',
      });
    }

    if (shopId && coupon.shopId && coupon.shopId.toString() !== shopId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'This coupon is not valid for items in your cart',
      });
    }

    const now = new Date();
    if (now < new Date(coupon.startDate) || now > new Date(coupon.endDate)) {
      return res.status(400).json({
        success: false,
        message: 'Coupon is expired or not yet active',
      });
    }

    if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({
        success: false,
        message: 'Coupon usage limit reached',
      });
    }

    if (orderSubtotal < coupon.minimumOrderAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount of ₹${coupon.minimumOrderAmount} required for this coupon`,
      });
    }

    let discountAmount = 0;
    if (coupon.discountType === 'PERCENTAGE') {
      discountAmount = (orderSubtotal * coupon.discountValue) / 100;
      if (coupon.maximumDiscount !== null && coupon.maximumDiscount > 0) {
        discountAmount = Math.min(discountAmount, coupon.maximumDiscount);
      }
    } else if (coupon.discountType === 'FIXED') {
      discountAmount = coupon.discountValue;
    }

    discountAmount = Math.min(discountAmount, orderSubtotal);
    discountAmount = Math.round(discountAmount * 100) / 100;

    return res.status(200).json({
      success: true,
      message: 'Coupon applied successfully',
      data: {
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount,
      },
    });
  } catch (error) {
    console.error('Error applying coupon:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to apply coupon',
      error: error.message,
    });
  }
};

/**
 * @desc    Create new order from Student's cart
 * @route   POST /api/orders
 * @access  Private (Student)
 */
export const createOrder = async (req, res) => {
  try {
    const { addressId, paymentMethod = 'COD', couponCode, notes, isBuyNow, buyNowItem, idempotencyKey, deliveryDistance: reqDeliveryDistance } = req.body;
    const key = idempotencyKey || req.headers['x-idempotency-key'] || null;


    if (key) {
      const existingOrder = await Order.findOne({ user: req.user._id, idempotencyKey: key })
        .populate([
          { path: 'shop', select: 'name phone address bannerImage owner' },
          { path: 'address' },
          { path: 'items.product', select: 'name images unit' },
        ]);
      if (existingOrder) {
        return res.status(200).json({
          success: true,
          message: 'Order created successfully',
          data: existingOrder,
        });
      }
    }

    if (!addressId) {
      return res.status(400).json({
        success: false,
        message: 'Delivery address is required',
      });
    }

    if (!['COD', 'UPI', 'ONLINE'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment method. Choose COD, UPI, or ONLINE.',
      });
    }

    // 1. Verify delivery address belongs to student
    const address = await Address.findOne({ _id: addressId, user: req.user._id });
    if (!address) {
      return res.status(404).json({
        success: false,
        message: 'Delivery address not found',
      });
    }

    let orderItems = [];
    let stockUpdates = [];
    let calculatedSubtotal = 0;
    let shop = null;
    let cartToClear = null;

    if (isBuyNow || buyNowItem) {
      // -------------------------------------------------------------
      // BUY NOW FLOW (bypasses cart, preserves existing cart items)
      // -------------------------------------------------------------
      const productId = buyNowItem?.productId || buyNowItem?.product?._id || buyNowItem?.product;
      const quantity = parseInt(buyNowItem?.quantity || 1, 10);

      if (!productId) {
        return res.status(400).json({
          success: false,
          message: 'Buy Now product is required',
        });
      }

      if (isNaN(quantity) || quantity < 1) {
        return res.status(400).json({
          success: false,
          message: 'Quantity must be at least 1',
        });
      }

      const product = await Product.findById(productId).populate('shop');
      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found',
        });
      }

      if (!product.isAvailable) {
        return res.status(400).json({
          success: false,
          message: `Product "${product.name}" is currently unavailable`,
        });
      }

      if (product.stock < quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}". Only ${product.stock} left.`,
        });
      }

      shop = product.shop;
      if (!shop || !shop.isApproved || !shop.isActive) {
        return res.status(400).json({
          success: false,
          message: 'The shop associated with this product is not currently available',
        });
      }

      // Calculate server-side effective selling price
      const effectivePrice =
        product.discountPrice != null && product.discountPrice < product.price
          ? product.discountPrice
          : product.price;

      const itemSubtotal = effectivePrice * quantity;
      calculatedSubtotal = itemSubtotal;

      orderItems.push({
        product: product._id,
        name: product.name,
        quantity,
        price: effectivePrice,
        subtotal: itemSubtotal,
        gstPercentage: Number(product.gstPercentage) || 0,
        packingCharges: Number(product.packingCharges) || 0,
      });

      stockUpdates.push({
        product,
        newStock: product.stock - quantity,
      });
    } else {
      // -------------------------------------------------------------
      // STANDARD CART FLOW
      // -------------------------------------------------------------
      const cart = await Cart.findOne({ user: req.user._id }).populate({
        path: 'items.product',
      });

      if (!cart || !cart.items || cart.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Your cart is empty',
        });
      }

      cartToClear = cart;

      const shopId = cart.items[0].shop;
      shop = await Shop.findById(shopId);
      if (!shop || !shop.isApproved || !shop.isActive) {
        return res.status(400).json({
          success: false,
          message: 'The shop associated with your cart is not available',
        });
      }

      for (const item of cart.items) {
        const product = await Product.findById(item.product._id || item.product);

        if (!product) {
          return res.status(400).json({
            success: false,
            message: `Product in cart no longer exists`,
          });
        }

        if (!product.isAvailable) {
          return res.status(400).json({
            success: false,
            message: `Product "${product.name}" is currently unavailable`,
          });
        }

        if (product.stock < item.quantity) {
          return res.status(400).json({
            success: false,
            message: `Insufficient stock for "${product.name}". Only ${product.stock} left.`,
          });
        }

        // Calculate server-side effective selling price
        const effectivePrice =
          product.discountPrice != null && product.discountPrice < product.price
            ? product.discountPrice
            : product.price;

        const itemSubtotal = effectivePrice * item.quantity;
        calculatedSubtotal += itemSubtotal;

        orderItems.push({
          product: product._id,
          name: product.name,
          quantity: item.quantity,
          price: effectivePrice,
          subtotal: itemSubtotal,
          gstPercentage: Number(product.gstPercentage) || 0,
          packingCharges: Number(product.packingCharges) || 0,
        });

        stockUpdates.push({
          product,
          newStock: product.stock - item.quantity,
        });
      }
    }

    // Check shop minimum order amount safely
    const minOrderAmt = shop.minimumOrderAmount !== undefined ? shop.minimumOrderAmount : (shop.minimumOrder || 0);
    if (minOrderAmt > 0 && calculatedSubtotal < minOrderAmt) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount of ₹${minOrderAmt} required for ${shop.name}`,
      });
    }

    // 5. Calculate delivery fee server-side using customer-entered distance (or fallback)
    const deliveryCalc = calculateDeliveryFeeForShopAndAddress(shop, address, reqDeliveryDistance);
    if (!deliveryCalc.success) {
      return res.status(400).json({
        success: false,
        message: deliveryCalc.error,
      });
    }

    const deliveryFee = deliveryCalc.deliveryFee;
    const deliveryDistance = deliveryCalc.distanceKm;


    // 6. Validate & calculate coupon discount server-side if provided
    let discountAmount = 0;
    let couponDoc = null;
    if (couponCode && couponCode.trim()) {
      couponDoc = await Coupon.findOne({
        code: couponCode.trim().toUpperCase(),
        isActive: true,
        $or: [{ shopId: null }, { shopId: shop._id }],
      });

      if (couponDoc) {
        const now = new Date();
        const validDates = now >= new Date(couponDoc.startDate) && now <= new Date(couponDoc.endDate);
        const validLimit = couponDoc.usageLimit === null || couponDoc.usedCount < couponDoc.usageLimit;
        const validMinOrder = calculatedSubtotal >= couponDoc.minimumOrderAmount;
        const validShop = !couponDoc.shopId || couponDoc.shopId.toString() === shop._id.toString();

        if (validDates && validLimit && validMinOrder && validShop) {
          if (couponDoc.discountType === 'PERCENTAGE') {
            discountAmount = (calculatedSubtotal * couponDoc.discountValue) / 100;
            if (couponDoc.maximumDiscount && couponDoc.maximumDiscount > 0) {
              discountAmount = Math.min(discountAmount, couponDoc.maximumDiscount);
            }
          } else if (couponDoc.discountType === 'FIXED') {
            discountAmount = couponDoc.discountValue;
          }
          discountAmount = Math.min(discountAmount, calculatedSubtotal);
          discountAmount = Math.round(discountAmount * 100) / 100;
        }
      }
    }

// 7. Calculate Product-Level Packing Charges, GST, and final total amount
let packingCharges = 0;
let gstAmount = 0;

for (const item of orderItems) {
  const itemPacking = (Number(item.packingCharges) || 0) * (Number(item.quantity) || 0);
  packingCharges += itemPacking;

  const gstPercentage = Number(item.gstPercentage) || 0;
  const itemGst = (Number(item.subtotal) * gstPercentage) / 100;
  gstAmount += itemGst;
}

packingCharges = Math.round(packingCharges * 100) / 100;
gstAmount = Math.round(gstAmount * 100) / 100;

const totalAmount = Math.max(
  0,
  calculatedSubtotal + packingCharges + gstAmount + deliveryFee - discountAmount
);
    // 8. Generate unique order number with retry on collision
    let orderNumber = generateOrderNumber();
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 5) {
      const existing = await Order.findOne({ orderNumber });
      if (!existing) {
        isUnique = true;
      } else {
        orderNumber = generateOrderNumber();
        attempts++;
      }
    }

    // Capture upiQrSnapshot from shop
    // const upiQrSnapshot = {
    //   upiId: shop.upiId || '',
    //   imageUrl: shop.upiQrImage || '',
    //   upiQrImage: shop.upiQrImage || '',
    // };
  const upiQrSnapshot = {
  upiId: shop.upiId || '',
  imageUrl: shop.upiQrImage || '',
    };

    // 9. Create Order Document (with idempotency handling)
    let order;
    try {
      order = await Order.create({
        orderNumber,
        user: req.user._id,
        shop: shop._id,
        items: orderItems,
        address: address._id,
        subtotal: calculatedSubtotal,
        packingCharges,
        deliveryFee,
        deliveryDistance,
        discount: discountAmount,
        gstAmount,
        totalAmount,
        paymentMethod,
        paymentStatus: 'PENDING',
        upiQrSnapshot,
        orderStatus: 'PLACED',
        notes: notes ? notes.trim() : '',
        ...(key ? { idempotencyKey: key } : {}),
      });
    } catch (createErr) {
      if (createErr.code === 11000 && key) {
        const existingOrder = await Order.findOne({ user: req.user._id, idempotencyKey: key })
          .populate([
            { path: 'shop', select: 'name phone address bannerImage owner' },
            { path: 'address' },
            { path: 'items.product', select: 'name images unit' },
          ]);
        if (existingOrder) {
          return res.status(200).json({
            success: true,
            message: 'Order created successfully',
            data: existingOrder,
          });
        }
      }
      throw createErr;
    }

    // 9b. Create initial unassigned Delivery Record (status: PENDING, deliveryBoy: null)
    try {
      const Delivery = (await import('../models/Delivery.js')).default;
      await Delivery.create({
        order: order._id,
        deliveryBoy: null,
        status: 'PENDING',
      });
    } catch (delErr) {
      console.warn('Initial Delivery document creation notice:', delErr.message);
    }

    // Create corresponding Payment document if required by schema
    try {
      await Payment.create({
        order: order._id,
        user: req.user._id,
        amount: totalAmount,
        method: paymentMethod === 'COD' ? 'COD' : 'UPI',
        status: 'PENDING',
        upiQrSnapshot,
      });
    } catch (payErr) {
      console.warn('Payment document creation notice:', payErr.message);
    }

    // 10. Update stock for all ordered products safely
    for (const update of stockUpdates) {
      update.product.stock = update.newStock;
      if (update.newStock === 0) {
        update.product.isAvailable = false;
      }
      await update.product.save();
    }

    // 11. Increment coupon usage count if applied
    if (couponDoc && discountAmount > 0) {
      couponDoc.usedCount += 1;
      await couponDoc.save();
    }

    // 12. Clear Student's cart only if standard cart flow
    if (cartToClear) {
      cartToClear.items = [];
      await cartToClear.save();
    }

    await order.populate([
      { path: 'shop', select: 'name phone address bannerImage owner' },
      { path: 'address' },
      { path: 'items.product', select: 'name images unit' },
    ]);


   // 13. Create Notifications + Real-Time Socket.IO
try {
  const notifications = [];

  // A. Student notification
  const studentNotification = await Notification.create({
    user: req.user._id,
    title: 'Order Placed Successfully',
    message: `Your order ${order.orderNumber} has been placed successfully.`,
    type: 'ORDER',
    relatedOrder: order._id,
    isRead: false,
  });

  notifications.push(studentNotification);

  // B. Shopkeeper notification
  if (shop.owner) {
    const shopkeeperNotification = await Notification.create({
      user: shop.owner,
      title: 'New Order Received',
      message: `New order ${order.orderNumber} has been placed for your shop.`,
      type: 'ORDER',
      relatedOrder: order._id,
      isRead: false,
    });

    notifications.push(shopkeeperNotification);
  }

  // C. Delivery Boy notifications
  const activeDeliveryBoys = await User.find({
    role: 'DELIVERY_BOY',
    isActive: true,
    accountStatus: 'APPROVED',
  }).select('_id');

  if (activeDeliveryBoys.length > 0) {
    const deliveryNotifications = activeDeliveryBoys.map((dbUser) => ({
      user: dbUser._id,
      title: 'New Delivery Available',
      message: `Order ${order.orderNumber} is available for delivery.`,
      type: 'DELIVERY',
      relatedOrder: order._id,
      isRead: false,
    }));

    const createdDeliveryNotifications =
      await Notification.insertMany(deliveryNotifications);

    notifications.push(...createdDeliveryNotifications);
  }

  // D. Send notifications & dashboard events instantly using Socket.IO
  try {
    const io = getIO();

    for (const notification of notifications) {
      io.to(`user:${notification.user.toString()}`).emit(
        'notification:new',
        {
          _id: notification._id,
          title: notification.title,
          message: notification.message,
          type: notification.type,
          relatedOrder: notification.relatedOrder,
          isRead: notification.isRead,
          createdAt: notification.createdAt,
        }
      );
    }

    // 1. Emit to Shopkeeper Owner
    if (shop.owner) {
      io.to(`user:${shop.owner.toString()}`).emit('order:new', {
        orderId: order._id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt,
        shopId: shop._id,
      });
    }

    // 2. Emit to Eligible Delivery Boys
    if (activeDeliveryBoys && activeDeliveryBoys.length > 0) {
      activeDeliveryBoys.forEach((dbUser) => {
        // io.to(`user:${dbUser._id.toString()}`).emit('delivery:order:new', {
        //   orderId: order._id,
        //   orderNumber: order.orderNumber,
        //   orderStatus: order.orderStatus,
        //   shopId: shop._id,
        //   createdAt: order.createdAt,
        // });
  io.to(`user:${dbUser._id.toString()}`).emit('delivery:order:new', {
  orderId: order._id,
  orderNumber: order.orderNumber,
  orderStatus: order.orderStatus,
  // Complete order details
  items: order.items,
  subtotal: order.subtotal,
  gstAmount: order.gstAmount,
  deliveryFee: order.deliveryFee,
  discount: order.discount,
  totalAmount: order.totalAmount,
  paymentMethod: order.paymentMethod,
  paymentStatus: order.paymentStatus,
  notes: order.notes,
  // Shop details
  shop: {
    _id: shop._id,
    name: shop.name,
    phone: shop.phone,
    address: shop.address,
  },
  // Customer details
  customer: {
    _id: req.user._id,
    name: req.user.name,
    phone: req.user.phone,
  },
  // Delivery address
  address: address,

  createdAt: order.createdAt,
});
      });
    }

    // 3. Emit to Student
    io.to(`user:${req.user._id.toString()}`).emit('order:created', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      totalAmount: order.totalAmount,
      createdAt: order.createdAt,
    });

    console.log(
      `🔔 Real-time notifications and dashboard events sent for order ${order.orderNumber}`
    );
  } catch (socketError) {
    console.warn(
      'Socket notification error:',
      socketError.message
    );
  }

  // E. Send Push Notifications via FCM
  try {
    const pushTasks = [];

    // Student push
    pushTasks.push(
      sendPushToUser(req.user._id, {
        title: 'Order Placed',
        body: `Your order ${order.orderNumber} has been placed successfully.`,
        orderId: order._id,
        type: 'ORDER',
        url: `/orders/${order._id}`,
      }).then((res) => ({ role: 'Student', res }))
    );

    // Shopkeeper push
    if (shop.owner) {
      pushTasks.push(
        sendPushToUser(shop.owner, {
          title: 'New Order Received',
          body: `New order ${order.orderNumber} has been placed for your shop.`,
          orderId: order._id,
          type: 'ORDER',
          url: `/orders/${order._id}`,
        }).then((res) => ({ role: 'Shopkeeper', res }))
      );
    }

    // Delivery Boy push
    if (activeDeliveryBoys && activeDeliveryBoys.length > 0) {
      const dbUserIds = activeDeliveryBoys.map((dbUser) => dbUser._id);
      const deliveryPushPromise = User.find({ _id: { $in: dbUserIds } })
        .select('pushTokens')
        .then((dbUsers) => {
          const dbTokens = [];
          dbUsers.forEach((u) => {
            if (u.pushTokens && u.pushTokens.length > 0) {
              u.pushTokens.forEach((t) => {
                if (t.isActive !== false && t.token) dbTokens.push(t.token);
              });
            }
          });
          if (dbTokens.length > 0) {
            return sendPushToTokens(dbTokens, {
              title: 'New Delivery Available',
              body: `Order ${order.orderNumber} is available for delivery.`,
              orderId: order._id,
              type: 'DELIVERY',
              url: `/orders/${order._id}`,
            });
          }
          return { success: true, sentCount: 0, failureCount: 0 };
        })
        .then((res) => ({ role: 'DeliveryBoys', res }));

      pushTasks.push(deliveryPushPromise);
    }

    Promise.allSettled(pushTasks).then((results) => {
      results.forEach((r) => {
        if (r.status === 'fulfilled' && r.value) {
          const { role, res } = r.value;
          console.log(`📱 [FCM Push Diagnostics] Order #${order.orderNumber} -> ${role}: ${res?.sentCount || 0} succeeded, ${res?.failureCount || 0} failed`);
        }
      });
    });
  } catch (fcmErr) {
    console.warn('FCM push dispatch notice:', fcmErr.message);
  }


} catch (notifErr) {
  console.warn(
    'Order notification creation notice:',
    notifErr.message
  );
}

// F. Send Email Notification to Shopkeeper (fire-and-forget — must NOT block order response)
(async () => {
  try {
    console.log(`[SHOP EMAIL TRACE] Order ID: ${order._id}`);
    console.log(`[SHOP EMAIL TRACE] Order Number: ${order.orderNumber}`);
    const targetShopId = order.shop._id || order.shop;
    console.log(`[SHOP EMAIL TRACE] Shop ID: ${targetShopId}`);
    const shopDoc = await Shop.findById(targetShopId).populate('owner', 'email name phone');

    if (shopDoc) {
      console.log(`[SHOP EMAIL TRACE] Shop resolved: PASS (${shopDoc.name})`);
    } else {
      console.warn(`[SHOP EMAIL TRACE] Shop resolved: FAIL (Shop document not found for ID ${targetShopId})`);
    }

    if (shopDoc && shopDoc.owner) {
      console.log(`[SHOP EMAIL TRACE] Shop Owner ID: ${shopDoc.owner._id}`);
      console.log(`[SHOP EMAIL TRACE] Shop owner resolved: PASS (${shopDoc.owner.name})`);
    } else {
      console.warn(`[SHOP EMAIL TRACE] Shop owner resolved: FAIL (Owner not assigned to shop)`);
    }

    if (shopDoc && shopDoc.owner && shopDoc.owner.email) {
      console.log(`[SHOP EMAIL TRACE] Shopkeeper Email: ${shopDoc.owner.email}`);
      console.log(`[SHOP EMAIL TRACE] Email Function Called: PASS`);

      // Address resolution
      let addressDoc = address;
      if ((!addressDoc || !addressDoc.fullAddress) && order.address) {
        addressDoc = await Address.findById(order.address);
      }

      let formattedAddress = 'Customer Delivery Address';
      if (addressDoc) {
        if (addressDoc.fullAddress) {
          formattedAddress = addressDoc.fullAddress;
        } else {
          const parts = [
            addressDoc.roomNumber ? `Room/Flat ${addressDoc.roomNumber}` : '',
            addressDoc.hostelName,
            addressDoc.landmark ? `Near ${addressDoc.landmark}` : '',
            addressDoc.city,
            addressDoc.state,
            addressDoc.postalCode,
          ].filter(Boolean);
          formattedAddress = parts.length > 0 ? parts.join(', ') : 'Customer Delivery Address';
        }
      }

      const emailResult = await sendOrderPlacedEmailToShopkeeper({
        shopkeeperEmail: shopDoc.owner.email,
        shopkeeperName: shopDoc.owner.name || 'Shopkeeper',
        shopName: shopDoc.name,
        shopPhone: shopDoc.phone || '',
        shopAddress: shopDoc.address || '',
        shopUpiId: shopDoc.upiId || order.upiQrSnapshot?.upiId || '',
        studentName: req.user.name || 'Customer',
        customerPhone: req.user.phone || 'Not provided',
        customerEmail: req.user.email || 'Not provided',
        orderNumber: order.orderNumber,
        orderId: order._id,
        items: orderItems,
        subtotal: order.subtotal,
        packingCharges: order.packingCharges,
        deliveryFee: order.deliveryFee,
        gstAmount: order.gstAmount,
        discount: order.discount,
        couponCode: couponCode ? couponCode.trim().toUpperCase() : null,
        totalAmount: order.totalAmount,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
        addressDoc,
        deliveryAddress: formattedAddress,
        orderTime: order.createdAt
          ? new Date(order.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
          : new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        orderStatus: order.orderStatus,
        notes: order.notes,
      });

      if (emailResult && emailResult.messageId) {
        console.log(`[SHOP EMAIL TRACE] SMTP Send: SUCCESS`);
        console.log(`[SHOP EMAIL TRACE] Message ID: ${emailResult.messageId}`);
      } else if (emailResult && emailResult.loggedOnly) {
        console.warn(`[SHOP EMAIL TRACE] SMTP Send: LOGGED_ONLY (SMTP not configured in runtime)`);
      } else {
        console.warn(`[SHOP EMAIL TRACE] SMTP Send: FAIL (${emailResult?.error?.message || 'Unknown error'})`);
      }
    } else {
      console.warn('[SHOP EMAIL TRACE] Shopkeeper Email: MISSING');
      console.warn('[SHOP EMAIL TRACE] Email Function Called: SKIPPED (Shop owner email missing in database)');
    }
  } catch (emailTriggerErr) {
    // Email failure must NEVER rollback a successful order
    console.warn('[SHOP EMAIL TRACE] Email Function Called: ERROR');
    console.warn(`[SHOP EMAIL TRACE] SMTP Send: FAIL (${emailTriggerErr.message})`);
  }
})(); // No await — email runs in the background, order response is immediate

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: order,
    });
  } catch (error) {
    console.error('Error creating order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to place order',
      error: error.message,
    });
  }
};

/**
 * @desc    Get order history for authenticated Student
 * @route   GET /api/orders
 * @access  Private (Student)
 */
export const getStudentOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      // .populate('shop', 'name bannerImage address')
      // .populate('shop', 'name bannerImage address upiEnabled upiId upiQrImage')
      .populate('shop','name bannerImage address deliveryFee upiEnabled upiId upiQrImage')
      .populate('address')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (error) {
    console.error('Error fetching student orders:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch order history',
      error: error.message,
    });
  }
};

/**
 * @desc    Get order details by ID
 * @route   GET /api/orders/:id
 * @access  Private (Student / Shopkeeper / Admin / Delivery)
 */
export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('shop','name bannerImage address deliveryFee upiEnabled upiId upiQrImage')
      .populate('address')
      .populate('items.product', 'name images unit');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Authorization check: Student can only view their own orders
    if (req.user.role === 'STUDENT' && order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to order details',
      });
    }

    const orderObj = order.toObject();

    // Check if a Delivery record is assigned to this order
    const delivery = await Delivery.findOne({ order: order._id }).populate('deliveryBoy', 'name phone profileImage');
    if (delivery && delivery.deliveryBoy) {
      orderObj.deliveryBoy = {
        _id: delivery.deliveryBoy._id,
        name: delivery.deliveryBoy.name,
        phone: delivery.deliveryBoy.phone,
        profileImage: delivery.deliveryBoy.profileImage || null,
      };
      orderObj.deliveryStatus = delivery.status;
    }

    return res.status(200).json({
      success: true,
      data: orderObj,
    });
  } catch (error) {
    console.error('Error fetching order details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch order details',
      error: error.message,
    });
  }
};

/**
 * @desc    Cancel order by authenticated Student
 * @route   PATCH /api/orders/:id/cancel
 * @access  Private (Student)
 */
export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancellationReason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order ID format',
      });
    }

    const order = await Order.findOne({ _id: id, user: req.user._id });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found or does not belong to you',
      });
    }

    // Cancellation check: Student can cancel ONLY when PLACED or SHOP_ACCEPTED
    const CANCELLABLE_STATUSES = ['PLACED', 'SHOP_ACCEPTED'];
    if (!CANCELLABLE_STATUSES.includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled once it reaches ${order.orderStatus}`,
      });
    }

    // Already cancelled check
    if (['CANCELLED', 'SHOP_REJECTED'].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Order is already cancelled',
      });
    }

    order.orderStatus = 'CANCELLED';
    order.cancellationReason = cancellationReason ? cancellationReason.trim() : 'Cancelled by Student';
    await order.save();

    // Safely restore product stock
    for (const item of order.items) {
      if (item.product) {
        const product = await Product.findById(item.product);
        if (product) {
          product.stock += item.quantity;
          if (product.stock > 0 && !product.isAvailable) {
            product.isAvailable = true;
          }
          await product.save();
        }
      }
    }

    await order.populate([
      { path: 'shop', select: 'name phone address bannerImage owner' },
      { path: 'address' },
      { path: 'items.product', select: 'name images unit' },
    ]);

    // Create Notification for Shopkeeper informing about Student Cancellation
    try {
      if (order.shop && order.shop.owner) {
        await Notification.create({
          user: order.shop.owner,
          title: 'Order Cancelled',
          message: `Order ${order.orderNumber} has been cancelled by the student.`,
          type: 'ORDER',
          relatedOrder: order._id,
          isRead: false,
        });
      }
    } catch (notifErr) {
      console.warn('Student cancellation notification notice:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: order,
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel order',
      error: error.message,
    });
  }
};

