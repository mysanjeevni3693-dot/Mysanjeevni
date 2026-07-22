/**
 * GET /api/vendor/reports
 *
 * Query params:
 *  - type: sales | products | returns | settlements | best-selling
 *  - from / to: ISO date strings (optional)
 *  - format: json | csv (default json)
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Order } from '@/lib/models/Order';
import { Product } from '@/lib/models/Product';
import { ReturnRequest } from '@/lib/models/ReturnRequest';
import { Settlement } from '@/lib/models/Settlement';
import { requireVendorAuth, isAuthError } from '@/lib/vendorAuth';

export const dynamic = 'force-dynamic';

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireVendorAuth(request);
    if (isAuthError(auth)) return auth;

    await connectDB();
    const vendorId = auth.vendorId;
    const type = (request.nextUrl.searchParams.get('type') || 'sales').trim();
    const format = (request.nextUrl.searchParams.get('format') || 'json').trim();
    const from = request.nextUrl.searchParams.get('from');
    const to = request.nextUrl.searchParams.get('to');

    const dateFilter: any = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to) dateFilter.$lte = new Date(to);
    const hasDate = Object.keys(dateFilter).length > 0;

    const products = await Product.find({ vendorId }).select('_id name stock price approvalStatus').lean();
    const productIds = products.map((p: any) => String(p._id));

    let rows: Record<string, unknown>[] = [];
    let summary: Record<string, unknown> = {};

    if (type === 'sales' || type === 'best-selling') {
      const orderQuery: any = {
        $or: [
          { 'items.vendorId': vendorId },
          ...(productIds.length ? [{ 'items.productId': { $in: productIds } }] : []),
        ],
      };
      if (hasDate) orderQuery.createdAt = dateFilter;

      const orders = await Order.find(orderQuery).sort({ createdAt: -1 }).lean();
      const productSales = new Map<string, { name: string; qty: number; revenue: number }>();

      rows = orders.map((order: any) => {
        const ownItems = (order.items || []).filter(
          (item: any) =>
            String(item.vendorId || '') === vendorId ||
            productIds.includes(String(item.productId || ''))
        );
        const amount = ownItems.reduce(
          (sum: number, item: any) => sum + Number(item.total ?? (Number(item.price || 0) * Number(item.quantity || 0))),
          0
        );
        for (const item of ownItems) {
          const key = String(item.productId || item.productName || 'unknown');
          const prev = productSales.get(key) || {
            name: item.productName || item.name || key,
            qty: 0,
            revenue: 0,
          };
          prev.qty += Number(item.quantity || 0);
          prev.revenue += Number(item.total ?? (Number(item.price || 0) * Number(item.quantity || 0)));
          productSales.set(key, prev);
        }
        return {
          orderId: String(order._id),
          date: order.createdAt ? new Date(order.createdAt).toISOString() : '',
          status: order.status,
          paymentStatus: order.paymentStatus,
          items: ownItems.length,
          amount: Math.round(amount * 100) / 100,
        };
      });

      summary = {
        totalOrders: rows.length,
        totalRevenue: rows.reduce((s, r) => s + Number(r.amount || 0), 0),
      };

      if (type === 'best-selling') {
        rows = Array.from(productSales.entries())
          .map(([productId, v]) => ({
            productId,
            productName: v.name,
            quantitySold: v.qty,
            revenue: Math.round(v.revenue * 100) / 100,
          }))
          .sort((a, b) => Number(b.quantitySold) - Number(a.quantitySold));
        summary = { products: rows.length };
      }
    } else if (type === 'products') {
      rows = products.map((p: any) => ({
        productId: String(p._id),
        name: p.name,
        price: p.price,
        stock: p.stock,
        approvalStatus: p.approvalStatus,
      }));
      summary = {
        total: products.length,
        lowStock: products.filter((p: any) => p.stock > 0 && p.stock <= 10).length,
        outOfStock: products.filter((p: any) => p.stock <= 0).length,
      };
    } else if (type === 'returns') {
      const q: any = {
        $or: [
          { vendorId },
          ...(productIds.length ? [{ productId: { $in: productIds } }] : []),
        ],
      };
      if (hasDate) q.createdAt = dateFilter;
      const returns = await ReturnRequest.find(q).sort({ createdAt: -1 }).lean();
      rows = returns.map((r: any) => ({
        returnId: String(r._id),
        orderId: r.orderId,
        productName: r.productName,
        status: r.status,
        reason: r.reason,
        preferredResolution: r.preferredResolution,
        date: r.createdAt ? new Date(r.createdAt).toISOString() : '',
      }));
      summary = { total: rows.length };
    } else if (type === 'settlements') {
      const q: any = { vendorId };
      if (hasDate) q.createdAt = dateFilter;
      const settlements = await Settlement.find(q).sort({ createdAt: -1 }).lean();
      rows = settlements.map((s: any) => ({
        settlementId: String(s._id),
        amount: s.amount,
        paymentMethod: s.paymentMethod,
        transactionId: s.transactionId || '',
        status: s.status,
        date: s.paidAt || s.createdAt ? new Date(s.paidAt || s.createdAt).toISOString() : '',
      }));
      summary = {
        total: rows.length,
        totalPaid: rows.reduce((sum, r) => sum + Number(r.amount || 0), 0),
      };
    } else {
      return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
    }

    if (format === 'csv') {
      const csv = toCsv(rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="vendor-${type}-report.csv"`,
        },
      });
    }

    return NextResponse.json({ type, summary, rows, total: rows.length });
  } catch (error: any) {
    console.error('Vendor reports error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to generate report' }, { status: 500 });
  }
}
