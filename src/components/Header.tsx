'use client';

import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { LogoImage } from './Logo';
import CategoryNav from './CategoryNav';
import { COUNTRY_OPTIONS, normalizeCountryCode, getCountryOption } from '@/lib/countryPreference';

declare global {
  interface Window {
    google?: any;
    googleTranslateElementInit?: () => void;
  }
}

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'bn', label: 'Bengali' },
  { code: 'te', label: 'Telugu' },
  { code: 'mr', label: 'Marathi' },
  { code: 'ta', label: 'Tamil' },
  { code: 'ur', label: 'Urdu' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'pa', label: 'Punjabi' },
  { code: 'or', label: 'Odia' },
] as const;

type SearchSuggestionKind =
  | 'Category'
  | 'Subcategory'
  | 'Sub-subcategory'
  | 'Product'
  | 'Doctor'
  | 'Lab Test'
  | 'Brand';

type SearchSuggestion = {
  value: string;
  type: SearchSuggestionKind;
};

const SEARCH_SECTION_PRIORITY = ['medicines', 'ayurveda', 'homeopathy', 'nutrition', 'organic-products', 'personal-care', 'fitness', 'sexual-wellness', 'baby-care', 'unani', 'disease', 'lab-tests'] as const;

// Product type to URL category mapping
const PRODUCT_TYPE_TO_ROUTE: Record<string, string> = {
  'Generic Medicine': 'medicines',
  'Ayurveda Medicine': 'ayurveda',
  'Ayurveda': 'ayurveda',
  'Homeopathy': 'homeopathy',
  'Lab Tests': 'lab-tests',
  'Nutrition': 'nutrition',
  'Personal Care': 'personal-care',
  'Fitness': 'fitness',
  'Sexual Wellness': 'sexual-wellness',
  'Baby Care': 'baby-care',
  'Unani': 'unani',
  'Disease': 'disease',
};

const AYURVEDA_QUERY_HINTS = [
  'ayurveda', 'ayurvedic', 'himalaya', 'organic india', 'baidyanath', 'dabur', 'zandu', 'charak', 'aimil',
  'chyawanprash', 'kadha', 'asava', 'arishta', 'guggulu', 'bhasm', 'pishti',
  'jamun', 'neem', 'karela', 'amrit', 'vaidhyam',
];

const HOMEOPATHY_QUERY_HINTS = [
  'homeopathy', 'homeopathic', 'sbl', 'reckeweg', 'schwabe', 'bjain', 'baksons', 'repl', 'adel',
  'mother tincture', 'biochemic', 'bach flower', '30 ch', '200 ch', '1000 ch', '6x', '3x',
];

const NUTRITION_QUERY_HINTS = [
  'nutrition', 'protein', 'vitamin', 'supplement', 'powder', 'shake', 'bar', 'whey', 'bcaa', 'creatine',
  'multivitamin', 'omega', 'calcium', 'iron', 'zinc', 'biotin', 'collagen',
];

const PERSONAL_CARE_QUERY_HINTS = [
  'personal care', 'skincare', 'shampoo', 'conditioner', 'soap', 'toothpaste', 'deodorant', 'lotion',
  'cream', 'face wash', 'moisturizer', 'sunscreen', 'lip balm', 'hair oil', 'body wash',
];

const FITNESS_QUERY_HINTS = [
  'fitness', 'gym', 'equipment', 'resistance', 'yoga', 'dumbbell', 'barbell', 'treadmill', 'mat',
  'tracker', 'band', 'ball', 'roller', 'kettlebell', 'exercise',
];

const SEXUAL_WELLNESS_QUERY_HINTS = [
  'sexual wellness', 'intimate', 'wellness product', 'performance', 'enhancement', 'lubrication',
];

const BABY_CARE_QUERY_HINTS = [
  'baby care', 'baby', 'infant', 'newborn', 'diaper', 'wipes', 'formula', 'bottle', 'shampoo',
  'lotion', 'teether', 'powder', 'toys', 'gear', 'stroller',
];

const UNANI_QUERY_HINTS = [
  'unani', 'unani medicine', 'hamdard', 'jaborandi', 'roghan', 'ubtan', 'ruh',
];

const ORGANIC_PRODUCTS_QUERY_HINTS = [
  'organic', 'organic products', 'organic food', 'coffee', 'tea', 'ghee', 'atta', 'flour', 'organic grains',
  'organic groceries', 'natural food', 'eco-friendly',
];

const LAB_TESTS_QUERY_HINTS = [
  'lab tests', 'test', 'blood test', 'thyroid', 'glucose', 'covid', 'diabetes', 'checkup',
  'profile', 'diagnostic', 'report',
];

const FALLBACK_SEARCH_SUGGESTIONS: SearchSuggestion[] = [
  { value: 'Fever & Cold Relief', type: 'Category' },
  { value: 'Headache & Migraine', type: 'Category' },
  { value: 'Digestive Care', type: 'Category' },
  { value: 'Pain Relief', type: 'Category' },
  { value: 'Skin Care Products', type: 'Category' },
  { value: 'Vitamins & Supplements', type: 'Category' },
  { value: 'Himalaya Products', type: 'Brand' },
  { value: 'Organic India', type: 'Brand' },
  { value: 'Homeopathic Remedies', type: 'Subcategory' },
  { value: 'SBL', type: 'Brand' },
  { value: 'Dr. Reckeweg', type: 'Brand' },
  { value: 'Protein Powder', type: 'Product' },
  { value: 'Multivitamins', type: 'Product' },
  { value: 'Weight Gainer', type: 'Product' },
  { value: 'Blood Test', type: 'Lab Test' },
  { value: 'Thyroid Test', type: 'Lab Test' },
  { value: 'Diabetes Test', type: 'Lab Test' },
  { value: 'Full Body Checkup', type: 'Lab Test' },
];

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [cartCount, setCartCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchRedirecting, setIsSearchRedirecting] = useState(false);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [isCountryMenuOpen, setIsCountryMenuOpen] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [selectedCountry, setSelectedCountry] = useState('IN');
  const [countrySearch, setCountrySearch] = useState('');
  const [countryLetter, setCountryLetter] = useState('A');
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([]);
  const [searchSuggestionPool, setSearchSuggestionPool] = useState<SearchSuggestion[]>([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const sortedCountryOptions = useMemo(
    () => [...COUNTRY_OPTIONS].sort((a, b) => a.label.localeCompare(b.label)),
    []
  );

  const visibleCountryOptions = useMemo(() => {
    const search = countrySearch.trim().toLowerCase();
    let list = sortedCountryOptions;

    if (search) {
      list = list.filter((option) => option.label.toLowerCase().includes(search) || option.code.toLowerCase().includes(search));
    } else if (countryLetter) {
      list = list.filter((option) => option.label.toUpperCase().startsWith(countryLetter));
    }

    return list;
  }, [countrySearch, countryLetter, sortedCountryOptions]);

  const getRootDomain = (hostname: string) => {
    const parts = hostname.split('.').filter(Boolean);
    if (parts.length < 2) return '';
    return `.${parts.slice(-2).join('.')}`;
  };

  const setTranslateCookies = (languageCode: string) => {
    const cookieValue = `/en/${languageCode}`;
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    const baseAttrs = `path=/; SameSite=Lax${secure}`;

    // Clear existing cookie variants first to avoid domain/path precedence issues.
    document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 GMT; ${baseAttrs}`;

    const hostname = window.location.hostname;
    if (hostname && hostname !== 'localhost' && !/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 GMT; ${baseAttrs}; domain=${hostname}`;
      const rootDomain = getRootDomain(hostname);
      if (rootDomain) {
        document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 GMT; ${baseAttrs}; domain=${rootDomain}`;
      }
    }

    // Set cookie on current host.
    document.cookie = `googtrans=${cookieValue}; ${baseAttrs}`;

    // Set additional domain-scoped variants for deployed environments.
    if (hostname && hostname !== 'localhost' && !/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      document.cookie = `googtrans=${cookieValue}; ${baseAttrs}; domain=${hostname}`;
      const rootDomain = getRootDomain(hostname);
      if (rootDomain) {
        document.cookie = `googtrans=${cookieValue}; ${baseAttrs}; domain=${rootDomain}`;
      }
    }
  };

  const setCountryPreference = (countryCode: string) => {
    const normalized = normalizeCountryCode(countryCode);
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    const baseAttrs = `path=/; SameSite=Lax${secure}`;

    document.cookie = `preferredCountry=; expires=Thu, 01 Jan 1970 00:00:00 GMT; ${baseAttrs}`;
    document.cookie = `preferredCountry=${normalized}; ${baseAttrs}`;

    const hostname = window.location.hostname;
    if (hostname && hostname !== 'localhost' && !/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
      document.cookie = `preferredCountry=; expires=Thu, 01 Jan 1970 00:00:00 GMT; ${baseAttrs}; domain=${hostname}`;
      document.cookie = `preferredCountry=${normalized}; ${baseAttrs}; domain=${hostname}`;
      const rootDomain = getRootDomain(hostname);
      if (rootDomain) {
        document.cookie = `preferredCountry=; expires=Thu, 01 Jan 1970 00:00:00 GMT; ${baseAttrs}; domain=${rootDomain}`;
        document.cookie = `preferredCountry=${normalized}; ${baseAttrs}; domain=${rootDomain}`;
      }
    }

    localStorage.setItem('preferredCountry', normalized);
    setSelectedCountry(normalized);
    setCountryLetter(getCountryOption(normalized).label.charAt(0).toUpperCase());
    setCountrySearch('');
    // Native `storage` only fires across tabs — also notify same-tab listeners (cart).
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(
      new CustomEvent('preferredCountryChanged', { detail: { country: normalized } })
    );
  };

  useEffect(() => {
    // Mark component as mounted to prevent hydration mismatch
    setIsMounted(true);

    const readCartCount = () => {
      try {
        const cartStr = localStorage.getItem('cart');
        if (!cartStr) return 0;
        const cart = JSON.parse(cartStr);
        if (!Array.isArray(cart)) return 0;
        return cart.reduce((sum: number, item: any) => sum + (item?.quantity || 0), 0);
      } catch {
        return 0;
      }
    };

    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        setUser(JSON.parse(userStr));
      }
    } catch {
      localStorage.removeItem('user');
    }

    setCartCount(readCartCount());

    const handleStorageChange = () => {
      setCartCount(readCartCount());
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    const storedLanguage = localStorage.getItem('siteLanguage') || 'en';
    setSelectedLanguage(storedLanguage);
    setTranslateCookies(storedLanguage);

    const storedCountry = normalizeCountryCode(localStorage.getItem('preferredCountry') || 'IN');
    setSelectedCountry(storedCountry);
    setCountryLetter(getCountryOption(storedCountry).label.charAt(0).toUpperCase());
    setCountryPreference(storedCountry);

    if (!document.getElementById('google-translate-script')) {
      window.googleTranslateElementInit = () => {
        if (!window.google?.translate?.TranslateElement) return;
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            autoDisplay: false,
            includedLanguages: LANGUAGE_OPTIONS.map((opt) => opt.code).join(','),
          },
          'google_translate_element'
        );
      };

      const script = document.createElement('script');
      script.id = 'google-translate-script';
      script.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const suggestionMap = new Map<string, SearchSuggestion>();

    const pushSuggestion = (value: unknown, type: SearchSuggestionKind) => {
      const cleanValue = String(value || '').trim();
      if (cleanValue.length < 2) return;
      const key = `${type}:${cleanValue.toLowerCase()}`;
      if (!suggestionMap.has(key)) {
        suggestionMap.set(key, { value: cleanValue, type });
      }
    };

    for (const fallbackSuggestion of FALLBACK_SEARCH_SUGGESTIONS) {
      pushSuggestion(fallbackSuggestion.value, fallbackSuggestion.type);
    }

    const loadSearchSuggestions = async () => {
      try {
        const [productsResult, doctorsResult, labTestsResult, categoriesResult] = await Promise.allSettled([
          fetch('/api/products?limit=600', { cache: 'no-store' }),
          fetch('/api/doctors', { cache: 'no-store' }),
          fetch('/api/lab-tests?limit=300', { cache: 'no-store' }),
          fetch('/api/categories?mode=config', { cache: 'no-store' }),
        ]);

        if (productsResult.status === 'fulfilled' && productsResult.value.ok) {
          const productsData = await productsResult.value.json();
          const products = Array.isArray(productsData?.products) ? productsData.products : [];

          for (const product of products) {
            pushSuggestion(product?.name, 'Product');
            pushSuggestion(product?.brand, 'Brand');
            pushSuggestion(product?.category, 'Category');
            pushSuggestion(product?.subcategory, 'Subcategory');
            pushSuggestion(product?.diseaseCategory, 'Subcategory');
            pushSuggestion(product?.diseaseSubcategory, 'Sub-subcategory');
          }
        }

        if (doctorsResult.status === 'fulfilled' && doctorsResult.value.ok) {
          const doctorsData = await doctorsResult.value.json();
          const doctors = Array.isArray(doctorsData?.doctors) ? doctorsData.doctors : [];

          for (const doctor of doctors) {
            pushSuggestion(doctor?.name, 'Doctor');
            pushSuggestion(doctor?.department, 'Category');
            pushSuggestion(doctor?.specialization, 'Subcategory');
          }
        }

        if (labTestsResult.status === 'fulfilled' && labTestsResult.value.ok) {
          const labTestsData = await labTestsResult.value.json();
          const tests = Array.isArray(labTestsData?.tests) ? labTestsData.tests : [];

          for (const test of tests) {
            pushSuggestion(test?.name, 'Lab Test');
            pushSuggestion(test?.category, 'Category');
          }
        }

        if (categoriesResult.status === 'fulfilled' && categoriesResult.value.ok) {
          const categoriesData = await categoriesResult.value.json();
          const config = categoriesData?.config || {};

          const vendorCategoryMap = config?.vendorCategoryMap || {};
          for (const categories of Object.values(vendorCategoryMap) as string[][]) {
            for (const category of categories) {
              pushSuggestion(category, 'Category');
            }
          }

          const subcategoryMapByType = config?.subcategoryMapByType || {};
          for (const subcategoryMap of Object.values(subcategoryMapByType) as Record<string, string[]>[]) {
            for (const [subcategory, nestedSubcategories] of Object.entries(subcategoryMap)) {
              pushSuggestion(subcategory, 'Subcategory');
              for (const nestedSubcategory of nestedSubcategories || []) {
                pushSuggestion(nestedSubcategory, 'Sub-subcategory');
              }
            }
          }

          const diseaseSubcategoryMap = config?.diseaseSubcategoryMap || {};
          for (const [diseaseCategory, diseaseSubcategories] of Object.entries(diseaseSubcategoryMap) as [string, string[]][]) {
            pushSuggestion(diseaseCategory, 'Subcategory');
            for (const diseaseSubcategory of diseaseSubcategories || []) {
              pushSuggestion(diseaseSubcategory, 'Sub-subcategory');
            }
          }
        }
      } catch {
        // Keep fallback suggestions when dynamic loading fails.
      } finally {
        if (active) {
          setSearchSuggestionPool(Array.from(suggestionMap.values()));
        }
      }
    };

    loadSearchSuggestions();

    return () => {
      active = false;
    };
  }, []);

  const changeLanguage = (languageCode: string) => {
    setSelectedLanguage(languageCode);
    localStorage.setItem('siteLanguage', languageCode);
    setTranslateCookies(languageCode);
    setIsLanguageMenuOpen(false);
    window.location.reload();
  };

  const changeCountry = (countryCode: string) => {
    setCountryPreference(countryCode);
    setIsCountryMenuOpen(false);
    window.location.reload();
  };

  const generateSearchSuggestions = (query: string): SearchSuggestion[] => {
    if (!query.trim()) {
      setSearchSuggestions([]);
      return [];
    }

    const lowerQuery = query.toLowerCase().trim();

    const source = searchSuggestionPool.length > 0 ? searchSuggestionPool : FALLBACK_SEARCH_SUGGESTIONS;

    const filtered = source
      .map((suggestion) => ({
        ...suggestion,
        index: suggestion.value.toLowerCase().indexOf(lowerQuery),
      }))
      .filter((suggestion) => suggestion.index >= 0)
      .sort((a, b) => {
        const aStarts = a.index === 0 ? 0 : 1;
        const bStarts = b.index === 0 ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        if (a.index !== b.index) return a.index - b.index;
        return a.value.localeCompare(b.value);
      })
      .slice(0, 10)
      .map(({ value, type }) => ({ value, type }));

    setSearchSuggestions(filtered);
    return filtered;
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('vendorToken');
    localStorage.removeItem('vendorInfo');
    setUser(null);
    setIsUserMenuOpen(false);
    window.dispatchEvent(new Event('storage'));
    router.replace('/');
  };

  const getSearchSection = (product: any) => {
    const normalize = (value: unknown) =>
      String(value || '')
        .toLowerCase()
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');

    const productType = normalize(product?.productType);
    const category = normalize(product?.category);
    const subcategory = normalize(product?.subcategory);
    const brand = normalize(product?.brand);
    const name = normalize(product?.name);

    // Check for precise productType match first
    const rawProductType = String(product?.productType || '').trim();
    const route = PRODUCT_TYPE_TO_ROUTE[rawProductType];
    if (route && route !== 'medicines') {
      return route;
    }

    const ayurvedaHints = new Set([
      'ayurveda', 'ayurvedic', 'himalaya', 'organic india', 'baidyanath', 'dabur', 'zandu', 'charak', 'aimil',
      'ras sindoor', 'bhasm pishti', 'vati gutika guggulu', 'asava arishta kadha', 'loha mandur',
      'churan powder avaleha pak', 'tailam ghrita', 'chyawanprash', 'honey', 'digestives', 'herbal vegetable juice',
      'jamun', 'neem', 'karela', 'amrit', 'vaidhyam',
    ]);

    const homeopathyHints = new Set([
      'homeopathy', 'homeopathic', 'sbl', 'dr reckeweg', 'willmar schwabe', 'schwabe india', 'adel pekana', 'bjain',
      'r s bhargava', 'baksons', 'repl', 'new life', 'mother tinctures', 'biochemic', 'triturations',
      'bio combination', 'bach flower', 'homeopathy kits', 'milleimal lm potency',
      '3x', '6x', '3 ch', '6 ch', '12 ch', '30 ch', '200 ch', '1000 ch', '10m ch', '50m ch', 'cm ch',
    ]);

    const nutritionHints = new Set(NUTRITION_QUERY_HINTS);
    const organicProductsHints = new Set(ORGANIC_PRODUCTS_QUERY_HINTS);
    const personalCareHints = new Set(PERSONAL_CARE_QUERY_HINTS);
    const fitnessHints = new Set(FITNESS_QUERY_HINTS);
    const sexualWellnessHints = new Set(SEXUAL_WELLNESS_QUERY_HINTS);
    const babyCareHints = new Set(BABY_CARE_QUERY_HINTS);
    const unaniHints = new Set(UNANI_QUERY_HINTS);
    const labTestsHints = new Set(LAB_TESTS_QUERY_HINTS);

    const fields = [productType, category, subcategory, brand, name];

    // Check for specific category signals
    const hasNutritionSignal = fields.some((field) => field.includes('nutrition')) ||
      fields.some((field) => Array.from(nutritionHints).some((hint) => field.includes(hint)));
    
    const hasOrganicProductsSignal = fields.some((field) => field.includes('organic')) ||
      fields.some((field) => Array.from(organicProductsHints).some((hint) => field.includes(hint)));
    
    const hasPersonalCareSignal = fields.some((field) => field.includes('personal care')) ||
      fields.some((field) => Array.from(personalCareHints).some((hint) => field.includes(hint)));
    
    const hasFitnessSignal = fields.some((field) => field.includes('fitness')) ||
      fields.some((field) => Array.from(fitnessHints).some((hint) => field.includes(hint)));
    
    const hasSexualWellnessSignal = fields.some((field) => field.includes('sexual wellness') || field.includes('intimate')) ||
      fields.some((field) => Array.from(sexualWellnessHints).some((hint) => field.includes(hint)));
    
    const hasBabyCareSignal = fields.some((field) => field.includes('baby care')) ||
      fields.some((field) => Array.from(babyCareHints).some((hint) => field.includes(hint)));
    
    const hasUnaniSignal = fields.some((field) => field.includes('unani')) ||
      fields.some((field) => Array.from(unaniHints).some((hint) => field.includes(hint)));
    
    const hasLabTestsSignal = fields.some((field) => field.includes('lab tests') || field.includes('lab test')) ||
      fields.some((field) => Array.from(labTestsHints).some((hint) => field.includes(hint)));

    const hasHomeopathySignal =
      fields.some((field) => field.includes('homeopathy') || field.includes('homeopathic')) ||
      fields.some((field) => Array.from(homeopathyHints).some((hint) => field.includes(hint)));

    const hasAyurvedaSignal =
      fields.some((field) => field.includes('ayurveda') || field.includes('ayurvedic')) ||
      fields.some((field) => Array.from(ayurvedaHints).some((hint) => field.includes(hint)));

    if (hasUnaniSignal && !hasAyurvedaSignal && !hasHomeopathySignal) return 'unani';
    if (hasBabyCareSignal && !hasPersonalCareSignal) return 'baby-care';
    if (hasSexualWellnessSignal && !hasPersonalCareSignal) return 'sexual-wellness';
    if (hasFitnessSignal && !hasNutritionSignal && !hasOrganicProductsSignal) return 'fitness';
    if (hasOrganicProductsSignal && !hasPersonalCareSignal) return 'organic-products';
    if (hasPersonalCareSignal && !hasNutritionSignal && !hasOrganicProductsSignal) return 'personal-care';
    if (hasNutritionSignal && !hasPersonalCareSignal && !hasOrganicProductsSignal) return 'nutrition';
    if (hasLabTestsSignal) return 'lab-tests';
    if (hasHomeopathySignal) return 'homeopathy';
    if (hasAyurvedaSignal) return 'ayurveda';
    return 'medicines';
  };

  const getSearchPriorityForQuery = (query: string) => {
    const normalizedQuery = query
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' ');

    const isNutritionIntent = NUTRITION_QUERY_HINTS.some((hint) => normalizedQuery.includes(hint));
    const isOrganicProductsIntent = ORGANIC_PRODUCTS_QUERY_HINTS.some((hint) => normalizedQuery.includes(hint));
    const isPersonalCareIntent = PERSONAL_CARE_QUERY_HINTS.some((hint) => normalizedQuery.includes(hint));
    const isFitnessIntent = FITNESS_QUERY_HINTS.some((hint) => normalizedQuery.includes(hint));
    const isSexualWellnessIntent = SEXUAL_WELLNESS_QUERY_HINTS.some((hint) => normalizedQuery.includes(hint));
    const isBabyCareIntent = BABY_CARE_QUERY_HINTS.some((hint) => normalizedQuery.includes(hint));
    const isUnaniIntent = UNANI_QUERY_HINTS.some((hint) => normalizedQuery.includes(hint));
    const isLabTestsIntent = LAB_TESTS_QUERY_HINTS.some((hint) => normalizedQuery.includes(hint));
    const isAyurvedaIntent = AYURVEDA_QUERY_HINTS.some((hint) => normalizedQuery.includes(hint));
    const isHomeopathyIntent = HOMEOPATHY_QUERY_HINTS.some((hint) => normalizedQuery.includes(hint));

    // Build priority array based on detected intents
    const priority: (typeof SEARCH_SECTION_PRIORITY)[number][] = [];

    if (isUnaniIntent && !isAyurvedaIntent && !isHomeopathyIntent) {
      return ['unani', 'medicines', 'ayurveda', 'homeopathy', 'nutrition', 'personal-care', 'fitness', 'sexual-wellness', 'baby-care', 'lab-tests'] as const;
    }

    if (isOrganicProductsIntent && !isNutritionIntent) {
      return ['organic-products', 'nutrition', 'personal-care', 'medicines', 'ayurveda', 'homeopathy', 'fitness', 'sexual-wellness', 'baby-care', 'unani', 'lab-tests'] as const;
    }

    if (isBabyCareIntent && !isPersonalCareIntent) {
      return ['baby-care', 'personal-care', 'nutrition', 'medicines', 'ayurveda', 'homeopathy', 'fitness', 'sexual-wellness', 'unani', 'lab-tests'] as const;
    }

    if (isSexualWellnessIntent && !isPersonalCareIntent) {
      return ['sexual-wellness', 'personal-care', 'nutrition', 'medicines', 'ayurveda', 'homeopathy', 'fitness', 'baby-care', 'unani', 'lab-tests'] as const;
    }

    if (isFitnessIntent && !isNutritionIntent && !isOrganicProductsIntent) {
      return ['fitness', 'nutrition', 'personal-care', 'medicines', 'ayurveda', 'homeopathy', 'sexual-wellness', 'baby-care', 'unani', 'lab-tests'] as const;
    }

    if (isPersonalCareIntent && !isNutritionIntent && !isOrganicProductsIntent) {
      return ['personal-care', 'nutrition', 'baby-care', 'medicines', 'ayurveda', 'homeopathy', 'fitness', 'sexual-wellness', 'unani', 'lab-tests'] as const;
    }

    if (isNutritionIntent && !isPersonalCareIntent && !isOrganicProductsIntent) {
      return ['nutrition', 'fitness', 'personal-care', 'medicines', 'ayurveda', 'homeopathy', 'sexual-wellness', 'baby-care', 'unani', 'lab-tests'] as const;
    }

    if (isLabTestsIntent) {
      return ['lab-tests', 'medicines', 'ayurveda', 'homeopathy', 'nutrition', 'personal-care', 'fitness', 'sexual-wellness', 'baby-care', 'unani'] as const;
    }

    if (isAyurvedaIntent && !isHomeopathyIntent) {
      return ['ayurveda', 'medicines', 'homeopathy', 'nutrition', 'personal-care', 'fitness', 'sexual-wellness', 'baby-care', 'unani', 'lab-tests'] as const;
    }

    if (isHomeopathyIntent && !isAyurvedaIntent) {
      return ['homeopathy', 'medicines', 'ayurveda', 'nutrition', 'personal-care', 'fitness', 'sexual-wellness', 'baby-care', 'unani', 'lab-tests'] as const;
    }

    if (isAyurvedaIntent && isHomeopathyIntent) {
      return ['ayurveda', 'homeopathy', 'medicines', 'nutrition', 'personal-care', 'fitness', 'sexual-wellness', 'baby-care', 'unani', 'lab-tests'] as const;
    }

    return SEARCH_SECTION_PRIORITY;
  };

  const getRouteForSection = (section: string, query: string) => {
    const encodedQuery = encodeURIComponent(query);
    switch (section) {
      case 'ayurveda':
        return `/ayurveda?search=${encodedQuery}`;
      case 'homeopathy':
        return `/homeopathy?search=${encodedQuery}`;
      case 'lab-tests':
        return `/medicines?category=lab%20tests&search=${encodedQuery}#products-section`;
      case 'nutrition':
        return `/medicines?category=nutrition&search=${encodedQuery}#products-section`;
      case 'organic-products':
        return `/medicines?category=organic%20products&search=${encodedQuery}#products-section`;
      case 'personal-care':
        return `/medicines?category=personal%20care&search=${encodedQuery}#products-section`;
      case 'fitness':
        return `/medicines?category=fitness&search=${encodedQuery}#products-section`;
      case 'sexual-wellness':
        return `/medicines?category=sexual%20wellness&search=${encodedQuery}#products-section`;
      case 'baby-care':
        return `/medicines?category=baby%20care&search=${encodedQuery}#products-section`;
      case 'unani':
        return `/medicines?category=unani&search=${encodedQuery}#products-section`;
      case 'disease':
        return `/medicines?category=disease&search=${encodedQuery}#products-section`;
      default:
        return `/medicines?search=${encodedQuery}#products-section`;
    }
  };

  const initializeSectionScores = () => {
    const scores: Record<string, number> = {};
    for (const section of SEARCH_SECTION_PRIORITY) {
      scores[section] = 0;
    }
    return scores;
  };

  const handleSearch = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? searchQuery).trim();
    if (!q) {
      router.push('/medicines#products-section');
      return;
    }

    setIsSearchRedirecting(true);
    try {
      const allResponse = await fetch('/api/products?limit=800', { cache: 'no-store' });

      if (!allResponse.ok) {
        router.push(`/medicines?search=${encodeURIComponent(q)}#products-section`);
        return;
      }

      const allData = await allResponse.json();
      const allProducts = Array.isArray(allData?.products) ? allData.products : [];

      const normalizedQuery = q
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

      const matchesSearchQuery = (product: any) => {
        const asText = (value: unknown) =>
          String(value || '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();

        const textFields = [
          product?.name,
          product?.description,
          product?.category,
          product?.subcategory,
          product?.brand,
          product?.benefit,
          product?.productType,
          product?.potency,
          product?.quantityUnit,
          product?.diseaseCategory,
          product?.diseaseSubcategory,
          product?.quantity,
        ];

        const healthConcerns = Array.isArray(product?.healthConcerns)
          ? product.healthConcerns.join(' ')
          : '';

        return [
          ...textFields,
          healthConcerns,
        ].some((field) => asText(field).includes(normalizedQuery));
      };

      const products = allProducts.filter(matchesSearchQuery);

      if (products.length === 0) {
        router.push(`/medicines?search=${encodeURIComponent(q)}#products-section`);
        return;
      }

      const sectionCounts = initializeSectionScores();
      const nameMatchScores = initializeSectionScores();

      for (const product of products) {
        const section = getSearchSection(product);
        sectionCounts[section] = (sectionCounts[section] || 0) + 1;

        const productName = String(product?.name || '')
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim();

        if (normalizedQuery) {
          if (productName === normalizedQuery) {
            nameMatchScores[section] = (nameMatchScores[section] || 0) + 5;
          } else if (productName.startsWith(normalizedQuery)) {
            nameMatchScores[section] = (nameMatchScores[section] || 0) + 3;
          } else if (productName.includes(normalizedQuery)) {
            nameMatchScores[section] = (nameMatchScores[section] || 0) + 1;
          }
        }
      }

      const sectionPriority = getSearchPriorityForQuery(q);

      // Check for name matches in priority order
      const sectionNameMatches: Record<string, boolean> = {};
      for (const section of sectionPriority) {
        const sectionProducts = products.filter((product: any) => getSearchSection(product) === section);
        sectionNameMatches[section] = sectionProducts.some((product: any) => {
          const productName = String(product?.name || '').toLowerCase().replace(/\s+/g, ' ').trim();
          return normalizedQuery && (productName === normalizedQuery || productName.startsWith(normalizedQuery) || productName.includes(normalizedQuery));
        });
      }

      // Find which sections have name matches
      const sectionsWithNameMatches = sectionPriority.filter((section) => sectionNameMatches[section]);

      // If only one section has name matches, route there
      if (sectionsWithNameMatches.length === 1) {
        const matchedSection = sectionsWithNameMatches[0];
        router.push(getRouteForSection(matchedSection, q));
        return;
      }

      // If multiple sections have name matches, use priority
      if (sectionsWithNameMatches.length > 1) {
        router.push(getRouteForSection(sectionsWithNameMatches[0], q));
        return;
      }

      // Product name match gets first priority for routing using weighted score.
      const bestNameMatchedSection = sectionPriority.reduce<string | null>((best, section) => {
        if (best === null) {
          return nameMatchScores[section] > 0 ? section : null;
        }
        if (nameMatchScores[section] > nameMatchScores[best]) {
          return section;
        }
        return best;
      }, null);

      if (bestNameMatchedSection) {
        router.push(getRouteForSection(bestNameMatchedSection, q));
        return;
      }

      // Fall back to first section with products
      const firstMatchedSection = sectionPriority.find((section) => sectionCounts[section] > 0);

      if (firstMatchedSection) {
        router.push(getRouteForSection(firstMatchedSection, q));
        return;
      }

      router.push(`/medicines?search=${encodeURIComponent(q)}#products-section`);
    } catch {
      router.push(`/medicines?search=${encodeURIComponent(q)}#products-section`);
    } finally {
      setIsSearchRedirecting(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-100">
      {/* Top Bar - Similar to 1mg */}
      <div className="bg-linear-to-r from-emerald-600 to-emerald-500 text-white py-2 px-3 sm:px-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center text-[11px] sm:text-sm gap-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            {isMounted && (
              <>
                <span className="truncate">Your All-in-One Natural Healthcare Destination</span>
                <span className="text-emerald-100 hidden sm:inline">|</span>
                <span className="hidden sm:inline">India&apos;s Healthcare Platform</span>
              </>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-4 shrink-0">
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsCountryMenuOpen((prev) => !prev)}
                className="hover:text-emerald-100"
                aria-label="Change country"
              >
                {getCountryOption(selectedCountry).label}
              </button>
              {isCountryMenuOpen && (
                <div className="absolute right-0 mt-2 w-88 rounded-lg bg-white text-gray-800 shadow-lg border border-gray-200 z-60 overflow-hidden">
                  <div className="p-3 border-b border-gray-100 space-y-2">
                    <input
                      type="text"
                      value={countrySearch}
                      onChange={(e) => setCountrySearch(e.target.value)}
                      placeholder="Search country"
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-auto pr-1">
                      <button
                        type="button"
                        onClick={() => {
                          setCountryLetter('');
                          setCountrySearch('');
                        }}
                        className={`rounded-full px-2 py-1 text-xs border ${!countryLetter && !countrySearch ? 'bg-emerald-600 text-white border-emerald-600' : 'border-gray-200 hover:bg-gray-50'}`}
                      >
                        All
                      </button>
                      {alphabet.map((letter) => (
                        <button
                          key={letter}
                          type="button"
                          onClick={() => {
                            setCountrySearch('');
                            setCountryLetter(letter);
                          }}
                          className={`rounded-full px-2 py-1 text-xs border ${countryLetter === letter && !countrySearch ? 'bg-emerald-600 text-white border-emerald-600' : 'border-gray-200 hover:bg-gray-50'}`}
                        >
                          {letter}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="max-h-72 overflow-auto">
                    {visibleCountryOptions.length > 0 ? (
                      visibleCountryOptions.map((option) => (
                        <button
                          key={option.code}
                          type="button"
                          onClick={() => changeCountry(option.code)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 ${
                            selectedCountry === option.code ? 'bg-emerald-50 text-emerald-700 font-semibold' : ''
                          }`}
                        >
                          <span className="block">{option.label}</span>
                          <span className="block text-xs text-gray-500">{option.code}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-4 text-sm text-gray-500">No countries found.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsLanguageMenuOpen((prev) => !prev)}
                className="hover:text-emerald-100"
                aria-label="Change website language"
              >
                Language
              </button>
              {isLanguageMenuOpen && (
                <div className="absolute right-0 mt-2 w-44 rounded-lg bg-white text-gray-800 shadow-lg border border-gray-200 z-60 max-h-72 overflow-auto">
                  {LANGUAGE_OPTIONS.map((option) => (
                    <button
                      key={option.code}
                      type="button"
                      onClick={() => changeLanguage(option.code)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-emerald-50 ${
                        selectedLanguage === option.code ? 'bg-emerald-50 text-emerald-700 font-semibold' : ''
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Link href="/help" className="hover:text-emerald-100">
              Help
            </Link>
            <Link href="/track" className="hover:text-emerald-100">
              Track Orders
            </Link>
          </div>
        </div>
      </div>

      <div id="google_translate_element" className="hidden" />

      {/* Main Navigation */}
      <div className="bg-white">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex justify-between items-center gap-3">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3">
              <div className="h-10 w-10 sm:h-12 sm:w-12 shrink-0">
                <LogoImage />
              </div>
              <div className="text-lg sm:text-xl font-bold">
                <span className="text-emerald-600">My</span><span className="text-orange-500">Sanjeevni</span>
              </div>
            </Link>

            {/* Search Bar - Like 1mg */}
            <div className="hidden md:flex flex-1 mx-8">
              <div className="w-full relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    generateSearchSuggestions(e.target.value);
                    setShowSearchSuggestions(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setShowSearchSuggestions(false);
                      handleSearch();
                    }
                  }}
                  onFocus={() => {
                    if (searchQuery.trim()) {
                      setShowSearchSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    // Delay closing to allow click on suggestions
                    setTimeout(() => setShowSearchSuggestions(false), 200);
                  }}
                  placeholder="Search for medicines, health conditions, products..."
                  className="w-full px-4 py-3 rounded-lg bg-gray-100 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-gray-900 placeholder:text-gray-700"
                />
                
                {/* Search Suggestions Dropdown */}
                {showSearchSuggestions && searchSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                    {searchSuggestions.map((suggestion, index) => (
                      <button
                        key={`${suggestion.type}-${suggestion.value}-${index}`}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSearchQuery(suggestion.value);
                          setShowSearchSuggestions(false);
                          handleSearch(suggestion.value);
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-emerald-50 border-b border-gray-100 last:border-b-0 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <span className="text-sm text-gray-700 flex-1">{suggestion.value}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 rounded px-2 py-1">
                          {suggestion.type}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                
                <button
                  type="button"
                  onClick={() => {
                    handleSearch();
                  }}
                  disabled={isSearchRedirecting}
                  className="absolute right-3 top-3 text-gray-400 hover:text-emerald-600"
                  aria-label="Search"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Right Navigation */}
            <div className="hidden md:flex items-center gap-6">
              <Link
                href="/cart"
                className="relative flex items-center gap-2 text-emerald-700 hover:text-orange-500 transition"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 9m10 0l2-9m-8 9h8m-8 0a1 1 0 11-2 0 1 1 0 012 0zm8 0a1 1 0 11-2 0 1 1 0 012 0z"
                  />
                </svg>
                <span>Cart</span>
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </Link>

              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center gap-2 text-emerald-700 hover:text-orange-500 transition"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg py-2 z-50">
                    {user ? (
                      <>
                        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                          <p className="text-sm font-semibold text-gray-900">
                            {user.fullName}
                          </p>
                          <p className="text-xs text-gray-600">{user.email}</p>
                        </div>
                        <Link
                          href="/profile"
                          className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          👤 My Profile
                        </Link>
                        <Link
                          href="/orders"
                          className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          📦 My Orders
                        </Link>
                        <Link
                          href="/addresses"
                          className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          🏠 Addresses
                        </Link>
                        {user.role === 'admin' && (
                          <>
                            <div className="border-t border-gray-100 my-2"></div>
                            <Link
                              href="/admin"
                              className="block px-4 py-2 text-blue-600 hover:bg-blue-50 font-medium"
                              onClick={() => setIsUserMenuOpen(false)}
                            >
                              ⚙️ Admin Panel
                            </Link>
                          </>
                        )}
                        {user.role === 'doctor' && (
                          <>
                            <div className="border-t border-gray-100 my-2"></div>
                            <Link
                              href="/doctor/panel"
                              className="block px-4 py-2 text-emerald-600 hover:bg-emerald-50 font-medium"
                              onClick={() => setIsUserMenuOpen(false)}
                            >
                              👨‍⚕️ Doctor Panel
                            </Link>
                          </>
                        )}
                        {user.role === 'vendor' && (
                          <>
                            <div className="border-t border-gray-100 my-2"></div>
                            <Link
                              href="/vendor/dashboard"
                              className="block px-4 py-2 text-emerald-600 hover:bg-emerald-50 font-medium"
                              onClick={() => setIsUserMenuOpen(false)}
                            >
                              🏪 Vendor Dashboard
                            </Link>
                          </>
                        )}
                        <div className="border-t border-gray-100 my-2"></div>
                        <button
                          onClick={handleLogout}
                          className="block w-full text-left px-4 py-2 text-red-600 hover:bg-red-50"
                        >
                          🚪 Logout
                        </button>
                      </>
                    ) : (
                      <>
                        <Link
                          href="/login"
                          className="block px-4 py-2 text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 font-medium transition duration-200"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          SignIn
                        </Link>
                        <Link
                          href="/signup"
                          className="block px-4 py-2 text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 font-medium transition duration-200"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          SignUp
                        </Link>
                        <div className="border-t border-gray-100 my-2"></div>
                        <Link
                          href="/signup?role=vendor"
                          className="block px-4 py-2 text-emerald-600 hover:bg-emerald-50 font-semibold"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          🤝 Become a Vendor
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Actions */}
            <div className="md:hidden flex items-center gap-2">
              <Link
                href="/cart"
                className="relative rounded-lg border border-gray-200 p-2 text-emerald-700"
                aria-label="Cart"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 9m10 0l2-9m-8 9h8m-8 0a1 1 0 11-2 0 1 1 0 012 0zm8 0a1 1 0 11-2 0 1 1 0 012 0z" />
                </svg>
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-[10px] font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </Link>

              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-gray-700 rounded-lg border border-gray-200 p-2"
                aria-label="Open menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Search */}
          <div className="md:hidden mt-3">
            <div className="w-full relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  generateSearchSuggestions(e.target.value);
                  setShowSearchSuggestions(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    setShowSearchSuggestions(false);
                    handleSearch();
                  }
                }}
                onFocus={() => {
                  if (searchQuery.trim()) {
                    setShowSearchSuggestions(true);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setShowSearchSuggestions(false), 200);
                }}
                placeholder="Search medicines and products..."
                className="w-full px-4 py-2.5 rounded-lg bg-gray-100 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-gray-900 placeholder:text-gray-700"
              />
              
              {/* Mobile Search Suggestions Dropdown */}
              {showSearchSuggestions && searchSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                  {searchSuggestions.map((suggestion, index) => (
                    <button
                      key={`${suggestion.type}-${suggestion.value}-${index}`}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setSearchQuery(suggestion.value);
                        setShowSearchSuggestions(false);
                        handleSearch(suggestion.value);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-emerald-50 border-b border-gray-100 last:border-b-0 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span className="text-sm text-gray-700 flex-1">{suggestion.value}</span>
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 rounded px-2 py-1">
                        {suggestion.type}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              
              <button
                type="button"
                onClick={() => {
                  handleSearch();
                }}
                disabled={isSearchRedirecting}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-emerald-600"
                aria-label="Search"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Category Navigation */}
          <CategoryNav />
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 p-4 space-y-2 max-h-[75vh] overflow-y-auto">
          <CategoryNav isMobile={true} />
          <div className="mt-2 flex flex-col gap-2">
            <Link
              href="/doctor-consultation"
              className="block w-full text-left px-3 py-2 rounded text-emerald-700 hover:text-orange-500 hover:bg-emerald-50 font-medium transition"
            >
              Consult Doctor
            </Link>
            <Link
              href="/lab-tests"
              className="block w-full text-left px-3 py-2 rounded text-emerald-700 hover:text-orange-500 hover:bg-emerald-50 font-medium transition"
            >
              Lab Tests
            </Link>
          </div>
          <div className="border-t border-gray-100 pt-3"></div>
          <div className="rounded-lg border border-gray-200 p-3">
            <button
              type="button"
              onClick={() => setIsLanguageMenuOpen((prev) => !prev)}
              className="w-full flex items-center justify-between text-sm font-semibold text-emerald-700"
              aria-label="Change website language"
            >
              <span>
                Language: {LANGUAGE_OPTIONS.find((option) => option.code === selectedLanguage)?.label || 'English'}
              </span>
              <span className="text-gray-500">{isLanguageMenuOpen ? '▲' : '▼'}</span>
            </button>
            {isLanguageMenuOpen && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {LANGUAGE_OPTIONS.map((option) => (
                  <button
                    key={`mobile-${option.code}`}
                    type="button"
                    onClick={() => changeLanguage(option.code)}
                    className={`rounded-md border px-2 py-1.5 text-xs text-left ${
                      selectedLanguage === option.code
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-semibold'
                        : 'border-gray-200 text-gray-700'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-gray-100 pt-3"></div>
          {user ? (
            <>
              <Link href="/profile" className="block w-full text-center bg-emerald-50 text-emerald-700 py-2.5 rounded-lg font-semibold hover:bg-emerald-100">
                My Profile
              </Link>
              {user.role === 'doctor' && (
                <Link href="/doctor/panel" className="block w-full text-center bg-slate-900 text-white py-2.5 rounded-lg font-semibold hover:bg-slate-800">
                  Doctor Panel
                </Link>
              )}
              {user.role === 'vendor' && (
                <Link href="/vendor/dashboard" className="block w-full text-center bg-slate-900 text-white py-2.5 rounded-lg font-semibold hover:bg-slate-800">
                  Vendor Dashboard
                </Link>
              )}
              <button
                onClick={handleLogout}
                className="block w-full text-center bg-red-50 text-red-700 py-2.5 rounded-lg font-semibold hover:bg-red-100"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="block w-full text-center bg-linear-to-r from-emerald-600 to-emerald-700 text-white py-3 rounded-lg hover:from-emerald-700 hover:to-emerald-800 font-semibold shadow-md hover:shadow-lg transition duration-200">
                SignIn
              </Link>
              <Link href="/signup" className="block w-full text-center bg-linear-to-r from-orange-500 to-orange-600 text-white py-3 rounded-lg hover:from-orange-600 hover:to-orange-700 font-semibold shadow-md hover:shadow-lg transition duration-200">
                SignUp
              </Link>
              <Link href="/signup?role=vendor" className="block w-full text-center bg-emerald-100 text-emerald-700 py-2 rounded-lg font-semibold hover:bg-emerald-200">
                🤝 Become a Vendor
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
