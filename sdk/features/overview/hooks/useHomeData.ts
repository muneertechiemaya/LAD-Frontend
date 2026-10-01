/**
 * Home dashboard data hooks (fixed layout). React Query, so the home page and
 * any future surface share one cache; `data === undefined` after loading means
 * the source failed — never render it as zero.
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getEmailBroadcastSummary,
  getInstagramSummary,
  getLeadJourneyCounts,
  getLinkedInSummary,
  getHomeLayout,
  saveHomeLayout,
  resetHomeLayout,
  type HomeLayout,
  type SavedHomeLayout,
} from '../api';

export type PipelinePeriod = 'week' | 'month' | 'quarter';
const PERIOD_DAYS: Record<PipelinePeriod, number> = { week: 7, month: 30, quarter: 90 };

export const homeKeys = {
  all: ['home'] as const,
  pipeline: (p: PipelinePeriod) => [...homeKeys.all, 'pipeline', p] as const,
  linkedin: () => [...homeKeys.all, 'linkedin'] as const,
  email: () => [...homeKeys.all, 'email'] as const,
  instagram: () => [...homeKeys.all, 'instagram'] as const,
  layout: () => [...homeKeys.all, 'layout'] as const,
};

const OPTS = { staleTime: 60_000, retry: 1 } as const;

export function usePipelineCounts(period: PipelinePeriod) {
  return useQuery({
    queryKey: homeKeys.pipeline(period),
    queryFn: () => {
      const to = new Date();
      const from = new Date(to.getTime() - PERIOD_DAYS[period] * 86_400_000);
      return getLeadJourneyCounts(from, to);
    },
    ...OPTS,
  });
}

export function useLinkedInSummary(enabled = true) {
  return useQuery({ queryKey: homeKeys.linkedin(), queryFn: getLinkedInSummary, enabled, ...OPTS });
}

export function useEmailBroadcastSummary(enabled = true) {
  return useQuery({ queryKey: homeKeys.email(), queryFn: getEmailBroadcastSummary, enabled, ...OPTS });
}

export function useInstagramSummary(enabled = true) {
  return useQuery({ queryKey: homeKeys.instagram(), queryFn: getInstagramSummary, enabled, ...OPTS });
}

/** The user's saved Home layout. `data.layout === null` → use the default. */
export function useHomeLayout() {
  return useQuery({ queryKey: homeKeys.layout(), queryFn: getHomeLayout, staleTime: 5 * 60_000, retry: 1 });
}

/** Save optimistically; roll back to the previous layout if the write fails. */
export function useSaveHomeLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (layout: HomeLayout) => saveHomeLayout(layout),
    onMutate: async (layout) => {
      await qc.cancelQueries({ queryKey: homeKeys.layout() });
      const prev = qc.getQueryData<SavedHomeLayout>(homeKeys.layout());
      qc.setQueryData<SavedHomeLayout>(homeKeys.layout(), { layout, degraded: false });
      return { prev };
    },
    onError: (_err, _layout, ctx) => {
      if (ctx?.prev) qc.setQueryData(homeKeys.layout(), ctx.prev);
    },
  });
}

export function useResetHomeLayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: resetHomeLayout,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: homeKeys.layout() });
      const prev = qc.getQueryData<SavedHomeLayout>(homeKeys.layout());
      qc.setQueryData<SavedHomeLayout>(homeKeys.layout(), { layout: null, degraded: false });
      return { prev };
    },
    onError: (_err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(homeKeys.layout(), ctx.prev);
    },
  });
}
