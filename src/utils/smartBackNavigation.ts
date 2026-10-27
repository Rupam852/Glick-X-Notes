/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';
import { sound } from './sound';

export type BackHandler = () => boolean | void;

// Stack of active back handlers (modals, popups, sheets)
const backHandlersStack: BackHandler[] = [];

/**
 * Register a back handler (e.g. for closing a modal or popup).
 * Handlers are executed in Last-In-First-Out (LIFO) order.
 * If a handler returns true, the back event is considered handled.
 */
export function registerBackHandler(handler: BackHandler): () => void {
  backHandlersStack.push(handler);
  return () => {
    const idx = backHandlersStack.lastIndexOf(handler);
    if (idx !== -1) {
      backHandlersStack.splice(idx, 1);
    }
  };
}

/**
 * Trigger smart back action manually or from gesture.
 * Returns true if an active modal/handler handled it, false otherwise.
 */
export function triggerSmartBack(): boolean {
  if (backHandlersStack.length > 0) {
    // Pop the topmost handler and execute it
    const topHandler = backHandlersStack.pop();
    if (topHandler) {
      const handled = topHandler();
      // If it returned explicitly false, continue down
      if (handled !== false) {
        sound.playPop();
        try {
          if ('vibrate' in navigator) navigator.vibrate(10);
        } catch {
          // Ignore
        }
        return true;
      }
    }
  }
  return false;
}

/**
 * React hook to register a back handler when a modal or sheet is open.
 */
export function useBackHandler(handler: BackHandler, active: boolean) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!active) return;
    const unregister = registerBackHandler(() => handlerRef.current());
    return unregister;
  }, [active]);
}
