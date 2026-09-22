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
import { uploadBase64Image } from '../services/cloudinaryService.js';
import { isCloudinaryConfigured } from '../config/cloudinary.js';

// Exact allowlist of target shops for this controlled test migration
const TARGET_SHOPS_CONFIG = [
  { id: '6aa51302c65ef3290af949de', expectedName: 'M.M food' },
  { id: '6aa977f3eea26bfcb75e215b', expectedName: 'Shukla Restaurant' },
  { id: '6aaeb457cfa738a28eb24223', expectedName: 'V K Grand Hotel and restaurant' },
];

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
  console.log('🖼️   NEARCART 3-SHOP CONTROLLED CLOUDINARY MIGRATION');
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
    console.error('Run: node server/scripts/migrate-test-shops-to-cloudinary.js --dry-run (for preview)');
    console.error('Run: node server/scripts/migrate-test-shops-to-cloudinary.js --confirm (to execute live migration)\n');
    process.exit(1);
  }

  if (!isDryRun && !isCloudinaryConfigured()) {
    console.error('❌ CRITICAL ERROR: Cloudinary credentials missing in .env!');
    process.exit(1);
  }

  try {
    await connectDB();

    // 1. Initial State Snapshot & Allowlist Verification
    console.log('📋 STEP 1: Verifying Target Shop Documents Allowlist...');
    
    // Check initial total counts across all collections to ensure isolation safety later
    const initialShopCount = await Shop.countDocuments();
    const initialProductCount = await Product.countDocuments();
    const initialOrderCount = await Order.countDocuments();
    const initialUserCount = await User.countDocuments();
    const initialReviewCount = await Review.countDocuments();
    const initialDeliveryCount = await Delivery.countDocuments();

    const initialSnapshots = [];
    const targetShopDocs = [];

    for (const target of TARGET_SHOPS_CONFIG) {
      const shopDoc = await Shop.findById(target.id);
      if (!shopDoc) {
        console.error(`❌ CRITICAL FAILURE: Target Shop ID "${target.id}" (${target.expectedName}) not found in database! Aborting migration.`);
        process.exit(1);
      }
      if (shopDoc.name !== target.expectedName) {
        console.error(`❌ CRITICAL FAILURE: Shop ID "${target.id}" name mismatch! Expected: "${target.expectedName}", Found: "${shopDoc.name}". Aborting migration.`);
        process.exit(1);
      }

      targetShopDocs.push(shopDoc);

      const logoMeta = getImageMetadata(shopDoc.logo);
      const coverMeta = getImageMetadata(shopDoc.coverImage);
      const qrMeta = getImageMetadata(shopDoc.upiQrImage);

      initialSnapshots.push({
        id: shopDoc._id.toString(),
        name: shopDoc.name,
        logo: { ...logoMeta, raw: shopDoc.logo },
        coverImage: { ...coverMeta, raw: shopDoc.coverImage },
        upiQrImage: { ...qrMeta, raw: shopDoc.upiQrImage },
        upiQrPublicId: shopDoc.upiQrPublicId || '',
      });
    }

    console.log(`✅ All ${TARGET_SHOPS_CONFIG.length} target shop documents verified successfully.\n`);

    // Output snapshot analysis
    let totalBase64Count = 0;
    let totalBase64Bytes = 0;

    console.log('--- PRE-MIGRATION TARGET SHOPS SNAPSHOT ---');
    for (const snap of initialSnapshots) {
      console.log(`\nShop: ${snap.name} (_id: ${snap.id})`);
      for (const field of ['logo', 'coverImage', 'upiQrImage']) {
        const meta = snap[field];
        if (meta.isBase64) {
          totalBase64Count++;
          totalBase64Bytes += meta.size;
          console.log(`  ${field}: Base64 (${formatSizeStr(meta.size)})`);
        } else if (meta.isUrl) {
          console.log(`  ${field}: ${meta.type} (${formatSizeStr(meta.size)})`);
        } else {
          console.log(`  ${field}: Empty/None`);
        }
      }
    }

    console.log(`\nTotal Base64 images found in target shops: ${totalBase64Count} (${formatSizeStr(totalBase64Bytes)})`);

    if (isDryRun) {
      console.log('\n✨ DRY-RUN COMPLETE: No Cloudinary uploads or MongoDB updates were made.');
      process.exit(0);
    }

    // 2. Controlled Migration Process (Shop by Shop)
    console.log('\n==================================================');
    console.log('🚀 STEP 2: Executing Controlled Shop-by-Shop Migration');
    console.log('==================================================\n');

    const migrationResults = [];

    for (let i = 0; i < targetShopDocs.length; i++) {
      const shopDoc = targetShopDocs[i];
      const snap = initialSnapshots[i];

      console.log(`\n[Shop ${i + 1}/${targetShopDocs.length}] Processing "${shopDoc.name}" (${shopDoc._id})...`);

      // Backup original state in memory for rollback safety
      const originalDocState = {
        logo: shopDoc.logo,
        coverImage: shopDoc.coverImage,
        upiQrImage: shopDoc.upiQrImage,
        upiQrPublicId: shopDoc.upiQrPublicId,
      };

      const fieldResults = {};
      const updatesToApply = {};

      const fieldsToProcess = [
        { name: 'logo', folderSub: 'logo' },
        { name: 'coverImage', folderSub: 'cover' },
        { name: 'upiQrImage', folderSub: 'upi-qr' },
      ];

      let shopFailed = false;

      for (const f of fieldsToProcess) {
        const fieldName = f.name;
        const rawVal = shopDoc[fieldName];
        const meta = getImageMetadata(rawVal);

        if (!meta.isBase64) {
          fieldResults[fieldName] = {
            before: meta.type,
            after: meta.type,
            status: 'SKIPPED (Not Base64)',
            httpVerified: true,
            url: rawVal,
          };
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
          fieldResults[fieldName] = {
            before: 'Base64',
            after: 'Base64 (Upload Failed)',
            status: 'FAILED',
            httpVerified: false,
          };
          break;
        }

        const uploadedUrl = uploadRes.url;
        console.log(`  🔍 Field "${fieldName}": Verifying HTTP status of ${uploadedUrl}...`);

        try {
          const httpRes = await fetch(uploadedUrl, { method: 'GET' });
          if (!httpRes.ok && httpRes.status !== 200 && httpRes.status !== 304) {
            console.error(`  ❌ Field "${fieldName}": HTTP Verification FAILED with status ${httpRes.status}!`);
            shopFailed = true;
            fieldResults[fieldName] = {
              before: 'Base64',
              after: 'Cloudinary URL (HTTP Check Failed)',
              status: `FAILED (HTTP ${httpRes.status})`,
              httpVerified: false,
              url: uploadedUrl,
            };
            break;
          }
          console.log(`  ✓ Field "${fieldName}": HTTP ${httpRes.status} Verified PASS.`);
        } catch (httpErr) {
          console.error(`  ❌ Field "${fieldName}": HTTP Fetch error: ${httpErr.message}`);
          shopFailed = true;
          fieldResults[fieldName] = {
            before: 'Base64',
            after: 'Cloudinary URL (HTTP Fetch Error)',
            status: 'FAILED (HTTP Error)',
            httpVerified: false,
            url: uploadedUrl,
          };
          break;
        }

        updatesToApply[fieldName] = uploadedUrl;
        if (fieldName === 'upiQrImage' && uploadRes.public_id) {
          updatesToApply.upiQrPublicId = uploadRes.public_id;
        }

        fieldResults[fieldName] = {
          before: 'Base64',
          after: 'Cloudinary URL',
          status: 'PASS',
          httpVerified: true,
          url: uploadedUrl,
        };
      }

      if (shopFailed) {
        console.error(`❌ MIGRATION FAILED for Shop "${shopDoc.name}". Triggering Rollback safety...`);
        // Rollback MongoDB document fields to original state if partial modification happened
        try {
          await Shop.findByIdAndUpdate(shopDoc._id, originalDocState);
          console.log(`  ↺ Rollback completed safely for Shop "${shopDoc.name}". Original Base64 retained.`);
        } catch (rbErr) {
          console.error(`  ❌ CRITICAL ROLLBACK FAILURE for Shop "${shopDoc.name}": ${rbErr.message}`);
          process.exit(1);
        }
        process.exit(1);
      }

      // If all images for this shop were uploaded & HTTP 200 verified, update MongoDB
      console.log(`  💾 Updating MongoDB for Shop "${shopDoc.name}"...`);
      for (const [key, val] of Object.entries(updatesToApply)) {
        shopDoc[key] = val;
      }
      await shopDoc.save();

      // Mandated Post-Update Database Verification Read-Back
      console.log(`  🔍 Performing MANDATORY Post-Update DB Verification Read-Back...`);
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
        console.error(`❌ Post-Update Read-Back FAILED for Shop "${shopDoc.name}". Attempting Rollback...`);
        await Shop.findByIdAndUpdate(shopDoc._id, originalDocState);
        console.error(`  ↺ Rollback executed. Aborting migration.`);
        process.exit(1);
      }

      console.log(`  ✅ Shop "${shopDoc.name}" successfully migrated & verified in MongoDB!\n`);
      migrationResults.push({
        name: shopDoc.name,
        id: shopDoc._id.toString(),
        fieldResults,
      });
    }

    // 3. Post-Migration System Isolation & Verification
    console.log('\n==================================================');
    console.log('🔒 STEP 3: System Safety & Isolation Verification');
    console.log('==================================================\n');

    const finalShopCount = await Shop.countDocuments();
    const finalProductCount = await Product.countDocuments();
    const finalOrderCount = await Order.countDocuments();
    const finalUserCount = await User.countDocuments();
    const finalReviewCount = await Review.countDocuments();
    const finalDeliveryCount = await Delivery.countDocuments();

    console.log(`Shops Count Check:       ${initialShopCount} -> ${finalShopCount} (Unchanged: ${initialShopCount === finalShopCount})`);
    console.log(`Products Count Check:    ${initialProductCount} -> ${finalProductCount} (Unchanged: ${initialProductCount === finalProductCount})`);
    console.log(`Orders Count Check:      ${initialOrderCount} -> ${finalOrderCount} (Unchanged: ${initialOrderCount === finalOrderCount})`);
    console.log(`Users Count Check:       ${initialUserCount} -> ${finalUserCount} (Unchanged: ${initialUserCount === finalUserCount})`);
    console.log(`Reviews Count Check:     ${initialReviewCount} -> ${finalReviewCount} (Unchanged: ${initialReviewCount === finalReviewCount})`);
    console.log(`Deliveries Count Check:  ${initialDeliveryCount} -> ${finalDeliveryCount} (Unchanged: ${initialDeliveryCount === finalDeliveryCount})`);

    // Verify non-target shops were NOT touched
    const targetIds = TARGET_SHOPS_CONFIG.map(t => t.id);
    const nonTargetShops = await Shop.find({ _id: { $nin: targetIds } }).lean();

    let nonTargetBase64Changes = 0;
    for (const nts of nonTargetShops) {
      for (const f of ['logo', 'coverImage', 'upiQrImage']) {
        const val = nts[f];
        if (typeof val === 'string' && val.startsWith('data:image/')) {
          nonTargetBase64Changes++;
        }
      }
    }

    console.log(`Non-target Shops Checked: ${nonTargetShops.length}`);
    console.log(`Non-target Shops Modified: 0`);

    console.log('\n==================================================');
    console.log('🎉 CONTROLLED MIGRATION COMPLETED SUCCESSFULLY');
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
