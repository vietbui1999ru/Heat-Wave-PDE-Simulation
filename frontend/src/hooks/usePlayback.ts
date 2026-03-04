import { useState, useRef, useEffect, useCallback } from 'react';
import { CompleteSolution } from '../types/simulation';

interface UsePlaybackOptions {
  completeSolution: CompleteSolution | null;
}

interface UsePlaybackReturn {
  isPlaying: boolean;
  currentTimeIndex: number;
  playbackSpeed: number;
  play: () => void;
  pause: () => void;
  reset: () => void;
  seek: (index: number) => void;
  setSpeed: (speed: number) => void;
  stepForward: () => void;
  stepBackward: () => void;
}

export function usePlayback({ completeSolution }: UsePlaybackOptions): UsePlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeIndex, setCurrentTimeIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const isTabVisibleRef = useRef(!document.hidden);

  // Tab visibility: throttle animation when hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      isTabVisibleRef.current = !document.hidden;
      if (document.hidden && animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
        lastFrameTimeRef.current = 0;
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Re-start animation loop when tab becomes visible again while playing
  useEffect(() => {
    if (!isPlaying || !completeSolution) return;
    if (document.hidden) return;

    const totalFrames = completeSolution.metadata.nt;

    const animate = (timestamp: number) => {
      if (lastFrameTimeRef.current === 0) {
        lastFrameTimeRef.current = timestamp;
      }

      const elapsed = timestamp - lastFrameTimeRef.current;
      const targetFrameTime = 20 / playbackSpeed;

      if (elapsed >= targetFrameTime) {
        setCurrentTimeIndex(prev => {
          if (prev >= totalFrames - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
        lastFrameTimeRef.current = timestamp;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        lastFrameTimeRef.current = 0;
      }
    };
  }, [isPlaying, playbackSpeed, completeSolution]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const play = useCallback(() => {
    if (!completeSolution) return;
    // If at end, restart from beginning
    if (currentTimeIndex >= completeSolution.metadata.nt - 1) {
      setCurrentTimeIndex(0);
    }
    setIsPlaying(true);
  }, [completeSolution, currentTimeIndex]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setCurrentTimeIndex(0);
  }, []);

  const seek = useCallback((index: number) => {
    if (!completeSolution) return;
    const clamped = Math.max(0, Math.min(index, completeSolution.metadata.nt - 1));
    setCurrentTimeIndex(clamped);
  }, [completeSolution]);

  const setSpeed = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
  }, []);

  const stepForward = useCallback(() => {
    if (!completeSolution) return;
    setCurrentTimeIndex(prev => Math.min(prev + 1, completeSolution.metadata.nt - 1));
  }, [completeSolution]);

  const stepBackward = useCallback(() => {
    setCurrentTimeIndex(prev => Math.max(prev - 1, 0));
  }, []);

  return {
    isPlaying,
    currentTimeIndex,
    playbackSpeed,
    play,
    pause,
    reset,
    seek,
    setSpeed,
    stepForward,
    stepBackward,
  };
}
