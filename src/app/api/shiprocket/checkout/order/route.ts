/**
 * POST /api/shiprocket/checkout/order
 *
 * Fetches details for a Shiprocket Checkout (SRC) order by its `oid`. Used by
 * the success page to confirm payment status after the redirect AND as a
 * fail-safe reconciliation: it persists the order to our database (idempotently,
 * attributed to the signed-in user when provided) in case the order webhook was
 * never delivered. This guarantees hosted-checkout orders always appear in the
 * customer's My Orders and the admin panel.
 */

import { NextRequest } from 'next/server';
import { checkoutOrderDetailsSchema } from '@/lib/shiprocket/types';
import { getCheckoutOrderDetails } from '@/lib/shiprocket/checkout';
import { persistCheckoutOrder } from '@/lib/shiprocket/checkoutPersistence';
import { shiprocketLogger } from '@/lib/shiprocket/logger';
import { ok, handleRouteError } from '@/lib/shiprocket/response';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { orderId, userId } = checkoutOrderDetailsSchema.parse(await request.json().catch(() => ({})));
    const order = await getCheckoutOrderDetails(orderId);

    // Fail-safe reconciliation: persist the order to our DB. Best-effort so a
    // persistence issue never breaks the customer's confirmation screen.
    try {
      const result = await persistCheckoutOrder(order, { userId });
      shiprocketLogger.info('order', 'Success-page reconciliation', {
        orderId: order.orderId,
        persisted: result.persisted,
        updated: result.updated,
        ...(result.reason ? { reason: result.reason } : {}),
      });
    } catch (persistError) {
      shiprocketLogger.error('order', 'Success-page reconciliation failed', {
        orderId: order.orderId,
        message: persistError instanceof Error ? persistError.message : 'unknown',
      });
    }

    return ok(order);
  } catch (error) {
    return handleRouteError(error, 'order');
  }
}
