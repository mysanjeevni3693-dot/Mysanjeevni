/**
 * POST /api/shiprocket/serviceability
 *
 * Public endpoint used by checkout. Given a delivery pincode (+ optional weight
 * and COD flag) it returns available couriers, shipping charge, estimated
 * delivery and COD availability. Invalid pincodes are rejected with a 422 via
 * Zod validation and non-serviceable pincodes return `serviceable: false`.
 */

import { NextRequest } from 'next/server';
import { serviceabilitySchema } from '@/lib/shiprocket/types';
import { checkServiceability } from '@/lib/shiprocket/serviceability';
import { ok, handleRouteError } from '@/lib/shiprocket/response';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const input = serviceabilitySchema.parse(body);
    const result = await checkServiceability(input);
    return ok(result);
  } catch (error) {
    return handleRouteError(error, 'serviceability');
  }
}
