import mongoose from 'mongoose';

/**
 * Records a manual payout from MySanjeevni to a vendor.
 * Customer payments stay with the platform; admin settles vendor net earnings.
 */
const settlementSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },
    paymentMethod: {
      type: String,
      enum: ['bank_transfer', 'upi', 'neft', 'rtgs', 'imps', 'other'],
      default: 'bank_transfer',
    },
    transactionId: {
      type: String,
      trim: true,
      default: '',
    },
    referenceNumber: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'cancelled'],
      default: 'paid',
    },
    paidAt: {
      type: Date,
      default: Date.now,
    },
    recordedBy: {
      type: String,
      default: 'admin',
    },
    // Snapshot of wallet figures at settlement time for auditability.
    snapshot: {
      grossSales: { type: Number, default: 0 },
      commission: { type: Number, default: 0 },
      walletBalanceBefore: { type: Number, default: 0 },
      walletBalanceAfter: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

settlementSchema.index({ vendorId: 1, createdAt: -1 });
settlementSchema.index({ status: 1 });

export const Settlement =
  mongoose.models.Settlement || mongoose.model('Settlement', settlementSchema);
