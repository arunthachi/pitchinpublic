'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Loader2, LockKeyhole, Mail, QrCode, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { createClient } from '@/lib/supabase/client';
import { markAuthPending, clearAuthPending } from '@/lib/auth-pending';

type OAuthProvider = 'google';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const getFriendlyAuthError = (error: unknown) => {
  if (error instanceof Error && error.message.includes('Supabase client is not configured')) {
    return 'Sign in is not available in this environment yet.';
  }

  return error instanceof Error ? error.message : 'Something went wrong. Try again.';
};

const getSafeNextPath = () => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next');

  if (next && next.startsWith('/') && !next.startsWith('//')) {
    return next;
  }

  return null;
};

export function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authStep, setAuthStep] = useState<'start' | 'email-code'>('start');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [mobileRecordUrl, setMobileRecordUrl] = useState('');

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const url = new URL(window.location.origin);
    url.searchParams.set('record', '1');
    setMobileRecordUrl(url.toString());
  }, [isOpen]);

  const resetModal = () => {
    setLoading(null);
    setError(null);
    setAuthStep('start');
    setEmail('');
    setOtpCode('');
    setSentTo('');
  };

  const handleClose = () => {
    clearAuthPending();
    resetModal();
    onClose();
  };

  const handleSocialSignIn = async (provider: OAuthProvider, nextPath?: string) => {
    try {
      setLoading(provider);
      setError(null);
      markAuthPending();

      const supabase = createClient();
      const fallbackNext = getSafeNextPath() || `${window.location.pathname}${window.location.search}` || '/';
      const next = nextPath || fallbackNext;
      const callbackUrl = new URL('/auth/callback', window.location.origin);
      callbackUrl.searchParams.set('next', next);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: callbackUrl.toString(),
        },
      });

      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      clearAuthPending();
      console.error('Sign in error:', err);
      setError(getFriendlyAuthError(err));
      setLoading(null);
    }
  };

  const handleSendEmailCode = async (event: React.FormEvent) => {
    event.preventDefault();
    await sendEmailCode();
  };

  const sendEmailCode = async () => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    try {
      setLoading('email');
      setError(null);
      const nextPath = (() => {
        const explicitNext = getSafeNextPath();
        if (explicitNext) return explicitNext;

        return `${window.location.pathname}${window.location.search}` || '/';
      })();

      const response = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, next: nextPath }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Could not send the code. Try again.');
      }

      setSentTo(trimmedEmail);
      setAuthStep('email-code');
      setOtpCode('');
      markAuthPending();
    } catch (err) {
      console.error('Email OTP error:', err);
      setError(getFriendlyAuthError(err));
    } finally {
      setLoading(null);
    }
  };

  const handleVerifyEmailCode = async (event: React.FormEvent) => {
    event.preventDefault();
    const token = otpCode.replace(/\D/g, '');

    if (token.length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }

    try {
      setLoading('verify-email');
      setError(null);

      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email: sentTo,
        token,
        type: 'email',
      });

      if (error) throw error;
      clearAuthPending();
      const explicitNext = getSafeNextPath();
      if (explicitNext) {
        window.location.assign(explicitNext);
        return;
      }

      handleClose();
    } catch (err) {
      console.error('Email OTP verification error:', err);
      setError('That code did not work. Check the latest email and try again.');
      setLoading(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-xl"
            onClick={handleClose}
          />

          <div className="fixed inset-0 z-[101] flex items-start justify-center overflow-y-auto overscroll-contain px-3 py-4 sm:px-6 sm:py-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 18 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="relative my-auto w-full max-w-[460px]"
            >
              <div className="glass-panel relative max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-[2rem] sm:max-h-[calc(100dvh-3rem)]">
                <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-neon-cyan/20 via-neon-lime/10 to-transparent" />

                <button
                  type="button"
                  onClick={handleClose}
                  className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 backdrop-blur-md transition hover:bg-white/10 hover:text-white"
                  aria-label="Close sign in"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="relative p-6 pt-10 sm:p-8 sm:pt-11">
                  <div className="mb-7">
                    <div className="glass-pill mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl text-neon-cyan">
                      <QrCode className="h-7 w-7" />
                    </div>
                    <h2 className="font-heading text-3xl font-bold tracking-normal text-white sm:text-4xl">
                      {authStep === 'email-code' ? 'Enter your code.' : 'Sign in. Start pitching.'}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      {authStep === 'email-code' ? (
                        <>Use the 6-digit code sent to <span className="font-semibold text-white">{sentTo}</span>.</>
                      ) : (
                        <>
                          Google is fastest. Email code works when you want access without another social account.
                          <span className="hidden sm:inline"> Scan the code if you want to record from your phone camera.</span>
                        </>
                      )}
                    </p>
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="mb-5 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm text-red-200"
                      >
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-4">
                    {authStep === 'start' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleSocialSignIn('google')}
                          disabled={loading !== null}
                          className="flex w-full items-center justify-center gap-3 rounded-full bg-white px-5 py-4 font-bold text-slate-950 shadow-[0_18px_48px_rgba(255,255,255,0.14)] transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {loading === 'google' ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                          )}
                          Continue with Google
                        </button>

                        <div className="relative flex items-center py-1">
                          <div className="h-px flex-1 bg-white/10" />
                          <span className="px-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">or</span>
                          <div className="h-px flex-1 bg-white/10" />
                        </div>

                        <form onSubmit={handleSendEmailCode} className="space-y-3">
                          <label className="block">
                            <span className="mb-2 block text-sm font-bold text-slate-200">Email</span>
                            <div className="flex items-center gap-3 rounded-full border border-white/12 bg-white/[0.06] px-4 py-3.5 focus-within:border-neon-cyan/70 focus-within:ring-2 focus-within:ring-neon-cyan/20">
                              <Mail className="h-5 w-5 shrink-0 text-slate-400" />
                              <input
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                placeholder="you@company.com"
                                className="min-w-0 flex-1 bg-transparent text-base font-semibold text-white outline-none placeholder:text-slate-500"
                                autoComplete="email"
                              />
                            </div>
                          </label>
                          <button
                            type="submit"
                            disabled={loading !== null}
                            className="flex w-full items-center justify-center gap-2 rounded-full border border-neon-cyan/35 bg-neon-cyan/10 px-5 py-4 font-bold text-neon-cyan transition hover:bg-neon-cyan/15 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {loading === 'email' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}
                            Email me a code
                          </button>
                        </form>
                      </>
                    ) : (
                      <form onSubmit={handleVerifyEmailCode} className="space-y-4">
                        <label className="block">
                          <span className="mb-2 block text-sm font-bold text-slate-200">6-digit code</span>
                          <input
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            value={otpCode}
                            onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="000000"
                            className="w-full rounded-full border border-white/12 bg-white/[0.06] px-5 py-4 text-center font-mono text-3xl font-black tracking-[0.28em] text-white outline-none placeholder:text-slate-600 focus:border-neon-cyan/70 focus:ring-2 focus:ring-neon-cyan/20"
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={loading !== null || otpCode.length !== 6}
                          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-neon-cyan to-neon-lime px-5 py-4 font-heading font-black text-slate-950 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {loading === 'verify-email' ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                          Verify and enter
                        </button>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <button
                            type="button"
                            onClick={() => {
                              setAuthStep('start');
                              setOtpCode('');
                              setError(null);
                            }}
                            className="inline-flex items-center gap-1.5 font-semibold text-slate-400 transition hover:text-white"
                          >
                            <ArrowLeft className="h-4 w-4" />
                            Change email
                          </button>
                          <button
                            type="button"
                            onClick={sendEmailCode}
                            disabled={loading !== null}
                            className="font-semibold text-neon-cyan transition hover:text-neon-lime disabled:opacity-50"
                          >
                            Resend code
                          </button>
                        </div>
                      </form>
                    )}

                    <section className="hidden rounded-3xl border border-white/15 bg-white/[0.06] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-2xl sm:block">
                      <div className="grid grid-cols-[116px_1fr] gap-4">
                        <div className="rounded-2xl border border-white/15 bg-white p-2">
                          {mobileRecordUrl ? (
                            <QRCodeSVG value={mobileRecordUrl} size={100} bgColor="#ffffff" fgColor="#020617" />
                          ) : null}
                        </div>
                        <div className="flex flex-col justify-center">
                          <p className="text-sm font-bold text-white">Record from your phone</p>
                          <p className="mt-1 text-xs leading-5 text-slate-400">
                            Scan to open PIP on mobile and continue with Google into the recording flow.
                          </p>
                        </div>
                      </div>
                    </section>

                  </div>

                  <div className="mt-6 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs leading-5 text-slate-400 backdrop-blur-xl">
                    <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    <p>
                      One Google account for practice momentum, feedback, and event rooms. Phone can be linked later in profile for reminders.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
