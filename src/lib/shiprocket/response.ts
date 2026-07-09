/**
 * Standardized JSON response helpers for the Shiprocket API routes.
 *
 * Every route returns the same `ShiprocketApiResponse<T>` envelope so the
 * frontend and any test harness can rely on a predictable shape. Errors are
 * translated from `ShiprocketError` / Zod errors into client-safe messages
 * (credentials and JWTs are never included).
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { isShiprocketError, type ShiprocketApiResponse } from './errors';
import { shiprocketLogger, type ShiprocketLogScope } from './logger';

/** Builds a successful JSON response. */
export function ok<T>(data: T, status = 200): NextResponse<ShiprocketApiResponse<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

/** Builds a failed JSON response with an explicit code + status. */
export function fail(
  code: ShiprocketApiResponse['error'] extends undefined ? never : NonNullable<ShiprocketApiResponse['error']>['code'],
  message: string,
  status: number,
  details?: unknown
): NextResponse<ShiprocketApiResponse<never>> {
  return NextResponse.json({ success: false, error: { code, message, details } }, { status });
}

/**
 * Converts any thrown error into a standardized JSON error response.
 *
 * - `ZodError`     -> 422 VALIDATION_ERROR with field issues.
 * - `ShiprocketError` -> its own status + code.
 * - anything else  -> 500 INTERNAL_ERROR (message hidden from client).
 *
 * @param error - the caught error.
 * @param scope - log scope for diagnostics.
 */
export function handleRouteError(
  error: unknown,
  scope: ShiprocketLogScope
): NextResponse<ShiprocketApiResponse<never>> {
  if (error instanceof ZodError) {
    return fail('VALIDATION_ERROR', 'Request validation failed', 422, error.issues);
  }

  if (isShiprocketError(error)) {
    return fail(error.code, error.message, error.status, error.details);
  }

  shiprocketLogger.error(scope, 'Unhandled route error', {
    message: error instanceof Error ? error.message : 'unknown',
  });
  return fail('INTERNAL_ERROR', 'An unexpected error occurred', 500);
}
