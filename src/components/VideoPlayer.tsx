'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Play, Pause } from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ReactPlayer = dynamic(() => import('react-player').then((mod) => mod.default as any), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-slate-900 animate-pulse flex items-center justify-center"><span className="text-slate-500">Loading video...</span></div>
}) as any;

interface VideoPlayerProps {
  url: string;
  playing: boolean;
  onEnded?: () => void;
  onProgress?: (state: { played: number; playedSeconds: number }) => void;
}

export function VideoPlayer({ url, playing, onEnded, onProgress }: VideoPlayerProps) {
  const [muted, setMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(playing);
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setIsPlaying(playing);
  }, [playing]);

  useEffect(() => {
    console.log('VideoPlayer url:', url);
  }, [url]);

  const handleProgress = (state: { played: number; playedSeconds: number }) => {
    setProgress(state.played);
    onProgress?.(state);
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
    setShowControls(true);
    setTimeout(() => setShowControls(false), 1500);
  };

  const toggleMute = () => {
    setMuted(!muted);
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* Error Display */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      )}

      {/* Video Player */}
      <ReactPlayer
        url={url}
        playing={isPlaying}
        muted={muted}
        loop={false}
        width="100%"
        height="100%"
        onEnded={onEnded}
        onReady={() => { console.log('Video ready'); setReady(true); }}
        onError={(e: Error) => { console.error('Video error:', e); setError('Failed to load video'); }}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onProgress={handleProgress as any}
        playsinline
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config={{ file: { attributes: { style: { width: '100%', height: '100%', objectFit: 'cover' } } } } as any}
      />

      {/* Progress Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800/50 z-50">
        <motion.div
          className="h-full bg-neon-cyan"
          initial={{ width: '0%' }}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>

      {/* Tap to Play/Pause Overlay */}
      <div
        className="absolute inset-0 z-40"
        onClick={togglePlayPause}
      >
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <div className="w-20 h-20 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
                {isPlaying ? (
                  <Pause className="w-10 h-10 text-white fill-white" />
                ) : (
                  <Play className="w-10 h-10 text-white fill-white ml-1" />
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mute Button */}
      <motion.button
        onClick={toggleMute}
        whileTap={{ scale: 0.9 }}
        className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700 flex items-center justify-center"
      >
        {muted ? (
          <VolumeX className="w-5 h-5 text-slate-300" />
        ) : (
          <Volume2 className="w-5 h-5 text-neon-cyan" />
        )}
      </motion.button>
    </div>
  );
}
