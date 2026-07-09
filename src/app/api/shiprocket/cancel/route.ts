/**
 * POST /api/shiprocket/cancel
 *
 * Admin-only. Cancels the Shiprocket shipment for an order and marks the DB
 * order's shipment status as CANCELLED.
 *
 * Body: { orderId: string }
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { cancelShipment } from '@/lib/shiprocket/shipment';
import { ok, fail, handleRouteError } from '@/lib/shiprocket/response';
import { requireAdmin } from '../_guard';
import { loadOrder } from '../_shippingService';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ orderId: z.string().trim().min(1) });

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { orderId } = bodySchema.parse(await request.json().catch(() => ({})));
    const order = await loadOrder(orderId);

    if (!order.shiprocketOrderId) {
      return fail('VALIDATION_ERROR', 'No Shiprocket order to cancel', 422);
    }

    const result = await cancelShipment({ orderIds: [order.shiprocketOrderId] });

    if (result.cancelled) {
      Object.assign(order, { shipmentStatus: 'CANCELLED' });
      await order.save();
    }

    return ok(result);
  } catch (error) {
    return handleRouteError(error, 'shipment');
  }
}
