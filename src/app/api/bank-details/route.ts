import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { BankDetails } from '@/lib/models/BankDetails';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const doctorId = request.nextUrl.searchParams.get('doctorId');
    let vendorId = request.nextUrl.searchParams.get('vendorId');
    const userId = request.nextUrl.searchParams.get('userId');

    // Vendor-scoped bank details require authenticated vendor JWT.
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

    const query: any = {};
    if (userId) query.userId = userId;
    if (doctorId) query.doctorId = doctorId;
    if (vendorId) query.vendorId = vendorId;

    const bankDetails = await BankDetails.findOne(query);

    if (!bankDetails) {
      return NextResponse.json(
        {
          message: 'No bank details found',
          bankDetails: null,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        message: 'Bank details fetched successfully',
        bankDetails: {
          id: bankDetails._id,
          accountHolderName: bankDetails.accountHolderName,
          bankName: bankDetails.bankName,
          accountNumber: bankDetails.accountNumber,
          ifscCode: bankDetails.ifscCode,
          upiId: bankDetails.upiId,
          preferredWithdrawalMethod: bankDetails.preferredWithdrawalMethod,
          isVerified: bankDetails.isVerified,
          isActive: bankDetails.isActive,
          createdAt: bankDetails.createdAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get bank details error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bank details' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    let {
      doctorId,
      vendorId,
      userId,
      accountHolderName,
      bankName,
      accountNumber,
      ifscCode,
      upiId,
      preferredWithdrawalMethod,
    } = body;

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

    if (!accountHolderName || !bankName || !accountNumber || !ifscCode) {
      return NextResponse.json(
        { error: 'All required fields must be provided' },
        { status: 400 }
      );
    }

    // Check if bank details already exist
    const query: any = {};
    if (userId) query.userId = userId;
    if (doctorId) query.doctorId = doctorId;
    if (vendorId) query.vendorId = vendorId;

    const existingBankDetails = await BankDetails.findOne(query);

    if (existingBankDetails) {
      return NextResponse.json(
        { error: 'Bank details already exist for this user' },
        { status: 400 }
      );
    }

    // Create new bank details
    const newBankDetails = await BankDetails.create({
      userId: userId || undefined,
      doctorId: doctorId || undefined,
      vendorId: vendorId || undefined,
      accountHolderName,
      bankName,
      accountNumber,
      ifscCode: ifscCode.toUpperCase(),
      upiId: upiId?.toLowerCase() || '',
      preferredWithdrawalMethod: preferredWithdrawalMethod || 'bank_transfer',
      isActive: true,
    });

    return NextResponse.json(
      {
        message: 'Bank details saved successfully',
        bankDetails: {
          id: newBankDetails._id,
          accountHolderName: newBankDetails.accountHolderName,
          bankName: newBankDetails.bankName,
          accountNumber: newBankDetails.accountNumber,
          ifscCode: newBankDetails.ifscCode,
          upiId: newBankDetails.upiId,
          preferredWithdrawalMethod: newBankDetails.preferredWithdrawalMethod,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create bank details error:', error);
    return NextResponse.json(
      { error: 'Failed to save bank details' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const {
      bankDetailsId,
      accountHolderName,
      bankName,
      accountNumber,
      ifscCode,
      upiId,
      preferredWithdrawalMethod,
    } = body;

    if (!bankDetailsId) {
      return NextResponse.json(
        { error: 'Bank details ID is required' },
        { status: 400 }
      );
    }

    const bankDetails = await BankDetails.findById(bankDetailsId);

    if (!bankDetails) {
      return NextResponse.json(
        { error: 'Bank details not found' },
        { status: 404 }
      );
    }

    // Vendor-owned bank details require JWT ownership check.
    if (bankDetails.vendorId) {
      const { requireVendorAuth, isAuthError } = await import('@/lib/vendorAuth');
      const auth = requireVendorAuth(request);
      if (isAuthError(auth)) return auth;
      if (String(bankDetails.vendorId) !== String(auth.vendorId)) {
        return NextResponse.json({ error: 'Not authorized to update these bank details' }, { status: 403 });
      }
    }

    // Update fields
    if (accountHolderName) bankDetails.accountHolderName = accountHolderName;
    if (bankName) bankDetails.bankName = bankName;
    if (accountNumber) bankDetails.accountNumber = accountNumber;
    if (ifscCode) bankDetails.ifscCode = ifscCode.toUpperCase();
    if (upiId) bankDetails.upiId = upiId.toLowerCase();
    if (preferredWithdrawalMethod) bankDetails.preferredWithdrawalMethod = preferredWithdrawalMethod;

    // Reset verification when bank details are updated
    bankDetails.isVerified = false;
    bankDetails.verifiedAt = undefined;

    await bankDetails.save();

    return NextResponse.json(
      {
        message: 'Bank details updated successfully',
        bankDetails: {
          id: bankDetails._id,
          accountHolderName: bankDetails.accountHolderName,
          bankName: bankDetails.bankName,
          accountNumber: bankDetails.accountNumber,
          ifscCode: bankDetails.ifscCode,
          upiId: bankDetails.upiId,
          preferredWithdrawalMethod: bankDetails.preferredWithdrawalMethod,
          isVerified: bankDetails.isVerified,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Update bank details error:', error);
    return NextResponse.json(
      { error: 'Failed to update bank details' },
      { status: 500 }
    );
  }
}
