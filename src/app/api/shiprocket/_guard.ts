/**
 * Shared admin authorization guard for Shiprocket management routes.
 *
 * Reuses the project's existing admin token validation (headers set by the
 * admin panel: authorization, x-token-expires-at, x-admin-email). Returns a
 * ready-to-send 401 response when the caller is not an authenticated admin.
 */

import type { NextRequest, NextResponse } from 'next/server';
import { validateAdminToken } from '@/lib/adminAuthMiddleware';
import { fail } from '@/lib/shiprocket/response';

/**
 * Ensures the request comes from an authenticated admin.
 *
 * @param request - the incoming request.
 * @returns `null` when authorized, otherwise a 401 JSON response to return.
 */
export async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  const validation = await validateAdminToken(request);
  if (!validation.isValid) {
    return fail('UNAUTHORIZED', validation.error || 'Admin authentication required', 401);
  }
  return null;
}
