/**
 * POST /api/shiprocket/checkout/webhook
 *
 * Receives order notifications from Shiprocket Checkout (SRC) after a customer
 * completes the hosted checkout. We verify the (optional) HMAC, then persist the
 * order to our database so it appears in admin/customer order views.
 *
 * Persistence is best-effort and idempotent (see persistCheckoutOrder):
 *  - The customer is matched to an existing User by email/phone. If no user is
 *    found, we acknowledge the webhook (200) without creating a DB order (the
 *    order still lives in Shiprocket and is reconciled by the success page,
 *    which can attribute it to the signed-in user directly).
 *  - Re-delivered webhooks update the existing order instead of duplicating it.
 *
 * Shiprocket already handles fulfilment inside its own ecosystem for SRC orders,
 * so we do NOT re-run the shipping pipeline here.
 */

import { NextRequest } from 'next/server';
import { verifyCheckoutWebhook, parseCheckoutOrder } from '@/lib/shiprocket/checkout';
import { persistCheckoutOrder } from '@/lib/shiprocket/checkoutPersistence';
import { shiprocketLogger } from '@/lib/shiprocket/logger';
import { ok, fail, handleRouteError } from '@/lib/shiprocket/response';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const hmac = request.headers.get('x-api-hmac-sha256');

    if (!verifyCheckoutWebhook(rawBody, hmac)) {
      shiprocketLogger.warn('webhook', 'Rejected SRC webhook with invalid signature');
      return fail('UNAUTHORIZED', 'Invalid webhook signature', 401);
    }

    const payload = rawBody ? JSON.parse(rawBody) : {};
    const order = parseCheckoutOrder(payload as Record<string, unknown>);

    shiprocketLogger.info('webhook', 'Received SRC order webhook', {
      orderId: order.orderId,
      status: order.status,
      paymentStatus: order.paymentStatus,
    });

    const result = await persistCheckoutOrder(order);
    return ok({
      received: true,
      persisted: result.persisted,
      updated: result.updated,
      ...(result.reason ? { reason: result.reason } : {}),
    });
  } catch (error) {
    return handleRouteError(error, 'webhook');
  }
}
