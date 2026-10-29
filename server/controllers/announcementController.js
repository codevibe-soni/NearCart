import Campaign from '../models/Campaign.js';
import cloudinary, { isCloudinaryConfigured } from '../config/cloudinary.js';
import { uploadBase64Image } from '../services/cloudinaryService.js';
import uploadToCloudinary from '../utils/uploadToCloudinary.js';

/**
 * Helper to upload buffer to Cloudinary with custom folder
 */
const uploadBufferToCloudinary = (fileBuffer, folder = 'nearcart/announcements') => {
  return new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured()) {
      return reject(new Error('Cloudinary environment variables are not configured on the server.'));
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
      },
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
 * Parse and normalize targetPortals from various request body formats
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
 * @desc    Upload poster image to Cloudinary (Admin only)
 * @access  Private (Admin)
 */
export const uploadPosterImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded',
      });
    }

    if (!req.file.mimetype || !req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        message: 'Only image files (JPEG, PNG, WEBP, etc.) are allowed',
      });
    }

    // Check size <= 5MB
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        message: 'Image size exceeds maximum limit of 5MB',
      });
    }

    const uploadRes = await uploadBufferToCloudinary(req.file.buffer, 'nearcart/announcements');

    return res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      url: uploadRes.secure_url,
      publicId: uploadRes.public_id,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Image upload failed: ${error.message}`,
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
    } = req.body;

    const finalTitle = (title || name || '').trim();
    if (!finalTitle) {
      return res.status(400).json({
        success: false,
        message: 'Announcement title is required',
      });
    }

    let resolvedImageUrl = (imageUrl || posterUrl || '').trim();
    let resolvedPublicId = '';

    // Handle file upload if present in multipart request
    if (req.file) {
      if (!req.file.mimetype || !req.file.mimetype.startsWith('image/')) {
        return res.status(400).json({
          success: false,
          message: 'Uploaded file must be a valid image',
        });
      }

      if (req.file.size > 5 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: 'Image file size exceeds 5MB limit',
        });
      }

      try {
        const uploadResult = await uploadBufferToCloudinary(req.file.buffer, 'nearcart/announcements');
        resolvedImageUrl = uploadResult.secure_url;
        resolvedPublicId = uploadResult.public_id;
      } catch (uploadErr) {
        return res.status(500).json({
          success: false,
          message: `Failed to upload poster image to Cloudinary: ${uploadErr.message}`,
        });
      }
    } else if (resolvedImageUrl.startsWith('data:image/')) {
      // Handle base64 image data string
      try {
        const uploadResult = await uploadBase64Image(resolvedImageUrl, {
          folder: 'nearcart/announcements',
        });
        if (!uploadResult.success || !uploadResult.url) {
          return res.status(400).json({
            success: false,
            message: `Base64 image upload failed: ${uploadResult.error || 'Unknown error'}`,
          });
        }
        resolvedImageUrl = uploadResult.url;
        resolvedPublicId = uploadResult.public_id || '';
      } catch (err) {
        return res.status(500).json({
          success: false,
          message: `Image upload failed: ${err.message}`,
        });
      }
    }

    if (!resolvedImageUrl) {
      return res.status(400).json({
        success: false,
        message: 'A poster image is required (upload an image file or provide an image URL)',
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
      imageUrl: resolvedImageUrl,
      posterUrl: resolvedImageUrl,
      imagePublicId: resolvedPublicId,
      message: (message || '').trim(),
      targetPortals: portals,
      isActive: activeBool,
      isPublished: activeBool,
      // Backward-compatible fields
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

    // Handle new file upload
    if (req.file) {
      if (!req.file.mimetype || !req.file.mimetype.startsWith('image/')) {
        return res.status(400).json({
          success: false,
          message: 'Uploaded file must be an image',
        });
      }

      if (req.file.size > 5 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: 'Image size exceeds 5MB limit',
        });
      }

      try {
        const uploadResult = await uploadBufferToCloudinary(req.file.buffer, 'nearcart/announcements');

        // Delete old Cloudinary image if it exists
        if (announcement.imagePublicId && isCloudinaryConfigured()) {
          try {
            await cloudinary.uploader.destroy(announcement.imagePublicId);
          } catch (delErr) {
            console.warn('Could not remove previous Cloudinary image:', delErr.message);
          }
        }

        announcement.imageUrl = uploadResult.secure_url;
        announcement.posterUrl = uploadResult.secure_url;
        announcement.imagePublicId = uploadResult.public_id;
      } catch (uploadErr) {
        return res.status(500).json({
          success: false,
          message: `Failed to upload new image to Cloudinary: ${uploadErr.message}`,
        });
      }
    } else if (imageUrl || posterUrl) {
      const newImg = (imageUrl || posterUrl).trim();
      if (newImg.startsWith('data:image/')) {
        try {
          const uploadResult = await uploadBase64Image(newImg, {
            folder: 'nearcart/announcements',
          });
          if (uploadResult.success && uploadResult.url) {
            announcement.imageUrl = uploadResult.url;
            announcement.posterUrl = uploadResult.url;
            announcement.imagePublicId = uploadResult.public_id || '';
          }
        } catch (err) {
          return res.status(500).json({
            success: false,
            message: `Image upload failed: ${err.message}`,
          });
        }
      } else if (newImg.startsWith('http://') || newImg.startsWith('https://')) {
        announcement.imageUrl = newImg;
        announcement.posterUrl = newImg;
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
 * @desc    Delete announcement and associated Cloudinary image (Admin only)
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

    // Safely remove image from Cloudinary if public ID is recorded
    if (announcement.imagePublicId && isCloudinaryConfigured()) {
      try {
        await cloudinary.uploader.destroy(announcement.imagePublicId);
      } catch (err) {
        console.warn('Failed to delete image from Cloudinary:', err.message);
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
