'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

interface TrackOrder {
  id: string;
  userId?: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  totalAmount: number;
  status: string;
  createdAt: string;
  awbNumber?: string;
  courierName?: string;
  shipmentStatus?: string;
  paymentMethod?: string;
}

const steps = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];

/** Normalized live tracking shape returned by /api/shiprocket/track. */
interface LiveTracking {
  awb: string;
  courierName: string;
  currentStatus: string;
  estimatedDelivery: string;
  trackUrl: string;
  activities: Array<{ date: string; status: string; activity: string; location: string }>;
}

function getOrderId(order: any): string {
  return String(order?._id || order?.id || order?.dbOrderId || order?.orderId || '').trim();
}

function normalizeLocalOrder(raw: any): TrackOrder | null {
  const id = getOrderId(raw);
  if (!id) return null;

  const items = Array.isArray(raw?.items)
    ? raw.items.map((item: any) => ({
        name: String(item?.productName || item?.name || 'Item'),
        quantity: Number(item?.quantity || 0) || 0,
        price: Number(item?.price || 0) || 0,
      }))
    : [];

  return {
    id,
    userId: raw?.userId ? String(raw.userId) : undefined,
    items,
    totalAmount: Number(raw?.totalAmount ?? raw?.totalPrice ?? 0) || 0,
    status: String(raw?.status || 'pending').toLowerCase(),
    createdAt: raw?.createdAt || new Date().toISOString(),
    awbNumber: raw?.awbNumber || '',
    courierName: raw?.courierName || '',
    shipmentStatus: raw?.shipmentStatus || '',
    paymentMethod: raw?.paymentMethod || '',
  };
}

function mapStatusToStep(status: string): number {
  const normalized = String(status || 'pending').toLowerCase();
  if (normalized === 'cancelled' || normalized === 'canceled') return 0;
  if (normalized === 'pickup_scheduled' || normalized === 'ready_to_ship') {
    return steps.indexOf('processing');
  }
  const idx = steps.indexOf(normalized);
  return idx >= 0 ? idx : 0;
}

export default function TrackPage() {
  const router = useRouter();
  const [orderIdInput, setOrderIdInput] = useState('');
  const [activeOrder, setActiveOrder] = useState<TrackOrder | null>(null);
  const [message, setMessage] = useState('');
  const [loadingOrder, setLoadingOrder] = useState(false);

  const [awbInput, setAwbInput] = useState(() => {
    if (typeof window === 'undefined') return '';
    return (new URLSearchParams(window.location.search).get('awb') || '').trim();
  });
  const [liveTracking, setLiveTracking] = useState<LiveTracking | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState('');

  const trackLive = async (awb: string) => {
    const value = awb.trim();
    if (!value) {
      setLiveError('Please enter your AWB / tracking number.');
      return;
    }
    setLiveLoading(true);
    setLiveError('');
    setLiveTracking(null);
    try {
      const res = await fetch(`/api/shiprocket/track?awb=${encodeURIComponent(value)}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message || 'Unable to fetch tracking details.');
      }
      setLiveTracking(data.data as LiveTracking);
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : 'Unable to fetch tracking details.');
    } finally {
      setLiveLoading(false);
    }
  };

  const loadOrderById = async (orderId: string) => {
    const target = orderId.trim();
    if (!target) {
      setMessage('Please enter an order ID.');
      setActiveOrder(null);
      return;
    }

    setLoadingOrder(true);
    setMessage('');
    setActiveOrder(null);

    try {
      // Prefer database (source of truth).
      const res = await fetch(`/api/orders/track?orderId=${encodeURIComponent(target)}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (res.ok && data?.success && data?.order) {
        const order = normalizeLocalOrder(data.order);
        if (order) {
          setActiveOrder(order);
          if (order.awbNumber) {
            setAwbInput(order.awbNumber);
            void trackLive(order.awbNumber);
          }
          if (data.trackingError) {
            setLiveError(String(data.trackingError));
          }
          return;
        }
      }

      // Fallback: localStorage cache from My Orders (supports _id / id / dbOrderId).
      try {
        const raw = localStorage.getItem('orders') || '[]';
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed)
          ? parsed.map(normalizeLocalOrder).filter(Boolean) as TrackOrder[]
          : [];
        const found = list.find((o) => o.id.toLowerCase() === target.toLowerCase());
        if (found) {
          setActiveOrder(found);
          if (found.awbNumber) {
            setAwbInput(found.awbNumber);
            void trackLive(found.awbNumber);
          }
          return;
        }
      } catch {
        // ignore local parse errors
      }

      setMessage(
        data?.error?.message ||
          'Order not found. Please check the ID and try again.'
      );
    } catch {
      setMessage('Unable to load order details. Please try again.');
    } finally {
      setLoadingOrder(false);
    }
  };

  useEffect(() => {
    if (!awbInput) return;
    void trackLive(awbInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const value = (new URLSearchParams(window.location.search).get('orderId') || '').trim();
    if (value) {
      setOrderIdInput(value);
      void loadOrderById(value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentStep = useMemo(() => {
    if (!activeOrder) return -1;
    return mapStatusToStep(activeOrder.status);
  }, [activeOrder]);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-1">
        <section className="relative overflow-hidden bg-linear-to-br from-emerald-50 via-white to-orange-50">
          <div className="absolute -top-16 right-0 h-52 w-52 rounded-full bg-orange-200/40 blur-3xl" />
          <div className="absolute -bottom-16 left-0 h-52 w-52 rounded-full bg-emerald-200/40 blur-3xl" />

          <div className="max-w-7xl mx-auto px-4 py-14 sm:py-16 relative z-10 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">Order Tracking</p>
            <h1 className="mt-3 text-4xl sm:text-5xl font-black text-emerald-700">Track Your Order in Real Time</h1>
            <p className="mt-3 text-emerald-600 max-w-2xl mx-auto text-sm sm:text-base">
              Enter your order ID to check current status, timeline, and delivery progress.
            </p>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-4 py-10 sm:py-12">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                value={orderIdInput}
                onChange={(e) => setOrderIdInput(e.target.value)}
                placeholder="Enter Order ID"
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <button
                onClick={() => loadOrderById(orderIdInput)}
                disabled={loadingOrder}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold px-5 py-3 transition"
              >
                {loadingOrder ? 'Loading…' : 'Track Order'}
              </button>
            </div>

            {message && <p className="mt-3 text-sm text-orange-500 font-medium">{message}</p>}

            {!activeOrder && !loadingOrder && (
              <div className="mt-6 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-slate-700">
                Tip: You can also open tracking from My Orders for a pre-filled order ID.
              </div>
            )}
          </div>

          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
            <h3 className="text-lg font-bold text-emerald-700">Live Courier Tracking</h3>
            <p className="text-sm text-slate-600 mt-1">
              Have a tracking (AWB) number? Track your shipment live with the courier.
            </p>
            <div className="mt-3 flex flex-col sm:flex-row gap-3">
              <input
                value={awbInput}
                onChange={(e) => setAwbInput(e.target.value)}
                placeholder="Enter AWB / Tracking Number"
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <button
                onClick={() => trackLive(awbInput)}
                disabled={liveLoading}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold px-5 py-3 transition"
              >
                {liveLoading ? 'Tracking…' : 'Track Live'}
              </button>
            </div>

            {liveError && <p className="mt-3 text-sm text-orange-500 font-medium">{liveError}</p>}

            {liveTracking && (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500">Courier</p>
                    <p className="font-semibold text-slate-900">{liveTracking.courierName || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">AWB</p>
                    <p className="font-semibold text-slate-900">{liveTracking.awb || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Status</p>
                    <p className="font-semibold text-emerald-700">{liveTracking.currentStatus}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Est. Delivery</p>
                    <p className="font-semibold text-slate-900">{liveTracking.estimatedDelivery || '—'}</p>
                  </div>
                </div>

                <ol className="relative border-l border-emerald-200 pl-4 mt-5 space-y-4">
                  {!Array.isArray(liveTracking.activities) || liveTracking.activities.length === 0 ? (
                    <li className="text-sm text-slate-500">No tracking activity yet.</li>
                  ) : (
                    liveTracking.activities.map((activity, idx) => (
                      <li key={idx} className="ml-2">
                        <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-emerald-500" />
                        <p className="text-sm font-medium text-slate-900">
                          {activity.activity || activity.status}
                        </p>
                        <p className="text-xs text-slate-500">
                          {activity.location} {activity.date ? `• ${activity.date}` : ''}
                        </p>
                      </li>
                    ))
                  )}
                </ol>
              </div>
            )}
          </div>

          {activeOrder && (
            <div className="mt-6 rounded-3xl border border-emerald-200 bg-linear-to-br from-white to-emerald-50 p-6 sm:p-7">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-orange-500 font-semibold">Order Details</p>
                  <h2 className="mt-1 text-2xl font-black text-emerald-700">#{activeOrder.id.toUpperCase()}</h2>
                  <p className="text-sm text-slate-600 mt-1">
                    Placed on{' '}
                    {new Date(activeOrder.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                  <p className="text-sm text-slate-600 mt-1 capitalize">
                    Status: <span className="font-semibold text-emerald-700">{activeOrder.status || 'pending'}</span>
                    {activeOrder.paymentMethod ? ` · ${activeOrder.paymentMethod.toUpperCase()}` : ''}
                  </p>
                  {(activeOrder.courierName || activeOrder.awbNumber) && (
                    <p className="text-sm text-slate-600 mt-1">
                      {activeOrder.courierName ? `${activeOrder.courierName} · ` : ''}
                      {activeOrder.awbNumber ? `AWB ${activeOrder.awbNumber}` : 'AWB pending'}
                    </p>
                  )}
                </div>
                <div className="text-left md:text-right">
                  <p className="text-xs text-slate-500">Order Total</p>
                  <p className="text-2xl font-black text-emerald-700">
                    ₹{Number(activeOrder.totalAmount || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
                {steps.map((step, idx) => {
                  const completed = idx <= currentStep;
                  return (
                    <div
                      key={step}
                      className={`rounded-xl border px-3 py-3 text-center text-sm font-semibold ${
                        completed
                          ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                          : 'bg-white border-slate-200 text-slate-500'
                      }`}
                    >
                      {step.charAt(0).toUpperCase() + step.slice(1)}
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="font-bold text-emerald-700 mb-3">Order Items</h3>
                <div className="space-y-2">
                  {activeOrder.items.length === 0 ? (
                    <p className="text-sm text-slate-500">No line items available.</p>
                  ) : (
                    activeOrder.items.map((item, index) => (
                      <div key={`${item.name}-${index}`} className="flex items-center justify-between text-sm">
                        <p className="text-slate-700">
                          {item.name} x {item.quantity}
                        </p>
                        <p className="font-semibold text-slate-900">
                          ₹{(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {String(activeOrder.status).toLowerCase() === 'pending' && !activeOrder.awbNumber && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Your order is confirmed in our system and awaiting packing/shipping.
                  Courier tracking will appear here once an AWB is assigned.
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  onClick={() => router.push('/orders')}
                  className="rounded-lg border border-emerald-300 text-emerald-700 px-4 py-2 text-sm font-bold hover:bg-emerald-50 transition"
                >
                  Back to My Orders
                </button>
                <button
                  onClick={() => router.push('/help')}
                  className="rounded-lg border border-orange-300 text-orange-500 px-4 py-2 text-sm font-bold hover:bg-orange-50 transition"
                >
                  Need Help?
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
