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
import User from '../models/User.js';
import Order from '../models/Order.js';
import Review from '../models/Review.js';
import Delivery from '../models/Delivery.js';
import Category from '../models/Category.js';
import { uploadBase64Image } from '../services/cloudinaryService.js';
import { isCloudinaryConfigured } from '../config/cloudinary.js';

const parseArgs = () => {
  const args = process.argv.slice(2);
  let isDryRun = false;
  let isConfirm = false;

  for (const arg of args) {
    if (arg === '--dry-run') isDryRun = true;
    if (arg === '--confirm') isConfirm = true;
  }

  return { isDryRun, isConfirm };
};

const formatSizeStr = (bytes) => {
  if (!bytes) return '0 KB';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
};

const getImageMetadata = (value) => {
  if (!value || typeof value !== 'string') {
    return { type: 'empty', size: 0, isBase64: false, isUrl: false, isCloudinary: false };
  }
  const bytes = Buffer.byteLength(value, 'utf8');
  if (value.startsWith('data:image/')) {
    return { type: 'Base64', size: bytes, isBase64: true, isUrl: false, isCloudinary: false };
  }
  if (value.startsWith('http://') || value.startsWith('https://')) {
    const isCloudinary = value.includes('cloudinary.com');
    return { type: isCloudinary ? 'Cloudinary URL' : 'HTTP/HTTPS URL', size: bytes, isBase64: false, isUrl: true, isCloudinary };
  }
  return { type: 'Other String', size: bytes, isBase64: false, isUrl: false, isCloudinary: false };
};

const runMigration = async () => {
  const { isDryRun, isConfirm } = parseArgs();

  console.log('\n==================================================');
  console.log('🖼️   NEARCART FINAL SHOP CLOUDINARY MIGRATION');
  console.log('==================================================');
  if (isDryRun) {
    console.log('Mode: 🔍 DRY RUN (Preview Mode - No uploads, No DB changes)');
  } else if (isConfirm) {
    console.log('Mode: 🚀 LIVE MIGRATION (Confirmed)');
  } else {
    console.log('Mode: ⚠️ UNCONFIRMED');
  }
  console.log('==================================================\n');

  if (!isDryRun && !isConfirm) {
    console.error('❌ SAFETY BLOCK: Live migration requires the --confirm flag.');
    console.error('Run: node server/scripts/migrate-all-shops-to-cloudinary.js --dry-run (for preview)');
    console.error('Run: node server/scripts/migrate-all-shops-to-cloudinary.js --confirm (to execute live migration)\n');
    process.exit(1);
  }

  if (!isDryRun && !isCloudinaryConfigured()) {
    console.error('❌ CRITICAL ERROR: Cloudinary credentials missing in .env!');
    process.exit(1);
  }

  try {
    await connectDB();

    // 1. Initial State Snapshot & Dynamic Discovery
    console.log('📋 STEP 1: Scanning Database for Remaining Base64 Shops...');
    
    // Initial Counts for Safety Audit
    const initialCounts = {
      shops: await Shop.countDocuments(),
      products: await Product.countDocuments(),
      orders: await Order.countDocuments(),
      users: await User.countDocuments(),
      reviews: await Review.countDocuments(),
      deliveries: await Delivery.countDocuments(),
      categories: await Category.countDocuments(),
    };

    const allShops = await Shop.find({});
    const shopsToMigrate = [];
    let initialTotalBase64Images = 0;
    let initialTotalBase64Bytes = 0;

    for (const shopDoc of allShops) {
      let shopBase64Count = 0;
      let shopBase64Bytes = 0;
      const fieldMetas = {};

      for (const field of ['logo', 'coverImage', 'upiQrImage']) {
        const meta = getImageMetadata(shopDoc[field]);
        fieldMetas[field] = meta;
        if (meta.isBase64) {
          shopBase64Count++;
          shopBase64Bytes += meta.size;
          initialTotalBase64Images++;
          initialTotalBase64Bytes += meta.size;
        }
      }

      if (shopBase64Count > 0) {
        shopsToMigrate.push({
          doc: shopDoc,
          fieldMetas,
          base64Count: shopBase64Count,
          base64Bytes: shopBase64Bytes,
        });
      }
    }

    console.log(`\nFound ${allShops.length} Total Shops in Database.`);
    console.log(`Found ${shopsToMigrate.length} Shops requiring Base64 migration (${initialTotalBase64Images} Base64 images, ${formatSizeStr(initialTotalBase64Bytes)}).\n`);

    console.log('--- REMAINING SHOPS REQUIRING MIGRATION ---');
    for (const item of shopsToMigrate) {
      const s = item.doc;
      console.log(`\nShop: "${s.name}" (_id: ${s._id})`);
      for (const [field, meta] of Object.entries(item.fieldMetas)) {
        if (meta.isBase64) {
          console.log(`  ${field}: Base64 (${formatSizeStr(meta.size)})`);
        } else if (meta.isUrl) {
          console.log(`  ${field}: ${meta.type}`);
        } else {
          console.log(`  ${field}: Empty/None`);
        }
      }
      console.log(`  Total Shop Base64: ${formatSizeStr(item.base64Bytes)}`);
    }

    if (isDryRun) {
      console.log('\n✨ DRY-RUN COMPLETE: No Cloudinary uploads or MongoDB updates were made.');
      process.exit(0);
    }

    if (shopsToMigrate.length === 0) {
      console.log('\n✨ All Shop documents are already migrated! No Base64 images remain.');
      process.exit(0);
    }

    // 2. Controlled Sequential Migration (One Shop at a Time)
    console.log('\n==================================================');
    console.log('🚀 STEP 2: Executing Sequential Shop Migration');
    console.log('==================================================\n');

    let successfullyMigratedShopsCount = 0;
    let failedShopsCount = 0;

    for (let i = 0; i < shopsToMigrate.length; i++) {
      const item = shopsToMigrate[i];
      const shopDoc = item.doc;

      console.log(`[Shop ${i + 1}/${shopsToMigrate.length}] Migrating "${shopDoc.name}" (${shopDoc._id})...`);

      const originalDocState = {
        logo: shopDoc.logo,
        coverImage: shopDoc.coverImage,
        upiQrImage: shopDoc.upiQrImage,
        upiQrPublicId: shopDoc.upiQrPublicId,
      };

      const fieldResults = {};
      const updatesToApply = {};
      let shopFailed = false;

      const fieldsToProcess = [
        { name: 'logo', folderSub: 'logo' },
        { name: 'coverImage', folderSub: 'cover' },
        { name: 'upiQrImage', folderSub: 'upi-qr' },
      ];

      for (const f of fieldsToProcess) {
        const fieldName = f.name;
        const rawVal = shopDoc[fieldName];
        const meta = getImageMetadata(rawVal);

        if (!meta.isBase64) {
          fieldResults[fieldName] = { status: 'SKIPPED (Already URL/Empty)', url: rawVal };
          console.log(`  ℹ️ Field "${fieldName}": Skipped (${meta.type}).`);
          continue;
        }

        console.log(`  ⏳ Field "${fieldName}": Uploading Base64 (${formatSizeStr(meta.size)}) to Cloudinary...`);
        const deterministicPublicId = `${fieldName}_${shopDoc._id}`;
        const folder = `nearcart/shops/${shopDoc._id}/${f.folderSub}`;

        const uploadRes = await uploadBase64Image(rawVal, {
          folder,
          public_id: deterministicPublicId,
          overwrite: true,
        });

        if (!uploadRes.success || !uploadRes.url) {
          console.error(`  ❌ Field "${fieldName}": Cloudinary upload FAILED! Error: ${uploadRes.error}`);
          shopFailed = true;
          break;
        }

        const uploadedUrl = uploadRes.url;
        console.log(`  🔍 Field "${fieldName}": Verifying HTTP status of ${uploadedUrl}...`);

        try {
          const httpRes = await fetch(uploadedUrl, { method: 'GET' });
          if (!httpRes.ok && httpRes.status !== 200 && httpRes.status !== 304) {
            console.error(`  ❌ Field "${fieldName}": HTTP Verification FAILED with status ${httpRes.status}!`);
            shopFailed = true;
            break;
          }
          console.log(`  ✓ Field "${fieldName}": HTTP ${httpRes.status} Verified PASS.`);
        } catch (httpErr) {
          console.error(`  ❌ Field "${fieldName}": HTTP Fetch error: ${httpErr.message}`);
          shopFailed = true;
          break;
        }

        updatesToApply[fieldName] = uploadedUrl;
        if (fieldName === 'upiQrImage' && uploadRes.public_id) {
          updatesToApply.upiQrPublicId = uploadRes.public_id;
        }

        fieldResults[fieldName] = { status: 'PASS', url: uploadedUrl };
      }

      if (shopFailed) {
        console.error(`❌ MIGRATION FAILED for Shop "${shopDoc.name}". Restoring original document fields...`);
        failedShopsCount++;
        await Shop.findByIdAndUpdate(shopDoc._id, originalDocState);
        console.error(`  ↺ Rollback executed for Shop "${shopDoc.name}". Aborting full migration for safety.`);
        process.exit(1);
      }

      // Update MongoDB only after all uploads & HTTP 200 checks pass for this shop
      console.log(`  💾 Updating MongoDB for Shop "${shopDoc.name}"...`);
      for (const [key, val] of Object.entries(updatesToApply)) {
        shopDoc[key] = val;
      }
      await shopDoc.save();

      // Post-Update Database Verification Read-Back
      console.log(`  🔍 Performing MANDATORY Post-Update DB Read-Back Verification...`);
      const reReadDoc = await Shop.findById(shopDoc._id).lean();

      let readBackPass = true;
      for (const [fieldName, resObj] of Object.entries(fieldResults)) {
        if (resObj.status === 'PASS') {
          const valInDb = reReadDoc[fieldName];
          const dbMeta = getImageMetadata(valInDb);
          if (!dbMeta.isUrl || dbMeta.isBase64 || valInDb !== updatesToApply[fieldName]) {
            console.error(`  ❌ Read-Back Verification FAILED for field "${fieldName}" in MongoDB!`);
            readBackPass = false;
          }
        }
      }

      if (!readBackPass) {
        console.error(`❌ Post-Update Read-Back FAILED for Shop "${shopDoc.name}". Rolling back...`);
        failedShopsCount++;
        await Shop.findByIdAndUpdate(shopDoc._id, originalDocState);
        process.exit(1);
      }

      successfullyMigratedShopsCount++;
      console.log(`  ✅ Shop "${shopDoc.name}" successfully migrated & verified!\n`);
    }

    // 3. Full Collection Post-Migration Scan & Safety Check
    console.log('\n==================================================');
    console.log('🔒 STEP 3: Full Collection Post-Migration Audit');
    console.log('==================================================\n');

    const finalAllShops = await Shop.find({}).lean();
    let remainingBase64Count = 0;
    let remainingBase64Bytes = 0;
    let totalCloudinaryUrls = 0;
    let totalHttpUrls = 0;

    for (const shopDoc of finalAllShops) {
      for (const field of ['logo', 'coverImage', 'upiQrImage']) {
        const meta = getImageMetadata(shopDoc[field]);
        if (meta.isBase64) {
          remainingBase64Count++;
          remainingBase64Bytes += meta.size;
          console.error(`❌ STRAY BASE64 DETECTED in Shop "${shopDoc.name}" (${shopDoc._id}), field: ${field}`);
        } else if (meta.isCloudinary) {
          totalCloudinaryUrls++;
        } else if (meta.isUrl) {
          totalHttpUrls++;
        }
      }
    }

    console.log(`Total Shops Scanned:               ${finalAllShops.length}`);
    console.log(`Total Cloudinary Image URLs:        ${totalCloudinaryUrls}`);
    console.log(`Other Normal HTTP/HTTPS URLs:       ${totalHttpUrls}`);
    console.log(`Remaining Base64 Images in DB:       ${remainingBase64Count}`);
    console.log(`Remaining Base64 Bytes in DB:        ${formatSizeStr(remainingBase64Bytes)}`);

    // Safety check for non-target collections
    const finalCounts = {
      shops: await Shop.countDocuments(),
      products: await Product.countDocuments(),
      orders: await Order.countDocuments(),
      users: await User.countDocuments(),
      reviews: await Review.countDocuments(),
      deliveries: await Delivery.countDocuments(),
      categories: await Category.countDocuments(),
    };

    console.log('\nNon-Target Collection Isolation Check:');
    console.log(`  - Products Unchanged:   ${initialCounts.products === finalCounts.products} (${finalCounts.products})`);
    console.log(`  - Orders Unchanged:     ${initialCounts.orders === finalCounts.orders} (${finalCounts.orders})`);
    console.log(`  - Users Unchanged:      ${initialCounts.users === finalCounts.users} (${finalCounts.users})`);
    console.log(`  - Reviews Unchanged:    ${initialCounts.reviews === finalCounts.reviews} (${finalCounts.reviews})`);
    console.log(`  - Deliveries Unchanged: ${initialCounts.deliveries === finalCounts.deliveries} (${finalCounts.deliveries})`);
    console.log(`  - Categories Unchanged: ${initialCounts.categories === finalCounts.categories} (${finalCounts.categories})`);

    console.log('\n==================================================');
    console.log('🎉 FINAL SHOP CLOUDINARY MIGRATION COMPLETE');
    console.log('==================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ CRITICAL SCRIPT EXECUTION FAILURE:', err);
    await mongoose.disconnect();
    process.exit(1);
  }
};

runMigration();
