'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Mail, Phone, ArrowRight, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthMethod = 'phone' | 'email';

export function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const [authMethod, setAuthMethod] = useState<AuthMethod>('phone');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const supabase = createClient();

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

  const handlePhoneSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!phone || phone.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }

    try {
      setLoading('phone');
      setError(null);

      // Format phone number (basic US format for now)
      const formattedPhone = phone.replace(/\D/g, '');
      const phoneWithCountry = formattedPhone.startsWith('1') ? `+${formattedPhone}` : `+1${formattedPhone}`;

      const { error } = await supabase.auth.signInWithOtp({
        phone: phoneWithCountry,
      });

      if (error) throw error;

      setCodeSent(true);
      setLoading(null);
    } catch (err) {
      console.error('Phone sign in error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send code');
      setLoading(null);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setLoading('email');
      setError(null);

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      setCodeSent(true);
      setLoading(null);
    } catch (err) {
      console.error('Email sign in error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send code');
      setLoading(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    if (authMethod === 'phone') {
      handlePhoneSignIn(e);
    } else {
      handleEmailSignIn(e);
    }
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
                          <svg className="w-9 h-9 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
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

                      {/* Phone/Email Toggle - TikTok Style */}
                      <div className="mb-6">
                        <div className="flex gap-3 p-1.5 bg-slate-800/50 rounded-2xl border border-slate-700/50">
                          <button
                            type="button"
                            onClick={() => setAuthMethod('phone')}
                            className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
                              authMethod === 'phone'
                                ? 'bg-white text-slate-900 shadow-lg'
                                : 'text-slate-400 hover:text-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-center gap-2">
                              <Phone className="w-4 h-4" />
                              <span>Phone</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setAuthMethod('email')}
                            className={`flex-1 py-3 px-4 rounded-xl font-semibold text-sm transition-all ${
                              authMethod === 'email'
                                ? 'bg-white text-slate-900 shadow-lg'
                                : 'text-slate-400 hover:text-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-center gap-2">
                              <Mail className="w-4 h-4" />
                              <span>Email</span>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Input Form */}
                      <form onSubmit={handleSubmit} className="space-y-4 mb-6">
                        <div className="relative">
                          {authMethod === 'phone' ? (
                            <>
                              <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                              <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                                placeholder="Phone number"
                                className="w-full pl-14 pr-6 py-5 bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 rounded-2xl focus:outline-none focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20 transition-all text-base"
                                disabled={loading !== null}
                                maxLength={12}
                              />
                            </>
                          ) : (
                            <>
                              <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                              <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Email address"
                                className="w-full pl-14 pr-6 py-5 bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 rounded-2xl focus:outline-none focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20 transition-all text-base"
                                disabled={loading !== null}
                              />
                            </>
                          )}
                        </div>

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          type="submit"
                          disabled={loading !== null}
                          className="w-full group relative overflow-hidden px-6 py-5 bg-gradient-to-r from-neon-cyan to-neon-lime text-slate-900 font-bold rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-neon-cyan/25 hover:shadow-xl hover:shadow-neon-cyan/40"
                        >
                          <div className="flex items-center justify-center gap-3">
                            {loading === authMethod ? (
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

                      {/* Divider */}
                      <div className="relative my-6">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-slate-700"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-4 bg-slate-900/90 text-slate-500 font-medium">or</span>
                        </div>
                      </div>

                      {/* Social Sign In Buttons */}
                      <div className="space-y-3">
                        {/* Apple Sign In */}
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

                        {/* Google Sign In */}
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
                      </div>

                      {/* Terms */}
                      <p className="mt-8 text-xs text-slate-500 text-center leading-relaxed">
                        By continuing, you agree to our{' '}
                        <a href="#" className="text-neon-cyan hover:underline">Terms of Service</a>
                        {' '}and{' '}
                        <a href="#" className="text-neon-cyan hover:underline">Privacy Policy</a>
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
                        {authMethod === 'phone' ? (
                          <Phone className="w-10 h-10 text-slate-900" />
                        ) : (
                          <Mail className="w-10 h-10 text-slate-900" />
                        )}
                      </motion.div>

                      <h3 className="text-2xl font-bold text-white font-heading mb-4">
                        {authMethod === 'phone' ? 'Check your phone!' : 'Check your email!'}
                      </h3>

                      <p className="text-slate-400 text-base mb-3">
                        {authMethod === 'phone'
                          ? "We've sent a verification code to"
                          : "We've sent a magic link to"
                        }
                      </p>
                      <p className="text-white font-semibold text-lg mb-6">
                        {authMethod === 'phone' ? phone : email}
                      </p>

                      <p className="text-slate-500 text-sm mb-8">
                        {authMethod === 'phone'
                          ? 'Enter the code to sign in. It expires in 10 minutes.'
                          : 'Click the link in the email to sign in. It expires in 1 hour.'
                        }
                      </p>

                      <button
                        onClick={() => {
                          setCodeSent(false);
                          setEmail('');
                          setPhone('');
                        }}
                        className="text-neon-cyan hover:text-neon-lime transition-colors font-medium"
                      >
                        ← Back to sign in
                      </button>
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
