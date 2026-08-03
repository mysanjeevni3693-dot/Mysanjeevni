'use client';

import Link from 'next/link';
import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';

interface Category {
  name: string;
  subcategories: string[];
  groupedSubcategories?: Record<string, string[]>;
  icon: string;
  color: string;
  href: string;
}

interface CategoryTreeNode {
  _id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  children: CategoryTreeNode[];
}

type DynamicCategoryConfig = {
  vendorCategoryMap?: Record<string, string[]>;
  subcategoryMapByType?: Record<string, Record<string, string[]>>;
  diseaseSubcategoryMap?: Record<string, string[]>;
};

const CATEGORY_TREE_ROOT_ALIASES: Record<string, string[]> = {
  Ayurveda: ['Ayurveda Medicine'],
  Disease: ['Disease Categories', 'Disease'],
};

const normalizeName = (value: string) => String(value || '').trim().toLowerCase();

const findTreeNodeByName = (
  nodes: CategoryTreeNode[] | null | undefined,
  targetName: string
): CategoryTreeNode | null => {
  if (!Array.isArray(nodes) || nodes.length === 0) return null;
  const normalizedTarget = normalizeName(targetName);
  const stack = [...nodes];

  while (stack.length) {
    const node = stack.shift();
    if (!node || typeof node !== 'object') continue;
    if (normalizeName(node.name) === normalizedTarget) {
      return node;
    }
    if (Array.isArray(node.children) && node.children.length > 0) {
      stack.push(...node.children);
    }
  }

  return null;
};

const getCategoryTreeRootNames = (categoryName: string) => {
  return CATEGORY_TREE_ROOT_ALIASES[categoryName] || [categoryName];
};

const getTreeNodeForCategory = (
  tree: CategoryTreeNode[] | null,
  categoryName: string
): CategoryTreeNode | null => {
  if (!tree) return null;
  const rootNames = getCategoryTreeRootNames(categoryName);
  for (const rootName of rootNames) {
    const node = findTreeNodeByName(tree, rootName);
    if (node) return node;
  }
  return null;
};

const getCategoryBasePath = (categoryName: string) => {
  if (categoryName === 'Ayurveda') return '/ayurveda';
  if (categoryName === 'Homeopathy') return '/homeopathy';
  return '/medicines';
};

const getTreeNodeHref = (categoryName: string, path: string[]) => {
  const linkName = path[path.length - 1] || '';
  if (!linkName) {
    return `${getCategoryBasePath(categoryName)}#products-section`;
  }

  if (categoryName === 'Ayurveda' || categoryName === 'Homeopathy') {
    return `${getCategoryBasePath(categoryName)}?category=${encodeURIComponent(linkName)}#products-section`;
  }

  if (categoryName === 'Disease') {
    return `${getCategoryBasePath(categoryName)}?category=disease&subcategory=${encodeURIComponent(linkName)}#products-section`;
  }

  if (categoryName === 'Organic Products') {
    return `${getCategoryBasePath(categoryName)}?category=${encodeURIComponent(linkName)}#products-section`;
  }

  return `${getCategoryBasePath(categoryName)}?category=${encodeURIComponent(
    categoryName.toLowerCase()
  )}&subcategory=${encodeURIComponent(linkName)}#products-section`;
};

const renderTreeNodes = (
  nodes: CategoryTreeNode[] | undefined | null,
  categoryName: string,
  ancestry: string[] = [],
  depth = 0
): React.ReactNode[] => {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];

  return nodes.map((node) => {
    const path = [...ancestry, node.name];
    const children = Array.isArray(node.children) ? node.children : [];
    return (
      <div key={`${path.join('>')}`} className="space-y-1">
        <Link
          href={getTreeNodeHref(categoryName, path)}
          className={`block text-sm truncate ${
            depth === 0 ? '' : 'text-gray-700'
          } hover:text-orange-500`}
        >
          {node.name}
        </Link>

        {children.length > 0 && (
          <div className={`mt-2 space-y-1 ${depth >= 0 ? 'pl-4' : ''}`}>
            {renderTreeNodes(children, categoryName, path, depth + 1)}
          </div>
        )}
      </div>
    );
  });
};

const renderTreeDropdown = (
  treeNodes: CategoryTreeNode[] | undefined | null,
  categoryName: string,
  color: string
) => {
  const styles = getColorStyles(color);
  const groups = Array.isArray(treeNodes) ? treeNodes : [];

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-5" style={{ width: '780px', maxWidth: '80vw' }}>
      <h3 className={`text-base font-semibold mb-4 pb-3 border-b border-gray-200 ${styles.text}`}>
        {categoryName}
      </h3>
      <div className="overflow-x-auto pb-1">
        <div
          className="grid gap-4 overflow-y-auto pr-1"
          style={{
            gridTemplateColumns: 'repeat(3, minmax(240px, 1fr))',
            minWidth: '900px',
            maxHeight: '440px',
          }}
        >
          {groups.map((group) => (
            <div key={group.name} className="min-w-0">
              <Link
                href={getTreeNodeHref(categoryName, [group.name])}
                className={`block text-sm font-semibold mb-2 ${styles.text} hover:text-orange-500 truncate`}
              >
                {group.name}
              </Link>
              <div className="space-y-2">
                {renderTreeNodes(group.children, categoryName, [group.name], 1)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const AYURVEDA_GROUPED_SUBCATEGORIES: Record<string, string[]> = {
  Medicines: ['Himalaya', 'Organic India', 'Baidyanath', 'Dabur', 'Zandu', 'Charak', 'Aimil'],
  'Single Remedies': [
    'Ras & Sindoor',
    'Bhasm & Pishti',
    'Vati & Gutika & Guggulu',
    'Asava Arishta & Kadha',
    'Loha & Mandur',
    'Churan & Powder & Avleha & Pak',
    'Tailam & Ghrita',
    'Gold Items',
    'Special Tablets & Capsules',
    'Syrups & Tonics',
  ],
  'Herbal Food & Juices': ['Chyawanprash', 'Honey', 'Digestives', 'Herbal & Vegetable Juice'],
};

const HOMEOPATHY_GROUPED_SUBCATEGORIES: Record<string, string[]> = {
  Medicines: [
    'SBL',
    'Dr. Reckeweg (Germany)',
    'Willmar Schwabe (Germany)',
    'Adel Pekana (Germany)',
    'Willmar Schwabe India',
    'BJain',
    'R S Bhargava',
    'Baksons',
    'REPL',
    'New Life',
    'Special Tablets',
    'Cream & Ointment',
    'Special Liquid/Drops',
  ],
  Cosmetics: ['Hair Care', 'Skin Care', 'Oral Care'],
  Dilutions: ['3X', '6X', '3 CH', '6 CH', '12 CH', '30 CH', '200 CH', '1000 CH', '10M CH', '50M CH', 'CM CH'],
  'Mother Tinctures': ['SBL', 'Dr. Reckeweg (Germany)', 'Willmar Schwabe India', 'BJain'],
  Biochemic: ['SBL', 'Dr. Reckeweg (Germany)', 'BJain', 'Willmar Schwabe India'],
  'Bach Flower': ['Bach Flower Remedies', 'Bach Flower Kits'],
  'Homeopathy Kits': ['Homeopathy Kits'],
  Triturations: ['SBL', 'Dr. Reckeweg (Germany)', 'Willmar Schwabe India', 'BJain'],
  'Millesimal LM Potency': ['SBL', 'BJain'],
  'Bio Combination': ['SBL', 'Dr. Reckeweg (Germany)', 'BJain', 'Willmar Schwabe India', 'Haslab (HSL)'],
};

const NUTRITION_GROUPED_SUBCATEGORIES: Record<string, string[]> = {
  'Sports Nutrition': ['Proteins', 'Fat Burner', 'Weight Gainers', 'Pre Post Workout', 'Aminos', 'Creatines'],
  'Health Food & Drinks': ['Spreads & Sugar & Honey', 'Oils', 'Herbal & Vegetable Juices', 'Health Drinks', 'Healthy Snacks & Bars', 'Sugar Free', 'Murabba', 'Chyawanprash', 'Edible Seeds'],
  'Vitamin & Dietary Supplements': ['Vitamin & Dietary Supplements'],
  'Green Teas': ['Green Teas'],
  Digestives: ['Digestives'],
};

const ORGANIC_PRODUCTS_GROUPED_SUBCATEGORIES: Record<string, string[]> = {
  'Organic Foods': ['Organic Foods'],
  'Coffee & Tea': ['Coffee & Tea'],
  'Ghee': ['Ghee'],
  'Atta/Flour': ['Atta/Flour'],
};

const PERSONAL_CARE_GROUPED_SUBCATEGORIES: Record<string, string[]> = {
  'Aroma Oils': ['Essential Oils'],
  'Mens Grooming': ['Beard Oils and Wax', 'Shaving Cream & Gels', 'Men Wellness'],
  'Female Care': ['Intimate Care', 'Pregnancy & Maternity Care'],
  'Skin Care': ['Face', 'Body', 'Foot Care', 'Sanitizers & Hand Wash'],
  'Bath & Shower': ['Shower Gel & Hand Wash', 'Soaps', 'Talcs & Deos'],
  'Hair Care': ['Shampoo & Conditioners', 'Hair Oils & Creams', 'Hair Serum & Mask', 'Hair Color & Dyes', 'Henna Mehandi'],
  'Elderly Care': ['Elderly Care'],
  'Mosquito Repellents': ['Mosquito Repellents'],
  'Oral Care': ['Toothpaste', 'Gums Care'],
};

const FITNESS_GROUPED_SUBCATEGORIES: Record<string, string[]> = {
  'Supports & Splints': [
    'Shoulder Support',
    'Elbow Support',
    'Forearm Support',
    'Wrist Support',
    'Chest Support',
    'Cervical Support',
    'Back Support',
    'Abdominal Support',
    'Thigh Support',
    'Knee Support',
    'Calf Support',
    'Ankle Support',
    'Finger Splint',
    'Compression Stockings',
    'Insoles & Heel cups',
  ],
  'Health Devices': [
    'Weighing Scales',
    'BP Monitors',
    'Thermometer',
    'Respiratory Care',
    'Activity Moniter',
    'Hot and Cold Pads & Bottles',
  ],
  'Fitness Equipment': ['Exercisers', 'Weights'],
  'Hospital Supplies': ['Stethoscopes', 'Protective Gears', 'Hospital Beds'],
  'Aroma Therapy': ['Aroma Therapy'],
  'Disability Aids': ['Disability Aids'],
  Massagers: ['Massagers'],
  'Bandages & Tapes': ['Bandages & Tapes'],
  'Walking Sticks': ['Walking Sticks'],
};

const UNANI_GROUPED_SUBCATEGORIES: Record<string, string[]> = {
  'Unani Medicines': ['Unani Medicines'],
  'Habbe & Qurs': ['Habbe & Qurs'],
  'Majun & Jawarish': ['Majun & Jawarish'],
  'Safoof, Labub & Kushta': ['Safoof, Labub & Kushta'],
  'Sharbat, Sirka & Arq': ['Sharbat, Sirka & Arq'],
  'Lauq & Saoot': ['Lauq & Saoot'],
  'Khamira & Itrifal': ['Khamira & Itrifal'],
  'Roghan & Oils': ['Roghan & Oils'],
  'Unani Brands': ['Hamdard', 'New Shama', 'Dehlvi', 'Rex'],
};

const BABY_CARE_GROUPED_SUBCATEGORIES: Record<string, string[]> = {
  'Tonics & Supplements': ['Tonics & Supplements'],
  'Bath & Skin': ['Shampoos & Bath Gels', 'Baby Oils', 'Baby Powder', 'Soaps'],
  'Wipes & Diapers': ['Wipes & Diapers'],
  'Gift Packs': ['Gift Packs'],
};

const SEXUAL_WELLNESS_GROUPED_SUBCATEGORIES: Record<string, string[]> = {
  'Sexual Wellness': ['Supplements', 'Condoms'],
};

const DISEASE_GROUPED_SUBCATEGORIES: Record<string, string[]> = {
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
};

const flattenSubcategories = (groupedSubcategories: Record<string, string[]>) =>
  Object.values(groupedSubcategories).flat();

const CATEGORIES: Category[] = [
  {
    name: 'Ayurveda',
    icon: '🌿',
    color: 'emerald',
    href: '/ayurveda',
    subcategories: ['All', ...flattenSubcategories(AYURVEDA_GROUPED_SUBCATEGORIES)],
    groupedSubcategories: AYURVEDA_GROUPED_SUBCATEGORIES,
  },
  {
    name: 'Homeopathy',
    icon: '🌸',
    color: 'emerald',
    href: '/homeopathy',
    subcategories: ['All', ...flattenSubcategories(HOMEOPATHY_GROUPED_SUBCATEGORIES)],
    groupedSubcategories: HOMEOPATHY_GROUPED_SUBCATEGORIES,
  },
  {
    name: 'Nutrition',
    icon: '🥗',
    color: 'green',
    href: '/medicines',
    subcategories: ['All', ...flattenSubcategories(NUTRITION_GROUPED_SUBCATEGORIES)],
    groupedSubcategories: NUTRITION_GROUPED_SUBCATEGORIES,
  },
  {
    name: 'Organic Products',
    icon: '🌾',
    color: 'green',
    href: '/medicines',
    subcategories: ['All', ...flattenSubcategories(ORGANIC_PRODUCTS_GROUPED_SUBCATEGORIES)],
    groupedSubcategories: ORGANIC_PRODUCTS_GROUPED_SUBCATEGORIES,
  },
  {
    name: 'Personal Care',
    icon: '🧴',
    color: 'emerald',
    href: '/medicines',
    subcategories: ['All', ...flattenSubcategories(PERSONAL_CARE_GROUPED_SUBCATEGORIES)],
    groupedSubcategories: PERSONAL_CARE_GROUPED_SUBCATEGORIES,
  },
  {
    name: 'Fitness',
    icon: '💪',
    color: 'emerald',
    href: '/medicines',
    subcategories: ['All', ...flattenSubcategories(FITNESS_GROUPED_SUBCATEGORIES)],
    groupedSubcategories: FITNESS_GROUPED_SUBCATEGORIES,
  },
  {
    name: 'Sexual Wellness',
    icon: '💑',
    color: 'emerald',
    href: '/medicines',
    subcategories: ['All', ...flattenSubcategories(SEXUAL_WELLNESS_GROUPED_SUBCATEGORIES)],
    groupedSubcategories: SEXUAL_WELLNESS_GROUPED_SUBCATEGORIES,
  },
  {
    name: 'Disease',
    icon: '🌾',
    color: 'emerald',
    href: '/medicines',
    subcategories: ['All', ...flattenSubcategories(DISEASE_GROUPED_SUBCATEGORIES)],
    groupedSubcategories: DISEASE_GROUPED_SUBCATEGORIES,
  },
  {
    name: 'Unani',
    icon: '⚗️',
    color: 'emerald',
    href: '/medicines',
    subcategories: ['All', ...flattenSubcategories(UNANI_GROUPED_SUBCATEGORIES)],
    groupedSubcategories: UNANI_GROUPED_SUBCATEGORIES,
  },
  {
    name: 'Baby Care',
    icon: '👶',
    color: 'emerald',
    href: '/medicines',
    subcategories: ['All', ...flattenSubcategories(BABY_CARE_GROUPED_SUBCATEGORIES)],
    groupedSubcategories: BABY_CARE_GROUPED_SUBCATEGORIES,
  },
];

/** Normalize dynamic category maps so desktop mega-menu never crashes on bad API data. */
const sanitizeGroupedSubcategories = (
  grouped?: Record<string, unknown> | Record<string, string[]> | null
): Record<string, string[]> | undefined => {
  if (!grouped || typeof grouped !== 'object') return undefined;
  const next: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(grouped as Record<string, unknown>)) {
    if (!key) continue;
    if (Array.isArray(value)) {
      next[key] = value.map((item) => String(item ?? '').trim()).filter(Boolean);
    } else if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) next[key] = [trimmed];
    }
  }
  return Object.keys(next).length > 0 ? next : undefined;
};

const buildFlatSubcategories = (groupedSubcategories?: Record<string, string[]>) => {
  const safe = sanitizeGroupedSubcategories(groupedSubcategories);
  if (!safe) return ['All'];
  return ['All', ...Object.values(safe).flat()];
};

const toSingleGroup = (groupName: string, values?: string[]) => {
  if (!values || values.length === 0) return undefined;
  return { [groupName]: values };
};

const pickFirstMap = (
  source: Record<string, Record<string, string[]>>,
  keys: string[]
) => {
  for (const key of keys) {
    if (source[key] && Object.keys(source[key]).length > 0) {
      return source[key];
    }
  }
  return undefined;
};

const getDynamicGroupedByCategory = (
  config: DynamicCategoryConfig
): Partial<Record<string, Record<string, string[]>>> => {
  const subByType = config.subcategoryMapByType || {};
  const vendorMap = config.vendorCategoryMap || {};
  const diseaseMap = config.diseaseSubcategoryMap || {};

  const nutritionMap = pickFirstMap(subByType, ['Nutrition']) || NUTRITION_GROUPED_SUBCATEGORIES;
  // Keep Nutrition free of Organic Products (Organic is its own top-level type).
  const nutritionWithoutOrganic = Object.fromEntries(
    Object.entries(nutritionMap).filter(([key]) => key.trim().toLowerCase() !== 'organic products')
  );

  return {
    Ayurveda:
      pickFirstMap(subByType, ['Ayurveda', 'Ayurveda Medicine']) ||
      AYURVEDA_GROUPED_SUBCATEGORIES,
    Homeopathy:
      pickFirstMap(subByType, ['Homeopathy']) || HOMEOPATHY_GROUPED_SUBCATEGORIES,
    Nutrition: nutritionWithoutOrganic,
    'Organic Products':
      pickFirstMap(subByType, ['Organic Products']) ||
      toSingleGroup('Organic Products', vendorMap['Organic Products']) ||
      ORGANIC_PRODUCTS_GROUPED_SUBCATEGORIES,
    'Personal Care':
      pickFirstMap(subByType, ['Personal Care']) || PERSONAL_CARE_GROUPED_SUBCATEGORIES,
    Fitness: pickFirstMap(subByType, ['Fitness']) || FITNESS_GROUPED_SUBCATEGORIES,
    'Sexual Wellness':
      pickFirstMap(subByType, ['Sexual Wellness']) ||
      toSingleGroup('Sexual Wellness', vendorMap['Sexual Wellness']) ||
      SEXUAL_WELLNESS_GROUPED_SUBCATEGORIES,
    Disease:
      Object.keys(diseaseMap).length > 0
        ? diseaseMap
        : DISEASE_GROUPED_SUBCATEGORIES,
    Unani: pickFirstMap(subByType, ['Unani']) || UNANI_GROUPED_SUBCATEGORIES,
  };
};

const COLOR_STYLES: Record<string, any> = {
  emerald: {
    hover: 'hover:bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-500',
    subcategoryBg: 'hover:bg-emerald-100',
  },
  amber: {
    hover: 'hover:bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-500',
    subcategoryBg: 'hover:bg-amber-100',
  },
  pink: {
    hover: 'hover:bg-pink-50',
    text: 'text-pink-700',
    border: 'border-pink-500',
    subcategoryBg: 'hover:bg-pink-100',
  },
  green: {
    hover: 'hover:bg-green-50',
    text: 'text-green-700',
    border: 'border-green-500',
    subcategoryBg: 'hover:bg-green-100',
  },
  purple: {
    hover: 'hover:bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-500',
    subcategoryBg: 'hover:bg-purple-100',
  },
  red: {
    hover: 'hover:bg-red-50',
    text: 'text-red-700',
    border: 'border-red-500',
    subcategoryBg: 'hover:bg-red-100',
  },
  rose: {
    hover: 'hover:bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-500',
    subcategoryBg: 'hover:bg-rose-100',
  },
  lime: {
    hover: 'hover:bg-lime-50',
    text: 'text-lime-700',
    border: 'border-lime-500',
    subcategoryBg: 'hover:bg-lime-100',
  },
  sky: {
    hover: 'hover:bg-sky-50',
    text: 'text-sky-700',
    border: 'border-sky-500',
    subcategoryBg: 'hover:bg-sky-100',
  },
  indigo: {
    hover: 'hover:bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-500',
    subcategoryBg: 'hover:bg-indigo-100',
  },
};

const getColorStyles = (color?: string) =>
  COLOR_STYLES[String(color || '')] || COLOR_STYLES.emerald;

/** Top-level nav labels that must never appear (Disease replaces Medicines). */
const EXCLUDED_NAV_CATEGORIES = new Set([
  'medicines',
  'medicine',
  'generic medicine',
  'generic medicines',
  'allopathic medicines',
  'allopathic medicine',
  'general medicines',
  'general medicine',
]);

const isExcludedNavCategory = (name: string) => {
  const normalized = normalizeName(name);
  if (EXCLUDED_NAV_CATEGORIES.has(normalized)) return true;
  // Catch variants like "Medicines Store", "Our Medicines", etc.
  if (normalized === 'medicines' || normalized.startsWith('medicines ')) return true;
  if (normalized.endsWith(' medicines') && !normalized.includes('unani')) return true;
  return false;
};

function CategoryNavInner({ isMobile = false }: { isMobile?: boolean }) {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>(() =>
    CATEGORIES.filter((category) => !isExcludedNavCategory(category.name))
  );
  const [categoryTree, setCategoryTree] = useState<CategoryTreeNode[] | null>(null);

  useEffect(() => {
    let active = true;

    const fetchDynamicCategories = async () => {
      try {
        const [configResponse, treeResponse] = await Promise.all([
          fetch('/api/categories?mode=config'),
          fetch('/api/categories'),
        ]);

        if (configResponse.ok) {
          const configData = await configResponse.json();
          if (configData?.success && active) {
            const dynamicGrouped = getDynamicGroupedByCategory(configData.config || {});
            setCategories((prev) =>
              prev
                .filter((category) => !isExcludedNavCategory(category.name))
                .map((category) => {
                  const groupedSubcategories = sanitizeGroupedSubcategories(
                    dynamicGrouped[category.name] || category.groupedSubcategories
                  );
                  if (!groupedSubcategories) return category;

                  return {
                    ...category,
                    groupedSubcategories,
                    subcategories: buildFlatSubcategories(groupedSubcategories),
                  };
                })
            );
          }
        }

        if (treeResponse.ok) {
          const treeData = await treeResponse.json();
          if (treeData?.success && active && Array.isArray(treeData.tree)) {
            setCategoryTree(treeData.tree);
          }
        }
      } catch {
        // Keep fallback static categories when dynamic config or tree data cannot be loaded.
      }
    };

    fetchDynamicCategories();

    return () => {
      active = false;
    };
  }, []);

  const visibleCategories = categories.filter(
    (category) => !isExcludedNavCategory(category.name)
  );

  const buildHref = (path: string, params?: Record<string, string>) => {
    const query = new URLSearchParams(params).toString();
    return `${path}${query ? `?${query}` : ''}#products-section`;
  };

  const getSubcategoryHref = (categoryName: string, subcategoryName: string) => {
    if (categoryName === 'Ayurveda') {
      return buildHref('/ayurveda', { category: subcategoryName });
    }

    if (categoryName === 'Homeopathy') {
      return buildHref('/homeopathy', { category: subcategoryName });
    }

    if (categoryName === 'Disease') {
      return buildHref('/medicines', { category: 'disease', subcategory: subcategoryName });
    }

    if (categoryName === 'Organic Products') {
      return buildHref('/medicines', {
        category: subcategoryName,
        productType: 'Organic Products',
        orgProductsView: 'true',
      });
    }

    // For all other categories (Nutrition, Personal Care, Fitness, etc.)
    return buildHref('/medicines', { category: categoryName.toLowerCase(), subcategory: subcategoryName });
  };

  const getCategoryHref = (category: Category) => {
    if (category.name === 'Ayurveda') return buildHref('/ayurveda');
    if (category.name === 'Homeopathy') return buildHref('/homeopathy');

    if (category.groupedSubcategories) {
      return buildHref('/medicines', { category: category.name.toLowerCase() });
    }

    return buildHref(category.href);
  };

  if (isMobile) {
    // Mobile menu version - expanded categories
    return (
      <div className="space-y-2 pb-2">
        {visibleCategories.map((category) => (
          <div key={category.name} className="border-b border-gray-100">
            <Link
              href={getCategoryHref(category)}
              className="flex items-center gap-2 py-2 text-emerald-700 hover:text-orange-500 font-medium"
            >
              <span>{category.name}</span>
            </Link>
            <div className="pl-6 space-y-1">
              {(Array.isArray(category.subcategories) ? category.subcategories : [])
                .slice(1, 6)
                .map((subcat, idx) => {
                return (
                  <Link
                    key={`${category.name}-${subcat}-${idx}`}
                    href={getSubcategoryHref(category.name, subcat)}
                    className="text-xs text-gray-600 hover:text-emerald-700 block py-1"
                  >
                    {subcat}
                  </Link>
                );
              })}
              {(Array.isArray(category.subcategories) ? category.subcategories : []).length > 6 && (
                <Link
                  href={getCategoryHref(category)}
                  className="text-xs text-emerald-600 hover:text-orange-500 font-semibold py-1"
                >
                  View All →
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Desktop menu version - with hover dropdowns
  return (
    <div
      className="hidden md:flex gap-0 mt-4 text-xs text-gray-700 border-t border-gray-100 pt-2 flex-nowrap relative pb-2 overflow-visible justify-center"
      data-nav-version="safe-v2"
    >
      {visibleCategories.map((category, index) => {
        const styles = getColorStyles(category.color);
        const grouped = sanitizeGroupedSubcategories(category.groupedSubcategories);
        // Prefer sanitized grouped maps over live tree (tree can throw on malformed nodes).
        let treeChildren: CategoryTreeNode[] | undefined;
        try {
          const children = getTreeNodeForCategory(categoryTree, category.name)?.children;
          treeChildren = Array.isArray(children) ? children : undefined;
        } catch {
          treeChildren = undefined;
        }
        const dropdownPositionClass =
          index <= 2
            ? 'left-0'
            : index >= visibleCategories.length - 2
              ? 'right-0'
              : 'left-1/2 -translate-x-1/2';

        return (
          <div
            key={category.name}
            className="relative group"
            onMouseEnter={() => setHoveredCategory(category.name)}
            onMouseLeave={() => setHoveredCategory(null)}
          >
          {/* Category Button */}
          <Link
            href={getCategoryHref(category)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded transition-all duration-200 ${styles.text} ${styles.hover} hover:text-orange-500 whitespace-nowrap text-xs`}
          >
            <span className="font-medium">{category.name}</span>
          </Link>

          {/* Dropdown Menu */}
          <div
            className={`absolute ${dropdownPositionClass} mt-0 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50`}
          >
            {category.name !== 'Disease' && Array.isArray(treeChildren) && treeChildren.length > 0 && !grouped ? (
              renderTreeDropdown(treeChildren, category.name, category.color)
            ) : grouped ? (
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-5" style={{ width: '780px', maxWidth: '80vw' }}>
                <h3 className={`text-base font-semibold mb-4 pb-3 border-b border-gray-200 ${styles.text}`}>
                  {category.name}
                </h3>
                <div className="overflow-x-auto pb-1">
                  <div
                    className="grid gap-4 overflow-y-auto pr-1"
                    style={{
                      gridTemplateColumns: 'repeat(3, minmax(240px, 1fr))',
                      minWidth: '900px',
                      maxHeight: '440px',
                    }}
                  >
                    {Object.entries(grouped).map(([groupName, subcats]) => (
                      <div key={groupName} className="min-w-0">
                        <Link
                          href={getSubcategoryHref(category.name, groupName)}
                          className={`block text-sm font-semibold mb-2 ${styles.text} hover:text-orange-500 truncate`}
                        >
                          {groupName}
                        </Link>
                        <div className="space-y-1">
                          {(Array.isArray(subcats) ? subcats : []).map((subcat) => (
                            <Link
                              key={`${groupName}-${subcat}`}
                              href={getSubcategoryHref(category.name, subcat)}
                              className="block text-xs text-gray-700 hover:text-orange-500 hover:bg-gray-50 rounded px-2 py-1 transition-colors"
                            >
                              {subcat}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.25rem', width: 'fit-content', maxWidth: '500px' }}>
                {(Array.isArray(category.subcategories) ? category.subcategories : ['All']).map((subcat, idx) => (
                  <Link
                    key={`${category.name}-${subcat}-${idx}`}
                    href={subcat === 'All' ? getCategoryHref(category) : getSubcategoryHref(category.name, subcat)}
                    className={`text-center px-2 py-2 text-sm rounded transition-colors duration-150 ${
                      idx === 0
                        ? `${styles.text} font-semibold col-span-full mb-2 pb-3 border-b border-gray-200 ${styles.hover}`
                        : 'text-gray-700 hover:bg-emerald-50 hover:rounded'
                    }`}
                  >
                    {subcat}
                  </Link>
                ))}
              </div>
            )}
          </div>
          </div>
        );
      })}

      {/* Other Navigation Links */}
      <div className="flex gap-0 items-center">
        <Link
          href="/doctor-consultation"
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-emerald-700 hover:text-orange-500 hover:bg-emerald-50 font-medium transition-all whitespace-nowrap text-xs"
        >
          Consult Doctor
        </Link>
        <Link
          href="/lab-tests"
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-emerald-700 hover:text-orange-500 hover:bg-emerald-50 font-medium transition-all whitespace-nowrap text-xs"
        >
          Lab Tests
        </Link>
      </div>
    </div>
  );
}

/** Prevent a nav-only crash from blanking the entire desktop site. */
class CategoryNavErrorBoundary extends Component<
  { children: ReactNode; isMobile?: boolean },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[CategoryNav] render failed', error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.isMobile) {
        return (
          <div className="space-y-2 pb-2">
            <Link href="/ayurveda" className="block py-2 text-emerald-700 font-medium">Ayurveda</Link>
            <Link href="/homeopathy" className="block py-2 text-emerald-700 font-medium">Homeopathy</Link>
            <Link href="/medicines?category=disease" className="block py-2 text-emerald-700 font-medium">Disease</Link>
          </div>
        );
      }
      return (
        <div className="hidden md:flex gap-3 mt-4 text-xs border-t border-gray-100 pt-2 justify-center">
          <Link href="/ayurveda" className="px-2 py-1 text-emerald-700 font-medium">Ayurveda</Link>
          <Link href="/homeopathy" className="px-2 py-1 text-emerald-700 font-medium">Homeopathy</Link>
          <Link href="/medicines?category=disease" className="px-2 py-1 text-emerald-700 font-medium">Disease</Link>
          <Link href="/doctor-consultation" className="px-2 py-1 text-emerald-700 font-medium">Consult Doctor</Link>
          <Link href="/lab-tests" className="px-2 py-1 text-emerald-700 font-medium">Lab Tests</Link>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function CategoryNav({ isMobile = false }: { isMobile?: boolean }) {
  return (
    <CategoryNavErrorBoundary isMobile={isMobile}>
      <CategoryNavInner isMobile={isMobile} />
    </CategoryNavErrorBoundary>
  );
}
