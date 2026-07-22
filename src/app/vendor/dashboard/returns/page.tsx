'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ReturnItem {
  _id: string;
  orderId: string;
  productName: string;
  userName: string;
  userEmail: string;
  reason: string;
  preferredResolution: string;
  status: string;
  vendorNote?: string;
  supportNote?: string;
  createdAt?: string;
}

export default function VendorReturnsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<ReturnItem[]>([]);
  const [counts, setCounts] = useState<any>({});
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ReturnItem | null>(null);
  const [vendorNote, setVendorNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const authHeaders = (): HeadersInit => {
    const token = localStorage.getItem('vendorToken') || '';
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/vendor/returns?status=${status}`, {
        headers: authHeaders(),
        cache: 'no-store',
      });
      if (res.status === 401) {
        router.push('/vendor/login');
        return;
      }
      const data = await res.json();
      setRequests(data.requests || []);
      setCounts(data.counts || {});
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
  }, [status, router]);

  const act = async (action: string) => {
    if (!selected) return;
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/vendor/returns', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          returnId: selected._id,
          action,
          vendorNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      setMessage(`Return ${action}d successfully`);
      setSelected(null);
      setVendorNote('');
      await load();
    } catch (e: any) {
      setMessage(e?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <Link href="/vendor/dashboard" className="text-emerald-600 font-semibold text-sm">
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 mt-3">Returns & Refunds</h1>
        <p className="text-slate-600 mb-6">Review customer return requests for your products</p>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
          {[
            { key: 'all', label: 'All', value: counts.all || 0 },
            { key: 'new', label: 'Pending', value: counts.pending || 0 },
            { key: 'approved', label: 'Approved', value: counts.approved || 0 },
            { key: 'rejected', label: 'Rejected', value: counts.rejected || 0 },
            { key: 'completed', label: 'Completed', value: counts.completed || 0 },
            { key: 'escalated', label: 'Escalated', value: counts.escalated || 0 },
          ].map((c) => (
            <button
              key={c.key}
              onClick={() => setStatus(c.key)}
              className={`rounded-lg border p-3 text-left ${
                status === c.key
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <p className="text-xs text-slate-500 uppercase">{c.label}</p>
              <p className="text-xl font-bold text-slate-900">{c.value}</p>
            </button>
          ))}
        </div>

        {message && <p className="mb-4 text-sm text-slate-700 bg-white border rounded-lg px-4 py-2">{message}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <p className="p-6 text-slate-500">Loading…</p>
            ) : requests.length === 0 ? (
              <p className="p-8 text-center text-slate-500">No return requests</p>
            ) : (
              <div className="divide-y">
                {requests.map((r) => (
                  <button
                    key={r._id}
                    type="button"
                    onClick={() => {
                      setSelected(r);
                      setVendorNote(r.vendorNote || '');
                    }}
                    className={`w-full text-left px-5 py-4 hover:bg-slate-50 ${
                      selected?._id === r._id ? 'bg-emerald-50' : ''
                    }`}
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{r.productName}</p>
                        <p className="text-xs text-slate-500">
                          Order {r.orderId} · {r.userName}
                        </p>
                      </div>
                      <span className="text-xs font-semibold capitalize px-2 py-1 rounded-full bg-slate-100 text-slate-700 h-fit">
                        {r.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-2 line-clamp-2">{r.reason}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
            {!selected ? (
              <p className="text-sm text-slate-500">Select a request to respond</p>
            ) : (
              <div className="space-y-3">
                <h2 className="font-bold text-slate-900">Respond</h2>
                <p className="text-sm text-slate-600">
                  <strong>{selected.productName}</strong>
                  <br />
                  Resolution: {selected.preferredResolution}
                </p>
                <p className="text-sm text-slate-700 bg-slate-50 rounded p-3">{selected.reason}</p>
                <textarea
                  value={vendorNote}
                  onChange={(e) => setVendorNote(e.target.value)}
                  rows={3}
                  placeholder="Your response / evidence notes"
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button disabled={saving} onClick={() => act('review')} className="px-3 py-2 rounded-lg bg-sky-600 text-white text-sm font-semibold disabled:opacity-50">
                    Mark Review
                  </button>
                  <button disabled={saving} onClick={() => act('approve')} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50">
                    Approve
                  </button>
                  <button disabled={saving} onClick={() => act('reject')} className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-50">
                    Reject
                  </button>
                  <button disabled={saving} onClick={() => act('complete')} className="px-3 py-2 rounded-lg bg-slate-800 text-white text-sm font-semibold disabled:opacity-50">
                    Complete
                  </button>
                </div>
                <button
                  disabled={saving}
                  onClick={() => act('escalate')}
                  className="w-full px-3 py-2 rounded-lg border border-orange-300 text-orange-700 text-sm font-semibold disabled:opacity-50"
                >
                  Escalate to Admin
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
