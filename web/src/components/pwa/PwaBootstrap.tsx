'use client';

/**
 * Mounted once at the root. Renders nothing.
 *
 *  - Starts listening for Android/desktop's install prompt right away (the
 *    `beforeinstallprompt` event fires shortly after load and is lost if nobody
 *    is listening yet).
 *  - Registers the service worker so a push can arrive while the app is closed.
 *    Registration does NOT ask for notification permission — that only happens
 *    when the user taps "Turn on" in Settings → Notifications.
 *  - When a notification is tapped while the app is already open in a browser
 *    that cannot navigate the window from the worker, the worker posts
 *    `lad:navigate`; route there with the Next router.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { captureInstallPrompt, registerServiceWorker } from '@/lib/push/pushClient';

export default function PwaBootstrap() {
  const router = useRouter();

  useEffect(() => {
    captureInstallPrompt();
    // After first paint, so registration never competes with the initial load.
    const id = window.setTimeout(() => { void registerServiceWorker(); }, 1500);

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | null;
      if (data?.type !== 'lad:navigate' || typeof data.url !== 'string') return;
      try {
        const target = new URL(data.url, window.location.origin);
        if (target.origin === window.location.origin) router.push(`${target.pathname}${target.search}`);
      } catch { /* ignore malformed */ }
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);

    return () => {
      window.clearTimeout(id);
      navigator.serviceWorker?.removeEventListener('message', onMessage);
    };
  }, [router]);

  return null;
}
