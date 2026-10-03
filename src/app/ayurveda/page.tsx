'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { usePreferredCountry } from '@/lib/usePreferredCountry';
import { addToCartUtil } from '@/lib/cartUtils';
import { productBelongsToProductType } from '@/lib/productCategoryMatch';
import { fetchAllCatalogProducts } from '@/lib/fetchCatalogProducts';
import { buildStorefrontCategories } from '@/lib/storefrontCategories';

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'rating', label: 'Highest Rated' },
];

function getAyurvedaFilterTargets(categoryName: string, groups: Record<string, string[]>): string[] {
  if (!categoryName || categoryName === 'All') return [];

  for (const [groupName, items] of Object.entries(groups)) {
    if (equalsIgnoreCase(groupName, categoryName)) {
      return [groupName, ...items];
    }
  }

  return [AYURVEDA_CATEGORY_ALIASES[categoryName.trim().toLowerCase()] || categoryName];
}

function ayurvedaProductMatchesCategory(
  product: Product,
  categoryName: string,
  groups: Record<string, string[]>
): boolean {
  const targets = getAyurvedaFilterTargets(categoryName, groups);
  if (targets.length === 0) return true;

  const fields = [
    product.category,
    product.subcategory,
    product.brand,
    ...(Array.isArray((product as Product & { extraCategoryPaths?: string[][] }).extraCategoryPaths)
      ? (product as Product & { extraCategoryPaths?: string[][] }).extraCategoryPaths!.flat()
      : []),
  ].filter(Boolean) as string[];

  return targets.some((target) => fields.some((field) => equalsIgnoreCase(field, target)));
}

const AYURVEDA_CATEGORY_ALIASES: Record<string, string> = {
  'vati & gutika & guggulu': 'Vati, Gutika & Guggulu',
  'churan & powder & avleha & pak': 'Churan, Powder, Avaleha & Pak',
};

interface Product {
  _id: number;
  name: string;
  brand?: string;
  category: string;
  subcategory?: string;
  price: number;
  displayPrice?: number;
  mrp?: number;
  displayMrp?: number;
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
  isPopular?: boolean;
  currencySymbol?: '₹' | '$';
  currency?: 'INR' | 'USD';
}

function normalizeText(value?: string) {
  return (value || '').trim().toLowerCase();
}

function equalsIgnoreCase(left?: string, right?: string) {
  return normalizeText(left) === normalizeText(right);
}

function AyurvedaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isIndia } = usePreferredCountry();
  const urlCategory = searchParams.get('category') || '';
  const urlSearch = searchParams.get('search') || '';
  const productsSectionRef = useRef<HTMLDivElement | null>(null);
  const hasAutoScrolledRef = useRef(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortOrder, setSortOrder] = useState('featured');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryChips, setCategoryChips] = useState<string[]>([]);
  const [categoryGroups, setCategoryGroups] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const categories = useMemo(() => ['All', ...categoryChips], [categoryChips]);

  useEffect(() => {
    const normalizedCategory = AYURVEDA_CATEGORY_ALIASES[urlCategory.trim().toLowerCase()] || urlCategory;
    setSelectedCategory(normalizedCategory || 'All');
    setSearch(urlSearch);
    hasAutoScrolledRef.current = false;
  }, [urlCategory, urlSearch]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const [list, categoryResponse] = await Promise.all([
          fetchAllCatalogProducts({ productType: 'Ayurveda Medicine' }),
          fetch('/api/categories', { cache: 'no-store' }),
        ]);
        const categoryData = await categoryResponse.json().catch(() => ({}));
        const tree = Array.isArray(categoryData?.tree) ? categoryData.tree : [];
        const ayurvedaList = list.filter((product: Product) =>
          productBelongsToProductType(product, 'Ayurveda Medicine')
        );
        const { chips, groups } = buildStorefrontCategories(tree, 'Ayurveda Medicine', ayurvedaList);
        setProducts(ayurvedaList);
        setCategoryChips(chips);
        setCategoryGroups(groups);
      } catch {
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const redirectToLogin = () => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    router.push(`/login?redirect=${encodeURIComponent(returnTo)}`);
  };

  const filtered = useMemo(() => {
    let result = products.filter((p) => {
      const matchCat =
        selectedCategory === 'All' || ayurvedaProductMatchesCategory(p, selectedCategory, categoryGroups);
      const keyword = search.toLowerCase().trim();
      const concatenatedHealthConcerns = Array.isArray(p.healthConcerns) ? p.healthConcerns.join(' ') : '';
      const matchSearch =
        !keyword ||
        p.name.toLowerCase().includes(keyword) ||
        (p.brand || '').toLowerCase().includes(keyword) ||
        (p.description || '').toLowerCase().includes(keyword) ||
        (p.category || '').toLowerCase().includes(keyword) ||
        (p.subcategory || '').toLowerCase().includes(keyword) ||
        (p.benefit || '').toLowerCase().includes(keyword) ||
        (p.productType || '').toLowerCase().includes(keyword) ||
        (p.potency || '').toLowerCase().includes(keyword) ||
        (p.diseaseCategory || '').toLowerCase().includes(keyword) ||
        (p.diseaseSubcategory || '').toLowerCase().includes(keyword) ||
        String(p.quantity || '').toLowerCase().includes(keyword) ||
        (p.quantityUnit || '').toLowerCase().includes(keyword) ||
        concatenatedHealthConcerns.toLowerCase().includes(keyword);
      return matchCat && matchSearch;
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
  }, [loading, urlCategory, urlSearch, filtered.length]);

  const addToCart = (product: Product) => {
    const result = addToCartUtil(product);
    if (result) {
      setCart((prev) => ({ ...prev, [product._id]: (prev[product._id] || 0) + 1 }));
    } else {
      console.error('Failed to add product to cart:', product._id);
      alert('Failed to add product to cart. Please try again.');
    }
  };

  const handleBuyNow = (product: Product) => {
    const token = localStorage.getItem('token');
    if (!token) {
      redirectToLogin();
      return;
    }
    addToCart(product);
    router.push('/cart');
  };

  return (
    <div className="min-h-screen bg-linear-to-b from-amber-50 via-yellow-50 to-white flex flex-col">
      <Header />

      {/* Hero */}
      <div className="w-full -mt-48">
        <img src="/AB.png" alt="Ayurveda Store" className="w-full h-auto object-cover block" />
      </div>

      {/* Search & Filter Bar */}
      <div className="sticky top-17 md:top-0 z-30 bg-white border-b border-amber-200 shadow-sm -mt-40">
        <div className="max-w-7xl mx-auto px-4 py-1">
          <div className="flex flex-col gap-7 md:gap-4 md:flex-row md:items-center md:justify-between">
            {/* Search Bar */}
            <div className="flex-1 md:mr-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 Search Ayurvedic products, brands, benefits..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full border-2 border-amber-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition text-sm placeholder:text-gray-700"
                />
              </div>
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="mt-3 md:mt-0 w-full md:w-auto border-2 border-amber-200 rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition text-sm font-medium text-gray-700"
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
                    ? 'bg-amber-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-amber-100'
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
                {selectedCategory === 'All' ? '🌿 All Ayurveda Products' : `${selectedCategory}`}
              </h1>
              <p className="text-gray-600 mt-1 text-sm">
                {filtered.length} {filtered.length === 1 ? 'product' : 'products'} available
              </p>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-amber-100 p-4 shadow-sm animate-pulse"
              >
                <div className="h-40 bg-linear-to-br from-amber-100 to-yellow-100 rounded-xl mb-4" />
                <div className="h-4 bg-gray-200 rounded mb-3 w-3/4" />
                <div className="h-3 bg-gray-200 rounded mb-2 w-full" />
                <div className="h-3 bg-gray-200 rounded mb-4 w-1/2" />
                <div className="h-10 bg-amber-100 rounded-lg" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 bg-white border-2 border-dashed border-amber-200 rounded-3xl shadow-sm">
            <div className="text-7xl mb-4 opacity-50">🌿</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-600 mb-6">
              {search
                ? `We couldn't find any products matching "${search}"`
                : 'No products available in this category'}
            </p>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="px-6 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Products Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((p) => (
                <article
                  key={String(p._id)}
                  onClick={() => router.push(`/medicines/${String(p._id)}`)}
                  className="group w-full max-w-56 mx-auto bg-white/95 border border-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition duration-300 flex flex-col cursor-pointer"
                >
                  {/* Image Container */}
                  <div className="relative h-40 bg-linear-to-br from-white to-slate-50 flex items-center justify-center overflow-hidden">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        className="h-full w-full object-contain p-3 group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <span className="text-5xl group-hover:scale-105 transition duration-300">
                        {p.icon || '🌿'}
                      </span>
                    )}

                    {/* Badges */}
                    <div className="absolute inset-0 flex items-start justify-end p-3 pointer-events-none">
                      {!!(p.mrp && p.mrp > p.price) && isIndia && (
                        <span className="text-[11px] font-bold text-emerald-600">
                          {Math.round(((p.mrp! - p.price) / p.mrp!) * 100)}% OFF
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-3 flex flex-col flex-1">
                    {/* Brand & Category */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                        {p.brand || 'MySanjeevni'}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700">
                        {p.category}
                      </span>
                    </div>

                    {/* Product Name */}
                    <h3 className="font-bold text-slate-900 text-xs line-clamp-2 min-h-8 mb-2 leading-tight">
                      {p.name}
                    </h3>

                    {/* Ratings */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold">
                        <span className="text-amber-500">★</span>
                        <span className="text-slate-900">{Number(p.rating || 0).toFixed(1)}</span>
                      </span>
                      <span className="text-xs text-slate-500">
                        ({p.reviews || 0} reviews)
                      </span>
                    </div>

                    {/* Price */}
                    <div className="mb-2 flex items-end justify-between">
                      <span className="text-base font-black text-slate-900">{p.currencySymbol || '₹'}{p.displayPrice ?? p.price}</span>
                      {isIndia && (p.displayMrp ?? p.mrp) && (p.displayMrp ?? p.mrp)! > (p.displayPrice ?? p.price) && (
                        <span className="text-xs text-slate-400 line-through">{p.currencySymbol || '₹'}{p.displayMrp ?? p.mrp}</span>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2 mt-auto">
                      <button
                        onClick={() => addToCart(p)}
                        className={`py-1.5 rounded-lg text-[11px] font-bold transition ${
                          cart[p._id]
                            ? 'bg-slate-700 text-white hover:bg-slate-800'
                            : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {cart[p._id] ? '✓ In Cart' : '🛒 Add'}
                      </button>
                      <button
                        onClick={() => handleBuyNow(p)}
                        className="py-1.5 rounded-lg text-[11px] font-bold bg-amber-600 text-white hover:bg-amber-700 transition"
                      >
                        💳 Buy
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {/* Results Footer */}
            <div className="mt-12 text-center">
              <p className="text-gray-600 text-sm">
                Showing all {filtered.length} products • Curated for authentic wellness
              </p>
            </div>
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}

export default function AyurvedaPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <AyurvedaContent />
    </Suspense>
  );
}
