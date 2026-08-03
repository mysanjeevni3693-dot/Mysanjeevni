import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Native / server-only packages must not be bundled by Turbopack; they are
  // loaded from node_modules at runtime instead. Without this, Turbopack fails
  // with "Failed to load external module ... undefined is not a function".
  serverExternalPackages: ['mongoose', 'bcrypt', 'firebase-admin'],
  devIndicators: {
    position: 'bottom-right',
  },
  images: {
    localPatterns: [
      {
        pathname: '/**',
      },
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
  async headers() {
    return [
      // Hashed build assets are safe to cache forever.
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/icon.png',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, must-revalidate',
          },
        ],
      },
      // HTML / RSC responses must NOT be cached for a year — after deploy,
      // stale HTML points at deleted chunk hashes and the site goes white.
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-cache, no-store, max-age=0, must-revalidate',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'no-store',
          },
          {
            key: 'Content-Security-Policy',
            value: "upgrade-insecure-requests; block-all-mixed-content",
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
