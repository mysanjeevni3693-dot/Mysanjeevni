'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const Icons = {
  dashboard: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-3m0 0l7-4 7 4M5 9v10a1 1 0 001 1h12a1 1 0 001-1V9m-9 4l4-2m-8 8h12a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  users: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 12H9m6 0a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  vendors: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18M5 21V7l8-4 8 4v14M9 9h8M9 13h8M9 17h8" />
    </svg>
  ),
  medicines: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  consultations: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12M8 11h12M8 15h6M19 19H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2z" />
    </svg>
  ),
  analytics: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  orders: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  reports: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  inquiries: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8M8 14h5m7 6H6a2 2 0 01-2-2V6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2z" />
    </svg>
  ),
  support: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h6m-9 8l-1-5a2 2 0 012-2h14a2 2 0 012 2l-1 5m-4-8V6a4 4 0 00-8 0v6" />
    </svg>
  ),
  logout: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
};

export default function AdminSidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const menuItems = [
    { label: 'Dashboard', href: '/admin', icon: Icons.dashboard },
    { label: 'Users', href: '/admin/users', icon: Icons.users },
      { label: 'Doctor Verification', href: '/admin/doctors', icon: Icons.consultations },
      { label: 'Vendors', href: '/admin/vendors', icon: Icons.vendors },
    { label: 'Medicines', href: '/admin/medicines', icon: Icons.medicines },
    { label: 'Categories', href: '/admin/categories', icon: Icons.medicines },
    { label: 'Featured Products', href: '/admin/featured-products', icon: Icons.medicines },
    { label: 'Popular Lab Tests', href: '/admin/lab-tests', icon: Icons.medicines },
    { label: 'Consultations', href: '/admin/consultations', icon: Icons.consultations },
    { label: 'Analytics', href: '/admin/analytics', icon: Icons.analytics },
    { label: 'Orders', href: '/admin/orders', icon: Icons.orders },
    { label: 'Settlements', href: '/admin/settlements', icon: Icons.analytics },
    { label: 'Bank Details', href: '/admin/bank-details', icon: Icons.analytics },
    { label: 'Wallet Mgmt', href: '/admin/wallet-management', icon: Icons.analytics },
    { label: 'Shipments', href: '/admin/shipments', icon: Icons.orders },
    { label: 'Lab Bookings', href: '/admin/lab-bookings', icon: Icons.orders },
    { label: 'Webhook Events', href: '/admin/thyrocare-webhooks', icon: Icons.reports },
    { label: 'Inquiries', href: '/admin/inquiries', icon: Icons.inquiries },
    { label: 'Support Review', href: '/admin/support', icon: Icons.support },
    { label: 'Reports', href: '/admin/reports', icon: Icons.reports },
  ];

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden bg-linear-to-r from-blue-600 to-blue-700 text-white p-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-2">
          <div className="bg-white rounded-lg p-2">
            <span className="text-blue-600 font-bold text-lg">MS</span>
          </div>
          <h1 className="text-lg font-bold">MySanjeevni Admin</h1>
        </div>
        <button onClick={() => setIsOpen(!isOpen)} className="hover:bg-blue-500 p-2 rounded-lg transition">
          {isOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Sidebar */}
      <div
        className={`${
          isOpen ? 'block' : 'hidden'
        } lg:block fixed lg:static left-0 top-16 lg:top-0 w-64 h-[calc(100vh-64px)] lg:h-screen bg-linear-to-b from-slate-900 to-slate-800 text-white overflow-y-auto z-40 shadow-2xl flex flex-col`}
      >
        {/* Logo */}
        <div className="hidden lg:flex h-20 bg-linear-to-r from-blue-600 to-blue-700 border-b border-slate-700 items-center justify-center shrink-0">
          <div className="flex items-center gap-3 px-6">
            <div className="bg-white rounded-lg p-2">
              <span className="text-blue-600 font-bold text-xl">MS</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">MySanjeevni</h1>
              <p className="text-xs text-blue-100">Admin Panel</p>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="p-4 space-y-2 flex-1">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition duration-200 ${
                isActive(item.href)
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="font-medium text-sm">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Admin Profile & Logout Section */}
        <div className="border-t border-slate-700 p-4 space-y-4 shrink-0 bg-linear-to-t from-slate-900 to-transparent">
          {/* Admin Profile Card */}
          <div className="bg-slate-700 bg-opacity-50 rounded-lg p-3 border border-slate-600">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-linear-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
                A
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">Admin</p>
                <p className="text-xs text-slate-400 truncate">Administrator</p>
              </div>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center justify-center gap-2 bg-linear-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-4 py-3 rounded-lg font-semibold transition duration-200 shadow-md hover:shadow-lg active:scale-95 group"
          >
            {Icons.logout}
            <span>Logout</span>
          </button>
          <p className="text-xs text-slate-500 text-center">v1.0.0 • MySanjeevni</p>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in">
            {/* Modal Header */}
            <div className="bg-linear-to-r from-red-600 to-red-700 px-6 py-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4v2m0 4v2M6.343 3H3.623A1.623 1.623 0 002 4.623v16.754A1.623 1.623 0 003.623 23h16.754a1.623 1.623 0 001.623-1.623V4.623A1.623 1.623 0 0020.377 2H17.657" />
                </svg>
                Confirm Logout
              </h3>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-6">
              <p className="text-slate-700 text-center mb-2">
                Are you sure you want to logout?
              </p>
              <p className="text-slate-500 text-sm text-center">
                You'll need to log in again to access the admin panel.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-6 py-4 flex gap-3 border-t border-slate-200">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-100 transition duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 px-4 py-2 bg-linear-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-medium rounded-lg transition duration-200 shadow-md hover:shadow-lg"
              >
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
