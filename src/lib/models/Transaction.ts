import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
    },
    type: {
      type: String,
      enum: ['earning', 'withdrawal', 'commission_deduction', 'refund', 'bonus', 'admin_adjustment', 'settlement'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'cancelled'],
      default: 'completed',
    },
    description: String,
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      description: 'ID of related entity (Consultation ID, Order ID, WithdrawalRequest ID, etc.)',
    },
    relatedType: {
      type: String,
      enum: ['consultation', 'order', 'withdrawal', 'lab_booking', 'settlement', 'other'],
      description: 'Type of related entity',
    },
    metadata: {
      type: Map,
      of: String,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster lookups
transactionSchema.index({ walletId: 1 });
transactionSchema.index({ userId: 1 });
transactionSchema.index({ doctorId: 1 });
transactionSchema.index({ vendorId: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ status: 1 });

export const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
