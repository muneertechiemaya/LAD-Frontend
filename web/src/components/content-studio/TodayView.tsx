'use client';
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Sparkles } from 'lucide-react';
import type { ContentPost, Gap, Pillar, StudioSettings, TodaySummary } from '@lad/frontend-features/content-studio';
import { useChannels, useFillGaps, usePosts } from '@lad/frontend-features/content-studio';
import { useToast } from '@/components/ui/app-toaster';
import { PLATFORM_META, postTitle, sentence } from '@/lib/content-studio/meta';
import { addDays, joinWords, weekdayName } from '@/lib/content-studio/time';
import { downloadCalendarCsv } from '@/lib/content-studio/exports';
import { PostCard, type PostCardActions } from './PostCard';
import { Card, CsButton, ErrorNote, Label, PlatformBadge, SampleChip, SectionTitle, tone } from './ui';
import { cn } from '@/lib/utils';

const DISMISS_KEY = 'lad.contentStudio.dismissedGaps';

function readDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || '[]');
  } catch {
    return [];
  }
}

/** Pillar that is furthest below its share of the next two weeks' posts. */
function neediestPillar(pillars: Pillar[], upcoming: ContentPost[]): Pillar | null {
  if (!pillars.length) return null;
  const total = Math.max(upcoming.length, 1);
  let best: Pillar | null = null;
  let bestGap = -Infinity;
  for (const p of pillars) {
    const have = upcoming.filter((u) => u.pillar === p.name).length;
    const gap = (p.weight / 100) * total - have;
    if (gap > bestGap) {
      bestGap = gap;
      best = p;
    }
  }
  return best;
}

export function TodayView({
  today,
  settings,
  onOpenCalendar,
  ...actions
}: {
  today: TodaySummary;
  settings: StudioSettings | undefined;
  onOpenCalendar: (date?: string) => void;
} & PostCardActions) {
  const { push } = useToast();
  const fill = useFillGaps();
  const channels = useChannels();
  const tz = today.timezone;
  const weekFrom = addDays(today.date, 1);
  const weekTo = addDays(today.date, 14);
  const upcoming = usePosts({ from: weekFrom, to: weekTo, limit: 200 });
  const [dismissed, setDismissed] = useState<string[]>(() => (typeof window === 'undefined' ? [] : readDismissed()));

  const gaps: Gap[] = useMemo(
    () => today.gaps.filter((g) => g.date <= addDays(today.date, 7) && g.date > today.date && !dismissed.includes(g.date)),
    [today.gaps, today.date, dismissed]
  );
  const pillar = neediestPillar(settings?.pillars || [], upcoming.data?.posts || []);

  const weekPosts = (upcoming.data?.posts || []).filter((p) => p.scheduledAt && p.scheduledAt <= `${addDays(today.date, 8)}`);
  const extraDownloads = [
    {
      label: "This week's calendar as CSV",
      detail: '7 days',
      run: () => downloadCalendarCsv([...today.posts, ...weekPosts], `week-of-${today.date}`),
    },
  ];

  const leaveEmpty = () => {
    const next = Array.from(new Set([...dismissed, ...gaps.map((g) => g.date)]));
    setDismissed(next);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch {
      /* private mode: the banner just comes back next visit */
    }
  };

  const fillGaps = async () => {
    try {
      const res = await fill.mutateAsync({ dates: gaps.map((g) => g.date), pillar: pillar?.name, draft: true });
      push({
        variant: 'success',
        title: `Filled ${res.created.length} ${res.created.length === 1 ? 'day' : 'days'}`,
        description: 'New drafts are on the calendar. Check them before they go out.',
      });
    } catch {
      /* shown below by <ErrorNote> */
    }
  };

  const last = today.lastPublished;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        {today.posts.some((p) => p.isSample) ? (
          <p className={cn('text-[13px]', tone.soft)}>
            Posts marked Sample post are examples from your showcase. Approve, edit or move one and it becomes yours; until then Mr LAD won&apos;t post it.
          </p>
        ) : null}
        {today.posts.length ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {today.posts.map((p) => (
              <PostCard key={p.id} post={p} extraDownloads={extraDownloads} {...actions} />
            ))}
          </div>
        ) : (
          <Card className="flex flex-col gap-2 p-5">
            <SectionTitle>Nothing goes out today</SectionTitle>
            <p className={cn('text-sm', tone.soft)}>Open the calendar to move a post here, or start a new one.</p>
          </Card>
        )}

        {gaps.length ? (
          <Card className="flex flex-col gap-3 border-[#F2C9CD] bg-[#FFF8F8] p-4 dark:border-[#4A1218] dark:bg-[#1F0D14] sm:flex-row sm:items-center sm:justify-between" aria-live="polite">
            <div className="flex flex-col gap-1">
              <p className={cn('text-[15px] font-semibold', tone.ink)}>
                Next week has {gaps.length} empty {gaps.length === 1 ? 'day' : 'days'}, {joinWords(gaps.map((g) => weekdayName(g.date)))}.
              </p>
              <p className={cn('text-sm', tone.soft)}>
                {pillar ? `Want me to fill ${gaps.length === 1 ? 'it' : 'them'} from your ${pillar.name} pillar?` : 'Want me to fill them?'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <CsButton variant="primary" size="sm" busy={fill.isPending} onClick={fillGaps}>
                <Sparkles className="h-4 w-4" aria-hidden />
                Fill the gaps
              </CsButton>
              <CsButton size="sm" onClick={leaveEmpty}>
                Leave empty
              </CsButton>
            </div>
            <ErrorNote error={fill.error} className="sm:hidden" />
          </Card>
        ) : null}
        <ErrorNote error={fill.error} className="max-sm:hidden" />

        <Card className="flex flex-col gap-3 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <SectionTitle>Next 7 days</SectionTitle>
            <CsButton size="sm" variant="ghost" onClick={() => onOpenCalendar()}>
              <CalendarDays className="h-4 w-4" aria-hidden />
              Open calendar
            </CsButton>
          </div>
          <ol className="grid grid-cols-7 gap-1 sm:gap-2" aria-label="Posts in the next 7 days">
            {today.week.map((d) => {
              const empty = d.posts.length === 0;
              return (
                <li key={d.date} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onOpenCalendar(d.date)}
                    aria-label={`${weekdayName(d.date)}: ${empty ? 'no posts' : `${d.posts.length} ${d.posts.length === 1 ? 'post' : 'posts'}`}`}
                    className={cn(
                      'flex min-h-[72px] w-full flex-col items-center gap-1.5 rounded-[10px] px-0.5 py-2',
                      tone.motion,
                      'hover:bg-[#F5F6FA] dark:hover:bg-[#18234A]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2156D9]'
                    )}
                  >
                    <Label className="text-[11px]">{weekdayName(d.date, true)}</Label>
                    {empty ? (
                      <span className="h-[22px] w-7 rounded-md border-[1.5px] border-dashed border-[#A1202B] dark:border-[#FFB3B9]" aria-hidden />
                    ) : (
                      <span className="flex flex-col items-center gap-1">
                        {d.posts.slice(0, 3).map((p) => (
                          <PlatformBadge key={p.id} platform={p.platform} />
                        ))}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </Card>
      </div>

      <aside className="flex min-w-0 flex-col gap-4">
        {last ? (
          <Card className="flex flex-col gap-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <SectionTitle>Last post&apos;s numbers</SectionTitle>
              {last.metricsSource === 'sample' ? <SampleChip /> : null}
            </div>
            <p className={cn('flex items-center gap-2 text-sm', tone.ink)}>
              <PlatformBadge platform={last.platform} />
              <span className="min-w-0 truncate">{postTitle(last)}</span>
            </p>
            {last.metrics ? (
              <dl className={cn('grid grid-cols-2 gap-x-3 gap-y-1 text-sm tabular-nums', tone.ink)}>
                {'reach' in last.metrics ? (
                  <>
                    <dt className={tone.soft}>Reach</dt>
                    <dd>{String(last.metrics.reach)}</dd>
                  </>
                ) : null}
                {'saves' in last.metrics ? (
                  <>
                    <dt className={tone.soft}>Saves</dt>
                    <dd>{String(last.metrics.saves)}</dd>
                  </>
                ) : null}
                {'profileVisits' in last.metrics ? (
                  <>
                    <dt className={tone.soft}>Profile visits</dt>
                    <dd>{String(last.metrics.profileVisits)}</dd>
                  </>
                ) : null}
                {'leadsCreated' in last.metrics ? (
                  <>
                    <dt className={tone.soft}>Leads created in Mr LAD</dt>
                    <dd>{String(last.metrics.leadsCreated)}</dd>
                  </>
                ) : null}
              </dl>
            ) : (
              <p className={cn('text-sm', tone.soft)}>Numbers appear once the platform reports them.</p>
            )}
            {last.metricsSource === 'sample' ? (
              <p className={cn('text-xs', tone.soft)}>Example numbers. Real ones replace them when your account reports.</p>
            ) : (
              <Link href="/campaigns/leads" className={cn('inline-flex min-h-11 items-center text-sm font-semibold text-[#13489E] underline dark:text-[#8DB4FF]')}>
                View leads
              </Link>
            )}
          </Card>
        ) : null}

        <Card className="flex flex-col gap-3 p-4">
          <SectionTitle>Where posts go out</SectionTitle>
          {channels.isLoading ? (
            <p className={cn('text-sm', tone.soft)}>Checking your connected accounts…</p>
          ) : channels.data ? (
            <ul className="flex flex-col gap-2">
              {channels.data.map((c) => (
                <li key={c.platform} className={cn('flex items-start gap-2 text-sm', tone.ink)}>
                  <PlatformBadge platform={c.platform} className="mt-0.5 shrink-0" />
                  <span>
                    <strong>
                      {PLATFORM_META[c.platform].label}: {c.mode === 'auto' ? 'automatic' : 'reminder'}.
                    </strong>
                    <span className={tone.soft}> {sentence(c.note)}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={cn('text-sm', tone.soft)}>Couldn&apos;t check your connected accounts. Posts still go on the calendar.</p>
          )}
          <p className={cn('text-xs', tone.soft)}>
            Scheduling runs on Mr LAD&apos;s own scheduler, in {tz}. {PLATFORM_META.linkedin.label} posts publish through your connected account.
          </p>
        </Card>
      </aside>
    </div>
  );
}
