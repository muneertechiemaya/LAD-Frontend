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
  /** Also one of the image maker's reference images ("Mr LAD can use this when making images"). */
  usedForImages?: boolean;
  /** The image maker's asset id while usedForImages is on. */
  referenceAssetId?: string | null;
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

// ── audience test ("Test with your audience") ─────────────────────────────
// A panel of 20 simulated people modelled on the tenant's buyers reacts to a
// post before it goes out. Results are counts out of the panel; the only
// numeric prediction is a LinkedIn engagement-rate range, and only once real
// numbers have calibrated it (Calibration.status === 'ready').

export type AudienceSegment = 'buyer' | 'peer' | 'casual';
export type Habit = 'daily' | 'weekly' | 'rarely';

export interface AudiencePersona {
  id: string;
  /** "Head of Operations · Logistics · Dubai" - never a personal name. */
  label: string;
  segment: AudienceSegment;
  /** Role family, plural: "Operations heads". */
  group: string;
  seniority: string | null;
  industry: string | null;
  region: string | null;
  cares: string[];
  scrollsPast: string[];
  platforms: Partial<Record<Platform, Habit>>;
}

export interface AudiencePanel {
  id: string;
  personas: AudiencePersona[];
  source: { leadsUsed: number; usedProfile: boolean; buyers: number; peers: number; casual: number };
  builtAt: string;
  builtBy: string | null;
}

export type ObjectionKind =
  | 'not_for_me'
  | 'unclear'
  | 'too_long'
  | 'sounds_like_an_ad'
  | 'no_proof'
  | 'too_generic'
  | 'tone'
  | 'other';

export type ReactionKind = 'none' | 'like' | 'insightful' | 'celebrate' | 'support' | 'funny' | 'love';

export interface PersonaReaction {
  personaId: string;
  stopped: boolean;
  readAll: boolean;
  reaction: ReactionKind;
  comment: string | null;
  share: boolean;
  message: boolean;
  objection: { kind: ObjectionKind; text: string } | null;
  why: string;
}

export interface HookPick {
  personaId: string;
  /** Index into the tested hooks; null = none of them would stop this person. */
  pick: number | null;
  why: string;
}

export interface GroupStat {
  group: string;
  stopped: number;
  size: number;
}

export type PredictionStatus = 'not_linkedin' | 'collecting' | 'weak' | 'ready';

export interface AudienceTestSummary {
  answered: number;
  panelSize: number;
  degraded: boolean;
  counts: { stopped: number; readAll: number; reacted: number; commented: number; shared: number; messaged: number } | null;
  panelScore: number | null;
  segments: { segment: AudienceSegment; size: number; stopped: number }[];
  landsWith: GroupStat | null;
  misses: GroupStat | null;
  objections: { kind: ObjectionKind; count: number; example: string }[];
  comments: { personaLabel: string; text: string }[];
  fix: GradeFix | null;
  hooks: { text: string; picks: number; score: number }[] | null;
  winner: number | null;
  history: { tested: number; betterThan: number } | null;
  prediction: { metric: 'engagementRate'; low: number; high: number; basedOn: number } | null;
  predictionStatus: PredictionStatus;
  predictionNeed: { have: number; need: number } | null;
}

export type AudienceVariant = 'post' | 'hooks';

export interface AudienceTest {
  id: string;
  postId: string;
  panelId: string;
  postVersion: number;
  platform: Platform;
  variant: AudienceVariant;
  createdAt: string;
  createdBy: string | null;
  cached?: boolean;
  summary: AudienceTestSummary;
  reactions: Array<PersonaReaction | HookPick>;
}

export interface AudienceTestRequest {
  variant: AudienceVariant;
  hooks?: string[];
  force?: boolean;
}

export interface Calibration {
  status: 'collecting' | 'weak' | 'ready';
  platform: 'linkedin';
  have: number;
  need: number;
  rho: number | null;
  points: {
    postId: string;
    title: string;
    panelScore: number;
    engagementRate: number;
    predictedLow: number | null;
    predictedHigh: number | null;
    publishedAt: string;
  }[];
}

// ── media hub bridge ──────────────────────────────────────────────────────

/** The Media brand profile, for drawing slides in the client's colours. */
export interface BrandInfo {
  source: 'media' | 'none';
  name: string | null;
  tagline: string | null;
  /** Hex, primary first, at most 5. */
  colors: string[];
  /** True when the Media service couldn't be reached (not the same as "no profile"). */
  degraded: boolean;
}

export interface ImportGeneratedRequest {
  sourceUrl: string;
  filename?: string;
  mediaType?: 'image' | 'video';
}
