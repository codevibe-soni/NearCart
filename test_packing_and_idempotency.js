import axios from 'axios';

const API = 'http://localhost:5000/api';

async function runTests() {
  console.log('=== RUNNING PRODUCT-LEVEL PACKING CHARGES & IDEMPOTENCY VERIFICATION TEST ===\n');

  try {
    const timestamp = Date.now();
    const adminEmail = 'nearcart7889@gamil.com';
    const adminPassword = 'Satyam@788058';

    // 1. Admin Login
    console.log('Step 1: Admin Login...');
    const adminLogin = await axios.post(`${API}/auth/login`, {
      email: adminEmail,
      password: adminPassword,
    });
    const adminCookie = adminLogin.headers['set-cookie'] ? adminLogin.headers['set-cookie'][0] : '';
    const adminHeaders = { headers: { Cookie: adminCookie } };
    console.log('  ✓ Admin login successful');

    // 2. Create Shopkeeper & Student
    console.log('\nStep 2: Creating Test Shopkeeper & Student...');
    const sk1Email = `sk1_${timestamp}@example.com`;
    const studentEmail = `student_${timestamp}@example.com`;
    const pass = 'Password123!';

    await axios.post(`${API}/auth/admin/create-staff`, {
      name: 'Shopkeeper Packing',
      email: sk1Email,
      phone: '9876543210',
      password: pass,
      role: 'SHOPKEEPER',
    }, adminHeaders);

    await axios.post(`${API}/auth/register`, {
      name: 'Test Student',
      email: studentEmail,
      phone: '9876543212',
      password: pass,
      role: 'STUDENT',
    });

    const sk1Login = await axios.post(`${API}/auth/login`, { email: sk1Email, password: pass });
    const sk1Headers = { headers: { Cookie: sk1Login.headers['set-cookie'][0] } };

    const studentLogin = await axios.post(`${API}/auth/login`, { email: studentEmail, password: pass });
    const studentHeaders = { headers: { Cookie: studentLogin.headers['set-cookie'][0] } };

    console.log('  ✓ Users created and logged in');

    // 3. Create Shop & Category
    console.log('\nStep 3: Creating Shop...');
    const catRes = await axios.get(`${API}/categories`);
    const categoryId = catRes.data.categories[0]._id;

    const shopRes = await axios.post(`${API}/shopkeeper/shop`, {
      name: `Packing Product Shop ${timestamp}`,
      description: 'Test shop for product packing charges',
      category: categoryId,
      address: 'Hostel 1 Campus',
      deliveryFee: 20,
    }, sk1Headers);

    const shop = shopRes.data.shop;
    console.log(`  ✓ Shop created: ID ${shop._id}`);

    // 4. Test Product Creation Validation (Negative Packing Charges)
    console.log('\nStep 4: Testing Negative Packing Charges Validation...');
    try {
      await axios.post(`${API}/shopkeeper/products?shopId=${shop._id}`, {
        name: 'Invalid Prod',
        price: 100,
        category: categoryId,
        unit: 'piece',
        stock: 10,
        packingCharges: -5,
      }, sk1Headers);
      console.error('  ❌ FAILED: Negative packing charges allowed!');
      process.exit(1);
    } catch (err) {
      if (err.response && err.response.status === 400) {
        console.log(`  ✓ Negative Packing Charges Validation PASS (${err.response.data.message})`);
      } else {
        throw err;
      }
    }

    // 5. Create Products with different packing charges
    console.log('\nStep 5: Creating Products A (₹5), B (₹0), C (₹10)...');
    
    // Product A: packingCharges = 5
    const prodARes = await axios.post(`${API}/shopkeeper/products?shopId=${shop._id}`, {
      name: 'Product A',
      price: 100,
      category: categoryId,
      unit: 'piece',
      stock: 50,
      gstPercentage: 18,
      packingCharges: 5,
      idempotencyKey: `prodA-key-${timestamp}`,
    }, sk1Headers);
    const prodA = prodARes.data.product;

    // Product B: packingCharges = 0
    const prodBRes = await axios.post(`${API}/shopkeeper/products?shopId=${shop._id}`, {
      name: 'Product B',
      price: 50,
      category: categoryId,
      unit: 'piece',
      stock: 50,
      gstPercentage: 18,
      packingCharges: 0,
      idempotencyKey: `prodB-key-${timestamp}`,
    }, sk1Headers);
    const prodB = prodBRes.data.product;

    // Product C: packingCharges = 10
    const prodCRes = await axios.post(`${API}/shopkeeper/products?shopId=${shop._id}`, {
      name: 'Product C',
      price: 200,
      category: categoryId,
      unit: 'piece',
      stock: 50,
      gstPercentage: 18,
      packingCharges: 10,
      idempotencyKey: `prodC-key-${timestamp}`,
    }, sk1Headers);
    const prodC = prodCRes.data.product;

    console.log(`  ✓ Product A: ID ${prodA._id}, Packing Charges: ₹${prodA.packingCharges}`);
    console.log(`  ✓ Product B: ID ${prodB._id}, Packing Charges: ₹${prodB.packingCharges}`);
    console.log(`  ✓ Product C: ID ${prodC._id}, Packing Charges: ₹${prodC.packingCharges}`);

    // 6. Test Double-Click Idempotency on Product Creation
    console.log('\nStep 6: Testing Double-Click Product Creation Idempotency...');
    const prodIdempotencyKey = `prod-dup-key-${timestamp}`;
    const prodPayload = {
      name: `Idempotent Prod ${timestamp}`,
      price: 100,
      category: categoryId,
      unit: 'piece',
      stock: 50,
      packingCharges: 15,
      idempotencyKey: prodIdempotencyKey,
    };

    const [p1, p2] = await Promise.all([
      axios.post(`${API}/shopkeeper/products?shopId=${shop._id}`, prodPayload, sk1Headers),
      axios.post(`${API}/shopkeeper/products?shopId=${shop._id}`, prodPayload, sk1Headers),
    ]);

    if (p1.data.product._id === p2.data.product._id) {
      console.log(`  ✓ Double-Click Product Idempotency PASS (${p1.data.product._id})`);
    } else {
      console.error('  ❌ FAILED: Duplicate products created!');
      process.exit(1);
    }

    // 7. Setup Student Address
    console.log('\nStep 7: Setting up Student Delivery Address...');
    const addrRes = await axios.post(`${API}/addresses`, {
      label: 'HOSTEL',
      hostelName: 'Block C',
      roomNumber: '301',
      fullAddress: 'Block C, Room 301, Campus Hostel',
      city: 'Campus Town',
      state: 'State',
      postalCode: '100001',
    }, studentHeaders);
    const addressId = addrRes.data.data._id || addrRes.data._id || addrRes.data.address._id;

    // 8. Add Multi-Product Items to Cart
    // Product A × 2 (5 * 2 = 10)
    // Product B × 1 (0 * 1 = 0)
    // Product C × 3 (10 * 3 = 30)
    // Total expected packing charges = 40
    console.log('\nStep 8: Adding Products to Cart (A×2, B×1, C×3)...');
    await axios.post(`${API}/cart/add`, { productId: prodA._id, quantity: 2 }, studentHeaders);
    await axios.post(`${API}/cart/add`, { productId: prodB._id, quantity: 1 }, studentHeaders);
    await axios.post(`${API}/cart/add`, { productId: prodC._id, quantity: 3 }, studentHeaders);

    // Verify Cart Output
    const cartRes = await axios.get(`${API}/cart`, studentHeaders);
    const cartData = cartRes.data.data || cartRes.data.cart;
    console.log(`  ✓ Cart retrieved with ${cartData.items.length} items`);

    // 9. Place Order with Double-Click Idempotency Protection
    console.log('\nStep 9: Submitting Order with Double-Click Protection & Product-Level Packing Charges Calculation...');
    const orderIdempotencyKey = `order-prod-key-${timestamp}`;
    const orderPayload = {
      addressId,
      paymentMethod: 'COD',
      idempotencyKey: orderIdempotencyKey,
    };

    const [orderReq1, orderReq2] = await Promise.all([
      axios.post(`${API}/orders`, orderPayload, studentHeaders),
      axios.post(`${API}/orders`, orderPayload, studentHeaders),
    ]);

    const order1 = orderReq1.data.data || orderReq1.data.order;
    const order2 = orderReq2.data.data || orderReq2.data.order;

    if (order1._id === order2._id) {
      console.log(`  ✓ Double-Click Order Protection PASS: Single order created (${order1._id})`);
    } else {
      console.error(`  ❌ FAILED: Duplicate orders created! ${order1._id} vs ${order2._id}`);
      process.exit(1);
    }

    // 10. Verify Order Billing & Product Snapshots
    console.log('\nStep 10: Verifying Order Billing & Item Packing Snapshots...');
    console.log(`  - Subtotal: ₹${order1.subtotal} (Expected: 850 [2x100 + 1x50 + 3x200])`);
    console.log(`  - Packing Charges Total: ₹${order1.packingCharges} (Expected: 40 [2x5 + 1x0 + 3x10])`);
    console.log(`  - Delivery Fee: ₹${order1.deliveryFee} (Expected: 20)`);
    console.log(`  - GST Amount: ₹${order1.gstAmount} (Expected: 153 [18% of 850])`);
    console.log(`  - Grand Total: ₹${order1.totalAmount} (Expected: 1063 [850 + 40 + 20 + 153])`);

    // Check item snapshots
    const itemA = order1.items.find(i => i.product.toString() === prodA._id || i.product._id === prodA._id);
    const itemB = order1.items.find(i => i.product.toString() === prodB._id || i.product._id === prodB._id);
    const itemC = order1.items.find(i => i.product.toString() === prodC._id || i.product._id === prodC._id);

    console.log(`  - Item A Snapshot Packing Charge: ₹${itemA.packingCharges} (Expected: 5)`);
    console.log(`  - Item B Snapshot Packing Charge: ₹${itemB.packingCharges} (Expected: 0)`);
    console.log(`  - Item C Snapshot Packing Charge: ₹${itemC.packingCharges} (Expected: 10)`);

    if (
      order1.subtotal === 850 &&
      order1.packingCharges === 40 &&
      order1.deliveryFee === 20 &&
      order1.gstAmount === 153 &&
      order1.totalAmount === 1063 &&
      itemA.packingCharges === 5 &&
      itemB.packingCharges === 0 &&
      itemC.packingCharges === 10
    ) {
      console.log('  ✓ Product-Level Packing Charges & Item Snapshots PASS: All calculations exact!');
    } else {
      console.error('  ❌ FAILED: Billing amounts or item snapshots do not match expectation!');
      process.exit(1);
    }

    // 11. Test Product Packing Charges Update Post-Order Preservation
    console.log('\nStep 11: Modifying Product A Packing Charges to ₹100 Post-Order...');
    await axios.put(`${API}/shopkeeper/products/${prodA._id}?shopId=${shop._id}`, {
      packingCharges: 100,
    }, sk1Headers);

    const fetchedOrderRes = await axios.get(`${API}/orders/${order1._id}`, studentHeaders);
    const fetchedOrder = fetchedOrderRes.data.order || fetchedOrderRes.data.data;

    if (fetchedOrder.packingCharges === 40 && fetchedOrder.totalAmount === 1063) {
      console.log(`  ✓ Historical Order Preservation PASS: Historical order packing charges remain ₹${fetchedOrder.packingCharges} and total ₹${fetchedOrder.totalAmount}`);
    } else {
      console.error(`  ❌ FAILED: Historical order modified after product update! Got ₹${fetchedOrder.packingCharges}`);
      process.exit(1);
    }

    console.log('\n======================================================');
    console.log('🎉 ALL PRODUCT-LEVEL PACKING CHARGES TESTS PASSED SUCCESSFULLY!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('❌ Test script failed with error:', err.response?.data || err.message);
    process.exit(1);
  }
}

runTests();
