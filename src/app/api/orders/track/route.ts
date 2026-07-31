import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Order } from '@/lib/models/Order';
import { trackShipment } from '@/lib/shiprocket';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';

function serializeOrder(order: any) {
  return {
    id: String(order._id),
    status: String(order.status || 'pending'),
    paymentMethod: String(order.paymentMethod || ''),
    paymentStatus: String(order.paymentStatus || ''),
    totalAmount: Number(order.totalPrice ?? order.totalAmount ?? 0),
    createdAt: order.createdAt ? new Date(order.createdAt).toISOString() : new Date().toISOString(),
    items: Array.isArray(order.items)
      ? order.items.map((item: any) => ({
          name: String(item.productName || item.name || 'Item'),
          quantity: Number(item.quantity || 0),
          price: Number(item.price || 0),
        }))
      : [],
    awbNumber: order.awbNumber || '',
    courierName: order.courierName || '',
    shipmentStatus: order.shipmentStatus || '',
  };
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const orderId = String(request.nextUrl.searchParams.get('orderId') || '').trim();
    if (!orderId) {
      return NextResponse.json(
        { success: false, error: { message: 'orderId query param is required' } },
        { status: 400 }
      );
    }

    if (!mongoose.isValidObjectId(orderId)) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid order ID' } },
        { status: 400 }
      );
    }

    const order = await Order.findById(orderId).lean();
    if (!order) {
      return NextResponse.json(
        { success: false, error: { message: 'Order not found' } },
        { status: 404 }
      );
    }

    const serialized = serializeOrder(order);
    let liveTracking: unknown = null;
    let trackingError = '';

    // Live courier tracking is optional — pending COD orders often have no AWB yet.
    try {
      if (order.awbNumber) {
        liveTracking = await trackShipment({ awb: String(order.awbNumber) });
      } else if (order.shiprocketShipmentId) {
        liveTracking = await trackShipment({
          shipmentId: String(order.shiprocketShipmentId),
        });
      }
    } catch (err: any) {
      trackingError = err?.message || 'Live courier tracking is temporarily unavailable';
      console.error('Tracking fetch error:', trackingError);
    }

    return NextResponse.json({
      success: true,
      order: serialized,
      tracking: liveTracking,
      trackingError: trackingError || undefined,
    });
  } catch (error: any) {
    console.error('Order tracking error:', error?.message || error);
    return NextResponse.json(
      { success: false, error: { message: 'Internal server error' } },
      { status: 500 }
    );
  }
}
