import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../server/.env') });

import Address from '../../server/models/Address.js';
import User from '../../server/models/User.js';
import { createAddress, updateAddress } from '../../server/controllers/addressController.js';
import { isValidCoordinatePair } from '../../server/utils/distanceCalculator.js';

async function runAddressApiTests() {
  const results = [];
  function logResult(testName, status, evidence) {
    results.push({ testName, status, evidence });
    console.log(`[${status}] ${testName}: ${evidence}`);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    let testUser = await User.findOne({ role: 'STUDENT' });
    if (!testUser) {
      testUser = await User.create({
        name: 'Address Test Student',
        email: 'addr_student_' + Date.now() + '@test.com',
        password: 'password123',
        role: 'STUDENT',
        phone: '9888888888'
      });
    }

    async function testCreate(payload) {
      let resData = {};
      const req = {
        user: { _id: testUser._id, customerType: 'STUDENT' },
        body: payload
      };
      const res = {
        status: (code) => ({
          json: (data) => { resData = { code, data }; }
        })
      };
      await createAddress(req, res);
      return resData;
    }

    // TEST 1: Valid address + valid coordinates
    const t1 = await testCreate({
      fullAddress: 'Test Hostel Block A, Room 101',
      latitude: 28.6139,
      longitude: 77.2090
    });
    if (t1.code === 201 && t1.data?.success && isValidCoordinatePair(t1.data.data?.location?.coordinates)) {
      logResult('TEST 1: Valid Address + Valid Coordinates', 'PASS', `Address saved successfully with GeoJSON coordinates [${t1.data.data.location.coordinates.join(', ')}].`);
    } else {
      logResult('TEST 1: Valid Address + Valid Coordinates', 'FAIL', `Expected 201, got ${t1.code}: ${JSON.stringify(t1.data)}`);
    }

    // TEST 2: Address without latitude
    const t2 = await testCreate({
      fullAddress: 'No Lat Address',
      longitude: 77.2090
    });
    if (t2.code === 400 && t2.data?.message?.includes('pin')) {
      logResult('TEST 2: Address Without Latitude', 'PASS', `Rejected with HTTP 400: "${t2.data.message}"`);
    } else {
      logResult('TEST 2: Address Without Latitude', 'FAIL', `Expected 400 rejection, got ${t2.code}`);
    }

    // TEST 3: Address without longitude
    const t3 = await testCreate({
      fullAddress: 'No Lng Address',
      latitude: 28.6139
    });
    if (t3.code === 400 && t3.data?.message?.includes('pin')) {
      logResult('TEST 3: Address Without Longitude', 'PASS', `Rejected with HTTP 400: "${t3.data.message}"`);
    } else {
      logResult('TEST 3: Address Without Longitude', 'FAIL', `Expected 400 rejection, got ${t3.code}`);
    }

    // TEST 4: latitude = null
    const t4 = await testCreate({
      fullAddress: 'Null Lat Address',
      latitude: null,
      longitude: 77.2090
    });
    if (t4.code === 400) {
      logResult('TEST 4: latitude = null', 'PASS', `Rejected with HTTP 400: "${t4.data.message}"`);
    } else {
      logResult('TEST 4: latitude = null', 'FAIL', `Expected 400 rejection, got ${t4.code}`);
    }

    // TEST 5: longitude = null
    const t5 = await testCreate({
      fullAddress: 'Null Lng Address',
      latitude: 28.6139,
      longitude: null
    });
    if (t5.code === 400) {
      logResult('TEST 5: longitude = null', 'PASS', `Rejected with HTTP 400: "${t5.data.message}"`);
    } else {
      logResult('TEST 5: longitude = null', 'FAIL', `Expected 400 rejection, got ${t5.code}`);
    }

    // TEST 6: latitude = NaN/invalid string
    const t6 = await testCreate({
      fullAddress: 'Invalid Lat String',
      latitude: 'abc_invalid',
      longitude: 77.2090
    });
    if (t6.code === 400) {
      logResult('TEST 6: latitude = NaN string', 'PASS', `Rejected with HTTP 400: "${t6.data.message}"`);
    } else {
      logResult('TEST 6: latitude = NaN string', 'FAIL', `Expected 400 rejection, got ${t6.code}`);
    }

    // TEST 7: longitude = NaN/invalid string
    const t7 = await testCreate({
      fullAddress: 'Invalid Lng String',
      latitude: 28.6139,
      longitude: 'xyz_invalid'
    });
    if (t7.code === 400) {
      logResult('TEST 7: longitude = NaN string', 'PASS', `Rejected with HTTP 400: "${t7.data.message}"`);
    } else {
      logResult('TEST 7: longitude = NaN string', 'FAIL', `Expected 400 rejection, got ${t7.code}`);
    }

    // TEST 8: latitude outside -90 to 90
    const t8 = await testCreate({
      fullAddress: 'Lat Out Of Range',
      latitude: 120.5,
      longitude: 77.2090
    });
    if (t8.code === 400 && t8.data?.message?.includes('between -90 and 90')) {
      logResult('TEST 8: latitude outside [-90, 90]', 'PASS', `Rejected with HTTP 400: "${t8.data.message}"`);
    } else {
      logResult('TEST 8: latitude outside [-90, 90]', 'FAIL', `Expected 400 rejection, got ${t8.code}`);
    }

    // TEST 9: longitude outside -180 to 180
    const t9 = await testCreate({
      fullAddress: 'Lng Out Of Range',
      latitude: 28.6139,
      longitude: 210.0
    });
    if (t9.code === 400 && t9.data?.message?.includes('between -180 and 180')) {
      logResult('TEST 9: longitude outside [-180, 180]', 'PASS', `Rejected with HTTP 400: "${t9.data.message}"`);
    } else {
      logResult('TEST 9: longitude outside [-180, 180]', 'FAIL', `Expected 400 rejection, got ${t9.code}`);
    }

    // TEST 10: Valid coordinates including zero (e.g. lat = 10.5, lng = 0)
    const t10 = await testCreate({
      fullAddress: 'Valid Zero Coordinate Address',
      latitude: 10.5,
      longitude: 0
    });
    if (t10.code === 201 && t10.data?.success && t10.data.data?.location?.coordinates[0] === 0) {
      logResult('TEST 10: Mathematically Valid Zero Coordinate (lat=10.5, lng=0)', 'PASS', `Successfully saved address with lng=0.`);
    } else {
      logResult('TEST 10: Mathematically Valid Zero Coordinate', 'FAIL', `Expected 201, got ${t10.code}: ${JSON.stringify(t10.data)}`);
    }

    // Cleanup test addresses created in this test run
    if (t1.data?.data?._id) await Address.findByIdAndDelete(t1.data.data._id);
    if (t10.data?.data?._id) await Address.findByIdAndDelete(t10.data.data._id);

    console.log('\n================ ADDRESS API TEST SUMMARY ================');
    console.table(results);

    process.exit(0);
  } catch (err) {
    console.error('API Test Error:', err);
    process.exit(1);
  }
}

runAddressApiTests();
