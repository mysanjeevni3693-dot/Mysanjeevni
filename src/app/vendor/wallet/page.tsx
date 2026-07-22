'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface WalletData {
  id: string;
  balance: number;
  totalEarnings: number;
  totalWithdrawn: number;
  totalCommissionDeducted: number;
  createdAt: string;
}

interface EarningsSummary {
  today: number;
  thisWeek: number;
  thisMonth: number;
  thisYear: number;
  allTime: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  description: string;
  createdAt: string;
}

interface BankDetails {
  id: string;
  accountHolderName: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string;
  preferredWithdrawalMethod: string;
  isVerified: boolean;
}

export default function VendorWallet() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string>('');
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState('month');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'settlements' | 'bank' | 'withdraw'>('overview');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('bank_transfer');
  const [settlements, setSettlements] = useState<any[]>([]);
  const [settlementSummary, setSettlementSummary] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('vendorToken');
    const info = localStorage.getItem('vendorInfo');
    if (!token || !info) {
      router.push('/vendor/login');
      return;
    }
    const vendor = JSON.parse(info);
    const id = vendor._id || vendor.id;
    if (!id) {
      router.push('/vendor/login');
      return;
    }
    setVendorId(String(id));
  }, [router]);

  useEffect(() => {
    if (!vendorId) return;
    fetchWalletData();
    fetchEarnings();
    fetchSettlements();
  }, [vendorId]);

  useEffect(() => {
    if (!vendorId) return;
    fetchTransactions();
  }, [vendorId, selectedTimeframe]);

  const vendorAuthHeaders = (): HeadersInit => {
    const token = localStorage.getItem('vendorToken') || '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const fetchSettlements = async () => {
    try {
      const res = await fetch('/api/vendor/settlements', {
        headers: vendorAuthHeaders(),
        cache: 'no-store',
      });
      const data = await res.json();
      if (res.ok) {
        setSettlements(data.settlements || []);
        setSettlementSummary(data.summary || null);
      }
    } catch (error) {
      console.error('Error fetching settlements:', error);
    }
  };

  const fetchWalletData = async () => {
    try {
      const res = await fetch(`/api/wallet/balance?vendorId=${vendorId}`, {
        headers: vendorAuthHeaders(),
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.wallet) {
        setWallet(data.wallet);
      }
      
      const bankRes = await fetch(`/api/bank-details?vendorId=${vendorId}`, {
        headers: vendorAuthHeaders(),
        cache: 'no-store',
      });
      const bankData = await bankRes.json();
      if (bankData.bankDetails) {
        setBankDetails(bankData.bankDetails);
      }
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEarnings = async () => {
    try {
      const res = await fetch(`/api/wallet/earnings?vendorId=${vendorId}`, {
        headers: vendorAuthHeaders(),
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.summary) {
        setEarnings(data.summary);
      }
    } catch (error) {
      console.error('Error fetching earnings:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await fetch(`/api/wallet/transactions?vendorId=${vendorId}&timeframe=${selectedTimeframe}`, {
        headers: vendorAuthHeaders(),
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.transactions) {
        setTransactions(data.transactions);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const handleWithdrawal = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (!bankDetails) {
      alert('Please add bank details first');
      setActiveTab('bank');
      return;
    }

    try {
      const res = await fetch('/api/withdrawal/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...vendorAuthHeaders(),
        },
        body: JSON.stringify({
          vendorId,
          amount: parseFloat(withdrawAmount),
          withdrawalMethod: withdrawMethod,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert('Withdrawal request submitted successfully!');
        setWithdrawAmount('');
        fetchWalletData();
      } else {
        alert(data.error || 'Failed to submit withdrawal request');
      }
    } catch (error) {
      console.error('Error submitting withdrawal:', error);
      alert('Failed to submit withdrawal request');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-green-50 to-emerald-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading wallet data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-green-50 to-emerald-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/vendor/dashboard" className="text-green-600 hover:text-green-800 mb-4 inline-block">
            ← Back to Dashboard
          </Link>
          <h1 className="text-4xl font-bold text-gray-800 mb-2">My Wallet</h1>
          <p className="text-gray-600">Manage your earnings and withdrawals</p>
        </div>

        {/* Balance Overview */}
        {wallet && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <p className="text-gray-600 text-sm font-semibold mb-2">Available Balance</p>
              <p className="text-3xl font-bold text-green-600">₹{wallet.balance.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-lg shadow-lg p-6">
              <p className="text-gray-600 text-sm font-semibold mb-2">Total Earnings</p>
              <p className="text-3xl font-bold text-green-600">₹{wallet.totalEarnings.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-lg shadow-lg p-6">
              <p className="text-gray-600 text-sm font-semibold mb-2">Withdrawn</p>
              <p className="text-3xl font-bold text-orange-600">₹{wallet.totalWithdrawn.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-lg shadow-lg p-6">
              <p className="text-gray-600 text-sm font-semibold mb-2">Commission Deducted</p>
              <p className="text-3xl font-bold text-red-600">₹{wallet.totalCommissionDeducted.toFixed(2)}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-lg mb-8">
          <div className="flex border-b border-gray-200 flex-wrap">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 min-w-30 py-4 px-6 font-semibold text-center transition ${
                activeTab === 'overview'
                  ? 'border-b-2 border-green-600 text-green-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`flex-1 min-w-30 py-4 px-6 font-semibold text-center transition ${
                activeTab === 'transactions'
                  ? 'border-b-2 border-green-600 text-green-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Transactions
            </button>
            <button
              onClick={() => setActiveTab('settlements')}
              className={`flex-1 min-w-30 py-4 px-6 font-semibold text-center transition ${
                activeTab === 'settlements'
                  ? 'border-b-2 border-green-600 text-green-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Settlements
            </button>
            <button
              onClick={() => setActiveTab('bank')}
              className={`flex-1 min-w-30 py-4 px-6 font-semibold text-center transition ${
                activeTab === 'bank'
                  ? 'border-b-2 border-green-600 text-green-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Bank Details
            </button>
            <button
              onClick={() => setActiveTab('withdraw')}
              className={`flex-1 min-w-30 py-4 px-6 font-semibold text-center transition ${
                activeTab === 'withdraw'
                  ? 'border-b-2 border-green-600 text-green-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Withdraw
            </button>
          </div>

          <div className="p-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && earnings && (
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-6">Earnings Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-linear-to-br from-blue-50 to-blue-100 rounded-lg p-4">
                    <p className="text-gray-600 text-sm mb-2">Today</p>
                    <p className="text-2xl font-bold text-blue-600">₹{earnings.today.toFixed(2)}</p>
                  </div>
                  <div className="bg-linear-to-br from-purple-50 to-purple-100 rounded-lg p-4">
                    <p className="text-gray-600 text-sm mb-2">This Week</p>
                    <p className="text-2xl font-bold text-purple-600">₹{earnings.thisWeek.toFixed(2)}</p>
                  </div>
                  <div className="bg-linear-to-br from-green-50 to-green-100 rounded-lg p-4">
                    <p className="text-gray-600 text-sm mb-2">This Month</p>
                    <p className="text-2xl font-bold text-green-600">₹{earnings.thisMonth.toFixed(2)}</p>
                  </div>
                  <div className="bg-linear-to-br from-orange-50 to-orange-100 rounded-lg p-4">
                    <p className="text-gray-600 text-sm mb-2">This Year</p>
                    <p className="text-2xl font-bold text-orange-600">₹{earnings.thisYear.toFixed(2)}</p>
                  </div>
                  <div className="bg-linear-to-br from-red-50 to-red-100 rounded-lg p-4 md:col-span-1">
                    <p className="text-gray-600 text-sm mb-2">All Time</p>
                    <p className="text-2xl font-bold text-red-600">₹{earnings.allTime.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Transactions Tab */}
            {activeTab === 'transactions' && (
              <div>
                <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
                  <h3 className="text-xl font-bold text-gray-800">Transaction History</h3>
                  <div className="flex gap-2">
                    {['day', 'week', 'month', 'year'].map((tf) => (
                      <button
                        key={tf}
                        onClick={() => setSelectedTimeframe(tf)}
                        className={`px-4 py-2 rounded-lg font-semibold transition text-sm ${
                          selectedTimeframe === tf
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {tf.charAt(0).toUpperCase() + tf.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Type</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Amount</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Description</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.length > 0 ? (
                        transactions.map((txn) => (
                          <tr key={txn.id} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                txn.type === 'earning' ? 'bg-green-100 text-green-800' :
                                txn.type === 'withdrawal' ? 'bg-orange-100 text-orange-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {txn.type}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-semibold">₹{txn.amount.toFixed(2)}</td>
                            <td className="px-4 py-3">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                txn.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                                txn.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {txn.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{txn.description}</td>
                            <td className="px-4 py-3 text-gray-500">{new Date(txn.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                            No transactions found for this period
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Settlements Tab */}
            {activeTab === 'settlements' && (
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Settlement History</h3>
                <p className="text-sm text-gray-500 mb-6">
                  Payouts recorded by MySanjeevni admin. Pending balance: ₹
                  {Number(settlementSummary?.pendingSettlement ?? wallet?.balance ?? 0).toFixed(2)}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Amount</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Method</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Transaction ID</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-700">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settlements.length > 0 ? (
                        settlements.map((s) => (
                          <tr key={s._id} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-4 py-3 font-semibold text-emerald-700">₹{Number(s.amount).toFixed(2)}</td>
                            <td className="px-4 py-3 capitalize">{String(s.paymentMethod || '').replace('_', ' ')}</td>
                            <td className="px-4 py-3 text-gray-600">{s.transactionId || s.referenceNumber || '—'}</td>
                            <td className="px-4 py-3 capitalize">{s.status}</td>
                            <td className="px-4 py-3 text-gray-500">
                              {s.paidAt || s.createdAt
                                ? new Date(s.paidAt || s.createdAt).toLocaleDateString('en-IN')
                                : '—'}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                            No settlements received yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Bank Details Tab */}
            {activeTab === 'bank' && (
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-6">Bank Account Details</h3>
                {bankDetails ? (
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-gray-600 text-sm mb-1">Account Holder Name</p>
                        <p className="text-lg font-semibold text-gray-800">{bankDetails.accountHolderName}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 text-sm mb-1">Bank Name</p>
                        <p className="text-lg font-semibold text-gray-800">{bankDetails.bankName}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 text-sm mb-1">Account Number</p>
                        <p className="text-lg font-semibold text-gray-800">****{bankDetails.accountNumber.slice(-4)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 text-sm mb-1">IFSC Code</p>
                        <p className="text-lg font-semibold text-gray-800">{bankDetails.ifscCode}</p>
                      </div>
                      {bankDetails.upiId && (
                        <div>
                          <p className="text-gray-600 text-sm mb-1">UPI ID</p>
                          <p className="text-lg font-semibold text-gray-800">{bankDetails.upiId}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-gray-600 text-sm mb-1">Status</p>
                        <p className={`text-lg font-semibold ${bankDetails.isVerified ? 'text-green-600' : 'text-orange-600'}`}>
                          {bankDetails.isVerified ? '✓ Verified' : 'Pending Verification'}
                        </p>
                      </div>
                    </div>
                    <Link
                      href="/vendor/wallet/edit-bank-details"
                      className="mt-6 inline-block bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition"
                    >
                      Edit Bank Details
                    </Link>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-6 text-center">
                    <p className="text-gray-600 mb-4">No bank details found</p>
                    <Link
                      href="/vendor/wallet/add-bank-details"
                      className="inline-block bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition"
                    >
                      Add Bank Details
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Withdrawal Tab */}
            {activeTab === 'withdraw' && (
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-6">Request Withdrawal</h3>
                {wallet && (
                  <div className="bg-gray-50 rounded-lg p-6 max-w-md">
                    <div className="mb-6">
                      <p className="text-gray-600 text-sm mb-2">Available Balance</p>
                      <p className="text-3xl font-bold text-green-600">₹{wallet.balance.toFixed(2)}</p>
                    </div>

                    <div className="mb-6">
                      <label className="block text-gray-700 font-semibold mb-2">Amount</label>
                      <input
                        type="number"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="Enter amount"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                      />
                    </div>

                    <div className="mb-6">
                      <label className="block text-gray-700 font-semibold mb-2">Withdrawal Method</label>
                      <select
                        value={withdrawMethod}
                        onChange={(e) => setWithdrawMethod(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-green-500"
                      >
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="upi">UPI</option>
                        <option value="neft">NEFT</option>
                        <option value="rtgs">RTGS</option>
                        <option value="imps">IMPS</option>
                      </select>
                    </div>

                    <button
                      onClick={handleWithdrawal}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition"
                    >
                      Request Withdrawal
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
