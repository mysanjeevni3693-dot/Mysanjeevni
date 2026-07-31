/**
 * Shiprocket Checkout (SRC) service.
 *
 * SRC is Shiprocket's hosted "fast checkout" widget. Unlike the shipping API
 * (token/login based), the checkout API authenticates every request with:
 *   - `X-Api-Key`         : the public checkout key
 *   - `X-Api-HMAC-SHA256` : Base64( HMAC-SHA256( exactRequestBody, apiSecret ) )
 *
 * This module signs and sends those requests, and verifies inbound webhooks.
 * All credentials stay on the server and are never returned to the client.
 */

import crypto from 'crypto';
import {
  shiprocketCheckoutConfig,
  shiprocketConfig,
  hasShiprocketCheckoutCredentials,
} from './config';
import { ShiprocketError, mapStatusToErrorCode } from './errors';
import { shiprocketLogger } from './logger';
import {
  CHECKOUT_DELIVERY_VARIANT_ID,
  CHECKOUT_DELIVERY_VARIANT_IDS,
  type CheckoutAddress,
  type CheckoutOrder,
  type CheckoutTokenInput,
  type CheckoutTokenResult,
} from './types';

/**
 * Computes the `X-Api-HMAC-SHA256` header value for a raw request body.
 *
 * @param rawBody - the EXACT JSON string that will be sent as the body.
 * @returns Base64-encoded HMAC-SHA256 signature.
 */
export function signCheckoutBody(rawBody: string): string {
  return crypto.createHmac('sha256', shiprocketCheckoutConfig.apiSecret).update(rawBody, 'utf8').digest('base64');
}

/**
 * Sends a signed POST request to the SRC API. The body is serialized once and
 * the SAME string is both signed and sent (so the HMAC always matches).
 *
 * @throws {ShiprocketError} normalized error with the upstream status code.
 */
async function sendCheckoutRequest<T>(path: string, bodyObject: unknown): Promise<T> {
  if (!hasShiprocketCheckoutCredentials()) {
    throw new ShiprocketError('Shiprocket Checkout credentials are not configured', 'CONFIG_MISSING', 500);
  }

  const rawBody = JSON.stringify(bodyObject);
  const signature = signCheckoutBody(rawBody);
  const url = `${shiprocketCheckoutConfig.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Api-Key': shiprocketCheckoutConfig.apiKey,
        'X-Api-HMAC-SHA256': signature,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: rawBody,
      cache: 'no-store',
    });
  } catch (error) {
    shiprocketLogger.error('order', 'Checkout network error', {
      path,
      message: error instanceof Error ? error.message : 'unknown',
    });
    throw new ShiprocketError('Unable to reach Shiprocket Checkout', 'NETWORK_ERROR', 502);
  }

  const payload = await safeJson(response);

  if (!response.ok) {
    const message = extractMessage(payload) || `Shiprocket Checkout request failed (${response.status})`;
    shiprocketLogger.error('order', 'Checkout upstream error', { path, status: response.status, message });
    throw new ShiprocketError(message, mapStatusToErrorCode(response.status), response.status, payload);
  }

  return payload as T;
}

/** Public alias for the signed request helper. */
export const checkoutRequest = sendCheckoutRequest;

interface RawTokenResponse {
  token?: string;
  result?: { token?: string };
  data?: { token?: string; result?: { token?: string } };
  message?: string;
}

/**
 * Creates a Shiprocket Checkout access token for a cart.
 *
 * We always pass inline `catalog_data` (name/price/image) so the checkout works
 * without a prior catalog sync. The `redirectUrl` is where Shiprocket sends the
 * customer after a successful order (with `?oid=&ost=` appended).
 *
 * @param input - validated cart + optional coupon.
 * @param redirectUrl - absolute success URL for this deployment.
 * @returns the access token + the redirect URL used.
 * @throws {ShiprocketError} when Shiprocket does not return a token.
 */
export async function createCheckoutToken(
  input: CheckoutTokenInput,
  redirectUrl: string
): Promise<CheckoutTokenResult> {
  shiprocketLogger.info('order', 'Creating checkout access token', { items: input.items.length });

  // Keep the access-token payload minimal — extra shipping/currency fields cause
  // Fastrr to return HTTP 500. Delivery is injected as a normal catalog line item.
  const envDefaultShipping =
    Number(shiprocketConfig.defaultShippingCharge || process.env.DEFAULT_SHIPPING_CHARGE || 50) || 50;
  const requestedShipping = Math.max(0, Number(input.shippingCharges || 0) || 0);
  const isInr = (input.currency || 'INR').toUpperCase() === 'INR';
  const shippingCharges =
    requestedShipping > 0 ? requestedShipping : isInr ? Math.max(0, envDefaultShipping) : 0;

  const items = input.items.map((item) => ({
    variant_id: item.variantId,
    quantity: item.quantity,
    catalog_data: {
      price: item.price,
      name: item.name,
      // Shiprocket rejects a blank image_url, so fall back to a placeholder.
      image_url: item.imageUrl || shiprocketCheckoutConfig.placeholderImage,
    },
  }));

  if (shippingCharges > 0) {
    items.push({
      variant_id: CHECKOUT_DELIVERY_VARIANT_ID,
      quantity: 1,
      catalog_data: {
        price: shippingCharges,
        name: 'Delivery Charges',
        image_url: shiprocketCheckoutConfig.placeholderImage,
      },
    });
  }

  const customAttributes = {
    ...(input.customAttributes || {}),
    ...(shippingCharges > 0 ? { shipping_charges: String(shippingCharges) } : {}),
  };

  shiprocketLogger.info('order', 'Checkout token shipping', {
    requestedShipping,
    shippingCharges,
    itemCount: items.length,
  });

  // Shape must match Fastrr's documented access-token/checkout body.
  const body = {
    cart_data: {
      items,
      ...(input.coupon
        ? { cart_discount: { coupon_code: input.coupon.code, amount: input.coupon.amount } }
        : {}),
      ...(Object.keys(customAttributes).length > 0 ? { custom_attributes: customAttributes } : {}),
      mobile_app: false,
    },
    redirect_url: redirectUrl,
    timestamp: new Date().toISOString(),
  };

  const response = await checkoutRequest<RawTokenResponse>('/api/v1/access-token/checkout', body);
  const token =
    response?.token ||
    response?.result?.token ||
    response?.data?.token ||
    response?.data?.result?.token ||
    '';

  if (!token) {
    throw new ShiprocketError(
      response?.message || 'Shiprocket Checkout did not return an access token',
      'UPSTREAM_ERROR',
      502,
      response
    );
  }

  return { token, redirectUrl };
}

/**
 * Fetches details for a single SRC order by its Shiprocket order id (`oid`).
 *
 * @param orderId - the Shiprocket checkout order id.
 * @returns the normalized order.
 */
export async function getCheckoutOrderDetails(orderId: string): Promise<CheckoutOrder> {
  shiprocketLogger.info('order', 'Fetching checkout order details', { orderId });

  const response = await checkoutRequest<Record<string, unknown>>('/api/v1/custom-platform-order/details', {
    order_id: orderId,
    timestamp: new Date().toISOString(),
  });

  // The order payload may be nested under `data` / `result`.
  const raw = (response?.data ?? response?.result ?? response) as Record<string, unknown>;
  return parseCheckoutOrder(raw);
}

/**
 * Initiates a refund for an SRC order.
 *
 * @param orderId - platform_order_id OR fastrr_order_id.
 * @param amount - refund amount (> 0).
 */
export async function initiateCheckoutRefund(
  orderId: string,
  amount: number
): Promise<{ success: boolean; message: string }> {
  const response = await checkoutRequest<{ status?: string; message?: string }>(
    '/api/v1/external/refund/initiate',
    { order_id: orderId, amount }
  );
  return {
    success: /success|ok|initiated/i.test(String(response?.status ?? response?.message ?? '')),
    message: String(response?.message ?? 'Refund requested'),
  };
}

/**
 * Verifies an inbound SRC order webhook.
 *
 * Shiprocket's order webhook does not always send a signature. When a webhook
 * secret is configured we verify the `X-Api-HMAC-SHA256` header against the raw
 * body; otherwise we accept the call (and log a warning).
 *
 * @param rawBody - the exact raw request body string.
 * @param hmacHeader - value of the `X-Api-HMAC-SHA256` header (if any).
 * @returns whether the webhook is authentic.
 */
export function verifyCheckoutWebhook(rawBody: string, hmacHeader: string | null): boolean {
  const secret = shiprocketCheckoutConfig.webhookSecret;
  if (!secret) {
    shiprocketLogger.warn('webhook', 'SHIPROCKET_CHECKOUT_WEBHOOK_SECRET not set – skipping verification');
    return true;
  }
  if (!hmacHeader) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(hmacHeader);
  if (expectedBuf.length !== receivedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, receivedBuf);
}

/**
 * Normalizes a raw SRC order object (webhook payload or order-details response).
 */
export function parseCheckoutOrder(raw: Record<string, unknown>): CheckoutOrder {
  // custom_attributes we set at token creation may come back top-level or nested
  // under cart_data depending on the SRC payload (webhook vs order-details).
  const cartData = (raw.cart_data && typeof raw.cart_data === 'object' ? raw.cart_data : {}) as Record<
    string,
    unknown
  >;

  const items = Array.isArray(raw.cart_data)
    ? []
    : Array.isArray(cartData.items)
      ? (cartData.items as Array<Record<string, unknown>>).map((item) => {
          const catalog =
            item.catalog_data && typeof item.catalog_data === 'object'
              ? (item.catalog_data as Record<string, unknown>)
              : {};
          return {
            variantId: String(item.variant_id ?? ''),
            quantity: Number(item.quantity ?? 0),
            price: Number(item.price ?? catalog.price ?? 0) || 0,
            name: String(item.name ?? catalog.name ?? ''),
          };
        })
      : [];

  const payments = Array.isArray(raw.payments) ? (raw.payments as Array<Record<string, unknown>>) : [];
  const firstPayment = payments[0] ?? {};

  const customAttributes = ((raw.custom_attributes ?? cartData.custom_attributes) || {}) as Record<
    string,
    unknown
  >;
  const customUserId = String(
    customAttributes.user_id ?? customAttributes.userId ?? ''
  );

  // Prefer Shiprocket's shipping_charges; fall back to our injected delivery line
  // item when the hosted checkout treated shipping as a catalog product.
  const deliveryLine = items.find((item) =>
    CHECKOUT_DELIVERY_VARIANT_IDS.has(String(item.variantId || ''))
  );
  const shippingFromLine = deliveryLine
    ? (Number(deliveryLine.price) || 0) * Math.max(1, Number(deliveryLine.quantity) || 1)
    : 0;
  const shippingCharges =
    Number(raw.shipping_charges ?? cartData.shipping_charges ?? 0) || shippingFromLine || 0;

  return {
    orderId: String(raw.order_id ?? raw.platform_order_id ?? ''),
    platformOrderId: String(raw.platform_order_id ?? ''),
    fastrrOrderId: String(raw.fastrr_order_id ?? ''),
    status: String(raw.status ?? ''),
    source: String(raw.source ?? ''),
    paymentType: String(raw.payment_type ?? ''),
    paymentStatus: String(raw.payment_status ?? ''),
    paymentMethod: String(firstPayment.payment_method ?? firstPayment.gateway ?? ''),
    transactionId: String(firstPayment.pg_transaction_id ?? firstPayment.txn_id ?? ''),
    phone: String(raw.phone ?? ''),
    email: String(raw.email ?? ''),
    subtotal: Number(raw.subtotal_price ?? 0) || 0,
    totalDiscount: Number(raw.total_discount ?? 0) || 0,
    shippingCharges,
    codCharges: Number(raw.cod_charges ?? 0) || 0,
    totalPayable: Number(raw.total_amount_payable ?? 0) || 0,
    estimatedDelivery: String(raw.edd ?? ''),
    createdDate: String(raw.order_created_date ?? ''),
    items,
    shippingAddress: parseAddress(raw.shipping_address),
    billingAddress: parseAddress(raw.billing_address),
    customUserId,
  };
}

/** Normalizes an SRC address block. */
function parseAddress(value: unknown): CheckoutAddress | null {
  if (!value || typeof value !== 'object') return null;
  const a = value as Record<string, unknown>;
  return {
    firstName: String(a.first_name ?? ''),
    lastName: String(a.last_name ?? ''),
    phone: String(a.phone ?? ''),
    email: String(a.email ?? ''),
    line1: String(a.line1 ?? ''),
    line2: String(a.line2 ?? ''),
    city: String(a.city ?? ''),
    state: String(a.state ?? ''),
    pincode: String(a.pincode ?? ''),
    country: String(a.country ?? 'India'),
    countryCode: String(a.country_code ?? 'IN'),
    landmark: String(a.landmark ?? ''),
  };
}

/** Parses a JSON body, tolerating empty / non-JSON responses. */
async function safeJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

/** Extracts a human-readable message from varied SRC error shapes. */
function extractMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const record = payload as Record<string, unknown>;
  if (typeof record.message === 'string') return record.message;
  if (typeof record.error === 'string') return record.error;
  return undefined;
}
