/**
 * My Tasks — React Query hooks. Each source is its own query so one failing
 * service degrades its own section only; screens key on `data === undefined`.
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  decideApproval,
  getAssignedConversations,
  getPendingApprovals,
  getTaskNotifications,
  getWaitingChats,
  markTaskNotificationRead,
  taskKeys,
} from './api';
import type { ApprovalAction, ApprovalType, HandoffChannel, PendingApprovals, TaskNotification } from './types';

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

export function usePendingApprovals(enabled = true) {
  return useQuery({ queryKey: taskKeys.approvals(), queryFn: getPendingApprovals, enabled, ...LIVE });
}

/** Drops the item from the list whatever the outcome (decided here or already settled), then refetches. */
export function useDecideApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { type: ApprovalType; id: string; action: ApprovalAction }) => decideApproval(v.type, v.id, v.action),
    onSuccess: (_out, v) => {
      qc.setQueryData<PendingApprovals>(taskKeys.approvals(), (prev) =>
        prev ? { ...prev, items: prev.items.filter((i) => !(i.type === v.type && i.id === v.id)) } : prev,
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: taskKeys.approvals() }),
  });
}
