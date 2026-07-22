import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Product } from '@/lib/models/Product';
import { generateProductId } from '@/lib/utils/productIdGenerator';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const vendorId = searchParams.get('vendorId');
    const search = searchParams.get('search');
    const productType = searchParams.get('productType');
    const approvalStatus = searchParams.get('approvalStatus');
    const limit = parseInt(searchParams.get('limit') || '200');

    await connectDB();

    const query: any = {};

    if (category) query.category = category;
    if (vendorId) query.vendorId = vendorId;
    if (productType) query.productType = productType;
    if (approvalStatus) query.approvalStatus = approvalStatus;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { vendorName: { $regex: search, $options: 'i' } },
      ];
    }

    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    return NextResponse.json({ products, total: products.length });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const normalizedPotency =
      typeof body.potency === 'string' ? (body.potency.trim() || undefined) : body.potency;
    const normalizedQuantityUnit =
      typeof body.quantityUnit === 'string'
        ? (body.quantityUnit.trim() || 'None')
        : (body.quantityUnit || 'None');
    const normalizedProductType =
      typeof body.productType === 'string' ? (body.productType.trim() || undefined) : body.productType;
    const normalizedApprovalStatus =
      typeof body.approvalStatus === 'string'
        ? (body.approvalStatus.trim().toLowerCase() || undefined)
        : body.approvalStatus;
    const validPopularSections = ['Generic', 'Ayurveda', 'Homeopathy', 'LabTests'] as const;
    const normalizedPopularSections =
      Array.isArray(body.popularSections) && body.popularSections.length > 0
        ? body.popularSections.filter(
            (s: unknown): s is string =>
              typeof s === 'string' && validPopularSections.includes(s as any)
          )
        : (typeof body.popularSection === 'string' && validPopularSections.includes(body.popularSection as any)
          ? [body.popularSection]
          : body.isPopularGeneric
            ? ['Generic']
            : body.isPopularAyurveda
              ? ['Ayurveda']
              : body.isPopularHomeopathy
                ? ['Homeopathy']
                : body.isPopularLabTests
                  ? ['LabTests']
                  : body.isPopular
                    ? ['Generic']
                    : []);
    const normalizedPopularSection = normalizedPopularSections.length > 0 ? normalizedPopularSections[0] : 'None';
    
    if (!body.name || !body.category || body.price === undefined || body.usdPrice === undefined || body.usdPrice === null || isNaN(Number(body.usdPrice))) {
      return NextResponse.json(
        { error: 'Missing or invalid required fields' },
        { status: 400 }
      );
    }

    // Generate a numeric product ID
    const productId = await generateProductId();

    const newProduct = await Product.create({
      _id: productId,
      ...body,
      usdPrice: Number(body.usdPrice),
      potency: normalizedPotency,
      quantityUnit: normalizedQuantityUnit,
      productType: normalizedProductType,
      approvalStatus: normalizedApprovalStatus || body.approvalStatus || 'approved',
      popularSections: normalizedPopularSections,
      popularSection: normalizedPopularSection,
      isPopular: body.isPopular !== undefined ? body.isPopular : normalizedPopularSections.length > 0,
      isPopularGeneric: normalizedPopularSections.includes('Generic'),
      isPopularAyurveda: normalizedPopularSections.includes('Ayurveda'),
      isPopularHomeopathy: normalizedPopularSections.includes('Homeopathy'),
      isPopularLabTests: normalizedPopularSections.includes('LabTests'),
      safetyInformation: body.safetyInformation || undefined,
      specifications: body.specifications || undefined,
      shortDescription: typeof body.shortDescription === 'string' ? body.shortDescription.trim() : undefined,
      isActive: body.isActive !== undefined ? body.isActive : true,
    });

    return NextResponse.json({ product: newProduct, message: 'Product created successfully' }, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    
    if (!body._id) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    const { _id, ...update } = body;
    const normalizedPotency =
      typeof update.potency === 'string' ? (update.potency.trim() || undefined) : update.potency;
    const normalizedQuantityUnit =
      typeof update.quantityUnit === 'string'
        ? (update.quantityUnit.trim() || 'None')
        : (update.quantityUnit || 'None');
    const normalizedProductType =
      typeof update.productType === 'string' ? (update.productType.trim() || undefined) : update.productType;
    const normalizedApprovalStatus =
      typeof update.approvalStatus === 'string'
        ? (update.approvalStatus.trim().toLowerCase() || undefined)
        : update.approvalStatus;
    const normalizedShortDescription =
      typeof update.shortDescription === 'string'
        ? update.shortDescription.trim()
        : update.shortDescription;
    const normalizedPopularSection =
      typeof update.popularSection === 'string' && ['None', 'Generic', 'Ayurveda', 'Homeopathy', 'LabTests'].includes(update.popularSection)
        ? update.popularSection
        : undefined;
    const validPopularSections = ['Generic', 'Ayurveda', 'Homeopathy', 'LabTests'] as const;
    
    // Handle new popularSections array (or fallback to legacy popularSection)
    if (Array.isArray(update.popularSections) && update.popularSections.length > 0) {
      const filtered = update.popularSections.filter(
        (s: unknown): s is string =>
          typeof s === 'string' && validPopularSections.includes(s as any)
      );
      if (filtered.length > 0) {
        update.popularSections = filtered;
        update.popularSection = filtered[0];
        update.isPopular = true;
        update.isPopularGeneric = filtered.includes('Generic');
        update.isPopularAyurveda = filtered.includes('Ayurveda');
        update.isPopularHomeopathy = filtered.includes('Homeopathy');
        update.isPopularLabTests = filtered.includes('LabTests');
      }
    } else if (normalizedPopularSection !== undefined) {
      update.popularSection = normalizedPopularSection;
      update.popularSections = normalizedPopularSection !== 'None' ? [normalizedPopularSection] : [];
      update.isPopular = normalizedPopularSection !== 'None';
      update.isPopularGeneric = normalizedPopularSection === 'Generic';
      update.isPopularAyurveda = normalizedPopularSection === 'Ayurveda';
      update.isPopularHomeopathy = normalizedPopularSection === 'Homeopathy';
      update.isPopularLabTests = normalizedPopularSection === 'LabTests';
    }
    const previous = await Product.findById(_id).select('approvalStatus vendorId name stock');
    const updated = await Product.findByIdAndUpdate(
      _id,
      {
        ...update,
        potency: normalizedPotency,
        quantityUnit: normalizedQuantityUnit,
        productType: normalizedProductType,
        approvalStatus: normalizedApprovalStatus,
        shortDescription: normalizedShortDescription,
      },
      { new: true }
    );
    if (!updated) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Notify vendor on approval/rejection and stock thresholds.
    try {
      const vendorId = String(updated.vendorId || previous?.vendorId || '');
      if (vendorId) {
        const { notifyVendor, maybeNotifyStock } = await import('@/lib/vendorNotifications');
        const prevStatus = String(previous?.approvalStatus || '');
        const nextStatus = String(updated.approvalStatus || '');
        if (nextStatus === 'approved' && prevStatus !== 'approved') {
          await notifyVendor({
            vendorId,
            type: 'product_approved',
            title: 'Product approved',
            message: `${updated.name} is now live on the storefront`,
            relatedId: String(updated._id),
            actionUrl: '/vendor/dashboard',
          });
        } else if (nextStatus === 'rejected' && prevStatus !== 'rejected') {
          await notifyVendor({
            vendorId,
            type: 'product_rejected',
            title: 'Product rejected',
            message: `${updated.name} was rejected by admin`,
            relatedId: String(updated._id),
            actionUrl: '/vendor/dashboard',
          });
        }
        if (update.stock !== undefined && Number(updated.stock) !== Number(previous?.stock)) {
          await maybeNotifyStock(updated);
        }
      }
    } catch (e) {
      console.error('Product notify failed (non-fatal):', e);
    }

    return NextResponse.json({ message: 'Product updated successfully', product: updated });
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('id');

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    await Product.findByIdAndDelete(productId);

    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}
