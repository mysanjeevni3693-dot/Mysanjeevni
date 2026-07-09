/**
 * POST /api/shiprocket/checkout/order
 *
 * Fetches details for a Shiprocket Checkout (SRC) order by its `oid`. Used by
 * the success page to confirm payment status after the redirect, and as a
 * fail-safe reconciliation in case the order webhook was missed.
 */

import { NextRequest } from 'next/server';
import { checkoutOrderDetailsSchema } from '@/lib/shiprocket/types';
import { getCheckoutOrderDetails } from '@/lib/shiprocket/checkout';
import { ok, handleRouteError } from '@/lib/shiprocket/response';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { orderId } = checkoutOrderDetailsSchema.parse(await request.json().catch(() => ({})));
    const order = await getCheckoutOrderDetails(orderId);
    return ok(order);
  } catch (error) {
    return handleRouteError(error, 'order');
  }
}
