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
    // Poster image URL & public ID
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

// Keep title/name, imageUrl/posterUrl, and isActive/isPublished in sync before saving
campaignSchema.pre('save', function (next) {
  // Sync title and name
  if (this.title && !this.name) {
    this.name = this.title;
  } else if (this.name && !this.title) {
    this.title = this.name;
  }

  // Sync imageUrl and posterUrl
  if (this.imageUrl && !this.posterUrl) {
    this.posterUrl = this.imageUrl;
  } else if (this.posterUrl && !this.imageUrl) {
    this.imageUrl = this.posterUrl;
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
