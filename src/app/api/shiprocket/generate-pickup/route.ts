/**
 * POST /api/shiprocket/generate-pickup
 *
 * Admin-only. Schedules a courier pickup for the order's shipment and stores the
 * pickup status + token on the DB order.
 *
 * Body: { orderId: string }
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { generatePickup } from '@/lib/shiprocket/pickup';
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

    if (!order.shiprocketShipmentId) {
      return fail('VALIDATION_ERROR', 'Create the Shiprocket order before scheduling a pickup', 422);
    }

    const result = await generatePickup({ shipmentId: order.shiprocketShipmentId });

    Object.assign(order, {
      pickupStatus: result.pickupStatus,
      pickupTokenNumber: result.pickupTokenNumber,
      shipmentStatus: result.pickupScheduled ? 'PICKUP_SCHEDULED' : 'PENDING',
    });
    await order.save();

    return ok(result);
  } catch (error) {
    return handleRouteError(error, 'pickup');
  }
}
