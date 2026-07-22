'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type CategoryTreeNode = {
  _id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  children: CategoryTreeNode[];
};

type DynamicCategoryConfig = {
  vendorCategoryMap?: Record<string, string[]>;
  subcategoryMapByType?: Record<string, Record<string, string[]>>;
  diseaseSubcategoryMap?: Record<string, string[]>;
};

const PRIMARY_MEDICINE_CATEGORIES = [
  'Medicines',
  'Ayurveda',
  'Homeopathy',
  'Nutrition',
  'Organic Products',
  'Personal Care',
  'Fitness',
  'Sexual Wellness',
  'Disease',
  'Unani',
];

const MANAGEMENT_CATEGORY_NAMES = [
  'Nutrition',
  'Organic Products',
  'Personal Care',
  'Fitness',
  'Sexual Wellness',
  'Disease',
  'Unani',
];

const CATEGORY_ACCENT_CLASSES: Record<string, string> = {
  Medicines: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  Ayurveda: 'border-green-200 bg-green-50 text-green-800',
  Homeopathy: 'border-pink-200 bg-pink-50 text-pink-800',
  Nutrition: 'border-lime-200 bg-lime-50 text-lime-800',
  'Organic Products': 'border-amber-200 bg-amber-50 text-amber-800',
  'Personal Care': 'border-cyan-200 bg-cyan-50 text-cyan-800',
  Fitness: 'border-sky-200 bg-sky-50 text-sky-800',
  'Sexual Wellness': 'border-rose-200 bg-rose-50 text-rose-800',
  Disease: 'border-red-200 bg-red-50 text-red-800',
  Unani: 'border-indigo-200 bg-indigo-50 text-indigo-800',
};

const normalizeName = (value: string) => value?.trim().toLowerCase() || '';

function findNodeByName(nodes: CategoryTreeNode[], name: string): CategoryTreeNode | null {
  for (const node of nodes) {
    if (normalizeName(node.name) === normalizeName(name)) {
      return node;
    }
    const found = findNodeByName(node.children, name);
    if (found) {
      return found;
    }
  }
  return null;
}

function getHierarchyGroups(config: DynamicCategoryConfig | null, categoryName: string): string[] {
  if (!config) return [];

  const vendorMap = config.vendorCategoryMap || {};
  const subByType = config.subcategoryMapByType || {};
  const diseaseMap = config.diseaseSubcategoryMap || {};

  if (categoryName === 'Medicines') {
    if (Object.keys(diseaseMap).length > 0) return Object.keys(diseaseMap);
    return vendorMap['Generic Medicine'] || [];
  }

  if (categoryName === 'Disease') {
    return Object.keys(diseaseMap);
  }

  if (categoryName === 'Ayurveda') {
    return Object.keys(subByType.Ayurveda || subByType['Ayurveda Medicine'] || {});
  }

  if (categoryName === 'Homeopathy') {
    return Object.keys(subByType.Homeopathy || {});
  }

  if (categoryName === 'Nutrition') {
    return Object.keys(subByType.Nutrition || {}).filter(
      (name) => normalizeName(name) !== 'organic products'
    );
  }

  if (categoryName === 'Organic Products') {
    const asType = Object.keys(subByType['Organic Products'] || {});
    if (asType.length > 0) return asType;
    return vendorMap['Organic Products'] || [];
  }

  if (categoryName === 'Personal Care') {
    return Object.keys(subByType['Personal Care'] || {});
  }

  if (categoryName === 'Fitness') {
    return Object.keys(subByType.Fitness || {});
  }

  if (categoryName === 'Sexual Wellness') {
    const mapped = Object.keys(subByType['Sexual Wellness'] || {});
    return mapped.length > 0 ? mapped : vendorMap['Sexual Wellness'] || [];
  }

  if (categoryName === 'Unani') {
    return Object.keys(subByType.Unani || {});
  }

  return [];
}

export default function AdminCategoriesPage() {
  const [tree, setTree] = useState<CategoryTreeNode[]>([]);
  const [categoryConfig, setCategoryConfig] = useState<DynamicCategoryConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newRootName, setNewRootName] = useState('');

  const buildCategorySections = useCallback((nodes: CategoryTreeNode[]) => {
    const productRootNames = ['product types', 'product type', 'products'];
    const isProductRoot = (name: string) => productRootNames.includes(normalizeName(name));
    const productTypesRoot = nodes.find((node) => isProductRoot(node.name));
    const diseaseRoot = nodes.find(
      (node) => normalizeName(node.name) === 'disease categories' || normalizeName(node.name) === 'disease'
    );
    const otherRoots = nodes.filter(
      (node) => !isProductRoot(node.name) && normalizeName(node.name) !== 'disease categories' && normalizeName(node.name) !== 'disease'
    );

    return {
      productTypes: productTypesRoot?.children || [],
      diseases: diseaseRoot?.children || [],
      otherRoots,
    };
  }, []);

  const categoryGroupSections = useMemo(() => {
    const findSectionNode = (name: string) => {
      if (normalizeName(name) === 'disease') {
        return findNodeByName(tree, 'Disease Categories') || findNodeByName(tree, 'Disease');
      }
      return findNodeByName(tree, name);
    };

    return MANAGEMENT_CATEGORY_NAMES.map((categoryName) => {
      const node = findSectionNode(categoryName);
      return {
        name: categoryName,
        node,
        sectionId: node ? `group-section-${node._id}` : undefined,
      };
    });
  }, [tree]);

  const fetchTree = useCallback(async () => {
    setLoading(true);
    try {
      const [treeResponse, configResponse] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/categories?mode=config'),
      ]);

      const treeData = await treeResponse.json();
      if (treeData?.success) {
        setTree(treeData.tree || []);
      }

      const configData = await configResponse.json();
      if (configData?.success) {
        setCategoryConfig(configData.config || null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const createNode = async (name: string, parentId: string | null) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusyId(parentId || 'root');
    try {
      await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed, parentId }),
      });
      await fetchTree();
    } finally {
      setBusyId(null);
    }
  };

  const renameNode = async (node: CategoryTreeNode) => {
    const name = prompt('Update category name', node.name)?.trim();
    if (!name || name === node.name) return;
    setBusyId(node._id);
    try {
      await fetch(`/api/categories/${node._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      await fetchTree();
    } finally {
      setBusyId(null);
    }
  };

  const deleteNode = async (node: CategoryTreeNode) => {
    const confirmed = confirm(`Delete "${node.name}" and all nested subcategories?`);
    if (!confirmed) return;
    setBusyId(node._id);
    try {
      await fetch(`/api/categories/${node._id}`, { method: 'DELETE' });
      await fetchTree();
    } finally {
      setBusyId(null);
    }
  };

  const getGroupParentId = (groupName: string): string | null => {
    const productTypesRoot = findNodeByName(tree, 'Product Types');
    const diseaseRoot = findNodeByName(tree, 'Disease Categories') || findNodeByName(tree, 'Disease');

    if (normalizeName(groupName) === 'disease') {
      return diseaseRoot?._id ?? null;
    }

    if (normalizeName(groupName) === 'organic products') {
      return productTypesRoot?._id ?? null;
    }

    return productTypesRoot?._id ?? null;
  };

  const addMissingCategoryGroup = async (name: string) => {
    const parentId = getGroupParentId(name);
    if (parentId === null) {
      await createNode(name, null);
      return;
    }
    await createNode(name, parentId);
  };

  const NodeView = ({ node, depth }: { node: CategoryTreeNode; depth: number }) => {
    const [newChildName, setNewChildName] = useState('');

    return (
      <div id={`category-section-${node._id}`} className="mt-3">
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
          style={{ marginLeft: `${depth * 18}px` }}
        >
          <span className="text-sm font-semibold text-slate-800">{node.name}</span>
          <span className="text-xs text-slate-500">({node.children.length} child)</span>
          <button
            onClick={() => renameNode(node)}
            disabled={busyId === node._id}
            className="ml-auto rounded-md border border-blue-200 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50 disabled:opacity-50"
          >
            Rename
          </button>
          <button
            onClick={() => deleteNode(node)}
            disabled={busyId === node._id}
            className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        </div>

        <div className="mt-2 flex gap-2" style={{ marginLeft: `${depth * 18 + 18}px` }}>
          <input
            value={newChildName}
            onChange={(e) => setNewChildName(e.target.value)}
            placeholder="Add child category"
            className="w-full max-w-md rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={async () => {
              await createNode(newChildName, node._id);
              setNewChildName('');
            }}
            disabled={busyId === node._id || !newChildName.trim()}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Add
          </button>
        </div>

        {node.children.map((child) => (
          <NodeView key={child._id} node={child} depth={depth + 1} />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <Link href="/admin" className="text-sm font-medium text-blue-700 hover:text-blue-900">
              ← Back to Dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">Category Layer Management</h1>
            <p className="text-sm text-slate-600">
              Manage category, subcategory, nested subcategory, and deeper levels. Forms update dynamically from this tree.
            </p>
            <p className="text-sm text-slate-600">
              Product Types and Disease Categories are flattened into their child level so menu categories like Nutrition, Organic Products, Personal Care, Fitness, Sexual Wellness, Disease, and Unani are easier to find and edit.
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Add Root Category</h2>
          <div className="flex flex-wrap gap-2">
            <input
              value={newRootName}
              onChange={(e) => setNewRootName(e.target.value)}
              placeholder="Example: Product Types or Disease Categories"
              className="w-full max-w-xl rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={async () => {
                await createNode(newRootName, null);
                setNewRootName('');
              }}
              disabled={busyId === 'root' || !newRootName.trim()}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Add Root
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Manage Core Category Groups</h2>
          <p className="mb-4 text-xs text-slate-600">
            Quick access links for Nutrition, Organic Products, Personal Care, Fitness, Sexual Wellness, Disease, and Unani category management.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categoryGroupSections.map(({ name, node, sectionId }) => (
              <div key={name} className="rounded-lg border p-3 bg-slate-50">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-slate-900">{name}</h3>
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                    {node ? `${node.children.length} children` : 'Not found'}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (sectionId) {
                        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
                      }
                    }}
                    className="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    disabled={!sectionId}
                  >
                    Manage
                  </button>
                  {node ? (
                    <span className="rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-700">
                      {node.children.length} child node{node.children.length === 1 ? '' : 's'}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Core Category Group Management</h2>
          <p className="mb-4 text-xs text-slate-600">
            Direct management panels for Nutrition, Organic Products, Personal Care, Fitness, Sexual Wellness, Disease, and Unani.
          </p>
          <div className="space-y-6">
            {categoryGroupSections.map(({ name, node, sectionId }) => (
              <div key={name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4" id={sectionId}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-800">{name}</h3>
                    {node ? (
                      <p className="text-xs text-slate-500">{node.children.length} child node{node.children.length === 1 ? '' : 's'}</p>
                    ) : (
                      <p className="text-xs text-slate-500">Category not found in tree yet.</p>
                    )}
                  </div>
                </div>
                {node ? (
                  <NodeView node={node} depth={0} />
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600">
                      This category group is not available in the current category tree. Add it under Product Types or Disease Categories to manage it here.
                    </p>
                    <button
                      type="button"
                      onClick={() => addMissingCategoryGroup(name)}
                      className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      Add {name}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Medicine Category Hierarchy Cards</h2>
          <p className="mb-4 text-xs text-slate-600">
            These cards drive user header hover hierarchy. Any add, update, or delete done in this panel updates this data and is reflected for users.
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PRIMARY_MEDICINE_CATEGORIES.map((categoryName) => {
              const groups = getHierarchyGroups(categoryConfig, categoryName);
              const accentClass = CATEGORY_ACCENT_CLASSES[categoryName] || 'border-slate-200 bg-slate-50 text-slate-800';

              return (
                <div key={categoryName} className={`rounded-lg border p-3 ${accentClass}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold">{categoryName}</h3>
                    <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold">
                      {groups.length} levels
                    </span>
                  </div>

                  {groups.length === 0 ? (
                    <p className="mt-2 text-xs">No hierarchy available yet.</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {groups.slice(0, 6).map((groupName) => (
                        <span
                          key={`${categoryName}-${groupName}`}
                          className="rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-medium"
                        >
                          {groupName}
                        </span>
                      ))}
                      {groups.length > 6 && (
                        <span className="rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-medium">
                          +{groups.length - 6} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-100 p-4">
          {loading ? (
            <div className="py-10 text-center text-slate-500">Loading category tree...</div>
          ) : tree.length === 0 ? (
            <div className="py-10 text-center text-slate-500">No categories found. Create your first root category.</div>
          ) : (
            (() => {
              const { productTypes, diseases, otherRoots } = buildCategorySections(tree);

              return (
                <div className="space-y-8">
                  {productTypes.length > 0 && (
                    <div>
                      <h2 className="mb-3 text-lg font-semibold text-slate-900">Product Type Categories</h2>
                      <div className="grid gap-4 lg:grid-cols-2">
                        {productTypes.map((node) => {
                          const sectionId = `category-section-${node.name.replace(/[^a-zA-Z0-9]+/g, '-')}`;
                          return (
                            <section key={node._id} id={sectionId} className="rounded-2xl border border-slate-200 bg-white p-4">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                  <h3 className="text-base font-semibold text-slate-800">{node.name}</h3>
                                  <p className="text-xs text-slate-500">{node.children.length} subcategory{node.children.length === 1 ? '' : 'ies'}</p>
                                </div>
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                                  Product Type
                                </span>
                              </div>
                              <NodeView node={node} depth={0} />
                            </section>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {diseases.length > 0 && (
                    <div>
                      <h2 className="mb-3 text-lg font-semibold text-slate-900">Disease Categories</h2>
                      <div className="grid gap-4 lg:grid-cols-2">
                        {diseases.map((node) => {
                          const sectionId = `category-section-${node.name.replace(/[^a-zA-Z0-9]+/g, '-')}`;
                          return (
                            <section key={node._id} id={sectionId} className="rounded-2xl border border-slate-200 bg-white p-4">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                  <h3 className="text-base font-semibold text-slate-800">{node.name}</h3>
                                  <p className="text-xs text-slate-500">{node.children.length} subcategory{node.children.length === 1 ? '' : 'ies'}</p>
                                </div>
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                                  Disease Group
                                </span>
                              </div>
                              <NodeView node={node} depth={0} />
                            </section>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {otherRoots.length > 0 && (
                    <div>
                      <h2 className="mb-3 text-lg font-semibold text-slate-900">Other Category Roots</h2>
                      <div className="grid gap-4 lg:grid-cols-2">
                        {otherRoots.map((node) => {
                          const sectionId = `category-section-${node.name.replace(/[^a-zA-Z0-9]+/g, '-')}`;
                          return (
                            <section key={node._id} id={sectionId} className="rounded-2xl border border-slate-200 bg-white p-4">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                  <h3 className="text-base font-semibold text-slate-800">{node.name}</h3>
                                  <p className="text-xs text-slate-500">{node.children.length} subcategory{node.children.length === 1 ? '' : 'ies'}</p>
                                </div>
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                                  Root Category
                                </span>
                              </div>
                              <NodeView node={node} depth={0} />
                            </section>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </div>
      </div>
    </div>
  );
}
