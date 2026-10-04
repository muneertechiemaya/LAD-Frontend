'use client';
import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { usePosts } from '@lad/frontend-features/content-studio';
import { useToast } from '@/components/ui/app-toaster';
import { downloadCalendarCsv, downloadCalendarPdf } from '@/lib/content-studio/exports';
import { postTitle } from '@/lib/content-studio/meta';
import { addDays, daysInMonth, friendlyTime, localDate, monthName, shortDate, startOfMonth, startOfWeek, todayLocal } from '@/lib/content-studio/time';
import { DownloadMenu } from './DownloadMenu';
import { useBrandName } from './PlatformPreview';
import { Card, CsButton, ErrorNote, PlatformBadge, SectionTitle, Segmented, tone } from './ui';
import { cn } from '@/lib/utils';

type Range = 'week' | 'month' | 'next';

export function DownloadsView({ tz }: { tz: string }) {
  const today = todayLocal(tz);
  const brand = useBrandName();
  const { push } = useToast();
  const [range, setRange] = useState<Range>('month');
  const [busy, setBusy] = useState<'csv' | 'pdf' | null>(null);
  const [err, setErr] = useState<unknown>(null);

  const r = useMemo(() => {
    if (range === 'week') {
      const from = startOfWeek(today);
      return { from, to: addDays(from, 6), label: `week of ${shortDate(from)}`, month: startOfMonth(today) };
    }
    const base = range === 'month' ? startOfMonth(today) : addDays(startOfMonth(today), daysInMonth(today));
    const [y, m] = base.split('-').map(Number);
    return { from: base, to: addDays(base, daysInMonth(base) - 1), label: `${monthName(m)} ${y}`, month: base };
  }, [range, today]);

  const posts = usePosts({ from: r.from, to: r.to, limit: 500 });
  const upcoming = usePosts({ from: today, to: addDays(today, 14), limit: 50 });
  const list = (posts.data?.posts || []).filter((p) => p.scheduledAt);

  const run = async (kind: 'csv' | 'pdf') => {
    setBusy(kind);
    setErr(null);
    try {
      const name = kind === 'csv' ? downloadCalendarCsv(list, r.label) : await downloadCalendarPdf(list, r.month, tz, { name: brand, primary: '#0B1957' });
      push({ variant: 'success', title: 'Downloaded', description: name });
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-start">
      <Card className="flex flex-col gap-4 p-4">
        <SectionTitle>Calendar export</SectionTitle>
        <Segmented
          label="Range"
          value={range}
          onChange={setRange}
          options={[
            { value: 'week', label: 'This week' },
            { value: 'month', label: 'This month' },
            { value: 'next', label: 'Next month' },
          ]}
        />
        <p className={cn('text-sm', tone.soft)}>
          {posts.isLoading ? 'Counting posts…' : `${list.length} ${list.length === 1 ? 'post' : 'posts'} in ${r.label}, times in ${tz}.`}
        </p>
        <div className="flex flex-wrap gap-2">
          <CsButton variant="primary" busy={busy === 'csv'} disabled={!list.length} onClick={() => run('csv')}>
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
            Calendar as CSV
          </CsButton>
          <CsButton busy={busy === 'pdf'} disabled={!list.length} onClick={() => run('pdf')}>
            <FileText className="h-4 w-4" aria-hidden />
            Calendar as PDF
          </CsButton>
        </div>
        <p className={cn('text-xs', tone.soft)}>
          The CSV has one row per post with the caption ready to paste. The PDF is a month grid plus a list, A4 landscape.
        </p>
        <ErrorNote error={err || posts.error} />
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <SectionTitle>Posts in the next 14 days</SectionTitle>
        <p className={cn('text-sm', tone.soft)}>Slides as PNG or PDF, captions and video scripts as TXT. Files are drawn from the post itself.</p>
        <ErrorNote error={upcoming.error} />
        <ul className="flex flex-col gap-2">
          {(upcoming.data?.posts || [])
            .filter((p) => p.scheduledAt)
            .map((p) => (
              <li key={p.id} className={cn('flex flex-wrap items-center gap-2 rounded-[12px] border p-2', tone.line)}>
                <PlatformBadge platform={p.platform} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={cn('truncate text-sm font-semibold', tone.ink)}>{postTitle(p)}</span>
                  <span className={cn('text-xs tabular-nums', tone.soft)}>
                    {shortDate(localDate(p.scheduledAt as string, tz))}, {friendlyTime(p.scheduledAt as string, tz)}
                  </span>
                </span>
                <DownloadMenu post={p} />
              </li>
            ))}
          {!upcoming.isLoading && !(upcoming.data?.posts || []).length ? <li className={cn('text-sm', tone.soft)}>Nothing scheduled in the next 14 days.</li> : null}
        </ul>
      </Card>
    </div>
  );
}
