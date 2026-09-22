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

async function auditBase64Data() {
  console.log('Connecting to MongoDB Atlas...');
  await connectDB();
  console.log('Connected.\n');

  console.log('==================================================');
  console.log('📊 READ-ONLY DATABASE BASE64 AUDIT');
  console.log('==================================================\n');

  // --- PRODUCTS AUDIT ---
  const allProducts = await Product.find({}).lean();
  let base64ProductDocsCount = 0;
  let totalProductBase64Images = 0;
  let totalProductBase64Bytes = 0;
  const base64ProductDetails = [];

  for (const p of allProducts) {
    const imgs = Array.isArray(p.images) ? p.images : [];
    let pBase64Count = 0;
    let pBase64Bytes = 0;

    for (const img of imgs) {
      if (typeof img === 'string' && img.startsWith('data:image/')) {
        pBase64Count++;
        totalProductBase64Images++;
        const b = Buffer.byteLength(img, 'utf8');
        pBase64Bytes += b;
        totalProductBase64Bytes += b;
      }
    }

    if (pBase64Count > 0) {
      base64ProductDocsCount++;
      base64ProductDetails.push({
        id: p._id.toString(),
        name: p.name,
        base64Count: pBase64Count,
        sizeKB: (pBase64Bytes / 1024).toFixed(1),
      });
    }
  }

  console.log('--- PRODUCTS AUDIT RESULT ---');
  console.log(`Total Product Documents:            ${allProducts.length}`);
  console.log(`Products Containing Base64:          ${base64ProductDocsCount}`);
  console.log(`Total Product Base64 Images:         ${totalProductBase64Images}`);
  console.log(`Total Product Base64 Payload Size:   ${(totalProductBase64Bytes / (1024 * 1024)).toFixed(3)} MB (${(totalProductBase64Bytes / 1024).toFixed(1)} KB)`);
  if (base64ProductDetails.length > 0) {
    console.log('\nDetails of Products containing Base64:');
    base64ProductDetails.forEach(p => console.log(`  - [${p.id}] "${p.name}": ${p.base64Count} Base64 image(s), ${p.sizeKB} KB`));
  }

  // --- SHOPS AUDIT ---
  const allShops = await Shop.find({}).lean();
  let base64ShopDocsCount = 0;
  let logoBase64Count = 0;
  let coverBase64Count = 0;
  let qrBase64Count = 0;
  let totalShopBase64Bytes = 0;
  const base64ShopDetails = [];

  for (const s of allShops) {
    let sBase64Count = 0;
    let sBase64Bytes = 0;
    const fieldsWithBase64 = [];

    for (const field of ['logo', 'coverImage', 'upiQrImage']) {
      const val = s[field];
      if (typeof val === 'string' && val.startsWith('data:image/')) {
        sBase64Count++;
        if (field === 'logo') logoBase64Count++;
        if (field === 'coverImage') coverBase64Count++;
        if (field === 'upiQrImage') qrBase64Count++;
        fieldsWithBase64.push(field);
        const b = Buffer.byteLength(val, 'utf8');
        sBase64Bytes += b;
        totalShopBase64Bytes += b;
      }
    }

    if (sBase64Count > 0) {
      base64ShopDocsCount++;
      base64ShopDetails.push({
        id: s._id.toString(),
        name: s.name,
        fields: fieldsWithBase64.join(', '),
        sizeKB: (sBase64Bytes / 1024).toFixed(1),
      });
    }
  }

  console.log('\n--- SHOPS AUDIT RESULT ---');
  console.log(`Total Shop Documents:               ${allShops.length}`);
  console.log(`Shops Containing Base64:             ${base64ShopDocsCount}`);
  console.log(`Logo Base64 Images:                 ${logoBase64Count}`);
  console.log(`CoverImage Base64 Images:            ${coverBase64Count}`);
  console.log(`UPI QR Base64 Images:               ${qrBase64Count}`);
  console.log(`Total Shop Base64 Payload Size:      ${(totalShopBase64Bytes / (1024 * 1024)).toFixed(3)} MB (${(totalShopBase64Bytes / 1024).toFixed(1)} KB)`);
  if (base64ShopDetails.length > 0) {
    console.log('\nDetails of Shops containing Base64:');
    base64ShopDetails.forEach(s => console.log(`  - [${s.id}] "${s.name}": fields [${s.fields}], ${s.sizeKB} KB`));
  }

  console.log('\n==================================================');
  console.log('AUDIT COMPLETE');
  console.log('==================================================\n');

  await mongoose.disconnect();
}

auditBase64Data().catch(err => {
  console.error("Audit error:", err);
  mongoose.disconnect();
});
