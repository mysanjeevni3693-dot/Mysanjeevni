'use client';

/**
 * Shiprocket Checkout (SRC) success/redirect page.
 *
 * Shiprocket redirects the customer here after the hosted checkout with
 * `?oid=<orderId>&ost=<status>`. We confirm the order via the server (which
 * fetches SRC order details), clear the local cart on success, and show a
 * confirmation. The order webhook persists the order server-side in parallel.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

interface CheckoutOrderView {
  orderId: string;
  status: string;
  paymentType: string;
  paymentStatus: string;
  totalPayable: number;
  estimatedDelivery: string;
}

export default function CheckoutSuccessPage() {
  // Read redirect params via lazy initializers (no setState-in-effect).
  const [oid] = useState(() => {
    if (typeof window === 'undefined') return '';
    return (new URLSearchParams(window.location.search).get('oid') || '').trim();
  });
  const [ost] = useState(() => {
    if (typeof window === 'undefined') return '';
    return (new URLSearchParams(window.location.search).get('ost') || '').trim().toUpperCase();
  });

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<CheckoutOrderView | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const run = async () => {
      const success = ost === 'SUCCESS';

      // Clear the cart once the order is confirmed successful.
      if (success) {
        try {
          localStorage.setItem('cart', JSON.stringify([]));
        } catch {
          /* ignore */
        }
      }

      if (!oid) {
        setError(success ? '' : 'Your checkout was not completed.');
        setLoading(false);
        return;
      }

      // Pass the signed-in user id so the server can attribute (and persist)
      // this order to the correct customer even if the webhook was missed.
      let userId = '';
      try {
        const stored = JSON.parse(localStorage.getItem('user') || '{}');
        userId = String(stored?.id || '');
      } catch {
        /* ignore */
      }

      try {
        const res = await fetch('/api/shiprocket/checkout/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: oid, userId }),
        });
        const data = await res.json();
        if (res.ok && data?.success) {
          setOrder(data.data as CheckoutOrderView);
        }
      } catch {
        // Details are best-effort; the webhook is the source of truth.
      } finally {
        setLoading(false);
      }
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSuccess = ost === 'SUCCESS';

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center py-16 px-4">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm text-center">
          {loading ? (
            <>
              <div className="mx-auto mb-4 h-14 w-14 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
              <p className="text-slate-600 font-medium">Confirming your order…</p>
            </>
          ) : isSuccess ? (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl">
                ✓
              </div>
              <h1 className="text-2xl font-black text-emerald-700">Order Placed Successfully</h1>
              <p className="mt-2 text-slate-600">
                Thank you for your purchase. Your order is being processed and shipped by Shiprocket.
              </p>

              <div className="mt-6 space-y-2 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 text-left text-sm">
                {oid && (
                  <p>
                    <span className="text-slate-500">Order ID: </span>
                    <span className="font-semibold text-slate-900">{oid}</span>
                  </p>
                )}
                {order && (
                  <>
                    <p>
                      <span className="text-slate-500">Payment: </span>
                      <span className="font-semibold text-slate-900">
                        {order.paymentType} • {order.paymentStatus}
                      </span>
                    </p>
                    {order.totalPayable > 0 && (
                      <p>
                        <span className="text-slate-500">Amount: </span>
                        <span className="font-semibold text-slate-900">₹{order.totalPayable.toFixed(2)}</span>
                      </p>
                    )}
                    {order.estimatedDelivery && (
                      <p>
                        <span className="text-slate-500">Estimated Delivery: </span>
                        <span className="font-semibold text-slate-900">{order.estimatedDelivery}</span>
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/orders"
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 transition"
                >
                  View My Orders
                </Link>
                <Link
                  href="/medicines"
                  className="rounded-xl border border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-bold px-6 py-3 transition"
                >
                  Continue Shopping
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-3xl">
                !
              </div>
              <h1 className="text-2xl font-black text-orange-600">Checkout Not Completed</h1>
              <p className="mt-2 text-slate-600">
                {error || 'Your order was not completed. You can try again from your cart.'}
              </p>
              <div className="mt-6">
                <Link
                  href="/cart"
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 transition"
                >
                  Back to Cart
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
