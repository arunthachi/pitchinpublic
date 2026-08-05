'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, LogOut, UserRound } from 'lucide-react';
import type { ActionNavLink } from '@/lib/app-navigation';

type ActionPageNavProps = {
  links: ActionNavLink[];
  account?: {
    email?: string | null;
    profileHref?: string;
    onSignOut?: () => void | Promise<void>;
  };
  ariaLabel?: string;
  className?: string;
};

export function ActionPageNav({
  links,
  account,
  ariaLabel = 'App navigation',
  className = '',
}: ActionPageNavProps) {
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!accountOpen) return;

    const close = (restoreFocus = false) => {
      setAccountOpen(false);
      if (restoreFocus) window.requestAnimationFrame(() => triggerRef.current?.focus());
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [accountOpen]);

  const visibleLinks = links.slice(0, 3);

  return (
    <nav
      aria-label={ariaLabel}
      className={`relative z-40 border-b border-white/10 bg-black/75 px-[max(1rem,env(safe-area-inset-left))] pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl ${className}`}
    >
      <div className="mx-auto flex min-h-11 max-w-7xl items-center gap-1 sm:gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden sm:gap-2">
          {visibleLinks.map((link) => (
            <Link
              key={`${link.label}:${link.href}`}
              href={link.href}
              aria-current={link.current ? 'page' : undefined}
              className={`inline-flex min-h-11 min-w-0 items-center justify-center rounded-full px-3 text-sm font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-neon-cyan sm:px-4 ${
                link.current
                  ? 'bg-white text-slate-950'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="truncate">{link.label}</span>
            </Link>
          ))}
        </div>

        {account ? (
          <div ref={accountRef} className="relative shrink-0">
            <button
              ref={triggerRef}
              type="button"
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              aria-label={account.email ? `Account menu for ${account.email}` : 'Account menu'}
              onClick={() => setAccountOpen((open) => !open)}
              className="inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-3 text-slate-200 outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-neon-cyan"
            >
              <UserRound className="h-4 w-4" aria-hidden="true" />
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </button>

            {accountOpen ? (
              <div
                role="menu"
                aria-label="Account actions"
                className="absolute right-0 top-[calc(100%+0.5rem)] w-52 overflow-hidden rounded-2xl border border-white/10 bg-slate-950 p-1.5 shadow-2xl"
              >
                {account.email ? (
                  <p className="truncate px-3 py-2 text-xs text-slate-500" title={account.email}>
                    {account.email}
                  </p>
                ) : null}
                {account.profileHref ? (
                  <Link
                    href={account.profileHref}
                    role="menuitem"
                    onClick={() => setAccountOpen(false)}
                    className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-slate-200 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-neon-cyan"
                  >
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                    Profile
                  </Link>
                ) : null}
                {account.onSignOut ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={async () => {
                      setAccountOpen(false);
                      await account.onSignOut?.();
                    }}
                    className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-bold text-slate-200 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-neon-cyan"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Log out
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
