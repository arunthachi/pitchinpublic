'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Video, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

interface RecordingStudioProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RecordingStudio({ isOpen, onClose }: RecordingStudioProps) {
  const [step, setStep] = useState<'upload' | 'details'>('upload');
  const [hook, setHook] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setStep('details');
    }
  };

  const handleSubmit = () => {
    console.log('Submitting pitch:', { hook, file: selectedFile });
    // In production, this would upload to backend
    onClose();
    setStep('upload');
    setHook('');
    setSelectedFile(null);
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
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[80]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[500px] sm:max-h-[80vh] bg-slate-950 border border-slate-800 rounded-2xl z-[90] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-neon-cyan to-neon-lime flex items-center justify-center">
                  <Video className="w-5 h-5 text-slate-900" />
                </div>
                <div>
                  <h2 className="text-xl font-heading font-bold text-white">
                    Post Your Pitch
                  </h2>
                  <p className="text-xs text-slate-400 font-body">
                    60 seconds to shine
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {step === 'upload' ? (
                <div className="space-y-6">
                  {/* Upload Area */}
                  <label className="block">
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <div className="border-2 border-dashed border-slate-700 rounded-xl p-12 hover:border-neon-cyan transition-colors cursor-pointer group">
                      <div className="text-center space-y-4">
                        <div className="w-16 h-16 mx-auto rounded-full bg-slate-800 group-hover:bg-neon-cyan/10 flex items-center justify-center transition-colors">
                          <Upload className="w-8 h-8 text-slate-400 group-hover:text-neon-cyan transition-colors" />
                        </div>
                        <div>
                          <p className="font-heading font-bold text-white mb-1">
                            Upload your pitch video
                          </p>
                          <p className="text-sm text-slate-400 font-body">
                            MP4, MOV, or WEBM (max 60s)
                          </p>
                        </div>
                      </div>
                    </div>
                  </label>

                  {/* Tips */}
                  <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 space-y-2">
                    <h3 className="font-heading font-bold text-sm text-neon-cyan flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Pro Tips
                    </h3>
                    <ul className="text-sm text-slate-300 font-body space-y-1">
                      <li>• Keep it under 60 seconds</li>
                      <li>• Start with your hook (first 5 seconds!)</li>
                      <li>• Good lighting and audio matter</li>
                      <li>• Show enthusiasm!</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Video Preview */}
                  {selectedFile && (
                    <div className="relative aspect-video bg-slate-900 rounded-lg overflow-hidden">
                      <video
                        src={URL.createObjectURL(selectedFile)}
                        controls
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Hook Input */}
                  <div className="space-y-2">
                    <label className="text-sm font-body text-slate-300 flex items-center justify-between">
                      <span>Your Hook</span>
                      <span className="text-xs text-slate-500">
                        {hook.length}/120
                      </span>
                    </label>
                    <Textarea
                      value={hook}
                      onChange={(e) => setHook(e.target.value.slice(0, 120))}
                      placeholder="One sentence that makes investors lean in..."
                      rows={3}
                      className="resize-none"
                    />
                  </div>

                  {/* Quick Tags */}
                  <div className="space-y-2">
                    <label className="text-sm font-body text-slate-300">
                      Quick Add
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="cursor-pointer hover:bg-slate-800">
                        Pre-Seed
                      </Badge>
                      <Badge variant="outline" className="cursor-pointer hover:bg-slate-800">
                        SaaS
                      </Badge>
                      <Badge variant="outline" className="cursor-pointer hover:bg-slate-800">
                        AI/ML
                      </Badge>
                      <Badge variant="outline" className="cursor-pointer hover:bg-slate-800">
                        B2B
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {step === 'details' && (
              <div className="p-6 border-t border-slate-800">
                <Button
                  onClick={handleSubmit}
                  disabled={!hook.trim()}
                  className="w-full py-6 text-base font-heading font-bold"
                >
                  Post to The Stage 🚀
                </Button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
