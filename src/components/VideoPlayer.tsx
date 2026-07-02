'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Play, Pause } from 'lucide-react';
import Hls from 'hls.js';

interface VideoPlayerProps {
  url: string;
  playing: boolean;
  onEnded?: () => void;
  onProgress?: (state: { played: number; playedSeconds: number }) => void;
}

/**
 * Checks if URL is an HLS stream (Cloudflare Stream, etc.)
 */
function isHlsUrl(url: string): boolean {
  return url.includes('.m3u8') || url.includes('/manifest/');
}

export function VideoPlayer({ url, playing, onEnded, onProgress }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [muted, setMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(playing);
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const playVideo = useCallback((video: HTMLVideoElement) => {
    video.play().catch((error) => {
      if (error?.name !== 'AbortError') {
        console.error(error);
      }
    });
  }, []);

  // Initialize HLS or native video
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (isHlsUrl(url)) {
      // HLS stream (Cloudflare Stream, etc.)
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (playing) {
            playVideo(video);
          }
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            console.error('HLS fatal error:', data);
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        video.src = url;
        if (playing) {
          playVideo(video);
        }
      }
    } else {
      // Regular MP4 video
      video.src = url;
      if (playing) {
        playVideo(video);
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [playVideo, playing, url]);

  // Handle playing state changes
  useEffect(() => {
    setIsPlaying(playing);
    if (videoRef.current) {
      if (playing) {
        playVideo(videoRef.current);
      } else {
        videoRef.current.pause();
      }
    }
  }, [playVideo, playing]);

  // Handle mute state changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

  const handleTimeUpdate = () => {
    if (videoRef.current && videoRef.current.duration) {
      const played = videoRef.current.currentTime / videoRef.current.duration;
      setProgress(isNaN(played) ? 0 : played);
      setDuration(videoRef.current.duration);
      setCurrentTime(videoRef.current.currentTime);
      onProgress?.({ played, playedSeconds: videoRef.current.currentTime });
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        playVideo(videoRef.current);
      }
    }
    setIsPlaying(!isPlaying);
    setShowControls(true);
    setTimeout(() => setShowControls(false), 1500);
  };

  const toggleMute = () => {
    setMuted(!muted);
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[radial-gradient(circle_at_50%_20%,rgba(0,240,255,0.12),transparent_34%),linear-gradient(180deg,#020617_0%,#000_55%)]">
      {/* Video Player */}
      <video
        ref={videoRef}
        className="relative z-10 h-full w-full object-contain"
        autoPlay={playing}
        muted={muted}
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={onEnded}
      />

      {/* Enhanced Progress Bar with Time Display */}
      <div className="absolute bottom-16 left-0 right-0 z-50 lg:bottom-0">
        {/* Thicker, more visible progress bar */}
        <div className="relative h-1.5 bg-black/40 hover:h-2 transition-all duration-100">
          {/* Animated gradient progress */}
          <motion.div
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-neon-cyan to-neon-lime"
            style={{ width: `${progress * 100}%` }}
            layoutId="progress"
          />
        </div>

        {/* Time Display - shows current / total */}
        <div className="px-3 py-2 bg-gradient-to-t from-black/80 to-black/40 text-white text-xs font-semibold flex justify-between items-center">
          <span>{formatTime(currentTime)}</span>
          <span className="text-slate-400">{formatTime(duration)}</span>
        </div>
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
