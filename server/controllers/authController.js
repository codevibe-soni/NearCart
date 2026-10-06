import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { isValidEmail, normalizeEmail } from '../utils/emailValidator.js';
import { sendWelcomeEmailToUser, sendStaffWelcomeEmailToStaff } from '../services/emailService.js';

// Helper to generate JWT token and set HTTP-only cookie
const sendTokenResponse = (user, statusCode, res, message = 'Success') => {
  const token = jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15d' }
  );

  const cookieName = process.env.COOKIE_NAME || 'campuscart_token';
  const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
  const maxAgeMs = 15 * 24 * 60 * 60 * 1000; // 15 days

  const options = {
    expires: new Date(Date.now() + maxAgeMs),
    maxAge: maxAgeMs,
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  };

  const safeUser = {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    customerType: user.customerType || 'STUDENT',
    accountStatus: user.accountStatus,
    profileImage: user.profileImage,
    authProvider: user.authProvider || 'local',
    passwordSet: user.passwordSet !== undefined ? user.passwordSet : true,
    googleConnected: Boolean(user.googleId),
    isActive: user.isActive,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
  };

  res.status(statusCode).cookie(cookieName, token, options).json({
    success: true,
    message,
    token,
    user: safeUser,
  });
};

// @route   POST /api/auth/register
// @desc    Register a new STUDENT user (Public)
// @access  Public
export const register = async (req, res, next) => {
  try {
    const { name, email, phone, password, customerType } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, phone, and password',
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address (e.g. student@example.com)',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    const normalizedEmail = normalizeEmail(email);

    // Check duplicate email
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email address is already registered',
      });
    }

    const selectedCustomerType = ['STUDENT', 'ATITHI'].includes(customerType?.toUpperCase()) ? customerType.toUpperCase() : 'STUDENT';

    // Public registration ALWAYS forces STUDENT role, but preserves customerType (STUDENT / ATITHI)
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      password,
      role: 'STUDENT',
      customerType: selectedCustomerType,
      accountStatus: 'APPROVED',
    });

    // Create in-app welcome notification for newly registered student
    try {
      const welcomeNotif = await Notification.create({
        user: user._id,
        title: 'Welcome to NearCart! 🎉',
        message: 'Welcome to NearCart. Your account has been created successfully. You can now explore local shops and place orders.',
        type: 'SYSTEM',
        isRead: false,
      });

      const { getIO } = await import('../config/socket.js');
      const io = getIO();
      if (io) {
        io.to(`user:${user._id}`).emit('notification', welcomeNotif);
      }
    } catch (notifErr) {
      console.warn('[NOTIF WARNING] Welcome notification dispatch failed safely:', notifErr.message);
    }

    // Send welcome email via Brevo HTTP API (non-blocking failure isolation)
    sendWelcomeEmailToUser({ userEmail: user.email, userName: user.name }).catch((emailErr) => {
      console.warn('[EMAIL WARNING] Welcome email dispatch failed safely:', emailErr.message);
    });

    sendTokenResponse(user, 201, res, 'Registration successful');
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/auth/google
// @desc    Google Sign-In / Registration handler (Public)
// @access  Public
export const googleAuth = async (req, res, next) => {
  try {
    const { token: googleToken, credential, email: bodyEmail, name: bodyName, phone: bodyPhone, googleId: bodyGoogleId, picture: bodyPicture } = req.body;

    let email = bodyEmail;
    let name = bodyName;
    let googleId = bodyGoogleId;
    let profileImage = bodyPicture || '';

    // If an ID token / credential was supplied, verify it server-side using Google Auth Library
    const idTokenToVerify = credential || googleToken;
    if (idTokenToVerify) {
      try {
        const { OAuth2Client } = await import('google-auth-library');
        const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
        
        console.log('[Google Auth Info] Starting verification:', {
          hasCredential: Boolean(idTokenToVerify),
          hasConfiguredClientId: Boolean(googleClientId),
        });

        const client = new OAuth2Client(googleClientId);

        const ticket = await client.verifyIdToken({
          idToken: idTokenToVerify,
          audience: googleClientId ? [googleClientId] : undefined,
        });
        const payload = ticket.getPayload();

        console.log('[Google Auth Info] Verification result:', {
          hasPayload: Boolean(payload),
          hasEmail: Boolean(payload?.email),
          emailVerified: Boolean(payload?.email_verified),
          hasSub: Boolean(payload?.sub),
        });

        if (!payload) {
          return res.status(401).json({
            success: false,
            message: 'Unable to parse Google authentication payload. Please try again.',
          });
        }

        if (!payload.email) {
          return res.status(400).json({
            success: false,
            message: 'Your Google account did not provide an email address.',
          });
        }

        if (payload.email_verified === false) {
          return res.status(403).json({
            success: false,
            message: 'Your Google account email address is not verified by Google.',
          });
        }

        email = payload.email;
        name = payload.name || name;
        googleId = payload.sub || googleId;
        if (payload.picture && !profileImage) {
          profileImage = payload.picture;
        }
      } catch (verifyErr) {
        console.error('[Google Auth Error] Token verification failed:', verifyErr.message);

        // If direct verified payload was provided in fallback body (e.g. dev mode), continue only if email exists
        if (!email) {
          let userMessage = 'Google Sign-In verification failed. Please try again.';
          if (verifyErr.message?.includes('expired')) {
            userMessage = 'Google Sign-In session has expired. Please try again.';
          } else if (verifyErr.message?.includes('audience mismatch') || verifyErr.message?.includes('Recipient')) {
            userMessage = 'Google Client ID mismatch between frontend and backend configuration.';
          } else if (verifyErr.message?.includes('wrong number of segments')) {
            userMessage = 'Invalid Google credential token format received.';
          }

          return res.status(401).json({
            success: false,
            message: userMessage,
          });
        }
      }
    } else if (!email) {
      return res.status(400).json({
        success: false,
        message: 'No Google authentication credentials were provided.',
      });
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Google profile email is required',
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Google account email address',
      });
    }

    const normalizedEmail = normalizeEmail(email);

    // Look for existing user
    let user = await User.findOne({ email: normalizedEmail });

    if (user) {
      // Existing user login
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Your account is deactivated. Please contact support.',
        });
      }

      // Link googleId if not already present
      if (googleId && !user.googleId) {
        user.googleId = googleId;
        await user.save();
      }

      return sendTokenResponse(user, 200, res, 'Google login successful');
    }

    // Genuinely NEW Google account creation
    const randomPassword = `google_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    user = await User.create({
      name: name ? name.trim() : 'Google User',
      email: normalizedEmail,
      phone: bodyPhone ? bodyPhone.trim() : '',
      password: randomPassword,
      role: 'STUDENT',
      accountStatus: 'APPROVED',
      profileImage: profileImage || '',
      googleId: googleId || '',
      authProvider: 'google',
      passwordSet: false,
      isActive: true,
      isVerified: true,
    });

    // Create in-app welcome notification for newly registered Google student
    try {
      const welcomeNotif = await Notification.create({
        user: user._id,
        title: 'Welcome to NearCart! 🎉',
        message: 'Welcome to NearCart. Your account has been created successfully. You can now explore local shops and place orders.',
        type: 'SYSTEM',
        isRead: false,
      });

      const { getIO } = await import('../config/socket.js');
      const io = getIO();
      if (io) {
        io.to(`user:${user._id}`).emit('notification', welcomeNotif);
      }
    } catch (notifErr) {
      console.warn('[NOTIF WARNING] Google welcome notification dispatch failed safely:', notifErr.message);
    }

    // Send welcome email via Brevo HTTP API (non-blocking failure isolation)
    sendWelcomeEmailToUser({ userEmail: user.email, userName: user.name }).catch((emailErr) => {
      console.warn('[EMAIL WARNING] Google welcome email dispatch failed safely:', emailErr.message);
    });

    return sendTokenResponse(user, 201, res, 'Google registration successful');
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/auth/login
// @desc    Login user & set JWT cookie
// @access  Public
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Select password explicitly as select: false in schema
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account is deactivated. Please contact support.',
      });
    }

    if (user.accountStatus !== 'APPROVED') {
      return res.status(401).json({
        success: false,
        message: 'Your staff account is pending administrator approval.',
      });
    }

    sendTokenResponse(user, 200, res, 'Logged in successfully');
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/auth/logout
// @desc    Logout user & clear cookie
// @access  Public
export const logout = async (req, res, next) => {
  try {
    const cookieName = process.env.COOKIE_NAME || 'campuscart_token';
    const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

    res.cookie(cookieName, '', {
      httpOnly: true,
      expires: new Date(0),
      maxAge: 0,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/auth/me
// @desc    Get current logged in user
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    const user = req.user;
    res.status(200).json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        customerType: user.customerType || 'STUDENT',
        accountStatus: user.accountStatus,
        profileImage: user.profileImage,
        authProvider: user.authProvider || 'local',
        passwordSet: user.passwordSet !== undefined ? user.passwordSet : true,
        googleConnected: Boolean(user.googleId),
        isActive: user.isActive,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/auth/set-password
// @desc    Set password for Google-created or existing authenticated user
// @access  Private
export const setPassword = async (req, res, next) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a new password',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.password = password;
    user.passwordSet = true;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password set successfully. You can now sign in with Google or your email and password.',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        accountStatus: user.accountStatus,
        profileImage: user.profileImage,
        authProvider: user.authProvider || 'local',
        passwordSet: true,
        googleConnected: Boolean(user.googleId),
        isActive: user.isActive,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @route   PUT /api/auth/profile
// @desc    Update current logged-in user profile (e.g. profileImage, name, phone)
// @access  Private
export const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, profileImage, customerType } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (name) user.name = name.trim();
    if (phone) user.phone = phone.trim();
    if (profileImage !== undefined) user.profileImage = profileImage;
    if (req.body.isOnline !== undefined) user.isOnline = Boolean(req.body.isOnline);
    if (customerType && ['STUDENT', 'ATITHI'].includes(customerType.toUpperCase())) {
      user.customerType = customerType.toUpperCase();
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        customerType: user.customerType || 'STUDENT',
        accountStatus: user.accountStatus,
        profileImage: user.profileImage,
        isActive: user.isActive,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @route   POST /api/auth/admin/create-staff
// @desc    Create staff account (SHOPKEEPER or DELIVERY_BOY) by ADMIN
// @access  Private/Admin
export const createStaff = async (req, res, next) => {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !phone || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, phone, password, and role',
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address for staff account',
      });
    }

    if (!['SHOPKEEPER', 'DELIVERY_BOY'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Admin can only create SHOPKEEPER or DELIVERY_BOY staff accounts.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email address is already registered',
      });
    }

    const staffUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      phone: phone.trim(),
      password,
      role,
      accountStatus: 'APPROVED',
      isActive: true,
    });

    // Create in-app welcome notification for newly created staff member
    try {
      const msg = role === 'SHOPKEEPER'
        ? 'Your NearCart shopkeeper account has been created successfully by the administrator.'
        : 'Your NearCart delivery partner account has been created successfully by the administrator.';

      const welcomeNotif = await Notification.create({
        user: staffUser._id,
        title: 'Welcome to NearCart! 🎉',
        message: msg,
        type: 'SYSTEM',
        isRead: false,
      });

      const { getIO } = await import('../config/socket.js');
      const io = getIO();
      if (io) {
        io.to(`user:${staffUser._id}`).emit('notification', welcomeNotif);
      }
    } catch (notifErr) {
      console.warn('[NOTIF WARNING] Staff welcome notification dispatch failed safely:', notifErr.message);
    }

    // Send staff welcome email via Brevo HTTP API (non-blocking failure isolation)
    sendStaffWelcomeEmailToStaff({ staffEmail: staffUser.email, staffName: staffUser.name, role: staffUser.role }).catch((emailErr) => {
      console.warn('[EMAIL WARNING] Staff welcome email dispatch failed safely:', emailErr.message);
    });

    res.status(201).json({
      success: true,
      message: `Staff account (${role}) created successfully`,
      user: {
        _id: staffUser._id,
        name: staffUser.name,
        email: staffUser.email,
        phone: staffUser.phone,
        role: staffUser.role,
        accountStatus: staffUser.accountStatus,
        isActive: staffUser.isActive,
      },
    });
  } catch (error) {
    next(error);
  }
};
export const getSocketToken = async (req, res) => {
  try {
    const token = jwt.sign(
      {
        userId: req.user._id,
        role: req.user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '15m',
      }
    );

    res.status(200).json({
      success: true,
      socketToken: token,
      data: {
        socketToken: token,
      },
    });
  } catch (error) {
    console.error('Socket token error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to generate socket token',
    });
  }
};
