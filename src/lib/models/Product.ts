import mongoose from 'mongoose';

const POTENCY_OPTIONS = ['1000 CH', '3 CH', '10M CH', '200 CH', '30 CH', '12 CH', '6 CH', 'CM CH', '50M CH'];
const QUANTITY_UNIT_OPTIONS = ['None', 'BAGS (Bag)', 'BOTTLES (Btl)', 'BOX (Box)', 'BUNDLES (Bdl)', 'CANS (Can)', 'CAPSULES (CAPS)', 'CARTONS (Ctn)', 'DOZENS (Dzn)', 'GRAMMES (Gm)', 'KILOGRAMS (Kg)', 'LITRE (Ltr)', 'METERS (Mtr)', 'MILILITRE (MI)', 'NUMBERS (Nos)', 'PACKS (Pac)', 'PAIRS (Prs)', 'PIECES (Pcs)', 'QUINTAL (Qtl)', 'ROLLS (Rol)', 'SACHET (SACH)', 'SQUARE FEET (Sqf)', 'SQUARE METERS (Sqm)', 'TABLETS (Tbs)'];

const productSchema = new mongoose.Schema(
  {
    _id: {
      type: Number,
      required: true,
    },
    // Product Info
    name: {
      type: String,
      required: true,
    },
    shortDescription: String,
    description: String,
    price: {
      type: Number,
      required: true,
    },
    usdPrice: {
      type: Number,
    },
    discount: Number,
    category: {
      type: String,
      required: true,
    },
    subcategory: {
      type: String,
    },
    categories: [{
      type: String,
    }],
    extraCategoryPaths: {
      type: [[String]],
      default: [],
    },
    potency: {
      type: String,
      enum: POTENCY_OPTIONS,
      set: (value: string | undefined) => {
        const normalized = typeof value === 'string' ? value.trim() : value;
        return normalized ? normalized : undefined;
      },
    },
    quantity: {
      type: Number,
      min: 0,
    },
    quantityUnit: {
      type: String,
      enum: QUANTITY_UNIT_OPTIONS,
      default: 'None',
      set: (value: string | undefined) => {
        const normalized = typeof value === 'string' ? value.trim() : value;
        return normalized ? normalized : 'None';
      },
    },
    diseaseCategory: {
      type: String,
    },
    diseaseSubcategory: {
      type: String,
    },
    diseasePaths: {
      type: [[String]],
      default: [],
    },
    productType: {
      type: String,
      enum: [
        'Generic Medicine',
        'Ayurveda Medicine',
        'Homeopathy',
        'Lab Tests',
        'Nutrition',
        'Organic Products',
        'Personal Care',
        'Fitness',
        'Sexual Wellness',
        'Unani',
        'Baby Care',
      ],
      set: (value: string | undefined) => {
        const normalized = typeof value === 'string' ? value.trim() : value;
        return normalized ? normalized : undefined;
      },
    },
    mrp: {
      type: Number,
    },
    icon: {
      type: String,
      default: '💊',
    },
    benefit: {
      type: String,
    },
    brand: String,
    manufacturer: String,
    stock: {
      type: Number,
      default: 0,
    },
    healthConcerns: [String],
    dosage: String,
    packaging: String,
    safetyInformation: String,
    specifications: String,
    expiryDate: Date,
    requiresPrescription: {
      type: Boolean,
      default: false,
    },
    image: String, // legacy single image
    images: {
      type: [String],
      validate: [(arr: any) => Array.isArray(arr) && arr.length <= 4, 'Maximum 4 images allowed'],
      default: [],
    },

    // Vendor Info
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      default: null,
    },
    vendorName: {
      type: String,
      default: 'MySanjeevni',
    },
    vendorRating: {
      type: Number,
      default: 5,
      min: 0,
      max: 5,
    },

    // Ratings
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviews: {
      type: Number,
      default: 0,
    },

    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved',
      set: (value: string | undefined) => {
        const normalized = typeof value === 'string' ? value.trim().toLowerCase() : value;
        return normalized ? normalized : undefined;
      },
    },
    
    // Featured/Popular Display Sections (multiple selections)
    popularSections: {
      type: [String],
      enum: ['Generic', 'Ayurveda', 'Homeopathy', 'LabTests'],
      default: [],
    },
    
    // Legacy field for backward compatibility (will be migrated to popularSections)
    popularSection: {
      type: String,
      enum: ['None', 'Generic', 'Ayurveda', 'Homeopathy', 'LabTests'],
      default: 'None',
    },
  },
  {
    timestamps: true,
  }
);

export const Product =
  mongoose.models.Product || mongoose.model('Product', productSchema);

// In dev hot-reload, mongoose can reuse an older cached model schema.
// Ensure newly added fields are present so updates are not silently dropped.
if (!Product.schema.path('safetyInformation') || !Product.schema.path('specifications')) {
  Product.schema.add({
    safetyInformation: String,
    specifications: String,
  });
}
