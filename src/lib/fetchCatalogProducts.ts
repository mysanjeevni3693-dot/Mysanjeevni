export async function fetchAllCatalogProducts(search: Record<string, string> = {}): Promise<any[]> {
  const pageSize = 250;
  const collected: any[] = [];

  for (let page = 1; page <= 40; page += 1) {
    const params = new URLSearchParams({ ...search, limit: String(pageSize), page: String(page) });
    const response = await fetch(`/api/products?${params.toString()}`, { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || 'Failed to load products');
    }

    const batch = Array.isArray(data.products) ? data.products : [];
    collected.push(...batch);
    const total = Number(data?.pagination?.total ?? collected.length);
    if (batch.length === 0 || collected.length >= total) break;
  }

  return collected;
}
