/**
 * Vendor authentication helpers.
 *
 * Vendor login issues a real JWT (role: 'vendor'). Every vendor-scoped API must
 * call `requireVendorAuth` and use the vendorId from the token — never trust a
 * client-supplied vendorId alone (that was an IDOR risk).
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionTokens,
  extractBearerToken,
  verifyAccessToken,
  type JWTPayload,
} from '@/lib/jwtUtils';

export interface VendorAuthContext {
  vendorId: string;
  email?: string;
  phone: string;
  payload: JWTPayload;
}

/**
 * Issues access + refresh tokens for a verified vendor.
 */
export function issueVendorTokens(vendor: {
  _id: { toString(): string } | string;
  email?: string;
  phone?: string;
  status?: string;
}): ReturnType<typeof createSessionTokens> {
  return createSessionTokens({
    userId: String(vendor._id),
    email: vendor.email,
    phone: String(vendor.phone || ''),
    role: 'vendor',
    isVerified: vendor.status === 'verified',
  });
}

/**
 * Reads and verifies the Bearer token; ensures role is vendor.
 * Returns either the auth context or a NextResponse error to return immediately.
 */
export function requireVendorAuth(
  request: NextRequest
): VendorAuthContext | NextResponse {
  const token = extractBearerToken(request.headers.get('authorization') || undefined);
  if (!token) {
    return NextResponse.json(
      { error: 'Authentication required. Please log in again.' },
      { status: 401 }
    );
  }

  try {
    const payload = verifyAccessToken(token);
    if (payload.role !== 'vendor') {
      return NextResponse.json({ error: 'Vendor access only' }, { status: 403 });
    }
    if (!payload.userId) {
      return NextResponse.json({ error: 'Invalid vendor token' }, { status: 401 });
    }
    return {
      vendorId: payload.userId,
      email: payload.email,
      phone: payload.phone,
      payload,
    };
  } catch {
    return NextResponse.json(
      { error: 'Invalid or expired session. Please log in again.' },
      { status: 401 }
    );
  }
}

export function isAuthError(
  result: VendorAuthContext | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}

/**
 * Ensures a requested vendorId (from query/body) matches the authenticated vendor.
 * Prevents Vendor A from reading/updating Vendor B's data.
 */
export function assertOwnVendor(
  auth: VendorAuthContext,
  requestedVendorId: string | null | undefined
): NextResponse | null {
  if (!requestedVendorId) return null;
  if (String(requestedVendorId) !== String(auth.vendorId)) {
    return NextResponse.json(
      { error: 'You do not have permission to access this vendor resource' },
      { status: 403 }
    );
  }
  return null;
}
