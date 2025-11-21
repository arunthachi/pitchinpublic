'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Mail, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const supabase = createClient();

  const handleSocialSignIn = async (provider: 'google' | 'github') => {
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

  const handleMagicLinkSignIn = async (e: React.FormEvent) => {
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

      setEmailSent(true);
      setLoading(null);
    } catch (err) {
      console.error('Magic link error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send magic link');
      setLoading(null);
    }
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
                  {!emailSent ? (
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

                      {/* Social Sign In Buttons */}
                      <div className="space-y-3 mb-6">
                        {/* Google Sign In */}
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSocialSignIn('google')}
                          disabled={loading !== null}
                          className="w-full group relative overflow-hidden px-6 py-5 bg-white hover:bg-gray-50 text-gray-900 font-semibold rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                        >
                          <div className="flex items-center justify-center gap-4">
                            {loading === 'google' ? (
                              <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                              <svg className="w-6 h-6" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                              </svg>
                            )}
                            <span className="text-lg">Continue with Google</span>
                          </div>
                        </motion.button>

                        {/* GitHub Sign In */}
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleSocialSignIn('github')}
                          disabled={loading !== null}
                          className="w-full group relative overflow-hidden px-6 py-5 bg-slate-800 hover:bg-slate-750 border border-slate-600 text-white font-semibold rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                        >
                          <div className="flex items-center justify-center gap-4">
                            {loading === 'github' ? (
                              <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                              </svg>
                            )}
                            <span className="text-lg">Continue with GitHub</span>
                          </div>
                        </motion.button>
                      </div>

                      {/* Divider */}
                      <div className="relative my-8">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-slate-700"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-4 bg-slate-900/90 text-slate-500 font-medium">or</span>
                        </div>
                      </div>

                      {/* Email Magic Link */}
                      <form onSubmit={handleMagicLinkSignIn} className="space-y-4">
                        <div className="relative">
                          <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                          <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            className="w-full pl-14 pr-6 py-5 bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 rounded-2xl focus:outline-none focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20 transition-all text-base"
                            disabled={loading !== null}
                          />
                        </div>

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          type="submit"
                          disabled={loading !== null}
                          className="w-full group relative overflow-hidden px-6 py-5 bg-gradient-to-r from-neon-cyan to-neon-lime text-slate-900 font-bold rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-neon-cyan/25 hover:shadow-xl hover:shadow-neon-cyan/40"
                        >
                          <div className="flex items-center justify-center gap-3">
                            {loading === 'email' ? (
                              <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span className="text-lg">Sending...</span>
                              </>
                            ) : (
                              <>
                                <span className="text-lg">Send Magic Link</span>
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                              </>
                            )}
                          </div>
                        </motion.button>
                      </form>

                      {/* Terms */}
                      <p className="mt-8 text-xs text-slate-500 text-center leading-relaxed">
                        By continuing, you agree to our{' '}
                        <a href="#" className="text-neon-cyan hover:underline">Terms of Service</a>
                        {' '}and{' '}
                        <a href="#" className="text-neon-cyan hover:underline">Privacy Policy</a>
                      </p>
                    </>
                  ) : (
                    // Email Sent Success State
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
                        <Mail className="w-10 h-10 text-slate-900" />
                      </motion.div>

                      <h3 className="text-2xl font-bold text-white font-heading mb-4">
                        Check your email!
                      </h3>

                      <p className="text-slate-400 text-base mb-3">
                        We've sent a magic link to
                      </p>
                      <p className="text-white font-semibold text-lg mb-6">
                        {email}
                      </p>

                      <p className="text-slate-500 text-sm mb-8">
                        Click the link in the email to sign in. It expires in 1 hour.
                      </p>

                      <button
                        onClick={() => {
                          setEmailSent(false);
                          setEmail('');
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
