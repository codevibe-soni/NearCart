import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config(); // fallback to cwd if any
import mongoose from 'mongoose';
import Coupon from '../models/Coupon.js';

export async function runMigration() {
  console.log('--- STARTING SAFE COUPON INDEX & SCOPE MIGRATION ---');

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is not set in environment variables');
  }

  const isConnected = mongoose.connection.readyState === 1;
  if (!isConnected) {
    await mongoose.connect(process.env.MONGO_URI);
  }

  const collection = Coupon.collection;

  // 1. Fetch all existing coupons for inspection
  const existingCoupons = await Coupon.find({}).lean();
  console.log(`Found ${existingCoupons.length} existing coupon(s) in database.`);

  // 2. Conflict & Ambiguity Check
  const globalCodes = new Set();
  const shopCodePairs = new Set();
  const conflicts = [];

  for (const c of existingCoupons) {
    const code = c.code ? c.code.trim().toUpperCase() : '';
    const isShopSpecific = Boolean(c.shopId);

    if (isShopSpecific) {
      const key = `${c.shopId.toString()}::${code}`;
      if (shopCodePairs.has(key)) {
        conflicts.push(`Duplicate code "${code}" for shop ID ${c.shopId}`);
      }
      shopCodePairs.add(key);
    } else {
      if (globalCodes.has(code)) {
        conflicts.push(`Duplicate GLOBAL coupon code "${code}" found`);
      }
      globalCodes.add(code);
    }
  }

  if (conflicts.length > 0) {
    console.error('FATAL CONFLICT DETECTED IN EXISTING DATA:', conflicts);
    throw new Error(`Migration stopped due to data conflicts: ${conflicts.join('; ')}`);
  }

  // 3. Backfill couponType safely and idempotently without touching usage counts or dates
  let updatedCount = 0;
  for (const c of existingCoupons) {
    const determinedType = c.shopId ? 'SHOP_SPECIFIC' : 'GLOBAL';
    if (!c.couponType || c.couponType !== determinedType) {
      await Coupon.updateOne(
        { _id: c._id },
        {
          $set: {
            couponType: determinedType,
            code: c.code.trim().toUpperCase(),
          },
        }
      );
      updatedCount++;
    }
  }
  console.log(`Backfilled couponType on ${updatedCount} coupon(s).`);

  // 4. Inspect current collection indexes
  const currentIndexes = await collection.indexes();
  console.log('Current collection indexes:', currentIndexes.map((idx) => idx.name));

  // 5. Drop old global unique index on code alone if present
  const oldCodeIndex = currentIndexes.find(
    (idx) => idx.name === 'code_1' && idx.unique === true
  );

  if (oldCodeIndex) {
    console.log('Dropping legacy global unique index "code_1"...');
    await collection.dropIndex('code_1');
    console.log('Legacy index "code_1" dropped successfully.');
  } else {
    console.log('No legacy unique index "code_1" found. Skipping drop.');
  }

  // 6. Build new partial unique indexes using Coupon.syncIndexes()
  console.log('Synchronizing schema indexes with MongoDB...');
  await Coupon.syncIndexes();

  const finalIndexes = await collection.indexes();
  console.log('Final collection indexes:');
  finalIndexes.forEach((idx) => {
    console.log(` - ${idx.name}:`, JSON.stringify(idx.key), idx.unique ? `[UNIQUE, partial: ${JSON.stringify(idx.partialFilterExpression || {})}]` : '');
  });

  console.log('--- COUPON MIGRATION COMPLETED SUCCESSFULLY ---');
  return {
    success: true,
    totalCoupons: existingCoupons.length,
    updatedCoupons: updatedCount,
    indexes: finalIndexes.map((i) => i.name),
  };
}

// Allow direct CLI invocation
if (process.argv[1] && process.argv[1].endsWith('migrateCouponIndexes.js')) {
  runMigration()
    .then((res) => {
      console.log('Result:', JSON.stringify(res, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
