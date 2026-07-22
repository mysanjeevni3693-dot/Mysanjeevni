import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { ReturnRequest } from '@/lib/models/ReturnRequest';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const userId = request.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const requests = await ReturnRequest.find({ userId }).sort({ createdAt: -1 }).lean();

    return NextResponse.json({ requests }, { status: 200 });
  } catch (error: any) {
    console.error('Fetch return requests error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch return requests' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { userId, userName, userEmail, orderId, productName, reason, preferredResolution } = body;

    if (!userId || !userName || !userEmail) {
      return NextResponse.json({ error: 'User information is required' }, { status: 400 });
    }

    if (!orderId || !productName || !reason) {
      return NextResponse.json(
        { error: 'Order ID, product name, and reason are required' },
        { status: 400 }
      );
    }

    const requestRecord = await ReturnRequest.create({
      userId,
      userName: String(userName).trim(),
      userEmail: String(userEmail).trim().toLowerCase(),
      orderId: String(orderId).trim(),
      productName: String(productName).trim(),
      productId: body.productId ? String(body.productId).trim() : '',
      vendorId: '',
      reason: String(reason).trim(),
      preferredResolution: preferredResolution || 'support-review',
    });

    // Stamp vendorId from product or order line item when possible.
    try {
      const { Product } = await import('@/lib/models/Product');
      const { Order } = await import('@/lib/models/Order');
      let vendorId = '';
      if (body.productId) {
        const product = await Product.findById(body.productId).select('vendorId');
        if (product?.vendorId) vendorId = String(product.vendorId);
      }
      if (!vendorId && productName) {
        const product = await Product.findOne({ name: productName }).select('vendorId');
        if (product?.vendorId) vendorId = String(product.vendorId);
      }
      if (!vendorId && orderId) {
        const order = await Order.findById(orderId).select('items');
        const match = (order?.items || []).find(
          (i: any) =>
            String(i.productName || '').toLowerCase() === String(productName).toLowerCase() ||
            (body.productId && String(i.productId) === String(body.productId))
        );
        if (match?.vendorId) vendorId = String(match.vendorId);
      }
      if (vendorId) {
        requestRecord.vendorId = vendorId;
        await requestRecord.save();
        const { notifyVendor } = await import('@/lib/vendorNotifications');
        await notifyVendor({
          vendorId,
          type: preferredResolution === 'refund' ? 'refund_request' : 'return_request',
          title: preferredResolution === 'refund' ? 'New refund request' : 'New return request',
          message: `${productName} — ${String(reason).slice(0, 120)}`,
          relatedId: String(requestRecord._id),
          actionUrl: '/vendor/dashboard/returns',
        });
      }
    } catch (e) {
      console.error('Return vendor stamp/notify failed (non-fatal):', e);
    }

    return NextResponse.json(
      {
        message: 'Return request submitted successfully',
        request: requestRecord,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create return request error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit return request' },
      { status: 500 }
    );
  }
}