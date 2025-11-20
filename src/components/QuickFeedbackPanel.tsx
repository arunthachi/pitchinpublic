'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Flame, Sparkles } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FeedbackFormData } from '@/types';

interface QuickFeedbackPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedback: FeedbackFormData) => void;
}

export function QuickFeedbackPanel({ isOpen, onClose, onSubmit }: QuickFeedbackPanelProps) {
  const [feedbackType, setFeedbackType] = useState<'roast' | 'toast'>('toast');
  const [scores, setScores] = useState({
    clarity: 5,
    solution: 5,
    market: 5,
    presentation: 5,
  });
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    onSubmit({ type: feedbackType, scores, notes });
    onClose();
    // Reset
    setScores({ clarity: 5, solution: 5, market: 5, presentation: 5 });
    setNotes('');
  };

  const isRoast = feedbackType === 'roast';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[400px] bg-slate-950 border-l border-slate-800 z-[70] overflow-y-auto"
          >
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-heading font-bold text-white">
                  Quick Feedback
                </h2>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Roast/Toast Toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setFeedbackType('roast')}
                  className={`flex-1 py-3 px-4 rounded-lg font-heading font-bold text-sm transition-all ${
                    isRoast
                      ? 'bg-roast text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <Flame className="inline-block w-4 h-4 mr-2" />
                  ROAST
                </button>
                <button
                  onClick={() => setFeedbackType('toast')}
                  className={`flex-1 py-3 px-4 rounded-lg font-heading font-bold text-sm transition-all ${
                    !isRoast
                      ? 'bg-toast text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  <Sparkles className="inline-block w-4 h-4 mr-2" />
                  TOAST
                </button>
              </div>

              {/* Sliders */}
              <div className="space-y-5 p-4 rounded-lg bg-slate-900/50 border border-slate-800">
                <h3 className="font-heading font-bold text-xs text-slate-400 uppercase tracking-wider">
                  Rate 1-10
                </h3>

                {/* Clarity */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-body text-slate-300">Clarity</span>
                    <span className={`text-lg font-heading font-bold ${isRoast ? 'text-roast' : 'text-toast'}`}>
                      {scores.clarity}
                    </span>
                  </div>
                  <Slider
                    value={[scores.clarity]}
                    onValueChange={([value]) => setScores({ ...scores, clarity: value })}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>

                {/* Solution */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-body text-slate-300">Solution</span>
                    <span className={`text-lg font-heading font-bold ${isRoast ? 'text-roast' : 'text-toast'}`}>
                      {scores.solution}
                    </span>
                  </div>
                  <Slider
                    value={[scores.solution]}
                    onValueChange={([value]) => setScores({ ...scores, solution: value })}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>

                {/* Market */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-body text-slate-300">Market</span>
                    <span className={`text-lg font-heading font-bold ${isRoast ? 'text-roast' : 'text-toast'}`}>
                      {scores.market}
                    </span>
                  </div>
                  <Slider
                    value={[scores.market]}
                    onValueChange={([value]) => setScores({ ...scores, market: value })}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>

                {/* Presentation */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-body text-slate-300">Presentation</span>
                    <span className={`text-lg font-heading font-bold ${isRoast ? 'text-roast' : 'text-toast'}`}>
                      {scores.presentation}
                    </span>
                  </div>
                  <Slider
                    value={[scores.presentation]}
                    onValueChange={([value]) => setScores({ ...scores, presentation: value })}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-body text-slate-300">
                  Your {isRoast ? 'Critique' : 'Encouragement'}
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    isRoast
                      ? 'Be brutally honest. What needs work?'
                      : "What's working well? What excites you?"
                  }
                  rows={4}
                  className="resize-none"
                />
              </div>

              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                disabled={!notes.trim()}
                className={`w-full py-6 text-base font-heading font-bold ${
                  isRoast
                    ? 'bg-roast hover:bg-roast/90 text-white'
                    : 'bg-toast hover:bg-toast/90 text-white'
                }`}
              >
                {isRoast ? '🔥 Submit Roast' : '🥂 Submit Toast'}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
