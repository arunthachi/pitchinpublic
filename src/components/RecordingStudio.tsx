'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Check, Loader2 } from 'lucide-react';

interface RecordingStudioProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RecordingStudio({ isOpen, onClose }: RecordingStudioProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const validateAndSetFile = useCallback((file: File) => {
    setError('');

    // Create video element to check duration
    const video = document.createElement('video');
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      const duration = Math.floor(video.duration);
      setVideoDuration(duration);

      if (duration < 30) {
        setError(`Too short (${duration}s). Need 30-60 seconds.`);
        setSelectedFile(null);
        setPreviewUrl(null);
      } else if (duration > 60) {
        setError(`Too long (${duration}s). Max 60 seconds.`);
        setSelectedFile(null);
        setPreviewUrl(null);
      } else {
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
      }
    };

    video.onerror = () => {
      setError('Could not read video file');
    };

    video.src = URL.createObjectURL(file);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      validateAndSetFile(file);
    }
  }, [validateAndSetFile]);

  const handleSubmit = async () => {
    if (!selectedFile) return;

    setUploading(true);
    // Simulate upload - in production, use the video provider
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('Uploading pitch:', { file: selectedFile, duration: videoDuration });

    // Reset and close
    handleClose();
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setVideoDuration(0);
    setError('');
    setUploading(false);
    onClose();
  };

  const removeFile = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setVideoDuration(0);
    setError('');
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
            onClick={handleClose}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100]"
          />

          {/* Modal - Always Centered */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-md z-[101]"
          >
            <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
              {/* Close Button */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center transition-colors z-10"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>

              {/* Content */}
              <div className="p-6">
                {!selectedFile ? (
                  // Upload State
                  <>
                    <div className="text-center mb-6">
                      <h2 className="text-2xl font-bold text-white mb-1">
                        Drop your pitch
                      </h2>
                      <p className="text-slate-400 text-sm">
                        30-60 second video
                      </p>
                    </div>

                    <label
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={handleDrop}
                      className="block cursor-pointer"
                    >
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <div className="border-2 border-dashed border-slate-600 hover:border-neon-cyan rounded-xl p-10 transition-all hover:bg-slate-800/30 group">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-16 h-16 rounded-full bg-slate-800 group-hover:bg-neon-cyan/20 flex items-center justify-center transition-colors">
                            <Upload className="w-7 h-7 text-slate-400 group-hover:text-neon-cyan transition-colors" />
                          </div>
                          <div className="text-center">
                            <p className="text-white font-medium mb-1">
                              Click or drag video here
                            </p>
                            <p className="text-slate-500 text-xs">
                              MP4, MOV, WEBM
                            </p>
                          </div>
                        </div>
                      </div>
                    </label>

                    {/* Error */}
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 text-center text-red-400 text-sm"
                      >
                        {error}
                      </motion.p>
                    )}
                  </>
                ) : (
                  // Preview State
                  <>
                    <div className="text-center mb-4">
                      <h2 className="text-xl font-bold text-white">
                        Ready to post?
                      </h2>
                    </div>

                    {/* Video Preview */}
                    <div className="relative aspect-[9/16] max-h-[50vh] mx-auto bg-black rounded-xl overflow-hidden mb-4">
                      <video
                        src={previewUrl || undefined}
                        controls
                        className="w-full h-full object-contain"
                      />
                      {/* Duration Badge */}
                      <div className="absolute top-3 left-3 px-2 py-1 bg-black/70 rounded-full">
                        <span className="text-xs text-white font-medium">{videoDuration}s</span>
                      </div>
                      {/* Remove Button */}
                      <button
                        onClick={removeFile}
                        className="absolute top-3 right-3 w-7 h-7 bg-black/70 hover:bg-red-500/80 rounded-full flex items-center justify-center transition-colors"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>

                    {/* Post Button */}
                    <button
                      onClick={handleSubmit}
                      disabled={uploading}
                      className="w-full py-4 bg-gradient-to-r from-neon-cyan to-lime-green text-slate-900 font-bold text-lg rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Posting...
                        </>
                      ) : (
                        <>
                          <Check className="w-5 h-5" />
                          Post Pitch
                        </>
                      )}
                    </button>

                    {/* Change Video Link */}
                    <button
                      onClick={removeFile}
                      className="w-full mt-3 text-slate-500 hover:text-slate-300 text-sm transition-colors"
                    >
                      Choose different video
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
