import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  registerDeviceToken,
  removeDeviceToken,
  sendTestPushNotification,
} from '../controllers/notificationController.js';

const router = express.Router();

router.use(protect);

router.get('/', getUserNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.post('/device-token', registerDeviceToken);
router.delete('/device-token', removeDeviceToken);
router.post('/test-push', sendTestPushNotification);
// Admin route to trigger Karwa Chauth promotional push (single-use)
router.post('/karwa-chooth-promo', authorizeRoles('ADMIN'), sendKarwaChauthPromo);

export default router;
