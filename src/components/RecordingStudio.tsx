'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Check, Loader2, Video, Circle, Square, RotateCcw } from 'lucide-react';
import { Step2_AddDetails } from './Step2_AddDetails';
import { Step3_Publish } from './Step3_Publish';

interface RecordingStudioProps {
  isOpen: boolean;
  onClose: () => void;
  onPitchCreated?: (pitch: any) => void;
}

type Mode = 'choose' | 'record' | 'upload' | 'preview' | 'details' | 'publish';
type UploadPhase = 'idle' | 'uploading' | 'processing' | 'ready';

const MAX_VIDEO_FILE_SIZE_BYTES = 200 * 1024 * 1024;
const RECORDING_MIME_TYPES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
];

interface UploadedVideoMetadata {
  playbackUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  status: 'processing' | 'ready' | 'error';
}

export function RecordingStudio({ isOpen, onClose, onPitchCreated }: RecordingStudioProps) {
  const [mode, setMode] = useState<Mode>('choose');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [error, setError] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Pitch details from Step 2
  const [pitchHook, setPitchHook] = useState<string>('');
  const [pitchDescription, setPitchDescription] = useState<string>('');
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoProvider, setVideoProvider] = useState<string | null>(null);
  const [uploadedVideo, setUploadedVideo] = useState<UploadedVideoMetadata | null>(null);

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimeRef = useRef(0);

  const getSupportedRecordingMimeType = () => {
    if (typeof MediaRecorder === 'undefined') return '';
    return RECORDING_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) || '';
  };

  // Start camera preview
  const startCamera = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        setError('Recording is not supported in this browser. Upload a video instead.');
        return;
      }

      const mimeType = getSupportedRecordingMimeType();
      if (!mimeType) {
        setError('Recording is not supported in this browser. Upload an MP4, MOV, or WEBM file instead.');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 720 },
          height: { ideal: 1280 }
        },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Ensure video is playing
        videoRef.current.play().catch(console.error);
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

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
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
      const mimeType = getSupportedRecordingMimeType();
      if (!mimeType) {
        setError('Recording is not supported in this browser. Upload a video instead.');
        return;
      }

      const mediaRecorder = new MediaRecorder(streamRef.current, { mimeType });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const fileExtension = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const file = new File([blob], `pitch-recording.${fileExtension}`, { type: mimeType });
        setSelectedFile(file);
        setPreviewUrl((currentUrl) => {
          if (currentUrl) URL.revokeObjectURL(currentUrl);
          return URL.createObjectURL(blob);
        });
        setVideoDuration(recordingTimeRef.current);
        stopCamera();
        setMode('preview');
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimeRef.current = 0;

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 60) {
            stopRecording();
            return prev;
          }
          const next = prev + 1;
          recordingTimeRef.current = next;
          return next;
        });
      }, 1000);
    }
  }, [countdown, stopCamera, stopRecording]);

  // Validate and set uploaded file
  const validateAndSetFile = useCallback((file: File) => {
    setError('');

    if (!file.type.startsWith('video/')) {
      setError('Please select a video file.');
      return;
    }

    if (file.size > MAX_VIDEO_FILE_SIZE_BYTES) {
      setError('Video must be under 200MB.');
      return;
    }

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
        setPreviewUrl((currentUrl) => {
          if (currentUrl) URL.revokeObjectURL(currentUrl);
          return URL.createObjectURL(file);
        });
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
    if (file) {
      validateAndSetFile(file);
    }
  }, [validateAndSetFile]);

  const uploadFileToProvider = useCallback(
    async (file: File) => {
      setUploadPhase('uploading');
      setUploadProgress(0);

      const uploadUrlResponse = await fetch('/api/videos/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxDurationSeconds: 60 }),
      });

      const uploadUrlData = await uploadUrlResponse.json();
      if (!uploadUrlResponse.ok || !uploadUrlData.success) {
        throw new Error(uploadUrlData.error || 'Failed to get upload URL');
      }

      const { uploadUrl: directUploadUrl, videoId: providerVideoId, provider } = uploadUrlData.data;
      setVideoId(providerVideoId);
      setVideoProvider(provider);

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload?.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(100);
            resolve();
          } else {
            reject(new Error('Failed to upload video'));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

        const formData = new FormData();
        formData.append('file', file);

        xhr.open('POST', directUploadUrl);
        xhr.send(formData);
      });

      return providerVideoId;
    },
    []
  );

  const waitForVideoReady = useCallback(
    async (providerVideoId: string) => {
      setUploadPhase('processing');

      let lastMetadata: UploadedVideoMetadata | null = null;
      const maxAttempts = 30;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const response = await fetch(`/api/videos/${providerVideoId}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to fetch video processing status');
        }

        lastMetadata = data.data;

        if (lastMetadata?.status === 'error') {
          throw new Error('Video processing failed. Please try another file or record again.');
        }

        if (lastMetadata?.status === 'ready' && lastMetadata.playbackUrl) {
          setUploadedVideo(lastMetadata);
          setVideoDuration(Math.round(lastMetadata.duration || videoDuration));
          setUploadPhase('ready');
          return lastMetadata;
        }

        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      throw new Error('Video is still processing. Please try again in a moment.');
    },
    [videoDuration]
  );

  const handleSubmit = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadPhase('uploading');
    setError('');

    try {
      const providerVideoId = await uploadFileToProvider(selectedFile);
      await waitForVideoReady(providerVideoId);
      setMode('details');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload video');
      console.error('Upload error:', err);
      setUploadPhase('idle');
    } finally {
      setUploading(false);
    }
  };

  const handleDetailsNext = async (data: { hook: string; description: string }) => {
    if (!videoId || !uploadedVideo) {
      setError('Video is not ready yet');
      return;
    }

    setUploading(true);
    setError('');
    setPitchHook(data.hook);
    setPitchDescription(data.description);

    try {
      const actualDuration = Math.round(uploadedVideo.duration || videoDuration);

      if (actualDuration < 30 || actualDuration > 60) {
        throw new Error(`Video duration must be 30-60 seconds (got ${actualDuration}s)`);
      }

      const pitchPayload: any = {
        hook: data.hook,
        videoId,
        playbackUrl: uploadedVideo.playbackUrl,
        duration: actualDuration,
      };

      if (data.description && data.description.trim()) {
        pitchPayload.description = data.description.trim();
      }
      if (uploadedVideo.thumbnailUrl) {
        pitchPayload.thumbnailUrl = uploadedVideo.thumbnailUrl;
      }
      if (videoProvider) {
        pitchPayload.videoProvider = videoProvider;
      }

      const response = await fetch('/api/pitches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pitchPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Pitch creation failed:', response.status, errorData);

        // Format detailed error message
        let errorMsg = 'Failed to create pitch';
        if (errorData.errors) {
          // Show validation errors
          const errorsList = Object.entries(errorData.errors)
            .map(([field, messages]: any) => {
              const message = Array.isArray(messages) ? messages.join(', ') : String(messages);
              return `${field}: ${message}`;
            })
            .join(' | ');
          errorMsg = `Validation error: ${errorsList}`;
        } else if (errorData.error) {
          errorMsg = errorData.error;
        } else if (errorData.message) {
          errorMsg = errorData.message;
        }

        throw new Error(errorMsg);
      }

      const responseData = await response.json();
      const { pitch } = responseData;
      onPitchCreated?.(pitch);
      setMode('publish');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create pitch';
      console.error('Pitch creation error:', errorMsg, err);
      setError(errorMsg);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    if (timerRef.current) clearInterval(timerRef.current);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setVideoDuration(0);
    setError('');
    setUploading(false);
    setUploadProgress(0);
    setUploadPhase('idle');
    setMode('choose');
    setIsRecording(false);
    setRecordingTime(0);
    recordingTimeRef.current = 0;
    setCountdown(null);
    setPitchHook('');
    setPitchDescription('');
    setVideoId(null);
    setVideoProvider(null);
    setUploadedVideo(null);
    onClose();
  };

  const goBack = () => {
    stopCamera();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadProgress(0);
    setUploadPhase('idle');
    setVideoId(null);
    setVideoProvider(null);
    setUploadedVideo(null);
    setError('');
    setMode('choose');
  };

  useEffect(() => {
    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl, stopCamera]);

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
              {/* Details Mode */}
              {mode === 'details' && previewUrl && (
                <Step2_AddDetails
                  videoDuration={videoDuration}
                  previewUrl={previewUrl}
                  onNext={handleDetailsNext}
                  onBack={() => setMode('preview')}
                  isLoading={uploading}
                />
              )}

              {/* Publish Mode */}
              {mode === 'publish' && previewUrl && (
                <Step3_Publish
                  pitchTitle={pitchHook}
                  previewUrl={previewUrl}
                  videoDuration={videoDuration}
                  onViewFeed={handleClose}
                  isLoading={uploading}
                />
              )}

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
                      className="w-full p-5 bg-gradient-to-r from-neon-cyan/20 to-neon-lime/20 border border-neon-cyan/50 rounded-xl hover:border-neon-cyan transition-all group"
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
                      className="w-full h-full object-contain"
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

                    {/* Recording Timer - Prominent Display */}
                    {isRecording && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        {/* Large Timer */}
                        <motion.div
                          key={recordingTime}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="flex flex-col items-center"
                        >
                          <div className="mb-4 px-6 py-3 bg-red-500/90 backdrop-blur-sm rounded-full">
                            <Circle className="w-3 h-3 fill-white text-white animate-pulse inline mr-2" />
                            <span className="text-white text-4xl font-bold font-mono">{formatTime(recordingTime)}</span>
                          </div>
                        </motion.div>

                        {/* Progress Bar - Show 30-60 second range */}
                        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-64">
                          <div className="relative h-2 bg-black/50 rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-gradient-to-r from-red-500 to-orange-400"
                              style={{ width: `${Math.min(100, (recordingTime / 60) * 100)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-slate-300 mt-2 px-2">
                            <span>0s</span>
                            <span className="font-semibold">{recordingTime < 30 ? `${30 - recordingTime}s min` : 'Ready ✓'}</span>
                            <span>60s</span>
                          </div>
                        </div>
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
                    <h2 className="text-xl font-bold text-white">Preview your pitch</h2>
                    <p className="text-sm text-slate-400 mt-1">Upload first, then add the hook and publish.</p>
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

                  {/* Upload Progress Bar */}
                  {uploading && (
                    <div className="mb-4 space-y-2">
                      <div className="relative h-2 bg-slate-700 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-neon-cyan to-neon-lime"
                          style={{ width: `${uploadProgress}%` }}
                          transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-xs text-slate-400">
                        <span className="text-white font-semibold">
                          {uploadPhase === 'processing' ? 'Processing video for playback...' : 'Uploading video...'}
                        </span>
                        <span className="font-mono text-neon-cyan">
                          {uploadPhase === 'processing' ? 'Almost ready' : `${uploadProgress}%`}
                        </span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleSubmit}
                    disabled={uploading}
                    className="w-full py-4 bg-gradient-to-r from-neon-cyan to-neon-lime text-slate-900 font-bold text-lg rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {uploadPhase === 'processing' ? 'Processing...' : `Uploading (${uploadProgress}%)...`}
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        Upload and continue
                      </>
                    )}
                  </button>

                  <button
                    onClick={goBack}
                    className="w-full mt-3 text-slate-500 hover:text-slate-300 text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    disabled={uploading}
                  >
                    <RotateCcw className="w-4 h-4" />
                    Retake or choose another video
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
