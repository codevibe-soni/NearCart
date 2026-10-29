import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Campaign name is required'], trim: true },
    occasion: { type: String, required: [true, 'Occasion is required'], trim: true },
    startDate: { type: Date, required: [true, 'Start date is required'] },
    endDate: { type: Date, required: [true, 'End date is required'], validate: { validator: function (val) { return val >= this.startDate; }, message: 'End date must be after start date' } },
    bannerText: { type: String, default: '' },
    bannerColor: { type: String, default: '#ffcc00' },
    animationPreset: { type: String, default: '' },
    informational: { type: Boolean, default: true },
    discount: { type: Number, default: 0, min: [0, 'Discount cannot be negative'] },
    targetPortals: { type: [String], enum: { values: ['STUDENT', 'SHOPKEEPER', 'DELIVERY_BOY'], message: '{VALUE} is not a valid portal' }, default: ['STUDENT'] },
    isActive: { type: Boolean, default: false },
  },
  { timestamps: true }
);

campaignSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

const Campaign = mongoose.models.Campaign || mongoose.model('Campaign', campaignSchema);
export default Campaign;
