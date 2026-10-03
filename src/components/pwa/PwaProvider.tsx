'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import InstallAppFAB from './InstallAppFAB';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type PlatformKind = 'ios' | 'android' | 'desktop' | 'other';

type PwaContextValue = {
  canPrompt: boolean;
  isInstalled: boolean;
  isStandalone: boolean;
  isIos: boolean;
  platform: PlatformKind;
  updateReady: boolean;
  install: () => Promise<boolean>;
  applyUpdate: () => void;
};

const PwaContext = createContext<PwaContextValue | null>(null);

const INSTALLED_KEY = 'mysanjeevani-pwa-installed';
const PROMPT_EVENT = 'mysanjeevani-pwa-install-available';

let storedInstallPrompt: BeforeInstallPromptEvent | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    storedInstallPrompt = event as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event(PROMPT_EVENT));
  });
}

function detectPlatform(): PlatformKind {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (iOS) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Windows|Macintosh|Linux/i.test(ua)) return 'desktop';
  return 'other';
}

function detectStandalone() {
  if (typeof window === 'undefined') return false;
  const media = window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return media || iosStandalone;
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [platform, setPlatform] = useState<PlatformKind>('other');
  const [updateReady, setUpdateReady] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    setPlatform(detectPlatform());
    setIsStandalone(detectStandalone());
    try {
      setIsInstalled(localStorage.getItem(INSTALLED_KEY) === '1' || detectStandalone());
    } catch {
      setIsInstalled(detectStandalone());
    }

    const onStandaloneChange = () => setIsStandalone(detectStandalone());
    const media = window.matchMedia('(display-mode: standalone)');
    media.addEventListener?.('change', onStandaloneChange);

    if (storedInstallPrompt) setDeferredPrompt(storedInstallPrompt);
    const earlyPrompt = (window as Window & { __pwaInstallPrompt?: BeforeInstallPromptEvent | null }).__pwaInstallPrompt;
    if (earlyPrompt) setDeferredPrompt(earlyPrompt);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      const promptEvent = event as BeforeInstallPromptEvent;
      storedInstallPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
    };
    const onStoredPrompt = () => {
      if (storedInstallPrompt) setDeferredPrompt(storedInstallPrompt);
    };
    const onInstalled = () => {
      storedInstallPrompt = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
      try {
        localStorage.setItem(INSTALLED_KEY, '1');
      } catch {
        // ignore storage failures
      }
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener(PROMPT_EVENT, onStoredPrompt);
    window.addEventListener('appinstalled', onInstalled);

    const onControllerChange = () => {
      let shouldReload = false;
      try {
        shouldReload = sessionStorage.getItem('mysanjeevani-pwa-updating') === '1';
        if (shouldReload) sessionStorage.removeItem('mysanjeevani-pwa-updating');
      } catch {
        shouldReload = false;
      }
      if (shouldReload) window.location.reload();
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          if (registration.waiting && navigator.serviceWorker.controller) {
            setWaitingWorker(registration.waiting);
            setUpdateReady(true);
          }
          registration.addEventListener('updatefound', () => {
            const installing = registration.installing;
            if (!installing) return;
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                setWaitingWorker(installing);
                setUpdateReady(true);
              }
            });
          });
        })
        .catch(() => {
          // Registration can fail on insecure origins; the website still works.
        });
    }

    return () => {
      media.removeEventListener?.('change', onStandaloneChange);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener(PROMPT_EVENT, onStoredPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      }
    };
  }, []);

  const value = useMemo<PwaContextValue>(
    () => ({
      canPrompt: Boolean(deferredPrompt),
      isInstalled,
      isStandalone,
      isIos: platform === 'ios',
      platform,
      updateReady,
      install: async () => {
        const promptEvent =
          deferredPrompt ||
          storedInstallPrompt ||
          (typeof window !== 'undefined' ? (window as Window & { __pwaInstallPrompt?: BeforeInstallPromptEvent | null }).__pwaInstallPrompt : null);
        if (!promptEvent) return false;
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        storedInstallPrompt = null;
        if (typeof window !== 'undefined') {
          (window as Window & { __pwaInstallPrompt?: BeforeInstallPromptEvent | null }).__pwaInstallPrompt = null;
        }
        setDeferredPrompt(null);
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
          try {
            localStorage.setItem(INSTALLED_KEY, '1');
          } catch {
            // ignore
          }
        }
        return choice.outcome === 'accepted';
      },
      applyUpdate: () => {
        try {
          sessionStorage.setItem('mysanjeevani-pwa-updating', '1');
        } catch {
          // ignore
        }
        waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
      },
    }),
    [deferredPrompt, isInstalled, isStandalone, platform, updateReady, waitingWorker]
  );

  return (
    <PwaContext.Provider value={value}>
      {children}
      <InstallAppFAB />
      {updateReady && !isStandalone ? (
        <div className="fixed bottom-4 left-4 right-4 z-[70] mx-auto flex max-w-lg items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 shadow-lg">
          <p className="text-sm text-slate-700">A new version of MySanjeevni is ready.</p>
          <button
            type="button"
            onClick={() => value.applyUpdate()}
            className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Update
          </button>
        </div>
      ) : null}
    </PwaContext.Provider>
  );
}

export function usePwaInstall() {
  const context = useContext(PwaContext);
  if (!context) {
    throw new Error('usePwaInstall must be used within PwaProvider');
  }
  return context;
}
