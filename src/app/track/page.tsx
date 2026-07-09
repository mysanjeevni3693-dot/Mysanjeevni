'use client';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Order {
  id: string;
  userId: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  totalAmount: number;
  status: 'confirmed' | 'processing' | 'shipped' | 'delivered' | string;
  createdAt: string;
}

const steps = ['confirmed', 'processing', 'shipped', 'delivered'];

/** Normalized live tracking shape returned by /api/shiprocket/track. */
interface LiveTracking {
  awb: string;
  courierName: string;
  currentStatus: string;
  estimatedDelivery: string;
  trackUrl: string;
  activities: Array<{ date: string; status: string; activity: string; location: string }>;
}

export default function TrackPage() {
  const router = useRouter();
  const [queryOrderId, setQueryOrderId] = useState('');
  const [orderIdInput, setOrderIdInput] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [message, setMessage] = useState('');

  // Live courier tracking (Shiprocket) by AWB. Additive to the local timeline.
  // Prefill the AWB from the URL (?awb=) using a lazy initializer so we avoid
  // any setState-in-effect for the initial value.
  const [awbInput, setAwbInput] = useState(() => {
    if (typeof window === 'undefined') return '';
    return (new URLSearchParams(window.location.search).get('awb') || '').trim();
  });
  const [liveTracking, setLiveTracking] = useState<LiveTracking | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState('');

  /** Fetches live shipment tracking from the server-side Shiprocket route. */
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
      const res = await fetch(`/api/shiprocket/track?awb=${encodeURIComponent(value)}`, { cache: 'no-store' });
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

  // Auto-track once on mount when an AWB is supplied via the URL (?awb=).
  // Wrapped in an async runner so no setState happens synchronously in the body.
  useEffect(() => {
    if (!awbInput) return;
    const run = async () => {
      await trackLive(awbInput);
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('orderId');
    setQueryOrderId((value || '').trim());
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('orders') || '[]';
    const parsed: Order[] = JSON.parse(raw);
    setOrders(parsed);

    if (queryOrderId) {
      setOrderIdInput(queryOrderId);
      const found = parsed.find((o) => o.id.toLowerCase() === queryOrderId.toLowerCase());
      if (found) setActiveOrder(found);
    }
  }, [queryOrderId]);

  const currentStep = useMemo(() => {
    if (!activeOrder) return -1;
    return Math.max(steps.indexOf(activeOrder.status), 0);
  }, [activeOrder]);

  const handleTrack = () => {
    const target = orderIdInput.trim().toLowerCase();
    if (!target) {
      setMessage('Please enter an order ID.');
      setActiveOrder(null);
      return;
    }

    const found = orders.find((o) => o.id.toLowerCase() === target);
    if (!found) {
      setMessage('Order not found. Please check ID and try again.');
      setActiveOrder(null);
      return;
    }

    setMessage('');
    setActiveOrder(found);
  };

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
                placeholder="Enter Order ID (example: ord_12345)"
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <button
                onClick={handleTrack}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-3 transition"
              >
                Track Order
              </button>
            </div>

            {message && <p className="mt-3 text-sm text-orange-500 font-medium">{message}</p>}

            {!activeOrder && (
              <div className="mt-6 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-slate-700">
                Tip: You can also open tracking from My Orders for a pre-filled order ID.
              </div>
            )}
          </div>

          {/* Live courier tracking by AWB (Shiprocket) */}
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
                  {liveTracking.activities.length === 0 ? (
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
                    Placed on {new Date(activeOrder.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-xs text-slate-500">Order Total</p>
                  <p className="text-2xl font-black text-emerald-700">₹{activeOrder.totalAmount.toFixed(2)}</p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-4 gap-3">
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
                  {activeOrder.items.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="flex items-center justify-between text-sm">
                      <p className="text-slate-700">{item.name} x {item.quantity}</p>
                      <p className="font-semibold text-slate-900">₹{(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>

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
