'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePwaInstall } from './PwaProvider';

export default function InstallAppFAB() {
  const { canPrompt, isStandalone, isIos, install } = usePwaInstall();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    setHost(document.body);
  }, []);

  const handleClick = useCallback(async () => {
    const promptEvent = (window as Window & { __pwaInstallPrompt?: { prompt: () => Promise<void> } | null }).__pwaInstallPrompt;
    if (canPrompt || promptEvent) {
      setShowHint(false);
      await install();
      return;
    }
    setShowHint(true);
  }, [canPrompt, install]);

  if (!host || isStandalone) return null;

  return createPortal(
    <div
      data-pwa-install-toggle="true"
      style={{
        position: 'fixed',
        right: '18px',
        bottom: '22px',
        zIndex: 2147483000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        pointerEvents: 'auto',
      }}
    >
      {showHint ? (
        <div
          role="status"
          style={{
            width: '230px',
            marginBottom: '4px',
            padding: '12px 14px',
            borderRadius: '14px',
            background: '#1e1b4b',
            color: '#f5f3ff',
            fontSize: '13px',
            lineHeight: 1.45,
            boxShadow: '0 12px 30px rgba(30, 27, 75, 0.35)',
          }}
        >
          {isIos
            ? 'Open this page in Safari, tap Share, then Add to Home Screen.'
            : 'This browser has not offered installation yet. Open the site in Chrome or Edge, then tap Get The App. The install window opens from this button.'}
        </div>
      ) : null}

      <button
        type="button"
        aria-label="Install App"
        onClick={() => {
          void handleClick();
        }}
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.55)',
          background: 'linear-gradient(145deg, #7c5cff 0%, #c026d3 55%, #f472b6 100%)',
          color: '#fff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 0 8px rgba(168, 85, 247, 0.18), 0 10px 24px rgba(124, 58, 237, 0.45)',
        }}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="7" y="2.5" width="10" height="19" rx="2.2" stroke="white" strokeWidth="1.8" />
          <circle cx="12" cy="18.2" r="0.9" fill="white" />
        </svg>
      </button>

      <span
        style={{
          fontSize: '12px',
          fontWeight: 700,
          color: '#6d28d9',
          letterSpacing: '0.01em',
          textShadow: '0 1px 0 #fff',
          userSelect: 'none',
        }}
      >
        Install App
      </span>
    </div>,
    host
  );
}
