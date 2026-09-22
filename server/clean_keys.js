import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function clean() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nearcart');
  const db = mongoose.connection.db;

  await db.collection('products').updateMany(
    { idempotencyKey: null },
    { $unset: { idempotencyKey: 1 } }
  );

  await db.collection('orders').updateMany(
    { idempotencyKey: null },
    { $unset: { idempotencyKey: 1 } }
  );

  console.log('Unset null idempotencyKeys successfully');
  await mongoose.disconnect();
}

clean().catch(console.error);
