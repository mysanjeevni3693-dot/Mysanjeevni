/**
 * Tests the Shiprocket shipping-API login using the EXACT credentials in
 * .env.local (SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD), so it validates the same
 * values the app will use.
 *
 * It also reports hidden problems (leading/trailing whitespace, length) WITHOUT
 * printing your actual password.
 *
 * Usage (from project root):
 *   node scripts/test-shiprocket-login.js
 */

const fs = require('fs');
const path = require('path');

function readEnv(key) {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return '';
  const line = fs
    .readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.trim().startsWith(`${key}=`));
  if (!line) return '';
  // Keep the raw value (do NOT trim) so we can detect stray whitespace.
  return line.slice(line.indexOf('=') + 1).replace(/^["']|["']$/g, '');
}

const email = readEnv('SHIPROCKET_EMAIL');
const password = readEnv('SHIPROCKET_PASSWORD');
const baseRaw = readEnv('SHIPROCKET_BASE_URL') || 'https://apiv2.shiprocket.in';
const base = baseRaw.replace(/\/+$/, '').endsWith('/v1/external')
  ? baseRaw.replace(/\/+$/, '')
  : `${baseRaw.replace(/\/+$/, '')}/v1/external`;

function describe(label, value) {
  const hasLeading = value !== value.replace(/^\s+/, '');
  const hasTrailing = value !== value.replace(/\s+$/, '');
  console.log(
    `${label}: length=${value.length}` +
      (hasLeading ? ' [LEADING WHITESPACE!]' : '') +
      (hasTrailing ? ' [TRAILING WHITESPACE!]' : '')
  );
}

console.log('--- Credential diagnostics (from .env.local) ---');
console.log('Email :', email || '(empty)');
describe('Password', password);
console.log('Login URL:', `${base}/auth/login`);

if (!email || !password) {
  console.error('\nERROR: SHIPROCKET_EMAIL or SHIPROCKET_PASSWORD is empty in .env.local');
  process.exit(1);
}

async function run() {
  // Send trimmed values (what a correct login needs) via a real JSON body.
  const body = JSON.stringify({ email: email.trim(), password: password.trim() });

  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body,
  });

  const text = await res.text();
  console.log('\n--- Shiprocket response ---');
  console.log('HTTP status:', res.status);

  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (json && json.token) {
    console.log('RESULT: ✅ SUCCESS — token received. Credentials are VALID.');
  } else {
    console.log('RESULT: ❌ FAILED');
    console.log('Message:', json.message || json.raw || text);
  }
}

run().catch((e) => {
  console.error('Network/error:', e.message);
  process.exit(1);
});
