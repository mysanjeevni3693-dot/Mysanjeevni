/**
 * Admin auth helper for API routes.
 * Expects `Authorization: Bearer <adminToken>` registered at admin login.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth/adminAuth';
import { extractBearerToken } from '@/lib/jwtUtils';

export type AdminAuthContext = {
  email: string;
  role: string;
  isAdmin: boolean;
};

export async function requireAdminAuth(
  request: NextRequest
): Promise<AdminAuthContext | NextResponse> {
  const token = extractBearerToken(request.headers.get('authorization') || undefined);
  if (!token) {
    return NextResponse.json(
      { error: 'Admin authentication required' },
      { status: 401 }
    );
  }

  const admin = await verifyAdminToken(token);
  if (!admin) {
    return NextResponse.json(
      { error: 'Invalid or expired admin session. Please log in again.' },
      { status: 401 }
    );
  }

  return admin;
}

export function isAdminAuthError(
  result: AdminAuthContext | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
