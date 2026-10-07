/** Push notification settings — shapes shared by the API layer and the UI. */

export interface PushConfig {
  /** Whether the server has VAPID keys; false = push is not set up on this environment. */
  configured: boolean;
  /** VAPID application server key (base64url) to pass to PushManager.subscribe. */
  publicKey: string | null;
  /** How many of the caller's browsers/devices currently receive push. */
  devices: number;
}

export interface NotificationPreferences {
  leadAccepted: boolean;
  messageReceived: boolean;
  /** false = the lock screen shows only who replied, never the message text. */
  showPreview: boolean;
}

/** `PushSubscription.toJSON()` as the browser produces it. */
export interface PushSubscriptionJSON {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
}

export interface PushTestResult {
  skipped?: string;
  recipients: number;
  sent: number;
  failed: number;
}
