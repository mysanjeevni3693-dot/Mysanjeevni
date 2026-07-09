/**
 * POST /api/shiprocket/create-order
 *
 * Admin-only. Creates a Shiprocket order from an existing DB order and persists
 * the returned Shiprocket order id + shipment id back onto the order.
 *
 * Body: { orderId: string }  (the Mongo order _id)
 *
 * The DB order is always the source of truth: we save the order first (it
 * already exists) and only then create the Shiprocket order, matching the
 * required workflow.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createShiprocketOrder } from '@/lib/shiprocket/order';
import { ok, fail, handleRouteError } from '@/lib/shiprocket/response';
import { requireAdmin } from '../_guard';
import { loadOrder, buildCreateOrderInput } from '../_shippingService';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ orderId: z.string().trim().min(1) });

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { orderId } = bodySchema.parse(await request.json().catch(() => ({})));
    const order = await loadOrder(orderId);

    if (order.shiprocketOrderId) {
      return fail('VALIDATION_ERROR', 'Shiprocket order already exists for this order', 409, {
        shiprocketOrderId: order.shiprocketOrderId,
        shipmentId: order.shiprocketShipmentId,
      });
    }

    const input = await buildCreateOrderInput(order);
    const result = await createShiprocketOrder(input);

    // Persist Shiprocket identifiers onto the DB order.
    Object.assign(order, {
      shiprocketOrderId: result.shiprocketOrderId,
      shiprocketShipmentId: result.shipmentId,
      shipmentStatus: 'PENDING',
    });
    await order.save();

    return ok(result, 201);
  } catch (error) {
    return handleRouteError(error, 'order');
  }
}
