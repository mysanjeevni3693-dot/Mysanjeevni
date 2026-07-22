import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { DoctorConsultation } from '@/lib/models/DoctorConsultation';
import { LabTestBooking } from '@/lib/models/LabTestBooking';
import { Order } from '@/lib/models/Order';

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

function isValidSignature(payload: string, signature: string, secret: string) {
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature || '');

  if (expectedBuf.length !== signatureBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, signatureBuf);
}

export async function POST(request: NextRequest) {
  try {
    if (!WEBHOOK_SECRET) {
      return NextResponse.json(
        { error: 'RAZORPAY_WEBHOOK_SECRET is not configured' },
        { status: 500 }
      );
    }

    const signature = request.headers.get('x-razorpay-signature') || '';
    const payloadText = await request.text();

    if (!signature || !isValidSignature(payloadText, signature, WEBHOOK_SECRET)) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
    }

    const event = JSON.parse(payloadText);
    const eventType = event?.event;
    const paymentEntity = event?.payload?.payment?.entity;

    const orderId = paymentEntity?.order_id;
    const paymentId = paymentEntity?.id;

    if (!orderId) {
      return NextResponse.json({ success: true, message: 'No order id to update' });
    }

    await connectDB();

    if (eventType === 'payment.captured') {
      await Promise.all([
        DoctorConsultation.updateMany(
          { razorpayOrderId: orderId },
          { paymentStatus: 'completed', razorpayPaymentId: paymentId }
        ),
        LabTestBooking.updateMany(
          { razorpayOrderId: orderId },
          { paymentStatus: 'completed', razorpayPaymentId: paymentId }
        ),
        Order.updateMany(
          { razorpayOrderId: orderId },
          { paymentStatus: 'completed', razorpayPaymentId: paymentId, status: 'confirmed' }
        ),
      ]);

      try {
        const paidOrders = await Order.find({ razorpayOrderId: orderId }).select('_id');
        const { creditVendorsForOrder } = await import('@/lib/vendorEarnings');
        for (const order of paidOrders) {
          await creditVendorsForOrder(String(order._id));
        }
      } catch (earnErr) {
        console.error('Razorpay webhook vendor credit failed (non-fatal):', earnErr);
      }
    }

    if (eventType === 'payment.failed') {
      await Promise.all([
        DoctorConsultation.updateMany(
          { razorpayOrderId: orderId },
          { paymentStatus: 'failed', razorpayPaymentId: paymentId }
        ),
        LabTestBooking.updateMany(
          { razorpayOrderId: orderId },
          { paymentStatus: 'failed', razorpayPaymentId: paymentId }
        ),
        Order.updateMany(
          { razorpayOrderId: orderId },
          { paymentStatus: 'failed', razorpayPaymentId: paymentId }
        ),
      ]);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Razorpay webhook error:', error?.message || error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
