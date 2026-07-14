/**
 * Shared persistence for Shiprocket Checkout (SRC) orders.
 *
 * The same logic is used by two callers so an SRC order is never lost:
 *   1. The order webhook (POST /api/shiprocket/checkout/webhook) – push based.
 *   2. The success-page reconciliation (POST /api/shiprocket/checkout/order) –
 *      pull based, runs in the customer's authenticated browser after redirect.
 *
 * Persistence is idempotent (keyed on `checkoutOrderId`) so running both is safe.
 * When a caller can supply the signed-in `userId` (the success page can), the
 * order is attributed directly to that user, which removes the fragile
 * email/phone matching as a point of failure.
 */

import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { Order } from '@/lib/models/Order';
import { Address } from '@/lib/models/Address';
import { User } from '@/lib/models/User';
import { Product } from '@/lib/models/Product';
import { shiprocketLogger } from './logger';
import type { CheckoutOrder } from './types';

/** Maps SRC payment status text onto our order paymentStatus enum. */
export function mapCheckoutPaymentStatus(status: string): 'pending' | 'completed' | 'failed' {
  const value = String(status || '').toLowerCase();
  if (value === 'success') return 'completed';
  if (value === 'failed') return 'failed';
  return 'pending';
}

/** Escapes a string for safe use inside a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface PersistCheckoutResult {
  persisted: boolean;
  updated: boolean;
  reason?: string;
  orderId?: string;
}

/**
 * Persists (or updates) a parsed SRC order in our database.
 *
 * @param order - normalized checkout order (from webhook payload or details API).
 * @param opts.userId - optional signed-in user id to attribute the order to.
 */
export async function persistCheckoutOrder(
  order: CheckoutOrder,
  opts: { userId?: string } = {}
): Promise<PersistCheckoutResult> {
  if (!order.orderId) {
    return { persisted: false, updated: false, reason: 'missing_order_id' };
  }

  await connectDB();

  // Idempotency: update if we have already recorded this checkout order.
  const existing = await Order.findOne({ checkoutOrderId: order.orderId });
  if (existing) {
    existing.paymentStatus = mapCheckoutPaymentStatus(order.paymentStatus);
    existing.status = existing.paymentStatus === 'completed' ? 'confirmed' : existing.status;
    await existing.save();
    return { persisted: true, updated: true, orderId: String(existing._id) };
  }

  // Resolve the customer in order of reliability:
  //  1. userId stamped onto the order at token creation (works from the webhook,
  //     no browser needed, immune to a different phone/email in checkout);
  //  2. an explicit (authenticated) userId from the success-page reconciliation;
  //  3. a formatting-tolerant email/phone match as a last resort.
  let user: any = null;
  const stampedUserId = order.customUserId;
  if (stampedUserId && mongoose.isValidObjectId(stampedUserId)) {
    user = await User.findById(stampedUserId);
  }
  if (!user && opts.userId && mongoose.isValidObjectId(opts.userId)) {
    user = await User.findById(opts.userId);
  }
  if (!user) {
    const emailNorm = (order.email || '').trim().toLowerCase();
    const phoneLast10 = (order.phone || '').replace(/\D/g, '').slice(-10);
    const matchers: Record<string, unknown>[] = [];
    if (emailNorm) matchers.push({ email: new RegExp(`^${escapeRegExp(emailNorm)}$`, 'i') });
    if (phoneLast10.length === 10) matchers.push({ phone: new RegExp(`${phoneLast10}$`) });
    user = matchers.length ? await User.findOne({ $or: matchers }) : null;
  }

  if (!user) {
    shiprocketLogger.error('order', 'No matching user for SRC order – not persisted', {
      orderId: order.orderId,
      email: order.email || '',
      phone: order.phone || '',
    });
    return { persisted: false, updated: false, reason: 'user_not_found' };
  }

  // Snapshot the shipping address.
  const ship = order.shippingAddress;
  const address = await Address.create({
    userId: user._id,
    fullName: ship ? `${ship.firstName} ${ship.lastName}`.trim() : user.fullName,
    phone: ship?.phone || order.phone,
    addressLine1: ship?.line1 || '',
    addressLine2: ship?.line2 || '',
    city: ship?.city || '',
    state: ship?.state || '',
    pincode: ship?.pincode || '',
    country: ship?.country || 'India',
  });

  // Enrich line items with product name/price from our catalog when possible.
  const items = await Promise.all(
    order.items.map(async (item) => {
      let name = `Item ${item.variantId}`;
      let price = 0;
      try {
        const product = await Product.findById(item.variantId).select('name price');
        if (product) {
          name = product.name || name;
          price = Number(product.price ?? 0) || 0;
        }
      } catch {
        // Non-fatal: keep placeholder values.
      }
      return {
        productId: item.variantId,
        productName: name,
        quantity: item.quantity,
        price,
        total: price * item.quantity,
      };
    })
  );

  const created = await Order.create({
    userId: user._id,
    items,
    totalPrice: order.totalPayable || order.subtotal,
    shippingCharge: order.shippingCharges,
    deliveryAddress: address._id,
    status: mapCheckoutPaymentStatus(order.paymentStatus) === 'completed' ? 'confirmed' : 'pending',
    paymentStatus: mapCheckoutPaymentStatus(order.paymentStatus),
    paymentMethod: order.paymentMethod || order.paymentType,
    checkoutOrderId: order.orderId,
    checkoutSource: order.source || 'shiprocket-checkout',
    estimatedDelivery: order.estimatedDelivery,
  });

  return { persisted: true, updated: false, orderId: String(created._id) };
}
