import mongoose from 'mongoose';
import dns from 'dns';

// Import all models to ensure they are registered
import { User } from './models/User';
import { Order } from './models/Order';
import { Product } from './models/Product';
import { Vendor } from './models/Vendor';
import { LabTestBooking } from './models/LabTestBooking';
import { Settlement } from './models/Settlement';
import { Wallet } from './models/Wallet';
import { Transaction } from './models/Transaction';
import { ReturnRequest } from './models/ReturnRequest';
import { VendorNotification } from './models/VendorNotification';
import { Commission } from './models/Commission';

// Ensure models are referenced so tree-shaking doesn't drop them.
void Settlement;
void Wallet;
void Transaction;
void ReturnRequest;
void VendorNotification;
void Commission;

/**
 * Convert mongodb+srv:// to mongodb:// with explicit hosts.
 * Uses dns.promises.Resolver (not global dns.resolveSrv) so Windows
 * can hit public DNS and avoid `querySrv ECONNREFUSED`.
 */
async function toDirectMongoUri(uri: string): Promise<string> {
  if (!uri.startsWith('mongodb+srv://')) return uri;

  try {
    dns.setDefaultResultOrder('ipv4first');
  } catch {
    // ignore
  }

  const resolver = new dns.promises.Resolver();
  resolver.setServers(['8.8.8.8', '1.1.1.1']);

  const parsed = new URL(uri.replace('mongodb+srv://', 'https://'));
  const hostname = parsed.hostname;
  const username = decodeURIComponent(parsed.username || '');
  const password = decodeURIComponent(parsed.password || '');
  const dbName = parsed.pathname && parsed.pathname !== '/' ? parsed.pathname : '/';

  const [srvRecords, txtRecords] = await Promise.all([
    resolver.resolveSrv(`_mongodb._tcp.${hostname}`),
    resolver.resolveTxt(hostname).catch(() => [] as string[][]),
  ]);

  if (!srvRecords?.length) {
    throw new Error(`No SRV records found for ${hostname}`);
  }

  const hosts = srvRecords
    .map((record) => `${record.name}:${record.port || 27017}`)
    .join(',');

  const txtFlat = (txtRecords || []).flat().join('&');
  const params = new URLSearchParams(parsed.searchParams);
  for (const part of txtFlat.split('&')) {
    const [key, value] = part.split('=');
    if (key && value && !params.has(key)) params.set(key, value);
  }
  if (!params.has('ssl') && !params.has('tls')) params.set('tls', 'true');
  if (!params.has('authSource')) params.set('authSource', 'admin');

  const auth =
    username || password
      ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
      : '';

  return `mongodb://${auth}${hosts}${dbName}?${params.toString()}`;
}

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongoose: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongoose ?? { conn: null, promise: null };
global.mongoose = cached;

export async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      serverSelectionTimeoutMS: 20000,
      socketTimeoutMS: 45000,
      family: 4 as const,
      maxPoolSize: 10,
    };

    cached.promise = (async () => {
      const uri = await toDirectMongoUri(MONGODB_URI as string);
      const m = await mongoose.connect(uri, opts);
      console.log('✅ MongoDB Connected');
      return m;
    })().catch((error) => {
      console.error('❌ MongoDB Connection Error:', error.message);
      cached.promise = null;
      throw error;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e: any) {
    cached.promise = null;
    console.error('DB Connection Failed:', e.message);
    throw new Error(`Failed to connect to MongoDB: ${e.message}`);
  }

  return cached.conn;
}
