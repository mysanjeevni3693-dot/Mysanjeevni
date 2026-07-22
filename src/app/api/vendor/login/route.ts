import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/db';
import { Vendor } from '@/lib/models/Vendor';
import { issueVendorTokens } from '@/lib/vendorAuth';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    let { email, password } = body;

    // Normalize email to lowercase
    email = email.toLowerCase().trim();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      );
    }

    // Find vendor
    const vendor = await Vendor.findOne({ email }).select('+password');

    if (!vendor) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    if (vendor.status === 'pending') {
      return NextResponse.json(
        { error: 'Your vendor account is awaiting admin approval. Please check your email for approval status.' },
        { status: 403 }
      );
    }

    if (vendor.status === 'rejected') {
      return NextResponse.json(
        { error: 'Your vendor account was rejected. Contact support.' },
        { status: 403 }
      );
    }

    if (vendor.status === 'suspended') {
      return NextResponse.json(
        { error: 'Your vendor account is suspended' },
        { status: 403 }
      );
    }

    // Verify password
    const hashedPassword = crypto
      .createHash('sha256')
      .update(password)
      .digest('hex');

    if (hashedPassword !== vendor.password) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Real JWT — APIs verify this and bind vendorId from the token (not the client).
    const tokens = issueVendorTokens(vendor);

    const vendorResponse = {
      // Both shapes for backward compatibility with dashboard (expects _id).
      _id: vendor._id,
      id: vendor._id,
      vendorName: vendor.vendorName,
      email: vendor.email,
      phone: vendor.phone,
      businessType: vendor.businessType,
      status: vendor.status,
      rating: vendor.rating,
      totalOrders: vendor.totalOrders,
      revenue: vendor.revenue,
      commissionPercentage: vendor.commissionPercentage,
      logo: vendor.logo,
      isActive: vendor.isActive,
    };

    return NextResponse.json(
      {
        message: 'Login successful',
        vendor: vendorResponse,
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Vendor login error:', error.message);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
