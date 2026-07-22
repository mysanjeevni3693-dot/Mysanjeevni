/**
 * Admin vendor settlement APIs.
 *
 * GET  /api/admin/settlements?vendorId=   — list settlements + payable summary
 * POST /api/admin/settlements            — record a manual payout to a vendor
 */

import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { Vendor } from '@/lib/models/Vendor';
import { Wallet } from '@/lib/models/Wallet';
import { Transaction } from '@/lib/models/Transaction';
import { Settlement } from '@/lib/models/Settlement';
import { Order } from '@/lib/models/Order';
import { Product } from '@/lib/models/Product';

export const dynamic = 'force-dynamic';

async function buildVendorPayableSummary(vendorId: string) {
  const wallet = (await Wallet.findOne({ vendorId })) || {
    balance: 0,
    totalEarnings: 0,
    totalWithdrawn: 0,
    totalCommissionDeducted: 0,
  };

  const products = await Product.find({ vendorId }).select('_id').lean();
  const productIds = products.map((p: any) => String(p._id));

  const orders = await Order.find({
    $or: [
      { 'items.vendorId': vendorId },
      ...(productIds.length ? [{ 'items.productId': { $in: productIds } }] : []),
    ],
    status: { $ne: 'cancelled' },
  }).lean();

  let grossSales = 0;
  for (const order of orders as any[]) {
    const ownItems = (order.items || []).filter(
      (item: any) =>
        String(item.vendorId || '') === String(vendorId) ||
        productIds.includes(String(item.productId || ''))
    );
    grossSales += ownItems.reduce(
      (sum: number, item: any) => sum + Number(item.total ?? (Number(item.price || 0) * Number(item.quantity || 0))),
      0
    );
  }

  const commission = Number(wallet.totalCommissionDeducted || 0);
  const netPayable = Number(wallet.balance || 0);
  const alreadyPaid = Number(wallet.totalWithdrawn || 0);
  const netEarnings = Number(wallet.totalEarnings || 0);

  return {
    grossSales: Math.round(grossSales * 100) / 100,
    commission: Math.round(commission * 100) / 100,
    netEarnings: Math.round(netEarnings * 100) / 100,
    alreadyPaid: Math.round(alreadyPaid * 100) / 100,
    remainingBalance: Math.round(netPayable * 100) / 100,
    walletBalance: Math.round(Number(wallet.balance || 0) * 100) / 100,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { requireAdminAuth, isAdminAuthError } = await import('@/lib/auth/requireAdminAuth');
    const admin = await requireAdminAuth(request);
    if (isAdminAuthError(admin)) return admin;

    await connectDB();

    const vendorId = request.nextUrl.searchParams.get('vendorId');
    const all = request.nextUrl.searchParams.get('all') === 'true';

    if (all) {
      // Marketplace-wide settlement overview.
      const vendors = await Vendor.find({ status: { $in: ['verified', 'suspended'] } })
        .select('vendorName email status commissionPercentage')
        .lean();

      const rows = [];
      for (const v of vendors) {
        const summary = await buildVendorPayableSummary(String(v._id));
        rows.push({
          vendorId: String(v._id),
          vendorName: v.vendorName,
          email: v.email,
          status: v.status,
          ...summary,
        });
      }

      const totals = rows.reduce(
        (acc, r) => {
          acc.grossSales += r.grossSales;
          acc.commission += r.commission;
          acc.remainingBalance += r.remainingBalance;
          acc.alreadyPaid += r.alreadyPaid;
          return acc;
        },
        { grossSales: 0, commission: 0, remainingBalance: 0, alreadyPaid: 0 }
      );

      return NextResponse.json({ vendors: rows, totals });
    }

    if (!vendorId || !mongoose.isValidObjectId(vendorId)) {
      return NextResponse.json({ error: 'Valid vendorId is required (or all=true)' }, { status: 400 });
    }

    const vendor = await Vendor.findById(vendorId).select('-password').lean();
    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const summary = await buildVendorPayableSummary(vendorId);
    const settlements = await Settlement.find({ vendorId }).sort({ createdAt: -1 }).limit(50).lean();

    return NextResponse.json({
      vendor: {
        _id: vendor._id,
        vendorName: (vendor as any).vendorName,
        email: (vendor as any).email,
        status: (vendor as any).status,
        commissionPercentage: (vendor as any).commissionPercentage,
      },
      summary,
      settlements,
    });
  } catch (error: any) {
    console.error('Get settlements error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to load settlements' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { requireAdminAuth, isAdminAuthError } = await import('@/lib/auth/requireAdminAuth');
    const admin = await requireAdminAuth(request);
    if (isAdminAuthError(admin)) return admin;

    await connectDB();

    const body = await request.json();
    const {
      vendorId,
      amount,
      paymentMethod = 'bank_transfer',
      transactionId = '',
      referenceNumber = '',
      notes = '',
    } = body;

    if (!vendorId || !mongoose.isValidObjectId(vendorId)) {
      return NextResponse.json({ error: 'Valid vendorId is required' }, { status: 400 });
    }

    const payAmount = Number(amount);
    if (!payAmount || payAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    let wallet = await Wallet.findOne({ vendorId });
    if (!wallet) {
      wallet = await Wallet.create({ vendorId });
    }

    if (Number(wallet.balance || 0) < payAmount) {
      return NextResponse.json(
        {
          error: `Insufficient wallet balance. Available: ₹${Number(wallet.balance || 0).toFixed(2)}`,
        },
        { status: 400 }
      );
    }

    const balanceBefore = Number(wallet.balance || 0);
    wallet.balance = balanceBefore - payAmount;
    wallet.totalWithdrawn = Number(wallet.totalWithdrawn || 0) + payAmount;
    await wallet.save();

    const summary = await buildVendorPayableSummary(vendorId);

    const settlement = await Settlement.create({
      vendorId,
      amount: payAmount,
      paymentMethod,
      transactionId: String(transactionId || '').trim(),
      referenceNumber: String(referenceNumber || '').trim(),
      notes: String(notes || '').trim(),
      status: 'paid',
      paidAt: new Date(),
      recordedBy: 'admin',
      snapshot: {
        grossSales: summary.grossSales,
        commission: summary.commission,
        walletBalanceBefore: balanceBefore,
        walletBalanceAfter: Number(wallet.balance),
      },
    });

    await Transaction.create({
      walletId: wallet._id,
      vendorId,
      type: 'settlement',
      amount: payAmount,
      status: 'completed',
      description: `Settlement paid via ${paymentMethod}${transactionId ? ` (txn ${transactionId})` : ''}`,
      relatedId: settlement._id,
      relatedType: 'settlement',
      metadata: {
        paymentMethod: String(paymentMethod),
        transactionId: String(transactionId || ''),
        referenceNumber: String(referenceNumber || ''),
      },
    });

    try {
      const { notifyVendor } = await import('@/lib/vendorNotifications');
      await notifyVendor({
        vendorId,
        type: 'settlement_paid',
        title: 'Settlement paid',
        message: `₹${payAmount.toFixed(2)} settled via ${paymentMethod}${transactionId ? ` (${transactionId})` : ''}`,
        relatedId: String(settlement._id),
        actionUrl: '/vendor/wallet',
      });
    } catch {
      // non-fatal
    }

    return NextResponse.json(
      {
        message: 'Settlement recorded successfully',
        settlement,
        summary: await buildVendorPayableSummary(vendorId),
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create settlement error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to record settlement' }, { status: 500 });
  }
}
