'use client';

import { useEffect, useState } from 'react';

interface VendorBankRow {
  id: string;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string;
  preferredWithdrawalMethod: string;
  isVerified: boolean;
  isActive: boolean;
  verifiedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
  vendor: {
    id: string;
    vendorName: string;
    email: string;
    phone: string;
    status: string;
  } | null;
}

export default function AdminBankDetailsPage() {
  const [rows, setRows] = useState<VendorBankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'verified' | 'rejected' | 'all'>('pending');
  const [message, setMessage] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);

  const adminHeaders = (extra: Record<string, string> = {}): HeadersInit => ({
    Authorization: `Bearer ${localStorage.getItem('adminToken') || ''}`,
    ...extra,
  });

  const loadRows = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`/api/admin/bank-details?status=${filter}&limit=50`, {
        headers: adminHeaders(),
        cache: 'no-store',
      });
      const data = await res.json();
      if (res.ok) {
        setRows(data.bankDetails || []);
      } else {
        setMessage(data.error || 'Failed to load bank details');
        setRows([]);
      }
    } catch (e) {
      console.error(e);
      setMessage('Failed to load bank details');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleAction = async (bankDetailsId: string, action: 'approve' | 'reject') => {
    setProcessingId(bankDetailsId);
    setMessage('');
    try {
      const res = await fetch('/api/admin/bank-details', {
        method: 'PUT',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          bankDetailsId,
          action,
          adminNotes: action === 'reject' ? rejectNotes : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message || `Bank details ${action}d`);
        setRejectTargetId(null);
        setRejectNotes('');
        await loadRows();
      } else {
        setMessage(data.error || `Failed to ${action} bank details`);
      }
    } catch (e) {
      console.error(e);
      setMessage(`Failed to ${action} bank details`);
    } finally {
      setProcessingId(null);
    }
  };

  const statusBadge = (row: VendorBankRow) => {
    if (row.isVerified) {
      return <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">Verified</span>;
    }
    if (!row.isActive) {
      return <span className="text-xs font-semibold text-red-700 bg-red-50 px-2 py-1 rounded">Rejected</span>;
    }
    return <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded">Pending Verification</span>;
  };

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Vendor Bank Details</h1>
          <p className="text-sm text-slate-600 mt-1">
            Review and verify bank accounts submitted by vendors for withdrawals and settlements.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {(['pending', 'verified', 'rejected', 'all'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${
                filter === tab
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {message && (
          <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            message.toLowerCase().includes('invalid') || message.toLowerCase().includes('expired') || message.toLowerCase().includes('auth')
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-slate-200 bg-white text-slate-700'
          }`}>
            {message}
            {(message.toLowerCase().includes('invalid') || message.toLowerCase().includes('expired') || message.toLowerCase().includes('auth')) && (
              <a href="/login" className="ml-2 underline font-medium">
                Log in again
              </a>
            )}
          </div>
        )}

        {loading ? (
          <p className="text-slate-500">Loading bank details…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-slate-600">No {filter === 'all' ? '' : filter + ' '}bank details found.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((row) => (
              <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {row.vendor?.vendorName || 'Unknown Vendor'}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {row.vendor?.email || '—'}
                      {row.vendor?.phone ? ` · ${row.vendor.phone}` : ''}
                    </p>
                  </div>
                  {statusBadge(row)}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
                  <div>
                    <p className="text-slate-500">Account Holder</p>
                    <p className="font-medium text-slate-900">{row.accountHolderName}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Bank Name</p>
                    <p className="font-medium text-slate-900">{row.bankName}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Account Number</p>
                    <p className="font-medium text-slate-900 tracking-wide">{row.accountNumber}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">IFSC Code</p>
                    <p className="font-medium text-slate-900">{row.ifscCode}</p>
                  </div>
                  {row.upiId ? (
                    <div>
                      <p className="text-slate-500">UPI ID</p>
                      <p className="font-medium text-slate-900">{row.upiId}</p>
                    </div>
                  ) : null}
                  <div>
                    <p className="text-slate-500">Preferred Method</p>
                    <p className="font-medium text-slate-900 capitalize">
                      {(row.preferredWithdrawalMethod || 'bank_transfer').replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>

                {!row.isVerified && row.isActive && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={processingId === row.id}
                      onClick={() => handleAction(row.id, 'approve')}
                      className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {processingId === row.id ? 'Processing…' : 'Approve / Verify'}
                    </button>
                    <button
                      type="button"
                      disabled={processingId === row.id}
                      onClick={() => setRejectTargetId(rejectTargetId === row.id ? null : row.id)}
                      className="px-4 py-2 rounded-lg border border-red-200 text-red-700 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}

                {rejectTargetId === row.id && (
                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={rejectNotes}
                      onChange={(e) => setRejectNotes(e.target.value)}
                      placeholder="Rejection reason (optional)"
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      disabled={processingId === row.id}
                      onClick={() => handleAction(row.id, 'reject')}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                    >
                      Confirm Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
