'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Smartphone, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt: () => Promise<void> | void;
}

interface PwaInstallPromptProps {
  dockToBottomNav?: boolean;
}

const DISMISS_KEY = 'pip.pwa-install.dismissed-at';
const DISMISS_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

function isStandaloneMode() {
  if (typeof window === 'undefined') return false;

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function isMobileDevice() {
  if (typeof window === 'undefined') return false;

  return (
    window.matchMedia('(max-width: 1024px)').matches &&
    (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 || 'ontouchstart' in window)
  );
}

function getDismissedAt() {
  if (typeof window === 'undefined') return null;

  const raw = window.localStorage.getItem(DISMISS_KEY);
  if (!raw) return null;

  const timestamp = Number(raw);
  if (!Number.isFinite(timestamp)) {
    window.localStorage.removeItem(DISMISS_KEY);
    return null;
  }

  if (Date.now() - timestamp > DISMISS_DURATION_MS) {
    window.localStorage.removeItem(DISMISS_KEY);
    return null;
  }

  return timestamp;
}

export function PwaInstallPrompt({ dockToBottomNav = false }: PwaInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [ready, setReady] = useState(false);

  const bottomOffsetClass = useMemo(
    () =>
      dockToBottomNav
        ? 'bottom-[calc(5.25rem+env(safe-area-inset-bottom))]'
        : 'bottom-4',
    [dockToBottomNav]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const ios =
      /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
      /safari/i.test(window.navigator.userAgent) &&
      !/crios|fxiOS|edgios/i.test(window.navigator.userAgent);

    setIsIos(ios);

    if (isStandaloneMode() || !isMobileDevice() || getDismissedAt()) {
      setReady(true);
      return;
    }

    setVisible(true);
    setReady(true);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
      setReady(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  if (!ready || !visible) {
    return null;
  }

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    setVisible(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      handleDismiss();
    } else {
      setVisible(true);
    }
    setDeferredPrompt(null);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.22 }}
          className={`fixed left-4 right-4 ${bottomOffsetClass} z-[90] mx-auto max-w-md sm:hidden`}
        >
          <div className="glass-panel rounded-[1.75rem] border-white/15 p-4 shadow-[0_24px_72px_rgba(0,0,0,0.45)]">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-neon-cyan/15 text-neon-cyan">
                <Smartphone className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">
                  {deferredPrompt ? 'Install Pitch in Public' : 'Add Pitch in Public to your home screen'}
                </p>
                <p className="mt-1 text-sm leading-5 text-slate-300">
                  {isIos
                    ? 'In Safari, tap Share, then Add to Home Screen for a calmer app-like launch.'
                    : 'Install it for a faster open, fewer browser controls, and a cleaner recording flow.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleDismiss}
                className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-slate-400 transition hover:text-white"
                aria-label="Dismiss install prompt"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex gap-2">
              {deferredPrompt ? (
                <button
                  type="button"
                  onClick={handleInstall}
                  className="flex-1 rounded-full bg-gradient-to-r from-neon-cyan to-neon-lime px-4 py-3 text-sm font-bold text-slate-950 transition hover:opacity-95"
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    <Download className="h-4 w-4" />
                    Install
                  </span>
                </button>
              ) : (
                <div className="flex-1 rounded-full border border-white/10 bg-white/[0.05] px-4 py-3 text-center text-sm font-semibold text-slate-200">
                  Share menu: Add to Home Screen
                </div>
              )}

              <button
                type="button"
                onClick={handleDismiss}
                className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:text-white"
              >
                Later
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
