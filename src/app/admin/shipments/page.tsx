'use client';

/**
 * Admin → Shipments management.
 *
 * Additive page (does not modify the existing Orders page). Lists database
 * orders and lets an admin drive the full Shiprocket workflow: create shipment,
 * assign AWB, schedule pickup, generate label/invoice/manifest, track, refresh
 * status and cancel. All Shiprocket calls go through the server API routes; no
 * credentials are ever exposed to this client.
 */

import { useCallback, useEffect, useState } from 'react';

interface ShipmentOrder {
  _id: string;
  totalPrice?: number;
  status?: string;
  paymentStatus?: string;
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
  createdAt?: string;
  userId?: { fullName?: string; email?: string; phone?: string } | string;
  deliveryAddress?: { city?: string; state?: string; pincode?: string } | string;
}

/** Builds the admin auth headers expected by the Shiprocket management routes. */
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
  | 'create-order'
  | 'assign-awb'
  | 'generate-pickup'
  | 'generate-label'
  | 'generate-invoice'
  | 'generate-manifest'
  | 'cancel';

export default function AdminShipments() {
  const [orders, setOrders] = useState<ShipmentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string>('');
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [tracking, setTracking] = useState<{ orderId: string; data: TrackingView } | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders?admin=true', { cache: 'no-store' });
      const data = await res.json();
      setOrders(Array.isArray(data?.orders) ? data.orders : []);
    } catch {
      setNotice({ type: 'err', text: 'Failed to load orders from the database.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Wrap in an async runner so no setState happens synchronously in the effect
    // body (satisfies react-hooks/set-state-in-effect).
    const load = async () => {
      await fetchOrders();
    };
    void load();
  }, [fetchOrders]);

  /** Runs a Shiprocket management action for one order, then refreshes. */
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

  /** Fetches live tracking for an order and shows it in a modal. */
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

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-4xl font-bold text-slate-900">Shipments</h1>
        <p className="text-slate-600 mt-2">Manage Shiprocket shipping for database orders.</p>
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
              <th className="px-4 py-3 font-semibold text-slate-700">Shipment</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Documents</th>
              <th className="px-4 py-3 font-semibold text-slate-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                  No database orders found. Orders created through the DB order API appear here.
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const user = typeof order.userId === 'object' ? order.userId : undefined;
                const addr = typeof order.deliveryAddress === 'object' ? order.deliveryAddress : undefined;
                const hasShipment = Boolean(order.shiprocketShipmentId);
                const hasAwb = Boolean(order.awbNumber);
                return (
                  <tr key={order._id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">#{order._id.slice(-8)}</p>
                      <p className="text-xs text-slate-500">₹{Number(order.totalPrice || 0).toFixed(2)}</p>
                      <p className="text-xs text-slate-500">{order.paymentStatus || 'pending'}</p>
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
                      <p>Shipment: {order.shiprocketShipmentId || '—'}</p>
                      <p>AWB: {order.awbNumber || '—'}</p>
                      <p>Courier: {order.courierName || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                        {order.shipmentStatus || 'NOT CREATED'}
                      </span>
                      <p className="mt-1 text-xs text-slate-500">Pickup: {order.pickupStatus || '—'}</p>
                      {order.estimatedDelivery && (
                        <p className="text-xs text-slate-500">ETA: {order.estimatedDelivery}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs space-y-1">
                      <DocLink label="Label" url={order.labelUrl} />
                      <DocLink label="Invoice" url={order.invoiceUrl} />
                      <DocLink label="Manifest" url={order.manifestUrl} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <ActionButton
                          label="Create"
                          onClick={() => runAction(order._id, 'create-order')}
                          disabled={hasShipment || isBusy(order._id, 'create-order')}
                          busy={isBusy(order._id, 'create-order')}
                        />
                        <ActionButton
                          label="Assign AWB"
                          onClick={() => runAction(order._id, 'assign-awb')}
                          disabled={!hasShipment || hasAwb || isBusy(order._id, 'assign-awb')}
                          busy={isBusy(order._id, 'assign-awb')}
                        />
                        <ActionButton
                          label="Pickup"
                          onClick={() => runAction(order._id, 'generate-pickup')}
                          disabled={!hasAwb || isBusy(order._id, 'generate-pickup')}
                          busy={isBusy(order._id, 'generate-pickup')}
                        />
                        <ActionButton
                          label="Label"
                          onClick={() => runAction(order._id, 'generate-label')}
                          disabled={!hasAwb || isBusy(order._id, 'generate-label')}
                          busy={isBusy(order._id, 'generate-label')}
                        />
                        <ActionButton
                          label="Invoice"
                          onClick={() => runAction(order._id, 'generate-invoice')}
                          disabled={!hasShipment || isBusy(order._id, 'generate-invoice')}
                          busy={isBusy(order._id, 'generate-invoice')}
                        />
                        <ActionButton
                          label="Manifest"
                          onClick={() => runAction(order._id, 'generate-manifest')}
                          disabled={!hasAwb || isBusy(order._id, 'generate-manifest')}
                          busy={isBusy(order._id, 'generate-manifest')}
                        />
                        <ActionButton
                          label="Track"
                          onClick={() => trackOrder(order._id)}
                          disabled={!hasAwb || isBusy(order._id, 'track')}
                          busy={isBusy(order._id, 'track')}
                        />
                        <ActionButton
                          label="Refresh"
                          onClick={() => trackOrder(order._id)}
                          disabled={!hasAwb || isBusy(order._id, 'track')}
                          busy={isBusy(order._id, 'track')}
                          variant="ghost"
                        />
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
    'create-order': 'Create shipment',
    'assign-awb': 'AWB assignment',
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
        View
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
  const styles: Record<string, string> = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    ghost: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded px-2 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]}`}
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-slate-900">Tracking #{orderId.slice(-8)}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 text-2xl">
            ✕
          </button>
        </div>
        <div className="mb-4 text-sm text-slate-600 space-y-0.5">
          <p>AWB: <span className="font-medium text-slate-900">{data.awb || '—'}</span></p>
          <p>Courier: <span className="font-medium text-slate-900">{data.courierName || '—'}</span></p>
          <p>Status: <span className="font-medium text-slate-900">{data.currentStatus}</span></p>
          {data.estimatedDelivery && <p>ETA: {data.estimatedDelivery}</p>}
        </div>
        <ol className="relative border-l border-slate-200 pl-4 space-y-4">
          {data.activities.length === 0 ? (
            <li className="text-sm text-slate-500">No tracking activity yet.</li>
          ) : (
            data.activities.map((activity, idx) => (
              <li key={idx} className="ml-2">
                <div className="absolute -left-1.5 mt-1 h-3 w-3 rounded-full bg-blue-500" />
                <p className="text-sm font-medium text-slate-900">{activity.activity || activity.status}</p>
                <p className="text-xs text-slate-500">
                  {activity.location} {activity.date ? `• ${activity.date}` : ''}
                </p>
              </li>
            ))
          )}
        </ol>
      </div>
    </div>
  );
}
