import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { sendPushToTokens, getFirebaseAdminStatus } from '../services/pushNotificationService.js';
import mongoose from 'mongoose';

/**
 * @desc    Get notifications for authenticated user
 * @route   GET /api/notifications
 * @access  Private
 */
export const getUserNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({
      success: true,
      count: notifications.length,
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get unread notification count for authenticated user
 * @route   GET /api/notifications/unread-count
 * @access  Private
 */
export const getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({
      user: req.user._id,
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      count,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark a single notification as read
 * @route   PATCH /api/notifications/:id/read
 * @access  Private
 */
export const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification ID format',
      });
    }

    const notification = await Notification.findOne({
      _id: id,
      user: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or access denied',
      });
    }

    notification.isRead = true;
    await notification.save();

    return res.status(200).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Mark all notifications as read for authenticated user
 * @route   PATCH /api/notifications/read-all
 * @access  Private
 */
export const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { isRead: true }
    );

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
};



/**
 * @desc    Register or update FCM device token for authenticated user
 * @route   POST /api/notifications/device-token
 * @access  Private
 */
export const registerDeviceToken = async (req, res, next) => {
  try {
    const { token, platform = 'web' } = req.body;

    if (!token || typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Valid FCM device token is required',
      });
    }

    const trimmedToken = token.trim();
    const truncatedToken = `${trimmedToken.substring(0, 12)}...${trimmedToken.substring(trimmedToken.length - 6)}`;

    console.log(`[FCM TEST] authenticated user: ${req.user._id} (${req.user.email})`);
    console.log(`[FCM TEST] token registration: ${truncatedToken}`);

    // Remove this token from any other user account
    await User.updateMany(
      {
        _id: { $ne: req.user._id },
        'pushTokens.token': trimmedToken,
      },
      {
        $pull: {
          pushTokens: { token: trimmedToken },
        },
      }
    );

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!user.pushTokens) {
      user.pushTokens = [];
    }

    const existingTokenIndex = user.pushTokens.findIndex(
      (t) => t.token === trimmedToken
    );

    if (existingTokenIndex >= 0) {
      user.pushTokens[existingTokenIndex].updatedAt = new Date();
      user.pushTokens[existingTokenIndex].isActive = true;
      user.pushTokens[existingTokenIndex].platform = platform;
    } else {
      user.pushTokens.push({
        token: trimmedToken,
        platform,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true,
      });
    }

    await user.save();

    console.log(`[FCM TEST] stored token count: ${user.pushTokens.filter((t) => t.isActive !== false).length}`);

    return res.status(200).json({
      success: true,
      message: 'Device token registered successfully',
    });
  } catch (error) {
    next(error);
  }
};





/**
 * @desc    Deactivate/remove FCM device token for authenticated user
 * @route   DELETE /api/notifications/device-token
 * @access  Private
 */
export const removeDeviceToken = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Device token is required',
      });
    }

    const trimmedToken = token.trim();

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { pushTokens: { token: trimmedToken } },
    });

    return res.status(200).json({
      success: true,
      message: 'Device token removed successfully',
    });
  } catch (error) {
    next(error);
  }
};


/**
 * @desc    Send a test FCM push notification to the logged-in user's active device tokens
 * @route   POST /api/notifications/test-push
 * @access  Private
 */
export const sendTestPushNotification = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('pushTokens');
    if (!user || !user.pushTokens || user.pushTokens.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No FCM device tokens registered for this user account. Allow notifications in CampusCart to register a token.',
        firebaseInitialized: getFirebaseAdminStatus(),
        tokensFound: 0,
        sentCount: 0,
        failureCount: 0,
      });
    }

    const activeTokens = user.pushTokens
      .filter((t) => t.isActive !== false && t.token)
      .map((t) => t.token);

    if (activeTokens.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active FCM device tokens found.',
        firebaseInitialized: getFirebaseAdminStatus(),
        tokensFound: 0,
        sentCount: 0,
        failureCount: 0,
      });
    }

    const result = await sendPushToTokens(
      activeTokens,
      {
        title: 'CampusCart Test Push 🚀',
        body: 'System notification test passed successfully!',
        type: 'TEST',
        url: '/notifications',
      },
      user._id
    );

    return res.status(200).json({
      success: result.success,
      firebaseInitialized: getFirebaseAdminStatus(),
      tokensFound: activeTokens.length,
      sentCount: result.sentCount || 0,
      failureCount: result.failureCount || 0,
      errors: result.errors || [],
      tokenCleanupOccurred: result.tokenCleanupOccurred || false,
    });
  } catch (error) {
    next(error);
  }
};

