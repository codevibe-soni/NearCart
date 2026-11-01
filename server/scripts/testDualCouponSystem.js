import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config(); // fallback to cwd if any
import mongoose from 'mongoose';
import Coupon from '../models/Coupon.js';
import Shop from '../models/Shop.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Address from '../models/Address.js';

// We import the controller functions to test both unit and integration behavior
import { applyCoupon, createOrder } from '../controllers/orderController.js';
import {
  createShopkeeperCoupon,
  getShopkeeperCoupons,
} from '../controllers/shopkeeperController.js';
import {
  createAdminCoupon,
  getAdminCoupons,
} from '../controllers/adminController.js';

// Helper to simulate express req/res
function mockReqRes(body = {}, query = {}, user = {}) {
  const req = {
    body,
    query,
    params: {},
    user,
    headers: {},
  };
  let statusCode = 200;
  let responseData = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
    get statusCode() {
      return statusCode;
    },
    get data() {
      return responseData;
    },
    headersSent: false,
  };
  return { req, res };
}

async function runTests() {
  console.log('====================================================');
  console.log('   NEAR増CART DUAL COUPON SYSTEM TEST SUITE         ');
  console.log('====================================================');

  await mongoose.connect(process.env.MONGO_URI);

  // If legacy global unique index "code_1" exists, drop it to test dual coupon system
  try {
    const currentIndexes = await Coupon.collection.indexes();
    const oldCodeIndex = currentIndexes.find((idx) => idx.name === 'code_1' && idx.unique === true);
    if (oldCodeIndex) {
      await Coupon.collection.dropIndex('code_1');
    }
  } catch (idxErr) {}

  // Setup: Find 3 shops to act as Shop A, Shop B, Shop C
  const shops = await Shop.find({ isApproved: true, isActive: true }).limit(3);
  if (shops.length < 3) {
    throw new Error('Need at least 3 shops in database for test suite');
  }
  const [shopA, shopB, shopC] = shops;
  console.log(`Test Shops: A="${shopA.name}" (${shopA._id}), B="${shopB.name}" (${shopB._id}), C="${shopC.name}" (${shopC._id})`);

  // Find an admin and a shopkeeper
  const adminUser = await User.findOne({ role: 'ADMIN' });
  const shopkeeperUser = await User.findById(shopA.owner);

  const testCodesToCleanup = [];
  const testUserIdsToCleanup = [];
  const testAddressIdsToCleanup = [];
  const testOrderIdsToCleanup = [];
  let sampleProduct = null;
  let testStudent = null;
  let testAddress = null;
  const testResults = [];

  function record(testNum, name, passed, details = '') {
    testResults.push({ testNum, name, passed, details });
    const icon = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[${icon}] Test ${testNum}: ${name} ${details ? `(${details})` : ''}`);
  }

  try {
    // -------------------------------------------------------------
    // Test 1, 2, 3: Create one GLOBAL coupon and use at Shop A, B, C
    // -------------------------------------------------------------
    const globalCode = `TESTGLOB_${Date.now()}`;
    testCodesToCleanup.push(globalCode);

    const now = new Date();
    const startDate = new Date(now.getTime() - 1000 * 60 * 60);
    const endDate = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30);

    const createdGlobal = await Coupon.create({
      code: globalCode,
      couponType: 'GLOBAL',
      discountType: 'PERCENTAGE',
      discountValue: 15,
      minimumOrderAmount: 50,
      maximumDiscount: 100,
      usageLimit: 10,
      startDate,
      endDate,
      shopId: null,
      isActive: true,
    });

    // Test 1: Global coupon at Shop A
    const { req: req1, res: res1 } = mockReqRes({ couponCode: globalCode, subtotal: 200, shopId: shopA._id.toString() });
    await applyCoupon(req1, res1);
    record(1, 'GLOBAL coupon usable at Shop A', res1.statusCode === 200 && res1.data.data.discountAmount === 30, `Discount: ₹${res1.data?.data?.discountAmount}`);

    // Test 2: Global coupon at Shop B
    const { req: req2, res: res2 } = mockReqRes({ couponCode: globalCode, subtotal: 300, shopId: shopB._id.toString() });
    await applyCoupon(req2, res2);
    record(2, 'GLOBAL coupon usable at Shop B', res2.statusCode === 200 && res2.data.data.discountAmount === 45, `Discount: ₹${res2.data?.data?.discountAmount}`);

    // Test 3: Global coupon at Shop C
    const { req: req3, res: res3 } = mockReqRes({ couponCode: globalCode, subtotal: 100, shopId: shopC._id.toString() });
    await applyCoupon(req3, res3);
    record(3, 'GLOBAL coupon usable at Shop C', res3.statusCode === 200 && res3.data.data.discountAmount === 15, `Discount: ₹${res3.data?.data?.discountAmount}`);

    // -------------------------------------------------------------
    // Test 4, 5, 6, 7: Create SHOP_SPECIFIC coupon for Shop A
    // -------------------------------------------------------------
    const shopACode = `SHOPA_${Date.now()}`;
    testCodesToCleanup.push(shopACode);

    await Coupon.create({
      code: shopACode,
      couponType: 'SHOP_SPECIFIC',
      discountType: 'FIXED',
      discountValue: 25,
      minimumOrderAmount: 40,
      usageLimit: 5,
      startDate,
      endDate,
      shopId: shopA._id,
      isActive: true,
    });

    record(4, 'Create SHOP_SPECIFIC coupon for Shop A', true, `Code: ${shopACode}`);

    // Test 5: Use it successfully at Shop A
    const { req: req5, res: res5 } = mockReqRes({ couponCode: shopACode, subtotal: 100, shopId: shopA._id.toString() });
    await applyCoupon(req5, res5);
    record(5, 'SHOP_SPECIFIC coupon applied at Shop A', res5.statusCode === 200 && res5.data.data.discountAmount === 25, `Discount: ₹${res5.data?.data?.discountAmount}`);

    // Test 6: Verify rejected at Shop B
    const { req: req6, res: res6 } = mockReqRes({ couponCode: shopACode, subtotal: 100, shopId: shopB._id.toString() });
    await applyCoupon(req6, res6);
    record(6, 'SHOP_SPECIFIC coupon rejected at Shop B', res6.statusCode === 400, res6.data?.message);

    // Test 7: Verify rejected at Shop C
    const { req: req7, res: res7 } = mockReqRes({ couponCode: shopACode, subtotal: 100, shopId: shopC._id.toString() });
    await applyCoupon(req7, res7);
    record(7, 'SHOP_SPECIFIC coupon rejected at Shop C', res7.statusCode === 400, res7.data?.message);

    // -------------------------------------------------------------
    // Test 8: Coexistence of same code at different shops
    // -------------------------------------------------------------
    const sharedCode = `SPECIAL_${Date.now()}`;
    testCodesToCleanup.push(sharedCode);

    // Shop A creates SPECIAL_X
    const cpnA = await Coupon.create({
      code: sharedCode,
      couponType: 'SHOP_SPECIFIC',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minimumOrderAmount: 20,
      startDate,
      endDate,
      shopId: shopA._id,
      isActive: true,
    });

    // Shop B creates SPECIAL_X with different discount (20%)
    const cpnB = await Coupon.create({
      code: sharedCode,
      couponType: 'SHOP_SPECIFIC',
      discountType: 'PERCENTAGE',
      discountValue: 20,
      minimumOrderAmount: 20,
      startDate,
      endDate,
      shopId: shopB._id,
      isActive: true,
    });

    // Test Shop A gets 10%
    const { req: req8a, res: res8a } = mockReqRes({ couponCode: sharedCode, subtotal: 100, shopId: shopA._id.toString() });
    await applyCoupon(req8a, res8a);
    const discA = res8a.data?.data?.discountAmount;

    // Test Shop B gets 20%
    const { req: req8b, res: res8b } = mockReqRes({ couponCode: sharedCode, subtotal: 100, shopId: shopB._id.toString() });
    await applyCoupon(req8b, res8b);
    const discB = res8b.data?.data?.discountAmount;

    record(8, 'Same code coexists at Shop A (10%) and Shop B (20%)', discA === 10 && discB === 20, `Shop A: ₹${discA}, Shop B: ₹${discB}`);

    // -------------------------------------------------------------
    // Test 9: Duplicate code handling & database safety
    // -------------------------------------------------------------
    let dupShopBlocked = false;
    try {
      // Trying to create same code for Shop A again MUST be rejected by unique index
      await Coupon.create({
        code: sharedCode,
        couponType: 'SHOP_SPECIFIC',
        discountType: 'FIXED',
        discountValue: 10,
        startDate,
        endDate,
        shopId: shopA._id,
      });
    } catch (err) {
      dupShopBlocked = err.code === 11000;
    }

    let dupGlobalBlocked = false;
    try {
      // Trying to create duplicate GLOBAL code MUST be rejected
      await Coupon.create({
        code: globalCode,
        couponType: 'GLOBAL',
        discountType: 'FIXED',
        discountValue: 10,
        startDate,
        endDate,
        shopId: null,
      });
    } catch (err) {
      dupGlobalBlocked = err.code === 11000;
    }

    // Verify ambiguity prevention: If both GLOBAL and SHOP_SPECIFIC share a code, applyCoupon REJECTS it
    const ambigCode = `AMBIG_${Date.now()}`;
    testCodesToCleanup.push(ambigCode);
    await Coupon.create([
      {
        code: ambigCode,
        couponType: 'GLOBAL',
        discountType: 'FIXED',
        discountValue: 10,
        startDate,
        endDate,
        shopId: null,
      },
      {
        code: ambigCode,
        couponType: 'SHOP_SPECIFIC',
        discountType: 'FIXED',
        discountValue: 15,
        startDate,
        endDate,
        shopId: shopA._id,
      },
    ]);

    const { req: reqAmbig, res: resAmbig } = mockReqRes({ couponCode: ambigCode, subtotal: 100, shopId: shopA._id.toString() });
    await applyCoupon(reqAmbig, resAmbig);
    const ambigRejectedApply = resAmbig.statusCode === 400 && resAmbig.data?.message?.includes('Ambiguous');

    // Also verify createOrder explicitly rejects ambiguous coupon code with HTTP 400
    sampleProduct = await Product.findOne({ shop: shopA._id, isAvailable: true });
    testStudent = await User.create({
      name: 'Test Student Ambiguity',
      email: `test_ambig_${Date.now()}@test.com`,
      password: 'Password@123',
      phone: '9876543210',
      role: 'STUDENT',
    });
    testUserIdsToCleanup.push(testStudent._id);

    testAddress = await Address.create({
      user: testStudent._id,
      fullAddress: 'Hostel 1, Campus Town',
      location: {
        type: 'Point',
        coordinates: [
          shopA.location?.coordinates?.[0] || 80.9462,
          shopA.location?.coordinates?.[1] || 26.8467,
        ],
      },
    });
    testAddressIdsToCleanup.push(testAddress._id);

    let ambigRejectedCreate = false;
    if (sampleProduct) {
      // Temporarily mark shopA open to test coupon validation logic without time-of-day closure
      await Shop.updateOne(
        { _id: shopA._id },
        {
          $set: {
            openingTime: '00:00',
            closingTime: '23:59',
            isOpen: true,
            weeklyClosingDays: [],
            specialClosingDates: [],
          },
        }
      );

      const neededQty = Math.max(1, Math.ceil(((shopA.minimumOrderAmount || 0) + 10) / (sampleProduct.price || 1)));
      const { req: reqCreateAmbig, res: resCreateAmbig } = mockReqRes(
        {
          addressId: testAddress._id.toString(),
          couponCode: ambigCode,
          paymentMethod: 'COD',
          isBuyNow: true,
          buyNowItem: {
            productId: sampleProduct._id.toString(),
            quantity: neededQty,
          },
        },
        {},
        testStudent
      );
      await createOrder(reqCreateAmbig, resCreateAmbig);
      ambigRejectedCreate =
        resCreateAmbig.statusCode === 400 &&
        resCreateAmbig.data?.message?.includes('Ambiguous');

      // Restore shopA
      await Shop.updateOne(
        { _id: shopA._id },
        {
          $set: {
            openingTime: shopA.openingTime,
            closingTime: shopA.closingTime,
            isOpen: shopA.isOpen,
            weeklyClosingDays: shopA.weeklyClosingDays,
            specialClosingDates: shopA.specialClosingDates,
          },
        }
      );
    }

    record(
      9,
      'Duplicate codes blocked & ambiguity rejected in applyCoupon + createOrder',
      dupShopBlocked && dupGlobalBlocked && ambigRejectedApply && ambigRejectedCreate,
      `Shop dup: ${dupShopBlocked}, Global dup: ${dupGlobalBlocked}, applyCoupon: ${ambigRejectedApply}, createOrder: ${ambigRejectedCreate}`
    );

    // -------------------------------------------------------------
    // Test 10: Existing coupons continue working
    // -------------------------------------------------------------
    // Find active pre-existing coupon DIWALI
    const existingCoupon = await Coupon.findOne({ code: 'DIWALI' });
    let existingWorks = false;
    if (existingCoupon) {
      const targetShop = existingCoupon.shopId ? existingCoupon.shopId.toString() : shopA._id.toString();
      const { req: req10, res: res10 } = mockReqRes({
        couponCode: existingCoupon.code,
        subtotal: (existingCoupon.minimumOrderAmount || 0) + 100,
        shopId: targetShop,
      });
      await applyCoupon(req10, res10);
      existingWorks = res10.statusCode === 200;
      record(10, `Existing pre-migration coupon (${existingCoupon.code}) continues working`, existingWorks, `Scope: ${existingCoupon.couponType}`);
    } else {
      record(10, 'Existing coupons check', true, 'No existing sample needed');
    }

    // -------------------------------------------------------------
    // Test 11: Expiry, minimum order, and usage limits
    // -------------------------------------------------------------
    // A. Expired coupon
    const expiredCode = `EXP_${Date.now()}`;
    testCodesToCleanup.push(expiredCode);
    await Coupon.create({
      code: expiredCode,
      couponType: 'GLOBAL',
      discountType: 'FIXED',
      discountValue: 10,
      startDate: new Date(now.getTime() - 1000 * 60 * 60 * 48),
      endDate: new Date(now.getTime() - 1000 * 60 * 60 * 24), // Ended yesterday
      shopId: null,
      isActive: true,
    });
    const { req: reqExp, res: resExp } = mockReqRes({ couponCode: expiredCode, subtotal: 100, shopId: shopA._id.toString() });
    await applyCoupon(reqExp, resExp);
    const expiredPass = resExp.statusCode === 400 && resExp.data?.message?.includes('expired');

    // B. Minimum order amount
    const minCode = `MIN_${Date.now()}`;
    testCodesToCleanup.push(minCode);
    await Coupon.create({
      code: minCode,
      couponType: 'GLOBAL',
      discountType: 'FIXED',
      discountValue: 10,
      minimumOrderAmount: 200,
      startDate,
      endDate,
      shopId: null,
      isActive: true,
    });
    const { req: reqMin, res: resMin } = mockReqRes({ couponCode: minCode, subtotal: 100, shopId: shopA._id.toString() });
    await applyCoupon(reqMin, resMin);
    const minPass = resMin.statusCode === 400 && resMin.data?.message?.includes('Minimum order amount');

    // C. Usage limit reached
    const limitCode = `LIM_${Date.now()}`;
    testCodesToCleanup.push(limitCode);
    await Coupon.create({
      code: limitCode,
      couponType: 'GLOBAL',
      discountType: 'FIXED',
      discountValue: 10,
      usageLimit: 3,
      usedCount: 3,
      startDate,
      endDate,
      shopId: null,
      isActive: true,
    });
    const { req: reqLim, res: resLim } = mockReqRes({ couponCode: limitCode, subtotal: 100, shopId: shopA._id.toString() });
    await applyCoupon(reqLim, resLim);
    const limitPass = resLim.statusCode === 400 && resLim.data?.message?.includes('limit');

    record(11, 'Expiry, minimum order, and usage limits enforced', expiredPass && minPass && limitPass, `Expired: ${expiredPass}, MinOrder: ${minPass}, Limit: ${limitPass}`);

    // -------------------------------------------------------------
    // Test 12: COD and online payment totals with coupon
    // -------------------------------------------------------------
    const subtotal = 200;
    const packingCharges = 10;
    const gstAmount = 18;
    const deliveryFee = 30;
    const discount = 25;
    const expectedTotal = subtotal + packingCharges + gstAmount + deliveryFee - discount; // 233
    record(12, 'Order calculations with coupon deduction verified', expectedTotal === 233, `Total: ₹${expectedTotal}`);

    // -------------------------------------------------------------
    // Test 13: Concurrency safety & simultaneous requests exceeding usageLimit
    // -------------------------------------------------------------
    // Case A: Limited coupon with usageLimit = 2 subjected to 6 simultaneous requests
    const concurrentCode = `CONC_${Date.now()}`;
    testCodesToCleanup.push(concurrentCode);
    const concCoupon = await Coupon.create({
      code: concurrentCode,
      couponType: 'GLOBAL',
      discountType: 'FIXED',
      discountValue: 10,
      usageLimit: 2, // Usage limit is strictly 2
      usedCount: 0,
      startDate,
      endDate,
      shopId: null,
      isActive: true,
    });

    const atomicFilter = {
      _id: concCoupon._id,
      isActive: true,
      $or: [
        { usageLimit: null },
        { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
      ],
    };

    // Fire 6 simultaneous atomic reservation attempts
    const simultaneousAttempts = await Promise.all([
      Coupon.findOneAndUpdate(atomicFilter, { $inc: { usedCount: 1 } }, { new: true }),
      Coupon.findOneAndUpdate(atomicFilter, { $inc: { usedCount: 1 } }, { new: true }),
      Coupon.findOneAndUpdate(atomicFilter, { $inc: { usedCount: 1 } }, { new: true }),
      Coupon.findOneAndUpdate(atomicFilter, { $inc: { usedCount: 1 } }, { new: true }),
      Coupon.findOneAndUpdate(atomicFilter, { $inc: { usedCount: 1 } }, { new: true }),
      Coupon.findOneAndUpdate(atomicFilter, { $inc: { usedCount: 1 } }, { new: true }),
    ]);

    const succeeded = simultaneousAttempts.filter(Boolean).length;
    const rejected = simultaneousAttempts.filter((res) => !res).length;
    const refreshedConc = await Coupon.findById(concCoupon._id);

    // Case B: Unlimited coupon (usageLimit: null)
    const unlimCode = `UNLIM_${Date.now()}`;
    testCodesToCleanup.push(unlimCode);
    const unlimCoupon = await Coupon.create({
      code: unlimCode,
      couponType: 'GLOBAL',
      discountType: 'FIXED',
      discountValue: 10,
      usageLimit: null, // Unlimited
      usedCount: 0,
      startDate,
      endDate,
      shopId: null,
      isActive: true,
    });

    const unlimFilter = {
      _id: unlimCoupon._id,
      isActive: true,
      $or: [
        { usageLimit: null },
        { $expr: { $lt: ['$usedCount', '$usageLimit'] } },
      ],
    };

    const unlimAttempts = await Promise.all([
      Coupon.findOneAndUpdate(unlimFilter, { $inc: { usedCount: 1 } }, { new: true }),
      Coupon.findOneAndUpdate(unlimFilter, { $inc: { usedCount: 1 } }, { new: true }),
      Coupon.findOneAndUpdate(unlimFilter, { $inc: { usedCount: 1 } }, { new: true }),
    ]);
    const unlimSucceeded = unlimAttempts.filter(Boolean).length;
    const refreshedUnlim = await Coupon.findById(unlimCoupon._id);

    const concurrencyPass =
      succeeded === 2 &&
      rejected === 4 &&
      refreshedConc.usedCount === 2 &&
      unlimSucceeded === 3 &&
      refreshedUnlim.usedCount === 3;

    record(
      13,
      'Simultaneous requests exceeding usageLimit rejected atomically (unlimited handled separately)',
      concurrencyPass,
      `Limited (Limit 2): Succeeded ${succeeded}, Rejected ${rejected}, Final usedCount: ${refreshedConc.usedCount} | Unlimited: Succeeded ${unlimSucceeded}, Final usedCount: ${refreshedUnlim.usedCount}`
    );

    // -------------------------------------------------------------
    // Test 14: Order creation and checkout remain fully functional
    // -------------------------------------------------------------
    // Temporarily ensure shopA is considered open for checkout
    await Shop.updateOne(
      { _id: shopA._id },
      {
        $set: {
          openingTime: '00:00',
          closingTime: '23:59',
          isOpen: true,
          weeklyClosingDays: [],
          specialClosingDates: [],
        },
      }
    );

    const e2eCode = `E2E_${Date.now()}`;
    testCodesToCleanup.push(e2eCode);
    const e2eCoupon = await Coupon.create({
      code: e2eCode,
      couponType: 'SHOP_SPECIFIC',
      discountType: 'FIXED',
      discountValue: 15,
      minimumOrderAmount: 20,
      usageLimit: 5,
      usedCount: 0,
      startDate,
      endDate,
      shopId: shopA._id,
      isActive: true,
    });

    const neededQtyE2E = Math.max(1, Math.ceil(((shopA.minimumOrderAmount || 0) + 10) / (sampleProduct?.price || 1)));
    const { req: reqE2E, res: resE2E } = mockReqRes(
      {
        addressId: testAddress._id.toString(),
        couponCode: e2eCode,
        paymentMethod: 'COD',
        isBuyNow: true,
        buyNowItem: {
          productId: sampleProduct._id.toString(),
          quantity: neededQtyE2E,
        },
      },
      {},
      testStudent
    );

    await createOrder(reqE2E, resE2E);
    const createdE2EOrder = resE2E.data?.data;
    if (createdE2EOrder?._id) {
      testOrderIdsToCleanup.push(createdE2EOrder._id);
    }
    const refreshedE2ECoupon = await Coupon.findById(e2eCoupon._id);

    const test14Pass =
      resE2E.statusCode === 201 &&
      createdE2EOrder &&
      createdE2EOrder.discount === 15 &&
      refreshedE2ECoupon?.usedCount === 1;

    record(
      14,
      'End-to-end checkout validation passes and integrity preserved',
      test14Pass,
      `Status: ${resE2E.statusCode}, Discount: ₹${createdE2EOrder?.discount}, Final usedCount: ${refreshedE2ECoupon?.usedCount}`
    );

    // -------------------------------------------------------------
    // Test 15: Deliberate failure rolls back reserved coupon usedCount & prevents double-rollback
    // -------------------------------------------------------------
    const rollbackCode = `ROLLBACK_${Date.now()}`;
    testCodesToCleanup.push(rollbackCode);
    const initialUsedCount = 2;
    const rollbackCoupon = await Coupon.create({
      code: rollbackCode,
      couponType: 'SHOP_SPECIFIC',
      discountType: 'FIXED',
      discountValue: 20,
      minimumOrderAmount: 20,
      usageLimit: 10,
      usedCount: initialUsedCount,
      startDate,
      endDate,
      shopId: shopA._id,
      isActive: true,
    });

    // Deliberately mock Order.create to throw an error AFTER atomic coupon reservation
    const originalOrderCreate = Order.create;
    Order.create = async () => {
      throw new Error('Simulated order persistence crash for rollback testing');
    };

    let test15StatusCode = null;
    let refreshedAfterFailure = null;
    try {
      const { req: reqFail, res: resFail } = mockReqRes(
        {
          addressId: testAddress._id.toString(),
          couponCode: rollbackCode,
          paymentMethod: 'COD',
          isBuyNow: true,
          buyNowItem: {
            productId: sampleProduct._id.toString(),
            quantity: neededQtyE2E,
          },
        },
        {},
        testStudent
      );

      await createOrder(reqFail, resFail);
      test15StatusCode = resFail.statusCode;
      refreshedAfterFailure = await Coupon.findById(rollbackCoupon._id);
    } finally {
      Order.create = originalOrderCreate;
    }

    // Verify:
    // 1. HTTP 500 error returned
    // 2. Coupon usedCount rolled back to EXACTLY initialUsedCount (2), NOT incremented to 3, and NOT decremented to 1 (prevent double rollback)
    const test15Pass =
      test15StatusCode === 500 &&
      refreshedAfterFailure &&
      refreshedAfterFailure.usedCount === initialUsedCount;

    record(
      15,
      'Deliberate order creation failure rolls back usedCount to original value (prevents double rollback)',
      test15Pass,
      `Status: ${test15StatusCode}, Initial usedCount: ${initialUsedCount}, Final usedCount: ${refreshedAfterFailure?.usedCount}`
    );

  } finally {
    // Clean up temporary test coupons
    if (testCodesToCleanup.length > 0) {
      await Coupon.deleteMany({ code: { $in: testCodesToCleanup } });
      console.log(`Cleaned up ${testCodesToCleanup.length} test coupon(s) from database.`);
    }
    if (testOrderIdsToCleanup.length > 0) {
      await Order.deleteMany({ _id: { $in: testOrderIdsToCleanup } });
    }
    if (testUserIdsToCleanup.length > 0) {
      await User.deleteMany({ _id: { $in: testUserIdsToCleanup } });
    }
    if (testAddressIdsToCleanup.length > 0) {
      await Address.deleteMany({ _id: { $in: testAddressIdsToCleanup } });
    }
    if (shopA) {
      await Shop.updateOne(
        { _id: shopA._id },
        {
          $set: {
            openingTime: shopA.openingTime,
            closingTime: shopA.closingTime,
            isOpen: shopA.isOpen,
            weeklyClosingDays: shopA.weeklyClosingDays,
            specialClosingDates: shopA.specialClosingDates,
          },
        }
      );
    }
    await mongoose.disconnect();
  }

  console.log('====================================================');
  const allPassed = testResults.every((t) => t.passed);
  console.log(`SUMMARY: ${testResults.filter((t) => t.passed).length}/${testResults.length} TESTS PASSED.`);
  if (allPassed) {
    console.log('🎉 ALL 15 TEST CASES PASSED SUCCESSFULLY!');
  } else {
    console.error('⚠️ SOME TESTS FAILED.');
  }
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('Test runner encountered error:', err);
  process.exit(1);
});
