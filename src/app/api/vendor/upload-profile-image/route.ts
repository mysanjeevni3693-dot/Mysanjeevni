import { NextRequest, NextResponse } from 'next/server';
import { uploadImageBufferToCloudinary } from '@/lib/cloudinaryUtils';
import { requireVendorAuth, isAuthError } from '@/lib/vendorAuth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const auth = requireVendorAuth(request);
    if (isAuthError(auth)) return auth;

    const formData = await request.formData();
    const image = formData.get('image');

    if (!(image instanceof File)) {
      return NextResponse.json({ error: 'Image file required' }, { status: 400 });
    }

    if (!image.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Please select a valid image file' }, { status: 400 });
    }

    if (image.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image size must be less than 5MB' }, { status: 400 });
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const result = await uploadImageBufferToCloudinary(buffer, 'vendor-profiles');

    if (!result.success || !result.url) {
      return NextResponse.json(
        { error: result.error || 'Image upload failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      imageUrl: result.url,
      publicId: result.publicId,
    });
  } catch (error: any) {
    console.error('Vendor profile image upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Image upload failed' },
      { status: 500 }
    );
  }
}
