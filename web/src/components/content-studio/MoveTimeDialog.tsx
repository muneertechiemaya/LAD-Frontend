'use client';
import React, { useEffect, useMemo, useState } from 'react';
import type { ContentPost } from '@lad/frontend-features/content-studio';
import { useSchedulePost, useUpdatePost } from '@lad/frontend-features/content-studio';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/app-toaster';
import { addDays, friendlyTime, localDate, localTime, shortDate, todayLocal, zonedToUtcIso } from '@/lib/content-studio/time';
import { postTitle } from '@/lib/content-studio/meta';
import { CsButton, ErrorNote, Field, inputCls, tone } from './ui';
import { cn } from '@/lib/utils';

interface Slot {
  date: string;
  time: string;
  label: string;
}

/**
 * Reschedule in 2 taps: open, then pick one of the 3 suggested slots (or set a
 * custom time). A scheduled post stays on the scheduler at the new time; an
 * unscheduled one just gets its planned time moved.
 */
export function MoveTimeDialog({
  post,
  windowTime,
  onClose,
}: {
  post: ContentPost | null;
  windowTime?: string;
  onClose: () => void;
}) {
  const tz = post?.timezone || 'Asia/Dubai';
  const schedule = useSchedulePost();
  const update = useUpdatePost();
  const { push } = useToast();
  const currentDate = post?.scheduledAt ? localDate(post.scheduledAt, tz) : todayLocal(tz);
  const currentTime = post?.scheduledAt ? localTime(post.scheduledAt, tz) : windowTime || '10:00';
  const [date, setDate] = useState(currentDate);
  const [time, setTime] = useState(currentTime);
  // The dialog stays mounted between posts; start each one from its own time.
  useEffect(() => {
    setDate(currentDate);
    setTime(currentTime);
  }, [post?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const suggestions = useMemo<Slot[]>(() => {
    if (!post) return [];
    const now = Date.now();
    const out: Slot[] = [];
    const add = (d: string, t: string) => {
      const iso = zonedToUtcIso(d, t, tz);
      if (new Date(iso).getTime() <= now + 60_000) return;
      if (out.some((s) => s.date === d && s.time === t)) return;
      if (d === currentDate && t === currentTime) return;
      out.push({ date: d, time: t, label: `${shortDate(d)}, ${friendlyTime(iso, tz)}` });
    };
    const today = todayLocal(tz);
    // later today (+2h), then the same time and the platform's best window on the next days
    const later = new Date(now + 2 * 3600_000);
    add(today, localTime(later, tz).replace(/:\d\d$/, ':00'));
    for (let i = 1; i <= 3 && out.length < 3; i++) {
      add(addDays(currentDate > today ? currentDate : today, i), currentTime);
      if (windowTime && out.length < 3) add(addDays(currentDate > today ? currentDate : today, i), windowTime);
    }
    return out.slice(0, 3);
  }, [post, tz, currentDate, currentTime, windowTime]);

  const busy = schedule.isPending || update.isPending;
  const error = schedule.error || update.error;

  const apply = async (d: string, t: string) => {
    if (!post) return;
    const iso = zonedToUtcIso(d, t, tz);
    if (new Date(iso).getTime() <= Date.now()) {
      push({ variant: 'warning', title: 'Pick a time in the future' });
      return;
    }
    try {
      if (post.status === 'scheduled') await schedule.mutateAsync({ id: post.id, scheduledAt: iso });
      else await update.mutateAsync({ id: post.id, patch: { scheduledAt: iso, reason: 'moved time' } });
    } catch {
      return; // shown by <ErrorNote> from the mutation's error
    }
    push({ variant: 'success', title: 'Moved', description: `${postTitle(post)} · ${shortDate(d)}, ${friendlyTime(iso, tz)}` });
    onClose();
  };

  return (
    <Dialog open={!!post} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <DialogTitle className="pr-10 text-xl">Move time</DialogTitle>
          <DialogDescription className={tone.soft}>
            {post ? postTitle(post) : ''} · times in {tz}
          </DialogDescription>
          <div className="flex flex-col gap-2">
            <p className={cn('text-sm font-semibold', tone.ink)}>Suggested times</p>
            {suggestions.map((s) => (
              <CsButton
                key={`${s.date}-${s.time}`}
                className="justify-start"
                disabled={busy}
                onClick={() => apply(s.date, s.time)}
              >
                {s.label}
              </CsButton>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" htmlFor="cs-move-date">
              <input id="cs-move-date" type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Time" htmlFor="cs-move-time">
              <input id="cs-move-time" type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
          </div>
          <ErrorNote error={error} />
          <div className={cn('flex flex-wrap justify-end gap-2')}>
            <CsButton variant="ghost" onClick={onClose}>
              Cancel
            </CsButton>
            <CsButton variant="primary" busy={busy} onClick={() => apply(date, time)}>
              Move to this time
            </CsButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
