import { NextRequest, NextResponse } from 'next/server';
import { getPaypalAccessToken, getPaypalBaseUrl, getPaypalConfig } from '@/lib/paypal';

export async function POST(request: NextRequest) {
  try {
    const { orderID } = await request.json();

    if (!orderID) {
      return NextResponse.json({ error: 'orderID is required' }, { status: 400 });
    }

    const cfg = getPaypalConfig();
    if (!cfg.configured) {
      return NextResponse.json({ error: 'PayPal is not configured' }, { status: 500 });
    }

    const accessToken = await getPaypalAccessToken();
    const response = await fetch(`${getPaypalBaseUrl()}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[PayPal capture-order] failed', {
        status: response.status,
        orderID,
        mode: process.env.PAYPAL_MODE || 'sandbox',
        details: data,
      });
      return NextResponse.json(
        { error: data?.message || data?.name || 'Failed to capture PayPal order', details: data },
        { status: 500 }
      );
    }

    if (data?.status !== 'COMPLETED') {
      console.error('[PayPal capture-order] incomplete status', { orderID, status: data?.status, details: data });
      return NextResponse.json(
        { success: false, status: data?.status, error: 'PayPal payment was not completed', details: data },
        { status: 402 }
      );
    }

    return NextResponse.json({
      success: true,
      status: data?.status,
      capture: data,
    });
  } catch (error: any) {
    console.error('[PayPal capture-order] exception', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to capture PayPal order' },
      { status: 500 }
    );
  }
}
