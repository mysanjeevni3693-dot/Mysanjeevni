/**
 * POST /api/shiprocket/webhook
 *
 * Receives shipment status updates pushed by Shiprocket and syncs them to the
 * DB. Authenticated via the `x-api-key` header (configure the same value in the
 * Shiprocket panel and in `SHIPROCKET_WEBHOOK_SECRET`).
 *
 * Handled events (mapped to canonical statuses): Shipment Created, Pickup
 * Scheduled, In Transit, Out For Delivery, Delivered, RTO, Cancelled.
 */

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { Order } from '@/lib/models/Order';
import { verifyWebhookSignature, parseWebhookEvent } from '@/lib/shiprocket/webhook';
import { shiprocketLogger } from '@/lib/shiprocket/logger';
import type { ShipmentStatus } from '@/lib/shiprocket/types';
import { ok, fail, handleRouteError } from '@/lib/shiprocket/response';

export const dynamic = 'force-dynamic';

/**
 * Maps a canonical shipment status onto the existing order.status enum so the
 * rest of the app (which only knows pending/confirmed/shipped/delivered/
 * cancelled) stays consistent. Returns undefined when there is no clean mapping
 * (in which case only shipmentStatus is updated).
 */
function toOrderStatus(status: ShipmentStatus): string | undefined {
  switch (status) {
    case 'PICKED_UP':
    case 'IN_TRANSIT':
    case 'OUT_FOR_DELIVERY':
      return 'shipped';
    case 'DELIVERED':
      return 'delivered';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return undefined;
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!verifyWebhookSignature(apiKey)) {
      shiprocketLogger.warn('webhook', 'Rejected webhook with invalid x-api-key');
      return fail('UNAUTHORIZED', 'Invalid webhook signature', 401);
    }

    const payload = await request.json().catch(() => ({}));
    const event = parseWebhookEvent(payload);

    shiprocketLogger.info('webhook', 'Received event', {
      awb: event.awb,
      status: event.currentStatus,
      shiprocketOrderId: event.shiprocketOrderId,
    });

    // Acknowledge non-actionable events so Shiprocket does not retry.
    if (!event.awb && !event.shiprocketOrderId) {
      return ok({ received: true, updated: false });
    }

    await connectDB();

    // Match the order by Shiprocket order id first, then by AWB as a fallback.
    const query = event.shiprocketOrderId
      ? { shiprocketOrderId: event.shiprocketOrderId }
      : { awbNumber: event.awb };

    const update: Record<string, string> = {
      shipmentStatus: event.currentStatus,
    };
    if (event.courierName) update.courierName = event.courierName;
    if (event.estimatedDelivery) update.estimatedDelivery = event.estimatedDelivery;

    const orderStatus = toOrderStatus(event.currentStatus);
    if (orderStatus) update.status = orderStatus;

    const result = await Order.updateMany(query, { $set: update });

    return ok({ received: true, updated: (result?.modifiedCount ?? 0) > 0 });
  } catch (error) {
    return handleRouteError(error, 'webhook');
  }
}
