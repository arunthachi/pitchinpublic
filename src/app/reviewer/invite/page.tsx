'use client';

import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, CheckCircle2, ClipboardCheck, Loader2, LockKeyhole, Mail, XCircle } from 'lucide-react';
import { SignInModal } from '@/components/SignInModal';
import { useAuth } from '@/contexts/AuthContext';

type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
type Invitation = {
  email: string;
  status: InvitationStatus;
};
type PageState = 'loading' | 'ready' | 'accepting' | 'accepted' | 'invalid' | 'error';

const normalizeEmail = (value?: string | null) => (value || '').trim().toLowerCase();

function ReviewerInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, signOut } = useAuth();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [message, setMessage] = useState('');
  const [showSignIn, setShowSignIn] = useState(false);
  const [resolveAttempt, setResolveAttempt] = useState(0);
  const token = useMemo(() => (searchParams.get('token') || '').trim(), [searchParams]);
  const nextPath = useMemo(
    () => (token ? `/reviewer/invite?token=${encodeURIComponent(token)}` : '/reviewer/invite'),
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
        setMessage('Open the private reviewer invitation link that was emailed to you.');
        return;
      }

      setPageState('loading');
      try {
        const response = await fetch(`/api/reviewer-invites/resolve?token=${encodeURIComponent(token)}`, {
          cache: 'no-store',
        });
        const data = await response.json().catch(() => ({}));
        if (!active) return;

        if (!response.ok || !data.success) {
          setPageState(data.code === 'resolve_failed' || data.code === 'not_configured' ? 'error' : 'invalid');
          setMessage(data.error || 'This reviewer invitation is unavailable.');
          return;
        }

        const resolvedInvitation = data.invitation || data.access?.invitation;
        if (!resolvedInvitation?.email || !resolvedInvitation?.status) {
          setPageState('error');
          setMessage('This reviewer invitation could not be verified.');
          return;
        }

        setInvitation(resolvedInvitation);
        if (resolvedInvitation.status === 'expired') {
          setPageState('invalid');
          setMessage('This reviewer invitation has expired. Ask for a new invitation.');
        } else if (resolvedInvitation.status === 'revoked') {
          setPageState('invalid');
          setMessage('This reviewer invitation is no longer active. Ask for a new invitation.');
        } else if (resolvedInvitation.status === 'accepted') {
          setPageState('accepted');
          setMessage('This reviewer invitation has already been accepted.');
        } else {
          setPageState('ready');
          setMessage('');
        }
      } catch {
        if (!active) return;
        setPageState('error');
        setMessage('We could not check this reviewer invitation. Please try again.');
      }
    };

    void resolveInvite();
    return () => {
      active = false;
    };
  }, [resolveAttempt, token]);

  useEffect(() => {
    if (authLoading || !user || !invitation || emailMismatch || pageState !== 'ready') return;

    const acceptInvite = async () => {
      setPageState('accepting');
      setMessage('Enabling trusted reviewer access...');

      try {
        const response = await fetch('/api/reviewer-invites/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
          if (data.code === 'email_mismatch') {
            setPageState('ready');
          } else if (data.code === 'resolve_failed' || data.code === 'not_configured') {
            setPageState('error');
          } else {
            setPageState('invalid');
          }
          setMessage(data.error || 'Could not accept this reviewer invitation.');
          return;
        }

        setPageState('accepted');
        setMessage(data.message || 'Trusted reviewer access is active.');
        window.setTimeout(() => router.replace('/'), 1000);
      } catch {
        setPageState('error');
        setMessage('Could not accept this reviewer invitation. Please try again.');
      }
    };

    void acceptInvite();
  }, [authLoading, emailMismatch, invitation, pageState, router, token, user]);

  const useAnotherAccount = async () => {
    await signOut();
    setMessage('');
    setPageState('ready');
    setShowSignIn(true);
  };

  const retry = () => {
    setInvitation(null);
    setMessage('');
    setPageState('loading');
    setResolveAttempt((attempt) => attempt + 1);
  };

  const isTerminalError = pageState === 'invalid' || pageState === 'error';

  return (
    <main className="min-h-[100dvh] bg-background px-4 py-5 text-white sm:px-6 sm:py-10">
      <section className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-lg flex-col justify-center sm:min-h-[calc(100dvh-5rem)]">
        <div className="mb-7 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-neon-cyan/25 bg-neon-cyan/10 text-neon-cyan">
            <ClipboardCheck className="h-6 w-6" />
          </span>
          <div>
            <p className="font-heading text-lg font-black leading-tight">Pitch in Public</p>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Trusted reviewer</p>
          </div>
        </div>

        <div className="border-y border-white/10 py-7 sm:py-9">
          {pageState === 'loading' ? (
            <StatePanel icon={Loader2} iconClass="animate-spin text-neon-cyan" title="Checking your invitation" copy="Verifying the private link before you continue." />
          ) : isTerminalError ? (
            <StatePanel icon={XCircle} iconClass="text-red-300" title="Invitation unavailable" copy={message}>
              {pageState === 'error' ? (
                <button type="button" onClick={retry} className="btn-glass mt-5 min-h-11 w-full px-5 py-3 font-bold">
                  Try again
                </button>
              ) : null}
            </StatePanel>
          ) : (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neon-cyan/10 text-neon-cyan">
                {pageState === 'accepted' ? <CheckCircle2 className="h-6 w-6" /> : <LockKeyhole className="h-6 w-6" />}
              </div>
              <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-neon-lime">Private invitation</p>
              <h1 className="mt-2 font-heading text-3xl font-black leading-tight sm:text-4xl">
                {pageState === 'accepted' ? 'Reviewer access enabled.' : 'Review pitches. Help founders get sharper.'}
              </h1>
              <p className="mt-4 text-sm leading-6 text-slate-300 sm:text-base sm:leading-7">
                {pageState === 'accepted'
                  ? message
                  : 'Join the trusted reviewer feed to watch founder pitches and leave clear, useful feedback.'}
              </p>

              {invitation ? (
                <div className={`mt-6 flex items-start gap-3 rounded-xl border p-4 ${emailMismatch ? 'border-amber-300/25 bg-amber-400/10' : 'border-white/10 bg-white/[0.04]'}`}>
                  <Mail className={`mt-0.5 h-5 w-5 shrink-0 ${emailMismatch ? 'text-amber-200' : 'text-slate-400'}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Invited email</p>
                    <p className="mt-1 break-all text-sm font-bold text-white">{invitation.email}</p>
                    {emailMismatch ? (
                      <p className="mt-2 text-sm leading-5 text-amber-100/80">You are signed in as {user?.email}. Use the invited account to continue.</p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {pageState === 'accepting' ? (
                <div className="mt-6 flex min-h-12 items-center justify-center gap-3 rounded-xl border border-neon-cyan/20 bg-neon-cyan/10 px-4 text-sm font-bold text-slate-100" aria-live="polite">
                  <Loader2 className="h-5 w-5 animate-spin text-neon-cyan" />
                  {message}
                </div>
              ) : pageState === 'accepted' ? (
                <Link href="/" className="cta-primary mt-6 flex min-h-12 w-full items-center justify-center gap-2 px-5 py-3 font-heading font-black">
                  Open review feed
                  <ArrowRight className="h-5 w-5" />
                </Link>
              ) : emailMismatch ? (
                <button type="button" onClick={useAnotherAccount} className="cta-primary mt-6 flex min-h-12 w-full items-center justify-center gap-2 px-5 py-3 font-heading font-black">
                  Use invited account
                  <ArrowRight className="h-5 w-5" />
                </button>
              ) : !authLoading && !user ? (
                <button type="button" onClick={() => setShowSignIn(true)} className="cta-primary mt-6 flex min-h-12 w-full items-center justify-center gap-2 px-5 py-3 font-heading font-black">
                  Sign in to accept
                  <ArrowRight className="h-5 w-5" />
                </button>
              ) : authLoading ? (
                <div className="mt-6 flex items-center justify-center gap-2 py-3 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking your account
                </div>
              ) : null}

              {message && pageState === 'ready' ? <p className="mt-4 text-sm text-red-300" role="alert">{message}</p> : null}
            </>
          )}
        </div>

        <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate-500">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
          This invitation is private and tied to the email address that received it.
        </p>
      </section>

      <SignInModal
        isOpen={showSignIn}
        onClose={() => setShowSignIn(false)}
        initialEmail={invitation?.email || ''}
        nextPath={nextPath}
      />
    </main>
  );
}

function StatePanel({
  icon: Icon,
  iconClass = '',
  title,
  copy,
  children,
}: {
  icon: typeof Loader2;
  iconClass?: string;
  title: string;
  copy: string;
  children?: ReactNode;
}) {
  return (
    <div aria-live="polite">
      <Icon className={`h-8 w-8 text-slate-300 ${iconClass}`} />
      <h1 className="mt-5 font-heading text-3xl font-black text-white">{title}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-400">{copy}</p>
      {children}
    </div>
  );
}

export default function ReviewerInvitePage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-background" />}>
      <ReviewerInviteContent />
    </Suspense>
  );
}
