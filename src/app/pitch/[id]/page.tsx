'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Eye,
  TrendingUp,
  Calendar,
  Flame,
  Sparkles,
  User,
} from 'lucide-react';
import { getLegacyPitchById } from '@/lib/data';
import { FeedbackModal } from '@/components/FeedbackModal';
import { PivotHistory } from '@/components/PivotHistory';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FeedbackFormData } from '@/types';
import { formatNumber, formatDate, calculateAverageScore } from '@/lib/utils';

export default function PitchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pitchId = params.id as string;
  const pitch = getLegacyPitchById(pitchId);
  const [localFeedback, setLocalFeedback] = useState(pitch?.feedback || []);

  if (!pitch) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-heading font-bold text-slate-100 mb-2">
            Pitch Not Found
          </h1>
          <p className="text-slate-400 mb-4 font-body">
            The pitch you're looking for doesn't exist.
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
                    const avgScore = calculateAverageScore(feedback.scores);

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
                                {avgScore}
                              </div>
                            </div>
                          </div>

                          <p className="text-slate-300 font-body leading-relaxed mb-3">
                            {feedback.notes}
                          </p>

                          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800">
                            <div className="text-center">
                              <p className="text-xs text-slate-500 font-body">
                                Clarity
                              </p>
                              <p className="text-sm font-heading font-bold text-slate-300">
                                {feedback.scores.clarity}/10
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-slate-500 font-body">
                                Solution
                              </p>
                              <p className="text-sm font-heading font-bold text-slate-300">
                                {feedback.scores.solution}/10
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-slate-500 font-body">
                                Market
                              </p>
                              <p className="text-sm font-heading font-bold text-slate-300">
                                {feedback.scores.market}/10
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-slate-500 font-body">
                                Presentation
                              </p>
                              <p className="text-sm font-heading font-bold text-slate-300">
                                {feedback.scores.presentation}/10
                              </p>
                            </div>
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
