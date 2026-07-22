import mongoose from 'mongoose';

/**
 * In-app notifications for vendors (separate from customer Notification model).
 */
const vendorNotificationSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'new_order',
        'order_cancelled',
        'return_request',
        'refund_request',
        'product_approved',
        'product_rejected',
        'settlement_paid',
        'low_stock',
        'out_of_stock',
        'profile_verification',
        'general',
      ],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, default: '' },
    relatedId: { type: String, default: '' },
    actionUrl: { type: String, default: '' },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

vendorNotificationSchema.index({ vendorId: 1, createdAt: -1 });
vendorNotificationSchema.index({ vendorId: 1, isRead: 1 });

export const VendorNotification =
  mongoose.models.VendorNotification ||
  mongoose.model('VendorNotification', vendorNotificationSchema);
