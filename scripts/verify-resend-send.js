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
  const fromRaw = (env.RESEND_FROM_EMAIL || '').trim();
  const to = (env.ADMIN_EMAIL || '').trim();
  const from = fromRaw.includes('<') ? fromRaw : `MySanjeevni <${fromRaw || 'noreply@mysanjeevni.com'}>`;

  console.log('FROM=', from);
  console.log('TO_SET=', Boolean(to));
  console.log('KEY_PRESENT=', Boolean(key));

  if (!key || !to) {
    console.log('RESULT=FAIL');
    console.log('ERROR_MSG=Missing RESEND_API_KEY or ADMIN_EMAIL');
    process.exit(1);
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'MySanjeevani Resend delivery test',
      html: '<p>Resend test from MySanjeevani local verification.</p><p>If you received this, sending works.</p>',
    }),
  });

  const data = await res.json().catch(() => ({}));
  console.log('SEND_HTTP=', res.status);
  if (res.ok) {
    console.log('RESULT=PASS');
    console.log('MESSAGE_ID_SET=', Boolean(data.id));
  } else {
    console.log('RESULT=FAIL');
    console.log('ERROR_NAME=', data?.name || 'unknown');
    console.log('ERROR_MSG=', data?.message || JSON.stringify(data).slice(0, 300));
  }
}

main().catch((e) => {
  console.log('RESULT=FAIL');
  console.log('ERROR_MSG=', e.message);
});
