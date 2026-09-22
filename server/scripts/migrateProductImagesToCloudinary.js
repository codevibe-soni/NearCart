import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import Product from '../models/Product.js';
import { uploadBase64Image } from '../services/cloudinaryService.js';
import { isCloudinaryConfigured } from '../config/cloudinary.js';

dotenv.config();

const parseArgs = () => {
  const args = process.argv.slice(2);
  let isDryRun = false;
  let limit = 0;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') {
      isDryRun = true;
    } else if (arg.startsWith('--limit=')) {
      const val = parseInt(arg.split('=')[1], 10);
      if (!isNaN(val) && val > 0) limit = val;
    } else if (arg === '--limit' && args[i + 1]) {
      const val = parseInt(args[i + 1], 10);
      if (!isNaN(val) && val > 0) {
        limit = val;
        i++;
      }
    }
  }

  return { isDryRun, limit };
};

const runMigration = async () => {
  const { isDryRun, limit } = parseArgs();

  console.log('\n==================================================');
  console.log('🖼️   NEAR CART PRODUCT IMAGE CLOUDINARY MIGRATION');
  console.log('==================================================');
  console.log(`Mode: ${isDryRun ? '🔍 DRY-RUN (Preview Mode - No changes will be made)' : '🚀 LIVE MIGRATION'}`);
  if (limit > 0) {
    console.log(`Limit: Processing maximum ${limit} product(s)`);
  }
  console.log('==================================================\n');

  if (!isDryRun && !isCloudinaryConfigured()) {
    console.error('❌ CRITICAL ERROR: Cloudinary environment variables are missing!');
    console.error('Please ensure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are set in server/.env\n');
    process.exit(1);
  }

  try {
    await connectDB();

    const allProducts = await Product.find({}).lean();
    console.log(`📦 Found ${allProducts.length} total product(s) in database.\n`);

    let productsRequiringMigrationCount = 0;
    let totalBase64ImagesFound = 0;
    let totalAlreadyMigratedImages = 0;
    let totalUploadedImages = 0;
    let totalFailedUploads = 0;
    let productsUpdatedCount = 0;
    let productsSkippedCount = 0;

    const productsToProcess = [];
    for (const p of allProducts) {
      const imgs = Array.isArray(p.images) ? p.images : [];
      const hasBase64 = imgs.some((img) => typeof img === 'string' && img.startsWith('data:image/'));
      if (hasBase64) {
        productsToProcess.push(p);
        if (limit > 0 && productsToProcess.length >= limit) {
          break;
        }
      }
    }

    console.log(`🎯 Identified ${productsToProcess.length} product(s) requiring Base64 migration for this execution.\n`);

    for (let pIdx = 0; pIdx < productsToProcess.length; pIdx++) {
      const product = productsToProcess[pIdx];
      const images = Array.isArray(product.images) ? product.images : [];

      let base64CountInProduct = 0;
      images.forEach((img) => {
        if (typeof img === 'string' && img.startsWith('data:image/')) {
          base64CountInProduct++;
        } else if (typeof img === 'string' && (img.startsWith('http://') || img.startsWith('https://'))) {
          totalAlreadyMigratedImages++;
        }
      });

      productsRequiringMigrationCount++;
      totalBase64ImagesFound += base64CountInProduct;

      console.log(`[${pIdx + 1}/${productsToProcess.length}] Product: "${product.name}" (ID: ${product._id}) - ${base64CountInProduct} Base64 image(s) found.`);

      if (isDryRun) {
        continue;
      }

      const updatedImages = [...images];
      let productImagesMigratedSuccessfully = 0;
      let productImagesFailed = 0;

      for (let i = 0; i < images.length; i++) {
        const img = images[i];

        if (typeof img === 'string' && img.startsWith('data:image/')) {
          console.log(`   ⏳ Uploading image index [${i}] to Cloudinary...`);

          const publicId = `${product._id}/img_${i}_${Date.now()}`;
          const result = await uploadBase64Image(img, { public_id: publicId });

          if (result.success && result.url && result.url.startsWith('https://')) {
            // HTTP reachability verification check
            try {
              const fetchRes = await fetch(result.url, { method: 'GET' });
              if (fetchRes.ok || fetchRes.status === 200 || fetchRes.status === 304) {
                updatedImages[i] = result.url;
                productImagesMigratedSuccessfully++;
                totalUploadedImages++;
                console.log(`   ✓ Image [${i}] uploaded & HTTP ${fetchRes.status} verified: ${result.url}`);
              } else {
                console.warn(`   ⚠️ Image [${i}] URL HTTP check returned status ${fetchRes.status}. Keeping Base64.`);
                productImagesFailed++;
                totalFailedUploads++;
              }
            } catch (httpErr) {
              console.warn(`   ⚠️ Image [${i}] URL HTTP check failed: ${httpErr.message}. Keeping Base64.`);
              productImagesFailed++;
              totalFailedUploads++;
            }
          } else {
            productImagesFailed++;
            totalFailedUploads++;
            console.warn(`   ⚠️ Image [${i}] upload failed. Keeping original Base64. Error: ${result.error}`);
          }
        }
      }

      if (productImagesMigratedSuccessfully > 0) {
        const prodDoc = await Product.findById(product._id);
        if (prodDoc) {
          prodDoc.images = updatedImages;
          await prodDoc.save();
        }
        productsUpdatedCount++;
        console.log(`   ✅ Updated Product ${product._id} in MongoDB (${productImagesMigratedSuccessfully} image(s) replaced).\n`);
      } else {
        console.warn(`   ⚠️ No images were updated for Product ${product._id}.\n`);
      }
    }

    console.log('\n==================================================');
    console.log('📊   MIGRATION SUMMARY RESULT');
    console.log('==================================================');
    console.log(`Mode:                             ${isDryRun ? 'DRY-RUN (Preview)' : 'LIVE MIGRATION'}`);
    console.log(`Total Products Processed:        ${productsToProcess.length}`);
    console.log(`Products Requiring Migration:    ${productsRequiringMigrationCount}`);
    console.log(`Products Skipped/Migrated:       ${productsSkippedCount}`);
    console.log(`Base64 Images Found:             ${totalBase64ImagesFound}`);
    console.log(`Already Cloudinary/HTTP Images:   ${totalAlreadyMigratedImages}`);
    if (!isDryRun) {
      console.log(`Images Successfully Uploaded:    ${totalUploadedImages}`);
      console.log(`Failed Image Uploads:            ${totalFailedUploads}`);
      console.log(`Products Updated in MongoDB:     ${productsUpdatedCount}`);
    } else {
      console.log('\n✨ DRY-RUN COMPLETE: No Cloudinary uploads or MongoDB updates were made.');
    }
    console.log('==================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ CRITICAL MIGRATION SCRIPT FAILURE:', err.message);
    process.exit(1);
  }
};

runMigration();
