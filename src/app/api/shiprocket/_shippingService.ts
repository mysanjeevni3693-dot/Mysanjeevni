/**
 * Bridge between the persisted `Order` documents and the pure Shiprocket
 * service layer (`@/lib/shiprocket/*`).
 *
 * The Shiprocket lib modules are intentionally database-agnostic. This file is
 * where we load an order from Mongo, translate it into the strongly-typed
 * `CreateOrderInput`, and write shipment results back onto the order. Keeping
 * this mapping in the API layer preserves the clean separation of concerns.
 */

import { connectDB } from '@/lib/db';
import { Order } from '@/lib/models/Order';
import { Address } from '@/lib/models/Address';
import { User } from '@/lib/models/User';
import { ShiprocketError } from '@/lib/shiprocket/errors';
import { createOrderSchema, type CreateOrderInput } from '@/lib/shiprocket/types';

/** Minimal typed view of the order fields this bridge reads/writes. */
export interface OrderDocument {
  _id: unknown;
  items?: Array<{
    productId?: string;
    productName?: string;
    quantity?: number;
    price?: number;
  }>;
  totalPrice?: number;
  shippingCharge?: number;
  paymentStatus?: string;
  orderNotes?: string;
  createdAt?: Date;
  deliveryAddress?: unknown;
  userId?: unknown;
  shiprocketOrderId?: string;
  shiprocketShipmentId?: string;
  awbNumber?: string;
  courierName?: string;
  shipmentStatus?: string;
  pickupStatus?: string;
  pickupTokenNumber?: string;
  estimatedDelivery?: string;
  trackingUrl?: string;
  labelUrl?: string;
  invoiceUrl?: string;
  manifestUrl?: string;
  save: () => Promise<unknown>;
  populate: (path: string, select?: string) => Promise<OrderDocument>;
}

/**
 * Loads an order by its Mongo id, connecting to the DB if needed.
 *
 * @throws {ShiprocketError} 404 when the order does not exist.
 */
export async function loadOrder(orderId: string): Promise<OrderDocument> {
  await connectDB();
  // Ensure referenced models are registered before populate is used.
  void Address;
  void User;

  const order = (await Order.findById(orderId)) as OrderDocument | null;
  if (!order) {
    throw new ShiprocketError('Order not found', 'NOT_FOUND', 404);
  }
  return order;
}

/** Splits a full name into first + last name parts for Shiprocket. */
function splitName(fullName: string): { first: string; last: string } {
  const parts = String(fullName || '').trim().split(/\s+/u);
  const first = parts.shift() || 'Customer';
  return { first, last: parts.join(' ') };
}

/**
 * Builds a validated `CreateOrderInput` from a persisted order.
 *
 * Populates the delivery address + user, derives the payment method from the
 * order's payment status, and maps line items. Throws a client-safe error when
 * the address/pincode required by Shiprocket is missing.
 */
export async function buildCreateOrderInput(order: OrderDocument): Promise<CreateOrderInput> {
  await order.populate('deliveryAddress');
  await order.populate('userId');

  const address = order.deliveryAddress as
    | {
        fullName?: string;
        phone?: string;
        addressLine1?: string;
        addressLine2?: string;
        city?: string;
        state?: string;
        pincode?: string;
        country?: string;
      }
    | undefined;

  const user = order.userId as { fullName?: string; email?: string; phone?: string } | undefined;

  if (!address?.pincode || !address?.addressLine1 || !address?.city || !address?.state) {
    throw new ShiprocketError('Delivery address is incomplete for shipping', 'VALIDATION_ERROR', 422);
  }

  const name = splitName(address.fullName || user?.fullName || 'Customer');
  const shippingCharge = Number(order.shippingCharge || 0);
  const subTotal = Math.max(0, Number(order.totalPrice || 0) - shippingCharge);
  const paymentMethod = order.paymentStatus === 'completed' ? 'Prepaid' : 'COD';

  const items = (order.items ?? []).map((item) => ({
    name: item.productName || 'Item',
    sku: item.productId || String(order._id),
    units: Number(item.quantity || 1),
    sellingPrice: Number(item.price || 0),
    discount: 0,
    tax: 0,
    hsn: '',
  }));

  const rawInput = {
    orderId: String(order._id),
    orderDate: (order.createdAt ? new Date(order.createdAt) : new Date()).toISOString().split('T')[0],
    paymentMethod,
    billing: {
      customerName: name.first,
      lastName: name.last,
      address: address.addressLine1,
      address2: address.addressLine2 || '',
      city: address.city,
      state: address.state,
      country: address.country || 'India',
      pincode: address.pincode,
      email: user?.email || 'orders@mysanjeevani.com',
      phone: address.phone || user?.phone || '',
    },
    items,
    subTotal,
    shippingCharges: shippingCharge,
    totalDiscount: 0,
    dimensions: {
      length: 10,
      breadth: 10,
      height: 10,
      weight: Math.max(0.5, items.reduce((sum, item) => sum + item.units, 0) * 0.5),
    },
    comment: order.orderNotes || '',
  };

  // Re-validate through the same schema the public routes use.
  return createOrderSchema.parse(rawInput);
}
