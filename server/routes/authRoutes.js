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
  sendPhoneOtp,
  verifyPhoneOtp,
  verifyFirebasePhoneToken,
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

// Phone verification routes
router.post('/phone/send-otp', protect, sendPhoneOtp);
router.post('/phone/verify-otp', protect, verifyPhoneOtp);
router.post('/phone/verify-firebase', protect, verifyFirebasePhoneToken);

// Admin only route
router.post(
  '/admin/create-staff',
  protect,
  authorizeRoles('ADMIN'),
  createStaff
);

export default router;