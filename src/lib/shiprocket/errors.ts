/**
 * Centralized error types and helpers for the Shiprocket integration.
 *
 * A single custom error class (`ShiprocketError`) carries the upstream HTTP
 * status code so that API routes can translate failures into consistent,
 * client-safe JSON responses without ever leaking credentials or raw tokens.
 */

/** Machine-readable error codes returned to API consumers. */
export type ShiprocketErrorCode =
  | 'CONFIG_MISSING'
  | 'AUTH_FAILED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

/**
 * Error thrown by every Shiprocket service module. Wraps the upstream status
 * code and a client-safe message so callers get predictable behaviour.
 */
export class ShiprocketError extends Error {
  public readonly code: ShiprocketErrorCode;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(message: string, code: ShiprocketErrorCode, status: number, details?: unknown) {
    super(message);
    this.name = 'ShiprocketError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Maps an upstream Shiprocket HTTP status code to a normalized error code.
 * Centralizing this mapping keeps error handling consistent across modules.
 */
export function mapStatusToErrorCode(status: number): ShiprocketErrorCode {
  switch (status) {
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 422:
      return 'VALIDATION_ERROR';
    case 429:
      return 'RATE_LIMITED';
    default:
      if (status >= 500) return 'UPSTREAM_ERROR';
      return 'UNKNOWN';
  }
}

/**
 * Type guard used by API routes to detect our custom error.
 */
export function isShiprocketError(error: unknown): error is ShiprocketError {
  return error instanceof ShiprocketError;
}

/**
 * Standard JSON envelope returned by all Shiprocket API routes so that the
 * frontend and any test harness can rely on a consistent shape.
 */
export interface ShiprocketApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: ShiprocketErrorCode | 'INTERNAL_ERROR';
    message: string;
    details?: unknown;
  };
}
