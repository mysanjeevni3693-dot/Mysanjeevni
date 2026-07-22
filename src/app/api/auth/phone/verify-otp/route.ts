import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { PhoneOtp } from '@/lib/models/PhoneOtp';
import {
  findRegisteredByPhone,
  normalizePhone,
  normalizeRole,
  type PhoneLoginRole,
} from '@/lib/phoneAuthUtils';
import { consumeRateLimit, getClientIp } from '@/lib/rateLimit';

const IS_DEV = process.env.NODE_ENV !== 'production';

function hashOtp(phone: string, otp: string): string {
  return crypto
    .createHash('sha256')
    .update(`${phone}:${otp}:${process.env.OTP_HASH_SECRET || 'MySanjeevni-phone-otp'}`)
    .digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawPhone = String(body?.phone || '').trim();
    const otp = String(body?.otp || '').trim();
    const role = normalizeRole(String(body?.role || 'user')) as PhoneLoginRole;

    const normalizedPhone = normalizePhone(rawPhone);
    const allowUnregistered = Boolean(body?.allowUnregistered);

    if (normalizedPhone.length < 10 || otp.length !== 6) {
      return NextResponse.json(
        { error: 'Valid phone number and 6-digit OTP are required' },
        { status: 400 }
      );
    }

    await connectDB();

    const clientIp = getClientIp(request);

    // Rate limiting (relaxed in development to avoid local testing lockouts)
    if (!IS_DEV) {
      const ipLimit = await consumeRateLimit('phone-verify-otp-ip', clientIp, 40, 15 * 60 * 1000);
      if (!ipLimit.allowed) {
        return NextResponse.json(
          {
            error: `Too many OTP verification attempts from this IP. Try again in ${ipLimit.retryAfterSeconds}s.`,
            retryAfterSeconds: ipLimit.retryAfterSeconds,
          },
          { status: 429 }
        );
      }

      const phoneLimit = await consumeRateLimit(
        'phone-verify-otp-phone',
        `${role}:${normalizedPhone}`,
        10,
        10 * 60 * 1000
      );
      if (!phoneLimit.allowed) {
        return NextResponse.json(
          {
            error: `Too many OTP verification attempts for this number. Try again in ${phoneLimit.retryAfterSeconds}s.`,
            retryAfterSeconds: phoneLimit.retryAfterSeconds,
          },
          { status: 429 }
        );
      }
    }

    let lookup = null;
    if (!allowUnregistered || role !== 'user') {
      lookup = await findRegisteredByPhone(rawPhone, role);
      if (!lookup) {
        return NextResponse.json({ error: 'Number Not registered' }, { status: 404 });
      }

      if (role === 'vendor') {
        if (lookup.account.status === 'rejected') {
          return NextResponse.json(
            { error: 'Your vendor account was rejected. Contact support.' },
            { status: 403 }
          );
        }

        if (lookup.account.status === 'suspended') {
          return NextResponse.json({ error: 'Your vendor account is suspended' }, { status: 403 });
        }
      }

      if (role === 'doctor' && !lookup.account.isApproved) {
        return NextResponse.json(
          {
            error: 'Your doctor account is pending admin approval. Please wait for approval before logging in.',
            pendingApproval: true,
          },
          { status: 403 }
        );
      }
    }

    const otpHash = hashOtp(normalizedPhone, otp);

    const otpRecord = await PhoneOtp.findOne({
      phone: normalizedPhone,
      role,
      otpHash,
      consumed: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 401 });
    }

    otpRecord.consumed = true;
    await otpRecord.save();

    if (lookup?.role === 'vendor') {
      const { issueVendorTokens } = await import('@/lib/vendorAuth');
      const tokens = issueVendorTokens(lookup.account);
      return NextResponse.json(
        {
          message: 'Login successful',
          user: {
            id: lookup.account._id,
            email: lookup.account.email,
            fullName: lookup.account.vendorName,
            phone: lookup.account.phone || '',
            role: 'vendor',
            isVerified: lookup.account.status === 'verified',
            vendorStatus: lookup.account.status,
          },
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
        },
        { status: 200 }
      );
    }

    if (lookup) {
      const token = crypto.randomUUID();
      return NextResponse.json(
        {
          message: 'Login successful',
          user: {
            id: lookup.account._id,
            email: lookup.account.email,
            fullName: lookup.account.fullName,
            phone: lookup.account.phone || '',
            role: lookup.account.role,
            isVerified: lookup.account.isVerified,
          },
          token,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        message: 'OTP verified successfully',
        phone: normalizedPhone,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'OTP verification failed' },
      { status: 500 }
    );
  }
}
