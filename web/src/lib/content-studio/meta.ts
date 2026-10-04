/**
 * Content Studio display metadata: platform colours, status chips, labels.
 *
 * Every colour pair here was measured for contrast (design board, Main
 * artboard): platform fills carry white text at 5.69:1 or better, status chips
 * are dark-on-tint at 5.82:1 or better in light and 8.4:1 or better in dark.
 * LinkedIn and Facebook are both blue, so a platform is never shown by colour
 * alone - always with its glyph.
 */
import type { Angle, ContentPost, Goal, Platform, PostFormat, PostStatus } from '@lad/frontend-features/content-studio';

export const PLATFORM_META: Record<
  Platform,
  { label: string; glyph: string; fill: string; darkText: string; limit: number; foldAt: number | null }
> = {
  linkedin: { label: 'LinkedIn', glyph: 'in', fill: '#0A66C2', darkText: '#5AA2F0', limit: 3000, foldAt: 140 },
  instagram: { label: 'Instagram', glyph: 'IG', fill: '#B3246F', darkText: '#F07AB8', limit: 2200, foldAt: 125 },
  facebook: { label: 'Facebook', glyph: 'f', fill: '#1658C8', darkText: '#7AA8FF', limit: 63206, foldAt: 80 },
  x: { label: 'X', glyph: 'X', fill: '#14171A', darkText: '#E8ECF7', limit: 280, foldAt: null },
  tiktok: { label: 'TikTok', glyph: 'TT', fill: '#0B6E73', darkText: '#4FD1C5', limit: 2200, foldAt: 150 },
};

export const STATUS_META: Record<PostStatus, { label: string; hint: string; cls: string }> = {
  idea: { label: 'Idea', hint: 'Topic only', cls: 'bg-[#ECEEF3] text-[#3B4256] dark:bg-[#2A3150] dark:text-[#D5DAE6]' },
  draft: { label: 'Draft', hint: 'Written, not checked', cls: 'bg-[#FFF1D6] text-[#7A4A00] dark:bg-[#3A2A0A] dark:text-[#FFD48A]' },
  ready: { label: 'Ready', hint: 'Graded, waiting for a time', cls: 'bg-[#E3EDFF] text-[#13489E] dark:bg-[#142A55] dark:text-[#AFC9FF]' },
  scheduled: { label: 'Scheduled', hint: 'On Mr LAD’s scheduler', cls: 'bg-[#EFE6FF] text-[#5B2A9E] dark:bg-[#2E1E52] dark:text-[#D6C2FF]' },
  published: { label: 'Published', hint: 'Live on the platform', cls: 'bg-[#DDF5E7] text-[#0F6A3B] dark:bg-[#0F3A25] dark:text-[#9BE3B8]' },
  failed: { label: 'Failed', hint: 'Publishing failed, retry', cls: 'bg-[#FDE4E6] text-[#A1202B] dark:bg-[#4A1218] dark:text-[#FFB3B9]' },
};

export const HASHTAG_HINT: Record<Platform, string> = {
  linkedin: 'Optional on LinkedIn: up to 5 at the end.',
  instagram: 'Instagram: 3 to 5 niche hashtags at the end.',
  facebook: 'Leave empty on Facebook; hashtags don’t help there.',
  x: 'Leave empty on X; hashtags cost characters and reach.',
  tiktok: 'TikTok: up to 5, keyword first.',
};

export const APPROVAL_CHIP = 'bg-[#FFF1D6] text-[#7A4A00] dark:bg-[#3A2A0A] dark:text-[#FFD48A]';

export const FORMAT_LABEL: Record<PostFormat, string> = {
  post: 'Post',
  carousel: 'Carousel',
  video_script: 'Video script',
  thread: 'Thread',
};

/** What the client calls the format on that platform ("Instagram · Reel"). */
export function formatName(platform: Platform, format: PostFormat): string {
  if (format !== 'video_script') return FORMAT_LABEL[format];
  if (platform === 'instagram') return 'Reel';
  if (platform === 'tiktok') return 'Short video';
  return 'Video';
}

/** Formats each platform supports, first = default. */
export const PLATFORM_FORMATS: Record<Platform, PostFormat[]> = {
  linkedin: ['post', 'carousel', 'video_script'],
  instagram: ['carousel', 'video_script', 'post'],
  facebook: ['post', 'video_script'],
  x: ['post', 'thread'],
  tiktok: ['video_script'],
};

export const ANGLE_LABEL: Record<Angle, string> = {
  polarizing_opinion: 'Strong opinion',
  receipts_number: 'Proof with a number',
  vulnerable_confession: 'Honest confession',
  customer_transformation: 'Customer before and after',
  most_people_wrong: 'Common mistake',
};

export const GOAL_LABEL: Record<Goal, string> = {
  book_meetings: 'Book meetings',
  generate_leads: 'Generate leads',
  grow_followers: 'Grow followers',
  build_authority: 'Build authority',
  launch_offer: 'Launch an offer',
};

/** The caption a platform would show, in posting order. */
export function captionOf(p: Pick<ContentPost, 'hook' | 'body' | 'cta' | 'hashtags'>): string {
  const parts = [p.hook, p.body, p.cta].map((s) => (s || '').trim()).filter(Boolean);
  const tags = (p.hashtags || []).filter(Boolean).join(' ');
  return [...parts, tags].filter(Boolean).join('\n\n');
}

/** Short label for a post in lists: its title, else the hook. */
/** Server notes may arrive without a full stop; show them as sentences. */
export function sentence(text: string): string {
  const t = (text || '').trim();
  return !t || /[.!?]$/.test(t) ? t : `${t}.`;
}

export function postTitle(p: Pick<ContentPost, 'title' | 'hook'>): string {
  return (p.title || p.hook || 'Untitled post').trim();
}

/** Score sub-line used on cards: "Hook 9 · Voice 8.5 · Platform fit 9". */
export function scoreSubline(p: ContentPost): string {
  const g = p.grade;
  if (!g) return 'Not graded yet';
  const d = g.dimensions;
  return `Hook ${d.hook} · Voice ${d.voice} · Platform fit ${d.platformFit}`;
}
