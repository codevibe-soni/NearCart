import dotenv from 'dotenv';
dotenv.config({ path: './.env' });
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Shop from '../models/Shop.js';
import { uploadBase64Image } from '../services/cloudinaryService.js';

async function migrateRemainingB64() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const products = await Product.find({});
  for (const p of products) {
    let modified = false;
    const newImages = [];
    for (const img of p.images || []) {
      if (typeof img === 'string' && img.startsWith('data:image/')) {
        const uploadRes = await uploadBase64Image(img, { folder: 'nearcart/products' });
        if (uploadRes.success && uploadRes.url) {
          newImages.push(uploadRes.url);
          modified = true;
        }
      } else {
        newImages.push(img);
      }
    }
    if (modified) {
      p.images = newImages;
      await p.save();
      console.log('Migrated product Base64 to Cloudinary:', p.name);
    }
  }

  const shops = await Shop.find({});
  for (const s of shops) {
    let modified = false;
    if (typeof s.logo === 'string' && s.logo.startsWith('data:image/')) {
      const res = await uploadBase64Image(s.logo, { folder: `nearcart/shops/${s._id}/logo` });
      if (res.success && res.url) {
        s.logo = res.url;
        modified = true;
      }
    }
    if (typeof s.coverImage === 'string' && s.coverImage.startsWith('data:image/')) {
      const res = await uploadBase64Image(s.coverImage, { folder: `nearcart/shops/${s._id}/cover` });
      if (res.success && res.url) {
        s.coverImage = res.url;
        modified = true;
      }
    }
    if (typeof s.upiQrImage === 'string' && s.upiQrImage.startsWith('data:image/')) {
      const res = await uploadBase64Image(s.upiQrImage, { folder: `nearcart/shops/${s._id}/upi` });
      if (res.success && res.url) {
        s.upiQrImage = res.url;
        modified = true;
      }
    }
    if (modified) {
      await s.save();
      console.log('Migrated shop Base64 to Cloudinary:', s.name);
    }
  }

  console.log('All remaining Base64 images migrated to Cloudinary.');
  await mongoose.disconnect();
}
migrateRemainingB64();
