/**
 * POST /api/orders/place
 *
 * Persists a customer order to the database AFTER a successful payment (Razorpay
 * / PayPal) or COD confirmation, then automatically runs the Shiprocket
 * fulfilment pipeline for Indian orders:
 *
 *   Save order (DB) -> Create Shiprocket order -> Assign AWB -> Schedule pickup
 *
 * The database order is always saved first and is the source of truth. Every
 * Shiprocket step is best-effort: a failure is logged and stored on the order
 * (so the admin Shipments panel can retry) but never fails the purchase.
 *
 * Label / invoice / manifest remain admin-triggered (they are print actions,
 * and manifest is typically batched per pickup) via /admin/shipments.
 *
 * This endpoint is intentionally additive: the existing localStorage-based order
 * screens keep working via the checkout's dual-write. It does NOT create a
 * payment order (payment is already completed by the time it is called).
 */

import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { Order } from '@/lib/models/Order';
import { Address } from '@/lib/models/Address';
import { User } from '@/lib/models/User';
import { hasShiprocketCredentials } from '@/lib/shiprocket/config';
import { createShiprocketOrder } from '@/lib/shiprocket/order';
import { assignAwb } from '@/lib/shiprocket/shipment';
import { generatePickup } from '@/lib/shiprocket/pickup';
import { shiprocketLogger } from '@/lib/shiprocket/logger';
import { ok, fail, handleRouteError } from '@/lib/shiprocket/response';
import { buildCreateOrderInput, type OrderDocument } from '../../shiprocket/_shippingService';

export const dynamic = 'force-dynamic';

/** Validation schema for a placed order. */
const placeOrderSchema = z.object({
  userId: z.string().trim().min(1),
  items: z
    .array(
      z.object({
        productId: z.string().trim().optional().default(''),
        productName: z.string().trim().min(1),
        quantity: z.number().int().positive(),
        price: z.number().nonnegative(),
        requiresPrescription: z.boolean().optional().default(false),
        prescriptionUrl: z.string().trim().optional(),
      })
    )
    .min(1),
  deliveryAddress: z.object({
    fullName: z.string().trim().min(1),
    phone: z.string().trim().min(6),
    addressLine1: z.string().trim().min(1),
    addressLine2: z.string().trim().optional().default(''),
    city: z.string().trim().min(1),
    state: z.string().trim().min(1),
    pincode: z.string().trim().min(4),
    country: z.string().trim().optional().default('India'),
  }),
  subtotal: z.number().nonnegative().default(0),
  discount: z.number().nonnegative().default(0),
  deliveryCharge: z.number().nonnegative().default(0),
  totalAmount: z.number().nonnegative(),
  paymentMethod: z.string().trim().default('cod'),
  paymentStatus: z.enum(['pending', 'completed', 'failed', 'refunded']).default('pending'),
  razorpayOrderId: z.string().trim().optional(),
  razorpayPaymentId: z.string().trim().optional(),
  orderNotes: z.string().trim().optional().default(''),
});

type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

/**
 * Runs the automatic Shiprocket pipeline for a freshly created order.
 * Each step is guarded so a failure is recorded but never throws.
 */
async function runShiprocketPipeline(order: OrderDocument): Promise<void> {
  // Step 1: create the Shiprocket order.
  let shipmentId = '';
  try {
    const input = await buildCreateOrderInput(order);
    const created = await createShiprocketOrder(input);
    shipmentId = created.shipmentId;
    Object.assign(order, {
      shiprocketOrderId: created.shiprocketOrderId,
      shiprocketShipmentId: created.shipmentId,
      shipmentStatus: 'PENDING',
    });
    await order.save();
  } catch (error) {
    shiprocketLogger.error('order', 'Auto create-order failed', {
      orderId: String(order._id),
      message: error instanceof Error ? error.message : 'unknown',
    });
    return; // Without a shipment id the remaining steps cannot proceed.
  }

  // Step 2: assign an AWB (courier + tracking number).
  try {
    const awb = await assignAwb({ shipmentId });
    Object.assign(order, { awbNumber: awb.awbCode, courierName: awb.courierName });
    await order.save();
  } catch (error) {
    shiprocketLogger.error('shipment', 'Auto assign-awb failed', {
      orderId: String(order._id),
      message: error instanceof Error ? error.message : 'unknown',
    });
    return; // Pickup requires an assigned AWB.
  }

  // Step 3: schedule a pickup.
  try {
    const pickup = await generatePickup({ shipmentId });
    Object.assign(order, {
      pickupStatus: pickup.pickupStatus,
      pickupTokenNumber: pickup.pickupTokenNumber,
      shipmentStatus: pickup.pickupScheduled ? 'PICKUP_SCHEDULED' : 'PENDING',
    });
    await order.save();
  } catch (error) {
    shiprocketLogger.error('pickup', 'Auto generate-pickup failed', {
      orderId: String(order._id),
      message: error instanceof Error ? error.message : 'unknown',
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const input: PlaceOrderInput = placeOrderSchema.parse(await request.json().catch(() => ({})));

    // The order must belong to a real user (guest checkouts are not persisted to
    // the DB pipeline; the caller keeps them in localStorage only).
    if (!mongoose.isValidObjectId(input.userId)) {
      return fail('VALIDATION_ERROR', 'A valid signed-in user is required to persist the order', 422);
    }

    await connectDB();
    void User; // ensure model registered for populate

    // Snapshot the delivery address as its own document (Order.deliveryAddress
    // is a required ObjectId ref — we do not modify the schema).
    const address = await Address.create({
      userId: input.userId,
      fullName: input.deliveryAddress.fullName,
      phone: input.deliveryAddress.phone,
      addressLine1: input.deliveryAddress.addressLine1,
      addressLine2: input.deliveryAddress.addressLine2,
      city: input.deliveryAddress.city,
      state: input.deliveryAddress.state,
      pincode: input.deliveryAddress.pincode,
      country: input.deliveryAddress.country,
    });

    // Persist the order (source of truth).
    const order = (await Order.create({
      userId: input.userId,
      items: input.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity,
        requiresPrescription: item.requiresPrescription,
        prescriptionUrl: item.prescriptionUrl,
      })),
      totalPrice: input.totalAmount,
      shippingCharge: input.deliveryCharge,
      deliveryAddress: address._id,
      status: input.paymentStatus === 'completed' ? 'confirmed' : 'pending',
      paymentStatus: input.paymentStatus,
      razorpayOrderId: input.razorpayOrderId,
      razorpayPaymentId: input.razorpayPaymentId,
      orderNotes: input.orderNotes,
      prescriptions: input.items
        .filter((item) => item.requiresPrescription && item.prescriptionUrl)
        .map((item) => ({
          productId: item.productId,
          productName: item.productName,
          prescriptionUrl: item.prescriptionUrl,
        })),
    })) as unknown as OrderDocument;

    // Auto-run the Shiprocket pipeline for serviceable Indian orders only.
    const country = String(input.deliveryAddress.country || 'India').trim().toLowerCase();
    const isIndia = country === 'india' || country === 'in';
    const shouldShip = isIndia && input.paymentStatus !== 'failed' && hasShiprocketCredentials();

    if (shouldShip) {
      await runShiprocketPipeline(order);
    }

    return ok(
      {
        orderId: String(order._id),
        shiprocketOrderId: order.shiprocketOrderId ?? '',
        shipmentId: order.shiprocketShipmentId ?? '',
        awbNumber: order.awbNumber ?? '',
        courierName: order.courierName ?? '',
        shipmentStatus: order.shipmentStatus ?? '',
        pickupStatus: order.pickupStatus ?? '',
      },
      201
    );
  } catch (error) {
    return handleRouteError(error, 'order');
  }
}
