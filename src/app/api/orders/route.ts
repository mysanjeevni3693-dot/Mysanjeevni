import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Razorpay from 'razorpay';
import { connectDB } from '@/lib/db';
import { Order } from '@/lib/models/Order';
import { User } from '@/lib/models/User';
import { Product } from '@/lib/models/Product';
import { Address } from '@/lib/models/Address';
import { Vendor } from '@/lib/models/Vendor';
import { createShiprocketOrder, generateAWB, getShippingRates, trackShipment } from '@/lib/shiprocket';

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

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    // Ensure User model is registered
    const { User: UserModel } = await import('@/lib/models/User');

    const userId = request.nextUrl.searchParams.get('userId');
    const vendorIdParam = request.nextUrl.searchParams.get('vendorId');
    const admin = request.nextUrl.searchParams.get('admin') === 'true';

    // Vendor-scoped listing requires a verified vendor JWT; vendorId comes from the token.
    let vendorId = vendorIdParam;
    if (vendorIdParam || request.headers.get('x-vendor-scope') === '1') {
      const { requireVendorAuth, isAuthError } = await import('@/lib/vendorAuth');
      const auth = requireVendorAuth(request);
      if (isAuthError(auth)) return auth;
      vendorId = auth.vendorId;
    }

    if (!userId && !vendorId && !admin) {
      return NextResponse.json(
        { error: 'User ID, Vendor ID, or admin flag is required' },
        { status: 400 }
      );
    }

    let orders;

    if (admin) {
      const { requireAdminAuth, isAdminAuthError } = await import('@/lib/auth/requireAdminAuth');
      const adminAuth = await requireAdminAuth(request);
      if (isAdminAuthError(adminAuth)) return adminAuth;

      // Admin can see all orders
      orders = await Order.find({}).sort({ createdAt: -1 }).populate('userId', 'fullName email phone').populate('deliveryAddress');
    } else if (vendorId) {
      // Prefer items stamped with vendorId; fall back to product ownership for legacy orders.
      const { Product } = await import('@/lib/models/Product');
      const vendorProducts = await Product.find({ vendorId }).select('_id');
      const productIds = vendorProducts.flatMap((p) => {
        const id = p._id;
        return [String(id), id];
      });

      orders = await Order.find({
        $or: [
          { 'items.vendorId': vendorId },
          { 'items.productId': { $in: productIds } },
        ],
      })
        .sort({ createdAt: -1 })
        .populate('userId', 'fullName email phone')
        .populate('deliveryAddress');

      // Only expose this vendor's line items + limited customer fields.
      orders = orders.map((order: any) => {
        const o = order.toObject ? order.toObject() : order;
        const productIdSet = new Set(productIds.map((id) => String(id)));
        const ownItems = (o.items || []).filter(
          (item: any) =>
            String(item.vendorId || '') === String(vendorId) ||
            productIdSet.has(String(item.productId || ''))
        );
        const vendorAmount = ownItems.reduce(
          (sum: number, item: any) =>
            sum + Number(item.total ?? Number(item.price || 0) * Number(item.quantity || 0)),
          0
        );
        // Prefer this vendor's item status over the shared order status.
        const vendorStatuses = ownItems.map((i: any) =>
          String(i.status || o.status || 'pending').toLowerCase()
        );
        const vendorStatus =
          vendorStatuses.length === 0
            ? o.status
            : vendorStatuses.every((s: string) => s === vendorStatuses[0])
              ? vendorStatuses[0]
              : vendorStatuses.includes('shipped')
                ? 'shipped'
                : vendorStatuses.includes('confirmed')
                  ? 'confirmed'
                  : vendorStatuses[0];
        return {
          ...o,
          items: ownItems,
          status: vendorStatus,
          vendorAmount: Math.round(vendorAmount * 100) / 100,
          totalPrice: Math.round(vendorAmount * 100) / 100,
          razorpayPaymentId: undefined,
          razorpaySignature: undefined,
        };
      });
    } else {
      // Regular user sees their own orders
      orders = await Order.find({ userId }).sort({ createdAt: -1 }).populate('deliveryAddress');
    }

    return NextResponse.json(
      {
        message: 'Orders fetched successfully',
        orders,
        total: orders.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get orders error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orders
 * Creates a new order with Razorpay payment integration
 * Request body: {
 *   userId: string,
 *   items: Array<{productId, productName, quantity, price, total}>,
 *   totalPrice: number,
 *   deliveryAddressId: string,
 *   currency: string (optional, default: 'INR'),
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
      deliveryAddressId,
      currency = 'INR',
      notes = {},
    } = body;

    if (!userId || !items || !totalPrice || !deliveryAddressId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, items, totalPrice, deliveryAddressId' },
        { status: 400 }
      );
    }

    // Fetch delivery address to determine country and pincode
    const deliveryAddress = await Address.findById(deliveryAddressId);
    if (!deliveryAddress) {
      return NextResponse.json({ error: 'Delivery address not found' }, { status: 404 });
    }

    // Determine shipping charge: free for non-India, Shiprocket for India
    let shippingCharge = 0;
    let shippingCourier: string | undefined;
    const countryNormalized = (deliveryAddress.country || '').trim().toLowerCase();

    if (countryNormalized !== 'india' && countryNormalized !== 'in') {
      // Free shipping for non-India addresses
      shippingCharge = 0;
    } else {
      try {
        const pickupPincode = process.env.SHIPROCKET_PICKUP_PINCODE || '110001';
        const weightKg = (items && Array.isArray(items)) ? (items.length * 0.5) : 0.5;
        const rates = await getShippingRates({ pickup_pincode: pickupPincode, delivery_pincode: deliveryAddress.pincode || '', weightKg });
        shippingCharge = rates.shippingCharge || 0;
        shippingCourier = rates.courier;
      } catch (rateErr: any) {
        console.error('Error fetching shipping rates:', rateErr?.message || rateErr);
        shippingCharge = Number(process.env.DEFAULT_SHIPPING_CHARGE || 0);
      }
    }

    // Create new order in database (include shippingCharge)
    const { stampVendorOnOrderItems } = await import('@/lib/orderItemVendors');
    const stampedItems = await stampVendorOnOrderItems(items, { defaultStatus: 'pending' });

    const order = await Order.create({
      userId,
      items: stampedItems,
      totalPrice: Number(totalPrice) + Number(shippingCharge),
      shippingCharge,
      courier: shippingCourier,
      deliveryAddress: deliveryAddressId,
      status: 'pending',
      paymentStatus: 'pending',
    });

    // Create Razorpay order if keys are configured
    let razorpayOrder = null;
    if (keyId && keySecret) {
      try {
        const razorpay = getClient();
        razorpayOrder = await razorpay.orders.create({
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
      } catch (razorpayError: any) {
        console.error('Razorpay order creation error:', razorpayError?.message);
        // Continue without Razorpay if there's an error
      }
    }

    return NextResponse.json(
      {
        message: 'Order created successfully',
        order: {
          _id: order._id,
          userId,
          items,
          totalPrice,
          deliveryAddress: deliveryAddressId,
          status: order.status,
          paymentStatus: order.paymentStatus,
          razorpayOrderId: order.razorpayOrderId,
        },
        ...(razorpayOrder && { keyId }),
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create order error:', error?.message || error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/orders
 * Updates order status
 * Request body: {
 *   orderId: string,
 *   status: string (pending|confirmed|shipped|delivered|cancelled),
 *   userType: 'admin' | 'vendor',
 *   vendorId?: string (required if userType is 'vendor')
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { orderId, status, userType, vendorId } = body;

    if (!orderId || !status) {
      return NextResponse.json(
        { error: 'Order ID and status are required' },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be one of: ' + validStatuses.join(', ') },
        { status: 400 }
      );
    }

    // Find the order safely.
    let order;
    try {
      if (mongoose.isValidObjectId(orderId)) {
        order = await Order.findById(orderId);
      } else {
        order = await Order.findOne({ orderId });
      }
    } catch (findError: any) {
      console.error('Order lookup error:', findError?.message || findError);
      return NextResponse.json(
        { error: 'Invalid order ID or malformed request' },
        { status: 400 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Check permissions
    if (userType === 'vendor') {
      const { requireVendorAuth, isAuthError } = await import('@/lib/vendorAuth');
      const auth = requireVendorAuth(request);
      if (isAuthError(auth)) return auth;
      const authenticatedVendorId = auth.vendorId;

      const { Product } = await import('@/lib/models/Product');
      const vendorProducts = await Product.find({ vendorId: authenticatedVendorId }).select('_id');
      const productIds = vendorProducts.map((p) => p._id.toString());
      const ownsItem = (item: any) =>
        String(item.vendorId || '') === String(authenticatedVendorId) ||
        productIds.includes(String(item.productId || ''));

      if (!order.items.some(ownsItem)) {
        return NextResponse.json(
          { error: 'Vendor does not have permission to update this order' },
          { status: 403 }
        );
      }

      // Multi-vendor: update only this vendor's line items, then derive order status.
      for (const item of order.items as any[]) {
        if (ownsItem(item)) {
          item.status = status;
          if (!item.vendorId) item.vendorId = authenticatedVendorId;
        }
      }

      const rank: Record<string, number> = {
        pending: 0,
        confirmed: 1,
        shipped: 2,
        delivered: 3,
        cancelled: -1,
      };
      const itemStatuses = (order.items as any[]).map((i) =>
        String(i.status || order.status || 'pending').toLowerCase()
      );
      const active = itemStatuses.filter((s) => s !== 'cancelled');
      if (active.length === 0) {
        order.status = 'cancelled';
      } else if (active.every((s) => s === 'delivered')) {
        order.status = 'delivered';
      } else {
        let min = 'delivered';
        for (const s of active) {
          if ((rank[s] ?? 0) < (rank[min] ?? 0)) min = s;
        }
        order.status = min as any;
      }

      await order.save();

      try {
        if (status === 'delivered') {
          const { creditVendorsForOrder } = await import('@/lib/vendorEarnings');
          await creditVendorsForOrder(String(order._id), {
            onlyVendorId: authenticatedVendorId,
            allowPartialDelivery: true,
          });
        } else if (status === 'cancelled') {
          const { reverseVendorCreditsForOrder } = await import('@/lib/vendorEarnings');
          await reverseVendorCreditsForOrder(String(order._id), 'vendor_cancelled_items', {
            onlyVendorId: authenticatedVendorId,
          });
        }
      } catch (earnErr) {
        console.error('Vendor-scoped earnings update failed (non-fatal):', earnErr);
      }

      return NextResponse.json(
        {
          message: 'Vendor order items updated successfully',
          order: {
            ...order.toObject(),
            status,
            items: (order.items as any[]).filter(ownsItem),
          },
        },
        { status: 200 }
      );
    }

    // Explicit admin updates (or legacy admin UI that now sends userType=admin).
    if (userType === 'admin') {
      const { requireAdminAuth, isAdminAuthError } = await import('@/lib/auth/requireAdminAuth');
      const admin = await requireAdminAuth(request);
      if (isAdminAuthError(admin)) return admin;

      order.status = status;
      for (const item of order.items as any[]) {
        item.status = status;
      }
      await order.save();

      try {
        if (status === 'delivered') {
          const { creditVendorsForOrder } = await import('@/lib/vendorEarnings');
          await creditVendorsForOrder(String(order._id));
        } else if (status === 'cancelled') {
          const { reverseVendorCreditsForOrder } = await import('@/lib/vendorEarnings');
          await reverseVendorCreditsForOrder(String(order._id), 'order_cancelled');

          try {
            const { notifyVendors } = await import('@/lib/vendorNotifications');
            const vendorIds = [
              ...new Set(
                (order.items || [])
                  .map((i: any) => String(i.vendorId || ''))
                  .filter((id: string) => Boolean(id))
              ),
            ] as string[];
            await notifyVendors(vendorIds, {
              type: 'order_cancelled',
              title: 'Order cancelled',
              message: `Order #${String(order._id).slice(-8).toUpperCase()} was cancelled`,
              relatedId: String(order._id),
              actionUrl: '/vendor/dashboard',
            });
          } catch {
            // non-fatal
          }
        }
      } catch (earnErr) {
        console.error('Vendor earnings update failed (non-fatal):', earnErr);
      }

      if (status === 'shipped') {
        try {
          await createShiprocketShipment(order);
        } catch (shippingError: any) {
          console.error('Shipping creation error:', shippingError?.message || shippingError);
        }
      }

      return NextResponse.json(
        { message: 'Order status updated successfully', order },
        { status: 200 }
      );
    }

    // Customer cancel path (no userType): only cancellation, must own the order.
    if (status !== 'cancelled') {
      return NextResponse.json(
        { error: 'Only admins or vendors can update order status to this value' },
        { status: 403 }
      );
    }

    const bodyUserId = String(body.userId || '').trim();
    if (!bodyUserId || String(order.userId) !== bodyUserId) {
      return NextResponse.json(
        { error: 'Not authorized to cancel this order' },
        { status: 403 }
      );
    }

    order.status = 'cancelled';
    for (const item of order.items as any[]) {
      item.status = 'cancelled';
    }
    await order.save();

    try {
      const { reverseVendorCreditsForOrder } = await import('@/lib/vendorEarnings');
      await reverseVendorCreditsForOrder(String(order._id), 'customer_cancelled');
      const { notifyVendors } = await import('@/lib/vendorNotifications');
      const vendorIds = [
        ...new Set(
          (order.items || [])
            .map((i: any) => String(i.vendorId || ''))
            .filter((id: string) => Boolean(id))
        ),
      ] as string[];
      await notifyVendors(vendorIds, {
        type: 'order_cancelled',
        title: 'Order cancelled',
        message: `Order #${String(order._id).slice(-8).toUpperCase()} was cancelled by customer`,
        relatedId: String(order._id),
        actionUrl: '/vendor/dashboard',
      });
    } catch (earnErr) {
      console.error('Customer cancel earnings reverse failed (non-fatal):', earnErr);
    }

    return NextResponse.json(
      { message: 'Order cancelled successfully', order },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Update order error:', error?.message || error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function createShiprocketShipment(order: any) {
  try {
    // Populate order with delivery address and user
    await order.populate('deliveryAddress');
    await order.populate('userId');

    // Get vendor from first product (assuming single vendor for simplicity)
    const firstProductId = order.items[0].productId;
    const product = await Product.findById(firstProductId).populate('vendorId');
    if (!product || !product.vendorId) {
      throw new Error('Vendor not found for product');
    }
    const vendor = product.vendorId;

    // Prepare order data for Shiprocket
    const orderData = {
      order_id: order._id.toString(),
      order_date: order.createdAt.toISOString().split('T')[0],
      pickup_location: 'Main Warehouse', // Default pickup location name
      channel_id: process.env.SHIPROCKET_CHANNEL_ID || '',
      comment: order.orderNotes || '',
      billing_customer_name: order.userId.fullName.split(' ')[0],
      billing_last_name: order.userId.fullName.split(' ').slice(1).join(' ') || '',
      billing_address: order.deliveryAddress.addressLine1,
      billing_address_2: order.deliveryAddress.addressLine2 || '',
      billing_city: order.deliveryAddress.city,
      billing_pincode: order.deliveryAddress.pincode,
      billing_state: order.deliveryAddress.state,
      billing_country: order.deliveryAddress.country,
      billing_email: order.userId.email,
      billing_phone: order.userId.phone,
      shipping_is_billing: true,
      shipping_customer_name: order.deliveryAddress.fullName.split(' ')[0],
      shipping_last_name: order.deliveryAddress.fullName.split(' ').slice(1).join(' ') || '',
      shipping_address: order.deliveryAddress.addressLine1,
      shipping_address_2: order.deliveryAddress.addressLine2 || '',
      shipping_city: order.deliveryAddress.city,
      shipping_pincode: order.deliveryAddress.pincode,
      shipping_state: order.deliveryAddress.state,
      shipping_country: order.deliveryAddress.country,
      shipping_email: order.userId.email,
      shipping_phone: order.deliveryAddress.phone,
      order_items: order.items.map((item: any) => ({
        name: item.productName,
        sku: item.productId,
        units: item.quantity,
        selling_price: item.price,
        discount: 0,
        tax: 0,
        hsn: '', // Need to add HSN to product model if required
      })),
      payment_method: 'Prepaid', // Since payment is already done
      shipping_charges: order.shippingCharge || 0,
      giftwrap_charges: 0,
      transaction_charges: 0,
      total_discount: 0,
      sub_total: order.totalPrice - (order.shippingCharge || 0),
      length: 10, // Default dimensions, should be from product
      breadth: 10,
      height: 10,
      weight: 0.5, // Default weight
    };

    // Create Shiprocket order
    const shiprocketResponse = await createShiprocketOrder(orderData);

    // Update order with Shiprocket details
    order.shiprocketOrderId = shiprocketResponse.order_id;
    order.shiprocketShipmentId = shiprocketResponse.shipment_id;
    await order.save();

    // Generate AWB
    if (order.shiprocketShipmentId) {
      const awbResponse = await generateAWB(order.shiprocketShipmentId);
      order.awbNumber = awbResponse.awb_code || awbResponse.awb_assign_response?.awb_code;
      await order.save();
    }

    console.log('Shiprocket shipment created successfully for order:', order._id);
  } catch (error: any) {
    console.error('Error creating Shiprocket shipment:', error?.message || error);
    throw error;
  }
}
