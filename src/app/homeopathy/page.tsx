'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { usePreferredCountry } from '@/lib/usePreferredCountry';
import { addToCartUtil } from '@/lib/cartUtils';
import { productBelongsToProductType } from '@/lib/productCategoryMatch';
import { fetchAllCatalogProducts } from '@/lib/fetchCatalogProducts';
import { buildStorefrontCategories } from '@/lib/storefrontCategories';

interface HomeopathyProduct {
  _id: number;
  name: string;
  brand?: string;
  category: string;
  subcategory?: string;
  price: number;
  displayPrice?: number;
  mrp?: number;
  displayMrp?: number;
  discount?: number;
  icon?: string;
  image?: string;
  rating?: number;
  reviews?: number;
  description?: string;
  benefit?: string;
  productType?: string;
  potency?: string;
  diseaseCategory?: string;
  diseaseSubcategory?: string;
  quantity?: number;
  quantityUnit?: string;
  healthConcerns?: string[];
  stock?: number;
  currencySymbol?: '₹' | '$';
  currency?: 'INR' | 'USD';
}

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'rating', label: 'Highest Rated' },
];

function normalizeText(value?: string) {
  return (value || '').trim().toLowerCase();
}

function equalsIgnoreCase(left?: string, right?: string) {
  return normalizeText(left) === normalizeText(right);
}

function getHomeopathyFilterTargets(categoryName: string, groups: Record<string, string[]>): string[] {
  if (!categoryName || categoryName === 'All') return [];

  for (const [groupName, items] of Object.entries(groups)) {
    if (equalsIgnoreCase(groupName, categoryName)) {
      return [groupName, ...items];
    }
  }

  return [HOMEOPATHY_CATEGORY_ALIASES[categoryName.trim().toLowerCase()] || categoryName];
}

function homeopathyProductMatchesCategory(
  product: HomeopathyProduct,
  categoryName: string,
  groups: Record<string, string[]>
): boolean {
  const targets = getHomeopathyFilterTargets(categoryName, groups);
  if (targets.length === 0) return true;

  const fields = [
    product.category,
    product.subcategory,
    product.brand,
    ...(Array.isArray((product as HomeopathyProduct & { extraCategoryPaths?: string[][] }).extraCategoryPaths)
      ? (product as HomeopathyProduct & { extraCategoryPaths?: string[][] }).extraCategoryPaths!.flat()
      : []),
  ].filter(Boolean) as string[];

  return targets.some((target) => fields.some((field) => equalsIgnoreCase(field, target)));
}

const HOMEOPATHY_CATEGORY_ALIASES: Record<string, string> = {
  'dr. reckeweg (germany)': 'Dr. Reckeweg',
  'willmar schwabe (germany)': 'Willmar Schwabe',
  'willmar schwabe india': 'Schwabe India',
  bjain: 'Bjain',
  'millesimal lm potency': 'Milleimal LM Potency',
};

function HomeopathyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isIndia } = usePreferredCountry();
  const urlCategory = searchParams.get('category') || '';
  const urlSearch = searchParams.get('search') || '';
  const productsSectionRef = useRef<HTMLDivElement | null>(null);
  const hasAutoScrolledRef = useRef(false);

  const [products, setProducts] = useState<HomeopathyProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortOrder, setSortOrder] = useState('featured');

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [categoryGroups, setCategoryGroups] = useState<Record<string, string[]>>({});
  const [categoryChips, setCategoryChips] = useState<string[]>([]);

  const categories = useMemo(() => ['All', ...categoryChips], [categoryChips]);

  useEffect(() => {
    const normalizedCategory = HOMEOPATHY_CATEGORY_ALIASES[urlCategory.trim().toLowerCase()] || urlCategory;
    setSelectedCategory(normalizedCategory || 'All');
    setSearch(urlSearch);
    hasAutoScrolledRef.current = false;
  }, [urlCategory, urlSearch]);

  const filteredProducts = useMemo(() => {
    let result = products.filter((product) => {
      const matchesCategory =
        selectedCategory === 'All' || homeopathyProductMatchesCategory(product, selectedCategory, categoryGroups);

      const searchText = search.trim().toLowerCase();
      const concatenatedHealthConcerns = Array.isArray(product.healthConcerns) ? product.healthConcerns.join(' ') : '';
      const matchesSearch =
        !searchText ||
        product.name.toLowerCase().includes(searchText) ||
        (product.brand || '').toLowerCase().includes(searchText) ||
        (product.description || '').toLowerCase().includes(searchText) ||
        (product.category || '').toLowerCase().includes(searchText) ||
        (product.subcategory || '').toLowerCase().includes(searchText) ||
        (product.benefit || '').toLowerCase().includes(searchText) ||
        (product.productType || '').toLowerCase().includes(searchText) ||
        (product.potency || '').toLowerCase().includes(searchText) ||
        (product.diseaseCategory || '').toLowerCase().includes(searchText) ||
        (product.diseaseSubcategory || '').toLowerCase().includes(searchText) ||
        String(product.quantity || '').toLowerCase().includes(searchText) ||
        (product.quantityUnit || '').toLowerCase().includes(searchText) ||
        concatenatedHealthConcerns.toLowerCase().includes(searchText);

      return matchesCategory && matchesSearch;
    });

    // Apply sorting
    if (sortOrder === 'price-low') result.sort((a, b) => a.price - b.price);
    else if (sortOrder === 'price-high') result.sort((a, b) => b.price - a.price);
    else if (sortOrder === 'rating') result.sort((a, b) => (b.rating || 0) - (a.rating || 0));

    return result;
  }, [products, selectedCategory, search, sortOrder, categoryGroups]);

  useEffect(() => {
    if (loading) return;
    if (!urlCategory && !urlSearch) return;
    if (hasAutoScrolledRef.current) return;

    const section = productsSectionRef.current;
    if (!section) return;

    hasAutoScrolledRef.current = true;
    window.requestAnimationFrame(() => {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [loading, urlCategory, urlSearch, filteredProducts.length]);

  useEffect(() => {
    const fetchHomeopathyProducts = async () => {
      setLoading(true);
      setError('');

      try {
        const [list, categoryResponse] = await Promise.all([
          fetchAllCatalogProducts({ productType: 'Homeopathy' }),
          fetch('/api/categories', { cache: 'no-store' }),
        ]);
        const categoryData = await categoryResponse.json().catch(() => ({}));
        const tree = Array.isArray(categoryData?.tree) ? categoryData.tree : [];
        const homeopathyProducts = list.filter((product: HomeopathyProduct) =>
          productBelongsToProductType(product, 'Homeopathy')
        );
        const { chips, groups } = buildStorefrontCategories(tree, 'Homeopathy', homeopathyProducts);

        setProducts(homeopathyProducts);
        setCategoryChips(chips);
        setCategoryGroups(groups);
      } catch (err: any) {
        setProducts([]);
        const message = String(err?.message || '');
        setError(
          /mongodb|connect|ECONNREFUSED|Internal server/i.test(message)
            ? 'Unable to reach the database right now. Please restart the dev server and try again.'
            : message || 'Unable to load products right now.'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchHomeopathyProducts();
  }, []);

  const redirectToLogin = () => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    router.push(`/login?redirect=${encodeURIComponent(returnTo)}`);
  };

  const addToCart = (product: HomeopathyProduct) => {
    const result = addToCartUtil(product);
    if (result) {
      setCart((prev) => ({ ...prev, [product._id]: (prev[product._id] || 0) + 1 }));
    } else {
      console.error('Failed to add product to cart:', product._id);
      alert('Failed to add product to cart. Please try again.');
    }
  };

  const handleBuyNow = (product: HomeopathyProduct) => {
    const token = localStorage.getItem('token');
    if (!token) {
      redirectToLogin();
      return;
    }

    addToCart(product);
    router.push('/cart');
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-pink-50 via-rose-50 to-white flex flex-col">
      <Header />

      {/* Hero */}
      <div className="w-full -mt-48">
        <img src="/HB.png" alt="Homeopathy Store" className="w-full h-auto object-cover block" />
      </div>

      {/* Search & Filter Bar */}
      <div className="sticky top-17 md:top-0 z-30 bg-white border-b border-pink-200 shadow-sm -mt-40">
        <div className="max-w-7xl mx-auto px-4 py-1">
          <div className="flex flex-col gap-7 md:gap-4 md:flex-row md:items-center md:justify-between">
            {/* Search Bar */}
            <div className="flex-1 md:mr-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 Search homeopathy remedies, brands, benefits..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full border-2 border-pink-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent transition text-sm placeholder:text-gray-700"
                />
              </div>
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="mt-3 md:mt-0 w-full md:w-auto border-2 border-pink-200 rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-pink-400 transition text-sm font-medium text-gray-700"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Horizontal Category Scroll */}
        <div className="max-w-7xl mx-auto px-4 pb-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`whitespace-nowrap px-4 py-2 rounded-full font-medium text-sm transition-all shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-pink-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-pink-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div id="products-section" ref={productsSectionRef} className="flex-1 max-w-7xl mx-auto px-4 py-10 w-full">
        {/* Results Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {selectedCategory === 'All' ? '🌸 All Homeopathy Remedies' : `${selectedCategory}`}
              </h1>
              <p className="text-gray-600 mt-1 text-sm">
                {filteredProducts.length} {filteredProducts.length === 1 ? 'remedy' : 'remedies'} available
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-pink-100 p-4 shadow-sm animate-pulse"
              >
                <div className="h-40 bg-linear-to-br from-pink-100 to-rose-100 rounded-xl mb-4" />
                <div className="h-4 bg-gray-200 rounded mb-3 w-3/4" />
                <div className="h-3 bg-gray-200 rounded mb-2 w-full" />
                <div className="h-3 bg-gray-200 rounded mb-4 w-1/2" />
                <div className="h-10 bg-pink-100 rounded-lg" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-6 text-sm">
            <p className="font-semibold mb-1">⚠️ Error Loading Products</p>
            <p>{error}</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 bg-white border-2 border-dashed border-pink-200 rounded-3xl shadow-sm">
            <div className="text-7xl mb-4 opacity-50">🌸</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No remedies found</h3>
            <p className="text-gray-600 mb-6">
              {search
                ? `We couldn't find any remedies matching "${search}"`
                : 'No remedies available in this category'}
            </p>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="px-6 py-2 bg-pink-500 text-white rounded-lg font-medium hover:bg-pink-600 transition"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Products Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map((product, index) => {
                const productDiscount = isIndia && product.mrp && product.mrp > product.price
                  ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
                  : product.discount || 0;
                const productId = product._id !== undefined && product._id !== null ? String(product._id) : null;
                const cardKey = productId || `${product.name || 'homeopathy-product'}-${index}`;

                return (
                  <article
                    key={cardKey}
                    className="group w-full max-w-56 mx-auto bg-white/95 border border-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition duration-300 cursor-pointer"
                    onClick={() => {
                      if (productId) {
                        router.push(`/medicines/${productId}`);
                      }
                    }}
                  >
                    {/* Image Container */}
                    <div className="relative h-40 bg-linear-to-br from-white to-slate-50 flex items-center justify-center overflow-hidden">
                      <span className="absolute top-3 left-3 rounded-full px-2.5 py-1 text-[10px] font-bold bg-amber-600 text-white">
                        Popular
                      </span>
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="h-full w-full object-contain p-3 group-hover:scale-105 transition duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-5xl group-hover:scale-105 transition duration-300">
                          {product.icon || '🌸'}
                        </span>
                      )}

                      <div className="absolute inset-0 flex items-start justify-end p-3 pointer-events-none">
                        {!!productDiscount && isIndia && (
                          <span className="text-[11px] font-bold text-emerald-600">
                            {productDiscount}% OFF
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-3 flex flex-col flex-1">
                      <p className="font-medium text-slate-500 mb-1 uppercase tracking-wide text-[10px]">
                        {product.brand || 'MySanjeevni'}
                      </p>
                      <h3 className="font-bold text-slate-900 line-clamp-2 mb-2 text-xs min-h-8">{product.name}</h3>

                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1">
                          <span className="text-amber-500">★</span>
                          <span className="text-xs font-semibold text-slate-900">{Number(product.rating || 0).toFixed(1)}</span>
                          <span className="text-xs text-slate-500">({product.reviews || 0})</span>
                        </div>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                            (product.stock || 0) > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {(product.stock || 0) > 0 ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </div>

                      <div className="mb-2 flex items-end justify-between">
                        <div className="flex items-baseline gap-2">
                          <span className="text-base font-black text-slate-900">{product.currencySymbol || '₹'}{product.displayPrice ?? product.price}</span>
                        {isIndia && (product.displayMrp ?? product.mrp) && (product.displayMrp ?? product.mrp)! > (product.displayPrice ?? product.price) && (
                            <span className="text-xs text-slate-400 line-through">{product.currencySymbol || '₹'}{product.displayMrp ?? product.mrp}</span>
                        )}
                        </div>
                        {(product.displayMrp ?? product.mrp) && (product.displayMrp ?? product.mrp)! > (product.displayPrice ?? product.price) && (
                          <span className="text-[11px] font-bold text-emerald-600">{productDiscount}% OFF</span>
                        )}
                      </div>

                      <div className="flex gap-2 mt-auto">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(product);
                          }}
                          disabled={(product.stock || 0) <= 0}
                          className={`flex-1 rounded-lg font-bold transition py-1.5 text-[11px] ${
                            (product.stock || 0) <= 0
                              ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                              : cart[product._id]
                                ? 'bg-slate-700 text-white hover:bg-slate-800'
                                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {cart[product._id] ? '✓ In Cart' : 'Add to Cart'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBuyNow(product);
                          }}
                          disabled={(product.stock || 0) <= 0}
                          className={`flex-1 rounded-lg font-bold text-white transition py-1.5 text-[11px] ${
                            (product.stock || 0) <= 0 ? 'bg-slate-400 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-700'
                          }`}
                        >
                          Buy Now
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Results Footer */}
            <div className="mt-12 text-center">
              <p className="text-gray-600 text-sm">
                Showing all {filteredProducts.length} remedies • Certified homeopathy products
              </p>
            </div>
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}

export default function HomeopathyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <HomeopathyContent />
    </Suspense>
  );
}
