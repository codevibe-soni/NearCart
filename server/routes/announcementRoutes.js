import express from 'express';
import { getActiveAnnouncements } from '../controllers/announcementController.js';

const router = express.Router();

// Public endpoint - fetch published announcements for specified portal
router.get('/active', getActiveAnnouncements);
router.get('/', getActiveAnnouncements);

export default router;
