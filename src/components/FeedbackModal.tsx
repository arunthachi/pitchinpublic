'use client';

import React, { useState } from 'react';
import { Flame, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { FeedbackFormData, FeedbackType } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';

interface FeedbackModalProps {
  pitchId: string;
  onSubmit: (feedback: FeedbackFormData) => void;
}

export function FeedbackModal({ pitchId, onSubmit }: FeedbackModalProps) {
  const [open, setOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('toast');
  const [scores, setScores] = useState({
    clarity: 5,
    solution: 5,
    market: 5,
    presentation: 5,
  });
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    const trimmedNotes = notes.trim();
    onSubmit({
      type: feedbackType,
      signal: feedbackType === 'toast' ? 'Clear' : 'Unclear audience',
      readiness: 2,
      scores,
      notes: trimmedNotes,
    });
    setOpen(false);
    // Reset form
    setFeedbackType('toast');
    setScores({ clarity: 5, solution: 5, market: 5, presentation: 5 });
    setNotes('');
  };

  const isRoast = feedbackType === 'roast';
  const accentColor = isRoast ? 'roast' : 'toast';

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="font-heading font-bold text-base">
          Leave Feedback
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] bg-slate-950 border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-2xl font-heading">
            Give Feedback
          </DialogTitle>
          <DialogDescription>
            Choose your style: honest critique or encouraging support
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Roast/Toast Toggle */}
          <div className="flex items-center justify-center gap-4 p-4 rounded-lg bg-slate-900/50 border border-slate-800">
            <motion.div
              animate={{
                scale: isRoast ? 1 : 0.9,
                opacity: isRoast ? 1 : 0.5,
              }}
              className="flex items-center gap-2"
            >
              <Flame className={`w-5 h-5 ${isRoast ? 'text-roast' : 'text-slate-600'}`} />
              <span className={`font-heading font-bold ${isRoast ? 'text-roast' : 'text-slate-600'}`}>
                ROAST
              </span>
            </motion.div>

            <Switch
              checked={!isRoast}
              onCheckedChange={(checked) => setFeedbackType(checked ? 'toast' : 'roast')}
              className="data-[state=checked]:bg-toast data-[state=unchecked]:bg-roast"
            />

            <motion.div
              animate={{
                scale: !isRoast ? 1 : 0.9,
                opacity: !isRoast ? 1 : 0.5,
              }}
              className="flex items-center gap-2"
            >
              <span className={`font-heading font-bold ${!isRoast ? 'text-toast' : 'text-slate-600'}`}>
                TOAST
              </span>
              <Sparkles className={`w-5 h-5 ${!isRoast ? 'text-toast' : 'text-slate-600'}`} />
            </motion.div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={feedbackType}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Sliders */}
              <div className="space-y-4 p-4 rounded-lg bg-slate-900/30 border border-slate-800">
                <h3 className="font-heading font-bold text-sm text-slate-300 uppercase tracking-wider">
                  Rate the Pitch (1-10)
                </h3>

                {/* Clarity */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-body text-slate-300">Clarity</label>
                    <span className={`text-lg font-bold font-heading ${isRoast ? 'text-roast' : 'text-toast'}`}>
                      {scores.clarity}
                    </span>
                  </div>
                  <Slider
                    value={[scores.clarity]}
                    onValueChange={([value]) => setScores({ ...scores, clarity: value })}
                    min={1}
                    max={10}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Solution */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-body text-slate-300">Solution</label>
                    <span className={`text-lg font-bold font-heading ${isRoast ? 'text-roast' : 'text-toast'}`}>
                      {scores.solution}
                    </span>
                  </div>
                  <Slider
                    value={[scores.solution]}
                    onValueChange={([value]) => setScores({ ...scores, solution: value })}
                    min={1}
                    max={10}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Market */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-body text-slate-300">Market</label>
                    <span className={`text-lg font-bold font-heading ${isRoast ? 'text-roast' : 'text-toast'}`}>
                      {scores.market}
                    </span>
                  </div>
                  <Slider
                    value={[scores.market]}
                    onValueChange={([value]) => setScores({ ...scores, market: value })}
                    min={1}
                    max={10}
                    step={1}
                    className="w-full"
                  />
                </div>

                {/* Presentation */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-body text-slate-300">Presentation</label>
                    <span className={`text-lg font-bold font-heading ${isRoast ? 'text-roast' : 'text-toast'}`}>
                      {scores.presentation}
                    </span>
                  </div>
                  <Slider
                    value={[scores.presentation]}
                    onValueChange={([value]) => setScores({ ...scores, presentation: value })}
                    min={1}
                    max={10}
                    step={1}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-body text-slate-300">
                  Your {isRoast ? 'critique' : 'encouragement'} <span className="text-slate-500">(optional)</span>
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
            </motion.div>
          </AnimatePresence>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className={
              isRoast
                ? 'bg-roast hover:bg-roast/90 text-white font-heading font-bold'
                : 'bg-toast hover:bg-toast/90 text-white font-heading font-bold'
            }
          >
            {isRoast ? '🔥 Submit Roast' : '🥂 Submit Toast'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
