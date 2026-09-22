import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { BSON } from 'bson';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: './.env' });

import Shop from './models/Shop.js';
import User from './models/User.js';
import Category from './models/Category.js';
import Product from './models/Product.js';
import { protect } from './middleware/authMiddleware.js';

async function runRootCauseDiagnostic() {
  console.log("Connecting to MongoDB Atlas...");
  const connectStart = performance.now();
  await mongoose.connect(process.env.MONGO_URI);
  const connectEnd = performance.now();
  console.log(`Connected successfully in ${(connectEnd - connectStart).toFixed(2)} ms.\n`);

  // --- 1. MONGODB ATLAS NETWORK PING & INDEX CHECK ---
  console.log("=== 1. MONGODB ATLAS & INDEX DIAGNOSTICS ===");
  const pingStart = performance.now();
  await mongoose.connection.db.admin().ping();
  const pingEnd = performance.now();
  console.log(`MongoDB Ping Latency: ${(pingEnd - pingStart).toFixed(2)} ms`);

  const shopIndexes = await mongoose.connection.db.collection('shops').indexes();
  console.log("Shop Collection Indexes:", shopIndexes.map(i => i.name));

  const explainPlan = await mongoose.connection.db.collection('shops').find({ isApproved: true, isActive: true }).explain("executionStats");
  const stats = explainPlan.executionStats;
  console.log(`Execution Stats - Stage: ${stats.executionStages.stage}, ExecutionTimeMillis: ${stats.executionTimeMillis} ms, DocsExamined: ${stats.nReturned}`);

  // --- 2. BASE64 PAYLOAD AUDIT ACROSS ENTIRE COLLECTION ---
  console.log("\n=== 2. EXACT BASE64 REMAINING PAYLOAD AUDIT ===");
  const shopsRaw = await mongoose.connection.db.collection('shops').find({}).toArray();
  
  let totalBase64Bytes = 0;
  let logoBase64Bytes = 0;
  let coverBase64Bytes = 0;
  let qrBase64Bytes = 0;
  let base64ShopCount = 0;

  for (const s of shopsRaw) {
    let hasBase64 = false;
    for (const [key, val] of Object.entries(s)) {
      if (typeof val === 'string' && val.startsWith('data:image/')) {
        hasBase64 = true;
        const size = Buffer.byteLength(val, 'utf8');
        totalBase64Bytes += size;
        if (key === 'logo') logoBase64Bytes += size;
        if (key === 'coverImage') coverBase64Bytes += size;
        if (key === 'upiQrImage') qrBase64Bytes += size;
      }
    }
    if (hasBase64) base64ShopCount++;
  }

  console.log(`Total Shops with Base64 remaining: ${base64ShopCount} / ${shopsRaw.length}`);
  console.log(`Total Remaining Base64 Payload: ${(totalBase64Bytes / (1024 * 1024)).toFixed(3)} MB (${(totalBase64Bytes / 1024).toFixed(1)} KB)`);
  console.log(`  - Logo Base64: ${(logoBase64Bytes / 1024).toFixed(1)} KB`);
  console.log(`  - Cover Base64: ${(coverBase64Bytes / 1024).toFixed(1)} KB`);
  console.log(`  - UPI QR Base64: ${(qrBase64Bytes / 1024).toFixed(1)} KB`);

  // --- 3. BENCHMARKS (A vs B vs C) ---
  console.log("\n=== 3. THREE DATABASE BENCHMARKS ===");

  // Benchmark A: Actual current query (mix of Cloudinary + 17 remaining Base64 shops)
  const tA0 = performance.now();
  const shopsA = await Shop.find({ isApproved: true, isActive: true })
    .populate('category', 'name image')
    .select('-owner')
    .sort({ rating: -1, name: 1 });
  const tA1 = performance.now();
  const jsonA = JSON.stringify({ success: true, count: shopsA.length, shops: shopsA });
  const tA2 = performance.now();

  console.log(`Benchmark A (Current Full Query):`);
  console.log(`  - Mongo Query + Wire + Hydration: ${(tA1 - tA0).toFixed(2)} ms`);
  console.log(`  - JSON Serialization: ${(tA2 - tA1).toFixed(2)} ms`);
  console.log(`  - Response Size: ${(Buffer.byteLength(jsonA, 'utf8') / (1024 * 1024)).toFixed(3)} MB`);

  // Benchmark B: Deselecting all image fields (-logo -coverImage -upiQrImage -upiQrPublicId)
  const tB0 = performance.now();
  const shopsB = await Shop.find({ isApproved: true, isActive: true })
    .populate('category', 'name image')
    .select('-owner -logo -coverImage -upiQrImage -upiQrPublicId')
    .sort({ rating: -1, name: 1 });
  const tB1 = performance.now();
  const jsonB = JSON.stringify({ success: true, count: shopsB.length, shops: shopsB });
  const tB2 = performance.now();

  console.log(`\nBenchmark B (Image Fields Excluded):`);
  console.log(`  - Mongo Query + Wire + Hydration: ${(tB1 - tB0).toFixed(2)} ms`);
  console.log(`  - JSON Serialization: ${(tB2 - tB1).toFixed(2)} ms`);
  console.log(`  - Response Size: ${(Buffer.byteLength(jsonB, 'utf8') / 1024).toFixed(3)} KB`);

  // Benchmark C: Only the 3 migrated Cloudinary shops
  const migratedIds = ['6aa51302c65ef3290af949de', '6aa977f3eea26bfcb75e215b', '6aaeb457cfa738a28eb24223'];
  const tC0 = performance.now();
  const shopsC = await Shop.find({ _id: { $in: migratedIds } })
    .populate('category', 'name image')
    .select('-owner')
    .sort({ rating: -1, name: 1 });
  const tC1 = performance.now();
  const jsonC = JSON.stringify({ success: true, count: shopsC.length, shops: shopsC });
  const tC2 = performance.now();

  console.log(`\nBenchmark C (Only 3 Migrated Cloudinary Shops with full URL fields):`);
  console.log(`  - Mongo Query + Wire + Hydration: ${(tC1 - tC0).toFixed(2)} ms`);
  console.log(`  - JSON Serialization: ${(tC2 - tC1).toFixed(2)} ms`);
  console.log(`  - Response Size: ${(Buffer.byteLength(jsonC, 'utf8') / 1024).toFixed(3)} KB`);

  // --- 4. AUTHENTICATION & USER LOOKUP DELAY ---
  console.log("\n=== 4. AUTHENTICATION MIDDLEWARE LATENCY MEASUREMENT ===");
  const testUser = await User.findOne({});
  if (testUser) {
    const auth0 = performance.now();
    const fetchedUser = await User.findById(testUser._id);
    const auth1 = performance.now();
    console.log(`User.findById() DB Lookup Latency: ${(auth1 - auth0).toFixed(2)} ms`);
  }

  // --- 5. PRODUCTION ENDPOINT REACHABILITY CHECK ---
  console.log("\n=== 5. PRODUCTION ENDPOINT CHECK ===");
  try {
    const prodT0 = performance.now();
    const res = await fetch('https://campas-cart-1.onrender.com/api/shops', { method: 'GET' });
    const prodT1 = performance.now();
    console.log(`Production GET https://campas-cart-1.onrender.com/api/shops -> HTTP ${res.status} in ${(prodT1 - prodT0).toFixed(2)} ms`);
  } catch (err) {
    console.log(`Production Endpoint Verification: Failed to fetch (${err.message})`);
  }

  await mongoose.disconnect();
}

runRootCauseDiagnostic().catch(err => {
  console.error("Diagnostic error:", err);
  mongoose.disconnect();
});
