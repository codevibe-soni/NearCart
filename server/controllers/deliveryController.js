import mongoose from 'mongoose';
import Delivery from '../models/Delivery.js';
import Order from '../models/Order.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';

// Valid status state transitions
const VALID_TRANSITIONS = {
  PENDING: ['ASSIGNED'],
  ASSIGNED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['ARRIVED_AT_SHOP', 'CANCELLED'],
  ARRIVED_AT_SHOP: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'CANCELLED'],
};

// @route   GET /api/delivery/available-orders
// @desc    Get unassigned available orders for delivery boys
// @access  Private/Delivery_Boy
export const getAvailableOrders = async (req, res, next) => {
  try {
    // Fetch delivery records where deliveryBoy is null and status is PENDING
    const availableDeliveries = await Delivery.find({
      deliveryBoy: null,
      status: 'PENDING',
    })
      .populate({
        path: 'order',
        match: { orderStatus: { $nin: ['CANCELLED', 'SHOP_REJECTED', 'DELIVERED', 'DELIVERY_ASSIGNED'] } },
        populate: [
          { path: 'shop', select: 'name address phone logo owner' },
          { path: 'user', select: 'name phone email' },
          { path: 'address' },
        ],
      })
      .sort({ createdAt: -1 });

    // Filter out deliveries where order might be null due to populate match filter
    const validDeliveries = availableDeliveries.filter((d) => d.order !== null);

    res.status(200).json({
      success: true,
      count: validDeliveries.length,
      deliveries: validDeliveries,
    });
  } catch (error) {
    next(error);
  }
};

// @route   PATCH /api/delivery/orders/:orderId/accept
// @desc    Accept delivery of an unassigned order (First-Accept-Wins Atomic Update)
// @access  Private/Delivery_Boy
export const acceptDelivery = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const deliveryBoyId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID format' });
    }

    // 1. Verify Order existence and status
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (['CANCELLED', 'SHOP_REJECTED', 'DELIVERED'].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be accepted because it is ${order.orderStatus}`,
      });
    }

    // Check if current user is ALREADY assigned to this delivery (Duplicate Request protection)
    const existingSelfAssigned = await Delivery.findOne({
      order: order._id,
      deliveryBoy: deliveryBoyId,
    });
    if (existingSelfAssigned) {
      return res.status(200).json({
        success: true,
        message: 'This delivery is already assigned to you.',
        delivery: existingSelfAssigned,
      });
    }

    // 2. ATOMIC ASSIGNMENT (FIRST-ACCEPT-WINS)
    // Find delivery where order matches, deliveryBoy is null AND status is PENDING
    // Update atomically in MongoDB to prevent race conditions between multiple delivery boys
    const updatedDelivery = await Delivery.findOneAndUpdate(
      {
        order: order._id,
        deliveryBoy: null,
        status: 'PENDING',
      },
      {
        $set: {
          deliveryBoy: deliveryBoyId,
          status: 'ACCEPTED',
          assignedAt: new Date(),
          acceptedAt: new Date(),
        },
      },
      { new: true }
    );

    // If update returned null, another Delivery Boy already accepted the order or it was no longer PENDING
    if (!updatedDelivery) {
      return res.status(409).json({
        success: false,
        message: 'This delivery has already been accepted by another delivery boy.',
      });
    }

    // 3. Update Order status to DELIVERY_ASSIGNED
    order.orderStatus = 'DELIVERY_ASSIGNED';
    await order.save();

    // 4. Fetch Delivery Boy details safely (name, phone, email, profileImage)
    const deliveryBoy = await User.findById(deliveryBoyId).select('name phone email profileImage');

    // 5. Create Notifications for Student & Shopkeeper
    try {
      // A. Student Notification
      await Notification.create({
        user: order.user,
        title: 'Delivery Boy Assigned',
        message: `Your delivery partner ${deliveryBoy.name} has accepted your order ${order.orderNumber}.`,
        type: 'DELIVERY',
        relatedOrder: order._id,
        isRead: false,
      });

      // B. Shopkeeper Notification
      const shop = await mongoose.model('Shop').findById(order.shop);
      if (shop && shop.owner) {
        await Notification.create({
          user: shop.owner,
          title: 'Delivery Partner Assigned',
          message: `Delivery partner ${deliveryBoy.name} has accepted order ${order.orderNumber}.`,
          type: 'DELIVERY',
          relatedOrder: order._id,
          isRead: false,
        });
      }
    } catch (notifErr) {
      console.warn('Accept delivery notification notice:', notifErr.message);
    }

    const deliveryBoyData = {
      _id: deliveryBoy._id,
      name: deliveryBoy.name,
      phone: deliveryBoy.phone,
      email: deliveryBoy.email || '',
      profileImage: deliveryBoy.profileImage || null,
    };

    // 6. Broadcast Real-Time Socket Event, DB Notifications & FCM Push
    try {
      const { getIO } = await import('../config/socket.js');
      const { sendPushToUser } = await import('../services/pushNotificationService.js');
      const io = getIO();

      io.to(`delivery:${order._id}`).emit('delivery:assigned', {
        orderId: order._id,
        orderStatus: 'DELIVERY_ASSIGNED',
        deliveryBoy: deliveryBoyData,
      });

      // Create Notification for Student
      const studentNotif = await Notification.create({
        user: order.user,
        title: 'Delivery Partner Assigned',
        message: `${deliveryBoy.name} has accepted delivery for order ${order.orderNumber}.`,
        type: 'DELIVERY',
        relatedOrder: order._id,
        isRead: false,
      });

      io.to(`user:${order.user.toString()}`).emit('notification:new', {
        _id: studentNotif._id,
        title: studentNotif.title,
        message: studentNotif.message,
        type: studentNotif.type,
        relatedOrder: studentNotif.relatedOrder,
        isRead: studentNotif.isRead,
        createdAt: studentNotif.createdAt,
      });

      // Send FCM push to Student
      sendPushToUser(order.user, {
        title: studentNotif.title,
        body: studentNotif.message,
        orderId: order._id,
        type: 'DELIVERY',
        url: `/orders/${order._id}`,
      }).catch((err) => console.warn('Student delivery acceptance FCM notice:', err.message));

      // Create Notification for Shopkeeper if owner exists
      const shopDoc = await mongoose.model('Shop').findById(order.shop).select('name owner address');
      if (shopDoc && shopDoc.owner) {
        const shopNotif = await Notification.create({
          user: shopDoc.owner,
          title: 'Delivery Partner Assigned',
          message: `Delivery partner ${deliveryBoy.name} accepted delivery for order ${order.orderNumber}.`,
          type: 'DELIVERY',
          relatedOrder: order._id,
          isRead: false,
        });

        io.to(`user:${shopDoc.owner.toString()}`).emit('notification:new', {
          _id: shopNotif._id,
          title: shopNotif.title,
          message: shopNotif.message,
          type: shopNotif.type,
          relatedOrder: shopNotif.relatedOrder,
          isRead: shopNotif.isRead,
          createdAt: shopNotif.createdAt,
        });
      }

      // 7. Send Email Notification to Delivery Boy (Database-resolved recipient)
      try {
        console.log(`[EMAIL TRACE] Delivery resolved: PASS (${order.orderNumber})`);
        if (deliveryBoy) {
          console.log(`[EMAIL TRACE] Delivery boy resolved: PASS (${deliveryBoy.name})`);
        }
        if (deliveryBoy && deliveryBoy.email) {
          console.log(`[EMAIL TRACE] Delivery email resolved: PASS (${deliveryBoy.email})`);
        } else {
          console.warn(`[EMAIL TRACE] Delivery email resolved: FAIL (Delivery boy email missing in database)`);
        }

        const { sendDeliveryAssignedEmailToDeliveryBoy } = await import('../services/emailService.js');
        const shopInfo = shopDoc || (await mongoose.model('Shop').findById(order.shop).select('name address'));
        const studentInfo = await User.findById(order.user).select('name');
        const addressInfo = await mongoose.model('Address').findById(order.address);

        const formattedDeliveryAddr = addressInfo
          ? `${addressInfo.addressLine1 || addressInfo.street || ''}, ${addressInfo.city || ''}, ${addressInfo.pincode || ''}`
          : 'Customer Address';

        sendDeliveryAssignedEmailToDeliveryBoy({
          deliveryBoyEmail: deliveryBoy.email,
          deliveryBoyName: deliveryBoy.name,
          orderNumber: order.orderNumber,
          shopName: shopInfo ? shopInfo.name : 'NearCart Shop',
          shopAddress: shopInfo ? shopInfo.address : '',
          deliveryAddress: formattedDeliveryAddr,
          customerName: studentInfo ? studentInfo.name : 'Student',
          totalAmount: order.totalAmount,
          orderId: order._id,
        }).catch((emailErr) => {
          console.warn('Delivery boy email dispatch notice:', emailErr.message);
        });
      } catch (emailTriggerErr) {
        console.warn('[EMAIL TRACE] Delivery boy email trigger notice:', emailTriggerErr.message);
      }
    } catch (sockErr) {
      console.warn('Socket/Notification delivery:assigned error:', sockErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'Delivery accepted successfully!',
      delivery: updatedDelivery,
      deliveryBoy: deliveryBoyData,
    });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/delivery/my-deliveries
// @desc    Get deliveries assigned to logged-in delivery boy
// @access  Private/Delivery_Boy
export const getMyDeliveries = async (req, res, next) => {
  try {
    const deliveries = await Delivery.find({ deliveryBoy: req.user._id })
      .populate({
        path: 'order',
        populate: [
          { path: 'shop', select: 'name address phone logo' },
          { path: 'user', select: 'name phone email' },
          { path: 'address' },
        ],
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: deliveries.length,
      deliveries,
    });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/delivery/:id
// @desc    Get single delivery detail assigned to logged-in delivery boy
// @access  Private/Delivery_Boy
export const getDeliveryById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid delivery ID format' });
    }

    const delivery = await Delivery.findOne({ _id: id, deliveryBoy: req.user._id }).populate({
      path: 'order',
      populate: [
        { path: 'shop', select: 'name address phone logo' },
        { path: 'user', select: 'name phone email' },
        { path: 'address' },
      ],
    });

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found or not assigned to you',
      });
    }

    res.status(200).json({
      success: true,
      delivery,
    });
  } catch (error) {
    next(error);
  }
};

// @route   PATCH /api/delivery/:id/status
// @desc    Update status of assigned delivery
// @access  Private/Delivery_Boy
export const updateDeliveryStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid delivery ID format' });
    }

    const delivery = await Delivery.findOne({ _id: id, deliveryBoy: req.user._id });
    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found or not assigned to you',
      });
    }

    const allowedNextStates = VALID_TRANSITIONS[delivery.status] || [];
    if (!allowedNextStates.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${delivery.status} to ${status}. Allowed transitions: ${allowedNextStates.join(', ')}`,
      });
    }

    delivery.status = status;
    const now = new Date();

    if (status === 'ACCEPTED') delivery.acceptedAt = now;
    else if (status === 'PICKED_UP') delivery.pickedUpAt = now;
    else if (status === 'DELIVERED') delivery.deliveredAt = now;

    await delivery.save();

    // Also update order status & dispatch notifications if linked
    if (delivery.order) {
      const order = await Order.findById(delivery.order);
      if (order) {
        if (status === 'PICKED_UP') order.orderStatus = 'PICKED_UP';
        else if (status === 'DELIVERED') {
          order.orderStatus = 'DELIVERED';

          // Automatic COD payment status update: COD payment collected at delivery
          if (order.paymentMethod === 'COD' && order.paymentStatus !== 'PAID') {
            order.paymentStatus = 'PAID';
            try {
              const Payment = (await import('../models/Payment.js')).default;
              await Payment.findOneAndUpdate(
                { order: order._id },
                { status: 'SUCCESS', paidAt: now }
              );
            } catch (payErr) {
              console.warn('Payment document update notice:', payErr.message);
            }
          }
        }
        await order.save();

        // Broadcast real-time status update to delivery room & user rooms via Socket.IO
        try {
          const { getIO } = await import('../config/socket.js');
          const { sendPushToUser } = await import('../services/pushNotificationService.js');
          const io = getIO();

          const updatePayload = {
            orderId: order._id,
            orderNumber: order.orderNumber,
            deliveryStatus: delivery.status,
            orderStatus: order.orderStatus,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            shopId: order.shop,
            timestamp: now,
          };

          io.to(`delivery:${order._id}`).emit('delivery:status:update', updatePayload);
          io.to(`user:${order.user.toString()}`).emit('order:updated', updatePayload);

          const shopDoc = await mongoose.model('Shop').findById(order.shop).select('owner');
          if (shopDoc && shopDoc.owner) {
            io.to(`user:${shopDoc.owner.toString()}`).emit('order:updated', updatePayload);
          }

          // FCM Push to Student
          sendPushToUser(order.user, {
            title: `Delivery Status: ${delivery.status.replace(/_/g, ' ')}`,
            body: `Order ${order.orderNumber} is now ${delivery.status.replace(/_/g, ' ')}.`,
            orderId: order._id,
            type: 'DELIVERY',
            url: `/orders/${order._id}`,
          }).catch((err) => console.warn('Delivery status FCM notice:', err.message));
        } catch (sockErr) {
          console.warn('Socket broadcast notice:', sockErr.message);
        }

        // Create Notifications for Student & Shopkeeper and emit real-time socket events
        try {
          const shop = await mongoose.model('Shop').findById(order.shop);
          const { getIO } = await import('../config/socket.js');
          const io = getIO();

          const emitNotif = (notifDoc) => {
            if (!notifDoc) return;
            io.to(`user:${notifDoc.user.toString()}`).emit('notification:new', {
              _id: notifDoc._id,
              title: notifDoc.title,
              message: notifDoc.message,
              type: notifDoc.type,
              relatedOrder: notifDoc.relatedOrder,
              isRead: notifDoc.isRead,
              createdAt: notifDoc.createdAt,
            });
          };

          if (status === 'ARRIVED_AT_SHOP') {
            const sNotif = await Notification.create({
              user: order.user,
              title: 'Delivery Partner Arrived',
              message: `Your delivery partner has arrived at the shop for order ${order.orderNumber}.`,
              type: 'DELIVERY',
              relatedOrder: order._id,
              isRead: false,
            });
            emitNotif(sNotif);

            if (shop && shop.owner) {
              const kNotif = await Notification.create({
                user: shop.owner,
                title: 'Delivery Partner Arrived',
                message: `Delivery partner has arrived to collect order ${order.orderNumber}.`,
                type: 'DELIVERY',
                relatedOrder: order._id,
                isRead: false,
              });
              emitNotif(kNotif);
            }
          } else if (status === 'PICKED_UP') {
            const sNotif = await Notification.create({
              user: order.user,
              title: 'Order Picked Up',
              message: `Your order ${order.orderNumber} has been picked up from the shop.`,
              type: 'DELIVERY',
              relatedOrder: order._id,
              isRead: false,
            });
            emitNotif(sNotif);

            if (shop && shop.owner) {
              const kNotif = await Notification.create({
                user: shop.owner,
                title: 'Order Picked Up',
                message: `Order ${order.orderNumber} has been picked up by the delivery partner.`,
                type: 'DELIVERY',
                relatedOrder: order._id,
                isRead: false,
              });
              emitNotif(kNotif);
            }
          } else if (status === 'OUT_FOR_DELIVERY') {
            const sNotif = await Notification.create({
              user: order.user,
              title: 'Order Out for Delivery',
              message: `Your order ${order.orderNumber} is now out for delivery.`,
              type: 'DELIVERY',
              relatedOrder: order._id,
              isRead: false,
            });
            emitNotif(sNotif);
          } else if (status === 'DELIVERED') {
            const sNotif = await Notification.create({
              user: order.user,
              title: 'Order Delivered',
              message: `Your order ${order.orderNumber} has been delivered successfully.`,
              type: 'DELIVERY',
              relatedOrder: order._id,
              isRead: false,
            });
            emitNotif(sNotif);

            if (shop && shop.owner) {
              const kNotif = await Notification.create({
                user: shop.owner,
                title: 'Order Delivered',
                message: `Order ${order.orderNumber} has been delivered.`,
                type: 'DELIVERY',
                relatedOrder: order._id,
                isRead: false,
              });
              emitNotif(kNotif);
            }
          }
        } catch (notifErr) {
          console.warn('Delivery status update notification notice:', notifErr.message);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Delivery status updated to ${status}`,
      delivery,
    });
  } catch (error) {
    next(error);
  }
};

