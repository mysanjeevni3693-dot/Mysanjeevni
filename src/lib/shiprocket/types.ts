/**
 * Shared TypeScript interfaces and Zod validation schemas for the Shiprocket
 * integration. Every request that enters an API route is validated against one
 * of the Zod schemas defined here, and every module returns a strongly-typed
 * result. There are intentionally no `any` types in this file.
 */

import { z } from 'zod';

/* -------------------------------------------------------------------------- */
/*                               Authentication                               */
/* -------------------------------------------------------------------------- */

/** Raw response returned by Shiprocket's `/auth/login` endpoint. */
export interface ShiprocketLoginResponse {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  token: string;
  created_at: string;
}

/* -------------------------------------------------------------------------- */
/*                               Serviceability                               */
/* -------------------------------------------------------------------------- */

export const serviceabilitySchema = z.object({
  /** Destination pincode (6 digit Indian pincode). */
  deliveryPincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/u, 'Delivery pincode must be a valid 6-digit Indian pincode'),
  /** Optional origin pincode; defaults to the configured warehouse pincode. */
  pickupPincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/u, 'Pickup pincode must be a valid 6-digit Indian pincode')
    .optional(),
  /** Package weight in kilograms. */
  weight: z.number().positive().max(50).default(0.5),
  /** Whether Cash-on-Delivery is required for this order. */
  cod: z.boolean().default(false),
  /** Optional order declared value used for COD serviceability. */
  declaredValue: z.number().nonnegative().optional(),
});

export type ServiceabilityInput = z.infer<typeof serviceabilitySchema>;

/** A single normalized courier option returned by a serviceability check. */
export interface CourierOption {
  courierCompanyId: number;
  courierName: string;
  /** Total shipping charge (freight + COD) in INR. */
  rate: number;
  /** Estimated delivery date as reported by Shiprocket (may be empty). */
  estimatedDeliveryDate: string;
  /** Estimated number of days in transit. */
  estimatedDeliveryDays: string;
  /** Whether this courier supports COD for the requested route. */
  codAvailable: boolean;
  /** Courier performance rating (0-5) if provided. */
  rating: number;
}

/** Normalized serviceability response consumed by checkout. */
export interface ServiceabilityResult {
  serviceable: boolean;
  deliveryPincode: string;
  pickupPincode: string;
  /** Cheapest / recommended courier option, if any. */
  recommended: CourierOption | null;
  /** All available couriers sorted by rate ascending. */
  couriers: CourierOption[];
  codAvailable: boolean;
}

/* -------------------------------------------------------------------------- */
/*                                Order create                                */
/* -------------------------------------------------------------------------- */

const orderItemSchema = z.object({
  name: z.string().trim().min(1),
  sku: z.string().trim().min(1),
  units: z.number().int().positive(),
  sellingPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  tax: z.number().nonnegative().default(0),
  hsn: z.string().trim().optional().default(''),
});

export const createOrderSchema = z.object({
  /** Your internal order reference (e.g. the Mongo order _id). */
  orderId: z.string().trim().min(1),
  orderDate: z.string().trim().min(1),
  /** Payment mode as recognised by Shiprocket. */
  paymentMethod: z.enum(['Prepaid', 'COD']),
  billing: z.object({
    customerName: z.string().trim().min(1),
    lastName: z.string().trim().optional().default(''),
    address: z.string().trim().min(1),
    address2: z.string().trim().optional().default(''),
    city: z.string().trim().min(1),
    state: z.string().trim().min(1),
    country: z.string().trim().min(1).default('India'),
    pincode: z.string().trim().regex(/^\d{6}$/u, 'Billing pincode must be 6 digits'),
    email: z.string().trim().email(),
    phone: z.string().trim().min(10),
  }),
  items: z.array(orderItemSchema).min(1),
  subTotal: z.number().nonnegative(),
  shippingCharges: z.number().nonnegative().default(0),
  totalDiscount: z.number().nonnegative().default(0),
  /** Physical package dimensions (cm) and weight (kg). */
  dimensions: z
    .object({
      length: z.number().positive().default(10),
      breadth: z.number().positive().default(10),
      height: z.number().positive().default(10),
      weight: z.number().positive().default(0.5),
    })
    .default({ length: 10, breadth: 10, height: 10, weight: 0.5 }),
  comment: z.string().trim().optional().default(''),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/** Normalized result after creating a Shiprocket order. */
export interface CreateOrderResult {
  shiprocketOrderId: string;
  shipmentId: string;
  status: string;
  statusCode: number;
}

/* -------------------------------------------------------------------------- */
/*                                AWB / courier                               */
/* -------------------------------------------------------------------------- */

export const assignAwbSchema = z.object({
  shipmentId: z.string().trim().min(1),
  /** Optional specific courier id (otherwise Shiprocket auto-selects). */
  courierId: z.number().int().positive().optional(),
});

export type AssignAwbInput = z.infer<typeof assignAwbSchema>;

export interface AssignAwbResult {
  awbCode: string;
  courierName: string;
  courierCompanyId: number;
  shipmentId: string;
}

/* -------------------------------------------------------------------------- */
/*                          Pickup / label / invoice                          */
/* -------------------------------------------------------------------------- */

export const shipmentIdSchema = z.object({
  shipmentId: z.union([z.string().trim().min(1), z.array(z.string().trim().min(1)).min(1)]),
});

export type ShipmentIdInput = z.infer<typeof shipmentIdSchema>;

export interface PickupResult {
  pickupScheduled: boolean;
  pickupStatus: string;
  pickupTokenNumber: string;
  pickupDate: string;
}

export interface LabelResult {
  labelCreated: boolean;
  labelUrl: string;
}

export interface InvoiceResult {
  invoiceCreated: boolean;
  invoiceUrl: string;
}

export interface ManifestResult {
  manifestGenerated: boolean;
  manifestUrl: string;
}

/* -------------------------------------------------------------------------- */
/*                                  Tracking                                  */
/* -------------------------------------------------------------------------- */

export const trackSchema = z
  .object({
    awb: z.string().trim().min(1).optional(),
    shipmentId: z.string().trim().min(1).optional(),
    orderId: z.string().trim().min(1).optional(),
  })
  .refine((value) => Boolean(value.awb || value.shipmentId || value.orderId), {
    message: 'One of awb, shipmentId or orderId is required',
  });

export type TrackInput = z.infer<typeof trackSchema>;

/** Canonical shipment lifecycle states used across the app. */
export type ShipmentStatus =
  | 'PENDING'
  | 'PICKUP_SCHEDULED'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'RTO'
  | 'CANCELLED'
  | 'UNKNOWN';

/** A single tracking scan/checkpoint. */
export interface TrackingActivity {
  date: string;
  status: string;
  activity: string;
  location: string;
}

/** Normalized tracking response. */
export interface TrackingResult {
  awb: string;
  courierName: string;
  currentStatus: ShipmentStatus;
  rawStatus: string;
  estimatedDelivery: string;
  trackUrl: string;
  activities: TrackingActivity[];
}

/* -------------------------------------------------------------------------- */
/*                                  Cancel                                     */
/* -------------------------------------------------------------------------- */

export const cancelShipmentSchema = z.object({
  /** Shiprocket order id(s) to cancel. */
  orderIds: z.array(z.union([z.string(), z.number()])).min(1),
});

export type CancelShipmentInput = z.infer<typeof cancelShipmentSchema>;

export interface CancelShipmentResult {
  cancelled: boolean;
  message: string;
}

/* -------------------------------------------------------------------------- */
/*                                  Webhook                                    */
/* -------------------------------------------------------------------------- */

/** Normalized webhook event after parsing Shiprocket's payload. */
export interface WebhookEvent {
  awb: string;
  courierName: string;
  currentStatus: ShipmentStatus;
  rawStatus: string;
  shiprocketOrderId: string;
  shipmentId: string;
  estimatedDelivery: string;
  timestamp: string;
}

/* -------------------------------------------------------------------------- */
/*                       Shiprocket Checkout (SRC) types                       */
/* -------------------------------------------------------------------------- */

/**
 * Request our frontend sends to /api/shiprocket/checkout/token.
 *
 * We pass full `catalog_data` per item (name/price/image) so the checkout works
 * WITHOUT requiring a prior catalog sync to Shiprocket. `variantId` must be
 * unique per line item.
 */
export const checkoutTokenSchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.string().trim().min(1),
        quantity: z.number().int().positive(),
        price: z.number().nonnegative(),
        name: z.string().trim().min(1),
        imageUrl: z.string().trim().optional().default(''),
      })
    )
    .min(1),
  /** Cart currency — INR for India, USD (etc.) for international. */
  currency: z.string().trim().min(3).max(3).optional(),
  /** Optional fixed cart discount / coupon. */
  coupon: z
    .object({
      code: z.string().trim().min(1),
      amount: z.number().positive(),
    })
    .optional(),
  /** Optional custom attributes echoed back on the order. */
  customAttributes: z.record(z.string(), z.string()).optional(),
});

export type CheckoutTokenInput = z.infer<typeof checkoutTokenSchema>;

/** Result returned to the frontend after creating a checkout access token. */
export interface CheckoutTokenResult {
  token: string;
  redirectUrl: string;
}

/** Address block used in SRC order payloads. */
export interface CheckoutAddress {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  countryCode: string;
  landmark: string;
}

/** Normalized SRC order (from the order webhook or order-details API). */
export interface CheckoutOrder {
  orderId: string;
  platformOrderId: string;
  fastrrOrderId: string;
  status: string;
  source: string;
  paymentType: 'CASH_ON_DELIVERY' | 'PREPAID' | string;
  paymentStatus: string;
  paymentMethod: string;
  transactionId: string;
  phone: string;
  email: string;
  subtotal: number;
  totalDiscount: number;
  shippingCharges: number;
  codCharges: number;
  totalPayable: number;
  estimatedDelivery: string;
  createdDate: string;
  items: Array<{ variantId: string; quantity: number }>;
  shippingAddress: CheckoutAddress | null;
  billingAddress: CheckoutAddress | null;
  /** Our signed-in user id, stamped via custom_attributes at token creation. */
  customUserId: string;
}

export const checkoutOrderDetailsSchema = z.object({
  orderId: z.string().trim().min(1),
  // Optional signed-in user id so the success page can attribute (and persist)
  // the order to the correct customer even if the webhook was missed.
  userId: z.string().trim().optional(),
});

export type CheckoutOrderDetailsInput = z.infer<typeof checkoutOrderDetailsSchema>;
