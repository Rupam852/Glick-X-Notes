/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { triggerSmartBack } from '../utils/smartBackNavigation';
import { sound } from '../utils/sound';

interface SmartBackGestureProps {
  onBack: () => void;
  canGoBack?: boolean;
}

export default function SmartBackGesture({ onBack, canGoBack = true }: SmartBackGestureProps) {
  const [swipeProgress, setSwipeProgress] = useState<number>(0);
  const [swipeY, setSwipeY] = useState<number>(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isEligibleSwipeRef = useRef(false);
  const hasTriggeredRef = useRef(false);

  const handleSmartBack = useCallback(() => {
    // 1. First check if any active modal or sheet can consume the back gesture
    const handledByModal = triggerSmartBack();
    if (handledByModal) {
      return;
    }

    // 2. Otherwise execute standard back navigation
    if (canGoBack) {
      sound.playSwoosh();
      try {
        if ('vibrate' in navigator) navigator.vibrate([15]);
      } catch {
        // Ignore
      }
      onBack();
    }
  }, [canGoBack, onBack]);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];

      // Only initiate gesture if touch starts within 36px of the left edge
      if (touch.clientX <= 36) {
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
        isEligibleSwipeRef.current = true;
        hasTriggeredRef.current = false;
        setSwipeY(touch.clientY);
        setSwipeProgress(0);
      } else {
        isEligibleSwipeRef.current = false;
        touchStartRef.current = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isEligibleSwipeRef.current || !touchStartRef.current) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

      // Cancel if vertical drag is dominant (user is scrolling up/down)
      if (deltaY > 60 && deltaY > deltaX) {
        isEligibleSwipeRef.current = false;
        setIsSwiping(false);
        setSwipeProgress(0);
        return;
      }

      if (deltaX > 15) {
        setIsSwiping(true);
        setSwipeY(touch.clientY);
        // Calculate progress from 0 to 1 (reaches 1 at 90px drag)
        const progress = Math.min(Math.max((deltaX - 15) / 75, 0), 1);
        setSwipeProgress(progress);

        // Haptic tick when passing activation threshold
        if (progress >= 1 && !hasTriggeredRef.current) {
          hasTriggeredRef.current = true;
          try {
            if ('vibrate' in navigator) navigator.vibrate(8);
          } catch {
            // Ignore
          }
        } else if (progress < 1) {
          hasTriggeredRef.current = false;
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (isEligibleSwipeRef.current && isSwiping && touchStartRef.current) {
        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - touchStartRef.current.x;
        const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);

        // Trigger if dragged over threshold and not a vertical scroll
        if (deltaX >= 80 && deltaX > deltaY) {
          handleSmartBack();
        }
      }

      isEligibleSwipeRef.current = false;
      setIsSwiping(false);
      setSwipeProgress(0);
      touchStartRef.current = null;
      hasTriggeredRef.current = false;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd, { passive: true });
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [handleSmartBack, isSwiping]);

  return (
    <AnimatePresence>
      {isSwiping && swipeProgress > 0.05 && (
        <div 
          className="fixed inset-y-0 left-0 z-[9999] pointer-events-none select-none flex items-center"
          style={{ top: Math.max(swipeY - 40, 20) }}
        >
          {/* Subtle edge glow */}
          <div 
            className="absolute left-0 w-8 bg-gradient-to-r from-indigo-500/20 to-transparent transition-opacity"
            style={{ 
              height: '140px', 
              top: '-30px',
              opacity: swipeProgress 
            }} 
          />

          {/* iOS / Android Native Style Back Arrow Pill */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0, x: -20 }}
            animate={{ 
              scale: 0.8 + swipeProgress * 0.35, 
              opacity: Math.min(swipeProgress * 1.3, 1),
              x: swipeProgress * 28 + 4
            }}
            exit={{ scale: 0.5, opacity: 0, x: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className={`w-11 h-11 rounded-full flex items-center justify-center shadow-xl backdrop-blur-md border transition-colors ${
              swipeProgress >= 1
                ? 'bg-indigo-600 text-white border-indigo-400 shadow-indigo-600/40 ring-4 ring-indigo-500/20'
                : 'bg-white/90 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-slate-800 shadow-black/10'
            }`}
          >
            <ArrowLeft 
              className={`w-5 h-5 transition-transform duration-150 ${
                swipeProgress >= 1 ? '-translate-x-0.5 scale-110' : ''
              }`} 
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
