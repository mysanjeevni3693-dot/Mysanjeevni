import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Product } from '@/lib/models/Product';
import { generateProductId } from '@/lib/utils/productIdGenerator';
import { Vendor } from '@/lib/models/Vendor';
import { requireVendorAuth, isAuthError } from '@/lib/vendorAuth';

const VENDOR_CATEGORY_MAP = {
  'Generic Medicine': [
    'Antibiotics',
    'Pain Relief',
    'Acidity',
    'Diabetes',
    'Allergy',
    'Heart Care',
    'Vitamins',
    'Cardiac',
    'Supplements',
    'Gastric',
  ],
  'Ayurveda Medicine': [
    'Immunity',
    'Digestion',
    'Stress Relief',
    'Energy',
    'Skin & Hair',
    'Weight Management',
    'Joint & Bone',
    "Women's Health",
    "Men's Health",
  ],
  Homeopathy: [
    'Cold & Flu',
    'Skin',
    'Digestive',
    'Mental Wellness',
    'Joint & Pain',
    "Women's Health",
    'Immunity',
    'Children',
  ],
  'Lab Tests': [
    'General',
    'Diabetes',
    'Cardiac',
    'Thyroid',
    'Liver',
    'Kidney',
    'Vitamins',
    'Infection',
    'Women',
  ],
  Nutrition: [
    'Sports Nutrition',
    'Health Food & Drinks',
    'Vitamin & Dietary Supplements',
    'Green Teas',
    'Digestives',
  ],
  'Organic Products': ['Organic Foods', 'Coffee & Tea', 'Ghee', 'Atta/Flour'],
  'Personal Care': [
    'Aroma Oils',
    'Mens Grooming',
    'Female Care',
    'Skin Care',
    'Bath & Shower',
    'Hair Care',
    'Elderly Care',
    'Mosquito Repellents',
    'Oral Care',
  ],
  Fitness: [
    'Supports & Splints',
    'Health Devices',
    'Fitness Equipment',
    'Hospital Supplies',
    'Aroma Therapy',
    'Disability Aids',
    'Massagers',
    'Bandages & Tapes',
    'Walking Sticks',
  ],
  'Sexual Wellness': [
    'Supplements',
    'Condoms',
  ],
  Unani: [
    'Unani Medicines',
    'Habbe & Qurs',
    'Majun & Jawarish',
    'Safoof, Labub & Kushta',
    'Sharbat, Sirka & Arq',
    'Lauq & Saoot',
    'Khamira & Itrifal',
    'Roghan & Oils',
    'Unani Brands',
  ],
  'Baby Care': [
    'Tonics & Supplements',
    'Bath & Skin',
    'Wipes & Diapers',
    'Gift Packs',
  ],
} as const;

type VendorProductType = keyof typeof VENDOR_CATEGORY_MAP;

function isVendorProductType(value: string): value is VendorProductType {
  return Object.prototype.hasOwnProperty.call(VENDOR_CATEGORY_MAP, value);
}

function isCloudinaryImageUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return /^https?:\/\/res\.cloudinary\.com\//i.test(url.trim());
}

function inferProductTypeFromCategory(category?: string): VendorProductType | null {
  if (!category) return null;
  const normalized = category.trim().toLowerCase();
  if (normalized === 'generic' || normalized === 'branded') return 'Generic Medicine';
  if (normalized === 'ayurvedic' || normalized === 'ayurveda') return 'Ayurveda Medicine';
  if (normalized === 'homeopathy') return 'Homeopathy';
  if (normalized === 'lab tests' || normalized === 'lab-tests' || normalized === 'labtest') return 'Lab Tests';

  for (const [type, categories] of Object.entries(VENDOR_CATEGORY_MAP)) {
    if ((categories as readonly string[]).includes(category)) {
      return type as VendorProductType;
    }
  }
  return null;
}

function normalizeCategoryForType(productType: VendorProductType, category?: string): string {
  const raw = (category || '').trim();
  const normalized = raw.toLowerCase();
  const categories = VENDOR_CATEGORY_MAP[productType] || VENDOR_CATEGORY_MAP['Generic Medicine'];

  if (productType === 'Generic Medicine' && (normalized === 'generic' || normalized === 'branded')) {
    return categories[0];
  }

  if (productType === 'Ayurveda Medicine' && (normalized === 'ayurvedic' || normalized === 'ayurveda')) {
    return categories[0];
  }

  if (productType === 'Homeopathy' && normalized === 'homeopathy') {
    return categories[0];
  }

  if (productType === 'Lab Tests' && (normalized === 'lab tests' || normalized === 'lab-tests' || normalized === 'labtest')) {
    return categories[0];
  }

  const exactMatch = categories.find((c) => c.toLowerCase() === normalized);
  return exactMatch || raw;
}

function resolveTypeAndCategory(productType: string | undefined, category: string) {
  const rawType = (productType || '').trim();
  const rawCategory = (category || '').trim();
  const inferredType = inferProductTypeFromCategory(rawCategory);
  const resolvedType: VendorProductType = isVendorProductType(rawType)
    ? (rawType as VendorProductType)
    : (inferredType || 'Generic Medicine');

  const normalizedCategory = normalizeCategoryForType(resolvedType, rawCategory) || rawCategory;

  return { resolvedType, normalizedCategory };
}

// Flexible field value getter supporting multiple column name variations
function getFieldValue(obj: any, possibleNames: string[]): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  
  for (const name of possibleNames) {
    // Try exact match first
    if (name in obj && obj[name]) {
      const val = String(obj[name]).trim();
      if (val) return val;
    }
    
    // Try case-insensitive match
    const lowerName = name.toLowerCase();
    for (const key in obj) {
      if (key.toLowerCase() === lowerName && obj[key]) {
        const val = String(obj[key]).trim();
        if (val) return val;
      }
    }
  }
  
  return undefined;
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireVendorAuth(request);
    if (isAuthError(auth)) return auth;

    await connectDB();

    const body = await request.json();
    const vendorId = auth.vendorId;
    const { products } = body;

    // Validate products array
    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: 'Products array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Verify vendor exists and is verified
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    if (vendor.status !== 'verified') {
      return NextResponse.json(
        { error: 'Your vendor account is not verified' },
        { status: 403 }
      );
    }

    const successful: any[] = [];
    const failed: any[] = [];

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      try {
        // Extract fields using flexible column name matching - ALL OPTIONAL
        const name = getFieldValue(product, ['name', 'productName', 'product_name', 'Product Name', 'PRODUCT NAME']) || `Product ${i + 1}`;
        const category = getFieldValue(product, ['category', 'productCategory', 'product_category', 'Category', 'Product Category', 'CATEGORY']) || '';
        const priceStr = getFieldValue(product, ['price', 'productPrice', 'product_price', 'Price', 'Product Price', 'PRICE']);
        const usdPriceStr = getFieldValue(product, ['usdPrice', 'usd_price', 'USD_Price', 'USD_PRICE', 'USD Price', 'usdprice']);
        const priceValue = priceStr ? Number(priceStr) : 0;
        const usdPriceValue = usdPriceStr ? Number(usdPriceStr) : 0;

        // Extract images with flexible field mapping - OPTIONAL
        let imageValue = getFieldValue(product, ['images', 'image', 'Image', 'Images', 'IMAGE', 'image_url', 'Image URL', 'imageUrl']) || '';
        
        // Log for debugging
        console.log(`Row ${i + 2} - Image value extracted: "${imageValue}" (type: ${typeof imageValue})`);

        // Parse images - could be array or comma-separated string
        let imageArray: string[] = [];
        if (typeof imageValue === 'string' && imageValue.trim()) {
          // Split by comma if multiple, and also handle it as single URL
          const trimmed = imageValue.trim();
          imageArray = trimmed.includes(',') 
            ? trimmed.split(',').map(img => img.trim()).filter(img => img)
            : [trimmed];
        } else if (Array.isArray(product.images)) {
          imageArray = product.images.filter((img: any) => typeof img === 'string' && img.trim());
        }

        // Validate each image URL
        console.log(`Row ${i + 2} - Image array: ${JSON.stringify(imageArray)}`);
        let primaryImage = '';
        for (const img of imageArray) {
          const trimmedImg = typeof img === 'string' ? img.trim() : '';
          console.log(`Row ${i + 2} - Checking image: "${trimmedImg}"`);
          if (isCloudinaryImageUrl(trimmedImg)) {
            primaryImage = trimmedImg;
            console.log(`Row ${i + 2} - Valid image found: "${primaryImage}"`);
            break;
          }
        }

        // NOTE: Images are now OPTIONAL - no error if missing or invalid

        const { resolvedType, normalizedCategory } = resolveTypeAndCategory(
          getFieldValue(product, [
            'productType',
            'product_type',
            'Product Type',
            'ProductType',
            'Type',
            'TYPE',
          ]),
          category
        );

        // Prepare product data using flexible field mapping
        const productId = await generateProductId();
        const stockStr = getFieldValue(product, ['stock', 'quantity', 'Stock', 'Quantity', 'STOCK', 'QUANTITY']);
        const stock = stockStr ? Number(stockStr) : 0;
        const mrpStr = getFieldValue(product, ['mrp', 'MRP', 'Mrp']);
        const mrp = mrpStr ? Number(mrpStr) : undefined;
        const description = getFieldValue(product, ['description', 'desc', 'Description', 'Desc', 'DESCRIPTION']) || '';
        const brand = getFieldValue(product, ['brand', 'manufacturer', 'Brand', 'Manufacturer', 'BRAND', 'MANUFACTURER']) || undefined;
        const subcategory =
          getFieldValue(product, [
            'subcategory',
            'subCategory',
            'Subcategory',
            'Sub Category',
            'SUBCATEGORY',
          ]) || undefined;

        // Handle image URLs (multiple images support)
        const finalImages = imageArray.filter((img: any) => isCloudinaryImageUrl(img));

        if (!name.trim()) {
          throw new Error('Product name is required');
        }
        if (!normalizedCategory) {
          throw new Error('Category is required (e.g. Organic Products, Antibiotics)');
        }
        if (!Number.isFinite(priceValue) || priceValue < 0) {
          throw new Error('Valid Price is required');
        }

        const createdProduct = await Product.create({
          _id: productId,
          vendorId,
          name,
          brand,
          category: normalizedCategory,
          subcategory,
          productType: resolvedType,
          price: priceValue,
          usdPrice: usdPriceValue,
          mrp,
          stock,
          description: description || undefined,
          image: primaryImage,
          images: finalImages.slice(0, 4), // Max 4 images
          isActive: true,
          approvalStatus: 'pending',
          requiresPrescription: String(
            getFieldValue(product, [
              'requiresPrescription',
              'RequiresPrescription',
              'Requires Prescription',
              'Rx',
              'Prescription',
            ]) || product.requiresPrescription || ''
          )
            .toLowerCase()
            .startsWith('y'),
        });

        successful.push(createdProduct);
      } catch (err: any) {
        failed.push({
          row: i + 2,
          error: err.message || 'Failed to create product',
          data: product,
        });
      }
    }

    return NextResponse.json(
      {
        successful: successful.length,
        failed: failed.length,
        errors: failed,
        message: `Bulk upload completed: ${successful.length} successful, ${failed.length} failed`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Vendor bulk upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Bulk upload failed' },
      { status: 500 }
    );
  }
}
