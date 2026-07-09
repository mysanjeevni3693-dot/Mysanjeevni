/**
 * POST /api/shiprocket/generate-label
 *
 * Admin-only. Generates a shipping label PDF and stores its URL on the order.
 *
 * Body: { orderId: string }
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { generateLabel } from '@/lib/shiprocket/label';
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
      return fail('VALIDATION_ERROR', 'Create the Shiprocket order before generating a label', 422);
    }

    const result = await generateLabel({ shipmentId: order.shiprocketShipmentId });

    Object.assign(order, { labelUrl: result.labelUrl });
    await order.save();

    return ok(result);
  } catch (error) {
    return handleRouteError(error, 'label');
  }
}
