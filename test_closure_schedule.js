// test_closure_schedule.js
// End‑to‑end verification of shop/hotel closure logic
const axios = require('axios');
const API = 'http://localhost:5000/api';

(async () => {
  try {
    // Admin login
    const adminRes = await axios.post(`${API}/auth/login`, {
      email: 'nearcart7889@gamil.com',
      password: 'Satyam@788058',
    });
    const adminCookie = adminRes.headers['set-cookie'][0];
    const adminHeaders = { headers: { Cookie: adminCookie } };
    console.log('Admin logged in');

    // Create shopkeeper (owner)
    const ts = Date.now();
    const ownerEmail = `owner_${ts}@example.com`;
    await axios.post(`${API}/auth/admin/create-staff`, {
      name: 'Owner',
      email: ownerEmail,
      phone: '1234567890',
      password: 'Password123!',
      role: 'SHOPKEEPER',
    }, adminHeaders);
    const ownerLogin = await axios.post(`${API}/auth/login`, { email: ownerEmail, password: 'Password123!' });
    const ownerCookie = ownerLogin.headers['set-cookie'][0];
    const ownerHeaders = { headers: { Cookie: ownerCookie } };
    console.log('Owner created and logged in');

    // Get a category
    const catRes = await axios.get(`${API}/categories`);
    const categoryId = catRes.data.categories[0]._id;

    // Create a shop
    const shopRes = await axios.post(`${API}/shopkeeper/shop`, {
      name: `Test Shop ${ts}`,
      description: 'Closure verification shop',
      category: categoryId,
      address: 'Test Address',
    }, ownerHeaders);
    const shop = shopRes.data.shop;
    console.log('Shop created', shop._id);

    // Enable weekly closure on Monday
    await axios.put(`${API}/shopkeeper/shop`, {
      weeklyClosingEnabled: true,
      weeklyClosingDays: ['Monday'],
    }, ownerHeaders);
    console.log('Weekly closure set to Monday');

    // Add a special closure for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const y = tomorrow.getFullYear();
    const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const d = String(tomorrow.getDate()).padStart(2, '0');
    const specialDate = `${y}-${m}-${d}`;
    await axios.put(`${API}/shopkeeper/shop`, {
      specialClosingDates: [{ date: specialDate, reason: 'Test Special Closure' }],
    }, ownerHeaders);
    console.log('Special closure added for', specialDate);

    // Student login (ensure a test student exists)
    const studentRes = await axios.post(`${API}/auth/login`, { email: 'student@example.com', password: 'Password123!' });
    const studentCookie = studentRes.headers['set-cookie'][0];
    const studentHeaders = { headers: { Cookie: studentCookie } };
    console.log('Student logged in');

    // Add a product to the shop
    const prodRes = await axios.post(`${API}/shopkeeper/products?shopId=${shop._id}`, {
      name: 'Test Product',
      category: categoryId,
      price: 100,
      stock: 10,
      unit: 'pc',
    }, ownerHeaders);
    const product = prodRes.data.product;
    console.log('Product added', product._id);

    // Normal order (should succeed)
    const orderRes = await axios.post(`${API}/order`, {
      shopId: shop._id,
      items: [{ productId: product._id, quantity: 1 }],
      address: 'Student Address',
    }, studentHeaders);
    console.log('Order succeeded, id', orderRes.data.order._id);

    // Set operating hours to make shop closed now
    await axios.put(`${API}/shopkeeper/shop`, {
      openingTime: '23:00',
      closingTime: '01:00',
    }, ownerHeaders);
    console.log('Operating hours set to 23:00‑01:00');

    // Attempt another order – expect 403
    try {
      await axios.post(`${API}/order`, {
        shopId: shop._id,
        items: [{ productId: product._id, quantity: 1 }],
        address: 'Student Address',
      }, studentHeaders);
      console.error('ERROR: Order succeeded despite closure');
    } catch (e) {
      if (e.response && e.response.status === 403) {
        console.log('✅ Closure blocked order as expected (403)');
        console.log('Reason:', e.response.data.reason);
      } else {
        console.error('Unexpected error during closed‑shop order:', e.message);
      }
    }

    console.log('Closure verification completed');
  } catch (err) {
    console.error('Script failed:', err.message);
    if (err.response) console.error('Status', err.response.status, err.response.data);
    process.exit(1);
  }
})();
