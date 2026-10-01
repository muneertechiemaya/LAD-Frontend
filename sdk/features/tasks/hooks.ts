/**
 * My Tasks — React Query hooks. Each source is its own query so one failing
 * service degrades its own section only; screens key on `data === undefined`.
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAssignedConversations,
  getTaskNotifications,
  getWaitingChats,
  markTaskNotificationRead,
  taskKeys,
} from './api';
import type { HandoffChannel, TaskNotification } from './types';

const LIVE = { staleTime: 20_000, refetchInterval: 60_000, retry: 1 } as const;

export function useWaitingChats(channel: HandoffChannel, enabled = true) {
  return useQuery({ queryKey: taskKeys.waiting(channel), queryFn: () => getWaitingChats(channel), enabled, ...LIVE });
}

export function useAssignedConversations(enabled = true) {
  return useQuery({ queryKey: taskKeys.assigned(), queryFn: getAssignedConversations, enabled, ...LIVE });
}

export function useTaskNotifications(enabled = true) {
  return useQuery({ queryKey: taskKeys.notifications(), queryFn: getTaskNotifications, enabled, ...LIVE });
}

export function useMarkTaskNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markTaskNotificationRead(id),
    onSuccess: (_void, id) => {
      qc.setQueryData<TaskNotification[]>(taskKeys.notifications(), (prev) =>
        prev?.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
    },
  });
}
