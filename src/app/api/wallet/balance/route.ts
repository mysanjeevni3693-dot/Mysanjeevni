import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Wallet } from '@/lib/models/Wallet';
import { Transaction } from '@/lib/models/Transaction';
import { Doctor } from '@/lib/models/Doctor';
import { Vendor } from '@/lib/models/Vendor';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const userId = request.nextUrl.searchParams.get('userId');
    const doctorId = request.nextUrl.searchParams.get('doctorId');
    let vendorId = request.nextUrl.searchParams.get('vendorId');

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

    // Build query
    const query: any = {};
    if (userId) query.userId = userId;
    if (doctorId) query.doctorId = doctorId;
    if (vendorId) query.vendorId = vendorId;

    // Get or create wallet
    let wallet = await Wallet.findOne(query);

    if (!wallet) {
      wallet = await Wallet.create(query);
    }

    // Get recent transactions (last 10)
    const recentTransactions = await Transaction.find({ walletId: wallet._id })
      .sort({ createdAt: -1 })
      .limit(10);

    // Get role info for dashboard
    let roleInfo: any = {};
    if (doctorId) {
      const doctor = await Doctor.findById(doctorId);
      roleInfo = {
        role: 'doctor',
        name: doctor?.name,
        avatar: doctor?.avatar,
      };
    } else if (vendorId) {
      const vendor = await Vendor.findById(vendorId);
      roleInfo = {
        role: 'vendor',
        name: vendor?.vendorName,
        avatar: vendor?.logo,
      };
    }

    return NextResponse.json(
      {
        message: 'Wallet details fetched successfully',
        wallet: {
          id: wallet._id,
          balance: wallet.balance,
          totalEarnings: wallet.totalEarnings,
          totalWithdrawn: wallet.totalWithdrawn,
          totalCommissionDeducted: wallet.totalCommissionDeducted,
          createdAt: wallet.createdAt,
        },
        recentTransactions: recentTransactions.map((t) => ({
          id: t._id,
          type: t.type,
          amount: t.amount,
          status: t.status,
          description: t.description,
          createdAt: t.createdAt,
        })),
        roleInfo,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get wallet error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet details' },
      { status: 500 }
    );
  }
}
