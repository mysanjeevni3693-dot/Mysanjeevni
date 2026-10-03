'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SocialToggle from '@/components/SocialToggle';
import HeroCarousel from '@/components/HeroCarousel';
import LeftSideCarousel from '@/components/LeftSideCarousel';
import PrimaryServicesCarousel from '@/components/PrimaryServicesCarousel';
import HealthConcernCarousel from '@/components/HealthConcernCarousel';
import FeaturedProductsSection from '@/components/FeaturedProductsSection';
import { usePreferredCountry } from '@/lib/usePreferredCountry';
import { addToCartUtil } from '@/lib/cartUtils';
import { fetchAllCatalogProducts } from '@/lib/fetchCatalogProducts';

interface Product {
  _id: number;
  name: string;
  brand?: string;
  category: string;
  productType?: string;
  price: number;
  displayPrice?: number;
  mrp?: number;
  displayMrp?: number;
  stock: number;
  image?: string;
  icon?: string;
  rating?: number;
  reviews?: number;
  shortDescription?: string;
  currencySymbol?: '₹' | '$';
  currency?: 'INR' | 'USD';
  isPopular?: boolean;
  isPopularGeneric?: boolean;
  isPopularAyurveda?: boolean;
  isPopularHomeopathy?: boolean;
  isPopularLabTests?: boolean;
  popularSection?: 'None' | 'Generic' | 'Ayurveda' | 'Homeopathy' | 'LabTests';
  popularSections?: string[];
}

interface ReviewSummary {
  averageRating: number;
  total: number;
  latestComment?: string;
  latestUserName?: string;
}

interface PopularSectionProps {
  title: string;
  subtitle: string;
  productType: string;
  products: Product[];
  reviewSummaries: Record<string, ReviewSummary>;
  loading: boolean;
  onAddToCart: (product: Product) => void;
  onBuyNow: (product: Product) => void;
  onProductClick: (productId: string) => void;
  viewAllHref?: string;
  viewAllText?: string;
}

function PopularProductsDisplay({
  title,
  subtitle,
  productType,
  products,
  reviewSummaries,
  loading,
  onAddToCart,
  onBuyNow,
  onProductClick,
  viewAllHref,
  viewAllText = 'View All',
}: PopularSectionProps) {
  const { isIndia } = usePreferredCountry();
  const themes: Record<string, {
    panel: string;
    ring: string;
    glow: string;
    chip: string;
    button: string;
  }> = {
    'Generic Medicine': {
      panel: 'bg-linear-to-br from-emerald-50 via-teal-50 to-cyan-50',
      ring: 'border-emerald-200',
      glow: 'bg-emerald-300/25',
      chip: 'bg-emerald-600 text-white',
      button: 'bg-emerald-600 hover:bg-emerald-700',
    },
    'Ayurveda Medicine': {
      panel: 'bg-linear-to-br from-amber-50 via-lime-50 to-emerald-50',
      ring: 'border-amber-200',
      glow: 'bg-amber-300/30',
      chip: 'bg-amber-600 text-white',
      button: 'bg-amber-600 hover:bg-amber-700',
    },
    Homeopathy: {
      panel: 'bg-linear-to-br from-sky-50 via-cyan-50 to-teal-50',
      ring: 'border-sky-200',
      glow: 'bg-sky-300/30',
      chip: 'bg-sky-600 text-white',
      button: 'bg-sky-600 hover:bg-sky-700',
    },
    'Lab Tests': {
      panel: 'bg-linear-to-br from-violet-50 via-fuchsia-50 to-rose-50',
      ring: 'border-violet-200',
      glow: 'bg-violet-300/30',
      chip: 'bg-violet-600 text-white',
      button: 'bg-violet-600 hover:bg-violet-700',
    },
  };

  const theme = themes[productType] || themes['Generic Medicine'];
  const isCompactPopularCard = true;

  const discountPercent = (product: Product) => {
    if (!isIndia) return 0;
    const displayPrice = product.displayPrice ?? product.price;
    const displayMrp = product.displayMrp ?? product.mrp;
    if (!displayMrp || displayMrp <= displayPrice) return 0;
    return Math.round(((displayMrp - displayPrice) / displayMrp) * 100);
  };

  if (loading) {
    return (
      <section className="max-w-7xl mx-auto px-4 py-12 w-full">
        <div className={`relative overflow-hidden rounded-3xl border ${theme.ring} ${theme.panel} p-6 sm:p-8`}>
          <div className={`absolute -top-12 -right-8 h-32 w-32 rounded-full blur-2xl ${theme.glow}`} />
          <div className="mb-7 relative z-10">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${theme.chip}`}>Featured Collection</span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 mt-3">{title}</h2>
            <p className="text-slate-700 mt-2 max-w-2xl">{subtitle}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 relative z-10">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white/80 border border-white rounded-2xl h-72 animate-pulse" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return (
      <section className="max-w-7xl mx-auto px-4 py-12 w-full">
        <div className={`relative overflow-hidden rounded-3xl border ${theme.ring} ${theme.panel} p-6 sm:p-8`}>
          <div className={`absolute -top-12 -right-8 h-32 w-32 rounded-full blur-2xl ${theme.glow}`} />
          <div className="mb-5 relative z-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${theme.chip}`}>Featured Collection</span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 mt-3">{title}</h2>
              <p className="text-slate-700 mt-2">{subtitle}</p>
            </div>
            {viewAllHref && (
              <Link
                href={viewAllHref}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white ${theme.button} shadow-sm hover:shadow-md transition shrink-0 group`}
              >
                <span>{viewAllText}</span>
                <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
              </Link>
            )}
          </div>
          <div className="text-center py-10 text-slate-600 relative z-10 bg-white/65 rounded-2xl border border-white">
            <p className="text-lg font-semibold">No products available yet</p>
            <p className="text-sm mt-1">Admin can mark products as popular to feature them here.</p>
            {viewAllHref && (
              <div className="mt-3">
                <Link
                  href={viewAllHref}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs text-white ${theme.button} shadow-sm`}
                >
                  <span>Explore all products</span>
                  <span>→</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-4 py-12 w-full">
      <div className={`relative overflow-hidden rounded-3xl border ${theme.ring} ${theme.panel} p-6 sm:p-8`}>
        <div className={`absolute -top-14 -right-10 h-36 w-36 rounded-full blur-2xl ${theme.glow}`} />
        <div className={`absolute -bottom-16 -left-12 h-40 w-40 rounded-full blur-3xl ${theme.glow}`} />

        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 relative z-10">
          <div className="flex flex-col gap-2">
            <span className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${theme.chip}`}>Featured Collection</span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">{title}</h2>
            <p className="text-slate-700 max-w-2xl text-sm sm:text-base">{subtitle}</p>
          </div>
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className={`inline-flex items-center gap-2 self-start sm:self-auto px-5 py-2.5 rounded-xl font-bold text-sm text-white ${theme.button} shadow-sm hover:shadow-md transition-all duration-200 shrink-0 group`}
            >
              <span>{viewAllText}</span>
              <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
            </Link>
          )}
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 relative z-10 ${isCompactPopularCard ? 'gap-4' : 'gap-5'}`}>
          {products.slice(0, 8).map((product, index) => {
            const productId = product._id !== undefined && product._id !== null ? String(product._id) : null;
            const cardKey = productId || `${product.name || 'product'}-${index}`;
            const summary = productId ? (reviewSummaries[productId] || {
              averageRating: product.rating || 0,
              total: product.reviews || 0,
            }) : {
              averageRating: product.rating || 0,
              total: product.reviews || 0,
            };

            return (
              <article
                key={cardKey}
                className={`group bg-white/95 border border-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition duration-300 cursor-pointer ${
                  isCompactPopularCard ? 'w-full max-w-56 mx-auto' : ''
                }`}
                onClick={() => {
                  if (productId) {
                    onProductClick(productId);
                  }
                }}
              >
                <div className={`relative bg-linear-to-br from-white to-slate-50 flex items-center justify-center overflow-hidden ${isCompactPopularCard ? 'h-40' : 'h-48'}`}>
                  <span className={`absolute top-3 left-3 rounded-full px-2.5 py-1 text-[10px] font-bold ${theme.chip}`}>
                    Popular
                  </span>
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className={`h-full w-full object-contain group-hover:scale-105 transition duration-300 ${isCompactPopularCard ? 'p-3' : 'p-4'}`}
                    />
                  ) : (
                    <div className="text-5xl">💊</div>
                  )}
                </div>

                <div className={isCompactPopularCard ? 'p-3' : 'p-4'}>
                  <p className={`font-medium text-slate-500 mb-1 uppercase tracking-wide ${isCompactPopularCard ? 'text-[10px]' : 'text-[11px]'}`}>{product.brand || 'MySanjeevni'}</p>
                  <h3 className={`font-bold text-slate-900 line-clamp-2 mb-2 ${isCompactPopularCard ? 'text-xs min-h-8' : 'text-sm min-h-10'}`}>{product.name}</h3>
                  
                  {product.shortDescription && (
                    <p className={`text-slate-600 mb-2 line-clamp-2 ${isCompactPopularCard ? 'text-[10px]' : 'text-xs'}`}>{product.shortDescription}</p>
                  )}

                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1">
                      <span className="text-amber-500">&#9733;</span>
                      <span className="text-xs font-semibold text-slate-900">{Number(summary.averageRating).toFixed(1)}</span>
                      <span className="text-xs text-slate-500">({summary.total})</span>
                    </div>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        product.stock > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {product.stock > 0 ? 'In Stock' : 'Out of Stock'}
                    </span>
                  </div>

                  {summary.latestComment && (
                    <p className="text-xs text-slate-600 mb-2 line-clamp-2">"{summary.latestComment}"</p>
                  )}

                  <div className={`flex items-end justify-between ${isCompactPopularCard ? 'mb-2' : 'mb-3'}`}>
                    <div className="flex items-baseline gap-2">
                      <span className={`${isCompactPopularCard ? 'text-base' : 'text-lg'} font-black text-slate-900`}>{product.currencySymbol || '₹'}{product.displayPrice ?? product.price}</span>
                      {isIndia && (product.displayMrp ?? product.mrp) && (product.displayMrp ?? product.mrp)! > (product.displayPrice ?? product.price) && (
                        <span className="text-xs text-slate-400 line-through">{product.currencySymbol || '₹'}{product.displayMrp ?? product.mrp}</span>
                      )}
                    </div>
                    {isIndia && (product.displayMrp ?? product.mrp) && (product.displayMrp ?? product.mrp)! > (product.displayPrice ?? product.price) && (
                      <span className="text-[11px] font-bold text-emerald-600">{discountPercent(product)}% OFF</span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToCart(product);
                      }}
                      disabled={product.stock <= 0}
                      className={`flex-1 rounded-lg font-bold transition ${isCompactPopularCard ? 'py-1.5 text-[11px]' : 'py-2 text-xs'} ${
                        product.stock <= 0
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      Add to Cart
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onBuyNow(product);
                      }}
                      disabled={product.stock <= 0}
                      className={`flex-1 rounded-lg font-bold text-white transition ${isCompactPopularCard ? 'py-1.5 text-[11px]' : 'py-2 text-xs'} ${
                        product.stock <= 0 ? 'bg-slate-400 cursor-not-allowed' : theme.button
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

        {viewAllHref && products.length > 0 && (
          <div className="mt-8 text-center relative z-10 flex justify-center">
            <Link
              href={viewAllHref}
              className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white ${theme.button} shadow-sm hover:shadow-md transition-all duration-200 group`}
            >
              <span>{viewAllText}</span>
              <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

export default function HomePage() {
  const router = useRouter();
  const trustSectionRef = useRef<HTMLElement | null>(null);

  // All products state
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [popularLabTests, setPopularLabTests] = useState<Product[]>([]);
  const [reviewSummaries, setReviewSummaries] = useState<Record<string, ReviewSummary>>({});
  const [loading, setLoading] = useState(true);
  const [trustVisible, setTrustVisible] = useState(false);

  useEffect(() => {
    const fetchAllProducts = async () => {
      try {
        setLoading(true);
        const products = await fetchAllCatalogProducts();
        setAllProducts(products);

        // Fetch popular lab tests from dedicated endpoint
        const labRes = await fetch('/api/lab-tests/popular?limit=8', { cache: 'no-store' });
        const labData = await labRes.json();
        setPopularLabTests(labData.data || []);

        // Combine product IDs for review summaries
        const allIds = [
          ...(products || []).map((p: Product) => p._id),
          ...(labData.data || []).map((t: any) => t._id),
        ];
        const productIds = allIds.join(',');
        if (productIds) {
          const reviewRes = await fetch(`/api/reviews?productIds=${productIds}`, {
            cache: 'no-store',
          });
          const reviewData = await reviewRes.json();
          setReviewSummaries(reviewData.summaries || {});
        }
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllProducts();
  }, []);

  useEffect(() => {
    const el = trustSectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setTrustVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  const addToCart = (product: Product) => {
    const result = addToCartUtil(product);
    if (!result) {
      console.error('Failed to add product to cart:', product._id);
      alert('Failed to add product to cart. Please try again.');
    }
  };

  const handleBuyNow = (product: Product) => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push(`/login?redirect=${encodeURIComponent('/')}`);
      return;
    }
    addToCart(product);
    router.push('/cart');
  };

  // Popular sections are driven by the selected popularSection value.
  const genericMedicines = allProducts.filter(
    (p) => p.popularSections?.includes('Generic') || (p.popularSection === 'Generic') || Boolean((p as any).isPopularGeneric || p.isPopular)
  );
  const ayurveda = allProducts.filter(
    (p) => p.popularSections?.includes('Ayurveda') || (p.popularSection === 'Ayurveda') || Boolean((p as any).isPopularAyurveda)
  );
  const homeopathy = allProducts.filter(
    (p) => p.popularSections?.includes('Homeopathy') || (p.popularSection === 'Homeopathy') || Boolean((p as any).isPopularHomeopathy)
  );
  // Use popular lab tests from dedicated endpoint
  const labTests = popularLabTests;

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <SocialToggle />

      {/* Featured Products Section */}
      <FeaturedProductsSection />

      {/* Hero Section */}
      <section className="w-full px-4 py-6">
        <div className="max-w-7xl mx-auto flex justify-center">
          <div className="w-full max-w-6xl flex flex-col lg:flex-row justify-center items-center gap-4 lg:h-56">
            {/* Left Carousel Section */}
            <div className="w-full max-w-[320px] lg:max-w-none lg:w-56 mx-auto lg:mx-0">
              <LeftSideCarousel />
            </div>

            {/* Center Carousel Section */}
            <div className="w-full lg:flex-1 lg:max-w-4xl rounded-2xl overflow-hidden shadow-lg bg-white min-h-55 sm:min-h-70 lg:min-h-0">
              <HeroCarousel />
            </div>
          </div>
        </div>
      </section>

      {/* Primary Services */}
      <PrimaryServicesCarousel />

      {/* Popular Medicines Section */}
      <PopularProductsDisplay
        title="Popular Medicines"
        subtitle="Most ordered and trusted products by our customers"
        productType="Generic Medicine"
        products={genericMedicines}
        reviewSummaries={reviewSummaries}
        loading={loading}
        onAddToCart={addToCart}
        onBuyNow={handleBuyNow}
        onProductClick={(id) => router.push(`/medicines/${id}`)}
        viewAllHref="/medicines#products-section"
        viewAllText="View All Medicines"
      />

      {/* Between Popular Medicines and Ayurveda */}
      <section className="max-w-7xl mx-auto px-4 pb-10 w-full">
        <div className="rounded-3xl border border-emerald-200 bg-linear-to-r from-emerald-600 via-teal-600 to-cyan-600 p-6 sm:p-7 text-white shadow-lg">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-center">
            <div className="lg:col-span-2">
              <p className="text-xs uppercase tracking-[0.2em] text-white/80">Quick Healthcare Access</p>
              <h3 className="mt-2 text-2xl sm:text-3xl font-black">Need More Than Medicines?</h3>
              <p className="mt-2 text-white/90 text-sm sm:text-base">Consult doctors, book lab tests, and unlock fresh offers in one tap.</p>
            </div>
            <div className="flex flex-wrap lg:justify-end gap-2">
              <button onClick={() => router.push('/doctor-consultation')} className="rounded-lg bg-white text-teal-700 px-4 py-2 text-sm font-bold hover:bg-teal-50 transition">Consult Doctor</button>
              <button onClick={() => router.push('/lab-tests')} className="rounded-lg bg-white text-teal-700 px-4 py-2 text-sm font-bold hover:bg-teal-50 transition">Book Lab Test</button>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Ayurveda Section */}
      <PopularProductsDisplay
        title="Popular Ayurveda Products"
        subtitle="Traditional wellness products trusted by customers"
        productType="Ayurveda Medicine"
        products={ayurveda}
        reviewSummaries={reviewSummaries}
        loading={loading}
        onAddToCart={addToCart}
        onBuyNow={handleBuyNow}
        onProductClick={(id) => router.push(`/medicines/${id}`)}
        viewAllHref="/ayurveda#products-section"
        viewAllText="View All Ayurveda"
      />

      {/* Shop by Health Concern Section */}
      <HealthConcernCarousel />

      {/* Between Ayurveda and Homeopathy */}
      <section className="max-w-7xl mx-auto px-4 pb-10 w-full">
        <div className="rounded-3xl border border-amber-200 bg-linear-to-r from-amber-50 via-lime-50 to-emerald-50 p-6 sm:p-7">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-amber-700 font-semibold">Daily Wellness Ritual</p>
              <h3 className="mt-2 text-2xl font-black text-slate-900">Build a Better Morning Routine</h3>
              <p className="mt-1 text-sm text-slate-600">Start with immunity support, digestive care, and stress-balancing solutions.</p>
            </div>
            <button
              onClick={() => router.push('/ayurveda#products-section')}
              className="rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-5 py-3 text-sm font-bold transition"
            >
              Explore Ayurveda
            </button>
          </div>
        </div>
      </section>

      {/* Popular Homeopathy Section */}
      <PopularProductsDisplay
        title="Popular Homeopathy Products"
        subtitle="Natural and safe homeopathic remedies"
        productType="Homeopathy"
        products={homeopathy}
        reviewSummaries={reviewSummaries}
        loading={loading}
        onAddToCart={addToCart}
        onBuyNow={handleBuyNow}
        onProductClick={(id) => router.push(`/medicines/${id}`)}
        viewAllHref="/homeopathy#products-section"
        viewAllText="View All Homeopathy"
      />

      {/* Between Homeopathy and Lab Tests */}
      <section className="max-w-7xl mx-auto px-4 pb-10 w-full">
        <div className="rounded-3xl border border-sky-200 bg-linear-to-r from-sky-50 via-cyan-50 to-blue-50 p-6 sm:p-7">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
            <div className="lg:col-span-2">
              <p className="text-xs uppercase tracking-[0.2em] text-sky-700 font-semibold">Preventive Health</p>
              <h3 className="mt-2 text-2xl font-black text-slate-900">Track Symptoms with Smart Diagnostics</h3>
              <p className="mt-1 text-sm text-slate-600">Pair your remedy plan with lab checks to monitor progress and improve outcomes.</p>
            </div>
            <div className="flex lg:justify-end">
              <button
                onClick={() => router.push('/lab-tests')}
                className="w-full lg:w-auto rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-5 py-3 text-sm font-bold transition"
              >
                Start Health Check
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Lab Tests Section */}
      <PopularProductsDisplay
        title="Popular Lab Tests"
        subtitle="Book health checkups and diagnostic tests online"
        productType="Lab Tests"
        products={labTests}
        reviewSummaries={reviewSummaries}
        loading={loading}
        onAddToCart={addToCart}
        onBuyNow={() => router.push('/lab-tests')}
        onProductClick={(id) => router.push(`/medicines/${id}`)}
        viewAllHref="/lab-tests"
        viewAllText="View All Lab Tests"
      />

      {/* Care Journey Section */}
      <section className="max-w-7xl mx-auto px-4 py-10 sm:py-12 w-full">
        <div className="rounded-3xl border border-slate-200 bg-linear-to-br from-white via-slate-50 to-emerald-50 p-6 sm:p-8">
          <div className="text-center max-w-2xl mx-auto">
            <span className="inline-flex rounded-full bg-slate-900 text-white px-3 py-1 text-xs font-semibold tracking-wide uppercase">
              How It Works
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
              Your Complete Healthcare Journey in 3 Steps
            </h2>
            <p className="mt-2 text-slate-600 text-sm sm:text-base">
              Discover products, get expert guidance, and receive care at home without friction.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            <article className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-black">1</div>
              <h3 className="mt-3 text-lg font-extrabold text-slate-900">Choose Your Care</h3>
              <p className="mt-1 text-sm text-slate-600">Browse medicines, Ayurveda, Homeopathy, and lab services based on your needs.</p>
            </article>

            <article className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center font-black">2</div>
              <h3 className="mt-3 text-lg font-extrabold text-slate-900">Get Expert Support</h3>
              <p className="mt-1 text-sm text-slate-600">Book doctor consultations and receive recommendations tailored to your symptoms.</p>
            </article>

            <article className="rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
              <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black">3</div>
              <h3 className="mt-3 text-lg font-extrabold text-slate-900">Fast Doorstep Delivery</h3>
              <p className="mt-1 text-sm text-slate-600">Track every order and receive trusted healthcare products quickly and safely.</p>
            </article>
          </div>
        </div>
      </section>

      {/* Personalized Care Programs */}
      <section className="max-w-7xl mx-auto px-4 pb-12 w-full">
        <div className="relative overflow-hidden rounded-3xl border border-violet-200 bg-linear-to-r from-violet-600 via-fuchsia-600 to-rose-500 p-6 sm:p-8 text-white">
          <div className="absolute -top-10 -right-8 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
          <div className="absolute -bottom-12 -left-10 h-36 w-36 rounded-full bg-white/15 blur-2xl" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
            <div className="lg:col-span-2">
              <p className="text-xs uppercase tracking-[0.2em] text-white/80">Personalized Wellness</p>
              <h3 className="mt-2 text-2xl sm:text-3xl font-black">Build Your Monthly Health Plan</h3>
              <p className="mt-2 text-white/90 text-sm sm:text-base max-w-2xl">
                Combine medicines, diagnostics, and consultations into one routine and manage everything from a single dashboard.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row lg:flex-col gap-3 lg:justify-self-end w-full lg:w-auto">
              <button
                onClick={() => router.push('/medicines#products-section')}
                className="rounded-xl bg-white text-violet-700 font-bold px-5 py-3 hover:bg-violet-50 transition"
              >
                Explore Medicines
              </button>
              <button
                onClick={() => router.push('/doctor-consultation')}
                className="rounded-xl border border-white/60 text-white font-bold px-5 py-3 hover:bg-white/10 transition"
              >
                Book Consultation
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Assurance Section */}
      <section ref={trustSectionRef} className="bg-linear-to-br from-slate-50 via-white to-emerald-50 py-14 sm:py-16 relative overflow-hidden">
        <div className="absolute -top-24 right-0 h-64 w-64 rounded-full bg-emerald-200/30 blur-3xl" />
        <div className="absolute -bottom-24 left-0 h-64 w-64 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
            <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-3 py-1 text-xs font-semibold tracking-wide uppercase">
              Why Choose MySanjeevni
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
              Trusted Healthcare, Delivered with Care
            </h2>
            <p className="mt-3 text-slate-600 text-sm sm:text-base">
              Every order is backed by verified sourcing, secure transactions, and dependable doorstep delivery.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            <article
              className={`rounded-2xl border border-emerald-200 bg-white shadow-sm hover:shadow-lg transition-all duration-700 ease-out p-6 text-center ${
                trustVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: '50ms' }}
            >
              <div className="mx-auto h-14 w-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl font-black mb-4">✓</div>
              <h3 className="font-extrabold text-slate-900 text-lg mb-2">100% Authentic</h3>
              <p className="text-sm text-slate-600">All medicines sourced from verified pharmacies</p>
            </article>

            <article
              className={`rounded-2xl border border-blue-200 bg-white shadow-sm hover:shadow-lg transition-all duration-700 ease-out p-6 text-center ${
                trustVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: '160ms' }}
            >
              <div className="mx-auto h-14 w-14 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center text-2xl mb-4">🔒</div>
              <h3 className="font-extrabold text-slate-900 text-lg mb-2">Secure & Safe</h3>
              <p className="text-sm text-slate-600">SSL encrypted transactions and secure payment</p>
            </article>

            <article
              className={`rounded-2xl border border-amber-200 bg-white shadow-sm hover:shadow-lg transition-all duration-700 ease-out p-6 text-center ${
                trustVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
              }`}
              style={{ transitionDelay: '260ms' }}
            >
              <div className="mx-auto h-14 w-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl mb-4">🚚</div>
              <h3 className="font-extrabold text-slate-900 text-lg mb-2">Fast Delivery</h3>
              <p className="text-sm text-slate-600">Get medicines delivered to your doorstep</p>
            </article>
          </div>

          <div className="mt-8 rounded-2xl border border-white bg-white/70 backdrop-blur px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm sm:text-base text-slate-700 font-medium">
              Ready to start your care journey with confidence?
            </p>
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => router.push('/signup')}
                className="flex-1 sm:flex-none rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2.5 transition"
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

