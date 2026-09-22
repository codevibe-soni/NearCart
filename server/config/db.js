import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
import Order from '../models/Order.js';
import Product from '../models/Product.js';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    try {
      await Order.syncIndexes();
      await Product.syncIndexes();
    } catch (idxErr) {
      console.warn('Index sync warning:', idxErr.message);
    }
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    // Log error cleanly without exposing sensitive connection string details
    process.exit(1);
  }
};

export default connectDB;
