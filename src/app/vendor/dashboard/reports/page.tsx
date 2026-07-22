'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const REPORT_TYPES = [
  { id: 'sales', label: 'Sales' },
  { id: 'best-selling', label: 'Best Selling' },
  { id: 'products', label: 'Products' },
  { id: 'returns', label: 'Returns' },
  { id: 'settlements', label: 'Settlements' },
];

export default function VendorReportsPage() {
  const router = useRouter();
  const [type, setType] = useState('sales');
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);

  const authHeaders = (): HeadersInit => {
    const token = localStorage.getItem('vendorToken') || '';
    return { Authorization: `Bearer ${token}` };
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/vendor/reports?type=${type}&format=json`, {
        headers: authHeaders(),
        cache: 'no-store',
      });
      if (res.status === 401) {
        router.push('/vendor/login');
        return;
      }
      const data = await res.json();
      setRows(data.rows || []);
      setSummary(data.summary || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!localStorage.getItem('vendorToken')) {
      router.push('/vendor/login');
      return;
    }
    load();
  }, [type, router]);

  const downloadCsv = () => {
    const token = localStorage.getItem('vendorToken') || '';
    // Fetch as blob with auth header
    fetch(`/api/vendor/reports?type=${type}&format=csv`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vendor-${type}-report.csv`;
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch(console.error);
  };

  const headers = rows.length ? Object.keys(rows[0]) : [];

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Link href="/vendor/dashboard" className="text-emerald-600 font-semibold text-sm">
          ← Back to Dashboard
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4 mt-3 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Reports</h1>
            <p className="text-slate-600">Sales, products, returns, and settlements</p>
          </div>
          <button
            onClick={downloadCsv}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-semibold text-sm"
          >
            Export CSV
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {REPORT_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setType(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                type === t.id ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {Object.entries(summary).map(([k, v]) => (
            <div key={k} className="bg-white border border-slate-200 rounded-lg p-4">
              <p className="text-xs uppercase text-slate-500 font-semibold">{k}</p>
              <p className="text-xl font-bold text-slate-900 mt-1">
                {typeof v === 'number' ? v.toLocaleString('en-IN') : String(v)}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-x-auto">
          {loading ? (
            <p className="p-6 text-slate-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="p-8 text-center text-slate-500">No data for this report</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    {headers.map((h) => (
                      <td key={h} className="px-4 py-3 text-slate-700">
                        {String(row[h] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
