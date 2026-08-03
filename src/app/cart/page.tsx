'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { OTPVerificationModal } from '@/components/OTPVerificationModal';
import PrescriptionChecker from '@/components/PrescriptionChecker';
import { isIndiaCountry, normalizeCountryCode, type CountryCode } from '@/lib/countryPreference';
import { usePreferredCountry } from '@/lib/usePreferredCountry';
import { getMissingPrescriptions, getAllPrescriptions } from '@/lib/prescriptionUtils';
import { getIndiaFlatShippingCharge } from '@/lib/shippingRates';

interface CartItem {
  id: string | number;
  productId?: string | number;
  productName?: string;
  name: string;
  price: number;
  displayPrice?: number;
  displayMrp?: number;
  currencySymbol?: '₹' | '$';
  currency?: 'INR' | 'USD';
  quantity: number;
  brand: string;
  image?: string;
  vendorId?: string;
  requiresPrescription?: boolean;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, callback: (response: any) => void) => void;
    };
    paypal?: {
      Buttons: (options: Record<string, unknown>) => {
        render: (container: string) => Promise<void>;
      };
    };
    HeadlessCheckout?: {
      addToCart: (
        event: unknown,
        token: string,
        options: { fallbackUrl: string; isInitiatedFromApp?: boolean }
      ) => void;
    };
  }
}

// Shiprocket Checkout (SRC) hosted widget assets. Override the base with
// NEXT_PUBLIC_SHIPROCKET_CHECKOUT_UI (e.g. the staging URL) when needed.
const SRC_UI_BASE =
  process.env.NEXT_PUBLIC_SHIPROCKET_CHECKOUT_UI || 'https://checkout-ui.shiprocket.com';
const SRC_JS_URL = `${SRC_UI_BASE}/assets/js/channels/shopify.js`;
const SRC_CSS_URL = `${SRC_UI_BASE}/assets/styles/shopify.css`;
// Feature flag – Shiprocket Checkout button is only shown when explicitly enabled.
const SRC_ENABLED = process.env.NEXT_PUBLIC_SHIPROCKET_CHECKOUT_ENABLED === 'true';

/** Loads the Shiprocket Checkout JS + CSS once. */
async function loadShiprocketCheckoutScript(): Promise<boolean> {
  if (typeof window !== 'undefined' && window.HeadlessCheckout) return true;

  if (!document.querySelector(`link[href="${SRC_CSS_URL}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = SRC_CSS_URL;
    document.head.appendChild(link);
  }

  return new Promise<boolean>((resolve) => {
    const existing = document.querySelector(`script[src="${SRC_JS_URL}"]`) as HTMLScriptElement | null;
    if (existing) {
      if (window.HeadlessCheckout) return resolve(true);
      existing.addEventListener('load', () => resolve(Boolean(window.HeadlessCheckout)));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = SRC_JS_URL;
    script.async = true;
    script.onload = () => resolve(Boolean(window.HeadlessCheckout));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function isImageUrl(value?: string) {
  return !!value && /^(https?:\/\/|\/)/i.test(value);
}

async function loadRazorpayScript() {
  if (window.Razorpay) return true;

  return new Promise<boolean>((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

async function loadPayPalScript(clientId: string, currency: string) {
  const scriptId = 'paypal-sdk-script';
  const desiredSrc =
    `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}` +
    `&currency=${encodeURIComponent(currency)}` +
    '&intent=capture&components=buttons&disable-funding=venmo,paylater,credit';

  const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
  if (existing) {
    if (existing.src === desiredSrc && window.paypal) return true;
    existing.remove();
    // Force SDK remount when client/currency changes
    (window as any).paypal = undefined;
  }

  return new Promise<boolean>((resolve) => {
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = desiredSrc;
    script.async = true;
    script.onload = () => resolve(Boolean(window.paypal));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function CartPage() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [srcBusy, setSrcBusy] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>('IN');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [isOTPVerified, setIsOTPVerified] = useState(false);
  const [paypalClientId, setPaypalClientId] = useState('');
  const [paypalCurrency, setPaypalCurrency] = useState('USD');
  const [paypalConfigured, setPaypalConfigured] = useState(false);
  const [prescriptionsReady, setPrescriptionsReady] = useState(true);
  const [paypalButtonError, setPaypalButtonError] = useState('');
  const [address, setAddress] = useState({
    houseNo: '',
    streetAddress: '',
    fullName: '',
    phoneNumber: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
  });
  // Live Shiprocket serviceability result for the entered delivery pincode.
  // Kept additive: when unavailable we fall back to the existing flat charge.
  const [shippingInfo, setShippingInfo] = useState<{
    checking: boolean;
    checkedPincode: string;
    serviceable: boolean;
    rate: number;
    courier: string;
    etd: string;
    codAvailable: boolean;
    error: string;
  }>({
    checking: false,
    checkedPincode: '',
    serviceable: false,
    rate: 0,
    courier: '',
    etd: '',
    codAvailable: false,
    error: '',
  });
  const router = useRouter();
  const { country: preferredCountry } = usePreferredCountry();

  // Prefer live country preference; also treat USD carts as international so Fast
  // Checkout (PayPal) stays visible even if country state briefly lags.
  const cartLooksInternational = cartItems.some(
    (item) => item?.currency === 'USD' || item?.currencySymbol === '$'
  );
  const isInternational = !isIndiaCountry(selectedCountry) || cartLooksInternational;
  const isIndia = !isInternational;
  const currencySymbol = isIndia ? '₹' : '$';
  const effectivePrice = (item?: CartItem) => item ? Number(item.displayPrice ?? item.price) || 0 : 0;
  const totalPrice = cartItems.reduce((sum, item) => sum + effectivePrice(item) * (item?.quantity || 0), 0);
  const discount = Math.floor(totalPrice * 0.10); // 10% discount
  const finalPrice = totalPrice - discount;
  // Business rule: Delhi NCR ₹50, rest of India ₹79. International: free shipping.
  // Charge updates whenever the customer enters city / state / pincode.
  const flatIndiaShipping = getIndiaFlatShippingCharge({
    city: address.city,
    state: address.state,
    pincode: address.postalCode,
  });
  const hasDeliveryPincode = /^\d{6}$/.test(String(address.postalCode || '').trim());
  // India: always charge location flat rate (never ₹0). International: free.
  const deliveryCharge = isIndia ? Math.max(flatIndiaShipping, 50) : 0;
  const totalAmount = finalPrice + deliveryCharge;
  const deliveryZoneLabel = !isIndia
    ? 'FREE international'
    : !hasDeliveryPincode
      ? 'Enter pincode to confirm (₹79 until then)'
      : flatIndiaShipping === 50
        ? 'Delhi NCR ₹50'
        : 'Other India ₹79';

  // International / USD carts never use India SMS OTP.
  useEffect(() => {
    if (!isInternational) return;
    setIsOTPVerified(true);
    setShowOTPModal(false);
  }, [isInternational]);

  const getStoredCountry = () => {
    const fromLocalStorage = localStorage.getItem('preferredCountry');
    if (fromLocalStorage) return normalizeCountryCode(fromLocalStorage);

    const match = document.cookie.match(/(?:^|;\s*)preferredCountry=([^;]+)/i);
    if (match?.[1]) return normalizeCountryCode(decodeURIComponent(match[1]));

    return 'IN' as CountryCode;
  };

  const syncCartWithCountry = async (country: CountryCode) => {
    const savedCart = localStorage.getItem('cart');
    if (!savedCart) return;

    try {
      const parsed = JSON.parse(savedCart);
      if (!Array.isArray(parsed) || parsed.length === 0) return;

      // Fetch fresh product details with current country pricing
      const updatedItems = await Promise.all(
        parsed.map(async (item: any) => {
          try {
            const response = await fetch(`/api/products/${item.id}`, {
              headers: {
                'Cookie': `preferredCountry=${country}`,
              },
              cache: 'no-store',
            });
            const data = await response.json();
            const product = data.product;

            if (product) {
              return {
                id: item.id,
                productId: product._id,
                productName: product.name || 'Product',
                name: product.name || item.name || 'Product',
                price: product.displayPrice || product.price || 0,
                displayPrice: product.displayPrice || product.price || 0,
                displayMrp: product.displayMrp ?? product.mrp,
                currencySymbol: (product.displayCurrency === 'USD' || product.currency === 'USD') ? ('$' as const) : ('₹' as const),
                currency: (product.displayCurrency === 'USD' || product.currency === 'USD') ? ('USD' as const) : ('INR' as const),
                quantity: Number(item.quantity) || 1,
                brand: product.brand || item.brand || 'MySanjeevni',
                image: product.image || product.icon || item.image || '💊',
                vendorId: item.vendorId,
                requiresPrescription: product.requiresPrescription || false,
              };
            }
          } catch {
            // Fall back to stored item if API fails
            return {
              id: item.id,
              productId: item.productId || item.id,
              productName: item.productName || item.name || 'Product',
              name: item.name || 'Product',
              price: Number(item.price ?? item.displayPrice) || 0,
              displayPrice: Number(item.displayPrice ?? item.price) || 0,
              displayMrp: item.displayMrp != null ? Number(item.displayMrp) || undefined : undefined,
              currencySymbol: item.currencySymbol === '$' ? ('$' as const) : ('₹' as const),
              currency: item.currency === 'USD' ? ('USD' as const) : ('INR' as const),
              quantity: Number(item.quantity) || 1,
              brand: item.brand || 'MySanjeevni',
              image: item.image || '💊',
              vendorId: item.vendorId,
              requiresPrescription: item.requiresPrescription || false,
            };
          }
        })
      );

      setCartItems(updatedItems as CartItem[]);
      // Update localStorage with synced cart items
      localStorage.setItem('cart', JSON.stringify(updatedItems));
    } catch {
      // If syncing fails, just load the cart as-is
      const savedCart = localStorage.getItem('cart');
      if (savedCart) {
        try {
          const parsed = JSON.parse(savedCart);
          const normalized = Array.isArray(parsed)
            ? parsed.map((item: any) => ({
                id: item.id,
                productId: item.productId || item.id,
                productName: item.productName || item.name || 'Product',
                name: item.name || 'Product',
                price: Number(item.price ?? item.displayPrice) || 0,
                displayPrice: Number(item.displayPrice ?? item.price) || 0,
                displayMrp: item.displayMrp != null ? Number(item.displayMrp) || undefined : undefined,
                currencySymbol: item.currencySymbol === '$' ? ('$' as const) : ('₹' as const),
                currency: item.currency === 'USD' ? ('USD' as const) : ('INR' as const),
                quantity: Number(item.quantity) || 1,
                brand: item.brand || 'MySanjeevni',
                image: item.image || '💊',
                vendorId: item.vendorId,
                requiresPrescription: item.requiresPrescription || false,
              }))
            : [];
          setCartItems(normalized);
        } catch {
          setCartItems([]);
        }
      }
    }
  };

  useEffect(() => {
    const country = getStoredCountry();
    setSelectedCountry(country);
    setSelectedPaymentMethod(isIndiaCountry(country) ? 'domestic' : 'paypal');

    // Sync cart with current country pricing
    syncCartWithCountry(country);

    // Load user from localStorage
    const userStr = localStorage.getItem('user');
    if (userStr) {
      setUser(JSON.parse(userStr));
    }
  }, []);

  // Keep cart country in sync with header preference (same tab + storage).
  useEffect(() => {
    const applyCountry = (newCountry: CountryCode) => {
      if (newCountry === selectedCountry) return;
      setSelectedCountry(newCountry);
      setSelectedPaymentMethod(isIndiaCountry(newCountry) ? 'domestic' : 'paypal');
      syncCartWithCountry(newCountry);
    };

    const handleCountryChange = () => applyCountry(getStoredCountry());
    const handlePreferredCountryChanged = (event: Event) => {
      const detailCountry = (event as CustomEvent<{ country?: string }>)?.detail?.country;
      applyCountry(normalizeCountryCode(detailCountry || getStoredCountry()));
    };

    window.addEventListener('storage', handleCountryChange);
    window.addEventListener('preferredCountryChanged', handlePreferredCountryChanged);
    return () => {
      window.removeEventListener('storage', handleCountryChange);
      window.removeEventListener('preferredCountryChanged', handlePreferredCountryChanged);
    };
  }, [selectedCountry]);

  // Hook updates after mount / custom event — mirror into selectedCountry.
  useEffect(() => {
    const normalized = normalizeCountryCode(preferredCountry);
    if (normalized && normalized !== selectedCountry) {
      setSelectedCountry(normalized);
      setSelectedPaymentMethod(isIndiaCountry(normalized) ? 'domestic' : 'paypal');
      syncCartWithCountry(normalized);
    }
  }, [preferredCountry]);

  useEffect(() => {
    const loadPaypalConfig = async () => {
      try {
        const res = await fetch('/api/payments/paypal/config', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load PayPal config');

        setPaypalConfigured(Boolean(data?.configured && data?.clientId));
        setPaypalClientId(String(data?.clientId || ''));
        setPaypalCurrency(String(data?.currency || 'USD').toUpperCase());
      } catch {
        setPaypalConfigured(false);
        setPaypalClientId('');
      }
    };

    if (showPaymentModal) {
      loadPaypalConfig();
    }
  }, [showPaymentModal]);

  useEffect(() => {
    if (!showPaymentModal || selectedPaymentMethod !== 'paypal') return;

    let isMounted = true;

    const mountPayPalButtons = async () => {
      setPaypalButtonError('');

      if (!paypalConfigured || !paypalClientId) {
        setPaypalButtonError('PayPal is not configured by admin.');
        return;
      }

      const loaded = await loadPayPalScript(paypalClientId, paypalCurrency);
      if (!loaded || !window.paypal) {
        setPaypalButtonError('Unable to load PayPal SDK. Please try again.');
        return;
      }

      const container = document.getElementById('paypal-button-container');
      if (container) container.innerHTML = '';

      try {
        await window.paypal.Buttons({
          style: {
            layout: 'vertical',
            color: 'blue',
            shape: 'rect',
            label: 'paypal',
          },
          createOrder: async () => {
            if (!user?.id) {
              throw new Error('Please login before paying with PayPal');
            }
            const res = await fetch('/api/payments/paypal/create-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ amount: totalAmount, currency: paypalCurrency }),
            });
            const data = await res.json();
            if (!res.ok || !data?.orderId) {
              console.error('[PayPal createOrder UI]', data);
              throw new Error(data?.error || 'Failed to create PayPal order');
            }
            return data.orderId;
          },
          onApprove: async (data: any) => {
            setIsProcessing(true);
            try {
              const res = await fetch('/api/payments/paypal/capture-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderID: data.orderID }),
              });
              const captureData = await res.json();

              if (!res.ok || !captureData?.success) {
                throw new Error(captureData?.error || 'PayPal payment capture failed');
              }

              const captureId =
                captureData?.capture?.purchase_units?.[0]?.payments?.captures?.[0]?.id || '';

              const prescriptions = getAllPrescriptions();

              // Persist to DB — required for Admin / Vendor / User order views.
              const dbResult = await persistOrderToDatabase({
                paymentMethod: 'paypal',
                paymentStatus: 'completed',
              });

              const order = {
                _id: dbResult.orderId,
                dbOrderId: dbResult.orderId,
                userId: user?.id || 'guest',
                customerName: address.fullName,
                customerEmail: user?.email || 'not-provided',
                customerPhone: address.phoneNumber,
                items: cartItems.filter((item) => item).map((item) => ({
                  ...item,
                  vendorId: item.vendorId || 'default-vendor',
                  prescriptionUrl: item.requiresPrescription ? prescriptions[String(item.productId || item.id)] : undefined,
                })),
                totalAmount,
                subtotal: finalPrice,
                discount,
                deliveryCharge,
                paymentMethod: 'paypal',
                paymentGateway: 'paypal',
                paypalOrderId: data.orderID,
                paypalCaptureId: captureId,
                deliveryAddress: address,
                status: 'confirmed',
                paymentStatus: 'completed',
                awbNumber: dbResult.awbNumber || '',
                courierName: dbResult.courierName || '',
                shipmentStatus: dbResult.shipmentStatus || '',
                createdAt: new Date().toISOString(),
              };

              const orders = JSON.parse(localStorage.getItem('orders') || '[]');
              orders.push(order);
              localStorage.setItem('orders', JSON.stringify(orders));

              setCartItems([]);
              localStorage.setItem('cart', JSON.stringify([]));

              setShowPaymentModal(false);
              setSelectedPaymentMethod('');
              setIsProcessing(false);

              alert(`Payment successful!\n\nOrder ID: ${order._id}\nPayPal Order ID: ${data.orderID}`);
              router.push('/orders');
            } catch (error: any) {
              setIsProcessing(false);
              alert(error?.message || 'PayPal payment failed. Please try again.');
            }
          },
          onCancel: () => {
            setIsProcessing(false);
            alert('Payment cancelled. Redirecting to homepage.');
            router.push('/');
          },
          onError: (error: any) => {
            setIsProcessing(false);
            setPaypalButtonError(error?.message || 'PayPal checkout failed');
            alert('PayPal checkout failed. Redirecting to homepage.');
            router.push('/');
          },
        }).render('#paypal-button-container');
      } catch (error: any) {
        if (!isMounted) return;
        setPaypalButtonError(error?.message || 'Unable to initialize PayPal checkout');
      }
    };

    mountPayPalButtons();

    return () => {
      isMounted = false;
      const container = document.getElementById('paypal-button-container');
      if (container) container.innerHTML = '';
    };
  }, [
    address,
    cartItems,
    deliveryCharge,
    discount,
    finalPrice,
    paypalClientId,
    paypalConfigured,
    paypalCurrency,
    router,
    selectedPaymentMethod,
    showPaymentModal,
    totalAmount,
    user,
  ]);

  const updateQuantity = (id: string | number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    const updated = cartItems.map((item) =>
      item && item.id === id ? { ...item, quantity } : item
    ).filter((item) => item);
    setCartItems(updated);
    localStorage.setItem('cart', JSON.stringify(updated));
  };

  const removeFromCart = (id: string | number) => {
    const updated = cartItems.filter((item) => item && item.id !== id);
    setCartItems(updated);
    localStorage.setItem('cart', JSON.stringify(updated));
  };

  const clearCart = () => {
    if (confirm('Are you sure you want to clear the cart?')) {
      setCartItems([]);
      localStorage.setItem('cart', JSON.stringify([]));
    }
  };

  const handleBuyNow = () => {
    if (!user) {
      alert('Please login first');
      router.push('/login');
      return;
    }
    if (cartItems.length === 0) {
      alert('Your cart is empty');
      return;
    }
    
    // Check if all prescription-required products have prescriptions
    const missingPrescriptions = getMissingPrescriptions(
      cartItems.map(item => ({
        productId: String(item.productId || item.id),
        productName: item.productName || item.name,
        requiresPrescription: item.requiresPrescription || false,
      }))
    );

    if (missingPrescriptions.length > 0) {
      alert(`Please upload prescriptions for the following products:\n${missingPrescriptions.map(p => `• ${p.productName}`).join('\n')}`);
      return;
    }

    // Pandeyra SMS OTP is India/DLT-only. International checkout uses PayPal.
    if (isInternational) {
      setSelectedPaymentMethod('paypal');
      setIsOTPVerified(true);
      setShowOTPModal(false);
      setShowAddressForm(true);
      return;
    }

    // India only: require phone OTP before address/payment.
    if (!isOTPVerified) {
      setShowOTPModal(true);
      return;
    }
    setShowAddressForm(true);
  };

  /** International Fast Checkout → address + PayPal. Never opens OTP. */
  const startInternationalFastCheckout = () => {
    if (!user) {
      alert('Please login first');
      router.push('/login');
      return;
    }
    if (cartItems.length === 0) {
      alert('Your cart is empty');
      return;
    }

    const missingPrescriptions = getMissingPrescriptions(
      cartItems.map((item) => ({
        productId: String(item.productId || item.id),
        productName: item.productName || item.name,
        requiresPrescription: item.requiresPrescription || false,
      }))
    );
    if (missingPrescriptions.length > 0) {
      alert(
        `Please upload prescriptions for the following products:\n${missingPrescriptions
          .map((p) => `• ${p.productName}`)
          .join('\n')}`
      );
      return;
    }

    setSelectedPaymentMethod('paypal');
    setIsOTPVerified(true);
    setShowOTPModal(false);
    setShowPaymentModal(false);
    setAddress((prev) => ({
      ...prev,
      country: prev.country === 'India' ? 'Other' : prev.country || 'Other',
    }));
    setShowAddressForm(true);
  };

  const processPayment = async () => {
    if (!selectedPaymentMethod) {
      alert('Please select a payment method');
      return;
    }

    // COD should not go through online payment gateway.
    if (selectedPaymentMethod === 'cod') {
      try {
        const prescriptions = getAllPrescriptions();
        const dbResult = await persistOrderToDatabase({ paymentMethod: 'cod', paymentStatus: 'pending' });

        const order = {
          _id: dbResult.orderId,
          dbOrderId: dbResult.orderId,
          userId: user?.id || 'guest',
          customerName: address.fullName,
          customerEmail: user?.email || 'not-provided',
          customerPhone: address.phoneNumber,
          items: cartItems.filter((item) => item).map((item) => ({
            ...item,
            vendorId: item.vendorId || 'default-vendor',
            prescriptionUrl: item.requiresPrescription ? prescriptions[String(item.productId || item.id)] : undefined,
          })),
          totalAmount,
          subtotal: finalPrice,
          discount,
          deliveryCharge,
          paymentMethod: 'cod',
          paymentGateway: 'cod',
          deliveryAddress: address,
          status: dbResult.awbNumber ? 'confirmed' : 'pending',
          paymentStatus: 'pending',
          awbNumber: dbResult.awbNumber || '',
          courierName: dbResult.courierName || '',
          shipmentStatus: dbResult.shipmentStatus || '',
          createdAt: new Date().toISOString(),
        };

        const orders = JSON.parse(localStorage.getItem('orders') || '[]');
        orders.push(order);
        localStorage.setItem('orders', JSON.stringify(orders));

        setCartItems([]);
        localStorage.setItem('cart', JSON.stringify([]));
        setShowPaymentModal(false);
        setSelectedPaymentMethod('');

        alert(
          dbResult.awbNumber
            ? `Order placed with Cash on Delivery!\n\nOrder ID: ${order._id}\nAWB: ${dbResult.awbNumber}`
            : `Order placed with Cash on Delivery!\n\nOrder ID: ${order._id}`
        );
        router.push('/orders');
      } catch (error: any) {
        alert(error?.message || 'Failed to place order. Please try again.');
      }
      return;
    }

    if (selectedPaymentMethod === 'paypal') {
      alert('Please use the PayPal button to complete international payment.');
      return;
    }

    if (!isIndia) {
      alert('International orders must use PayPal checkout.');
      return;
    }

    setIsProcessing(true);
    try {
      const isRazorpayLoaded = await loadRazorpayScript();
      if (!isRazorpayLoaded || !window.Razorpay) {
        alert('Unable to load Razorpay checkout. Please try again.');
        setIsProcessing(false);
        return;
      }

      const createOrderResponse = await fetch('/api/payments/razorpay/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: totalAmount,
          receipt: `rcpt_${Date.now()}`,
          selectedPaymentMethod: selectedPaymentMethod === 'domestic' ? '' : selectedPaymentMethod,
          notes: {
            userId: user?.id || 'guest',
            email: user?.email || 'not-provided',
            selectedPaymentMethod,
          },
        }),
      });

      const createOrderData = await createOrderResponse.json();

      if (!createOrderResponse.ok) {
        throw new Error(createOrderData.error || 'Failed to create Razorpay order');
      }

      const methodConfig = {
        card: true,
        netbanking: true,
        upi: true,
        wallet: true,
      } as Record<string, boolean>;

      const options: Record<string, unknown> = {
        key: createOrderData.keyId,
        amount: createOrderData.order.amount,
        currency: 'INR',
        name: 'MySanjeevni',
        description: 'Order Payment',
        order_id: createOrderData.order.id,
        prefill: {
          name: address.fullName,
          email: user?.email || '',
          contact: address.phoneNumber,
        },
        notes: {
          address: `${address.houseNo}, ${address.streetAddress}, ${address.city}, ${address.state} - ${address.postalCode}`,
        },
        theme: {
          color: '#059669',
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            alert('Payment cancelled. Redirecting to homepage.');
            router.push('/');
          },
        },
        method: methodConfig,
        handler: async (response: any) => {
          try {
            const verifyResponse = await fetch('/api/payments/razorpay/verify-order', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyResponse.json();

            if (!verifyResponse.ok || !verifyData.success) {
              throw new Error(verifyData.error || 'Payment verification failed');
            }

            const prescriptions = getAllPrescriptions();

            // Persist to DB — required for Admin / Vendor / User order views.
            const dbResult = await persistOrderToDatabase({
              paymentMethod: `razorpay-${selectedPaymentMethod}`,
              paymentStatus: 'completed',
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
            });

            const order = {
              _id: dbResult.orderId,
              dbOrderId: dbResult.orderId,
              userId: user?.id || 'guest',
              customerName: address.fullName,
              customerEmail: user?.email || 'not-provided',
              customerPhone: address.phoneNumber,
              items: cartItems.filter((item) => item).map((item) => ({
                ...item,
                vendorId: item.vendorId || 'default-vendor',
                prescriptionUrl: item.requiresPrescription ? prescriptions[String(item.productId || item.id)] : undefined,
              })),
              totalAmount,
              subtotal: finalPrice,
              discount,
              deliveryCharge,
              paymentMethod: `razorpay-${selectedPaymentMethod}`,
              paymentGateway: 'razorpay',
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              deliveryAddress: address,
              status: 'confirmed',
              paymentStatus: 'completed',
              awbNumber: dbResult.awbNumber || '',
              courierName: dbResult.courierName || '',
              shipmentStatus: dbResult.shipmentStatus || '',
              createdAt: new Date().toISOString(),
            };

            const orders = JSON.parse(localStorage.getItem('orders') || '[]');
            orders.push(order);
            localStorage.setItem('orders', JSON.stringify(orders));

            setCartItems([]);
            localStorage.setItem('cart', JSON.stringify([]));

            setShowPaymentModal(false);
            setSelectedPaymentMethod('');
            setIsProcessing(false);

            alert(
              `Payment successful!\n\nOrder ID: ${order._id}\nRazorpay Payment ID: ${response.razorpay_payment_id}`
            );
            router.push('/orders');
          } catch (error: any) {
            setIsProcessing(false);
            alert(error?.message || 'Payment verification failed. Please contact support.');
          }
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on('payment.failed', (failureResponse: any) => {
        const reason = failureResponse?.error?.description || 'Payment failed';
        alert(reason);
        setIsProcessing(false);
        router.push('/');
      });

      razorpay.open();
    } catch (error: any) {
      console.error('Payment error:', error);
      alert(error?.message || 'Payment failed. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setAddress((prev) => ({
      ...prev,
      [name]: value,
    }));

    // When a valid 6-digit Indian pincode is entered, fetch live serviceability
    // (courier, charge, ETA, COD availability) and reflect it in the summary.
    if (name === 'postalCode') {
      const pincode = value.trim();
      if (isIndia && /^\d{6}$/.test(pincode)) {
        checkPincodeServiceability(pincode);
      } else {
        setShippingInfo((prev) => ({ ...prev, serviceable: false, checkedPincode: '', error: '' }));
      }
    }
  };

  /**
   * Calls the server-side Shiprocket serviceability route for the given pincode.
   * All Shiprocket credentials stay on the server; this only receives normalized
   * courier/rate/ETA data. Failures degrade gracefully to the flat rate.
   */
  const checkPincodeServiceability = async (pincode: string) => {
    setShippingInfo((prev) => ({ ...prev, checking: true, error: '' }));
    try {
      const totalUnits = cartItems.reduce((sum, item) => sum + (item?.quantity || 0), 0);
      const weight = Math.max(0.5, totalUnits * 0.5);

      const res = await fetch('/api/shiprocket/serviceability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryPincode: pincode, weight, cod: selectedPaymentMethod === 'cod' }),
      });
      const data = await res.json();

      if (!res.ok || !data?.success || !data?.data?.serviceable) {
        setShippingInfo({
          checking: false,
          checkedPincode: pincode,
          serviceable: false,
          rate: 0,
          courier: '',
          etd: '',
          codAvailable: false,
          error: 'Delivery is not available for this pincode.',
        });
        return;
      }

      const recommended = data.data.recommended;
      setShippingInfo({
        checking: false,
        checkedPincode: pincode,
        serviceable: true,
        rate: Number(recommended?.rate || 0),
        courier: String(recommended?.courierName || ''),
        etd: String(recommended?.estimatedDeliveryDate || ''),
        codAvailable: Boolean(data.data.codAvailable),
        error: '',
      });
    } catch {
      setShippingInfo((prev) => ({
        ...prev,
        checking: false,
        serviceable: false,
        error: 'Could not check delivery availability right now.',
      }));
    }
  };

  /**
   * Persists the order to the database (source of truth for Admin / Vendor / User views).
   * Throws on failure so checkout does not pretend the order was placed.
   */
  const persistOrderToDatabase = async (payment: {
    paymentMethod: string;
    paymentStatus: 'pending' | 'completed';
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
  }): Promise<{
    orderId: string;
    shiprocketOrderId: string;
    awbNumber: string;
    courierName: string;
    shipmentStatus: string;
    pickupStatus: string;
  }> => {
    if (!user?.id) {
      throw new Error('Please login to place an order');
    }

    const prescriptions = getAllPrescriptions();
    const payload = {
      userId: user.id,
      customerEmail: String(user.email || '').trim(),
      items: cartItems
        .filter((item) => item)
        .map((item) => ({
          productId: String(item.productId || item.id),
          productName: item.productName || item.name || 'Product',
          quantity: item.quantity || 1,
          price: effectivePrice(item),
          requiresPrescription: item.requiresPrescription || false,
          prescriptionUrl: item.requiresPrescription
            ? prescriptions[String(item.productId || item.id)]
            : undefined,
        })),
      deliveryAddress: {
        fullName: address.fullName,
        phone: address.phoneNumber,
        addressLine1: [address.houseNo, address.streetAddress].filter(Boolean).join(', '),
        addressLine2: '',
        city: address.city,
        state: address.state,
        pincode: address.postalCode,
        country: address.country,
      },
      subtotal: finalPrice,
      discount,
      deliveryCharge,
      totalAmount,
      ...payment,
    };

    const res = await fetch('/api/orders/place', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data?.success || !data?.data?.orderId) {
      throw new Error(data?.error?.message || data?.error || 'Failed to save order. Please try again.');
    }
    return data.data;
  };

  /**
   * Opens the Shiprocket Checkout (SRC) hosted widget. We request a signed
   * access token from our backend (which never exposes the API secret), load the
   * SRC snippet, then hand the token to `HeadlessCheckout.addToCart`. Shiprocket
   * handles address + payment and redirects to /checkout/success on completion.
   */
  const handleShiprocketCheckout = async (event: React.MouseEvent) => {
    if (cartItems.length === 0) {
      alert('Your cart is empty');
      return;
    }

    // USD / non-India: never use Shiprocket or India OTP — PayPal Fast Checkout only.
    if (isInternational) {
      startInternationalFastCheckout();
      return;
    }

    // Location-based shipping needs a pincode so Fast Checkout is not free for all cities.
    if (!/^\d{6}$/.test(String(address.postalCode || '').trim())) {
      alert('Please enter your 6-digit delivery pincode first so we can calculate shipping charges.');
      setShowAddressForm(true);
      return;
    }

    setSrcBusy(true);
    try {
      const items = cartItems
        .filter((item) => item)
        .map((item) => ({
          variantId: String(item.productId || item.id),
          quantity: item.quantity || 1,
          price: effectivePrice(item),
          name: item.productName || item.name || 'Product',
          imageUrl: isImageUrl(item.image) ? (item.image as string) : '',
        }));

      // Stamp the signed-in user id onto the order so the webhook can attribute
      // it even if the customer enters a different phone/email in hosted checkout.
      const customAttributes: Record<string, string> = {
        preferred_country: 'IN',
        currency: 'INR',
      };
      if (user?.id) customAttributes.user_id = String(user.id);

      // Pass cart-level discount + the same delivery charge shown in Order Summary
      // so Fast Checkout totals match the cart (Shiprocket dashboard free-shipping
      // rules must not zero out our flat India rates).
      const coupon = discount > 0 ? { code: 'MYSANJEEVNI10', amount: discount } : undefined;
      // Never send 0 for India — server also recomputes from pincode (NCR ₹50 / rest ₹79).
      const checkoutShipping = Math.max(Number(deliveryCharge) || 0, Number(flatIndiaShipping) || 0, 50);
      customAttributes.shipping_charges = String(checkoutShipping);
      customAttributes.delivery_city = String(address.city || '');
      customAttributes.delivery_pincode = String(address.postalCode || '');
      customAttributes.delivery_state = String(address.state || '');

      const res = await fetch('/api/shiprocket/checkout/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          currency: 'INR',
          shippingCharges: checkoutShipping,
          deliveryPincode: String(address.postalCode || ''),
          deliveryCity: String(address.city || ''),
          deliveryState: String(address.state || ''),
          ...(coupon ? { coupon } : {}),
          customAttributes,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success || !data?.data?.token) {
        const detail = data?.error?.message || data?.error || 'Unable to start Shiprocket Checkout';
        console.error('[Shiprocket Checkout token]', data);
        alert(typeof detail === 'string' ? detail : 'Unable to start Shiprocket Checkout. Please try again.');
        return;
      }

      const loaded = await loadShiprocketCheckoutScript();
      if (!loaded || !window.HeadlessCheckout) {
        alert('Checkout is temporarily unavailable. Please try another payment option.');
        return;
      }

      const fallbackUrl = `${window.location.origin}/cart`;
      window.HeadlessCheckout.addToCart(event.nativeEvent, data.data.token, {
        fallbackUrl,
        isInitiatedFromApp: false,
      });
    } catch {
      alert('Something went wrong starting checkout. Please try again.');
    } finally {
      setSrcBusy(false);
    }
  };

  const submitAddress = () => {
    // Validate address fields
    if (!address.houseNo || !address.fullName || !address.phoneNumber || !address.streetAddress || !address.city || !address.state || !address.postalCode) {
      alert('Please fill in all address fields');
      return;
    }

    // Validate phone number
    if (!/^\d{10}$/.test(address.phoneNumber)) {
      alert('Please enter a valid 10-digit phone number');
      return;
    }

    // Hide address form and show payment modal
    setShowAddressForm(false);
    setShowPaymentModal(true);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />

      <div className="flex-1 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Shopping Cart</h1>
          <p className="text-gray-600 mb-8">
            {cartItems.length} item{cartItems.length !== 1 ? 's' : ''} in your cart
          </p>

          {cartItems.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">🛒</div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Your cart is empty</h2>
              <p className="text-gray-600 mb-8">Add some medicines to get started</p>
              <Link
                href="/medicines"
                className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-lg font-semibold transition"
              >
                Continue Shopping
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Cart Items */}
              <div className="lg:col-span-2">
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-lg font-semibold text-gray-900">
                      Cart Items ({cartItems.length})
                    </h2>
                    <button
                      onClick={clearCart}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Clear Cart
                    </button>
                  </div>

                  <div className="divide-y divide-gray-200">
                    {cartItems.map((item) => {
                      if (!item) return null;
                      return (
                        <div
                          key={item.id}
                          className="px-6 py-4 flex gap-4 items-center hover:bg-gray-50 transition"
                        >
                          {/* Product Image */}
                          <div className="w-20 h-20 bg-emerald-50 rounded-lg flex items-center justify-center text-3xl shrink-0">
                            {isImageUrl(item.image) ? (
                              <img
                                src={item.image}
                                alt={item.name || 'Product'}
                                className="w-full h-full object-cover rounded-lg"
                                loading="lazy"
                              />
                            ) : (
                              item.image || '💊'
                            )}
                          </div>

                          {/* Product Details */}
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">{item.name || 'Product'}</h3>
                            <p className="text-sm text-gray-600">{item.brand || 'N/A'}</p>
                            <p className="text-lg font-bold text-emerald-600 mt-1">
                              {item.currencySymbol || currencySymbol}{effectivePrice(item).toFixed(2)}
                            </p>
                          </div>

                          {/* Quantity Control */}
                          <div className="flex items-center gap-3 bg-gray-100 rounded-lg px-3 py-2">
                            <button
                              onClick={() => updateQuantity(item.id, (item.quantity || 1) - 1)}
                              className="text-gray-600 hover:text-gray-900 font-bold"
                            >
                              −
                            </button>
                            <span className="w-8 text-center font-semibold text-gray-900">
                              {item.quantity || 1}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.id, (item.quantity || 1) + 1)}
                              className="text-gray-600 hover:text-gray-900 font-bold"
                            >
                              +
                            </button>
                          </div>

                          {/* Total & Remove */}
                          <div className="text-right">
                            <p className="font-bold text-gray-900">
                              {item.currencySymbol || currencySymbol}{(effectivePrice(item) * (item.quantity || 1)).toFixed(2)}
                            </p>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="text-sm text-red-600 hover:text-red-700 mt-2"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Continue Shopping */}
                <div className="mt-6">
                  <Link
                    href="/medicines"
                    className="inline-block text-emerald-600 hover:text-emerald-700 font-semibold"
                  >
                    ← Continue Shopping
                  </Link>
                </div>

                {/* Prescription Checker */}
                {user && (
                  <div className="mt-6">
                    <PrescriptionChecker
                      cartItems={cartItems.map(item => ({
                        _id: String(item.productId || item.id),
                        productId: String(item.productId || item.id),
                        productName: item.productName || item.name,
                        quantity: item.quantity || 1,
                        requiresPrescription: item.requiresPrescription || false,
                      }))}
                      userId={user?.id || ''}
                      onPrescriptionsReady={setPrescriptionsReady}
                    />
                  </div>
                )}
              </div>

              {/* Price Summary — sticky on desktop so pincode/shipping stay visible */}
              <div className="lg:col-span-1 w-full">
                <div className="bg-linear-to-b from-emerald-50 to-white border border-emerald-200 rounded-lg p-6 lg:sticky lg:top-24">
                  <h3 className="text-lg font-bold text-gray-900 mb-6">Order Summary</h3>

                  <div className="space-y-4 mb-6 pb-6 border-b border-gray-200">
                    <div className="flex justify-between items-center text-gray-700">
                      <span>Subtotal:</span>
                      <span className="font-semibold">{currencySymbol}{totalPrice.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center text-green-600">
                      <span>Discount (10%):</span>
                      <span className="font-semibold">-{currencySymbol}{discount.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center text-gray-700">
                      <span>After Discount:</span>
                      <span className="font-semibold">{currencySymbol}{finalPrice.toFixed(2)}</span>
                    </div>

                    {isIndia && (
                      <div className="rounded-lg border border-emerald-100 bg-white p-3 space-y-2">
                        <label className="block text-xs font-semibold text-gray-700">
                          Delivery pincode
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={address.postalCode}
                          onChange={(e) => {
                            const postalCode = e.target.value.replace(/\D/g, '').slice(0, 6);
                            setAddress((prev) => ({ ...prev, postalCode }));
                            if (/^\d{6}$/.test(postalCode)) {
                              checkPincodeServiceability(postalCode);
                            }
                          }}
                          placeholder="Enter 6-digit pincode"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                        <p className="text-[11px] text-gray-500">
                          Delhi NCR: ₹50 · Rest of India: ₹79
                          {shippingInfo.serviceable && shippingInfo.etd
                            ? ` · Est. delivery: ${shippingInfo.etd}`
                            : ''}
                        </p>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-gray-700">
                      <span>
                        Delivery{' '}
                        <span className="text-xs text-gray-500">({deliveryZoneLabel})</span>:
                      </span>
                      <span className="font-semibold">
                        {!isIndia || deliveryCharge === 0
                          ? 'FREE'
                          : `${currencySymbol}${deliveryCharge}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center mb-6 text-lg">
                    <span className="font-bold text-gray-900">Total Amount:</span>
                    <span className="font-bold text-emerald-600 text-2xl">
                      {currencySymbol}{totalAmount.toFixed(2)}
                    </span>
                  </div>

                  {false && deliveryCharge > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 text-xs text-blue-700">
                      📦 Add {currencySymbol}{(299 - finalPrice).toFixed(2)} more to get FREE delivery
                    </div>
                  )}

                  {/* International: Fast Checkout (PayPal) first — no OTP. */}
                  {isInternational && (
                    <>
                      <button
                        type="button"
                        onClick={startInternationalFastCheckout}
                        className="w-full bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white py-3 rounded-lg font-bold transition flex items-center justify-center gap-2"
                      >
                        ⚡ Fast Checkout (PayPal · USD)
                      </button>
                      <p className="mt-2 mb-4 text-[11px] text-gray-400 text-center">
                        No OTP required — enter address and pay securely with PayPal
                      </p>
                      <div className="flex items-center gap-3 mb-4">
                        <span className="h-px flex-1 bg-gray-200" />
                        <span className="text-xs text-gray-400 font-medium">OR</span>
                        <span className="h-px flex-1 bg-gray-200" />
                      </div>
                    </>
                  )}

                  <button
                    onClick={handleBuyNow}
                    className="w-full bg-linear-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white py-3 rounded-lg font-bold transition"
                  >
                    {isInternational
                      ? '💳 Buy Now (PayPal)'
                      : isOTPVerified
                        ? '💳 Buy Now'
                        : '🔐 Verify OTP & Buy'}
                  </button>

                  {/* India only: Shiprocket Fast Checkout (env-gated). */}
                  {isIndia && SRC_ENABLED && (
                    <>
                      <div className="flex items-center gap-3 my-4">
                        <span className="h-px flex-1 bg-gray-200" />
                        <span className="text-xs text-gray-400 font-medium">OR</span>
                        <span className="h-px flex-1 bg-gray-200" />
                      </div>
                      <button
                        type="button"
                        onClick={handleShiprocketCheckout}
                        disabled={srcBusy}
                        className="w-full bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-60 text-white py-3 rounded-lg font-bold transition flex items-center justify-center gap-2"
                      >
                        {srcBusy ? (
                          <>
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Starting…
                          </>
                        ) : (
                          '⚡ Fast Checkout (Shiprocket)'
                        )}
                      </button>
                      <p className="mt-2 text-[11px] text-gray-400 text-center">
                        Address & payment handled securely by Shiprocket Checkout
                      </p>
                    </>
                  )}

                  <div className="mt-4 text-xs text-gray-600 text-center space-y-1">
                    <p>✓ Secure Checkout</p>
                    <p>✓ Multiple Payment Options</p>
                    <p>✓ Money Back Guarantee</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-96 overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Payment Method</h2>
            <p className="text-gray-600 mb-6">
              Amount to Pay: <span className="font-bold text-emerald-600 text-lg">{currencySymbol}{totalAmount.toFixed(2)}</span>
            </p>

            <div className="space-y-3 mb-6">
                {isIndia ? (
                  <>
                    <label className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-emerald-300 transition"
                      onClick={() => setSelectedPaymentMethod('domestic')}>
                      <input
                        type="radio"
                        name="payment"
                        value="domestic"
                        checked={selectedPaymentMethod === 'domestic'}
                        onChange={() => setSelectedPaymentMethod('domestic')}
                        className="mr-4"
                      />
                      <div>
                        <p className="font-semibold text-gray-900">🇮🇳 India (Razorpay)</p>
                        <p className="text-xs text-gray-600">UPI, Card, Net Banking, Wallets</p>
                      </div>
                    </label>

                    <label className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-emerald-300 transition"
                      onClick={() => setSelectedPaymentMethod('cod')}>
                      <input
                        type="radio"
                        name="payment"
                        value="cod"
                        checked={selectedPaymentMethod === 'cod'}
                        onChange={() => setSelectedPaymentMethod('cod')}
                        className="mr-4"
                      />
                      <div>
                        <p className="font-semibold text-gray-900">🚚 Cash on Delivery</p>
                        <p className="text-xs text-gray-600">Pay when you receive</p>
                      </div>
                    </label>
                  </>
                ) : (
                  <label className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-emerald-300 transition"
                    onClick={() => setSelectedPaymentMethod('paypal')}>
                    <input
                      type="radio"
                      name="payment"
                      value="paypal"
                      checked={selectedPaymentMethod === 'paypal'}
                      onChange={() => setSelectedPaymentMethod('paypal')}
                      className="mr-4"
                    />
                    <div>
                      <p className="font-semibold text-gray-900">🌍 International (PayPal)</p>
                      <p className="text-xs text-gray-600">Pay securely in USD with PayPal</p>
                    </div>
                  </label>
                )}
            </div>

              {selectedPaymentMethod === 'paypal' && !isIndia && (
              <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-xs text-blue-800 mb-2 font-medium">
                  International checkout via PayPal ({paypalCurrency})
                </p>
                {paypalButtonError && (
                  <p className="text-xs text-red-600 mb-2">{paypalButtonError}</p>
                )}
                <div id="paypal-button-container" />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-50 transition"
                disabled={isProcessing}
              >
                Cancel
              </button>
              <button
                onClick={processPayment}
                disabled={isProcessing || !selectedPaymentMethod || selectedPaymentMethod === 'paypal'}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white py-2 rounded-lg font-semibold transition"
              >
                {selectedPaymentMethod === 'paypal'
                  ? 'Use PayPal Button'
                  : isProcessing
                    ? 'Processing...'
                    : 'Pay Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Address Form Modal */}
      {showAddressForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-96 overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Delivery Address</h2>
            <p className="text-gray-600 mb-6">Please provide your complete delivery address</p>

            <div className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Full Name *</label>
                <input
                  type="text"
                  name="fullName"
                  value={address.fullName}
                  onChange={handleAddressChange}
                  placeholder="Enter your full name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900 placeholder-gray-500"
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Phone Number *</label>
                <input
                  type="tel"
                  name="phoneNumber"
                  value={address.phoneNumber}
                  onChange={handleAddressChange}
                  placeholder="Enter 10-digit phone number"
                  maxLength={10}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900 placeholder-gray-500"
                />
              </div>

              {/* House No or Flat No */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">House No or Flat No *</label>
                <input
                  type="text"
                  name="houseNo"
                  value={address.houseNo}
                  onChange={handleAddressChange}
                  placeholder="e.g., 123 or Flat 4B"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900 placeholder-gray-500"
                />
              </div>

              {/* Street Address */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Street Address *</label>
                <input
                  type="text"
                  name="streetAddress"
                  value={address.streetAddress}
                  onChange={handleAddressChange}
                  placeholder="Enter building name, street"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900 placeholder-gray-500"
                />
              </div>

              {/* City */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">City *</label>
                <input
                  type="text"
                  name="city"
                  value={address.city}
                  onChange={handleAddressChange}
                  placeholder="Enter city name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900 placeholder-gray-500"
                />
              </div>

              {/* State */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">State *</label>
                <input
                  type="text"
                  name="state"
                  value={address.state}
                  onChange={handleAddressChange}
                  placeholder="Enter state name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900 placeholder-gray-500"
                />
              </div>

              {/* Postal Code */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Postal Code *</label>
                <input
                  type="text"
                  name="postalCode"
                  value={address.postalCode}
                  onChange={handleAddressChange}
                  placeholder="Enter 6-digit postal code"
                  maxLength={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900 placeholder-gray-500"
                />

                {/* Shipping charge (NCR ₹50 / rest of India ₹79) + courier availability */}
                {address.country === 'India' && (
                  <div className="mt-2 text-xs rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-800 space-y-0.5">
                    <p>
                      Shipping charge:{' '}
                      <span className="font-semibold">₹{flatIndiaShipping}</span>
                      {' '}({flatIndiaShipping === 50 ? 'Delhi NCR' : 'Rest of India'})
                    </p>
                    {/^\d{6}$/.test(address.postalCode) && (
                      <>
                        {shippingInfo.checking ? (
                          <p className="text-gray-600">Checking courier availability…</p>
                        ) : shippingInfo.serviceable && shippingInfo.checkedPincode === address.postalCode ? (
                          <>
                            <p>✓ Deliverable via <span className="font-semibold">{shippingInfo.courier || 'courier partner'}</span></p>
                            {shippingInfo.etd && <p>Estimated delivery: <span className="font-semibold">{shippingInfo.etd}</span></p>}
                            <p>COD: <span className="font-semibold">{shippingInfo.codAvailable ? 'Available' : 'Not available'}</span></p>
                          </>
                        ) : shippingInfo.error && shippingInfo.checkedPincode === address.postalCode ? (
                          <p className="text-amber-700">{shippingInfo.error}</p>
                        ) : null}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Country */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Country</label>
                <select
                  name="country"
                  value={address.country}
                  onChange={handleAddressChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-gray-900"
                >
                  <option value="India">India</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddressForm(false);
                  setAddress({ houseNo: '', streetAddress: '', fullName: '', phoneNumber: '', city: '', state: '', postalCode: '', country: 'India' });
                  setSelectedPaymentMethod('');
                }}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={submitAddress}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-semibold transition"
              >
                ✓ Confirm & Proceed to Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OTP is India-only (Pandeyra/DLT). Never show for international / USD carts. */}
      <OTPVerificationModal
        isOpen={showOTPModal && isIndia}
        userPhone={user?.phone || ''}
        onVerifySuccess={() => {
          setIsOTPVerified(true);
          setShowOTPModal(false);
          setShowAddressForm(true);
        }}
        onClose={() => setShowOTPModal(false)}
      />

      <Footer />
    </div>
  );
}
