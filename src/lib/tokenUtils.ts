import crypto from 'crypto';
import jwt from 'jsonwebtoken';

interface TokenPayload {
  token: string;
  email: string;
  expiresAt: number;
  createdAt: number;
}

const FIVE_DAYS_IN_MS = 5 * 24 * 60 * 60 * 1000; // 5 days in milliseconds
const FIVE_DAYS_JWT = '5d';

function getAdminJwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

/**
 * Generate a signed admin JWT with 5-day expiration.
 * Stateless — survives server restarts / Turbopack reloads (unlike the old UUID + in-memory Map).
 */
export function generateAdminToken(email: string): TokenPayload {
  const createdAt = Date.now();
  const expiresAt = createdAt + FIVE_DAYS_IN_MS;
  const secret = getAdminJwtSecret();

  const token = jwt.sign(
    {
      userId: 'admin',
      email: email.toLowerCase(),
      phone: '',
      role: 'admin',
      isVerified: true,
    },
    secret,
    {
      expiresIn: FIVE_DAYS_JWT,
      algorithm: 'HS256',
    }
  );

  return {
    token,
    email: email.toLowerCase(),
    expiresAt,
    createdAt,
  };
}

/**
 * Validate if admin token is still valid (not expired)
 */
export function isTokenValid(expiresAt: number): boolean {
  return Date.now() < expiresAt;
}

/**
 * Get token expiration date
 */
export function getTokenExpirationDate(expiresAt: number): Date {
  return new Date(expiresAt);
}

/**
 * Get remaining time until token expires (in milliseconds)
 */
export function getTokenRemainingTime(expiresAt: number): number {
  const remaining = expiresAt - Date.now();
  return remaining > 0 ? remaining : 0;
}

/**
 * Get remaining time in human-readable format
 */
export function getTokenRemainingTimeReadable(expiresAt: number): string {
  const remaining = getTokenRemainingTime(expiresAt);

  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''}, ${hours}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
}

/** Kept for rare callers that still need a random id. */
export function generateRandomTokenId(): string {
  return crypto.randomUUID();
}
