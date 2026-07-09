/**
 * POST /api/shiprocket/checkout/webhook
 *
 * Receives order notifications from Shiprocket Checkout (SRC) after a customer
 * completes the hosted checkout. We verify the (optional) HMAC, then persist the
 * order to our database so it appears in admin/customer order views.
 *
 * Persistence is best-effort and idempotent:
 *  - The customer is matched to an existing User by email/phone. If no user is
 *    found, we acknowledge the webhook (200) without creating a DB order (the
 *    order still lives in Shiprocket and can be reconciled via Order/Details).
 *  - Re-delivered webhooks update the existing order instead of duplicating it.
 *
 * Shiprocket already handles fulfilment inside its own ecosystem for SRC orders,
 * so we do NOT re-run the shipping pipeline here.
 */

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/db';
import { Order } from '@/lib/models/Order';
import { Address } from '@/lib/models/Address';
import { User } from '@/lib/models/User';
import { Product } from '@/lib/models/Product';
import { verifyCheckoutWebhook, parseCheckoutOrder } from '@/lib/shiprocket/checkout';
import { shiprocketLogger } from '@/lib/shiprocket/logger';
import { ok, fail, handleRouteError } from '@/lib/shiprocket/response';

export const dynamic = 'force-dynamic';

/** Maps SRC payment status text onto our order paymentStatus enum. */
function mapPaymentStatus(status: string): 'pending' | 'completed' | 'failed' {
  const value = status.toLowerCase();
  if (value === 'success') return 'completed';
  if (value === 'failed') return 'failed';
  return 'pending';
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const hmac = request.headers.get('x-api-hmac-sha256');

    if (!verifyCheckoutWebhook(rawBody, hmac)) {
      shiprocketLogger.warn('webhook', 'Rejected SRC webhook with invalid signature');
      return fail('UNAUTHORIZED', 'Invalid webhook signature', 401);
    }

    const payload = rawBody ? JSON.parse(rawBody) : {};
    const order = parseCheckoutOrder(payload as Record<string, unknown>);

    shiprocketLogger.info('webhook', 'Received SRC order webhook', {
      orderId: order.orderId,
      status: order.status,
      paymentStatus: order.paymentStatus,
    });

    if (!order.orderId) {
      return ok({ received: true, persisted: false });
    }

    await connectDB();

    // Idempotency: update if we have already recorded this checkout order.
    const existing = await Order.findOne({ checkoutOrderId: order.orderId });
    if (existing) {
      existing.paymentStatus = mapPaymentStatus(order.paymentStatus);
      existing.status = existing.paymentStatus === 'completed' ? 'confirmed' : existing.status;
      await existing.save();
      return ok({ received: true, persisted: true, updated: true });
    }

    // Resolve the customer by email or phone.
    const user = await User.findOne({
      $or: [
        ...(order.email ? [{ email: order.email }] : []),
        ...(order.phone ? [{ phone: order.phone }] : []),
      ],
    });

    if (!user) {
      shiprocketLogger.warn('webhook', 'No matching user for SRC order – acknowledged without DB order', {
        orderId: order.orderId,
      });
      return ok({ received: true, persisted: false, reason: 'user_not_found' });
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

    await Order.create({
      userId: user._id,
      items,
      totalPrice: order.totalPayable || order.subtotal,
      shippingCharge: order.shippingCharges,
      deliveryAddress: address._id,
      status: mapPaymentStatus(order.paymentStatus) === 'completed' ? 'confirmed' : 'pending',
      paymentStatus: mapPaymentStatus(order.paymentStatus),
      paymentMethod: order.paymentMethod || order.paymentType,
      checkoutOrderId: order.orderId,
      checkoutSource: order.source || 'shiprocket-checkout',
      estimatedDelivery: order.estimatedDelivery,
    });

    return ok({ received: true, persisted: true, updated: false });
  } catch (error) {
    return handleRouteError(error, 'webhook');
  }
}
