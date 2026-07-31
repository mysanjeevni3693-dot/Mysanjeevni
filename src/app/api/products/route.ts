import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Product } from '@/lib/models/Product';
import { generateProductId } from '@/lib/utils/productIdGenerator';
import { detectUserCountry, convertPrice } from '@/lib/currencyUtils';
import { getCountryFromCookieHeader, isIndiaCountry } from '@/lib/countryPreference';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

async function fetchActiveVendorProducts(query: any, page: number, limit: number) {
  const pipeline: any[] = [
    { $match: query },
    {
      $lookup: {
        from: 'vendors',
        localField: 'vendorId',
        foreignField: '_id',
        as: 'vendor',
      },
    },
    { $unwind: { path: '$vendor', preserveNullAndEmptyArrays: true } },
    {
      $match: {
        $or: [
          { vendor: null },
          { 'vendor.isActive': true },
        ],
      },
    },
    { $sort: { createdAt: -1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    { $project: { vendor: 0 } },
  ];

  const products = await Product.aggregate(pipeline);
  return products;
}

async function countActiveVendorProducts(query: any) {
  const pipeline: any[] = [
    { $match: query },
    {
      $lookup: {
        from: 'vendors',
        localField: 'vendorId',
        foreignField: '_id',
        as: 'vendor',
      },
    },
    { $unwind: { path: '$vendor', preserveNullAndEmptyArrays: true } },
    {
      $match: {
        $or: [
          { vendor: null },
          { 'vendor.isActive': true },
        ],
      },
    },
    { $count: 'total' },
  ];

  const result = await Product.aggregate(pipeline);
  return result[0]?.total || 0;
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const category = request.nextUrl.searchParams.get('category');
    const search = request.nextUrl.searchParams.get('search');
    const healthConcern = request.nextUrl.searchParams.get('healthConcern');
    const productType = request.nextUrl.searchParams.get('productType');
    const potency = request.nextUrl.searchParams.get('potency');
    const quantityUnit = request.nextUrl.searchParams.get('quantityUnit');
    const subcategory = request.nextUrl.searchParams.get('subcategory');
    const brand = request.nextUrl.searchParams.get('brand');
    const diseaseCategory = request.nextUrl.searchParams.get('diseaseCategory');
    const diseaseSubcategory = request.nextUrl.searchParams.get('diseaseSubcategory');
    const quantity = request.nextUrl.searchParams.get('quantity');
    const name = request.nextUrl.searchParams.get('name');
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');

    const query: any = {
      isActive: true,
      $or: [{ approvalStatus: 'approved' }, { approvalStatus: { $exists: false } }],
    };

    // Add category filtering
    if (category) {
      query.$or.push({ category: category });
      query.$or.push({ categories: { $in: [category] } });
    }
    if (subcategory) query.subcategory = subcategory;
    if (brand) query.brand = { $regex: brand, $options: 'i' };
    if (productType) {
      // Match products by main productType OR by extraCategoryPaths first element
      query.$or = query.$or || [];
      query.$or.push({ productType: productType });
      // Check if extraCategoryPaths contains the requested product type as first element
      query.$or.push({ 'extraCategoryPaths.0': productType });
    }
    if (potency) query.potency = potency;
    if (quantityUnit) query.quantityUnit = quantityUnit;
    if (quantity) {
      const parsedQuantity = Number(quantity);
      if (!Number.isNaN(parsedQuantity)) query.quantity = parsedQuantity;
    }
    if (diseaseCategory) query.diseaseCategory = diseaseCategory;
    if (diseaseSubcategory) query.diseaseSubcategory = diseaseSubcategory;
    if (name) query.name = name;
    if (search) {
      const parsedSearchQuantity = Number(search);
      const searchOr: any[] = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
        { subcategory: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { potency: { $regex: search, $options: 'i' } },
        { quantityUnit: { $regex: search, $options: 'i' } },
        { diseaseCategory: { $regex: search, $options: 'i' } },
        { diseaseSubcategory: { $regex: search, $options: 'i' } },
      ];
      if (!Number.isNaN(parsedSearchQuantity)) {
        searchOr.push({ quantity: parsedSearchQuantity });
      }
      query.$or = [
        ...searchOr,
      ];
    }
    if (healthConcern) {
      query.healthConcerns = { $in: [healthConcern] };
    }

    const products = await fetchActiveVendorProducts(query, page, limit);
    const total = await countActiveVendorProducts(query);

    // Get user location for currency conversion
    const ip = request.headers.get('x-forwarded-for') ||
               request.headers.get('x-real-ip') ||
               '127.0.0.1';
    const acceptLanguage = request.headers.get('accept-language') || '';
    const preferredCountry = request.cookies.get('preferredCountry')?.value || getCountryFromCookieHeader(request.headers.get('cookie'));
    const userLocation = await detectUserCountry(ip as string, acceptLanguage, preferredCountry);

    // Convert prices for all products
    const productsWithConvertedPrices = await Promise.all(
      products.map(async (product) => {
        const productObj = typeof product.toObject === 'function' ? product.toObject() : product;
        const inIndia = userLocation.isIndia || isIndiaCountry(preferredCountry);
        const usdPrice = typeof productObj.usdPrice === 'number' ? productObj.usdPrice : undefined;
        const conversion = inIndia
          ? {
              convertedPrice: productObj.price,
              currency: 'INR' as const,
              symbol: '₹' as const,
              exchangeRate: 1,
            }
          : usdPrice !== undefined
            ? {
                convertedPrice: usdPrice,
                currency: 'USD' as const,
                symbol: '$' as const,
                exchangeRate: 1,
              }
            : await convertPrice(productObj.price, userLocation);

        const displayMrp = inIndia || productObj.mrp === undefined || productObj.mrp === null
          ? productObj.mrp
          : Math.round(productObj.mrp * conversion.exchangeRate * 100) / 100;

        return {
          ...productObj,
          displayCurrency: conversion.currency,
          displayPrice: conversion.convertedPrice,
          currency: conversion.currency,
          currencySymbol: conversion.symbol,
          displayMrp,
          originalPrice: productObj.price,
          exchangeRate: conversion.exchangeRate,
        };
      })
    );

    return NextResponse.json(
      {
        message: 'Products fetched successfully',
        products: productsWithConvertedPrices,
        userLocation,
        pagination: {
          total,
          page,
          pages: Math.ceil(total / limit),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Get products error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const {
      name,
      description,
      price,
      usdPrice,
      discount,
      category,
      brand,
      manufacturer,
      stock,
      healthConcerns,
      dosage,
      packaging,
      safetyInformation,
      specifications,
      requiresPrescription,
      image,
      images,
      icon,
      mrp,
      benefit,
      isActive,
      isPopular,
      popularSections,
      popularSection,
      productType,
      potency,
      quantity,
      quantityUnit,
      categories,
      categoryPath,
      extraCategoryPaths,
      diseasePaths,
      diseaseCategory,
      diseaseSubcategory,
      subcategory,
      shortDescription,
    } = body;

    const normalizedPotency = typeof potency === 'string' ? (potency.trim() || undefined) : potency;
    const normalizedQuantityUnit =
      typeof quantityUnit === 'string' ? (quantityUnit.trim() || 'None') : (quantityUnit || 'None');
    const normalizedProductType =
      typeof productType === 'string' ? (productType.trim() || undefined) : productType;
    
    // Handle new popularSections array (or fallback to legacy popularSection)
    const normalizedPopularSections =
      Array.isArray(popularSections) && popularSections.length > 0
        ? popularSections.filter((s) => ['Generic', 'Ayurveda', 'Homeopathy', 'LabTests'].includes(s))
        : (typeof popularSection === 'string' && ['Generic', 'Ayurveda', 'Homeopathy', 'LabTests'].includes(popularSection)
          ? [popularSection]
          : body.isPopularGeneric
            ? ['Generic']
            : body.isPopularAyurveda
              ? ['Ayurveda']
              : body.isPopularHomeopathy
                ? ['Homeopathy']
                : body.isPopularLabTests
                  ? ['LabTests']
                  : body.isPopular
                    ? ['Generic']
                    : []);
    
    const isPopularSectionSelected = normalizedPopularSections.length > 0;

    if (!name || !price || !category || usdPrice === undefined || usdPrice === null || isNaN(Number(usdPrice))) {
      return NextResponse.json(
        { error: 'Missing or invalid required fields' },
        { status: 400 }
      );
    }

    const normalizedImages = Array.isArray(images)
      ? images.map((url: unknown) => String(url || '').trim()).filter(Boolean).slice(0, 4)
      : [];
    const primaryImage =
      (typeof image === 'string' && image.trim()) || normalizedImages[0] || undefined;

    // Preserve rich-text HTML from the admin/vendor editors. For legacy plain
    // text (no tags), keep newline-separated bullets for consistent list rendering.
    const normalizeRichOrBulletText = (value: unknown): string | undefined => {
      if (typeof value !== 'string') return undefined;
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      if (trimmed.includes('<') && trimmed.includes('>')) return trimmed;
      const lines = trimmed
        .replace(/<br\s*\/?>/gi, '\n')
        .split(/\r\n|\n|\r|\u2028|\u2029/)
        .map((line) => line.replace(/^[-*•]\s*/, '').trim())
        .filter(Boolean);
      return lines.length > 0 ? lines.join('\n') : trimmed;
    };

    const product = await Product.create({
      _id: await generateProductId(),
      name,
      description,
      price,
      usdPrice: Number(usdPrice),
      discount,
      category,
      brand,
      manufacturer,
      stock,
      healthConcerns,
      dosage,
      packaging,
      safetyInformation: normalizeRichOrBulletText(safetyInformation),
      specifications: normalizeRichOrBulletText(specifications),
      requiresPrescription,
      image: primaryImage,
      images: normalizedImages,
      icon,
      mrp,
      benefit,
      isActive: isActive !== undefined ? isActive : true,
      popularSections: normalizedPopularSections,
      popularSection: normalizedPopularSections.length > 0 ? normalizedPopularSections[0] : 'None',
      isPopular: isPopular !== undefined ? isPopular : isPopularSectionSelected,
      isPopularGeneric: normalizedPopularSections.includes('Generic'),
      isPopularAyurveda: normalizedPopularSections.includes('Ayurveda'),
      isPopularHomeopathy: normalizedPopularSections.includes('Homeopathy'),
      isPopularLabTests: normalizedPopularSections.includes('LabTests'),
      productType: normalizedProductType || 'Generic Medicine',
      potency: normalizedPotency,
      quantity,
      quantityUnit: normalizedQuantityUnit,
      categories: Array.isArray(categories) ? categories : (categoryPath && Array.isArray(categoryPath) ? categoryPath : []),
      categoryPath: Array.isArray(categoryPath) ? categoryPath : (Array.isArray(categories) ? categories : []),
      extraCategoryPaths: Array.isArray(extraCategoryPaths) ? extraCategoryPaths : [],
      diseasePaths: Array.isArray(diseasePaths) ? diseasePaths : [],
      diseaseCategory: diseaseCategory || undefined,
      diseaseSubcategory: diseaseSubcategory || undefined,
      subcategory: subcategory || undefined,
      shortDescription: typeof shortDescription === 'string' ? shortDescription.trim() : undefined,
    });

    return NextResponse.json(
      {
        message: 'Product created successfully',
        product,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create product error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
