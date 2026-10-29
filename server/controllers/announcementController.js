import Campaign from '../models/Campaign.js';
import cloudinary, { isCloudinaryConfigured } from '../config/cloudinary.js';
import { uploadBase64Image } from '../services/cloudinaryService.js';

/**
 * Validate media file buffer and MIME type against supported formats and size limits.
 * Supported:
 * - Static images (JPG, JPEG, PNG, WEBP): max 5MB
 * - Animated GIFs (GIF): max 5MB (preserves animation)
 * - Videos (MP4, WebM): max 25MB
 */
export const validateAndDetectMedia = (file) => {
  if (!file) {
    throw new Error('No media file provided');
  }

  const mime = (file.mimetype || '').toLowerCase();
  const ext = (file.originalname || '').split('.').pop().toLowerCase();
  const size = file.size || (file.buffer ? file.buffer.length : 0);

  let mediaType = null;
  let resourceType = 'image';
  let maxSize = 5 * 1024 * 1024; // Default 5 MB

  // 1. Video detection (MP4, WebM)
  if (mime === 'video/mp4' || mime === 'video/webm' || ext === 'mp4' || ext === 'webm') {
    mediaType = 'video';
    resourceType = 'video';
    maxSize = 25 * 1024 * 1024; // 25 MB for videos
  }
  // 2. Animated GIF detection
  else if (mime === 'image/gif' || ext === 'gif') {
    mediaType = 'gif';
    resourceType = 'image';
    maxSize = 5 * 1024 * 1024;
  }
  // 3. Static image detection (JPEG, PNG, WEBP)
  else if (
    ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(mime) ||
    ['jpg', 'jpeg', 'png', 'webp'].includes(ext)
  ) {
    mediaType = 'image';
    resourceType = 'image';
    maxSize = 5 * 1024 * 1024;
  } else {
    throw new Error(
      'Unsupported file format. Only JPG, JPEG, PNG, WEBP, GIF images and MP4, WebM videos are allowed.'
    );
  }

  // Size limit validation
  if (size > maxSize) {
    const limitMb = Math.round(maxSize / (1024 * 1024));
    throw new Error(
      `${mediaType === 'video' ? 'Video' : 'Image/GIF'} file size exceeds maximum limit of ${limitMb}MB.`
    );
  }

  // Magic bytes inspection on buffer where practical
  if (file.buffer && file.buffer.length >= 4) {
    const headerHex = file.buffer.subarray(0, 12).toString('hex').toLowerCase();

    if (mediaType === 'image') {
      // PNG: 89504e47, JPEG: ffd8ff, WebP: RIFF....WEBP (52494646)
      const isPng = headerHex.startsWith('89504e47');
      const isJpg = headerHex.startsWith('ffd8ff');
      const isWebp = headerHex.startsWith('52494646');
      if (!isPng && !isJpg && !isWebp && !mime.startsWith('image/')) {
        throw new Error('Corrupted or invalid image file content.');
      }
    } else if (mediaType === 'gif') {
      // GIF87a or GIF89a: 47494638
      if (!headerHex.startsWith('47494638') && !mime.includes('gif')) {
        throw new Error('Corrupted or invalid GIF file content.');
      }
    } else if (mediaType === 'video') {
      // WebM: 1a45dfa3, MP4: contains 'ftyp' in first 16 bytes
      const isWebm = headerHex.startsWith('1a45dfa3');
      const isMp4 = file.buffer.subarray(0, 32).toString('utf-8').includes('ftyp');
      if (!isWebm && !isMp4 && !mime.startsWith('video/')) {
        throw new Error('Corrupted or invalid video file content.');
      }
    }
  }

  return { mediaType, resourceType, maxSize };
};

/**
 * Upload buffer to Cloudinary with custom folder and resource type.
 * Ensures GIF animations are preserved and videos are handled as video resource type.
 */
const uploadBufferToCloudinary = (fileBuffer, folder = 'nearcart/announcements', resourceType = 'image') => {
  return new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured()) {
      return reject(new Error('Cloudinary environment variables are not configured on the server.'));
    }

    const uploadOptions = {
      folder,
      resource_type: resourceType, // 'image' for images/GIFs, 'video' for MP4/WebM
      overwrite: true,
    };

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    uploadStream.end(fileBuffer);
  });
};

/**
 * Parse and normalize targetPortals from request body
 */
const normalizeTargetPortals = (target) => {
  if (!target) return ['ALL'];
  if (Array.isArray(target)) {
    const valid = target.map((p) => String(p).toUpperCase().trim()).filter(Boolean);
    return valid.length > 0 ? valid : ['ALL'];
  }
  if (typeof target === 'string') {
    try {
      const parsed = JSON.parse(target);
      if (Array.isArray(parsed)) {
        return normalizeTargetPortals(parsed);
      }
    } catch {
      // Not JSON, treat as comma-separated or single string
    }
    const parts = target
      .split(',')
      .map((p) => p.toUpperCase().trim())
      .filter(Boolean);
    return parts.length > 0 ? parts : ['ALL'];
  }
  return ['ALL'];
};

/**
 * Infer media type from external URL
 */
const inferMediaTypeFromUrl = (url) => {
  if (!url || typeof url !== 'string') return { mediaType: 'image', resourceType: 'image' };
  const lower = url.split('?')[0].toLowerCase();
  if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.includes('/video/upload/')) {
    return { mediaType: 'video', resourceType: 'video' };
  }
  if (lower.endsWith('.gif')) {
    return { mediaType: 'gif', resourceType: 'image' };
  }
  return { mediaType: 'image', resourceType: 'image' };
};

/**
 * @route   GET /api/admin/announcements
 * @route   GET /api/admin/campaigns
 * @desc    Get all announcements (Admin only)
 * @access  Private (Admin)
 */
export const getAnnouncements = async (req, res, next) => {
  try {
    const announcements = await Campaign.find({}).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: announcements.length,
      announcements,
      campaigns: announcements,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/admin/announcements/:id
 * @route   GET /api/admin/campaigns/:id
 * @desc    Get single announcement by ID (Admin only)
 * @access  Private (Admin)
 */
export const getAnnouncementById = async (req, res, next) => {
  try {
    const announcement = await Campaign.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found',
      });
    }

    res.status(200).json({
      success: true,
      announcement,
      campaign: announcement,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/admin/announcements/upload
 * @route   POST /api/admin/campaigns/upload
 * @desc    Upload poster media (Image, GIF, Video) to Cloudinary (Admin only)
 * @access  Private (Admin)
 */
export const uploadPosterImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No media file uploaded',
      });
    }

    // Validate type and size
    let mediaInfo;
    try {
      mediaInfo = validateAndDetectMedia(req.file);
    } catch (valErr) {
      return res.status(400).json({
        success: false,
        message: valErr.message,
      });
    }

    const uploadRes = await uploadBufferToCloudinary(
      req.file.buffer,
      'nearcart/announcements',
      mediaInfo.resourceType
    );

    return res.status(200).json({
      success: true,
      message: `${mediaInfo.mediaType.toUpperCase()} uploaded successfully`,
      url: uploadRes.secure_url,
      publicId: uploadRes.public_id,
      mediaType: mediaInfo.mediaType,
      resourceType: mediaInfo.resourceType,
      format: uploadRes.format,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Media upload failed: ${error.message}`,
    });
  }
};

/**
 * @route   POST /api/admin/announcements
 * @route   POST /api/admin/campaigns
 * @desc    Create a new poster & announcement (Admin only)
 * @access  Private (Admin)
 */
export const createAnnouncement = async (req, res, next) => {
  try {
    const {
      title,
      name,
      message,
      targetPortals,
      targetAudiences,
      isActive,
      isPublished,
      imageUrl,
      posterUrl,
      mediaUrl,
      mediaType,
      resourceType,
      imagePublicId,
    } = req.body;

    const finalTitle = (title || name || '').trim();
    if (!finalTitle) {
      return res.status(400).json({
        success: false,
        message: 'Announcement title is required',
      });
    }

    let resolvedMediaUrl = (mediaUrl || imageUrl || posterUrl || '').trim();
    let resolvedPublicId = imagePublicId || '';
    let resolvedMediaType = mediaType || 'image';
    let resolvedResourceType = resourceType || 'image';

    // Handle file upload if present in multipart request
    if (req.file) {
      let mediaInfo;
      try {
        mediaInfo = validateAndDetectMedia(req.file);
      } catch (valErr) {
        return res.status(400).json({
          success: false,
          message: valErr.message,
        });
      }

      try {
        const uploadResult = await uploadBufferToCloudinary(
          req.file.buffer,
          'nearcart/announcements',
          mediaInfo.resourceType
        );
        resolvedMediaUrl = uploadResult.secure_url;
        resolvedPublicId = uploadResult.public_id;
        resolvedMediaType = mediaInfo.mediaType;
        resolvedResourceType = mediaInfo.resourceType;
      } catch (uploadErr) {
        return res.status(500).json({
          success: false,
          message: `Failed to upload poster media to Cloudinary: ${uploadErr.message}`,
        });
      }
    } else if (resolvedMediaUrl.startsWith('data:image/')) {
      // Handle base64 image data string
      try {
        const uploadResult = await uploadBase64Image(resolvedMediaUrl, {
          folder: 'nearcart/announcements',
        });
        if (!uploadResult.success || !uploadResult.url) {
          return res.status(400).json({
            success: false,
            message: `Base64 media upload failed: ${uploadResult.error || 'Unknown error'}`,
          });
        }
        resolvedMediaUrl = uploadResult.url;
        resolvedPublicId = uploadResult.public_id || '';
        resolvedMediaType = 'image';
        resolvedResourceType = 'image';
      } catch (err) {
        return res.status(500).json({
          success: false,
          message: `Media upload failed: ${err.message}`,
        });
      }
    } else if (resolvedMediaUrl) {
      // Inferred type from URL if not specified
      const inferred = inferMediaTypeFromUrl(resolvedMediaUrl);
      if (!mediaType || mediaType === 'image') {
        resolvedMediaType = inferred.mediaType;
        resolvedResourceType = inferred.resourceType;
      }
    }

    if (!resolvedMediaUrl) {
      return res.status(400).json({
        success: false,
        message: 'Poster media is required (upload an image/GIF/video file or provide a media URL)',
      });
    }

    const portals = normalizeTargetPortals(targetPortals || targetAudiences);

    const activeBool =
      typeof isPublished !== 'undefined'
        ? String(isPublished) === 'true' || isPublished === true
        : typeof isActive !== 'undefined'
        ? String(isActive) === 'true' || isActive === true
        : true;

    const newAnnouncement = new Campaign({
      title: finalTitle,
      name: finalTitle,
      mediaUrl: resolvedMediaUrl,
      mediaType: resolvedMediaType,
      resourceType: resolvedResourceType,
      imageUrl: resolvedMediaUrl,
      posterUrl: resolvedMediaUrl,
      imagePublicId: resolvedPublicId,
      message: (message || '').trim(),
      targetPortals: portals,
      isActive: activeBool,
      isPublished: activeBool,
      occasion: 'General Announcement',
      bannerText: (message || finalTitle).trim(),
    });

    await newAnnouncement.save();

    return res.status(201).json({
      success: true,
      message: 'Announcement published successfully',
      announcement: newAnnouncement,
      campaign: newAnnouncement,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/admin/announcements/:id
 * @route   PUT /api/admin/campaigns/:id
 * @desc    Update an announcement (Admin only)
 * @access  Private (Admin)
 */
export const updateAnnouncement = async (req, res, next) => {
  try {
    const announcement = await Campaign.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found',
      });
    }

    const {
      title,
      name,
      message,
      targetPortals,
      targetAudiences,
      isActive,
      isPublished,
      imageUrl,
      posterUrl,
      mediaUrl,
      mediaType,
      resourceType,
      imagePublicId,
    } = req.body;

    if (title || name) {
      const finalTitle = (title || name).trim();
      announcement.title = finalTitle;
      announcement.name = finalTitle;
    }

    if (typeof message !== 'undefined') {
      announcement.message = String(message).trim();
      announcement.bannerText = announcement.message || announcement.title;
    }

    if (targetPortals || targetAudiences) {
      announcement.targetPortals = normalizeTargetPortals(targetPortals || targetAudiences);
    }

    if (typeof isActive !== 'undefined' || typeof isPublished !== 'undefined') {
      const activeBool =
        typeof isPublished !== 'undefined'
          ? String(isPublished) === 'true' || isPublished === true
          : String(isActive) === 'true' || isActive === true;
      announcement.isActive = activeBool;
      announcement.isPublished = activeBool;
    }

    // Handle new media file upload (replaces previous asset)
    if (req.file) {
      let mediaInfo;
      try {
        mediaInfo = validateAndDetectMedia(req.file);
      } catch (valErr) {
        return res.status(400).json({
          success: false,
          message: valErr.message,
        });
      }

      try {
        const uploadResult = await uploadBufferToCloudinary(
          req.file.buffer,
          'nearcart/announcements',
          mediaInfo.resourceType
        );

        // Delete old Cloudinary asset safely using its specific resource type
        if (announcement.imagePublicId && isCloudinaryConfigured()) {
          try {
            const oldResourceType = announcement.resourceType || (announcement.mediaType === 'video' ? 'video' : 'image');
            await cloudinary.uploader.destroy(announcement.imagePublicId, {
              resource_type: oldResourceType,
            });
          } catch (delErr) {
            console.warn('Could not remove previous Cloudinary asset:', delErr.message);
          }
        }

        announcement.mediaUrl = uploadResult.secure_url;
        announcement.imageUrl = uploadResult.secure_url;
        announcement.posterUrl = uploadResult.secure_url;
        announcement.imagePublicId = uploadResult.public_id;
        announcement.mediaType = mediaInfo.mediaType;
        announcement.resourceType = mediaInfo.resourceType;
      } catch (uploadErr) {
        return res.status(500).json({
          success: false,
          message: `Failed to upload new media to Cloudinary: ${uploadErr.message}`,
        });
      }
    } else if (mediaUrl || imageUrl || posterUrl) {
      const newMedia = (mediaUrl || imageUrl || posterUrl).trim();
      if (newMedia.startsWith('data:image/')) {
        try {
          const uploadResult = await uploadBase64Image(newMedia, {
            folder: 'nearcart/announcements',
          });
          if (uploadResult.success && uploadResult.url) {
            announcement.mediaUrl = uploadResult.url;
            announcement.imageUrl = uploadResult.url;
            announcement.posterUrl = uploadResult.url;
            announcement.imagePublicId = uploadResult.public_id || '';
            announcement.mediaType = 'image';
            announcement.resourceType = 'image';
          }
        } catch (err) {
          return res.status(500).json({
            success: false,
            message: `Media upload failed: ${err.message}`,
          });
        }
      } else if (newMedia.startsWith('http://') || newMedia.startsWith('https://')) {
        announcement.mediaUrl = newMedia;
        announcement.imageUrl = newMedia;
        announcement.posterUrl = newMedia;
        if (imagePublicId) announcement.imagePublicId = imagePublicId;
        if (mediaType) announcement.mediaType = mediaType;
        if (resourceType) announcement.resourceType = resourceType;
        else {
          const inferred = inferMediaTypeFromUrl(newMedia);
          announcement.mediaType = inferred.mediaType;
          announcement.resourceType = inferred.resourceType;
        }
      }
    }

    await announcement.save();

    return res.status(200).json({
      success: true,
      message: 'Announcement updated successfully',
      announcement,
      campaign: announcement,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PATCH /api/admin/announcements/:id/toggle
 * @route   PATCH /api/admin/campaigns/:id/toggle
 * @desc    Toggle announcement published/active state (Admin only)
 * @access  Private (Admin)
 */
export const togglePublishAnnouncement = async (req, res, next) => {
  try {
    const announcement = await Campaign.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found',
      });
    }

    const nextState = !announcement.isActive;
    announcement.isActive = nextState;
    announcement.isPublished = nextState;

    await announcement.save();

    return res.status(200).json({
      success: true,
      message: `Announcement ${nextState ? 'published' : 'unpublished'} successfully`,
      announcement,
      campaign: announcement,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/admin/announcements/:id
 * @route   DELETE /api/admin/campaigns/:id
 * @desc    Delete announcement and associated Cloudinary asset (Admin only)
 * @access  Private (Admin)
 */
export const deleteAnnouncement = async (req, res, next) => {
  try {
    const announcement = await Campaign.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found',
      });
    }

    // Safely remove asset from Cloudinary using the appropriate resource type
    if (announcement.imagePublicId && isCloudinaryConfigured()) {
      try {
        const resType =
          announcement.resourceType ||
          (announcement.mediaType === 'video' ? 'video' : 'image');

        await cloudinary.uploader.destroy(announcement.imagePublicId, {
          resource_type: resType,
        });
      } catch (err) {
        console.warn('Failed to delete asset from Cloudinary:', err.message);
      }
    }

    await Campaign.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Announcement deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/announcements/active
 * @route   GET /api/campaigns/active
 * @desc    Get published announcements for a specific portal (Public)
 * @access  Public
 */
export const getActiveAnnouncements = async (req, res, next) => {
  try {
    const { portal } = req.query;

    const query = {
      $or: [{ isActive: true }, { isPublished: true }],
    };

    if (portal) {
      const norm = portal.toUpperCase().trim();
      query.$and = [
        {
          $or: [
            { targetPortals: { $in: [norm, 'ALL'] } },
            { targetPortals: { $size: 0 } },
            { targetPortals: { $exists: false } },
          ],
        },
      ];
    }

    const announcements = await Campaign.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: announcements.length,
      announcements,
      campaigns: announcements,
    });
  } catch (error) {
    next(error);
  }
};
