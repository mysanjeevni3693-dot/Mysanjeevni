'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface VendorNotificationItem {
  _id: string;
  type: string;
  title: string;
  message?: string;
  actionUrl?: string;
  isRead?: boolean;
  createdAt?: string;
}

export default function VendorNotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<VendorNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const authHeaders = (): HeadersInit => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('vendorToken') || '' : '';
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  const load = useCallback(async () => {
    const token = localStorage.getItem('vendorToken');
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/vendor/notifications?limit=20', {
        headers: authHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications || []);
      setUnreadCount(Number(data.unreadCount || 0));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 60000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const markOne = async (id: string) => {
    try {
      await fetch('/api/vendor/notifications', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ notificationId: id }),
      });
      setItems((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  };

  const markAll = async () => {
    try {
      await fetch('/api/vendor/notifications', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({ markAll: true }),
      });
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) void load();
        }}
        className="relative inline-flex items-center justify-center rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-200"
        aria-label="Notifications"
      >
        <span className="text-lg leading-none">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[1.25rem] rounded-full bg-red-600 px-1 text-center text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-bold text-slate-900">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAll}
                className="text-xs font-semibold text-emerald-700 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">No notifications yet</p>
            ) : (
              items.map((n) => {
                const inner = (
                  <div className={`px-4 py-3 ${n.isRead ? 'bg-white' : 'bg-emerald-50/60'}`}>
                    <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                    {n.message ? <p className="mt-0.5 text-xs text-slate-600 line-clamp-2">{n.message}</p> : null}
                    {n.createdAt ? (
                      <p className="mt-1 text-[10px] text-slate-400">
                        {new Date(n.createdAt).toLocaleString('en-IN')}
                      </p>
                    ) : null}
                  </div>
                );
                return n.actionUrl ? (
                  <Link
                    key={n._id}
                    href={n.actionUrl}
                    onClick={() => {
                      if (!n.isRead) void markOne(n._id);
                      setOpen(false);
                    }}
                    className="block border-b border-slate-50 hover:bg-slate-50"
                  >
                    {inner}
                  </Link>
                ) : (
                  <button
                    key={n._id}
                    type="button"
                    onClick={() => {
                      if (!n.isRead) void markOne(n._id);
                    }}
                    className="block w-full border-b border-slate-50 text-left hover:bg-slate-50"
                  >
                    {inner}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
