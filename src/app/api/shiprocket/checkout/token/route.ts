/**
 * POST /api/shiprocket/checkout/token
 *
 * Public endpoint called by the cart when the customer clicks "Checkout with
 * Shiprocket". It builds a signed Shiprocket Checkout (SRC) access token for the
 * cart and returns it to the browser, which then opens the checkout widget.
 *
 * The Shiprocket API key/secret never leave the server; only the short-lived
 * checkout token is returned to the client.
 */

import { NextRequest } from 'next/server';
import { checkoutTokenSchema } from '@/lib/shiprocket/types';
import { createCheckoutToken } from '@/lib/shiprocket/checkout';
import { shiprocketCheckoutConfig } from '@/lib/shiprocket/config';
import { ok, handleRouteError } from '@/lib/shiprocket/response';

export const dynamic = 'force-dynamic';

/**
 * Resolves the absolute success URL Shiprocket should redirect to. Prefers the
 * configured value; otherwise derives it from the request origin so it works on
 * any domain (localhost, Vercel preview, Hostinger prod).
 */
function resolveRedirectUrl(request: NextRequest): string {
  if (shiprocketCheckoutConfig.redirectUrl) return shiprocketCheckoutConfig.redirectUrl;

  const origin =
    request.headers.get('origin') ||
    `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host') || ''}`;

  return `${origin.replace(/\/+$/, '')}/checkout/success`;
}

export async function POST(request: NextRequest) {
  try {
    const input = checkoutTokenSchema.parse(await request.json().catch(() => ({})));
    const redirectUrl = resolveRedirectUrl(request);
    const result = await createCheckoutToken(input, redirectUrl);
    return ok(result);
  } catch (error) {
    return handleRouteError(error, 'order');
  }
}
