/**
 * Vendor earnings engine.
 *
 * When an order is paid (prepaid) or delivered (COD), each vendor who owns line
 * items is credited: gross item total − platform commission → wallet.balance.
 *
 * Idempotent: repeating credit for the same order+vendor is a no-op (checked via
 * Transaction relatedId + vendorId + type earning).
 */

import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { Order } from '@/lib/models/Order';
import { Product } from '@/lib/models/Product';
import { Vendor } from '@/lib/models/Vendor';
import { Wallet } from '@/lib/models/Wallet';
import { Transaction } from '@/lib/models/Transaction';
import { Commission } from '@/lib/models/Commission';

export interface VendorCreditResult {
  vendorId: string;
  gross: number;
  commission: number;
  net: number;
  credited: boolean;
  reason?: string;
}

async function resolveCommissionPercent(vendorId: string, vendorDoc: any): Promise<number> {
  // 1) Per-vendor override on Vendor model
  if (typeof vendorDoc?.commissionPercentage === 'number') {
    return Math.min(100, Math.max(0, vendorDoc.commissionPercentage));
  }

  // 2) Commission config vendor override
  const config = await Commission.findOne({}).lean();
  if (config?.vendorCommissions?.length) {
    const now = new Date();
    const match = config.vendorCommissions.find((c: any) => {
      if (String(c.vendorId) !== String(vendorId)) return false;
      if (c.effectiveFrom && new Date(c.effectiveFrom) > now) return false;
      if (c.effectiveUntil && new Date(c.effectiveUntil) < now) return false;
      return true;
    });
    if (match && typeof match.commissionPercentage === 'number') {
      return Math.min(100, Math.max(0, match.commissionPercentage));
    }
  }

  // 3) Platform default
  if (typeof config?.platformDefaultCommission === 'number') {
    return Math.min(100, Math.max(0, config.platformDefaultCommission));
  }

  return 10;
}

async function getOrCreateVendorWallet(vendorId: string) {
  let wallet = await Wallet.findOne({ vendorId });
  if (!wallet) {
    wallet = await Wallet.create({ vendorId, balance: 0, totalEarnings: 0, totalWithdrawn: 0, totalCommissionDeducted: 0 });
  }
  return wallet;
}

/**
 * Credits vendors on an order once payment is complete or items are delivered.
 * Safe to call multiple times.
 *
 * @param opts.onlyVendorId — credit only this vendor (multi-vendor partial delivery)
 * @param opts.allowPartialDelivery — allow COD credit when this vendor's items are delivered
 *   even if the whole order is not yet delivered
 */
export async function creditVendorsForOrder(
  orderId: string,
  opts?: { onlyVendorId?: string; allowPartialDelivery?: boolean }
): Promise<VendorCreditResult[]> {
  await connectDB();

  const order = await Order.findById(orderId);
  if (!order) return [];

  const paymentStatus = String(order.paymentStatus || '').toLowerCase();
  const orderStatus = String(order.status || '').toLowerCase();
  const onlyVendorId = opts?.onlyVendorId ? String(opts.onlyVendorId) : '';

  if (paymentStatus === 'refunded' || paymentStatus === 'failed') {
    return [{ vendorId: '', gross: 0, commission: 0, net: 0, credited: false, reason: 'not_eligible' }];
  }

  // Whole-order cancel blocks global credit; vendor-scoped cancel is handled by item filter.
  if (orderStatus === 'cancelled' && !onlyVendorId) {
    return [{ vendorId: '', gross: 0, commission: 0, net: 0, credited: false, reason: 'not_eligible' }];
  }

  const paymentOk = paymentStatus === 'completed';
  const orderDelivered = orderStatus === 'delivered';
  const shouldCredit = paymentOk || orderDelivered || Boolean(opts?.allowPartialDelivery);

  if (!shouldCredit) {
    return [{ vendorId: '', gross: 0, commission: 0, net: 0, credited: false, reason: 'not_eligible' }];
  }

  // For full-order COD delivered, flip payment to completed so downstream is consistent.
  if (orderDelivered && paymentStatus === 'pending' && !onlyVendorId) {
    order.paymentStatus = 'completed';
    await order.save();
  }

  const items = Array.isArray(order.items) ? order.items : [];

  // Group line totals by vendorId (stamped, or resolved from Product).
  const byVendor = new Map<string, { gross: number; productIds: string[]; allDelivered: boolean }>();

  for (const item of items) {
    let vendorId = String((item as any).vendorId || '').trim();
    if (!vendorId && (item as any).productId) {
      try {
        const product = await Product.findById((item as any).productId).select('vendorId');
        if (product?.vendorId) vendorId = String(product.vendorId);
      } catch {
        // skip
      }
    }
    if (!vendorId || !mongoose.isValidObjectId(vendorId)) continue;
    if (onlyVendorId && vendorId !== onlyVendorId) continue;

    const itemStatus = String((item as any).status || orderStatus || 'pending').toLowerCase();
    if (itemStatus === 'cancelled') continue;

    const lineTotal = Number(
      (item as any).total ?? Number((item as any).price || 0) * Number((item as any).quantity || 0)
    );
    if (lineTotal <= 0) continue;

    const existing = byVendor.get(vendorId) || { gross: 0, productIds: [], allDelivered: true };
    existing.gross += lineTotal;
    existing.productIds.push(String((item as any).productId || ''));
    if (itemStatus !== 'delivered') existing.allDelivered = false;
    byVendor.set(vendorId, existing);
  }

  const results: VendorCreditResult[] = [];

  for (const [vendorId, { gross, allDelivered }] of byVendor.entries()) {
    // Partial COD: only credit when this vendor's lines are delivered (unless prepaid).
    if (!paymentOk && !orderDelivered && opts?.allowPartialDelivery && !allDelivered) {
      results.push({ vendorId, gross, commission: 0, net: 0, credited: false, reason: 'not_delivered' });
      continue;
    }

    // Idempotency: already credited for this order?
    const already = await Transaction.findOne({
      vendorId,
      type: 'earning',
      relatedType: 'order',
      relatedId: order._id,
      status: 'completed',
    });

    if (already) {
      results.push({
        vendorId,
        gross,
        commission: Number(
          (already.metadata as any)?.commission ||
            (typeof (already.metadata as any)?.get === 'function'
              ? (already.metadata as any).get('commission')
              : 0) ||
            0
        ),
        net: Number(already.amount || 0),
        credited: false,
        reason: 'already_credited',
      });
      continue;
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      results.push({ vendorId, gross, commission: 0, net: 0, credited: false, reason: 'vendor_not_found' });
      continue;
    }

    const commissionPct = await resolveCommissionPercent(vendorId, vendor);
    const commission = Math.round(((gross * commissionPct) / 100) * 100) / 100;
    const net = Math.round((gross - commission) * 100) / 100;

    if (net <= 0) {
      results.push({ vendorId, gross, commission, net: 0, credited: false, reason: 'zero_net' });
      continue;
    }

    const wallet = await getOrCreateVendorWallet(vendorId);
    wallet.balance = Number(wallet.balance || 0) + net;
    wallet.totalEarnings = Number(wallet.totalEarnings || 0) + net;
    wallet.totalCommissionDeducted = Number(wallet.totalCommissionDeducted || 0) + commission;
    await wallet.save();

    await Transaction.create({
      walletId: wallet._id,
      vendorId,
      type: 'earning',
      amount: net,
      status: 'completed',
      description: `Order #${String(order._id).slice(-8).toUpperCase()} earnings (gross ₹${gross.toFixed(2)} − ${commissionPct}% commission)`,
      relatedId: order._id,
      relatedType: 'order',
      metadata: {
        gross: String(gross),
        commission: String(commission),
        commissionPercent: String(commissionPct),
        orderId: String(order._id),
      },
    });

    if (commission > 0) {
      await Transaction.create({
        walletId: wallet._id,
        vendorId,
        type: 'commission_deduction',
        amount: commission,
        status: 'completed',
        description: `Platform commission ${commissionPct}% on order #${String(order._id).slice(-8).toUpperCase()}`,
        relatedId: order._id,
        relatedType: 'order',
        metadata: {
          gross: String(gross),
          commissionPercent: String(commissionPct),
          orderId: String(order._id),
        },
      });
    }

    vendor.revenue = Number(vendor.revenue || 0) + net;
    vendor.totalOrders = Number(vendor.totalOrders || 0) + 1;
    await vendor.save();

    results.push({ vendorId, gross, commission, net, credited: true });

    try {
      const { notifyVendor } = await import('@/lib/vendorNotifications');
      await notifyVendor({
        vendorId,
        type: 'general',
        title: 'Order earnings credited',
        message: `₹${net.toFixed(2)} credited for order #${String(order._id).slice(-8).toUpperCase()} (after ${commissionPct}% commission)`,
        relatedId: String(order._id),
        actionUrl: '/vendor/wallet',
      });
    } catch {
      // non-fatal
    }
  }

  return results;
}

/**
 * Reverses vendor credits for a cancelled/refunded order (best-effort).
 * Only runs if earnings were previously credited.
 */
export async function reverseVendorCreditsForOrder(
  orderId: string,
  reason = 'order_cancelled',
  opts?: { onlyVendorId?: string }
): Promise<number> {
  await connectDB();
  const order = await Order.findById(orderId);
  if (!order) return 0;

  const earningsQuery: any = {
    type: 'earning',
    relatedType: 'order',
    relatedId: order._id,
    status: 'completed',
  };
  if (opts?.onlyVendorId) {
    earningsQuery.vendorId = opts.onlyVendorId;
  }

  const earnings = await Transaction.find(earningsQuery);

  let reversed = 0;
  for (const txn of earnings) {
    const vendorId = txn.vendorId;
    if (!vendorId) continue;

    // Don't double-reverse
    const alreadyReversed = await Transaction.findOne({
      vendorId,
      type: 'refund',
      relatedType: 'order',
      relatedId: order._id,
      status: 'completed',
    });
    if (alreadyReversed) continue;

    const wallet = await getOrCreateVendorWallet(String(vendorId));
    const amount = Number(txn.amount || 0);
    wallet.balance = Math.max(0, Number(wallet.balance || 0) - amount);
    wallet.totalEarnings = Math.max(0, Number(wallet.totalEarnings || 0) - amount);

    // Roll back matching commission deduction for this order/vendor when present.
    const commissionTxn = await Transaction.findOne({
      vendorId,
      type: 'commission_deduction',
      relatedType: 'order',
      relatedId: order._id,
      status: 'completed',
    });
    const commissionAmount = Number(commissionTxn?.amount || 0);
    if (commissionAmount > 0) {
      wallet.totalCommissionDeducted = Math.max(
        0,
        Number(wallet.totalCommissionDeducted || 0) - commissionAmount
      );
      commissionTxn!.status = 'cancelled';
      await commissionTxn!.save();
    }

    await wallet.save();

    // Mark original earning cancelled so a future re-credit (rare) can run.
    txn.status = 'cancelled';
    await txn.save();

    // Keep denormalized vendor revenue in sync.
    try {
      const vendor = await Vendor.findById(vendorId);
      if (vendor) {
        vendor.revenue = Math.max(0, Number(vendor.revenue || 0) - amount);
        vendor.totalOrders = Math.max(0, Number(vendor.totalOrders || 0) - 1);
        await vendor.save();
      }
    } catch {
      // non-fatal
    }

    await Transaction.create({
      walletId: wallet._id,
      vendorId,
      type: 'refund',
      amount,
      status: 'completed',
      description: `Reversal for order #${String(order._id).slice(-8).toUpperCase()} (${reason})`,
      relatedId: order._id,
      relatedType: 'order',
      metadata: {
        orderId: String(order._id),
        reason,
        commissionReversed: String(commissionAmount),
      },
    });
    reversed += 1;
  }
  return reversed;
}
