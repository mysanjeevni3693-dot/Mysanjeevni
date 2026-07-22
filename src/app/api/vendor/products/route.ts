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
    'Organic Products',
    'Green Teas',
    'Digestives',
  ],
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
  // Direct type validation - no legacy conversions
  const resolvedType: VendorProductType = isVendorProductType(rawType)
    ? (rawType as VendorProductType)
    : (inferredType || 'Generic Medicine');

  // Keep compatibility for legacy category aliases, but do not block categories
  // that come from newer vendor UI category maps.
  const normalizedCategory = normalizeCategoryForType(resolvedType, rawCategory) || rawCategory;

  return { resolvedType, normalizedCategory };
}

// GET vendor products
export async function GET(request: NextRequest) {
  try {
    const auth = requireVendorAuth(request);
    if (isAuthError(auth)) return auth;

    await connectDB();

    const products = await Product.find({ vendorId: auth.vendorId }).populate(
      'vendorId',
      'vendorName rating'
    );

    return NextResponse.json(
      {
        message: 'Products retrieved',
        products,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching products:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

// POST - Add product
export async function POST(request: NextRequest) {
  try {
    const auth = requireVendorAuth(request);
    if (isAuthError(auth)) return auth;

    await connectDB();

    const body = await request.json();
    const vendorId = auth.vendorId;
    const {
      name,
      description,
      shortDescription,
      price,
      usdPrice,
      productType,
      category,
      stock,
      image,
      safetyInformation,
      specifications,
      mrp,
      quantity,
      ...otherFields
    } = body;

    if (!name || !price || !category || usdPrice === undefined || usdPrice === null || isNaN(parseFloat(String(usdPrice)))) {
      return NextResponse.json(
        { error: 'Missing or invalid required fields' },
        { status: 400 }
      );
    }

    if (!isCloudinaryImageUrl(image)) {
      return NextResponse.json(
        { error: 'Please upload image to Cloudinary first' },
        { status: 400 }
      );
    }

    const { resolvedType, normalizedCategory } = resolveTypeAndCategory(productType, category);

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

    // Safely convert numeric fields to avoid NaN values
    const parsedPrice = price && !isNaN(parseFloat(price)) ? parseFloat(price) : 0;
    const parsedUsdPrice = usdPrice && !isNaN(parseFloat(String(usdPrice))) ? parseFloat(String(usdPrice)) : undefined;
    const parsedStock = stock && !isNaN(parseInt(stock)) ? parseInt(stock) : 0;
    const parsedMrp = mrp && !isNaN(parseFloat(mrp)) ? parseFloat(mrp) : undefined;
    const parsedQuantity = quantity && !isNaN(parseFloat(quantity)) ? parseFloat(quantity) : undefined;
    const parsedPotency = typeof otherFields.potency === 'string' && otherFields.potency.trim()
      ? otherFields.potency.trim()
      : undefined;
    const parsedQuantityUnit =
      typeof otherFields.quantityUnit === 'string'
        ? (otherFields.quantityUnit.trim() || 'None')
        : (otherFields.quantityUnit || 'None');
    const normalizedPopularSection =
      typeof body.popularSection === 'string' && ['None', 'Generic', 'Ayurveda', 'Homeopathy', 'LabTests'].includes(body.popularSection)
        ? body.popularSection
        : body.isPopularGeneric
          ? 'Generic'
          : body.isPopularAyurveda
            ? 'Ayurveda'
            : body.isPopularHomeopathy
              ? 'Homeopathy'
              : body.isPopularLabTests
                ? 'LabTests'
                : body.isPopular
                  ? 'Generic'
                  : 'None';
    const validPopularSections = ['Generic', 'Ayurveda', 'Homeopathy', 'LabTests'] as const;

    // Handle new popularSections array (or fallback to legacy popularSection)
    const normalizedPopularSections =
      Array.isArray(body.popularSections) && body.popularSections.length > 0
        ? body.popularSections.filter(
            (s: unknown): s is string =>
              typeof s === 'string' && validPopularSections.includes(s as any)
          )
        : (normalizedPopularSection !== 'None' ? [normalizedPopularSection] : []);

    // Create product with properly typed numeric fields
    const newProduct = await Product.create({
      _id: await generateProductId(),
      ...otherFields,
      potency: parsedPotency,
      name,
      description,
      shortDescription: typeof shortDescription === 'string' ? shortDescription.trim() : undefined,
      price: parsedPrice,
      usdPrice: parsedUsdPrice,
      productType: resolvedType,
      category: normalizedCategory,
      stock: parsedStock,
      image,
      vendorId,
      vendorName: vendor.vendorName,
      vendorRating: vendor.rating,
      mrp: parsedMrp,
      quantity: parsedQuantity,
      quantityUnit: parsedQuantityUnit,
      safetyInformation: typeof safetyInformation === 'string' ? safetyInformation.trim() : undefined,
      specifications: typeof specifications === 'string' ? specifications.trim() : undefined,
      approvalStatus: 'pending',
      isActive: false,
      popularSections: normalizedPopularSections,
      popularSection: normalizedPopularSections.length > 0 ? normalizedPopularSections[0] : 'None',
      isPopular: normalizedPopularSections.length > 0,
      isPopularGeneric: normalizedPopularSections.includes('Generic'),
      isPopularAyurveda: normalizedPopularSections.includes('Ayurveda'),
      isPopularHomeopathy: normalizedPopularSections.includes('Homeopathy'),
      isPopularLabTests: normalizedPopularSections.includes('LabTests'),
    });

    return NextResponse.json(
      {
        message: 'Product submitted for admin approval',
        product: newProduct,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error adding product:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
    });
    return NextResponse.json(
      { error: error.message || 'Failed to add product' },
      { status: 500 }
    );
  }
}

// PUT - Update product
export async function PUT(request: NextRequest) {
  try {
    const auth = requireVendorAuth(request);
    if (isAuthError(auth)) return auth;

    await connectDB();

    const body = await request.json();
    const vendorId = auth.vendorId;
    const { productId, safetyInformation, specifications, shortDescription, ...updateData } = body;

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID required' },
        { status: 400 }
      );
    }

    if (updateData.usdPrice === undefined || updateData.usdPrice === null || isNaN(parseFloat(String(updateData.usdPrice)))) {
      return NextResponse.json(
        { error: 'Missing or invalid USD dollar price' },
        { status: 400 }
      );
    }

    const normalizedPopularSection =
      typeof updateData.popularSection === 'string' && ['None', 'Generic', 'Ayurveda', 'Homeopathy', 'LabTests'].includes(updateData.popularSection)
        ? updateData.popularSection
        : undefined;
    
    // Handle new popularSections array (or fallback to legacy popularSection)
    if (Array.isArray(updateData.popularSections) && updateData.popularSections.length > 0) {
      const filtered = updateData.popularSections.filter(
        (s: unknown): s is string =>
          typeof s === 'string' && ['Generic', 'Ayurveda', 'Homeopathy', 'LabTests'].includes(s)
      );
      if (filtered.length > 0) {
        updateData.popularSections = filtered;
        updateData.popularSection = filtered[0];
        updateData.isPopular = true;
        updateData.isPopularGeneric = filtered.includes('Generic');
        updateData.isPopularAyurveda = filtered.includes('Ayurveda');
        updateData.isPopularHomeopathy = filtered.includes('Homeopathy');
        updateData.isPopularLabTests = filtered.includes('LabTests');
      }
    } else if (normalizedPopularSection !== undefined) {
      updateData.popularSection = normalizedPopularSection;
      updateData.popularSections = normalizedPopularSection !== 'None' ? [normalizedPopularSection] : [];
      updateData.isPopular = normalizedPopularSection !== 'None';
      updateData.isPopularGeneric = normalizedPopularSection === 'Generic';
      updateData.isPopularAyurveda = normalizedPopularSection === 'Ayurveda';
      updateData.isPopularHomeopathy = normalizedPopularSection === 'Homeopathy';
      updateData.isPopularLabTests = normalizedPopularSection === 'LabTests';
    }

    // Verify ownership
    const product = await Product.findById(productId);
    if (!product || product.vendorId.toString() !== vendorId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const nextCategoryRaw = String(updateData.category || product.category || '');
    const { resolvedType: nextType, normalizedCategory: nextCategory } = resolveTypeAndCategory(
      String(updateData.productType || product.productType || ''),
      nextCategoryRaw
    );

    const normalizedSafetyInformation =
      typeof safetyInformation === 'string'
        ? safetyInformation
        : (product as any).safetyInformation || '';

    const normalizedSpecifications =
      typeof specifications === 'string'
        ? specifications
        : (product as any).specifications || '';

    const normalizedShortDescription =
      typeof shortDescription === 'string'
        ? shortDescription.trim()
        : (product as any).shortDescription || undefined;

    const normalizedPotency =
      typeof updateData.potency === 'string'
        ? (updateData.potency.trim() || undefined)
        : updateData.potency;
    const normalizedQuantityUnit =
      typeof updateData.quantityUnit === 'string'
        ? (updateData.quantityUnit.trim() || 'None')
        : (updateData.quantityUnit || 'None');

    if (Object.prototype.hasOwnProperty.call(updateData, 'image') && updateData.image) {
      if (!isCloudinaryImageUrl(updateData.image)) {
        return NextResponse.json(
          { error: 'Please upload image to Cloudinary first' },
          { status: 400 }
        );
      }
    }

    // Any vendor edit should return item to pending review.
    const parsedUsdPrice = updateData.usdPrice && !isNaN(parseFloat(String(updateData.usdPrice))) ? parseFloat(String(updateData.usdPrice)) : undefined;

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      {
        ...updateData,
        usdPrice: parsedUsdPrice,
        potency: normalizedPotency,
        quantityUnit: normalizedQuantityUnit,
        safetyInformation: normalizedSafetyInformation,
        specifications: normalizedSpecifications,
        shortDescription: normalizedShortDescription,
        productType: nextType,
        category: nextCategory,
        approvalStatus: 'pending',
        isActive: false,
        updatedAt: new Date(),
      },
      { new: true, runValidators: true }
    );

    try {
      if (updatedProduct && updateData.stock !== undefined) {
        const { maybeNotifyStock } = await import('@/lib/vendorNotifications');
        const payload =
          typeof updatedProduct.toObject === 'function'
            ? updatedProduct.toObject()
            : updatedProduct;
        await maybeNotifyStock({
          ...payload,
          vendorId: auth.vendorId,
        });
      }
    } catch {
      // non-fatal
    }

    return NextResponse.json(
      {
        message: 'Product updated and submitted for admin approval',
        product: updatedProduct,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating product:', error.message);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

// DELETE - Remove product
export async function DELETE(request: NextRequest) {
  try {
    const auth = requireVendorAuth(request);
    if (isAuthError(auth)) return auth;

    await connectDB();

    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const vendorId = auth.vendorId;

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID required' },
        { status: 400 }
      );
    }

    const product = await Product.findById(productId);
    if (!product || product.vendorId.toString() !== vendorId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    await Product.findByIdAndDelete(productId);

    return NextResponse.json(
      { message: 'Product deleted successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error deleting product:', error.message);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}
