import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Product } from '@/lib/models/Product';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { id } = await params;
    const product = await Product.findById(id);
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    return NextResponse.json({ product });
  } catch (error) {
    console.error('Product GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { id } = await params;
    const body = await req.json();
    // Only validate usdPrice if it's being updated in this request
    if (body.hasOwnProperty('usdPrice')) {
      if (body.usdPrice === null || isNaN(Number(body.usdPrice))) {
        return NextResponse.json({ error: 'Invalid USD dollar price' }, { status: 400 });
      }
      body.usdPrice = Number(body.usdPrice);
    }
    const normalizedPotency =
      typeof body.potency === 'string' ? (body.potency.trim() || undefined) : body.potency;
    const normalizedQuantityUnit =
      typeof body.quantityUnit === 'string'
        ? (body.quantityUnit.trim() || 'None')
        : (body.quantityUnit || 'None');
    const normalizedProductType =
      typeof body.productType === 'string' ? (body.productType.trim() || undefined) : body.productType;
    const normalizedApprovalStatus =
      typeof body.approvalStatus === 'string'
        ? (body.approvalStatus.trim().toLowerCase() || undefined)
        : body.approvalStatus;
    const updated = await Product.findByIdAndUpdate(
      id,
      {
        ...body,
        potency: normalizedPotency,
        quantityUnit: normalizedQuantityUnit,
        productType: normalizedProductType,
        approvalStatus: normalizedApprovalStatus,
      },
      { new: true }
    );
    if (!updated) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    return NextResponse.json({ message: 'Product updated', product: updated });
  } catch (error) {
    console.error('Product PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { id } = await params;
    await Product.findByIdAndDelete(id);
    return NextResponse.json({ message: 'Product deleted' });
  } catch (error) {
    console.error('Product DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
