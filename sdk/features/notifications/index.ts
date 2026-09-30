/**
 * Notifications Feature SDK
 * Web Push for the installed mobile web app: this user's device subscriptions,
 * alert preferences, and a test send.
 *
 * Usage:
 *   import { usePushConfig, useNotificationPreferences } from '@lad/frontend-features/notifications';
 */

export {
  notificationKeys,
  getPushConfig,
  savePushSubscription,
  removePushSubscription,
  sendTestPush,
  getNotificationPreferences,
  updateNotificationPreferences,
} from './api';

export {
  usePushConfig,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  useSavePushSubscription,
  useRemovePushSubscription,
  useSendTestPush,
} from './hooks';

export type { PushConfig, NotificationPreferences, PushSubscriptionJSON, PushTestResult } from './types';
