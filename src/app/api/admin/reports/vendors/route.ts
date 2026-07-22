/**
 * GET /api/admin/reports/vendors
 * Marketplace vendor-wise sales / commission / settlement report.
 * format=json|csv
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Vendor } from '@/lib/models/Vendor';
import { Wallet } from '@/lib/models/Wallet';
import { Order } from '@/lib/models/Order';
import { Product } from '@/lib/models/Product';
import { Settlement } from '@/lib/models/Settlement';

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
    const { requireAdminAuth, isAdminAuthError } = await import('@/lib/auth/requireAdminAuth');
    const admin = await requireAdminAuth(request);
    if (isAdminAuthError(admin)) return admin;

    await connectDB();
    const format = (request.nextUrl.searchParams.get('format') || 'json').trim();

    const vendors = await Vendor.find({}).select('vendorName email status commissionPercentage').lean();
    const rows = [];

    let marketplaceGross = 0;
    let marketplaceCommission = 0;
    let marketplacePaid = 0;
    let marketplacePending = 0;

    for (const v of vendors as any[]) {
      const vendorId = String(v._id);
      const products = await Product.find({ vendorId }).select('_id').lean();
      const productIds = products.map((p: any) => String(p._id));
      const orders = await Order.find({
        $or: [
          { 'items.vendorId': vendorId },
          ...(productIds.length ? [{ 'items.productId': { $in: productIds } }] : []),
        ],
        status: { $ne: 'cancelled' },
      }).lean();

      let gross = 0;
      for (const order of orders as any[]) {
        const ownItems = (order.items || []).filter(
          (item: any) =>
            String(item.vendorId || '') === vendorId ||
            productIds.includes(String(item.productId || ''))
        );
        gross += ownItems.reduce(
          (sum: number, item: any) =>
            sum + Number(item.total ?? (Number(item.price || 0) * Number(item.quantity || 0))),
          0
        );
      }

      const wallet = await Wallet.findOne({ vendorId }).lean();
      const commission = Number(wallet?.totalCommissionDeducted || 0);
      const paid = Number(wallet?.totalWithdrawn || 0);
      const pending = Number(wallet?.balance || 0);
      const settlementsCount = await Settlement.countDocuments({ vendorId });

      marketplaceGross += gross;
      marketplaceCommission += commission;
      marketplacePaid += paid;
      marketplacePending += pending;

      rows.push({
        vendorId,
        vendorName: v.vendorName,
        email: v.email,
        status: v.status,
        commissionPercent: v.commissionPercentage ?? 10,
        orderCount: orders.length,
        grossSales: Math.round(gross * 100) / 100,
        commission: Math.round(commission * 100) / 100,
        netEarnings: Math.round(Number(wallet?.totalEarnings || 0) * 100) / 100,
        paidSettlement: Math.round(paid * 100) / 100,
        pendingSettlement: Math.round(pending * 100) / 100,
        settlementsCount,
      });
    }

    const summary = {
      vendors: rows.length,
      marketplaceGross: Math.round(marketplaceGross * 100) / 100,
      marketplaceCommission: Math.round(marketplaceCommission * 100) / 100,
      marketplacePaid: Math.round(marketplacePaid * 100) / 100,
      marketplacePending: Math.round(marketplacePending * 100) / 100,
    };

    if (format === 'csv') {
      return new NextResponse(toCsv(rows), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="marketplace-vendor-report.csv"',
        },
      });
    }

    return NextResponse.json({ summary, rows });
  } catch (error: any) {
    console.error('Admin vendor reports error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to generate report' }, { status: 500 });
  }
}
