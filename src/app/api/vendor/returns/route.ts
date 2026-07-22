/**
 * Vendor returns API — list / respond / escalate (own returns only).
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { ReturnRequest } from '@/lib/models/ReturnRequest';
import { Product } from '@/lib/models/Product';
import { requireVendorAuth, isAuthError } from '@/lib/vendorAuth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = requireVendorAuth(request);
    if (isAuthError(auth)) return auth;

    await connectDB();

    const status = (request.nextUrl.searchParams.get('status') || '').trim();
    const vendorId = auth.vendorId;

    // Own products (for legacy returns without vendorId stamped).
    const products = await Product.find({ vendorId }).select('_id name').lean();
    const productIds = products.map((p: any) => String(p._id));
    const productNames = products.map((p: any) => String(p.name || '').toLowerCase()).filter(Boolean);

    // UI "Pending" uses status=new; include under-review in that bucket.
    const statusFilter =
      status === 'new' || status === 'pending'
        ? { status: { $in: ['new', 'under-review'] } }
        : status && status !== 'all'
          ? { status }
          : {};

    const baseOr = {
      $or: [
        { vendorId },
        ...(productIds.length ? [{ productId: { $in: productIds } }] : []),
        ...(productNames.length
          ? [{ productName: { $in: products.map((p: any) => p.name) } }]
          : []),
      ],
    };

    const [requests, allForCounts] = await Promise.all([
      ReturnRequest.find({ ...baseOr, ...statusFilter }).sort({ createdAt: -1 }).lean(),
      ReturnRequest.find(baseOr).select('status').lean(),
    ]);

    const counts = {
      pending: 0,
      approved: 0,
      rejected: 0,
      completed: 0,
      escalated: 0,
      all: allForCounts.length,
    };
    for (const r of allForCounts as any[]) {
      const s = String(r.status || '');
      if (s === 'new' || s === 'under-review') counts.pending += 1;
      else if (s === 'approved') counts.approved += 1;
      else if (s === 'rejected') counts.rejected += 1;
      else if (s === 'completed') counts.completed += 1;
      else if (s === 'escalated') counts.escalated += 1;
    }

    return NextResponse.json({ requests, counts, total: requests.length });
  } catch (error: any) {
    console.error('Vendor returns GET error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to load returns' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = requireVendorAuth(request);
    if (isAuthError(auth)) return auth;

    await connectDB();
    const body = await request.json();
    const { returnId, action, vendorNote, vendorEvidenceUrl } = body;

    if (!returnId || !action) {
      return NextResponse.json({ error: 'returnId and action are required' }, { status: 400 });
    }

    const allowed = ['review', 'approve', 'reject', 'complete', 'escalate'];
    if (!allowed.includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const ret = await ReturnRequest.findById(returnId);
    if (!ret) {
      return NextResponse.json({ error: 'Return request not found' }, { status: 404 });
    }

    // Ownership check
    const vendorId = auth.vendorId;
    let owns = String(ret.vendorId || '') === vendorId;
    if (!owns && ret.productId) {
      const product = await Product.findById(ret.productId).select('vendorId');
      owns = product && String(product.vendorId) === vendorId;
    }
    if (!owns && ret.productName) {
      const product = await Product.findOne({ vendorId, name: ret.productName }).select('_id');
      owns = Boolean(product);
    }
    if (!owns) {
      return NextResponse.json({ error: 'Not authorized for this return' }, { status: 403 });
    }

    if (vendorNote !== undefined) ret.vendorNote = String(vendorNote).trim().slice(0, 1000);
    if (vendorEvidenceUrl !== undefined) ret.vendorEvidenceUrl = String(vendorEvidenceUrl).trim();
    ret.vendorRespondedAt = new Date();
    if (!ret.vendorId) ret.vendorId = vendorId;

    switch (action) {
      case 'review':
        ret.status = 'under-review';
        break;
      case 'approve':
        ret.status = 'approved';
        break;
      case 'reject':
        ret.status = 'rejected';
        break;
      case 'complete':
        ret.status = 'completed';
        break;
      case 'escalate':
        ret.status = 'escalated';
        ret.escalatedToAdmin = true;
        break;
    }

    await ret.save();

    return NextResponse.json({ message: 'Return updated', request: ret });
  } catch (error: any) {
    console.error('Vendor returns PUT error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update return' }, { status: 500 });
  }
}
