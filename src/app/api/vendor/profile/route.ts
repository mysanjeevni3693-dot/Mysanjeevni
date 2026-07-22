import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Vendor } from '@/lib/models/Vendor';
import { requireVendorAuth, isAuthError } from '@/lib/vendorAuth';

function isCloudinaryImageUrl(url?: string) {
  return !!url && /^https?:\/\/res\.cloudinary\.com\//i.test(String(url).trim());
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireVendorAuth(request);
    if (isAuthError(auth)) return auth;

    await connectDB();

    // Always load the authenticated vendor — ignore client-supplied vendorId.
    const vendor = await Vendor.findById(auth.vendorId).lean();
    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Vendor profile retrieved',
      vendor,
    });
  } catch (error: any) {
    console.error('Vendor profile fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = requireVendorAuth(request);
    if (isAuthError(auth)) return auth;

    await connectDB();

    const body = await request.json();
    const {
      vendorName,
      phone,
      businessType,
      description,
      logo,
      banner,
      isActive,
      street,
      city,
      state,
      pincode,
      country,
      gstNumber,
      licenseNumber,
      registrationNumber,
      supportContact,
      socialLinks,
      pickupAddress,
      warehouseAddress,
      returnAddress,
    } = body;

    // Reject attempts to update another vendor via body.vendorId.
    if (body.vendorId && String(body.vendorId) !== String(auth.vendorId)) {
      return NextResponse.json(
        { error: 'You do not have permission to update this vendor' },
        { status: 403 }
      );
    }

    if (logo !== undefined && logo && !isCloudinaryImageUrl(logo)) {
      return NextResponse.json({ error: 'Profile image must be uploaded to Cloudinary first' }, { status: 400 });
    }
    if (banner !== undefined && banner && !isCloudinaryImageUrl(banner)) {
      return NextResponse.json({ error: 'Banner image must be uploaded to Cloudinary first' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (vendorName !== undefined) updates.vendorName = vendorName;
    if (phone !== undefined) updates.phone = phone;
    if (businessType !== undefined) updates.businessType = businessType;
    if (description !== undefined) updates.description = description;
    if (logo !== undefined) updates.logo = logo || '';
    if (banner !== undefined) updates.banner = banner || '';
    if (isActive !== undefined) updates.isActive = Boolean(isActive);
    if (gstNumber !== undefined) updates.gstNumber = gstNumber;
    if (licenseNumber !== undefined) updates.licenseNumber = licenseNumber;
    if (registrationNumber !== undefined) updates.registrationNumber = registrationNumber;
    if (supportContact !== undefined) updates.supportContact = supportContact;
    if (socialLinks !== undefined) updates.socialLinks = socialLinks;
    if (pickupAddress !== undefined) updates.pickupAddress = pickupAddress;
    if (warehouseAddress !== undefined) updates.warehouseAddress = warehouseAddress;
    if (returnAddress !== undefined) updates.returnAddress = returnAddress;

    const addressUpdates: Record<string, unknown> = {};
    if (street !== undefined) addressUpdates.street = street;
    if (city !== undefined) addressUpdates.city = city;
    if (state !== undefined) addressUpdates.state = state;
    if (pincode !== undefined) addressUpdates.pincode = pincode;
    if (country !== undefined) addressUpdates.country = country;
    if (Object.keys(addressUpdates).length > 0) {
      updates.address = addressUpdates;
    }

    updates.updatedAt = new Date();

    const vendor = await Vendor.findByIdAndUpdate(
      auth.vendorId,
      { $set: updates },
      { new: true }
    ).lean();

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Vendor profile updated successfully',
      vendor,
    });
  } catch (error: any) {
    console.error('Vendor profile update error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
