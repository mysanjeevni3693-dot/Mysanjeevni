'use client';

import { useEffect, useState } from 'react';

interface VendorSettlementRow {
  vendorId: string;
  vendorName: string;
  email: string;
  status: string;
  grossSales: number;
  commission: number;
  netEarnings: number;
  alreadyPaid: number;
  remainingBalance: number;
}

interface SettlementRecord {
  _id: string;
  amount: number;
  paymentMethod: string;
  transactionId?: string;
  referenceNumber?: string;
  notes?: string;
  status: string;
  paidAt?: string;
  createdAt?: string;
}

export default function AdminSettlementsPage() {
  const [rows, setRows] = useState<VendorSettlementRow[]>([]);
  const [totals, setTotals] = useState({
    grossSales: 0,
    commission: 0,
    remainingBalance: 0,
    alreadyPaid: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [history, setHistory] = useState<SettlementRecord[]>([]);
  const [form, setForm] = useState({
    amount: '',
    paymentMethod: 'bank_transfer',
    transactionId: '',
    referenceNumber: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const adminHeaders = (extra: Record<string, string> = {}): HeadersInit => ({
    Authorization: `Bearer ${localStorage.getItem('adminToken') || ''}`,
    ...extra,
  });

  const loadOverview = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settlements?all=true', {
        headers: adminHeaders(),
        cache: 'no-store',
      });
      const data = await res.json();
      if (res.ok) {
        setRows(data.vendors || []);
        setTotals(data.totals || totals);
      } else {
        setMessage(data.error || 'Failed to load settlements');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadVendorDetail = async (vendorId: string) => {
    if (!vendorId) {
      setHistory([]);
      return;
    }
    try {
      const res = await fetch(`/api/admin/settlements?vendorId=${vendorId}`, {
        headers: adminHeaders(),
        cache: 'no-store',
      });
      const data = await res.json();
      if (res.ok) {
        setHistory(data.settlements || []);
        const bal = data.summary?.remainingBalance;
        if (typeof bal === 'number' && !form.amount) {
          setForm((f) => ({ ...f, amount: bal > 0 ? String(bal) : '' }));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    if (selectedVendorId) loadVendorDetail(selectedVendorId);
  }, [selectedVendorId]);

  const recordSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVendorId) {
      setMessage('Select a vendor first');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/settlements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...adminHeaders(),
        },
        body: JSON.stringify({
          vendorId: selectedVendorId,
          amount: Number(form.amount),
          paymentMethod: form.paymentMethod,
          transactionId: form.transactionId,
          referenceNumber: form.referenceNumber,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record settlement');
      setMessage('Settlement recorded successfully');
      setForm({ amount: '', paymentMethod: 'bank_transfer', transactionId: '', referenceNumber: '', notes: '' });
      await loadOverview();
      await loadVendorDetail(selectedVendorId);
    } catch (err: any) {
      setMessage(err?.message || 'Failed to record settlement');
    } finally {
      setSaving(false);
    }
  };

  const selected = rows.find((r) => r.vendorId === selectedVendorId);

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Vendor Settlements</h1>
        <p className="text-slate-600 mt-1">
          Customer payments stay with MySanjeevni. Record manual payouts to vendors here.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Marketplace Gross Sales', value: totals.grossSales, color: 'text-emerald-600' },
          { label: 'Platform Commission', value: totals.commission, color: 'text-orange-600' },
          { label: 'Pending Settlement', value: totals.remainingBalance, color: 'text-blue-600' },
          { label: 'Already Paid', value: totals.alreadyPaid, color: 'text-slate-700' },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-lg shadow border border-slate-200 p-5">
            <p className="text-xs uppercase text-slate-500 font-semibold">{c.label}</p>
            <p className={`text-2xl font-bold mt-2 ${c.color}`}>₹{Number(c.value || 0).toLocaleString('en-IN')}</p>
          </div>
        ))}
      </div>

      {message && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800">{message}</div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 font-semibold text-slate-900">Vendors</div>
          {loading ? (
            <p className="p-6 text-slate-500">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Vendor</th>
                    <th className="px-4 py-3">Gross</th>
                    <th className="px-4 py-3">Commission</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr
                      key={r.vendorId}
                      onClick={() => setSelectedVendorId(r.vendorId)}
                      className={`cursor-pointer hover:bg-emerald-50 ${
                        selectedVendorId === r.vendorId ? 'bg-emerald-50' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{r.vendorName}</p>
                        <p className="text-xs text-slate-500">{r.email}</p>
                      </td>
                      <td className="px-4 py-3">₹{r.grossSales.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3">₹{r.commission.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3">₹{r.alreadyPaid.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 font-bold text-emerald-700">
                        ₹{r.remainingBalance.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                        No vendors found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow border border-slate-200 p-5">
            <h2 className="font-bold text-slate-900 mb-1">Record Settlement</h2>
            <p className="text-xs text-slate-500 mb-4">
              {selected
                ? `${selected.vendorName} — available ₹${selected.remainingBalance.toLocaleString('en-IN')}`
                : 'Select a vendor from the table'}
            </p>
            <form onSubmit={recordSettlement} className="space-y-3">
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                disabled={!selectedVendorId}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="Amount (INR)"
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
              <select
                value={form.paymentMethod}
                disabled={!selectedVendorId}
                onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              >
                <option value="bank_transfer">Bank Transfer</option>
                <option value="upi">UPI</option>
                <option value="neft">NEFT</option>
                <option value="rtgs">RTGS</option>
                <option value="imps">IMPS</option>
                <option value="other">Other</option>
              </select>
              <input
                type="text"
                disabled={!selectedVendorId}
                value={form.transactionId}
                onChange={(e) => setForm({ ...form, transactionId: e.target.value })}
                placeholder="Transaction ID / UTR"
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
              <input
                type="text"
                disabled={!selectedVendorId}
                value={form.referenceNumber}
                onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
                placeholder="Reference number"
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
              <textarea
                disabled={!selectedVendorId}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notes"
                rows={2}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
              <button
                type="submit"
                disabled={!selectedVendorId || saving}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg"
              >
                {saving ? 'Saving…' : 'Mark Settlement as Paid'}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-lg shadow border border-slate-200 p-5">
            <h2 className="font-bold text-slate-900 mb-3">Settlement History</h2>
            {!selectedVendorId ? (
              <p className="text-sm text-slate-500">Select a vendor to view history</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-slate-500">No settlements yet</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {history.map((s) => (
                  <div key={s._id} className="border-b border-slate-100 pb-2 text-sm">
                    <div className="flex justify-between">
                      <span className="font-semibold text-emerald-700">₹{Number(s.amount).toFixed(2)}</span>
                      <span className="text-xs text-slate-500 capitalize">{s.paymentMethod}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {s.transactionId ? `Txn: ${s.transactionId}` : 'No txn id'} ·{' '}
                      {s.paidAt || s.createdAt
                        ? new Date(s.paidAt || s.createdAt || '').toLocaleDateString('en-IN')
                        : ''}
                    </p>
                    {s.notes && <p className="text-xs text-slate-600 mt-0.5">{s.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
