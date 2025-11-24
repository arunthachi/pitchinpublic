'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Check, Edit3 } from 'lucide-react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

interface ProfileEditModalProps {
  isOpen: boolean;
  user: User | null;
  currentBio?: string;
  currentWebsite?: string;
  currentTwitter?: string;
  currentLinkedin?: string;
  onComplete: () => void;
}

export function ProfileEditModal({
  isOpen,
  user,
  currentBio,
  currentWebsite,
  currentTwitter,
  currentLinkedin,
  onComplete,
}: ProfileEditModalProps) {
  const [bio, setBio] = useState(currentBio || '');
  const [website, setWebsite] = useState(currentWebsite || '');
  const [twitter, setTwitter] = useState(currentTwitter || '');
  const [linkedin, setLinkedin] = useState(currentLinkedin || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const supabase = createClient();

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setBio(currentBio || '');
      setWebsite(currentWebsite || '');
      setTwitter(currentTwitter || '');
      setLinkedin(currentLinkedin || '');
      setError(null);
      setCompleted(false);
    }
  }, [isOpen, currentBio, currentWebsite, currentTwitter, currentLinkedin]);

  if (!user) return null;

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      // Update user metadata with new profile info
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          bio: bio || null,
          website: website || null,
          twitter_handle: twitter || null,
          linkedin_url: linkedin || null,
        },
      });

      if (updateError) throw updateError;

      // Update profile in database
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          bio: bio || null,
          website: website || null,
          twitter_handle: twitter || null,
          linkedin_url: linkedin || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profileError) throw profileError;

      setCompleted(true);

      // Delay closing to show success animation
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (err) {
      console.error('Error saving profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to save profile');
      setLoading(false);
    }
  };

  const hasChanges =
    bio !== (currentBio || '') ||
    website !== (currentWebsite || '') ||
    twitter !== (currentTwitter || '') ||
    linkedin !== (currentLinkedin || '');

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onComplete}
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
                          <Edit3 className="w-9 h-9 text-slate-900" />
                        </motion.div>
                        <h2 className="text-2xl font-bold text-white font-heading mb-3">
                          Edit Profile
                        </h2>
                        <p className="text-slate-400 text-sm">
                          Update your profile information
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
                        {/* Bio */}
                        <div>
                          <label className="text-sm font-medium text-slate-300 mb-2 block">
                            Bio
                          </label>
                          <textarea
                            value={bio}
                            onChange={(e) => {
                              setBio(e.target.value);
                              if (error) setError(null);
                            }}
                            placeholder="Tell us about yourself"
                            maxLength={160}
                            rows={3}
                            className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 rounded-2xl focus:outline-none focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20 transition-all text-base resize-none"
                            disabled={loading}
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            {bio.length}/160 characters
                          </p>
                        </div>

                        {/* Website */}
                        <div>
                          <label className="text-sm font-medium text-slate-300 mb-2 block">
                            Website{' '}
                            <span className="text-xs text-slate-500 font-normal">(optional)</span>
                          </label>
                          <input
                            type="url"
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                            placeholder="https://example.com"
                            className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 rounded-2xl focus:outline-none focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20 transition-all text-base"
                            disabled={loading}
                          />
                        </div>

                        {/* Twitter */}
                        <div>
                          <label className="text-sm font-medium text-slate-300 mb-2 block">
                            Twitter Handle{' '}
                            <span className="text-xs text-slate-500 font-normal">(optional)</span>
                          </label>
                          <input
                            type="text"
                            value={twitter}
                            onChange={(e) => setTwitter(e.target.value)}
                            placeholder="@username"
                            className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 rounded-2xl focus:outline-none focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20 transition-all text-base"
                            disabled={loading}
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            {twitter ? `Handle: ${twitter}` : 'Enter without the @ symbol'}
                          </p>
                        </div>

                        {/* LinkedIn */}
                        <div>
                          <label className="text-sm font-medium text-slate-300 mb-2 block">
                            LinkedIn URL{' '}
                            <span className="text-xs text-slate-500 font-normal">(optional)</span>
                          </label>
                          <input
                            type="url"
                            value={linkedin}
                            onChange={(e) => setLinkedin(e.target.value)}
                            placeholder="https://linkedin.com/in/username"
                            className="w-full px-6 py-4 bg-slate-800/50 border border-slate-700 text-white placeholder:text-slate-500 rounded-2xl focus:outline-none focus:border-neon-cyan focus:ring-2 focus:ring-neon-cyan/20 transition-all text-base"
                            disabled={loading}
                          />
                        </div>
                      </div>

                      {/* Buttons */}
                      <div className="space-y-3 mb-2">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleSave}
                          disabled={loading || !hasChanges}
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
                                <span>Save Changes</span>
                                <Check className="w-5 h-5" />
                              </>
                            )}
                          </div>
                        </motion.button>

                        <button
                          onClick={onComplete}
                          disabled={loading}
                          className="w-full py-3 text-slate-400 hover:text-slate-300 font-medium rounded-2xl transition-colors text-sm disabled:opacity-50"
                        >
                          Cancel
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
                        Profile Updated!
                      </h3>

                      <p className="text-slate-400 text-sm">
                        Your profile changes have been saved.
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
