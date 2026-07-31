'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [role, setRole] = useState<'user' | 'vendor' | 'doctor'>('user');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleSendOtp = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password/send-otp-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to send OTP');
        if (Number(data.retryAfterSeconds) > 0) {
          setCooldown(Number(data.retryAfterSeconds));
        }
        return;
      }

      setOtpSent(true);
      setCooldown(Number(data.cooldownSeconds || 60));
      setSuccess('OTP sent to your registered email. Use the OTP here (a reset page link is also included in the email).');
    } catch {
      setError('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!otpSent) {
      setError('Please send OTP first.');
      return;
    }

    if (otp.trim().length !== 6) {
      setError('Please enter a valid 6-digit OTP.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password/reset-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          otp,
          newPassword,
          role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to reset password');
        return;
      }

      setSuccess('Password reset successful. Redirecting to login...');
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');

      window.setTimeout(() => {
        router.push('/login');
      }, 1500);
    } catch {
      setError('Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-lg">
            <h1 className="text-2xl font-bold text-gray-900">Forgot Password</h1>
            <p className="mt-2 text-sm text-gray-600">
              Reset your password using your registered email address.
            </p>

            <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                  Account Type
                </label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'user' | 'vendor' | 'doctor')}
                  className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-4 py-3 outline-none transition focus:border-transparent focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="user">User</option>
                  <option value="vendor">Vendor</option>
                  <option value="doctor">Doctor</option>
                </select>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Registered Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your registered email address"
                  className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 px-4 py-3 outline-none transition focus:border-transparent focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading || cooldown > 0}
                  className="flex-1 rounded-lg border border-emerald-600 px-4 py-3 font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : otpSent ? 'Resend OTP' : 'Send OTP'}
                </button>
              </div>

              {otpSent && (
                <>
                  <div>
                    <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
                      OTP
                    </label>
                    <input
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit OTP"
                      className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 px-4 py-3 tracking-widest outline-none transition focus:border-transparent focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-2">
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        id="new-password"
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 px-4 py-3 outline-none transition focus:border-transparent focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-3 flex items-center text-sm font-medium text-emerald-700 hover:text-emerald-900"
                      >
                        {showNewPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-2">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <input
                        id="confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-500 px-4 py-3 outline-none transition focus:border-transparent focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute inset-y-0 right-3 flex items-center text-sm font-medium text-emerald-700 hover:text-emerald-900"
                      >
                        {showConfirmPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !otpSent}
                className="w-full rounded-lg bg-linear-to-r from-emerald-600 to-emerald-700 px-4 py-3 font-bold text-white transition hover:from-emerald-700 hover:to-emerald-800 disabled:bg-slate-400"
              >
                {loading ? 'Processing...' : 'Reset Password'}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-gray-600">
              Remembered your password?{' '}
              <Link href="/login" className="font-semibold text-emerald-700 hover:text-emerald-800">
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
