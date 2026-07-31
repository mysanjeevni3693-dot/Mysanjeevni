/**
 * Automatic Shiprocket fulfilment pipeline.
 *
 * On India order place (and admin retry):
 *   1. Create Shiprocket order (skip if already created)
 *   2. Pick best courier via serviceability (COD-aware)
 *   3. Assign AWB
 *   4. Schedule pickup
 *   5. Generate label + invoice PDFs (admin only prints)
 *
 * Failures are persisted on the order and never throw to checkout.
 */

import { shiprocketConfig } from '@/lib/shiprocket/config';
import { createShiprocketOrder } from '@/lib/shiprocket/order';
import { assignAwb } from '@/lib/shiprocket/shipment';
import { generatePickup } from '@/lib/shiprocket/pickup';
import { generateLabel } from '@/lib/shiprocket/label';
import { generateInvoice } from '@/lib/shiprocket/invoice';
import { checkServiceability } from '@/lib/shiprocket/serviceability';
import { shiprocketLogger } from '@/lib/shiprocket/logger';
import { buildCreateOrderInput, type OrderDocument } from './_shippingService';

export type PipelineStep =
  | 'create'
  | 'awb'
  | 'pickup'
  | 'label'
  | 'invoice'
  | 'done';

export interface PipelineResult {
  ok: boolean;
  step: PipelineStep;
  awbNumber?: string;
  courierName?: string;
  shiprocketOrderId?: string;
  shiprocketShipmentId?: string;
  labelUrl?: string;
  invoiceUrl?: string;
  error?: string;
}

function preferredCourierId(): number | undefined {
  const raw = Number(process.env.SHIPROCKET_COURIER_ID || 0);
  return Number.isFinite(raw) && raw > 0 ? raw : undefined;
}

function recordError(order: OrderDocument, step: PipelineStep, error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown shipping error';
  Object.assign(order, {
    shiprocketPipelineStep: step,
    shiprocketLastError: message.slice(0, 500),
  });
  return message;
}

async function persist(order: OrderDocument): Promise<void> {
  await order.save();
}

/**
 * Runs (or resumes) the full auto-fulfilment pipeline for one order.
 * Idempotent: skips steps that already succeeded.
 */
export async function runShiprocketFulfillmentPipeline(
  order: OrderDocument
): Promise<PipelineResult> {
  const orderId = String(order._id);

  let shipmentId = String(order.shiprocketShipmentId || '');
  let shiprocketOrderId = String(order.shiprocketOrderId || '');

  // ---- 1) Create Shiprocket order ----------------------------------------
  if (!shipmentId) {
    try {
      const input = await buildCreateOrderInput(order);
      const created = await createShiprocketOrder(input);
      shipmentId = created.shipmentId;
      shiprocketOrderId = created.shiprocketOrderId;
      Object.assign(order, {
        shiprocketOrderId,
        shiprocketShipmentId: shipmentId,
        shipmentStatus: 'PENDING',
        shiprocketPipelineStep: 'create',
        shiprocketLastError: '',
      });
      // Ready for warehouse packing once SR accepts (COD pending is OK).
      if (!(order as any).status || (order as any).status === 'pending') {
        Object.assign(order, { status: 'confirmed' });
        if (Array.isArray((order as any).items)) {
          for (const item of (order as any).items) {
            if (!item.status || item.status === 'pending') item.status = 'confirmed';
          }
        }
      }
      await persist(order);
    } catch (error) {
      const message = recordError(order, 'create', error);
      await persist(order).catch(() => undefined);
      shiprocketLogger.error('order', 'Auto create-order failed', { orderId, message });
      return { ok: false, step: 'create', error: message };
    }
  }

  // ---- 2) Assign AWB (courier + tracking) --------------------------------
  if (!order.awbNumber) {
    try {
      const createInput = await buildCreateOrderInput(order);
      const isCod = createInput.paymentMethod === 'COD';
      const weight = Math.max(0.5, Number(createInput.dimensions?.weight || 0.5));
      const deliveryPincode = String(createInput.billing.pincode || '').replace(/\D/g, '');

      let courierId = preferredCourierId();
      try {
        const serviceability = await checkServiceability({
          deliveryPincode,
          weight,
          cod: isCod,
          declaredValue: Number(order.totalPrice || 0) || undefined,
          pickupPincode: shiprocketConfig.pickupPincode,
        });
        const recommended = isCod
          ? serviceability.couriers.find((c) => c.codAvailable) || serviceability.recommended
          : serviceability.recommended;
        if (recommended?.courierCompanyId) {
          courierId = recommended.courierCompanyId;
        }
      } catch (svcErr) {
        shiprocketLogger.error('serviceability', 'Courier lookup failed; trying default AWB', {
          orderId,
          message: svcErr instanceof Error ? svcErr.message : 'unknown',
        });
      }

      const awb = await assignAwb({
        shipmentId,
        ...(courierId ? { courierId } : {}),
      });

      Object.assign(order, {
        awbNumber: awb.awbCode,
        courierName: awb.courierName,
        shipmentStatus: 'PENDING',
        shiprocketPipelineStep: 'awb',
        shiprocketLastError: '',
      });
      await persist(order);
    } catch (error) {
      const message = recordError(order, 'awb', error);
      await persist(order).catch(() => undefined);
      shiprocketLogger.error('shipment', 'Auto assign-awb failed', { orderId, message });
      return {
        ok: false,
        step: 'awb',
        shiprocketOrderId,
        shiprocketShipmentId: shipmentId,
        error: message,
      };
    }
  }

  // ---- 3) Schedule pickup ------------------------------------------------
  const pickupDone =
    Boolean(order.pickupStatus) &&
    !/pending|failed|error/i.test(String(order.pickupStatus || ''));

  if (!pickupDone) {
    try {
      const pickup = await generatePickup({ shipmentId });
      Object.assign(order, {
        pickupStatus: pickup.pickupStatus,
        pickupTokenNumber: pickup.pickupTokenNumber,
        shipmentStatus: pickup.pickupScheduled
          ? 'PICKUP_SCHEDULED'
          : order.shipmentStatus || 'PENDING',
        shiprocketPipelineStep: 'pickup',
        shiprocketLastError: '',
      });
      await persist(order);
    } catch (error) {
      const message = recordError(order, 'pickup', error);
      await persist(order).catch(() => undefined);
      shiprocketLogger.error('pickup', 'Auto generate-pickup failed', { orderId, message });
    }
  }

  // ---- 4) Label PDF (admin prints) ---------------------------------------
  if (!order.labelUrl && order.awbNumber) {
    try {
      const label = await generateLabel({ shipmentId });
      Object.assign(order, {
        labelUrl: label.labelUrl,
        shiprocketPipelineStep: 'label',
        shiprocketLastError: '',
      });
      await persist(order);
    } catch (error) {
      const message = recordError(order, 'label', error);
      await persist(order).catch(() => undefined);
      shiprocketLogger.error('label', 'Auto generate-label failed', { orderId, message });
    }
  }

  // ---- 5) Invoice PDF (admin prints) -------------------------------------
  if (!order.invoiceUrl && shiprocketOrderId) {
    try {
      const invoice = await generateInvoice({ shipmentId: shiprocketOrderId });
      Object.assign(order, {
        invoiceUrl: invoice.invoiceUrl,
        shiprocketPipelineStep: 'invoice',
        shiprocketLastError: '',
      });
      await persist(order);
    } catch (error) {
      const message = recordError(order, 'invoice', error);
      await persist(order).catch(() => undefined);
      shiprocketLogger.error('invoice', 'Auto generate-invoice failed', { orderId, message });
    }
  }

  const fullyReady = Boolean(order.awbNumber);
  if (fullyReady && !order.shiprocketLastError) {
    Object.assign(order, { shiprocketPipelineStep: 'done', shiprocketLastError: '' });
    await persist(order).catch(() => undefined);
  } else if (fullyReady) {
    Object.assign(order, { shiprocketPipelineStep: 'done' });
    await persist(order).catch(() => undefined);
  }

  return {
    ok: fullyReady,
    step: (order.shiprocketPipelineStep as PipelineStep) || 'done',
    awbNumber: order.awbNumber,
    courierName: order.courierName,
    shiprocketOrderId: order.shiprocketOrderId,
    shiprocketShipmentId: order.shiprocketShipmentId,
    labelUrl: order.labelUrl,
    invoiceUrl: order.invoiceUrl,
    error: order.shiprocketLastError || undefined,
  };
}
