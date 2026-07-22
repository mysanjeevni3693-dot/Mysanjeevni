import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { WithdrawalRequest } from '@/lib/models/WithdrawalRequest';
import { Wallet } from '@/lib/models/Wallet';
import { BankDetails } from '@/lib/models/BankDetails';
import { requireVendorAuth, isAuthError } from '@/lib/vendorAuth';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    let { doctorId, vendorId, userId, amount, withdrawalMethod } = body;

    // Vendor withdrawals must use JWT; never trust client vendorId alone.
    if (vendorId) {
      const auth = requireVendorAuth(request);
      if (isAuthError(auth)) return auth;
      vendorId = auth.vendorId;
      doctorId = undefined;
      userId = undefined;
    }

    if (!userId && !doctorId && !vendorId) {
      return NextResponse.json(
        { error: 'Either userId, doctorId, or vendorId is required' },
        { status: 400 }
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Valid amount is required' },
        { status: 400 }
      );
    }

    if (!withdrawalMethod) {
      return NextResponse.json(
        { error: 'Withdrawal method is required' },
        { status: 400 }
      );
    }

    const walletQuery: any = {};
    if (userId) walletQuery.userId = userId;
    if (doctorId) walletQuery.doctorId = doctorId;
    if (vendorId) walletQuery.vendorId = vendorId;

    const wallet = await Wallet.findOne(walletQuery);

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    if (wallet.balance < amount) {
      return NextResponse.json(
        { error: 'Insufficient balance for withdrawal' },
        { status: 400 }
      );
    }

    const bankDetails = await BankDetails.findOne(walletQuery);

    if (!bankDetails || !bankDetails.isActive) {
      return NextResponse.json(
        { error: 'Bank details not found or inactive' },
        { status: 404 }
      );
    }

    const withdrawalRequest = await WithdrawalRequest.create({
      walletId: wallet._id,
      userId: userId || undefined,
      doctorId: doctorId || undefined,
      vendorId: vendorId || undefined,
      bankDetailsId: bankDetails._id,
      amount,
      withdrawalMethod,
      status: 'pending',
    });

    return NextResponse.json(
      {
        message: 'Withdrawal request submitted successfully',
        withdrawalRequest: {
          id: withdrawalRequest._id,
          amount: withdrawalRequest.amount,
          status: withdrawalRequest.status,
          withdrawalMethod: withdrawalRequest.withdrawalMethod,
          bankAccount: {
            accountNumber: bankDetails.accountNumber
              .slice(-4)
              .padStart(bankDetails.accountNumber.length, '*'),
            bankName: bankDetails.bankName,
          },
          requestedAt: withdrawalRequest.requestedAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create withdrawal request error:', error);
    return NextResponse.json(
      { error: 'Failed to create withdrawal request' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const doctorId = request.nextUrl.searchParams.get('doctorId');
    let vendorId = request.nextUrl.searchParams.get('vendorId');
    const userId = request.nextUrl.searchParams.get('userId');
    const status = request.nextUrl.searchParams.get('status');
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '10');

    if (vendorId) {
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

    const walletQuery: any = {};
    if (userId) walletQuery.userId = userId;
    if (doctorId) walletQuery.doctorId = doctorId;
    if (vendorId) walletQuery.vendorId = vendorId;

    const wallet = await Wallet.findOne(walletQuery);

    if (!wallet) {
      return NextResponse.json(
        {
          message: 'No withdrawal requests found',
          requests: [],
          pagination: { page, limit, total: 0, pages: 0 },
        },
        { status: 200 }
      );
    }

    const withdrawalQuery: any = { walletId: wallet._id };
    if (status) withdrawalQuery.status = status;

    const total = await WithdrawalRequest.countDocuments(withdrawalQuery);
    const pages = Math.ceil(total / limit);

    const withdrawalRequests = await WithdrawalRequest.find(withdrawalQuery)
      .populate('bankDetailsId', 'bankName accountNumber')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    return NextResponse.json(
      {
        message: 'Withdrawal requests fetched successfully',
        requests: withdrawalRequests.map((wr) => ({
          id: wr._id,
          amount: wr.amount,
          status: wr.status,
          withdrawalMethod: wr.withdrawalMethod,
          bankAccount: {
            bankName: wr.bankDetailsId?.bankName,
            accountNumber: wr.bankDetailsId?.accountNumber.slice(-4).padStart(8, '*'),
          },
          requestedAt: wr.requestedAt,
          approvedAt: wr.approvedAt,
          completedAt: wr.completedAt,
          failureReason: wr.failureReason,
        })),
        pagination: { page, limit, total, pages },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get withdrawal requests error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch withdrawal requests' },
      { status: 500 }
    );
  }
}
