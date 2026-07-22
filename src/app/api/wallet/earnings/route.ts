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
          summary: {
            today: 0,
            thisWeek: 0,
            thisMonth: 0,
            thisYear: 0,
            allTime: 0,
          },
        },
        { status: 200 }
      );
    }

    const now = new Date();

    // Calculate different time ranges
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    // Get earnings for each timeframe
    const earningsByTimeframe = await Transaction.aggregate([
      {
        $match: {
          walletId: wallet._id,
          type: 'earning',
          status: 'completed',
        },
      },
      {
        $facet: {
          today: [
            {
              $match: {
                createdAt: { $gte: today, $lte: now },
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: '$amount' },
                count: { $sum: 1 },
              },
            },
          ],
          thisWeek: [
            {
              $match: {
                createdAt: { $gte: weekStart, $lte: now },
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: '$amount' },
                count: { $sum: 1 },
              },
            },
          ],
          thisMonth: [
            {
              $match: {
                createdAt: { $gte: monthStart, $lte: now },
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: '$amount' },
                count: { $sum: 1 },
              },
            },
          ],
          thisYear: [
            {
              $match: {
                createdAt: { $gte: yearStart, $lte: now },
              },
            },
            {
              $group: {
                _id: null,
                total: { $sum: '$amount' },
                count: { $sum: 1 },
              },
            },
          ],
          allTime: [
            {
              $group: {
                _id: null,
                total: { $sum: '$amount' },
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    const result = earningsByTimeframe[0];

    return NextResponse.json(
      {
        message: 'Earnings summary fetched successfully',
        summary: {
          today: result.today.length > 0 ? result.today[0].total : 0,
          thisWeek: result.thisWeek.length > 0 ? result.thisWeek[0].total : 0,
          thisMonth: result.thisMonth.length > 0 ? result.thisMonth[0].total : 0,
          thisYear: result.thisYear.length > 0 ? result.thisYear[0].total : 0,
          allTime: result.allTime.length > 0 ? result.allTime[0].total : 0,
        },
        counts: {
          today: result.today.length > 0 ? result.today[0].count : 0,
          thisWeek: result.thisWeek.length > 0 ? result.thisWeek[0].count : 0,
          thisMonth: result.thisMonth.length > 0 ? result.thisMonth[0].count : 0,
          thisYear: result.thisYear.length > 0 ? result.thisYear[0].count : 0,
          allTime: result.allTime.length > 0 ? result.allTime[0].count : 0,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get earnings error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch earnings' },
      { status: 500 }
    );
  }
}
