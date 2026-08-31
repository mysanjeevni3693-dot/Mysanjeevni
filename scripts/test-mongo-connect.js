const fs = require('fs');
const dns = require('dns');
const mongoose = require('mongoose');

dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const envText = fs.readFileSync('.env.local', 'utf8');
const match = envText.match(/^MONGODB_URI=(.*)$/m);
if (!match) {
  console.error('MONGODB_URI missing');
  process.exit(1);
}
let uri = match[1].trim();
if ((uri.startsWith('"') && uri.endsWith('"')) || (uri.startsWith("'") && uri.endsWith("'"))) {
  uri = uri.slice(1, -1);
}

console.log('URI scheme:', uri.slice(0, 20) + '...');

dns.resolveSrv('_mongodb._tcp.cluster0.m8uhmbj.mongodb.net', (err, addresses) => {
  console.log('SRV lookup:', err ? err.code || err.message : `ok (${addresses.length} hosts)`);
});

mongoose
  .connect(uri, {
    serverSelectionTimeoutMS: 25000,
    socketTimeoutMS: 45000,
    family: 4,
  })
  .then(async () => {
    console.log('CONNECTED');
    const ping = await mongoose.connection.db.admin().command({ ping: 1 });
    console.log('PING', ping);
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch((error) => {
    console.error('CONNECT FAIL:', error.name, error.message);
    process.exit(1);
  });
