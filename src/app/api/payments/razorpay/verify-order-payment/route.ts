import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Order } from '@/lib/models/Order';

const keySecret = process.env.RAZORPAY_KEY_SECRET;

/**
 * POST /api/payments/razorpay/verify-order-payment
 * Verifies payment for an order
 * Request body: {
 *   razorpay_order_id: string,
 *   razorpay_payment_id: string,
 *   razorpay_signature: string,
 *   orderId: string (database order ID)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    if (!keySecret) {
      return NextResponse.json(
        { error: 'Razorpay secret is not configured' },
        { status: 500 }
      );
    }

    await connectDB();

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
    } = await request.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
      return NextResponse.json(
        { error: 'Missing payment verification fields' },
        { status: 400 }
      );
    }

    // Verify Razorpay signature
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      // Update order payment status to failed
      await Order.updateOne(
        { _id: orderId },
        { paymentStatus: 'failed', razorpayPaymentId: razorpay_payment_id }
      );

      return NextResponse.json(
        { success: false, error: 'Invalid payment signature', verified: false },
        { status: 400 }
      );
    }

    // Update order with payment details
    const order = await Order.findByIdAndUpdate(
      orderId,
      {
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        paymentStatus: 'completed',
        status: 'confirmed',
      },
      { new: true }
    );

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    try {
      const { creditVendorsForOrder } = await import('@/lib/vendorEarnings');
      await creditVendorsForOrder(String(order._id));
    } catch (earnErr) {
      console.error('Razorpay verify vendor credit failed (non-fatal):', earnErr);
    }

    return NextResponse.json(
      {
        success: true,
        verified: true,
        message: 'Payment verified successfully',
        order,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Order payment verification error:', error?.message || error);
    return NextResponse.json(
      { error: error?.message || 'Failed to verify payment' },
      { status: 500 }
    );
  }
}
