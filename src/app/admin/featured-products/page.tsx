'use client';

import { useState, useEffect, useCallback } from 'react';

interface FeaturedProduct {
  _id: string;
  brandName: string;
  category?: string;
  subcategory?: string;
  imageUrl: string;
  cloudinaryPublicId?: string;
  cardBgColor?: string;
  isActive: boolean;
  createdAt: string;
}

const FEATURED_CATEGORY_MAP = {
  'Generic Medicine': [
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
    'Sun Pharma', 'Cipla', 'Lupin', 'Pfizer', 'Abbott', 'Mankind Pharma', 'Dr. Reddys', 'Glenmark Pharma',
    'Tablets & Capsules', 'Syrups & Suspensions', 'Creams & Ointments', 'Inhalers & Respules', 'Oral Drops', 'Eye & Ear Drops', 'Nasal Drops & Spray', 'Injections & Infusions',
  ],
  'Ayurveda Medicine': [
    'Himalaya', 'Organic India', 'Baidyanath', 'Dabur', 'Zandu', 'Charak', 'Aimil',
    'Ras & Sindoor', 'Bhasm & Pishti', 'Vati, Gutika & Guggulu', 'Asava Arishta & Kadha', 'Loha & Mandur', 'Churan, Powder, Avaleha & Pak', 'Tailam & Ghrita',
    'Chyawanprash', 'Honey', 'Digestives', 'Herbal & Vegetable Juice',
  ],
  Homeopathy: [
    'SBL', 'Dr. Reckeweg', 'Willmar Schwabe', 'Adel Pekana', 'Schwabe India', 'Bjain', 'R S Bhargava', 'Baksons', 'REPL', 'New Life',
    '3X', '6X', '3 CH', '6 CH', '12 CH', '30 CH', '200 CH', '1000 CH', '10M CH', '50M CH', 'CM CH',
    'Mother Tinctures', 'Biochemic', 'Triturations', 'Bio Combination', 'Bach Flower', 'Homeopathy Kits', 'Milleimal LM Potency',
    'Hair Care', 'Skin Care', 'Oral Care',
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
    'Proteins', 'Fat Burner', 'Weight Gainers', 'Pre Post Workout', 'Aminos', 'Creatines',
    'Spreads, Sugar & Honey', 'Oils', 'Health Drinks', 'Healthy Snacks & Bars', 'Sugar Free', 'Murabba', 'Edible Seeds',
  ],
  'Organic Products': [
    'Organic Foods', 'Coffee & Tea', 'Ghee', 'Atta/Flour',
  ],
  'Personal Care': [
    'Essential Oils', 'Face', 'Body', 'Foot Care', 'Sanitizers & Hand Wash',
    'Shampoo & Conditioners', 'Hair Oils & Creams', 'Hair Serum & Mask', 'Hair Color & Dyes', 'Henna Mehndi',
    'Beard Oils and Wax', 'Shaving Cream & Gels', 'Men Wellness',
    'Shower Gel & Hand Wash', 'Soaps', 'Talcs & Deos',
    'Toothpaste', 'Gums Care',
    'Intimate Care', 'Pregnancy & Maternity Care',
  ],
  Fitness: [
    'Shoulder Support', 'Elbow Support', 'Forearm Support', 'Wrist Support', 'Chest Support', 'Cervical Support', 'Back Support', 'Abdominal Support', 'Thigh Support', 'Knee Support', 'Calf Support', 'Ankle Support', 'Finger Splint', 'Compression Stockings', 'Insoles & Heel Cups',
    'Weighing Scales', 'BP Monitors', 'Thermometer', 'Respiratory Care', 'Activity Monitor', 'Hot and Cold Pads & Bottles',
    'Exercisers', 'Weights', 'Stethoscopes', 'Protective Gears', 'Hospital Beds',
    'Walking Sticks', 'Massagers', 'Disability Aids',
  ],
  'Sexual Wellness': [
    'Sexual Supplements', 'Condoms',
  ],
  Consultation: [
    'Homeo Treatment', 'Ayurveda Treatment', 'Unani Treatment', 'Diet Counselling',
  ],
  Unani: [
    'Habbe & Qurs', 'Majun & Jawarish', 'Safoof, Labub & Kushta', 'Sharbat, Sirka & Arq', 'Lauq & Saoot', 'Khamira & Itrifal', 'Roghan & Oils',
    'Hamdard', 'New Shama', 'Dehlvi', 'Rex',
  ],
  'Baby Care': [
    'Tonics & Supplements', 'Shampoos & Bath Gels', 'Baby Oils', 'Baby Powder', 'Soaps', 'Wipes & Diapers', 'Gift Packs',
  ],
} as const;

type FeaturedCategory = keyof typeof FEATURED_CATEGORY_MAP;

type FeaturedCategoryHierarchy = Record<string, readonly string[]>;

const FEATURED_CATEGORY_GROUPED_MAP: Partial<Record<FeaturedCategory, FeaturedCategoryHierarchy>> = {
  'Ayurveda Medicine': {
    Medicines: ['Himalaya', 'Organic India', 'Baidyanath', 'Dabur', 'Zandu', 'Charak', 'Aimil'],
    'Single Remedies': [
      'Ras & Sindoor',
      'Bhasm & Pishti',
      'Vati, Gutika & Guggulu',
      'Asava Arishta & Kadha',
      'Loha & Mandur',
      'Churan, Powder, Avaleha & Pak',
      'Tailam & Ghrita',
    ],
    'Herbal Food & Juices': ['Chyawanprash', 'Honey', 'Digestives', 'Herbal & Vegetable Juice'],
  },
  Homeopathy: {
    Medicines: ['SBL', 'Dr. Reckeweg', 'Willmar Schwabe', 'Adel Pekana', 'Schwabe India', 'Bjain', 'R S Bhargava', 'Baksons', 'REPL', 'New Life'],
    Dilutions: ['3X', '6X', '3 CH', '6 CH', '12 CH', '30 CH', '200 CH', '1000 CH', '10M CH', '50M CH', 'CM CH'],
    Categories: ['Mother Tinctures', 'Biochemic', 'Triturations', 'Bio Combination', 'Bach Flower', 'Homeopathy Kits', 'Milleimal LM Potency'],
    Cosmetics: ['Hair Care', 'Skin Care', 'Oral Care'],
  },
  Nutrition: {
    'Sports Nutrition': ['Proteins', 'Fat Burner', 'Weight Gainers', 'Pre Post Workout', 'Aminos', 'Creatines'],
    'Health Food & Drinks': ['Spreads, Sugar & Honey', 'Oils', 'Health Drinks', 'Healthy Snacks & Bars', 'Sugar Free', 'Murabba', 'Edible Seeds'],
  },
  'Organic Products': {
    'Organic Foods': ['Organic Foods'],
    'Coffee & Tea': ['Coffee & Tea'],
    Ghee: ['Ghee'],
    'Atta/Flour': ['Atta/Flour'],
  },
  'Personal Care': {
    'Aroma Oils': ['Essential Oils'],
    'Skin Care': ['Face', 'Body', 'Foot Care', 'Sanitizers & Hand Wash'],
    'Hair Care': ['Shampoo & Conditioners', 'Hair Oils & Creams', 'Hair Serum & Mask', 'Hair Color & Dyes', 'Henna Mehndi'],
    'Mens Grooming': ['Beard Oils and Wax', 'Shaving Cream & Gels', 'Men Wellness'],
    'Bath & Shower': ['Shower Gel & Hand Wash', 'Soaps', 'Talcs & Deos'],
    'Oral Care': ['Toothpaste', 'Gums Care'],
    'Female Care': ['Intimate Care', 'Pregnancy & Maternity Care'],
  },
  Fitness: {
    'Supports & Splints': ['Shoulder Support', 'Elbow Support', 'Forearm Support', 'Wrist Support', 'Chest Support', 'Cervical Support', 'Back Support', 'Abdominal Support', 'Thigh Support', 'Knee Support', 'Calf Support', 'Ankle Support', 'Finger Splint', 'Compression Stockings', 'Insoles & Heel Cups'],
    'Health Devices': ['Weighing Scales', 'BP Monitors', 'Thermometer', 'Respiratory Care', 'Activity Monitor', 'Hot and Cold Pads & Bottles'],
    'Fitness Equipment': ['Exercisers', 'Weights'],
    'Hospital Supplies': ['Stethoscopes', 'Protective Gears', 'Hospital Beds'],
    'Support Devices': ['Walking Sticks', 'Massagers', 'Disability Aids'],
  },
  'Sexual Wellness': {
    'Sexual Wellness': ['Sexual Supplements', 'Condoms'],
  },
  Disease: {
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
    'Children Problems': ['Low Height', 'Autism', 'Bed Wetting', 'Immunity', 'Teething Troubles', 'Irritability & Hyperactive'],
    'Lifestyle Diseases': ['Diabetes', 'Blood Pressure', 'Obesity', 'Thyroid', 'Hang Over', 'Varicose Veins'],
    'Old Age Problems': ['Parkinsons & Trembling', 'Involuntary Urination', 'Alzheimers'],
    Tonics: ['Anaemia', 'Blood Purifiers', 'General Tonics', 'Weakness & Fatigue'],
  },
  Unani: {
    'Unani Categories': ['Habbe & Qurs', 'Majun & Jawarish', 'Safoof, Labub & Kushta', 'Sharbat, Sirka & Arq', 'Lauq & Saoot', 'Khamira & Itrifal', 'Roghan & Oils'],
    Brands: ['Hamdard', 'New Shama', 'Dehlvi', 'Rex'],
  },
  'Baby Care': {
    'Baby Care': ['Tonics & Supplements', 'Shampoos & Bath Gels', 'Baby Oils', 'Baby Powder', 'Soaps', 'Wipes & Diapers', 'Gift Packs'],
  },
};

function getCategoryHierarchy(category: FeaturedCategory): FeaturedCategoryHierarchy {
  const grouped = FEATURED_CATEGORY_GROUPED_MAP[category];
  if (grouped && Object.keys(grouped).length > 0) {
    return grouped;
  }

  return {
    'All Items': FEATURED_CATEGORY_MAP[category],
  };
}

function getDefaultSubcategoryLevel1(category: FeaturedCategory): string {
  return Object.keys(getCategoryHierarchy(category))[0] || '';
}

function getDefaultSubcategoryLevel2(category: FeaturedCategory, level1: string): string {
  return getCategoryHierarchy(category)[level1]?.[0] || '';
}

function resolveSubcategoryPath(category: FeaturedCategory, subcategory?: string) {
  const hierarchy = getCategoryHierarchy(category);
  const level1Keys = Object.keys(hierarchy);
  const fallbackLevel1 = level1Keys[0] || '';

  if (!subcategory) {
    return {
      subcategoryLevel1: fallbackLevel1,
      subcategoryLevel2: getDefaultSubcategoryLevel2(category, fallbackLevel1),
    };
  }

  for (const level1 of level1Keys) {
    const options = hierarchy[level1] || [];
    if (options.includes(subcategory)) {
      return {
        subcategoryLevel1: level1,
        subcategoryLevel2: subcategory,
      };
    }
  }

  return {
    subcategoryLevel1: fallbackLevel1,
    subcategoryLevel2: subcategory,
  };
}

function getDefaultSubcategory(category: FeaturedCategory): string {
  const level1 = getDefaultSubcategoryLevel1(category);
  return getDefaultSubcategoryLevel2(category, level1);
}

const PRESET_CARD_COLORS = [
  '#ffffff',
  '#fef3c7',
  '#fee2e2',
  '#dbeafe',
  '#dcfce7',
  '#f3e8ff',
  '#fce7f3',
  '#ecfeff',
];

const getRandomCardColor = () =>
  PRESET_CARD_COLORS[Math.floor(Math.random() * PRESET_CARD_COLORS.length)];

export default function FeaturedProductsAdmin() {
  const [products, setProducts] = useState<FeaturedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    brandName: '',
    category: 'Generic Medicine' as FeaturedCategory,
    subcategoryLevel1: getDefaultSubcategoryLevel1('Generic Medicine'),
    subcategoryLevel2: getDefaultSubcategory('Generic Medicine'),
    cardBgColor: '#ffffff',
  });

  // Handle image file change
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    setImageFile(file);
    setError('');

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Reset image
  const resetImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  // Fetch products
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('adminToken');

      const response = await fetch('/api/featured-products', {
        cache: 'no-store',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) throw new Error('Failed to fetch products');

      const data = await response.json();
      setProducts(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Prevent duplicate submissions
    if (submitting) return;
    setSubmitting(true);

    try {
      // Get all required auth data from localStorage
      const token = localStorage.getItem('adminToken');
      const expiresAt = localStorage.getItem('tokenExpiresAt');
      let adminEmail = localStorage.getItem('adminEmail');

      // Fallback: if adminEmail is not set, try to get it from user data or env
      if (!adminEmail) {
        const user = localStorage.getItem('user');
        if (user) {
          try {
            const userData = JSON.parse(user);
            adminEmail = userData.email || process.env.NEXT_PUBLIC_ADMIN_EMAIL;
          } catch (e) {
            console.warn('Could not parse user data');
          }
        }
      }

      console.log('🔐 Auth check:', { 
        token: !!token, 
        expiresAt: !!expiresAt, 
        adminEmail: !!adminEmail 
      });

      if (!token || !expiresAt || !adminEmail) {
        const missing = [];
        if (!token) missing.push('adminToken');
        if (!expiresAt) missing.push('tokenExpiresAt');
        if (!adminEmail) missing.push('adminEmail');
        
        setError(`Admin authentication incomplete. Missing: ${missing.join(', ')}. Please logout and login again.`);
        setSubmitting(false);
        console.error('❌ Missing auth fields:', missing);
        return;
      }

      // If editing and no new image, use existing imageUrl
      if (editingId && !imageFile) {
        const currentProduct = products.find((p) => p._id === editingId);
        if (!currentProduct) throw new Error('Product not found');

        console.log('🔐 Updating product with auth headers:', { token: !!token, expiresAt, adminEmail });
        
        const response = await fetch(`/api/featured-products/${editingId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'x-token-expires-at': expiresAt,
            'x-admin-email': adminEmail,
          },
          body: JSON.stringify({
            brandName: formData.brandName,
            category: formData.category,
            subcategory: formData.subcategoryLevel2 || formData.subcategoryLevel1,
            cardBgColor: formData.cardBgColor,
            imageUrl: currentProduct.imageUrl,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to update product');
        }

        setSuccess('Product updated successfully');
        resetForm();
        fetchProducts();
        setSubmitting(false);
        return;
      }

      // If no image provided, show error
      if (!imageFile) {
        setError('Please upload an image');
        setSubmitting(false);
        return;
      }

      // Convert image to base64 for upload
      const reader = new FileReader();
      reader.readAsDataURL(imageFile);

      reader.onload = async () => {
        try {
          const base64Image = (reader.result as string).split(',')[1];
          console.log('📤 Uploading image to Cloudinary...', { size: base64Image.length });

          // Upload to Cloudinary
          const uploadResponse = await fetch('/api/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              image: base64Image,
              folder: 'featured-products',
            }),
          });

          console.log('Upload response status:', uploadResponse.status);

          const uploadData = await uploadResponse.json();
          console.log('Upload response data:', uploadData);

          if (!uploadResponse.ok) {
            throw new Error(uploadData.error || `Upload failed: ${uploadResponse.status}`);
          }

          if (!uploadData.success) {
            throw new Error(uploadData.error || 'Upload failed');
          }

          console.log('✅ Image uploaded successfully:', uploadData.url);

          // Save to database
          const token = localStorage.getItem('adminToken');
          const expiresAt = localStorage.getItem('tokenExpiresAt');
          let adminEmail = localStorage.getItem('adminEmail');

          // Fallback for adminEmail
          if (!adminEmail) {
            const user = localStorage.getItem('user');
            if (user) {
              try {
                const userData = JSON.parse(user);
                adminEmail = userData.email;
              } catch (e) {
                console.warn('Could not parse user data');
              }
            }
          }

          if (!token || !expiresAt || !adminEmail) {
            const missing = [];
            if (!token) missing.push('token');
            if (!expiresAt) missing.push('expiresAt');
            if (!adminEmail) missing.push('adminEmail');
            throw new Error(`Missing auth fields: ${missing.join(', ')}. Please logout and login again.`);
          }

          const method = editingId ? 'PUT' : 'POST';
          const url = editingId
            ? `/api/featured-products/${editingId}`
            : '/api/featured-products';

          console.log('💾 Saving to database...', { method, url, token: !!token, expiresAt, adminEmail });

          const response = await fetch(url, {
            method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'x-token-expires-at': expiresAt,
              'x-admin-email': adminEmail,
            },
            body: JSON.stringify({
              brandName: formData.brandName,
              category: formData.category,
              subcategory: formData.subcategoryLevel2 || formData.subcategoryLevel1,
              cardBgColor: formData.cardBgColor,
              imageUrl: uploadData.url,
              cloudinaryPublicId: uploadData.publicId,
            }),
          });

          console.log('Database response status:', response.status);

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Failed to save: ${response.status}`);
          }

          const result = await response.json();
          console.log('✅ Product saved successfully', result);
          
          setSuccess(editingId ? 'Product updated successfully' : 'Product created successfully');
          resetForm();
          fetchProducts();
        } catch (err: any) {
          console.error('❌ Error:', err);
          setError(err.message || 'Upload failed');
        } finally {
          setSubmitting(false);
        }
      };

      reader.onerror = () => {
        console.error('❌ FileReader error');
        setError('Failed to read image file');
        setSubmitting(false);
      };;
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'An error occurred');
      setSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      setError('');
      const token = localStorage.getItem('adminToken');
      const expiresAt = localStorage.getItem('tokenExpiresAt');
      let adminEmail = localStorage.getItem('adminEmail');

      // Fallback for adminEmail
      if (!adminEmail) {
        const user = localStorage.getItem('user');
        if (user) {
          try {
            const userData = JSON.parse(user);
            adminEmail = userData.email;
          } catch (e) {
            console.warn('Could not parse user data');
          }
        }
      }

      if (!token || !expiresAt || !adminEmail) {
        setError('Admin authentication missing. Please logout and login again.');
        return;
      }

      const response = await fetch(`/api/featured-products/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-token-expires-at': expiresAt,
          'x-admin-email': adminEmail,
        },
      });

      if (!response.ok) throw new Error('Failed to delete product');

      setSuccess('Product deleted successfully');
      fetchProducts();
    } catch (err: any) {
      setError(err.message || 'Failed to delete product');
    }
  };

  // Handle edit
  const handleEdit = (product: FeaturedProduct) => {
    const category = (product.category as FeaturedCategory) || 'Generic Medicine';
    const path = resolveSubcategoryPath(category, product.subcategory);

    setEditingId(product._id);
    setFormData({
      brandName: product.brandName,
      category,
      subcategoryLevel1: path.subcategoryLevel1,
      subcategoryLevel2: path.subcategoryLevel2,
      cardBgColor: product.cardBgColor || '#ffffff',
    });
    setShowModal(true);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      brandName: '',
      category: 'Generic Medicine',
      subcategoryLevel1: getDefaultSubcategoryLevel1('Generic Medicine'),
      subcategoryLevel2: getDefaultSubcategory('Generic Medicine'),
      cardBgColor: '#ffffff',
    });
    setEditingId(null);
    setShowModal(false);
    resetImage();
    setError('');
    setSuccess('');
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="overflow-auto">
        {/* Header Section */}
        <div className="sticky top-0 z-40 bg-linear-to-r from-blue-600 to-blue-700 shadow-lg">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex justify-between items-start gap-4">
              <div>
                <h1 className="text-4xl font-black text-white">Featured Products</h1>
                <p className="text-blue-100 mt-2">Manage brand cards displayed on homepage</p>
              </div>
              <button
                onClick={() => setShowModal(true)}
                className="px-6 py-3 bg-white text-blue-600 font-bold rounded-lg hover:bg-blue-50 shadow-lg transition-all transform hover:scale-105 flex items-center gap-2"
              >
                <span className="text-xl">+</span> Add Product
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
              <p className="text-slate-600 text-sm font-semibold uppercase tracking-wide">Total Products</p>
              <p className="text-4xl font-black text-slate-900 mt-2">{products.length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-emerald-500">
              <p className="text-slate-600 text-sm font-semibold uppercase tracking-wide">Active</p>
              <p className="text-4xl font-black text-emerald-600 mt-2">{products.filter(p => p.isActive).length}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-amber-500">
              <p className="text-slate-600 text-sm font-semibold uppercase tracking-wide">Inactive</p>
              <p className="text-4xl font-black text-amber-600 mt-2">{products.filter(p => !p.isActive).length}</p>
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg text-red-700 font-semibold shadow">
              ✕ {error}
            </div>
          )}
          {success && (
            <div className="mb-6 p-4 bg-emerald-50 border-l-4 border-emerald-500 rounded-lg text-emerald-700 font-semibold shadow animate-in fade-in">
              ✓ {success}
            </div>
          )}

          {/* Search & Filter Bar */}
          <div className="mb-6 flex gap-4 items-center flex-wrap">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 min-w-64 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2 bg-white rounded-lg p-1 shadow border border-slate-300">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded font-semibold transition-all ${
                  viewMode === 'grid'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                ⊞ Grid
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-4 py-2 rounded font-semibold transition-all ${
                  viewMode === 'table'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                ≡ Table
              </button>
            </div>
          </div>

          {/* Products View */}
          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block">
                <div className="animate-spin text-4xl mb-4">⟳</div>
                <p className="text-slate-600 font-semibold">Loading products...</p>
              </div>
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-lg border-2 border-dashed border-slate-300 shadow">
              <p className="text-slate-600 text-xl font-semibold">No featured products yet</p>
              <p className="text-slate-500 mt-2">Click "Add Product" to get started</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products
                .filter(p => `${p.brandName} ${p.category || ''} ${p.subcategory || ''}`.toLowerCase().includes(searchTerm.toLowerCase()))
                .map((product) => (
                  <div
                    key={String(product._id)}
                    className="bg-white rounded-lg shadow hover:shadow-xl transition-all duration-300 overflow-hidden group border border-slate-200"
                    style={{ backgroundColor: product.cardBgColor || '#ffffff' }}
                  >
                    {/* Image Container */}
                    <div className="relative bg-linear-to-br from-slate-100 to-slate-200 h-64 overflow-hidden">
                      <img
                        src={product.imageUrl}
                        alt={product.brandName}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                      <div className="absolute top-3 left-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${
                          product.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                        }`}>
                          {product.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="absolute top-3 right-3">
                        <span className="px-3 py-1 rounded-full text-xs font-bold text-white bg-slate-700">
                          Featured
                        </span>
                      </div>
                      <div className="absolute bottom-3 left-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/95 px-2 py-1">
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-slate-300"
                            style={{ backgroundColor: product.cardBgColor || '#ffffff' }}
                          />
                          <span className="text-[10px] font-bold text-slate-700">
                            {product.cardBgColor || '#ffffff'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Product Info */}
                    <div className="p-4 flex flex-col">
                      <h3 className="font-bold text-slate-900 text-center text-lg mb-4 line-clamp-2">
                        {product.brandName}
                      </h3>
                      <div className="text-center mb-4">
                        <span className="inline-block text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded-full mr-1">
                          {product.category || '—'}
                        </span>
                        <span className="inline-block text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-1 rounded-full mt-1">
                          {product.subcategory || '—'}
                        </span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 mt-auto">
                        <button
                          onClick={() => handleEdit(product)}
                          className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded transition-colors"
                        >
                          ✎ Edit
                        </button>
                        <button
                          onClick={() => handleDelete(product._id)}
                          className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded transition-colors"
                        >
                          ✕ Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden border border-slate-200">
              <table className="w-full">
                <thead className="bg-linear-to-r from-slate-800 to-slate-900 text-white">
                  <tr>
                    <th className="px-6 py-4 text-left font-bold">Brand Name</th>
                    <th className="px-6 py-4 text-left font-bold">Category</th>
                    <th className="px-6 py-4 text-left font-bold">Subcategory</th>
                    <th className="px-6 py-4 text-left font-bold">Image</th>
                    <th className="px-6 py-4 text-center font-bold">Card Color</th>
                    <th className="px-6 py-4 text-center font-bold">Status</th>
                    <th className="px-6 py-4 text-center font-bold">Created</th>
                    <th className="px-6 py-4 text-center font-bold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {products
                    .filter(p => `${p.brandName} ${p.category || ''} ${p.subcategory || ''}`.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map((product, idx) => (
                      <tr key={String(product._id)} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-slate-900">{product.brandName}</td>
                        <td className="px-6 py-4 text-sm text-slate-700">{product.category || '—'}</td>
                        <td className="px-6 py-4 text-sm text-slate-700">{product.subcategory || '—'}</td>
                        <td className="px-6 py-4">
                          <img
                            src={product.imageUrl}
                            alt={product.brandName}
                            className="w-12 h-16 object-cover rounded"
                          />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1">
                            <span
                              className="h-4 w-4 rounded-full border border-slate-300"
                              style={{ backgroundColor: product.cardBgColor || '#ffffff' }}
                            />
                            <span className="text-xs font-bold text-slate-700">
                              {product.cardBgColor || '#ffffff'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-block px-3 py-1 font-bold rounded text-white ${
                            product.isActive ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}>
                            {product.isActive ? '✓ Active' : '✗ Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-sm text-slate-600">
                          {new Date(product.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => handleEdit(product)}
                              className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(product._id)}
                              className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-linear-to-r from-blue-600 to-blue-700 px-8 py-6 flex justify-between items-center border-b border-slate-200">
              <h2 className="text-2xl font-black text-white">
                {editingId ? '✎ Edit Product' : '➕ Add New Product'}
              </h2>
              <button
                onClick={resetForm}
                className="text-white text-2xl hover:bg-blue-500 p-1 rounded transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              {/* Brand Name */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">
                  Brand Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.brandName}
                  onChange={(e) =>
                    setFormData({ ...formData, brandName: e.target.value })
                  }
                  placeholder="Enter brand name (e.g., Premium Herbs)"
                  className="w-full px-5 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-semibold"
                  required
                />
              </div>

              {/* Category & Subcategory */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => {
                      const category = e.target.value as FeaturedCategory;
                      const subcategoryLevel1 = getDefaultSubcategoryLevel1(category);
                      setFormData({
                        ...formData,
                        category,
                        subcategoryLevel1,
                        subcategoryLevel2: getDefaultSubcategoryLevel2(category, subcategoryLevel1),
                      });
                    }}
                    className="w-full px-5 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-semibold"
                    required
                  >
                    {(Object.keys(FEATURED_CATEGORY_MAP) as FeaturedCategory[]).map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">
                    Subcategory <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.subcategoryLevel1}
                    onChange={(e) => {
                      const subcategoryLevel1 = e.target.value;
                      setFormData({
                        ...formData,
                        subcategoryLevel1,
                        subcategoryLevel2: getDefaultSubcategoryLevel2(formData.category, subcategoryLevel1),
                      });
                    }}
                    className="w-full px-5 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-semibold"
                    required
                  >
                    {Object.keys(getCategoryHierarchy(formData.category)).map((subcategory) => (
                      <option key={subcategory} value={subcategory}>
                        {subcategory}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">
                    Subcategory&apos;s Subcategory <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.subcategoryLevel2}
                    onChange={(e) => setFormData({ ...formData, subcategoryLevel2: e.target.value })}
                    className="w-full px-5 py-3 border-2 border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-semibold"
                    required
                  >
                    {(() => {
                      const options = [
                        ...(getCategoryHierarchy(formData.category)[formData.subcategoryLevel1] || []),
                      ];

                      if (
                        formData.subcategoryLevel2 &&
                        !options.includes(formData.subcategoryLevel2)
                      ) {
                        options.push(formData.subcategoryLevel2);
                      }

                      return options.map((subcategory) => (
                        <option key={subcategory} value={subcategory}>
                          {subcategory}
                        </option>
                      ));
                    })()}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">
                    Next Category (Preview)
                  </label>
                  <div className="w-full px-5 py-3 border-2 border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-semibold min-h-13 flex items-center">
                    {`${formData.category} → ${formData.subcategoryLevel1} → ${formData.subcategoryLevel2 || '—'}`}
                  </div>
                </div>
              </div>

              {/* Card Background Color */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">
                  Card Background Color
                </label>
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="color"
                    value={formData.cardBgColor}
                    onChange={(e) =>
                      setFormData({ ...formData, cardBgColor: e.target.value })
                    }
                    className="h-11 w-16 cursor-pointer rounded border-2 border-slate-300 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({ ...formData, cardBgColor: getRandomCardColor() })
                    }
                    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded transition-colors"
                  >
                    Random Color
                  </button>
                  <span
                    className="inline-flex items-center rounded px-2 py-1 text-xs font-semibold border border-slate-300"
                    style={{ backgroundColor: formData.cardBgColor }}
                  >
                    {formData.cardBgColor}
                  </span>
                </div>
                <p className="text-xs text-slate-500">This color will be used as the featured card background.</p>
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">
                  Product Image {!editingId && <span className="text-red-500">*</span>}
                </label>
                <div className="border-3 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-500 hover:bg-blue-50 transition-all">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    id="image-input"
                  />
                  <label htmlFor="image-input" className="cursor-pointer block">
                    {imagePreview ? (
                      <div className="space-y-3">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="max-h-64 mx-auto rounded-lg shadow"
                        />
                        <p className="text-sm text-slate-600 font-semibold">Click to change image</p>
                      </div>
                    ) : (
                      <div className="py-12">
                        <p className="text-3xl mb-3">🖼️</p>
                        <p className="text-slate-700 font-bold text-lg">Drag and drop image here</p>
                        <p className="text-slate-600 font-semibold">or click to browse</p>
                        <p className="text-xs text-slate-500 mt-3">Recommended: 300px × 500px</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded text-red-700 font-semibold">
                  {error}
                </div>
              )}

              {/* Form Actions */}
              <div className="flex gap-4 pt-4 border-t border-slate-200">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-6 py-3 bg-linear-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-blue-400 disabled:to-blue-400 text-white font-bold rounded-lg transition-all transform hover:scale-105 shadow-lg"
                >
                  {submitting
                    ? '⟳ Saving...'
                    : editingId
                    ? '✓ Update Product'
                    : '✓ Create Product'}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
