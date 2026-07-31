'use client';

/**
 * Admin → Shipments
 *
 * Auto-fulfilment creates shipment + AWB + pickup + label/invoice PDFs on order
 * place. This page is for packing: print label/invoice, retry if auto failed,
 * and optional manifest/cancel.
 */

import { useCallback, useEffect, useState } from 'react';

interface ShipmentOrder {
  _id: string;
  totalPrice?: number;
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  shippingCharge?: number;
  courierName?: string;
  shiprocketOrderId?: string;
  shiprocketShipmentId?: string;
  awbNumber?: string;
  shipmentStatus?: string;
  pickupStatus?: string;
  labelUrl?: string;
  invoiceUrl?: string;
  manifestUrl?: string;
  estimatedDelivery?: string;
  trackingUrl?: string;
  shiprocketLastError?: string;
  shiprocketPipelineStep?: string;
  createdAt?: string;
  userId?: { fullName?: string; email?: string; phone?: string } | string;
  deliveryAddress?: { city?: string; state?: string; pincode?: string } | string;
}

function adminHeaders(): HeadersInit {
  if (typeof window === 'undefined') return {};
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('adminToken') || ''}`,
    'x-token-expires-at': localStorage.getItem('tokenExpiresAt') || '',
    'x-admin-email': localStorage.getItem('adminEmail') || '',
  };
}

type ShipmentAction =
  | 'auto-fulfill'
  | 'generate-label'
  | 'generate-invoice'
  | 'generate-manifest'
  | 'generate-pickup'
  | 'cancel';

export default function AdminShipments() {
  const [orders, setOrders] = useState<ShipmentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string>('');
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [tracking, setTracking] = useState<{ orderId: string; data: TrackingView } | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders?admin=true', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('adminToken') || ''}`,
        },
        cache: 'no-store',
      });
      const data = await res.json();
      setOrders(Array.isArray(data?.orders) ? data.orders : []);
    } catch {
      setNotice({ type: 'err', text: 'Failed to load orders from the database.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      await fetchOrders();
    };
    void load();
  }, [fetchOrders]);

  const runAction = async (orderId: string, action: ShipmentAction) => {
    const confirmCancel = action === 'cancel' && !window.confirm('Cancel this shipment in Shiprocket?');
    if (confirmCancel) return;

    setBusyKey(`${orderId}:${action}`);
    setNotice(null);
    try {
      const res = await fetch(`/api/shiprocket/${action}`, {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message || 'Action failed');
      }

      setNotice({ type: 'ok', text: `${labelForAction(action)} completed.` });
      await fetchOrders();
    } catch (error) {
      setNotice({ type: 'err', text: error instanceof Error ? error.message : 'Action failed' });
    } finally {
      setBusyKey('');
    }
  };

  const trackOrder = async (orderId: string) => {
    setBusyKey(`${orderId}:track`);
    setNotice(null);
    try {
      const res = await fetch(`/api/shiprocket/track?orderId=${encodeURIComponent(orderId)}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error?.message || 'Unable to track shipment');
      }
      setTracking({ orderId, data: data.data as TrackingView });
      await fetchOrders();
    } catch (error) {
      setNotice({ type: 'err', text: error instanceof Error ? error.message : 'Tracking failed' });
    } finally {
      setBusyKey('');
    }
  };

  const isBusy = (orderId: string, action: string) => busyKey === `${orderId}:${action}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full border-4 border-blue-600 border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Loading shipments…</p>
        </div>
      </div>
    );
  }

  const needsAttention = orders.filter((o) => !o.awbNumber).length;
  const readyToPack = orders.filter((o) => o.awbNumber).length;

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-slate-900">Shipments</h1>
        <p className="text-slate-600 mt-2">
          Shipments and AWBs are created automatically when a customer places an India order.
          Pack the order, then print the label and invoice.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 font-medium">
            Ready to pack: {readyToPack}
          </span>
          <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 font-medium">
            Needs auto-fulfill: {needsAttention}
          </span>
        </div>
      </div>

      {notice && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm font-medium ${
            notice.type === 'ok'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-700">Order</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Customer</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Shipment / AWB</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Print</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                  No database orders found.
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const user = typeof order.userId === 'object' ? order.userId : undefined;
                const addr = typeof order.deliveryAddress === 'object' ? order.deliveryAddress : undefined;
                const hasAwb = Boolean(order.awbNumber);
                const hasError = Boolean(order.shiprocketLastError);
                return (
                  <tr key={order._id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">#{order._id.slice(-8)}</p>
                      <p className="text-xs text-slate-500">₹{Number(order.totalPrice || 0).toFixed(2)}</p>
                      <p className="text-xs text-slate-500">
                        {String(order.paymentMethod || order.paymentStatus || 'pending').toUpperCase()}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-800">{user?.fullName || 'N/A'}</p>
                      <p className="text-xs text-slate-500">{user?.email || ''}</p>
                      <p className="text-xs text-slate-500">
                        {addr ? `${addr.city || ''} ${addr.pincode || ''}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 space-y-0.5">
                      <p>SR Order: {order.shiprocketOrderId || '—'}</p>
                      <p className="font-semibold text-slate-900">AWB: {order.awbNumber || 'Not assigned'}</p>
                      <p>Courier: {order.courierName || '—'}</p>
                      {hasError && (
                        <p className="text-red-600 mt-1 max-w-xs">Error: {order.shiprocketLastError}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                          hasAwb
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {hasAwb ? 'Ready to pack' : 'Awaiting AWB'}
                      </span>
                      <p className="mt-1 text-xs text-slate-500">
                        {order.shipmentStatus || 'NOT CREATED'}
                      </p>
                      <p className="text-xs text-slate-500">Pickup: {order.pickupStatus || '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-xs space-y-1">
                      <DocLink label="Label" url={order.labelUrl} />
                      <DocLink label="Invoice" url={order.invoiceUrl} />
                      <DocLink label="Manifest" url={order.manifestUrl} />
                      {hasAwb && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <ActionButton
                            label="Print Label"
                            onClick={() =>
                              order.labelUrl
                                ? window.open(order.labelUrl, '_blank')
                                : runAction(order._id, 'generate-label')
                            }
                            disabled={isBusy(order._id, 'generate-label')}
                            busy={isBusy(order._id, 'generate-label')}
                          />
                          <ActionButton
                            label="Print Invoice"
                            onClick={() =>
                              order.invoiceUrl
                                ? window.open(order.invoiceUrl, '_blank')
                                : runAction(order._id, 'generate-invoice')
                            }
                            disabled={isBusy(order._id, 'generate-invoice')}
                            busy={isBusy(order._id, 'generate-invoice')}
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {!hasAwb && (
                          <ActionButton
                            label="Auto-fulfill"
                            onClick={() => runAction(order._id, 'auto-fulfill')}
                            disabled={isBusy(order._id, 'auto-fulfill')}
                            busy={isBusy(order._id, 'auto-fulfill')}
                          />
                        )}
                        {hasAwb && hasError && (
                          <ActionButton
                            label="Retry docs"
                            onClick={() => runAction(order._id, 'auto-fulfill')}
                            disabled={isBusy(order._id, 'auto-fulfill')}
                            busy={isBusy(order._id, 'auto-fulfill')}
                            variant="ghost"
                          />
                        )}
                        {hasAwb && (
                          <>
                            <ActionButton
                              label="Manifest"
                              onClick={() => runAction(order._id, 'generate-manifest')}
                              disabled={isBusy(order._id, 'generate-manifest')}
                              busy={isBusy(order._id, 'generate-manifest')}
                              variant="ghost"
                            />
                            <ActionButton
                              label="Track"
                              onClick={() => trackOrder(order._id)}
                              disabled={isBusy(order._id, 'track')}
                              busy={isBusy(order._id, 'track')}
                              variant="ghost"
                            />
                          </>
                        )}
                        <ActionButton
                          label="Cancel"
                          onClick={() => runAction(order._id, 'cancel')}
                          disabled={!order.shiprocketOrderId || isBusy(order._id, 'cancel')}
                          busy={isBusy(order._id, 'cancel')}
                          variant="danger"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {tracking && (
        <TrackingModal
          orderId={tracking.orderId}
          data={tracking.data}
          onClose={() => setTracking(null)}
        />
      )}
    </div>
  );
}

interface TrackingView {
  awb: string;
  courierName: string;
  currentStatus: string;
  rawStatus: string;
  estimatedDelivery: string;
  trackUrl: string;
  activities: Array<{ date: string; status: string; activity: string; location: string }>;
}

function labelForAction(action: ShipmentAction): string {
  const map: Record<ShipmentAction, string> = {
    'auto-fulfill': 'Auto-fulfilment',
    'generate-pickup': 'Pickup generation',
    'generate-label': 'Label generation',
    'generate-invoice': 'Invoice generation',
    'generate-manifest': 'Manifest generation',
    cancel: 'Cancellation',
  };
  return map[action];
}

function DocLink({ label, url }: { label: string; url?: string }) {
  if (!url) return <p className="text-slate-400">{label}: —</p>;
  return (
    <p>
      {label}:{' '}
      <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
        Open
      </a>
    </p>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  busy,
  variant = 'primary',
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
}) {
  const styles =
    variant === 'danger'
      ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
      : variant === 'ghost'
        ? 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
        : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50 ${styles}`}
    >
      {busy ? '…' : label}
    </button>
  );
}

function TrackingModal({
  orderId,
  data,
  onClose,
}: {
  orderId: string;
  data: TrackingView;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Live tracking</h2>
            <p className="text-xs text-slate-500">Order #{orderId.slice(-8)}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800">
            ✕
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm mb-4">
          <div>
            <p className="text-xs text-slate-500">Courier</p>
            <p className="font-semibold">{data.courierName || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">AWB</p>
            <p className="font-semibold">{data.awb || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Status</p>
            <p className="font-semibold text-emerald-700">{data.currentStatus || data.rawStatus}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">ETA</p>
            <p className="font-semibold">{data.estimatedDelivery || '—'}</p>
          </div>
        </div>
        <ol className="space-y-3 border-l border-slate-200 pl-4">
          {(data.activities || []).map((activity, idx) => (
            <li key={idx}>
              <p className="text-sm font-medium text-slate-900">{activity.activity || activity.status}</p>
              <p className="text-xs text-slate-500">
                {activity.location} {activity.date ? `• ${activity.date}` : ''}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
