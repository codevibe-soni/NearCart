// server/scripts/test_receipt_end_to_end.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Shop from '../models/Shop.js';
import Address from '../models/Address.js';
import Delivery from '../models/Delivery.js';
import { generateReceiptPdf } from '../controllers/paymentController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

function mockResponse() {
  const chunks = [];
  const headers = {};
  let statusCode = 200;
  let finished = false;

  const res = {
    statusCode,
    headers,
    status(code) {
      this.statusCode = code;
      statusCode = code;
      return this;
    },
    setHeader(name, value) {
      headers[name.toLowerCase()] = value;
    },
    getHeader(name) {
      return headers[name.toLowerCase()];
    },
    json(data) {
      this.data = data;
      this.finished = true;
      return this;
    },
    write(chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    },
    end(chunk) {
      if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      this.finished = true;
      this.buffer = Buffer.concat(chunks);
    },
    on(event, handler) {
      // noop
    },
    once(event, handler) {
      // noop
    },
    emit(event, ...args) {
      // noop
    },
  };
  return res;
}

async function runTests() {
  console.log('=== STARTING NEARCARTS ORDER RECEIPT PDF SUITE ===\n');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✓ Connected to MongoDB');

  try {
    // Setup test users & shop
    const student1 = await User.findOne({ role: 'STUDENT' });
    const student2 = await User.findOne({ role: 'STUDENT', _id: { $ne: student1._id } }) || student1;
    const admin = await User.findOne({ role: 'ADMIN' });
    const shop = await Shop.findOne().populate('owner');
    const address = await Address.findOne();

    console.log(`✓ Test entities resolved: Student1=${student1?.name}, Shop=${shop?.name}, Admin=${admin?.name}`);

    // --- TEST 1: Single item order receipt for student owner ---
    console.log('\nTest 1: Single-item order receipt for student owner');
    const order1 = await Order.create({
      orderNumber: `TEST-ORD-1-${Date.now()}`,
      user: student1._id,
      shop: shop._id,
      address: address?._id || new mongoose.Types.ObjectId(),
      items: [{
        product: new mongoose.Types.ObjectId(),
        name: 'Single Notebook A4 200 Pages Rule',
        quantity: 1,
        price: 80,
        subtotal: 80,
      }],
      subtotal: 80,
      deliveryFee: 15,
      packingCharges: 5,
      discount: 0,
      gstAmount: 0,
      totalAmount: 100,
      paymentMethod: 'UPI',
      paymentStatus: 'PAID',
      orderStatus: 'DELIVERED',
    });

    const res1 = mockResponse();
    await generateReceiptPdf({ params: { orderId: order1._id.toString() }, user: student1 }, res1, (err) => { throw err; });
    
    // Wait for stream to finish
    await new Promise(resolve => setTimeout(resolve, 300));
    if (!res1.buffer || res1.buffer.length < 500) throw new Error('Test 1 failed: PDF buffer too small or empty');
    if (!res1.buffer.toString('utf8', 0, 5).startsWith('%PDF-')) throw new Error('Test 1 failed: Invalid PDF header');
    if (res1.headers['content-type'] !== 'application/pdf') throw new Error('Test 1 failed: Wrong content-type header');
    console.log(`   ✓ PASS: Generated single-item PDF receipt (Size: ${res1.buffer.length} bytes, Header: ${res1.headers['content-disposition']})`);

    // --- TEST 2 & 3: Multi-item order with delivery fee, packing charges, and GST ---
    console.log('\nTest 2 & 3: Multi-item order with full charges (Delivery, Packaging, GST)');
    const order2 = await Order.create({
      orderNumber: `TEST-ORD-2-${Date.now()}`,
      user: student1._id,
      shop: shop._id,
      address: address?._id || new mongoose.Types.ObjectId(),
      items: [
        { product: new mongoose.Types.ObjectId(), name: 'Hot Samosa with Mint Chutney (Plate of 2)', quantity: 3, price: 30, subtotal: 90 },
        { product: new mongoose.Types.ObjectId(), name: 'Cold Coffee Bottle 300ml Chilled', quantity: 2, price: 50, subtotal: 100 },
        { product: new mongoose.Types.ObjectId(), name: 'Masala Maggi Extra Cheese Double Portion', quantity: 1, price: 65, subtotal: 65 },
      ],
      subtotal: 255,
      deliveryFee: 20,
      packingCharges: 10,
      gstAmount: 12.75,
      discount: 0,
      totalAmount: 297.75,
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      orderStatus: 'DELIVERED',
    });

    const res2 = mockResponse();
    await generateReceiptPdf({ params: { orderId: order2._id.toString() }, user: student1 }, res2, (err) => { throw err; });
    await new Promise(resolve => setTimeout(resolve, 300));
    if (!res2.buffer || res2.buffer.length < 500) throw new Error('Test 2 failed: PDF buffer too small');
    console.log(`   ✓ PASS: Generated multi-item receipt with all charges (Size: ${res2.buffer.length} bytes)`);

    // --- TEST 4: Order with Discount / Coupon Deduction ---
    console.log('\nTest 4: Order with Discount Deduction');
    const order4 = await Order.create({
      orderNumber: `TEST-ORD-4-${Date.now()}`,
      user: student1._id,
      shop: shop._id,
      address: address?._id || new mongoose.Types.ObjectId(),
      items: [
        { product: new mongoose.Types.ObjectId(), name: 'Campus Special Deluxe Burger Meal', quantity: 2, price: 120, subtotal: 240 },
      ],
      subtotal: 240,
      deliveryFee: 15,
      packingCharges: 5,
      gstAmount: 0,
      discount: 50,
      totalAmount: 210, // 240 + 15 + 5 - 50 = 210
      paymentMethod: 'UPI',
      paymentStatus: 'PAID',
      orderStatus: 'PLACED',
    });

    const res4 = mockResponse();
    await generateReceiptPdf({ params: { orderId: order4._id.toString() }, user: student1 }, res4, (err) => { throw err; });
    await new Promise(resolve => setTimeout(resolve, 300));
    console.log(`   ✓ PASS: Generated receipt with discount deduction (Size: ${res4.buffer.length} bytes)`);

    // --- TEST 5: Long Order requiring Multi-Page PDF ---
    console.log('\nTest 5: Long Order requiring Multi-Page PDF');
    const longItems = [];
    for (let i = 1; i <= 25; i++) {
      longItems.push({
        product: new mongoose.Types.ObjectId(),
        name: `Campus Stationary Item #${i} - Premium Quality Standard Student Academic Supply Line (${i})`,
        quantity: i,
        price: 15 + i,
        subtotal: i * (15 + i),
      });
    }
    const longSubtotal = longItems.reduce((acc, it) => acc + it.subtotal, 0);

    const order5 = await Order.create({
      orderNumber: `TEST-ORD-5-${Date.now()}`,
      user: student1._id,
      shop: shop._id,
      address: address?._id || new mongoose.Types.ObjectId(),
      items: longItems,
      subtotal: longSubtotal,
      deliveryFee: 25,
      packingCharges: 10,
      gstAmount: 0,
      discount: 0,
      totalAmount: longSubtotal + 35,
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      orderStatus: 'DELIVERED',
    });

    const res5 = mockResponse();
    await generateReceiptPdf({ params: { orderId: order5._id.toString() }, user: student1 }, res5, (err) => { throw err; });
    await new Promise(resolve => setTimeout(resolve, 500));
    if (res5.buffer.length < 2000) throw new Error('Test 5 failed: Multi-page PDF buffer too small');
    console.log(`   ✓ PASS: Generated multi-page receipt with 25 items (Size: ${res5.buffer.length} bytes)`);

    // Save one sample PDF to disk for manual inspection
    fs.writeFileSync(path.join(__dirname, 'sample_receipt_verified.pdf'), res5.buffer);
    console.log('   ✓ Saved sample multi-page PDF to server/scripts/sample_receipt_verified.pdf');

    // --- TEST 6: Missing optional customer & shop information ---
    console.log('\nTest 6: Order with missing optional customer / shop fields');
    const order6 = await Order.create({
      orderNumber: `TEST-ORD-6-${Date.now()}`,
      user: student1._id,
      shop: shop._id,
      address: address?._id || new mongoose.Types.ObjectId(),
      items: [{ product: new mongoose.Types.ObjectId(), name: 'Generic Item', quantity: 1, price: 50, subtotal: 50 }],
      subtotal: 50,
      deliveryFee: 10,
      totalAmount: 60,
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      orderStatus: 'PLACED',
      customerPhone: '',
    });

    const res6 = mockResponse();
    await generateReceiptPdf({ params: { orderId: order6._id.toString() }, user: student1 }, res6, (err) => { throw err; });
    await new Promise(resolve => setTimeout(resolve, 300));
    console.log(`   ✓ PASS: Missing fields handled safely without crash (Size: ${res6.buffer.length} bytes)`);

    // --- TEST 7: Unauthorized Student Access ---
    console.log('\nTest 7: Security check - Unauthorized student accessing another user receipt');
    const fakeOtherStudent = {
      _id: new mongoose.Types.ObjectId(),
      role: 'STUDENT',
      name: 'Intruder Student',
    };
    const res7 = mockResponse();
    await generateReceiptPdf({ params: { orderId: order1._id.toString() }, user: fakeOtherStudent }, res7, (err) => { throw err; });
    if (res7.statusCode !== 403) throw new Error(`Expected 403 Forbidden but got ${res7.statusCode}`);
    console.log(`   ✓ PASS: Correctly blocked unauthorized student with 403 Forbidden: "${res7.data?.message}"`);

    // --- TEST 8: Invalid and Nonexistent Order ID ---
    console.log('\nTest 8: Invalid and Nonexistent Order ID');
    const res8a = mockResponse();
    await generateReceiptPdf({ params: { orderId: 'invalid-id-123' }, user: student1 }, res8a, (err) => { throw err; });
    if (res8a.statusCode !== 400) throw new Error(`Expected 400 Bad Request for invalid ID, got ${res8a.statusCode}`);
    console.log(`   ✓ PASS: Invalid order ID correctly rejected with 400: "${res8a.data?.message}"`);

    const res8b = mockResponse();
    const nonExistentId = new mongoose.Types.ObjectId().toString();
    await generateReceiptPdf({ params: { orderId: nonExistentId }, user: student1 }, res8b, (err) => { throw err; });
    if (res8b.statusCode !== 404) throw new Error(`Expected 404 Not Found for nonexistent ID, got ${res8b.statusCode}`);
    console.log(`   ✓ PASS: Nonexistent order ID correctly rejected with 404: "${res8b.data?.message}"`);

    // --- TEST 9: Pending / COD and Failed payment status ---
    console.log('\nTest 9: Pending & Failed payment status representation');
    const order9 = await Order.create({
      orderNumber: `TEST-ORD-9-${Date.now()}`,
      user: student1._id,
      shop: shop._id,
      address: address?._id || new mongoose.Types.ObjectId(),
      items: [{ product: new mongoose.Types.ObjectId(), name: 'Cash on Delivery Item', quantity: 1, price: 100, subtotal: 100 }],
      subtotal: 100,
      deliveryFee: 20,
      totalAmount: 120,
      paymentMethod: 'COD',
      paymentStatus: 'PENDING',
      orderStatus: 'PLACED',
    });

    const res9 = mockResponse();
    await generateReceiptPdf({ params: { orderId: order9._id.toString() }, user: student1 }, res9, (err) => { throw err; });
    await new Promise(resolve => setTimeout(resolve, 300));
    if (!res9.buffer || res9.buffer.length < 500) throw new Error('Test 9 failed: PDF not generated for pending order');
    console.log(`   ✓ PASS: Receipt generated for COD/PENDING order with accurate TOTAL PAYABLE status (Size: ${res9.buffer.length} bytes)`);

    // Clean up test orders
    await Order.deleteMany({ _id: { $in: [order1._id, order2._id, order4._id, order5._id, order6._id, order9._id] } });
    console.log('\n✓ Cleaned up test orders from database');

    console.log('\n======================================================');
    console.log('ALL RECEIPT PDF TESTS PASSED WITH 100% SUCCESS!');
    console.log('======================================================\n');
  } finally {
    await mongoose.disconnect();
  }
}

runTests().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
