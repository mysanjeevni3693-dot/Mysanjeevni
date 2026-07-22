import mongoose from 'mongoose';

const vendorSchema = new mongoose.Schema({
  // Basic Info
  vendorName: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    select: false,
  },
  phone: {
    type: String,
    required: true,
  },

  // Business Info
  businessType: {
    type: String,
    enum: ['pharmacy', 'clinic', 'hospital', 'lab', 'supplier', 'other'],
    required: true,
  },
  description: String,
  logo: String,
  banner: String,

  // Address
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: String,
  },

  // Documents
  registrationNumber: String,
  licenseNumber: String,
  licenseDocument: String,
  gstNumber: String,
  medicineType: {
    type: String,
    enum: ['allopathic', 'homeopathy', 'ayurveda', 'mixed'],
    default: 'allopathic',
  },
  aadharCardUrl: {
    type: String,
    default: '',
  },
  panCardUrl: {
    type: String,
    default: '',
  },
  gstCertificateUrl: {
    type: String,
    default: '',
  },
  drugLicenseUrl: {
    type: String,
    default: '',
  },

  // Banking
  accountHolderName: String,
  bankName: String,
  accountNumber: String,
  ifscCode: String,

  // Status & Verification
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'suspended'],
    default: 'pending',
  },
  verifiedAt: Date,
  rejectionReason: String,

  // Ratings & Stats
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  totalReviews: {
    type: Number,
    default: 0,
  },
  totalOrders: {
    type: Number,
    default: 0,
  },
  revenue: {
    type: Number,
    default: 0,
  },

  // Commission & Settings
  commissionPercentage: {
    type: Number,
    default: 10,
  },
  isActive: {
    type: Boolean,
    default: true,
  },

  // Extended shop profile (additive — used by vendor profile management)
  supportContact: String,
  socialLinks: {
    website: String,
    facebook: String,
    instagram: String,
    twitter: String,
  },
  pickupAddress: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: String,
    phone: String,
  },
  warehouseAddress: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: String,
    phone: String,
  },
  returnAddress: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: String,
    phone: String,
  },

  createdAt: {
    type: Date,
    default: () => new Date(),
  },
  updatedAt: {
    type: Date,
    default: () => new Date(),
  },
});

vendorSchema.index({ status: 1 });
vendorSchema.index({ createdAt: -1 });

export const Vendor = mongoose.models.Vendor || mongoose.model('Vendor', vendorSchema);
