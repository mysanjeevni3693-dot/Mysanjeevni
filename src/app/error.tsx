'use client';

import { useEffect } from 'react';

export default function GlobalAppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AppError]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Something went wrong</h1>
      <p className="text-sm text-slate-600 max-w-md">
        The page failed to load. Please try again. If this keeps happening, hard-refresh (Ctrl+Shift+R).
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        Try again
      </button>
      <a href="/" className="text-sm text-emerald-700 hover:underline">
        Go to homepage
      </a>
    </div>
  );
}
