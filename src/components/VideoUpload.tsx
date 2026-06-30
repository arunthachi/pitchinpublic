'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Check, AlertCircle, Video, Loader2 } from 'lucide-react';

interface VideoUploadProps {
  onUploadComplete: (videoId: string, playbackUrl: string) => void;
  onError?: (error: string) => void;
  maxDurationSeconds?: number;
  className?: string;
}

type UploadStatus = 'idle' | 'selecting' | 'uploading' | 'processing' | 'ready' | 'error';

export function VideoUpload({
  onUploadComplete,
  onError,
  maxDurationSeconds = 60,
  className = '',
}: VideoUploadProps) {
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const validateVideo = useCallback(
    (file: File): Promise<boolean> => {
      return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';

        video.onloadedmetadata = () => {
          URL.revokeObjectURL(video.src);
          const duration = video.duration;

          if (duration > maxDurationSeconds) {
            setError(`Video must be ${maxDurationSeconds} seconds or less. Your video is ${Math.round(duration)} seconds.`);
            resolve(false);
          } else if (duration < 30) {
            setError('Pitch videos must be at least 30 seconds long.');
            resolve(false);
          } else {
            resolve(true);
          }
        };

        video.onerror = () => {
          setError('Invalid video file');
          resolve(false);
        };

        video.src = URL.createObjectURL(file);
      });
    },
    [maxDurationSeconds]
  );

  const pollVideoStatus = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`/api/videos/${id}`);
        const data = await response.json();

        if (data.success && data.data) {
          if (data.data.status === 'ready') {
            // Video is ready
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }
            setStatus('ready');
            onUploadComplete(id, data.data.playbackUrl);
          } else if (data.data.status === 'error') {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }
            setStatus('error');
            setError('Video processing failed');
            onError?.('Video processing failed');
          }
          // Keep polling if still processing
        }
      } catch (err) {
        console.error('Error polling video status:', err);
      }
    },
    [onUploadComplete, onError]
  );

  const uploadFile = useCallback(
    async (file: File) => {
      setStatus('uploading');
      setProgress(0);
      setError(null);

      try {
        // Step 1: Get direct upload URL from our API
        const urlResponse = await fetch('/api/videos/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ maxDurationSeconds }),
        });

        const urlData = await urlResponse.json();

        if (!urlData.success) {
          throw new Error(urlData.error || 'Failed to get upload URL');
        }

        const { uploadUrl, videoId: id } = urlData.data;
        setVideoId(id);

        // Step 2: Upload directly to provider (Cloudflare)
        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = Math.round((event.loaded / event.total) * 100);
            setProgress(percentComplete);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setStatus('processing');
            setProgress(100);

            // Start polling for video ready status
            pollIntervalRef.current = setInterval(() => {
              pollVideoStatus(id);
            }, 2000);
          } else {
            setStatus('error');
            setError('Upload failed');
            onError?.('Upload failed');
          }
        };

        xhr.onerror = () => {
          setStatus('error');
          setError('Network error during upload');
          onError?.('Network error during upload');
        };

        xhr.open('POST', uploadUrl);
        xhr.send(formData);
      } catch (err) {
        setStatus('error');
        const message = err instanceof Error ? err.message : 'Upload failed';
        setError(message);
        onError?.(message);
      }
    },
    [maxDurationSeconds, onError, pollVideoStatus]
  );

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('video/')) {
        setError('Please select a video file');
        return;
      }

      // Validate file size (max 200MB)
      if (file.size > 200 * 1024 * 1024) {
        setError('Video must be under 200MB');
        return;
      }

      setStatus('selecting');
      setPreviewUrl(URL.createObjectURL(file));

      // Validate duration
      const isValid = await validateVideo(file);
      if (isValid) {
        await uploadFile(file);
      } else {
        setStatus('error');
      }
    },
    [validateVideo, uploadFile]
  );

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      if (file && file.type.startsWith('video/')) {
        const input = fileInputRef.current;
        if (input) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          input.files = dataTransfer.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    },
    []
  );

  const reset = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    setStatus('idle');
    setProgress(0);
    setError(null);
    setVideoId(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <div className={`relative ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <AnimatePresence mode="wait">
        {status === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-slate-700 rounded-xl p-8 cursor-pointer hover:border-neon-cyan hover:bg-slate-800/30 transition-all"
          >
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
                <Upload className="w-8 h-8 text-slate-400" />
              </div>
              <div>
                <p className="text-white font-medium">Upload your pitch video</p>
                <p className="text-slate-400 text-sm mt-1">
                  Drag & drop or click to select (max {maxDurationSeconds}s)
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {(status === 'selecting' || status === 'uploading') && (
          <motion.div
            key="uploading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="border-2 border-neon-cyan rounded-xl p-8"
          >
            <div className="flex flex-col items-center gap-4">
              {previewUrl && (
                <video
                  src={previewUrl}
                  className="w-32 h-32 object-cover rounded-lg"
                  muted
                />
              )}
              <div className="w-full">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">Uploading...</span>
                  <span className="text-neon-cyan">{progress}%</span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-neon-cyan"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {status === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="border-2 border-lime-green rounded-xl p-8"
          >
            <div className="flex flex-col items-center gap-4 text-center">
              <Loader2 className="w-12 h-12 text-lime-green animate-spin" />
              <div>
                <p className="text-white font-medium">Processing video...</p>
                <p className="text-slate-400 text-sm mt-1">
                  This may take a minute
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {status === 'ready' && (
          <motion.div
            key="ready"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="border-2 border-lime-green rounded-xl p-8"
          >
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-lime-green/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-lime-green" />
              </div>
              <div>
                <p className="text-white font-medium">Video uploaded!</p>
                <p className="text-slate-400 text-sm mt-1">
                  Ready to publish your pitch
                </p>
              </div>
              <button
                onClick={reset}
                className="text-slate-400 text-sm hover:text-white transition-colors"
              >
                Upload a different video
              </button>
            </div>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="border-2 border-red-500 rounded-xl p-8"
          >
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <div>
                <p className="text-white font-medium">Upload failed</p>
                <p className="text-red-400 text-sm mt-1">{error}</p>
              </div>
              <button
                onClick={reset}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
              >
                Try again
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
