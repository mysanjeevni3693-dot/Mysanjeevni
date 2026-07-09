/**
 * Centralized Shiprocket configuration.
 *
 * Reads credentials and settings from environment variables. These values are
 * server-only and must NEVER be imported into client components. Keeping all
 * env access in a single module makes the rest of the integration easy to test
 * and reason about (single source of truth).
 */

/**
 * Normalizes the Shiprocket API base URL.
 *
 * The env var `SHIPROCKET_BASE_URL` may be provided either as the bare host
 * (e.g. `https://apiv2.shiprocket.in`) or already including the API prefix.
 * Shiprocket's external REST API lives under `/v1/external`, so we always
 * return a URL that ends with that path (no trailing slash).
 */
function resolveBaseUrl(): string {
  const raw = (process.env.SHIPROCKET_BASE_URL || 'https://apiv2.shiprocket.in').trim();
  const withoutTrailingSlash = raw.replace(/\/+$/, '');

  if (withoutTrailingSlash.endsWith('/v1/external')) {
    return withoutTrailingSlash;
  }

  return `${withoutTrailingSlash}/v1/external`;
}

export const shiprocketConfig = {
  /** Shiprocket account email used for the login/token API. */
  email: process.env.SHIPROCKET_EMAIL || '',
  /** Shiprocket account password used for the login/token API. */
  password: process.env.SHIPROCKET_PASSWORD || '',
  /** Optional sales channel id used when creating adhoc orders. */
  channelId: process.env.SHIPROCKET_CHANNEL_ID || '',
  /** Normalized REST base url ending in `/v1/external`. */
  baseUrl: resolveBaseUrl(),
  /** Default pickup pincode used for serviceability + rate checks. */
  pickupPincode: process.env.SHIPROCKET_PICKUP_PINCODE || '110001',
  /** Human readable pickup location name registered in the Shiprocket panel. */
  pickupLocation: process.env.SHIPROCKET_PICKUP_LOCATION || 'Primary',
  /** Fallback flat shipping charge (INR) when serviceability lookup fails. */
  defaultShippingCharge: Number(process.env.DEFAULT_SHIPPING_CHARGE || 0) || 0,
  /** Optional shared secret used to authenticate incoming webhook calls. */
  webhookSecret: process.env.SHIPROCKET_WEBHOOK_SECRET || '',
} as const;

/**
 * Configuration for Shiprocket Checkout (SRC) — the hosted "fast checkout"
 * widget. This is a SEPARATE product from the shipping API above and uses its
 * own API key/secret (provided by the Shiprocket Checkout team) plus HMAC
 * request signing. Credentials are server-only.
 */
export const shiprocketCheckoutConfig = {
  /** Public API key for Shiprocket Checkout (sent as `X-Api-Key`). */
  apiKey: process.env.SHIPROCKET_CHECKOUT_API_KEY || '',
  /** Secret used to compute the `X-Api-HMAC-SHA256` request signature. */
  apiSecret: process.env.SHIPROCKET_CHECKOUT_API_SECRET || '',
  /** REST base url (prod default). Staging: https://fastrr-api-dev.pickrr.com */
  baseUrl: (process.env.SHIPROCKET_CHECKOUT_BASE_URL || 'https://checkout-api.shiprocket.com').replace(/\/+$/, ''),
  /**
   * Optional absolute success URL that Shiprocket redirects to after checkout
   * (`?oid=&ost=` are appended). When empty, the token route derives it from the
   * incoming request origin (works on any domain / Vercel / Hostinger).
   */
  redirectUrl: process.env.SHIPROCKET_CHECKOUT_REDIRECT_URL || '',
  /** Optional shared secret to verify inbound SRC order webhooks. */
  webhookSecret: process.env.SHIPROCKET_CHECKOUT_WEBHOOK_SECRET || '',
} as const;

/**
 * Returns true when the minimum credentials required to authenticate with
 * Shiprocket are present. Used to fail fast with a clear error message.
 */
export function hasShiprocketCredentials(): boolean {
  return Boolean(shiprocketConfig.email && shiprocketConfig.password);
}

/**
 * Returns true when Shiprocket Checkout (SRC) credentials are configured.
 */
export function hasShiprocketCheckoutCredentials(): boolean {
  return Boolean(shiprocketCheckoutConfig.apiKey && shiprocketCheckoutConfig.apiSecret);
}
