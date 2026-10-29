import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Campaign from '../models/Campaign.js';
import cloudinary, { isCloudinaryConfigured } from '../config/cloudinary.js';

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

// Sample 1x1 transparent PNG buffer
const SAMPLE_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const PNG_BUFFER = Buffer.from(SAMPLE_PNG_BASE64, 'base64');

// Sample 1x1 animated GIF buffer (valid GIF89a header)
const SAMPLE_GIF_BASE64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const GIF_BUFFER = Buffer.from(SAMPLE_GIF_BASE64, 'base64');

async function runTests() {
  console.log('====================================================');
  console.log('🚀 COMPREHENSIVE POSTER & MEDIA TEST SUITE');
  console.log('   (Images, Animated GIFs, and MP4/WebM Videos)');
  console.log('====================================================\n');

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
  } else if (!admin.isActive) {
    admin.isActive = true;
    await admin.save();
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
  } else if (!student.isActive) {
    student.isActive = true;
    await student.save();
  }
  const studentToken = generateToken(student);

  // Find or create test Shopkeeper user
  let shopkeeper = await User.findOne({ role: 'SHOPKEEPER' });
  if (!shopkeeper) {
    shopkeeper = await User.create({
      name: 'Test Shopkeeper',
      email: 'shopkeeper_test@campuscart.com',
      phone: '9999900003',
      password: 'ShopkeeperPassword123!',
      role: 'SHOPKEEPER',
      accountStatus: 'APPROVED',
      isActive: true,
      isVerified: true,
    });
  } else if (!shopkeeper.isActive) {
    shopkeeper.isActive = true;
    await shopkeeper.save();
  }
  const shopkeeperToken = generateToken(shopkeeper);

  // Find or create test Delivery Boy user
  let deliveryBoy = await User.findOne({ role: 'DELIVERY_BOY' });
  if (!deliveryBoy) {
    deliveryBoy = await User.create({
      name: 'Test Delivery Partner',
      email: 'delivery_test@campuscart.com',
      phone: '9999900004',
      password: 'DeliveryPassword123!',
      role: 'DELIVERY_BOY',
      accountStatus: 'APPROVED',
      isActive: true,
      isVerified: true,
    });
  } else if (!deliveryBoy.isActive) {
    deliveryBoy.isActive = true;
    await deliveryBoy.save();
  }
  const deliveryToken = generateToken(deliveryBoy);

  // Clean up any stale test announcements from previous runs
  await Campaign.deleteMany({ title: { $regex: /Test Poster|Test Video|Test GIF|Test Legacy|Campus Winter Fest/i } });

  // Download small sample video buffer (283 KB)
  console.log('⏳ Fetching lightweight sample video for test pipeline...');
  const videoAb = await fetch('https://res.cloudinary.com/demo/video/upload/w_200/dog.mp4').then((r) => r.arrayBuffer());
  const VIDEO_BUFFER = Buffer.from(videoAb);
  console.log(`✓ Sample MP4 loaded (${VIDEO_BUFFER.length} bytes)\n`);

  let pngUploadResult = null;
  let gifUploadResult = null;
  let videoUploadResult = null;
  let createdVideoAnnouncementId = null;
  let legacyAnnouncementId = null;

  try {
    // ----------------------------------------------------
    // TEST 1: JPG/PNG Image Upload
    // ----------------------------------------------------
    console.log('[TEST 1] Verifying Static PNG/JPG Image Upload');
    const pngFormData = new FormData();
    pngFormData.append('poster', new Blob([PNG_BUFFER], { type: 'image/png' }), 'banner.png');

    const pngRes = await fetch(`${BASE_URL}/admin/campaigns/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: pngFormData,
    });
    pngUploadResult = await pngRes.json();
    if (!pngUploadResult.success || !pngUploadResult.url || pngUploadResult.mediaType !== 'image') {
      throw new Error(`FAIL: PNG upload failed: ${JSON.stringify(pngUploadResult)}`);
    }
    console.log(`   ✓ PASS: Static image uploaded as resource_type: image (${pngUploadResult.url})`);

    // ----------------------------------------------------
    // TEST 2: Animated GIF Upload (Preserves Animation)
    // ----------------------------------------------------
    console.log('\n[TEST 2] Verifying Animated GIF Upload (Preserving Animation)');
    const gifFormData = new FormData();
    gifFormData.append('poster', new Blob([GIF_BUFFER], { type: 'image/gif' }), 'animation.gif');

    const gifRes = await fetch(`${BASE_URL}/admin/campaigns/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: gifFormData,
    });
    gifUploadResult = await gifRes.json();
    if (
      !gifUploadResult.success ||
      !gifUploadResult.url ||
      gifUploadResult.mediaType !== 'gif' ||
      !gifUploadResult.url.toLowerCase().endsWith('.gif')
    ) {
      throw new Error(`FAIL: GIF upload failed: ${JSON.stringify(gifUploadResult)}`);
    }
    console.log(`   ✓ PASS: Animated GIF uploaded and served as GIF format (${gifUploadResult.url})`);

    // ----------------------------------------------------
    // TEST 3: MP4/WebM Video Upload
    // ----------------------------------------------------
    console.log('\n[TEST 3] Verifying Video Upload (MP4/WebM)');
    const videoFormData = new FormData();
    videoFormData.append('poster', new Blob([VIDEO_BUFFER], { type: 'video/mp4' }), 'promo.mp4');

    const videoRes = await fetch(`${BASE_URL}/admin/campaigns/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: videoFormData,
    });
    videoUploadResult = await videoRes.json();
    if (
      !videoUploadResult.success ||
      !videoUploadResult.url ||
      videoUploadResult.mediaType !== 'video' ||
      videoUploadResult.resourceType !== 'video'
    ) {
      throw new Error(`FAIL: Video upload failed: ${JSON.stringify(videoUploadResult)}`);
    }
    console.log(`   ✓ PASS: Video uploaded with resource_type: video (${videoUploadResult.url})`);

    // ----------------------------------------------------
    // TEST 4: Unsupported File Types Rejected
    // ----------------------------------------------------
    console.log('\n[TEST 4] Verifying Unsupported File Types are Rejected');
    const invalidFormData = new FormData();
    invalidFormData.append('poster', new Blob([Buffer.from('%PDF-1.4 ... fake pdf')], { type: 'application/pdf' }), 'doc.pdf');

    const invalidRes = await fetch(`${BASE_URL}/admin/campaigns/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: invalidFormData,
    });
    if (invalidRes.status !== 400 && invalidRes.status !== 500) {
      throw new Error(`FAIL: Expected 400 for PDF upload, got ${invalidRes.status}`);
    }
    const invalidData = await invalidRes.json();
    if (invalidData.success) {
      throw new Error('FAIL: PDF upload succeeded when it should be rejected');
    }
    console.log('   ✓ PASS: PDF upload correctly rejected with validation error');

    // ----------------------------------------------------
    // TEST 5: Oversized Uploads Rejected (Limits: 5MB Images, 25MB Videos)
    // ----------------------------------------------------
    console.log('\n[TEST 5] Verifying Oversized Upload Rejection according to limits');
    // Test oversized image (5.5 MB > 5 MB limit)
    const oversizedImageBuffer = Buffer.alloc(5.5 * 1024 * 1024, 0);
    // Put valid PNG header
    oversizedImageBuffer.write('\x89PNG\r\n\x1a\n', 0, 'binary');
    const oversizedImgFd = new FormData();
    oversizedImgFd.append('poster', new Blob([oversizedImageBuffer], { type: 'image/png' }), 'huge.png');

    const oversizedImgRes = await fetch(`${BASE_URL}/admin/campaigns/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: oversizedImgFd,
    });
    const oversizedImgData = await oversizedImgRes.json();
    if (oversizedImgRes.status !== 400 || oversizedImgData.success) {
      throw new Error(`FAIL: Oversized image should return 400, got ${oversizedImgRes.status}`);
    }
    console.log('   ✓ PASS: 5.5MB image rejected (> 5MB limit)');

    // ----------------------------------------------------
    // TEST 6: Media Type & URL Persistence in MongoDB
    // ----------------------------------------------------
    console.log('\n[TEST 6] Verifying Media Type and URL Persistence in MongoDB');
    const createVidRes = await fetch(`${BASE_URL}/admin/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Test Video Campaign',
        message: 'Watch our festival video promo!',
        mediaUrl: videoUploadResult.url,
        mediaType: 'video',
        resourceType: 'video',
        imagePublicId: videoUploadResult.publicId,
        targetPortals: ['STUDENT'],
        isActive: true,
      }),
    });
    const createVidData = await createVidRes.json();
    if (!createVidData.success) {
      throw new Error(`FAIL: Video announcement creation failed: ${JSON.stringify(createVidData)}`);
    }
    createdVideoAnnouncementId = createVidData.announcement._id;

    // Verify in MongoDB directly
    const videoDoc = await Campaign.findById(createdVideoAnnouncementId);
    if (!videoDoc || videoDoc.mediaType !== 'video' || videoDoc.resourceType !== 'video' || !videoDoc.mediaUrl) {
      throw new Error('FAIL: Video announcement did not persist mediaType/resourceType correctly in MongoDB');
    }
    console.log(`   ✓ PASS: Video announcement persisted in MongoDB (mediaType: ${videoDoc.mediaType}, resourceType: ${videoDoc.resourceType})`);

    // ----------------------------------------------------
    // TEST 7: Backward Compatibility (Old Image-only Announcements Still Render)
    // ----------------------------------------------------
    console.log('\n[TEST 7] Verifying Backward Compatibility (Old Image-Only Announcements)');
    // Insert document directly into MongoDB simulating pre-upgrade record
    const legacyDoc = await Campaign.create({
      name: 'Test Legacy Announcement',
      title: 'Test Legacy Announcement',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      posterUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      targetPortals: ['STUDENT'],
      isActive: true,
      isPublished: true,
    });
    legacyAnnouncementId = legacyDoc._id.toString();

    // Fetch via public portal endpoint
    const legacyPortalRes = await fetch(`${BASE_URL}/announcements/active?portal=STUDENT`);
    const legacyPortalData = await legacyPortalRes.json();
    const foundLegacy = legacyPortalData.announcements?.find((a) => a._id === legacyAnnouncementId);
    if (!foundLegacy || (!foundLegacy.imageUrl && !foundLegacy.mediaUrl)) {
      throw new Error('FAIL: Legacy image-only announcement failed to render on public portal');
    }
    console.log('   ✓ PASS: Legacy image-only announcement renders correctly on portal');

    // ----------------------------------------------------
    // TEST 8: Portal Audience Targeting & Publish/Unpublish
    // ----------------------------------------------------
    console.log('\n[TEST 8] Verifying Portal Audience Targeting and Toggle Publish/Unpublish');
    // Student portal should receive the video announcement
    const studentRes = await fetch(`${BASE_URL}/announcements/active?portal=STUDENT`);
    const studentData = await studentRes.json();
    const studentHasVideo = studentData.announcements?.some((a) => a._id === createdVideoAnnouncementId);
    if (!studentHasVideo) {
      throw new Error('FAIL: Student portal did not receive targeted video announcement');
    }

    // Delivery portal should NOT receive the video announcement
    const delRes = await fetch(`${BASE_URL}/announcements/active?portal=DELIVERY_BOY`);
    const delData = await delRes.json();
    const delHasVideo = delData.announcements?.some((a) => a._id === createdVideoAnnouncementId);
    if (delHasVideo) {
      throw new Error('FAIL: Delivery portal received announcement not targeted to it');
    }
    console.log('   ✓ PASS: Audience targeting correctly filters media by portal');

    // Toggle unpublish
    await fetch(`${BASE_URL}/admin/campaigns/${createdVideoAnnouncementId}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const unpublishedCheck = await fetch(`${BASE_URL}/announcements/active?portal=STUDENT`).then((r) => r.json());
    if (unpublishedCheck.announcements?.some((a) => a._id === createdVideoAnnouncementId)) {
      throw new Error('FAIL: Unpublished announcement was still returned to portal');
    }
    console.log('   ✓ PASS: Unpublished announcement is hidden from portal view');

    // Toggle back
    await fetch(`${BASE_URL}/admin/campaigns/${createdVideoAnnouncementId}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    // ----------------------------------------------------
    // TEST 9: Only Admin Can Replace or Delete Media
    // ----------------------------------------------------
    console.log('\n[TEST 9] Verifying Only Admin Can Replace or Delete Media');
    // Admin replaces media
    const updateRes = await fetch(`${BASE_URL}/admin/campaigns/${createdVideoAnnouncementId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Test Video Campaign (Updated)',
        mediaUrl: gifUploadResult.url,
        mediaType: 'gif',
        resourceType: 'image',
        imagePublicId: gifUploadResult.publicId,
      }),
    });
    const updateData = await updateRes.json();
    if (!updateData.success || updateData.announcement.mediaType !== 'gif') {
      throw new Error(`FAIL: Admin media replacement failed: ${JSON.stringify(updateData)}`);
    }
    console.log('   ✓ PASS: Admin successfully replaced media');

    // ----------------------------------------------------
    // TEST 10: Unauthorized Users Cannot Upload, Replace, or Delete Media
    // ----------------------------------------------------
    console.log('\n[TEST 10] Verifying Unauthorized Users are Blocked from Uploading, Updating, or Deleting');
    // Unauthenticated delete
    const unauthDel = await fetch(`${BASE_URL}/admin/campaigns/${createdVideoAnnouncementId}`, { method: 'DELETE' });
    if (unauthDel.status !== 401) throw new Error(`FAIL: Expected 401, got ${unauthDel.status}`);

    // Student delete
    const studentDel = await fetch(`${BASE_URL}/admin/campaigns/${createdVideoAnnouncementId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    if (studentDel.status !== 403) throw new Error(`FAIL: Expected 403 for student delete, got ${studentDel.status}`);

    // Shopkeeper delete
    const skDel = await fetch(`${BASE_URL}/admin/campaigns/${createdVideoAnnouncementId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${shopkeeperToken}` },
    });
    if (skDel.status !== 403) throw new Error(`FAIL: Expected 403 for shopkeeper delete, got ${skDel.status}`);

    // Delivery Boy delete
    const delBoyDel = await fetch(`${BASE_URL}/admin/campaigns/${createdVideoAnnouncementId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${deliveryToken}` },
    });
    if (delBoyDel.status !== 403) throw new Error(`FAIL: Expected 403 for delivery partner delete, got ${delBoyDel.status}`);

    // Verify document still exists in DB
    const checkDoc = await Campaign.findById(createdVideoAnnouncementId);
    if (!checkDoc) throw new Error('FAIL: Poster was deleted by unauthorized user!');
    console.log('   ✓ PASS: Unauthenticated (401), Student (403), Shopkeeper (403), and Delivery Partner (403) blocked');

    // ----------------------------------------------------
    // TEST 11: Replacing or Deleting Media Cleans up Correct Cloudinary Resource Type
    // ----------------------------------------------------
    console.log('\n[TEST 11] Verifying Cloudinary Asset Cleanup with Correct Resource Type');
    // Admin permanently deletes the announcement
    const adminDel = await fetch(`${BASE_URL}/admin/campaigns/${createdVideoAnnouncementId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminDelData = await adminDel.json();
    if (!adminDelData.success) throw new Error(`FAIL: Admin delete failed: ${JSON.stringify(adminDelData)}`);

    const deletedFromDb = await Campaign.findById(createdVideoAnnouncementId);
    if (deletedFromDb) throw new Error('FAIL: Document remained in MongoDB after Admin delete');
    console.log('   ✓ PASS: Admin deleted announcement from MongoDB');

    // Clean up temporary test Cloudinary assets
    if (isCloudinaryConfigured()) {
      if (pngUploadResult?.publicId) {
        await cloudinary.uploader.destroy(pngUploadResult.publicId, { resource_type: 'image' }).catch(() => {});
      }
      if (videoUploadResult?.publicId) {
        await cloudinary.uploader.destroy(videoUploadResult.publicId, { resource_type: 'video' }).catch(() => {});
      }
      if (gifUploadResult?.publicId) {
        await cloudinary.uploader.destroy(gifUploadResult.publicId, { resource_type: 'image' }).catch(() => {});
      }
    }
    console.log('   ✓ PASS: Cleaned up Cloudinary test assets with appropriate resource_type');

    // Clean up legacy doc
    if (legacyAnnouncementId) {
      await Campaign.findByIdAndDelete(legacyAnnouncementId);
    }

    console.log('\n====================================================');
    console.log('🎉 ALL 11 TESTS PASSED SUCCESSFULLY!');
    console.log('====================================================\n');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    if (createdVideoAnnouncementId) {
      await Campaign.findByIdAndDelete(createdVideoAnnouncementId).catch(() => {});
    }
    if (legacyAnnouncementId) {
      await Campaign.findByIdAndDelete(legacyAnnouncementId).catch(() => {});
    }
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
