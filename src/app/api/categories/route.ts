import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { CategoryNode } from '@/lib/models/CategoryNode';
import { getCategoryConfig, getCategoryTree } from '@/lib/categoryConfig';
import {
  FALLBACK_DISEASE_SUBCATEGORY_MAP,
  FALLBACK_SUBCATEGORY_MAP_BY_TYPE,
  FALLBACK_VENDOR_CATEGORY_MAP,
} from '@/lib/categoryDefaults';

async function ensureDefaultCategoryTree() {
  const count = await CategoryNode.countDocuments({});
  if (count > 0) return;

  const productRoot = await CategoryNode.create({
    name: 'Product Types',
    parentId: null,
    sortOrder: 0,
    isActive: true,
  });

  const diseaseRoot = await CategoryNode.create({
    name: 'Disease Categories',
    parentId: null,
    sortOrder: 1,
    isActive: true,
  });

  for (const [typeName, categories] of Object.entries(FALLBACK_VENDOR_CATEGORY_MAP)) {
    const typeNode = await CategoryNode.create({
      name: typeName,
      parentId: productRoot._id,
      sortOrder: 0,
      isActive: true,
    });

    for (const categoryName of categories) {
      const categoryNode = await CategoryNode.create({
        name: categoryName,
        parentId: typeNode._id,
        sortOrder: 0,
        isActive: true,
      });

      const subMap = FALLBACK_SUBCATEGORY_MAP_BY_TYPE[typeName as keyof typeof FALLBACK_SUBCATEGORY_MAP_BY_TYPE];
      const subcategories = subMap?.[categoryName as keyof typeof subMap] as string[] | undefined;
      if (!subcategories || subcategories.length === 0) continue;

      await CategoryNode.insertMany(
        subcategories.map((name) => ({
          name,
          parentId: categoryNode._id,
          sortOrder: 0,
          isActive: true,
        }))
      );
    }
  }

  for (const [diseaseCategory, diseaseSubcategories] of Object.entries(FALLBACK_DISEASE_SUBCATEGORY_MAP)) {
    const diseaseCategoryNode = await CategoryNode.create({
      name: diseaseCategory,
      parentId: diseaseRoot._id,
      sortOrder: 0,
      isActive: true,
    });

    await CategoryNode.insertMany(
      diseaseSubcategories.map((name) => ({
        name,
        parentId: diseaseCategoryNode._id,
        sortOrder: 0,
        isActive: true,
      }))
    );
  }
}

/**
 * Ensure Organic Products exists as its own Product Type (sibling of Nutrition, not under it).
 * Migrates any misplaced Organic Products node that was nested under Nutrition.
 * Idempotent — safe to run on every categories GET.
 */
async function ensureEssentialCategories() {
  const productRoot =
    (await CategoryNode.findOne({ name: 'Product Types', parentId: null })) ||
    (await CategoryNode.findOne({ name: 'Product Type', parentId: null }));
  if (!productRoot) return;

  // Hide legacy top-level "Medicines" / "Generic Medicine" product types from the tree
  // so storefront never resurfaces them (Disease is the public nav replacement).
  await CategoryNode.updateMany(
    {
      parentId: productRoot._id,
      name: { $in: ['Medicines', 'Medicine', 'Generic Medicine', 'Generic Medicines', 'Allopathic Medicines'] },
    },
    { $set: { isActive: false } }
  );

  const nutritionType = await CategoryNode.findOne({
    name: 'Nutrition',
    parentId: productRoot._id,
  });

  // Misplaced: Organic Products was previously nested under Nutrition — promote or remove.
  if (nutritionType) {
    const nestedOrganic = await CategoryNode.findOne({
      name: 'Organic Products',
      parentId: nutritionType._id,
    });
    if (nestedOrganic) {
      const existingTopLevel = await CategoryNode.findOne({
        name: 'Organic Products',
        parentId: productRoot._id,
      });
      if (existingTopLevel) {
        // Move children to the top-level type, then remove the nested duplicate.
        await CategoryNode.updateMany(
          { parentId: nestedOrganic._id },
          { parentId: existingTopLevel._id }
        );
        await CategoryNode.findByIdAndDelete(nestedOrganic._id);
      } else {
        nestedOrganic.parentId = productRoot._id;
        nestedOrganic.isActive = true;
        await nestedOrganic.save();
      }
    }
  }

  let organicType = await CategoryNode.findOne({
    name: 'Organic Products',
    parentId: productRoot._id,
  });

  if (!organicType) {
    organicType = await CategoryNode.create({
      name: 'Organic Products',
      parentId: productRoot._id,
      sortOrder: 6,
      isActive: true,
    });
  } else if (organicType.isActive === false) {
    organicType.isActive = true;
    await organicType.save();
  }

  const organicCategories =
    FALLBACK_VENDOR_CATEGORY_MAP['Organic Products'] ||
    (['Organic Foods', 'Coffee & Tea', 'Ghee', 'Atta/Flour'] as const);

  for (const categoryName of organicCategories) {
    let categoryNode = await CategoryNode.findOne({
      name: categoryName,
      parentId: organicType._id,
    });
    if (!categoryNode) {
      categoryNode = await CategoryNode.create({
        name: categoryName,
        parentId: organicType._id,
        sortOrder: 0,
        isActive: true,
      });
    } else if (categoryNode.isActive === false) {
      categoryNode.isActive = true;
      await categoryNode.save();
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    await ensureDefaultCategoryTree();
    await ensureEssentialCategories();

    const mode = request.nextUrl.searchParams.get('mode');
    if (mode === 'config') {
      const config = await getCategoryConfig();
      return NextResponse.json({ success: true, config });
    }

    const tree = await getCategoryTree();
    return NextResponse.json({ success: true, tree });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const name = String(body?.name || '').trim();
    const parentId = body?.parentId ? String(body.parentId) : null;
    const sortOrder = Number(body?.sortOrder || 0);

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    if (parentId) {
      const parent = await CategoryNode.findById(parentId);
      if (!parent) {
        return NextResponse.json(
          { success: false, error: 'Parent category not found' },
          { status: 404 }
        );
      }
    }

    const created = await CategoryNode.create({ name, parentId, sortOrder, isActive: true });

    return NextResponse.json({ success: true, category: created }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to create category' },
      { status: 500 }
    );
  }
}
