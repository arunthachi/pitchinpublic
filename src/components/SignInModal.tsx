'use client';

import { FormEvent, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, CheckCircle2, ChevronLeft, Loader2, LockKeyhole, Smartphone, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type OAuthProvider = 'google' | 'linkedin_oidc';
type AuthStep = 'phone' | 'code';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const formatUSPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').replace(/^1/, '').slice(0, 10);
  const area = digits.slice(0, 3);
  const prefix = digits.slice(3, 6);
  const line = digits.slice(6, 10);

  if (digits.length > 6) return `(${area}) ${prefix}-${line}`;
  if (digits.length > 3) return `(${area}) ${prefix}`;
  if (digits.length > 0) return `(${area}`;
  return '';
};

const toE164USPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').replace(/^1/, '').slice(0, 10);
  return digits.length === 10 ? `+1${digits}` : null;
};

export function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<AuthStep>('phone');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [maskedDestination, setMaskedDestination] = useState<string | null>(null);
  const supabase = createClient();

  const normalizedPhone = useMemo(() => toE164USPhone(phone), [phone]);
  const canSendCode = Boolean(normalizedPhone) && loading === null;
  const canVerifyCode = otpCode.length === 6 && loading === null;

  const resetModal = () => {
    setLoading(null);
    setError(null);
    setStep('phone');
    setPhone('');
    setOtpCode('');
    setMaskedDestination(null);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleSocialSignIn = async (provider: OAuthProvider) => {
    try {
      setLoading(provider);
      setError(null);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (err) {
      console.error('Sign in error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign in');
      setLoading(null);
    }
  };

  const handleSendCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!normalizedPhone) {
      setError('Enter a valid US phone number.');
      return;
    }

    try {
      setLoading('phone');
      setError(null);

      const response = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizedPhone }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || 'Could not send the code. Try again.');
      }

      setMaskedDestination(payload.destination || normalizedPhone.replace(/^\+1(\d{3})\d{3}(\d{4})$/, '+1 ($1) ***-$2'));
      setOtpCode('');
      setStep('code');
    } catch (err) {
      console.error('OTP send error:', err);
      setError(err instanceof Error ? err.message : 'Could not send the code. Try again.');
    } finally {
      setLoading(null);
    }
  };

  const handleVerifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!normalizedPhone || otpCode.length !== 6) {
      setError('Enter the 6-digit code.');
      return;
    }

    try {
      setLoading('verify');
      setError(null);

      const { error } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: otpCode,
        type: 'sms',
      });

      if (error) throw error;
      handleClose();
    } catch (err) {
      console.error('OTP verify error:', err);
      setError(err instanceof Error ? err.message : 'That code did not work. Try again.');
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

          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 18 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="relative w-full max-w-[460px]"
            >
              <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-[#07090d]/95 shadow-2xl shadow-black/50">
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
                    <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-neon-cyan text-slate-950 shadow-lg shadow-neon-cyan/20">
                      <Smartphone className="h-7 w-7" />
                    </div>
                    <h2 className="font-heading text-3xl font-bold tracking-normal text-white sm:text-4xl">
                      Get in and pitch.
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-slate-300">
                      Use a phone code for the fastest mobile path. Recording from your Mac?
                      Continue with Google or LinkedIn.
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

                  <div className="flex flex-col gap-5">
                    <section className="order-1 rounded-3xl border border-white/10 bg-white/[0.04] p-4 md:order-2">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">Phone code</p>
                          <p className="text-xs text-slate-400">Best for mobile, events, and daily nudges.</p>
                        </div>
                        <span className="rounded-full border border-neon-lime/25 bg-neon-lime/10 px-3 py-1 text-xs font-semibold text-neon-lime">
                          +1
                        </span>
                      </div>

                      {step === 'phone' ? (
                        <form onSubmit={handleSendCode} className="space-y-3">
                          <label className="sr-only" htmlFor="phone">
                            US phone number
                          </label>
                          <div className="flex overflow-hidden rounded-2xl border border-white/10 bg-black/35 transition focus-within:border-neon-cyan/70 focus-within:ring-2 focus-within:ring-neon-cyan/20">
                            <div className="flex items-center gap-2 border-r border-white/10 px-4 text-sm font-semibold text-white">
                              <span aria-hidden="true">US</span>
                              <span className="text-slate-500">+1</span>
                            </div>
                            <input
                              id="phone"
                              type="tel"
                              inputMode="tel"
                              autoComplete="tel-national"
                              placeholder="(555) 000-0000"
                              value={phone}
                              onChange={(event) => setPhone(formatUSPhone(event.target.value))}
                              className="min-w-0 flex-1 bg-transparent px-4 py-4 text-lg font-semibold text-white outline-none placeholder:text-slate-600"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={!canSendCode}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-neon-cyan px-5 py-4 font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {loading === 'phone' ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                            Text me a code
                            {loading !== 'phone' ? <ArrowRight className="h-5 w-5" /> : null}
                          </button>
                        </form>
                      ) : (
                        <form onSubmit={handleVerifyCode} className="space-y-3">
                          <button
                            type="button"
                            onClick={() => {
                              setStep('phone');
                              setOtpCode('');
                              setError(null);
                            }}
                            className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-400 transition hover:text-white"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Change number
                          </button>
                          <label className="sr-only" htmlFor="otp">
                            Six digit code
                          </label>
                          <input
                            id="otp"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            placeholder="000000"
                            value={otpCode}
                            onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-4 text-center text-3xl font-bold tracking-[0.45em] text-white outline-none transition placeholder:text-slate-700 focus:border-neon-cyan/70 focus:ring-2 focus:ring-neon-cyan/20"
                          />
                          <p className="text-center text-xs text-slate-400">
                            Code sent to {maskedDestination || 'your phone'}.
                          </p>
                          <button
                            type="submit"
                            disabled={!canVerifyCode}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-neon-lime px-5 py-4 font-bold text-slate-950 transition hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {loading === 'verify' ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                            Start pitching
                          </button>
                        </form>
                      )}
                    </section>

                    <section className="order-2 space-y-3 md:order-1">
                      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                        <span className="h-px flex-1 bg-white/10" />
                        Desktop quick start
                        <span className="h-px flex-1 bg-white/10" />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSocialSignIn('google')}
                        disabled={loading !== null}
                        className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-5 py-4 font-bold text-slate-950 shadow-lg transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
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

                      <button
                        type="button"
                        onClick={() => handleSocialSignIn('linkedin_oidc')}
                        disabled={loading !== null}
                        className="flex w-full items-center justify-center gap-3 rounded-2xl border border-[#70b7ff]/35 bg-[#0a66c2] px-5 py-4 font-bold text-white shadow-lg shadow-[#0a66c2]/15 transition hover:bg-[#0b75de] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {loading === 'linkedin_oidc' ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <span className="flex h-5 w-5 items-center justify-center rounded bg-white text-sm font-black text-[#0a66c2]">
                            in
                          </span>
                        )}
                        Continue with LinkedIn
                      </button>
                    </section>
                  </div>

                  <div className="mt-6 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-5 text-slate-400">
                    <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    <p>
                      One account for practice streaks, event rooms, and feedback. Phone is US-only during early access.
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
