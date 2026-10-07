/**
 * Content Studio downloads. Every file is built in the browser from the post
 * itself, so what downloads is exactly what is scheduled.
 *
 *  - carousel slides  → 1080 × 1080 PNG each, or one PDF (one slide per page)
 *  - caption          → TXT (hook, body, CTA, hashtags)
 *  - video script     → TXT (hook, timed scenes, CTA)
 *  - calendar         → CSV (one row per post) or PDF (month grid + list)
 */
import type { ContentPost } from '@lad/frontend-features/content-studio';
import { buildCsv, downloadCsv } from '@/lib/csv';
import { buildPdf, canvasToJpeg, type PdfPage } from './pdf';
import { FORMAT_LABEL, PLATFORM_META, STATUS_META, captionOf, postTitle } from './meta';
import { addDays, daysInMonth, friendlyTime, localDate, localTime, monthName, startOfMonth, weekdayIndex } from './time';

export interface BrandLook {
  name: string;
  /** Cover slide fill; must carry white text at 4.5:1 or better. */
  primary: string;
}

export const DEFAULT_BRAND: BrandLook = { name: 'Mr LAD', primary: '#0B1957' };

const INK = '#0E1530';
const INK_SOFT = '#4A5470';
const LINE = '#E3E7F0';

export function slug(s: string): string {
  return (
    (s || 'post')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'post'
  );
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ensureFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load('600 64px "Space Grotesk"'),
      document.fonts.load('400 40px "Inter"'),
      document.fonts.load('600 28px "Inter"'),
    ]);
  } catch {
    /* fall back to system fonts - the file still downloads */
  }
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of (text || '').split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = '';
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = next;
      }
    }
    lines.push(line);
  }
  return lines;
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): number {
  const lines = wrapLines(ctx, text, maxWidth);
  const shown = lines.slice(0, maxLines);
  if (lines.length > maxLines) shown[maxLines - 1] = `${shown[maxLines - 1].replace(/\s+\S*$/, '')}…`;
  shown.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return y + shown.length * lineHeight;
}

/** Draw one carousel slide on a 1080 × 1080 canvas. */
export function drawSlide(
  canvas: HTMLCanvasElement,
  slide: { heading: string; text: string },
  index: number,
  count: number,
  brand: BrandLook = DEFAULT_BRAND
): void {
  const S = 1080;
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw slides.');
  const cover = index === 0;
  ctx.fillStyle = cover ? brand.primary : '#FFFFFF';
  ctx.fillRect(0, 0, S, S);
  if (!cover) {
    ctx.fillStyle = brand.primary;
    ctx.fillRect(0, 0, S, 16);
  }
  const fg = cover ? '#FFFFFF' : INK;
  const soft = cover ? 'rgba(255,255,255,0.86)' : INK_SOFT;
  const pad = 88;
  const width = S - pad * 2;

  ctx.textBaseline = 'top';
  ctx.fillStyle = soft;
  ctx.font = '600 28px "Inter", system-ui, sans-serif';
  ctx.fillText(`${index + 1} / ${count}`, pad, pad);

  ctx.fillStyle = fg;
  ctx.font = `600 ${cover ? 76 : 64}px "Space Grotesk", system-ui, sans-serif`;
  const y = drawBlock(ctx, slide.heading || '', pad, cover ? 300 : 260, width, cover ? 92 : 78, cover ? 5 : 4);

  if (slide.text) {
    ctx.fillStyle = soft;
    ctx.font = '400 40px "Inter", system-ui, sans-serif';
    drawBlock(ctx, slide.text, pad, y + 36, width, 56, 6);
  }

  ctx.fillStyle = soft;
  ctx.font = '600 28px "Inter", system-ui, sans-serif';
  const name = brand.name || 'Mr LAD';
  ctx.fillText(name, S - pad - ctx.measureText(name).width, S - pad - 28);
  if (!cover && index < count - 1) ctx.fillText('Swipe →', pad, S - pad - 28);
}

async function slideCanvases(post: ContentPost, brand: BrandLook): Promise<HTMLCanvasElement[]> {
  await ensureFonts();
  const slides = post.slides?.length ? post.slides : [{ heading: post.hook, text: post.body }];
  return slides.map((s, i) => {
    const c = document.createElement('canvas');
    drawSlide(c, s, i, slides.length, brand);
    return c;
  });
}

function canvasToPng(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not draw this slide.'))), 'image/png')
  );
}

/** One PNG per slide. Returns the filenames, in order. */
export async function downloadSlidesPng(post: ContentPost, brand: BrandLook = DEFAULT_BRAND): Promise<string[]> {
  const canvases = await slideCanvases(post, brand);
  const base = slug(postTitle(post));
  const names: string[] = [];
  for (let i = 0; i < canvases.length; i++) {
    const name = `${base}-slide-${String(i + 1).padStart(2, '0')}.png`;
    downloadBlob(await canvasToPng(canvases[i]), name);
    names.push(name);
    // Browsers drop rapid back-to-back downloads; space them out.
    if (i < canvases.length - 1) await wait(350);
  }
  return names;
}

/** All slides in one PDF, one square page per slide. */
export async function downloadSlidesPdf(post: ContentPost, brand: BrandLook = DEFAULT_BRAND): Promise<string> {
  const canvases = await slideCanvases(post, brand);
  const pages: PdfPage[] = [];
  for (const c of canvases) {
    pages.push({ jpeg: await canvasToJpeg(c), pxWidth: c.width, pxHeight: c.height, ptWidth: 540, ptHeight: 540 });
  }
  const name = `${slug(postTitle(post))}-slides.pdf`;
  downloadBlob(buildPdf(pages, postTitle(post)), name);
  return name;
}

function header(post: ContentPost): string {
  const meta = PLATFORM_META[post.platform];
  const when = post.scheduledAt
    ? `${localDate(post.scheduledAt, post.timezone)} ${localTime(post.scheduledAt, post.timezone)} (${post.timezone})`
    : 'Not scheduled';
  return [
    postTitle(post),
    `${meta.label} · ${FORMAT_LABEL[post.format]}${post.pillar ? ` · ${post.pillar}` : ''}`,
    `Status: ${STATUS_META[post.status].label} · ${when}`,
    post.score != null ? `Score: ${post.score} / 10` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function captionTxt(post: ContentPost): string {
  const sections = [
    header(post),
    `HOOK\n${post.hook || ''}`,
    `BODY\n${post.body || ''}`,
    `CTA\n${post.cta || ''}`,
    post.hashtags?.length ? `HASHTAGS\n${post.hashtags.join(' ')}` : '',
    post.format === 'thread' && post.threadParts?.length
      ? `THREAD\n${[post.hook, ...post.threadParts].map((t, i) => `${i + 1}/ ${t}`).join('\n\n')}`
      : '',
    post.format === 'carousel' && post.slides?.length
      ? `SLIDES\n${post.slides.map((s, i) => `${i + 1}. ${s.heading}${s.text ? `\n   ${s.text}` : ''}`).join('\n')}`
      : '',
    `READY TO PASTE\n${captionOf(post)}`,
  ];
  return `${sections.filter(Boolean).join('\n\n')}\n`;
}

export function scriptTxt(post: ContentPost): string {
  const s = post.script;
  if (!s) return captionTxt(post);
  let t = 0;
  const stamp = (secs: number) => {
    const from = t;
    t += secs || 0;
    return `${from}s to ${t}s`;
  };
  const lines: string[] = [header(post), `Length: about ${s.durationSeconds} seconds`, ''];
  lines.push(`HOOK (${stamp(s.hook.seconds)})`, `Say: ${s.hook.spoken}`, `On screen: ${s.hook.onScreen || '(none)'}`, '');
  s.scenes.forEach((b, i) => {
    lines.push(`SCENE ${i + 1} (${stamp(b.seconds)})`, `Say: ${b.spoken}`);
    if (b.onScreen) lines.push(`On screen: ${b.onScreen}`);
    if (b.visual) lines.push(`Show: ${b.visual}`);
    lines.push('');
  });
  lines.push(`CTA (${stamp(s.cta.seconds)})`, `Say: ${s.cta.spoken}`, `On screen: ${s.cta.onScreen || '(none)'}`, '');
  lines.push('CAPTION', captionOf(post), '');
  return lines.join('\n');
}

export function downloadText(text: string, filename: string): void {
  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), filename);
}

export function downloadCaptionTxt(post: ContentPost): string {
  const name = `${slug(postTitle(post))}-caption.txt`;
  downloadText(captionTxt(post), name);
  return name;
}

export function downloadScriptTxt(post: ContentPost): string {
  const name = `${slug(postTitle(post))}-script.txt`;
  downloadText(scriptTxt(post), name);
  return name;
}

// ── calendar ───────────────────────────────────────────────────────────────

const CSV_HEADER = [
  'Date', 'Time', 'Timezone', 'Platform', 'Format', 'Pillar', 'Status', 'Approval',
  'Title', 'Hook', 'Caption', 'Hashtags', 'Score', 'Publishing',
];

function sortByTime(posts: ContentPost[]): ContentPost[] {
  return [...posts].sort((a, b) => (a.scheduledAt || '').localeCompare(b.scheduledAt || ''));
}

export function calendarCsv(posts: ContentPost[]): string {
  const rows = sortByTime(posts.filter((p) => p.scheduledAt)).map((p) => [
    localDate(p.scheduledAt as string, p.timezone),
    localTime(p.scheduledAt as string, p.timezone),
    p.timezone,
    PLATFORM_META[p.platform].label,
    FORMAT_LABEL[p.format],
    p.pillar || '',
    STATUS_META[p.status].label,
    p.approvalState === 'pending' ? 'Needs approval' : p.approvalState === 'approved' ? 'Approved' : '',
    postTitle(p),
    p.hook,
    captionOf(p),
    (p.hashtags || []).join(' '),
    p.score ?? '',
    p.publishMode === 'auto' ? 'Automatic' : 'Reminder',
  ]);
  return buildCsv(CSV_HEADER, rows);
}

export function downloadCalendarCsv(posts: ContentPost[], label: string): string {
  const name = `content-calendar-${slug(label)}.csv`;
  downloadCsv(name, calendarCsv(posts));
  return name;
}

function drawCalendarPage(canvas: HTMLCanvasElement, monthDate: string, posts: ContentPost[], tz: string, brand: BrandLook) {
  const W = 1684;
  const H = 1190;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw the calendar.');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  const [y, m] = monthDate.split('-').map(Number);
  ctx.textBaseline = 'top';
  ctx.fillStyle = INK;
  ctx.font = '600 44px "Space Grotesk", system-ui, sans-serif';
  ctx.fillText(`${brand.name} content calendar · ${monthName(m)} ${y}`, 64, 48);
  ctx.fillStyle = INK_SOFT;
  ctx.font = '400 22px "Inter", system-ui, sans-serif';
  ctx.fillText(`Times in ${tz}. ${posts.length} posts.`, 64, 104);

  const first = startOfMonth(monthDate);
  const lead = weekdayIndex(first);
  const nDays = daysInMonth(monthDate);
  const weeks = Math.ceil((lead + nDays) / 7);
  const top = 190;
  const left = 64;
  const cw = (W - 128) / 7;
  const ch = (H - top - 48) / weeks;
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((d, i) => {
    ctx.fillStyle = INK_SOFT;
    ctx.font = '600 20px "Inter", system-ui, sans-serif';
    ctx.fillText(d.toUpperCase(), left + i * cw + 10, top - 34);
  });
  const byDay = new Map<string, ContentPost[]>();
  for (const p of sortByTime(posts)) {
    if (!p.scheduledAt) continue;
    const d = localDate(p.scheduledAt, tz);
    byDay.set(d, [...(byDay.get(d) || []), p]);
  }
  for (let i = 0; i < weeks * 7; i++) {
    const x = left + (i % 7) * cw;
    const yy = top + Math.floor(i / 7) * ch;
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, yy, cw, ch);
    const dayNum = i - lead + 1;
    if (dayNum < 1 || dayNum > nDays) continue;
    const date = addDays(first, dayNum - 1);
    ctx.fillStyle = INK;
    ctx.font = '600 22px "Inter", system-ui, sans-serif';
    ctx.fillText(String(dayNum), x + 10, yy + 10);
    const items = byDay.get(date) || [];
    const maxRows = Math.max(1, Math.floor((ch - 46) / 30));
    items.slice(0, maxRows).forEach((p, r) => {
      const ry = yy + 42 + r * 30;
      const meta = PLATFORM_META[p.platform];
      ctx.fillStyle = meta.fill;
      ctx.fillRect(x + 10, ry, 34, 24);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 14px "Inter", system-ui, sans-serif';
      ctx.fillText(meta.glyph, x + 14, ry + 5);
      ctx.fillStyle = INK;
      ctx.font = '400 17px "Inter", system-ui, sans-serif';
      const label = `${friendlyTime(p.scheduledAt as string, tz)} ${postTitle(p)}`;
      let s = label;
      while (ctx.measureText(s).width > cw - 64 && s.length > 4) s = s.slice(0, -2);
      ctx.fillText(s === label ? s : `${s}…`, x + 50, ry + 3);
    });
    if (items.length > maxRows) {
      ctx.fillStyle = INK_SOFT;
      ctx.font = '600 16px "Inter", system-ui, sans-serif';
      ctx.fillText(`+${items.length - maxRows} more`, x + 10, yy + ch - 26);
    }
  }
}

function drawListPage(canvas: HTMLCanvasElement, title: string, rows: ContentPost[], tz: string, page: number, pages: number) {
  const W = 1684;
  const H = 1190;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw the calendar.');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'top';
  ctx.fillStyle = INK;
  ctx.font = '600 36px "Space Grotesk", system-ui, sans-serif';
  ctx.fillText(`${title} · posts ${page}/${pages}`, 64, 48);
  const cols = [64, 300, 420, 600, 780, 960];
  const heads = ['Date', 'Time', 'Platform', 'Status', 'Pillar', 'Post'];
  ctx.fillStyle = INK_SOFT;
  ctx.font = '600 18px "Inter", system-ui, sans-serif';
  heads.forEach((h, i) => ctx.fillText(h.toUpperCase(), cols[i], 120));
  rows.forEach((p, r) => {
    const yy = 160 + r * 34;
    ctx.fillStyle = r % 2 ? '#F5F6FA' : '#FFFFFF';
    ctx.fillRect(56, yy - 6, W - 112, 34);
    ctx.fillStyle = INK;
    ctx.font = '400 18px "Inter", system-ui, sans-serif';
    const vals = [
      p.scheduledAt ? localDate(p.scheduledAt, tz) : '',
      p.scheduledAt ? friendlyTime(p.scheduledAt, tz) : '',
      PLATFORM_META[p.platform].label,
      STATUS_META[p.status].label,
      p.pillar || '',
      postTitle(p),
    ];
    vals.forEach((v, i) => {
      let s = String(v);
      const maxW = (i < 5 ? cols[i + 1] - cols[i] : W - 64 - cols[i]) - 16;
      while (ctx.measureText(s).width > maxW && s.length > 4) s = s.slice(0, -2);
      ctx.fillText(s === String(v) ? s : `${s}…`, cols[i], yy);
    });
  });
}

/** Month grid page plus list pages (28 posts per page), A4 landscape. */
export async function downloadCalendarPdf(
  posts: ContentPost[],
  monthDate: string,
  tz: string,
  brand: BrandLook = DEFAULT_BRAND
): Promise<string> {
  await ensureFonts();
  const scheduled = sortByTime(posts.filter((p) => p.scheduledAt));
  const canvases: HTMLCanvasElement[] = [];
  const grid = document.createElement('canvas');
  drawCalendarPage(grid, monthDate, scheduled, tz, brand);
  canvases.push(grid);
  const per = 28;
  const pages = Math.max(1, Math.ceil(scheduled.length / per));
  const [y, m] = monthDate.split('-').map(Number);
  const title = `${monthName(m)} ${y}`;
  for (let i = 0; i < pages && scheduled.length; i++) {
    const c = document.createElement('canvas');
    drawListPage(c, title, scheduled.slice(i * per, (i + 1) * per), tz, i + 1, pages);
    canvases.push(c);
  }
  const pdfPages: PdfPage[] = [];
  for (const c of canvases) {
    pdfPages.push({ jpeg: await canvasToJpeg(c, 0.9), pxWidth: c.width, pxHeight: c.height, ptWidth: 842, ptHeight: 595 });
  }
  const name = `content-calendar-${slug(title)}.pdf`;
  downloadBlob(buildPdf(pdfPages, `${brand.name} content calendar ${title}`), name);
  return name;
}
