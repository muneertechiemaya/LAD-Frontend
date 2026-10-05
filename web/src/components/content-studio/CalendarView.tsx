'use client';
import React, { useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, Clock, GripVertical, Pencil } from 'lucide-react';
import type { ContentPost, Platform } from '@lad/frontend-features/content-studio';
import { useEnabledPlatforms, usePosts, useSchedulePost, useStudioSettings, useUpdatePost } from '@lad/frontend-features/content-studio';
import { useToast } from '@/components/ui/app-toaster';
import { PLATFORM_META, formatName, postTitle } from '@/lib/content-studio/meta';
import {
  addDays,
  daysInMonth,
  friendlyTime,
  joinWords,
  localDate,
  localTime,
  longDate,
  monthName,
  shortDate,
  startOfMonth,
  startOfWeek,
  todayLocal,
  weekdayName,
  zonedToUtcIso,
} from '@/lib/content-studio/time';
import { ApprovalChip, Card, CsButton, ErrorNote, Label, PlatformBadge, SampleChip, Segmented, StatusChip, tone } from './ui';
import { cn } from '@/lib/utils';

type View = 'month' | 'week' | 'day';

function DraggablePost({ post, compact, onEdit }: { post: ContentPost; compact?: boolean; onEdit: (p: ContentPost) => void }) {
  const locked = post.status === 'published';
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: post.id, disabled: locked, data: { post } });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  const time = post.scheduledAt ? friendlyTime(post.scheduledAt, post.timezone) : '';
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative rounded-[10px] border bg-white dark:bg-[#0B1433]',
        tone.line,
        isDragging ? 'z-30 -translate-y-0.5 shadow-lg motion-reduce:translate-y-0' : 'shadow-[0_1px_0_#E3E7F0] dark:shadow-none'
      )}
    >
      <button
        type="button"
        onClick={() => onEdit(post)}
        className={cn('flex min-h-11 w-full min-w-0 flex-col items-start gap-1 p-2 text-left', !locked ? 'lg:pr-11' : '', 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2156D9] rounded-[10px]')}
        aria-label={`${PLATFORM_META[post.platform].label} ${formatName(post.platform, post.format)} at ${time}: ${postTitle(post)}. Open`}
      >
        <span className="flex w-full items-center gap-1.5">
          <PlatformBadge platform={post.platform} className={compact ? 'h-[18px] min-w-[22px] text-[10px]' : ''} />
          <span className={cn('text-xs tabular-nums', tone.soft)}>{time}</span>
        </span>
        <span className={cn(compact ? 'line-clamp-2 text-xs' : 'line-clamp-3 text-[13px]', 'font-semibold leading-snug', tone.ink)}>{postTitle(post)}</span>
        {!compact ? (
          <span className="flex flex-wrap gap-1">
            <StatusChip status={post.status} />
            <ApprovalChip state={post.approvalState} />
            {post.isSample ? <SampleChip label="Sample" /> : null}
          </span>
        ) : null}
      </button>
      {!locked ? (
        <button
          type="button"
          {...listeners}
          {...attributes}
          aria-label={`Drag ${postTitle(post)} to another day`}
          className={cn('absolute right-0 top-0 hidden h-11 w-11 cursor-grab items-center justify-center rounded-[10px] lg:flex', tone.soft, 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2156D9]')}
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function DayDrop({
  date,
  disabled,
  full,
  children,
  className,
  label,
}: {
  date: string;
  disabled: boolean;
  full: boolean;
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${date}`, disabled, data: { date } });
  return (
    <div
      ref={setNodeRef}
      aria-label={label}
      className={cn(
        className,
        isOver && !disabled ? (full ? 'bg-[#FFF1D6] dark:bg-[#3A2A0A]' : 'bg-[#E3EDFF] dark:bg-[#142A55]') : '',
        'transition-colors duration-150 motion-reduce:transition-none'
      )}
    >
      {children}
    </div>
  );
}

export function CalendarView({
  tz,
  initialDate,
  onEdit,
  onMoveTime,
}: {
  tz: string;
  initialDate: string | null;
  onEdit: (p: ContentPost) => void;
  onMoveTime: (p: ContentPost) => void;
}) {
  const enabledPlatforms = useEnabledPlatforms();
  const today = todayLocal(tz);
  const [view, setView] = useState<View>(initialDate ? 'day' : 'week');
  const [anchor, setAnchor] = useState(initialDate || today);
  const [hidden, setHidden] = useState<Platform[]>([]);
  const settings = useStudioSettings();
  const cap = settings.data?.maxPostsPerDay || 3;
  const schedule = useSchedulePost();
  const update = useUpdatePost();
  const { push } = useToast();

  const range = useMemo(() => {
    if (view === 'month') {
      const from = startOfWeek(startOfMonth(anchor));
      const last = addDays(startOfMonth(anchor), daysInMonth(anchor) - 1);
      const to = addDays(startOfWeek(last), 6);
      return { from, to };
    }
    if (view === 'week') {
      const from = startOfWeek(anchor);
      return { from, to: addDays(from, 6) };
    }
    return { from: anchor, to: anchor };
  }, [view, anchor]);

  const posts = usePosts({ from: range.from, to: range.to, limit: 500 });
  const byDay = useMemo(() => {
    const visible = (posts.data?.posts || []).filter((p) => p.scheduledAt && !hidden.includes(p.platform));
    const m = new Map<string, ContentPost[]>();
    for (const p of [...visible].sort((a, b) => (a.scheduledAt || '').localeCompare(b.scheduledAt || ''))) {
      const d = localDate(p.scheduledAt as string, tz);
      m.set(d, [...(m.get(d) || []), p]);
    }
    return m;
  }, [posts.data, hidden, tz]);

  const days: string[] = [];
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) days.push(d);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  const onDragEnd = async (e: DragEndEvent) => {
    const post = e.active.data.current?.post as ContentPost | undefined;
    const date = e.over?.data.current?.date as string | undefined;
    if (!post || !date || !post.scheduledAt) return;
    const fromDate = localDate(post.scheduledAt, tz);
    if (date === fromDate) return;
    if (date < today) {
      push({ variant: 'warning', title: 'That day has passed', description: 'Drop it on today or a later day.' });
      return;
    }
    const iso = zonedToUtcIso(date, localTime(post.scheduledAt, tz), tz);
    if (new Date(iso).getTime() <= Date.now()) {
      push({ variant: 'warning', title: 'That time has passed', description: 'Use Move time to pick a later slot today.' });
      return;
    }
    try {
      if (post.status === 'scheduled') await schedule.mutateAsync({ id: post.id, scheduledAt: iso });
      else await update.mutateAsync({ id: post.id, patch: { scheduledAt: iso, reason: 'moved on the calendar' } });
      const count = (byDay.get(date)?.length || 0) + 1;
      push({
        variant: count > cap ? 'warning' : 'success',
        title: `Moved to ${shortDate(date)}`,
        description: count > cap ? `${count} posts that day, over your limit of ${cap}.` : `${postTitle(post)} keeps its ${friendlyTime(iso, tz)} slot.`,
      });
    } catch {
      /* shown below */
    }
  };

  const step = (n: number) => {
    if (view === 'month') {
      const [y, m] = anchor.split('-').map(Number);
      const d = new Date(Date.UTC(y, m - 1 + n, 1));
      setAnchor(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`);
    } else setAnchor(addDays(anchor, n * (view === 'week' ? 7 : 1)));
  };

  const [ay, am] = anchor.split('-').map(Number);
  const title =
    view === 'month' ? `${monthName(am)} ${ay}` : view === 'week' ? `Week of ${shortDate(range.from)}` : longDate(anchor);

  // Past days with nothing on them are history, not a gap to fill: phones fold them into one line.
  const pastEmpty = days.filter((d) => d < today && !(byDay.get(d) || []).length);

  const nav = (
    <>
      <CsButton size="sm" aria-label={`Previous ${view}`} onClick={() => step(-1)}>
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </CsButton>
      <CsButton size="sm" onClick={() => setAnchor(today)}>
        Today
      </CsButton>
      <CsButton size="sm" aria-label={`Next ${view}`} onClick={() => step(1)}>
        <ChevronRight className="h-4 w-4" aria-hidden />
      </CsButton>
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center justify-between gap-2">
          <h2 className={cn('text-lg font-semibold sm:text-xl', tone.ink)}>{title}</h2>
          <div className="flex shrink-0 items-center gap-1 lg:hidden">{nav}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Calendar view"
            value={view}
            onChange={setView}
            options={[
              { value: 'month', label: 'Month' },
              { value: 'week', label: 'Week' },
              { value: 'day', label: 'Day' },
            ]}
          />
          <div className="hidden items-center gap-2 lg:flex">{nav}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Show platforms">
        <Label className="mr-1">Show</Label>
        {enabledPlatforms.map((p) => {
          const on = !hidden.includes(p);
          return (
            <button
              key={p}
              type="button"
              aria-pressed={on}
              onClick={() => setHidden((h) => (on ? [...h, p] : h.filter((x) => x !== p)))}
              className={cn('inline-flex min-h-11 items-center gap-1.5 rounded-[10px] border px-2.5 text-sm font-semibold', tone.line, tone.surface, on ? tone.ink : 'opacity-50')}
            >
              <PlatformBadge platform={p} />
              <span className="max-sm:sr-only">{PLATFORM_META[p].label}</span>
            </button>
          );
        })}
        <span className={cn('hidden text-[13px] lg:inline', tone.soft)}>Drag a post to another day; it keeps its time. Published posts are locked.</span>
      </div>

      <ErrorNote error={posts.error || schedule.error || update.error} />

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        {view === 'month' ? (
          <Card className="p-2 sm:p-3">
            <div className="grid grid-cols-7 gap-1" aria-hidden>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <Label key={d} className="px-1 py-1 text-[11px]">
                  <span className="sm:hidden">{d[0]}</span>
                  <span className="max-sm:hidden">{d}</span>
                </Label>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((d) => {
                const items = byDay.get(d) || [];
                const outside = d.slice(0, 7) !== anchor.slice(0, 7);
                return (
                  <DayDrop
                    key={d}
                    date={d}
                    disabled={d < today}
                    full={items.length >= cap}
                    label={`${shortDate(d)}: ${items.length} ${items.length === 1 ? 'post' : 'posts'}`}
                    className={cn('flex min-h-[64px] flex-col gap-1 rounded-[10px] border p-1 lg:min-h-[110px]', tone.line, outside ? 'opacity-50' : '', d === today ? 'ring-2 ring-[#2156D9] dark:ring-[#8DB4FF]' : '')}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setAnchor(d);
                        setView('day');
                      }}
                      className={cn('min-h-11 min-w-11 self-start rounded-md px-1 text-left text-xs font-semibold tabular-nums', tone.ink)}
                      aria-label={`Open ${longDate(d)}`}
                    >
                      {Number(d.slice(8))}
                    </button>
                    <div className="hidden flex-col gap-1 lg:flex">
                      {items.slice(0, 3).map((p) => (
                        <DraggablePost key={p.id} post={p} compact onEdit={onEdit} />
                      ))}
                      {items.length > 3 ? (
                        <button type="button" onClick={() => { setAnchor(d); setView('day'); }} className={cn('min-h-11 text-left text-xs font-semibold', tone.soft)}>
                          +{items.length - 3} more
                        </button>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-0.5 lg:hidden" aria-hidden>
                      {items.slice(0, 4).map((p) => (
                        <span key={p.id} className="h-2 w-2 rounded-full" style={{ background: PLATFORM_META[p.platform].fill }} />
                      ))}
                    </div>
                  </DayDrop>
                );
              })}
            </div>
          </Card>
        ) : view === 'week' ? (
          <>
            <div className="hidden grid-cols-7 gap-3 lg:grid">
              {days.map((d) => {
                const items = byDay.get(d) || [];
                return (
                  <DayDrop
                    key={d}
                    date={d}
                    disabled={d < today}
                    full={items.length >= cap}
                    label={`${longDate(d)}`}
                    className={cn('flex min-h-[320px] min-w-0 flex-col gap-2 rounded-[14px] border p-2', tone.line, tone.surface, d === today ? 'ring-2 ring-[#2156D9] dark:ring-[#8DB4FF]' : '')}
                  >
                    <Label className="text-xs">
                      {weekdayName(d, true)} {Number(d.slice(8))}
                    </Label>
                    {items.length ? (
                      items.map((p) => <DraggablePost key={p.id} post={p} onEdit={onEdit} />)
                    ) : d < today ? (
                      <p className={cn('mt-2 p-2 text-center text-xs', tone.soft)}>No posts</p>
                    ) : (
                      <p className="mt-2 rounded-[10px] border-[1.5px] border-dashed border-[#A1202B] p-2 text-center text-xs font-semibold text-[#A1202B] dark:border-[#FFB3B9] dark:text-[#FFB3B9]">
                        Empty day
                      </p>
                    )}
                  </DayDrop>
                );
              })}
            </div>
            <ol className="flex flex-col gap-3 lg:hidden" aria-label="This week">
              {pastEmpty.length ? (
                <li className={cn('text-sm', tone.soft)}>No posts on {joinWords(pastEmpty.map((d) => weekdayName(d)))}.</li>
              ) : null}
              {days.map((d) => {
                const items = byDay.get(d) || [];
                if (!items.length && d < today) return null;
                return (
                  <li key={d}>
                    <Card className="flex flex-col gap-2 p-3">
                      <Label>{longDate(d)}</Label>
                      {items.length ? (
                        items.map((p) => <PhoneRow key={p.id} post={p} onEdit={onEdit} onMoveTime={onMoveTime} />)
                      ) : (
                        <p className="text-sm font-semibold text-[#A1202B] dark:text-[#FFB3B9]">Empty day</p>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ol>
          </>
        ) : (
          <Card className="flex flex-col gap-2 p-3 sm:p-4">
            {(byDay.get(anchor) || []).length ? (
              (byDay.get(anchor) || []).map((p) => <PhoneRow key={p.id} post={p} onEdit={onEdit} onMoveTime={onMoveTime} />)
            ) : (
              <p className={cn('text-sm', tone.soft)}>Nothing planned for {longDate(anchor)}.</p>
            )}
          </Card>
        )}
      </DndContext>
    </div>
  );
}

function PhoneRow({ post, onEdit, onMoveTime }: { post: ContentPost; onEdit: (p: ContentPost) => void; onMoveTime: (p: ContentPost) => void }) {
  return (
    <div className={cn('flex flex-col gap-2 rounded-[12px] border p-3 sm:flex-row sm:items-center', tone.line)}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <PlatformBadge platform={post.platform} />
          <span className={cn('text-[13px] tabular-nums', tone.soft)}>
            {post.scheduledAt ? friendlyTime(post.scheduledAt, post.timezone) : ''} · {formatName(post.platform, post.format)}
          </span>
          <StatusChip status={post.status} />
          <ApprovalChip state={post.approvalState} />
          {post.isSample ? <SampleChip label="Sample" /> : null}
        </span>
        <span className={cn('text-sm font-semibold', tone.ink)}>{postTitle(post)}</span>
      </div>
      <div className="flex gap-2">
        <CsButton size="sm" onClick={() => onEdit(post)}>
          <Pencil className="h-4 w-4" aria-hidden />
          Edit
        </CsButton>
        {post.status !== 'published' ? (
          <CsButton size="sm" onClick={() => onMoveTime(post)}>
            <Clock className="h-4 w-4" aria-hidden />
            Move time
          </CsButton>
        ) : null}
      </div>
    </div>
  );
}
