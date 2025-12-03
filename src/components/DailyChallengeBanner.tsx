'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, Zap } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface DailyChallengeBannerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Challenge {
  id: string;
  date: string;
  category: string;
  prompt: string;
  difficulty: 'easy' | 'medium' | 'hard';
  hasResponded: boolean;
  responseCount: number;
}

export function DailyChallengeBanner({ isOpen, onClose }: DailyChallengeBannerProps) {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(false);
  const [response, setResponse] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Fetch daily challenge
  useEffect(() => {
    const fetchChallenge = async () => {
      try {
        const res = await fetch('/api/daily-challenge');
        if (res.ok) {
          const data = await res.json();
          setChallenge(data.challenge);
          setSubmitted(data.challenge.hasResponded);
        }
      } catch (error) {
        console.error('Error fetching challenge:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen) {
      fetchChallenge();
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!challenge || !response.trim()) return;

    setResponding(true);
    try {
      const res = await fetch('/api/daily-challenge/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: challenge.id,
          response: response.trim(),
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        setResponse('');
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (error) {
      console.error('Error submitting challenge response:', error);
    } finally {
      setResponding(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'hard':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  if (loading) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && challenge && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[50]"
          />

          {/* Banner */}
          <motion.div
            initial={{ y: '-100%' }}
            animate={{ y: 0 }}
            exit={{ y: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 left-0 right-0 z-[60] p-4 sm:p-6"
          >
            <div className="max-w-2xl mx-auto bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="bg-gradient-to-r from-neon-cyan/20 to-neon-lime/20 border-b border-slate-700 p-4 sm:p-6 flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-5 h-5 text-neon-cyan" />
                    <h3 className="text-lg sm:text-xl font-bold text-white">
                      Today's Challenge
                    </h3>
                    <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${getDifficultyColor(challenge.difficulty)}`}>
                      {challenge.difficulty.toUpperCase()}
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm">{challenge.category}</p>
                </div>

                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 sm:p-6 space-y-4">
                {!submitted ? (
                  <>
                    <div>
                      <p className="text-white text-base sm:text-lg font-semibold mb-4">
                        {challenge.prompt}
                      </p>
                      <p className="text-slate-400 text-sm mb-4">
                        {challenge.responseCount} {challenge.responseCount === 1 ? 'person' : 'people'} have responded
                      </p>

                      <Textarea
                        value={response}
                        onChange={(e) => setResponse(e.target.value)}
                        placeholder="Share your answer... (max 2000 characters)"
                        className="min-h-[120px] bg-slate-800 border-slate-600 text-white placeholder-slate-500"
                        maxLength={2000}
                      />

                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-slate-400">
                          {response.length}/2000
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={onClose}
                        disabled={responding}
                        className="flex-1 px-4 py-3 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
                      >
                        Skip
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={!response.trim() || responding}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-neon-cyan to-neon-lime text-slate-900 font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {responding ? 'Submitting...' : 'Submit Answer'}
                      </button>
                    </div>
                  </>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-8"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                      className="flex justify-center mb-4"
                    >
                      <CheckCircle className="w-12 h-12 text-green-400" />
                    </motion.div>
                    <h4 className="text-xl font-bold text-white mb-2">
                      Great Job! 🎉
                    </h4>
                    <p className="text-slate-400">
                      Your response has been submitted. Check back tomorrow for a new challenge!
                    </p>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
