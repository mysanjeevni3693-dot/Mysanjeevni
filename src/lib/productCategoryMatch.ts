/**
 * Helpers so products tagged via extraCategoryPaths / diseasePaths
 * appear under every selected category — not only the primary productType.
 */

function norm(value?: string | null): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function equalsIgnoreCase(a?: string | null, b?: string | null): boolean {
  const left = norm(a);
  const right = norm(b);
  return Boolean(left && right && left === right);
}

export type ProductCategoryLike = {
  productType?: string | null;
  category?: string | null;
  subcategory?: string | null;
  categories?: string[] | null;
  extraCategoryPaths?: string[][] | null;
  diseaseCategory?: string | null;
  diseaseSubcategory?: string | null;
  diseasePaths?: string[][] | null;
  benefit?: string | null;
};

/** Flatten all category-related labels on a product (primary + extras + disease). */
export function getProductCategoryLabels(product: ProductCategoryLike): string[] {
  const labels: string[] = [];
  const push = (value?: string | null) => {
    const trimmed = String(value || '').trim();
    if (trimmed) labels.push(trimmed);
  };

  push(product.productType);
  push(product.category);
  push(product.subcategory);
  push(product.diseaseCategory);
  push(product.diseaseSubcategory);
  push(product.benefit);

  if (Array.isArray(product.categories)) {
    for (const item of product.categories) push(item);
  }

  if (Array.isArray(product.extraCategoryPaths)) {
    for (const path of product.extraCategoryPaths) {
      if (!Array.isArray(path)) continue;
      for (const segment of path) push(segment);
    }
  }

  if (Array.isArray(product.diseasePaths)) {
    for (const path of product.diseasePaths) {
      if (!Array.isArray(path)) continue;
      for (const segment of path) push(segment);
    }
  }

  return labels;
}

/** True if any extraCategoryPaths row starts with the given product type. */
export function hasExtraProductType(product: ProductCategoryLike, productType: string): boolean {
  if (!Array.isArray(product.extraCategoryPaths)) return false;
  const target = norm(productType);
  return product.extraCategoryPaths.some(
    (path) => Array.isArray(path) && path[0] && norm(path[0]) === target
  );
}

/**
 * True if the product belongs to a top-level product type
 * (main productType OR an additional category path).
 */
export function productBelongsToProductType(
  product: ProductCategoryLike,
  productType: string
): boolean {
  if (!productType) return true;
  if (equalsIgnoreCase(product.productType, productType)) return true;
  if (hasExtraProductType(product, productType)) return true;

  // Also accept type name appearing anywhere in extra paths / categories.
  const target = norm(productType);
  return getProductCategoryLabels(product).some((label) => norm(label) === target);
}

/** Map common URL/nav category keys to Product.productType values. */
export const NAV_CATEGORY_TO_PRODUCT_TYPE: Record<string, string> = {
  medicines: 'Generic Medicine',
  'generic medicine': 'Generic Medicine',
  ayurveda: 'Ayurveda Medicine',
  ayurvedic: 'Ayurveda Medicine',
  'ayurveda medicine': 'Ayurveda Medicine',
  homeopathy: 'Homeopathy',
  nutrition: 'Nutrition',
  'organic products': 'Organic Products',
  personalcare: 'Personal Care',
  'personal care': 'Personal Care',
  fitness: 'Fitness',
  babycare: 'Baby Care',
  'baby care': 'Baby Care',
  sexualwellness: 'Sexual Wellness',
  'sexual wellness': 'Sexual Wellness',
  unani: 'Unani',
};

export function resolveProductTypeFromNavCategory(category?: string | null): string | undefined {
  if (!category) return undefined;
  return NAV_CATEGORY_TO_PRODUCT_TYPE[norm(category)] || NAV_CATEGORY_TO_PRODUCT_TYPE[String(category).trim().toLowerCase()];
}

export function productHasDiseaseTags(product: ProductCategoryLike): boolean {
  if (product.diseaseCategory || product.diseaseSubcategory) return true;
  if (equalsIgnoreCase(product.category, 'disease')) return true;
  if (Array.isArray(product.diseasePaths) && product.diseasePaths.some((p) => Array.isArray(p) && p.some(Boolean))) {
    return true;
  }
  return false;
}

export { equalsIgnoreCase, norm as normalizeCategoryToken };
