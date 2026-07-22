import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { connectDB } from '@/lib/db';
import { LabTestBooking } from '@/lib/models/LabTestBooking';
import { Product } from '@/lib/models/Product';
import { User } from '@/lib/models/User';
import { requireVendorAuth, isAuthError } from '@/lib/vendorAuth';

const JWT_SECRET = process.env.JWT_SECRET || 'MySanjeevni-secret-key-2024';

const ALLOWED_STATUSES = ['scheduled', 'completed', 'cancelled'] as const;

function getUserId(req: Request): string | null {
  const explicitUserId = req.headers.get('x-user-id')?.trim();
  if (explicitUserId) return explicitUserId;

  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET) as { userId?: string; id?: string; sub?: string };
    return decoded.userId || decoded.id || decoded.sub || null;
  } catch {
    return null;
  }
}

function requireVendorScope(req: Request): { vendorId: string } | NextResponse {
  const auth = requireVendorAuth(req as any);
  if (isAuthError(auth)) return auth;
  return { vendorId: auth.vendorId };
}

function normalizeStatus(value: string) {
  const normalized = String(value || '').trim().toLowerCase();
  return ALLOWED_STATUSES.includes(normalized as (typeof ALLOWED_STATUSES)[number]) ? normalized : '';
}

function parseDate(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function getVendorLabProductIds(vendorId: string) {
  const vendorProducts = await Product.find({ vendorId, productType: 'Lab Tests' }).select('_id');
  return vendorProducts.map((p) => String(p._id));
}

export async function GET(req: Request) {
  try {
    await connectDB();

    // Ensure User model is registered
    const { User: UserModel } = await import('@/lib/models/User');

    const { searchParams } = new URL(req.url);
    const scope = String(searchParams.get('scope') || 'me').trim().toLowerCase();
    const status = normalizeStatus(String(searchParams.get('status') || ''));
    const search = String(searchParams.get('search') || '').trim().toLowerCase();
    const fromDate = parseDate(searchParams.get('fromDate'));
    const toDate = parseDate(searchParams.get('toDate'));

    const query: Record<string, any> = {};

    if (scope === 'all') {
      // Admin scope: all bookings.
    } else if (scope === 'vendor') {
      const scoped = requireVendorScope(req);
      if (scoped instanceof NextResponse) return scoped;
      const vendorId = scoped.vendorId;

      const vendorProductIds = await getVendorLabProductIds(vendorId);
      if (vendorProductIds.length === 0) {
        return NextResponse.json({ bookings: [], total: 0, roleScope: 'vendor' });
      }

      query.testId = { $in: vendorProductIds };
      query.provider = 'local';
    } else {
      const userId = getUserId(req);
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      query.userId = userId;
    }

    if (status) {
      query.status = status;
    }

    if (fromDate || toDate) {
      query.collectionDate = {};
      if (fromDate) query.collectionDate.$gte = fromDate;
      if (toDate) query.collectionDate.$lte = toDate;
    }

    const bookings = await LabTestBooking.find(query)
      .sort({ createdAt: -1 })
      .populate('userId', 'fullName email phone');

    const mapped = bookings.filter((booking) => {
      if (!search) return true;

      const user: any = booking.userId;
      const haystack = [
        String(booking.testName || ''),
        String(booking.provider || ''),
        String(booking.status || ''),
        String(booking.providerStatus || ''),
        String(user?.fullName || ''),
        String(user?.email || ''),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(search);
    });

    return NextResponse.json({
      bookings: mapped,
      total: mapped.length,
      roleScope: scope,
    });
  } catch (error) {
    console.error('Lab booking history GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch lab booking history' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const scope = String(searchParams.get('scope') || '').trim().toLowerCase();
    const body = await req.json();

    const bookingId = String(body.bookingId || '').trim();
    const status = normalizeStatus(String(body.status || ''));

    if (!bookingId || !status) {
      return NextResponse.json({ error: 'bookingId and valid status are required' }, { status: 400 });
    }

    const booking = await LabTestBooking.findById(bookingId);
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (scope === 'vendor') {
      const scoped = requireVendorScope(req);
      if (scoped instanceof NextResponse) return scoped;
      const vendorId = scoped.vendorId;

      const vendorProductIds = await getVendorLabProductIds(vendorId);
      const canAccess = vendorProductIds.includes(String(booking.testId)) && booking.provider === 'local';
      if (!canAccess) {
        return NextResponse.json({ error: 'Forbidden for this booking' }, { status: 403 });
      }
    } else if (scope === 'me') {
      const userId = getUserId(req);
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (String(booking.userId) !== userId) {
        return NextResponse.json({ error: 'Forbidden for this booking' }, { status: 403 });
      }
    }

    booking.status = status;
    await booking.save();

    return NextResponse.json({ message: 'Booking status updated', booking });
  } catch (error) {
    console.error('Lab booking history PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update booking status' }, { status: 500 });
  }
}
