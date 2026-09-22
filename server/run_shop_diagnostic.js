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

async function runDiagnostic() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected successfully.\n");

  // 1 & 2. Inspect Shop Documents & Image Fields
  const shopsRaw = await mongoose.connection.db.collection('shops').find({}).toArray();
  console.log(`=== TOTAL SHOPS IN DB: ${shopsRaw.length} ===\n`);

  let totalBsonSize = 0;
  let maxBsonSize = 0;
  let largestBsonShopName = '';

  let totalBase64Size = 0;
  let maxBase64Size = 0;
  let largestBase64ShopName = '';

  const discoveredImageFields = new Set();
  const shopSummaries = [];

  for (const doc of shopsRaw) {
    const docBsonSize = BSON.calculateObjectSize(doc);
    totalBsonSize += docBsonSize;
    if (docBsonSize > maxBsonSize) {
      maxBsonSize = docBsonSize;
      largestBsonShopName = doc.name || doc._id.toString();
    }

    let shopBase64Count = 0;
    let shopBase64Bytes = 0;
    let shopUrlBytes = 0;
    const shopImageFields = [];

    // Scan all keys in document for image-like content or fields
    for (const [key, value] of Object.entries(doc)) {
      if (typeof value === 'string') {
        const isBase64 = value.startsWith('data:image/') || (value.length > 500 && !value.startsWith('http'));
        const isUrl = value.startsWith('http://') || value.startsWith('https://');

        if (isBase64 || isUrl || /image|logo|banner|cover|photo|qr|thumbnail/i.test(key)) {
          discoveredImageFields.add(key);
          shopImageFields.push(key);

          if (isBase64) {
            shopBase64Count++;
            const bytes = Buffer.byteLength(value, 'utf8');
            shopBase64Bytes += bytes;
            totalBase64Size += bytes;
            if (bytes > maxBase64Size) {
              maxBase64Size = bytes;
              largestBase64ShopName = `${doc.name || doc._id} (field: ${key})`;
            }
          } else if (isUrl) {
            shopUrlBytes += Buffer.byteLength(value, 'utf8');
          }
        }
      }
    }

    shopSummaries.push({
      id: doc._id.toString(),
      name: doc.name,
      bsonSizeMB: (docBsonSize / (1024 * 1024)).toFixed(3),
      base64Count: shopBase64Count,
      base64SizeMB: (shopBase64Bytes / (1024 * 1024)).toFixed(3),
      urlSizeKB: (shopUrlBytes / 1024).toFixed(3),
      imageFields: shopImageFields,
    });
  }

  console.log("--- SHOP INSPECTION DETAILS ---");
  for (const s of shopSummaries) {
    console.log(`Shop: ${s.name}\n  _id: ${s.id}\n  BSON size: ${s.bsonSizeMB} MB\n  Base64 images count: ${s.base64Count}\n  Base64 size: ${s.base64SizeMB} MB\n  Image fields: ${s.imageFields.join(', ')}`);
  }
  console.log("\nAll Discovered Image-Related Fields across all shops:", Array.from(discoveredImageFields));

  // 3 & 4. Measure API Response Size & Test Projections (Benchmark)
  console.log("\n--- BENCHMARK 1: Student API Query (FULL vs DESELECT IMAGES) ---");
  const t0 = performance.now();
  const studentShopsFull = await Shop.find({ isApproved: true, isActive: true })
    .populate('category', 'name image')
    .select('-owner')
    .sort({ rating: -1, name: 1 });
  const t1 = performance.now();
  const studentFullJson = JSON.stringify({ success: true, count: studentShopsFull.length, shops: studentShopsFull });
  const t2 = performance.now();

  console.log(`Student Shop count: ${studentShopsFull.length}`);
  console.log(`Student API Mongo+Populate query time: ${(t1 - t0).toFixed(2)} ms`);
  console.log(`Student API JSON serialization time: ${(t2 - t1).toFixed(2)} ms`);
  console.log(`Student API Total execution time: ${(t2 - t0).toFixed(2)} ms`);
  console.log(`Student API JSON response size: ${(Buffer.byteLength(studentFullJson, 'utf8') / (1024 * 1024)).toFixed(3)} MB`);

  // Build deselect string from discovered fields
  const imageDeselectString = Array.from(discoveredImageFields).map(f => `-${f}`).join(' ');
  console.log(`\nTesting with projection deselecting: ${imageDeselectString}`);

  const tb0 = performance.now();
  const studentShopsNoImg = await Shop.find({ isApproved: true, isActive: true })
    .populate('category', 'name image')
    .select(`-owner ${imageDeselectString}`)
    .sort({ rating: -1, name: 1 });
  const tb1 = performance.now();
  const studentNoImgJson = JSON.stringify({ success: true, count: studentShopsNoImg.length, shops: studentShopsNoImg });
  const tb2 = performance.now();

  console.log(`Without Image fields - Mongo+Populate query time: ${(tb1 - tb0).toFixed(2)} ms`);
  console.log(`Without Image fields - JSON serialization time: ${(tb2 - tb1).toFixed(2)} ms`);
  console.log(`Without Image fields - Total execution time: ${(tb2 - tb0).toFixed(2)} ms`);
  console.log(`Without Image fields - JSON response size: ${(Buffer.byteLength(studentNoImgJson, 'utf8') / 1024).toFixed(3)} KB`);

  // 8. Shopkeeper API Benchmark
  console.log("\n--- BENCHMARK 2: Shopkeeper API (GET /api/shopkeeper/shops) ---");
  const shopkeeperUser = await User.findOne({ role: 'shopkeeper' });
  if (shopkeeperUser) {
    const skT0 = performance.now();
    const skShops = await Shop.find({ owner: shopkeeperUser._id })
      .populate('category', 'name image')
      .sort({ createdAt: -1 });
    const skT1 = performance.now();
    const skJson = JSON.stringify({ success: true, count: skShops.length, shops: skShops });
    const skT2 = performance.now();

    console.log(`Shopkeeper (${shopkeeperUser.email}) Shops count: ${skShops.length}`);
    console.log(`Shopkeeper API Query time: ${(skT1 - skT0).toFixed(2)} ms`);
    console.log(`Shopkeeper API Serialization time: ${(skT2 - skT1).toFixed(2)} ms`);
    console.log(`Shopkeeper API Response size: ${(Buffer.byteLength(skJson, 'utf8') / (1024 * 1024)).toFixed(3)} MB`);
  } else {
    console.log("No shopkeeper user found.");
  }

  // 9. Admin API Benchmark
  console.log("\n--- BENCHMARK 3: Admin API (GET /api/admin/shops) ---");
  const admT0 = performance.now();
  const adminShops = await Shop.find()
    .populate('owner', 'name email phone')
    .populate('category', 'name')
    .sort({ createdAt: -1 })
    .lean();
  const admT1 = performance.now();

  const shopIds = adminShops.map((s) => s._id);
  const productCounts = await Product.aggregate([
    { $match: { shop: { $in: shopIds } } },
    { $group: { _id: '$shop', count: { $sum: 1 } } },
  ]);
  const admT2 = performance.now();

  const countMap = {};
  productCounts.forEach((p) => {
    countMap[p._id.toString()] = p.count;
  });

  const enrichedShops = adminShops.map((s) => ({
    ...s,
    productCount: countMap[s._id.toString()] || 0,
  }));

  const adminJson = JSON.stringify({ success: true, count: enrichedShops.length, shops: enrichedShops });
  const admT3 = performance.now();

  console.log(`Admin Shops count: ${enrichedShops.length}`);
  console.log(`Admin API Mongo Shop find query time: ${(admT1 - admT0).toFixed(2)} ms`);
  console.log(`Admin API Product aggregation time: ${(admT2 - admT1).toFixed(2)} ms`);
  console.log(`Admin API Total Response build time: ${(admT3 - admT0).toFixed(2)} ms`);
  console.log(`Admin API Response size: ${(Buffer.byteLength(adminJson, 'utf8') / (1024 * 1024)).toFixed(3)} MB`);

  console.log("\n--- AGGREGATE STATS FOR DIAGNOSTIC REPORT ---");
  console.log(`Total shops: ${shopsRaw.length}`);
  console.log(`Average shop BSON size: ${(totalBsonSize / shopsRaw.length / (1024 * 1024)).toFixed(3)} MB (${(totalBsonSize / shopsRaw.length / 1024).toFixed(1)} KB)`);
  console.log(`Largest shop BSON size: ${(maxBsonSize / (1024 * 1024)).toFixed(3)} MB (${largestBsonShopName})`);
  console.log(`Total Base64 image data: ${(totalBase64Size / (1024 * 1024)).toFixed(3)} MB`);
  console.log(`Largest Base64 image: ${(maxBase64Size / (1024 * 1024)).toFixed(3)} MB (${largestBase64ShopName})`);

  await mongoose.disconnect();
}

runDiagnostic().catch(err => {
  console.error("Error running diagnostic:", err);
  mongoose.disconnect();
});
