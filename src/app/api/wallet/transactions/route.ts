import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Wallet } from '@/lib/models/Wallet';
import { Transaction } from '@/lib/models/Transaction';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const doctorId = request.nextUrl.searchParams.get('doctorId');
    let vendorId = request.nextUrl.searchParams.get('vendorId');
    const userId = request.nextUrl.searchParams.get('userId');
    const timeframe = request.nextUrl.searchParams.get('timeframe') || 'month'; // day, week, month, year
    const transactionType = request.nextUrl.searchParams.get('type'); // Optional: filter by type
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');

    if (vendorId) {
      const { requireVendorAuth, isAuthError } = await import('@/lib/vendorAuth');
      const auth = requireVendorAuth(request);
      if (isAuthError(auth)) return auth;
      vendorId = auth.vendorId;
    }

    if (!userId && !doctorId && !vendorId) {
      return NextResponse.json(
        { error: 'Either userId, doctorId, or vendorId is required' },
        { status: 400 }
      );
    }

    // Find wallet
    const walletQuery: any = {};
    if (userId) walletQuery.userId = userId;
    if (doctorId) walletQuery.doctorId = doctorId;
    if (vendorId) walletQuery.vendorId = vendorId;

    const wallet = await Wallet.findOne(walletQuery);

    if (!wallet) {
      return NextResponse.json(
        {
          message: 'No wallet found',
          transactions: [],
          summary: { totalEarnings: 0, totalWithdrawn: 0, totalCommissionDeducted: 0 },
          pagination: { page, limit, total: 0, pages: 0 },
        },
        { status: 200 }
      );
    }

    // Calculate date range based on timeframe
    const now = new Date();
    let startDate = new Date();

    switch (timeframe) {
      case 'day':
        startDate.setDate(now.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(now.getMonth() - 1);
    }

    // Build transaction query
    const transactionQuery: any = {
      walletId: wallet._id,
      createdAt: { $gte: startDate, $lte: now },
    };

    if (transactionType) {
      transactionQuery.type = transactionType;
    }

    // Get total transactions for pagination
    const total = await Transaction.countDocuments(transactionQuery);
    const pages = Math.ceil(total / limit);

    // Get transactions
    const transactions = await Transaction.find(transactionQuery)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Calculate summary for timeframe
    const summary = await Transaction.aggregate([
      { $match: transactionQuery },
      {
        $group: {
          _id: null,
          totalEarnings: {
            $sum: { $cond: [{ $eq: ['$type', 'earning'] }, '$amount', 0] },
          },
          totalWithdrawn: {
            $sum: { $cond: [{ $eq: ['$type', 'withdrawal'] }, '$amount', 0] },
          },
          totalCommissionDeducted: {
            $sum: { $cond: [{ $eq: ['$type', 'commission_deduction'] }, '$amount', 0] },
          },
        },
      },
    ]);

    const summaryData = summary.length > 0 ? summary[0] : { totalEarnings: 0, totalWithdrawn: 0, totalCommissionDeducted: 0 };

    return NextResponse.json(
      {
        message: 'Transactions fetched successfully',
        transactions: transactions.map((t) => ({
          id: t._id,
          type: t.type,
          amount: t.amount,
          status: t.status,
          description: t.description,
          createdAt: t.createdAt,
          relatedType: t.relatedType,
        })),
        summary: {
          totalEarnings: summaryData.totalEarnings,
          totalWithdrawn: summaryData.totalWithdrawn,
          totalCommissionDeducted: summaryData.totalCommissionDeducted,
        },
        pagination: { page, limit, total, pages },
        timeframe,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get transactions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
