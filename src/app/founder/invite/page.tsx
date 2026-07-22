'use client';

import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  Mail,
  Mic2,
  ShieldCheck,
  UserRoundCheck,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { SignInModal } from '@/components/SignInModal';
import { useAuth } from '@/contexts/AuthContext';

type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
type Invitation = {
  email: string;
  cohort: string | null;
  source: string | null;
  status: InvitationStatus;
  inviterDisplay: string;
};
type PageState = 'loading' | 'ready' | 'accepting' | 'accepted' | 'invalid' | 'disabled' | 'error';

const normalizeEmail = (value?: string | null) => (value || '').trim().toLowerCase();

function FounderInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, signOut } = useAuth();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [message, setMessage] = useState('');
  const [showSignIn, setShowSignIn] = useState(false);
  const token = useMemo(() => (searchParams.get('token') || '').trim(), [searchParams]);
  const nextPath = useMemo(
    () => (token ? `/founder/invite?token=${encodeURIComponent(token)}` : '/founder/invite'),
    [token]
  );
  const emailMismatch = Boolean(
    user?.email && invitation?.email && normalizeEmail(user.email) !== normalizeEmail(invitation.email)
  );

  useEffect(() => {
    let active = true;

    const resolveInvite = async () => {
      if (!token) {
        setPageState('invalid');
        setMessage('Open the private invitation link that was emailed to you.');
        return;
      }

      setPageState('loading');
      try {
        const response = await fetch(`/api/founder-invites/resolve?token=${encodeURIComponent(token)}`, {
          cache: 'no-store',
        });
        const data = await response.json();
        if (!active) return;

        if (!response.ok || !data.success) {
          setPageState(data.code === 'feature_disabled' ? 'disabled' : data.code === 'resolve_failed' ? 'error' : 'invalid');
          setMessage(data.error || 'This founder invitation is unavailable.');
          return;
        }

        setInvitation(data.invitation);
        if (data.invitation.status === 'expired') {
          setPageState('invalid');
          setMessage('This invitation has expired. Ask for a new founder invite.');
        } else if (data.invitation.status === 'revoked') {
          setPageState('invalid');
          setMessage('This invitation is no longer active. Ask for a new founder invite.');
        } else {
          setPageState('ready');
          setMessage('');
        }
      } catch {
        if (!active) return;
        setPageState('error');
        setMessage('We could not check this invitation. Please try again.');
      }
    };

    void resolveInvite();
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (authLoading || !user || !invitation || emailMismatch) return;
    if (pageState !== 'ready') return;

    let active = true;
    const acceptInvite = async () => {
      setPageState('accepting');
      setMessage('Securing your founder access...');

      try {
        const response = await fetch('/api/founder-invites/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await response.json();
        if (!active) return;

        if (!response.ok || !data.success) {
          if (data.code === 'email_mismatch') {
            setPageState('ready');
          } else if (data.code === 'feature_disabled') {
            setPageState('disabled');
          } else {
            setPageState('invalid');
          }
          setMessage(data.error || 'Could not accept this invitation.');
          return;
        }

        setPageState('accepted');
        setMessage('You’re in. Your first pitch is ready to record.');
        window.setTimeout(() => router.replace(data.redirectTo || '/'), 1400);
      } catch {
        if (!active) return;
        setPageState('error');
        setMessage('Could not accept this invitation. Please try again.');
      }
    };

    void acceptInvite();
    return () => {
      active = false;
    };
  }, [authLoading, emailMismatch, invitation, pageState, router, token, user]);

  const useAnotherAccount = async () => {
    await signOut();
    setMessage('');
    setPageState('ready');
    setShowSignIn(true);
  };

  const isTerminalError = pageState === 'invalid' || pageState === 'disabled' || pageState === 'error';

  return (
    <main className="min-h-[100dvh] bg-background px-3 py-4 text-white sm:px-6 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-4xl items-center justify-center sm:min-h-[calc(100dvh-4rem)]">
        <section className="glass-panel w-full overflow-hidden rounded-[1.5rem] border border-white/10 sm:rounded-[2rem]">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
            <div className="relative p-5 sm:p-8 lg:p-10">
              <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-neon-cyan/15 to-transparent" />
              <div className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-neon-cyan/25 bg-neon-cyan/10 text-neon-cyan sm:h-14 sm:w-14">
                  {pageState === 'accepted' ? (
                    <CheckCircle2 className="h-6 w-6 sm:h-7 sm:w-7" />
                  ) : isTerminalError ? (
                    <XCircle className="h-6 w-6 sm:h-7 sm:w-7" />
                  ) : (
                    <Mic2 className="h-6 w-6 sm:h-7 sm:w-7" />
                  )}
                </div>

                <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-neon-cyan">
                  Private founder invitation
                </p>
                <h1 className="mt-2 font-heading text-[2rem] font-black leading-[1.05] tracking-normal text-white sm:text-5xl">
                  {pageState === 'accepted' ? 'Your pitch room is ready.' : 'You’re invited to Pitch in Public.'}
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
                  Record a short pitch, get useful Toast or Roast feedback, and improve your next take with founders who are practicing too.
                </p>

                <div className="mt-7 space-y-3">
                  <Benefit icon={Mic2} title="Record your first take" copy="Start with one clear, focused pitch." />
                  <Benefit icon={UserRoundCheck} title="Get useful feedback" copy="Know exactly what to sharpen next." />
                  <Benefit icon={ShieldCheck} title="Private founding cohort" copy="Access stays tied to your invited email." />
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 bg-black/20 p-5 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
              {pageState === 'loading' ? (
                <StatePanel icon={Loader2} iconClass="animate-spin" title="Checking your invitation" copy="This will only take a moment." />
              ) : isTerminalError ? (
                <StatePanel icon={XCircle} title={pageState === 'disabled' ? 'Invitations are paused' : 'Invitation unavailable'} copy={message}>
                  <Link href="/" className="btn-glass mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full px-5 py-3 font-bold">
                    Back to Pitch in Public
                  </Link>
                </StatePanel>
              ) : (
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Your invitation</p>
                  <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
                    <p className="break-words font-heading text-lg font-black text-white">{invitation?.email}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      Invited by {invitation?.inviterDisplay || 'Pitch in Public'}
                    </p>
                    {invitation?.cohort ? (
                      <p className="mt-3 inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-bold text-slate-200">
                        {invitation.cohort}
                      </p>
                    ) : null}
                  </div>

                  {emailMismatch ? (
                    <div className="mt-5 rounded-3xl border border-amber-300/25 bg-amber-400/10 p-4" role="alert">
                      <p className="font-heading text-lg font-black text-white">Use another account</p>
                      <p className="mt-2 break-words text-sm leading-6 text-amber-50/80">
                        This invitation belongs to {invitation?.email}. You are signed in as {user?.email}.
                      </p>
                      <button
                        type="button"
                        onClick={useAnotherAccount}
                        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 font-heading font-black text-slate-950"
                      >
                        Use another account
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  ) : pageState === 'accepting' ? (
                    <div className="mt-5 flex items-center gap-3 rounded-3xl border border-neon-cyan/20 bg-neon-cyan/10 p-4" aria-live="polite">
                      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-neon-cyan" />
                      <p className="text-sm font-semibold text-slate-200">{message}</p>
                    </div>
                  ) : pageState === 'accepted' ? (
                    <div className="mt-5 rounded-3xl border border-emerald-300/25 bg-emerald-400/10 p-4" aria-live="polite">
                      <p className="font-heading text-xl font-black text-white">You’re in.</p>
                      <p className="mt-2 text-sm leading-6 text-emerald-50/80">{message}</p>
                      <Link
                        href="/"
                        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 font-heading font-black text-slate-950"
                      >
                        Record your first pitch
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </div>
                  ) : !authLoading && !user ? (
                    <div className="mt-5">
                      <button
                        type="button"
                        onClick={() => setShowSignIn(true)}
                        className="cta-primary inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 font-heading font-black"
                      >
                        Accept founder invite
                        <ArrowRight className="h-5 w-5" />
                      </button>
                      <p className="mt-3 text-center text-xs leading-5 text-slate-500">
                        Continue with Google or a one-time email code.
                      </p>
                    </div>
                  ) : authLoading ? (
                    <div className="mt-5 flex items-center justify-center gap-2 py-3 text-sm text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Checking your account
                    </div>
                  ) : null}

                  {message && pageState === 'ready' && !emailMismatch ? (
                    <p className="mt-4 text-sm text-red-300" role="alert">{message}</p>
                  ) : null}

                  <div className="mt-6 flex items-start gap-3 border-t border-white/10 pt-5 text-xs leading-5 text-slate-500">
                    <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>This private invitation works only with the email address shown above.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <SignInModal
        isOpen={showSignIn}
        onClose={() => setShowSignIn(false)}
        initialEmail={invitation?.email || ''}
        nextPath={nextPath}
      />
    </main>
  );
}

function Benefit({ icon: Icon, title, copy }: { icon: LucideIcon; title: string; copy: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/[0.06] text-slate-300">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="font-heading text-sm font-black text-white">{title}</p>
        <p className="mt-0.5 text-sm leading-5 text-slate-400">{copy}</p>
      </div>
    </div>
  );
}

function StatePanel({
  icon: Icon,
  iconClass = '',
  title,
  copy,
  children,
}: {
  icon: LucideIcon;
  iconClass?: string;
  title: string;
  copy: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-center" aria-live="polite">
      <Icon className={`mx-auto h-8 w-8 text-slate-300 ${iconClass}`} />
      <h2 className="mt-4 font-heading text-2xl font-black text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">{copy}</p>
      {children}
    </div>
  );
}

export default function FounderInvitePage() {
  return (
    <Suspense fallback={<div className="flex min-h-[100dvh] items-center justify-center bg-background text-slate-300">Loading invitation...</div>}>
      <FounderInviteContent />
    </Suspense>
  );
}
