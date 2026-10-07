/**
 * Notifications feature — React Query hooks.
 *
 * Screens tell "not loaded" from "failed" by `data === undefined`, not
 * `isError` (see the CRM hardening notes in CLAUDE.md).
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getNotificationPreferences,
  getPushConfig,
  notificationKeys,
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
  updateNotificationPreferences,
} from './api';
import type { NotificationPreferences, PushSubscriptionJSON } from './types';

export function usePushConfig(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.pushConfig(),
    queryFn: getPushConfig,
    staleTime: 30_000,
    retry: 1,
    enabled,
  });
}

export function useNotificationPreferences(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.preferences(),
    queryFn: getNotificationPreferences,
    staleTime: 30_000,
    retry: 1,
    enabled,
  });
}

export function useUpdateNotificationPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<NotificationPreferences>) => updateNotificationPreferences(patch),
    onSuccess: (next) => {
      if (next) qc.setQueryData(notificationKeys.preferences(), next);
    },
  });
}

export function useSavePushSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subscription: PushSubscriptionJSON) => savePushSubscription(subscription),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.pushConfig() }),
  });
}

export function useRemovePushSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (endpoint: string) => removePushSubscription(endpoint),
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.pushConfig() }),
  });
}

export function useSendTestPush() {
  return useMutation({ mutationFn: sendTestPush });
}
