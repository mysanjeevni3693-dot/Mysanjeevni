/**
 * GET /api/shiprocket/track
 *
 * Public tracking endpoint used by the customer "My Orders" page and the admin
 * panel. Accepts one of:
 *   - ?awb=<awb>
 *   - ?shipmentId=<id>
 *   - ?orderId=<mongoOrderId>   (resolves AWB/shipment from the DB order)
 *
 * When an `orderId` is supplied, the latest canonical status + tracking url are
 * also persisted back onto the order so the DB stays in sync.
 */

import { NextRequest } from 'next/server';
import { trackShipment } from '@/lib/shiprocket/tracking';
import { trackSchema } from '@/lib/shiprocket/types';
import { ok, fail, handleRouteError } from '@/lib/shiprocket/response';
import { loadOrder } from '../_shippingService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const orderId = params.get('orderId') || undefined;
    let awb = params.get('awb') || undefined;
    let shipmentId = params.get('shipmentId') || undefined;

    // Resolve identifiers from the DB order when only orderId is given.
    let order: Awaited<ReturnType<typeof loadOrder>> | null = null;
    if (orderId && !awb && !shipmentId) {
      order = await loadOrder(orderId);
      awb = order.awbNumber || undefined;
      shipmentId = order.shiprocketShipmentId || undefined;
    }

    if (!awb && !shipmentId) {
      return fail('VALIDATION_ERROR', 'No tracking identifier available for this order yet', 422);
    }

    const input = trackSchema.parse({ awb, shipmentId });
    const result = await trackShipment(input);

    // Keep the DB order's shipment status in sync when possible.
    if (order) {
      Object.assign(order, {
        shipmentStatus: result.currentStatus,
        trackingUrl: result.trackUrl || order.awbNumber,
        estimatedDelivery: result.estimatedDelivery || undefined,
        courierName: result.courierName || undefined,
      });
      await order.save();
    }

    return ok(result);
  } catch (error) {
    return handleRouteError(error, 'tracking');
  }
}
