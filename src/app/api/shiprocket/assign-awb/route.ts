/**
 * POST /api/shiprocket/assign-awb
 *
 * Admin-only. Assigns a courier + AWB to an order's shipment and stores the AWB
 * number and courier name on the DB order.
 *
 * Body: { orderId: string, courierId?: number }
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { assignAwb } from '@/lib/shiprocket/shipment';
import { ok, fail, handleRouteError } from '@/lib/shiprocket/response';
import { requireAdmin } from '../_guard';
import { loadOrder } from '../_shippingService';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  orderId: z.string().trim().min(1),
  courierId: z.number().int().positive().optional(),
});

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { orderId, courierId } = bodySchema.parse(await request.json().catch(() => ({})));
    const order = await loadOrder(orderId);

    if (!order.shiprocketShipmentId) {
      return fail('VALIDATION_ERROR', 'Create the Shiprocket order before assigning an AWB', 422);
    }

    const result = await assignAwb({ shipmentId: order.shiprocketShipmentId, courierId });

    Object.assign(order, {
      awbNumber: result.awbCode,
      courierName: result.courierName,
      shipmentStatus: 'PENDING',
    });
    await order.save();

    return ok(result);
  } catch (error) {
    return handleRouteError(error, 'shipment');
  }
}
