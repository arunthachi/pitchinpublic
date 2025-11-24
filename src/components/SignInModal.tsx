'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Mail, Phone, ArrowRight, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthMethod = 'phone' | 'email';

export function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const [input, setInput] = useState('');
  const [detectedMethod, setDetectedMethod] = useState<AuthMethod | null>(null);
  const [forceMethod, setForceMethod] = useState<AuthMethod | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [sentTo, setSentTo] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(3600); // 60 minutes for email, will adjust
  const supabase = createClient();

  // Countdown timer for verification expiration
  useEffect(() => {
    if (!codeSent) return;

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [codeSent]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;

    const interval = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Smart detection: email vs phone
  const detectAuthMethod = (value: string): AuthMethod | null => {
    const cleanValue = value.trim();

    // Check if email
    if (cleanValue.includes('@') && cleanValue.includes('.')) {
      return 'email';
    }

    // Check if phone (has digits and length >= 10)
    const digitsOnly = cleanValue.replace(/\D/g, '');
    if (digitsOnly.length >= 10) {
      return 'phone';
    }

    return null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);

    // Auto-detect method
    const detected = detectAuthMethod(value);
    setDetectedMethod(detected);

    // Clear error when user starts typing
    if (error) setError(null);
  };

  const formatPhoneNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{0,3})(\d{0,3})(\d{0,4})$/);
    if (match) {
      const parts = [match[1], match[2], match[3]].filter(Boolean);
      return parts.join('-');
    }
    return value;
  };

  const handleSocialSignIn = async (provider: 'google' | 'apple') => {
    try {
      setLoading(provider);
      setError(null);

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
    } catch (err) {
      console.error('Sign in error:', err);
      setError(err instanceof Error ? err.message : 'Failed to sign in');
      setLoading(null);
    }
  };

  const handlePhoneSignIn = async () => {
    const cleanedPhone = input.replace(/\D/g, '');

    if (!cleanedPhone || cleanedPhone.length < 10) {
      setError('Please enter a valid phone number (at least 10 digits)');
      return;
    }

    try {
      setLoading('phone');
      setError(null);

      const phoneWithCountry = cleanedPhone.startsWith('1')
        ? `+${cleanedPhone}`
        : `+1${cleanedPhone}`;

      const { error } = await supabase.auth.signInWithOtp({
        phone: phoneWithCountry,
      });

      if (error) {
        if (error.message.includes('over_sms_limit')) {
          throw new Error('Too many SMS attempts. Please try again later.');
        }
        throw error;
      }

      setSentTo(phoneWithCountry);
      setCodeSent(true);
      setTimeRemaining(600); // 10 minutes for phone OTP
      setLoading(null);
    } catch (err) {
      console.error('Phone sign in error:', err);
      const message = err instanceof Error ? err.message : 'Failed to send code';
      setError(message);
      setLoading(null);
    }
  };

  const handleEmailSignIn = async () => {
    if (!input || !input.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setLoading('email');
      setError(null);

      const { error } = await supabase.auth.signInWithOtp({
        email: input,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        if (error.message.includes('over_email_send_limit')) {
          throw new Error('Too many email attempts. Please try again later.');
        }
        throw error;
      }

      setSentTo(input);
      setCodeSent(true);
      setTimeRemaining(3600); // 60 minutes for email magic link
      setLoading(null);
    } catch (err) {
      console.error('Email sign in error:', err);
      const message = err instanceof Error ? err.message : 'Failed to send magic link';
      setError(message);
      setLoading(null);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    const method = forceMethod || detectedMethod;
    if (method === 'phone') {
      await handlePhoneSignIn();
    } else {
      await handleEmailSignIn();
    }
    setResendCooldown(30); // 30 second cooldown
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const method = forceMethod || detectedMethod;

    if (!method) {
      setError('Please enter a valid email address or phone number');
      return;
    }

    if (method === 'phone') {
      handlePhoneSignIn();
    } else {
      handleEmailSignIn();
    }
  };

  const method = forceMethod || detectedMethod;
  const formattedTime = `${String(Math.floor(timeRemaining / 60)).padStart(2, '0')}:${String(
    timeRemaining % 60
  ).padStart(2, '0')}`;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop with blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100]"
            onClick={onClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md"
            >
              {/* Glass morphism card */}
              <div className="relative bg-gradient-to-br from-slate-900/90 to-slate-950/90 backdrop-blur-xl border border-slate-700/50 rounded-3xl shadow-2xl overflow-hidden">
                {/* Gradient accent */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-neon-cyan via-neon-lime to-neon-cyan" />

                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full bg-slate-800/50 hover:bg-slate-700/50 transition-colors z-10 backdrop-blur-sm"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>

                {/* Content */}
                <div className="p-8 pt-12">
                  {!codeSent ? (
                    <>
                      {/* Header */}
                      <div className="text-center mb-8">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-neon-cyan to-neon-lime mb-6 shadow-lg shadow-neon-cyan/25"
                        >
                          <svg
                            className="w-9 h-9 text-slate-900"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                            />
                          </svg>
                        </motion.div>
                        <h2 className="text-3xl font-bold text-white font-heading mb-3">
                          Join Pitch in Public
                        </h2>
                        <p className="text-slate-400 text-base">
                          Share your startup journey with founders worldwide
                        </p>
                      </div>

                      {/* Error Message */}
                      <AnimatePresence>
                        {error && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl backdrop-blur-sm"
                          >
                            <p className="text-red-400 text-sm text-center">{error}</p>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Social Sign In - PROMINENT (FIRST) */}
                      <div className="space-y-3 mb-6">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSocialSignIn('google')}
                          disabled={loading !== null}
                          className="w-full group relative overflow-hidden px-6 py-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                        >
                          <div className="flex items-center justify-center gap-3">
                            {loading === 'google' ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                              </svg>
                            )}
                            <span>Continue with Google</span>
                          </div>
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSocialSignIn('apple')}
                          disabled={loading !== null}
                          className="w-full group relative overflow-hidden px-6 py-4 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                        >
                          <div className="flex items-center justify-center gap-3">
                            {loading === 'apple' ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                              </svg>
                            )}
                            <span>Continue with Apple</span>
                          </div>
                        </motion.button>
                      </div>

                      {/* Divider */}
                      <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-slate-700"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-4 bg-slate-900/90 text-slate-500 font-medium">
                            or continue with email or phone
                          </span>
                        </div>
                      </div>

                      {/* Smart Input Form - Single Field */}
                      <form onSubmit={handleSubmit} className="space-y-4 mb-6">
                        <div className="relative">
                          {method === 'phone' ? (
                            <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                          ) : method === 'email' ? (
                            <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                          ) : (
                            <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                          )}

                          <input
                            type="text"
                            value={input}
                            onChange={handleInputChange}
                            placeholder="Email or phone number"
                            className="w-full pl-14 pr-6 py-5 bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 rounded-2xl focus:outline-none focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20 transition-all text-base"
                            disabled={loading !== null}
                            autoFocus
                          />
                        </div>

                        {/* Prefer phone? Toggle - Optional */}
                        {detectedMethod === 'email' && !forceMethod && (
                          <motion.button
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            type="button"
                            onClick={() => setForceMethod('phone')}
                            className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
                          >
                            Prefer to use phone? →
                          </motion.button>
                        )}

                        {forceMethod === 'phone' && (
                          <motion.button
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            type="button"
                            onClick={() => setForceMethod(null)}
                            className="text-xs text-slate-400 hover:text-slate-300 transition-colors"
                          >
                            ← Back to email
                          </motion.button>
                        )}

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          type="submit"
                          disabled={loading !== null || !method}
                          className="w-full group relative overflow-hidden px-6 py-5 bg-gradient-to-r from-neon-cyan to-neon-lime text-slate-900 font-bold rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-neon-cyan/25 hover:shadow-xl hover:shadow-neon-cyan/40"
                        >
                          <div className="flex items-center justify-center gap-3">
                            {loading ? (
                              <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span className="text-lg">Sending...</span>
                              </>
                            ) : (
                              <>
                                <span className="text-lg">Continue</span>
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                              </>
                            )}
                          </div>
                        </motion.button>
                      </form>

                      {/* Terms */}
                      <p className="text-xs text-slate-500 text-center leading-relaxed">
                        By continuing, you agree to our{' '}
                        <a href="#" className="text-neon-cyan hover:underline">
                          Terms of Service
                        </a>
                        {' '}and{' '}
                        <a href="#" className="text-neon-cyan hover:underline">
                          Privacy Policy
                        </a>
                      </p>
                    </>
                  ) : (
                    // Code Sent Success State
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center py-8"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                        className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-neon-cyan to-neon-lime mb-6 shadow-lg shadow-neon-cyan/25"
                      >
                        {method === 'phone' ? (
                          <Phone className="w-10 h-10 text-slate-900" />
                        ) : (
                          <Mail className="w-10 h-10 text-slate-900" />
                        )}
                      </motion.div>

                      <h3 className="text-2xl font-bold text-white font-heading mb-4">
                        {method === 'phone' ? 'Check your phone!' : 'Check your email!'}
                      </h3>

                      <p className="text-slate-400 text-base mb-3">
                        {method === 'phone'
                          ? 'We sent a verification code to'
                          : 'We sent a magic link to'
                        }
                      </p>
                      <p className="text-white font-semibold text-lg mb-6 break-all">{sentTo}</p>

                      {/* Timer - Prominent Display */}
                      <div className="mb-8 p-4 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                        <p className="text-slate-400 text-sm mb-2">
                          {method === 'phone'
                            ? 'Code expires in'
                            : 'Link expires in'}
                        </p>
                        <div className="text-3xl font-bold text-neon-cyan font-mono">
                          {formattedTime} ⏱️
                        </div>
                      </div>

                      <p className="text-slate-500 text-sm mb-8">
                        {method === 'phone'
                          ? 'Enter the code to sign in. It expires in 10 minutes.'
                          : 'Click the link in the email to sign in. It expires in 1 hour.'
                        }
                      </p>

                      {/* Resend Button with Cooldown */}
                      <button
                        onClick={handleResend}
                        disabled={resendCooldown > 0 || loading !== null}
                        className={`text-neon-cyan hover:text-neon-lime transition-colors font-medium mb-6 ${
                          resendCooldown > 0 ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {resendCooldown > 0
                          ? `Resend in ${resendCooldown}s`
                          : 'Resend'}
                      </button>

                      {/* Back Button */}
                      <div className="pt-4 border-t border-slate-700">
                        <button
                          onClick={() => {
                            setCodeSent(false);
                            setInput('');
                            setForceMethod(null);
                            setError(null);
                            setTimeRemaining(3600);
                          }}
                          className="text-slate-400 hover:text-slate-300 transition-colors font-medium text-sm"
                        >
                          ← Try a different method
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
