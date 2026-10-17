/**
 * seed_categories.js
 *
 * Idempotent NearCart category seed script.
 *
 * Usage:
 *   node seed_categories.js
 *   (or via npm: npm run seed-categories)
 *
 * Behaviour:
 *   - Connects to MongoDB using MONGO_URI from .env
 *   - Checks existing categories (case-insensitive name match)
 *   - Skips categories that already exist
 *   - Inserts only new categories
 *   - Safe to run multiple times — no duplicates created
 *   - Does NOT delete or modify existing categories
 *   - Does NOT break existing products (ObjectId refs unchanged)
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from './models/Category.js';

dotenv.config();

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY DEFINITIONS
// sortOrder controls display order (lower = shown first).
// Existing "General" is preserved at sortOrder 99 if it already exists.
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  // ── Priority campus/student categories ──
  {
    name: 'Food & Beverages',
    description: 'Meals, snacks and all types of beverages',
    sortOrder: 1,
  },
  {
    name: 'Hotels',
    description: 'Hotels, lodges and hospitality services',
    sortOrder: 2,
  },
  {
    name: 'Grocery',
    description: 'Daily grocery essentials — rice, pulses, oil, spices and more',
    sortOrder: 3,
  },
  {
    name: 'Snacks & Drinks',
    description: 'Packaged snacks, cold drinks, juices and energy drinks',
    sortOrder: 3,
  },
  {
    name: 'Stationery & Books',
    description: 'Notebooks, pens, pencils, files, art supplies and calculators',
    sortOrder: 4,
  },
  {
    name: 'Personal Care',
    description: 'Bath, hair, oral care, skin care and deodorants',
    sortOrder: 5,
  },
  {
    name: 'Health & Wellness',
    description: 'First aid, general wellness, hygiene and personal health essentials',
    sortOrder: 6,
  },
  {
    name: 'Fruits & Vegetables',
    description: 'Fresh fruits and vegetables',
    sortOrder: 7,
  },
  {
    name: 'Dairy & Bakery',
    description: 'Milk, eggs, bread, dairy products and baked goods',
    sortOrder: 8,
  },
  {
    name: 'Hostel Essentials',
    description: 'Must-have items for hostel and dorm life',
    sortOrder: 9,
  },
  {
    name: 'College Essentials',
    description: 'Everything a college student needs on campus',
    sortOrder: 10,
  },
  {
    name: 'Household Essentials',
    description: 'Basic home and living essentials',
    sortOrder: 11,
  },
  {
    name: 'Electronics & Accessories',
    description: 'Chargers, cables, earphones, power banks and small electronics',
    sortOrder: 12,
  },
  {
    name: 'Mobile Accessories',
    description: 'Mobile covers, screen guards, holders and accessories',
    sortOrder: 13,
  },
  {
    name: 'Cleaning & Laundry',
    description: 'Detergents, cleaning supplies and laundry essentials',
    sortOrder: 14,
  },
  {
    name: 'Beauty & Grooming',
    description: 'Cosmetics, grooming products and beauty accessories',
    sortOrder: 15,
  },
  {
    name: 'Instant & Ready-to-Eat',
    description: 'Instant noodles, ready-to-eat meals and quick snacks',
    sortOrder: 16,
  },
  {
    name: 'Home & Kitchen',
    description: 'Kitchenware, home goods and household items',
    sortOrder: 17,
  },
  {
    name: 'Kitchen Essentials',
    description: 'Cooking tools, utensils and kitchen must-haves',
    sortOrder: 18,
  },
  {
    name: 'School & College Essentials',
    description: 'School and college supplies for students',
    sortOrder: 19,
  },
  {
    name: 'Sports & Fitness',
    description: 'Sports equipment, fitness accessories and outdoor essentials',
    sortOrder: 20,
  },
  {
    name: 'Travel Essentials',
    description: 'Travel bags, water bottles, locks and travel accessories',
    sortOrder: 21,
  },
  {
    name: 'Gifts & Accessories',
    description: 'Gifts, accessories and lifestyle products',
    sortOrder: 22,
  },
  {
    name: 'Books & Educational Materials',
    description: 'Textbooks, study guides and educational materials',
    sortOrder: 23,
  },
  {
    name: 'Office Supplies',
    description: 'Stationery, files and office essentials',
    sortOrder: 24,
  },
  {
    name: 'Computer & Study Accessories',
    description: 'Keyboards, mice, USB drives and study accessories',
    sortOrder: 25,
  },
  {
    name: 'Baby Care',
    description: 'Baby products, diapers and infant essentials',
    sortOrder: 26,
  },
  {
    name: 'Pet Care',
    description: 'Pet food, accessories and care products',
    sortOrder: 27,
  },
  {
    name: 'Electrical & Lighting',
    description: 'Bulbs, adapters, extension cords and electrical items',
    sortOrder: 28,
  },
  {
    name: 'Footwear',
    description: 'Shoes, sandals, slippers and footwear accessories',
    sortOrder: 29,
  },
  {
    name: 'Clothing & Fashion',
    description: 'Apparel, clothing and fashion accessories',
    sortOrder: 30,
  },
  {
    name: 'Seasonal & Festival',
    description: 'Festive decorations, seasonal and special occasion items',
    sortOrder: 31,
  },
  {
    name: 'Emergency Essentials',
    description: 'First aid supplies, urgent medicines and emergency items',
    sortOrder: 32,
  },
  {
    name: 'Other',
    description: 'Miscellaneous products that do not fit other categories',
    sortOrder: 98,
  },
  // ── Preserved fallback ──
  {
    name: 'General',
    description: 'General items',
    sortOrder: 99,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
async function seedCategories() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campuscart';

  console.log('\n🌱 NearCart Category Seed Script');
  console.log('─────────────────────────────────');
  console.log(`📡 Connecting to: ${mongoUri.replace(/\/\/.*@/, '//<credentials>@')}`);

  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB\n');

  // Fetch all existing category names (case-insensitive comparison)
  const existing = await Category.find({}).select('name sortOrder');
  const existingNamesLower = new Set(existing.map((c) => c.name.trim().toLowerCase()));

  console.log(`📋 Existing categories in DB: ${existing.length}`);
  if (existing.length > 0) {
    existing.forEach((c) => console.log(`   • ${c.name}`));
  }
  console.log('');

  let inserted = 0;
  let skipped = 0;
  const insertedNames = [];
  const skippedNames = [];

  for (const cat of CATEGORIES) {
    const normalizedName = cat.name.trim().toLowerCase();

    if (existingNamesLower.has(normalizedName)) {
      skipped++;
      skippedNames.push(cat.name);
      continue;
    }

    try {
      await Category.create({
        name: cat.name.trim(),
        description: cat.description || '',
        sortOrder: cat.sortOrder,
        isActive: true,
      });
      inserted++;
      insertedNames.push(cat.name);
      existingNamesLower.add(normalizedName); // prevent in-loop duplicates
    } catch (err) {
      // Catch unique constraint race conditions
      if (err.code === 11000) {
        skipped++;
        skippedNames.push(cat.name + ' (duplicate key)');
      } else {
        console.error(`❌ Failed to insert "${cat.name}": ${err.message}`);
      }
    }
  }

  console.log('─────────────────────────────────');
  console.log(`✅ Inserted: ${inserted} new categories`);
  if (insertedNames.length > 0) {
    insertedNames.forEach((n) => console.log(`   ✚ ${n}`));
  }

  console.log(`\n⏭  Skipped: ${skipped} (already exist)`);
  if (skippedNames.length > 0) {
    skippedNames.forEach((n) => console.log(`   ↩ ${n}`));
  }

  const total = await Category.countDocuments({});
  console.log(`\n📦 Total categories in DB: ${total}`);
  console.log('─────────────────────────────────');
  console.log('🎉 Category seed complete!\n');

  await mongoose.disconnect();
}

seedCategories().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
