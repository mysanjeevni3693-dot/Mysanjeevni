'use client';

import { useState, useEffect } from 'react';
import { DocumentViewer } from '@/components/DocumentViewer';

interface Vendor {
  _id: string;
  vendorName: string;
  email: string;
  phone: string;
  businessType: string;
  medicineType?: string;
  status: string;
  rating?: number;
  totalReviews?: number;
  totalOrders?: number;
  rejectionReason?: string;
  aadharCardUrl?: string;
  panCardUrl?: string;
  gstCertificateUrl?: string;
  drugLicenseUrl?: string;
  businessAddress?: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  };
}

export default function AdminVendors() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchVendors();
  }, [filter]);

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/vendors?status=${filter}`);
      if (!response.ok) throw new Error('Failed to fetch vendors');
      const data = await response.json();
      setVendors(data.vendors || []);
    } catch (err: unknown) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (vendorId: string) => {
    try {
      const response = await fetch('/api/admin/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId,
          action: 'approve',
        }),
      });

      if (!response.ok) throw new Error('Failed to approve vendor');
      setMessage('✅ Vendor approved successfully');
      fetchVendors();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      setMessage('❌ ' + error);
    }
  };

  const handleReject = async (vendorId: string) => {
    if (!rejectionReason.trim()) {
      setMessage('⚠️ Please provide rejection reason');
      return;
    }

    try {
      const response = await fetch('/api/admin/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId,
          action: 'reject',
          rejectionReason,
        }),
      });

      if (!response.ok) throw new Error('Failed to reject vendor');
      setMessage('✅ Vendor rejected (account retained — can be reactivated later)');
      setSelectedVendor(null);
      setRejectionReason('');
      fetchVendors();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      setMessage('❌ ' + error);
    }
  };

  const handleSuspend = async (vendorId: string) => {
    try {
      const response = await fetch('/api/admin/vendors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId,
          action: 'suspend',
        }),
      });

      if (!response.ok) throw new Error('Failed to suspend vendor');
      setMessage('✅ Vendor suspended');
      fetchVendors();
      setTimeout(() => setMessage(''), 3000);
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      setMessage('❌ ' + error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Vendor Management</h1>

          {message && (
            <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4">
              {message}
            </div>
          )}

          <div className="flex gap-4 mb-6">
            {['pending', 'verified', 'rejected', 'suspended'].map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg font-semibold transition ${
                  filter === status
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-500">Loading vendors...</div>
        ) : vendors.length === 0 ? (
          <div className="text-center text-gray-500">No vendors found</div>
        ) : (
          <div className="grid gap-6">
            {vendors.map((vendor) => (
              <div key={vendor._id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-800">{vendor.vendorName}</h3>
                    <p className="text-gray-600 text-sm">Email: {vendor.email}</p>
                    <p className="text-gray-600 text-sm">Phone: {vendor.phone}</p>
                    <p className="text-gray-600 text-sm">
                      Business Type: <span className="capitalize">{vendor.businessType}</span>
                    </p>
                    <p className="text-gray-600 text-sm">
                      Product Type: <span className="capitalize">{vendor.medicineType || 'allopathic'}</span>
                    </p>

                    {vendor.businessAddress && (
                      <p className="text-gray-600 text-sm mt-2">
                        Address: {vendor.businessAddress.street}, {vendor.businessAddress.city},{' '}
                        {vendor.businessAddress.state} - {vendor.businessAddress.pincode}
                      </p>
                    )}

                    {vendor.status === 'verified' && (
                      <p className="text-gray-600 text-sm">
                        Rating: ⭐ {vendor.rating}/5 ({vendor.totalReviews} reviews)
                      </p>
                    )}

                    {vendor.rejectionReason && (
                      <p className="text-red-600 text-sm mt-2">
                        Rejection Reason: {vendor.rejectionReason}
                      </p>
                    )}

                    {filter === 'pending' && (
                      <div className="mt-4 rounded-lg border border-gray-200 p-3 bg-gray-50 text-sm space-y-2">
                        <p className="font-semibold text-gray-800">Verification Documents</p>
                        <div>Aadhar Card: <DocumentViewer url={vendor.aadharCardUrl} label="View Aadhar Card" /></div>
                        <div>PAN Card: <DocumentViewer url={vendor.panCardUrl} label="View PAN Card" /></div>
                        <div>GST Certificate: <DocumentViewer url={vendor.gstCertificateUrl} label="View GST Certificate" /></div>
                        <div>Drug License: <DocumentViewer url={vendor.drugLicenseUrl} label="View Drug License" /></div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 flex-col">
                    {filter === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(vendor._id)}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setSelectedVendor(vendor._id === selectedVendor ? null : vendor._id)}
                          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                        >
                          Reject
                        </button>
                      </>
                    )}

                    {filter === 'verified' && (
                      <button
                        onClick={() => handleSuspend(vendor._id)}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                      >
                        Suspend
                      </button>
                    )}

                    {filter === 'suspended' && (
                      <button
                        onClick={() => {
                          try {
                            fetch('/api/admin/vendors', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                vendorId: vendor._id,
                                action: 'reactivate',
                              }),
                            }).then(() => {
                              setMessage('✅ Vendor reactivated');
                              fetchVendors();
                            }).catch((err: unknown) => {
                              const error = err instanceof Error ? err.message : 'Unknown error';
                              setMessage('❌ ' + error);
                            });
                          } catch (err: unknown) {
                            const error = err instanceof Error ? err.message : 'Unknown error';
                            setMessage('❌ ' + error);
                          }
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                      >
                        Reactivate
                      </button>
                    )}

                    {filter === 'rejected' && (
                      <button
                        onClick={() => {
                          fetch('/api/admin/vendors', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              vendorId: vendor._id,
                              action: 'reactivate',
                            }),
                          })
                            .then((res) => {
                              if (!res.ok) throw new Error('Failed to reactivate');
                              setMessage('✅ Vendor reactivated / approved');
                              fetchVendors();
                            })
                            .catch((err: unknown) => {
                              const error = err instanceof Error ? err.message : 'Unknown error';
                              setMessage('❌ ' + error);
                            });
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                      >
                        Approve & Reactivate
                      </button>
                    )}
                  </div>
                </div>

                {/* Rejection Form */}
                {selectedVendor === vendor._id && filter === 'pending' && (
                  <div className="mt-4 pt-4 border-t border-gray-300">
                    <p className="font-semibold text-gray-700 mb-2">Rejection Reason</p>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Provide reason for rejection..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 bg-white text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReject(vendor._id)}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold"
                      >
                        Confirm Rejection
                      </button>
                      <button
                        onClick={() => {
                          setSelectedVendor(null);
                          setRejectionReason('');
                        }}
                        className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded-lg font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
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
