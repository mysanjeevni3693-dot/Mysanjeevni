'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SocialToggle from '@/components/SocialToggle';
import { usePreferredCountry } from '@/lib/usePreferredCountry';
import { addToCartUtil } from '@/lib/cartUtils';
import SafeHTML from '@/components/SafeHTML';

interface Product {
  _id: number;
  name: string;
  brand?: string;
  category: string;
  potency?: string;
  quantity?: number;
  quantityUnit?: string;
  productType?: string;
  description?: string;
  shortDescription?: string;
  price: number;
  displayPrice?: number;
  mrp?: number;
  displayMrp?: number;
  stock: number;
  image?: string;
  images?: string[];
  icon?: string;
  rating?: number;
  reviews?: number;
  benefit?: string;
  dosage?: string;
  packaging?: string;
  safetyInformation?: string;
  specifications?: string;
  manufacturer?: string;
  requiresPrescription?: boolean;
  healthConcerns?: string[];
  expiryDate?: string;
  vendorRating?: number;
  currencySymbol?: '₹' | '$';
  currency?: 'INR' | 'USD';
}

interface ProductReview {
  _id: string;
  userId: string;
  rating: number;
  title?: string;
  comment?: string;
  userName?: string;
  createdAt: string;
}

const POTENCY_OPTIONS = ['1000 CH', '3 CH', '10M CH', '200 CH', '30 CH', '12 CH', '6 CH', 'CM CH', '50M CH'];
const QUANTITY_UNIT_OPTIONS = ['None', 'BAGS (Bag)', 'BOTTLES (Btl)', 'BOX (Box)', 'BUNDLES (Bdl)', 'CANS (Can)', 'CAPSULES (CAPS)', 'CARTONS (Ctn)', 'DOZENS (Dzn)', 'GRAMMES (Gm)', 'KILOGRAMS (Kg)', 'LITRE (Ltr)', 'METERS (Mtr)', 'MILILITRE (MI)', 'NUMBERS (Nos)', 'PACKS (Pac)', 'PAIRS (Prs)', 'PIECES (Pcs)', 'QUINTAL (Qtl)', 'ROLLS (Rol)', 'SACHET (SACH)', 'SQUARE FEET (Sqf)', 'SQUARE METERS (Sqm)', 'TABLETS (Tbs)'];

const normalizeText = (value?: string) => (value || '').trim().toLowerCase();
const isUnitNone = (value?: string) => !value || value === 'None';
const hasValidPotency = (value?: string) => Boolean((value || '').trim());
const hasValidQuantityValue = (value?: number) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getBaseProductName = (value?: string) => {
  const source = normalizeText(value);
  if (!source) return '';

  let base = source;

  // Remove known potency labels from the end of name.
  const potencyAlternation = POTENCY_OPTIONS.map((p) => escapeRegExp(p.toLowerCase())).join('|');
  if (potencyAlternation) {
    base = base.replace(new RegExp(`\\b(${potencyAlternation})\\b`, 'gi'), ' ');
  }

  // Remove quantity tokens such as "10 ml", "30 tablets", etc.
  base = base.replace(/\b\d+(?:\.\d+)?\s*(ml|l|gm|g|kg|pcs|tabs?|tablets?|caps?|capsules?|bottles?|box|boxes|pack|packs|nos)\b/gi, ' ');

  return base.replace(/\s+/g, ' ').trim();
};

const isLikelySameFamily = (currentProduct: Product, item: Product) => {
  const currentName = normalizeText(currentProduct.name);
  const itemName = normalizeText(item.name);
  if (!itemName) return false;

  const currentBaseName = getBaseProductName(currentProduct.name);
  const itemBaseName = getBaseProductName(item.name);

  const directNameMatch = itemName === currentName;
  const baseNameMatch = Boolean(currentBaseName && itemBaseName && itemBaseName === currentBaseName);
  const looseNameMatch = Boolean(
    currentBaseName && itemName && (itemName.includes(currentBaseName) || currentName.includes(itemBaseName))
  );

  if (!directNameMatch && !baseNameMatch && !looseNameMatch) return false;

  const currentBrand = normalizeText(currentProduct.brand);
  const itemBrand = normalizeText(item.brand);
  if (currentBrand && itemBrand && currentBrand !== itemBrand) return false;

  return true;
};

const getVariantCandidates = async (currentProduct: Product): Promise<Product[]> => {
  const categoryRes = await fetch(
    `/api/products?category=${encodeURIComponent(currentProduct.category)}&limit=300`,
    { cache: 'no-store' }
  );
  const categoryData = await categoryRes.json();
  const categoryProducts: Product[] = categoryRes.ok && Array.isArray(categoryData.products) ? categoryData.products : [];

  // Fallback for older/misaligned records where variants are not under the same category.
  if (categoryProducts.some((item) => isLikelySameFamily(currentProduct, item))) {
    return categoryProducts;
  }

  const globalRes = await fetch('/api/products?limit=500', { cache: 'no-store' });
  const globalData = await globalRes.json();
  const globalProducts: Product[] = globalRes.ok && Array.isArray(globalData.products) ? globalData.products : [];

  const byId = new Map<string, Product>();
  [...categoryProducts, ...globalProducts].forEach((item) => {
    if (item?._id !== undefined && item?._id !== null) byId.set(String(item._id), item);
  });
  return Array.from(byId.values());
};

const getQuantityLabel = (item: Product) => {
  const hasQuantity = hasValidQuantityValue(item.quantity);
  const hasUnit = !isUnitNone(item.quantityUnit);
  if (hasQuantity && hasUnit) return `${item.quantity} ${item.quantityUnit}`;
  if (hasQuantity) return String(item.quantity);
  if (hasUnit) return item.quantityUnit as string;
  return 'None';
};

const getQuantityVariantKey = (item: Product) => {
  const qty = item.quantity !== undefined && item.quantity !== null ? String(item.quantity) : '';
  const unit = isUnitNone(item.quantityUnit) ? 'None' : String(item.quantityUnit);
  return `${qty}|${unit}`;
};

const toLineItems = (value?: string): string[] =>
  (value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\u2022/g, '\n• ')
    .split(/\r\n|\n|\r|\u2028|\u2029|(?<=[.!?])\s+(?=[A-Z•\-*])/)
    .flatMap((chunk) => chunk.split(/(?:^|\s)[•]\s+/))
    .map((line) => line.replace(/^[-*•]\s*/, '').trim())
    .filter(Boolean);

export default function MedicineDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { isIndia } = usePreferredCountry();
  const productId = params?.id;

  useEffect(() => {
    if (!productId) return;
    if (productId.startsWith('thyrocare_') || productId.startsWith('healthians_')) {
      router.replace(`/lab-tests/${productId}`);
    }
  }, [productId, router]);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [added, setAdded] = useState(false);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewHasMore, setReviewHasMore] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [loggedInUserId, setLoggedInUserId] = useState<string>('');
  const [isReviewUserLoggedIn, setIsReviewUserLoggedIn] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    title: '',
    comment: '',
  });
  const [reviewSummary, setReviewSummary] = useState({ averageRating: 0, total: 0 });
  const [activeTab, setActiveTab] = useState<'info' | 'safety' | 'specs'>('info');
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [shareMessage, setShareMessage] = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [potencyProducts, setPotencyProducts] = useState<Product[]>([]);
  const [quantityProducts, setQuantityProducts] = useState<Product[]>([]);
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const [imageZoomPosition, setImageZoomPosition] = useState({ x: 50, y: 50 });
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const allImages = useMemo(() => {
    if (!product) return [];
    const images = product.images || [];
    const primaryImage = product.image;
    // Use images array if available, otherwise fall back to single image
    if (images.length > 0) return images;
    if (primaryImage) return [primaryImage];
    return [];
  }, [product]);

  const currentImage = useMemo(() => {
    if (allImages.length > 0) return allImages[selectedImageIndex];
    return product?.image || null;
  }, [allImages, selectedImageIndex, product]);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!productId) return;
      if (productId.startsWith('thyrocare_') || productId.startsWith('healthians_')) return;
      setLoading(true);
      setError('');

      try {
        console.log(`[Frontend] Fetching product: ${productId}`);
        const res = await fetch(`/api/products/${productId}`, { cache: 'no-store' });
        const data = await res.json();

        console.log(`[Frontend] Response status: ${res.status}, data:`, data);

        if (!res.ok) {
          if (res.status === 404) {
            console.warn('[Frontend] Product not found:', productId);
            setError('Product not found');
          } else if (res.status === 500) {
            console.error('[Frontend] Server error:', data.error);
            setError(`Server error: ${data.error || 'Unable to load product details'}`);
          } else {
            console.warn('[Frontend] API error:', res.status, data.error);
            setError(data.error || 'Unable to load product details');
          }
          setProduct(null);
          return;
        }

        if (!data.product) {
          console.warn('[Frontend] No product in response');
          setError('Product data is invalid');
          setProduct(null);
          return;
        }

        console.log('[Frontend] Product loaded successfully:', data.product._id);
        setProduct(data.product || null);
        setSelectedImageIndex(0);
      } catch (error) {
        console.error('[Frontend] Error fetching product:', error);
        setError(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

  const fetchRelatedProducts = useCallback(async (currentProduct: Product) => {
    try {
      const res = await fetch(
        `/api/products?category=${encodeURIComponent(currentProduct.category)}&limit=6`,
        { cache: 'no-store' }
      );
      const data = await res.json();

      if (res.ok && data.products) {
        // Filter out the current product
        const filtered = data.products.filter((p: Product) => p._id !== currentProduct._id).slice(0, 4);
        setRelatedProducts(filtered);
      }
    } catch (error) {
      console.error('Failed to fetch related products:', error);
    }
  }, []);

  const fetchPotencyProducts = useCallback(async (currentProduct: Product) => {
    if (!currentProduct?.name) {
      setPotencyProducts([]);
      return;
    }

    try {
      const candidates = await getVariantCandidates(currentProduct);
      const familyProducts = candidates.filter(
        (item: Product) => hasValidPotency(item?.potency) && isLikelySameFamily(currentProduct, item)
      );

      const byPotency = new Map<string, Product>();
      familyProducts.forEach((item: Product) => {
        byPotency.set((item.potency as string).trim(), item);
      });
      if (hasValidPotency(currentProduct.potency)) {
        byPotency.set((currentProduct.potency as string).trim(), currentProduct);
      }

      const sorted = Array.from(byPotency.values()).sort((a, b) => {
        const aIndex = POTENCY_OPTIONS.indexOf(a.potency || '');
        const bIndex = POTENCY_OPTIONS.indexOf(b.potency || '');
        const safeAIndex = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
        const safeBIndex = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
        if (safeAIndex !== safeBIndex) return safeAIndex - safeBIndex;
        return (a.potency || '').localeCompare(b.potency || '');
      });

      setPotencyProducts(sorted);
    } catch {
      setPotencyProducts([]);
    }
  }, []);

  const fetchQuantityProducts = useCallback(async (currentProduct: Product) => {
    if (!currentProduct?.name) {
      setQuantityProducts([]);
      return;
    }

    try {
      const candidates = await getVariantCandidates(currentProduct);
      const familyProducts = candidates.filter((item: Product) => {
        if (!isLikelySameFamily(currentProduct, item)) return false;
        const hasQuantity = hasValidQuantityValue(item.quantity);
        const hasUnit = !isUnitNone(item.quantityUnit);
        return hasQuantity || hasUnit;
      });

      const byQuantity = new Map<string, Product>();
      familyProducts.forEach((item: Product) => {
        byQuantity.set(getQuantityVariantKey(item), item);
      });

      const currentHasQuantity = hasValidQuantityValue(currentProduct.quantity);
      const currentHasUnit = !isUnitNone(currentProduct.quantityUnit);
      if (currentHasQuantity || currentHasUnit) {
        byQuantity.set(getQuantityVariantKey(currentProduct), currentProduct);
      }

      const sorted = Array.from(byQuantity.values()).sort((a, b) => {
        const aUnit = isUnitNone(a.quantityUnit) ? 'None' : (a.quantityUnit as string);
        const bUnit = isUnitNone(b.quantityUnit) ? 'None' : (b.quantityUnit as string);
        const aUnitIndex = QUANTITY_UNIT_OPTIONS.indexOf(aUnit);
        const bUnitIndex = QUANTITY_UNIT_OPTIONS.indexOf(bUnit);
        const safeAUnitIndex = aUnitIndex === -1 ? Number.MAX_SAFE_INTEGER : aUnitIndex;
        const safeBUnitIndex = bUnitIndex === -1 ? Number.MAX_SAFE_INTEGER : bUnitIndex;
        if (safeAUnitIndex !== safeBUnitIndex) return safeAUnitIndex - safeBUnitIndex;

        const aQty = a.quantity ?? Number.MAX_SAFE_INTEGER;
        const bQty = b.quantity ?? Number.MAX_SAFE_INTEGER;
        return aQty - bQty;
      });

      setQuantityProducts(sorted);
    } catch {
      setQuantityProducts([]);
    }
  }, []);

  useEffect(() => {
    if (product) {
      fetchRelatedProducts(product);
      fetchPotencyProducts(product);
      fetchQuantityProducts(product);
    }
  }, [product, fetchRelatedProducts, fetchPotencyProducts, fetchQuantityProducts]);

  const fetchReviews = useCallback(async (page = 1, append = false) => {
    if (!productId) return;

    setReviewLoading(true);
    try {
      const res = await fetch(`/api/reviews?productId=${productId}&page=${page}&limit=5`, { cache: 'no-store' });
      const data = await res.json();

      if (!res.ok) return;

      const averageRating = Number(data.averageRating || 0);
      const total = Number(data.total || 0);

      const incomingReviews = data.reviews || [];
      setReviews((prev) => (append ? [...prev, ...incomingReviews] : incomingReviews));
      setReviewSummary({ averageRating, total });
      setReviewPage(Number(data.page || page));
      setReviewHasMore(Boolean(data.hasMore));
    } catch {
      if (!append) {
        setReviews([]);
        setReviewSummary({ averageRating: 0, total: 0 });
      }
    } finally {
      setReviewLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      const rawUser = localStorage.getItem('user');
      const user = rawUser ? JSON.parse(rawUser) : null;
      setLoggedInUserId(String(user?.id || user?._id || ''));
      setIsReviewUserLoggedIn(Boolean(token && user && (user.id || user._id)));
    } catch {
      setLoggedInUserId('');
      setIsReviewUserLoggedIn(false);
    }
  }, []);

  const discountPercent = useMemo(() => {
    const price = product?.displayPrice ?? product?.price;
    const mrp = product?.displayMrp ?? product?.mrp;
    if (!isIndia || !mrp || !price || mrp <= price) return 0;
    return Math.round(((mrp - price) / mrp) * 100);
  }, [isIndia, product]);

  const safetyItems = useMemo(() => toLineItems(product?.safetyInformation), [product?.safetyInformation]);
  const specificationItems = useMemo(() => toLineItems(product?.specifications), [product?.specifications]);
  const selectablePotencyProducts = useMemo(
    () => potencyProducts.filter((item) => hasValidPotency(item.potency)),
    [potencyProducts]
  );
  const potencyProductByLabel = useMemo(() => {
    const map = new Map<string, Product>();

    selectablePotencyProducts.forEach((item) => {
      const label = (item.potency || '').trim();
      if (!label) return;
      map.set(label, item);
    });

    if (product && hasValidPotency(product.potency)) {
      map.set((product.potency || '').trim(), product);
    }

    return map;
  }, [selectablePotencyProducts, product]);
  const allPotencyLabels = useMemo(() => {
    const labels = [...POTENCY_OPTIONS];

    // Preserve any custom potency labels created by admin that are not in defaults.
    potencyProductByLabel.forEach((_item, label) => {
      if (!labels.includes(label)) labels.push(label);
    });

    return labels;
  }, [potencyProductByLabel]);
  const currentPotencyLabel = useMemo(
    () => (hasValidPotency(product?.potency) ? (product?.potency || '').trim() : ''),
    [product?.potency]
  );
  const shouldShowPotencySelector = useMemo(() => {
    if (allPotencyLabels.length > 0 && selectablePotencyProducts.length > 0) return true;
    return Boolean(currentPotencyLabel);
  }, [allPotencyLabels.length, selectablePotencyProducts.length, currentPotencyLabel]);
  const selectableQuantityProducts = useMemo(
    () => quantityProducts.filter((item) => {
      const hasQuantity = hasValidQuantityValue(item.quantity);
      const hasUnit = !isUnitNone(item.quantityUnit);
      return hasQuantity || hasUnit;
    }),
    [quantityProducts]
  );
  const currentQuantityLabel = useMemo(() => {
    if (!product) return '';
    const hasQuantity = hasValidQuantityValue(product.quantity);
    const hasUnit = !isUnitNone(product.quantityUnit);
    if (!hasQuantity && !hasUnit) return '';
    return getQuantityLabel(product);
  }, [product]);

  const redirectToLogin = () => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    router.push(`/login?redirect=${encodeURIComponent(returnTo)}`);
  };

  const shareProduct = async () => {
    if (!product) return;
    setShareLoading(true);
    setShareMessage('');

    const shareData = {
      title: product.name,
      text: `Check out ${product.name} on MySanjeevni`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setShareMessage('Product shared successfully');
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareData.url);
        setShareMessage('Product link copied to clipboard');
      } else {
        window.prompt('Copy this product link:', shareData.url);
        setShareMessage('Product link is ready to copy');
      }
    } catch (error) {
      if ((error as any)?.name !== 'AbortError') {
        setShareMessage('Unable to share product right now');
      }
    } finally {
      setShareLoading(false);
    }
  };

  const addToCart = () => {
    if (!product) return;

    const result = addToCartUtil(product);
    if (result) {
      setAdded(true);
      setError('');
    } else {
      setError('Unable to add product to cart');
      console.error('Failed to add product to cart:', product._id);
    }
  };

  const buyNow = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      redirectToLogin();
      return;
    }

    addToCart();
    router.push('/cart');
  };

  const handleImageMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setImageZoomPosition({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  };

  const submitReview = async () => {
    if (!product) return;

    const token = localStorage.getItem('token');
    const userRaw = localStorage.getItem('user');
    const user = userRaw ? JSON.parse(userRaw) : null;

    if (!token || !user) {
      redirectToLogin();
      return;
    }

    if (!reviewForm.comment.trim()) {
      setError('Please write a comment before submitting review.');
      return;
    }

    setReviewSubmitting(true);
    setError('');
    try {
      const isEdit = Boolean(editingReviewId);
      const endpoint = isEdit ? `/api/reviews/${editingReviewId}` : '/api/reviews';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: user.id || user._id,
          productId: product._id,
          rating: reviewForm.rating,
          title: reviewForm.title.trim(),
          comment: reviewForm.comment.trim(),
          userName: user.fullName || user.name || 'User',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unable to submit review');
        return;
      }

      setReviewForm({ rating: 5, title: '', comment: '' });
      setEditingReviewId(null);
      await fetchReviews();
    } catch {
      setError('Unable to submit review');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const startEditReview = (review: ProductReview) => {
    setEditingReviewId(review._id);
    setReviewForm({
      rating: Number(review.rating || 5),
      title: review.title || '',
      comment: review.comment || '',
    });
  };

  const cancelEditReview = () => {
    setEditingReviewId(null);
    setReviewForm({ rating: 5, title: '', comment: '' });
  };

  const deleteReview = async (reviewId: string) => {
    const token = localStorage.getItem('token');
    if (!token || !loggedInUserId) {
      redirectToLogin();
      return;
    }

    if (!confirm('Delete this review?')) return;

    setReviewSubmitting(true);
    try {
      const res = await fetch(`/api/reviews/${reviewId}?userId=${encodeURIComponent(loggedInUserId)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unable to delete review');
        return;
      }

      if (editingReviewId === reviewId) {
        cancelEditReview();
      }
      await fetchReviews();
    } catch {
      setError('Unable to delete review');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const loadMoreReviews = async () => {
    if (reviewLoading || !reviewHasMore) return;
    await fetchReviews(reviewPage + 1, true);
  };

  const getStarDistribution = () => {
    if (reviews.length === 0) return { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((r) => {
      const rating = Math.round(Number(r.rating || 0));
      if (rating >= 1 && rating <= 5) {
        dist[rating as 1 | 2 | 3 | 4 | 5]++;
      }
    });
    return dist;
  };

  const starDistribution = useMemo(() => getStarDistribution(), [reviews]);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <SocialToggle />

      <div className="w-full px-4 py-8 flex-1">
        <div className="max-w-7xl mx-auto">
          {/* Breadcrumb */}
          <button
            onClick={() => router.back()}
            className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 mb-6 flex items-center gap-1"
          >
            ← Back to Medicines
          </button>

          {loading ? (
            <div className="bg-gray-100 rounded-lg p-8 space-y-6 animate-pulse">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <div className="md:col-span-2 h-96 bg-gray-300 rounded-lg" />
                <div className="md:col-span-3 space-y-4">
                  <div className="h-8 bg-gray-300 rounded w-3/4" />
                  <div className="h-6 bg-gray-300 rounded w-1/2" />
                  <div className="h-12 bg-gray-300 rounded w-1/3" />
                </div>
              </div>
            </div>
          ) : error || !product ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
              <p className="text-red-600 font-semibold">{error || 'Product not found'}</p>
              <button
                onClick={() => router.push('/medicines')}
                className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-semibold"
              >
                Browse Medicines
              </button>
            </div>
          ) : (
            <>
              {/* Hero Section */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mb-12">
                {/* Product Image Gallery */}
                <div className="md:col-span-2">
                  {/* Main Image */}
                  <div
                    className="bg-gray-50 rounded-lg p-8 flex items-center justify-center min-h-96 border border-gray-200 sticky top-24 overflow-hidden"
                    onMouseEnter={() => setIsImageZoomed(true)}
                    onMouseLeave={() => {
                      setIsImageZoomed(false);
                      setImageZoomPosition({ x: 50, y: 50 });
                    }}
                    onMouseMove={handleImageMouseMove}
                  >
                    {currentImage ? (
                      <>
                        <img
                          src={currentImage}
                          alt={`${product.name} - Image ${selectedImageIndex + 1}`}
                          className="max-h-80 w-full object-contain"
                          style={{
                            transform: isImageZoomed ? 'scale(1.9)' : 'scale(1)',
                            transformOrigin: `${imageZoomPosition.x}% ${imageZoomPosition.y}%`,
                            transition: isImageZoomed ? 'transform 120ms ease-out' : 'transform 200ms ease-out',
                            willChange: 'transform',
                          }}
                        />
                        <span className="absolute bottom-3 right-3 text-[11px] font-semibold text-slate-600 bg-white/90 border border-slate-200 px-2 py-1 rounded">
                          Hover to zoom
                        </span>
                        {allImages.length > 1 && (
                          <span className="absolute top-3 right-3 text-xs font-semibold text-slate-600 bg-white/90 border border-slate-200 px-2 py-1 rounded">
                            {selectedImageIndex + 1} / {allImages.length}
                          </span>
                        )}
                      </>
                    ) : (
                      <div className="text-6xl">{product.icon || '💊'}</div>
                    )}
                  </div>

                  {/* Image Thumbnails */}
                  {allImages.length > 1 && (
                    <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                      {allImages.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedImageIndex(idx)}
                          className={`shrink-0 h-20 w-20 rounded-lg border-2 overflow-hidden transition-all ${
                            selectedImageIndex === idx
                              ? 'border-emerald-600 ring-2 ring-emerald-300'
                              : 'border-slate-300 hover:border-emerald-400'
                          }`}
                        >
                          <img
                            src={img}
                            alt={`Thumbnail ${idx + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Product Details */}
                <div className="md:col-span-3">
                  {/* Badges */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">
                      {product.category}
                    </span>
                    {product.requiresPrescription && (
                      <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-orange-100 text-orange-700">
                        Rx Required
                      </span>
                    )}
                    {product.productType && (
                      <span className="inline-block text-xs font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-700">
                        {product.productType}
                      </span>
                    )}
                  </div>

                  {/* Brand */}
                  <p className="text-sm text-slate-600 mb-1">{product.brand || 'MySanjeevni'}</p>

                  {/* Title */}
                  <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 leading-tight">
                    {product.name}
                  </h1>

                  {/* Short Description */}
                  {product.shortDescription && (
                    <p className="text-base text-slate-700 mb-6 italic border-l-4 border-emerald-400 pl-4 py-2 bg-emerald-50">
                      {product.shortDescription}
                    </p>
                  )}

                  {/* Potency Selector */}
                  {shouldShowPotencySelector ? (
                    <div className="mb-6">
                      <p className="text-sm font-semibold text-slate-700 mb-2">Select Potency</p>
                      <div className="flex flex-wrap gap-2">
                        {allPotencyLabels.map((potencyLabel) => {
                          const potencyProduct = potencyProductByLabel.get(potencyLabel);
                          const isAvailable = Boolean(potencyProduct);
                          const isActive = currentPotencyLabel === potencyLabel;

                          return (
                            <button
                              key={potencyLabel}
                              type="button"
                              onClick={() => {
                                if (isAvailable && potencyProduct && !isActive) {
                                  router.push(`/medicines/${potencyProduct._id}`);
                                }
                              }}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                                isActive
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : isAvailable
                                    ? 'bg-white text-slate-700 border-slate-300 hover:border-emerald-500 hover:text-emerald-700'
                                    : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              }`}
                              disabled={!isAvailable}
                            >
                              {potencyLabel}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Available potencies are clickable. The selected potency is highlighted.
                      </p>
                    </div>
                  ) : null}

                  {/* Quantity Selector */}
                  {selectableQuantityProducts.length > 1 ? (
                    <div className="mb-6">
                      <p className="text-sm font-semibold text-slate-700 mb-2">Select Quantity</p>
                      <div className="flex flex-wrap gap-2">
                        {selectableQuantityProducts.map((quantityProduct) => {
                          const isActive = quantityProduct._id === product._id;
                          return (
                            <button
                              key={`quantity-${String(quantityProduct._id)}`}
                              type="button"
                              onClick={() => {
                                if (!isActive) {
                                  router.push(`/medicines/${String(quantityProduct._id)}`);
                                }
                              }}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                                isActive
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white text-slate-700 border-slate-300 hover:border-emerald-500 hover:text-emerald-700'
                              }`}
                            >
                              {getQuantityLabel(quantityProduct)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : currentQuantityLabel ? (
                    <div className="mb-6">
                      <p className="text-sm font-semibold text-slate-700 mb-2">Quantity</p>
                      <span className="inline-flex px-3 py-1.5 rounded-full text-xs font-semibold border bg-slate-50 text-slate-700 border-slate-300">
                        {currentQuantityLabel}
                      </span>
                    </div>
                  ) : null}

                  {/* Rating */}
                  <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <span key={i} className="text-amber-500 text-lg">
                            ★
                          </span>
                        ))}
                      </div>
                      <span className="text-xl font-bold text-slate-900">
                        {Number(
                          reviewSummary.total > 0
                            ? reviewSummary.averageRating
                            : Number(product.rating || 0)
                        ).toFixed(1)}
                      </span>
                    </div>
                    <span className="text-slate-600">
                      {reviewSummary.total > 0 ? reviewSummary.total : product.reviews || 0}
                      <span className="ml-1">Ratings & Reviews</span>
                    </span>
                  </div>

                  {/* Pricing */}
                  <div className="mb-6 bg-gray-50 rounded-lg p-6">
                    <div className="flex items-baseline gap-3 mb-2">
                      <span className="text-4xl font-bold text-slate-900">{product.currencySymbol || '₹'}{product.displayPrice ?? product.price}</span>
                      {isIndia && (product.displayMrp ?? product.mrp) && (product.displayMrp ?? product.mrp)! > (product.displayPrice ?? product.price) && (
                        <>
                          <span className="text-xl text-slate-400 line-through">{product.currencySymbol || '₹'}{product.displayMrp ?? product.mrp}</span>
                          <span className="text-lg font-bold text-emerald-600">
                            {discountPercent}% OFF
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">Inclusive of all taxes</p>
                  </div>

                  {/* Stock Status */}
                  <div className="mb-6">
                    {product.stock > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                        <span className="text-sm font-semibold text-emerald-700">
                          In Stock: {product.stock} units available
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full" />
                        <span className="text-sm font-semibold text-red-700">Out of Stock</span>
                      </div>
                    )}
                  </div>

                  {/* Expiry Date */}
                  {product.expiryDate && (
                    <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs text-blue-600">
                        <span className="font-semibold">Expires on or after:</span>{' '}
                        {new Date(product.expiryDate).toLocaleDateString('en-IN', {
                          year: 'numeric',
                          month: 'short',
                        })}
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  {added && (
                    <p className="mb-4 text-sm text-emerald-700 font-semibold bg-emerald-50 p-3 rounded-lg">
                      ✓ Added to cart successfully
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <button
                      onClick={addToCart}
                      disabled={product.stock <= 0}
                      className={`py-3 px-6 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${
                        product.stock <= 0
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-white border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50'
                      }`}
                    >
                      🛒 Add to Cart
                    </button>
                    <button
                      onClick={buyNow}
                      disabled={product.stock <= 0}
                      className={`py-3 px-6 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 ${
                        product.stock <= 0
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      🚀 Buy Now
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={shareProduct}
                    disabled={shareLoading}
                    className="w-full py-3 px-6 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  >
                    {shareLoading ? 'Sharing…' : '🔗 Share Product'}
                  </button>
                  {shareMessage && (
                    <p className="mt-3 text-sm text-slate-700">{shareMessage}</p>
                  )}

                  {/* Trust Badges */}
                  <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-center">
                      <div className="text-2xl mb-1">✓</div>
                      <p className="text-xs font-semibold text-slate-900">Authentic</p>
                      <p className="text-xs text-slate-600">100% Genuine</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl mb-1">🛡️</div>
                      <p className="text-xs font-semibold text-slate-900">Secure</p>
                      <p className="text-xs text-slate-600">SSL Encrypted</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl mb-1">📦</div>
                      <p className="text-xs font-semibold text-slate-900">Delivery</p>
                      <p className="text-xs text-slate-600">Home Delivery</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Key Information Tabs */}
              <div className="mb-12">
                <div className="flex gap-1 border-b border-gray-300 mb-6">
                  {(['info', 'safety', 'specs'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`pb-4 px-6 font-semibold text-sm border-b-2 transition ${
                        activeTab === tab
                          ? 'border-emerald-600 text-emerald-600'
                          : 'border-transparent text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab === 'info'
                        ? 'Product Information'
                        : tab === 'safety'
                          ? 'Safety Information'
                          : 'Specifications'}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                <div className="bg-white rounded-lg">
                  {activeTab === 'info' && (
                    <div className="space-y-6">
                      {product.description && (
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 mb-3">About this Product</h3>
                          {product.description.includes('<') && product.description.includes('>') ? (
                            <SafeHTML
                              html={product.description}
                              className="text-slate-700 leading-7"
                            />
                          ) : (
                            <p className="text-slate-700 leading-7 whitespace-pre-wrap wrap-break-word">{product.description}</p>
                          )}
                        </div>
                      )}

                      {product.benefit && (
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                            💪 Key Benefits
                          </h3>
                          <ul className="space-y-2">
                            <li className="flex items-start gap-3">
                              <span className="text-emerald-600 font-bold mt-1">✓</span>
                              <span className="text-slate-700">{product.benefit}</span>
                            </li>
                          </ul>
                        </div>
                      )}

                      {product.dosage && (
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 mb-3">📋 Directions for Use</h3>
                          <p className="text-slate-700 leading-7">{product.dosage}</p>
                        </div>
                      )}

                      {product.packaging && (
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 mb-3">📦 Packaging</h3>
                          <p className="text-slate-700">{product.packaging}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'safety' && (
                    <div className="space-y-4">
                      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                        <h4 className="font-bold text-orange-900 mb-2">⚠️ Safety Information</h4>
                        <ul className="list-disc pl-5 space-y-2 text-sm text-orange-900">
                          {safetyItems.length > 0 ? (
                            safetyItems.map((item) => <li key={item}>{item}</li>)
                          ) : (
                            <>
                              <li>Read the label carefully before use</li>
                              <li>Store in a cool and dry place away from direct sunlight</li>
                              <li>Keep out of reach of children</li>
                              <li>Use as directed by physician</li>
                              <li>Do not use if allergic to any ingredients</li>
                            </>
                          )}
                        </ul>
                      </div>
                      {product.requiresPrescription && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <p className="text-sm font-semibold text-red-900">
                            ⚕️ This product requires a valid prescription
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'specs' && (
                    <div className="space-y-4">
                      {specificationItems.length > 0 && (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                          <h4 className="font-bold text-slate-900 mb-2">Specifications</h4>
                          <ul className="list-disc pl-5 space-y-2 text-sm text-slate-700">
                            {specificationItems.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {product.manufacturer && (
                          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="text-xs text-slate-600 font-semibold mb-1">Manufacturer</p>
                            <p className="text-slate-900 font-medium">{product.manufacturer}</p>
                          </div>
                        )}
                        {product.packaging && (
                          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="text-xs text-slate-600 font-semibold mb-1">Package Size</p>
                            <p className="text-slate-900 font-medium">{product.packaging}</p>
                          </div>
                        )}
                        {product.dosage && (
                          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="text-xs text-slate-600 font-semibold mb-1">Dosage</p>
                            <p className="text-slate-900 font-medium">{product.dosage}</p>
                          </div>
                        )}
                        {product.category && (
                          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="text-xs text-slate-600 font-semibold mb-1">Category</p>
                            <p className="text-slate-900 font-medium">{product.category}</p>
                          </div>
                        )}
                        {product.potency && (
                          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="text-xs text-slate-600 font-semibold mb-1">Potency</p>
                            <p className="text-slate-900 font-medium">{product.potency}</p>
                          </div>
                        )}
                      </div>
                      {product.healthConcerns && product.healthConcerns.length > 0 && (
                        <div>
                          <p className="font-semibold text-slate-900 mb-3">Health Concerns</p>
                          <div className="flex flex-wrap gap-2">
                            {product.healthConcerns.map((concern) => (
                              <span
                                key={concern}
                                className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
                              >
                                {concern}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Reviews Section */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Ratings & Reviews</h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Review Summary */}
                  <div className="md:col-span-1">
                    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 sticky top-24">
                      <div className="text-center mb-6">
                        <div className="text-5xl font-bold text-slate-900">
                          {Number(
                            reviewSummary.total > 0
                              ? reviewSummary.averageRating
                              : Number(product.rating || 0)
                          ).toFixed(1)}
                        </div>
                        <div className="flex justify-center my-2">
                          {[...Array(5)].map((_, i) => (
                            <span key={i} className="text-amber-500 text-xl">
                              ★
                            </span>
                          ))}
                        </div>
                        <p className="text-sm text-slate-600">
                          Based on {reviewSummary.total} ratings
                        </p>
                      </div>

                      {/* Star Distribution */}
                      <div className="space-y-2">
                        {[5, 4, 3, 2, 1].map((stars) => {
                          const count = starDistribution[stars as keyof typeof starDistribution];
                          const percentage = reviewSummary.total > 0 ? (count / reviewSummary.total) * 100 : 0;
                          return (
                            <div key={stars} className="flex items-center gap-2 text-xs">
                              <span className="w-12">{stars} ★</span>
                              <div className="flex-1 h-2 bg-gray-300 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-amber-500 rounded-full transition-all"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className="w-8 text-right text-slate-600">{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Review Form & Reviews List */}
                  <div className="md:col-span-2">
                    {/* Review Form */}
                    <div className="bg-emerald-50 border-2 border-emerald-200 rounded-lg p-6 mb-8">
                      <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                        ✍️ Share Your Experience
                      </h3>

                      {!isReviewUserLoggedIn ? (
                        <div className="bg-white rounded-lg p-4 text-center">
                          <p className="text-slate-700 mb-3">Please login to share your review</p>
                          <button
                            type="button"
                            onClick={redirectToLogin}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg text-sm font-bold"
                          >
                            Login to Review
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-4">
                            {/* Rating */}
                            <div>
                              <label className="block text-sm font-semibold text-slate-900 mb-2">
                                Your Rating
                              </label>
                              <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    type="button"
                                    onClick={() =>
                                      setReviewForm((prev) => ({ ...prev, rating: star }))
                                    }
                                    className={`text-3xl transition ${
                                      star <= reviewForm.rating
                                        ? 'text-amber-500'
                                        : 'text-gray-300 hover:text-amber-300'
                                    }`}
                                  >
                                    ★
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Title */}
                            <div>
                              <label className="block text-sm font-semibold text-slate-900 mb-2">
                                Review Title (optional)
                              </label>
                              <input
                                type="text"
                                value={reviewForm.title}
                                onChange={(e) =>
                                  setReviewForm((prev) => ({ ...prev, title: e.target.value }))
                                }
                                className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                placeholder="E.g., Great product, highly effective"
                              />
                            </div>

                            {/* Comment */}
                            <div>
                              <label className="block text-sm font-semibold text-slate-900 mb-2">
                                Your Review
                              </label>
                              <textarea
                                value={reviewForm.comment}
                                onChange={(e) =>
                                  setReviewForm((prev) => ({ ...prev, comment: e.target.value }))
                                }
                                className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                rows={4}
                                placeholder="Share your experience with this product..."
                              />
                            </div>

                            {error && (
                              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
                            )}

                            {/* Buttons */}
                            <div className="flex gap-3">
                              <button
                                onClick={submitReview}
                                disabled={reviewSubmitting}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-60 transition"
                              >
                                {reviewSubmitting
                                  ? 'Submitting...'
                                  : editingReviewId
                                    ? 'Update Review'
                                    : 'Submit Review'}
                              </button>
                              {editingReviewId && (
                                <button
                                  onClick={cancelEditReview}
                                  type="button"
                                  className="border border-slate-300 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 transition"
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Reviews List */}
                    <div className="space-y-4">
                      {reviewLoading && reviews.length === 0 ? (
                        <p className="text-center text-slate-600">Loading reviews...</p>
                      ) : reviews.length === 0 ? (
                        <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                          <p className="text-slate-600">No reviews yet. Be the first to review!</p>
                        </div>
                      ) : (
                        <>
                          {reviews.map((review) => (
                            <div
                              key={review._id}
                              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <p className="font-semibold text-slate-900">
                                    {review.userName || 'Anonymous User'}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {new Date(review.createdAt).toLocaleDateString('en-IN')}
                                  </p>
                                </div>
                                <div className="flex gap-1">
                                  {[...Array(5)].map((_, i) => (
                                    <span
                                      key={i}
                                      className={
                                        i < Math.round(Number(review.rating || 0))
                                          ? 'text-amber-500'
                                          : 'text-gray-300'
                                      }
                                    >
                                      ★
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {review.title && (
                                <p className="font-semibold text-slate-900 mb-1">{review.title}</p>
                              )}

                              {review.comment && (
                                <p className="text-slate-700 text-sm leading-6 mb-3">{review.comment}</p>
                              )}

                              {loggedInUserId && String(review.userId) === String(loggedInUserId) && (
                                <div className="flex gap-2 pt-3 border-t border-gray-200">
                                  <button
                                    type="button"
                                    onClick={() => startEditReview(review)}
                                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-3 py-1 border border-blue-200 rounded-md hover:bg-blue-50 transition"
                                  >
                                    ✏️ Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteReview(review._id)}
                                    className="text-xs font-semibold text-red-600 hover:text-red-700 px-3 py-1 border border-red-200 rounded-md hover:bg-red-50 transition"
                                  >
                                    🗑️ Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}

                          {reviewHasMore && (
                            <button
                              type="button"
                              onClick={loadMoreReviews}
                              disabled={reviewLoading}
                              className="w-full border border-gray-300 text-slate-700 py-3 rounded-lg text-sm font-bold hover:bg-gray-50 disabled:opacity-60 transition"
                            >
                              {reviewLoading ? 'Loading...' : 'Load More Reviews'}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Manufacturer Info */}
              {product.manufacturer && (
                <div className="mb-12 bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-slate-900 mb-3">📋 About the Manufacturer</h3>
                  <p className="text-slate-700">
                    Manufactured by <span className="font-semibold">{product.manufacturer}</span>, a trusted
                    name in healthcare products.
                  </p>
                </div>
              )}

              {/* Related Products Section */}
              {relatedProducts.length > 0 && (
                <div className="mb-12">
                  <h2 className="text-2xl font-bold text-slate-900 mb-6">Related Products</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {relatedProducts.map((relProduct) => (
                      <div
                        key={String(relProduct._id)}
                        onClick={() => router.push(`/medicines/${String(relProduct._id)}`)}
                        className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition cursor-pointer"
                      >
                        {/* Product Image */}
                        <div className="bg-gray-50 h-48 flex items-center justify-center overflow-hidden">
                          {relProduct.image ? (
                            <img
                              src={relProduct.image}
                              alt={relProduct.name}
                              className="h-full w-full object-contain p-4"
                            />
                          ) : (
                            <div className="text-5xl">{relProduct.icon || '💊'}</div>
                          )}
                        </div>

                        {/* Product Details */}
                        <div className="p-4">
                          <p className="text-xs text-slate-500 mb-1">{relProduct.brand || 'MySanjeevni'}</p>
                          {getQuantityLabel(relProduct) && (
                            <p className="text-[11px] font-semibold text-indigo-700 mb-1">
                              Qty: {getQuantityLabel(relProduct)}
                            </p>
                          )}
                          <h3 className="font-bold text-slate-900 text-sm line-clamp-2 mb-2">
                            {relProduct.name}
                          </h3>

                          {/* Rating */}
                          <div className="flex items-center gap-1 mb-2">
                            <span className="text-amber-500">★</span>
                            <span className="text-xs font-semibold text-slate-900">
                              {Number(relProduct.rating || 0).toFixed(1)}
                            </span>
                            <span className="text-xs text-slate-500">
                              ({relProduct.reviews || 0})
                            </span>
                          </div>

                          {/* Price */}
                          <div className="mb-3">
                            <div className="flex items-baseline gap-2">
                              <span className="text-lg font-bold text-slate-900">{relProduct.currencySymbol || '₹'}{relProduct.displayPrice ?? relProduct.price}</span>
                              {(() => {
                                const mrp = relProduct.displayMrp ?? relProduct.mrp;
                                const price = relProduct.displayPrice ?? relProduct.price;
                                return isIndia && mrp && price && mrp > price ? (
                                  <>
                                    <span className="text-xs text-slate-400 line-through">{relProduct.currencySymbol || '₹'}{mrp}</span>
                                    <span className="text-xs font-bold text-emerald-600">
                                      {Math.round(((mrp - price) / mrp) * 100)}% OFF
                                    </span>
                                  </>
                                ) : null;
                              })()}
                            </div>
                          </div>

                          {/* Stock Status */}
                          <div className="mb-3">
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${
                                relProduct.stock > 0
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {relProduct.stock > 0 ? 'In Stock' : 'Out of Stock'}
                            </span>
                          </div>

                          {/* Add to Cart Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              try {
                                const raw = localStorage.getItem('cart') || '[]';
                                const cart = JSON.parse(raw);
                                const existing = cart.find((item: any) => item.id === relProduct._id);

                                if (existing) existing.quantity += 1;
                                else {
                                  cart.push({
                                    id: relProduct._id,
                                    name: relProduct.name,
                                    price: relProduct.displayPrice ?? relProduct.price,
                                    displayPrice: relProduct.displayPrice ?? relProduct.price,
                                    displayMrp: relProduct.displayMrp ?? relProduct.mrp,
                                    currencySymbol: relProduct.currencySymbol || '₹',
                                    currency: relProduct.currency || 'INR',
                                    quantity: 1,
                                    brand: relProduct.brand,
                                    image: relProduct.image || relProduct.icon || '💊',
                                    vendorName: 'MySanjeevni',
                                  });
                                }

                                localStorage.setItem('cart', JSON.stringify(cart));
                                window.dispatchEvent(new Event('storage'));
                              } catch {
                                console.error('Failed to add to cart');
                              }
                            }}
                            disabled={relProduct.stock <= 0}
                            className={`w-full py-2 rounded-lg text-sm font-bold transition ${
                              relProduct.stock <= 0
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            {relProduct.stock <= 0 ? 'Out of Stock' : 'Add to Cart'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
