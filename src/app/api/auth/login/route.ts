import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { connectDB } from '@/lib/db';
import { User } from '@/lib/models/User';
import { Vendor } from '@/lib/models/Vendor';
import { generateAdminToken } from '@/lib/tokenUtils';

export async function POST(request: NextRequest) {
  try {
    const timeoutId = setTimeout(() => {
      console.error('Login request timeout');
    }, 15000);

    try {
      const body = await request.json();
      const { email, password, role } = body;

      const selectedRole = role || 'user';
      const validRoles = ['user', 'vendor', 'doctor', 'admin'];

      if (!validRoles.includes(selectedRole)) {
        clearTimeout(timeoutId);
        return NextResponse.json(
          { error: 'Invalid role selected' },
          { status: 400 }
        );
      }

      // Validation
      if (!email || !password) {
        clearTimeout(timeoutId);
        return NextResponse.json(
          { error: 'Email and password are required' },
          { status: 400 }
        );
      }

      // Connect to DB
      await connectDB();

      // Handle Admin Login using Environment Variables
      if (selectedRole === 'admin') {
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPassword = process.env.ADMIN_PASSWORD;

        if (!adminEmail || !adminPassword) {
          clearTimeout(timeoutId);
          return NextResponse.json(
            { error: 'Admin login is not configured' },
            { status: 500 }
          );
        }

        if (email !== adminEmail || password !== adminPassword) {
          clearTimeout(timeoutId);
          return NextResponse.json(
            { error: 'Invalid email or password' },
            { status: 401 }
          );
        }

        const tokenPayload = generateAdminToken(adminEmail);
        const { registerAdminToken } = await import('@/lib/auth/adminAuth');
        registerAdminToken(
          tokenPayload.token,
          tokenPayload.email,
          tokenPayload.expiresAt,
          tokenPayload.createdAt
        );

        clearTimeout(timeoutId);
        return NextResponse.json(
          {
            message: 'Admin login successful',
            user: {
              email: adminEmail,
              role: 'admin',
              isAdmin: true,
            },
            token: tokenPayload.token,
            expiresAt: tokenPayload.expiresAt,
            expiresIn: '5 days',
          },
          { status: 200 }
        );
      }

      if (selectedRole === 'vendor') {
        const vendor = await Vendor.findOne({ email }).select('+password');

        if (!vendor) {
          clearTimeout(timeoutId);
          return NextResponse.json(
            { error: 'Invalid email or password' },
            { status: 401 }
          );
        }

        if (vendor.status === 'rejected') {
          clearTimeout(timeoutId);
          return NextResponse.json(
            { error: 'Your vendor account was rejected. Contact support.' },
            { status: 403 }
          );
        }

        if (vendor.status === 'suspended') {
          clearTimeout(timeoutId);
          return NextResponse.json(
            { error: 'Your vendor account is suspended' },
            { status: 403 }
          );
        }

        const hashedPassword = crypto
          .createHash('sha256')
          .update(password)
          .digest('hex');

        if (hashedPassword !== vendor.password) {
          clearTimeout(timeoutId);
          return NextResponse.json(
            { error: 'Invalid email or password' },
            { status: 401 }
          );
        }

        const { issueVendorTokens } = await import('@/lib/vendorAuth');
        const tokens = issueVendorTokens(vendor);

        clearTimeout(timeoutId);
        return NextResponse.json(
          {
            message: 'Login successful',
            user: {
              id: vendor._id,
              email: vendor.email,
              fullName: vendor.vendorName,
              phone: vendor.phone || '',
              role: 'vendor',
              isVerified: vendor.status === 'verified',
              vendorStatus: vendor.status,
            },
            token: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
          },
          { status: 200 }
        );
      }

      // Find user in MongoDB
      const user = await User.findOne({ email }).select('+password');
      
      if (!user) {
        clearTimeout(timeoutId);
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        );
      }

      // Check if user role matches selected role
      if (user.role !== selectedRole) {
        clearTimeout(timeoutId);
        return NextResponse.json(
          { error: `This account is registered as ${user.role}. Please select the correct role.` },
          { status: 403 }
        );
      }

      // For doctor role, check if approved
      if (user.role === 'doctor') {
        if (!user.isApproved) {
          clearTimeout(timeoutId);
          return NextResponse.json(
            {
              error: 'Your doctor account is pending admin approval. Please wait for approval before logging in.',
              pendingApproval: true,
            },
            { status: 403 }
          );
        }
      }

      // Hash provided password and compare
      const hashedPassword = crypto
        .createHash('sha256')
        .update(password)
        .digest('hex');

      if (hashedPassword !== user.password) {
        clearTimeout(timeoutId);
        return NextResponse.json(
          { error: 'Invalid email or password' },
          { status: 401 }
        );
      }

      // Generate mock token
      const token = crypto.randomUUID();

      // Return success response
      const userResponse = {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
      };

      clearTimeout(timeoutId);
      return NextResponse.json(
        {
          message: 'Login successful',
          user: userResponse,
          token,
        },
        { status: 200 }
      );
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error: any) {
    console.error('Login error:', error.message);
    
    if (error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
