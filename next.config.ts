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
      {
        source: '/:path*',
        headers: [
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
