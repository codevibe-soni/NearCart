import mongoose from 'mongoose';

const campaignLogSchema = new mongoose.Schema(
  {
    campaignName: { type: String, required: true, unique: true },
    sentAt: { type: Date, default: Date.now },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tokenCount: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    failureCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const CampaignLog = mongoose.models.CampaignLog || mongoose.model('CampaignLog', campaignLogSchema);

export default CampaignLog;
