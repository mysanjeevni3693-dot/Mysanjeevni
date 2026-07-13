/**
 * Generates the Shiprocket Checkout `X-Api-HMAC-SHA256` signature for a request
 * body, using SHIPROCKET_CHECKOUT_API_SECRET.
 *
 * The secret is read from the environment, falling back to `.env.local`, so it
 * never has to be typed on the command line.
 *
 * Usage (from the project root):
 *   node scripts/sign-checkout.js '{"ping":"test"}'
 *   node scripts/sign-checkout.js            # uses a sample cart body
 *
 * Whatever string you pass is signed and printed EXACTLY as-is, so it matches
 * the bytes you send as the HTTP body.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function readSecretFromEnvFile() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return '';
  const line = fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.trim().startsWith('SHIPROCKET_CHECKOUT_API_SECRET='));
  if (!line) return '';
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
}

const secret = process.env.SHIPROCKET_CHECKOUT_API_SECRET || readSecretFromEnvFile();

if (!secret) {
  console.error(
    'ERROR: SHIPROCKET_CHECKOUT_API_SECRET is not set (env var or .env.local).'
  );
  process.exit(1);
}

const sampleBody = JSON.stringify({
  cart_data: { items: [{ variant_id: '118', quantity: 1 }], mobile_app: false },
  redirect_url: 'https://mysanjeevni.com/checkout/success',
  timestamp: new Date().toISOString(),
});

const body = process.argv[2] ?? sampleBody;
const signature = crypto.createHmac('sha256', secret).update(body, 'utf8').digest('base64');

console.log('Body signed :', body);
console.log('X-Api-HMAC-SHA256:', signature);
