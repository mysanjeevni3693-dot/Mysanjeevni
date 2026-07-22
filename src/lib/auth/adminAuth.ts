import { isTokenValid } from '@/lib/tokenUtils';
import jwt from 'jsonwebtoken';

/**
 * Legacy in-memory store for UUID admin tokens issued before JWT migration.
 * New logins use signed JWTs and do not depend on this Map.
 */
const adminTokenStore = new Map<
  string,
  {
    email: string;
    expiresAt: number;
    createdAt: number;
  }
>();

/**
 * Register a legacy/in-memory admin token (optional; JWT tokens are verified by signature).
 */
export function registerAdminToken(
  token: string,
  email: string,
  expiresAt: number,
  createdAt: number
): void {
  // Skip storing JWT tokens — they are self-contained.
  if (token.split('.').length === 3) {
    return;
  }
  adminTokenStore.set(token, {
    email,
    expiresAt,
    createdAt,
  });
}

function verifyAdminJwt(
  token: string
): { email: string; role: string; isAdmin: boolean } | null {
  const secret = process.env.JWT_SECRET || process.env.ADMIN_JWT_SECRET;
  if (!secret) return null;

  try {
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as {
      role?: string;
      email?: string;
      userId?: string;
    };

    if (decoded.role !== 'admin') {
      return null;
    }

    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
    const tokenEmail = (decoded.email || '').toLowerCase();
    if (adminEmail && tokenEmail && tokenEmail !== adminEmail) {
      return null;
    }

    return {
      email: tokenEmail || adminEmail || 'admin',
      role: 'admin',
      isAdmin: true,
    };
  } catch {
    return null;
  }
}

/**
 * Verify and retrieve admin user from token.
 * Prefers signed JWT (stateless). Falls back to legacy in-memory UUID tokens.
 */
export async function verifyAdminToken(
  token: string
): Promise<{ email: string; role: string; isAdmin: boolean } | null> {
  if (!token) {
    return null;
  }

  const jwtAdmin = verifyAdminJwt(token);
  if (jwtAdmin) {
    return jwtAdmin;
  }

  const tokenData = adminTokenStore.get(token);
  if (!tokenData) {
    return null;
  }

  if (!isTokenValid(tokenData.expiresAt)) {
    adminTokenStore.delete(token);
    return null;
  }

  return {
    email: tokenData.email,
    role: 'admin',
    isAdmin: true,
  };
}

/**
 * Revoke an admin token (logout) — only applies to legacy in-memory tokens.
 */
export function revokeAdminToken(token: string): void {
  adminTokenStore.delete(token);
}

/**
 * Clear all expired legacy tokens (cleanup)
 */
export function cleanupExpiredTokens(): void {
  const now = Date.now();
  for (const [token, data] of adminTokenStore.entries()) {
    if (now >= data.expiresAt) {
      adminTokenStore.delete(token);
    }
  }
}

/**
 * Get all active legacy tokens count (for monitoring)
 */
export function getActiveTokenCount(): number {
  cleanupExpiredTokens();
  return adminTokenStore.size;
}
