const fs = require('fs');
const path = require('path');

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.name === 'route.ts') acc.push(full);
  }
  return acc;
}

const root = path.join('src', 'app', 'api');
const files = walk(root);
const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const rows = [
  'Method\tEndpoint\tFull URL\tArea\tNotes',
];

const purposeHints = {
  auth: 'Authentication',
  admin: 'Admin panel (do not use in customer Android app)',
  vendor: 'Vendor panel',
  doctor: 'Doctor APIs',
  'doctor-consultation': 'Doctor booking',
  doctors: 'Public doctor list',
  products: 'Catalog',
  categories: 'Categories',
  orders: 'Orders',
  cart: 'Cart',
  payments: 'Payments',
  shiprocket: 'Shipping (mostly server/admin)',
  'lab-tests': 'Lab tests',
  'lab-test-bookings': 'Lab bookings',
  'lab-partners': 'Lab partners',
  user: 'User profile/support',
  wallet: 'Vendor wallet',
  wishlist: 'Wishlist',
  reviews: 'Reviews',
  addresses: 'Addresses',
  prescriptions: 'Prescriptions',
  notifications: 'Notifications',
  consultations: 'Consultations',
  agora: 'Video call token',
  currency: 'Currency',
  upload: 'File upload',
  health: 'Health check',
  seed: 'Dev/seed only',
};

for (const file of files) {
  let rel = path.relative(root, file).replace(/\\/g, '/');
  rel = rel.replace(/\/route\.ts$/, '').replace(/route\.ts$/, '');
  const apiPath = '/api/' + rel;
  const text = fs.readFileSync(file, 'utf8');
  const area = apiPath.split('/')[2] || 'root';
  const notes = purposeHints[area] || area;

  for (const method of methods) {
    const re = new RegExp(`export\\s+async\\s+function\\s+${method}\\b`);
    if (re.test(text)) {
      rows.push(
        [
          method,
          apiPath,
          `https://mysanjeevni.com${apiPath}`,
          area,
          notes,
        ].join('\t')
      );
    }
  }
}

fs.writeFileSync('ANDROID_API_CATALOG.tsv', rows.join('\n'), 'utf8');
console.log(`routes=${files.length} handlers=${rows.length - 1}`);
