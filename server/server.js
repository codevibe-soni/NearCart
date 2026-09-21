import http from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import connectDB from './config/db.js';
import { initSocket } from './config/socket.js';
import cloudinary from './config/cloudinary.js';

// Routes
import healthRoutes from './routes/healthRoutes.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import shopkeeperRoutes from './routes/shopkeeperRoutes.js';
import deliveryRoutes from './routes/deliveryRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import shopRoutes from './routes/shopRoutes.js';
import productRoutes from './routes/productRoutes.js';
import cartRoutes from './routes/cartRoutes.js';
import addressRoutes from './routes/addressRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';

import {
  errorHandler,
  notFoundHandler,
} from './middleware/errorHandler.js';

// ===============================
// LOAD ENVIRONMENT VARIABLES
// ===============================

dotenv.config();

// ===============================
// EXPRESS APP
// ===============================

const app = express();
const PORT = process.env.PORT || 5000;

// Trust reverse proxy
app.set('trust proxy', 1);

// Create HTTP server for Express + Socket.IO
const httpServer = http.createServer(app);

// ===============================
// CORS
// ===============================

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'https://near-cart.netlify.app',
  process.env.CLIENT_URL,
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      process.env.NODE_ENV !== 'production'
    ) {
      callback(null, true);
    } else {
      // Currently allowing all origins
      callback(null, true);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

// ===============================
// MIDDLEWARE
// ===============================

app.use(cors(corsOptions));

app.use(
  express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: '10mb',
  })
);

app.use(cookieParser());

// ===============================
// SOCKET.IO
// ===============================

initSocket(httpServer, corsOptions);

// ===============================
// ROOT ROUTE
// ===============================

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'NearCart Backend is running',
  });
});

// ===============================
// API ROUTES
// ===============================

app.use('/api', healthRoutes);

app.use('/api/auth', authRoutes);

app.use('/api/admin', adminRoutes);

app.use('/api/shopkeeper', shopkeeperRoutes);

app.use('/api/delivery', deliveryRoutes);

app.use('/api/categories', categoryRoutes);

app.use('/api/shops', shopRoutes);

app.use('/api/products', productRoutes);

app.use('/api/cart', cartRoutes);

app.use('/api/addresses', addressRoutes);

app.use('/api/orders', orderRoutes);

app.use('/api/notifications', notificationRoutes);

app.use('/api/payments', paymentRoutes);

app.use('/api/reviews', reviewRoutes);

app.use('/api/analytics', analyticsRoutes);

// ===============================
// TEMPORARY CLOUDINARY TEST
// ===============================

app.get('/api/cloudinary-test', async (req, res) => {
  try {
    const result = await cloudinary.api.ping();

    res.status(200).json({
      success: true,
      message: 'Cloudinary connected successfully',
      result,
    });
  } catch (error) {
    console.error('Cloudinary error:', error);

    res.status(500).json({
      success: false,
      message: 'Cloudinary connection failed',
      error: error.message,
    });
  }
});

// ===============================
// 404 ROUTE HANDLER
// IMPORTANT: MUST BE AFTER ALL ROUTES
// ===============================

app.use(notFoundHandler);

// ===============================
// CENTRAL ERROR HANDLER
// ===============================

app.use(errorHandler);

// ===============================
// DATABASE + SERVER
// ===============================

const startServer = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error(
        'CRITICAL ERROR: MONGO_URI is not defined in environment variables.'
      );

      process.exit(1);
    }

    // Connect to MongoDB
    await connectDB();

    // Start HTTP + Socket.IO server
    httpServer.listen(PORT, () => {
      console.log(
        `🚀 NearCart Server running on port ${PORT} (HTTP + Socket.IO)`
      );
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();