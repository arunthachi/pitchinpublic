'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Check, Loader2, Video, Circle, Square } from 'lucide-react';

interface RecordingStudioProps {
  isOpen: boolean;
  onClose: () => void;
}

type Mode = 'choose' | 'record' | 'upload' | 'preview';

export function RecordingStudio({ isOpen, onClose }: RecordingStudioProps) {
  const [mode, setMode] = useState<Mode>('choose');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Start camera preview
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setMode('record');
      setError('');
    } catch (err) {
      setError('Could not access camera. Please allow camera permissions.');
      console.error('Camera error:', err);
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Start recording with countdown
  const startRecording = useCallback(() => {
    setCountdown(3);
  }, []);

  // Actual recording start after countdown
  useEffect(() => {
    if (countdown === null) return;

    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }

    if (countdown === 0) {
      setCountdown(null);
      // Start actual recording
      if (!streamRef.current) return;

      chunksRef.current = [];
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm;codecs=vp9',
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const file = new File([blob], 'pitch-recording.webm', { type: 'video/webm' });
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(blob));
        setVideoDuration(recordingTime);
        stopCamera();
        setMode('preview');
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 60) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }
  }, [countdown, stopCamera]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  // Validate and set uploaded file
  const validateAndSetFile = useCallback((file: File) => {
    setError('');
    const video = document.createElement('video');
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      window.URL.revokeObjectURL(video.src);
      const duration = Math.floor(video.duration);
      setVideoDuration(duration);

      if (duration < 30) {
        setError(`Too short (${duration}s). Need 30-60 seconds.`);
      } else if (duration > 60) {
        setError(`Too long (${duration}s). Max 60 seconds.`);
      } else {
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setMode('preview');
      }
    };

    video.onerror = () => setError('Could not read video file');
    video.src = URL.createObjectURL(file);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSetFile(file);
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
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('Uploading pitch:', { file: selectedFile, duration: videoDuration });
    handleClose();
  };

  const handleClose = () => {
    stopCamera();
    if (timerRef.current) clearInterval(timerRef.current);
    setSelectedFile(null);
    setPreviewUrl(null);
    setVideoDuration(0);
    setError('');
    setUploading(false);
    setMode('choose');
    setIsRecording(false);
    setRecordingTime(0);
    setCountdown(null);
    onClose();
  };

  const goBack = () => {
    stopCamera();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setError('');
    setMode('choose');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-[90vw] max-w-md bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl"
          >
            {/* Close Button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 flex items-center justify-center transition-colors z-10"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>

            <div className="p-6">
              {/* Choose Mode */}
              {mode === 'choose' && (
                <>
                  <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-white mb-1">Post your pitch</h2>
                    <p className="text-slate-400 text-sm">30-60 second video</p>
                  </div>

                  <div className="space-y-3">
                    {/* Record Option */}
                    <button
                      onClick={startCamera}
                      className="w-full p-5 bg-gradient-to-r from-neon-cyan/20 to-lime-green/20 border border-neon-cyan/50 rounded-xl hover:border-neon-cyan transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-neon-cyan/20 flex items-center justify-center">
                          <Video className="w-6 h-6 text-neon-cyan" />
                        </div>
                        <div className="text-left">
                          <p className="text-white font-semibold">Record now</p>
                          <p className="text-slate-400 text-sm">Use your camera</p>
                        </div>
                      </div>
                    </button>

                    {/* Upload Option */}
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
                      <div className="w-full p-5 border border-slate-600 rounded-xl hover:border-slate-500 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                            <Upload className="w-6 h-6 text-slate-400" />
                          </div>
                          <div className="text-left">
                            <p className="text-white font-semibold">Upload video</p>
                            <p className="text-slate-400 text-sm">MP4, MOV, WEBM</p>
                          </div>
                        </div>
                      </div>
                    </label>
                  </div>

                  {error && (
                    <p className="mt-4 text-center text-red-400 text-sm">{error}</p>
                  )}
                </>
              )}

              {/* Record Mode */}
              {mode === 'record' && (
                <>
                  <div className="relative aspect-[9/16] max-h-[60vh] mx-auto bg-black rounded-xl overflow-hidden mb-4">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover mirror"
                      style={{ transform: 'scaleX(-1)' }}
                    />

                    {/* Countdown Overlay */}
                    {countdown !== null && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <motion.span
                          key={countdown}
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 1.5, opacity: 0 }}
                          className="text-7xl font-bold text-white"
                        >
                          {countdown || 'GO!'}
                        </motion.span>
                      </div>
                    )}

                    {/* Recording Timer */}
                    {isRecording && (
                      <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-red-500 rounded-full">
                        <Circle className="w-3 h-3 fill-white text-white animate-pulse" />
                        <span className="text-white text-sm font-medium">{formatTime(recordingTime)}</span>
                      </div>
                    )}

                    {/* Min/Max indicator */}
                    {isRecording && (
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/70 rounded-full">
                        <span className={`text-xs ${recordingTime >= 30 ? 'text-green-400' : 'text-yellow-400'}`}>
                          {recordingTime < 30 ? `${30 - recordingTime}s until minimum` : 'Ready to stop!'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={goBack}
                      className="flex-1 py-3 border border-slate-600 text-slate-300 rounded-xl hover:bg-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                    {!isRecording ? (
                      <button
                        onClick={startRecording}
                        disabled={countdown !== null}
                        className="flex-1 py-3 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <Circle className="w-4 h-4 fill-white" />
                        Record
                      </button>
                    ) : (
                      <button
                        onClick={stopRecording}
                        disabled={recordingTime < 30}
                        className="flex-1 py-3 bg-white text-slate-900 font-semibold rounded-xl hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        <Square className="w-4 h-4 fill-slate-900" />
                        Stop
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* Preview Mode */}
              {mode === 'preview' && (
                <>
                  <div className="text-center mb-4">
                    <h2 className="text-xl font-bold text-white">Ready to post?</h2>
                  </div>

                  <div className="relative aspect-[9/16] max-h-[50vh] mx-auto bg-black rounded-xl overflow-hidden mb-4">
                    <video
                      src={previewUrl || undefined}
                      controls
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute top-3 left-3 px-2 py-1 bg-black/70 rounded-full">
                      <span className="text-xs text-white font-medium">{videoDuration}s</span>
                    </div>
                  </div>

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

                  <button
                    onClick={goBack}
                    className="w-full mt-3 text-slate-500 hover:text-slate-300 text-sm transition-colors"
                  >
                    Start over
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
