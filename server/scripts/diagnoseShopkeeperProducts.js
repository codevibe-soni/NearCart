import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

import connectDB from '../config/db.js';
import Shop from '../models/Shop.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';

async function diagnoseProductsEndpoint() {
  console.log('Connecting to MongoDB Atlas...');
  await connectDB();
  console.log('Connected.\n');

  const shopId = '6aaeb457cfa738a28eb24223'; // Target Shop: V K Grand Hotel and restaurant
  console.log(`==================================================`);
  console.log(`🔍 BENCHMARKING GET /api/shopkeeper/products?shopId=${shopId}`);
  console.log(`==================================================\n`);

  const shopDoc = await Shop.findById(shopId);
  if (!shopDoc) {
    console.error(`Shop ${shopId} not found.`);
    process.exit(1);
  }
  console.log(`Target Shop Name: "${shopDoc.name}"`);

  // 1. Benchmark Shop Ownership Check
  const t0 = performance.now();
  const shopCheck = await Shop.findById(shopId);
  const t1 = performance.now();
  console.log(`Shop ownership findById query time: ${(t1 - t0).toFixed(2)} ms`);

  // 2. Benchmark Product.find() Query + Populate + Lean
  const t2 = performance.now();
  const products = await Product.find({ shop: shopId })
    .select('name description category price discountPrice unit stock sku isAvailable isActive rating totalRatings gstPercentage packingCharges variantName createdAt updatedAt images')
    .slice('images', 1)
    .populate('category', 'name')
    .sort({ createdAt: -1 })
    .lean();
  const t3 = performance.now();

  const jsonStr = JSON.stringify({ success: true, count: products.length, products });
  const t4 = performance.now();

  console.log(`Product.find() query execution time: ${(t3 - t2).toFixed(2)} ms`);
  console.log(`JSON serialization time: ${(t4 - t3).toFixed(2)} ms`);
  console.log(`Total controller response time: ${(t4 - t0).toFixed(2)} ms`);
  console.log(`Product count returned: ${products.length}`);
  console.log(`Total JSON response size: ${(Buffer.byteLength(jsonStr, 'utf8') / 1024).toFixed(2)} KB`);

  // Check Product Image Payload details
  let totalImages = 0;
  let base64Count = 0;
  let maxProductBytes = 0;
  let maxProductName = '';

  for (const p of products) {
    const pJson = JSON.stringify(p);
    const pBytes = Buffer.byteLength(pJson, 'utf8');
    if (pBytes > maxProductBytes) {
      maxProductBytes = pBytes;
      maxProductName = p.name;
    }
    const imgs = Array.isArray(p.images) ? p.images : [];
    totalImages += imgs.length;
    for (const img of imgs) {
      if (typeof img === 'string' && img.startsWith('data:image/')) {
        base64Count++;
      }
    }
  }

  console.log(`Total Image URLs returned: ${totalImages}`);
  console.log(`Base64 images detected in response (data:image/): ${base64Count}`);
  console.log(`Average product JSON size: ${(Buffer.byteLength(jsonStr, 'utf8') / (products.length || 1) / 1024).toFixed(2)} KB`);
  console.log(`Largest product object size: ${(maxProductBytes / 1024).toFixed(2)} KB ("${maxProductName}")`);

  // 3. Product Index Verification
  console.log(`\n--- PRODUCT INDEX AUDIT ---`);
  const indexes = await mongoose.connection.db.collection('products').indexes();
  console.log(`Product collection indexes:`, indexes.map(i => i.name));

  const explain = await mongoose.connection.db.collection('products').find({ shop: new mongoose.Types.ObjectId(shopId) }).explain('executionStats');
  const eStats = explain.executionStats;
  console.log(`Index Explain Plan -> Stage: ${eStats.executionStages.stage}, Index: ${eStats.executionStages.indexName || 'None'}, Time: ${eStats.executionTimeMillis} ms, DocsExamined: ${eStats.totalDocsExamined}`);

  // 4. Test Production Endpoint Reachability
  console.log(`\n--- PRODUCTION ENDPOINT TEST ---`);
  try {
    const prodT0 = performance.now();
    const prodRes = await fetch(`https://campas-cart-1.onrender.com/api/shopkeeper/products?shopId=${shopId}`);
    const prodT1 = performance.now();
    console.log(`GET https://campas-cart-1.onrender.com/api/shopkeeper/products?shopId=${shopId} -> HTTP ${prodRes.status} in ${(prodT1 - prodT0).toFixed(2)} ms`);
  } catch (err) {
    console.log(`Production Test: Could not fetch (${err.message})`);
  }

  await mongoose.disconnect();
}

diagnoseProductsEndpoint().catch(err => {
  console.error("Diagnostic error:", err);
  mongoose.disconnect();
});
