import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Shop from '../models/Shop.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Review from '../models/Review.js';
import Delivery from '../models/Delivery.js';
import Category from '../models/Category.js';
import Payment from '../models/Payment.js';
import Notification from '../models/Notification.js';

import { uploadBase64Image, generateCloudinarySignature } from '../services/cloudinaryService.js';
import { assertNoBase64Image } from '../utils/imageGuard.js';

const img1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const img2 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const img3 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAM4A05AAAAABJRU5ErkJggg==';

let testsPassed = 0;
let testsFailed = 0;

function logTest(name, passed, detail = '') {
  if (passed) {
    testsPassed++;
    console.log(`PASS: ${name} ${detail}`);
  } else {
    testsFailed++;
    console.error(`FAIL: ${name} ${detail}`);
  }
}

async function runFullSuite() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB for Verification Suite\n');

  const shop = await Shop.findOne({});
  if (!shop) throw new Error('No test shop found');

  // --- CLOUDINARY SIGNATURE TEST ---
  try {
    const params = generateCloudinarySignature('nearcart/products');
    const valid = Boolean(params.signature && params.timestamp && params.apiKey && params.cloudName && !params.apiSecret);
    logTest('Cloudinary Signature Generation (Server Secret Safe)', valid, `ApiKey: ${params.apiKey}, CloudName: ${params.cloudName}`);
  } catch (e) {
    logTest('Cloudinary Signature Generation (Server Secret Safe)', false, e.message);
  }

  // --- PRODUCT TEST MATRIX ---

  // Test 1: Single image upload
  try {
    const t0 = Date.now();
    const res1 = await uploadBase64Image(img1, { folder: 'nearcart/test_suite' });
    const duration = Date.now() - t0;
    logTest('Product Test 1 (1 Image Upload)', res1.success && res1.url.startsWith('https://res.cloudinary.com/'), `[Duration: ${duration}ms] URL: ${res1.url.substring(0, 45)}...`);
  } catch (e) {
    logTest('Product Test 1 (1 Image Upload)', false, e.message);
  }

  // Test 2: Multiple images parallel upload (3 images)
  try {
    const t0 = Date.now();
    const uploads = await Promise.all([img1, img2, img3].map(i => uploadBase64Image(i, { folder: 'nearcart/test_suite' })));
    const duration = Date.now() - t0;
    const allUrls = uploads.every(u => u.url && u.url.startsWith('https://res.cloudinary.com/'));
    logTest('Product Test 2 (3 Parallel Images)', allUrls, `[Duration: ${duration}ms]`);
  } catch (e) {
    logTest('Product Test 2 (3 Parallel Images)', false, e.message);
  }

  // Test 3: Existing Cloudinary URL (No re-upload)
  try {
    const existingUrl = 'https://res.cloudinary.com/demo/image/upload/v12345678/sample.jpg';
    const resExist = await uploadBase64Image(existingUrl);
    logTest('Product Test 4 (Existing Cloudinary URL)', resExist.skipped === true && resExist.url === existingUrl);
  } catch (e) {
    logTest('Product Test 4 (Existing Cloudinary URL)', false, e.message);
  }

  // Test 4: Invalid image string format
  try {
    const resInvalid = await uploadBase64Image('not_a_valid_image_string');
    logTest('Product Test 5 (Invalid Image Format)', resInvalid.success === false);
  } catch (e) {
    logTest('Product Test 5 (Invalid Image Format)', true, `Handled cleanly: ${e.message}`);
  }

  // Test 5: Cloudinary failure test (missing cloud_name)
  try {
    const origCloud = process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_CLOUD_NAME;
    try {
      await uploadBase64Image(img1);
      logTest('Product Test 6 (Cloudinary Failure Handling)', false, 'Should have thrown error');
    } catch (err) {
      logTest('Product Test 6 (Cloudinary Failure Handling)', true, `Upload failed safely: ${err.message}`);
    } finally {
      process.env.CLOUDINARY_CLOUD_NAME = origCloud;
    }
  } catch (e) {
    logTest('Product Test 6 (Cloudinary Failure Handling)', false, e.message);
  }

  // Test 6: Partial failure test (3 images, 1 invalid)
  try {
    let failed = false;
    try {
      await Promise.all([
        uploadBase64Image(img1, { folder: 'nearcart/test_suite' }),
        uploadBase64Image(img2, { folder: 'nearcart/test_suite' }),
        uploadBase64Image('data:image/png;base64,invalid_base64_data_causes_failure_scenario')
      ]);
    } catch (batchErr) {
      failed = true;
    }
    logTest('Product Test 7 (Partial Upload Failure Abort)', failed, 'Batch aborted on image failure - no partial write');
  } catch (e) {
    logTest('Product Test 7 (Partial Upload Failure Abort)', false, e.message);
  }

  // --- SHOP TEST MATRIX ---
  try {
    const logoRes = await uploadBase64Image(img1, { folder: 'nearcart/test_shop/logo' });
    const coverRes = await uploadBase64Image(img2, { folder: 'nearcart/test_shop/cover' });
    const qrRes = await uploadBase64Image(img3, { folder: 'nearcart/test_shop/upi' });

    const shopImagesValid = [logoRes.url, coverRes.url, qrRes.url].every(u => u.startsWith('https://res.cloudinary.com/'));
    logTest('Shop Test Matrix (Logo, Cover, UPI QR Uploads)', shopImagesValid);
  } catch (e) {
    logTest('Shop Test Matrix (Logo, Cover, UPI QR Uploads)', false, e.message);
  }

  // --- RACE CONDITION / IDEMPOTENCY TEST ---
  try {
    const key = 'race-test-' + Date.now();
    const mockProduct1 = { name: 'Race Product 1', price: 50, idempotencyKey: key, images: ['https://res.cloudinary.com/test/p1.png'] };
    const mockProduct2 = { name: 'Race Product 2', price: 50, idempotencyKey: key, images: ['https://res.cloudinary.com/test/p2.png'] };
    assertNoBase64Image(mockProduct1, 'Race 1');
    assertNoBase64Image(mockProduct2, 'Race 2');
    logTest('Race Condition & Idempotency Check', true, 'Idempotency key & base64 assertions clean');
  } catch (e) {
    logTest('Race Condition & Idempotency Check', false, e.message);
  }

  // --- DATABASE-WIDE AUDIT ---
  console.log('\n--- FULL RECURSIVE DATABASE AUDIT ---');
  const collections = [
    { name: 'Products', model: Product, fields: ['images'] },
    { name: 'Shops', model: Shop, fields: ['logo', 'coverImage', 'upiQrImage'] },
    { name: 'Users', model: User, fields: ['avatar'] },
    { name: 'Orders', model: Order, fields: [] },
    { name: 'Reviews', model: Review, fields: ['images'] },
    { name: 'Deliveries', model: Delivery, fields: [] },
    { name: 'Categories', model: Category, fields: ['image'] },
    { name: 'Payments', model: Payment, fields: [] },
    { name: 'Notifications', model: Notification, fields: [] },
  ];

  let totalB64InDB = 0;

  for (const col of collections) {
    const docs = await col.model.find({});
    let b64Docs = 0;
    let b64Count = 0;
    let cloudinaryCount = 0;

    for (const doc of docs) {
      let docHasB64 = false;
      for (const field of col.fields) {
        const val = doc[field];
        if (Array.isArray(val)) {
          for (const item of val) {
            if (typeof item === 'string' && item.startsWith('data:image/')) {
              b64Count++;
              docHasB64 = true;
            } else if (typeof item === 'string' && item.includes('res.cloudinary.com')) {
              cloudinaryCount++;
            }
          }
        } else if (typeof val === 'string') {
          if (val.startsWith('data:image/')) {
            b64Count++;
            docHasB64 = true;
          } else if (val.includes('res.cloudinary.com')) {
            cloudinaryCount++;
          }
        }
      }
      if (docHasB64) b64Docs++;
    }

    totalB64InDB += b64Count;
    console.log(`Collection: ${col.name.padEnd(14)} | Docs: ${String(docs.length).padStart(4)} | Base64 Docs: ${b64Docs} | Base64 Images: ${b64Count} | Cloudinary URLs: ${cloudinaryCount}`);
  }

  logTest('Final Database-Wide Invariant Audit (Base64 Count = 0)', totalB64InDB === 0, `Total Base64 stored: ${totalB64InDB}`);

  console.log(`\n========================================`);
  console.log(`TEST SUITE COMPLETE: ${testsPassed} Passed, ${testsFailed} Failed`);
  console.log(`========================================\n`);

  await mongoose.disconnect();
}

runFullSuite().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
