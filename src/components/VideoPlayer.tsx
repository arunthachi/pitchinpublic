'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Play, Pause, RotateCcw } from 'lucide-react';

interface VideoPlayerProps {
  url: string;
  playing: boolean;
  onEnded?: () => void;
  onProgress?: (state: { played: number; playedSeconds: number }) => void;
  onInteractionChange?: (active: boolean) => void;
}

const SOUND_PREFERENCE_KEY = 'pip-video-sound-enabled';

function soundEnabledForSession() {
  try {
    return window.sessionStorage.getItem(SOUND_PREFERENCE_KEY) === 'true';
  } catch {
    return false;
  }
}

function rememberSoundPreference(enabled: boolean) {
  try {
    window.sessionStorage.setItem(SOUND_PREFERENCE_KEY, String(enabled));
  } catch {
    // Playback remains functional when storage is unavailable.
  }
}

/**
 * Checks if URL is an HLS stream (Cloudflare Stream, etc.)
 */
function isHlsUrl(url: string): boolean {
  return url.includes('.m3u8') || url.includes('/manifest/');
}

export function VideoPlayer({ url, playing, onEnded, onProgress, onInteractionChange }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<InstanceType<typeof import('hls.js').default> | null>(null);
  const playingRef = useRef(playing);
  const [muted, setMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(playing);
  const [showControls, setShowControls] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [showSoundPrompt, setShowSoundPrompt] = useState(true);
  const hlsRecoveryAttemptsRef = useRef(0);

  const playVideo = useCallback(async (video: HTMLVideoElement, withSound = soundEnabledForSession()) => {
    window.dispatchEvent(new CustomEvent('pip-video-player-claim', { detail: video }));
    video.muted = !withSound;
    setMuted(!withSound);
    try {
      await video.play();
      setIsPlaying(true);
      setShowSoundPrompt(video.muted);
    } catch (error) {
      if (withSound) {
        video.muted = true;
        setMuted(true);
        setShowSoundPrompt(true);
        rememberSoundPreference(false);
        try {
          await video.play();
          setIsPlaying(true);
          return;
        } catch {
          setIsPlaying(false);
        }
      }
      if ((error as DOMException)?.name !== 'AbortError') setIsPlaying(false);
    }
  }, []);

  useEffect(() => {
    const onClaim = (event: Event) => {
      const video = videoRef.current;
      if (video && (event as CustomEvent<HTMLVideoElement>).detail !== video) {
        video.pause();
        video.muted = true;
        setMuted(true);
        setIsPlaying(false);
      }
    };
    window.addEventListener('pip-video-player-claim', onClaim);
    return () => window.removeEventListener('pip-video-player-claim', onClaim);
  }, []);

  useEffect(() => {
    playingRef.current = playing;
  }, [playing]);

  // Initialize HLS or native video
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;
    let disposed = false;

    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    hlsRecoveryAttemptsRef.current = 0;

    if (isHlsUrl(url)) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari plays HLS natively and does not need the hls.js runtime.
        video.src = url;
        if (playingRef.current) {
          playVideo(video);
        }
      } else {
        // Load the HLS runtime only when this pitch actually needs it.
        void import('hls.js').then(({ default: Hls }) => {
          if (disposed || !Hls.isSupported()) return;
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 30,
            fragLoadingMaxRetry: 4,
            manifestLoadingMaxRetry: 4,
          });
          hlsRef.current = hls;
          hls.loadSource(url);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (playingRef.current) void playVideo(video);
          });
          hls.on(Hls.Events.ERROR, (event, data) => {
            if (!data.fatal) return;
            hlsRecoveryAttemptsRef.current += 1;

            if (data.type === Hls.ErrorTypes.NETWORK_ERROR && hlsRecoveryAttemptsRef.current <= 3) {
              console.warn('Recovering HLS network error:', data.details);
              hls.startLoad();
              return;
            }
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR && hlsRecoveryAttemptsRef.current <= 2) {
              console.warn('Recovering HLS media error:', data.details);
              hls.recoverMediaError();
              return;
            }

            console.warn('Unable to recover HLS playback:', {
              type: data.type,
              details: data.details,
              response: data.response,
            });
            hls.destroy();
            hlsRef.current = null;
          });
        }).catch((error) => {
          if (!disposed) console.warn('Unable to load HLS playback support:', error);
        });
      }
    } else {
      // Regular MP4 video
      video.src = url;
      if (playingRef.current) {
        playVideo(video);
      }
    }

    return () => {
      disposed = true;
      video.pause();
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [playVideo, url]);

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
        setIsPlaying(false);
      } else {
        void playVideo(videoRef.current);
      }
    }
    setShowControls(true);
    setTimeout(() => setShowControls(false), 1500);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setMuted(nextMuted);
    setShowSoundPrompt(nextMuted);
    rememberSoundPreference(!nextMuted);
    if (!nextMuted && video.paused) void playVideo(video, true);
  };

  const replayWithSound = () => {
    const video = videoRef.current;
    if (!video) return;
    rememberSoundPreference(true);
    video.currentTime = 0;
    setShowSoundPrompt(false);
    void playVideo(video, true);
  };

  const rewind = () => {
    const video = videoRef.current;
    if (video) video.currentTime = Math.max(0, video.currentTime - 10);
  };

  const seek = (seconds: number) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    video.currentTime = seconds;
    setCurrentTime(seconds);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[radial-gradient(circle_at_50%_20%,rgba(0,230,246,0.12),transparent_34%),linear-gradient(180deg,#05070a_0%,#000_58%)]">
      {/* Video Player */}
      <video
        ref={videoRef}
        className="relative z-10 h-full w-full object-cover"
        autoPlay={playing}
        muted={muted}
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={onEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <div
        className="absolute bottom-16 left-0 right-0 z-50 bg-gradient-to-t from-black/90 to-black/30 px-3 pb-2 pt-3 lg:bottom-0"
        onPointerDown={(event) => { event.stopPropagation(); onInteractionChange?.(true); }}
        onPointerUp={() => onInteractionChange?.(false)}
        onPointerCancel={() => onInteractionChange?.(false)}
        onPointerLeave={() => onInteractionChange?.(false)}
      >
        <input
          type="range"
          min={0}
          max={duration || 0}
          step="0.05"
          value={Math.min(currentTime, duration || 0)}
          onChange={(event) => seek(Number(event.target.value))}
          className="h-7 w-full cursor-pointer accent-neon-cyan"
          aria-label="Pitch playback position"
          aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
        />
        <div className="flex items-center justify-between text-xs font-semibold text-white">
          <span>{formatTime(currentTime)}</span>
          <span className="text-slate-400">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Tap to Play/Pause Overlay */}
      <button
        type="button"
        className="absolute inset-0 z-40"
        onClick={togglePlayPause}
        aria-label={isPlaying ? 'Pause pitch video' : 'Play pitch video'}
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
      </button>

      {showSoundPrompt && playing ? (
        <button type="button" onClick={replayWithSound} className="glass-pill absolute left-3 top-4 z-50 flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-black text-white shadow-lg focus:outline-none focus:ring-2 focus:ring-neon-cyan sm:px-4" aria-label="Replay pitch from the beginning with sound">
          <Volume2 className="h-4 w-4 text-neon-cyan" /> Play from start
        </button>
      ) : null}

      <motion.button type="button" onClick={rewind} whileTap={{ scale: 0.9 }} className="glass-pill absolute right-16 top-4 z-50 flex h-11 w-11 items-center justify-center rounded-full" aria-label="Rewind 10 seconds">
        <RotateCcw className="h-5 w-5 text-white" />
      </motion.button>
      <motion.button
        type="button"
        onClick={toggleMute}
        whileTap={{ scale: 0.9 }}
        className="glass-pill absolute right-4 top-4 z-50 flex h-11 w-11 items-center justify-center rounded-full"
        aria-label={muted ? 'Turn sound on' : 'Mute pitch'}
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
