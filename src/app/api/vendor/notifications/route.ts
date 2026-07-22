/**
 * GET  /api/vendor/notifications — list notifications
 * PUT  /api/vendor/notifications — mark read (one or all)
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { VendorNotification } from '@/lib/models/VendorNotification';
import { requireVendorAuth, isAuthError } from '@/lib/vendorAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = requireVendorAuth(request);
    if (isAuthError(auth)) return auth;

    await connectDB();

    const unreadOnly = request.nextUrl.searchParams.get('unread') === 'true';
    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '30', 10), 100);

    const query: any = { vendorId: auth.vendorId };
    if (unreadOnly) query.isRead = false;

    const [notifications, unreadCount] = await Promise.all([
      VendorNotification.find(query).sort({ createdAt: -1 }).limit(limit).lean(),
      VendorNotification.countDocuments({ vendorId: auth.vendorId, isRead: false }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error: any) {
    console.error('Vendor notifications GET error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to load notifications' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = requireVendorAuth(request);
    if (isAuthError(auth)) return auth;

    await connectDB();
    const body = await request.json().catch(() => ({}));
    const { notificationId, markAll } = body;

    if (markAll) {
      await VendorNotification.updateMany(
        { vendorId: auth.vendorId, isRead: false },
        { $set: { isRead: true } }
      );
      return NextResponse.json({ message: 'All notifications marked as read' });
    }

    if (!notificationId) {
      return NextResponse.json({ error: 'notificationId or markAll required' }, { status: 400 });
    }

    const updated = await VendorNotification.findOneAndUpdate(
      { _id: notificationId, vendorId: auth.vendorId },
      { $set: { isRead: true } },
      { new: true }
    );

    if (!updated) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Marked as read', notification: updated });
  } catch (error: any) {
    console.error('Vendor notifications PUT error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update notification' }, { status: 500 });
  }
}
