'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Plus, Sparkles } from 'lucide-react';
import type { ContentPost, TodaySummary } from '@lad/frontend-features/content-studio';
import { useStudioSettings, useToday } from '@lad/frontend-features/content-studio';
import { greeting, longDate, todayLocal } from '@/lib/content-studio/time';
import { TodayView } from './TodayView';
import { PlanView } from './PlanView';
import { CalendarView } from './CalendarView';
import { Composer } from './Composer';
import { LibraryView } from './LibraryView';
import { DownloadsView } from './DownloadsView';
import { AnalyticsView } from './AnalyticsView';
import { MoveTimeDialog } from './MoveTimeDialog';
import { PreviewDialog } from './PreviewDialog';
import { BriefDialog } from './BriefDialog';
import { CoachDialog } from './CoachDialog';
import { Card, CsButton, ErrorNote, Label, SectionTitle, tone } from './ui';
import { cn } from '@/lib/utils';

export type AreaId = 'today' | 'plan' | 'calendar' | 'create' | 'library' | 'downloads' | 'analytics';

const AREAS: { id: AreaId; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'plan', label: 'Plan' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'create', label: 'Create' },
  { id: 'library', label: 'Library' },
  { id: 'downloads', label: 'Downloads' },
  { id: 'analytics', label: 'Analytics' },
];

const TITLES: Record<AreaId, string> = {
  today: '',
  plan: 'Your 30-day plan',
  calendar: 'Calendar',
  create: 'Create and edit',
  library: 'Library',
  downloads: 'Downloads',
  analytics: 'Analytics',
};

/**
 * "2 posts go out today." Showcase samples never publish until the client acts
 * on them, so they are counted separately rather than claimed as going out.
 */
function outLine(t: TodaySummary): string {
  const sampleOut = t.posts.filter((p) => p.isSample && p.status === 'scheduled').length;
  const realOut = Math.max(0, t.goingOut - sampleOut);
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  if (!realOut && !sampleOut) return 'Nothing goes out today.';
  if (!sampleOut) return `${n(realOut, 'post goes', 'posts go')} out today.`;
  if (!realOut) return `${n(sampleOut, 'sample post is', 'sample posts are')} lined up for today.`;
  return `${n(realOut, 'post goes', 'posts go')} out today, plus ${n(sampleOut, 'sample', 'samples')}.`;
}

function isArea(v: string | null): v is AreaId {
  return !!v && AREAS.some((a) => a.id === v);
}

export function ContentStudio() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tabParam = params.get('tab');
  const area: AreaId = isArea(tabParam) ? tabParam : 'today';
  const postId = params.get('post');
  const dateParam = params.get('date');

  const settings = useStudioSettings();
  const today = useToday();
  const tz = settings.data?.timezone || today.data?.timezone || 'Asia/Dubai';

  const [moveTime, setMoveTime] = useState<ContentPost | null>(null);
  const [preview, setPreview] = useState<ContentPost | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [coachOpen, setCoachOpen] = useState(false);

  const go = useCallback(
    (next: AreaId, extra?: Record<string, string | null>) => {
      const sp = new URLSearchParams(Array.from(params.entries()));
      sp.set('tab', next);
      sp.delete('post');
      sp.delete('date');
      for (const [k, v] of Object.entries(extra || {})) {
        if (v == null) sp.delete(k);
        else sp.set(k, v);
      }
      router.push(`${pathname}?${sp.toString()}`, { scroll: false });
    },
    [params, pathname, router]
  );

  const edit = useCallback((p: ContentPost) => go('create', { post: p.id }), [go]);
  const newPost = useCallback(() => go('create', { post: 'new' }), [go]);

  // Keep the active tab visible on a phone, where the strip scrolls sideways.
  const stripRef = useRef<HTMLDivElement>(null);
  const tapped = useRef(false);
  useEffect(() => {
    const strip = stripRef.current;
    const btn = strip?.querySelector<HTMLElement>(`[data-area="${area}"]`);
    if (!strip || !btn || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollTo({ left: btn.offsetLeft - (strip.clientWidth - btn.offsetWidth) / 2, behavior: tapped.current ? 'smooth' : 'auto' });
  }, [area]);

  const t = today.data;
  const headline =
    area === 'today'
      ? t
        ? `${greeting(tz)}. ${outLine(t)}${
            t.needsApproval ? ` ${t.needsApproval} ${t.needsApproval === 1 ? 'needs' : 'need'} your approval.` : ''
          }`
        : `${greeting(tz)}.`
      : TITLES[area];

  const briefMissing = settings.data && !settings.data.brandBrief;

  return (
    <div data-cs-root className={cn('mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-10 lg:py-8')}>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <Label>Content Studio · {longDate(todayLocal(tz))}</Label>
          <h1 className={cn('text-2xl font-bold leading-tight tracking-tight sm:text-[30px]', tone.ink)}>{headline}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <CsButton className="grow whitespace-nowrap sm:grow-0" onClick={() => (briefMissing ? setBriefOpen(true) : setCoachOpen(true))}>
            <Sparkles className="h-4 w-4" aria-hidden />
            Help me post something
          </CsButton>
          <CsButton variant="primary" className="grow whitespace-nowrap sm:grow-0" onClick={newPost}>
            <Plus className="h-4 w-4" aria-hidden />
            New post
          </CsButton>
        </div>
      </header>

      <nav aria-label="Content Studio areas" className={cn('rounded-xl border p-1', tone.line, tone.surface)}>
        <div ref={stripRef} className="relative flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {AREAS.map((a) => (
            <button
              key={a.id}
              type="button"
              data-area={a.id}
              aria-current={area === a.id ? 'page' : undefined}
              onClick={() => {
                tapped.current = true;
                go(a.id);
              }}
              className={cn(
                'min-h-11 shrink-0 rounded-lg px-4 text-sm font-semibold',
                tone.focus,
                tone.motion,
                area === a.id
                  ? 'bg-[#0B1957] text-white dark:bg-[#2563EB]'
                  : cn(tone.soft, 'hover:bg-[#ECEEF3] dark:hover:bg-[#18234A]')
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      </nav>

      {briefMissing ? (
        <Card className="flex flex-col gap-3 border-[#C9D8FF] bg-[#F2F6FF] p-4 dark:border-[#24407A] dark:bg-[#0F1D45] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <SectionTitle>Start with your brand brief</SectionTitle>
            <p className={cn('text-sm', tone.soft)}>
              6 short questions about what you sell, who buys and how you sound. Every post Mr LAD writes uses it.
            </p>
          </div>
          <CsButton variant="primary" onClick={() => setBriefOpen(true)}>
            Write my brief
          </CsButton>
        </Card>
      ) : null}

      <main className="min-w-0">
        {area === 'today' ? (
          today.isLoading ? (
            <p className={cn('text-sm', tone.soft)}>Loading today…</p>
          ) : today.data ? (
            <TodayView
              today={today.data}
              settings={settings.data}
              onEdit={edit}
              onPreview={setPreview}
              onMoveTime={setMoveTime}
              onOpenCalendar={(d) => go('calendar', { date: d || null, view: d ? 'day' : null })}
            />
          ) : (
            <ErrorNote error={today.error || new Error("Couldn't load today. Refresh to try again.")} />
          )
        ) : null}
        {area === 'plan' ? <PlanView settings={settings.data} settingsError={settings.error} /> : null}
        {area === 'calendar' ? (
          <CalendarView tz={tz} initialDate={dateParam} onEdit={edit} onMoveTime={setMoveTime} />
        ) : null}
        {area === 'create' ? (
          <Composer
            postId={postId}
            settings={settings.data}
            onOpenBrief={() => setBriefOpen(true)}
            onCreated={(p) => go('create', { post: p.id })}
            onDone={() => go('today')}
            onNew={newPost}
          />
        ) : null}
        {area === 'library' ? <LibraryView tz={tz} settings={settings.data} onEdit={edit} /> : null}
        {area === 'downloads' ? <DownloadsView tz={tz} /> : null}
        {area === 'analytics' ? <AnalyticsView /> : null}
      </main>

      <MoveTimeDialog post={moveTime} windowTime={moveTime ? settings.data?.windows?.[moveTime.platform] : undefined} onClose={() => setMoveTime(null)} />
      <PreviewDialog post={preview} onClose={() => setPreview(null)} onEdit={(p) => { setPreview(null); edit(p); }} />
      <BriefDialog open={briefOpen} onClose={() => setBriefOpen(false)} initial={settings.data?.brandBrief ?? null} />
      <CoachDialog
        open={coachOpen}
        onClose={() => setCoachOpen(false)}
        onNeedBrief={() => {
          setCoachOpen(false);
          setBriefOpen(true);
        }}
        onDrafted={(p) => {
          setCoachOpen(false);
          edit(p);
        }}
      />
    </div>
  );
}
