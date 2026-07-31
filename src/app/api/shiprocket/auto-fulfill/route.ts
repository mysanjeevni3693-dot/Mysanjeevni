/**
 * POST /api/shiprocket/auto-fulfill
 *
 * Admin-only. Runs (or retries) the full automatic fulfilment pipeline for an
 * order: create SR order → AWB → pickup → label → invoice.
 *
 * Body: { orderId: string }
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { hasShiprocketCredentials } from '@/lib/shiprocket/config';
import { ok, fail, handleRouteError } from '@/lib/shiprocket/response';
import { requireAdmin } from '../_guard';
import { loadOrder } from '../_shippingService';
import { runShiprocketFulfillmentPipeline } from '../_pipeline';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ orderId: z.string().trim().min(1) });

export async function POST(request: NextRequest) {
  const unauthorized = await requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    if (!hasShiprocketCredentials()) {
      return fail('CONFIG_MISSING', 'Shiprocket credentials are not configured', 503);
    }

    const { orderId } = bodySchema.parse(await request.json().catch(() => ({})));
    const order = await loadOrder(orderId);
    const result = await runShiprocketFulfillmentPipeline(order);

    if (!result.ok) {
      return fail(
        'UPSTREAM_ERROR',
        result.error || `Auto-fulfilment stopped at step: ${result.step}`,
        502,
        result
      );
    }

    return ok(result);
  } catch (error) {
    return handleRouteError(error, 'order');
  }
}
