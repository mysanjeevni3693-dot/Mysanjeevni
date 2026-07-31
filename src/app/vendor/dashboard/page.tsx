'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { useImageUpload } from '@/lib/hooks/useImageUpload';
import RichTextEditor from '@/components/RichTextEditor';
import VendorNotificationBell from '@/components/VendorNotificationBell';

interface VendorInfo {
  _id: string;
  vendorName: string;
  email: string;
  phone?: string;
  businessType?: string;
  description?: string;
  logo?: string;
  banner?: string;
  gstNumber?: string;
  licenseNumber?: string;
  registrationNumber?: string;
  supportContact?: string;
  rejectionReason?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  pickupAddress?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    phone?: string;
  };
  warehouseAddress?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    phone?: string;
  };
  returnAddress?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
    phone?: string;
  };
  socialLinks?: {
    website?: string;
    facebook?: string;
    instagram?: string;
  };
  status: string;
  isActive?: boolean;
  rating?: number;
  totalOrders?: number;
  commissionPercentage?: number;
}

interface DashboardStats {
  verificationStatus: string;
  isActive: boolean;
  rating: number;
  commissionPercentage: number;
  productCount: number;
  activeProducts: number;
  pendingApprovalProducts: number;
  lowStockCount: number;
  outOfStockCount: number;
  lowStockProducts: Array<{ _id: string; name: string; stock: number }>;
  outOfStockProducts: Array<{ _id: string; name: string; stock: number }>;
  totalOrders: number;
  totalSales: number;
  totalRevenue: number;
  estimatedCommission: number;
  estimatedNetEarnings: number;
  orderStatusCounts: Record<string, number>;
  wallet: {
    balance: number;
    totalEarnings: number;
    totalWithdrawn: number;
    pendingSettlement: number;
    paidSettlement: number;
  };
  monthlyEarnings: Array<{ month: string; sales: number; orders: number }>;
  recentOrders: Array<{
    _id: string;
    status: string;
    paymentStatus?: string;
    createdAt?: string;
    customerName: string;
    vendorAmount: number;
    itemCount: number;
  }>;
  recentReviews: Array<{
    _id: string;
    rating: number;
    title: string;
    comment: string;
    userName: string;
    createdAt?: string;
  }>;
}

interface Product {
  _id: number;
  name: string;
  brand?: string;
  price: number;
  mrp?: number;
  stock: number;
  category: string;
  subcategory?: string;
  potency?: string;
  quantity?: number;
  quantityUnit?: string;
  diseaseCategory?: string;
  diseaseSubcategory?: string;
  productType?: string;
  extraCategoryPaths?: string[][];
  benefit?: string;
  requiresPrescription?: boolean;
  shortDescription?: string;
  description?: string;
  safetyInformation?: string;
  specifications?: string;
  image?: string;
  usdPrice?: number;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
}

interface DynamicCategoryConfig {
  vendorCategoryMap?: Record<string, string[]>;
  subcategoryMapByType?: Record<string, Record<string, string[]>>;
  diseaseSubcategoryMap?: Record<string, string[]>;
}

const POTENCY_OPTIONS = ['1000 CH', '3 CH', '10M CH', '200 CH', '30 CH', '12 CH', '6 CH', 'CM CH', '50M CH'];
const QUANTITY_UNIT_OPTIONS = ['None', 'BAGS (Bag)', 'BOTTLES (Btl)', 'BOX (Box)', 'BUNDLES (Bdl)', 'CANS (Can)', 'CAPSULES (CAPS)', 'CARTONS (Ctn)', 'DOZENS (Dzn)', 'GRAMMES (Gm)', 'KILOGRAMS (Kg)', 'LITRE (Ltr)', 'METERS (Mtr)', 'MILILITRE (MI)', 'NUMBERS (Nos)', 'PACKS (Pac)', 'PAIRS (Prs)', 'PIECES (Pcs)', 'QUINTAL (Qtl)', 'ROLLS (Rol)', 'SACHET (SACH)', 'SQUARE FEET (Sqf)', 'SQUARE METERS (Sqm)', 'TABLETS (Tbs)'];

const HOMEOPATHY_SUBCATEGORY_MAP = {
  Medicines: ['SBL', 'Dr. Reckeweg (Germany)', 'Willmar Schwabe (Germany)', 'Adel Pekana (Germany)', 'Willmar Schwabe India', 'BJain', 'R S Bhargava', 'Baksons', 'REPL', 'New Life', 'Special Tablets', 'Cream & Ointment', 'Special Liquid/Drops'],
  Cosmetics: ['Hair Care', 'Skin Care', 'Oral Care'],
  Dilutions: ['3X', '6X', '3 CH', '6 CH', '12 CH', '30 CH', '200 CH', '1000 CH', '10M CH', '50M CH', 'CM CH'],
  'Mother Tinctures': ['SBL', 'Dr. Reckeweg (Germany)', 'Willmar Schwabe India', 'BJain'],
  Biochemic: ['SBL', 'Dr. Reckeweg (Germany)', 'BJain', 'Willmar Schwabe India'],
  'Bach Flower': ['Bach Flower Remedies', 'Bach Flower Kits'],
  'Homeopathy Kits': ['Homeopathy Kits'],
  Triturations: ['SBL', 'Dr. Reckeweg (Germany)', 'Willmar Schwabe India', 'BJain'],
  'Millesimal LM Potency': ['SBL', 'BJain'],
  'Bio Combination': ['SBL', 'Dr. Reckeweg (Germany)', 'BJain', 'Willmar Schwabe India', 'Haslab (HSL)'],
} as const;
type HomeopathyCategory = keyof typeof HOMEOPATHY_SUBCATEGORY_MAP;

const AYURVEDA_SUBCATEGORY_MAP = {
  Medicines: ['Himalaya', 'Organic India', 'Baidyanath', 'Dabur', 'Zandu', 'Charak', 'Aimil'],
  'Single Remedies': ['Ras & Sindoor', 'Bhasm & Pishti', 'Vati & Gutika & Guggulu', 'Asava Arishta & Kadha', 'Loha & Mandur', 'Churan & Powder & Avleha & Pak', 'Tailam & Ghrita', 'Gold Items', 'Special Tablets & Capsules', 'Syrups & Tonics'],
  'Herbal Food & Juices': ['Chyawanprash', 'Honey', 'Digestives', 'Herbal & Vegetable Juice'],
} as const;
type AyurvedaCategory = keyof typeof AYURVEDA_SUBCATEGORY_MAP;

const NUTRITION_SUBCATEGORY_MAP = {
  'Sports Nutrition': ['Proteins', 'Fat Burner', 'Weight Gainers', 'Pre Post Workout', 'Aminos', 'Creatines'],
  'Health Food & Drinks': ['Spreads & Sugar & Honey', 'Oils', 'Herbal & Vegetable Juices', 'Health Drinks', 'Healthy Snacks & Bars', 'Sugar Free', 'Murabba', 'Chyawanprash', 'Edible Seeds'],
  'Vitamin & Dietary Supplements': ['Vitamin & Dietary Supplements'],
  'Green Teas': ['Green Teas'],
  Digestives: ['Digestives'],
} as const;
type NutritionCategory = keyof typeof NUTRITION_SUBCATEGORY_MAP;

const ORGANIC_PRODUCTS_SUBCATEGORY_MAP = {
  'Organic Foods': ['Organic Foods'],
  'Coffee & Tea': ['Coffee & Tea'],
  Ghee: ['Ghee'],
  'Atta/Flour': ['Atta/Flour'],
} as const;
type OrganicProductsCategory = keyof typeof ORGANIC_PRODUCTS_SUBCATEGORY_MAP;

const PERSONAL_CARE_SUBCATEGORY_MAP = {
  'Aroma Oils': ['Essential Oils'],
  'Mens Grooming': ['Beard Oils and Wax', 'Shaving Cream & Gels', 'Men Wellness'],
  'Female Care': ['Intimate Care', 'Pregnancy & Maternity Care'],
  'Skin Care': ['Face', 'Body', 'Foot Care', 'Sanitizers & Hand Wash'],
  'Bath & Shower': ['Shower Gel & Hand Wash', 'Soaps', 'Talcs & Deos'],
  'Hair Care': ['Shampoo & Conditioners', 'Hair Oils & Creams', 'Hair Serum & Mask', 'Hair Color & Dyes', 'Henna Mehandi'],
  'Elderly Care': ['Elderly Care'],
  'Mosquito Repellents': ['Mosquito Repellents'],
  'Oral Care': ['Toothpaste', 'Gums Care'],
} as const;
type PersonalCareCategory = keyof typeof PERSONAL_CARE_SUBCATEGORY_MAP;

const BABY_CARE_SUBCATEGORY_MAP = {
  'Tonics & Supplements': ['Tonics & Supplements'],
  'Bath & Skin': ['Shampoos & Bath Gels', 'Baby Oils', 'Baby Powder', 'Soaps'],
  'Wipes & Diapers': ['Wipes & Diapers'],
  'Gift Packs': ['Gift Packs'],
} as const;
type BabyCareCategory = keyof typeof BABY_CARE_SUBCATEGORY_MAP;

const FITNESS_SUBCATEGORY_MAP = {
  'Supports & Splints': ['Shoulder Support', 'Elbow Support', 'Forearm Support', 'Wrist Support', 'Chest Support', 'Cervical Support', 'Back Support', 'Abdominal Support', 'Thigh Support', 'Knee Support', 'Calf Support', 'Ankle Support', 'Finger Splint', 'Compression Stockings', 'Insoles & Heel cups'],
  'Health Devices': ['Weighing Scales', 'BP Monitors', 'Thermometer', 'Respiratory Care', 'Activity Moniter', 'Hot and Cold Pads & Bottles'],
  'Fitness Equipment': ['Exercisers', 'Weights'],
  'Hospital Supplies': ['Stethoscopes', 'Protective Gears', 'Hospital Beds'],
  'Aroma Therapy': ['Aroma Therapy'],
  'Disability Aids': ['Disability Aids'],
  Massagers: ['Massagers'],
  'Bandages & Tapes': ['Bandages & Tapes'],
  'Walking Sticks': ['Walking Sticks'],
} as const;
type FitnessCategory = keyof typeof FITNESS_SUBCATEGORY_MAP;

const UNANI_SUBCATEGORY_MAP = {
  'Unani Medicines': ['Unani Medicines'],
  'Habbe & Qurs': ['Habbe & Qurs'],
  'Majun & Jawarish': ['Majun & Jawarish'],
  'Safoof, Labub & Kushta': ['Safoof, Labub & Kushta'],
  'Sharbat, Sirka & Arq': ['Sharbat, Sirka & Arq'],
  'Lauq & Saoot': ['Lauq & Saoot'],
  'Khamira & Itrifal': ['Khamira & Itrifal'],
  'Roghan & Oils': ['Roghan & Oils'],
  'Unani Brands': ['Hamdard', 'New Shama', 'Dehlvi', 'Rex'],
} as const;
type UnaniCategory = keyof typeof UNANI_SUBCATEGORY_MAP;

const ORDER_STATUS_OPTIONS = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const;

const DISEASE_SUBCATEGORY_MAP = {
  Mind: ['Addiction', 'Anxiety & Depression', 'Sleeplessness', 'Weak Memory'],
  Face: ['Acne & Pimples', 'Dark Circles & Marks', 'Wrinkles & Aging'],
  Hair: ['Hair Fall', 'Dandruff', 'Alopecia & Bald Patches', 'Premature Graying', 'Lice'],
  'Eyes & Ear': ['Conjunctivitis', 'Cataract', 'Eye Strain', 'Glaucoma', 'Styes', 'Ear Pain', 'Ear Wax'],
  'Nose & Throat': ['Allergic Rhinitis', 'Sneezing & Running Nose', 'Sinusitis & Blocked Nose', 'Snoring', 'Tonsilitis & Throat Pain', 'Laryngitis & Hoarse Voice'],
  'Nervous System': ['Headache & Migraine', 'Vertigo/Motion Sickness', 'Neuralgia & Nerve Pain', 'Epilepsy & Fits'],
  'Mouth, Gums & Teeth': ['Bad Breath', 'Bleeding Gum/Pyorrhoea', 'Mouth Ulcers/Aphthae', 'Cavities & Tooth Pain', 'Stammering'],
  Respiratory: ['Asthma', 'Bronchitis', 'Cough', 'Pneumonia'],
  'Rectum & Piles': ['Constipation', 'Piles & Fissures', 'Loose Motions/Diarrhoea', 'IBS & Colitis', 'Fistula', 'Worms'],
  'Digestive System': ['Indigestion/Acidity/Gas', 'Loss of Appetite', 'Jaundice & Fatty Liver', 'Stomach Pain & Colic', 'Vomiting & Nausea', 'Gall Stones', 'Appendicitis', 'Hernia'],
  'Heart & Cardiovascular': ['Heart Tonics', 'Chest Pain & Angina', 'Cholesterol & Triglyceride'],
  'Urinary System': ['Urinary Tract Infection', 'Kidney Stone', 'Frequent Urination'],
  'Bone, Joint & Muscles': ['Arthritis & Joint Pains', 'Back & Knee Pain', 'Cervical Spondolyisis', 'Injuries & Fractures', 'Gout & Uric Acid', 'Osteoporosis', 'Sciatica', 'Heel Pain'],
  'Skin & Nails': ['Bed Sores', 'Boils & Abscesses', 'Burns', 'Cyst & Tumor', 'Eczema', 'Herpes', 'Nail Fungus', 'Psoriasis & Dry Skin', 'Rash/Itch/Urticaria/Hives', 'Vitiligo & Leucoderma', 'Warts & Corns'],
  'Fevers & Flu': ['Dengue', 'Flu & Fever', 'Malaria', 'Typhoid'],
  'Male Problems': ['Hydrocele', 'Premature Ejaculation', 'Impotency', 'Prostate Enlargement'],
  'Female Problems': ['Underdeveloped Breasts', 'Enlarged Breasts', 'Leucorrhoea', 'Excessive Menses', 'Vaginitis', 'Menopause', 'Painful, Delayed & Scanty Menses'],
  'Old Age Problems': ['Parkinsons & Trembling', 'Involuntary Urination', 'Alzheimers'],
  'Children Problems': ['Low Height', 'Autism', 'Bed Wetting', 'Immunity', 'Teething Troubles', 'Irritability & Hyperactive'],
  'Lifestyle Diseases': ['Diabetes', 'Blood Pressure', 'Obesity', 'Thyroid', 'Hang Over', 'Varicose Veins'],
  Tonics: ['Anaemia', 'Blood Purifiers', 'General Tonics', 'Weakness & Fatigue'],
} as const;

type DiseaseCategory = keyof typeof DISEASE_SUBCATEGORY_MAP;

const VENDOR_CATEGORY_MAP = {
  'Generic Medicine': [
    // Disease Categories
    'Addiction', 'Anxiety & Depression', 'Sleeplessness', 'Weak Memory',
    'Acne & Pimples', 'Dark Circles & Marks', 'Wrinkles & Aging',
    'Hair Fall', 'Dandruff', 'Alopecia & Bald Patches', 'Premature Graying', 'Lice',
    'Conjunctivitis', 'Cataract', 'Eye Strain', 'Glaucoma', 'Styes', 'Ear Pain', 'Ear Wax',
    'Allergic Rhinitis', 'Sneezing & Running Nose', 'Sinusitis & Blocked Nose', 'Snoring', 'Tonsillitis & Throat Pain', 'Laryngitis & Hoarse Voice',
    'Headache & Migraine', 'Vertigo/Motion Sickness', 'Neuralgia & Nerve Pain', 'Epilepsy & Fits',
    'Bad Breath', 'Bleeding Gum/Pyorrhea', 'Mouth Ulcers/Aphthae', 'Cavities & Tooth Pain', 'Stammering',
    'Asthma', 'Bronchitis', 'Cough', 'Pneumonia',
    'Constipation', 'Piles & Fissures', 'Loose Motions/Diarrhoea', 'IBS & Colitis', 'Fistula', 'Worms',
    'Indigestion/Acidity/Gas', 'Loss of Appetite', 'Jaundice & Fatty Liver', 'Stomach Pain & Colic', 'Vomiting & Nausea', 'Gall Stones', 'Appendicitis', 'Hernia',
    'Heart Tonics', 'Chest Pain & Angina', 'Cholesterol & Triglyceride',
    'Urinary Tract Infection', 'Kidney Stone', 'Frequent Urination',
    'Arthritis & Joint Pains', 'Back & Knee Pain', 'Cervical Spondylosis', 'Injuries & Fractures', 'Gout & Uric Acid', 'Osteoporosis', 'Sciatica', 'Heel Pain',
    'Bed Sores', 'Boils & Abscesses', 'Burns', 'Cyst & Tumor', 'Eczema', 'Herpes', 'Nail Fungus', 'Psoriasis & Dry Skin', 'Rash/Itch/Urticaria/Hives', 'Vitiligo & Leucoderma', 'Warts & Corns',
    'Dengue', 'Flu & Fever', 'Malaria', 'Typhoid',
    'Hydrocele', 'Premature Ejaculation', 'Impotency', 'Prostate Enlargement',
    'Underdeveloped Breasts', 'Enlarged Breasts', 'Leucorrhoea', 'Excessive Menses', 'Vaginitis', 'Menopause', 'Painful, Delayed & Scanty Menses',
    'Low Height', 'Autism', 'Bed Wetting', 'Immunity', 'Teething Troubles', 'Irritability & Hyperactive',
    'Diabetes', 'Blood Pressure', 'Obesity', 'Thyroid', 'Hang Over', 'Varicose Veins',
    'Parkinsons & Trembling', 'Involuntary Urination', 'Alzheimers',
    'Anaemia', 'Blood Purifiers', 'General Tonics', 'Weakness & Fatigue',
    // Allopathy Brands
    'Sun Pharma', 'Cipla', 'Lupin', 'Pfizer', 'Abbott', 'Mankind Pharma', 'Dr. Reddys', 'Glenmark Pharma',
    // Allopathic Medicines
    'Tablets & Capsules', 'Syrups & Suspensions', 'Creams & Ointments', 'Inhalers & Respules', 'Oral Drops', 'Eye & Ear Drops', 'Nasal Drops & Spray', 'Injections & Infusions',
  ],
  'Ayurveda Medicine': [
    'Medicines', 'Single Remedies', 'Herbal Food & Juices',
  ],
  Homeopathy: [
    'Medicines', 'Cosmetics', 'Dilutions', 'Mother Tinctures', 'Biochemic', 'Bach Flower', 'Homeopathy Kits', 'Triturations', 'Millesimal LM Potency', 'Bio Combination',
  ],
  'Lab Tests': [
    'General', 'Diabetes', 'Cardiac', 'Thyroid', 'Liver', 'Kidney', 'Vitamins', 'Infection', 'Women',
  ],
  Disease: [
    'Addiction', 'Anxiety & Depression', 'Sleeplessness', 'Weak Memory',
    'Acne & Pimples', 'Dark Circles & Marks', 'Wrinkles & Aging',
    'Hair Fall', 'Dandruff', 'Alopecia & Bald Patches', 'Premature Graying', 'Lice',
    'Conjunctivitis', 'Cataract', 'Eye Strain', 'Glaucoma', 'Styes', 'Ear Pain', 'Ear Wax',
    'Allergic Rhinitis', 'Sneezing & Running Nose', 'Sinusitis & Blocked Nose', 'Snoring', 'Tonsillitis & Throat Pain', 'Laryngitis & Hoarse Voice',
    'Headache & Migraine', 'Vertigo/Motion Sickness', 'Neuralgia & Nerve Pain', 'Epilepsy & Fits',
    'Bad Breath', 'Bleeding Gum/Pyorrhea', 'Mouth Ulcers/Aphthae', 'Cavities & Tooth Pain', 'Stammering',
    'Asthma', 'Bronchitis', 'Cough', 'Pneumonia',
    'Constipation', 'Piles & Fissures', 'Loose Motions/Diarrhoea', 'IBS & Colitis', 'Fistula', 'Worms',
    'Indigestion/Acidity/Gas', 'Loss of Appetite', 'Jaundice & Fatty Liver', 'Stomach Pain & Colic', 'Vomiting & Nausea', 'Gall Stones', 'Appendicitis', 'Hernia',
    'Heart Tonics', 'Chest Pain & Angina', 'Cholesterol & Triglyceride',
    'Urinary Tract Infection', 'Kidney Stone', 'Frequent Urination',
    'Arthritis & Joint Pains', 'Back & Knee Pain', 'Cervical Spondylosis', 'Injuries & Fractures', 'Gout & Uric Acid', 'Osteoporosis', 'Sciatica', 'Heel Pain',
    'Bed Sores', 'Boils & Abscesses', 'Burns', 'Cyst & Tumor', 'Eczema', 'Herpes', 'Nail Fungus', 'Psoriasis & Dry Skin', 'Rash/Itch/Urticaria/Hives', 'Vitiligo & Leucoderma', 'Warts & Corns',
    'Dengue', 'Flu & Fever', 'Malaria', 'Typhoid',
    'Hydrocele', 'Premature Ejaculation', 'Impotency', 'Prostate Enlargement',
    'Underdeveloped Breasts', 'Enlarged Breasts', 'Leucorrhoea', 'Excessive Menses', 'Vaginitis', 'Menopause', 'Painful, Delayed & Scanty Menses',
    'Low Height', 'Autism', 'Bed Wetting', 'Immunity', 'Teething Troubles', 'Irritability & Hyperactive',
    'Diabetes', 'Blood Pressure', 'Obesity', 'Thyroid', 'Hang Over', 'Varicose Veins',
    'Parkinsons & Trembling', 'Involuntary Urination', 'Alzheimers',
    'Anaemia', 'Blood Purifiers', 'General Tonics', 'Weakness & Fatigue',
  ],
  Nutrition: [
    'Sports Nutrition', 'Health Food & Drinks', 'Vitamin & Dietary Supplements', 'Green Teas', 'Digestives',
  ],
  'Organic Products': ['Organic Foods', 'Coffee & Tea', 'Ghee', 'Atta/Flour'],
  'Personal Care': [
    'Aroma Oils', 'Mens Grooming', 'Female Care', 'Skin Care', 'Bath & Shower', 'Hair Care', 'Elderly Care', 'Mosquito Repellents', 'Oral Care',
  ],
  Fitness: [
    'Supports & Splints', 'Health Devices', 'Fitness Equipment', 'Hospital Supplies', 'Aroma Therapy', 'Disability Aids', 'Massagers', 'Bandages & Tapes', 'Walking Sticks',
  ],
  'Sexual Wellness': [
    'Sexual Supplements', 'Condoms',
  ],
  Consultation: [
    'Homeo Treatment', 'Ayurveda Treatment', 'Unani Treatment', 'Diet Counselling',
  ],
  Unani: [
    'Unani Medicines', 'Habbe & Qurs', 'Majun & Jawarish', 'Safoof, Labub & Kushta', 'Sharbat, Sirka & Arq', 'Lauq & Saoot', 'Khamira & Itrifal', 'Roghan & Oils', 'Unani Brands',
  ],
  'Baby Care': [
    'Tonics & Supplements', 'Bath & Skin', 'Wipes & Diapers', 'Gift Packs',
  ],
} as const;

type VendorProductType = keyof typeof VENDOR_CATEGORY_MAP;

function getDefaultCategoryForType(productType: VendorProductType): string {
  return VENDOR_CATEGORY_MAP[productType][0];
}

function inferProductTypeFromCategory(category: string): VendorProductType {
  const normalized = (category || '').trim().toLowerCase();
  if (normalized === 'generic' || normalized === 'branded') return 'Generic Medicine';
  if (normalized === 'ayurvedic' || normalized === 'ayurveda') return 'Ayurveda Medicine';
  if (normalized === 'homeopathy') return 'Homeopathy';
  if (normalized === 'lab tests' || normalized === 'lab-tests' || normalized === 'labtest') return 'Lab Tests';

  for (const [type, categories] of Object.entries(VENDOR_CATEGORY_MAP)) {
    if ((categories as readonly string[]).includes(category)) {
      return type as VendorProductType;
    }
  }
  return 'Generic Medicine';
}

function isCloudinaryImageUrl(url?: string): boolean {
  if (!url || typeof url !== 'string') return false;
  return /^https?:\/\/res\.cloudinary\.com\//i.test(url.trim());
}

function extractPublicIdFromUrl(url: string): string | null {
  try {
    const match = url.match(/\/([^/]+\/[^/]+)\.[^.]+$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function formatVendorAddress(address?: VendorInfo['address']) {
  if (!address) return 'Not provided';

  const parts = [address.street, address.city, address.state, address.pincode, address.country]
    .map((part) => String(part || '').trim())
    .filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : 'Not provided';
}

function buildProfileForm(vendor?: VendorInfo | null) {
  return {
    vendorName: vendor?.vendorName || '',
    phone: vendor?.phone || '',
    businessType: vendor?.businessType || 'pharmacy',
    description: vendor?.description || '',
    street: vendor?.address?.street || '',
    city: vendor?.address?.city || '',
    state: vendor?.address?.state || '',
    pincode: vendor?.address?.pincode || '',
    country: vendor?.address?.country || 'India',
    gstNumber: vendor?.gstNumber || '',
    licenseNumber: vendor?.licenseNumber || '',
    registrationNumber: vendor?.registrationNumber || '',
    supportContact: vendor?.supportContact || '',
    website: vendor?.socialLinks?.website || '',
    facebook: vendor?.socialLinks?.facebook || '',
    instagram: vendor?.socialLinks?.instagram || '',
    pickupStreet: vendor?.pickupAddress?.street || '',
    pickupCity: vendor?.pickupAddress?.city || '',
    pickupState: vendor?.pickupAddress?.state || '',
    pickupPincode: vendor?.pickupAddress?.pincode || '',
    pickupPhone: vendor?.pickupAddress?.phone || '',
    warehouseStreet: vendor?.warehouseAddress?.street || '',
    warehouseCity: vendor?.warehouseAddress?.city || '',
    warehouseState: vendor?.warehouseAddress?.state || '',
    warehousePincode: vendor?.warehouseAddress?.pincode || '',
    returnStreet: vendor?.returnAddress?.street || '',
    returnCity: vendor?.returnAddress?.city || '',
    returnState: vendor?.returnAddress?.state || '',
    returnPincode: vendor?.returnAddress?.pincode || '',
  };
}

export default function VendorDashboard() {
  const router = useRouter();
  const [vendorInfo, setVendorInfo] = useState<VendorInfo | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [categoryTree, setCategoryTree] = useState<any[]>([]);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    brand: '',
    description: '',
    shortDescription: '',
    safetyInformation: '',
    specifications: '',
    price: '',
    usdPrice: '',
    mrp: '',
    productType: 'Generic Medicine' as VendorProductType,
    category: '',
    categoryPath: [] as string[],
    categories: [] as string[],
    extraCategoryPaths: [] as string[][],
    subcategory: '',
    potency: '',
    quantity: '',
    quantityUnit: 'None',
    diseasePaths: [] as string[][],
    diseaseCategory: '',
    diseaseSubcategory: '',
    benefit: '',
    requiresPrescription: false,
    isPopular: false,
    isPopularGeneric: false,
    isPopularAyurveda: false,
    isPopularHomeopathy: false,
    isPopularLabTests: false,
    popularSection: 'None',
    popularSections: [] as string[],
    stock: '',
    image: '',
  });
  const [showEditProduct, setShowEditProduct] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editProduct, setEditProduct] = useState({
    name: '',
    brand: '',
    description: '',
    shortDescription: '',
    safetyInformation: '',
    specifications: '',
    price: '',
    usdPrice: '',
    mrp: '',
    productType: 'Generic Medicine' as VendorProductType,
    category: '',
    categoryPath: [] as string[],
    categories: [] as string[],
    extraCategoryPaths: [] as string[][],
    subcategory: '',
    potency: '',
    quantity: '',
    quantityUnit: 'None',
    diseasePaths: [] as string[][],
    diseaseCategory: '',
    diseaseSubcategory: '',
    benefit: '',
    requiresPrescription: false,
    popularSection: 'None',
    popularSections: [] as string[],
    stock: '',
    image: '',
  });
  const [vendorOrders, setVendorOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedProductImage, setSelectedProductImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [selectedEditProductImage, setSelectedEditProductImage] = useState<File | null>(null);
  const [editImagePreviewUrl, setEditImagePreviewUrl] = useState<string>('');
  const [profileForm, setProfileForm] = useState(buildProfileForm());
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [profileImagePreviewUrl, setProfileImagePreviewUrl] = useState('');
  const [profileImageUploading, setProfileImageUploading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [categoryConfig, setCategoryConfig] = useState<DynamicCategoryConfig | null>(null);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResult, setBulkResult] = useState<any>(null);
  const { uploadImage, uploading: imageUploading, error: uploadError, previewUrl } = useImageUpload();

  const activeVendorCategoryMap: Record<string, string[]> =
    categoryConfig?.vendorCategoryMap && Object.keys(categoryConfig.vendorCategoryMap).length > 0
      ? categoryConfig.vendorCategoryMap
      : (VENDOR_CATEGORY_MAP as unknown as Record<string, string[]>);

  const activeDiseaseCategoryMap: Record<string, string[]> =
    categoryConfig?.diseaseSubcategoryMap && Object.keys(categoryConfig.diseaseSubcategoryMap).length > 0
      ? categoryConfig.diseaseSubcategoryMap
      : (DISEASE_SUBCATEGORY_MAP as unknown as Record<string, string[]>);

  const productTypeOptions = Object.keys(activeVendorCategoryMap) as VendorProductType[];

  const getDefaultCategoryForTypeDynamic = (productType: VendorProductType): string => {
    const options = activeVendorCategoryMap[productType] || [];
    return options[0] || getDefaultCategoryForType(productType);
  };

  const getSubcategoryOptionsForType = (productType: string, category: string): string[] => {
    const dynamicByType = categoryConfig?.subcategoryMapByType?.[productType]?.[category];
    if (dynamicByType && dynamicByType.length > 0) return dynamicByType;

    if (productType === 'Homeopathy') return (HOMEOPATHY_SUBCATEGORY_MAP[category as HomeopathyCategory] || []) as unknown as string[];
    if (productType === 'Ayurveda Medicine') return (AYURVEDA_SUBCATEGORY_MAP[category as AyurvedaCategory] || []) as unknown as string[];
    if (productType === 'Nutrition') return (NUTRITION_SUBCATEGORY_MAP[category as NutritionCategory] || []) as unknown as string[];
    if (productType === 'Organic Products') return (ORGANIC_PRODUCTS_SUBCATEGORY_MAP[category as OrganicProductsCategory] || []) as unknown as string[];
    if (productType === 'Personal Care') return (PERSONAL_CARE_SUBCATEGORY_MAP[category as PersonalCareCategory] || []) as unknown as string[];
    if (productType === 'Baby Care') return (BABY_CARE_SUBCATEGORY_MAP[category as BabyCareCategory] || []) as unknown as string[];
    if (productType === 'Fitness') return (FITNESS_SUBCATEGORY_MAP[category as FitnessCategory] || []) as unknown as string[];
    if (productType === 'Unani') return (UNANI_SUBCATEGORY_MAP[category as UnaniCategory] || []) as unknown as string[];

    return [];
  };

  const getDefaultSubcategoryForTypeDynamic = (productType: string, category: string): string => {
    const options = getSubcategoryOptionsForType(productType, category);
    return options[0] || '';
  };

  // ── Build dynamic category hierarchy ──────────────────────────────────────
  const findNodeByName = (nodes: any[], name: string): any => {
    for (const node of nodes) {
      if (node.name === name) return node;
      if (node.children) {
        const found = findNodeByName(node.children, name);
        if (found) return found;
      }
    }
    return null;
  };

  const getNodeChildren = (nodeName: string | null, treeData: any[]): string[] => {
    if (!nodeName) {
      // Get product types (top-level children under Product Types root)
      const productTypesRoot = treeData.find((n: any) => n.name === 'Product Types');
      if (productTypesRoot?.children) {
        return productTypesRoot.children.map((n: any) => n.name).filter((n: any) => n);
      }
      return [];
    }
    const node = findNodeByName(treeData, nodeName);
    if (node?.children) {
      return node.children.map((n: any) => n.name).filter((n: any) => n);
    }
    return [];
  };

  const normalizeExtraCategoryPath = (productType: string, path: string[]): string[] => {
    if (path.length >= 4) return path.slice(0, 4);
    if (path.length === 3) return [productType, ...path];
    const normalized = [productType, ...path];
    while (normalized.length < 4) normalized.push('');
    return normalized;
  };

  const PRODUCT_TYPE_LABELS: Record<string, string> = {
    'Generic Medicine': 'General Medicines',
    'Ayurveda Medicine': 'Ayurveda',
  };

  const formatProductTypeLabel = (productType: string): string => PRODUCT_TYPE_LABELS[productType] || productType;

  const normalizeExtraCategoryPaths = (productType: string, paths: string[][]): string[][] =>
    paths.map((path) => normalizeExtraCategoryPath(productType, path));

  const getExtraPathOptions = (productType: string, path: string[], levelIdx: number): string[] => {
    if (levelIdx === 0) {
      const productTypes = getNodeChildren(null, categoryTree);
      return productTypes.length > 0 ? productTypes : (Object.keys(activeVendorCategoryMap) as string[]);
    }

    const selectedProductType = path[0] || productType;

    if (levelIdx === 1) {
      const treeOptions = getNodeChildren(selectedProductType, categoryTree);
      if (treeOptions.length > 0) return treeOptions;
      return activeVendorCategoryMap[selectedProductType] || [];
    }

    const parent = path[levelIdx - 1];
    if (!parent) return [];

    const treeOptions = getNodeChildren(parent, categoryTree);
    if (treeOptions.length > 0) return treeOptions;

    if (levelIdx === 2) {
      return getSubcategoryOptionsForType(selectedProductType, path[1] || '');
    }

    return [];
  };

  const findCategoryPathFromTree = (productType: string, targetCategory: string): string[] => {
    const productTypesRoot = categoryTree.find((n: any) => n.name === 'Product Types');
    if (!productTypesRoot || !productTypesRoot.children) return [targetCategory];

    const productTypeNode = productTypesRoot.children.find((node: any) => node.name === productType);
    if (!productTypeNode) return [targetCategory];

    const searchPath = (node: any, target: string, path: string[]): string[] | null => {
      if (node.name === target) {
        return path;
      }
      if (!node.children) return null;
      for (const child of node.children) {
        const result = searchPath(child, target, [...path, child.name]);
        if (result) return result;
      }
      return null;
    };

    const foundPath = searchPath(productTypeNode, targetCategory, []);
    return foundPath || [targetCategory];
  };

  useEffect(() => {
    const token = localStorage.getItem('vendorToken');
    const info = localStorage.getItem('vendorInfo');

    if (!token || !info) {
      router.push('/vendor/login');
      return;
    }

    const vendorData = JSON.parse(info);
    // Normalize id shape (login historically returned `id`, APIs return `_id`).
    if (!vendorData._id && vendorData.id) vendorData._id = vendorData.id;
    setVendorInfo(vendorData);
    setProfileForm(buildProfileForm(vendorData));
    setProfileImageUrl(vendorData.logo || '');
    fetchProducts();
    fetchVendorOrders();
    void fetchVendorProfile();
    void fetchDashboardStats();
  }, [router]);

  /** Authorization header from the vendor JWT issued at login. */
  const vendorAuthHeaders = (extra: Record<string, string> = {}): HeadersInit => {
    const token = localStorage.getItem('vendorToken') || '';
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extra,
    };
  };

  const fetchDashboardStats = async () => {
    try {
      setStatsLoading(true);
      const response = await fetch('/api/vendor/dashboard/stats', {
        headers: vendorAuthHeaders(),
        cache: 'no-store',
      });
      if (response.status === 401) {
        router.push('/vendor/login');
        return;
      }
      if (!response.ok) return;
      const data = await response.json();
      if (data?.stats) setDashboardStats(data.stats);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    const fetchCategoryConfig = async () => {
      try {
        const [configRes, treeRes] = await Promise.all([
          fetch('/api/categories?mode=config'),
          fetch('/api/categories')
        ]);
        const configData = await configRes.json();
        const treeData = await treeRes.json();
        if (configData?.success && configData?.config) {
          setCategoryConfig(configData.config);
        }
        if (treeData?.success && treeData?.tree) {
          setCategoryTree(treeData.tree);
        }
      } catch {}
    };

    fetchCategoryConfig();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await fetch(`/api/vendor/products`, {
        headers: vendorAuthHeaders(),
        cache: 'no-store',
      });
      if (response.status === 401) {
        router.push('/vendor/login');
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch products');
      const data = await response.json();
      setProducts(data.products || []);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchVendorProfile = async () => {
    try {
      const response = await fetch(`/api/vendor/profile`, {
        headers: vendorAuthHeaders(),
        cache: 'no-store',
      });

      if (response.status === 401) {
        router.push('/vendor/login');
        return;
      }
      if (!response.ok) return;

      const data = await response.json();
      if (data?.vendor) {
        setVendorInfo(data.vendor);
        setProfileForm(buildProfileForm(data.vendor));
        setProfileImageUrl(data.vendor.logo || '');
        localStorage.setItem('vendorInfo', JSON.stringify(data.vendor));
        window.dispatchEvent(new Event('storage'));
      }
    } catch (error) {
      console.error('Error fetching vendor profile:', error);
    }
  };

  const toggleVendorVisibility = async () => {
    if (!vendorInfo?._id) return;

    const nextActiveState = vendorInfo.isActive !== false;

    try {
      const response = await fetch('/api/vendor/profile', {
        method: 'PUT',
        headers: vendorAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          isActive: !nextActiveState,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update vendor visibility');

      const updatedVendor = data.vendor ? data.vendor : { ...vendorInfo, isActive: !nextActiveState };
      setVendorInfo(updatedVendor);
      localStorage.setItem('vendorInfo', JSON.stringify(updatedVendor));
      window.dispatchEvent(new Event('storage'));
    } catch (error) {
      console.error('Error updating vendor visibility:', error);
    }
  };

  const uploadVendorProfileImage = async (file?: File) => {
    if (!file) return;

    setProfileError('');

    if (!file.type.startsWith('image/')) {
      setProfileError('Please select a valid image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileError('Image size must be less than 5MB');
      return;
    }

    setProfileImageUploading(true);
    const preview = URL.createObjectURL(file);
    setProfileImagePreviewUrl(preview);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/vendor/upload-profile-image', {
        method: 'POST',
        headers: vendorAuthHeaders(),
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data?.imageUrl) {
        throw new Error(data?.error || 'Image upload failed');
      }

      setProfileImageUrl(data.imageUrl);
      setProfileImagePreviewUrl('');
      setProfileError('');
    } catch (error: any) {
      setProfileError(error?.message || 'Image upload failed');
    } finally {
      setProfileImageUploading(false);
    }
  };

  const handleProfileFieldChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setProfileForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleUpdateVendorProfile = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!vendorInfo?._id) {
      setProfileError('Vendor information missing. Please login again.');
      return;
    }

    setProfileSaving(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      const response = await fetch('/api/vendor/profile', {
        method: 'PUT',
        headers: vendorAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          vendorName: profileForm.vendorName,
          phone: profileForm.phone,
          businessType: profileForm.businessType,
          description: profileForm.description,
          logo: profileImageUrl || vendorInfo.logo || '',
          street: profileForm.street,
          city: profileForm.city,
          state: profileForm.state,
          pincode: profileForm.pincode,
          country: profileForm.country,
          gstNumber: profileForm.gstNumber,
          licenseNumber: profileForm.licenseNumber,
          registrationNumber: profileForm.registrationNumber,
          supportContact: profileForm.supportContact,
          socialLinks: {
            website: profileForm.website,
            facebook: profileForm.facebook,
            instagram: profileForm.instagram,
          },
          pickupAddress: {
            street: profileForm.pickupStreet,
            city: profileForm.pickupCity,
            state: profileForm.pickupState,
            pincode: profileForm.pickupPincode,
            phone: profileForm.pickupPhone,
            country: profileForm.country || 'India',
          },
          warehouseAddress: {
            street: profileForm.warehouseStreet,
            city: profileForm.warehouseCity,
            state: profileForm.warehouseState,
            pincode: profileForm.warehousePincode,
            country: profileForm.country || 'India',
          },
          returnAddress: {
            street: profileForm.returnStreet,
            city: profileForm.returnCity,
            state: profileForm.returnState,
            pincode: profileForm.returnPincode,
            country: profileForm.country || 'India',
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update profile');

      const updatedVendor = data.vendor || vendorInfo;
      setVendorInfo(updatedVendor);
      setProfileForm(buildProfileForm(updatedVendor));
      setProfileImageUrl(updatedVendor.logo || '');
      setProfileImagePreviewUrl('');
      localStorage.setItem('vendorInfo', JSON.stringify(updatedVendor));
      window.dispatchEvent(new Event('storage'));
      setProfileSuccess('Profile updated successfully');
    } catch (error: any) {
      setProfileError(error?.message || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const fetchVendorOrders = async () => {
    try {
      const response = await fetch('/api/orders?vendorId=me', {
        headers: vendorAuthHeaders({ 'x-vendor-scope': '1' }),
        cache: 'no-store',
      });
      if (response.status === 401) {
        router.push('/vendor/login');
        return;
      }
      if (!response.ok) throw new Error('Failed to fetch orders');
      const data = await response.json();
      const list = Array.isArray(data?.orders) ? data.orders : [];
      // Normalize for the existing orders UI (expects customerName / totalAmount).
      setVendorOrders(
        list.map((o: any) => ({
          ...o,
          customerName: o?.userId?.fullName || o?.customerName || 'Customer',
          customerEmail: o?.userId?.email || o?.customerEmail || '',
          customerPhone: o?.userId?.phone || o?.customerPhone || '',
          totalAmount: Number(
            o?.vendorAmount ??
              (Array.isArray(o?.items)
                ? o.items.reduce(
                    (sum: number, i: any) =>
                      sum + Number(i.total ?? Number(i.price || 0) * Number(i.quantity || 0)),
                    0
                  )
                : o?.totalPrice ?? o?.totalAmount ?? 0)
          ),
          items: Array.isArray(o?.items)
            ? o.items.map((i: any) => ({
                ...i,
                name: i?.productName || i?.name,
              }))
            : [],
        }))
      );
    } catch (err) {
      console.error('Error fetching vendor orders:', err);
      setVendorOrders([]);
    }
  };

  const getOrderId = (order: any): string => {
    return String(order?._id || order?.id || order?.orderId || '').trim();
  };

  const getOrderStatusColor = (status: string) => {
    switch ((status || 'pending').toLowerCase()) {
      case 'pending':
        return 'bg-orange-100 text-orange-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'shipped':
        return 'bg-indigo-100 text-indigo-800';
      case 'delivered':
        return 'bg-emerald-100 text-emerald-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    if (!vendorInfo?._id) return;

    const normalizedStatus = String(newStatus || 'pending').toLowerCase();
    if (!ORDER_STATUS_OPTIONS.includes(normalizedStatus as typeof ORDER_STATUS_OPTIONS[number])) {
      return;
    }

    try {
      const response = await fetch('/api/orders', {
        method: 'PUT',
        headers: vendorAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          orderId,
          status: normalizedStatus,
          userType: 'vendor',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to update order status');
      }

      await fetchVendorOrders();
      if (selectedOrder && getOrderId(selectedOrder) === orderId) {
        setSelectedOrder({ ...selectedOrder, status: normalizedStatus });
      }
    } catch (err: any) {
      console.error('Error updating order status:', err);
      alert(err?.message || 'Failed to update order status. Please try again.');
    }
  };

  const handleAddProduct = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const token = localStorage.getItem('vendorToken');

    try {
      // Validate required fields
      if (!newProduct.name || newProduct.name.trim() === '') {
        throw new Error('Product name is required');
      }
      
      if (!newProduct.price || isNaN(parseFloat(newProduct.price))) {
        throw new Error('Valid product price is required');
      }

      if (!newProduct.usdPrice || isNaN(parseFloat(newProduct.usdPrice))) {
        throw new Error('Valid USD dollar price is required');
      }
      
      if (!newProduct.categoryPath || newProduct.categoryPath.length === 0) {
        throw new Error('Category hierarchy must be selected');
      }

      if (!imageUrl) {
        throw new Error('Please upload image to Cloudinary first');
      }

      const response = await fetch('/api/vendor/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          vendorId: vendorInfo?._id,
          ...newProduct,
          category: newProduct.categoryPath[0] || undefined,
          subcategory: newProduct.categoryPath[1] || newProduct.subcategory || undefined,
          categories: newProduct.categoryPath,
          extraCategoryPaths: (newProduct.extraCategoryPaths || []).map((path) => path.map((value) => value.trim()).filter(Boolean)).filter((path) => path.length > 0),
          popularSections: newProduct.popularSections || [],
          diseasePaths: newProduct.diseasePaths || [],
          diseaseCategory: newProduct.diseasePaths?.[0]?.[0] || newProduct.diseaseCategory || undefined,
          diseaseSubcategory: newProduct.diseasePaths?.[0]?.[1] || newProduct.diseaseSubcategory || undefined,
          potency: newProduct.potency || undefined,
          price: parseFloat(newProduct.price),
          usdPrice: newProduct.usdPrice ? parseFloat(newProduct.usdPrice) : undefined,
          mrp: newProduct.mrp && !isNaN(parseFloat(newProduct.mrp)) ? parseFloat(newProduct.mrp) : undefined,
          quantity: newProduct.quantity && !isNaN(parseFloat(newProduct.quantity)) ? parseFloat(newProduct.quantity) : undefined,
          stock: newProduct.stock && !isNaN(parseInt(newProduct.stock)) ? parseInt(newProduct.stock) : 0,
          image: imageUrl,
        }),
      });

      const createdData = await response.json();
      if (!response.ok) throw new Error(createdData.error || 'Failed to add product');

      setNewProduct({
        name: '',
        brand: '',
        description: '',
        shortDescription: '',
        safetyInformation: '',
        specifications: '',
        price: '',
        usdPrice: '',
        mrp: '',
        productType: 'Generic Medicine',
        category: '',
        categoryPath: [],
        categories: [],
        extraCategoryPaths: [],
        subcategory: '',
        potency: '',

        quantity: '',
        quantityUnit: 'None',
        diseasePaths: [],
        diseaseCategory: '',
        diseaseSubcategory: '',
        benefit: '',
        requiresPrescription: false,
        isPopular: false,
        isPopularGeneric: false,
        isPopularAyurveda: false,
        isPopularHomeopathy: false,
        isPopularLabTests: false,
        popularSection: 'None',
        popularSections: [],
        stock: '',
        image: '',
      });
      setSelectedProductImage(null);
      setImageUrl('');
      setShowAddProduct(false);
      alert(createdData.message || 'Product submitted for admin approval');
      if (vendorInfo) {
        fetchProducts();
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      alert('Error: ' + error);
    }
  };

  const handleEditProduct = (product: Product) => {
    const inferredType =
      (Object.entries(activeVendorCategoryMap).find(([, categories]) =>
        (categories || []).includes(product.category)
      )?.[0] as VendorProductType) || inferProductTypeFromCategory(product.category);
    const normalizedCategory = product.category || getDefaultCategoryForTypeDynamic(inferredType);
    const inferredProductType = (product.productType as VendorProductType) || inferredType;
    const editCategoryPath = product.subcategory 
      ? [normalizedCategory, product.subcategory]
      : findCategoryPathFromTree(inferredProductType, normalizedCategory);
    const isHomeopathy = inferredProductType === 'Homeopathy';
    const isAyurveda = inferredProductType === 'Ayurveda Medicine';
    const isNutrition = inferredProductType === 'Nutrition';
    const isPersonalCare = inferredProductType === 'Personal Care';
    const isBabyCare = inferredProductType === 'Baby Care';
    const isFitness = inferredProductType === 'Fitness';
    const isUnani = inferredProductType === 'Unani';
    setEditingProductId(String(product._id));
    setEditProduct({
      name: product.name || '',
      brand: product.brand || '',
      description: product.description || '',
      shortDescription: product.shortDescription || '',
      safetyInformation: product.safetyInformation || '',
      specifications: product.specifications || '',
      price: String(product.price ?? ''),
      usdPrice: String((product as any).usdPrice || ''),
      mrp: product.mrp !== undefined ? String(product.mrp) : '',
      productType: product.productType as VendorProductType || inferredType,
      category: normalizedCategory,
      categoryPath: editCategoryPath,
      categories: (product as any).categories || [],
      extraCategoryPaths: normalizeExtraCategoryPaths(inferredProductType, Array.isArray((product as any).extraCategoryPaths) ? (product as any).extraCategoryPaths : []),
      subcategory: product.subcategory || (
        isHomeopathy ? getDefaultSubcategoryForTypeDynamic(inferredProductType, normalizedCategory)
          : isAyurveda ? getDefaultSubcategoryForTypeDynamic(inferredProductType, normalizedCategory)
          : isNutrition ? getDefaultSubcategoryForTypeDynamic(inferredProductType, normalizedCategory)
          : isPersonalCare ? getDefaultSubcategoryForTypeDynamic(inferredProductType, normalizedCategory)
          : isBabyCare ? getDefaultSubcategoryForTypeDynamic(inferredProductType, normalizedCategory)
          : isFitness ? getDefaultSubcategoryForTypeDynamic(inferredProductType, normalizedCategory)
          : isUnani ? getDefaultSubcategoryForTypeDynamic(inferredProductType, normalizedCategory)
          : ''
      ),
      potency: product.potency || '',
      quantity: product.quantity !== undefined ? String(product.quantity) : '',
      quantityUnit: product.quantityUnit || 'None',
      diseasePaths: Array.isArray((product as any).diseasePaths)
        ? (product as any).diseasePaths
        : ((product.diseaseCategory || product.diseaseSubcategory)
          ? [[product.diseaseCategory || '', product.diseaseSubcategory || '']]
          : []),
      diseaseCategory: product.diseaseCategory || '',
      diseaseSubcategory: product.diseaseSubcategory || '',
      benefit: product.benefit || '',
      requiresPrescription: product.requiresPrescription || false,
      popularSection: (product as any).popularSection ||
        ((product as any).isPopularGeneric ? 'Generic' :
         (product as any).isPopularAyurveda ? 'Ayurveda' :
         (product as any).isPopularHomeopathy ? 'Homeopathy' :
         (product as any).isPopularLabTests ? 'LabTests' :
         (product as any).isPopular ? 'Generic' :
         'None'),
      popularSections: (product as any).popularSections || [],
      stock: String(product.stock ?? ''),
      image: product.image || '',
    });
    setSelectedEditProductImage(null);
    setEditImagePreviewUrl(product.image || '');
    setShowEditProduct(true);
    setShowAddProduct(false);
  };

  const handleUpdateProduct = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const token = localStorage.getItem('vendorToken');

    if (!editingProductId || !vendorInfo?._id) {
      alert('Unable to update product. Missing product or vendor details.');
      return;
    }

    if (!editProduct.categoryPath || editProduct.categoryPath.length === 0) {
      alert('Category hierarchy must be selected');
      return;
    }

    if (!editProduct.usdPrice || isNaN(parseFloat(editProduct.usdPrice))) {
      alert('Valid USD dollar price is required');
      return;
    }

    try {
      let imageUrl = editProduct.image;

      if (selectedEditProductImage) {
        const uploadResult = await uploadImage(selectedEditProductImage);
        if (!uploadResult?.success || !uploadResult.imageUrl) {
          throw new Error(uploadResult?.error || 'Image upload failed');
        }
        imageUrl = uploadResult.imageUrl;
      }

      const response = await fetch('/api/vendor/products', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: editingProductId,
          vendorId: vendorInfo._id,
          name: editProduct.name,
          description: editProduct.description,
          shortDescription: editProduct.shortDescription,
          price: parseFloat(editProduct.price),
          usdPrice: editProduct.usdPrice ? parseFloat(editProduct.usdPrice) : undefined,
          mrp: editProduct.mrp ? parseFloat(editProduct.mrp) : undefined,
          quantity: editProduct.quantity ? parseFloat(editProduct.quantity) : undefined,
          stock: parseInt(editProduct.stock),
          productType: editProduct.productType,
          category: editProduct.categoryPath?.[0] || editProduct.category,
          categories: editProduct.categoryPath && editProduct.categoryPath.length > 0 ? editProduct.categoryPath : editProduct.category ? [editProduct.category] : [],
          extraCategoryPaths: (editProduct.extraCategoryPaths || []).map((path) => path.map((value) => value.trim()).filter(Boolean)).filter((path) => path.length > 0),
          subcategory: editProduct.categoryPath?.[1] || editProduct.subcategory || undefined,
          potency: editProduct.potency || undefined,
          quantityUnit: editProduct.quantityUnit || 'None',
          popularSections: editProduct.popularSections || [],
          diseasePaths: editProduct.diseasePaths || [],
          diseaseCategory: editProduct.diseasePaths?.[0]?.[0] || editProduct.diseaseCategory || undefined,
          diseaseSubcategory: editProduct.diseasePaths?.[0]?.[1] || editProduct.diseaseSubcategory || undefined,
          benefit: editProduct.benefit || undefined,
          safetyInformation: editProduct.safetyInformation,
          specifications: editProduct.specifications,
          brand: editProduct.brand || undefined,
          requiresPrescription: editProduct.requiresPrescription,
          image: imageUrl,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update product');
      }

      setShowEditProduct(false);
      setEditingProductId(null);
      setSelectedEditProductImage(null);
      setEditImagePreviewUrl('');

      if (vendorInfo) {
        fetchProducts();
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      alert('Error: ' + error);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure?')) return;

    const token = localStorage.getItem('vendorToken');
    if (!vendorInfo?._id) {
      alert('Vendor information missing. Please login again.');
      return;
    }

    try {
      const params = new URLSearchParams({
        productId,
        vendorId: vendorInfo._id,
      });

      const response = await fetch(`/api/vendor/products?${params.toString()}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete product');
      if (vendorInfo) {
        fetchProducts();
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      alert('Error: ' + error);
    }
  };

  const exportProductsToExcel = () => {
    const rows = products.map((product) => ({
      'Product ID': product._id,
      Name: product.name,
      Brand: product.brand,
      Category: product.category,
      Subcategory: product.subcategory || '',
      'Product Type': product.productType || '',
      Price: product.price,
      'USD Price': product.usdPrice ?? '',
      MRP: product.mrp ?? '',
      Stock: product.stock,
      'Requires Prescription': product.requiresPrescription ? 'Yes' : 'No',
      'Approval Status': product.approvalStatus || '',
      Description: product.description || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
    const workbookBlob = new Blob([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })], {
      type: 'application/octet-stream',
    });
    const url = URL.createObjectURL(workbookBlob);
    const element = document.createElement('a');
    element.href = url;
    element.download = `products-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
  };

  const downloadBulkUploadTemplate = () => {
    const sampleRows = [
      {
        Name: 'Sample Organic Honey',
        Brand: 'Sample Brand',
        'Product Type': 'Organic Products',
        Category: 'Organic Foods',
        Subcategory: '',
        Price: 299,
        'USD Price': 3.5,
        MRP: 349,
        Stock: 50,
        Description: 'Sample product description',
        Images: '',
        RequiresPrescription: 'No',
      },
      {
        Name: 'Sample Paracetamol 500mg',
        Brand: 'Sample Pharma',
        'Product Type': 'Generic Medicine',
        Category: 'Pain Relief',
        Subcategory: '',
        Price: 45,
        'USD Price': 0.55,
        MRP: 60,
        Stock: 200,
        Description: 'Sample medicine description',
        Images: '',
        RequiresPrescription: 'No',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
    const workbookBlob = new Blob([XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })], {
      type: 'application/octet-stream',
    });
    const url = URL.createObjectURL(workbookBlob);
    const element = document.createElement('a');
    element.href = url;
    element.download = 'vendor-bulk-upload-template.xlsx';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
  };

  const handleBulkUpload = async () => {
    if (!bulkFile) {
      alert('Please select a file');
      return;
    }

    const lowerName = bulkFile.name.toLowerCase();
    if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls') && !lowerName.endsWith('.csv')) {
      alert('Invalid file type. Please upload a .xlsx, .xls, or .csv file.');
      return;
    }

    if (!vendorInfo?._id) {
      alert('Vendor information missing');
      return;
    }

    setBulkUploading(true);
    setBulkResult(null);
    try {
      const workbook = XLSX.read(await bulkFile.arrayBuffer(), { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet);

      if (!Array.isArray(data) || data.length === 0) {
        alert('No valid product data found in file. Make sure row 1 has column headers.');
        setBulkUploading(false);
        return;
      }

      const token = localStorage.getItem('vendorToken');
      if (!token) {
        alert('Vendor session expired. Please log in again.');
        setBulkUploading(false);
        return;
      }

      const response = await fetch('/api/vendor/products/bulk-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          vendorId: vendorInfo._id,
          products: data,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Bulk upload failed');

      setBulkResult(result);
      if (result.successful > 0) {
        fetchProducts();
      }
      if (result.failed === 0) {
        alert(`Bulk upload completed: ${result.successful} successful!`);
        setShowBulkUpload(false);
        setBulkFile(null);
      } else {
        alert(
          `Bulk upload finished: ${result.successful} successful, ${result.failed} failed. See error details below.`
        );
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      alert('Error: ' + error);
    } finally {
      setBulkUploading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('vendorToken');
    localStorage.removeItem('vendorInfo');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('storage'));
    window.location.href = '/';
  };

  if (!vendorInfo) return <div className="flex items-center justify-center h-screen">Loading...</div>;

  const profileDisplayImage = profileImagePreviewUrl || profileImageUrl || vendorInfo.logo || '';

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 overflow-hidden rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                    {profileDisplayImage ? (
                      <img src={profileDisplayImage} alt={vendorInfo.vendorName} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl text-emerald-600 font-bold">{vendorInfo.vendorName?.charAt(0) || 'V'}</span>
                  )}
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-800">{vendorInfo.vendorName}</h1>
                  <p className="text-gray-600 text-sm mt-1">
                    Status: <span className="font-semibold text-emerald-600">{vendorInfo.status}</span>
                  </p>
                  <p className="text-gray-600 text-sm mt-1">
                    Visibility:{' '}
                    <span className={`font-semibold ${vendorInfo.isActive === false ? 'text-red-600' : 'text-emerald-600'}`}>
                      {vendorInfo.isActive === false ? 'Inactive' : 'Active'}
                    </span>
                  </p>
                  {vendorInfo.status === 'verified' && (
                    <p className="text-gray-600 text-sm">
                      Rating: ⭐ {vendorInfo.rating || 'Not rated yet'}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-2">
                <VendorNotificationBell />
                <button
                  onClick={handleLogout}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg"
                >
                  Logout
                </button>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Link
                  href="/profile"
                  className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  My Profile
                </Link>
                <Link
                  href="/profile/support"
                  className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Support Center
                </Link>
                <Link
                  href="/vendor/wallet"
                  className="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                >
                  My Wallet
                </Link>
                <Link
                  href="/vendor/dashboard/returns"
                  className="inline-flex items-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  Returns
                </Link>
                <Link
                  href="/vendor/dashboard/reports"
                  className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Reports
                </Link>
                <button
                  type="button"
                  onClick={toggleVendorVisibility}
                  className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white ${vendorInfo?.isActive === false ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-orange-500 hover:bg-orange-600'}`}
                >
                  {vendorInfo?.isActive === false ? 'Activate Store' : 'Deactivate Store'}
                </button>
                <button
                  onClick={() => setTab('orders')}
                  className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  My Orders
                </button>
                <Link
                  href="/medicines"
                  className="inline-flex items-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
                >
                  Browse Medicines
                </Link>
              </div>
            </div>
          </div>
        </div>

        {vendorInfo.status !== 'verified' && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg mb-8">
            ⚠️ Your account is {vendorInfo.status}. You cannot add products until your account is verified by admin.
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-4 mb-8 border-b border-gray-300">
          <button
            onClick={() => setTab('overview')}
            className={`px-4 py-2 font-semibold ${
              tab === 'overview'
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-gray-600'
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setTab('products')}
            className={`px-4 py-2 font-semibold ${
              tab === 'products'
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-gray-600'
            }`}
          >
            Products
          </button>
          <button
            onClick={() => setTab('orders')}
            className={`px-4 py-2 font-semibold ${
              tab === 'orders'
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-gray-600'
            }`}
          >
            Orders
          </button>
          <button
            onClick={() => setTab('analytics')}
            className={`px-4 py-2 font-semibold ${
              tab === 'analytics'
                ? 'text-emerald-600 border-b-2 border-emerald-600'
                : 'text-gray-600'
            }`}
          >
            Analytics
          </button>
        </div>

        {tab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Profile Information</h2>
                <div className="space-y-5">
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-20 overflow-hidden rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                      {profileDisplayImage ? (
                        <img src={profileDisplayImage} alt={vendorInfo.vendorName} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-3xl text-emerald-600 font-bold">{vendorInfo.vendorName?.charAt(0) || 'V'}</span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{vendorInfo.vendorName}</h3>
                      <p className="text-sm text-gray-600">{vendorInfo.email}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">Verification</p>
                    <p className="font-medium text-gray-900 capitalize">{vendorInfo.status}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">GST Number</p>
                    <p className="font-medium text-gray-900">{vendorInfo.gstNumber || 'Not provided'}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">Drug License</p>
                    <p className="font-medium text-gray-900">{vendorInfo.licenseNumber || 'Not provided'}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">Support Contact</p>
                    <p className="font-medium text-gray-900">{vendorInfo.supportContact || vendorInfo.phone || 'Not provided'}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">Phone</p>
                    <p className="font-medium text-gray-900">{vendorInfo.phone || 'Not provided'}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">Business Type</p>
                    <p className="font-medium text-gray-900 capitalize">{vendorInfo.businessType || 'Not provided'}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">Full Address</p>
                    <p className="font-medium text-gray-900 leading-6">{formatVendorAddress(vendorInfo.address)}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">Description</p>
                    <p className="font-medium text-gray-900 leading-6">
                      {vendorInfo.description || 'No description added yet'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-900">Edit Profile</h2>
                  <span className="text-xs font-semibold text-gray-500">Upload any supported image format for your profile</span>
                </div>

                <form onSubmit={handleUpdateVendorProfile} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="md:col-span-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                      <label className="block text-sm font-semibold text-slate-700 mb-3">Profile Image</label>
                      <div className="flex items-center gap-4">
                        <div className="h-24 w-24 overflow-hidden rounded-full bg-white border border-slate-200 flex items-center justify-center">
                          {profileDisplayImage ? (
                            <img src={profileDisplayImage} alt="Vendor profile" className="h-full w-full object-cover" />
                          ) : (
                            <span className="text-2xl text-slate-400">👤</span>
                          )}
                        </div>
                        <div className="flex-1">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => uploadVendorProfileImage(e.target.files?.[0] || undefined)}
                            disabled={profileImageUploading || profileSaving}
                            className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                          />
                          <p className="mt-2 text-xs text-slate-500">Upload any supported image file. It will be saved to Cloudinary and then stored in your profile.</p>
                          {profileImageUploading && <p className="mt-2 text-xs font-medium text-blue-600">Uploading image...</p>}
                          {profileError && <p className="mt-2 text-xs font-medium text-red-600">{profileError}</p>}
                        </div>
                      </div>
                    </div>

                    <input
                      type="text"
                      name="vendorName"
                      value={profileForm.vendorName}
                      onChange={handleProfileFieldChange}
                      placeholder="Vendor / Shop Name"
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                      required
                    />
                    <input
                      type="tel"
                      name="phone"
                      value={profileForm.phone}
                      onChange={handleProfileFieldChange}
                      placeholder="Phone Number"
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                      required
                    />
                    <select
                      name="businessType"
                      value={profileForm.businessType}
                      onChange={handleProfileFieldChange}
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                      required
                    >
                      <option value="pharmacy">Pharmacy</option>
                      <option value="clinic">Clinic</option>
                      <option value="hospital">Hospital</option>
                      <option value="lab">Lab</option>
                      <option value="supplier">Supplier</option>
                      <option value="other">Other</option>
                    </select>
                    <input
                      type="text"
                      name="country"
                      value={profileForm.country}
                      onChange={handleProfileFieldChange}
                      placeholder="Country"
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                      required
                    />
                    <input
                      type="text"
                      name="street"
                      value={profileForm.street}
                      onChange={handleProfileFieldChange}
                      placeholder="Street Address"
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm md:col-span-2"
                      required
                    />
                    <input
                      type="text"
                      name="city"
                      value={profileForm.city}
                      onChange={handleProfileFieldChange}
                      placeholder="City"
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                      required
                    />
                    <input
                      type="text"
                      name="state"
                      value={profileForm.state}
                      onChange={handleProfileFieldChange}
                      placeholder="State"
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                      required
                    />
                    <input
                      type="text"
                      name="pincode"
                      value={profileForm.pincode}
                      onChange={handleProfileFieldChange}
                      placeholder="Pincode"
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                      required
                    />
                    <textarea
                      name="description"
                      value={profileForm.description}
                      onChange={handleProfileFieldChange}
                      placeholder="Business / shop description"
                      rows={4}
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm md:col-span-2"
                    />

                    <p className="md:col-span-2 text-sm font-bold text-slate-800 pt-2 border-t">Business documents</p>
                    <input
                      type="text"
                      name="gstNumber"
                      value={profileForm.gstNumber}
                      onChange={handleProfileFieldChange}
                      placeholder="GST Number (optional)"
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                    />
                    <input
                      type="text"
                      name="licenseNumber"
                      value={profileForm.licenseNumber}
                      onChange={handleProfileFieldChange}
                      placeholder="Drug License Number"
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                    />
                    <input
                      type="text"
                      name="registrationNumber"
                      value={profileForm.registrationNumber}
                      onChange={handleProfileFieldChange}
                      placeholder="Business Registration Number"
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                    />
                    <input
                      type="text"
                      name="supportContact"
                      value={profileForm.supportContact}
                      onChange={handleProfileFieldChange}
                      placeholder="Customer Support Contact"
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                    />

                    <p className="md:col-span-2 text-sm font-bold text-slate-800 pt-2 border-t">Social links</p>
                    <input
                      type="url"
                      name="website"
                      value={profileForm.website}
                      onChange={handleProfileFieldChange}
                      placeholder="Website URL"
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm md:col-span-2"
                    />
                    <input
                      type="url"
                      name="facebook"
                      value={profileForm.facebook}
                      onChange={handleProfileFieldChange}
                      placeholder="Facebook URL"
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                    />
                    <input
                      type="url"
                      name="instagram"
                      value={profileForm.instagram}
                      onChange={handleProfileFieldChange}
                      placeholder="Instagram URL"
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                    />

                    <p className="md:col-span-2 text-sm font-bold text-slate-800 pt-2 border-t">Pickup address</p>
                    <input type="text" name="pickupStreet" value={profileForm.pickupStreet} onChange={handleProfileFieldChange} placeholder="Pickup street" className="border border-slate-300 rounded-lg px-4 py-2 md:col-span-2" />
                    <input type="text" name="pickupCity" value={profileForm.pickupCity} onChange={handleProfileFieldChange} placeholder="Pickup city" className="border border-slate-300 rounded-lg px-4 py-2" />
                    <input type="text" name="pickupState" value={profileForm.pickupState} onChange={handleProfileFieldChange} placeholder="Pickup state" className="border border-slate-300 rounded-lg px-4 py-2" />
                    <input type="text" name="pickupPincode" value={profileForm.pickupPincode} onChange={handleProfileFieldChange} placeholder="Pickup pincode" className="border border-slate-300 rounded-lg px-4 py-2" />
                    <input type="text" name="pickupPhone" value={profileForm.pickupPhone} onChange={handleProfileFieldChange} placeholder="Pickup phone" className="border border-slate-300 rounded-lg px-4 py-2" />

                    <p className="md:col-span-2 text-sm font-bold text-slate-800 pt-2 border-t">Warehouse address</p>
                    <input type="text" name="warehouseStreet" value={profileForm.warehouseStreet} onChange={handleProfileFieldChange} placeholder="Warehouse street" className="border border-slate-300 rounded-lg px-4 py-2 md:col-span-2" />
                    <input type="text" name="warehouseCity" value={profileForm.warehouseCity} onChange={handleProfileFieldChange} placeholder="Warehouse city" className="border border-slate-300 rounded-lg px-4 py-2" />
                    <input type="text" name="warehouseState" value={profileForm.warehouseState} onChange={handleProfileFieldChange} placeholder="Warehouse state" className="border border-slate-300 rounded-lg px-4 py-2" />
                    <input type="text" name="warehousePincode" value={profileForm.warehousePincode} onChange={handleProfileFieldChange} placeholder="Warehouse pincode" className="border border-slate-300 rounded-lg px-4 py-2" />

                    <p className="md:col-span-2 text-sm font-bold text-slate-800 pt-2 border-t">Return address</p>
                    <input type="text" name="returnStreet" value={profileForm.returnStreet} onChange={handleProfileFieldChange} placeholder="Return street" className="border border-slate-300 rounded-lg px-4 py-2 md:col-span-2" />
                    <input type="text" name="returnCity" value={profileForm.returnCity} onChange={handleProfileFieldChange} placeholder="Return city" className="border border-slate-300 rounded-lg px-4 py-2" />
                    <input type="text" name="returnState" value={profileForm.returnState} onChange={handleProfileFieldChange} placeholder="Return state" className="border border-slate-300 rounded-lg px-4 py-2" />
                    <input type="text" name="returnPincode" value={profileForm.returnPincode} onChange={handleProfileFieldChange} placeholder="Return pincode" className="border border-slate-300 rounded-lg px-4 py-2" />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={profileSaving || profileImageUploading}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white px-6 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-60"
                    >
                      {profileSaving ? 'Saving Profile...' : 'Save Profile'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileForm(buildProfileForm(vendorInfo));
                        setProfileImageUrl(vendorInfo.logo || '');
                        setProfileImagePreviewUrl('');
                        setProfileError('');
                        setProfileSuccess('');
                      }}
                      className="border border-slate-300 text-slate-700 px-6 py-2 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                    >
                      Reset
                    </button>
                  </div>

                  {profileSuccess && (
                    <p className="text-sm font-medium text-emerald-700">{profileSuccess}</p>
                  )}
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Overview Tab */}
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* Verification banner */}
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                vendorInfo.status === 'verified'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : vendorInfo.status === 'pending'
                    ? 'border-orange-200 bg-orange-50 text-orange-800'
                    : vendorInfo.status === 'suspended'
                      ? 'border-red-200 bg-red-50 text-red-800'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              <span className="font-semibold">Verification status: </span>
              <span className="capitalize">{vendorInfo.status}</span>
              {vendorInfo.status === 'rejected' && vendorInfo.rejectionReason && (
                <span> — {vendorInfo.rejectionReason}</span>
              )}
              {vendorInfo.status === 'verified' && (
                <span> · Storefront {vendorInfo.isActive === false ? 'hidden' : 'visible'}</span>
              )}
            </div>

            {statsLoading && !dashboardStats ? (
              <p className="text-slate-500 text-center py-8">Loading dashboard metrics…</p>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Revenue', value: `₹${(dashboardStats?.totalRevenue || 0).toLocaleString('en-IN')}`, color: 'text-emerald-600' },
                    { label: 'Total Sales', value: dashboardStats?.totalSales ?? 0, color: 'text-blue-600' },
                    { label: 'Total Orders', value: dashboardStats?.totalOrders ?? 0, color: 'text-indigo-600' },
                    { label: 'Wallet Balance', value: `₹${(dashboardStats?.wallet?.balance || 0).toLocaleString('en-IN')}`, color: 'text-purple-600' },
                    { label: 'Pending Orders', value: dashboardStats?.orderStatusCounts?.pending ?? 0, color: 'text-orange-600' },
                    { label: 'Processing', value: dashboardStats?.orderStatusCounts?.confirmed ?? 0, color: 'text-sky-600' },
                    { label: 'Shipped', value: dashboardStats?.orderStatusCounts?.shipped ?? 0, color: 'text-violet-600' },
                    { label: 'Delivered', value: dashboardStats?.orderStatusCounts?.delivered ?? 0, color: 'text-teal-600' },
                    { label: 'Cancelled', value: dashboardStats?.orderStatusCounts?.cancelled ?? 0, color: 'text-red-600' },
                    { label: 'Products', value: dashboardStats?.productCount ?? products.length, color: 'text-emerald-700' },
                    { label: 'Low Stock', value: dashboardStats?.lowStockCount ?? 0, color: 'text-amber-600' },
                    { label: 'Out of Stock', value: dashboardStats?.outOfStockCount ?? 0, color: 'text-rose-600' },
                    { label: 'Pending Settlement', value: `₹${(dashboardStats?.wallet?.pendingSettlement || 0).toLocaleString('en-IN')}`, color: 'text-orange-700' },
                    { label: 'Paid Settlement', value: `₹${(dashboardStats?.wallet?.paidSettlement || 0).toLocaleString('en-IN')}`, color: 'text-emerald-700' },
                    { label: 'Est. Net Earnings', value: `₹${(dashboardStats?.estimatedNetEarnings || 0).toLocaleString('en-IN')}`, color: 'text-blue-700' },
                    { label: 'Rating', value: `⭐ ${dashboardStats?.rating || vendorInfo.rating || 'N/A'}`, color: 'text-yellow-600' },
                  ].map((card) => (
                    <div key={card.label} className="bg-white p-4 rounded-lg shadow-md border border-slate-100">
                      <h3 className="text-gray-500 text-xs font-semibold uppercase tracking-wide">{card.label}</h3>
                      <p className={`text-2xl font-bold mt-2 ${card.color}`}>{card.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg shadow-md border border-slate-100 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-slate-900">Recent Orders</h3>
                      <button type="button" onClick={() => setTab('orders')} className="text-sm text-emerald-600 font-semibold">
                        View all
                      </button>
                    </div>
                    {(dashboardStats?.recentOrders || []).length === 0 ? (
                      <p className="text-sm text-slate-500 py-6 text-center">No orders yet</p>
                    ) : (
                      <div className="space-y-3">
                        {dashboardStats!.recentOrders.map((o) => (
                          <div key={o._id} className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm">
                            <div>
                              <p className="font-semibold text-slate-900">#{o._id.slice(-8).toUpperCase()}</p>
                              <p className="text-slate-500">{o.customerName} · {o.itemCount} item(s)</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-emerald-600">₹{Number(o.vendorAmount || 0).toFixed(0)}</p>
                              <p className="capitalize text-xs text-slate-500">{o.status}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-lg shadow-md border border-slate-100 p-5">
                    <h3 className="font-bold text-slate-900 mb-4">Latest Reviews</h3>
                    {(dashboardStats?.recentReviews || []).length === 0 ? (
                      <p className="text-sm text-slate-500 py-6 text-center">No reviews yet</p>
                    ) : (
                      <div className="space-y-3">
                        {dashboardStats!.recentReviews.map((r) => (
                          <div key={r._id} className="border-b border-slate-100 pb-2 text-sm">
                            <p className="font-semibold text-slate-900">
                              {'★'.repeat(Math.min(5, Number(r.rating) || 0))}{' '}
                              <span className="text-slate-600 font-normal">{r.userName}</span>
                            </p>
                            <p className="text-slate-700 mt-1">{r.title || r.comment || '—'}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {((dashboardStats?.lowStockProducts?.length || 0) > 0 ||
                  (dashboardStats?.outOfStockProducts?.length || 0) > 0) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
                    <p className="font-semibold text-amber-900 mb-2">Inventory alerts</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <p className="text-amber-800 font-medium">Low stock</p>
                        <ul className="mt-1 space-y-1 text-amber-900">
                          {(dashboardStats?.lowStockProducts || []).map((p) => (
                            <li key={p._id}>
                              {p.name} — {p.stock} left
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-rose-800 font-medium">Out of stock</p>
                        <ul className="mt-1 space-y-1 text-rose-900">
                          {(dashboardStats?.outOfStockProducts || []).map((p) => (
                            <li key={p._id}>{p.name}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Products Tab */}
        {tab === 'products' && (
          <div>
            {vendorInfo.status === 'verified' && (
              <div className="flex flex-wrap gap-3 mb-6">
                <button
                  onClick={() => setShowAddProduct(!showAddProduct)}
                  className="bg-linear-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white px-6 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all whitespace-nowrap"
                >
                  {showAddProduct ? 'Cancel' : '+ Add Product'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkUpload(!showBulkUpload);
                    if (!showBulkUpload) setBulkResult(null);
                  }}
                  className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all"
                >
                  📥 Bulk Upload
                </button>
                {products.length > 0 && (
                  <button
                    type="button"
                    onClick={exportProductsToExcel}
                    className="inline-flex items-center gap-2 border border-slate-300 bg-white text-slate-700 px-5 py-2 rounded-lg font-semibold hover:bg-slate-50 transition-all"
                  >
                    📤 Export XLSX
                  </button>
                )}
              </div>
            )}

            {vendorInfo.status === 'verified' && showBulkUpload && (
              <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6 mb-6">
                <h2 className="text-xl font-bold text-slate-900 mb-2">Bulk Upload Products</h2>
                <p className="text-sm text-slate-600 mb-4">
                  Upload multiple products at once using an Excel or CSV file. Products are submitted for admin approval.
                </p>

                <div className="flex flex-col sm:flex-row items-start gap-3 mb-4">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                    onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                    className="border border-slate-300 rounded-lg px-3 py-2 w-full sm:w-auto"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleBulkUpload}
                      disabled={!bulkFile || bulkUploading}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white px-4 py-2 rounded-lg font-semibold transition-all"
                    >
                      {bulkUploading ? 'Uploading...' : 'Upload File'}
                    </button>
                    <button
                      type="button"
                      onClick={downloadBulkUploadTemplate}
                      className="border border-emerald-300 text-emerald-800 bg-emerald-50 px-4 py-2 rounded-lg font-medium hover:bg-emerald-100"
                    >
                      Download Sample Template
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowBulkUpload(false);
                        setBulkFile(null);
                        setBulkResult(null);
                      }}
                      className="border border-slate-300 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50"
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900 mb-2">Guidelines — File type & format</p>
                  <ul className="list-disc ml-5 space-y-1 mb-3">
                    <li>
                      Accepted file types: <strong>.xlsx</strong>, <strong>.xls</strong>, or <strong>.csv</strong>
                    </li>
                    <li>Use the first sheet only. Row 1 must be column headers.</li>
                    <li>Each following row is one product.</li>
                    <li>Do not password-protect or zip the file.</li>
                    <li>After upload, products appear as <strong>Pending</strong> until admin approval.</li>
                  </ul>

                  <p className="font-semibold text-slate-900 mb-2">Required / recommended columns</p>
                  <ul className="list-disc ml-5 space-y-1">
                    <li>
                      <strong>Name</strong> (or Product Name) — required
                    </li>
                    <li>
                      <strong>Category</strong> — required (e.g. Organic Foods, Pain Relief, Skin Care)
                    </li>
                    <li>
                      <strong>Price</strong> — required (INR)
                    </li>
                    <li>
                      <strong>Product Type</strong> — recommended (Generic Medicine, Ayurveda Medicine, Homeopathy, Nutrition, Organic Products, Personal Care, Fitness, Sexual Wellness, Unani, Baby Care, Lab Tests)
                    </li>
                    <li>
                      <strong>Subcategory</strong> — optional
                    </li>
                    <li>
                      <strong>Brand</strong>, <strong>MRP</strong>, <strong>Stock</strong>, <strong>USD Price</strong>, <strong>Description</strong> — optional
                    </li>
                    <li>
                      <strong>Images</strong> — optional; Cloudinary image URL(s), comma-separated (max 4)
                    </li>
                    <li>
                      <strong>RequiresPrescription</strong> — Yes / No (optional)
                    </li>
                  </ul>
                  <p className="mt-3 text-xs text-slate-500">
                    Tip: Download the sample template, replace the sample rows with your products, save as .xlsx, then upload.
                  </p>
                </div>

                {bulkResult && (
                  <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
                    <div className="font-semibold text-gray-900 mb-2">
                      Upload Result: {bulkResult.successful} successful, {bulkResult.failed} failed
                    </div>
                    {bulkResult.failed > 0 && bulkResult.errors && (
                      <div className="mt-3">
                        <div className="font-medium text-red-700 mb-2">Errors:</div>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {bulkResult.errors.slice(0, 10).map((err: any, idx: number) => (
                            <div key={idx} className="bg-red-50 border border-red-200 rounded p-2 text-sm">
                              <div className="font-semibold text-red-800">Row {err.row}:</div>
                              <div className="text-red-700">{err.error}</div>
                              {err.data?.name && (
                                <div className="text-gray-600 text-xs mt-1">Product: {err.data.name}</div>
                              )}
                            </div>
                          ))}
                          {bulkResult.failed > 10 && (
                            <div className="text-gray-600 text-sm">
                              ... and {bulkResult.failed - 10} more errors
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {showAddProduct && (
              <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6 mb-6">
                <h2 className="text-xl font-bold text-slate-900 mb-6">Add New Product</h2>
                <form onSubmit={handleAddProduct} className="space-y-4">
                  <div className="mb-6 p-4 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50">
                    <label className="block text-sm font-semibold text-slate-700 mb-3">Medicine Image</label>

                    {imageUrl && (
                      <div className="mb-4 p-3 bg-white border border-slate-200 rounded-lg">
                        <p className="text-xs text-slate-600 mb-2 font-medium">Current Image:</p>
                        <div className="flex gap-3 items-start">
                          <img
                            src={imageUrl}
                            alt="Current"
                            className="h-24 w-24 object-cover rounded-lg border border-slate-300"
                          />
                          <div className="flex-1">
                            <p className="text-xs text-slate-600 truncate mb-2">URL: {imageUrl}</p>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!confirm('Delete this image? You can upload a new one.')) return;
                                const publicId = extractPublicIdFromUrl(imageUrl);
                                if (!publicId) {
                                  alert('Could not extract image ID');
                                  return;
                                }
                                try {
                                  const res = await fetch('/api/medicines/delete-image', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ publicId }),
                                  });
                                  if (res.ok) {
                                    setImageUrl('');
                                    setSelectedProductImage(null);
                                    alert('✅ Image deleted successfully');
                                  } else {
                                    alert('❌ Failed to delete image');
                                  }
                                } catch {
                                  alert('❌ Error deleting image');
                                }
                              }}
                              disabled={imageUploading}
                              className="text-red-600 hover:text-red-800 text-xs font-semibold disabled:opacity-50"
                            >
                              🗑️ Delete Image
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {previewUrl && (
                      <div className="mb-3">
                        <p className="text-xs text-slate-600 mb-2">Preview:</p>
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="h-32 w-32 object-cover rounded-lg border border-slate-300"
                        />
                      </div>
                    )}

                    {selectedProductImage && (
                      <button
                        type="button"
                        onClick={() => setSelectedProductImage(null)}
                        className="mb-3 text-red-600 hover:text-red-800 text-xs font-semibold"
                      >
                        Delete Selected Image
                      </button>
                    )}

                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        setSelectedProductImage(file || null);
                        if (file) {
                          const result = await uploadImage(file);
                          if (result?.success && result.imageUrl) {
                            setImageUrl(result.imageUrl);
                          }
                        }
                      }}
                      disabled={imageUploading}
                      className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                    />

                    {uploadError && (
                      <p className="mt-2 text-red-600 text-sm font-medium">❌ {uploadError}</p>
                    )}

                    {imageUploading && (
                      <p className="mt-2 text-blue-600 text-sm font-medium">⏳ Uploading image...</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <input
                      type="text"
                      placeholder="Product Name *"
                      value={newProduct.name}
                      onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                      required
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                    />
                    <select
                      value={newProduct.productType}
                      onChange={(e) => {
                        const productType = e.target.value as VendorProductType;
                        setNewProduct({
                          ...newProduct,
                          productType,
                          category: '',
                          categoryPath: [],
                          extraCategoryPaths: [],
                          subcategory: '',
                        });
                      }}
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                    >
                      {productTypeOptions.map((productType) => (
                        <option key={productType} value={productType}>{productType}</option>
                      ))}
                    </select>
                    {(() => {
                      const productTypeName = newProduct.productType || 'Generic Medicine';
                      const hierarchyLevels: string[][] = [];
                      let currentLevelName: string | null = productTypeName;

                      for (let i = 0; i < 10; i++) {
                        let options = getNodeChildren(currentLevelName, categoryTree);
                        // Level 0: always merge essential categories from config map
                        if (i === 0) {
                          const fallback = activeVendorCategoryMap[productTypeName] || [];
                          options = Array.from(new Set([...(options || []), ...fallback]));
                        }
                        if (!options || options.length === 0) break;
                        hierarchyLevels.push(options);

                        if (i < newProduct.categoryPath.length) {
                          currentLevelName = newProduct.categoryPath[i];
                        } else {
                          break;
                        }
                      }

                      if (hierarchyLevels.length === 0) {
                        const staticLevels: string[][] = [];
                        const firstLevel = (activeVendorCategoryMap[productTypeName] || []);
                        if (firstLevel.length > 0) staticLevels.push(firstLevel);
                        if (newProduct.categoryPath[0]) {
                          const secondLevel = getSubcategoryOptionsForType(productTypeName, newProduct.categoryPath[0]);
                          if (secondLevel.length > 0) staticLevels.push(secondLevel);
                        }
                        hierarchyLevels.push(...staticLevels);
                      }

                      return (
                        <>
                          {hierarchyLevels.map((options, levelIdx) => (
                            <select
                              key={`hierarchy-${levelIdx}`}
                              value={newProduct.categoryPath[levelIdx] || ''}
                              onChange={(e) => {
                                const newPath = newProduct.categoryPath.slice(0, levelIdx);
                                if (e.target.value) newPath.push(e.target.value);
                                setNewProduct({
                                  ...newProduct,
                                  categoryPath: newPath,
                                  category: newPath[0] || '',
                                  subcategory: newPath[1] || '',
                                });
                              }}
                              className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                            >
                              <option value="">{levelIdx === 0 ? 'Select Category' : `Level ${levelIdx + 1}`}</option>
                              {options.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ))}
                        </>
                      );
                    })()}
                    <div className="md:col-span-3 space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                        <div>
                          <label className="text-sm font-semibold text-slate-800">Additional Category Paths (Optional)</label>
                          <p className="text-xs text-slate-500">Add one or more extra product type &gt; category &gt; subcategory &gt; next category paths without changing the main selector above.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewProduct({ ...newProduct, extraCategoryPaths: [...(newProduct.extraCategoryPaths || []), ['', '', '', '']] })}
                          className="text-emerald-700 hover:text-emerald-900 text-sm font-medium"
                        >
                          + Add Path
                        </button>
                      </div>
                      {(newProduct.extraCategoryPaths || []).map((path, idx) => (
                        <div key={`extra-category-${idx}`} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                          {[0, 1, 2, 3].map((levelIdx) => {
                            const options = getExtraPathOptions(newProduct.productType || 'Generic Medicine', path, levelIdx);
                            return (
                              <select
                                key={`extra-path-${idx}-${levelIdx}`}
                                value={path[levelIdx] || ''}
                                onChange={(e) => {
                                  const updated = [...(newProduct.extraCategoryPaths || [])];
                                  const nextPath = path.slice(0, levelIdx);
                                  if (e.target.value) nextPath[levelIdx] = e.target.value;
                                  updated[idx] = nextPath;
                                  setNewProduct({ ...newProduct, extraCategoryPaths: updated });
                                }}
                                className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                              >
                                <option value="">{levelIdx === 0 ? 'Extra Product Type' : levelIdx === 1 ? 'Extra Category' : levelIdx === 2 ? 'Extra Subcategory' : 'Extra Next Category'}</option>
                                {options.map((opt) => (
                                  <option key={opt} value={opt}>{levelIdx === 0 ? formatProductTypeLabel(opt) : opt}</option>
                                ))}
                              </select>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...(newProduct.extraCategoryPaths || [])];
                              updated.splice(idx, 1);
                              setNewProduct({ ...newProduct, extraCategoryPaths: updated });
                            }}
                            className="text-sm text-red-600 hover:text-red-800 font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="md:col-span-3 space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold text-slate-800">Diseases / Conditions (Optional)</label>
                        <button
                          type="button"
                          onClick={() => setNewProduct({ ...newProduct, diseasePaths: [...(newProduct.diseasePaths || []), ['', '']] })}
                          className="text-emerald-700 hover:text-emerald-900 text-sm font-medium"
                        >
                          + Add Disease
                        </button>
                      </div>
                      {(newProduct.diseasePaths || []).map((path, idx) => (
                        <div key={`disease-${idx}`} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                          <select
                            value={path[0] || ''}
                            onChange={(e) => {
                              const updated = [...(newProduct.diseasePaths || [])];
                              updated[idx] = [e.target.value, ''];
                              setNewProduct({ ...newProduct, diseasePaths: updated });
                            }}
                            className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                          >
                            <option value="">Select Disease Category</option>
                            {Object.keys(activeDiseaseCategoryMap).map((category) => (
                              <option key={category} value={category}>{category}</option>
                            ))}
                          </select>
                          <select
                            value={path[1] || ''}
                            onChange={(e) => {
                              const updated = [...(newProduct.diseasePaths || [])];
                              updated[idx] = [path[0] || '', e.target.value];
                              setNewProduct({ ...newProduct, diseasePaths: updated });
                            }}
                            className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                          >
                            <option value="">Select Disease Subcategory</option>
                            {(activeDiseaseCategoryMap[path[0]] || []).map((sub) => (
                              <option key={sub} value={sub}>{sub}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...(newProduct.diseasePaths || [])];
                              updated.splice(idx, 1);
                              setNewProduct({ ...newProduct, diseasePaths: updated });
                            }}
                            className="text-sm text-red-600 hover:text-red-800 font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                    <input
                      type="text"
                      placeholder="Brand"
                      value={newProduct.brand}
                      onChange={(e) => setNewProduct({ ...newProduct, brand: e.target.value })}
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                    />
                    <input
                      type="number"
                      placeholder="Price ₹ *"
                      value={newProduct.price}
                      onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                      required
                      step="0.01"
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                    />
                    <input
                      type="number"
                      placeholder="Dollar Price USD *"
                      value={newProduct.usdPrice}
                      onChange={(e) => setNewProduct({ ...newProduct, usdPrice: e.target.value })}
                      required
                      step="0.01"
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                    />
                    <input
                      type="number"
                      placeholder="MRP ₹"
                      value={newProduct.mrp}
                      onChange={(e) => setNewProduct({ ...newProduct, mrp: e.target.value })}
                      step="0.01"
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                    />
                    <input
                      type="number"
                      placeholder="Stock Qty"
                      value={newProduct.stock}
                      onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                    />
                    <select
                      value={newProduct.potency}
                      onChange={(e) => setNewProduct({ ...newProduct, potency: e.target.value })}
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                    >
                      <option value="">Potency (Optional)</option>
                      {POTENCY_OPTIONS.map((potency) => (
                        <option key={potency} value={potency}>{potency}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Quantity (Optional)"
                      value={newProduct.quantity}
                      onChange={(e) => setNewProduct({ ...newProduct, quantity: e.target.value })}
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                    />
                    <select
                      value={newProduct.quantityUnit}
                      onChange={(e) => setNewProduct({ ...newProduct, quantityUnit: e.target.value })}
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                    >
                      {QUANTITY_UNIT_OPTIONS.map((unit) => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Benefit tag (e.g. Immunity)"
                      value={newProduct.benefit}
                      onChange={(e) => setNewProduct({ ...newProduct, benefit: e.target.value })}
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                    />
                    <textarea
                      placeholder="Short Description (optional - displays below product name)"
                      value={newProduct.shortDescription}
                      onChange={(e) => setNewProduct({ ...newProduct, shortDescription: e.target.value })}
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm md:col-span-3"
                      rows={1}
                    />
                    <div className="md:col-span-3">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Description (with formatting)</label>
                      <RichTextEditor
                        value={newProduct.description}
                        onChange={(value) => setNewProduct({ ...newProduct, description: value })}
                        placeholder="Enter product description with formatting..."
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Safety Information (with formatting)</label>
                      <RichTextEditor
                        value={newProduct.safetyInformation || ''}
                        onChange={(value) => setNewProduct({ ...newProduct, safetyInformation: value })}
                        placeholder="Enter safety information with bullet points and formatting..."
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Specifications (with formatting)</label>
                      <RichTextEditor
                        value={newProduct.specifications || ''}
                        onChange={(value) => setNewProduct({ ...newProduct, specifications: value })}
                        placeholder="Enter specifications with bullet points and formatting..."
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer mb-6 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={newProduct.requiresPrescription}
                      onChange={(e) => setNewProduct({ ...newProduct, requiresPrescription: e.target.checked })}
                      className="w-5 h-5 rounded border-slate-300 accent-emerald-600"
                    />
                    <span className="text-sm font-medium text-slate-700">Requires Prescription (Rx)</span>
                  </label>


                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={imageUploading}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white px-6 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-60"
                    >
                      {imageUploading ? 'Uploading Image...' : 'Add Product'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddProduct(false);
                        setSelectedProductImage(null);
                        setImageUrl('');
                      }}
                      className="border border-slate-300 text-slate-700 px-6 py-2 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {showEditProduct && (
              <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6 mb-6">
                <h2 className="text-xl font-bold text-slate-900 mb-6">Edit Product</h2>
                <form onSubmit={handleUpdateProduct} className="space-y-4">
                  <div className="mb-6 p-4 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50">
                    <label className="block text-sm font-semibold text-slate-700 mb-3">Medicine Image</label>
                    {(editImagePreviewUrl || editProduct.image) && (
                      <div className="mb-3 p-3 bg-white border border-slate-200 rounded-lg">
                        <p className="text-xs text-slate-600 mb-2 font-medium">Current Image:</p>
                        <div className="flex items-center gap-3">
                          <img
                            src={editImagePreviewUrl || editProduct.image}
                            alt="Current product"
                            className="h-24 w-24 rounded-lg object-cover border border-slate-300"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm('Delete current image? You can upload a new one.')) return;

                              const currentImageUrl = editProduct.image || '';
                              if (currentImageUrl && isCloudinaryImageUrl(currentImageUrl)) {
                                const publicId = extractPublicIdFromUrl(currentImageUrl);
                                if (!publicId) {
                                  alert('Could not extract image ID');
                                  return;
                                }
                                try {
                                  const res = await fetch('/api/medicines/delete-image', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ publicId }),
                                  });
                                  if (!res.ok) {
                                    alert('Failed to delete image');
                                    return;
                                  }
                                } catch {
                                  alert('Error deleting image');
                                  return;
                                }
                              }

                              setEditProduct({ ...editProduct, image: '' });
                              setSelectedEditProductImage(null);
                              setEditImagePreviewUrl('');
                            }}
                            className="text-red-600 hover:text-red-800 text-xs font-semibold"
                          >
                            Delete Image
                          </button>
                        </div>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setSelectedEditProductImage(file);
                        if (file) {
                          const preview = URL.createObjectURL(file);
                          setEditImagePreviewUrl(preview);
                        }
                      }}
                      className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <input
                      type="text"
                      placeholder="Product Name *"
                      value={editProduct.name}
                      onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })}
                      required
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                    />
                    <select
                      value={editProduct.productType}
                      onChange={(e) => {
                        const productType = e.target.value as VendorProductType;
                        setEditProduct({
                          ...editProduct,
                          productType,
                          category: '',
                          categoryPath: [],
                          extraCategoryPaths: [],
                          subcategory: '',
                        });
                      }}
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                    >
                      {productTypeOptions.map((productType) => (
                        <option key={productType} value={productType}>{productType}</option>
                      ))}
                    </select>
                    {(() => {
                      const productTypeName = editProduct.productType || 'Generic Medicine';
                      const hierarchyLevels: string[][] = [];
                      let currentLevelName: string | null = productTypeName;

                      for (let i = 0; i < 10; i++) {
                        // For level 1 (subcategories/brands), ALWAYS use getSubcategoryOptionsForType
                        // to ensure correct product type's subcategories are returned
                        if (i === 1 && editProduct.categoryPath[0]) {
                          const options = getSubcategoryOptionsForType(productTypeName, editProduct.categoryPath[0]);
                          if (options && options.length > 0) {
                            hierarchyLevels.push(options);
                            if (i < editProduct.categoryPath.length) {
                              currentLevelName = editProduct.categoryPath[i];
                            } else {
                              break;
                            }
                            continue;
                          }
                        }

                        let options = getNodeChildren(currentLevelName, categoryTree);
                        if (i === 0) {
                          const fallback = activeVendorCategoryMap[productTypeName] || [];
                          options = Array.from(new Set([...(options || []), ...fallback]));
                        }
                        if (!options || options.length === 0) break;
                        hierarchyLevels.push(options);

                        if (i < editProduct.categoryPath.length) {
                          currentLevelName = editProduct.categoryPath[i];
                        } else {
                          break;
                        }
                      }

                      if (hierarchyLevels.length === 0) {
                        const staticLevels: string[][] = [];
                        const firstLevel = (activeVendorCategoryMap[productTypeName] || []);
                        if (firstLevel.length > 0) staticLevels.push(firstLevel);
                        if (editProduct.categoryPath[0]) {
                          const secondLevel = getSubcategoryOptionsForType(productTypeName, editProduct.categoryPath[0]);
                          if (secondLevel.length > 0) staticLevels.push(secondLevel);
                        }
                        hierarchyLevels.push(...staticLevels);
                      }

                      return (
                        <>
                          {hierarchyLevels.map((options, levelIdx) => (
                            <select
                              key={`hierarchy-edit-${levelIdx}`}
                              value={editProduct.categoryPath[levelIdx] || ''}
                              onChange={(e) => {
                                const newPath = editProduct.categoryPath.slice(0, levelIdx);
                                if (e.target.value) newPath.push(e.target.value);
                                setEditProduct({
                                  ...editProduct,
                                  categoryPath: newPath,
                                  category: newPath[0] || '',
                                  subcategory: newPath[1] || '',
                                });
                              }}
                              className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                            >
                              <option value="">{levelIdx === 0 ? 'Select Category' : `Level ${levelIdx + 1}`}</option>
                              {options.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ))}
                        </>
                      );
                    })()}
                    <div className="md:col-span-3 space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                        <div>
                          <label className="text-sm font-semibold text-slate-800">Additional Category Paths (Optional)</label>
                          <p className="text-xs text-slate-500">Add one or more extra product type &gt; category &gt; subcategory &gt; next category paths without changing the main selector above.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditProduct({ ...editProduct, extraCategoryPaths: [...(editProduct.extraCategoryPaths || []), ['', '', '', '']] })}
                          className="text-emerald-700 hover:text-emerald-900 text-sm font-medium"
                        >
                          + Add Path
                        </button>
                      </div>
                      {(editProduct.extraCategoryPaths || []).map((path, idx) => (
                        <div key={`extra-category-edit-${idx}`} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                          {[0, 1, 2, 3].map((levelIdx) => {
                            const options = getExtraPathOptions(editProduct.productType || 'Generic Medicine', path, levelIdx);
                            return (
                              <select
                                key={`extra-path-edit-${idx}-${levelIdx}`}
                                value={path[levelIdx] || ''}
                                onChange={(e) => {
                                  const updated = [...(editProduct.extraCategoryPaths || [])];
                                  const nextPath = path.slice(0, levelIdx);
                                  if (e.target.value) nextPath[levelIdx] = e.target.value;
                                  updated[idx] = nextPath;
                                  setEditProduct({ ...editProduct, extraCategoryPaths: updated });
                                }}
                                className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                              >
                                <option value="">{levelIdx === 0 ? 'Extra Product Type' : levelIdx === 1 ? 'Extra Category' : levelIdx === 2 ? 'Extra Subcategory' : 'Extra Next Category'}</option>
                                {options.map((opt) => (
                                  <option key={opt} value={opt}>{levelIdx === 0 ? formatProductTypeLabel(opt) : opt}</option>
                                ))}
                              </select>
                            );
                          })}
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...(editProduct.extraCategoryPaths || [])];
                              updated.splice(idx, 1);
                              setEditProduct({ ...editProduct, extraCategoryPaths: updated });
                            }}
                            className="text-sm text-red-600 hover:text-red-800 font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="md:col-span-3 space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold text-slate-800">Diseases / Conditions (Optional)</label>
                        <button
                          type="button"
                          onClick={() => setEditProduct({ ...editProduct, diseasePaths: [...(editProduct.diseasePaths || []), ['', '']] })}
                          className="text-emerald-700 hover:text-emerald-900 text-sm font-medium"
                        >
                          + Add Disease
                        </button>
                      </div>
                      {(editProduct.diseasePaths || []).map((path, idx) => (
                        <div key={`edit-disease-${idx}`} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                          <select
                            value={path[0] || ''}
                            onChange={(e) => {
                              const updated = [...(editProduct.diseasePaths || [])];
                              updated[idx] = [e.target.value, ''];
                              setEditProduct({ ...editProduct, diseasePaths: updated });
                            }}
                            className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                          >
                            <option value="">Select Disease Category</option>
                            {Object.keys(activeDiseaseCategoryMap).map((category) => (
                              <option key={category} value={category}>{category}</option>
                            ))}
                          </select>
                          <select
                            value={path[1] || ''}
                            onChange={(e) => {
                              const updated = [...(editProduct.diseasePaths || [])];
                              updated[idx] = [path[0] || '', e.target.value];
                              setEditProduct({ ...editProduct, diseasePaths: updated });
                            }}
                            className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                          >
                            <option value="">Select Disease Subcategory</option>
                            {(activeDiseaseCategoryMap[path[0]] || []).map((sub) => (
                              <option key={sub} value={sub}>{sub}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...(editProduct.diseasePaths || [])];
                              updated.splice(idx, 1);
                              setEditProduct({ ...editProduct, diseasePaths: updated });
                            }}
                            className="text-sm text-red-600 hover:text-red-800 font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                    <input
                      type="text"
                      placeholder="Brand"
                      value={editProduct.brand}
                      onChange={(e) => setEditProduct({ ...editProduct, brand: e.target.value })}
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                    />
                    <input
                      type="number"
                      placeholder="Price ₹ *"
                      value={editProduct.price}
                      onChange={(e) => setEditProduct({ ...editProduct, price: e.target.value })}
                      required
                      step="0.01"
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                    />
                    <input
                      type="number"
                      placeholder="Dollar Price USD *"
                      value={editProduct.usdPrice}
                      onChange={(e) => setEditProduct({ ...editProduct, usdPrice: e.target.value })}
                      required
                      step="0.01"
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                    />
                    <input
                      type="number"
                      placeholder="MRP ₹"
                      value={editProduct.mrp}
                      onChange={(e) => setEditProduct({ ...editProduct, mrp: e.target.value })}
                      step="0.01"
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                    />
                    <input
                      type="number"
                      placeholder="Stock Qty"
                      value={editProduct.stock}
                      onChange={(e) => setEditProduct({ ...editProduct, stock: e.target.value })}
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                    />
                    <select
                      value={editProduct.potency}
                      onChange={(e) => setEditProduct({ ...editProduct, potency: e.target.value })}
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                    >
                      <option value="">Potency (Optional)</option>
                      {POTENCY_OPTIONS.map((potency) => (
                        <option key={potency} value={potency}>{potency}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Quantity (Optional)"
                      value={editProduct.quantity}
                      onChange={(e) => setEditProduct({ ...editProduct, quantity: e.target.value })}
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                    />
                    <select
                      value={editProduct.quantityUnit}
                      onChange={(e) => setEditProduct({ ...editProduct, quantityUnit: e.target.value })}
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                    >
                      {QUANTITY_UNIT_OPTIONS.map((unit) => (
                        <option key={unit} value={unit}>{unit}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Benefit tag (e.g. Immunity)"
                      value={editProduct.benefit}
                      onChange={(e) => setEditProduct({ ...editProduct, benefit: e.target.value })}
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
                    />
                    <textarea
                      placeholder="Short Description (optional - displays below product name)"
                      value={editProduct.shortDescription}
                      onChange={(e) => setEditProduct({ ...editProduct, shortDescription: e.target.value })}
                      className="border border-slate-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-500 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm md:col-span-3"
                      rows={1}
                    />
                    <div className="md:col-span-3">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Description (with formatting)</label>
                      <RichTextEditor
                        value={editProduct.description}
                        onChange={(value) => setEditProduct({ ...editProduct, description: value })}
                        placeholder="Enter product description with formatting..."
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Safety Information (with formatting)</label>
                      <RichTextEditor
                        value={editProduct.safetyInformation || ''}
                        onChange={(value) => setEditProduct({ ...editProduct, safetyInformation: value })}
                        placeholder="Enter safety information with bullet points and formatting..."
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Specifications (with formatting)</label>
                      <RichTextEditor
                        value={editProduct.specifications || ''}
                        onChange={(value) => setEditProduct({ ...editProduct, specifications: value })}
                        placeholder="Enter specifications with bullet points and formatting..."
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer mb-6 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={editProduct.requiresPrescription}
                      onChange={(e) => setEditProduct({ ...editProduct, requiresPrescription: e.target.checked })}
                      className="w-5 h-5 rounded border-slate-300 accent-emerald-600"
                    />
                    <span className="text-sm font-medium text-slate-700">Requires Prescription (Rx)</span>
                  </label>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={imageUploading}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white px-6 py-2 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-60"
                    >
                      {imageUploading ? 'Uploading Image...' : 'Update Product'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditProduct(false);
                        setEditingProductId(null);
                        setSelectedEditProductImage(null);
                        setEditImagePreviewUrl('');
                      }}
                      className="border border-slate-300 text-slate-700 px-6 py-2 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              {products.length === 0 ? (
                <p className="p-6 text-center text-gray-500">
                  No products yet. Use <strong>+ Add Product</strong> or <strong>Bulk Upload</strong> to add products.
                </p>
              ) : (
                <>
                  <table className="w-full">
                    <thead className="bg-emerald-600">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-white">Product</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-white">Type</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-white">Approval</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-white">Price</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-white">Stock</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold text-white">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((product) => (
                        <tr key={String(product._id)} className="border-b hover:bg-gray-50">
                          <td className="px-6 py-4 text-gray-900">
                            <div className="flex items-center gap-3">
                              {product.image ? (
                                <img
                                  src={product.image}
                                  alt={product.name}
                                  className="w-12 h-12 rounded-md object-cover border border-gray-200"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center">
                                  💊
                                </div>
                              )}
                              <span className="text-gray-900">{product.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">{product.productType || 'Generic Medicine'}</td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              product.approvalStatus === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : product.approvalStatus === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {product.approvalStatus || 'pending'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-900">₹{product.price}</td>
                          <td className="px-6 py-4 text-gray-900">{product.stock}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => handleEditProduct(product)}
                                className="text-blue-600 hover:text-blue-800 font-semibold"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(String(product._id))}
                                className="text-red-600 hover:text-red-800 font-semibold"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {tab === 'orders' && (
          <div>
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h3 className="text-lg font-semibold mb-4">Your Orders ({vendorOrders.length})</h3>
              
              {vendorOrders.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No orders yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-semibold">Order ID</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold">Customer</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold">Amount</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold">Date</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                        <th className="px-6 py-3 text-left text-sm font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendorOrders.map((order, idx) => (
                        <tr key={idx} className="border-b hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium">#{getOrderId(order)?.substring(0, 8)}</td>
                          <td className="px-6 py-4 text-sm">
                            <div>{order.customerName || 'N/A'}</div>
                            <div className="text-xs text-gray-500">{order.customerEmail || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium">₹{(order.totalAmount || 0).toFixed(2)}</td>
                          <td className="px-6 py-4 text-sm">
                            {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={String(order.status || 'pending').toLowerCase()}
                              onChange={(e) => updateOrderStatus(getOrderId(order), e.target.value)}
                              className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer ${getOrderStatusColor(
                                order.status || 'pending'
                              )}`}
                            >
                              {ORDER_STATUS_OPTIONS.map((statusOption) => (
                                <option key={statusOption} value={statusOption}>
                                  {statusOption}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <button
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowOrderModal(true);
                              }}
                              className="text-emerald-600 hover:text-emerald-900 font-semibold"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {tab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-lg shadow-md border border-slate-100">
                <p className="text-xs uppercase text-slate-500 font-semibold">Gross Revenue</p>
                <p className="text-2xl font-bold text-emerald-600 mt-1">
                  ₹{(dashboardStats?.totalRevenue || 0).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="bg-white p-5 rounded-lg shadow-md border border-slate-100">
                <p className="text-xs uppercase text-slate-500 font-semibold">Platform Commission ({dashboardStats?.commissionPercentage ?? 10}%)</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">
                  ₹{(dashboardStats?.estimatedCommission || 0).toLocaleString('en-IN')}
                </p>
              </div>
              <div className="bg-white p-5 rounded-lg shadow-md border border-slate-100">
                <p className="text-xs uppercase text-slate-500 font-semibold">Est. Net Earnings</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">
                  ₹{(dashboardStats?.estimatedNetEarnings || 0).toLocaleString('en-IN')}
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md border border-slate-100">
              <h3 className="font-bold text-slate-900 mb-4">Monthly Earnings (last 6 months)</h3>
              {(dashboardStats?.monthlyEarnings || []).length === 0 ? (
                <p className="text-slate-500 text-center py-8">No sales data yet</p>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    const maxSales = Math.max(
                      ...(dashboardStats?.monthlyEarnings || []).map((m) => m.sales),
                      1
                    );
                    return (dashboardStats?.monthlyEarnings || []).map((m) => (
                      <div key={m.month} className="flex items-center gap-3 text-sm">
                        <span className="w-20 text-slate-600 font-medium">{m.month}</span>
                        <div className="flex-1 h-8 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full flex items-center justify-end pr-2"
                            style={{ width: `${Math.max((m.sales / maxSales) * 100, m.sales > 0 ? 8 : 0)}%` }}
                          >
                            {m.sales > 0 && (
                              <span className="text-xs font-semibold text-white">₹{m.sales.toLocaleString('en-IN')}</span>
                            )}
                          </div>
                        </div>
                        <span className="w-16 text-right text-slate-500">{m.orders} ord</span>
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Order Details Modal */}
        {showOrderModal && selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-3xl w-full p-6 max-h-96 overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Order Details</h2>
                <button
                  onClick={() => setShowOrderModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ✕
                </button>
              </div>

              {/* Order Info */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <p className="text-sm text-gray-600">Order ID</p>
                  <p className="text-lg font-semibold text-gray-900">#{selectedOrder._id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Order Date</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Customer Details */}
              <div className="border-t border-b py-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Name</p>
                    <p className="font-medium text-gray-900">{selectedOrder.customerName || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="font-medium text-gray-900">{selectedOrder.customerEmail || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Phone</p>
                    <p className="font-medium text-gray-900">{selectedOrder.customerPhone || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Delivery Address */}
              <div className="border-t border-b py-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery Address</h3>
                {selectedOrder.deliveryAddress ? (
                  <div className="text-gray-700 text-sm space-y-1">
                    <p><strong>Full Name:</strong> {selectedOrder.deliveryAddress.fullName || 'N/A'}</p>
                    <p><strong>Phone:</strong> {selectedOrder.deliveryAddress.phone || 'N/A'}</p>
                    <p><strong>Address:</strong> {selectedOrder.deliveryAddress.addressLine1 || 'N/A'}</p>
                    {selectedOrder.deliveryAddress.addressLine2 && <p><strong>Address 2:</strong> {selectedOrder.deliveryAddress.addressLine2}</p>}
                    <p><strong>City:</strong> {selectedOrder.deliveryAddress.city || 'N/A'}</p>
                    <p><strong>State:</strong> {selectedOrder.deliveryAddress.state || 'N/A'}</p>
                    <p><strong>Pincode:</strong> {selectedOrder.deliveryAddress.pincode || 'N/A'}</p>
                    <p><strong>Country:</strong> {selectedOrder.deliveryAddress.country || 'N/A'}</p>
                  </div>
                ) : (
                  <p className="text-gray-500">No address provided</p>
                )}
              </div>

              {/* Order Items */}
              <div className="border-t border-b py-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Items</h3>
                <div className="space-y-3">
                  {selectedOrder.items && selectedOrder.items.length > 0 ? (
                    selectedOrder.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm border-b pb-2">
                        <div>
                          <p className="font-medium text-gray-900">{item.name}</p>
                          <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                        </div>
                        <p className="font-medium text-gray-900">₹{(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm">No items in order</p>
                  )}
                </div>
              </div>

              {/* Order Summary */}
              <div className="border-t pt-4 mb-6">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">₹{(selectedOrder.subtotal || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total:</span>
                    <span className="font-bold text-lg">₹{(selectedOrder.totalAmount || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Payment & Status Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-600">Payment Method</p>
                  <p className="font-medium text-gray-900">{selectedOrder.paymentMethod || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Order Status</p>
                  <select
                    value={String(selectedOrder.status || 'pending').toLowerCase()}
                    onChange={(e) => updateOrderStatus(getOrderId(selectedOrder), e.target.value)}
                    className={`font-medium px-3 py-1 rounded-full w-fit text-sm cursor-pointer ${getOrderStatusColor(
                      selectedOrder.status || 'pending'
                    )}`}
                  >
                    {ORDER_STATUS_OPTIONS.map((statusOption) => (
                      <option key={statusOption} value={statusOption}>
                        {statusOption}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setShowOrderModal(false)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

