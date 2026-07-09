/**
 * Authenticated Shiprocket HTTP client.
 *
 * A single reusable request function (`shiprocketRequest`) that:
 *  - attaches the cached JWT to every call,
 *  - centralizes error handling for 401/403/404/422/429/5xx,
 *  - automatically retries once after refreshing the token on a 401,
 *  - logs failures without ever exposing the token.
 *
 * Uses the native `fetch` available in the Next.js runtime (no axios dependency)
 * so the module works identically on Vercel and Hostinger.
 */

import { shiprocketConfig } from './config';
import { getShiprocketToken, invalidateShiprocketToken } from './auth';
import { ShiprocketError, mapStatusToErrorCode } from './errors';
import { shiprocketLogger, type ShiprocketLogScope } from './logger';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface RequestOptions {
  method: HttpMethod;
  /** Path relative to the `/v1/external` base, e.g. `/orders/create/adhoc`. */
  path: string;
  /** Query parameters (only primitive values). */
  query?: Record<string, string | number | boolean | undefined>;
  /** JSON body for write requests. */
  body?: unknown;
  /** Log scope for diagnostics. */
  scope: ShiprocketLogScope;
  /** Internal flag used to prevent infinite retry loops. */
  isRetry?: boolean;
}

/**
 * Executes an authenticated request against the Shiprocket API and returns the
 * parsed JSON body typed as `T`.
 *
 * @throws {ShiprocketError} normalized error carrying an HTTP status + code.
 */
export async function shiprocketRequest<T>(options: RequestOptions): Promise<T> {
  const { method, path, query, body, scope, isRetry = false } = options;

  const token = await getShiprocketToken();
  const url = buildUrl(path, query);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
  } catch (error) {
    shiprocketLogger.error(scope, 'Network error', {
      path,
      message: error instanceof Error ? error.message : 'unknown',
    });
    throw new ShiprocketError('Unable to reach Shiprocket', 'NETWORK_ERROR', 502);
  }

  // A 401 means the token expired or was revoked. Refresh once and retry.
  if (response.status === 401 && !isRetry) {
    shiprocketLogger.warn(scope, 'Received 401 – refreshing token and retrying', { path });
    invalidateShiprocketToken();
    await getShiprocketToken(true);
    return shiprocketRequest<T>({ ...options, isRetry: true });
  }

  const payload = await safeJson(response);

  if (!response.ok) {
    const message = extractMessage(payload) || `Shiprocket request failed (${response.status})`;
    shiprocketLogger.error(scope, 'Upstream error', { path, status: response.status, message });
    throw new ShiprocketError(message, mapStatusToErrorCode(response.status), response.status, payload);
  }

  return payload as T;
}

/** Builds a fully-qualified URL with an optional query string. */
function buildUrl(path: string, query?: RequestOptions['query']): string {
  const base = `${shiprocketConfig.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return base;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  }

  const queryString = params.toString();
  return queryString ? `${base}?${queryString}` : base;
}

/** Parses a JSON body, tolerating empty / non-JSON responses. */
async function safeJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

/**
 * Extracts a human-readable message from Shiprocket's varied error shapes.
 * Shiprocket may return `{ message }`, `{ error }`, or field-level errors under
 * `{ errors: { field: [msg] } }`.
 */
function extractMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const record = payload as Record<string, unknown>;

  if (typeof record.message === 'string') return record.message;
  if (typeof record.error === 'string') return record.error;

  if (record.errors && typeof record.errors === 'object') {
    const firstField = Object.values(record.errors as Record<string, unknown>)[0];
    if (Array.isArray(firstField) && typeof firstField[0] === 'string') {
      return firstField[0];
    }
    if (typeof firstField === 'string') return firstField;
  }

  return undefined;
}
