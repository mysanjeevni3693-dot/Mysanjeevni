type CategoryTreeNode = {
  name?: string;
  isActive?: boolean;
  children?: CategoryTreeNode[];
};

type CategoryProduct = {
  category?: string;
  subcategory?: string;
  categories?: string[];
};

function uniqueNames(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const value of values) {
    const trimmed = String(value || '').trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    names.push(trimmed);
  }
  return names;
}

export function findCategoryNode(nodes: CategoryTreeNode[] | undefined, name: string): CategoryTreeNode | null {
  if (!Array.isArray(nodes)) return null;
  const target = name.trim().toLowerCase();
  for (const node of nodes) {
    if (String(node?.name || '').trim().toLowerCase() === target) return node;
    const nested = findCategoryNode(node?.children, name);
    if (nested) return nested;
  }
  return null;
}

export function groupsFromCategoryNode(node: CategoryTreeNode | null): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const child of node?.children || []) {
    if (child?.isActive === false) continue;
    const name = String(child?.name || '').trim();
    if (!name) continue;
    const children = (child.children || [])
      .filter((item) => item?.isActive !== false)
      .map((item) => String(item?.name || '').trim())
      .filter(Boolean);
    if (children.length > 0) groups[name] = children;
  }
  return groups;
}

export function namesFromCategoryNode(node: CategoryTreeNode | null): string[] {
  const names: string[] = [];
  const walk = (current: CategoryTreeNode | null | undefined) => {
    for (const child of current?.children || []) {
      if (child?.isActive === false) continue;
      const name = String(child?.name || '').trim();
      if (name) names.push(name);
      walk(child);
    }
  };
  walk(node);
  return uniqueNames(names);
}

export function namesFromProducts(products: CategoryProduct[], productType: string): string[] {
  const skip = new Set(['all', productType.trim().toLowerCase()]);
  const values: string[] = [];
  for (const product of products) {
    if (product.category) values.push(product.category);
    if (product.subcategory) values.push(product.subcategory);
    if (Array.isArray(product.categories)) {
      product.categories.forEach((cat) => {
        if (cat) values.push(cat);
      });
    }
  }
  return uniqueNames(values).filter((name) => !skip.has(name.toLowerCase()));
}

export function buildStorefrontCategories(
  tree: CategoryTreeNode[] | undefined,
  productType: string,
  products: CategoryProduct[]
): { chips: string[]; groups: Record<string, string[]> } {
  const node = findCategoryNode(tree, productType);
  const groups = groupsFromCategoryNode(node);
  const chips = uniqueNames([...namesFromCategoryNode(node), ...namesFromProducts(products, productType)]);
  return { chips, groups };
}
