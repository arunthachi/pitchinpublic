'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Eye,
  TrendingUp,
  Calendar,
  Flame,
  Sparkles,
  Target,
  User,
} from 'lucide-react';
import { getLegacyPitchById } from '@/lib/data';
import { FeedbackModal } from '@/components/FeedbackModal';
import { PivotHistory } from '@/components/PivotHistory';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FeedbackFormData, LegacyPitch } from '@/types';
import { formatNumber, formatDate } from '@/lib/utils';
import { isUuidLike } from '@/lib/public-routes';
import { getPitchFeedbackAskFromFields, getPitchStartupNameFromFields } from '@/lib/pitch-copy';

function readinessLabel(value?: number) {
  if (!value) return 'Getting there';
  if (value >= 4) return 'Pitch-ready';
  if (value >= 3) return 'Strong';
  if (value >= 2) return 'Getting there';
  return 'Needs work';
}

function readinessFromScores(scores: FeedbackFormData['scores']) {
  const average = (scores.clarity + scores.solution + scores.market + scores.presentation) / 4;
  return Math.max(1, Math.min(4, Math.round(average / 2.5)));
}

function parseFeedback(rawFeedback: any[] | undefined) {
  return (rawFeedback || []).map((item) => {
    let parsedContent: any = {};
    try {
      parsedContent = item.content ? JSON.parse(item.content) : {};
    } catch {
      parsedContent = { notes: item.content || '' };
    }

    return {
      id: item.id,
      authorName: 'Builder',
      authorRole: 'Founder',
      type: item.type,
      signal: parsedContent.signal,
      signals: parsedContent.signals || (parsedContent.signal ? [parsedContent.signal] : undefined),
      readiness: parsedContent.readiness,
      scores: parsedContent.scores || {
        clarity: 5,
        solution: 5,
        market: 5,
        presentation: 5,
      },
      notes: parsedContent.notes || '',
      createdAt: item.created_at,
    };
  });
}

function convertApiPitchToLegacy(pitch: any): LegacyPitch {
  const profile = pitch.profiles || {};
  return {
    id: pitch.id,
    publicId: pitch.public_id || null,
    userId: pitch.user_id,
    founderHandle: profile.public_handle || profile.username || null,
    founderName: profile.full_name || 'Founder',
    founderAvatar: profile.avatar_url || 'https://api.dicebear.com/7.x/initials/svg?seed=PiP',
    companyName: getPitchStartupNameFromFields(pitch, 'Practice pitch'),
    hook: pitch.hook,
    description: pitch.description || getPitchFeedbackAskFromFields(pitch),
    feedbackAsk: getPitchFeedbackAskFromFields(pitch),
    videoUrl: pitch.video_url,
    thumbnailUrl: pitch.thumbnail_url || '',
    industry: 'SaaS',
    stage: 'Pre-Seed',
    views: pitch.views_count || 0,
    interestScore: pitch.interest_score || 0,
    roastCount: pitch.roast_count || 0,
    toastCount: pitch.toast_count || 0,
    createdAt: pitch.created_at,
    duration: pitch.duration || undefined,
    versionNumber: pitch.take_version || pitch.version_number,
    practiceGoalId: pitch.practice_goal_id || null,
    promptKey: pitch.prompt_key || null,
    promptText: pitch.prompt_text || null,
    isBestTake: Boolean(pitch.is_best_take),
    feedback: parseFeedback(pitch.feedback),
  };
}

export default function PitchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pitchId = params.id as string;
  const mockPitch = getLegacyPitchById(pitchId);
  const [remotePitch, setRemotePitch] = useState<LegacyPitch | null>(null);
  const [loadingPitch, setLoadingPitch] = useState(!mockPitch);
  const pitch = mockPitch || remotePitch;
  const [localFeedback, setLocalFeedback] = useState(mockPitch?.feedback || []);

  useEffect(() => {
    if (mockPitch) return;

    const loadPitch = async () => {
      try {
        setLoadingPitch(true);
        const queryKey = isUuidLike(pitchId) ? 'pitchId' : 'publicId';
        const response = await fetch(`/api/pitches?${queryKey}=${encodeURIComponent(pitchId)}&limit=1`);
        if (!response.ok) return;
        const data = await response.json();
        const apiPitch = data.pitches?.[0];
        if (!apiPitch) return;
        if (isUuidLike(pitchId) && apiPitch.public_id) {
          router.replace(`/pitch/${encodeURIComponent(apiPitch.public_id)}`);
          return;
        }
        const converted = convertApiPitchToLegacy(apiPitch);
        setRemotePitch(converted);
        setLocalFeedback(converted.feedback || []);
      } finally {
        setLoadingPitch(false);
      }
    };

    loadPitch();
  }, [mockPitch, pitchId, router]);

  if (loadingPitch) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neon-cyan border-t-transparent" />
      </div>
    );
  }

  if (!pitch) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-heading font-bold text-slate-100 mb-2">
            Pitch Not Found
          </h1>
          <p className="text-slate-400 mb-4 font-body">
            The pitch you&apos;re looking for doesn&apos;t exist.
          </p>
          <Button onClick={() => router.push('/')}>Back to Stage</Button>
        </div>
      </div>
    );
  }

  const handleFeedbackSubmit = (feedbackData: FeedbackFormData) => {
    const newFeedback = {
      id: `f${Date.now()}`,
      authorName: 'You',
      authorRole: 'Founder',
      type: feedbackData.type,
      signal: feedbackData.signal,
      signals: feedbackData.signals,
      readiness: feedbackData.readiness,
      scores: feedbackData.scores,
      notes: feedbackData.notes,
      createdAt: new Date().toISOString(),
    };
    setLocalFeedback([...localFeedback, newFeedback]);
  };

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-slate-800">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            onClick={() => router.push('/')}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Stage
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Desktop: Split Layout, Mobile: Stacked */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* LEFT COLUMN: Video & Pitch Info */}
          <div className="space-y-6">
            {/* Video Player */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative aspect-video rounded-lg overflow-hidden bg-slate-900 border border-slate-800"
            >
              <img
                src={pitch.thumbnailUrl}
                alt={pitch.companyName}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <button className="w-20 h-20 rounded-full bg-neon-cyan/90 flex items-center justify-center hover:scale-110 transition-transform">
                  <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[20px] border-l-slate-900 border-b-[12px] border-b-transparent ml-1" />
                </button>
              </div>

              {/* Stats overlay */}
              <div className="absolute top-4 right-4 flex gap-2">
                <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-sm px-3 py-1.5 rounded-md">
                  <Eye className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium text-slate-200">
                    {formatNumber(pitch.views)}
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-neon-cyan/20 backdrop-blur-sm px-3 py-1.5 rounded-md border border-neon-cyan/30">
                  <TrendingUp className="w-4 h-4 text-neon-cyan" />
                  <span className="text-sm font-bold text-neon-cyan">
                    {pitch.interestScore}
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Pitch Details */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h1 className="text-3xl font-heading font-bold text-slate-100 mb-2">
                      {pitch.companyName}
                    </h1>
                    <p className="text-lg text-slate-300 font-medium mb-4 leading-relaxed">
                      {pitch.hook}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{pitch.stage}</Badge>
                  <Badge variant="outline">{pitch.industry}</Badge>
                  <Badge variant="lime" className="gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(pitch.createdAt)}
                  </Badge>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <div className="flex items-center gap-3 mb-4">
                    <img
                      src={pitch.founderAvatar}
                      alt={pitch.founderName}
                      className="w-12 h-12 rounded-full border-2 border-slate-700"
                    />
                    <div>
                      <p className="font-heading font-bold text-slate-100">
                        {pitch.founderName}
                      </p>
                      <p className="text-sm text-slate-400 font-body">Founder</p>
                    </div>
                  </div>

                  <p className="text-slate-300 font-body leading-relaxed">
                    {pitch.description}
                  </p>
                </div>
              </Card>
            </motion.div>

            {/* Pivot History - Desktop: Show here, Mobile: Show after feedback */}
            {pitch.versions && pitch.versions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="hidden lg:block"
              >
                <Card className="p-6">
                  <PivotHistory versions={pitch.versions} />
                </Card>
              </motion.div>
            )}
          </div>

          {/* RIGHT COLUMN: Feedback */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="sticky top-24"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-heading font-bold text-slate-100">
                  Feedback
                </h2>
                <FeedbackModal
                  pitchId={pitch.id}
                  onSubmit={handleFeedbackSubmit}
                />
              </div>

              {/* Feedback List */}
              <div className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
                {localFeedback.length === 0 ? (
                  <Card className="p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-8 h-8 text-slate-600" />
                    </div>
                    <h3 className="font-heading font-bold text-lg text-slate-100 mb-2">
                      No feedback yet
                    </h3>
                    <p className="text-slate-400 font-body mb-4">
                      Be the first to give feedback on this pitch!
                    </p>
                    <FeedbackModal
                      pitchId={pitch.id}
                      onSubmit={handleFeedbackSubmit}
                    />
                  </Card>
                ) : (
                  localFeedback.map((feedback) => {
                    const isRoast = feedback.type === 'roast';
                    const readiness = feedback.readiness || readinessFromScores(feedback.scores);

                    return (
                      <motion.div
                        key={feedback.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                      >
                        <Card
                          className={`p-4 border-2 ${
                            isRoast
                              ? 'border-roast/30 bg-roast/5'
                              : 'border-toast/30 bg-toast/5'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                                <User className="w-5 h-5 text-slate-400" />
                              </div>
                              <div>
                                <p className="font-heading font-bold text-slate-100">
                                  {feedback.authorName}
                                </p>
                                <p className="text-xs text-slate-400 font-body">
                                  {feedback.authorRole}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <div
                                className={`flex items-center gap-1 px-2 py-1 rounded-md ${
                                  isRoast
                                    ? 'bg-roast/20 text-roast'
                                    : 'bg-toast/20 text-toast'
                                }`}
                              >
                                {isRoast ? (
                                  <Flame className="w-4 h-4" />
                                ) : (
                                  <Sparkles className="w-4 h-4" />
                                )}
                                <span className="text-xs font-heading font-bold">
                                  {isRoast ? 'ROAST' : 'TOAST'}
                                </span>
                              </div>
                              <div
                                className={`text-lg font-heading font-bold ${
                                  isRoast ? 'text-roast' : 'text-toast'
                                }`}
                              >
                                {readiness}/4
                              </div>
                            </div>
                          </div>

                          <div className="mb-3 flex flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-slate-200">
                              <Target className="h-3.5 w-3.5 text-neon-cyan" />
                              {(feedback.signals?.length ? feedback.signals.join(' + ') : feedback.signal) || (isRoast ? 'Sharpen the ask' : 'Clear signal')}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-bold text-slate-300">
                              {readinessLabel(readiness)}
                            </span>
                          </div>

                          <p className="text-slate-300 font-body leading-relaxed mb-3">
                            {feedback.notes || 'No extra note added.'}
                          </p>

                          <div className="grid grid-cols-4 gap-1.5 pt-3 border-t border-slate-800">
                            {[1, 2, 3, 4].map((step) => (
                              <div
                                key={step}
                                className={`h-2 rounded-full ${
                                  step <= readiness
                                    ? isRoast
                                      ? 'bg-roast'
                                      : 'bg-toast'
                                    : 'bg-white/10'
                                }`}
                              />
                            ))}
                          </div>
                        </Card>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Pivot History - Mobile: Show at bottom */}
        {pitch.versions && pitch.versions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:hidden mt-8"
          >
            <Card className="p-6">
              <PivotHistory versions={pitch.versions} />
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
