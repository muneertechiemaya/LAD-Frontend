'use client';
import React from 'react';
import Link from 'next/link';
import type { Analytics } from '@lad/frontend-features/content-studio';
import { useAnalytics } from '@lad/frontend-features/content-studio';
import { PLATFORM_META } from '@/lib/content-studio/meta';
import { shortDate } from '@/lib/content-studio/time';
import { Card, ErrorNote, Label, PlatformBadge, SampleChip, SectionTitle, tone } from './ui';
import { cn } from '@/lib/utils';

function hourLabel(h: number) {
  const ap = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${ap}`;
}

function Kpi({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <Label>{label}</Label>
      {/* A bracketed placeholder ("[VERIFIED REACH]") is a slot to fill, not a number: keep it small. */}
      <span className={cn('font-bold tabular-nums', typeof value === 'string' && value.startsWith('[') ? 'text-sm' : 'text-2xl', tone.ink)}>{value}</span>
      {note ? <span className={cn('text-xs', tone.soft)}>{note}</span> : null}
    </Card>
  );
}

/** Horizontal-label bar list: readable at 390px and to screen readers. */
function Bars({ rows, unit, highlightTop = 1, stacked }: { rows: { label: string; value: number }[]; unit?: string; highlightTop?: number; stacked?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const top = [...rows].sort((a, b) => b.value - a.value).slice(0, highlightTop).map((r) => r.label);
  const fill = (label: string) => (top.includes(label) ? 'bg-[#0B1957] dark:bg-[#C9DAFF]' : 'bg-[#5272C7] dark:bg-[#6F90E0]');
  if (stacked) {
    // Long labels (pillar names) sit above their bar so none are cut short.
    return (
      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <li key={r.label} className="flex flex-col gap-1">
            <span className="flex items-baseline justify-between gap-2 text-xs">
              <span className={tone.soft}>{r.label}</span>
              <span className={cn('font-semibold tabular-nums', tone.ink)}>
                {r.value}
                {unit || ''}
              </span>
            </span>
            <span className="h-3 rounded-full bg-[#ECEEF3] dark:bg-[#24305A]" aria-hidden>
              <span className={cn('block h-3 rounded-full', fill(r.label))} style={{ width: `${(r.value / max) * 100}%` }} />
            </span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[72px_minmax(0,1fr)_48px] items-center gap-2">
          <span className={cn('text-xs tabular-nums', tone.soft)}>{r.label}</span>
          <span className="h-3 rounded-full bg-[#ECEEF3] dark:bg-[#24305A]" aria-hidden>
            <span
              className={cn('block h-3 rounded-full', fill(r.label))}
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </span>
          <span className={cn('text-right text-xs font-semibold tabular-nums', tone.ink)}>
            {r.value}
            {unit || ''}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function AnalyticsView() {
  const q = useAnalytics();
  if (q.isLoading) return <p className={cn('text-sm', tone.soft)}>Loading analytics…</p>;
  if (!q.data) return <ErrorNote error={q.error || new Error("Couldn't load analytics. Refresh to try again.")} />;
  const a: Analytics = q.data;
  const sample = a.source !== 'live';
  const t = a.totals;

  return (
    <div className="flex flex-col gap-4">
      {sample ? (
        <Card className="flex flex-wrap items-center gap-3 border-[#F0DDB0] bg-[#FFFBEF] p-4 dark:border-[#3A2A0A] dark:bg-[#211A08]">
          <SampleChip />
          <p className={cn('text-sm', tone.ink)}>
            {a.source === 'mixed'
              ? 'Some numbers here are examples. Anything marked Sample is not from your accounts and is never an estimate of them.'
              : 'These are example numbers. Real ones replace them as each connected account reports, and are never estimated.'}
          </p>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Reach" value={t.reach ?? '—'} note={sample ? 'Sample' : undefined} />
        <Kpi label="Engagement" value={t.engagementRate != null ? `${t.engagementRate}%` : '—'} note={sample ? 'Sample' : undefined} />
        <Kpi label="New followers" value={t.newFollowers != null ? `+${t.newFollowers}` : '—'} note={sample ? 'Sample' : undefined} />
        <Kpi label="Leads from posts" value={t.leadsFromPosts ?? '—'} note={sample ? 'Sample · created in Mr LAD campaigns' : 'Created in Mr LAD campaigns'} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Posts in range" value={t.posts} />
        <Kpi label="Published" value={t.published} />
        <Kpi label="Scheduled" value={t.scheduled} />
        <Kpi label="Range" value={<span className="text-base">{`${shortDate(a.range.from)} to ${shortDate(a.range.to)}`}</span>} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <SectionTitle>Best posting times</SectionTitle>
            {sample ? <SampleChip /> : null}
          </div>
          {a.bestTimes.length ? (
            <Bars rows={a.bestTimes.map((b) => ({ label: hourLabel(b.hour), value: b.score }))} highlightTop={2} />
          ) : (
            <p className={cn('text-sm', tone.soft)}>Not enough posts yet to see a pattern.</p>
          )}
          <p className={cn('text-xs', tone.soft)}>Relative engagement by hour; higher is better. The plan moves future posts toward the darkest bars.</p>
        </Card>
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <SectionTitle>Follower growth</SectionTitle>
            {sample ? <SampleChip /> : null}
          </div>
          {a.followerGrowth.length ? (
            <Bars rows={a.followerGrowth.map((g) => ({ label: shortDate(g.weekStart).replace(/^\w+ /, ''), value: g.followers }))} highlightTop={1} />
          ) : (
            <p className={cn('text-sm', tone.soft)}>Follower numbers appear once an account reports them.</p>
          )}
          <p className={cn('text-xs', tone.soft)}>New followers per week.</p>
        </Card>
      </div>

      <Card className="flex flex-col gap-3 p-4">
        <SectionTitle>Top posts</SectionTitle>
        {a.topPosts.length ? (
          <ul className="flex flex-col gap-2">
            {a.topPosts.map((p) => (
              <li key={p.postId} className={cn('flex flex-col gap-1 rounded-[12px] border p-3 sm:flex-row sm:items-center sm:gap-3', tone.line)}>
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <PlatformBadge platform={p.platform} />
                  <span className={cn('line-clamp-2 min-w-0 flex-1 text-sm font-semibold', tone.ink)}>{p.title}</span>
                  {p.source === 'sample' ? <SampleChip /> : null}
                </span>
                <span className={cn('text-[13px] tabular-nums', tone.ink)}>
                  {Object.entries(p.metrics)
                    .filter(([k]) => ['saves', 'comments', 'shares', 'profileVisits', 'reach'].includes(k))
                    .map(([k, v]) => `${k === 'profileVisits' ? 'Profile visits' : k[0].toUpperCase() + k.slice(1)} ${v}`)
                    .join(' · ')}
                  {p.leadsCreated != null ? ` · ${p.leadsCreated} ${p.leadsCreated === 1 ? 'lead' : 'leads'}` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={cn('text-sm', tone.soft)}>Top posts show here once posts have numbers.</p>
        )}
        {!sample ? (
          <Link href="/campaigns/leads" className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-[#13489E] underline dark:text-[#8DB4FF]">
            View leads from these posts
          </Link>
        ) : null}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-3 p-4">
          <SectionTitle>Posts by pillar</SectionTitle>
          <Bars rows={a.byPillar.map((b) => ({ label: b.pillar, value: b.posts }))} highlightTop={0} stacked />
        </Card>
        <Card className="flex flex-col gap-3 p-4">
          <SectionTitle>Posts by platform</SectionTitle>
          <ul className="flex flex-col gap-2">
            {a.byPlatform.map((b) => (
              <li key={b.platform} className={cn('flex items-center gap-2 text-sm', tone.ink)}>
                <PlatformBadge platform={b.platform} />
                <span className="flex-1">{PLATFORM_META[b.platform].label}</span>
                <span className="font-semibold tabular-nums">{b.posts}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
