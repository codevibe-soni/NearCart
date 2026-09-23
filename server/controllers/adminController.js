import mongoose from 'mongoose';
import User from '../models/User.js';

// @route   GET /api/admin/users
// @desc    Get all users list for admin user management
// @access  Private/Admin
export const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/admin/shops
// @desc    Get all shops list for Admin management
// @access  Private/Admin
export const getAllShops = async (req, res, next) => {
  try {
    const Shop = (await import('../models/Shop.js')).default;
    const Product = (await import('../models/Product.js')).default;

    const shops = await Shop.find()
      .populate('owner', 'name email phone')
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const shopIds = shops.map((s) => s._id);
    const productCounts = await Product.aggregate([
      { $match: { shop: { $in: shopIds } } },
      { $group: { _id: '$shop', count: { $sum: 1 } } },
    ]);

    const countMap = {};
    productCounts.forEach((p) => {
      countMap[p._id.toString()] = p.count;
    });

    const enrichedShops = shops.map((s) => ({
      ...s,
      productCount: countMap[s._id.toString()] || 0,
    }));

    res.status(200).json({
      success: true,
      count: enrichedShops.length,
      shops: enrichedShops,
    });
  } catch (error) {
    next(error);
  }
};

// @route   PATCH /api/admin/shops/:id/status
// @desc    Block or Unblock a Shop (toggle isActive)
// @access  Private/Admin
export const updateShopStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const Shop = (await import('../models/Shop.js')).default;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid shop ID format' });
    }

    if (isActive === undefined || typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive boolean property is required.',
      });
    }

    const shop = await Shop.findById(id);
    if (!shop) {
      return res.status(404).json({ success: false, message: 'Shop not found' });
    }

    shop.isActive = isActive;
    await shop.save();

    res.status(200).json({
      success: true,
      message: `Shop "${shop.name}" has been ${isActive ? 'unblocked/activated' : 'blocked/deactivated'}.`,
      shop,
    });
  } catch (error) {
    next(error);
  }
};

// @route   DELETE /api/admin/shops/:id
// @desc    Permanently delete a Shop and cascade-delete all its products, coupons, and reviews
// @access  Private/Admin
export const deleteShopAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;
    const Shop = (await import('../models/Shop.js')).default;
    const Product = (await import('../models/Product.js')).default;
    const Coupon = (await import('../models/Coupon.js')).default;
    const Review = (await import('../models/Review.js')).default;
    const Cart = (await import('../models/Cart.js')).default;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid shop ID format' });
    }

    const shop = await Shop.findById(id);
    if (!shop) {
      return res.status(404).json({ success: false, message: 'Shop not found' });
    }

    // 1. Find all product IDs belonging exclusively to this shop
    const products = await Product.find({ shop: id }).select('_id');
    const productIds = products.map((p) => p._id);

    // 2. Cascade delete products belonging to this shop
    const productDelRes = await Product.deleteMany({ shop: id });

    // 3. Cascade delete coupons belonging to this shop
    const couponDelRes = await Coupon.deleteMany({ shop: id });

    // 4. Cascade delete reviews for this shop and its products
    const reviewDelRes = await Review.deleteMany({
      $or: [
        { shop: id },
        { product: { $in: productIds } },
      ],
    });

    // 5. Clean up items from user carts referencing deleted products
    if (productIds.length > 0) {
      await Cart.updateMany(
        {},
        { $pull: { items: { product: { $in: productIds } } } }
      );
    }

    // 6. Delete the Shop document permanently
    await Shop.findByIdAndDelete(id);

    console.log(`[ADMIN AUDIT] Admin ${req.user._id} deleted shop "${shop.name}" (${id}). Deleted ${productDelRes.deletedCount} products, ${couponDelRes.deletedCount} coupons, ${reviewDelRes.deletedCount} reviews.`);

    res.status(200).json({
      success: true,
      message: `Shop "${shop.name}" and all ${productDelRes.deletedCount} associated products were deleted permanently.`,
      deletedSummary: {
        shopId: id,
        productsDeleted: productDelRes.deletedCount || 0,
        couponsDeleted: couponDelRes.deletedCount || 0,
        reviewsDeleted: reviewDelRes.deletedCount || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/admin/staff
// @desc    Get list of staff members (SHOPKEEPER & DELIVERY_BOY)
// @access  Private/Admin
export const getStaffMembers = async (req, res, next) => {
  try {
    const staff = await User.find({
      role: { $in: ['SHOPKEEPER', 'DELIVERY_BOY'] },
    })
      .select('-password')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: staff.length,
      staff,
    });
  } catch (error) {
    next(error);
  }
};

// @route   PATCH /api/admin/users/:id/status
// @desc    Block or Unblock a user (toggle isActive)
// @access  Private/Admin
export const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID format' });
    }

    if (isActive === undefined || typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive boolean property is required in request body.',
      });
    }

    // Do not allow admin to block themselves
    if (id === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Administrators cannot block their own account.',
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Do not allow blocking of other ADMIN users
    if (user.role === 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Cannot modify status of an Administrator account.',
      });
    }

    user.isActive = isActive;
    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${user.name} (${user.role}) has been ${isActive ? 'unblocked' : 'blocked'}.`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @route   DELETE /api/admin/users/:id
// @desc    Permanently delete a user (admin only)
// @access  Private/Admin
export const deleteUserAdmin = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID format' });
    }

    // Prevent admin from deleting themselves
    if (id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Administrators cannot delete their own account.' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Prevent deleting other ADMIN accounts
    if (user.role === 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Cannot delete an Administrator account.' });
    }

    await User.findByIdAndDelete(id);
    console.log(`[ADMIN AUDIT] Admin ${req.user._id} deleted user ${user.email} (${id}).`);
    return res.status(200).json({
      success: true,
      message: `User ${user.name} (${user.role}) has been permanently deleted.`,
    });
  } catch (error) {
    next(error);
  }
};
/**
 * @desc    Preview estimated document counts for cleanup targets
 * @route   POST /api/admin/clean-data/preview
 * @access  Private/Admin
 */
export const previewCleanData = async (req, res, next) => {
  try {
    const { targets = [] } = req.body;

    const targetList = Array.isArray(targets) ? targets : [];

    const counts = {
      orders: targetList.includes('orders') ? await mongoose.model('Order').countDocuments() : 0,
      deliveries: targetList.includes('deliveries') ? await mongoose.model('Delivery').countDocuments() : 0,
      reviews: targetList.includes('reviews') ? await mongoose.model('Review').countDocuments() : 0,
      notifications: targetList.includes('notifications') ? await mongoose.model('Notification').countDocuments() : 0,
      carts: targetList.includes('carts') ? await mongoose.model('Cart').countDocuments() : 0,
      testUsers: targetList.includes('testUsers') ? await User.countDocuments({ role: 'STUDENT' }) : 0,
    };

    return res.status(200).json({
      success: true,
      counts,
      message: 'Preview document counts calculated successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Execute safe allowlist PRE-LAUNCH app data cleanup
 * @route   POST /api/admin/clean-data
 * @access  Private/Admin
 */
export const executeCleanData = async (req, res, next) => {
  try {
    const { targets = [], confirmation, adminEmail, password } = req.body;

    // ── STEP 1: Validate admin email is provided ──
    if (!adminEmail || typeof adminEmail !== 'string' || !adminEmail.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Admin email and password are required.',
      });
    }

    // ── STEP 2: Validate password is provided ──
    if (!password || typeof password !== 'string' || !password.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Admin email and password are required.',
      });
    }

    // ── STEP 3: Find user by supplied email ──
    const adminUser = await User.findOne({ email: adminEmail.trim().toLowerCase() }).select('+password');
    if (!adminUser) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin email or password.',
      });
    }

    // ── STEP 4: Verify user has ADMIN role ──
    if (adminUser.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Invalid admin email or password.',
      });
    }

    // ── STEP 5: Verify admin account is active ──
    if (!adminUser.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This admin account has been deactivated.',
      });
    }

    // ── STEP 6: Verify password using existing bcrypt comparePassword ──
    const isPasswordValid = await adminUser.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin email or password.',
      });
    }

    // ── STEP 7: Validate "CLEAN NEARCART" confirmation phrase ──
    if (confirmation !== 'CLEAN NEARCART') {
      return res.status(400).json({
        success: false,
        message: 'Invalid confirmation string. You must type "CLEAN NEARCART" to confirm cleanup.',
      });
    }

    // ── STEP 8: Validate targets array ──
    const validTargetKeys = ['orders', 'deliveries', 'reviews', 'notifications', 'carts', 'testUsers'];
    const selectedTargets = (Array.isArray(targets) ? targets : []).filter((t) =>
      validTargetKeys.includes(t)
    );

    if (selectedTargets.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid cleanup targets selected.',
      });
    }

    // ── STEP 9: All checks passed — proceed with cleanup ──
    const Order = mongoose.model('Order');
    const Delivery = mongoose.model('Delivery');
    const Review = mongoose.model('Review');
    const Notification = mongoose.model('Notification');
    const Cart = mongoose.model('Cart');
    const Payment = mongoose.model('Payment');
    const Address = mongoose.model('Address');
    const Product = mongoose.model('Product');
    const Shop = mongoose.model('Shop');

    const deletedSummary = {
      orders: 0,
      deliveries: 0,
      reviews: 0,
      notifications: 0,
      carts: 0,
      testUsers: 0,
      payments: 0,
    };

    // A. ORDERS
    if (selectedTargets.includes('orders')) {
      const orders = await Order.find().select('_id');
      const orderIds = orders.map((o) => o._id);

      if (orderIds.length > 0) {
        const payRes = await Payment.deleteMany({ order: { $in: orderIds } });
        deletedSummary.payments = payRes.deletedCount || 0;

        const delRes = await Delivery.deleteMany({ order: { $in: orderIds } });
        deletedSummary.deliveries += delRes.deletedCount || 0;

        const revRes = await Review.deleteMany({ order: { $in: orderIds } });
        deletedSummary.reviews += revRes.deletedCount || 0;

        const notifRes = await Notification.deleteMany({ relatedOrder: { $in: orderIds } });
        deletedSummary.notifications += notifRes.deletedCount || 0;

        const ordRes = await Order.deleteMany({ _id: { $in: orderIds } });
        deletedSummary.orders = ordRes.deletedCount || 0;
      }
    }

    // B. DELIVERIES (if selected standalone)
    if (selectedTargets.includes('deliveries') && !selectedTargets.includes('orders')) {
      const delRes = await Delivery.deleteMany({});
      deletedSummary.deliveries += delRes.deletedCount || 0;
    }

    // C. REVIEWS (and rating recalculations / resets)
    if (selectedTargets.includes('reviews')) {
      const revRes = await Review.deleteMany({});
      deletedSummary.reviews += revRes.deletedCount || 0;

      // Reset rating aggregates on Master Collections to 0
      await Product.updateMany({}, { rating: 0, totalRatings: 0 });
      await Shop.updateMany({}, { rating: 0, totalRatings: 0 });
      await User.updateMany({ role: 'DELIVERY_BOY' }, { rating: 0, totalRatings: 0 });
    }

    // D. NOTIFICATIONS
    if (selectedTargets.includes('notifications')) {
      const notifRes = await Notification.deleteMany({});
      deletedSummary.notifications += notifRes.deletedCount || 0;
    }

    // E. CARTS
    if (selectedTargets.includes('carts')) {
      const cartRes = await Cart.deleteMany({});
      deletedSummary.carts += cartRes.deletedCount || 0;
    }

    // F. TEST / STUDENT USERS
    if (selectedTargets.includes('testUsers')) {
      // Find all STUDENT users (Excludes ADMIN, SHOPKEEPER, DELIVERY_BOY)
      const students = await User.find({ role: 'STUDENT' }).select('_id');
      const studentIds = students.map((s) => s._id);

      if (studentIds.length > 0) {
        await Address.deleteMany({ user: { $in: studentIds } });
        await Cart.deleteMany({ user: { $in: studentIds } });
        const userRes = await User.deleteMany({ role: 'STUDENT' });
        deletedSummary.testUsers = userRes.deletedCount || 0;
      }
    }

    // Audit Logging (Safe server log — no credentials logged)
    console.log(`[AUDIT CLEANUP] Admin ${adminUser._id} (${adminUser.email}) performed pre-launch data cleanup.`);
    console.log(`[AUDIT CLEANUP] Targets: ${selectedTargets.join(', ')} | Summary:`, deletedSummary);

    return res.status(200).json({
      success: true,
      message: 'NearCart pre-launch cleanup completed successfully.',
      deletedCounts: deletedSummary,
      preserved: [
        'Admin accounts',
        'Shopkeeper accounts',
        'Delivery Boy accounts',
        'Shops & Master Settings',
        'Products & Images',
        'Categories',
        'App Configuration',
      ],
    });
  } catch (error) {
    next(error);
  }
};

