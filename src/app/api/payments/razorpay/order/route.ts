import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { connectDB } from '@/lib/db';
import { Order } from '@/lib/models/Order';

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

function getClient() {
  if (!keyId || !keySecret) {
    throw new Error('Razorpay keys are not configured on server');
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

/**
 * POST /api/payments/razorpay/order
 * Creates a Razorpay order for a product order
 * Request body: {
 *   userId: string,
 *   items: Array<{productId, productName, quantity, price, total}>,
 *   totalPrice: number,
 *   deliveryAddress: string,
 *   currency: string (default: 'INR'),
 *   notes: object (optional)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const {
      userId,
      items,
      totalPrice,
      deliveryAddress,
      currency = 'INR',
      notes = {},
    } = body;

    // Validate required fields
    if (!userId || !items || !totalPrice || !deliveryAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, items, totalPrice, deliveryAddress' },
        { status: 400 }
      );
    }

    if (Number(totalPrice) <= 0) {
      return NextResponse.json(
        { error: 'Total price must be greater than 0' },
        { status: 400 }
      );
    }

    // Create order in database with vendor stamps so marketplace scoping works.
    const { stampVendorOnOrderItems } = await import('@/lib/orderItemVendors');
    const stampedItems = await stampVendorOnOrderItems(items, { defaultStatus: 'pending' });

    const order = await Order.create({
      userId,
      items: stampedItems,
      totalPrice,
      deliveryAddress,
      status: 'pending',
      paymentStatus: 'pending',
    });

    // Create Razorpay order
    const razorpay = getClient();
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(Number(totalPrice) * 100), // Amount in paise
      currency,
      receipt: `order_${order._id}`,
      notes: {
        orderId: order._id.toString(),
        userId,
        ...notes,
      },
    });

    // Update order with Razorpay details
    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    return NextResponse.json(
      {
        success: true,
        order: {
          _id: order._id,
          razorpayOrderId: razorpayOrder.id,
          amount: Number(razorpayOrder.amount) / 100, // Convert back to rupees
          currency: razorpayOrder.currency,
        },
        keyId,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Razorpay order creation error:', error?.message || error);
    const errorMessage = error?.error?.description || error?.message || 'Failed to create payment order';

    return NextResponse.json(
      {
        error: errorMessage,
        code: error?.error?.code,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/payments/razorpay/order?orderId=<orderId>
 * Fetches order details
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const orderId = request.nextUrl.searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        order,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Fetch order error:', error?.message || error);
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}
