import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

// Prevent Hostinger/CDN from serving stale HTML that references deleted JS chunks.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'MySanjeevni Healthcare Platform',
  description: 'Healthcare platform providing medicines and health services',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.png?v=4',
    shortcut: '/icon.png?v=4',
    apple: '/icon.png?v=4',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon.png?v=4" sizes="32x32" type="image/png" />
        <link rel="shortcut icon" href="/icon.png?v=4" type="image/png" />
        <link rel="apple-touch-icon" href="/icon.png?v=4" />
      </head>
      <body className={inter.className} suppressHydrationWarning>{children}</body>
    </html>
  );
}
