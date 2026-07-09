/**
 * Shiprocket order creation.
 *
 * Maps our internal, strongly-typed `CreateOrderInput` to the payload expected
 * by Shiprocket's `/orders/create/adhoc` endpoint and returns the resulting
 * Shiprocket order id + shipment id.
 */

import { shiprocketConfig } from './config';
import { shiprocketRequest } from './client';
import { ShiprocketError } from './errors';
import { shiprocketLogger } from './logger';
import type { CreateOrderInput, CreateOrderResult } from './types';

interface RawCreateOrderResponse {
  order_id?: number | string;
  shipment_id?: number | string;
  status?: string;
  status_code?: number;
  message?: string;
}

/**
 * Creates an adhoc order in Shiprocket.
 *
 * @param input - validated order input (billing = shipping by default).
 * @returns the Shiprocket order id + shipment id needed for AWB assignment.
 * @throws {ShiprocketError} when Shiprocket does not return an order/shipment id.
 */
export async function createShiprocketOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  shiprocketLogger.info('order', 'Creating Shiprocket order', { orderId: input.orderId });

  const payload = {
    order_id: input.orderId,
    order_date: input.orderDate,
    pickup_location: shiprocketConfig.pickupLocation,
    channel_id: shiprocketConfig.channelId || undefined,
    comment: input.comment,

    billing_customer_name: input.billing.customerName,
    billing_last_name: input.billing.lastName,
    billing_address: input.billing.address,
    billing_address_2: input.billing.address2,
    billing_city: input.billing.city,
    billing_pincode: input.billing.pincode,
    billing_state: input.billing.state,
    billing_country: input.billing.country,
    billing_email: input.billing.email,
    billing_phone: input.billing.phone,

    // Shipping mirrors billing for a standard single-address checkout.
    shipping_is_billing: true,

    order_items: input.items.map((item) => ({
      name: item.name,
      sku: item.sku,
      units: item.units,
      selling_price: item.sellingPrice,
      discount: item.discount,
      tax: item.tax,
      hsn: item.hsn,
    })),

    payment_method: input.paymentMethod,
    shipping_charges: input.shippingCharges,
    giftwrap_charges: 0,
    transaction_charges: 0,
    total_discount: input.totalDiscount,
    sub_total: input.subTotal,

    length: input.dimensions.length,
    breadth: input.dimensions.breadth,
    height: input.dimensions.height,
    weight: input.dimensions.weight,
  };

  const response = await shiprocketRequest<RawCreateOrderResponse>({
    method: 'POST',
    path: '/orders/create/adhoc',
    scope: 'order',
    body: payload,
  });

  if (!response?.order_id || !response?.shipment_id) {
    throw new ShiprocketError(
      response?.message || 'Shiprocket did not return an order/shipment id',
      'UPSTREAM_ERROR',
      502,
      response
    );
  }

  shiprocketLogger.info('order', 'Shiprocket order created', {
    orderId: input.orderId,
    shiprocketOrderId: response.order_id,
    shipmentId: response.shipment_id,
  });

  return {
    shiprocketOrderId: String(response.order_id),
    shipmentId: String(response.shipment_id),
    status: String(response.status ?? ''),
    statusCode: Number(response.status_code ?? 0),
  };
}
