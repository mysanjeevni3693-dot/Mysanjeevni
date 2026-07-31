import { Resend } from 'resend';

interface EmailOtpOptions {
  to: string;
  otp: string;
  type: 'reset' | 'verify';
  userName?: string;
}

interface OrderConfirmationOptions {
  to: string;
  customerName?: string;
  orderId: string;
  totalAmount: number;
  currencySymbol?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
  deliveryAddress?: {
    fullName?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
}

function sanitizeEnv(value?: string | null): string {
  return String(value || '')
    .trim()
    .replace(/^["']|["']$/g, '');
}

function getResendApiKey(): string {
  const apiKey = sanitizeEnv(process.env.RESEND_API_KEY);
  if (!apiKey) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }
  return apiKey;
}

function getFromAddress(): string {
  const fromEmail = sanitizeEnv(process.env.RESEND_FROM_EMAIL) || 'noreply@mysanjeevani.com';
  // Resend prefers "Name <email@domain>"
  if (fromEmail.includes('<')) return fromEmail;
  return `MySanjeevani <${fromEmail}>`;
}

function getResendClient(): Resend {
  return new Resend(getResendApiKey());
}

function getSiteUrl(): string {
  return (
    sanitizeEnv(process.env.NEXT_PUBLIC_SITE_URL) ||
    sanitizeEnv(process.env.NEXT_PUBLIC_APP_URL) ||
    'https://mysanjeevani.com'
  );
}

export async function sendOtpViaResend({
  to,
  otp,
  type,
  userName = 'User',
}: EmailOtpOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const resend = getResendClient();
    const subject = type === 'reset' ? 'Password Reset OTP - MySanjeevani' : 'Email Verification OTP - MySanjeevani';
    const emailTemplate = generateOtpEmailTemplate(otp, userName, type);

    const response = await resend.emails.send({
      from: getFromAddress(),
      to: sanitizeEnv(to),
      subject,
      html: emailTemplate,
    });

    if (response.error) {
      console.error('[Resend] OTP email failed:', response.error);
      return {
        success: false,
        error: response.error.message || 'Failed to send email',
      };
    }

    console.log('[Resend] OTP email sent:', { to: sanitizeEnv(to), id: response.data?.id, type });
    return {
      success: true,
      messageId: response.data?.id,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send OTP email';
    console.error('[Resend] OTP email exception:', message);
    return {
      success: false,
      error: message,
    };
  }
}

export async function sendOrderConfirmationEmail(
  options: OrderConfirmationOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const to = sanitizeEnv(options.to);
    if (!to || !to.includes('@')) {
      return { success: false, error: 'Valid customer email is required' };
    }

    const resend = getResendClient();
    const response = await resend.emails.send({
      from: getFromAddress(),
      to,
      subject: `Order Confirmed #${options.orderId} - MySanjeevani`,
      html: generateOrderConfirmationTemplate(options),
    });

    if (response.error) {
      console.error('[Resend] Order confirmation failed:', response.error);
      return {
        success: false,
        error: response.error.message || 'Failed to send order confirmation email',
      };
    }

    console.log('[Resend] Order confirmation sent:', { to, orderId: options.orderId, id: response.data?.id });
    return {
      success: true,
      messageId: response.data?.id,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send order confirmation email';
    console.error('[Resend] Order confirmation exception:', message);
    return {
      success: false,
      error: message,
    };
  }
}

function generateOtpEmailTemplate(
  otp: string,
  userName: string,
  type: 'reset' | 'verify'
): string {
  const title = type === 'reset' ? 'Password Reset Request' : 'Email Verification';
  const siteUrl = getSiteUrl();
  const resetUrl = `${siteUrl}/forgot-password`;
  const message =
    type === 'reset'
      ? 'You requested to reset your password. Use the OTP below on the password reset page to continue.'
      : 'Verify your email address using the OTP below.';
  const expiryTime = '10 minutes';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background:#f5f5f5; margin:0; padding:0;">
      <div style="max-width:600px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <div style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;padding:28px;text-align:center;">
          <h1 style="margin:0;font-size:24px;">${title}</h1>
        </div>
        <div style="padding:28px;color:#333;">
          <p>Hi ${escapeHtml(userName)},</p>
          <p style="color:#666;line-height:1.6;">${message}</p>
          <div style="background:#f0fdf4;border:2px solid #10b981;border-radius:8px;padding:20px;text-align:center;margin:24px 0;">
            <div style="font-size:12px;color:#059669;text-transform:uppercase;letter-spacing:1px;">Your One-Time Password</div>
            <div style="font-size:34px;font-weight:700;color:#10b981;letter-spacing:4px;font-family:monospace;margin:10px 0;">${escapeHtml(otp)}</div>
            <div style="font-size:12px;color:#dc2626;">This OTP will expire in ${expiryTime}</div>
          </div>
          ${
            type === 'reset'
              ? `<p style="text-align:center;margin:20px 0;">
                  <a href="${resetUrl}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">
                    Open Password Reset Page
                  </a>
                </p>
                <p style="font-size:12px;color:#666;word-break:break-all;">Or visit: ${resetUrl}</p>`
              : ''
          }
          <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 15px;border-radius:4px;font-size:13px;color:#92400e;">
            <strong>Important:</strong> Never share this OTP with anyone. MySanjeevani staff will never ask for your OTP.
          </div>
        </div>
        <div style="background:#f9fafb;padding:16px;text-align:center;font-size:12px;color:#666;border-top:1px solid #e5e7eb;">
          © ${new Date().getFullYear()} MySanjeevani. This is an automated email.
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateOrderConfirmationTemplate(options: OrderConfirmationOptions): string {
  const symbol = options.currencySymbol || '₹';
  const itemsHtml = (options.items || [])
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee;">${escapeHtml(item.name)}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${symbol}${Number(item.price).toFixed(2)}</td>
      </tr>`
    )
    .join('');

  const addr = options.deliveryAddress;
  const addressHtml = addr
    ? `${escapeHtml(addr.fullName || '')}<br/>
       ${escapeHtml(addr.addressLine1 || '')}${addr.addressLine2 ? `<br/>${escapeHtml(addr.addressLine2)}` : ''}<br/>
       ${escapeHtml(addr.city || '')}, ${escapeHtml(addr.state || '')} - ${escapeHtml(addr.pincode || '')}<br/>
       ${escapeHtml(addr.country || 'India')}<br/>
       Phone: ${escapeHtml(addr.phone || '')}`
    : 'As provided during checkout';

  const trackUrl = `${getSiteUrl()}/track?orderId=${encodeURIComponent(options.orderId)}`;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f5f5f5;margin:0;padding:0;">
      <div style="max-width:600px;margin:20px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <div style="background:linear-gradient(135deg,#10b981,#059669);color:#fff;padding:28px;text-align:center;">
          <h1 style="margin:0;font-size:24px;">Order Confirmed</h1>
          <p style="margin:8px 0 0;opacity:.95;">Thank you for shopping with MySanjeevani</p>
        </div>
        <div style="padding:28px;color:#333;">
          <p>Hi ${escapeHtml(options.customerName || 'Customer')},</p>
          <p style="color:#666;line-height:1.6;">Your order <strong>#${escapeHtml(options.orderId)}</strong> has been placed successfully.</p>

          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin:18px 0;">
            <div><strong>Payment:</strong> ${escapeHtml(options.paymentMethod || 'N/A')} (${escapeHtml(options.paymentStatus || 'pending')})</div>
            <div style="margin-top:6px;"><strong>Total:</strong> ${symbol}${Number(options.totalAmount || 0).toFixed(2)}</div>
          </div>

          ${
            itemsHtml
              ? `<table style="width:100%;border-collapse:collapse;margin:18px 0;">
                  <thead>
                    <tr>
                      <th style="text-align:left;padding:8px 0;border-bottom:2px solid #e5e7eb;">Item</th>
                      <th style="text-align:center;padding:8px 0;border-bottom:2px solid #e5e7eb;">Qty</th>
                      <th style="text-align:right;padding:8px 0;border-bottom:2px solid #e5e7eb;">Price</th>
                    </tr>
                  </thead>
                  <tbody>${itemsHtml}</tbody>
                </table>`
              : ''
          }

          <h3 style="margin:20px 0 8px;font-size:16px;">Delivery Address</h3>
          <p style="color:#555;line-height:1.6;margin:0;">${addressHtml}</p>

          <p style="text-align:center;margin:28px 0 8px;">
            <a href="${trackUrl}" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">
              View My Orders
            </a>
          </p>
        </div>
        <div style="background:#f9fafb;padding:16px;text-align:center;font-size:12px;color:#666;border-top:1px solid #e5e7eb;">
          © ${new Date().getFullYear()} MySanjeevani. This is an automated email.
        </div>
      </div>
    </body>
    </html>
  `;
}

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
