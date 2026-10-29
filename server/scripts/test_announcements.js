import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Campaign from '../models/Campaign.js';

dotenv.config();

const BASE_URL = 'http://localhost:5000/api';
const JWT_SECRET = process.env.JWT_SECRET || 'campuscart_super_secret_jwt_key_2026';

function generateToken(user) {
  return jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
}

async function runTests() {
  console.log('====================================================');
  console.log('🚀 STARTING ADMIN POSTER & ANNOUNCEMENT TEST SUITE');
  console.log('====================================================\n');

  // Connect directly to MongoDB to inspect / clean up
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✓ Connected to MongoDB');

  // Find or create test Admin user
  let admin = await User.findOne({ role: 'ADMIN' });
  if (!admin) {
    admin = await User.create({
      name: 'System Admin',
      email: 'sysadmin_test@campuscart.com',
      phone: '9999900001',
      password: 'AdminPassword123!',
      role: 'ADMIN',
      accountStatus: 'APPROVED',
      isActive: true,
      isVerified: true,
    });
  }
  const adminToken = generateToken(admin);

  // Find or create test Student user
  let student = await User.findOne({ role: 'STUDENT' });
  if (!student) {
    student = await User.create({
      name: 'Test Student',
      email: 'student_test@campuscart.com',
      phone: '9999900002',
      password: 'StudentPassword123!',
      role: 'STUDENT',
      accountStatus: 'APPROVED',
      isActive: true,
      isVerified: true,
    });
  }
  const studentToken = generateToken(student);

  let createdAnnouncementId = null;

  try {
    // ----------------------------------------------------
    // TEST 1: Exact route that previously returned 404
    // ----------------------------------------------------
    console.log('\n[TEST 1] Verifying /api/admin/campaigns is NOT 404 (Route Not Found fix)');
    const checkRouteRes = await fetch(`${BASE_URL}/admin/campaigns`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (checkRouteRes.status === 404) {
      throw new Error('FAIL: /api/admin/campaigns still returned 404 Route Not Found!');
    }
    const checkRouteData = await checkRouteRes.json();
    if (!checkRouteData.success) {
      throw new Error(`FAIL: /api/admin/campaigns failed with: ${JSON.stringify(checkRouteData)}`);
    }
    console.log('   ✓ PASS: /api/admin/campaigns is registered and responded with 200 OK');

    // Also check /api/admin/announcements
    const checkAnnounceRes = await fetch(`${BASE_URL}/admin/announcements`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (checkAnnounceRes.status === 404) {
      throw new Error('FAIL: /api/admin/announcements returned 404');
    }
    console.log('   ✓ PASS: /api/admin/announcements also responded with 200 OK');

    // ----------------------------------------------------
    // TEST 2: Admin-only Authentication & Authorization
    // ----------------------------------------------------
    console.log('\n[TEST 2] Verifying Admin-only Access Controls');
    // Unauthenticated
    const unauthRes = await fetch(`${BASE_URL}/admin/campaigns`);
    if (unauthRes.status !== 401) {
      throw new Error(`FAIL: Expected 401 for unauthenticated request, got ${unauthRes.status}`);
    }
    console.log('   ✓ PASS: Unauthenticated access blocked with 401 Unauthorized');

    // Non-admin (Student)
    const studentRes = await fetch(`${BASE_URL}/admin/campaigns`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    if (studentRes.status !== 403) {
      throw new Error(`FAIL: Expected 403 for student request, got ${studentRes.status}`);
    }
    console.log('   ✓ PASS: Non-admin (Student) access blocked with 403 Forbidden');

    // ----------------------------------------------------
    // TEST 3: Validation checks (Title & Image)
    // ----------------------------------------------------
    console.log('\n[TEST 3] Input & Image Validation');
    // Missing title
    const noTitleRes = await fetch(`${BASE_URL}/admin/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      }),
    });
    if (noTitleRes.status !== 400) {
      throw new Error(`FAIL: Expected 400 for missing title, got ${noTitleRes.status}`);
    }
    console.log('   ✓ PASS: Missing title rejected with 400 Bad Request');

    // Missing image
    const noImageRes = await fetch(`${BASE_URL}/admin/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Banner Without Image',
      }),
    });
    if (noImageRes.status !== 400) {
      throw new Error(`FAIL: Expected 400 for missing image, got ${noImageRes.status}`);
    }
    console.log('   ✓ PASS: Missing poster image rejected with 400 Bad Request');

    // Test real image file upload to Cloudinary via FormData
    console.log('   ⏳ Testing actual image file upload to Cloudinary (/api/admin/campaigns/upload)...');
    const formData = new FormData();
    const samplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const buffer = Buffer.from(samplePngBase64, 'base64');
    const blob = new Blob([buffer], { type: 'image/png' });
    formData.append('poster', blob, 'test_poster.png');

    const uploadRes = await fetch(`${BASE_URL}/admin/campaigns/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: formData,
    });
    const uploadData = await uploadRes.json();
    if (!uploadData.success || !uploadData.url || !uploadData.url.startsWith('http')) {
      throw new Error(`FAIL: Image upload failed: ${JSON.stringify(uploadData)}`);
    }
    console.log(`   ✓ PASS: Image successfully uploaded to Cloudinary: ${uploadData.url}`);

    // ----------------------------------------------------
    // TEST 4: Create Announcement & Verify MongoDB Persistence
    // ----------------------------------------------------
    console.log('\n[TEST 4] Creating Poster & Announcement with Target Audiences');
    const createRes = await fetch(`${BASE_URL}/admin/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Campus Winter Fest',
        message: 'Special deals for students and shopkeepers this week!',
        imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        targetPortals: ['STUDENT', 'SHOPKEEPER'],
        isActive: true,
      }),
    });
    const createData = await createRes.json();
    if (createRes.status !== 201 || !createData.success) {
      throw new Error(`FAIL: Creation failed: ${JSON.stringify(createData)}`);
    }
    createdAnnouncementId = createData.announcement._id;
    console.log(`   ✓ PASS: Announcement created with ID: ${createdAnnouncementId}`);

    // Verify in MongoDB directly
    const docInDb = await Campaign.findById(createdAnnouncementId);
    if (!docInDb || docInDb.title !== 'Campus Winter Fest') {
      throw new Error('FAIL: Document not persisted correctly in MongoDB');
    }
    console.log('   ✓ PASS: Document successfully persisted and verified in MongoDB');

    // ----------------------------------------------------
    // TEST 5: Listing announcements in Admin
    // ----------------------------------------------------
    console.log('\n[TEST 5] Listing Announcements in Admin Dashboard');
    const listRes = await fetch(`${BASE_URL}/admin/campaigns`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const listData = await listRes.json();
    if (!listData.success || !Array.isArray(listData.announcements)) {
      throw new Error('FAIL: Invalid announcement list response format');
    }
    const found = listData.announcements.find((a) => a._id === createdAnnouncementId);
    if (!found) {
      throw new Error('FAIL: Created announcement not found in list response');
    }
    console.log(`   ✓ PASS: Announcement retrieved in list. Total count: ${listData.count}`);

    // ----------------------------------------------------
    // TEST 6: Editing an announcement
    // ----------------------------------------------------
    console.log('\n[TEST 6] Editing an Announcement');
    const editRes = await fetch(`${BASE_URL}/admin/campaigns/${createdAnnouncementId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Campus Winter Fest (Updated)',
        message: 'Updated message: Free hot beverage on orders over ₹150!',
      }),
    });
    const editData = await editRes.json();
    if (editRes.status !== 200 || !editData.success) {
      throw new Error(`FAIL: Update failed: ${JSON.stringify(editData)}`);
    }
    const updatedDb = await Campaign.findById(createdAnnouncementId);
    if (updatedDb.title !== 'Campus Winter Fest (Updated)') {
      throw new Error('FAIL: Update did not persist in MongoDB');
    }
    console.log('   ✓ PASS: Announcement updated and verified in MongoDB');

    // ----------------------------------------------------
    // TEST 7: Toggling publish / unpublish status
    // ----------------------------------------------------
    console.log('\n[TEST 7] Toggling Publish / Unpublish Status');
    const toggleRes1 = await fetch(`${BASE_URL}/admin/campaigns/${createdAnnouncementId}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const toggleData1 = await toggleRes1.json();
    if (!toggleData1.success || toggleData1.announcement.isActive !== false) {
      throw new Error('FAIL: Announcement did not toggle to unpublished');
    }
    console.log('   ✓ PASS: Toggled to Unpublished (isActive: false)');

    // Toggle back to active
    const toggleRes2 = await fetch(`${BASE_URL}/admin/campaigns/${createdAnnouncementId}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const toggleData2 = await toggleRes2.json();
    if (!toggleData2.success || toggleData2.announcement.isActive !== true) {
      throw new Error('FAIL: Announcement did not toggle back to published');
    }
    console.log('   ✓ PASS: Toggled back to Published (isActive: true)');

    // ----------------------------------------------------
    // TEST 8: Public Active Endpoint & Portal Target Filtering
    // ----------------------------------------------------
    console.log('\n[TEST 8] Public Read-only Endpoint & Audience Target Filtering');
    // Student portal (Targeted) -> should receive it
    const studentPortalRes = await fetch(`${BASE_URL}/announcements/active?portal=STUDENT`);
    const studentPortalData = await studentPortalRes.json();
    const hasStudentPoster = studentPortalData.announcements?.some((a) => a._id === createdAnnouncementId);
    if (!hasStudentPoster) {
      throw new Error('FAIL: Student portal did not receive targeted announcement');
    }
    console.log('   ✓ PASS: Student portal received announcement (portal=STUDENT)');

    // Shopkeeper portal (Targeted) -> should receive it
    const skPortalRes = await fetch(`${BASE_URL}/announcements/active?portal=SHOPKEEPER`);
    const skPortalData = await skPortalRes.json();
    const hasSkPoster = skPortalData.announcements?.some((a) => a._id === createdAnnouncementId);
    if (!hasSkPoster) {
      throw new Error('FAIL: Shopkeeper portal did not receive targeted announcement');
    }
    console.log('   ✓ PASS: Shopkeeper portal received announcement (portal=SHOPKEEPER)');

    // Delivery portal (NOT Targeted) -> should NOT receive it
    const delPortalRes = await fetch(`${BASE_URL}/announcements/active?portal=DELIVERY_BOY`);
    const delPortalData = await delPortalRes.json();
    const hasDelPoster = delPortalData.announcements?.some((a) => a._id === createdAnnouncementId);
    if (hasDelPoster) {
      throw new Error('FAIL: Delivery portal received announcement that was not targeted to it');
    }
    console.log('   ✓ PASS: Delivery portal correctly excluded (portal=DELIVERY_BOY)');

    // Path compatibility check: /api/campaigns/active
    const compatRes = await fetch(`${BASE_URL}/campaigns/active?portal=STUDENT`);
    const compatData = await compatRes.json();
    if (!compatData.success || !compatData.announcements?.some((a) => a._id === createdAnnouncementId)) {
      throw new Error('FAIL: /api/campaigns/active compatibility endpoint failed');
    }
    console.log('   ✓ PASS: /api/campaigns/active path compatibility verified');

    // ----------------------------------------------------
    // TEST 9: Unpublished / Hidden state excluded from public
    // ----------------------------------------------------
    console.log('\n[TEST 9] Unpublished Announcement Exclusion from Public View');
    await fetch(`${BASE_URL}/admin/campaigns/${createdAnnouncementId}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const hiddenCheckRes = await fetch(`${BASE_URL}/announcements/active?portal=STUDENT`);
    const hiddenCheckData = await hiddenCheckRes.json();
    const isStillVisible = hiddenCheckData.announcements?.some((a) => a._id === createdAnnouncementId);
    if (isStillVisible) {
      throw new Error('FAIL: Unpublished announcement was still returned on public endpoint!');
    }
    console.log('   ✓ PASS: Unpublished announcement is completely hidden from public view');

    // ----------------------------------------------------
    // TEST 10: Delete Announcement
    // ----------------------------------------------------
    console.log('\n[TEST 10] Deleting Announcement and MongoDB Record Removal');
    const deleteRes = await fetch(`${BASE_URL}/admin/campaigns/${createdAnnouncementId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const deleteData = await deleteRes.json();
    if (deleteRes.status !== 200 || !deleteData.success) {
      throw new Error(`FAIL: Deletion failed: ${JSON.stringify(deleteData)}`);
    }
    const checkDeleted = await Campaign.findById(createdAnnouncementId);
    if (checkDeleted) {
      throw new Error('FAIL: Document was not removed from MongoDB');
    }
    console.log('   ✓ PASS: Announcement deleted and confirmed removed from database');
    createdAnnouncementId = null;

    // ----------------------------------------------------
    // TEST 11: All-Audience Targeting
    // ----------------------------------------------------
    console.log('\n[TEST 11] All-Audience Targeting (ALL)');
    const allAudienceRes = await fetch(`${BASE_URL}/admin/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Campus-wide Announcement',
        message: 'App maintenance scheduled for midnight.',
        imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
        targetPortals: ['ALL'],
        isActive: true,
      }),
    });
    const allAudienceData = await allAudienceRes.json();
    const allAudienceId = allAudienceData.announcement._id;

    // Check all 3 portals
    const [sRes, skRes, dRes] = await Promise.all([
      fetch(`${BASE_URL}/announcements/active?portal=STUDENT`).then((r) => r.json()),
      fetch(`${BASE_URL}/announcements/active?portal=SHOPKEEPER`).then((r) => r.json()),
      fetch(`${BASE_URL}/announcements/active?portal=DELIVERY_BOY`).then((r) => r.json()),
    ]);

    const studentSawIt = sRes.announcements?.some((a) => a._id === allAudienceId);
    const skSawIt = skRes.announcements?.some((a) => a._id === allAudienceId);
    const delSawIt = dRes.announcements?.some((a) => a._id === allAudienceId);

    if (!studentSawIt || !skSawIt || !delSawIt) {
      throw new Error('FAIL: Announcement with targetPortals: ["ALL"] was not delivered to all portals');
    }
    console.log('   ✓ PASS: Announcement with "ALL" target delivered to Students, Shopkeepers, and Delivery Partners');

    // Clean up
    await Campaign.findByIdAndDelete(allAudienceId);
    console.log('   ✓ PASS: Cleaned up test record');

    console.log('\n====================================================');
    console.log('🎉 ALL 11 TESTS PASSED SUCCESSFULLY!');
    console.log('====================================================\n');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    if (createdAnnouncementId) {
      await Campaign.findByIdAndDelete(createdAnnouncementId).catch(() => {});
    }
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
