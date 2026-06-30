'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Check, Sparkles } from 'lucide-react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

interface ProfileSetupModalProps {
  isOpen: boolean;
  user: User | null;
  onComplete: () => void;
}

export function ProfileSetupModal({ isOpen, user, onComplete }: ProfileSetupModalProps) {
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const supabase = createClient();

  if (!user) return null;

  // Generate a unique username from email or full name
  const generateUsername = (name: string): string => {
    if (!name) {
      const emailPart = user.email?.split('@')[0] || 'user';
      return `@${emailPart}${Math.floor(Math.random() * 100)}`;
    }

    const baseUsername = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

    return `@${baseUsername}`;
  };

  const handleComplete = async () => {
    if (!fullName.trim()) {
      setError('Please enter your full name');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const generatedUsername = username || generateUsername(fullName);

      // Update user metadata with full_name
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          username: generatedUsername,
        },
      });

      if (updateError) throw updateError;

      // Update or create profile in database
      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: user.id,
          email: user.email,
          full_name: fullName,
          username: generatedUsername,
          avatar_url: user.user_metadata?.avatar_url || null,
          bio: null,
          website: null,
          twitter_handle: null,
          linkedin_url: null,
          followers_count: 0,
          following_count: 0,
          pitches_count: 0,
          companies_count: 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );

      if (profileError) throw profileError;

      setCompleted(true);

      // Delay closing to show success animation
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (err) {
      console.error('Error completing profile setup:', err);
      setError(err instanceof Error ? err.message : 'Failed to save profile');
      setLoading(false);
    }
  };

  const handleSkip = () => {
    // Generate a basic username and save minimal profile
    const generatedUsername = generateUsername(fullName || user.email?.split('@')[0] || '');

    supabase.auth
      .updateUser({
        data: {
          full_name: fullName || user.email?.split('@')[0] || 'User',
          username: generatedUsername,
        },
      })
      .then(() => {
        onComplete();
      })
      .catch((err) => {
        console.error('Error skipping profile setup:', err);
        onComplete();
      });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110]"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[111] flex items-center justify-center p-4">
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

                {/* Content */}
                <div className="p-8 pt-12">
                  {!completed ? (
                    <>
                      {/* Header */}
                      <div className="text-center mb-8">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-neon-cyan to-neon-lime mb-6 shadow-lg shadow-neon-cyan/25"
                        >
                          <Sparkles className="w-9 h-9 text-slate-900" />
                        </motion.div>
                        <h2 className="text-2xl font-bold text-white font-heading mb-3">
                          Complete Your Profile
                        </h2>
                        <p className="text-slate-400 text-sm">
                          Just a couple more details and you&apos;re all set!
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

                      {/* Form */}
                      <div className="space-y-4 mb-6">
                        {/* Full Name */}
                        <div>
                          <label className="text-sm font-medium text-slate-300 mb-2 block">
                            Full Name
                          </label>
                          <input
                            type="text"
                            value={fullName}
                            onChange={(e) => {
                              setFullName(e.target.value);
                              if (error) setError(null);
                            }}
                            placeholder="John Smith"
                            className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 rounded-2xl focus:outline-none focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20 transition-all text-base"
                            disabled={loading}
                            autoFocus
                          />
                          <p className="text-xs text-slate-500 mt-1">This is how you&apos;ll appear to other founders</p>
                        </div>

                        {/* Username (Optional) - COMMENTED OUT: Username concept is risky to introduce right now */}
                        {/* <div>
                          <label className="text-sm font-medium text-slate-300 mb-2 block">
                            Username{' '}
                            <span className="text-xs text-slate-500 font-normal">(optional)</span>
                          </label>
                          <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder={generateUsername(fullName)}
                            className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-400 rounded-2xl focus:outline-none focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20 transition-all text-base"
                            disabled={loading}
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            {username
                              ? `Your unique handle: ${username}`
                              : `We'll auto-generate: ${generateUsername(fullName)}`}
                          </p>
                        </div> */}
                      </div>

                      {/* Buttons */}
                      <div className="space-y-3 mb-2">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleComplete}
                          disabled={loading || !fullName.trim()}
                          className="w-full group relative overflow-hidden px-6 py-4 bg-gradient-to-r from-neon-cyan to-neon-lime text-slate-900 font-bold rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-neon-cyan/25 hover:shadow-xl hover:shadow-neon-cyan/40"
                        >
                          <div className="flex items-center justify-center gap-2">
                            {loading ? (
                              <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Saving...</span>
                              </>
                            ) : (
                              <>
                                <span>Continue</span>
                                <Check className="w-5 h-5" />
                              </>
                            )}
                          </div>
                        </motion.button>

                        <button
                          onClick={handleSkip}
                          disabled={loading}
                          className="w-full py-3 text-slate-400 hover:text-slate-300 font-medium rounded-2xl transition-colors text-sm disabled:opacity-50"
                        >
                          Skip for now
                        </button>
                      </div>
                    </>
                  ) : (
                    // Success State
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center py-8"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                        className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-neon-cyan to-neon-lime mb-6 shadow-lg shadow-neon-cyan/25"
                      >
                        <Check className="w-10 h-10 text-slate-900" />
                      </motion.div>

                      <h3 className="text-2xl font-bold text-white font-heading mb-2">
                        Welcome, {fullName}!
                      </h3>

                      <p className="text-slate-400 text-sm">
                        You&apos;re all set. Let&apos;s start pitching! 🎬
                      </p>
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
