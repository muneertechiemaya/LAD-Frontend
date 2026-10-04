/**
 * Content Studio - React Query hooks.
 *
 * Mutations invalidate the whole feature key: one post change can move Today,
 * the calendar, gaps, the library and analytics at once, and a stale count on
 * any of them reads as a wrong number. The feature's reads are cheap.
 */
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from './api';
import { contentStudioKeys as keys } from './api';
import type { BulkPatch, DraftRequest, Platform, PostListQuery, PostPatch, StudioSettings } from './types';

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: keys.all });
}

export function useStudioSettings() {
  return useQuery({ queryKey: keys.settings(), queryFn: api.getSettings, staleTime: 60_000 });
}

export function useSaveStudioSettings() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (s: Partial<StudioSettings>) => api.saveSettings(s),
    onSuccess: invalidate,
  });
}

export function useChannels() {
  return useQuery({ queryKey: keys.channels(), queryFn: api.getChannels, staleTime: 5 * 60_000 });
}

export function useToday() {
  return useQuery({ queryKey: keys.today(), queryFn: api.getToday, staleTime: 30_000, refetchOnWindowFocus: true });
}

export function usePlanPreview(startDate?: string, days = 30, enabled = true) {
  return useQuery({
    queryKey: keys.planPreview(startDate, days),
    queryFn: () => api.previewPlan({ startDate, days }),
    enabled,
    staleTime: 30_000,
  });
}

export function useGeneratePlan() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: api.generatePlan, onSuccess: invalidate });
}

export function useFillGaps() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: api.fillGaps, onSuccess: invalidate });
}

export function usePosts(q?: PostListQuery, enabled = true) {
  return useQuery({ queryKey: keys.postList(q), queryFn: () => api.listPosts(q), enabled, staleTime: 15_000 });
}

export function usePost(id: string | null | undefined) {
  return useQuery({
    queryKey: keys.post(id || 'none'),
    queryFn: () => api.getPost(id as string),
    enabled: !!id,
    staleTime: 5_000,
  });
}

export function useCreatePost() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (p: PostPatch & { platform: Platform }) => api.createPost(p),
    onSuccess: invalidate,
  });
}

export function useUpdatePost() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: PostPatch }) => api.updatePost(id, patch),
    onSuccess: invalidate,
  });
}

export function useDeletePost() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => api.deletePost(id), onSuccess: invalidate });
}

export function useDuplicatePost() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, platform, scheduledAt }: { id: string; platform?: Platform; scheduledAt?: string }) =>
      api.duplicatePost(id, { platform, scheduledAt }),
    onSuccess: invalidate,
  });
}

export function useBulkUpdate() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ ids, patch }: { ids: string[]; patch: BulkPatch }) => api.bulkUpdate(ids, patch),
    onSuccess: invalidate,
  });
}

export function useVersions(id: string | null | undefined) {
  return useQuery({
    queryKey: keys.versions(id || 'none'),
    queryFn: () => api.listVersions(id as string),
    enabled: !!id,
  });
}

export function useRestoreVersion() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => api.restoreVersion(id, version),
    onSuccess: invalidate,
  });
}

export function useSchedulePost() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, scheduledAt }: { id: string; scheduledAt: string }) => api.schedulePost(id, scheduledAt),
    onSuccess: invalidate,
  });
}

export function useUnschedulePost() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => api.unschedulePost(id), onSuccess: invalidate });
}

export function useApprovePost() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => api.approvePost(id), onSuccess: invalidate });
}

export function useMarkPosted() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, url }: { id: string; url?: string }) => api.markPosted(id, url),
    onSuccess: invalidate,
  });
}

export function useRetryPost() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => api.retryPost(id), onSuccess: invalidate });
}

export function useGenerateHooks() {
  return useMutation({ mutationFn: api.generateHooks });
}

export function useGenerateIdeas() {
  return useMutation({ mutationFn: api.generateIdeas });
}

export function useGenerateDraft() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (b: DraftRequest) => api.generateDraft(b), onSuccess: invalidate });
}

export function useGradePost() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => api.gradePost(id), onSuccess: invalidate });
}

export function useApplyFix() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, fixIndex }: { id: string; fixIndex: number }) => api.applyFix(id, fixIndex),
    onSuccess: invalidate,
  });
}

export function useRepurpose() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: api.repurpose, onSuccess: invalidate });
}

export function useFolders() {
  return useQuery({ queryKey: keys.folders(), queryFn: api.listFolders, staleTime: 60_000 });
}

export function useCreateFolder() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (name: string) => api.createFolder(name), onSuccess: invalidate });
}

export function useRenameFolder() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.renameFolder(id, name),
    onSuccess: invalidate,
  });
}

export function useDeleteFolder() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => api.deleteFolder(id), onSuccess: invalidate });
}

export function useMedia(enabled = true) {
  return useQuery({ queryKey: keys.media(), queryFn: api.listMedia, enabled, staleTime: 60_000 });
}

export function useUploadMedia() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (file: File) => api.uploadMedia(file), onSuccess: invalidate });
}

export function useDeleteMedia() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => api.deleteMedia(id), onSuccess: invalidate });
}

export function useAnalytics(from?: string, to?: string) {
  return useQuery({ queryKey: keys.analytics(from, to), queryFn: () => api.getAnalytics(from, to), staleTime: 60_000 });
}

export function useSeedShowcase() {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: api.seedShowcase, onSuccess: invalidate });
}
