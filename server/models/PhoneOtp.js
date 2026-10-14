import mongoose from 'mongoose';
import crypto from 'crypto';

const phoneOtpSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    otpSalt: {
      type: String,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    resendCount: {
      type: Number,
      default: 1,
    },
    lastSentAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index: auto-deleted by MongoDB upon expiration
    },
  },
  {
    timestamps: true,
  }
);

// Method to verify candidate OTP
phoneOtpSchema.methods.verifyOtp = function (candidateOtp) {
  if (this.attempts >= this.maxAttempts) {
    return { valid: false, reason: 'MAX_ATTEMPTS_EXCEEDED' };
  }
  if (new Date() > this.expiresAt) {
    return { valid: false, reason: 'EXPIRED' };
  }
  const candidateHash = crypto
    .createHash('sha256')
    .update(String(candidateOtp) + this.otpSalt)
    .digest('hex');

  const isValid = crypto.timingSafeEqual(
    Buffer.from(candidateHash, 'hex'),
    Buffer.from(this.otpHash, 'hex')
  );

  return { valid: isValid, reason: isValid ? 'OK' : 'INVALID' };
};

// Static helper to create a hashed OTP record
phoneOtpSchema.statics.createHashedOtp = async function ({ userId, phone, otp, expiresInMinutes = 10 }) {
  const salt = crypto.randomBytes(16).toString('hex');
  const otpHash = crypto
    .createHash('sha256')
    .update(String(otp) + salt)
    .digest('hex');

  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  // Check if an OTP record already exists for this user & phone
  let existing = await this.findOne({ userId, phone });
  if (existing) {
    existing.otpHash = otpHash;
    existing.otpSalt = salt;
    existing.attempts = 0;
    existing.resendCount = (existing.resendCount || 0) + 1;
    existing.lastSentAt = new Date();
    existing.expiresAt = expiresAt;
    return await existing.save();
  }

  return await this.create({
    userId,
    phone,
    otpHash,
    otpSalt: salt,
    attempts: 0,
    resendCount: 1,
    lastSentAt: new Date(),
    expiresAt,
  });
};

const PhoneOtp = mongoose.models.PhoneOtp || mongoose.model('PhoneOtp', phoneOtpSchema);

export default PhoneOtp;
