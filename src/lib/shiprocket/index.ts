/**
 * Public barrel for the Shiprocket integration.
 *
 * Import service functions from here for convenience, e.g.:
 *   import { checkServiceability, createShiprocketOrder } from '@/lib/shiprocket';
 *
 * NOTE: This module is server-only. Never import it from client components.
 */

export * from './types';
export * from './errors';
export {
  shiprocketConfig,
  hasShiprocketCredentials,
  shiprocketCheckoutConfig,
  hasShiprocketCheckoutCredentials,
} from './config';
export {
  createCheckoutToken,
  getCheckoutOrderDetails,
  initiateCheckoutRefund,
  verifyCheckoutWebhook,
  parseCheckoutOrder,
  signCheckoutBody,
} from './checkout';
export { getShiprocketToken, invalidateShiprocketToken } from './auth';
export { checkServiceability } from './serviceability';
export { createShiprocketOrder } from './order';
export { assignAwb, cancelShipment } from './shipment';
export { generatePickup } from './pickup';
export { generateLabel } from './label';
export { generateInvoice } from './invoice';
export { generateManifest } from './manifest';
export { trackShipment, mapShipmentStatus } from './tracking';
export { verifyWebhookSignature, parseWebhookEvent } from './webhook';
