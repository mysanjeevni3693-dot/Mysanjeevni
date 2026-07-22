'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

interface Order {
  _id?: string;
  id?: string;
  orderId?: string;
  dbOrderId?: string;
  userId: string;
  items?: any[];
  totalAmount?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  razorpayPaymentId?: string;
  status?: string;
  createdAt?: string;
  // Shipping details populated at checkout from the Shiprocket pipeline.
  awbNumber?: string;
  courierName?: string;
  shipmentStatus?: string;
}

/**
 * Normalizes a database order (from GET /api/orders) into the shape this page
 * renders. The DB uses `totalPrice` / `productName`; the UI expects
 * `totalAmount` / item `name`.
 */
function normalizeDbOrder(o: any): Order {
  return {
    _id: String(o?._id || ''),
    userId: String(o?.userId?._id || o?.userId || ''),
    items: Array.isArray(o?.items)
      ? o.items.map((i: any) => ({
          name: i?.productName || i?.name || 'Item',
          brand: i?.brand || '',
          quantity: Number(i?.quantity || 0),
          price: Number(i?.price || 0),
        }))
      : [],
    totalAmount: Number(o?.totalPrice ?? o?.totalAmount ?? 0),
    paymentMethod: o?.paymentMethod || (o?.razorpayPaymentId ? 'razorpay' : 'cod'),
    paymentStatus: o?.paymentStatus,
    razorpayPaymentId: o?.razorpayPaymentId,
    status: o?.status,
    createdAt: o?.createdAt,
    awbNumber: o?.awbNumber,
    courierName: o?.courierName,
    shipmentStatus: o?.shipmentStatus,
  };
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [user, setUser] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      router.push('/login');
      return;
    }

    const parsedUser = JSON.parse(userStr);
    setUser(parsedUser);
    loadOrders(parsedUser);
  }, [router]);

  /**
   * Loads this user's orders from the database (source of truth).
   * Admin sees all; vendors see their product lines via their dashboard.
   */
  const loadOrders = async (parsedUser: any) => {
    try {
      const res = await fetch(`/api/orders?userId=${encodeURIComponent(parsedUser?.id || '')}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        setOrders([]);
        return;
      }
      const data = await res.json();
      const dbOrders: Order[] = Array.isArray(data?.orders)
        ? data.orders.map(normalizeDbOrder)
        : [];
      dbOrders.sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
      setOrders(dbOrders);

      // Keep a local cache mirror of DB orders for offline display only (not a second source of truth).
      try {
        localStorage.setItem(
          'orders',
          JSON.stringify(
            dbOrders.map((o) => ({
              ...o,
              dbOrderId: o._id,
              userId: parsedUser?.id,
            }))
          )
        );
      } catch {
        // ignore quota
      }
    } catch {
      setOrders([]);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'shipped':
        return 'bg-purple-100 text-purple-800';
      case 'delivered':
        return 'bg-emerald-100 text-emerald-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'card':
        return '💳';
      case 'netbanking':
        return '🏦';
      case 'upi':
        return '📱';
      case 'wallet':
        return '💰';
      case 'bnpl':
        return '📅';
      case 'cod':
        return '🚚';
      default:
        return '💳';
    }
  };

  const getPaymentLabel = (method?: string) => {
    const normalized = String(method || '').trim().toLowerCase();
    if (!normalized) return 'COD';
    if (normalized === 'cod') return 'COD';
    if (normalized === 'cash_on_delivery') return 'COD';
    return normalized.toUpperCase();
  };

  const getOrderId = (order: Order): string => {
    return String(order?._id || order?.id || order?.orderId || '').trim();
  };

  const canCancelOrder = (order: Order) => {
    const status = String(order?.status || '').toLowerCase();
    return !['cancelled', 'delivered', 'shipped'].includes(status);
  };

  const cancelOrder = async (order: Order) => {
    const resolvedOrderId = getOrderId(order);
    if (!resolvedOrderId) return;
    if (!canCancelOrder(order)) {
      alert('This order cannot be cancelled now.');
      return;
    }

    const confirmed = confirm('Cancel this order? If paid online, refund will be initiated to the original payment account.');
    if (!confirmed) return;

    try {
      setCancellingOrderId(resolvedOrderId);

      let refundId = '';
      const isRazorpay = String(order.paymentMethod || '').toLowerCase().includes('razorpay');
      const isPaid = String(order.paymentStatus || '').toLowerCase() === 'completed';
      const amount = Number(order.totalAmount || 0);

      if (isRazorpay && isPaid && order.razorpayPaymentId && amount > 0) {
        const refundRes = await fetch('/api/payments/razorpay/refund', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentId: order.razorpayPaymentId,
            amount,
            reason: 'order_cancelled_by_user',
          }),
        });
        const refundData = await refundRes.json();
        if (!refundRes.ok || !refundData?.success) {
          throw new Error(refundData?.error || 'Refund initiation failed');
        }
        refundId = String(refundData?.refund?.id || '');
      }

      // Persist the cancellation to the database (source of truth) so it sticks
      // across reloads/devices. Best-effort: a non-DB (local-only) id just 404s.
      const isDbOrder = /^[0-9a-fA-F]{24}$/.test(resolvedOrderId);
      if (isDbOrder) {
        try {
          await fetch('/api/orders', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: resolvedOrderId,
              status: 'cancelled',
              userId: String(user?.id || ''),
            }),
          });
        } catch {
          // Ignore – local state is still updated below.
        }
      }

      // Keep any localStorage copy in sync too.
      const allOrders: any[] = JSON.parse(localStorage.getItem('orders') || '[]');
      const updatedOrders = allOrders.map((o) => {
        const currentId = String(o?.dbOrderId || o?._id || o?.id || o?.orderId || '').trim();
        if (currentId !== resolvedOrderId) return o;

        return {
          ...o,
          status: 'cancelled',
          paymentStatus:
            isRazorpay && isPaid && order.razorpayPaymentId
              ? 'refunded'
              : String(o?.paymentStatus || 'pending'),
          refundId: refundId || o?.refundId || '',
          cancelledAt: new Date().toISOString(),
        };
      });
      localStorage.setItem('orders', JSON.stringify(updatedOrders));

      // Update the on-screen list.
      setOrders((prev) =>
        prev.map((o) =>
          getOrderId(o) === resolvedOrderId
            ? {
                ...o,
                status: 'cancelled',
                paymentStatus:
                  isRazorpay && isPaid && order.razorpayPaymentId
                    ? 'refunded'
                    : o.paymentStatus,
              }
            : o
        )
      );

      alert(
        refundId
          ? `Order cancelled. Refund initiated to original payment account. Refund ID: ${refundId}`
          : 'Order cancelled successfully.'
      );
    } catch (error: any) {
      alert(error?.message || 'Failed to cancel order. Please contact support.');
    } finally {
      setCancellingOrderId(null);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />

      <div className="flex-1 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">My Orders</h1>
          <p className="text-gray-600 mb-8">
            Track and manage all your orders
          </p>

          {orders.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">📦</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">No orders yet</h2>
              <p className="text-gray-600 mb-8">Start shopping to place your first order</p>
              <Link
                href="/medicines"
                className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-lg font-semibold transition"
              >
                Shop Now
              </Link>
            </div>
          ) : (
            <div className="grid gap-6">
              {orders.map((order) => (
                (() => {
                  const resolvedOrderId = getOrderId(order);
                  const safeOrderId = resolvedOrderId || 'N/A';
                  const safeStatus = String(order?.status || 'processing').toLowerCase();
                  const safePaymentMethod = String(order?.paymentMethod || 'cod').toLowerCase();
                  const safeItems = Array.isArray(order?.items) ? order.items : [];
                  const safeTotalAmount = Number(order?.totalAmount || 0);
                  const safeCreatedAt = order?.createdAt ? new Date(order.createdAt) : new Date();

                  return (
                <div
                  key={`${safeOrderId}-${order?.createdAt || ''}`}
                  className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition cursor-pointer"
                  onClick={() => setSelectedOrder(getOrderId(selectedOrder as Order) === resolvedOrderId ? null : order)}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Order #{safeOrderId.toUpperCase()}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {safeCreatedAt.toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <span className={`px-4 py-2 rounded-full text-sm font-semibold text-center ${getStatusColor(safeStatus)}`}>
                        {safeStatus.charAt(0).toUpperCase() + safeStatus.slice(1)}
                      </span>
                      <p className="text-right text-lg font-bold text-emerald-600">
                        ₹{safeTotalAmount.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Order Summary */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-t border-gray-200 border-b">
                    <div>
                      <p className="text-xs text-gray-600">Items</p>
                      <p className="font-semibold text-gray-900">{safeItems.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Payment</p>
                      <p className="font-semibold text-gray-900">
                        {getPaymentIcon(safePaymentMethod)} {getPaymentLabel(safePaymentMethod)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Delivery</p>
                      <p className="font-semibold text-gray-900">Free</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Expected</p>
                      <p className="font-semibold text-gray-900">2-3 days</p>
                    </div>
                  </div>

                  {/* Expandable Order Details */}
                  {getOrderId(selectedOrder as Order) === resolvedOrderId && (
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <h4 className="font-semibold text-gray-900 mb-4">Order Items</h4>
                      <div className="space-y-3">
                        {safeItems.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-sm">
                            <div>
                              <p className="text-gray-900 font-medium">{item.name}</p>
                              <p className="text-gray-600 text-xs">{item.brand}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-gray-900 font-medium">Qty: {item.quantity}</p>
                              <p className="text-gray-600">₹{(item.price * item.quantity).toFixed(2)}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 pt-4 border-t border-gray-200 space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Subtotal:</span>
                          <span className="font-medium">₹{(safeTotalAmount * 0.9).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Discount:</span>
                          <span className="font-medium text-green-600">-₹{((safeTotalAmount * 0.9) * 0.1).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Delivery:</span>
                          <span className="font-medium">FREE</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-gray-200 font-bold">
                          <span>Total:</span>
                          <span className="text-emerald-600">₹{safeTotalAmount.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Shipping details (from the Shiprocket pipeline) */}
                      {(order.courierName || order.awbNumber || order.shipmentStatus) && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <h4 className="font-semibold text-gray-900 mb-2">Shipping</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                            {order.courierName && (
                              <div>
                                <span className="text-gray-600">Courier: </span>
                                <span className="font-medium text-gray-900">{order.courierName}</span>
                              </div>
                            )}
                            {order.awbNumber && (
                              <div>
                                <span className="text-gray-600">Tracking No: </span>
                                <span className="font-medium text-gray-900">{order.awbNumber}</span>
                              </div>
                            )}
                            {order.shipmentStatus && (
                              <div>
                                <span className="text-gray-600">Status: </span>
                                <span className="font-medium text-emerald-700">{order.shipmentStatus}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="mt-6 flex gap-3">
                        <button
                          onClick={() =>
                            router.push(
                              order.awbNumber
                                ? `/track?awb=${encodeURIComponent(order.awbNumber)}`
                                : `/track?orderId=${encodeURIComponent(safeOrderId)}`
                            )
                          }
                          className="flex-1 px-4 py-2 border border-emerald-600 text-emerald-600 rounded-lg hover:bg-emerald-50 font-medium transition"
                        >
                          📞 Track Order
                        </button>
                        <button
                          onClick={() => router.push(`/contact-support?orderId=${encodeURIComponent(safeOrderId)}`)}
                          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
                        >
                          💬 Contact Support
                        </button>
                        {canCancelOrder(order) && (
                          <button
                            onClick={() => cancelOrder(order)}
                            disabled={cancellingOrderId === safeOrderId}
                            className="flex-1 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 font-medium transition disabled:opacity-50"
                          >
                            {cancellingOrderId === safeOrderId ? 'Cancelling...' : 'Cancel & Refund'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                  );
                })()
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
