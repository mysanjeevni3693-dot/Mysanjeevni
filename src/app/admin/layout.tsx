'use client';

import AdminSidebar from '@/components/AdminSidebar';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAdmin = async () => {
      const token = localStorage.getItem('adminToken');
      const user = localStorage.getItem('user');
      const adminEmail = localStorage.getItem('adminEmail');
      const expiresAtRaw = localStorage.getItem('tokenExpiresAt');
      const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : 0;

      if (!token && !user) {
        router.push('/login');
        return;
      }

      // Token expired client-side → force re-login
      if (token && expiresAt > 0 && Date.now() >= expiresAt) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('tokenExpiresAt');
        router.push('/login');
        return;
      }

      // Prefer explicit admin session markers from login
      if (token) {
        if (user) {
          try {
            const userData = JSON.parse(user);
            if (userData.role === 'admin' || userData.isAdmin === true) {
              setIsAdmin(true);
              setLoading(false);
              return;
            }
          } catch {
            /* fall through */
          }
        }
        // adminToken alone is enough for layout gate; APIs verify JWT server-side
        if (adminEmail || token.split('.').length === 3) {
          setIsAdmin(true);
          setLoading(false);
          return;
        }
      }

      if (user) {
        try {
          const userData = JSON.parse(user);
          if (userData.role === 'admin' || userData.email === 'admin@MySanjeevni.com') {
            setIsAdmin(true);
          } else {
            router.push('/');
            return;
          }
        } catch {
          router.push('/login');
          return;
        }
      }

      setLoading(false);
    };

    checkAdmin();
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-600 font-semibold text-lg">Unauthorized Access</p>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel flex h-screen bg-slate-50">
      <AdminSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white shadow-md h-16 flex items-center justify-between px-8 border-b border-slate-200">
          <div className="flex items-center gap-4">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-lg font-semibold text-slate-900">Administration Panel</h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-900">Admin User</p>
              <p className="text-xs text-slate-500">MySanjeevni Platform</p>
            </div>
            <div className="w-10 h-10 bg-linear-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold shadow-md">
              A
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
