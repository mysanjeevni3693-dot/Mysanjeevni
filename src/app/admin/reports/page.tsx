'use client';

import { useState } from 'react';

interface Report {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  live?: boolean;
}

export default function AdminReports() {
  const [selectedReport, setSelectedReport] = useState<string | null>('vendors');
  const [dateRange, setDateRange] = useState('month');
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');

  const reports: Report[] = [
    {
      id: 'sales',
      name: 'Sales Report',
      description: 'Detailed sales analytics and trends',
      icon: '📊',
      category: 'Financial',
    },
    {
      id: 'revenue',
      name: 'Revenue Report',
      description: 'Revenue breakdown by category and time',
      icon: '💰',
      category: 'Financial',
    },
    {
      id: 'users',
      name: 'User Demographics',
      description: 'User growth and demographic analysis',
      icon: '👥',
      category: 'Users',
    },
    {
      id: 'products',
      name: 'Product Performance',
      description: 'Top performing and low-performing products',
      icon: '📦',
      category: 'Products',
    },
    {
      id: 'vendors',
      name: 'Vendor Performance',
      description: 'Vendor sales, commission, and settlement summary (live CSV)',
      icon: '🏪',
      category: 'Vendors',
      live: true,
    },
    {
      id: 'consultations',
      name: 'Consultation Report',
      description: 'Doctor consultations and ratings',
      icon: '👨‍⚕️',
      category: 'Services',
    },
    {
      id: 'inventory',
      name: 'Inventory Report',
      description: 'Stock levels and inventory management',
      icon: '📋',
      category: 'Inventory',
    },
    {
      id: 'customers',
      name: 'Customer Analysis',
      description: 'Customer lifetime value and behavior',
      icon: '🔍',
      category: 'Customers',
    },
  ];

  const categories = Array.from(new Set(reports.map((r) => r.category)));

  const handleExport = async (format: string) => {
    setMessage('');
    if (selectedReport !== 'vendors') {
      setMessage('Live export is currently available for Vendor Performance only.');
      return;
    }
    if (format !== 'csv' && format !== 'excel') {
      setMessage('Vendor report supports CSV download (Excel-compatible).');
      return;
    }

    setExporting(true);
    try {
      const res = await fetch('/api/admin/reports/vendors?format=csv', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('adminToken') || ''}`,
        },
        cache: 'no-store',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Export failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'marketplace-vendor-report.csv';
      a.click();
      URL.revokeObjectURL(url);
      setMessage('Vendor performance CSV downloaded.');
    } catch (e: any) {
      setMessage(e?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
        <p className="text-gray-600 mt-2">Generate and download comprehensive business reports</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h3 className="text-lg font-semibold text-gray-900">Report Period</h3>
          <div className="flex gap-3 flex-wrap">
            {['week', 'month', 'quarter', 'year'].map((period) => (
              <button
                key={period}
                onClick={() => setDateRange(period)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  dateRange === period
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          Period filter is reserved for upcoming report types. Vendor CSV exports full marketplace history.
        </p>
      </div>

      <div className="space-y-8">
        {categories.map((category) => (
          <div key={category}>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{category} Reports</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {reports
                .filter((r) => r.category === category)
                .map((report) => (
                  <button
                    key={report.id}
                    onClick={() => setSelectedReport(report.id)}
                    className={`p-6 rounded-lg border-2 transition text-left ${
                      selectedReport === report.id
                        ? 'border-indigo-600 bg-indigo-50'
                        : 'border-gray-200 bg-white hover:border-indigo-300'
                    }`}
                  >
                    <div className="text-4xl mb-3">{report.icon}</div>
                    <h4 className="text-lg font-semibold text-gray-900">{report.name}</h4>
                    <p className="text-sm text-gray-600 mt-2">{report.description}</p>
                    {report.live ? (
                      <span className="mt-3 inline-block rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                        Live export
                      </span>
                    ) : null}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow p-6 mt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Export Selected Report</h3>
        {message ? <p className="mb-4 text-sm text-slate-700">{message}</p> : null}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            disabled={exporting}
            onClick={() => handleExport('csv')}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-medium transition"
          >
            {exporting ? 'Exporting…' : 'Download CSV'}
          </button>
          <button
            disabled={exporting}
            onClick={() => handleExport('excel')}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-medium transition"
          >
            Download Excel (CSV)
          </button>
        </div>
      </div>
    </div>
  );
}
