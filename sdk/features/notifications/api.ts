/**
 * Notifications feature — API functions.
 *
 * Everything goes through the app's own `/api/notifications/*` proxy, which
 * forwards to LAD_backend `/api/notifications/*` with the caller's token. The
 * backend scopes every call to the token's tenant and user — nothing here
 * sends a tenant or user id.
 */
import { apiGet, apiPost, apiPut } from '../../shared/apiClient';
import type { NotificationPreferences, PushConfig, PushSubscriptionJSON, PushTestResult } from './types';

const BASE = '/api/notifications';

interface Envelope<T> {
  success?: boolean;
  data?: T;
}

function requireData<T>(data: T | undefined | null, what: string): T {
  if (data === undefined || data === null) throw new Error(`Empty ${what} response`);
  return data;
}

export const notificationKeys = {
  all: ['notifications'] as const,
  pushConfig: () => [...notificationKeys.all, 'push-config'] as const,
  preferences: () => [...notificationKeys.all, 'preferences'] as const,
};

export async function getPushConfig(): Promise<PushConfig> {
  const res = await apiGet<Envelope<PushConfig>>(`${BASE}/push/config`);
  // A missing body is a failure, not "push isn't set up" — let the query error.
  const d = requireData(res.data?.data, 'push config');
  return { configured: !!d?.configured, publicKey: d?.publicKey ?? null, devices: d?.devices ?? 0 };
}

export async function savePushSubscription(subscription: PushSubscriptionJSON): Promise<void> {
  await apiPost(`${BASE}/push/subscribe`, { subscription });
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  await apiPost(`${BASE}/push/unsubscribe`, { endpoint });
}

export async function sendTestPush(): Promise<PushTestResult> {
  const res = await apiPost<Envelope<PushTestResult>>(`${BASE}/push/test`);
  return requireData(res.data?.data, 'test push');
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const res = await apiGet<Envelope<NotificationPreferences>>(`${BASE}/preferences`);
  const d = requireData(res.data?.data, 'notification preferences');
  return {
    leadAccepted: d?.leadAccepted !== false,
    messageReceived: d?.messageReceived !== false,
    showPreview: d?.showPreview !== false,
  };
}

export async function updateNotificationPreferences(
  patch: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const res = await apiPut<Envelope<NotificationPreferences>>(`${BASE}/preferences`, patch);
  return requireData(res.data?.data, 'notification preferences');
}
