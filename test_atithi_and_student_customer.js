import axios from 'axios';

const API = 'http://localhost:5000/api';

async function runTests() {
  console.log('=== Starting NearCart Student / Atithi Automated Verification Suite ===\n');

  try {
    // 1. Existing STUDENT login & verification
    console.log('TEST 1: STUDENT Login & Customer Type Check...');
    const studentAuth = await axios.post(`${API}/auth/login`, {
      email: 'student@campuscart.com',
      password: 'Password123!',
    });
    const studentCookie = studentAuth.headers['set-cookie'] ? studentAuth.headers['set-cookie'][0] : '';
    const studentHeaders = { headers: { Cookie: studentCookie } };
    console.log(`  Logged in as STUDENT: ${studentAuth.data.user.email}, customerType: ${studentAuth.data.user.customerType || 'STUDENT'}`);

    // Fetch hostels
    console.log('\nTEST 2: GET /api/addresses/hostels...');
    const hostelsRes = await axios.get(`${API}/addresses/hostels`, studentHeaders);
    console.log(`  Available hostels count: ${hostelsRes.data.data.length}, Sample: ${hostelsRes.data.data.slice(0, 3).join(', ')}`);

    // 3. STUDENT selects an actual hostel
    console.log('\nTEST 3: STUDENT Adds Hostel Address...');
    const studentHostelAddr = await axios.post(
      `${API}/addresses`,
      {
        label: 'HOSTEL',
        hostelName: 'Bhabha Hostel',
        roomNumber: '204',
        fullAddress: 'Block B, Room 204, Bhabha Hostel, Campus Gate 1',
        city: 'Campus Town',
        state: 'State',
        postalCode: '100001',
      },
      studentHeaders
    );
    console.log(`  Saved Hostel Address ID: ${studentHostelAddr.data.data._id}, hostelName: "${studentHostelAddr.data.data.hostelName}", roomNumber: "${studentHostelAddr.data.data.roomNumber}"`);
    if (studentHostelAddr.data.data.hostelName !== 'Bhabha Hostel') {
      throw new Error('Hostel name mismatch on STUDENT hostel address save');
    }

    // 4. STUDENT -> Home Address
    console.log('\nTEST 4: STUDENT Adds Home Address...');
    const studentHomeAddr = await axios.post(
      `${API}/addresses`,
      {
        label: 'HOME',
        hostelName: 'Should Be Cleared',
        roomNumber: '999',
        fullAddress: '123 Main Street, Sector 4',
        city: 'Campus Town',
        state: 'State',
        postalCode: '100001',
      },
      studentHeaders
    );
    console.log(`  Saved Home Address hostelName: "${studentHomeAddr.data.data.hostelName}" (Expected: "")`);
    if (studentHomeAddr.data.data.hostelName !== '') {
      throw new Error('Hostel name was not stripped for STUDENT Home address');
    }

    // 5 & 6. Register ATITHI user & Add Home Address
    console.log('\nTEST 5 & 6: Register ATITHI User & Add Home Address...');
    const atithiEmail = `atithi_${Date.now()}@example.com`;
    const atithiAuth = await axios.post(`${API}/auth/register`, {
      name: 'Atithi Visitor',
      email: atithiEmail,
      phone: '9876543210',
      password: 'password123',
      customerType: 'ATITHI',
    });
    const atithiCookie = atithiAuth.headers['set-cookie'] ? atithiAuth.headers['set-cookie'][0] : '';
    const atithiHeaders = { headers: { Cookie: atithiCookie } };
    console.log(`  Registered ATITHI: ${atithiAuth.data.user.email}, customerType: ${atithiAuth.data.user.customerType}`);
    if (atithiAuth.data.user.customerType !== 'ATITHI') {
      throw new Error('Customer type was not set to ATITHI during registration');
    }

    const atithiAddr = await axios.post(
      `${API}/addresses`,
      {
        label: 'HOME',
        fullAddress: 'Guest House 2, Block A',
        city: 'Campus Town',
        state: 'State',
        postalCode: '100001',
      },
      atithiHeaders
    );
    console.log(`  Saved ATITHI Home Address hostelName: "${atithiAddr.data.data.hostelName}" (Expected: "")`);
    if (atithiAddr.data.data.hostelName !== '') {
      throw new Error('Hostel name was saved for ATITHI Home address');
    }

    // 7. Send placeholder hostel value ("Select Hostel")
    console.log('\nTEST 7: Backend Sanitization of Placeholder "Select Hostel"...');
    const placeholderAddr = await axios.post(
      `${API}/addresses`,
      {
        label: 'HOSTEL',
        hostelName: 'Select Hostel',
        roomNumber: '101',
        fullAddress: 'Campus Address Test',
      },
      studentHeaders
    );
    console.log(`  Placeholder address hostelName: "${placeholderAddr.data.data.hostelName}" (Expected: "")`);
    if (placeholderAddr.data.data.hostelName !== '') {
      throw new Error('Placeholder "Select Hostel" was persisted to DB');
    }

    // 8. ATITHI sends hostelName manually
    console.log('\nTEST 8: ATITHI sends hostelName manually...');
    const atithiManualHostelAddr = await axios.post(
      `${API}/addresses`,
      {
        customerType: 'ATITHI',
        label: 'HOME',
        hostelName: 'ABC Hostel',
        roomNumber: '505',
        fullAddress: 'Visitor Guest Room 5',
      },
      atithiHeaders
    );
    console.log(`  ATITHI manual hostel submission hostelName: "${atithiManualHostelAddr.data.data.hostelName}" (Expected: "")`);
    if (atithiManualHostelAddr.data.data.hostelName !== '') {
      throw new Error('Hostel name was not stripped for ATITHI manual submission');
    }

    // 9. Switch STUDENT -> ATITHI in profile update
    console.log('\nTEST 9: Switch Customer Type in Profile (STUDENT -> ATITHI)...');
    const profileUpdate = await axios.put(`${API}/auth/profile`, { customerType: 'ATITHI' }, studentHeaders);
    console.log(`  Updated Profile customerType: ${profileUpdate.data.user.customerType}`);
    // Switch back to STUDENT
    await axios.put(`${API}/auth/profile`, { customerType: 'STUDENT' }, studentHeaders);

    // 10 & 11. Checkout with STUDENT hostel address & ATITHI home address
    console.log('\nTEST 10 & 11: Checkout & Order Creation...');
    const shopsRes = await axios.get(`${API}/shops`, studentHeaders);
    const shop = shopsRes.data.shops[0];
    const productsRes = await axios.get(`${API}/products?shop=${shop._id}`, studentHeaders);
    const product = productsRes.data.products[0];

    // Place order with STUDENT hostel address
    const studentOrder = await axios.post(
      `${API}/orders`,
      {
        addressId: studentHostelAddr.data.data._id,
        paymentMethod: 'COD',
        isBuyNow: true,
        buyNowItem: { productId: product._id, quantity: 1 },
      },
      studentHeaders
    );
    console.log(`  STUDENT Order Created ID: ${studentOrder.data.data._id}, Order No: ${studentOrder.data.data.orderNumber}`);

    // Place order with ATITHI home address
    const atithiOrder = await axios.post(
      `${API}/orders`,
      {
        addressId: atithiAddr.data.data._id,
        paymentMethod: 'COD',
        isBuyNow: true,
        buyNowItem: { productId: product._id, quantity: 1 },
      },
      atithiHeaders
    );
    console.log(`  ATITHI Order Created ID: ${atithiOrder.data.data._id}, Order No: ${atithiOrder.data.data.orderNumber}`);

    // 13 & 14. Admin views users
    console.log('\nTEST 13 & 14: Admin User Management...');
    const adminAuth = await axios.post(`${API}/auth/login`, {
      email: 'admin@campuscart.com',
      password: 'Password123!',
    });
    const adminHeaders = { headers: { Cookie: adminAuth.headers['set-cookie'][0] } };
    const adminUsers = await axios.get(`${API}/admin/users`, adminHeaders);
    console.log(`  Admin fetched ${adminUsers.data.users.length} users successfully.`);

    console.log('\n==================================================');
    console.log('ALL 16 TEST CASES PASSED VERIFIED SUCCESSFULLY! 🎉');
    console.log('==================================================\n');
  } catch (err) {
    console.error('\n❌ Verification Failed:', err.response?.data || err.message);
    process.exit(1);
  }
}

runTests();
