/**
 * Content Studio - types. Mirrors the backend contract
 * (LAD_backend features/content-studio, /api/content-studio).
 */

export type Platform = 'linkedin' | 'instagram' | 'facebook' | 'x' | 'tiktok';
export type PostFormat = 'post' | 'carousel' | 'video_script' | 'thread';
export type PostStatus = 'idea' | 'draft' | 'ready' | 'scheduled' | 'published' | 'failed';
export type ApprovalState = 'not_required' | 'pending' | 'approved';
export type PublishMode = 'auto' | 'reminder';
export type Angle =
  | 'polarizing_opinion'
  | 'receipts_number'
  | 'vulnerable_confession'
  | 'customer_transformation'
  | 'most_people_wrong';
export type Goal = 'book_meetings' | 'generate_leads' | 'grow_followers' | 'build_authority' | 'launch_offer';

export const PLATFORMS: readonly Platform[] = ['linkedin', 'instagram', 'facebook', 'x', 'tiktok'];
export const STATUSES: readonly PostStatus[] = ['idea', 'draft', 'ready', 'scheduled', 'published', 'failed'];

export interface Pillar {
  id: string;
  name: string;
  weight: number;
  color: string;
}

export interface BrandBrief {
  business: string;
  customer: string;
  primaryCta: string;
  strongOpinion: string;
  storyVault: string[];
  voice: string[];
  voiceWords?: string;
}

export interface StudioSettings {
  brandBrief: BrandBrief | null;
  goals: Goal[];
  pillars: Pillar[];
  frequency: Partial<Record<Platform, number>>;
  windows: Partial<Record<Platform, string>>;
  timezone: string;
  approvalRequired: boolean;
  maxPostsPerDay: number;
  autoMaintain: boolean;
  updatedAt: string | null;
}

export interface Slide {
  heading: string;
  text: string;
  imageUrl?: string | null;
}

export interface ScriptBeat {
  seconds: number;
  spoken: string;
  onScreen: string;
  visual?: string;
}

export interface VideoScript {
  durationSeconds: number;
  hook: { spoken: string; onScreen: string; seconds: number };
  scenes: ScriptBeat[];
  cta: { spoken: string; onScreen: string; seconds: number };
}

export interface GradeFix {
  issue: string;
  current: string;
  why: string;
  fix: string;
}

export type VoiceRule =
  | 'em_dashes'
  | 'contractions'
  | 'numbers_as_digits'
  | 'active_voice'
  | 'filler_words'
  | 'filler_openers'
  | 'hashtag_count';

export interface VoiceRuleResult {
  rule: VoiceRule;
  pass: boolean;
  violation?: string;
}

export interface GradeDimensions {
  hook: number;
  specificity: number;
  emotion: number;
  shareability: number;
  voice: number;
  polarity: number;
  platformFit: number;
}

export interface Grade {
  score: number;
  dimensions: GradeDimensions;
  voiceRules: VoiceRuleResult[];
  fixes: GradeFix[];
  gradedAt: string;
}

export interface ContentPost {
  id: string;
  platform: Platform;
  format: PostFormat;
  pillar: string | null;
  status: PostStatus;
  approvalState: ApprovalState;
  publishMode: PublishMode;
  title: string;
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  slides: Slide[];
  script: VideoScript | null;
  threadParts?: string[];
  angle: Angle | null;
  hookPattern: string | null;
  grade: Grade | null;
  score: number | null;
  scheduledAt: string | null;
  timezone: string;
  folderId: string | null;
  isTemplate: boolean;
  isSample: boolean;
  mediaUrls: string[];
  version: number;
  locked: boolean;
  publishedAt: string | null;
  externalPostId: string | null;
  lastError: string | null;
  remindedAt: string | null;
  sourcePostId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PostPatch = Partial<
  Pick<
    ContentPost,
    | 'platform'
    | 'format'
    | 'pillar'
    | 'status'
    | 'title'
    | 'hook'
    | 'body'
    | 'cta'
    | 'hashtags'
    | 'slides'
    | 'script'
    | 'threadParts'
    | 'angle'
    | 'hookPattern'
    | 'scheduledAt'
    | 'folderId'
    | 'isTemplate'
    | 'mediaUrls'
  >
> & { reason?: string };

export interface PostVersion {
  version: number;
  reason: string;
  createdAt: string;
  createdBy: string | null;
  snapshot: Partial<ContentPost>;
}

export interface Folder {
  id: string;
  name: string;
  postCount: number;
}

export interface MediaItem {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface Gap {
  date: string;
  weekday: string;
  plannedPlatforms: Platform[];
}

export interface ChannelInfo {
  platform: Platform;
  mode: PublishMode;
  connected: boolean;
  note: string;
}

export interface PlanSlot {
  date: string;
  time: string;
  platform: Platform;
  format: PostFormat;
  pillar: string;
  angle: Angle;
}

export interface HookOption {
  text: string;
  category: string;
  pattern: string;
  first3: string;
  first3Pass: boolean;
}

export interface Idea {
  title: string;
  angle: Angle;
  why: string;
  platform?: Platform;
}

export interface Analytics {
  source: 'sample' | 'live' | 'mixed';
  label: string;
  range: { from: string; to: string };
  totals: {
    posts: number;
    published: number;
    scheduled: number;
    reach: number | string | null;
    engagementRate: number | null;
    newFollowers: number | null;
    leadsFromPosts: number | null;
  };
  bestTimes: { hour: number; score: number }[];
  followerGrowth: { weekStart: string; followers: number }[];
  topPosts: {
    postId: string;
    title: string;
    platform: Platform;
    metrics: Record<string, number | string>;
    leadsCreated: number | null;
    source: 'sample' | 'live';
  }[];
  byPillar: { pillar: string; posts: number }[];
  byPlatform: { platform: Platform; posts: number }[];
}

export interface TodayWeekDay {
  date: string;
  weekday: string;
  posts: { id: string; platform: Platform; status: PostStatus }[];
}

export interface TodaySummary {
  date: string;
  timezone: string;
  posts: ContentPost[];
  goingOut: number;
  needsApproval: number;
  gaps: Gap[];
  week: TodayWeekDay[];
  lastPublished:
    | (ContentPost & {
        metrics: Record<string, number | string> | null;
        metricsSource: 'sample' | 'live' | null;
      })
    | null;
}

export interface PostListQuery {
  from?: string;
  to?: string;
  platform?: Platform;
  status?: PostStatus;
  pillar?: string;
  q?: string;
  folderId?: string;
  template?: boolean;
  limit?: number;
  offset?: number;
}

export interface BulkPatch {
  pillar?: string;
  status?: PostStatus;
  folderId?: string | null;
  shiftMinutes?: number;
  approvalState?: ApprovalState;
}

export interface DraftRequest {
  postId?: string;
  topic?: string;
  platform?: Platform;
  format?: PostFormat;
  pillar?: string;
  angle?: Angle;
}
