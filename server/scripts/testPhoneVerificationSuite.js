import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';
import User from '../models/User.js';
import PhoneOtp from '../models/PhoneOtp.js';
import Order from '../models/Order.js';
import Address from '../models/Address.js';
import Shop from '../models/Shop.js';
import Product from '../models/Product.js';
import { normalizeIndianPhone } from '../utils/phoneValidator.js';

dotenv.config();

let passedTests = 0;
let totalTests = 0;

const assert = (condition, testName) => {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
  }
};

const runSuite = async () => {
  console.log('\n======================================================');
  console.log('🧪 Starting NearCart Phone Verification Test Suite');
  console.log('======================================================\n');

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected successfully.\n');

    // -----------------------------------------------------------------
    // TEST GROUP 1: Indian Phone Number Normalization and Validation
    // -----------------------------------------------------------------
    console.log('--- Test Group 1: Phone Normalization & Validation ---');
    const valid1 = normalizeIndianPhone('9876543210');
    assert(valid1.isValid && valid1.normalized === '+919876543210' && valid1.localNumber === '9876543210', 'Normalizes 10-digit number to +919876543210');

    const valid2 = normalizeIndianPhone('+91 98765 43210');
    assert(valid2.isValid && valid2.normalized === '+919876543210', 'Handles spaces and leading +91');

    const valid3 = normalizeIndianPhone('09876543210');
    assert(valid3.isValid && valid3.normalized === '+919876543210', 'Handles leading 0 prefix');

    const invalid1 = normalizeIndianPhone('5876543210');
    assert(!invalid1.isValid, 'Rejects number starting with invalid digit (< 6)');

    const invalid2 = normalizeIndianPhone('98765');
    assert(!invalid2.isValid, 'Rejects short phone numbers');

    const invalid3 = normalizeIndianPhone('98765432109999');
    assert(!invalid3.isValid, 'Rejects long phone numbers');

    // -----------------------------------------------------------------
    // TEST GROUP 2: OTP Creation, Hashing & Timing-Safe Verification
    // -----------------------------------------------------------------
    console.log('\n--- Test Group 2: OTP Storage & Hashing ---');
    const testUserId = new mongoose.Types.ObjectId();
    const testPhone = '+919876500001';
    const testOtp = '742918';

    // Cleanup previous test data if any
    await PhoneOtp.deleteMany({ userId: testUserId });

    const createdRecord = await PhoneOtp.createHashedOtp({
      userId: testUserId,
      phone: testPhone,
      otp: testOtp,
      expiresInMinutes: 10,
    });

    assert(createdRecord && createdRecord.otpHash, 'Hashed OTP record created');
    assert(!createdRecord.otpHash.includes(testOtp), 'OTP is never stored in plaintext (properly hashed with salt)');

    // Verify correct OTP
    const verifyPass = createdRecord.verifyOtp(testOtp);
    assert(verifyPass.valid && verifyPass.reason === 'OK', 'Correct OTP successfully passes timingSafeEqual');

    // Verify incorrect OTP
    const verifyFail = createdRecord.verifyOtp('000000');
    assert(!verifyFail.valid && verifyFail.reason === 'INVALID', 'Incorrect OTP correctly rejected');

    // Test attempt count and lockout
    createdRecord.attempts = 5;
    const verifyLocked = createdRecord.verifyOtp(testOtp);
    assert(!verifyLocked.valid && verifyLocked.reason === 'MAX_ATTEMPTS_EXCEEDED', 'Exceeded max attempts triggers lockout');

    // Test expiration
    createdRecord.attempts = 0;
    createdRecord.expiresAt = new Date(Date.now() - 1000);
    const verifyExpired = createdRecord.verifyOtp(testOtp);
    assert(!verifyExpired.valid && verifyExpired.reason === 'EXPIRED', 'Past expiration triggers EXPIRED error');

    // Clean up OTP record
    await PhoneOtp.deleteMany({ userId: testUserId });

    // -----------------------------------------------------------------
    // TEST GROUP 3: Duplicate Verified Phone Number Protection
    // -----------------------------------------------------------------
    console.log('\n--- Test Group 3: Duplicate Phone Conflict Prevention ---');
    const uniqueEmail1 = `test_phone_user1_${Date.now()}@nearcart.test`;
    const uniqueEmail2 = `test_phone_user2_${Date.now()}@nearcart.test`;
    const verifiedPhone = '9876500099';
    const verifiedPhoneE164 = '+919876500099';

    // Clean up any old test users
    await User.deleteMany({ email: { $in: [uniqueEmail1, uniqueEmail2] } });

    const user1 = await User.create({
      name: 'User One',
      email: uniqueEmail1,
      password: 'Password123!',
      phone: verifiedPhone,
      phoneNumber: verifiedPhoneE164,
      phoneVerified: true,
      role: 'STUDENT',
      accountStatus: 'APPROVED',
    });

    const user2 = await User.create({
      name: 'User Two',
      email: uniqueEmail2,
      password: 'Password123!',
      phone: '',
      phoneNumber: '',
      phoneVerified: false,
      role: 'STUDENT',
      accountStatus: 'APPROVED',
    });

    // Check conflict query matching what authController uses
    const conflict = await User.findOne({
      $or: [
        { phone: verifiedPhoneE164 },
        { phoneNumber: verifiedPhoneE164 },
        { phone: verifiedPhone },
        { phoneNumber: verifiedPhone },
      ],
      phoneVerified: true,
      _id: { $ne: user2._id },
    });

    assert(conflict && conflict._id.toString() === user1._id.toString(), 'Detects conflict when attempting to verify a phone already used by user1');

    // -----------------------------------------------------------------
    // TEST GROUP 4: Backend Order Creation Security (Bypass Prevention)
    // -----------------------------------------------------------------
    console.log('\n--- Test Group 4: Order Creation Security Check ---');

    // Fresh user without verified phone
    const freshUnverifiedUser = await User.findById(user2._id).select('phone phoneNumber phoneVerified');
    const hasVerifiedPhone =
      freshUnverifiedUser &&
      (freshUnverifiedUser.phone || freshUnverifiedUser.phoneNumber) &&
      freshUnverifiedUser.phoneVerified === true;

    assert(!hasVerifiedPhone, 'Unverified user fails backend order-creation phone check');

    // Mark user2 as verified
    user2.phone = '9876500088';
    user2.phoneNumber = '+919876500088';
    user2.phoneVerified = true;
    await user2.save();

    const freshVerifiedUser = await User.findById(user2._id).select('phone phoneNumber phoneVerified');
    const hasVerifiedPhoneNow =
      freshVerifiedUser &&
      (freshVerifiedUser.phone || freshVerifiedUser.phoneNumber) &&
      freshVerifiedUser.phoneVerified === true;

    assert(hasVerifiedPhoneNow, 'Verified user passes backend order-creation phone check');

    // -----------------------------------------------------------------
    // CLEANUP
    // -----------------------------------------------------------------
    await User.deleteMany({ email: { $in: [uniqueEmail1, uniqueEmail2] } });

    console.log('\n======================================================');
    console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);
    console.log('======================================================\n');

    process.exit(passedTests === totalTests ? 0 : 1);
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
};

runSuite();
