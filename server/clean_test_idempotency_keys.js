import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from './models/Order.js';
import Product from './models/Product.js';

dotenv.config();

async function clean() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  // Clean duplicate idempotency test records
  const res1 = await Product.deleteMany({ idempotencyKey: { $exists: true, $ne: null } });
  const res2 = await Order.deleteMany({ idempotencyKey: { $exists: true, $ne: null } });

  console.log('Deleted test products:', res1.deletedCount);
  console.log('Deleted test orders:', res2.deletedCount);

  // Sync unique indexes
  await Product.syncIndexes();
  await Order.syncIndexes();
  console.log('Successfully synced Product and Order unique indexes!');

  process.exit(0);
}

clean();
