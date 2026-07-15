'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Check, Edit3, Building2 } from 'lucide-react';
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

interface StartupSnapshot {
  id: string;
  name: string;
  tagline: string;
  website: string;
  stage: string;
}

const LAST_PITCH_DETAILS_KEY = 'pitchinpublic:last-pitch-details';
const startupStageOptions = [
  'Idea',
  'Prototype',
  'MVP',
  'Launched',
  'Revenue',
  'Scaling',
];

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
  const [startupId, setStartupId] = useState<string | null>(null);
  const [startupName, setStartupName] = useState('');
  const [startupPitch, setStartupPitch] = useState('');
  const [startupWebsite, setStartupWebsite] = useState('');
  const [startupStage, setStartupStage] = useState('Idea');
  const [initialStartup, setInitialStartup] = useState<StartupSnapshot | null>(null);
  const [startupLoading, setStartupLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setBio(currentBio || '');
      setWebsite(currentWebsite || '');
      setTwitter(currentTwitter || '');
      setLinkedin(currentLinkedin || '');
      setStartupId(null);
      setStartupName('');
      setStartupPitch('');
      setStartupWebsite('');
      setStartupStage('Idea');
      setInitialStartup(null);
      setError(null);
      setCompleted(false);
    }
  }, [isOpen, currentBio, currentWebsite, currentTwitter, currentLinkedin]);

  useEffect(() => {
    if (!isOpen || !user) return;

    let cancelled = false;

    const fetchStartup = async () => {
      setStartupLoading(true);
      try {
        const { data, error: startupError } = await supabase
          .from('companies')
          .select('id, name, tagline, website, stage')
          .eq('founder_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: true })
          .limit(1);

        if (startupError) throw startupError;
        if (cancelled) return;

        const startup = data?.[0];
        if (!startup) return;

        const snapshot = {
          id: startup.id,
          name: startup.name || '',
          tagline: startup.tagline || '',
          website: startup.website || '',
          stage: startup.stage || 'Idea',
        };

        setStartupId(snapshot.id);
        setStartupName(snapshot.name);
        setStartupPitch(snapshot.tagline);
        setStartupWebsite(snapshot.website);
        setStartupStage(snapshot.stage);
        setInitialStartup(snapshot);
      } catch (err) {
        console.error('Error loading startup profile:', err);
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load startup profile');
      } finally {
        if (!cancelled) setStartupLoading(false);
      }
    };

    fetchStartup();

    return () => {
      cancelled = true;
    };
  }, [isOpen, user, supabase]);

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

      const cleanStartupName = startupName.trim();
      const cleanStartupPitch = startupPitch.trim();
      const cleanStartupWebsite = startupWebsite.trim();
      const shouldSaveStartup = cleanStartupName || cleanStartupPitch || cleanStartupWebsite;

      if (shouldSaveStartup) {
        if (!cleanStartupName) {
          throw new Error('Startup name is required when saving startup details');
        }
        if (!cleanStartupPitch || cleanStartupPitch.length < 10) {
          throw new Error('One-line pitch must be at least 10 characters');
        }

        const startupPayload = {
          founder_id: user.id,
          name: cleanStartupName,
          tagline: cleanStartupPitch,
          description: cleanStartupPitch,
          website: cleanStartupWebsite || null,
          industry: 'General',
          stage: startupStage,
          status: 'active',
          updated_at: new Date().toISOString(),
        };

        const startupResult = startupId
          ? await supabase
              .from('companies')
              .update(startupPayload)
              .eq('id', startupId)
              .eq('founder_id', user.id)
              .select('id')
              .single()
          : await supabase
              .from('companies')
              .insert({
                ...startupPayload,
                created_at: new Date().toISOString(),
              })
              .select('id')
              .single();

        if (startupResult.error) throw startupResult.error;
        if (startupResult.data?.id) setStartupId(startupResult.data.id);

        window.localStorage.setItem(
          LAST_PITCH_DETAILS_KEY,
          JSON.stringify({
            hook: cleanStartupPitch,
            description: [
              `Startup: ${cleanStartupName}`,
              'Feedback ask: Focus: Clarity, ICP, Closing ask',
            ].join('\n'),
            startupName: cleanStartupName,
            oneLinePitch: cleanStartupPitch,
            feedbackAsk: 'Focus: Clarity, ICP, Closing ask',
          })
        );
      }

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
    linkedin !== (currentLinkedin || '') ||
    startupName !== (initialStartup?.name || '') ||
    startupPitch !== (initialStartup?.tagline || '') ||
    startupWebsite !== (initialStartup?.website || '') ||
    startupStage !== (initialStartup?.stage || 'Idea');

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
          <div className="fixed inset-0 z-[111] flex items-start justify-center overflow-y-auto overscroll-contain px-3 py-4 sm:px-6 sm:py-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative my-auto w-full max-w-2xl"
            >
              {/* Glass morphism card */}
              <div className="relative max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain rounded-3xl border border-slate-700/50 bg-gradient-to-br from-slate-900/95 to-slate-950/95 shadow-2xl backdrop-blur-xl [scrollbar-width:thin] sm:max-h-[calc(100dvh-3rem)]">
                {/* Gradient accent */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-neon-cyan via-neon-lime to-neon-cyan" />

                {/* Content */}
                <div className="p-5 pt-8 sm:p-7 sm:pt-10">
                  {!completed ? (
                    <>
                      {/* Header */}
                      <div className="text-center mb-6">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                          className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-cyan to-neon-lime shadow-lg shadow-neon-cyan/25 sm:h-14 sm:w-14"
                        >
                          <Edit3 className="h-7 w-7 text-slate-900 sm:h-8 sm:w-8" />
                        </motion.div>
                        <h2 className="mt-4 font-heading text-2xl font-bold text-white sm:text-3xl">
                          Edit Profile
                        </h2>
                        <p className="mt-2 text-sm text-slate-400">
                          Update founder details and your primary startup
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
                      <div className="space-y-4 mb-5">
                        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
                          <div className="mb-4 flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-neon-cyan/15 text-neon-cyan">
                              <Building2 className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="font-heading text-lg font-black text-white">Primary startup</h3>
                              <p className="text-sm leading-5 text-slate-500">MVP supports one startup. This pre-fills every pitch upload.</p>
                            </div>
                          </div>

                          {startupLoading ? (
                            <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-slate-800/40 p-5 text-slate-400">
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Loading startup...
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div>
                                <label className="mb-2 block text-sm font-medium text-slate-300">
                                  Startup name
                                </label>
                                <input
                                  type="text"
                                  value={startupName}
                                  onChange={(e) => {
                                    setStartupName(e.target.value);
                                    if (error) setError(null);
                                  }}
                                  placeholder="ReachCopilot"
                                  maxLength={120}
                                  className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3.5 text-base text-white placeholder:text-slate-500 transition-all focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/20 sm:px-5 sm:py-4"
                                  disabled={loading}
                                />
                              </div>

                              <div>
                                <label className="mb-2 block text-sm font-medium text-slate-300">
                                  One-line pitch
                                </label>
                                <textarea
                                  value={startupPitch}
                                  onChange={(e) => {
                                    setStartupPitch(e.target.value);
                                    if (error) setError(null);
                                  }}
                                  placeholder="Write the version you want founders to react to."
                                  maxLength={280}
                                  rows={3}
                                  className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3.5 text-base text-white placeholder:text-slate-500 transition-all focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/20 sm:px-5 sm:py-4"
                                  disabled={loading}
                                />
                                <p className="mt-2 text-xs leading-5 text-slate-400">
                                  Template: For [customer], we help [painful problem] so they can [outcome].
                                </p>
                                <p className="mt-1 text-xs text-slate-500">{startupPitch.length}/280 characters</p>
                              </div>

                              <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                  <label className="mb-2 block text-sm font-medium text-slate-300">
                                    Startup website <span className="text-xs font-normal text-slate-500">(optional)</span>
                                  </label>
                                  <input
                                    type="url"
                                    value={startupWebsite}
                                    onChange={(e) => setStartupWebsite(e.target.value)}
                                    placeholder="https://company.com"
                                    className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3.5 text-base text-white placeholder:text-slate-500 transition-all focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/20 sm:px-5 sm:py-4"
                                    disabled={loading}
                                  />
                                </div>

                                <div>
                                  <label className="mb-2 block text-sm font-medium text-slate-300">
                                    Stage
                                  </label>
                                  <select
                                    value={startupStage}
                                    onChange={(e) => setStartupStage(e.target.value)}
                                    className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3.5 text-base text-white transition-all focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/20 sm:px-5 sm:py-4"
                                    disabled={loading}
                                  >
                                    {startupStageOptions.map((stage) => (
                                      <option key={stage} value={stage}>
                                        {stage}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>
                          )}
                        </section>

                        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                          <div className="mb-4">
                            <h3 className="font-heading text-lg font-black text-white">Founder profile</h3>
                            <p className="text-sm text-slate-500">About you, not the startup.</p>
                          </div>

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
                            className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3.5 text-base text-white placeholder:text-slate-500 transition-all focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/20 sm:px-5 sm:py-4"
                            disabled={loading}
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            {bio.length}/160 characters
                          </p>
                        </div>

                        {/* Website */}
                        <div>
                          <label className="text-sm font-medium text-slate-300 mb-2 block">
                            Personal website{' '}
                            <span className="text-xs text-slate-500 font-normal">(optional)</span>
                          </label>
                          <input
                            type="url"
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                            placeholder="https://example.com"
                            className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3.5 text-base text-white placeholder:text-slate-500 transition-all focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/20 sm:px-5 sm:py-4"
                            disabled={loading}
                          />
                        </div>

                        {/* Twitter */}
                        <div>
                          <label className="text-sm font-medium text-slate-300 mb-2 block">
                            X / Twitter Handle{' '}
                            <span className="text-xs text-slate-500 font-normal">(optional)</span>
                          </label>
                          <input
                            type="text"
                            value={twitter}
                            onChange={(e) => setTwitter(e.target.value)}
                            placeholder="@username"
                            className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3.5 text-base text-white placeholder:text-slate-500 transition-all focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/20 sm:px-5 sm:py-4"
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
                            className="w-full rounded-2xl border border-slate-700 bg-slate-800/50 px-4 py-3.5 text-base text-white placeholder:text-slate-500 transition-all focus:border-neon-cyan focus:outline-none focus:ring-2 focus:ring-neon-cyan/20 sm:px-5 sm:py-4"
                            disabled={loading}
                          />
                        </div>
                        </section>
                      </div>

                      {/* Buttons */}
                      <div className="space-y-3 mb-2">
                        <Link
                          href="/notifications/preferences"
                          className="block w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm font-medium text-slate-200 transition hover:border-neon-cyan/40 hover:bg-white/[0.07] hover:text-white"
                        >
                          Manage email nudges
                        </Link>

                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={handleSave}
                          disabled={loading || !hasChanges}
                          className="w-full group relative overflow-hidden rounded-2xl bg-gradient-to-r from-neon-cyan to-neon-lime px-6 py-3.5 font-bold text-slate-900 shadow-lg shadow-neon-cyan/25 transition-all hover:shadow-xl hover:shadow-neon-cyan/40 disabled:cursor-not-allowed disabled:opacity-50 sm:py-4"
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
