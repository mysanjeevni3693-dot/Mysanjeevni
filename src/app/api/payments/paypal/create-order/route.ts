import { NextRequest, NextResponse } from 'next/server';
import { getPaypalAccessToken, getPaypalBaseUrl, getPaypalConfig } from '@/lib/paypal';

export async function POST(request: NextRequest) {
  try {
    const { amount, currency } = await request.json();

    if (!amount || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
    }

    const cfg = getPaypalConfig();
    if (!cfg.configured) {
      return NextResponse.json({ error: 'PayPal is not configured' }, { status: 500 });
    }

    const useCurrency = String(currency || cfg.currency || 'USD').toUpperCase();
    const normalizedAmount = Number(amount).toFixed(2);

    const accessToken = await getPaypalAccessToken();
    const response = await fetch(`${getPaypalBaseUrl()}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: useCurrency,
              value: normalizedAmount,
            },
          },
        ],
      }),
      cache: 'no-store',
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[PayPal create-order] failed', {
        status: response.status,
        currency: useCurrency,
        amount: normalizedAmount,
        mode: process.env.PAYPAL_MODE || 'sandbox',
        details: data,
      });
      return NextResponse.json(
        { error: data?.message || data?.name || 'Failed to create PayPal order', details: data },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId: data.id,
      currency: useCurrency,
      raw: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to create PayPal order' },
      { status: 500 }
    );
  }
}
