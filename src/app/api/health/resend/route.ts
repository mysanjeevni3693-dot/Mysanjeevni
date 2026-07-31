/**
 * GET /api/health/resend
 * Lightweight Resend configuration check (does not send email unless ?sendTo= is provided).
 * Admin-only when sendTo is used.
 */

import { NextRequest, NextResponse } from 'next/server';

function sanitizeEnv(value?: string | null): string {
  return String(value || '')
    .trim()
    .replace(/^["']|["']$/g, '');
}

export async function GET(request: NextRequest) {
  const apiKey = sanitizeEnv(process.env.RESEND_API_KEY);
  const fromEmail = sanitizeEnv(process.env.RESEND_FROM_EMAIL) || 'noreply@mysanjeevani.com';
  const sendTo = sanitizeEnv(request.nextUrl.searchParams.get('sendTo'));

  const status = {
    configured: Boolean(apiKey),
    apiKeyPresent: Boolean(apiKey),
    apiKeyPrefix: apiKey ? `${apiKey.slice(0, 5)}…` : null,
    fromEmail,
    domainHint: fromEmail.includes('@') ? fromEmail.split('@')[1] : null,
  };

  if (!sendTo) {
    return NextResponse.json({
      ok: status.configured,
      message: status.configured
        ? 'Resend env looks present. Append ?sendTo=you@email.com to send a test email.'
        : 'RESEND_API_KEY is missing. Set it in Hostinger env to the Token from Resend → API keys (not the key Name).',
      status,
    });
  }

  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: 'RESEND_API_KEY is not configured',
        status,
      },
      { status: 500 }
    );
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);
    const from = fromEmail.includes('<') ? fromEmail : `MySanjeevani <${fromEmail}>`;
    const result = await resend.emails.send({
      from,
      to: sendTo,
      subject: 'MySanjeevani Resend Test',
      html: `<p>This is a Resend connectivity test from MySanjeevani.</p><p>If you received this, email delivery is working.</p>`,
    });

    if (result.error) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error.message,
          details: result.error,
          status,
          hint:
            'If this says invalid API key, copy the Token (not Name) from https://resend.com/api-keys into RESEND_API_KEY on Hostinger and redeploy.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Test email sent to ${sendTo}`,
      messageId: result.data?.id,
      status,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || 'Resend test failed',
        status,
      },
      { status: 500 }
    );
  }
}
