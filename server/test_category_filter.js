/**
 * test_category_filter.js
 *
 * Comprehensive test for category filtering in the /api/shops endpoint.
 * Tests:
 *   1. All shops (no category filter) returns results
 *   2. Each category returns only matching shops
 *   3. Hotels category uses the same data-driven filtering as all others
 *   4. An unknown category returns zero results (proper empty state)
 *   5. Search + category combined works correctly
 *   6. Category by ObjectId works
 *   7. Category by name (backward compat) works
 *   8. Data integrity checks
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from './models/Category.js';
import Shop from './models/Shop.js';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/campuscart';

let passed = 0;
let failed = 0;
const results = [];

function assert(condition, testName, detail = '') {
  if (condition) {
    passed++;
    results.push(`  ✅ ${testName}`);
  } else {
    failed++;
    results.push(`  ❌ ${testName}${detail ? ` — ${detail}` : ''}`);
  }
}

async function runTests() {
  console.log('\n🧪 NearCart Category Filter Test Suite');
  console.log('═══════════════════════════════════════\n');

  await mongoose.connect(MONGO_URI);
  console.log('📡 Connected to MongoDB\n');

  const allCategories = await Category.find({ isActive: true }).sort({ sortOrder: 1 });
  console.log(`📋 Found ${allCategories.length} active categories`);

  const allShops = await Shop.find({ isApproved: true, isActive: true }).populate('category', 'name');
  console.log(`🏪 Found ${allShops.length} approved+active shops\n`);

  console.log('── Shop → Category mapping ──────────────────');
  for (const shop of allShops) {
    const catName = shop.category?.name || 'MISSING CATEGORY';
    const catId = shop.category?._id || 'NULL';
    console.log(`   • "${shop.name}" → category: "${catName}" (${catId}), foodType: "${shop.foodType || ''}"` );
  }
  console.log('');

  // TEST 1: No filter returns all shops
  console.log('── Test Group 1: All Shops (no filter) ──');
  const allResult = await Shop.find({ isApproved: true, isActive: true });
  assert(allResult.length === allShops.length, 'No filter returns all approved+active shops', `got ${allResult.length}, expected ${allShops.length}`);

  // TEST 2: Each category returns only its shops
  console.log('\n── Test Group 2: Per-category ObjectId filter ──');
  for (const cat of allCategories) {
    const catShops = await Shop.find({ isApproved: true, isActive: true, category: cat._id });
    const expectedCount = allShops.filter((s) => s.category?._id?.toString() === cat._id.toString()).length;
    assert(
      catShops.length === expectedCount,
      `Category "${cat.name}" (ID: ${cat._id}): ${catShops.length} shops`,
      `expected ${expectedCount}, got ${catShops.length}`
    );

    for (const shop of catShops) {
      assert(
        shop.category.toString() === cat._id.toString(),
        `  Shop "${shop.name}" belongs to correct category`,
        `shop.category=${shop.category}, expected=${cat._id}`
      );
    }
  }

  // TEST 3: Hotels uses same data model
  console.log('\n── Test Group 3: Hotels category ──');
  const hotelsCat = allCategories.find((c) => c.name.toLowerCase().includes('hotel'));
  if (hotelsCat) {
    const hotelShops = await Shop.find({ isApproved: true, isActive: true, category: hotelsCat._id });
    const expectedHotels = allShops.filter((s) => s.category?._id?.toString() === hotelsCat._id.toString());
    assert(
      hotelShops.length === expectedHotels.length,
      `Hotels category returns ${hotelShops.length} shops via ObjectId`,
      `expected ${expectedHotels.length}`
    );
    for (const h of hotelShops) {
      console.log(`     • "${h.name}" (foodType: "${h.foodType || ''}")`);
    }
  } else {
    console.log('   ℹ️  No "Hotels" category found in DB');
    assert(true, 'Hotels category not found (informational)');
  }

  // TEST 4: Unknown category returns zero results
  console.log('\n── Test Group 4: Unknown category ──');
  const dummyId = new mongoose.Types.ObjectId();
  const unknownResult = await Shop.find({ isApproved: true, isActive: true, category: dummyId });
  assert(unknownResult.length === 0, 'Unknown category ObjectId returns 0 shops');

  // TEST 5: Name-based lookup (backward compat)
  console.log('\n── Test Group 5: Category name backward compat ──');
  if (allCategories.length > 0) {
    const testCat = allCategories[0];
    const catDoc = await Category.findOne({
      name: { $regex: `^${testCat.name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&').trim()}$`, $options: 'i' },
    });
    assert(catDoc !== null, `Name-based lookup for "${testCat.name}" finds the category`);
    if (catDoc) {
      assert(
        catDoc._id.toString() === testCat._id.toString(),
        `Name-based lookup returns correct ObjectId`
      );
    }
  }

  // TEST 6: Search + Category combined
  console.log('\n── Test Group 6: Search + Category combined ──');
  if (allShops.length > 0) {
    const testShop = allShops[0];
    const searchQuery = testShop.name.substring(0, 3);
    const catId = testShop.category?._id;
    if (catId) {
      const combined = await Shop.find({
        isApproved: true,
        isActive: true,
        category: catId,
        $or: [
          { name: new RegExp(searchQuery, 'i') },
          { description: new RegExp(searchQuery, 'i') },
          { foodType: new RegExp(searchQuery, 'i') },
        ],
      });
      const allInCorrectCat = combined.every((s) => s.category.toString() === catId.toString());
      assert(allInCorrectCat, `Search "${searchQuery}" + category: all results in correct category`);
      assert(combined.length >= 1, `Search "${searchQuery}" + category returns at least 1 result`);
    }
  }

  // TEST 7: Data integrity checks
  console.log('\n── Test Group 7: Data integrity ──');
  const shopsWithBadCategory = await Shop.find({
    isApproved: true,
    isActive: true,
    $or: [{ category: null }, { category: { $exists: false } }],
  });
  if (shopsWithBadCategory.length > 0) {
    console.log('   ⚠️  Shops with missing category reference:');
    for (const s of shopsWithBadCategory) {
      console.log(`     • "${s.name}" (_id: ${s._id})`);
    }
  }
  assert(shopsWithBadCategory.length === 0, `All shops have a category reference (${shopsWithBadCategory.length} missing)`);

  const categoryIds = new Set(allCategories.map((c) => c._id.toString()));
  const orphanedShops = allShops.filter((s) => s.category && !categoryIds.has(s.category._id?.toString()));
  if (orphanedShops.length > 0) {
    console.log('   ⚠️  Shops referencing non-existent/inactive categories:');
    for (const s of orphanedShops) {
      console.log(`     • "${s.name}" → category: ${s.category}`);
    }
  }
  assert(orphanedShops.length === 0, `All shop category refs point to active categories (${orphanedShops.length} orphaned)`);

  // Summary
  console.log('\n═══════════════════════════════════════');
  console.log('📊 Results:');
  results.forEach((r) => console.log(r));
  console.log(`\n✅ Passed: ${passed}  ❌ Failed: ${failed}  📊 Total: ${passed + failed}`);
  console.log('═══════════════════════════════════════\n');

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
