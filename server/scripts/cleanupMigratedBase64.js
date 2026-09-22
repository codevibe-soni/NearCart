import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import Product from '../models/Product.js';

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

const runCleanup = async () => {
  const { isDryRun, limit } = parseArgs();

  console.log('\n==================================================');
  console.log('🧹   NEAR CART MIGRATED BASE64 CLEANUP VERIFICATION');
  console.log('==================================================');
  console.log(`Mode: ${isDryRun ? '🔍 DRY-RUN (Preview Mode)' : '🚀 LIVE CLEANUP'}`);
  if (limit > 0) {
    console.log(`Limit: Maximum ${limit} product(s)`);
  }
  console.log('==================================================\n');

  try {
    await connectDB();

    const allProducts = await Product.find({}).lean();
    console.log(`📦 Found ${allProducts.length} total product(s) in database.\n`);

    let fullyMigratedProductsCount = 0;
    let productsWithRemainingBase64Count = 0;
    let totalCloudinaryUrlsVerified = 0;
    let totalBase64ImagesRemaining = 0;

    const targetProducts = limit > 0 ? allProducts.slice(0, limit) : allProducts;

    for (const product of targetProducts) {
      const images = Array.isArray(product.images) ? product.images : [];
      let base64Count = 0;
      let urlCount = 0;

      images.forEach((img) => {
        if (typeof img === 'string' && img.startsWith('data:image/')) {
          base64Count++;
        } else if (typeof img === 'string' && (img.startsWith('http://') || img.startsWith('https://'))) {
          urlCount++;
        }
      });

      if (base64Count > 0) {
        productsWithRemainingBase64Count++;
        totalBase64ImagesRemaining += base64Count;
      } else if (urlCount > 0) {
        fullyMigratedProductsCount++;
        totalCloudinaryUrlsVerified += urlCount;
      }
    }

    console.log('==================================================');
    console.log('📊   CLEANUP AUDIT SUMMARY');
    console.log('==================================================');
    console.log(`Total Products Scanned:                ${targetProducts.length}`);
    console.log(`Fully Migrated Products (URL-only):    ${fullyMigratedProductsCount}`);
    console.log(`Verified Cloudinary/HTTP Images:       ${totalCloudinaryUrlsVerified}`);
    console.log(`Products with Remaining Base64:        ${productsWithRemainingBase64Count}`);
    console.log(`Remaining Base64 Images:               ${totalBase64ImagesRemaining}`);
    console.log('==================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ CRITICAL CLEANUP SCRIPT FAILURE:', err.message);
    process.exit(1);
  }
};

runCleanup();
