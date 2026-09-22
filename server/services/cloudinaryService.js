import cloudinary, { isCloudinaryConfigured } from '../config/cloudinary.js';

/**
 * Upload a Base64 image data URL to Cloudinary cleanly.
 * If base64Str is already an HTTP/HTTPS URL, returns it unchanged.
 * If Cloudinary is not configured, returns success: false with original URL for safety fallback.
 */
export const uploadBase64Image = async (base64Str, options = {}) => {
  if (!base64Str || typeof base64Str !== 'string') {
    return { success: false, error: 'Invalid image input', url: base64Str };
  }

  // If image is already an HTTP/HTTPS URL, no upload needed
  if (base64Str.startsWith('http://') || base64Str.startsWith('https://')) {
    return { success: true, url: base64Str, skipped: true };
  }

  // Only attempt upload if Base64 Data URL
  if (!base64Str.startsWith('data:image/')) {
    return { success: false, error: 'Image string is not a Base64 Data URL', url: base64Str };
  }

  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary environment variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are not set. Base64 storage is strictly prohibited.');
  }

  try {
    const uploadOptions = {
      folder: 'nearcart/products',
      resource_type: 'auto',
      overwrite: true,
      ...options,
    };

    const result = await cloudinary.uploader.upload(base64Str, uploadOptions);

    if (!result?.secure_url) {
      throw new Error('Cloudinary response did not contain a valid secure_url');
    }

    return {
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      format: result.format,
      bytes: result.bytes,
    };
  } catch (error) {
    console.error('❌ Cloudinary Upload Error:', error.message);
    throw new Error(`Cloudinary upload failed: ${error.message}`);
  }
};

/**
 * Generate server-side signed Cloudinary upload parameters for browser direct uploads.
 * Keeps CLOUDINARY_API_SECRET strictly on the server.
 */
export const generateCloudinarySignature = (folder = 'nearcart/products') => {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary is not configured on the server.');
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const paramsToSign = {
    timestamp,
    folder,
  };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET
  );

  return {
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    folder,
  };
};
