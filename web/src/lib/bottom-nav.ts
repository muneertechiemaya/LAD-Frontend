'use client';

/**
 * Mobile bottom nav visibility.
 *
 * The bar floats over the bottom of the screen, which is exactly where a chat
 * thread puts its composer. Any screen that shows its own bottom-anchored
 * input calls `useHideBottomNav(true)` while it does; the bar hides as long as
 * at least one screen asks it to. A counter (not a boolean) so two views
 * mounting/unmounting in either order can't leave it stuck hidden or shown.
 */

import { useEffect, useSyncExternalStore } from 'react';

let hideRequests = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Hide the mobile bottom nav while `hidden` is true and this component is mounted. */
export function useHideBottomNav(hidden: boolean) {
  useEffect(() => {
    if (!hidden) return;
    hideRequests += 1;
    emit();
    return () => {
      hideRequests -= 1;
      emit();
    };
  }, [hidden]);
}

export function useBottomNavHidden(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => hideRequests > 0,
    () => false,
  );
}
