import mongoose from 'mongoose';

/**
 * Additive fields on ReturnRequest for multi-vendor marketplace.
 * Existing documents without these fields remain valid.
 */
const returnRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
    },
    userEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    orderId: {
      type: String,
      required: true,
      trim: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    productId: {
      type: String,
      default: '',
      trim: true,
    },
    vendorId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    preferredResolution: {
      type: String,
      enum: ['replacement', 'refund', 'support-review'],
      default: 'support-review',
    },
    status: {
      type: String,
      enum: ['new', 'under-review', 'approved', 'rejected', 'completed', 'escalated'],
      default: 'new',
    },
    supportNote: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },
    vendorNote: {
      type: String,
      default: '',
      trim: true,
      maxlength: 1000,
    },
    vendorEvidenceUrl: {
      type: String,
      default: '',
      trim: true,
    },
    escalatedToAdmin: {
      type: Boolean,
      default: false,
    },
    vendorRespondedAt: Date,
  },
  {
    timestamps: true,
  }
);

returnRequestSchema.index({ status: 1, createdAt: -1 });
returnRequestSchema.index({ vendorId: 1, status: 1 });

export const ReturnRequest =
  mongoose.models.ReturnRequest || mongoose.model('ReturnRequest', returnRequestSchema);
