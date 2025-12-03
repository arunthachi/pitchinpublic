'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface Step2_AddDetailsProps {
  videoDuration: number;
  previewUrl: string;
  onNext: (data: { hook: string; description: string }) => void;
  onBack: () => void;
  isLoading?: boolean;
}

export function Step2_AddDetails({
  videoDuration,
  previewUrl,
  onNext,
  onBack,
  isLoading = false,
}: Step2_AddDetailsProps) {
  const [hook, setHook] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if form is valid
  const isValid = hook.trim().length >= 10 && hook.trim().length <= 280;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    const newErrors: Record<string, string> = {};

    if (!hook.trim()) {
      newErrors.hook = 'Pitch title is required';
    } else if (hook.trim().length < 10) {
      newErrors.hook = 'Pitch title must be at least 10 characters';
    } else if (hook.trim().length > 280) {
      newErrors.hook = 'Pitch title must be at most 280 characters';
    }

    if (description.length > 2000) {
      newErrors.description = 'Description must be at most 2000 characters';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      onNext({
        hook: hook.trim(),
        description: description.trim(),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Add Details</h2>
        <p className="text-slate-400 text-sm">Tell us about your pitch</p>
      </div>

      {/* Video Preview */}
      <div className="relative aspect-[9/16] max-h-[40vh] mx-auto bg-black rounded-xl overflow-hidden mb-4">
        <video
          src={previewUrl}
          controls
          className="w-full h-full object-contain"
        />
        <div className="absolute top-3 left-3 px-2 py-1 bg-black/70 rounded-full">
          <span className="text-xs text-white font-medium">{videoDuration}s</span>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Hook/Title Input */}
        <div>
          <label htmlFor="hook" className="block text-sm font-semibold text-white mb-2">
            Pitch Title <span className="text-red-400">*</span>
          </label>
          <textarea
            id="hook"
            value={hook}
            onChange={(e) => {
              setHook(e.target.value);
              if (errors.hook) {
                setErrors({ ...errors, hook: '' });
              }
            }}
            placeholder="Summarize your pitch in one compelling sentence..."
            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-neon-cyan focus:border-transparent resize-none"
            rows={3}
            maxLength={280}
          />
          <div className="flex justify-between mt-1">
            <span className={`text-xs ${errors.hook ? 'text-red-400' : 'text-slate-400'}`}>
              {errors.hook || `${hook.length}/280`}
            </span>
            {!errors.hook && hook.length >= 10 && (
              <span className="text-xs text-green-400">✓ Great!</span>
            )}
          </div>
        </div>

        {/* Description Input */}
        <div>
          <label htmlFor="description" className="block text-sm font-semibold text-white mb-2">
            Description <span className="text-slate-400 text-xs">(optional)</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (errors.description) {
                setErrors({ ...errors, description: '' });
              }
            }}
            placeholder="Add more details about your company, product, or ask..."
            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-neon-cyan focus:border-transparent resize-none"
            rows={4}
            maxLength={2000}
          />
          <div className="flex justify-between mt-1">
            <span className={`text-xs ${errors.description ? 'text-red-400' : 'text-slate-400'}`}>
              {errors.description || `${description.length}/2000`}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting || isLoading}
            className="flex-1 py-3 border border-slate-600 text-slate-300 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <button
            type="submit"
            disabled={!isValid || isSubmitting || isLoading}
            className="flex-1 py-3 bg-gradient-to-r from-neon-cyan to-neon-lime text-slate-900 font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting || isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Preparing...
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </motion.div>
  );
}
