'use client';
/**
 * "Test with your audience": 20 simulated people modelled on the tenant's
 * buyers react to a post before it goes out.
 *
 * Honesty rules (CONTRACT-audience §0): results are counts out of the panel
 * and a comparison with the tenant's own tests. The only number that looks
 * like a forecast is a LinkedIn engagement-rate range, shown only once real
 * published posts have calibrated it. Everything is labelled simulated, and
 * panel members carry role labels, never personal names.
 */
import React, { useState } from 'react';
import { RefreshCw, Users, Wand2 } from 'lucide-react';
import type {
  AudiencePanel,
  AudienceTest,
  AudienceTestSummary,
  ContentPost,
  PersonaReaction,
} from '@lad/frontend-features/content-studio';
import {
  useApplyAudienceFix,
  useAudiencePanel,
  useAudienceTests,
  useBuildAudiencePanel,
  useCalibration,
  useRunAudienceTest,
} from '@lad/frontend-features/content-studio';
import { apiErrorCode } from '@lad/shared/apiError';
import { useToast } from '@/components/ui/app-toaster';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { OBJECTION_LABEL, REACTION_LABEL, SEGMENT_LABEL } from '@/lib/content-studio/meta';
import { ago, localDate, shortDate } from '@/lib/content-studio/time';
import { Card, CsButton, ErrorNote, Label, SectionTitle, tone } from './ui';
import { cn } from '@/lib/utils';

const SIMULATED_NOTE = 'Simulated reactions from people modelled on your audience, not real ones.';
const BAR = 'bg-[#5272C7] dark:bg-[#6F90E0]';
const TRACK = 'bg-[#ECEEF3] dark:bg-[#24305A]';

/** Latest whole-post test for a post (tests come latest first). */
export function latestPostTest(tests: AudienceTest[] | undefined): AudienceTest | null {
  return (tests || []).find((t) => t.variant === 'post') || null;
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function panelLine(panel: AudiencePanel) {
  const s = panel.source;
  return `${panel.personas.length} people: ${plural(s.buyers, 'buyer', 'buyers')}, ${plural(s.peers, 'peer', 'peers')}, ${plural(s.casual, 'casual scroller', 'casual scrollers')}`;
}

// ── composer card ──────────────────────────────────────────────────────────
export function AudienceCard({ post, dirty, onNeedBrief }: { post: ContentPost; dirty: boolean; onNeedBrief: () => void }) {
  const panelQ = useAudiencePanel();
  const build = useBuildAudiencePanel();
  const tests = useAudienceTests(post.id);
  const run = useRunAudienceTest();
  const fix = useApplyAudienceFix();
  const { push } = useToast();
  const [showPanel, setShowPanel] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);

  const panel = panelQ.data?.panel ?? null;
  const latest = latestPostTest(tests.data);
  const stale = !!latest && latest.postVersion !== post.version;
  const hasCopy = !!(post.hook || post.body);

  const buildPanel = async () => {
    try {
      const { panel: p } = await build.mutateAsync();
      push({
        variant: 'success',
        title: 'Your audience panel is ready',
        description: p.source.leadsUsed
          ? `${p.personas.length} people modelled on ${p.source.leadsUsed.toLocaleString()} of your leads and your Business Profile.`
          : `${p.personas.length} people modelled on your Business Profile.`,
      });
    } catch (e) {
      if (apiErrorCode(e) === 'BRIEF_REQUIRED') onNeedBrief();
    }
  };

  const runTest = async () => {
    try {
      const t = await run.mutateAsync({ postId: post.id, body: { variant: 'post', force: !!latest && !stale } });
      push(
        t.cached
          ? { variant: 'success', title: 'This version was already tested', description: 'Showing that result. Nothing was charged.' }
          : { variant: 'success', title: 'Tested with your audience', description: `${t.summary.counts?.stopped ?? 0} of ${t.summary.answered} stopped scrolling.` }
      );
    } catch (e) {
      const code = apiErrorCode(e);
      if (code === 'BRIEF_REQUIRED') onNeedBrief();
      if (code === 'PANEL_REQUIRED') panelQ.refetch();
    }
  };

  const applyFix = async (test: AudienceTest) => {
    try {
      await fix.mutateAsync({ postId: post.id, testId: test.id });
      push({ variant: 'success', title: 'Fix applied', description: 'A new version was saved. Run the test again to see the difference.' });
    } catch (e) {
      if (apiErrorCode(e) === 'BRIEF_REQUIRED') onNeedBrief();
    }
  };

  const err =
    (build.error && apiErrorCode(build.error) !== 'BRIEF_REQUIRED' && build.error) ||
    (run.error && !['BRIEF_REQUIRED', 'PANEL_REQUIRED'].includes(apiErrorCode(run.error) || '') && run.error) ||
    (fix.error && apiErrorCode(fix.error) !== 'BRIEF_REQUIRED' && fix.error) ||
    panelQ.error ||
    tests.error ||
    null;

  const score = latest && !stale ? latest.summary.panelScore : null;

  return (
    <Card className="flex flex-col gap-3 p-4" aria-label="Test with your audience">
      <div className="flex items-baseline justify-between gap-2">
        <SectionTitle as="h3">Test with your audience</SectionTitle>
        {score != null ? (
          <span className={cn('text-[28px] font-bold tabular-nums', tone.ink)}>
            {score} <span className={cn('text-[15px] font-semibold', tone.soft)}>/ 100</span>
          </span>
        ) : null}
      </div>

      {panelQ.isLoading ? (
        <p className={cn('text-sm', tone.soft)}>Loading your audience panel…</p>
      ) : !panel ? (
        <div className="flex flex-col gap-2">
          <p className={cn('text-[13px]', tone.ink)}>
            See how 20 people modelled on your buyers react before you post: who stops scrolling, what they&apos;d comment and what holds them back.
          </p>
          <p className={cn('text-xs', tone.soft)}>
            Built from your Business Profile and the roles, industries and cities of your leads. No names or contact details are used. Takes about 20 seconds and uses credits.
          </p>
          <CsButton variant="primary" size="sm" className="self-start" busy={build.isPending} onClick={buildPanel}>
            <Users className="h-4 w-4" aria-hidden />
            Build my audience panel
          </CsButton>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className={cn('text-[13px]', tone.ink)}>
              {panelLine(panel)} <span className={tone.soft}>· built {ago(panel.builtAt)}</span>
            </p>
            <span className="flex flex-wrap gap-1">
              <CsButton size="sm" variant="ghost" onClick={() => setShowPanel(true)}>
                See who&apos;s on it
              </CsButton>
              <CsButton size="sm" variant="ghost" busy={build.isPending} onClick={buildPanel}>
                <RefreshCw className="h-4 w-4" aria-hidden />
                Rebuild
              </CsButton>
            </span>
          </div>

          {latest ? (
            <TestResult
              test={latest}
              stale={stale}
              dirty={dirty}
              fixing={fix.isPending}
              onApplyFix={() => applyFix(latest)}
              onShowAnswers={() => setShowAnswers(true)}
            />
          ) : null}

          <div className="flex flex-col gap-1">
            <CsButton
              variant={latest && !stale ? 'secondary' : 'primary'}
              size="sm"
              className="self-start"
              busy={run.isPending}
              disabled={dirty || !hasCopy}
              title={dirty ? 'Save your edits first' : !hasCopy ? 'Write the post first' : undefined}
              onClick={runTest}
            >
              {latest && !stale ? 'Run again' : 'Run the test'}
            </CsButton>
            <p className={cn('text-xs', tone.soft)} aria-live="polite">
              {run.isPending
                ? `${panel.personas.length} people are reading your post. This takes about 20 seconds.`
                : latest && !stale
                  ? 'Running again charges credits for a fresh set of answers.'
                  : 'Each person sees it the way the feed shows it, then the full post if they stop.'}
            </p>
          </div>
        </div>
      )}

      <ErrorNote error={err} />
      <p className={cn('text-xs', tone.soft)}>{SIMULATED_NOTE}</p>

      {panel ? <PanelDialog panel={panel} open={showPanel} onClose={() => setShowPanel(false)} /> : null}
      {panel && latest ? <AnswersDialog panel={panel} test={latest} open={showAnswers} onClose={() => setShowAnswers(false)} /> : null}
    </Card>
  );
}

// ── one test result ────────────────────────────────────────────────────────
function TestResult({
  test,
  stale,
  dirty,
  fixing,
  onApplyFix,
  onShowAnswers,
}: {
  test: AudienceTest;
  stale: boolean;
  dirty: boolean;
  fixing: boolean;
  onApplyFix: () => void;
  onShowAnswers: () => void;
}) {
  const s = test.summary;
  const c = s.counts;
  return (
    <section className="flex flex-col gap-3" aria-label="Latest audience test">
      {stale ? (
        <p className={cn('rounded-[10px] border p-3 text-[13px]', tone.line, tone.ink)}>
          This test was on v{test.postVersion}. The post has changed since, so run it again for the current words.
        </p>
      ) : null}

      {c ? (
        <>
          <p className={cn('text-base font-semibold', tone.ink)}>
            {c.stopped} of {s.answered} stopped scrolling
          </p>
          {s.degraded ? (
            <p className={cn('text-xs', tone.soft)}>
              {s.answered} of {s.panelSize} people answered; the rest timed out, so counts are out of {s.answered}.
            </p>
          ) : null}
          <Funnel
            total={s.answered}
            rows={[
              ['Stopped scrolling', c.stopped],
              ['Read to the end', c.readAll],
              ['Would react', c.reacted],
              ['Would comment', c.commented],
              ['Would share', c.shared],
              ['Would message you', c.messaged],
            ]}
          />
          {s.panelScore != null ? (
            <p className={cn('text-xs', tone.soft)}>
              Panel score {s.panelScore} / 100: how far people got, from stopping to commenting, with buyers counting most.
            </p>
          ) : null}
        </>
      ) : null}

      <div className={cn('flex flex-col gap-1 text-[13px]', tone.ink)}>
        {s.history && s.history.tested > 0 ? (
          <p>
            Stronger than {s.history.betterThan} of your last {plural(s.history.tested, 'tested post', 'tested posts')}.
          </p>
        ) : null}
        {s.segments.length ? (
          <p className={tone.soft}>
            {s.segments.map((g) => `${SEGMENT_LABEL[g.segment]} ${g.stopped} of ${g.size}`).join(' · ')} stopped.
          </p>
        ) : null}
        {s.landsWith ? (
          <p>
            <strong>Lands with</strong> {s.landsWith.group} ({s.landsWith.stopped} of {s.landsWith.size} stopped).
          </p>
        ) : null}
        {s.misses ? (
          <p>
            <strong>Misses</strong> {s.misses.group} ({s.misses.stopped} of {s.misses.size} stopped).
          </p>
        ) : null}
      </div>

      {s.objections.length ? (
        <div className="flex flex-col gap-1">
          <Label>What held people back</Label>
          <ul className="flex flex-col gap-2">
            {s.objections.map((o) => (
              <li key={o.kind} className={cn('text-[13px]', tone.ink)}>
                <strong>{OBJECTION_LABEL[o.kind]}</strong> <span className={tone.soft}>· {plural(o.count, 'person', 'people')}</span>
                {o.example ? <span className={cn('block', tone.soft)}>“{o.example}”</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {s.comments.length ? (
        <div className="flex flex-col gap-1">
          <Label>What they&apos;d comment (simulated)</Label>
          <ul className="flex flex-col gap-2">
            {s.comments.map((cm, i) => (
              <li key={i} className={cn('rounded-[10px] border p-3 text-[13px]', tone.line)}>
                <span className={tone.ink}>“{cm.text}”</span>
                <span className={cn('block text-xs', tone.soft)}>{cm.personaLabel}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {s.fix ? (
        <div className={cn('flex flex-col gap-1 rounded-[10px] border p-3 text-[13px]', tone.line)}>
          <Label>Fix from this test</Label>
          <span className={cn('font-semibold', tone.ink)}>{s.fix.issue}</span>
          {s.fix.current ? <span className={tone.soft}>Now: “{s.fix.current}”</span> : null}
          <span className={tone.soft}>Why: {s.fix.why}</span>
          <span className={tone.ink}>Fix: {s.fix.fix}</span>
          <CsButton
            size="sm"
            className="mt-1 self-start"
            busy={fixing}
            disabled={dirty || stale}
            title={dirty ? 'Save your edits first' : stale ? 'Run the test again first' : undefined}
            onClick={onApplyFix}
          >
            <Wand2 className="h-4 w-4" aria-hidden />
            Fix with this
          </CsButton>
        </div>
      ) : null}

      <Prediction summary={s} />

      <div className="flex flex-wrap items-center gap-2">
        <CsButton size="sm" variant="ghost" onClick={onShowAnswers}>
          See every answer
        </CsButton>
        <span className={cn('text-xs', tone.soft)}>
          Tested {ago(test.createdAt)} on v{test.postVersion}
        </span>
      </div>
    </section>
  );
}

function Funnel({ rows, total }: { rows: [string, number][]; total: number }) {
  const max = Math.max(1, total);
  return (
    <ul className="flex flex-col gap-1.5" aria-label="How far people got">
      {rows.map(([label, n]) => (
        <li key={label} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3.5rem] items-center gap-2 text-[13px]">
          <span className={tone.ink}>{label}</span>
          <span className={cn('h-3 rounded-full', TRACK)} aria-hidden>
            <span className={cn('block h-3 rounded-full', BAR)} style={{ width: `${(n / max) * 100}%` }} />
          </span>
          <span className={cn('text-right font-semibold tabular-nums', tone.ink)}>
            {n} of {total}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Prediction({ summary: s }: { summary: AudienceTestSummary }) {
  let body: React.ReactNode;
  if (s.predictionStatus === 'ready' && s.prediction) {
    body = (
      <>
        <span className={cn('text-base font-semibold tabular-nums', tone.ink)}>
          Likely engagement {s.prediction.low}% to {s.prediction.high}%
        </span>
        <span className={cn('text-xs', tone.soft)}>
          Based on how this panel&apos;s scores matched the real numbers of your last {s.prediction.basedOn} published LinkedIn posts.
        </span>
      </>
    );
  } else if (s.predictionStatus === 'collecting') {
    const need = s.predictionNeed || { have: 0, need: 10 };
    body = (
      <>
        <span className={cn('text-[13px]', tone.ink)}>
          An engagement range appears after {need.need} published LinkedIn posts with real numbers. You have {need.have}.
        </span>
        <span
          className={cn('h-2 rounded-full', TRACK)}
          role="progressbar"
          aria-label="Posts with real numbers"
          aria-valuemin={0}
          aria-valuemax={need.need}
          aria-valuenow={Math.min(need.have, need.need)}
        >
          <span className={cn('block h-2 rounded-full', BAR)} style={{ width: `${Math.min(100, (need.have / Math.max(1, need.need)) * 100)}%` }} />
        </span>
      </>
    );
  } else if (s.predictionStatus === 'weak') {
    body = (
      <span className={cn('text-[13px]', tone.ink)}>
        No range for now: this panel&apos;s scores haven&apos;t matched your real LinkedIn results closely enough yet. Mr LAD keeps checking as posts publish.
      </span>
    );
  } else {
    body = (
      <span className={cn('text-[13px]', tone.ink)}>
        Engagement ranges cover LinkedIn only, where Mr LAD publishes and reads the real numbers.
      </span>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      <Label>Prediction</Label>
      {body}
    </div>
  );
}

// ── dialogs ────────────────────────────────────────────────────────────────
function PanelDialog({ panel, open, onClose }: { panel: AudiencePanel; open: boolean; onClose: () => void }) {
  const s = panel.source;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <div className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto p-5 sm:p-6">
          <DialogTitle className="pr-10 text-xl">Your audience panel</DialogTitle>
          <DialogDescription className={tone.soft}>
            {panelLine(panel)}.{' '}
            {s.leadsUsed
              ? `Buyers are modelled on the roles, industries and cities of ${s.leadsUsed.toLocaleString()} of your leads${s.usedProfile ? ' and your Business Profile' : ''}.`
              : 'Buyers are modelled on your Business Profile.'}{' '}
            They are simulated people, not your contacts.
          </DialogDescription>
          {(['buyer', 'peer', 'casual'] as const).map((seg) => {
            const people = panel.personas.filter((p) => p.segment === seg);
            if (!people.length) return null;
            return (
              <section key={seg} className="flex flex-col gap-2" aria-label={SEGMENT_LABEL[seg]}>
                <Label>
                  {SEGMENT_LABEL[seg]} · {people.length}
                </Label>
                <ul className="flex flex-col gap-2">
                  {people.map((p) => (
                    <li key={p.id} className={cn('rounded-[10px] border p-3 text-[13px]', tone.line)}>
                      <span className={cn('block font-semibold', tone.ink)}>{p.label}</span>
                      {p.cares.length ? <span className={cn('block', tone.ink)}>Cares about: {p.cares.join('; ')}</span> : null}
                      {p.scrollsPast.length ? <span className={cn('block', tone.soft)}>Scrolls past: {p.scrollsPast.join('; ')}</span> : null}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function reactionLine(r: PersonaReaction): string {
  if (!r.stopped) return 'Scrolled past';
  const bits = [r.readAll ? 'Read to the end' : 'Stopped, then moved on'];
  if (r.reaction !== 'none') bits.push(REACTION_LABEL[r.reaction]);
  if (r.share) bits.push('Would share');
  if (r.message) bits.push('Would message you');
  return bits.join(' · ');
}

function AnswersDialog({ panel, test, open, onClose }: { panel: AudiencePanel; test: AudienceTest; open: boolean; onClose: () => void }) {
  const byId = new Map(test.reactions.map((r) => [r.personaId, r]));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <div className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto p-5 sm:p-6">
          <DialogTitle className="pr-10 text-xl">Every answer</DialogTitle>
          <DialogDescription className={tone.soft}>
            v{test.postVersion}, tested {shortDate(localDate(test.createdAt))}. {SIMULATED_NOTE}
          </DialogDescription>
          <ul className="flex flex-col gap-2">
            {panel.personas.map((p) => {
              const r = byId.get(p.id) as PersonaReaction | undefined;
              return (
                <li key={p.id} className={cn('rounded-[10px] border p-3 text-[13px]', tone.line)}>
                  <span className={cn('block font-semibold', tone.ink)}>{p.label}</span>
                  <span className={cn('block text-xs', tone.soft)}>{SEGMENT_LABEL[p.segment]}</span>
                  {r && 'stopped' in r ? (
                    <>
                      <span className={cn('mt-1 block', tone.ink)}>{reactionLine(r)}</span>
                      {r.comment ? <span className={cn('block', tone.ink)}>Would comment: “{r.comment}”</span> : null}
                      {r.objection ? (
                        <span className={cn('block', tone.soft)}>
                          Held back: {OBJECTION_LABEL[r.objection.kind]}
                          {r.objection.text ? `, “${r.objection.text}”` : ''}
                        </span>
                      ) : null}
                      {r.why ? <span className={cn('block', tone.soft)}>Why: {r.why}</span> : null}
                    </>
                  ) : (
                    <span className={cn('mt-1 block', tone.soft)}>No answer (timed out).</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Analytics: predicted vs actual ─────────────────────────────────────────
type CalPoint = { engagementRate: number; predictedLow: number | null; predictedHigh: number | null };
const inRange = (p: CalPoint) => p.predictedLow != null && p.predictedHigh != null && p.engagementRate >= p.predictedLow && p.engagementRate <= p.predictedHigh;

function RangeChip({ hit }: { hit: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-semibold',
        hit ? 'bg-[#E3F4EA] text-[#0F5A33] dark:bg-[#0E3320] dark:text-[#9BE3B8]' : 'bg-[#ECEEF3] text-[#3B4256] dark:bg-[#2A3150] dark:text-[#D5DAE6]'
      )}
    >
      {hit ? 'In range' : 'Outside'}
    </span>
  );
}

export function PredictedVsActual() {
  const q = useCalibration();
  if (q.isLoading) return null;
  const c = q.data;
  return (
    <Card className="flex flex-col gap-3 p-4" aria-label="Audience test: predicted vs actual">
      <SectionTitle>Audience test: predicted vs actual</SectionTitle>
      {!c ? (
        <ErrorNote error={q.error || new Error("Couldn't load the comparison. Refresh to try again.")} />
      ) : c.status === 'collecting' ? (
        <p className={cn('text-[13px]', tone.ink)}>
          Mr LAD compares each tested LinkedIn post&apos;s panel score with its real engagement after 3 days. Ranges start after {c.need} published posts with real numbers. You have {c.have}.
        </p>
      ) : (
        <>
          <p className={cn('text-[13px]', tone.ink)}>
            {c.status === 'ready'
              ? `The panel's scores track your real LinkedIn engagement across ${plural(c.have, 'post', 'posts')}, so tests show a likely range.`
              : `Across ${plural(c.have, 'post', 'posts')}, the panel's scores haven't tracked your real engagement closely enough yet, so tests show no range.`}
            {(() => {
              const ranged = c.points.filter((p) => p.predictedLow != null && p.predictedHigh != null);
              if (!ranged.length) return null;
              const hits = ranged.filter((p) => inRange(p)).length;
              return ` Real engagement landed inside the predicted range for ${hits} of ${ranged.length}.`;
            })()}
          </p>
          {/* Phones: one stacked row per post, so the real number is never off-screen. */}
          <ul className="flex flex-col gap-2 sm:hidden" aria-label="Predicted vs actual per post">
            {c.points.map((p) => (
              <li key={p.postId} className={cn('flex flex-col gap-1 rounded-[10px] border p-3 text-[13px]', tone.line)}>
                <span className={cn('font-semibold', tone.ink)}>{p.title}</span>
                <span className={cn('tabular-nums', tone.ink)}>
                  Real {p.engagementRate}% <span className={tone.soft}>· panel score {p.panelScore}</span>
                </span>
                {p.predictedLow != null && p.predictedHigh != null ? (
                  <span className={cn('flex flex-wrap items-center gap-2 tabular-nums', tone.soft)}>
                    Predicted {p.predictedLow}% to {p.predictedHigh}% <RangeChip hit={inRange(p)} />
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="hidden sm:block">
            <table className={cn('w-full text-left text-[13px]', tone.ink)}>
              <caption className="sr-only">Panel score, predicted range and real engagement per post</caption>
              <thead>
                <tr className={cn('border-b', tone.line)}>
                  <th scope="col" className="py-2 pr-2 font-semibold">Post</th>
                  <th scope="col" className="py-2 pr-2 text-right font-semibold">Panel score</th>
                  <th scope="col" className="py-2 pr-2 text-right font-semibold">Predicted</th>
                  <th scope="col" className="py-2 text-right font-semibold">Real engagement</th>
                </tr>
              </thead>
              <tbody>
                {c.points.map((p) => (
                  <tr key={p.postId} className={cn('border-b last:border-0', tone.line)}>
                    <td className="max-w-[16rem] truncate py-2 pr-2">{p.title}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{p.panelScore}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {p.predictedLow != null && p.predictedHigh != null ? (
                        <span className="inline-flex items-center justify-end gap-2">
                          {p.predictedLow}% to {p.predictedHigh}% <RangeChip hit={inRange(p)} />
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2 text-right font-semibold tabular-nums">{p.engagementRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
