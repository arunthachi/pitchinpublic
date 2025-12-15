'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SignInModal({ isOpen, onClose }: SignInModalProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const handleSocialSignIn = async (provider: 'google' | 'twitter') => {
    try {
      setLoading(provider);
      setError(null);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }

      // Manually handle the redirect since Supabase library sometimes fails
      if (data?.url) {
        console.log('Redirecting to OAuth URL:', data.url);
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Sign in error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign in';
      setError(errorMessage);
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

                  {/* Social Sign In - ONLY X and GOOGLE */}
                  <div className="space-y-3 mb-6">
                    {/* Google Button */}
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

                    {/* X Logo Button */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSocialSignIn('twitter')}
                      disabled={loading !== null}
                      className="w-full group relative overflow-hidden px-6 py-4 bg-black hover:bg-slate-900 text-white font-semibold rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl border border-slate-700"
                    >
                      <div className="flex items-center justify-center gap-3">
                        {loading === 'twitter' ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.514l-5.106-6.666-5.834 6.666h-3.308l7.73-8.835L.424 2.25h6.679l4.619 6.029 5.522-6.029zm-1.106 17.748h1.832L5.627 3.712H3.635z"/>
                          </svg>
                        )}
                        <span>Continue with X</span>
                      </div>
                    </motion.button>
                  </div>

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
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
