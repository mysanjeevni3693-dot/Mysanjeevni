/**
 * GET /api/vendor/dashboard/stats
 *
 * Authenticated vendor-only. Returns marketplace dashboard metrics computed
 * from the database (orders, products, wallet, reviews) — never localStorage.
 */

import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { Order } from '@/lib/models/Order';
import { Product } from '@/lib/models/Product';
import { Wallet } from '@/lib/models/Wallet';
import { Review } from '@/lib/models/Review';
import { Vendor } from '@/lib/models/Vendor';
import { requireVendorAuth, isAuthError } from '@/lib/vendorAuth';

export const dynamic = 'force-dynamic';

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireVendorAuth(request);
    if (isAuthError(auth)) return auth;

    await connectDB();
    const vendorId = auth.vendorId;

    const vendor = await Vendor.findById(vendorId).select('-password').lean();
    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const products = await Product.find({ vendorId }).select('_id stock price approvalStatus isActive name').lean();
    const productIds = products.map((p: any) => String(p._id));

    const productCount = products.length;
    const lowStockProducts = products.filter((p: any) => Number(p.stock) > 0 && Number(p.stock) <= 10);
    const outOfStockProducts = products.filter((p: any) => Number(p.stock) <= 0);
    const pendingApprovalProducts = products.filter((p: any) => p.approvalStatus === 'pending').length;
    const activeProducts = products.filter((p: any) => p.isActive && p.approvalStatus === 'approved').length;

    // Orders containing this vendor's products (stamped vendorId or legacy product ownership).
    const orders = await Order.find({
      $or: [
        { 'items.vendorId': vendorId },
        ...(productIds.length ? [{ 'items.productId': { $in: productIds } }] : []),
      ],
    })
      .sort({ createdAt: -1 })
      .populate('userId', 'fullName email phone')
      .lean();

    const statusCounts: Record<string, number> = {
      pending: 0,
      confirmed: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      returned: 0,
      refunded: 0,
    };

    let totalSales = 0;
    let totalRevenue = 0;
    const monthlyMap = new Map<string, { sales: number; orders: number }>();

    // Last 6 calendar months keys (for chart).
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyMap.set(monthKey(d), { sales: 0, orders: 0 });
    }

    const recentOrders = orders.slice(0, 10).map((order: any) => {
      const ownItems = (order.items || []).filter(
        (item: any) =>
          String(item.vendorId || '') === String(vendorId) ||
          productIds.includes(String(item.productId || ''))
      );
      const vendorSubtotal = ownItems.reduce(
        (sum: number, item: any) => sum + Number(item.total ?? (Number(item.price || 0) * Number(item.quantity || 0))),
        0
      );
      return {
        _id: String(order._id),
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        customerName: order.userId?.fullName || 'Customer',
        customerEmail: order.userId?.email || '',
        itemCount: ownItems.length,
        vendorAmount: vendorSubtotal,
        items: ownItems.map((i: any) => ({
          productName: i.productName || i.name,
          quantity: i.quantity,
          price: i.price,
        })),
      };
    });

    for (const order of orders as any[]) {
      const status = String(order.status || 'pending').toLowerCase();
      if (status in statusCounts) statusCounts[status] += 1;
      if (String(order.paymentStatus || '').toLowerCase() === 'refunded') {
        statusCounts.refunded += 1;
      }

      const ownItems = (order.items || []).filter(
        (item: any) =>
          String(item.vendorId || '') === String(vendorId) ||
          productIds.includes(String(item.productId || ''))
      );
      const vendorSubtotal = ownItems.reduce(
        (sum: number, item: any) => sum + Number(item.total ?? (Number(item.price || 0) * Number(item.quantity || 0))),
        0
      );

      if (status !== 'cancelled') {
        totalSales += 1;
        totalRevenue += vendorSubtotal;
      }

      const created = order.createdAt ? new Date(order.createdAt) : null;
      if (created) {
        const key = monthKey(created);
        if (monthlyMap.has(key) && status !== 'cancelled') {
          const entry = monthlyMap.get(key)!;
          entry.sales += vendorSubtotal;
          entry.orders += 1;
        }
      }
    }

    const wallet = await Wallet.findOne({ vendorId });
    const commissionPct = Number((vendor as any).commissionPercentage ?? 10);
    const estimatedCommission = (totalRevenue * commissionPct) / 100;
    const estimatedNet = Math.max(totalRevenue - estimatedCommission, 0);

    // Reviews on this vendor's products.
    let reviews: any[] = [];
    if (productIds.length) {
      const objectIds = productIds.filter((id) => mongoose.isValidObjectId(id));
      const numericIds = productIds
        .map((id) => Number(id))
        .filter((n) => !Number.isNaN(n));

      reviews = await Review.find({
        productId: { $in: [...objectIds, ...numericIds, ...productIds] },
      })
        .sort({ createdAt: -1 })
        .limit(8)
        .lean();
    }

    const monthlyEarnings = Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      sales: Math.round(data.sales * 100) / 100,
      orders: data.orders,
    }));

    return NextResponse.json({
      message: 'Dashboard stats loaded',
      stats: {
        verificationStatus: (vendor as any).status,
        isActive: (vendor as any).isActive !== false,
        rating: (vendor as any).rating || 0,
        commissionPercentage: commissionPct,
        productCount,
        activeProducts,
        pendingApprovalProducts,
        lowStockCount: lowStockProducts.length,
        outOfStockCount: outOfStockProducts.length,
        lowStockProducts: lowStockProducts.slice(0, 5).map((p: any) => ({
          _id: String(p._id),
          name: p.name,
          stock: p.stock,
        })),
        outOfStockProducts: outOfStockProducts.slice(0, 5).map((p: any) => ({
          _id: String(p._id),
          name: p.name,
          stock: p.stock,
        })),
        totalOrders: orders.length,
        totalSales,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        estimatedCommission: Math.round(estimatedCommission * 100) / 100,
        estimatedNetEarnings: Math.round(estimatedNet * 100) / 100,
        orderStatusCounts: statusCounts,
        wallet: {
          balance: Number(wallet?.balance || 0),
          totalEarnings: Number(wallet?.totalEarnings || 0),
          totalWithdrawn: Number(wallet?.totalWithdrawn || 0),
          // Until the settlement engine (Phase 3) runs, wallet balance is the
          // amount available / pending payout; withdrawn is already paid.
          pendingSettlement: Number(wallet?.balance || 0),
          paidSettlement: Number(wallet?.totalWithdrawn || 0),
        },
        monthlyEarnings,
        recentOrders,
        recentReviews: reviews.map((r: any) => ({
          _id: String(r._id),
          productId: String(r.productId),
          rating: r.rating,
          title: r.title || '',
          comment: r.comment || '',
          userName: r.userName || 'Customer',
          createdAt: r.createdAt,
        })),
      },
    });
  } catch (error: any) {
    console.error('Vendor dashboard stats error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to load dashboard stats' },
      { status: 500 }
    );
  }
}
