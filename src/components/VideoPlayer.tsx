'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Play, Pause } from 'lucide-react';

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
  const playerRef = useRef<ReactPlayer>(null);

  useEffect(() => {
    setIsPlaying(playing);
  }, [playing]);

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
      {/* Video Player */}
      <ReactPlayer
        ref={playerRef}
        url={url}
        playing={isPlaying}
        muted={muted}
        loop={false}
        width="100%"
        height="100%"
        onEnded={onEnded}
        onProgress={handleProgress}
        playsinline
        config={{
          file: {
            attributes: {
              style: {
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              },
            },
          },
        }}
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
