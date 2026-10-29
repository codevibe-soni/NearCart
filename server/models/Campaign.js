import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema(
  {
    // Announcement & Poster primary fields
    title: {
      type: String,
      trim: true,
      default: '',
    },
    // Kept for backward compatibility with existing campaign records
    name: {
      type: String,
      trim: true,
      default: '',
    },
    // Media URL, Type, and Resource Type (supports Image, GIF, Video)
    mediaUrl: {
      type: String,
      trim: true,
      default: '',
    },
    mediaType: {
      type: String,
      enum: ['image', 'gif', 'video'],
      default: 'image',
    },
    resourceType: {
      type: String,
      enum: ['image', 'video', 'raw', 'auto'],
      default: 'image',
    },
    // Backward-compatible fields for existing image posters
    imageUrl: {
      type: String,
      trim: true,
      default: '',
    },
    posterUrl: {
      type: String,
      trim: true,
      default: '',
    },
    imagePublicId: {
      type: String,
      trim: true,
      default: '',
    },
    // Optional announcement message displayed with poster
    message: {
      type: String,
      trim: true,
      default: '',
    },
    // Target audience: STUDENT, SHOPKEEPER, DELIVERY_BOY, or ALL
    targetPortals: {
      type: [String],
      enum: {
        values: ['STUDENT', 'SHOPKEEPER', 'DELIVERY_BOY', 'ALL'],
        message: '{VALUE} is not a valid portal',
      },
      default: ['ALL'],
    },
    // Published / Active status
    isActive: {
      type: Boolean,
      default: true,
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    // Backward-compatible optional fields
    occasion: {
      type: String,
      trim: true,
      default: '',
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
    bannerText: {
      type: String,
      default: '',
    },
    bannerColor: {
      type: String,
      default: '#ffcc00',
    },
    animationPreset: {
      type: String,
      default: '',
    },
    informational: {
      type: Boolean,
      default: true,
    },
    discount: {
      type: Number,
      default: 0,
      min: [0, 'Discount cannot be negative'],
    },
  },
  {
    timestamps: true,
  }
);

// Helper to determine media type from URL extension
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

// Keep title/name, mediaUrl/imageUrl/posterUrl, and isActive/isPublished in sync before saving
campaignSchema.pre('save', function (next) {
  // Sync title and name
  if (this.title && !this.name) {
    this.name = this.title;
  } else if (this.name && !this.title) {
    this.title = this.name;
  }

  // Sync mediaUrl, imageUrl, and posterUrl
  const resolvedUrl = this.mediaUrl || this.imageUrl || this.posterUrl || '';
  if (resolvedUrl) {
    if (!this.mediaUrl) this.mediaUrl = resolvedUrl;
    if (!this.imageUrl) this.imageUrl = resolvedUrl;
    if (!this.posterUrl) this.posterUrl = resolvedUrl;

    // Detect mediaType and resourceType if not set or set to default image
    if (!this.mediaType || this.mediaType === 'image') {
      const inferred = inferMediaTypeFromUrl(resolvedUrl);
      if (inferred.mediaType !== 'image') {
        this.mediaType = inferred.mediaType;
        this.resourceType = inferred.resourceType;
      }
    }
  }

  // Sync isPublished and isActive
  if (typeof this.isPublished === 'boolean' && typeof this.isActive !== 'boolean') {
    this.isActive = this.isPublished;
  } else if (typeof this.isActive === 'boolean') {
    this.isPublished = this.isActive;
  }

  // Normalize targetPortals
  if (!this.targetPortals || this.targetPortals.length === 0) {
    this.targetPortals = ['ALL'];
  }

  next();
});

// Indexes for fast querying of published announcements
campaignSchema.index({ isActive: 1, createdAt: -1 });
campaignSchema.index({ isPublished: 1, createdAt: -1 });
campaignSchema.index({ targetPortals: 1 });

const Campaign = mongoose.models.Campaign || mongoose.model('Campaign', campaignSchema);

export const Announcement = Campaign;
export default Campaign;
