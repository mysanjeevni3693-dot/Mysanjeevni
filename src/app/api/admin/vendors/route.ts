import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Vendor } from '@/lib/models/Vendor';
import { Product } from '@/lib/models/Product';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Hard-delete is reserved for explicit admin "delete" only.
 * Approve / reject / suspend / reactivate are soft status transitions so
 * historical orders, KYC docs, and products are preserved.
 */
const deleteVendorAndAssets = async (vendorId: string) => {
  const vendor = await Vendor.findById(vendorId);

  if (!vendor) {
    return null;
  }

  const cloudinaryUrls = [
    vendor.aadharCardUrl,
    vendor.panCardUrl,
    vendor.gstCertificateUrl,
    vendor.drugLicenseUrl,
  ].filter((url): url is string => Boolean(url));

  for (const url of cloudinaryUrls) {
    try {
      const matches = url.match(/\/([^\/]+)\/([^\/]+)\.(jpg|jpeg|png|pdf)$/i);

      if (matches) {
        const folder = matches[1];
        const fileName = matches[2];
        const resourceType = url.includes('.pdf') ? 'raw' : 'image';
        const publicId = `${folder}/${fileName}`;

        await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
      }
    } catch (err) {
      console.error('Error deleting Cloudinary image:', err);
    }
  }

  const deletedProducts = await Product.deleteMany({ vendorId: vendor._id });
  await Vendor.findByIdAndDelete(vendorId);

  return {
    vendor,
    deletedProductsCount: deletedProducts.deletedCount || 0,
  };
};

// GET vendors by status
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const status = request.nextUrl.searchParams.get('status') || 'pending';

    const vendors = await Vendor.find({ status }).select('-password').sort({ createdAt: -1 });

    return NextResponse.json(
      {
        message: `${status} vendors`,
        vendors,
        count: vendors.length,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching vendors:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch vendors' },
      { status: 500 }
    );
  }
}

// POST - Approve or reject vendor (soft reject — keeps the record)
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { vendorId, action, rejectionReason } = body;

    if (!vendorId || !action) {
      return NextResponse.json(
        { error: 'Vendor ID and action required' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be approve or reject' },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      const updatedVendor = await Vendor.findByIdAndUpdate(
        vendorId,
        {
          status: 'verified',
          verifiedAt: new Date(),
          rejectionReason: '',
          isActive: true,
        },
        { new: true }
      ).select('-password');

      if (!updatedVendor) {
        return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
      }

      // Activate previously submitted products that were waiting on verification.
      await Product.updateMany(
        { vendorId, approvalStatus: 'approved' },
        { $set: { isActive: true } }
      );

      try {
        const { notifyVendor } = await import('@/lib/vendorNotifications');
        await notifyVendor({
          vendorId: String(vendorId),
          type: 'profile_verification',
          title: 'Account verified',
          message: 'Your vendor account has been approved. You can now list products.',
          actionUrl: '/vendor/dashboard',
        });
      } catch {
        // non-fatal
      }

      return NextResponse.json(
        {
          message: 'Vendor approved successfully',
          vendor: updatedVendor,
        },
        { status: 200 }
      );
    }

    // Soft reject — do NOT delete vendor or products.
    if (!rejectionReason || !String(rejectionReason).trim()) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      );
    }

    const updatedVendor = await Vendor.findByIdAndUpdate(
      vendorId,
      {
        status: 'rejected',
        rejectionReason: String(rejectionReason).trim(),
        isActive: false,
        updatedAt: new Date(),
      },
      { new: true }
    ).select('-password');

    if (!updatedVendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    // Hide storefront products while rejected (can be restored on re-approve).
    await Product.updateMany({ vendorId }, { $set: { isActive: false } });

    try {
      const { notifyVendor } = await import('@/lib/vendorNotifications');
      await notifyVendor({
        vendorId: String(vendorId),
        type: 'profile_verification',
        title: 'Account rejected',
        message: String(rejectionReason).trim().slice(0, 200),
        actionUrl: '/vendor/dashboard',
      });
    } catch {
      // non-fatal
    }

    return NextResponse.json(
      {
        message: 'Vendor rejected (account retained for records)',
        vendor: updatedVendor,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating vendor:', error.message);
    return NextResponse.json(
      { error: 'Failed to update vendor' },
      { status: 500 }
    );
  }
}

// PUT - Suspend, reactivate, deactivate, or hard-delete vendor
export async function PUT(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { vendorId, action, reason } = body;

    if (!vendorId || !action) {
      return NextResponse.json(
        { error: 'Vendor ID and action required' },
        { status: 400 }
      );
    }

    if (!['suspend', 'reactivate', 'deactivate', 'delete'].includes(action)) {
      return NextResponse.json(
        { error: 'Action must be suspend, reactivate, deactivate, or delete' },
        { status: 400 }
      );
    }

    if (action === 'suspend') {
      const updatedVendor = await Vendor.findByIdAndUpdate(
        vendorId,
        {
          status: 'suspended',
          isActive: false,
          rejectionReason: reason ? String(reason).trim() : undefined,
          updatedAt: new Date(),
        },
        { new: true }
      ).select('-password');

      if (!updatedVendor) {
        return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
      }

      await Product.updateMany({ vendorId }, { $set: { isActive: false } });

      try {
        const { notifyVendor } = await import('@/lib/vendorNotifications');
        await notifyVendor({
          vendorId: String(vendorId),
          type: 'profile_verification',
          title: 'Account suspended',
          message: reason ? String(reason).trim().slice(0, 200) : 'Your vendor account has been suspended',
          actionUrl: '/vendor/dashboard',
        });
      } catch {
        // non-fatal
      }

      return NextResponse.json(
        {
          message: 'Vendor suspended successfully',
          vendor: updatedVendor,
        },
        { status: 200 }
      );
    }

    if (action === 'deactivate') {
      const updatedVendor = await Vendor.findByIdAndUpdate(
        vendorId,
        {
          isActive: false,
          updatedAt: new Date(),
        },
        { new: true }
      ).select('-password');

      if (!updatedVendor) {
        return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
      }

      await Product.updateMany({ vendorId }, { $set: { isActive: false } });

      return NextResponse.json(
        {
          message: 'Vendor deactivated successfully',
          vendor: updatedVendor,
        },
        { status: 200 }
      );
    }

    if (action === 'delete') {
      // Explicit hard-delete only — irreversible.
      const deletedVendorResult = await deleteVendorAndAssets(vendorId);

      if (!deletedVendorResult) {
        return NextResponse.json(
          { error: 'Vendor not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          message: 'Vendor permanently deleted',
          vendor: deletedVendorResult.vendor,
          deletedProductsCount: deletedVendorResult.deletedProductsCount,
        },
        { status: 200 }
      );
    }

    // reactivate
    const updatedVendor = await Vendor.findByIdAndUpdate(
      vendorId,
      {
        status: 'verified',
        isActive: true,
        rejectionReason: '',
        verifiedAt: new Date(),
        updatedAt: new Date(),
      },
      { new: true }
    ).select('-password');

    if (!updatedVendor) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    await Product.updateMany(
      { vendorId, approvalStatus: 'approved' },
      { $set: { isActive: true } }
    );

    try {
      const { notifyVendor } = await import('@/lib/vendorNotifications');
      await notifyVendor({
        vendorId: String(vendorId),
        type: 'profile_verification',
        title: 'Account reactivated',
        message: 'Your vendor account is active again',
        actionUrl: '/vendor/dashboard',
      });
    } catch {
      // non-fatal
    }

    return NextResponse.json(
      {
        message: 'Vendor reactivated successfully',
        vendor: updatedVendor,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error updating vendor status:', error.message);
    return NextResponse.json(
      { error: 'Failed to update vendor' },
      { status: 500 }
    );
  }
}
