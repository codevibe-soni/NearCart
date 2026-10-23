import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import Order from '../models/Order.js';
import Notification from '../models/Notification.js';
import Delivery from '../models/Delivery.js';

/**
 * @desc    Get shop-specific UPI QR details for a Student's specific Order
 * @route   GET /api/payments/qr/:orderId
 * @access  Private (Student)
 */
export const getOrderPaymentQr = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: 'Invalid order ID format' });
    }

    const order = await Order.findById(orderId).populate('shop', 'name upiEnabled upiId upiQrImage logo owner');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Security check: Student can ONLY view payment QR for their own order
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to order payment QR' });
    }

    const shop = order.shop || {};
    // Use snapshot if available, otherwise shop's current QR
    const qrImage = order.upiQrSnapshot?.imageUrl || shop.upiQrImage || '';
    const upiId = order.upiQrSnapshot?.upiId || shop.upiId || '';

    // Build UPI intent URI with server-calculated amount (security: never from request body)
    let upiPaymentUri = '';
    const amount = order.totalAmount;
    const formattedAmount = (typeof amount === 'number' && amount > 0)
      ? amount.toFixed(2)
      : '';

    if (upiId && formattedAmount) {
      const shopName = shop.name || 'Campus Shop';
      const txnNote = `NearCart Order ${order.orderNumber}`;
      const safeUpiId = encodeURIComponent(upiId.trim()).replace(/%40/g, '@');
      const safeShopName = encodeURIComponent(shopName);
      const safeTxnNote = encodeURIComponent(txnNote);
      upiPaymentUri = `upi://pay?pa=${safeUpiId}&pn=${safeShopName}&am=${formattedAmount}&cu=INR&tn=${safeTxnNote}`;
    }

    return res.status(200).json({
      success: true,
      orderId: order._id,
      shopName: shop.name || 'Campus Shop',
      totalAmount: order.totalAmount,
      formattedAmount,
      upiEnabled: shop.upiEnabled !== false,
      upiId,
      upiQrImage: qrImage,
      upiPaymentUri,
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Student confirms UPI payment ("I Have Paid")
 * @route   POST /api/payments/upi/confirm
 * @access  Private (Student)
 */
export const confirmUpiPayment = async (req, res, next) => {
  try {
    const { orderId, transactionId } = req.body;

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: 'Valid Order ID is required' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Security check: Student can only confirm their own order
    if (order.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized payment confirmation attempt' });
    }

    if (order.paymentStatus === 'PAID') {
      return res.status(400).json({ success: false, message: 'Order is already marked as PAID' });
    }

    const now = new Date();

    // Prevent duplicate confirmation if already USER_CONFIRMED
    if (order.paymentStatus === 'USER_CONFIRMED') {
      return res.status(200).json({
        success: true,
        message: 'Payment confirmation already submitted. Waiting for shopkeeper verification.',
        order,
      });
    }

    order.paymentStatus = 'USER_CONFIRMED';
    await order.save();

    let payment = await Payment.findOne({ order: order._id });
    if (!payment) {
      payment = new Payment({
        order: order._id,
        user: req.user._id,
        amount: order.totalAmount,
        method: 'UPI',
      });
    }

    payment.status = 'USER_CONFIRMED';
    payment.method = 'UPI';
    payment.transactionId = transactionId || payment.transactionId || `UPI_TXN_${Date.now()}`;
    payment.studentConfirmedAt = now;
    await payment.save();

    // Create Notification for Shopkeeper
    try {
      const shop = await mongoose.model('Shop').findById(order.shop);
      if (shop && shop.owner) {
        await Notification.create({
          user: shop.owner,
          title: 'UPI Payment Claimed',
          message: `Student marked payment as completed for Order ${order.orderNumber}. Please verify.`,
          type: 'ORDER',
          relatedOrder: order._id,
          isRead: false,
        });
      }

      // Socket.IO event emission
      const { getIO } = await import('../config/socket.js');
      const io = getIO();
      io.to(`delivery:${order._id}`).emit('payment:user_confirmed', {
        orderId: order._id,
        paymentStatus: 'USER_CONFIRMED',
      });
    } catch (notifErr) {
      console.warn('UPI confirmation notification notice:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Payment confirmation submitted successfully. Waiting for shopkeeper verification.',
      order,
      payment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Shopkeeper verifies UPI payment ("Verify Payment")
 * @route   PATCH /api/shopkeeper/orders/:orderId/verify-payment
 * @access  Private (Shopkeeper)
 */
export const verifyShopkeeperUpiPayment = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: 'Valid Order ID is required' });
    }

    const order = await Order.findById(orderId).populate('shop');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Security check: Only owner of order's shop can verify payment
    if (order.shop.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized verification attempt for another shop order' });
    }

    if (order.paymentStatus === 'PAID') {
      return res.status(200).json({
        success: true,
        message: 'Payment already verified and marked as PAID.',
        order,
      });
    }

    const now = new Date();
    order.paymentStatus = 'PAID';
    await order.save();

    let payment = await Payment.findOne({ order: order._id });
    if (!payment) {
      payment = new Payment({
        order: order._id,
        user: order.user,
        amount: order.totalAmount,
        method: 'UPI',
      });
    }

    payment.status = 'SUCCESS';
    payment.verifiedAt = now;
    payment.paidAt = now;
    payment.verifiedBy = req.user._id;
    await payment.save();

    // Create Notification for Student
    try {
      await Notification.create({
        user: order.user,
        title: 'UPI Payment Verified',
        message: `Your UPI payment for Order ${order.orderNumber} has been verified by the shopkeeper!`,
        type: 'ORDER',
        relatedOrder: order._id,
        isRead: false,
      });

      const { getIO } = await import('../config/socket.js');
      const io = getIO();
      io.to(`delivery:${order._id}`).emit('payment:verified', {
        orderId: order._id,
        paymentStatus: 'PAID',
      });
    } catch (notifErr) {
      console.warn('UPI verification notification notice:', notifErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'UPI Payment verified successfully!',
      order,
      payment,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Shopkeeper marks payment as NOT received ("Payment Not Received")
 * @route   PATCH /api/shopkeeper/orders/:orderId/reject-payment
 * @access  Private (Shopkeeper)
 */
export const rejectShopkeeperUpiPayment = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: 'Valid Order ID is required' });
    }

    const order = await Order.findById(orderId).populate('shop');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.shop.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized action for another shop order' });
    }

    order.paymentStatus = 'FAILED';
    await order.save();

    let payment = await Payment.findOne({ order: order._id });
    if (payment) {
      payment.status = 'FAILED';
      await payment.save();
    }

    try {
      await Notification.create({
        user: order.user,
        title: 'Payment Verification Unsuccessful',
        message: `Payment for Order ${order.orderNumber} could not be verified by the shopkeeper. Please contact shopkeeper.`,
        type: 'ORDER',
        relatedOrder: order._id,
        isRead: false,
      });
    } catch (nErr) {
      console.warn('Payment reject notification notice:', nErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Payment set to unverified / failed.',
      order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generate & stream official PDF Payment Receipt
 * @route   GET /api/orders/:orderId/receipt
 * @access  Private (Student / Shopkeeper / Admin)
 */
export const generateReceiptPdf = async (req, res, next) => {
  try {
    const { orderId } = req.params;

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: 'Valid Order ID is required' });
    }

    const order = await Order.findById(orderId)
      .populate('user', 'name email phone')
      .populate('shop', 'name phone address owner')
      .populate('address');

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Authorization check: Student owner, Shop owner, Assigned Delivery partner, or Admin
    const orderUserId = order.user && order.user._id ? order.user._id.toString() : order.user?.toString();
    const isStudentOwner = req.user.role === 'STUDENT' && orderUserId === req.user._id.toString();

    const shopOwnerId = order.shop && order.shop.owner
      ? (order.shop.owner._id ? order.shop.owner._id.toString() : order.shop.owner.toString())
      : null;
    const isShopOwner = req.user.role === 'SHOPKEEPER' && shopOwnerId === req.user._id.toString();
    const isAdmin = req.user.role === 'ADMIN';

    let isAssignedDelivery = false;
    if (req.user.role === 'DELIVERY_BOY') {
      const deliveryRecord = await Delivery.findOne({ order: order._id, deliveryBoy: req.user._id });
      if (deliveryRecord) isAssignedDelivery = true;
    }

    if (!isStudentOwner && !isShopOwner && !isAdmin && !isAssignedDelivery) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to order receipt' });
    }

    const payment = await Payment.findOne({ order: order._id });

    // Dynamic import PDFDocument safely
    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });

    // Sanitize filename to NearCart-Receipt-{orderNumber}.pdf
    const safeOrderNumber = (order.orderNumber || order._id.toString()).replace(/[^a-zA-Z0-9-_]/g, '');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="NearCart-Receipt-${safeOrderNumber}.pdf"`);

    doc.pipe(res);

    // --- Header Section ---
    doc.fillColor('#0284c7').fontSize(22).font('Helvetica-Bold').text('NearCart', 40, 40);
    doc.fillColor('#64748b').fontSize(9).font('Helvetica').text('Campus Hyperlocal Marketplace', 40, 66);
    doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text('OFFICIAL ORDER RECEIPT', 300, 40, { align: 'right' });
    doc.fontSize(9).font('Helvetica').fillColor('#64748b').text(`Receipt No: ${order.orderNumber || order._id}`, 300, 58, { align: 'right' });
    doc.text(`Order Date: ${new Date(order.createdAt).toLocaleString('en-IN')}`, 300, 70, { align: 'right' });

    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, 88).lineTo(555, 88).stroke();

    // --- Customer & Shop Metadata ---
    doc.y = 98;
    const metaTopY = doc.y;

    // Customer Box (Left Column, x=40, width=240)
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#0284c7').text('CUSTOMER DETAILS', 40, metaTopY);
    doc.font('Helvetica').fontSize(9).fillColor('#0f172a');
    doc.text(`Name: ${order.user?.name || 'Student Customer'}`, 40, doc.y + 3);
    doc.text(`Phone: ${order.customerPhone || order.user?.phone || 'N/A'}`);
    if (order.user?.email) {
      doc.text(`Email: ${order.user.email}`);
    }

    // Address formatting
    const addressParts = [];
    if (order.address?.roomNumber) addressParts.push(`Room: ${order.address.roomNumber}`);
    if (order.address?.hostelName) addressParts.push(order.address.hostelName);
    if (order.address?.fullAddress) addressParts.push(order.address.fullAddress);
    if (order.address?.landmark) addressParts.push(`Near ${order.address.landmark}`);
    const fullAddr = addressParts.length > 0 ? addressParts.join(', ') : (order.address?.fullAddress || 'Campus Delivery Address');
    doc.text(`Delivery Address: ${fullAddr}`, 40, doc.y, { width: 240 });
    const customerBottomY = doc.y;

    // Shop Box (Right Column, x=310, width=245)
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#0284c7').text('SHOP DETAILS', 310, metaTopY);
    doc.font('Helvetica').fontSize(9).fillColor('#0f172a');
    doc.text(`Shop Name: ${order.shop?.name || 'Campus Partner Shop'}`, 310, doc.y + 3);
    doc.text(`Shop Phone: ${order.shop?.phone || 'N/A'}`, 310);
    doc.text(`Shop Address: ${order.shop?.address || 'Campus Location'}`, 310, doc.y, { width: 245 });
    const shopBottomY = doc.y;

    doc.y = Math.max(customerBottomY, shopBottomY) + 12;

    // --- Order & Payment Status Badge Box ---
    const statusBoxY = doc.y;
    doc.rect(40, statusBoxY, 515, 26).fill('#f8fafc');
    doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(40, statusBoxY, 515, 26).stroke();

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#475569');
    doc.text(`Order Status: `, 48, statusBoxY + 8, { continued: true });
    doc.font('Helvetica').fillColor('#0f172a').text(`${order.orderStatus || 'PLACED'}`, { continued: true });

    doc.font('Helvetica-Bold').fillColor('#475569').text(`   |   Payment Method: `, { continued: true });
    doc.font('Helvetica').fillColor('#0f172a').text(`${order.paymentMethod || 'COD'}`, { continued: true });

    doc.font('Helvetica-Bold').fillColor('#475569').text(`   |   Payment Status: `, { continued: true });
    const isPaid = order.paymentStatus === 'PAID';
    const statusColor = isPaid ? '#10b981' : order.paymentStatus === 'FAILED' ? '#ef4444' : '#d97706';
    doc.font('Helvetica-Bold').fillColor(statusColor).text(`${order.paymentStatus || 'PENDING'}`);

    doc.y = statusBoxY + 36;

    // --- Item Details Table ---
    const drawTableHeader = () => {
      const headerY = doc.y;
      doc.rect(40, headerY, 515, 20).fill('#0284c7');
      doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
      doc.text('Item Description', 48, headerY + 5, { width: 235 });
      doc.text('Qty', 290, headerY + 5, { width: 45, align: 'center' });
      doc.text('Unit Price', 340, headerY + 5, { width: 85, align: 'right' });
      doc.text('Subtotal', 435, headerY + 5, { width: 110, align: 'right' });
      doc.y = headerY + 22;
    };

    drawTableHeader();

    const items = order.items && order.items.length > 0 ? order.items : [];
    items.forEach((item, index) => {
      const itemDesc = item.name || 'Product Item';
      const itemHeight = Math.max(doc.heightOfString(itemDesc, { width: 235 }), 16);

      // Page break check if row exceeds printable height
      if (doc.y + itemHeight > 710) {
        doc.addPage();
        drawTableHeader();
      }

      const rowY = doc.y;
      if (index % 2 === 1) {
        doc.rect(40, rowY, 515, itemHeight + 4).fill('#f8fafc');
      }

      doc.fillColor('#0f172a').fontSize(9).font('Helvetica');
      doc.text(itemDesc, 48, rowY + 2, { width: 235 });
      doc.text(String(item.quantity || 1), 290, rowY + 2, { width: 45, align: 'center' });
      doc.text(`INR ${Number(item.price || 0).toFixed(2)}`, 340, rowY + 2, { width: 85, align: 'right' });
      doc.text(`INR ${Number(item.subtotal || 0).toFixed(2)}`, 435, rowY + 2, { width: 110, align: 'right' });

      doc.y = rowY + itemHeight + 4;
    });

    doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.8);

    // --- Summary Totals Section ---
    if (doc.y + 130 > 730) {
      doc.addPage();
    }

    const subtotal = Number(order.subtotal || 0);
    const deliveryFee = Number(order.deliveryFee || 0);
    const packingCharges = Number(order.packingCharges || 0);
    const gstAmount = Number(order.gstAmount || 0);
    const discount = Number(order.discount || 0);
    const totalAmount = Number(order.totalAmount || 0);

    const summaryStartX = 320;
    const summaryValX = 450;
    const valWidth = 95;

    doc.fontSize(9).font('Helvetica').fillColor('#475569');

    // Subtotal
    doc.text('Items Subtotal:', summaryStartX, doc.y, { width: 125, align: 'right' });
    doc.fillColor('#0f172a').text(`INR ${subtotal.toFixed(2)}`, summaryValX, doc.y - 10, { width: valWidth, align: 'right' });

    // Delivery Fee
    doc.fillColor('#475569').text('Delivery Charges:', summaryStartX, doc.y + 3, { width: 125, align: 'right' });
    doc.fillColor('#0f172a').text(`INR ${deliveryFee.toFixed(2)}`, summaryValX, doc.y - 10, { width: valWidth, align: 'right' });

    // Packaging Charges (if applicable)
    if (packingCharges > 0) {
      doc.fillColor('#475569').text('Packaging Charges:', summaryStartX, doc.y + 3, { width: 125, align: 'right' });
      doc.fillColor('#0f172a').text(`INR ${packingCharges.toFixed(2)}`, summaryValX, doc.y - 10, { width: valWidth, align: 'right' });
    }

    // Taxes / GST (if applicable)
    if (gstAmount > 0) {
      doc.fillColor('#475569').text('GST / Taxes:', summaryStartX, doc.y + 3, { width: 125, align: 'right' });
      doc.fillColor('#0f172a').text(`INR ${gstAmount.toFixed(2)}`, summaryValX, doc.y - 10, { width: valWidth, align: 'right' });
    }

    // Discounts / Coupons (if applicable)
    if (discount > 0) {
      doc.fillColor('#475569').text('Discount Deducted:', summaryStartX, doc.y + 3, { width: 125, align: 'right' });
      doc.fillColor('#10b981').text(`-INR ${discount.toFixed(2)}`, summaryValX, doc.y - 10, { width: valWidth, align: 'right' });
    }

    doc.moveDown(0.6);

    // Total Amount Highlight Box
    const totalBoxY = doc.y;
    const boxColor = isPaid ? '#f0fdf4' : '#f8fafc';
    const borderColor = isPaid ? '#86efac' : '#cbd5e1';
    const textColor = isPaid ? '#15803d' : '#0369a1';

    doc.rect(summaryStartX - 10, totalBoxY, 245, 26).fill(boxColor);
    doc.strokeColor(borderColor).lineWidth(1).rect(summaryStartX - 10, totalBoxY, 245, 26).stroke();

    const totalLabel = isPaid ? 'TOTAL PAID:' : 'TOTAL PAYABLE:';
    doc.fontSize(11).font('Helvetica-Bold').fillColor(textColor);
    doc.text(totalLabel, summaryStartX, totalBoxY + 7, { width: 125, align: 'right' });
    doc.text(`INR ${totalAmount.toFixed(2)}`, summaryValX, totalBoxY + 7, { width: valWidth, align: 'right' });

    doc.y = totalBoxY + 36;

    // --- Payment Reference Details ---
    doc.fontSize(9).font('Helvetica').fillColor('#475569');
    if (payment?.transactionId) {
      doc.text(`Payment Reference / UTR: ${payment.transactionId}`);
    }
    if (order.upiQrSnapshot?.upiId) {
      doc.text(`Shop UPI ID: ${order.upiQrSnapshot.upiId}`);
    }
    if (payment?.verifiedAt) {
      doc.text(`Payment Verification Timestamp: ${new Date(payment.verifiedAt).toLocaleString('en-IN')}`);
    }

    doc.moveDown(1.5);
    doc.fontSize(8.5).fillColor('#64748b').text('Thank you for ordering with NearCart! Hyperlocal Campus Delivery.', { align: 'center' });
    doc.text('This is an official computer-generated receipt. No physical signature is required.', { align: 'center' });

    // --- Page Numbering on all buffered pages ---
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.font('Helvetica').fontSize(8).fillColor('#94a3b8').text(
        `Page ${i + 1} of ${range.count}  •  NearCart Official Receipt  •  Order #${order.orderNumber || order._id}`,
        40,
        doc.page.height - 30,
        { align: 'center', width: doc.page.width - 80, lineBreak: false }
      );
    }

    doc.end();
  } catch (error) {
    console.error('Error generating PDF receipt:', error);
    next(error);
  }
};

/**
 * @desc    Handle Razorpay Webhook Events securely using Raw Body HMAC
 * @route   POST /api/payments/webhook
 * @access  Public (Razorpay Webhook)
 */
export const handleRazorpayWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'dummy_razorpay_webhook_secret_2026';

    if (!signature) {
      return res.status(400).json({ success: false, message: 'Missing Razorpay webhook signature' });
    }

    // Verify raw body signature
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.warn('Webhook signature mismatch');
      return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = payload.payment ? payload.payment.entity : null;
      const razorpayOrderId = paymentEntity ? paymentEntity.order_id : null;
      const razorpayPaymentId = paymentEntity ? paymentEntity.id : null;

      if (razorpayOrderId) {
        const payment = await Payment.findOne({ providerOrderId: razorpayOrderId });
        if (payment && payment.status !== 'SUCCESS') {
          payment.status = 'SUCCESS';
          payment.providerPaymentId = razorpayPaymentId || payment.providerPaymentId;
          payment.paidAt = new Date();
          await payment.save();

          const order = await Order.findById(payment.order);
          if (order && order.paymentStatus !== 'PAID') {
            order.paymentStatus = 'PAID';
            await order.save();
          }
        }
      }
    } else if (event === 'payment.failed') {
      const paymentEntity = payload.payment ? payload.payment.entity : null;
      const razorpayOrderId = paymentEntity ? paymentEntity.order_id : null;

      if (razorpayOrderId) {
        const payment = await Payment.findOne({ providerOrderId: razorpayOrderId });
        if (payment && payment.status !== 'SUCCESS') {
          payment.status = 'FAILED';
          await payment.save();

          const order = await Order.findById(payment.order);
          if (order && order.paymentStatus !== 'PAID') {
            order.paymentStatus = 'FAILED';
            await order.save();
          }
        }
      }
    }

    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Error handling webhook:', error);
    return res.status(500).json({ success: false, message: 'Webhook processing error' });
  }
};

/**
 * @desc    Get payment visibility data for Admin / Student / Shopkeeper
 * @route   GET /api/payments
 * @access  Private
 */
export const getPayments = async (req, res, next) => {
  try {
    let filter = {};

    if (req.user.role === 'STUDENT') {
      filter.user = req.user._id;
    } else if (req.user.role === 'SHOPKEEPER') {
      const shopOrders = await Order.find({ shop: req.user.shopId }).select('_id');
      const orderIds = shopOrders.map((o) => o._id);
      filter.order = { $in: orderIds };
    }
    // Admin gets all payments (filter = {})

    const payments = await Payment.find(filter)
      .populate('order', 'orderNumber orderStatus paymentStatus paymentMethod totalAmount createdAt')
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 });

    // Aggregate statistics for Admin if role is ADMIN
    let stats = null;
    if (req.user.role === 'ADMIN') {
      const totalCount = payments.length;
      const successCount = payments.filter((p) => p.status === 'SUCCESS').length;
      const failedCount = payments.filter((p) => p.status === 'FAILED').length;
      const pendingCount = payments.filter((p) => p.status === 'PENDING' || p.status === 'CREATED').length;
      const codCount = payments.filter((p) => p.method === 'COD').length;
      const onlineCount = payments.filter((p) => p.method === 'RAZORPAY').length;
      const totalRevenue = payments
        .filter((p) => p.status === 'SUCCESS' || (p.method === 'COD' && p.order?.paymentStatus === 'PAID'))
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      stats = {
        totalPayments: totalCount,
        successfulPayments: successCount,
        failedPayments: failedCount,
        pendingPayments: pendingCount,
        codPayments: codCount,
        onlinePayments: onlineCount,
        totalRevenue,
      };
    }

    return res.status(200).json({
      success: true,
      stats,
      data: payments,
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
      error: error.message,
    });
  }
};
