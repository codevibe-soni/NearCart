import express from 'express';
import {
  getStaffMembers,
  getAllUsers,
  updateUserStatus,
  deleteUserAdmin,
  deletePaymentAdmin,
  getAllShops,
  updateShopStatus,
  deleteShopAdmin,
  previewCleanData,
  executeCleanData,
} from '../controllers/adminController.js';
import { getInstallationAnalytics } from '../controllers/analyticsController.js';
import {
  getAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  togglePublishAnnouncement,
  uploadPosterImage,
} from '../controllers/announcementController.js';
import { protect, authorizeRoles } from '../middleware/authMiddleware.js';
import upload, { posterMediaUpload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Protected Admin-only routes
router.use(protect, authorizeRoles('ADMIN'));

router.get('/staff', getStaffMembers);
router.get('/users', getAllUsers);
router.patch('/users/:id/status', updateUserStatus);
router.delete('/users/:id', deleteUserAdmin);

// Shop Management & Moderation routes
router.get('/shops', getAllShops);
router.patch('/shops/:id/status', updateShopStatus);
router.delete('/shops/:id', deleteShopAdmin);
router.delete('/payments/:id', deletePaymentAdmin);

// PWA App Installation Analytics for Admin Dashboard
router.get('/analytics/installations', getInstallationAnalytics);

// Data Cleanup routes
router.post('/clean-data/preview', previewCleanData);
router.post('/clean-data', executeCleanData);

// Admin Poster & Announcement Management routes (mapped to both /campaigns and /announcements for 100% path compatibility)
router.get('/campaigns', getAnnouncements);
router.post('/campaigns/upload', posterMediaUpload.single('poster'), uploadPosterImage);
router.post('/campaigns', posterMediaUpload.single('poster'), createAnnouncement);
router.get('/campaigns/:id', getAnnouncementById);
router.put('/campaigns/:id', posterMediaUpload.single('poster'), updateAnnouncement);
router.patch('/campaigns/:id/toggle', togglePublishAnnouncement);
router.delete('/campaigns/:id', deleteAnnouncement);

router.get('/announcements', getAnnouncements);
router.post('/announcements/upload', posterMediaUpload.single('poster'), uploadPosterImage);
router.post('/announcements', posterMediaUpload.single('poster'), createAnnouncement);
router.get('/announcements/:id', getAnnouncementById);
router.put('/announcements/:id', posterMediaUpload.single('poster'), updateAnnouncement);
router.patch('/announcements/:id/toggle', togglePublishAnnouncement);
router.delete('/announcements/:id', deleteAnnouncement);

export default router;
