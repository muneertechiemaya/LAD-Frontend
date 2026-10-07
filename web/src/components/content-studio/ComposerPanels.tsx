'use client';
import React, { useState } from 'react';
import { Check, History, RotateCcw, Sparkles, Users, Wand2, X } from 'lucide-react';
import type { AudienceTest, ChannelInfo, ContentPost, HookOption, Platform, VoiceRuleResult } from '@lad/frontend-features/content-studio';
import {
  DIMENSION_LABELS,
  RULE_LABELS,
  first3Words,
  useApplyFix,
  useApprovePost,
  useGenerateHooks,
  useGradePost,
  useMarkPosted,
  useRestoreVersion,
  useRunAudienceTest,
  useSchedulePost,
  useUnschedulePost,
  useVersions,
} from '@lad/frontend-features/content-studio';
import { apiErrorCode } from '@lad/shared/apiError';
import { useToast } from '@/components/ui/app-toaster';
import { PLATFORM_META, sentence } from '@/lib/content-studio/meta';
import { friendlyTime, localDate, localTime, shortDate, todayLocal, zonedToUtcIso } from '@/lib/content-studio/time';
import { ApprovalChip, Card, CsButton, ErrorNote, Field, Label, SectionTitle, StatusChip, inputCls, tone } from './ui';
import { cn } from '@/lib/utils';

// ── hooks ──────────────────────────────────────────────────────────────────
export function HookPicker({
  topic,
  platform,
  postId,
  current,
  onPick,
  onNeedBrief,
}: {
  topic: string;
  platform: Platform;
  postId?: string;
  current: string;
  onPick: (h: HookOption) => void;
  onNeedBrief: () => void;
}) {
  const gen = useGenerateHooks();
  const testHooks = useRunAudienceTest();
  // Head-to-head result, kept with the exact hook texts it was run on.
  const [hookTest, setHookTest] = useState<{ texts: string[]; test: AudienceTest } | null>(null);
  const t = first3Words(current);
  const run = () => {
    setHookTest(null);
    gen.mutate(
      { topic: topic || current, platform, postId },
      { onError: (e) => apiErrorCode(e) === 'BRIEF_REQUIRED' && onNeedBrief() }
    );
  };
  const hooks = gen.data?.hooks || [];
  const runHooks = async () => {
    if (!postId) return;
    const texts = hooks.slice(0, 3).map((h) => h.text);
    try {
      const test = await testHooks.mutateAsync({ postId, body: { variant: 'hooks', hooks: texts } });
      setHookTest({ texts, test });
    } catch (e) {
      if (apiErrorCode(e) === 'BRIEF_REQUIRED') onNeedBrief();
    }
  };
  const statFor = (text: string) => {
    if (!hookTest) return null;
    const i = hookTest.texts.indexOf(text);
    const h = i >= 0 ? hookTest.test.summary.hooks?.[i] : undefined;
    return h ? { picks: h.picks, total: hookTest.test.summary.answered, winner: hookTest.test.summary.winner === i } : null;
  };
  const noneStopped = hookTest
    ? Math.max(0, hookTest.test.summary.answered - (hookTest.test.summary.hooks || []).reduce((n, h) => n + h.picks, 0))
    : 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={cn('text-[13px]', tone.soft)}>
          First 3 words: <strong className={tone.ink}>“{t.words || '…'}”</strong>{' '}
          {current ? (
            t.pass ? (
              <span className="font-semibold text-[#0F6A3B] dark:text-[#9BE3B8]">stops the scroll</span>
            ) : (
              <span className="font-semibold text-[#A1202B] dark:text-[#FFB3B9]">weak opener, lead with the surprise</span>
            )
          ) : null}
        </p>
        <CsButton size="sm" onClick={run} busy={gen.isPending} disabled={!topic && !current}>
          <Sparkles className="h-4 w-4" aria-hidden />
          3 hook options
        </CsButton>
      </div>
      {gen.data?.hooks?.length ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">Hook options</legend>
          {gen.data.hooks.map((h) => {
            const on = h.text === current;
            return (
              <label
                key={h.text}
                className={cn(
                  'flex min-h-11 cursor-pointer items-start gap-3 rounded-[10px] border p-3',
                  on ? 'border-[#2156D9] bg-[#F2F6FF] dark:border-[#8DB4FF] dark:bg-[#0F1D45]' : cn(tone.line, tone.surface)
                )}
              >
                <input type="radio" name="hook-option" className="mt-1 h-5 w-5 accent-[#0B1957]" checked={on} onChange={() => onPick(h)} />
                <span className="flex flex-col gap-1">
                  <span className={cn('text-sm font-semibold', tone.ink)}>{h.text}</span>
                  <span className={cn('text-xs', tone.soft)}>
                    {h.category} · first 3 words “{h.first3}” {h.first3Pass ? 'pass' : 'weak'}
                  </span>
                  {(() => {
                    const st = statFor(h.text);
                    return st ? (
                      <span className={cn('flex flex-wrap items-center gap-2 text-xs', tone.ink)}>
                        <span className="font-semibold tabular-nums">
                          Stops {st.picks} of {st.total}
                        </span>
                        {st.winner ? (
                          <span className="inline-flex h-6 items-center rounded-full bg-[#E3F4EA] px-2.5 font-semibold text-[#0F5A33] dark:bg-[#0E3320] dark:text-[#9BE3B8]">
                            Panel pick
                          </span>
                        ) : null}
                      </span>
                    ) : null;
                  })()}
                </span>
              </label>
            );
          })}
        </fieldset>
      ) : null}
      {postId && hooks.length >= 2 ? (
        <div className="flex flex-col gap-1">
          <CsButton size="sm" className="self-start" busy={testHooks.isPending} onClick={runHooks}>
            <Users className="h-4 w-4" aria-hidden />
            Test these hooks with your audience
          </CsButton>
          <p className={cn('text-xs', tone.soft)} aria-live="polite">
            {testHooks.isPending
              ? 'Your panel is reading the openings…'
              : hookTest
                ? `${noneStopped} of ${hookTest.test.summary.answered} wouldn't stop for any of them. Simulated reactions.`
                : 'Each person sees only the openings, as the feed shows them, and picks the one that would stop them. Uses credits.'}
          </p>
        </div>
      ) : null}
      <ErrorNote
        error={
          (gen.error && apiErrorCode(gen.error) !== 'BRIEF_REQUIRED' ? gen.error : null) ||
          (testHooks.error && apiErrorCode(testHooks.error) !== 'BRIEF_REQUIRED' ? testHooks.error : null)
        }
      />
    </div>
  );
}

// ── grade ──────────────────────────────────────────────────────────────────
export function GradePanel({
  post,
  liveRules,
  dirty,
  onNeedBrief,
}: {
  post: ContentPost;
  liveRules: VoiceRuleResult[];
  dirty: boolean;
  onNeedBrief: () => void;
}) {
  const grade = useGradePost();
  const fix = useApplyFix();
  const { push } = useToast();
  const g = post.grade;
  const rules = dirty || !g ? liveRules : g.voiceRules?.length ? g.voiceRules : liveRules;
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      push({ variant: 'success', title: ok });
    } catch (e) {
      if (apiErrorCode(e) === 'BRIEF_REQUIRED') onNeedBrief();
    }
  };
  return (
    <Card className="flex flex-col gap-3 p-4" aria-label="Score">
      <div className="flex items-baseline justify-between gap-2">
        <SectionTitle as="h3">Score</SectionTitle>
        {g ? (
          <span className={cn('text-[28px] font-bold tabular-nums', tone.ink)}>
            {g.score} <span className={cn('text-[15px] font-semibold', tone.soft)}>/ 10</span>
          </span>
        ) : (
          <span className={cn('text-sm', tone.soft)}>Not graded yet</span>
        )}
      </div>
      {g ? (
        <dl className={cn('grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[13px] tabular-nums', tone.ink)}>
          {(Object.keys(DIMENSION_LABELS) as (keyof typeof DIMENSION_LABELS)[]).map((k) => (
            <React.Fragment key={k}>
              <dt className={tone.soft}>
                {DIMENSION_LABELS[k]}
                {k === 'hook' ? ' (half the score)' : ''}
              </dt>
              <dd className="font-semibold">{g.dimensions[k]}</dd>
            </React.Fragment>
          ))}
        </dl>
      ) : null}
      <div>
        <Label className="pb-1">Voice rules{dirty && g ? ' (live, as you type)' : ''}</Label>
        <ul className="flex flex-col gap-1">
          {rules.map((r) => (
            <li key={r.rule} className={cn('flex items-start gap-2 text-[13px]', tone.ink)}>
              {r.pass ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#0F6A3B] dark:text-[#9BE3B8]" aria-label="pass" />
              ) : (
                <X className="mt-0.5 h-4 w-4 shrink-0 text-[#A1202B] dark:text-[#FFB3B9]" aria-label="fail" />
              )}
              <span>
                {RULE_LABELS[r.rule]}
                {r.violation ? <span className={tone.soft}> · {r.violation}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {g?.fixes?.length ? (
        <div className="flex flex-col gap-2">
          <Label>Top 3 fixes</Label>
          <ol className="flex flex-col gap-3">
            {g.fixes.slice(0, 3).map((f, i) => (
              <li key={i} className={cn('flex flex-col gap-1 rounded-[10px] border p-3 text-[13px]', tone.line)}>
                <span className={cn('font-semibold', tone.ink)}>
                  {i + 1}. {f.issue}
                </span>
                {f.current ? <span className={tone.soft}>Now: “{f.current}”</span> : null}
                <span className={tone.soft}>Why: {f.why}</span>
                <span className={tone.ink}>Fix: {f.fix}</span>
                <CsButton
                  size="sm"
                  className="mt-1 self-start"
                  disabled={dirty}
                  title={dirty ? 'Save your edits first' : undefined}
                  busy={fix.isPending && fix.variables?.fixIndex === i}
                  onClick={() => run(() => fix.mutateAsync({ id: post.id, fixIndex: i }), 'Fix applied. A new version was saved.')}
                >
                  <Wand2 className="h-4 w-4" aria-hidden />
                  Apply fix {i + 1}
                </CsButton>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      <CsButton
        size="sm"
        disabled={dirty}
        title={dirty ? 'Save your edits first' : undefined}
        busy={grade.isPending}
        onClick={() => run(() => grade.mutateAsync(post.id), 'Graded')}
      >
        {g ? 'Grade again' : 'Grade this post'}
      </CsButton>
      <ErrorNote error={(grade.error && apiErrorCode(grade.error) !== 'BRIEF_REQUIRED' && grade.error) || (fix.error && apiErrorCode(fix.error) !== 'BRIEF_REQUIRED' && fix.error) || null} />
    </Card>
  );
}

// ── schedule ───────────────────────────────────────────────────────────────
export function SchedulePanel({
  post,
  channel,
  dirty,
  windowTime,
}: {
  post: ContentPost;
  channel: ChannelInfo | undefined;
  dirty: boolean;
  windowTime?: string;
}) {
  const tz = post.timezone;
  const schedule = useSchedulePost();
  const unschedule = useUnschedulePost();
  const approve = useApprovePost();
  const posted = useMarkPosted();
  const { push } = useToast();
  const [date, setDate] = useState(post.scheduledAt ? localDate(post.scheduledAt, tz) : todayLocal(tz));
  const [time, setTime] = useState(post.scheduledAt ? localTime(post.scheduledAt, tz) : windowTime || '10:00');
  const empty = post.status === 'idea' || !(post.hook || post.body || post.slides?.length || post.script);
  const err = schedule.error || unschedule.error || approve.error || posted.error;

  const doSchedule = async () => {
    const iso = zonedToUtcIso(date, time, tz);
    if (new Date(iso).getTime() <= Date.now()) {
      push({ variant: 'warning', title: 'Pick a time in the future' });
      return;
    }
    try {
      await schedule.mutateAsync({ id: post.id, scheduledAt: iso });
      push({ variant: 'success', title: 'Scheduled', description: `${shortDate(date)}, ${friendlyTime(iso, tz)}` });
    } catch {
      /* shown below */
    }
  };
  const quiet = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      push({ variant: 'success', title: ok });
    } catch {
      /* shown below */
    }
  };

  return (
    <Card className="flex flex-col gap-3 p-4" aria-label="Schedule">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle as="h3">When it goes out</SectionTitle>
        <span className="flex gap-2">
          <StatusChip status={post.status} />
          <ApprovalChip state={post.approvalState} />
        </span>
      </div>
      {channel ? (
        <p className={cn('text-[13px]', tone.soft)}>
          <strong className={tone.ink}>{channel.mode === 'auto' && post.publishMode !== 'reminder' ? 'Automatic.' : 'Reminder.'}</strong> {sentence(channel.note)}
        </p>
      ) : null}
      {post.isSample ? (
        <p className={cn('text-[13px]', tone.ink)}>
          This is a sample post. Save, approve or schedule it and it becomes yours; until then Mr LAD won&apos;t post it.
        </p>
      ) : null}
      {post.status === 'published' ? (
        <p className={cn('text-sm', tone.ink)}>
          Published {post.publishedAt ? `${shortDate(localDate(post.publishedAt, tz))}, ${friendlyTime(post.publishedAt, tz)}` : ''}.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" htmlFor="cs-sched-date">
              <input id="cs-sched-date" type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={`Time (${tz})`} htmlFor="cs-sched-time">
              <input id="cs-sched-time" type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <CsButton
              variant="primary"
              size="sm"
              busy={schedule.isPending}
              disabled={dirty || empty}
              title={dirty ? 'Save your edits first' : empty ? 'Write the post first' : undefined}
              onClick={doSchedule}
            >
              {post.status === 'scheduled' ? 'Move to this time' : 'Schedule'}
            </CsButton>
            {post.status === 'scheduled' ? (
              <CsButton size="sm" busy={unschedule.isPending} onClick={() => quiet(() => unschedule.mutateAsync(post.id), 'Taken off the schedule')}>
                Unschedule
              </CsButton>
            ) : null}
            {post.approvalState === 'pending' ? (
              <CsButton size="sm" busy={approve.isPending} onClick={() => quiet(() => approve.mutateAsync(post.id), 'Approved')}>
                <Check className="h-4 w-4" aria-hidden />
                Approve
              </CsButton>
            ) : null}
            {post.status === 'scheduled' && post.publishMode === 'reminder' ? (
              <CsButton size="sm" busy={posted.isPending} onClick={() => quiet(() => posted.mutateAsync({ id: post.id }), 'Marked as posted')}>
                Mark as posted
              </CsButton>
            ) : null}
          </div>
          {empty ? <p className={cn('text-xs', tone.soft)}>An idea needs writing before it can go on the scheduler.</p> : null}
        </>
      )}
      <ErrorNote error={err} />
    </Card>
  );
}

// ── versions ───────────────────────────────────────────────────────────────
export function VersionsPanel({ post, dirty }: { post: ContentPost; dirty: boolean }) {
  const versions = useVersions(post.id);
  const restore = useRestoreVersion();
  const { push } = useToast();
  const [confirm, setConfirm] = useState<number | null>(null);
  return (
    <Card className="flex flex-col gap-3 p-4" aria-label="Version history">
      <div className="flex items-center justify-between gap-2">
        <SectionTitle as="h3">
          <span className="inline-flex items-center gap-2">
            <History className="h-4 w-4" aria-hidden /> Versions
          </span>
        </SectionTitle>
        <span className={cn('text-xs tabular-nums', tone.soft)}>Now on v{post.version}</span>
      </div>
      {versions.isLoading ? (
        <p className={cn('text-sm', tone.soft)}>Loading versions…</p>
      ) : versions.data?.length ? (
        <ol className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
          {versions.data.map((v) => (
            <li key={v.version} className={cn('flex flex-col gap-1 rounded-[10px] border p-3', tone.line)}>
              <div className="flex items-center justify-between gap-2">
                <span className={cn('text-sm font-semibold tabular-nums', tone.ink)}>v{v.version}</span>
                <span className={cn('text-xs tabular-nums', tone.soft)}>
                  {shortDate(localDate(v.createdAt, post.timezone))}, {friendlyTime(v.createdAt, post.timezone)}
                </span>
              </div>
              <span className={cn('text-[13px]', tone.soft)}>{v.reason}</span>
              {v.snapshot?.hook ? <span className={cn('line-clamp-2 text-[13px]', tone.ink)}>“{v.snapshot.hook}”</span> : null}
              {v.version !== post.version ? (
                confirm === v.version ? (
                  <div className="flex flex-wrap gap-2">
                    <CsButton
                      size="sm"
                      variant="primary"
                      busy={restore.isPending}
                      onClick={async () => {
                        try {
                          await restore.mutateAsync({ id: post.id, version: v.version });
                          push({ variant: 'success', title: `Restored v${v.version}`, description: 'Saved as a new version, nothing was lost.' });
                          setConfirm(null);
                        } catch {
                          /* shown below */
                        }
                      }}
                    >
                      Yes, restore v{v.version}
                    </CsButton>
                    <CsButton size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                      Keep current
                    </CsButton>
                  </div>
                ) : (
                  <CsButton size="sm" className="self-start" disabled={dirty} title={dirty ? 'Save or discard your edits first' : undefined} onClick={() => setConfirm(v.version)}>
                    <RotateCcw className="h-4 w-4" aria-hidden />
                    Restore
                  </CsButton>
                )
              ) : (
                <span className={cn('text-xs font-semibold', tone.soft)}>Current version</span>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className={cn('text-sm', tone.soft)}>Every save keeps a version here.</p>
      )}
      <ErrorNote error={versions.error || restore.error} />
    </Card>
  );
}

export function ChannelNote({ platform, channels }: { platform: Platform; channels?: ChannelInfo[] }) {
  const c = channels?.find((x) => x.platform === platform);
  if (!c) return null;
  return (
    <p className={cn('text-xs', tone.soft)}>
      {PLATFORM_META[platform].label}: {c.note}
    </p>
  );
}
