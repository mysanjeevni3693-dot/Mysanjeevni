/**
 * Helper to create vendor in-app notifications (best-effort, never throws to callers).
 */

import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { VendorNotification } from '@/lib/models/VendorNotification';

export type VendorNotificationType =
  | 'new_order'
  | 'order_cancelled'
  | 'return_request'
  | 'refund_request'
  | 'product_approved'
  | 'product_rejected'
  | 'settlement_paid'
  | 'low_stock'
  | 'out_of_stock'
  | 'profile_verification'
  | 'general';

export async function notifyVendor(input: {
  vendorId: string;
  type: VendorNotificationType;
  title: string;
  message?: string;
  relatedId?: string;
  actionUrl?: string;
}): Promise<void> {
  try {
    if (!input.vendorId || !mongoose.isValidObjectId(input.vendorId)) return;
    await connectDB();
    await VendorNotification.create({
      vendorId: input.vendorId,
      type: input.type,
      title: input.title,
      message: input.message || '',
      relatedId: input.relatedId || '',
      actionUrl: input.actionUrl || '',
      isRead: false,
    });
  } catch (error) {
    console.error('notifyVendor failed (non-fatal):', error);
  }
}

export async function notifyVendors(
  vendorIds: string[],
  payload: Omit<Parameters<typeof notifyVendor>[0], 'vendorId'>
): Promise<void> {
  const unique = [...new Set(vendorIds.filter(Boolean))];
  await Promise.all(unique.map((vendorId) => notifyVendor({ ...payload, vendorId })));
}

/** Best-effort stock alerts when inventory crosses thresholds. */
export async function maybeNotifyStock(product: {
  vendorId?: string | null;
  name?: string | null;
  stock?: number | null;
  _id?: unknown;
}): Promise<void> {
  const vendorId = String(product.vendorId || '');
  if (!vendorId) return;
  const stock = Number(product.stock ?? 0);
  const name = product.name || 'Product';
  const relatedId = product._id != null ? String(product._id) : '';

  if (stock <= 0) {
    await notifyVendor({
      vendorId,
      type: 'out_of_stock',
      title: 'Out of stock',
      message: `${name} is out of stock`,
      relatedId,
      actionUrl: '/vendor/dashboard',
    });
  } else if (stock <= 10) {
    await notifyVendor({
      vendorId,
      type: 'low_stock',
      title: 'Low stock alert',
      message: `${name} has only ${stock} left`,
      relatedId,
      actionUrl: '/vendor/dashboard',
    });
  }
}
