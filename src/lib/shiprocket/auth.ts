/**
 * Shiprocket authentication.
 *
 * Responsibilities:
 *  - Call the Shiprocket login API to obtain a JWT.
 *  - Cache the token in memory (module scope) with an expiry.
 *  - Transparently refresh the token when it is missing or expired.
 *  - Expose `getShiprocketToken()` and `invalidateShiprocketToken()` helpers.
 *
 * The JWT never leaves the server: it is only attached to outbound requests by
 * the client module and is never returned to API responses.
 */

import { shiprocketConfig, hasShiprocketCredentials } from './config';
import { ShiprocketError } from './errors';
import { shiprocketLogger } from './logger';
import type { ShiprocketLoginResponse } from './types';

/**
 * In-memory token cache. Because Next.js route handlers run in a long-lived
 * server process, module-level state persists across requests, giving us a
 * simple and effective cache without any external store.
 */
interface TokenCache {
  token: string | null;
  /** Epoch milliseconds at which the cached token should be considered stale. */
  expiresAt: number;
}

const cache: TokenCache = {
  token: null,
  expiresAt: 0,
};

/**
 * Shiprocket tokens are valid for ~10 days. We proactively refresh well before
 * that (23h) so a token can never expire mid-request.
 */
const TOKEN_TTL_MS = 23 * 60 * 60 * 1000;

/**
 * After a login is rejected by Shiprocket (bad credentials / blocked account),
 * we stop attempting to log in again for this cooldown window. Repeated failed
 * logins are exactly what causes Shiprocket to temporarily block the account
 * ("too many failed login attempts"), so backing off protects the account and
 * lets callers degrade gracefully (e.g. checkout falls back to the flat rate).
 */
const AUTH_FAILURE_COOLDOWN_MS = 60 * 1000;

/** In-flight login promise used to de-duplicate concurrent token requests. */
let pendingLogin: Promise<string> | null = null;

/** Epoch ms until which we should not retry login after an auth failure. */
let failureCooldownUntil = 0;
/** The auth error that triggered the current cooldown (re-thrown while active). */
let lastAuthError: ShiprocketError | null = null;

/**
 * Returns a valid Shiprocket JWT, logging in if necessary. Concurrent callers
 * share a single in-flight login request to avoid hammering the auth endpoint.
 *
 * @param forceRefresh - when true, ignores the cache and forces a fresh login.
 * @throws {ShiprocketError} when credentials are missing or login fails.
 */
export async function getShiprocketToken(forceRefresh = false): Promise<string> {
  const now = Date.now();

  if (!forceRefresh && cache.token && now < cache.expiresAt) {
    return cache.token;
  }

  if (pendingLogin) {
    return pendingLogin;
  }

  // Negative cache: while a recent login failure is still "cooling down", fail
  // fast with the same error instead of hammering Shiprocket's auth endpoint
  // (which is what gets the account temporarily blocked).
  if (lastAuthError && now < failureCooldownUntil) {
    throw lastAuthError;
  }

  pendingLogin = login()
    .then((token) => {
      cache.token = token;
      cache.expiresAt = Date.now() + TOKEN_TTL_MS;
      failureCooldownUntil = 0;
      lastAuthError = null;
      return token;
    })
    .catch((error) => {
      // Only back off on genuine auth rejections (bad creds / blocked / rate
      // limited) — not on transient network errors, which shouldn't disable
      // logins for a full minute.
      if (
        error instanceof ShiprocketError &&
        (error.code === 'AUTH_FAILED' || error.status === 401 || error.status === 403 || error.status === 429)
      ) {
        failureCooldownUntil = Date.now() + AUTH_FAILURE_COOLDOWN_MS;
        lastAuthError = error;
        shiprocketLogger.warn('auth', 'Login failed – backing off before next attempt', {
          cooldownMs: AUTH_FAILURE_COOLDOWN_MS,
        });
      }
      throw error;
    })
    .finally(() => {
      pendingLogin = null;
    });

  return pendingLogin;
}

/**
 * Clears the cached token. Called by the client after a 401 so that the next
 * request forces a fresh login.
 */
export function invalidateShiprocketToken(): void {
  cache.token = null;
  cache.expiresAt = 0;
}

/**
 * Performs the actual login request against Shiprocket's auth endpoint.
 */
async function login(): Promise<string> {
  if (!hasShiprocketCredentials()) {
    throw new ShiprocketError(
      'Shiprocket credentials are not configured on the server',
      'CONFIG_MISSING',
      500
    );
  }

  shiprocketLogger.info('auth', 'Requesting new Shiprocket token');

  let response: Response;
  try {
    response = await fetch(`${shiprocketConfig.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: shiprocketConfig.email,
        password: shiprocketConfig.password,
      }),
      cache: 'no-store',
    });
  } catch (error) {
    shiprocketLogger.error('auth', 'Network error during login', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    throw new ShiprocketError('Unable to reach Shiprocket authentication service', 'NETWORK_ERROR', 502);
  }

  const payload = (await safeJson(response)) as Partial<ShiprocketLoginResponse> & { message?: string };

  if (!response.ok || !payload?.token) {
    shiprocketLogger.error('auth', 'Login failed', { status: response.status, message: payload?.message });
    throw new ShiprocketError(
      payload?.message || 'Failed to authenticate with Shiprocket',
      'AUTH_FAILED',
      response.status || 401
    );
  }

  shiprocketLogger.info('auth', 'Shiprocket token acquired');
  return payload.token;
}

/** Parses a JSON body, returning an empty object on failure. */
async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}
