'use client';

import { useState, useEffect } from 'react';

/**
 * Normalizes a database order (from GET /api/orders?admin=true) into the shape
 * this admin panel renders. The DB uses `totalPrice` / `productName` and stores
 * the customer as a populated `userId` ref.
 */
function normalizeAdminOrder(o: any): any {
  const shipping = Number(o?.shippingCharge || 0);
  const total = Number(o?.totalPrice ?? o?.totalAmount ?? 0);
  const customer = o?.userId && typeof o.userId === 'object' ? o.userId : null;
  return {
    _id: String(o?._id || ''),
    customerName: customer?.fullName || o?.deliveryAddress?.fullName || 'N/A',
    customerEmail: customer?.email || 'N/A',
    customerPhone: customer?.phone || o?.deliveryAddress?.phone || 'N/A',
    items: Array.isArray(o?.items)
      ? o.items.map((i: any) => ({
          name: i?.productName || i?.name || 'Item',
          price: Number(i?.price || 0),
          quantity: Number(i?.quantity || 0),
          vendorName: i?.vendorName || '',
          vendorId: i?.vendorId || '',
        }))
      : [],
    totalAmount: total,
    subtotal: Math.max(total - shipping, 0),
    discount: 0,
    deliveryCharge: shipping,
    deliveryAddress: o?.deliveryAddress || null,
    paymentMethod: o?.paymentMethod || (o?.razorpayPaymentId ? 'razorpay' : 'cod'),
    paymentStatus: o?.paymentStatus,
    status: o?.status || 'pending',
    createdAt: o?.createdAt,
  };
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === 'orders') {
        fetchOrders();
      }
    };

    const handleFocus = () => fetchOrders();

    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, searchTerm, statusFilter]);

  const getOrderId = (order: any): string => {
    return String(order?._id || order?.id || order?.orderId || '').trim();
  };

  const normalizeStatus = (status: string | undefined): string => {
    return String(status || 'pending').toLowerCase();
  };

  const fetchOrders = async () => {
    try {
      // The database is the source of truth for ALL customer orders. localStorage
      // is per-browser, so it only ever held orders placed on this device.
      const res = await fetch('/api/orders?admin=true', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('adminToken') || ''}`,
        },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data?.orders) ? data.orders.map(normalizeAdminOrder) : [];
        setOrders(list);
      } else {
        console.error('Admin orders fetch failed', res.status);
        setOrders([]);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const filterOrders = () => {
    let filtered = [...orders];

    if (searchTerm) {
      filtered = filtered.filter(
        (order) =>
          getOrderId(order).toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.customerEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((order) => normalizeStatus(order.status) === statusFilter);
    }

    setFilteredOrders(filtered);
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    if (!orderId) return;
    try {
      setUpdatingStatus(orderId);

      // Persist to the database (source of truth) for real DB orders.
      const isDbOrder = /^[0-9a-fA-F]{24}$/.test(orderId);
      if (isDbOrder) {
        const res = await fetch('/api/orders', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('adminToken') || ''}`,
          },
          body: JSON.stringify({ orderId, status: newStatus, userType: 'admin' }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || 'Failed to update order');
        }
      }

      // Keep any localStorage copy in sync too.
      try {
        const ordersStr = localStorage.getItem('orders') || '[]';
        const ordersList = JSON.parse(ordersStr);
        const updatedLocal = ordersList.map((order: any) =>
          order._id === orderId || order.id === orderId || order.dbOrderId === orderId
            ? { ...order, status: newStatus }
            : order
        );
        localStorage.setItem('orders', JSON.stringify(updatedLocal));
      } catch {
        // ignore local sync errors
      }

      // Update on-screen state.
      setOrders((prev) =>
        prev.map((order: any) =>
          order._id === orderId || order.id === orderId ? { ...order, status: newStatus } : order
        )
      );

      alert('Order status updated successfully');
    } catch (error: any) {
      console.error('Error updating order status:', error);
      alert(error?.message || 'Failed to update order status');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (normalizeStatus(status)) {
      case 'completed':
      case 'delivered':
        return 'bg-emerald-100 text-emerald-800';
      case 'pending':
        return 'bg-orange-100 text-orange-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'processing':
        return 'bg-sky-100 text-sky-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'shipped':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full border-4 border-blue-600 border-t-transparent animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900">Orders Management</h1>
        <p className="text-slate-600 mt-2">View all customer orders and vendor status updates</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
          <p className="text-slate-600 text-sm font-medium">Total Orders</p>
          <p className="text-4xl font-bold text-slate-900 mt-2">{orders.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
          <p className="text-slate-600 text-sm font-medium">Completed</p>
          <p className="text-4xl font-bold text-emerald-600 mt-2">
            {orders.filter((o) => ['completed', 'delivered'].includes(normalizeStatus(o.status))).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
          <p className="text-slate-600 text-sm font-medium">Pending</p>
          <p className="text-4xl font-bold text-orange-600 mt-2">
            {orders.filter((o) => o.status === 'pending').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6">
          <p className="text-slate-600 text-sm font-medium">Cancelled</p>
          <p className="text-4xl font-bold text-red-600 mt-2">
            {orders.filter((o) => o.status === 'cancelled').length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md border border-slate-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Search by order ID, customer email or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
          >
            <option value="all">All Orders</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Order ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order, index) => (
                  <tr key={getOrderId(order) || `order-${index}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      #{(getOrderId(order) || 'N/A').substring(0, 8)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <div>{order.customerName || 'N/A'}</div>
                      <div className="text-xs text-gray-500">{order.customerEmail || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      ₹{(Number(order.totalAmount ?? order.total ?? 0)).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(
                          order.status || 'pending'
                        )}`}
                      >
                        {normalizeStatus(order.status || 'pending')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <select
                          value={order.status || 'pending'}
                          onChange={(e) => updateOrderStatus(order._id || order.id, e.target.value)}
                          disabled={updatingStatus === (order._id || order.id)}
                          className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="shipped">Shipped</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowModal(true);
                          }}
                          className="text-indigo-600 hover:text-indigo-900 font-medium text-xs"
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filteredOrders.length > 10 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing {filteredOrders.length} of {orders.length} orders
          </p>
          <div className="flex gap-2">
            <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700">
              Previous
            </button>
            <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-700">
              Next
            </button>
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {showModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full p-6 max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Order Details</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Order Info */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-sm text-gray-600">Order ID</p>
                <p className="text-lg font-semibold text-gray-900">#{getOrderId(selectedOrder) || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Order Date</p>
                <p className="text-lg font-semibold text-gray-900">
                  {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>

            {/* Customer Details */}
            <div className="border-t border-b py-4 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Customer Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Name</p>
                  <p className="font-medium text-gray-900">{selectedOrder.customerName || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium text-gray-900">{selectedOrder.customerEmail || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-medium text-gray-900">{selectedOrder.customerPhone || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Delivery Address */}
            <div className="border-t border-b py-4 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery Address</h3>
              {selectedOrder.deliveryAddress ? (
                <div className="text-gray-700 text-sm space-y-1">
                  <p><strong>Full Name:</strong> {selectedOrder.deliveryAddress.fullName || 'N/A'}</p>
                  <p><strong>Phone:</strong> {selectedOrder.deliveryAddress.phone || 'N/A'}</p>
                  <p><strong>Address:</strong> {selectedOrder.deliveryAddress.addressLine1 || 'N/A'}</p>
                  {selectedOrder.deliveryAddress.addressLine2 && <p><strong>Address 2:</strong> {selectedOrder.deliveryAddress.addressLine2}</p>}
                  <p><strong>City:</strong> {selectedOrder.deliveryAddress.city || 'N/A'}</p>
                  <p><strong>State:</strong> {selectedOrder.deliveryAddress.state || 'N/A'}</p>
                  <p><strong>Pincode:</strong> {selectedOrder.deliveryAddress.pincode || 'N/A'}</p>
                  <p><strong>Country:</strong> {selectedOrder.deliveryAddress.country || 'N/A'}</p>
                </div>
              ) : (
                <p className="text-gray-500">No address provided</p>
              )}
            </div>

            {/* Order Items */}
            <div className="border-t border-b py-4 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Items</h3>
              <div className="space-y-3">
                {selectedOrder.items && selectedOrder.items.length > 0 ? (
                  selectedOrder.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm border-b pb-2">
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                      </div>
                      <p className="font-medium text-gray-900">₹{(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm">No items in order</p>
                )}
              </div>
            </div>

            {/* Order Summary */}
            <div className="border-t pt-4 mb-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">₹{(selectedOrder.subtotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Discount:</span>
                  <span className="font-medium text-emerald-600">-₹{(selectedOrder.discount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Delivery:</span>
                  <span className="font-medium">₹{(selectedOrder.deliveryCharge || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-gray-900 font-bold">Total:</span>
                  <span className="font-bold text-lg">₹{(selectedOrder.totalAmount || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Payment & Status Info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-600">Payment Method</p>
                <p className="font-medium text-gray-900">{selectedOrder.paymentMethod || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Order Status</p>
                <p className={`font-medium px-3 py-1 rounded-full w-fit text-sm ${
                  selectedOrder.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                  selectedOrder.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                  selectedOrder.status === 'shipped' ? 'bg-indigo-100 text-indigo-800' :
                  selectedOrder.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {selectedOrder.status || 'pending'}
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowModal(false)}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white py-2 rounded-lg font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
