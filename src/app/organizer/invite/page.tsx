'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, CalendarDays, CheckCircle2, Loader2, LockKeyhole, XCircle } from 'lucide-react';
import { SignInModal } from '@/components/SignInModal';
import { useAuth } from '@/contexts/AuthContext';

type AcceptState = 'idle' | 'accepting' | 'accepted' | 'error';

function OrganizerInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const [showSignIn, setShowSignIn] = useState(false);
  const [state, setState] = useState<AcceptState>('idle');
  const [message, setMessage] = useState('');
  const code = useMemo(() => (searchParams.get('code') || '').trim(), [searchParams]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setShowSignIn(true);
      return;
    }
    if (!code || state !== 'idle') return;

    const acceptInvite = async () => {
      setState('accepting');
      setMessage('');

      try {
        const response = await fetch('/api/organizer-invites/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Could not accept organizer invite.');
        }

        setState('accepted');
        setMessage(data.message || 'Organizer access enabled.');
        window.setTimeout(() => {
          router.replace(data.redirectTo || '/events/new?organizer=accepted');
        }, 900);
      } catch (error) {
        setState('error');
        setMessage(error instanceof Error ? error.message : 'Could not accept organizer invite.');
      }
    };

    acceptInvite();
  }, [code, loading, router, state, user]);

  return (
    <main className="min-h-screen bg-background px-4 py-8 text-white sm:px-6">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-3xl items-center justify-center">
        <section className="glass-panel w-full rounded-[2rem] p-6 text-center sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-neon-cyan/15 text-neon-cyan shadow-[0_16px_50px_rgba(34,211,238,0.14)]">
            {state === 'accepted' ? <CheckCircle2 className="h-8 w-8" /> : state === 'error' ? <XCircle className="h-8 w-8" /> : <LockKeyhole className="h-8 w-8" />}
          </div>

          <p className="mt-7 font-heading text-xs font-black uppercase tracking-[0.22em] text-neon-lime">
            Invite-only organizer access
          </p>
          <h1 className="mx-auto mt-3 max-w-2xl font-heading text-4xl font-black leading-tight sm:text-5xl">
            Create pitch rooms only after an invite.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
            Organizer accounts can create events, invite founders and judges, review submissions, and post announcements.
            This access is gated so founder practice stays simple.
          </p>

          <div className="mx-auto mt-7 max-w-xl rounded-3xl border border-white/10 bg-black/20 p-4 text-left">
            <div className="flex items-start gap-3">
              <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/8 text-neon-cyan">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <p className="font-heading text-sm font-black uppercase tracking-[0.18em] text-slate-400">
                  Invite code
                </p>
                <p className="mt-1 break-all font-mono text-lg font-black text-white">
                  {code || 'Missing code'}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  {loading
                    ? 'Checking your session...'
                    : !code
                      ? 'Open the organizer invite link you received.'
                      : !user
                        ? 'Sign in with the email that received this invite.'
                        : state === 'accepting'
                          ? 'Enabling organizer access...'
                          : state === 'accepted'
                            ? 'Organizer access is enabled. Redirecting...'
                            : state === 'error'
                              ? message
                              : 'Ready to enable organizer access.'}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            {!user ? (
              <button
                type="button"
                onClick={() => setShowSignIn(true)}
                className="cta-primary inline-flex items-center justify-center gap-2 rounded-full px-6 py-4 font-heading font-black"
              >
                Sign in to accept
                <ArrowRight className="h-5 w-5" />
              </button>
            ) : state === 'accepting' ? (
              <button
                type="button"
                disabled
                className="cta-primary inline-flex items-center justify-center gap-2 rounded-full px-6 py-4 font-heading font-black opacity-70"
              >
                <Loader2 className="h-5 w-5 animate-spin" />
                Accepting invite
              </button>
            ) : state === 'accepted' ? (
              <Link
                href="/events/new?organizer=accepted"
                className="cta-primary inline-flex items-center justify-center gap-2 rounded-full px-6 py-4 font-heading font-black"
              >
                Create event
                <ArrowRight className="h-5 w-5" />
              </Link>
            ) : (
              <Link
                href="/for-events"
                className="btn-glass inline-flex items-center justify-center rounded-full px-6 py-4 font-heading font-bold"
              >
                Request a new invite
              </Link>
            )}

            <Link
              href="/?alpha=1&preview=1"
              className="btn-glass inline-flex items-center justify-center rounded-full px-6 py-4 font-heading font-bold"
            >
              Back to founder app
            </Link>
          </div>
        </section>
      </div>

      <SignInModal isOpen={showSignIn} onClose={() => setShowSignIn(false)} />
    </main>
  );
}

export default function OrganizerInvitePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background text-white">Loading invite...</div>}>
      <OrganizerInviteContent />
    </Suspense>
  );
}
