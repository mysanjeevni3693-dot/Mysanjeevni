/**
 * GET /api/vendor/settlements
 * Authenticated vendor — lists their settlement (payout) history.
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Settlement } from '@/lib/models/Settlement';
import { Wallet } from '@/lib/models/Wallet';
import { requireVendorAuth, isAuthError } from '@/lib/vendorAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = requireVendorAuth(request);
    if (isAuthError(auth)) return auth;

    await connectDB();

    const settlements = await Settlement.find({ vendorId: auth.vendorId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const wallet = await Wallet.findOne({ vendorId: auth.vendorId }).lean();

    return NextResponse.json({
      settlements,
      summary: {
        walletBalance: Number(wallet?.balance || 0),
        totalEarnings: Number(wallet?.totalEarnings || 0),
        totalWithdrawn: Number(wallet?.totalWithdrawn || 0),
        totalCommissionDeducted: Number(wallet?.totalCommissionDeducted || 0),
        pendingSettlement: Number(wallet?.balance || 0),
        paidSettlement: Number(wallet?.totalWithdrawn || 0),
      },
    });
  } catch (error: any) {
    console.error('Vendor settlements error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to load settlements' }, { status: 500 });
  }
}
