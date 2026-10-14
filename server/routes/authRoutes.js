import express from 'express';

import {
  register,
  login,
  googleAuth,
  logout,
  getMe,
  setPassword,
  getSocketToken,
  updateProfile,
  createStaff,
} from '../controllers/authController.js';

import { protect, authorizeRoles } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);
router.post('/logout', logout);

// Protected routes
router.get('/me', protect, getMe);
router.post('/set-password', protect, setPassword);
router.get('/socket-token', protect, getSocketToken);
router.put('/profile', protect, updateProfile);

// Admin only route
router.post(
  '/admin/create-staff',
  protect,
  authorizeRoles('ADMIN'),
  createStaff
);

export default router;