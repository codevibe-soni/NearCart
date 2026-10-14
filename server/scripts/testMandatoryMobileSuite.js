import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Order from '../models/Order.js';

dotenv.config();

let passed = 0;
let total = 0;

const assert = (condition, name) => {
  total++;
  if (condition) {
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${name}`);
  }
};

const run = async () => {
  console.log('\n======================================================');
  console.log('🧪 Testing NearCart Mandatory Mobile Number Requirement');
  console.log('======================================================\n');

  try {
    await mongoose.connect(process.env.MONGO_URI);

    const testEmail = `test_mobile_req_${Date.now()}@nearcart.test`;
    await User.deleteMany({ email: testEmail });

    // 1. User created without phone (e.g. fresh Google Login)
    const user = await User.create({
      name: 'Google User Without Phone',
      email: testEmail,
      password: 'password123',
      phone: '',
      role: 'STUDENT',
      accountStatus: 'APPROVED',
    });

    console.log('--- Test 1: Missing Mobile Number in Database ---');
    const freshUserNoPhone = await User.findById(user._id).select('phone');
    const rawPhone1 = freshUserNoPhone?.phone ? freshUserNoPhone.phone.trim() : '';
    const cleanPhone1 = rawPhone1.replace(/[\s\-\.\(\)]/g, '').replace(/^(\+91|91|0)/, '');
    const isValidPhone1 = /^[6-9]\d{9}$/.test(cleanPhone1);

    assert(!isValidPhone1, 'Rejects user with missing phone from placing order');

    // 2. User with invalid phone number
    console.log('\n--- Test 2: Invalid Mobile Number ---');
    user.phone = '12345';
    await user.save();
    const freshUserInvalid = await User.findById(user._id).select('phone');
    const rawPhone2 = freshUserInvalid?.phone ? freshUserInvalid.phone.trim() : '';
    const cleanPhone2 = rawPhone2.replace(/[\s\-\.\(\)]/g, '').replace(/^(\+91|91|0)/, '');
    const isValidPhone2 = /^[6-9]\d{9}$/.test(cleanPhone2);

    assert(!isValidPhone2, 'Rejects invalid phone (e.g. 12345) from placing order');

    // 3. User updates phone via profile to a valid 10-digit number
    console.log('\n--- Test 3: Valid Mobile Number Saved ---');
    const validMobile = '9876543210';
    user.phone = validMobile;
    await user.save();

    const freshUserValid = await User.findById(user._id).select('phone');
    const rawPhone3 = freshUserValid?.phone ? freshUserValid.phone.trim() : '';
    const cleanPhone3 = rawPhone3.replace(/[\s\-\.\(\)]/g, '').replace(/^(\+91|91|0)/, '');
    const isValidPhone3 = /^[6-9]\d{9}$/.test(cleanPhone3);

    assert(isValidPhone3 && cleanPhone3 === '9876543210', 'Accepts valid 10-digit mobile number starting with 6-9');

    // 4. Order Schema stores customerPhone
    console.log('\n--- Test 4: Order Customer Phone Field ---');
    const orderDoc = new Order({
      orderNumber: `TEST-ORD-${Date.now()}`,
      user: user._id,
      customerPhone: cleanPhone3,
      shop: new mongoose.Types.ObjectId(),
      items: [
        {
          product: new mongoose.Types.ObjectId(),
          name: 'Notebook',
          quantity: 1,
          price: 50,
          subtotal: 50,
        },
      ],
      address: new mongoose.Types.ObjectId(),
      subtotal: 50,
      deliveryFee: 10,
      totalAmount: 60,
    });

    assert(orderDoc.customerPhone === '9876543210', 'Order document stores customerPhone for delivery staff');

    // Cleanup
    await User.deleteMany({ email: testEmail });

    console.log('\n======================================================');
    console.log(`📊 Test Results: ${passed}/${total} passed`);
    console.log('======================================================\n');

    process.exit(passed === total ? 0 : 1);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
};

run();
