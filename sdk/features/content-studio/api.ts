/**
 * Content Studio - API functions.
 *
 * Every request goes through the shared apiClient and the Next.js catch-all
 * proxy (/api/[feature]/...) to LAD_backend's /api/content-studio. Tenant
 * scoping is applied server-side from the caller's token. Scheduling only ever
 * calls Mr LAD's own scheduler endpoints below - there is no third-party
 * publishing API anywhere in this feature.
 */
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../../shared/apiClient';
import { safeStorage } from '../../shared/storage';
import type {
  Analytics,
  AudiencePanel,
  BrandInfo,
  ImportGeneratedRequest,
  AudienceTest,
  AudienceTestRequest,
  BulkPatch,
  Calibration,
  ChannelInfo,
  ContentPost,
  DraftRequest,
  Folder,
  Gap,
  HookOption,
  Idea,
  MediaItem,
  PlanSlot,
  Platform,
  PostListQuery,
  PostPatch,
  PostVersion,
  StudioSettings,
  TodaySummary,
} from './types';

const BASE = '/api/content-studio';

interface Envelope<T> {
  success: boolean;
  data: T;
}

function qs(params?: object): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') search.append(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

async function get<T>(path: string): Promise<T> {
  const res = await apiGet<Envelope<T>>(`${BASE}${path}`);
  return res.data.data;
}
async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await apiPost<Envelope<T>>(`${BASE}${path}`, body ?? {});
  return res.data.data;
}
async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await apiPut<Envelope<T>>(`${BASE}${path}`, body);
  return res.data.data;
}
async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await apiPatch<Envelope<T>>(`${BASE}${path}`, body);
  return res.data.data;
}
async function del<T>(path: string): Promise<T> {
  const res = await apiDelete<Envelope<T>>(`${BASE}${path}`);
  return res.data.data;
}

export const contentStudioKeys = {
  all: ['contentStudio'] as const,
  settings: () => [...contentStudioKeys.all, 'settings'] as const,
  channels: () => [...contentStudioKeys.all, 'channels'] as const,
  today: () => [...contentStudioKeys.all, 'today'] as const,
  posts: () => [...contentStudioKeys.all, 'posts'] as const,
  postList: (q?: PostListQuery) => [...contentStudioKeys.posts(), 'list', q ?? {}] as const,
  post: (id: string) => [...contentStudioKeys.posts(), 'one', id] as const,
  versions: (id: string) => [...contentStudioKeys.all, 'versions', id] as const,
  planPreview: (startDate?: string, days?: number) =>
    [...contentStudioKeys.all, 'planPreview', startDate ?? '', days ?? 30] as const,
  gaps: (from?: string, to?: string) => [...contentStudioKeys.all, 'gaps', from ?? '', to ?? ''] as const,
  folders: () => [...contentStudioKeys.all, 'folders'] as const,
  media: () => [...contentStudioKeys.all, 'media'] as const,
  analytics: (from?: string, to?: string) => [...contentStudioKeys.all, 'analytics', from ?? '', to ?? ''] as const,
  audiencePanel: () => [...contentStudioKeys.all, 'audiencePanel'] as const,
  audienceTests: (postId: string) => [...contentStudioKeys.all, 'audienceTests', postId] as const,
  calibration: () => [...contentStudioKeys.all, 'calibration'] as const,
  brand: () => [...contentStudioKeys.all, 'brand'] as const,
};

// ── settings & channels ────────────────────────────────────────────────────
export const getSettings = () => get<StudioSettings>('/settings');
export const saveSettings = (s: Partial<StudioSettings>) => put<StudioSettings>('/settings', s);
export const getChannels = () => get<ChannelInfo[]>('/channels');

// ── today & plan ───────────────────────────────────────────────────────────
export const getToday = () => get<TodaySummary>('/today');
export const previewPlan = (body: { startDate?: string; days?: number }) =>
  post<{ slots: PlanSlot[]; gaps: Gap[] }>('/plan/preview', body);
export const generatePlan = (body: { startDate?: string; days?: number }) =>
  post<{ created: ContentPost[]; kept: number; gaps: Gap[] }>('/plan/generate', body);
export const getGaps = (from?: string, to?: string) => get<Gap[]>(`/plan/gaps${qs({ from, to })}`);
export const fillGaps = (body: { dates: string[]; pillar?: string; draft?: boolean }) =>
  post<{ created: ContentPost[] }>('/plan/fill-gaps', body);

// ── posts ──────────────────────────────────────────────────────────────────
export const listPosts = (q?: PostListQuery) =>
  get<{ posts: ContentPost[]; total: number }>(`/posts${qs(q)}`);
export const getPost = (id: string) => get<ContentPost>(`/posts/${id}`);
export const createPost = (p: PostPatch & { platform: Platform }) => post<ContentPost>('/posts', p);
export const updatePost = (id: string, p: PostPatch) => patch<ContentPost>(`/posts/${id}`, p);
export const deletePost = (id: string) => del<{ id: string }>(`/posts/${id}`);
export const duplicatePost = (id: string, body?: { platform?: Platform; scheduledAt?: string }) =>
  post<ContentPost>(`/posts/${id}/duplicate`, body);
export const bulkUpdate = (ids: string[], p: BulkPatch) =>
  post<{ updated: ContentPost[] }>('/posts/bulk', { ids, patch: p });
export const listVersions = (id: string) => get<PostVersion[]>(`/posts/${id}/versions`);
export const restoreVersion = (id: string, version: number) =>
  post<ContentPost>(`/posts/${id}/versions/${version}/restore`);

// ── Mr LAD scheduler ──────────────────────────────────────────────────────
export const schedulePost = (id: string, scheduledAt: string) =>
  post<ContentPost>(`/posts/${id}/schedule`, { scheduledAt });
export const unschedulePost = (id: string) => post<ContentPost>(`/posts/${id}/unschedule`);
export const approvePost = (id: string) => post<ContentPost>(`/posts/${id}/approve`);
export const markPosted = (id: string, url?: string) => post<ContentPost>(`/posts/${id}/mark-posted`, { url });
export const retryPost = (id: string) => post<ContentPost>(`/posts/${id}/retry`);

// ── writing help ──────────────────────────────────────────────────────────
export const generateHooks = (body: { topic: string; platform: Platform; angle?: string; postId?: string }) =>
  post<{ hooks: HookOption[] }>('/generate/hooks', body);
export const generateIdeas = (body: { platform?: Platform; count?: number }) =>
  post<{ ideas: Idea[] }>('/generate/ideas', body);
export const generateDraft = (body: DraftRequest) => post<ContentPost>('/generate/draft', body);
export const gradePost = (id: string) => post<ContentPost>(`/posts/${id}/grade`);
export const applyFix = (id: string, fixIndex: number) => post<ContentPost>(`/posts/${id}/apply-fix`, { fixIndex });
export const repurpose = (body: { source: string; title?: string }) =>
  post<{ posts: ContentPost[] }>('/generate/repurpose', body);

// ── library ───────────────────────────────────────────────────────────────
export const listFolders = () => get<Folder[]>('/folders');
export const createFolder = (name: string) => post<Folder>('/folders', { name });
export const renameFolder = (id: string, name: string) => patch<Folder>(`/folders/${id}`, { name });
export const deleteFolder = (id: string) => del<{ id: string }>(`/folders/${id}`);
export const listMedia = () => get<MediaItem[]>('/media');
export const deleteMedia = (id: string) => del<{ id: string }>(`/media/${id}`);
/** Copy a Media Hub output (a short-lived signed URL) into the post library for good. */
export const importGeneratedMedia = (body: ImportGeneratedRequest) => post<MediaItem>('/media/import-generated', body);
export const getBrand = () => get<BrandInfo>('/brand');

/**
 * Upload goes as multipart, which the JSON apiClient can't send - same raw
 * fetch the promo-video feature uses, with the same bearer token.
 */
export async function uploadMedia(file: File): Promise<MediaItem> {
  const token = typeof window !== 'undefined' ? safeStorage.getItem('token') : null;
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/media`, {
    method: 'POST',
    body: form,
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'Upload failed. Try a PNG, JPEG or WebP under 10 MB.');
  return body.data as MediaItem;
}

// ── audience test ─────────────────────────────────────────────────────────
export const getAudiencePanel = () => get<{ panel: AudiencePanel | null }>('/audience/panel');
export const buildAudiencePanel = () => post<{ panel: AudiencePanel }>('/audience/panel');
export const runAudienceTest = (postId: string, body: AudienceTestRequest) =>
  post<AudienceTest>(`/posts/${postId}/audience-tests`, body);
export const listAudienceTests = (postId: string) => get<AudienceTest[]>(`/posts/${postId}/audience-tests`);
export const applyAudienceFix = (postId: string, testId: string) =>
  post<ContentPost>(`/posts/${postId}/audience-tests/${testId}/apply-fix`);
export const getCalibration = () => get<Calibration>('/audience/calibration');

// ── analytics & seed ──────────────────────────────────────────────────────
export const getAnalytics = (from?: string, to?: string) => get<Analytics>(`/analytics${qs({ from, to })}`);
export const seedShowcase = () => post<{ created: number }>('/seed-showcase');
