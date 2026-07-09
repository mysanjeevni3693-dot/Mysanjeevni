import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: [
      {
        productId: String,
        productName: String,
        quantity: Number,
        price: Number,
        total: Number,
        requiresPrescription: Boolean,
        prescriptionUrl: String,
      },
    ],
    totalPrice: Number,
    deliveryAddress: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Address',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending',
    },
    shippingCharge: {
      type: Number,
      default: 0,
    },
    courier: {
      type: String,
    },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    orderNotes: String,
    shiprocketOrderId: String,
    shiprocketShipmentId: String,
    awbNumber: String,
    // ---------------------------------------------------------------------
    // Shiprocket shipping fields (additive – existing docs default to null).
    // Kept flat to remain backward compatible with the existing order flow.
    // ---------------------------------------------------------------------
    courierName: String,
    estimatedDelivery: String,
    trackingUrl: String,
    // Canonical shipment status from lib/shiprocket (PENDING, IN_TRANSIT, ...)
    shipmentStatus: String,
    pickupStatus: String,
    pickupTokenNumber: String,
    labelUrl: String,
    invoiceUrl: String,
    manifestUrl: String,
    // ---------------------------------------------------------------------
    // Shiprocket Checkout (SRC) fields (additive). Populated when an order is
    // placed via the hosted Shiprocket Checkout widget instead of native pay.
    // ---------------------------------------------------------------------
    checkoutOrderId: String,
    checkoutSource: String,
    paymentMethod: String,
    prescriptions: [
      {
        productId: String,
        productName: String,
        prescriptionUrl: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const Order =
  mongoose.models.Order || mongoose.model('Order', orderSchema);
