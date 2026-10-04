'use client';

/**
 * The per-member coordination rows and the send panel.
 *
 * Each member gets TWO rows — one per coordination day — each with a dropdown
 * defaulting to the pair the recommender chose for that day. The admin can
 * override with any member not already spoken for on that day; taken members
 * are shown but disabled, with who took them, so the constraint explains
 * itself rather than being discovered as a 409.
 *
 * A pick is persisted the moment it changes (it used to live in the page and
 * vanish on reload). Sending a day seeds the remaining generated pairs into
 * selections in one call, shows what that did, and only then sends.
 *
 * Each row also has its own Coordinate button: the same seed-then-send,
 * scoped to that one member's pair. For trying the flow with one person
 * before the chapter sees it, or a member who joined after the day went out.
 */
import React, { useMemo, useState } from 'react';
import { Send, AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import type {
  CoordinationSelection, DaySlot, SeedSummary, SendSummary,
} from '@lad/frontend-features/community-roi';

function initials(name: string): string {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

// 600/700 shades: white initials need >= 4.5:1 (amber-500 / emerald-500 / teal-500 were 2.2-2.5:1)
const AVATAR_COLORS = ['#4F46E5','#7C3AED','#DB2777','#B45309','#047857','#2563EB','#DC2626','#0F766E'];
function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

const Avatar: React.FC<{ name: string; size?: 'sm' | 'md' }> = ({ name, size = 'md' }) => (
  <div
    className={`rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white ${size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-xs'}`}
    style={{ backgroundColor: avatarColor(name) }}
    title={name}
  >
    {initials(name)}
  </div>
);

const IndustryTag: React.FC<{ industry?: string }> = ({ industry }) => {
  if (!industry) return null;
  return (
    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium truncate max-w-[120px] dark:bg-white/10 dark:text-slate-400">
      {industry}
    </span>
  );
};

export const DAY_LABEL: Record<DaySlot, string> = { 1: 'Wednesday', 2: 'Friday' };
export const DAY_SLOTS: DaySlot[] = [1, 2];

export interface Pair {
  recommendation_id?: string | null;
  member_a_id?: string | null;
  member_b_id?: string | null;
  day_slot?: number | null;
  member_a: string;
  member_b: string;
  industry_a?: string;
  industry_b?: string;
  score: number;
  reason: string;
  combination_type: number;
}

export interface MemberLite { id: string; name: string; industry?: string | null }

/** The selection on `day` that involves `memberId`, if any. */
export function selectionFor(
  selections: CoordinationSelection[], memberId: string, day: DaySlot,
): CoordinationSelection | undefined {
  return selections.find(
    (s) => s.day_slot === day && (s.member_a_id === memberId || s.member_b_id === memberId),
  );
}

/**
 * A pick the admin can still change or send: not yet coordinated, or
 * coordinated and never delivered. 'failed' arrives from Meta's status
 * webhook (a landline, a number Meta holds out of marketing templates); the
 * negotiation behind it was cancelled, so the pick is open again and the row
 * shows why it failed.
 */
export function isOpen(sel?: CoordinationSelection): boolean {
  return !sel || sel.status === 'pending' || sel.status === 'failed';
}

export function partnerOf(sel: CoordinationSelection, memberId: string): { id: string; name: string } {
  return sel.member_a_id === memberId
    ? { id: sel.member_b_id, name: sel.member_b_name }
    : { id: sel.member_a_id, name: sel.member_a_name };
}

const StatusChip: React.FC<{ sel?: CoordinationSelection }> = ({ sel }) => {
  if (!sel) return null;
  const map: Record<CoordinationSelection['status'], { icon: typeof Clock; cls: string; text: string }> = {
    pending: { icon: Clock, cls: 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-white/10', text: 'selected' },
    sent:    { icon: CheckCircle2, cls: 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10', text: 'sent' },
    skipped: { icon: AlertTriangle, cls: 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10', text: `skipped${sel.skip_reason ? ` · ${sel.skip_reason}` : ''}` },
    failed:  { icon: XCircle, cls: 'text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-500/10', text: `failed${sel.skip_reason ? ` · ${sel.skip_reason}` : ''}` },
  };
  const m = map[sel.status] ?? map.pending;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded ${m.cls}`} title={m.text}>
      <Icon className="w-3 h-3" /> {m.text}
    </span>
  );
};

interface DayRowProps {
  member: MemberLite;
  day: DaySlot;
  generated?: Pair;                       // the recommender's pair for this member on this day
  selection?: CoordinationSelection;      // the persisted pick, if any
  takenBy: Map<string, string>;           // memberId -> name of who they are paired with, this day
  allMembers: MemberLite[];
  saving: boolean;
  coordinating: boolean;                  // this row's own send is in flight
  onPick: (partnerId: string | null) => void;
  onCoordinate: () => void;               // send just this pair, now
}

const DayRow: React.FC<DayRowProps> = ({
  member, day, generated, selection, takenBy, allMembers, saving, coordinating, onPick, onCoordinate,
}) => {
  const generatedPartnerId = generated
    ? (generated.member_a_id === member.id ? generated.member_b_id : generated.member_a_id) ?? null
    : null;
  const current = selection ? partnerOf(selection, member.id).id : (generatedPartnerId ?? '');
  const locked = !isOpen(selection);

  // Everyone but self, sorted; the generated partner first so the default is
  // visible at the top even when the list is long.
  const options = useMemo(() => {
    const rest = allMembers.filter((m) => m.id !== member.id && m.id !== generatedPartnerId)
      .sort((a, b) => a.name.localeCompare(b.name));
    const gen = allMembers.find((m) => m.id === generatedPartnerId);
    return gen ? [gen, ...rest] : rest;
  }, [allMembers, member.id, generatedPartnerId]);

  return (
    // Wraps on phones: label, picker and button on one line, the status under them.
    // In one fixed row (80 + picker + 144px status) the picker was pushed off a 390px screen.
    <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
      <span className="text-xs font-bold text-slate-500 w-20 flex-shrink-0 dark:text-slate-400">{DAY_LABEL[day]}</span>
      <select
        value={current}
        disabled={saving || locked}
        onChange={(e) => onPick(e.target.value || null)}
        title={locked ? 'Already coordinated — the members have the message' : undefined}
        className="max-lg:min-h-11 min-w-0 flex-1 basis-40 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 hover:border-indigo-300 focus:outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-500 cursor-pointer disabled:cursor-not-allowed dark:bg-[#071131] dark:border-slate-700 dark:text-slate-100"
      >
        <option value="">— no meeting this day —</option>
        {options.map((m) => {
          const takenWith = takenBy.get(m.id);
          const isCurrent = m.id === current;
          const isGenerated = m.id === generatedPartnerId;
          // A member paired with THIS member is not "taken" from our point of view.
          const disabled = !!takenWith && !isCurrent && takenWith !== member.name;
          return (
            <option key={m.id} value={m.id} disabled={disabled}>
              {m.name}
              {isGenerated && generated ? ` (${generated.score})${generated.combination_type === 2 ? ' ⭐' : ''}` : ''}
              {disabled ? ` — taken (with ${takenWith})` : ''}
            </option>
          );
        })}
      </select>
      {current && !locked ? (
        <button
          type="button"
          onClick={onCoordinate}
          disabled={saving || coordinating}
          title={`Send ${member.name} the ${DAY_LABEL[day]} slot offer now — only this pair is messaged`}
          className="max-lg:min-h-11 flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-indigo-500/10 dark:text-indigo-300"
        >
          <Send className="w-3 h-3" /> {coordinating ? 'Sending…' : selection?.status === 'failed' ? 'Retry' : 'Coordinate'}
        </button>
      ) : null}
      <div className="w-full sm:w-36 flex-shrink-0 sm:text-right empty:hidden"><StatusChip sel={selection} /></div>
    </div>
  );
};

export interface MemberCoordinationCardProps {
  index: number;
  member: MemberLite;
  generatedByDay: Partial<Record<DaySlot, Pair>>;
  selections: CoordinationSelection[];
  takenByDay: Record<DaySlot, Map<string, string>>;
  allMembers: MemberLite[];
  saving: boolean;
  coordinatingDay?: DaySlot | null;       // which of this member's rows is sending
  onPick: (day: DaySlot, partnerId: string | null) => void;
  onCoordinate: (day: DaySlot) => void;
}

export const MemberCoordinationCard: React.FC<MemberCoordinationCardProps> = ({
  index, member, generatedByDay, selections, takenByDay, allMembers, saving, coordinatingDay, onPick, onCoordinate,
}) => (
  // Phones stack the member above their day rows; from sm the wrapper is `contents`, so the row layout is unchanged.
  <div className="flex flex-col gap-3 p-4 bg-white border border-slate-100 rounded-xl hover:border-indigo-200 hover:shadow-sm transition-all dark:bg-[#071131] dark:border-slate-800 sm:flex-row sm:items-start sm:gap-4">
    <div className="flex items-center gap-2 sm:contents">
      <span className="text-xs font-bold text-slate-500 w-5 flex-shrink-0 text-center sm:pt-2 dark:text-slate-400">{index + 1}</span>
      <div className="flex items-center gap-2 min-w-0 sm:flex-shrink-0 sm:min-w-[180px] sm:pt-0.5">
        <Avatar name={member.name} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate dark:text-slate-100">{member.name}</p>
          <IndustryTag industry={member.industry ?? undefined} />
        </div>
      </div>
    </div>
    <div className="min-w-0 flex-1 flex flex-col gap-2">
      {DAY_SLOTS.map((day) => (
        <DayRow
          key={day}
          member={member}
          day={day}
          generated={generatedByDay[day]}
          selection={selectionFor(selections, member.id, day)}
          takenBy={takenByDay[day]}
          allMembers={allMembers}
          saving={saving}
          coordinating={coordinatingDay === day}
          onPick={(partnerId) => onPick(day, partnerId)}
          onCoordinate={() => onCoordinate(day)}
        />
      ))}
    </div>
  </div>
);

// ── Send panel ────────────────────────────────────────────────────────────────

export interface SendCoordinationPanelProps {
  weekNumber: number;
  generatedCount: Record<DaySlot, number>;
  selections: CoordinationSelection[];
  isSeeding: boolean;
  isSending: boolean;
  onSeed: (day: DaySlot) => Promise<SeedSummary>;
  onSend: (day: DaySlot) => Promise<SendSummary>;
  onClose: () => void;
}

/**
 * Seed, show what that did, THEN send. Two steps on purpose: an admin sees
 * "42 pairs, 2 skipped because you already overrode them" and can stop
 * before a single message leaves.
 */
export const SendCoordinationPanel: React.FC<SendCoordinationPanelProps> = ({
  weekNumber, generatedCount, selections, isSeeding, isSending, onSeed, onSend, onClose,
}) => {
  const [day, setDay] = useState<DaySlot>(1);
  const [seedResult, setSeedResult] = useState<SeedSummary | null>(null);
  const [sendResult, setSendResult] = useState<SendSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const forDay = selections.filter((s) => s.day_slot === day);
  const pending = forDay.filter((s) => s.status === 'pending').length;
  const failed = forDay.filter((s) => s.status === 'failed').length;
  const sent = forDay.filter((s) => s.status === 'sent').length;

  const pickDay = (d: DaySlot) => { setDay(d); setSeedResult(null); setSendResult(null); setError(null); };

  const doSeed = async () => {
    setError(null);
    try { setSeedResult(await onSeed(day)); } catch (e) { setError((e as Error).message); }
  };
  const doSend = async () => {
    setError(null);
    try { setSendResult(await onSend(day)); } catch (e) { setError((e as Error).message); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 dark:bg-[#071131]" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Coordinate 1-2-1s — week {weekNumber}</h3>
        <p className="text-xs text-slate-500 mt-1 dark:text-slate-400">
          Sends each member a slot offer for their pick that day and opens the negotiation. Members reply with a time; partners confirm.
        </p>

        <div className="flex gap-2 mt-4">
          {DAY_SLOTS.map((d) => (
            <button key={d} onClick={() => pickDay(d)}
              className={`max-lg:min-h-11 px-3 py-1.5 rounded-lg text-sm font-semibold ${day === d ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>
              {DAY_LABEL[d]} <span className="opacity-70 text-xs">· {generatedCount[d] ?? 0} pairs</span>
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="bg-slate-50 rounded-lg p-2 dark:bg-white/5"><p className="text-lg font-bold text-slate-800 dark:text-slate-100">{generatedCount[day] ?? 0}</p><p className="text-xs text-slate-500 dark:text-slate-400">generated pairs</p></div>
          <div className="bg-slate-50 rounded-lg p-2 dark:bg-white/5"><p className="text-lg font-bold text-slate-800 dark:text-slate-100">{pending + failed}</p><p className="text-xs text-slate-500 dark:text-slate-400">{failed > 0 ? `to send (${failed} not delivered, will retry)` : 'selected, not sent'}</p></div>
          <div className="bg-emerald-50 rounded-lg p-2 dark:bg-emerald-500/10"><p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{sent}</p><p className="text-xs text-emerald-600 dark:text-emerald-300">already sent</p></div>
        </div>

        {/* Step 1 — seed */}
        {!seedResult && !sendResult && (
          <button onClick={doSeed} disabled={isSeeding}
            className="max-lg:min-h-11 mt-4 w-full px-4 py-2 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60">
            {isSeeding ? 'Preparing…' : `Prepare ${DAY_LABEL[day]} — turn generated pairs into selections`}
          </button>
        )}

        {/* Step 2 — review, then send */}
        {seedResult && !sendResult && (
          <div className="mt-4 space-y-3">
            <div className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 dark:text-slate-200 dark:bg-white/5">
              <p><strong>{seedResult.created}</strong> new selection{seedResult.created === 1 ? '' : 's'} created,
                {' '}<strong>{seedResult.alreadySelected}</strong> already there.</p>
              {seedResult.skippedConflict > 0 && (
                <p className="text-amber-700 mt-1 dark:text-amber-300">
                  <AlertTriangle className="inline w-3.5 h-3.5 mr-1" />
                  {seedResult.skippedConflict} generated pair{seedResult.skippedConflict === 1 ? '' : 's'} skipped — a member in them is already spoken for on {DAY_LABEL[day]} (your override stands).
                </p>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This will message <strong>{pending + failed + seedResult.created}</strong> member{pending + failed + seedResult.created === 1 ? '' : 's'} on WhatsApp. Already-sent pairs are not re-sent; pairs whose message never arrived are.
            </p>
            <button onClick={doSend} disabled={isSending}
              className="max-lg:min-h-11 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-60">
              <Send className="w-4 h-4" /> {isSending ? 'Sending…' : `Send ${DAY_LABEL[day]} slot offers`}
            </button>
          </div>
        )}

        {/* Done */}
        {sendResult && (
          <div className="mt-4 text-sm text-slate-700 bg-emerald-50 rounded-lg p-3 space-y-1 dark:text-slate-200 dark:bg-emerald-500/10">
            <p><CheckCircle2 className="inline w-4 h-4 text-emerald-600 mr-1 dark:text-emerald-300" /><strong>{sendResult.notified}</strong> slot offer{sendResult.notified === 1 ? '' : 's'} delivered, <strong>{sendResult.proposed}</strong> negotiation{sendResult.proposed === 1 ? '' : 's'} opened.</p>
            {sendResult.skipped > 0 && <p className="text-amber-700 dark:text-amber-300">{sendResult.skipped} skipped (a live negotiation already exists, or no bookable slots).</p>}
            {sendResult.failed > 0 && <p className="text-red-700 dark:text-red-300">{sendResult.failed} failed — see each row&apos;s status.</p>}
            {sendResult.cappedOut > 0 && <p className="text-amber-700 dark:text-amber-300">{sendResult.cappedOut} left pending by the send cap — send again to continue.</p>}
            {sendResult.proposed > sendResult.notified && (
              <p className="text-amber-700 dark:text-amber-300">{sendResult.proposed - sendResult.notified} opened but not yet delivered — the coordinator retries those automatically.</p>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-700 dark:text-red-300">{error}</p>}

        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="max-lg:min-h-11 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:text-slate-300 dark:bg-white/10">
            {sendResult ? 'Done' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
};
