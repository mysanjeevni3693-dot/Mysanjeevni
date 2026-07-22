import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/lib/models/User';
import { Vendor } from '@/lib/models/Vendor';
import { getFirebaseAdminAuth } from '@/lib/firebaseAdmin';
import { generateAdminToken } from '@/lib/tokenUtils';

interface VerifiedGoogleUser {
  email: string;
  phone: string;
  name: string;
  emailVerified: boolean;
}

async function verifyWithIdentityToolkit(idToken: string): Promise<VerifiedGoogleUser> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  if (!apiKey) {
    throw new Error('Firebase API key is missing for token verification fallback.');
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      cache: 'no-store',
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Failed to verify Google ID token.');
  }

  const account = Array.isArray(data?.users) ? data.users[0] : null;
  if (!account?.email) {
    throw new Error('Google account data not found in token verification response.');
  }

  return {
    email: String(account.email || '').toLowerCase().trim(),
    phone: String(account.phoneNumber || '').trim(),
    name: String(account.displayName || account.email || '').trim(),
    emailVerified: Boolean(account.emailVerified || account.phoneNumber),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const idToken = String(body?.idToken || '').trim();

    if (!idToken) {
      return NextResponse.json({ error: 'Google idToken is required' }, { status: 400 });
    }

    let verifiedUser: VerifiedGoogleUser;

    try {
      const firebaseAdminAuth = getFirebaseAdminAuth();
      const decodedToken = await firebaseAdminAuth.verifyIdToken(idToken, true);

      verifiedUser = {
        email: String(decodedToken.email || '').toLowerCase().trim(),
        phone: String(decodedToken.phone_number || '').trim(),
        name: String(decodedToken.name || decodedToken.email || '').trim(),
        emailVerified: Boolean(decodedToken.email_verified || decodedToken.phone_number),
      };
    } catch {
      // Fallback for local setups missing service-account secrets.
      verifiedUser = await verifyWithIdentityToolkit(idToken);
    }

    const email = verifiedUser.email;
    const phone = verifiedUser.phone;

    if ((!email && !phone) || !verifiedUser.emailVerified) {
      return NextResponse.json(
        { error: 'Verified email or phone is required from social login provider.' },
        { status: 401 }
      );
    }

    await connectDB();

    // Admin fallback (admin account from env without DB user record)
    if (email && process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL.toLowerCase()) {
      const tokenPayload = generateAdminToken(process.env.ADMIN_EMAIL);
      const { registerAdminToken } = await import('@/lib/auth/adminAuth');
      registerAdminToken(
        tokenPayload.token,
        tokenPayload.email,
        tokenPayload.expiresAt,
        tokenPayload.createdAt
      );
      return NextResponse.json(
        {
          message: 'Admin social login successful',
          token: tokenPayload.token,
          expiresAt: tokenPayload.expiresAt,
          user: {
            id: 'admin',
            email: process.env.ADMIN_EMAIL,
            fullName: 'Admin',
            phone: '',
            role: 'admin',
            isVerified: true,
            isAdmin: true,
          },
        },
        { status: 200 }
      );
    }

    let user = null as any;
    if (email) {
      user = await User.findOne({ email }).select('+password');
    }
    if (!user && phone) {
      user = await User.findOne({ phone }).select('+password');
    }

    if (!user) {
      let vendor = null as any;
      if (email) vendor = await Vendor.findOne({ email }).select('+password');
      if (!vendor && phone) vendor = await Vendor.findOne({ phone }).select('+password');

      if (vendor) {
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

        const { issueVendorTokens } = await import('@/lib/vendorAuth');
        const tokens = issueVendorTokens(vendor);
        return NextResponse.json(
          {
            message: 'Vendor social login successful',
            token: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
            user: {
              id: vendor._id,
              email: vendor.email,
              fullName: vendor.vendorName,
              phone: vendor.phone || '',
              role: 'vendor',
              isVerified: vendor.status === 'verified',
              vendorStatus: vendor.status,
            },
          },
          { status: 200 }
        );
      }
    }

    if (!user) {
      const fallbackPassword = crypto.randomUUID();
      const hashedPassword = crypto
        .createHash('sha256')
        .update(fallbackPassword)
        .digest('hex');

      const fallbackPhoneDigits = phone.replace(/\D/g, '').slice(-10);
      const generatedEmail =
        email ||
        `phone${fallbackPhoneDigits || Date.now()}@MySanjeevni.com`;

      user = await User.create({
        fullName: verifiedUser.name || generatedEmail.split('@')[0],
        email: generatedEmail,
        phone: phone || '',
        fullAddress: '',
        password: hashedPassword,
        role: 'user',
        isVerified: true,
      });
    } else if (!user.isVerified) {
      user.isVerified = true;
      await user.save();
    }

    const token = crypto.randomUUID();

    return NextResponse.json(
      {
        message: 'Google login successful',
        token,
        user: {
          id: user._id,
          email: user.email,
          fullName: user.fullName,
          phone: user.phone,
          role: user.role,
          isVerified: user.isVerified,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Google login failed' },
      { status: 500 }
    );
  }
}
