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
import Category from '../models/Category.js';
import { uploadBase64Image } from '../services/cloudinaryService.js';

// Tiny sample 1x1 transparent GIF Base64 data URLs for testing upload pipeline
const TEST_BASE64_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

async function verifyFutureUploadsPipeline() {
  console.log('Connecting to MongoDB Atlas...');
  await connectDB();
  console.log('Connected.\n');

  console.log('==================================================');
  console.log('🧪 VERIFYING FUTURE SHOP & PRODUCT UPLOAD PIPELINE');
  console.log('==================================================\n');

  // Find a shopkeeper user for test ownership
  const shopkeeperUser = await User.findOne({ role: 'SHOPKEEPER' }) || await User.findOne({});
  const categoryDoc = await Category.findOne({});

  if (!shopkeeperUser || !categoryDoc) {
    console.error('❌ Test Setup Error: Missing Shopkeeper User or Category.');
    process.exit(1);
  }

  // --- TEST A: NEW SHOP UPLOAD TEST ---
  console.log('--- TEST A: NEW SHOP CREATION WITH BASE64 UPLOADS ---');
  const tempShopId = new mongoose.Types.ObjectId();

  console.log(`Simulating shop creation with Base64 logo, cover, and UPI QR...`);
  
  const logoResult = await uploadBase64Image(TEST_BASE64_IMAGE, {
    folder: `nearcart/shops/${tempShopId}/logo`,
    public_id: `logo_${tempShopId}`,
    overwrite: true,
  });

  const coverResult = await uploadBase64Image(TEST_BASE64_IMAGE, {
    folder: `nearcart/shops/${tempShopId}/cover`,
    public_id: `coverImage_${tempShopId}`,
    overwrite: true,
  });

  const qrResult = await uploadBase64Image(TEST_BASE64_IMAGE, {
    folder: `nearcart/shops/${tempShopId}/upi-qr`,
    public_id: `upiQrImage_${tempShopId}`,
    overwrite: true,
  });

  console.log(`Logo Cloudinary URL: ${logoResult.url}`);
  console.log(`Cover Cloudinary URL: ${coverResult.url}`);
  console.log(`UPI QR Cloudinary URL: ${qrResult.url}`);

  // HTTP GET status verification
  const logoHttp = await fetch(logoResult.url, { method: 'GET' });
  const coverHttp = await fetch(coverResult.url, { method: 'GET' });
  const qrHttp = await fetch(qrResult.url, { method: 'GET' });

  console.log(`HTTP 200 Checks -> Logo: ${logoHttp.status}, Cover: ${coverHttp.status}, QR: ${qrHttp.status}`);

  // Create temporary shop document
  const testShop = await Shop.create({
    _id: tempShopId,
    name: 'TEMP TEST AUTOMATED SHOP',
    description: 'Automated upload pipeline test shop',
    owner: shopkeeperUser._id,
    category: categoryDoc._id,
    address: '127.0.0.1 Test Suite',
    logo: logoResult.url,
    coverImage: coverResult.url,
    upiQrImage: qrResult.url,
    upiQrPublicId: qrResult.public_id,
    isApproved: true,
    isActive: true,
  });

  const readShop = await Shop.findById(testShop._id).lean();
  const shopLogoBase64 = readShop.logo.startsWith('data:image/');
  const shopCoverBase64 = readShop.coverImage.startsWith('data:image/');
  const shopQrBase64 = readShop.upiQrImage.startsWith('data:image/');

  console.log(`MongoDB Read-Back Base64 Check -> Logo Base64: ${shopLogoBase64}, Cover Base64: ${shopCoverBase64}, QR Base64: ${shopQrBase64}`);
  console.log(`TEST A RESULT: ${!shopLogoBase64 && !shopCoverBase64 && !shopQrBase64 && logoHttp.ok ? 'PASS ✅' : 'FAIL ❌'}\n`);

  // --- TEST B: NEW PRODUCT UPLOAD TEST ---
  console.log('--- TEST B: NEW PRODUCT CREATION WITH MULTI-IMAGE BASE64 ---');
  console.log('Uploading 3 product images via processImagesForStorage pattern...');

  const productImagesToUpload = [TEST_BASE64_IMAGE, TEST_BASE64_IMAGE, TEST_BASE64_IMAGE];
  const uploadedProductImages = [];

  for (let idx = 0; idx < productImagesToUpload.length; idx++) {
    const pRes = await uploadBase64Image(productImagesToUpload[idx], {
      folder: `nearcart/products/${testShop._id}`,
      public_id: `test_prod_img_${idx}_${Date.now()}`,
      overwrite: true,
    });
    if (pRes.success && pRes.url) {
      uploadedProductImages.push(pRes.url);
    }
  }

  console.log(`Product Image 1 URL: ${uploadedProductImages[0]}`);
  console.log(`Product Image 2 URL: ${uploadedProductImages[1]}`);
  console.log(`Product Image 3 URL: ${uploadedProductImages[2]}`);

  const p1Http = await fetch(uploadedProductImages[0], { method: 'GET' });
  const p2Http = await fetch(uploadedProductImages[1], { method: 'GET' });
  const p3Http = await fetch(uploadedProductImages[2], { method: 'GET' });

  console.log(`HTTP 200 Checks -> Img1: ${p1Http.status}, Img2: ${p2Http.status}, Img3: ${p3Http.status}`);

  const testProduct = await Product.create({
    shop: testShop._id,
    category: categoryDoc._id,
    name: 'TEMP TEST AUTOMATED PRODUCT',
    description: 'Automated product upload test',
    price: 99,
    unit: '1 item',
    stock: 10,
    images: uploadedProductImages,
    isActive: true,
    isAvailable: true,
  });

  const readProduct = await Product.findById(testProduct._id).lean();
  const hasProdBase64 = readProduct.images.some((img) => typeof img === 'string' && img.startsWith('data:image/'));

  console.log(`MongoDB Read-Back Base64 Check -> Product Contains Base64: ${hasProdBase64}`);
  console.log(`TEST B RESULT: ${!hasProdBase64 && p1Http.ok && p2Http.ok && p3Http.ok ? 'PASS ✅' : 'FAIL ❌'}\n`);

  // --- TEST C: SYSTEM-WIDE DATABASE AUDIT ---
  console.log('--- TEST C: SYSTEM-WIDE BASE64 DATABASE AUDIT ---');
  const allShops = await Shop.find({}).lean();
  const allProducts = await Product.find({}).lean();

  let shopBase64Count = 0;
  for (const s of allShops) {
    if (s._id.toString() === testShop._id.toString()) continue; // Ignore temp test shop
    for (const f of ['logo', 'coverImage', 'upiQrImage']) {
      if (typeof s[f] === 'string' && s[f].startsWith('data:image/')) shopBase64Count++;
    }
  }

  let prodBase64Count = 0;
  for (const p of allProducts) {
    if (p._id.toString() === testProduct._id.toString()) continue; // Ignore temp test product
    const imgs = Array.isArray(p.images) ? p.images : [];
    for (const img of imgs) {
      if (typeof img === 'string' && img.startsWith('data:image/')) prodBase64Count++;
    }
  }

  console.log(`System Database Audit -> Shop Base64 Images: ${shopBase64Count}`);
  console.log(`System Database Audit -> Product Base64 Images: ${prodBase64Count}`);
  console.log(`TEST C RESULT: ${shopBase64Count === 0 && prodBase64Count === 0 ? 'PASS ✅' : 'FAIL ❌'}\n`);

  // --- CLEANUP TEMP TEST RECORDS ---
  console.log('Cleaning up temporary test records...');
  await Product.findByIdAndDelete(testProduct._id);
  await Shop.findByIdAndDelete(testShop._id);
  console.log('Temporary test records cleaned.\n');

  console.log('==================================================');
  console.log('🎉 FUTURE UPLOAD PIPELINE VERIFICATION COMPLETE');
  console.log('==================================================\n');

  await mongoose.disconnect();
}

verifyFutureUploadsPipeline().catch((err) => {
  console.error('Verification failed:', err);
  mongoose.disconnect();
});
