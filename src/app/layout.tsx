import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Inter } from 'next/font/google';
import './globals.css';
import { PwaProvider } from '@/components/pwa/PwaProvider';

const inter = Inter({ subsets: ['latin'] });

// Prevent Hostinger/CDN from serving stale HTML that references deleted JS chunks.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const viewport: Viewport = {
  themeColor: '#059669',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'MySanjeevni Healthcare Platform',
  description: 'Healthcare platform providing medicines and health services',
  applicationName: 'MySanjeevni',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'MySanjeevni',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icon.png?v=5', sizes: '32x32', type: 'image/png' },
      { url: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/icon.png?v=5',
    apple: '/pwa/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='en' suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon.png?v=5" sizes="32x32" type="image/png" />
        <link rel="shortcut icon" href="/icon.png?v=5" type="image/png" />
        <link rel="apple-touch-icon" href="/pwa/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <Script id="pwa-install-capture" strategy="beforeInteractive">
          {`window.__pwaInstallPrompt=null;window.addEventListener('beforeinstallprompt',function(event){event.preventDefault();window.__pwaInstallPrompt=event;});`}
        </Script>
        <PwaProvider>{children}</PwaProvider>
      </body>
    </html>
  );
}
