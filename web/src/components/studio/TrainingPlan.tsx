'use client';

/**
 * TrainingPlan — the Train Mr LAD home (the rooms view).
 *
 * One list, in the order that helps most: what Mr LAD knows about the
 * business, how it should sound, where it talks, who is a good fit, then
 * practising and correcting it. Each step says in plain words how far along
 * it is and offers one action; the first unfinished step is repeated at the
 * top as "Next". The practice steps (ideal customer, rehearse, ask for a
 * change) open on their own screen, so on a phone they are not two screens
 * below the status cards.
 *
 * Every number comes from `GET /studio` (`state`); a field the backend does
 * not report hides its step rather than showing it as empty.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowRight, Briefcase, CheckCircle2, Circle, History, Lock, MessagesSquare, Radio, Rocket, SlidersHorizontal, Sparkles, Target, Theater,
} from 'lucide-react';
import type { StudioState } from '@lad/frontend-features/tenant-studio';
import { launchRowTitle } from './StudioLaunchBanner';
import { timeAgo } from './StudioHistory';
import { AI_GRADIENT, CARD, CARD_ACTIVE, CTA_PRIMARY, ICON_TILE, LINK, READY_PULSE, TINT } from './studio-theme';

export type TrainingRoom = 'pipelines' | 'icp' | 'rehearse' | 'tailor';

/** Where the business answers (setup steps 1–5) are edited. */
const PROFILE_HREF = '/settings?tab=businessprofile';

const FIELD_LABELS: Record<string, string> = {
  companyName: 'Company name', industry: 'Industry', valueProposition: 'Value proposition', productsServices: 'Products / services',
  targetCustomers: 'Target customers', companyDescription: 'Company description', icpJobTitles: 'Decision-maker titles',
  icpCompanySize: 'Company size', icpLocations: 'Locations', icpPainPoints: 'Pain points', operatingHours: 'Operating hours',
  timezone: 'Timezone', geographicFocus: 'Geographic focus', campaignTone: 'Campaign tone',
};

/** The title and one-line purpose of each room, shared with the room's own screen. */
export const ROOM_COPY: Record<TrainingRoom, { title: string; why: string }> = {
  pipelines: { title: 'Your pipelines', why: 'Switch on what your support agent runs and fill in its settings.' },
  icp: { title: 'Who is a good fit', why: 'Paste a few real leads and mark each a fit or not. Mr LAD learns who to go after.' },
  rehearse: { title: 'Practise and correct', why: 'Play a prospect, read each reply, and correct any you would not send.' },
  tailor: { title: 'Ask for any change', why: 'Tell Mr LAD in your own words what to do differently. You see every change before it applies.' },
};

type Status = 'done' | 'todo' | 'locked' | 'open';

interface Action { label: string; href?: string; onClick?: () => void }

interface Step {
  key: string;
  icon: typeof Briefcase;
  title: string;
  why: string;
  status: Status;
  detail: string;
  action: Action | null;
  /** Counts toward "basics done" (the practice steps never finish). */
  basic: boolean;
}

export interface TrainingPlanProps {
  state: StudioState;
  onOpenRoom: (room: TrainingRoom) => void;
  /** Setup steps opened in the Studio frame; omitted when the backend does not report what the step is built on. */
  onChannels?: () => void;
  onReferences?: () => void;
  onFirstCampaign?: () => void;
  onGoLive?: () => void;
  onHistory?: () => void;
  /** Rendered between "Next step" and the step list (Mr LAD's open questions — answering one is training too). */
  afterNext?: ReactNode;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function buildSteps(state: StudioState, p: TrainingPlanProps): Step[] {
  const { interview, rehearsal, icpTraining, references: refs, channels, workspace } = state;
  const curated = workspace?.curated === true;
  const steps: Step[] = [];

  if (curated && workspace) {
    const on = workspace.pipelines.filter((x) => x.entitled && x.active).length;
    const available = workspace.pipelines.filter((x) => x.entitled).length;
    steps.push({
      key: 'pipelines', icon: SlidersHorizontal, ...ROOM_COPY.pipelines, basic: true,
      status: on > 0 ? 'done' : 'todo',
      detail: `${on} on, ${available} available`,
      action: { label: on > 0 ? 'Open' : 'Switch one on', onClick: () => p.onOpenRoom('pipelines') },
    });
  }

  const missing = interview.missing.map((k) => FIELD_LABELS[k] ?? k);
  steps.push({
    key: 'business', icon: Briefcase, title: 'Your business', basic: true,
    why: 'What you sell, who buys it and how you work. Everything else builds on this.',
    status: interview.complete ? 'done' : 'todo',
    detail: interview.complete
      ? `All ${interview.required} key answers in${interview.optionalTotal ? ` · ${interview.optionalFilled} of ${interview.optionalTotal} extras` : ''}`
      : `${interview.filled} of ${interview.required} key answers · still needed: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ` and ${missing.length - 3} more` : ''}`,
    action: { label: interview.complete ? 'Review answers' : 'Continue', href: PROFILE_HREF },
  });

  if (refs && p.onReferences) {
    const docs = refs.documents + refs.links + refs.posts;
    const shared = refs.conversations + docs;
    steps.push({
      key: 'voice', icon: MessagesSquare, title: 'How you sound', basic: true,
      why: 'A few real conversations and documents, so messages sound like you, not a template.',
      status: shared > 0 ? 'done' : 'todo',
      detail: shared > 0
        ? [refs.conversations ? plural(refs.conversations, 'conversation') : '', docs ? plural(docs, 'document or link', 'documents and links') : ''].filter(Boolean).join(', ')
        : 'Nothing shared yet, so it writes in a neutral voice',
      action: { label: shared > 0 ? 'Add more' : 'Add examples', onClick: p.onReferences },
    });
  }

  if (Array.isArray(channels) && p.onChannels) {
    const on = channels.filter((c) => c.isOn);
    const ready = on.filter((c) => c.ready);
    steps.push({
      key: 'channels', icon: Radio, title: 'Where it talks', basic: true,
      why: 'Switch on the channels Mr LAD should use and give each one its first line.',
      status: ready.length > 0 ? 'done' : 'todo',
      detail: on.length === 0 ? 'No channel switched on yet' : `${ready.length} of ${plural(on.length, 'switched-on channel')} ready`,
      action: { label: ready.length > 0 ? 'Change' : 'Set up', onClick: p.onChannels },
    });
  }

  steps.push({
    key: 'icp', icon: Target, ...ROOM_COPY.icp, basic: false,
    status: icpTraining.ready ? 'open' : 'locked',
    detail: icpTraining.ready ? 'Takes about five minutes' : 'Opens once your business answers are in',
    action: icpTraining.ready ? { label: 'Start', onClick: () => p.onOpenRoom('icp') } : null,
  });

  const rehearseLocked = !rehearsal.ready;
  steps.push({
    key: 'rehearse', icon: Theater, ...ROOM_COPY.rehearse, basic: false,
    why: curated ? 'Play a member on WhatsApp, read each reply, and correct any you would not send.' : ROOM_COPY.rehearse.why,
    status: rehearseLocked ? 'locked' : 'open',
    detail: !rehearseLocked
      ? 'Try one conversation, it takes a minute'
      : rehearsal.reason === 'no_agent_prompt'
        ? (curated ? 'Switch the customer support pipeline on first' : 'Set up Mr LAD for LinkedIn first')
        : 'Opens once your business answers are in',
    action: !rehearseLocked
      ? { label: 'Practise', onClick: () => p.onOpenRoom('rehearse') }
      : rehearsal.reason === 'no_agent_prompt'
        ? (curated ? { label: 'Open pipelines', onClick: () => p.onOpenRoom('pipelines') } : { label: 'Set up for LinkedIn', href: '/settings?tab=chat' })
        : null,
  });

  steps.push({
    key: 'tailor', icon: Sparkles, ...ROOM_COPY.tailor, basic: false,
    status: 'open',
    detail: 'Handing over to you, replies, follow-ups, anything',
    action: { label: 'Ask', onClick: () => p.onOpenRoom('tailor') },
  });

  return steps;
}

function ActionButton({ action, primary = false, testId }: { action: Action; primary?: boolean; testId?: string }) {
  const cls = primary
    ? `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-5 text-sm font-semibold ${CTA_PRIMARY}`
    : 'inline-flex min-h-11 items-center justify-center gap-1 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 transition-colors hover:border-[#7C5CFF]/50 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10';
  const body = <>{action.label}<ArrowRight className="h-4 w-4" aria-hidden /></>;
  return action.href
    ? <Link href={action.href} className={cls} data-testid={testId}>{body}</Link>
    : <button type="button" onClick={action.onClick} className={cls} data-testid={testId}>{body}</button>;
}

function StatusIcon({ status }: { status: Status }) {
  if (status === 'done') return <CheckCircle2 className={`h-5 w-5 ${TINT.ready}`} aria-label="Done" />;
  if (status === 'locked') return <Lock className="h-5 w-5 text-slate-400 dark:text-slate-500" aria-label="Not available yet" />;
  return <Circle className="h-5 w-5 text-slate-400 dark:text-slate-500" aria-label={status === 'todo' ? 'To do' : 'Any time'} />;
}

export default function TrainingPlan(props: TrainingPlanProps) {
  const { state, onFirstCampaign, onGoLive, onHistory, afterNext } = props;
  const steps = buildSteps(state, props);
  const basics = steps.filter((s) => s.basic);
  const basicsDone = basics.filter((s) => s.status === 'done').length;
  const next = steps.find((s) => s.status === 'todo') ?? null;

  const setupDone = Boolean(state.setup && state.setup.completedAt !== null);
  const launch = state.launch;
  const fc = state.firstCampaign;
  const showLaunch = !setupDone && Boolean(launch && onGoLive);
  const history = state.history;

  return (
    <div className="space-y-4" data-testid="training-plan">
      {/* What to do next: the first unfinished basic, or practise once they are all in. */}
      <section className={`${CARD_ACTIVE} p-4 sm:p-5`} data-testid="training-next">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#5b3fd6] dark:text-[#B69CFF]">
            {next ? 'Next step' : 'The basics are in'}
          </p>
          {basics.length > 0 && (
            <p className="text-xs text-muted-foreground" data-testid="training-basics">{basicsDone} of {basics.length} basics done</p>
          )}
        </div>
        {basics.length > 0 && (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80 dark:bg-white/10" aria-hidden>
            <div className={`h-full rounded-full ${AI_GRADIENT}`} style={{ width: `${Math.round((basicsDone / basics.length) * 100)}%` }} />
          </div>
        )}
        {next ? (
          <>
            <h2 className="mt-3 text-lg font-semibold tracking-tight">{next.title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{next.why}</p>
            <p className="mt-1 text-sm">{next.detail}</p>
            {next.action && <div className="mt-3"><ActionButton action={next.action} primary testId="training-next-action" /></div>}
          </>
        ) : (
          <>
            <h2 className="mt-3 text-lg font-semibold tracking-tight">Now practise and correct it</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Mr LAD knows your business. The quickest way to make it better is to play a prospect and fix the replies you would not send.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {state.rehearsal.ready && <ActionButton action={{ label: 'Practise', onClick: () => props.onOpenRoom('rehearse') }} primary testId="training-next-action" />}
              <ActionButton action={{ label: 'Ask for a change', onClick: () => props.onOpenRoom('tailor') }} primary={!state.rehearsal.ready} />
            </div>
          </>
        )}
      </section>

      {afterNext}

      {/* Every step, in order. */}
      <section className={`${CARD} overflow-hidden`} aria-labelledby="training-steps-title">
        <h2 id="training-steps-title" className="border-b border-slate-200/80 px-4 py-3 font-semibold tracking-tight dark:border-white/10">Everything you can teach it</h2>
        <ol className="divide-y divide-slate-200/80 dark:divide-white/10">
          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <li key={s.key} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center" data-testid={`training-step-${s.key}`} data-status={s.status}>
                <div className="flex min-w-0 flex-1 gap-3">
                  <span className={`${ICON_TILE} mt-0.5 h-9 w-9 shrink-0 ${s.status === 'locked' ? 'opacity-50 grayscale' : ''}`}><Icon className="h-4 w-4" aria-hidden /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold tracking-tight">{s.title}</h3>
                      <StatusIcon status={s.status} />
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{s.why}</p>
                    <p className={`mt-1 text-sm ${s.status === 'done' ? TINT.readyText : s.status === 'locked' ? 'text-muted-foreground' : 'text-foreground'}`}>{s.detail}</p>
                  </div>
                </div>
                {s.action && <div className="pl-12 sm:pl-0"><ActionButton action={s.action} /></div>}
              </li>
            );
          })}
        </ol>
      </section>

      {/* Launch, until setup is complete. */}
      {showLaunch && launch && (
        <section className={`${CARD} overflow-hidden`} aria-labelledby="training-launch-title" data-testid="training-launch">
          <h2 id="training-launch-title" className="border-b border-slate-200/80 px-4 py-3 font-semibold tracking-tight dark:border-white/10">When it is ready</h2>
          <ul className="divide-y divide-slate-200/80 dark:divide-white/10">
            {fc !== undefined && onFirstCampaign && (
              <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold tracking-tight">{fc?.kind === 'pipeline' ? 'Your first pipeline' : 'Your first campaign'}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {fc?.status === 'launched' ? 'Live' : fc?.drafted ? `${fc.kind === 'pipeline' ? 'Picked' : 'Drafted'}${fc.summary ? `: ${fc.summary}` : fc.offering ? `: "${fc.offering}"` : ''}` : 'Not drafted yet. Mr LAD can draft one in a minute.'}
                  </p>
                </div>
                <ActionButton action={{ label: fc?.drafted ? 'Review' : 'Draft it', onClick: onFirstCampaign }} />
              </li>
            )}
            <li className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center" data-testid="training-go-live">
              <div className="min-w-0 flex-1">
                <h3 className="flex items-center gap-2 font-semibold tracking-tight">
                  <Rocket className={`h-4 w-4 ${launch.canGoLive ? `${TINT.ready} ${READY_PULSE}` : 'text-[#7C5CFF] dark:text-[#B69CFF]'}`} aria-hidden />Go live
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {launch.canGoLive
                    ? 'Everything is ready. Try your agent once more, then go live.'
                    : `${plural(launch.blocking.length, 'thing')} first: ${launch.blocking.map(launchRowTitle).join(', ')}`}
                </p>
              </div>
              <ActionButton action={{ label: launch.canGoLive ? 'Go live' : 'See what is left', onClick: onGoLive }} primary={launch.canGoLive} />
            </li>
          </ul>
        </section>
      )}

      {history && onHistory && (
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground" data-testid="last-change">
          <History className="h-4 w-4" aria-hidden />
          <span>{history.lastChangeAt ? `Last change: ${timeAgo(history.lastChangeAt)}` : 'No changes yet'}</span>
          <span aria-hidden>·</span>
          <button type="button" onClick={onHistory} className={LINK}>{history.undoable ? 'See or undo changes' : 'See changes'}</button>
        </p>
      )}
    </div>
  );
}
