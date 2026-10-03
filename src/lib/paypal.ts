export function getPaypalMode() {
  return (process.env.PAYPAL_MODE || 'live').toLowerCase() === 'sandbox' ? 'sandbox' : 'live';
}

export function getPaypalBaseUrl() {
  return getPaypalMode() === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

export function getPaypalConfig() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  const currency = (process.env.PAYPAL_CURRENCY || 'USD').toUpperCase();

  return {
    clientId,
    clientSecret,
    webhookId,
    currency,
    mode: getPaypalMode(),
    configured: Boolean(clientId && clientSecret),
  };
}

export async function getPaypalAccessToken() {
  const { clientId, clientSecret } = getPaypalConfig();

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials are not configured');
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(`${getPaypalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get PayPal access token: ${text}`);
  }

  const data = await response.json();
  if (!data?.access_token) {
    throw new Error('PayPal access token missing in response');
  }

  return data.access_token as string;
}
