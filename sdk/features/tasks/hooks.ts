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
  WAITING_CHATS_LIMIT,
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

/**
 * One number for "things waiting on me": handed-over chats + approvals +
 * conversations assigned to me + unread alerts — the same sources and query
 * keys as the My Tasks page, so the two share one cache.
 *
 * `count` is undefined until every source has settled, so a badge can stay
 * hidden rather than flash "0" — or a partial "1" that becomes "5" a second
 * later (people read the first number). A source that failed simply doesn't
 * contribute. `capped` is true when a chat channel hit its page size (show "+").
 */
export function useMyTasksCount(enabled = true) {
  const waba = useWaitingChats('waba', enabled);
  const personal = useWaitingChats('personal', enabled);
  const approvals = usePendingApprovals(enabled);
  const assigned = useAssignedConversations(enabled);
  const notes = useTaskNotifications(enabled);

  const queries = [waba, personal, approvals, assigned, notes];
  if (queries.some((q) => q.isLoading) || queries.every((q) => q.data === undefined)) {
    return { count: undefined, capped: false };
  }

  const count =
    (waba.data?.length ?? 0) +
    (personal.data?.length ?? 0) +
    (approvals.data?.items.length ?? 0) +
    (assigned.data?.length ?? 0) +
    (notes.data?.filter((n) => !n.isRead).length ?? 0);
  const capped = (waba.data?.length ?? 0) >= WAITING_CHATS_LIMIT || (personal.data?.length ?? 0) >= WAITING_CHATS_LIMIT;
  return { count, capped };
}
