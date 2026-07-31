/**
 * POST /api/orders/place
 *
 * Persists a customer order AFTER payment / COD confirmation, then automatically
 * runs Shiprocket fulfilment for Indian orders:
 *
 *   Save order → Create SR order → Assign AWB → Pickup → Label + Invoice PDFs
 *
 * Pending COD is included (not blocked). Admin work is pack + print only.
 * Shipping failures are best-effort and never fail the purchase.
 */

import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { z } from 'zod';
import { connectDB } from '@/lib/db';
import { Order } from '@/lib/models/Order';
import { Address } from '@/lib/models/Address';
import { User } from '@/lib/models/User';
import { Product } from '@/lib/models/Product';
import { hasShiprocketCredentials } from '@/lib/shiprocket/config';
import { ok, fail, handleRouteError } from '@/lib/shiprocket/response';
import { type OrderDocument } from '../../shiprocket/_shippingService';
import { runShiprocketFulfillmentPipeline } from '../../shiprocket/_pipeline';

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
  /** Optional explicit recipient — used when user profile email is missing. */
  customerEmail: z.string().trim().optional().default(''),
});

type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

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

    // Resolve owning vendor for each line item (multi-vendor safe).
    const productIds = input.items.map((i) => i.productId).filter(Boolean);
    const products = productIds.length
      ? await Product.find({ _id: { $in: productIds } }).select('_id vendorId vendorName')
      : [];
    const productVendorMap = new Map(
      products.map((p: any) => [
        String(p._id),
        { vendorId: p.vendorId ? String(p.vendorId) : '', vendorName: p.vendorName || '' },
      ])
    );

    // Persist the order (source of truth).
    const order = (await Order.create({
      userId: input.userId,
      items: input.items.map((item) => {
        const owner = productVendorMap.get(String(item.productId || '')) || {
          vendorId: '',
          vendorName: '',
        };
        return {
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity,
          requiresPrescription: item.requiresPrescription,
          prescriptionUrl: item.prescriptionUrl,
          vendorId: owner.vendorId,
          vendorName: owner.vendorName,
          status: input.paymentStatus === 'completed' ? 'confirmed' : 'pending',
        };
      }),
      totalPrice: input.totalAmount,
      shippingCharge: input.deliveryCharge,
      deliveryAddress: address._id,
      status: input.paymentStatus === 'completed' ? 'confirmed' : 'pending',
      paymentStatus: input.paymentStatus,
      paymentMethod: input.paymentMethod,
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
      await runShiprocketFulfillmentPipeline(order);
    }

    // Notify vendors of the new order (best-effort).
    try {
      const { notifyVendors } = await import('@/lib/vendorNotifications');
      const vendorIds = [
        ...new Set(
          (order.items || [])
            .map((i: any) => String(i.vendorId || ''))
            .filter(Boolean)
        ),
      ];
      await notifyVendors(vendorIds, {
        type: 'new_order',
        title: 'New order received',
        message: `Order #${String(order._id).slice(-8).toUpperCase()} — ${order.items?.length || 0} item(s)`,
        relatedId: String(order._id),
        actionUrl: '/vendor/dashboard',
      });
    } catch (notifyErr) {
      console.error('Vendor new-order notify failed (non-fatal):', notifyErr);
    }

    // Credit vendor wallets for prepaid / completed payments (idempotent).
    if (input.paymentStatus === 'completed') {
      try {
        const { creditVendorsForOrder } = await import('@/lib/vendorEarnings');
        await creditVendorsForOrder(String(order._id));
      } catch (earnErr) {
        console.error('Vendor earnings credit failed (non-fatal):', earnErr);
      }
    }

    // Send order confirmation email via Resend (best-effort).
    try {
      const customer = await User.findById(input.userId).select('email fullName').lean();
      const profileEmail = String((customer as any)?.email || '').trim();
      const payloadEmail = String(input.customerEmail || '').trim();
      const customerEmail =
        (payloadEmail.includes('@') ? payloadEmail : '') ||
        (profileEmail.includes('@') ? profileEmail : '');

      if (!customerEmail) {
        console.warn('[orders/place] Skipping confirmation email — no customer email', {
          orderId: String(order._id),
          userId: input.userId,
        });
      } else {
        const { sendOrderConfirmationEmail } = await import('@/lib/resend');
        const country = String(input.deliveryAddress.country || 'India').toLowerCase();
        const currencySymbol = country === 'india' || country === 'in' ? '₹' : '$';
        const emailResult = await sendOrderConfirmationEmail({
          to: customerEmail,
          customerName: input.deliveryAddress.fullName || (customer as any)?.fullName || 'Customer',
          orderId: String(order._id),
          totalAmount: input.totalAmount,
          currencySymbol,
          paymentMethod: input.paymentMethod,
          paymentStatus: input.paymentStatus,
          items: input.items.map((item) => ({
            name: item.productName,
            quantity: item.quantity,
            price: item.price,
          })),
          deliveryAddress: input.deliveryAddress,
        });
        if (!emailResult.success) {
          console.error('[orders/place] Confirmation email not delivered:', emailResult.error);
        }
      }
    } catch (emailErr) {
      console.error('Order confirmation email failed (non-fatal):', emailErr);
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
        labelUrl: order.labelUrl ?? '',
        invoiceUrl: order.invoiceUrl ?? '',
        shiprocketLastError: order.shiprocketLastError ?? '',
      },
      201
    );
  } catch (error) {
    return handleRouteError(error, 'order');
  }
}
