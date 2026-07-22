/**
 * GET  /api/admin/bank-details?status=pending|verified|all
 * PUT  /api/admin/bank-details  { bankDetailsId, action: 'approve' | 'reject', adminNotes? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { BankDetails } from '@/lib/models/BankDetails';
import { Vendor } from '@/lib/models/Vendor';
import { requireAdminAuth, isAdminAuthError } from '@/lib/auth/requireAdminAuth';

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdminAuth(request);
    if (isAdminAuthError(admin)) return admin;

    await connectDB();

    const status = request.nextUrl.searchParams.get('status') || 'pending';
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '20', 10)));

    const query: Record<string, unknown> = {
      vendorId: { $exists: true, $ne: null },
    };

    if (status === 'pending') {
      query.isVerified = { $ne: true };
      query.isActive = { $ne: false };
    } else if (status === 'verified') {
      query.isVerified = true;
    } else if (status === 'rejected') {
      query.isActive = false;
      query.isVerified = { $ne: true };
    }
    // status === 'all' → no extra filters

    const total = await BankDetails.countDocuments(query);
    const pages = Math.ceil(total / limit) || 1;

    const rows = await BankDetails.find(query)
      .populate('vendorId', 'vendorName email phone status')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({
      message: 'Bank details fetched successfully',
      bankDetails: rows.map((row: any) => ({
        id: String(row._id),
        accountHolderName: row.accountHolderName,
        bankName: row.bankName,
        accountNumber: row.accountNumber,
        ifscCode: row.ifscCode,
        upiId: row.upiId || '',
        preferredWithdrawalMethod: row.preferredWithdrawalMethod,
        isVerified: !!row.isVerified,
        isActive: row.isActive !== false,
        verifiedAt: row.verifiedAt || null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        vendor: row.vendorId
          ? {
              id: String(row.vendorId._id || row.vendorId),
              vendorName: row.vendorId.vendorName || 'Unknown',
              email: row.vendorId.email || '',
              phone: row.vendorId.phone || '',
              status: row.vendorId.status || '',
            }
          : null,
      })),
      pagination: { page, limit, total, pages },
    });
  } catch (error: any) {
    console.error('Admin get bank details error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch bank details' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdminAuth(request);
    if (isAdminAuthError(admin)) return admin;

    await connectDB();

    const body = await request.json();
    const { bankDetailsId, action, adminNotes } = body as {
      bankDetailsId?: string;
      action?: string;
      adminNotes?: string;
    };

    if (!bankDetailsId || !action) {
      return NextResponse.json(
        { error: 'bankDetailsId and action are required' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be approve or reject' },
        { status: 400 }
      );
    }

    const bankDetails = await BankDetails.findById(bankDetailsId);
    if (!bankDetails) {
      return NextResponse.json({ error: 'Bank details not found' }, { status: 404 });
    }

    if (!bankDetails.vendorId) {
      return NextResponse.json(
        { error: 'Only vendor bank details can be verified here' },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      bankDetails.isVerified = true;
      bankDetails.verifiedAt = new Date();
      bankDetails.isActive = true;
      await bankDetails.save();

      // Keep Vendor document in sync for settlements / payouts
      await Vendor.findByIdAndUpdate(bankDetails.vendorId, {
        accountHolderName: bankDetails.accountHolderName,
        bankName: bankDetails.bankName,
        accountNumber: bankDetails.accountNumber,
        ifscCode: bankDetails.ifscCode,
      });

      return NextResponse.json({
        message: 'Bank details verified successfully',
        bankDetails: {
          id: bankDetails._id,
          isVerified: true,
          verifiedAt: bankDetails.verifiedAt,
        },
      });
    }

    // reject
    bankDetails.isVerified = false;
    bankDetails.verifiedAt = undefined;
    bankDetails.isActive = false;
    if (adminNotes) {
      bankDetails.verificationDocument = `Rejected: ${adminNotes}`;
    }
    await bankDetails.save();

    return NextResponse.json({
      message: 'Bank details rejected',
      bankDetails: {
        id: bankDetails._id,
        isVerified: false,
        isActive: false,
      },
    });
  } catch (error: any) {
    console.error('Admin update bank details error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update bank details' },
      { status: 500 }
    );
  }
}
