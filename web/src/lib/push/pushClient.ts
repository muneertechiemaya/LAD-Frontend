/**
 * Browser side of Web Push + "install the app".
 *
 * Pure browser plumbing — no network calls here. Saving a subscription to the
 * backend goes through the SDK (`@lad/frontend-features/notifications`).
 *
 * PLATFORM RULES THAT SHAPE THE UI:
 *  - Android Chrome/Edge/Samsung: push works in the browser tab AND installed;
 *    install via the captured `beforeinstallprompt` event (one tap).
 *  - iPhone/iPad (iOS/iPadOS 16.4+): push works ONLY once the site is added to
 *    the Home Screen and opened from there. Safari has no install prompt API —
 *    the user must use Share → Add to Home Screen, so we show instructions.
 *  - Permission can only be requested from a user gesture (a tap), never on load.
 */

export type Platform = 'ios' | 'android' | 'desktop';

export type PushSupport =
  | { supported: true }
  | { supported: false; reason: 'no_service_worker' | 'no_push' | 'ios_needs_install' | 'ios_too_old' };

const SW_URL = '/sw.js';

export function getPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent || '';
  // iPadOS 13+ reports a Mac user agent; touch points give it away.
  const iPadOS = /Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || iPadOS) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

/** Running as an installed app (home-screen icon), not a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

function iosMajorVersion(): number | null {
  const m = (navigator.userAgent || '').match(/OS (\d+)_(\d+)/);
  return m ? Number(m[1]) + Number(m[2]) / 100 : null;
}

export function getPushSupport(): PushSupport {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return { supported: false, reason: 'no_service_worker' };
  }
  if (getPlatform() === 'ios') {
    const v = iosMajorVersion();
    if (v !== null && v < 16.04) return { supported: false, reason: 'ios_too_old' };
    if (!isStandalone()) return { supported: false, reason: 'ios_needs_install' };
  }
  if (!('PushManager' in window) || !('Notification' in window)) {
    return { supported: false, reason: 'no_push' };
  }
  return { supported: true };
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/** Register (or return the existing) service worker. Never throws. */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration('/');
    if (existing) return existing;
    return await navigator.serviceWorker.register(SW_URL, { scope: '/' });
  } catch {
    return null;
  }
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await registerServiceWorker();
  if (!reg || !('pushManager' in reg)) return null;
  try {
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/** VAPID keys are base64url; PushManager wants the raw bytes. */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export class PushPermissionDenied extends Error {
  constructor() {
    super('Notifications are blocked for this site');
    this.name = 'PushPermissionDenied';
  }
}

/**
 * Ask for permission (must run inside a tap handler) and subscribe this browser.
 * Returns the subscription JSON to save on the backend.
 */
export async function subscribeThisDevice(publicKey: string): Promise<PushSubscriptionJSON> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new PushPermissionDenied();
  const reg = await registerServiceWorker();
  if (!reg) throw new Error('Service worker could not be registered');
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }
  return sub.toJSON() as PushSubscriptionJSON;
}

/** Unsubscribe this browser; returns the endpoint to remove on the backend (or null). */
export async function unsubscribeThisDevice(): Promise<string | null> {
  const sub = await currentSubscription();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  try { await sub.unsubscribe(); } catch { /* still remove server-side */ }
  return endpoint;
}

// ── Install prompt (Android / desktop Chromium) ─────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(available: boolean) => void>();
let captureStarted = false;

/**
 * Start listening for the browser's install prompt. Call once, early (the event
 * fires shortly after load and is lost if nobody is listening).
 */
export function captureInstallPrompt(): void {
  if (captureStarted || typeof window === 'undefined') return;
  captureStarted = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((fn) => fn(true));
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    listeners.forEach((fn) => fn(false));
  });
}

export function canPromptInstall(): boolean {
  return !!deferredPrompt;
}

export function onInstallAvailabilityChange(fn: (available: boolean) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Show the native install dialog. Returns true when the user accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  const prompt = deferredPrompt;
  deferredPrompt = null;
  listeners.forEach((fn) => fn(false));
  await prompt.prompt();
  const choice = await prompt.userChoice;
  return choice.outcome === 'accepted';
}

export interface PushSubscriptionJSON {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
}
