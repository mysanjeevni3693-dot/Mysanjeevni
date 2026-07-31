/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function loadEnv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function main() {
  const env = loadEnv(path.join(process.cwd(), '.env.local'));
  const key = (env.RESEND_API_KEY || '').trim();
  const from = (env.RESEND_FROM_EMAIL || '').trim();

  console.log('FROM=', from);
  console.log('KEY_PRESENT=', Boolean(key));

  if (!key) {
    console.log('RESULT=FAIL');
    console.log('ERROR_MSG=RESEND_API_KEY missing');
    process.exit(1);
  }

  const res = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${key}` },
  });
  const data = await res.json().catch(() => ({}));
  console.log('DOMAINS_HTTP=', res.status);

  if (!res.ok) {
    console.log('AUTH_OK=false');
    console.log('ERROR_NAME=', data?.name || data?.statusCode || 'unknown');
    console.log('ERROR_MSG=', data?.message || 'invalid or unauthorized API key');
    console.log('RESULT=FAIL');
    process.exit(1);
  }

  const list = (data.data || []).map((d) => ({ name: d.name, status: d.status }));
  console.log('DOMAINS=', JSON.stringify(list));

  const fromEmail = (from.match(/<([^>]+)>/) || [null, from])[1] || '';
  const domain = fromEmail.includes('@') ? fromEmail.split('@')[1].toLowerCase() : '';
  const verified = list.some(
    (d) => String(d.name).toLowerCase() === domain && String(d.status).toLowerCase() === 'verified'
  );

  console.log('FROM_DOMAIN=', domain);
  console.log('FROM_DOMAIN_VERIFIED=', verified);
  console.log('RESULT=', verified ? 'PASS' : 'FAIL');
  process.exit(verified ? 0 : 1);
}

main().catch((e) => {
  console.log('RESULT=FAIL');
  console.log('ERROR_MSG=', e.message);
  process.exit(1);
});
