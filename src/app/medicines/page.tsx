'use client';

import { useState, useEffect, useCallback, useMemo, useRef, useDeferredValue } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SocialToggle from '@/components/SocialToggle';
import { Suspense } from 'react';
import { usePreferredCountry } from '@/lib/usePreferredCountry';
import { addToCartUtil } from '@/lib/cartUtils';

interface Product {
  _id: number;
  name: string;
  brand: string;
  potency?: string;
  quantity?: number;
  quantityUnit?: string;
  productType?: string;
  category: string;
  subcategory?: string;
  diseaseCategory?: string;
  diseaseSubcategory?: string;
  price: number;
  displayPrice?: number;
  mrp?: number;
  displayMrp?: number;
  discount?: number;
  image?: string;
  icon?: string;
  benefit?: string;
  description?: string;
  shortDescription?: string;
  stock: number;
  rating: number;
  reviews: number;
  requiresPrescription?: boolean;
  healthConcerns?: string[];
  isActive: boolean;
  isPopular?: boolean;
  currencySymbol?: '₹' | '$';
  currency?: 'INR' | 'USD';
}

interface ReviewSummary {
  averageRating: number;
  total: number;
  latestComment?: string;
  latestUserName?: string;
}

const SORT_OPTIONS = [
  { value: 'featured', label: 'Featured' },
  { value: 'price-low', label: 'Price: Low to High' },
  { value: 'price-high', label: 'Price: High to Low' },
  { value: 'rating', label: 'Highest Rated' },
];

// ── Category groups for sidebar ─────────────────────────────────────────────
const MED_CATEGORIES = ['All', 'Addiction', 'Anxiety & Depression', 'Sleeplessness', 'Weak Memory', 'Acne & Pimples', 'Dark Circles & Marks', 'Wrinkles & Aging', 'Hair Fall', 'Dandruff', 'Cough', 'Asthma', 'Bronchitis', 'Indigestion/Acidity/Gas', 'Diabetes', 'Blood Pressure', 'Headache & Migraine', 'Back & Knee Pain', 'Arthritis & Joint Pains'];
const DISEASE_CATEGORIES = ['All', 'Mind', 'Face', 'Hair', 'Eyes & Ear', 'Nose & Throat', 'Nervous System', 'Mouth, Gums & Teeth', 'Respiratory', 'Rectum & Piles', 'Digestive System', 'Heart & Cardiovascular', 'Urinary System', 'Bone, Joint & Muscles', 'Skin & Nails', 'Fevers & Flu', 'Male Problems', 'Female Problems', 'Old Age Problems', 'Children Problems', 'Lifestyle Diseases', 'Tonics'];
const AYUR_CATEGORIES = ['All', 'Himalaya', 'Organic India', 'Baidyanath', 'Dabur', 'Zandu', 'Charak', 'Aimil', 'Ras & Sindoor', 'Bhasm & Pishti', 'Vati, Gutika & Guggulu', 'Chyawanprash', 'Honey'];
const HOMEO_CATEGORIES = ['All', 'SBL', 'Dr. Reckeweg', 'Willmar Schwabe', 'Bjain', '30 CH', '200 CH', '1000 CH', 'Mother Tinctures', 'Biochemic', 'Bach Flower'];
const NUTRITION_CATEGORIES = ['All', 'Proteins', 'Fat Burner', 'Weight Gainers', 'Pre Post Workout', 'Aminos', 'Creatines', 'Spreads & Sugar & Honey', 'Oils', 'Herbal & Vegetable Juices', 'Health Drinks', 'Healthy Snacks & Bars', 'Sugar Free', 'Murabba', 'Chyawanprash', 'Edible Seeds', 'Vitamin & Dietary Supplements', 'Organic Foods', 'Coffee & Tea', 'Ghee', 'Atta/Flour', 'Green Teas', 'Digestives'];
const PERSONAL_CARE_CATEGORIES = ['All', 'Essential Oils', 'Beard Oils and Wax', 'Shaving Cream & Gels', 'Men Wellness', 'Intimate Care', 'Pregnancy & Maternity Care', 'Face', 'Body', 'Foot Care', 'Sanitizers & Hand Wash', 'Shower Gel & Hand Wash', 'Soaps', 'Talcs & Deos', 'Shampoo & Conditioners', 'Hair Oils & Creams', 'Hair Serum & Mask', 'Hair Color & Dyes', 'Henna Mehandi', 'Elderly Care', 'Mosquito Repellents', 'Toothpaste', 'Gums Care'];
const FITNESS_CATEGORIES = ['All', 'Shoulder Support', 'Elbow Support', 'Forearm Support', 'Wrist Support', 'Chest Support', 'Cervical Support', 'Back Support', 'Abdominal Support', 'Thigh Support', 'Knee Support', 'Calf Support', 'Ankle Support', 'Finger Splint', 'Compression Stockings', 'Insoles & Heel cups', 'Weighing Scales', 'BP Monitors', 'Thermometer', 'Respiratory Care', 'Activity Moniter', 'Hot and Cold Pads & Bottles', 'Exercisers', 'Weights', 'Stethoscopes', 'Protective Gears', 'Hospital Beds', 'Aroma Therapy', 'Disability Aids', 'Massagers', 'Bandages & Tapes', 'Walking Sticks'];
const BABY_CARE_CATEGORIES = ['All', 'Tonics & Supplements', 'Shampoos & Bath Gels', 'Baby Oils', 'Baby Powder', 'Soaps', 'Wipes & Diapers', 'Gift Packs'];
const SEXUAL_WELLNESS_CATEGORIES = ['All', 'Supplements', 'Condoms', 'Sexual Wellness'];
const UNANI_CATEGORIES = ['All', 'Unani Medicines', 'Habbe & Qurs', 'Majun & Jawarish', 'Safoof, Labub & Kushta', 'Sharbat, Sirka & Arq', 'Lauq & Saoot', 'Khamira & Itrifal', 'Roghan & Oils', 'Hamdard', 'New Shama', 'Dehlvi', 'Rex'];

const TAB_CATEGORIES: Record<string, string[]> = {
  medicines: ['Addiction', 'Anxiety & Depression', 'Sleeplessness', 'Weak Memory', 'Acne & Pimples', 'Dark Circles & Marks', 'Wrinkles & Aging', 'Hair Fall', 'Dandruff', 'Cough', 'Asthma', 'Bronchitis', 'Indigestion/Acidity/Gas', 'Diabetes', 'Blood Pressure', 'Headache & Migraine', 'Back & Knee Pain', 'Arthritis & Joint Pains'],
  ayurveda: ['Ayurveda'],
  homeopathy: ['Homeopathy'],
  nutrition: ['Nutrition'],
  personalcare: ['Personal Care'],
  fitness: ['Fitness'],
  babycare: ['Baby Care'],
  sexualwellness: ['Sexual Wellness'],
  unani: ['Unani'],
  disease: ['Mind', 'Face', 'Hair', 'Eyes & Ear', 'Nose & Throat', 'Nervous System', 'Mouth, Gums & Teeth', 'Respiratory', 'Rectum & Piles', 'Digestive System', 'Heart & Cardiovascular', 'Urinary System', 'Bone, Joint & Muscles', 'Skin & Nails', 'Fevers & Flu', 'Male Problems', 'Female Problems', 'Old Age Problems', 'Children Problems', 'Lifestyle Diseases', 'Tonics'],
};

const TAB_SIDEBAR: Record<string, string[]> = {
  medicines: MED_CATEGORIES,
  ayurveda: AYUR_CATEGORIES,
  homeopathy: HOMEO_CATEGORIES,
  nutrition: NUTRITION_CATEGORIES,
  personalcare: PERSONAL_CARE_CATEGORIES,
  fitness: FITNESS_CATEGORIES,
  babycare: BABY_CARE_CATEGORIES,
  sexualwellness: SEXUAL_WELLNESS_CATEGORIES,
  unani: UNANI_CATEGORIES,
  disease: DISEASE_CATEGORIES,
};

// ── Grouped subcategories mapping (for categories with grouped display) ──────
// Maps category tab names to their grouped subcategories structure
const GROUPED_SUBCATEGORIES_MAP: Record<string, Record<string, string[]>> = {
  nutrition: {
    'Sports Nutrition': ['Proteins', 'Fat Burner', 'Weight Gainers', 'Pre Post Workout', 'Aminos', 'Creatines'],
    'Health Food & Drinks': ['Spreads & Sugar & Honey', 'Oils', 'Herbal & Vegetable Juices', 'Health Drinks', 'Healthy Snacks & Bars', 'Sugar Free', 'Murabba', 'Chyawanprash', 'Edible Seeds'],
    'Vitamin & Dietary Supplements': ['Vitamin & Dietary Supplements'],
    'Green Teas': ['Green Teas'],
    'Digestives': ['Digestives'],
  },
  'organic products': {
    'Organic Foods': ['Organic Foods'],
    'Coffee & Tea': ['Coffee & Tea'],
    Ghee: ['Ghee'],
    'Atta/Flour': ['Atta/Flour'],
  },
  personalcare: {
    'Aroma Oils': ['Essential Oils'],
    'Mens Grooming': ['Beard Oils and Wax', 'Shaving Cream & Gels', 'Men Wellness'],
    'Female Care': ['Intimate Care', 'Pregnancy & Maternity Care'],
    'Skin Care': ['Face', 'Body', 'Foot Care', 'Sanitizers & Hand Wash'],
    'Bath & Shower': ['Shower Gel & Hand Wash', 'Soaps', 'Talcs & Deos'],
    'Hair Care': ['Shampoo & Conditioners', 'Hair Oils & Creams', 'Hair Serum & Mask', 'Hair Color & Dyes', 'Henna Mehandi'],
    'Elderly Care': ['Elderly Care'],
    'Mosquito Repellents': ['Mosquito Repellents'],
    'Oral Care': ['Toothpaste', 'Gums Care'],
  },
  fitness: {
    'Supports & Splints': ['Shoulder Support', 'Elbow Support', 'Forearm Support', 'Wrist Support', 'Chest Support', 'Cervical Support', 'Back Support', 'Abdominal Support', 'Thigh Support', 'Knee Support', 'Calf Support', 'Ankle Support', 'Finger Splint', 'Compression Stockings', 'Insoles & Heel cups'],
    'Health Devices': ['Weighing Scales', 'BP Monitors', 'Thermometer', 'Respiratory Care', 'Activity Moniter', 'Hot and Cold Pads & Bottles'],
    'Fitness Equipment': ['Exercisers', 'Weights'],
    'Hospital Supplies': ['Stethoscopes', 'Protective Gears', 'Hospital Beds'],
    'Aroma Therapy': ['Aroma Therapy'],
    'Disability Aids': ['Disability Aids'],
    'Massagers': ['Massagers'],
    'Bandages & Tapes': ['Bandages & Tapes'],
    'Walking Sticks': ['Walking Sticks'],
  },
  babycare: {
    'Tonics & Supplements': ['Tonics & Supplements'],
    'Bath & Skin': ['Shampoos & Bath Gels', 'Baby Oils', 'Baby Powder', 'Soaps'],
    'Wipes & Diapers': ['Wipes & Diapers'],
    'Gift Packs': ['Gift Packs'],
  },
  sexualwellness: {
    'Sexual Wellness': ['Supplements', 'Condoms'],
  },
  unani: {
    'Unani Medicines': ['Unani Medicines'],
    'Habbe & Qurs': ['Habbe & Qurs'],
    'Majun & Jawarish': ['Majun & Jawarish'],
    'Safoof, Labub & Kushta': ['Safoof, Labub & Kushta'],
    'Sharbat, Sirka & Arq': ['Sharbat, Sirka & Arq'],
    'Lauq & Saoot': ['Lauq & Saoot'],
    'Khamira & Itrifal': ['Khamira & Itrifal'],
    'Roghan & Oils': ['Roghan & Oils'],
    'Unani Brands': ['Hamdard', 'New Shama', 'Dehlvi', 'Rex'],
  },
  disease: {
    Mind: ['Addiction', 'Anxiety & Depression', 'Sleeplessness', 'Weak Memory'],
    Face: ['Acne & Pimples', 'Dark Circles & Marks', 'Wrinkles & Aging'],
    Hair: ['Hair Fall', 'Dandruff', 'Alopecia & Bald Patches', 'Premature Graying', 'Lice'],
    'Eyes & Ear': ['Conjunctivitis', 'Cataract', 'Eye Strain', 'Glaucoma', 'Styes', 'Ear Pain', 'Ear Wax'],
    'Nose & Throat': ['Allergic Rhinitis', 'Sneezing & Running Nose', 'Sinusitis & Blocked Nose', 'Snoring', 'Tonsillitis & Throat Pain', 'Laryngitis & Hoarse Voice'],
    'Nervous System': ['Headache & Migraine', 'Vertigo/Motion Sickness', 'Neuralgia & Nerve Pain', 'Epilepsy & Fits'],
    'Mouth, Gums & Teeth': ['Bad Breath', 'Bleeding Gum/Pyorrhea', 'Mouth Ulcers/Aphthae', 'Cavities & Tooth Pain', 'Stammering'],
    Respiratory: ['Asthma', 'Bronchitis', 'Cough', 'Pneumonia'],
    'Rectum & Piles': ['Constipation', 'Piles & Fissures', 'Loose Motions/Diarrhoea', 'IBS & Colitis', 'Fistula', 'Worms'],
    'Digestive System': ['Indigestion/Acidity/Gas', 'Loss of Appetite', 'Jaundice & Fatty Liver', 'Stomach Pain & Colic', 'Vomiting & Nausea', 'Gall Stones', 'Appendicitis', 'Hernia'],
    'Heart & Cardiovascular': ['Heart Tonics', 'Chest Pain & Angina', 'Cholesterol & Triglyceride'],
    'Urinary System': ['Urinary Tract Infection', 'Kidney Stone', 'Frequent Urination'],
    'Bone, Joint & Muscles': ['Arthritis & Joint Pains', 'Back & Knee Pain', 'Cervical Spondylosis', 'Injuries & Fractures', 'Gout & Uric Acid', 'Osteoporosis', 'Sciatica', 'Heel Pain'],
    'Skin & Nails': ['Bed Sores', 'Boils & Abscesses', 'Burns', 'Cyst & Tumor', 'Eczema', 'Herpes', 'Nail Fungus', 'Psoriasis & Dry Skin', 'Rash/Itch/Urticaria/Hives', 'Vitiligo & Leucoderma', 'Warts & Corns'],
    'Fevers & Flu': ['Dengue', 'Flu & Fever', 'Malaria', 'Typhoid'],
    'Male Problems': ['Hydrocele', 'Premature Ejaculation', 'Impotency', 'Prostate Enlargement'],
    'Female Problems': ['Underdeveloped Breasts', 'Enlarged Breasts', 'Leucorrhoea', 'Excessive Menses', 'Vaginitis', 'Menopause', 'Painful, Delayed & Scanty Menses'],
    'Old Age Problems': ['Parkinsons & Trembling', 'Involuntary Urination', 'Alzheimers'],
    'Children Problems': ['Low Height', 'Autism', 'Bed Wetting', 'Immunity', 'Teething Troubles', 'Irritability & Hyperactive'],
    'Lifestyle Diseases': ['Diabetes', 'Blood Pressure', 'Obesity', 'Thyroid', 'Hang Over', 'Varicose Veins'],
    Tonics: ['Anaemia', 'Blood Purifiers', 'General Tonics', 'Weakness & Fatigue'],
  },
};

function getSubcategoryFilterTargets(tabKey: string, subcategoryName: string): string[] {
  if (!subcategoryName) return [];

  const grouped = GROUPED_SUBCATEGORIES_MAP[tabKey];
  if (grouped) {
    for (const [groupName, items] of Object.entries(grouped)) {
      if (equalsIgnoreCase(groupName, subcategoryName)) {
        return [groupName, ...items];
      }
    }
  }

  return [subcategoryName];
}

function getProductClassificationFields(p: Product): string[] {
  const extraPaths = Array.isArray((p as Product & { extraCategoryPaths?: string[][] }).extraCategoryPaths)
    ? (p as Product & { extraCategoryPaths?: string[][] }).extraCategoryPaths!.flat()
    : [];

  return [
    p.subcategory,
    p.category,
    p.diseaseCategory,
    p.diseaseSubcategory,
    ...extraPaths,
  ].filter(Boolean) as string[];
}

function productMatchesSubcategoryFilter(p: Product, tabKey: string, subcategoryName: string): boolean {
  if (!subcategoryName) return true;

  const targets = getSubcategoryFilterTargets(tabKey, subcategoryName);
  const fields = getProductClassificationFields(p);

  return targets.some((target) => fields.some((field) => equalsIgnoreCase(field, target)));
}

// Map URL category names to product types and tabs
const CATEGORY_TO_TAB: Record<string, string> = {
  'generic medicine': 'medicines',
  'medicines': 'medicines',
  'branded': 'medicines',
  'generic': 'medicines',
  'ayurveda': 'ayurveda',
  'ayurvedic': 'ayurveda',
  'homeopathy': 'homeopathy',
  'nutrition': 'nutrition',
  'personal care': 'personalcare',
  'personalcare': 'personalcare',
  'fitness': 'fitness',
  'baby care': 'babycare',
  'babycare': 'babycare',
  'sexual wellness': 'sexualwellness',
  'sexualwellness': 'sexualwellness',
  'unani': 'unani',
  'disease': 'disease',
};

const CATEGORY_TO_PRODUCT_TYPE: Record<string, string> = {
  'medicines': 'Generic Medicine',
  'ayurveda': 'Ayurveda Medicine',
  'homeopathy': 'Homeopathy',
  'nutrition': 'Nutrition',
  'organic products': 'Organic Products',
  'personalcare': 'Personal Care',
  'personal care': 'Personal Care',
  'fitness': 'Fitness',
  'babycare': 'Baby Care',
  'baby care': 'Baby Care',
  'sexualwellness': 'Sexual Wellness',
  'sexual wellness': 'Sexual Wellness',
  'unani': 'Unani',
};


function normalizeCategory(category?: string) {
  const value = (category || '').trim().toLowerCase();
  if (value === 'generic' || value === 'branded') return 'Medicines';
  if (value === 'ayurvedic' || value === 'ayurveda') return 'Ayurveda';
  if (value === 'homeopathy') return 'Homeopathy';
  return category || '';
}

function normalizeText(value?: string) {
  return (value || '').trim().toLowerCase();
}

function normalizeFilterToken(value?: string) {
  return (value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function matchesFilterValue(field?: string, query?: string) {
  const normalizedField = normalizeFilterToken(field);
  const normalizedQuery = normalizeFilterToken(query);

  if (!normalizedField || !normalizedQuery) return false;
  return (
    normalizedField === normalizedQuery ||
    normalizedField.includes(normalizedQuery) ||
    normalizedQuery.includes(normalizedField)
  );
}

function fieldMatchesAny(fields: Array<string | undefined>, query?: string) {
  if (!query) return true;
  return fields.some((field) => matchesFilterValue(field, query));
}

const HEADER_CATEGORY_ALIASES: Record<string, string[]> = {
  medicines: ['generic medicine', 'medicines', 'branded', 'generic'],
  nutrition: ['sports nutrition', 'health food and drinks', 'vitamin and dietary supplements', 'organic products', 'green teas', 'digestives'],
  'personal care': ['aroma oils', 'mens grooming', 'female care', 'skin care', 'bath and shower', 'hair care', 'elderly care', 'mosquito repellents', 'oral care'],
  fitness: ['supports and splints', 'health devices', 'fitness equipment', 'hospital supplies', 'aroma therapy', 'disability aids', 'massagers', 'bandages and tapes', 'walking sticks'],
  'sexual wellness': ['supplements', 'condoms', 'sexual wellness'],
  disease: ['mind', 'face', 'hair', 'eyes and ear', 'nose and throat', 'nervous system', 'mouth gums and teeth', 'respiratory', 'rectum and piles', 'digestive system', 'heart and cardiovascular', 'urinary system', 'bone joint and muscles', 'skin and nails', 'fevers and flu', 'male problems', 'female problems', 'old age problems', 'children problems', 'lifestyle diseases', 'tonics'],
  unani: ['unani medicines', 'habbe and qurs', 'majun and jawarish', 'safoof labub and kushta', 'sharbat sirka and arq', 'lauq and saoot', 'khamira and itrifal', 'roghan and oils', 'unani brands'],
  'baby care': ['tonics and supplements', 'bath and skin', 'wipes and diapers', 'gift packs'],
};

function equalsIgnoreCase(left?: string, right?: string) {
  return normalizeText(left) === normalizeText(right);
}

function getQuantityLabel(product: Product) {
  const hasQuantity = product.quantity !== undefined && product.quantity !== null;
  const hasUnit = product.quantityUnit && product.quantityUnit !== 'None';

  if (hasQuantity && hasUnit) return `${product.quantity} ${product.quantityUnit}`;
  if (hasQuantity) return String(product.quantity);
  if (hasUnit) return product.quantityUnit as string;
  return '';
}

const TAB_CONFIG = [
  { key: 'medicines', label: 'Medicines', color: 'emerald' },
  { key: 'ayurveda', label: 'Ayurveda', color: 'amber' },
  { key: 'homeopathy', label: 'Homeopathy', color: 'pink' },
  { key: 'nutrition', label: 'Nutrition', color: 'green' },
  { key: 'personalcare', label: 'Personal Care', color: 'purple' },
  { key: 'fitness', label: 'Fitness', color: 'blue' },
  { key: 'babycare', label: 'Baby Care', color: 'rose' },
  { key: 'sexualwellness', label: 'Sexual Wellness', color: 'red' },
  { key: 'unani', label: 'Unani', color: 'indigo' },
  { key: 'disease', label: 'Disease', color: 'emerald' },
];

const COLOR_MAP: Record<string, { active: string; btn: string; tag: string; ring: string }> = {
  emerald: { active: 'bg-emerald-100 text-emerald-800', btn: 'bg-orange-500 hover:bg-orange-600', tag: 'bg-emerald-50 text-emerald-700', ring: 'border-emerald-500 text-emerald-700' },
  amber:   { active: 'bg-amber-100 text-amber-800',   btn: 'bg-amber-500 hover:bg-amber-600',   tag: 'bg-amber-50 text-amber-700',   ring: 'border-amber-500 text-amber-700' },
  pink:    { active: 'bg-pink-100 text-pink-800',     btn: 'bg-pink-500 hover:bg-pink-600',     tag: 'bg-pink-50 text-pink-700',     ring: 'border-pink-500 text-pink-700' },
  green:   { active: 'bg-green-100 text-green-800',   btn: 'bg-green-500 hover:bg-green-600',   tag: 'bg-green-50 text-green-700',   ring: 'border-green-500 text-green-700' },
  purple:  { active: 'bg-purple-100 text-purple-800', btn: 'bg-purple-500 hover:bg-purple-600', tag: 'bg-purple-50 text-purple-700', ring: 'border-purple-500 text-purple-700' },
  blue:    { active: 'bg-blue-100 text-blue-800',     btn: 'bg-blue-500 hover:bg-blue-600',     tag: 'bg-blue-50 text-blue-700',     ring: 'border-blue-500 text-blue-700' },
  rose:    { active: 'bg-rose-100 text-rose-800',     btn: 'bg-rose-500 hover:bg-rose-600',     tag: 'bg-rose-50 text-rose-700',     ring: 'border-rose-500 text-rose-700' },
  red:     { active: 'bg-red-100 text-red-800',       btn: 'bg-red-500 hover:bg-red-600',       tag: 'bg-red-50 text-red-700',       ring: 'border-red-500 text-red-700' },
  indigo:  { active: 'bg-indigo-100 text-indigo-800', btn: 'bg-indigo-500 hover:bg-indigo-600', tag: 'bg-indigo-50 text-indigo-700', ring: 'border-indigo-500 text-indigo-700' },
};

function getProductPageHref(product: Product): string {
  // Always use the central medicine detail route for product detail navigation.
  // This prevents invalid category-prefixed routes like /ayurveda/:id or /homeopathy/:id.
  return `/medicines/${product._id}`;
}

function MedicinesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isIndia } = usePreferredCountry();
  // Decode URL parameters to handle encoded characters (spaces, special chars)
  const rawUrlCategory = searchParams.get('category') || '';
  const urlCategory = rawUrlCategory ? decodeURIComponent(rawUrlCategory) : '';
  const isOrgProductsView = searchParams.get('orgProductsView') === 'true';
  const rawUrlSubcategory = searchParams.get('subcategory') || '';
  const urlSubcategory = rawUrlSubcategory ? decodeURIComponent(rawUrlSubcategory) : '';
  const urlSearch = searchParams.get('search') || '';
  const urlConcern = searchParams.get('concern') || '';
  const productsSectionRef = useRef<HTMLDivElement | null>(null);
  const hasAutoScrolledRef = useRef(false);

  const [activeTab, setActiveTab] = useState<'medicines' | 'ayurveda' | 'homeopathy' | 'nutrition' | 'personalcare' | 'fitness' | 'babycare' | 'sexualwellness' | 'unani' | 'disease'>('medicines');
  const [sortOrder, setSortOrder] = useState('featured');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [sidebarCat, setSidebarCat] = useState('All');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [seedStatus, setSeedStatus] = useState<string | null>(null);
  const [reviewSummaries, setReviewSummaries] = useState<Record<string, ReviewSummary>>({});

  const redirectToLogin = () => {
    const returnTo = `${window.location.pathname}${window.location.search}`;
    router.push(`/login?redirect=${encodeURIComponent(returnTo)}`);
  };

  // Map URL param category → tab
  useEffect(() => {
    if (!urlCategory) return;
    // urlCategory is already decoded at this point
    const lower = urlCategory.toLowerCase().trim();
    const mappedTab = CATEGORY_TO_TAB[lower] || 'medicines';
    setActiveTab(mappedTab as any);
  }, [urlCategory]);

  useEffect(() => {
    if (!urlSubcategory) {
      setSidebarCat('All');
      return;
    }

    const candidates = TAB_SIDEBAR[activeTab] || [];
    const found = candidates.find(
      (item) => item.toLowerCase() === urlSubcategory.toLowerCase()
    );
    if (found) {
      setSidebarCat(found);
      return;
    }

    const grouped = GROUPED_SUBCATEGORIES_MAP[activeTab];
    const groupMatch = grouped
      ? Object.keys(grouped).find((group) => equalsIgnoreCase(group, urlSubcategory))
      : undefined;
    setSidebarCat(groupMatch || urlSubcategory);
  }, [urlSubcategory, activeTab]);

  useEffect(() => {
    setSearch(urlSearch);
  }, [urlSearch]);

  useEffect(() => {
    hasAutoScrolledRef.current = false;
  }, [urlCategory, urlSubcategory, urlSearch]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      // fetch all, we filter client-side by category group
      const res = await fetch('/api/products?limit=1000', { cache: 'no-store' });
      const data = await res.json();
      setProducts(data.products || []);
    } catch { setProducts([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const seedData = async () => {
    setSeeding(true);
    setSeedStatus(null);
    try {
      const res = await fetch('/api/seed?force=false', { method: 'POST' });
      const data = await res.json();
      if (data.seeded) {
        setSeedStatus(`✅ Seeded ${data.seeded.products} products + ${data.seeded.labTests} lab tests`);
      } else {
        setSeedStatus('Already seeded — use ?force=true to re-seed');
      }
      await fetchProducts();
    } catch { setSeedStatus('Seed failed'); }
    setSeeding(false);
  };

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

  // ── Filter products for current tab + sidebar category ──────────────────
  const displayed = useMemo(() => {
    const tabFiltered = products.filter((p) => {
      const normalizedCategory = normalizeCategory(p.category);
      const productType = (p.productType || '').trim();
      const normalizedType = productType.toLowerCase();
      const isLabTestType = normalizedType === 'lab tests' || normalizedType === 'lab test';
      
      // Check product type for all categories
      const isGenericMedicineType = productType === 'Generic Medicine' || normalizedType === 'generic medicine';
      const isAyurvedaType = productType === 'Ayurveda Medicine' || normalizedCategory === 'Ayurveda' || AYUR_CATEGORIES.includes(normalizedCategory);
      const isHomeopathyType = productType === 'Homeopathy' || normalizedCategory === 'Homeopathy' || HOMEO_CATEGORIES.includes(normalizedCategory);
      const isNutritionType = productType === 'Nutrition' || normalizedType === 'nutrition';
      const isPersonalCareType = productType === 'Personal Care' || normalizedType === 'personal care';
      const isFitnessType = productType === 'Fitness' || normalizedType === 'fitness';
      const isBabyCareType = productType === 'Baby Care' || normalizedType === 'baby care';
      const isSexualWellnessType = productType === 'Sexual Wellness' || normalizedType === 'sexual wellness';
      const isUnaniType = productType === 'Unani' || normalizedType === 'unani';
      const isDiseaseTagged = Boolean(p.diseaseCategory || p.diseaseSubcategory || equalsIgnoreCase(p.category, 'disease'));

      // Filter by active tab
      if (activeTab === 'ayurveda') return isAyurvedaType;
      if (activeTab === 'homeopathy') return isHomeopathyType;
      if (activeTab === 'nutrition') return isNutritionType;
      if (activeTab === 'personalcare') return isPersonalCareType;
      if (activeTab === 'fitness') return isFitnessType;
      if (activeTab === 'babycare') return isBabyCareType;
      if (activeTab === 'sexualwellness') return isSexualWellnessType;
      if (activeTab === 'unani') return isUnaniType;
      if (activeTab === 'disease') return isDiseaseTagged;

      // Medicines tab - include generic medicines and other non-specialized products
      return !isLabTestType && !isAyurvedaType && !isHomeopathyType && !isNutritionType && !isPersonalCareType && !isFitnessType && !isBabyCareType && !isSexualWellnessType && !isUnaniType;
    });

    const trimmedSearch = deferredSearch.trim();

    // Define organic product subcategories
    const ORGANIC_PRODUCTS_SUBCATS = ['Organic Foods', 'Coffee & Tea', 'Ghee', 'Atta/Flour'];

    return tabFiltered.filter((p) => {
      // If viewing organic products, only show products with organic subcategories
      if (isOrgProductsView) {
        const isOrgType = equalsIgnoreCase(p.productType, 'Organic Products');
        const isOrgCategory = equalsIgnoreCase(p.category, 'Organic Products');
        const isOrgSubcat = ORGANIC_PRODUCTS_SUBCATS.some(
          (subcat) =>
            equalsIgnoreCase(p.subcategory, subcat) || equalsIgnoreCase(p.category, subcat)
        );
        if (!isOrgType && !isOrgCategory && !isOrgSubcat) return false;
      }

      const matchCat =
        sidebarCat === 'All' ||
        productMatchesSubcategoryFilter(p, activeTab, sidebarCat);

    const urlCategoryMatch = !urlCategory || (() => {
      const categoryFields = [
        p.category,
        p.subcategory,
        p.diseaseCategory,
        p.diseaseSubcategory,
        p.benefit,
        p.productType,
        normalizeCategory(p.category),
      ];

      // Special handling for Disease category
      if (equalsIgnoreCase(urlCategory, 'disease')) {
        return Boolean(p.diseaseCategory || p.diseaseSubcategory || equalsIgnoreCase(p.category, 'disease'));
      }

      // Check if URL category maps to a product type
      const mappedProductType = CATEGORY_TO_PRODUCT_TYPE[urlCategory.toLowerCase().trim()];
      if (mappedProductType) {
        return equalsIgnoreCase(p.productType, mappedProductType);
      }

      if (equalsIgnoreCase(urlCategory, 'ayurveda')) {
        return categoryFields.some((field) => equalsIgnoreCase(field, 'Ayurveda')) || equalsIgnoreCase(p.productType, 'Ayurveda Medicine');
      }

      if (equalsIgnoreCase(urlCategory, 'homeopathy')) {
        return categoryFields.some((field) => equalsIgnoreCase(field, 'Homeopathy')) || equalsIgnoreCase(p.productType, 'Homeopathy');
      }

      const normalizedCategoryKey = normalizeFilterToken(urlCategory);
      const categoryCandidates = [
        urlCategory,
        ...(HEADER_CATEGORY_ALIASES[normalizedCategoryKey] || []),
      ];

      return categoryCandidates.some((candidate) =>
        categoryFields.some((field) => matchesFilterValue(field, candidate))
      );
    })();

      const urlSubcategoryMatch =
        !urlSubcategory || productMatchesSubcategoryFilter(p, activeTab, urlSubcategory);

      const quantityText = p.quantity !== undefined && p.quantity !== null ? String(p.quantity) : '';
      const matchSearch =
        !trimmedSearch ||
        fieldMatchesAny(
          [
            p.name,
            p.brand,
            p.category,
            p.subcategory,
            p.diseaseCategory,
            p.diseaseSubcategory,
            p.potency,
            p.quantityUnit,
            quantityText,
            getQuantityLabel(p),
            p.benefit,
            p.description,
            p.productType,
            (p.healthConcerns || []).join(' '),
          ],
          trimmedSearch
        );

      // Filter by health concern if specified
      // Check both healthConcerns array and benefit field
      const matchConcern =
        !urlConcern ||
        (p.healthConcerns || []).some((concern) =>
          matchesFilterValue(concern, urlConcern)
        ) ||
        matchesFilterValue(p.benefit, urlConcern);

      return matchCat && urlCategoryMatch && urlSubcategoryMatch && matchSearch && matchConcern;
    });
  }, [activeTab, deferredSearch, products, sidebarCat, urlCategory, urlSubcategory, urlConcern]);

  // Apply sorting
  const sortedDisplayed = useMemo(() => {
    let result = [...displayed];
    if (sortOrder === 'price-low') result.sort((a, b) => a.price - b.price);
    else if (sortOrder === 'price-high') result.sort((a, b) => b.price - a.price);
    else if (sortOrder === 'rating') result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return result;
  }, [displayed, sortOrder]);

  const displayedProductIds = useMemo(
    () => sortedDisplayed.map((product) => product._id).filter(Boolean).join(','),
    [sortedDisplayed]
  );

  useEffect(() => {
    const fetchReviewSummaries = async () => {
      if (!displayedProductIds) {
        setReviewSummaries({});
        return;
      }

      try {
        const res = await fetch(`/api/reviews?productIds=${encodeURIComponent(displayedProductIds)}`, {
          cache: 'no-store',
        });
        const data = await res.json();
        if (res.ok) setReviewSummaries(data.summaries || {});
      } catch {
        setReviewSummaries({});
      }
    };

    fetchReviewSummaries();
  }, [displayedProductIds]);

  useEffect(() => {
    if (loading) return;
    if (!urlCategory && !urlSubcategory && !urlSearch) return;
    if (hasAutoScrolledRef.current) return;

    const section = productsSectionRef.current;
    if (!section) return;

    hasAutoScrolledRef.current = true;
    window.requestAnimationFrame(() => {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [loading, urlCategory, urlSubcategory, urlSearch]);

  const col = COLOR_MAP[TAB_CONFIG.find((t) => t.key === activeTab)!.color];

  return (
    <div className="min-h-screen bg-linear-to-b from-emerald-50 via-teal-50 to-white flex flex-col">
      <Header />
      <SocialToggle />

      {/* Hero */}
      <div className="w-full -mt-48">
        <img src="/OM.png" alt="Medicines Store" className="w-full h-auto object-cover block" />
      </div>

      {/* Tabs & Search Bar */}
      <div className="sticky top-0 z-30 bg-white border-b border-emerald-200 shadow-sm -mt-40">
        <div className="max-w-7xl mx-auto px-4">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {TAB_CONFIG.map((t) => (
              <button 
                key={t.key} 
                onClick={() => { setActiveTab(t.key as any); setSidebarCat('All'); }}
                className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all shrink-0 ${
                  activeTab === t.key
                    ? `text-${t.color === 'amber' ? 'amber' : t.color === 'pink' ? 'pink' : 'emerald'}-700 border-${t.color === 'amber' ? 'amber' : t.color === 'pink' ? 'pink' : 'emerald'}-600`
                    : 'text-gray-600 border-transparent hover:text-gray-800'
                }`}
                style={activeTab === t.key ? { 
                  borderBottomColor: t.color === 'amber' ? '#d97706' : t.color === 'pink' ? '#db2777' : '#059669',
                  color: t.color === 'amber' ? '#92400e' : t.color === 'pink' ? '#9d174d' : '#065f46'
                } : {}}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col gap-4 md:gap-0 md:flex-row md:items-center md:justify-between py-3">
            {/* Search Bar */}
            <div className="flex-1 md:mr-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 Search by product name, brand..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full border-2 border-emerald-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition text-sm placeholder:text-gray-700"
                />
              </div>
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="border-2 border-emerald-200 rounded-xl px-4 py-3 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 transition text-sm font-medium text-gray-700"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {seedStatus && (
        <div className="max-w-7xl mx-auto px-4 py-2">
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-2 text-sm">{seedStatus}</div>
        </div>
      )}

      <div id="products-section" ref={productsSectionRef} className="flex-1 max-w-7xl mx-auto px-4 py-10 w-full">
        {/* Results Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {TAB_CONFIG.find((t) => t.key === activeTab)?.label || 'Products'}
              </h1>
              {urlConcern && (
                <p className="text-emerald-600 mt-1 text-sm font-medium">
                  Showing products for: <span className="capitalize">{urlConcern}</span>
                </p>
              )}
              <p className="text-gray-600 mt-1 text-sm">
                {sortedDisplayed.length} {sortedDisplayed.length === 1 ? 'product' : 'products'} available
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-sm animate-pulse"
              >
                <div className="h-40 bg-linear-to-br from-emerald-100 to-teal-100 rounded-xl mb-4" />
                <div className="h-4 bg-gray-200 rounded mb-3 w-3/4" />
                <div className="h-3 bg-gray-200 rounded mb-2 w-full" />
                <div className="h-3 bg-gray-200 rounded mb-4 w-1/2" />
                <div className="h-10 bg-emerald-100 rounded-lg" />
              </div>
            ))}
          </div>
        ) : sortedDisplayed.length === 0 ? (
          <div className="text-center py-20 bg-white border-2 border-dashed border-emerald-200 rounded-3xl shadow-sm">
            <div className="text-7xl mb-4 opacity-50">💊</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No products found</h3>
            <p className="text-gray-600 mb-6">
              {search
                ? `We couldn't find any products matching "${search}"`
                : 'No products available in this category'}
            </p>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="px-6 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition"
              >
                Clear Search
              </button>
            )}
            {products.length === 0 && (
              <button
                onClick={seedData}
                disabled={seeding}
                className="ml-3 px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-60"
              >
                {seeding ? 'Loading...' : '⚡ Load Sample Products'}
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Products Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {sortedDisplayed.map((product) => {
                const summary = reviewSummaries[product._id];
                const productRating =
                  summary && summary.total > 0 ? summary.averageRating : Number(product.rating || 0);
                const productReviewCount =
                  summary && summary.total > 0 ? summary.total : Number(product.reviews || 0);

                return (
                  <article
                    key={String(product._id)}
                    className="group w-full max-w-56 mx-auto bg-white/95 border border-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition duration-300 cursor-pointer"
                    onClick={() => router.push(getProductPageHref(product))}
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
                          {product.icon || '💊'}
                        </span>
                      )}

                      <div className="absolute inset-0 flex items-start justify-end p-3 pointer-events-none">
                        {isIndia && product.mrp && product.mrp > product.price && (
                          <span className="text-[11px] font-bold text-emerald-600">
                            {Math.round(((product.mrp - product.price) / product.mrp) * 100)}% OFF
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-3 flex flex-col flex-1">
                      <p className="font-medium text-slate-500 mb-1 uppercase tracking-wide text-[10px]">
                        {product.brand || 'MySanjeevni'}
                      </p>
                      {getQuantityLabel(product) && (
                        <p className="text-[10px] font-semibold text-indigo-700 mb-1">
                          Qty: {getQuantityLabel(product)}
                        </p>
                      )}
                      <h3 className="font-bold text-slate-900 line-clamp-2 mb-2 text-xs min-h-8">{product.name}</h3>
                      
                      {product.shortDescription && (
                        <p className="text-xs text-slate-600 mb-2 line-clamp-2">{product.shortDescription}</p>
                      )}

                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1">
                          <span className="text-amber-500">★</span>
                          <span className="text-xs font-semibold text-slate-900">{productRating.toFixed(1)}</span>
                          <span className="text-xs text-slate-500">({productReviewCount})</span>
                        </div>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                            product.stock > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {product.stock > 0 ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </div>

                      {summary?.latestComment && (
                        <p className="text-xs text-slate-600 mb-2 line-clamp-2">"{summary.latestComment}"</p>
                      )}

                      <div className="mb-2 flex items-end justify-between">
                        <div className="flex items-baseline gap-2">
                          <span className="text-base font-black text-slate-900">{product.currencySymbol || '₹'}{product.displayPrice ?? product.price}</span>
                          {isIndia && (product.displayMrp ?? product.mrp) && (product.displayMrp ?? product.mrp)! > (product.displayPrice ?? product.price) && (
                            <span className="text-xs text-slate-400 line-through">{product.currencySymbol || '₹'}{product.displayMrp ?? product.mrp}</span>
                          )}
                        </div>
                        {isIndia && (product.displayMrp ?? product.mrp) && (product.displayMrp ?? product.mrp)! > (product.displayPrice ?? product.price) && (
                          <span className="text-[11px] font-bold text-emerald-600">
                            {Math.round((((product.displayMrp ?? product.mrp)! - (product.displayPrice ?? product.price)!) / (product.displayMrp ?? product.mrp)!) * 100)}% OFF
                          </span>
                        )}
                      </div>

                      <div className="flex gap-2 mt-auto">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(product);
                          }}
                          disabled={product.stock <= 0}
                          className={`flex-1 rounded-lg font-bold transition py-1.5 text-[11px] ${
                            product.stock <= 0
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
                          disabled={product.stock <= 0}
                          className={`flex-1 rounded-lg font-bold text-white transition py-1.5 text-[11px] ${
                            product.stock <= 0 ? 'bg-slate-400 cursor-not-allowed' : 'bg-amber-600 hover:bg-amber-700'
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
                Showing all {sortedDisplayed.length} products • Quality certified products
              </p>
            </div>
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}

export default function MedicinesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <MedicinesContent />
    </Suspense>
  );
}

