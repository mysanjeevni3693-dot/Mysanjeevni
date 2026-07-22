/**
 * Enrich order line items with vendorId / vendorName from the Product catalog.
 * Used by every order-create path so vendors can see their own lines.
 */

import { Product } from '@/lib/models/Product';

export type OrderItemInput = {
  productId?: string | number;
  productName?: string;
  name?: string;
  quantity?: number;
  price?: number;
  total?: number;
  requiresPrescription?: boolean;
  prescriptionUrl?: string;
  vendorId?: string;
  vendorName?: string;
  status?: string;
  [key: string]: unknown;
};

export async function stampVendorOnOrderItems<T extends OrderItemInput>(
  items: T[],
  opts?: { defaultStatus?: string }
): Promise<Array<T & { vendorId: string; vendorName: string; status: string }>> {
  const productIds = [
    ...new Set(
      items
        .map((i) => String(i.productId || '').trim())
        .filter(Boolean)
    ),
  ];

  const products =
    productIds.length > 0
      ? await Product.find({ _id: { $in: productIds } }).select('_id vendorId vendorName')
      : [];

  const map = new Map<string, { vendorId: string; vendorName: string }>();
  for (const p of products as any[]) {
    map.set(String(p._id), {
      vendorId: p.vendorId ? String(p.vendorId) : '',
      vendorName: p.vendorName || '',
    });
  }

  const defaultStatus = opts?.defaultStatus || 'pending';

  return items.map((item) => {
    const key = String(item.productId || '').trim();
    const owner = map.get(key) || { vendorId: '', vendorName: '' };
    const quantity = Number(item.quantity || 0);
    const price = Number(item.price || 0);
    return {
      ...item,
      productId: key || String(item.productId || ''),
      productName: String(item.productName || item.name || 'Product'),
      quantity,
      price,
      total: Number(item.total ?? price * quantity),
      vendorId: String(item.vendorId || owner.vendorId || ''),
      vendorName: String(item.vendorName || owner.vendorName || ''),
      status: String(item.status || defaultStatus),
    };
  });
}
