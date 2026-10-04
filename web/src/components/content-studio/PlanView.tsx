'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { Goal, Pillar, PlanSlot, Platform, StudioSettings } from '@lad/frontend-features/content-studio';
import { PLATFORMS, useFillGaps, useGeneratePlan, usePlanPreview, useSaveStudioSettings } from '@lad/frontend-features/content-studio';
import { apiErrorCode } from '@lad/shared/apiError';
import { useToast } from '@/components/ui/app-toaster';
import { GOAL_LABEL, PLATFORM_META, formatName } from '@/lib/content-studio/meta';
import { addDays, clockLabel, joinWords, shortDate, startOfWeek, todayLocal, weekdayName } from '@/lib/content-studio/time';
import { Card, CsButton, ErrorNote, Field, Label, PlatformBadge, SectionTitle, inputCls, tone } from './ui';
import { cn } from '@/lib/utils';

const PILLAR_COLORS = ['#0B1957', '#0B6E73', '#2156D9', '#B3246F', '#7A4A00', '#5B2A9E'];
const COLOR_NAMES: Record<string, string> = { '#0B1957': 'Navy', '#0B6E73': 'Teal', '#2156D9': 'Blue', '#B3246F': 'Plum', '#7A4A00': 'Bronze', '#5B2A9E': 'Violet' };
const TIMEZONES = ['Asia/Dubai', 'Asia/Riyadh', 'Asia/Qatar', 'Asia/Kuwait', 'Asia/Bahrain', 'Asia/Muscat', 'Asia/Kolkata', 'Europe/London', 'UTC'];
const DEFAULT_WINDOWS: Record<Platform, string> = { linkedin: '10:00', instagram: '18:30', x: '12:00', facebook: '19:00', tiktok: '20:00' };

type Draft = Pick<StudioSettings, 'goals' | 'pillars' | 'frequency' | 'windows' | 'timezone' | 'approvalRequired' | 'maxPostsPerDay' | 'autoMaintain'>;

function toDraft(s: StudioSettings | undefined): Draft {
  return {
    goals: s?.goals || ['book_meetings'],
    pillars: s?.pillars?.length
      ? s.pillars
      : [
          { id: 'customer-pain', name: 'Customer pain', weight: 35, color: PILLAR_COLORS[0] },
          { id: 'how-to', name: 'How-to', weight: 35, color: PILLAR_COLORS[2] },
          { id: 'offer-proof', name: 'Offer and proof', weight: 30, color: PILLAR_COLORS[4] },
        ],
    frequency: s?.frequency || { linkedin: 3, instagram: 2, x: 0, facebook: 0, tiktok: 0 },
    windows: { ...DEFAULT_WINDOWS, ...(s?.windows || {}) },
    timezone: s?.timezone || 'Asia/Dubai',
    approvalRequired: !!s?.approvalRequired,
    maxPostsPerDay: s?.maxPostsPerDay || 3,
    autoMaintain: !!s?.autoMaintain,
  };
}

function Stepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label={label}>
      <CsButton size="sm" variant="ghost" aria-label={`Fewer ${label}`} className="px-0" disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 1))}>
        <Minus className="h-4 w-4" />
      </CsButton>
      <span className={cn('w-8 text-center text-base font-semibold tabular-nums', tone.ink)} aria-live="polite">
        {value}
      </span>
      <CsButton size="sm" variant="ghost" aria-label={`More ${label}`} className="px-0" disabled={value >= 14} onClick={() => onChange(Math.min(14, value + 1))}>
        <Plus className="h-4 w-4" />
      </CsButton>
    </div>
  );
}

export function PlanView({ settings, settingsError }: { settings: StudioSettings | undefined; settingsError: unknown }) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings));
  // Phones list the month day by day; show a week first so the page stays short.
  const [allDays, setAllDays] = useState(false);
  useEffect(() => setDraft(toDraft(settings)), [settings?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useSaveStudioSettings();
  const generate = useGeneratePlan();
  const fill = useFillGaps();
  const { push } = useToast();
  const tz = draft.timezone;
  const today = todayLocal(tz);
  const preview = usePlanPreview(today, 30, !!settings);

  const sum = draft.pillars.reduce((a, p) => a + (Number(p.weight) || 0), 0);
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(settings));
  const perWeek = PLATFORMS.reduce((a, p) => a + (draft.frequency[p] || 0), 0);
  const valid = sum === 100 && draft.pillars.length >= 1 && draft.pillars.every((p) => p.name.trim());

  const setPillar = (i: number, patch: Partial<Pillar>) =>
    setDraft((d) => ({ ...d, pillars: d.pillars.map((p, k) => (k === i ? { ...p, ...patch } : p)) }));

  const saveSettings = async () => {
    try {
      await save.mutateAsync(draft);
      push({ variant: 'success', title: 'Plan settings saved', description: 'The preview below now follows them.' });
    } catch {
      /* shown below */
    }
  };

  const build = async () => {
    try {
      const res = await generate.mutateAsync({ startDate: today, days: 30 });
      push({
        variant: 'success',
        title: `Added ${res.created.length} ${res.created.length === 1 ? 'idea' : 'ideas'} to the calendar`,
        description: res.kept ? `${res.kept} existing posts were left as they are.` : undefined,
      });
    } catch (e) {
      if (apiErrorCode(e) === 'BRIEF_REQUIRED') push({ variant: 'warning', title: 'Add your brand brief first' });
    }
  };

  const gaps = preview.data?.gaps || [];
  const fillAll = async () => {
    try {
      const res = await fill.mutateAsync({ dates: gaps.map((g) => g.date) });
      push({ variant: 'success', title: `Filled ${res.created.length} ${res.created.length === 1 ? 'day' : 'days'} with ideas` });
    } catch {
      /* shown below */
    }
  };

  // Calendar cells: weeks from the Monday on/before today, 30 days of slots.
  const byDate = useMemo(() => {
    const m = new Map<string, PlanSlot[]>();
    for (const s of preview.data?.slots || []) m.set(s.date, [...(m.get(s.date) || []), s]);
    return m;
  }, [preview.data]);
  const gapDates = new Set(gaps.map((g) => g.date));
  const pillarColor = (name: string) => draft.pillars.find((p) => p.name === name)?.color || '#4A5470';
  const gridStart = startOfWeek(today);
  const end = addDays(today, 29);
  const cells: string[] = [];
  for (let d = gridStart; d <= end || cells.length % 7 !== 0; d = addDays(d, 1)) cells.push(d);

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] xl:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        <ErrorNote error={settingsError} />
        <Card className="flex flex-col gap-3 p-4">
          <SectionTitle>Goals</SectionTitle>
          <p className={cn('text-sm', tone.soft)}>Up to 3. Booking meetings puts an Offer and proof post at the end of each week.</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Goals">
            {(Object.keys(GOAL_LABEL) as Goal[]).map((g) => {
              const on = draft.goals.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  aria-pressed={on}
                  disabled={!on && draft.goals.length >= 3}
                  onClick={() => setDraft((d) => ({ ...d, goals: on ? d.goals.filter((x) => x !== g) : [...d.goals, g] }))}
                  className={cn(
                    'min-h-11 rounded-full border px-4 text-sm font-semibold disabled:opacity-50',
                    on ? 'border-[#0B1957] bg-[#0B1957] text-white dark:border-[#2563EB] dark:bg-[#2563EB]' : cn(tone.line, tone.ink, tone.surface)
                  )}
                >
                  {GOAL_LABEL[g]}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <SectionTitle>Content pillars</SectionTitle>
            <span className={cn('text-sm font-semibold tabular-nums', sum === 100 ? tone.soft : 'text-[#A1202B] dark:text-[#FFB3B9]')}>{sum}% of 100%</span>
          </div>
          <ul className="flex flex-col gap-3">
            {draft.pillars.map((p, i) => (
              <li key={p.id} className={cn('flex flex-col gap-2 rounded-[12px] border p-3', tone.line)}>
                <div className="grid grid-cols-[minmax(0,1fr)_72px_44px] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_88px_44px]">
                  <Field label={`Pillar ${i + 1}`} htmlFor={`pil-n-${i}`}>
                    <input id={`pil-n-${i}`} className={inputCls} value={p.name} onChange={(e) => setPillar(i, { name: e.target.value })} />
                  </Field>
                  <Field label="Share %" htmlFor={`pil-w-${i}`}>
                    <input
                      id={`pil-w-${i}`}
                      type="number"
                      min={0}
                      max={100}
                      className={inputCls}
                      value={p.weight}
                      onChange={(e) => setPillar(i, { weight: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}
                    />
                  </Field>
                  <CsButton
                    size="sm"
                    variant="ghost"
                    className="px-0"
                    aria-label={`Remove pillar ${p.name || i + 1}`}
                    disabled={draft.pillars.length <= 1}
                    onClick={() => setDraft((d) => ({ ...d, pillars: d.pillars.filter((_, k) => k !== i) }))}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </CsButton>
                </div>
                <div className="flex flex-wrap items-center gap-0.5 sm:gap-1" role="group" aria-label={`Colour for ${p.name || `pillar ${i + 1}`}`}>
                  <span className={cn('mr-1 hidden text-xs sm:inline', tone.soft)} aria-hidden>
                    Colour
                  </span>
                  {PILLAR_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={COLOR_NAMES[c] || c}
                      aria-pressed={p.color === c}
                      onClick={() => setPillar(i, { color: c })}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full"
                    >
                      <span className={cn('block h-6 w-6 rounded-full', p.color === c ? 'ring-2 ring-offset-2 ring-[#0E1530] dark:ring-[#E8ECF7] dark:ring-offset-[#111A3A]' : '')} style={{ background: c }} />
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <CsButton
            size="sm"
            className="self-start"
            disabled={draft.pillars.length >= 6}
            onClick={() =>
              setDraft((d) => ({
                ...d,
                pillars: [...d.pillars, { id: `pillar-${Date.now()}`, name: '', weight: 0, color: PILLAR_COLORS[d.pillars.length % PILLAR_COLORS.length] }],
              }))
            }
          >
            <Plus className="h-4 w-4" aria-hidden />
            Pillar
          </CsButton>
        </Card>

        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <SectionTitle>Posts per week</SectionTitle>
            <span className={cn('text-sm tabular-nums', tone.soft)}>{perWeek} a week</span>
          </div>
          <ul className="flex flex-col">
            {PLATFORMS.map((p) => (
              <li key={p} className={cn('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t py-2 sm:grid-cols-[minmax(0,1fr)_auto_120px]', tone.line)}>
                <span className={cn('inline-flex items-center gap-2 text-sm font-semibold', tone.ink)}>
                  <PlatformBadge platform={p} />
                  {PLATFORM_META[p].label}
                </span>
                <Stepper
                  label={`${PLATFORM_META[p].label} posts a week`}
                  value={draft.frequency[p] || 0}
                  onChange={(n) => setDraft((d) => ({ ...d, frequency: { ...d.frequency, [p]: n } }))}
                />
                <label className="col-span-2 flex items-center gap-2 sm:col-span-1">
                  <span className={cn('text-xs sm:sr-only', tone.soft)}>Time</span>
                  <input
                    type="time"
                    aria-label={`${PLATFORM_META[p].label} posting time`}
                    className={inputCls}
                    value={draft.windows[p] || DEFAULT_WINDOWS[p]}
                    onChange={(e) => setDraft((d) => ({ ...d, windows: { ...d.windows, [p]: e.target.value } }))}
                  />
                </label>
              </li>
            ))}
          </ul>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Timezone" htmlFor="cs-tz">
              <select id="cs-tz" className={inputCls} value={draft.timezone} onChange={(e) => setDraft((d) => ({ ...d, timezone: e.target.value }))}>
                {TIMEZONES.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Most posts in one day" htmlFor="cs-max">
              <input
                id="cs-max"
                type="number"
                min={1}
                max={6}
                className={inputCls}
                value={draft.maxPostsPerDay}
                onChange={(e) => setDraft((d) => ({ ...d, maxPostsPerDay: Math.max(1, Math.min(6, Number(e.target.value) || 1)) }))}
              />
            </Field>
          </div>
          <label className={cn('flex min-h-11 items-center gap-3 text-sm', tone.ink)}>
            <input type="checkbox" className="h-5 w-5 accent-[#0B1957]" checked={draft.approvalRequired} onChange={(e) => setDraft((d) => ({ ...d, approvalRequired: e.target.checked }))} />
            Hold every scheduled post until someone approves it
          </label>
          <label className={cn('flex min-h-11 items-center gap-3 text-sm', tone.ink)}>
            <input type="checkbox" className="h-5 w-5 accent-[#0B1957]" checked={draft.autoMaintain} onChange={(e) => setDraft((d) => ({ ...d, autoMaintain: e.target.checked }))} />
            Keep the next 30 days planned and draft 3 days ahead each morning
          </label>
          {draft.autoMaintain ? <p className={cn('text-xs', tone.soft)}>Each draft uses credits from your wallet. Mr LAD stops when your spend limit is reached.</p> : null}
          <ErrorNote error={save.error} />
          <CsButton variant="primary" className="self-start" disabled={!dirty || !valid} busy={save.isPending} onClick={saveSettings}>
            Save plan settings
          </CsButton>
          {!valid ? <p className="text-xs font-semibold text-[#A1202B] dark:text-[#FFB3B9]">Pillar shares must add up to 100% and every pillar needs a name.</p> : null}
        </Card>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        {gaps.length ? (
          <Card className="flex flex-col gap-3 border-[#F2C9CD] bg-[#FFF8F8] p-4 dark:border-[#4A1218] dark:bg-[#1F0D14] sm:flex-row sm:items-center sm:justify-between">
            <p className={cn('text-sm', tone.ink)}>
              <strong>
                {gaps.length} empty {gaps.length === 1 ? 'day' : 'days'}
              </strong>{' '}
              in the next 30: {joinWords(gaps.slice(0, 4).map((g) => shortDate(g.date)))}
              {gaps.length > 4 ? ` and ${gaps.length - 4} more` : ''}.
            </p>
            <CsButton variant="primary" size="sm" busy={fill.isPending} onClick={fillAll}>
              <Sparkles className="h-4 w-4" aria-hidden />
              Fill the gaps
            </CsButton>
          </Card>
        ) : null}
        <ErrorNote error={fill.error || (generate.error && apiErrorCode(generate.error) !== 'BRIEF_REQUIRED' ? generate.error : null)} />
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <SectionTitle>Next 30 days · {preview.data?.slots.length ?? 0} posts</SectionTitle>
              <p className={cn('text-xs', tone.soft)}>
                Laid out from your goals, pillars and frequency{dirty ? '. Save to update this preview' : ''}. Edited, approved and scheduled posts are never changed.
              </p>
            </div>
            <CsButton variant="primary" busy={generate.isPending} onClick={build} disabled={dirty}>
              <Sparkles className="h-4 w-4" aria-hidden />
              Build my 30 days
            </CsButton>
          </div>
          {preview.isLoading ? (
            <p className={cn('text-sm', tone.soft)}>Laying out the month…</p>
          ) : preview.error ? (
            <ErrorNote error={preview.error} />
          ) : (
            <>
              <div className="hidden grid-cols-7 gap-1.5 sm:grid" aria-hidden>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                  <Label key={d} className="px-1">
                    {d}
                  </Label>
                ))}
              </div>
              <ol className="hidden grid-cols-7 gap-1.5 sm:grid" aria-label="30-day plan">
                {cells.map((d) => {
                  const inRange = d >= today && d <= end;
                  const slots = byDate.get(d) || [];
                  const gap = gapDates.has(d);
                  return (
                    <li
                      key={d}
                      aria-label={`${shortDate(d)}: ${slots.length ? slots.map((s) => PLATFORM_META[s.platform].label).join(', ') : 'nothing planned'}${gap ? ', nothing written yet' : ''}`}
                      className={cn(
                        'flex min-h-[72px] flex-col gap-1 rounded-[10px] border p-1.5',
                        inRange ? tone.surface : 'opacity-40',
                        gap ? 'border-[1.5px] border-dashed border-[#A1202B] dark:border-[#FFB3B9]' : tone.line
                      )}
                    >
                      <span className={cn('text-xs font-semibold tabular-nums', tone.ink)}>{Number(d.slice(8))}</span>
                      <span className="flex flex-wrap gap-1">
                        {slots.map((s, i) => (
                          <span key={i} className="inline-flex items-center gap-0.5" title={`${PLATFORM_META[s.platform].label} · ${formatName(s.platform, s.format)} · ${s.pillar} · ${clockLabel(s.time)}`}>
                            <PlatformBadge platform={s.platform} className="h-[18px] min-w-[22px] text-[10px]" />
                            <span className="h-2 w-2 rounded-full" style={{ background: pillarColor(s.pillar) }} aria-hidden />
                          </span>
                        ))}
                      </span>
                      {gap ? <span className="text-[11px] font-semibold leading-tight text-[#A1202B] dark:text-[#FFB3B9]">Not written</span> : null}
                    </li>
                  );
                })}
              </ol>
              <ol className="flex flex-col gap-2 sm:hidden" aria-label="30-day plan">
                {Array.from({ length: allDays ? 30 : 7 }, (_, i) => addDays(today, i)).map((d) => {
                  const slots = byDate.get(d) || [];
                  if (!slots.length && !gapDates.has(d)) return null;
                  return (
                    <li key={d} className={cn('flex flex-col gap-1.5 rounded-[10px] border p-3', gapDates.has(d) ? 'border-dashed border-[#A1202B] dark:border-[#FFB3B9]' : tone.line)}>
                      <span className={cn('text-sm font-semibold', tone.ink)}>
                        {weekdayName(d)} {Number(d.slice(8))}
                        {gapDates.has(d) ? <span className="ml-2 text-xs text-[#A1202B] dark:text-[#FFB3B9]">Nothing written yet</span> : null}
                      </span>
                      {slots.map((s, i) => (
                        <span key={i} className={cn('flex items-center gap-2 text-[13px]', tone.ink)}>
                          <PlatformBadge platform={s.platform} />
                          <span className="tabular-nums">{clockLabel(s.time)}</span> · {formatName(s.platform, s.format)} ·{' '}
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: pillarColor(s.pillar) }} aria-hidden /> {s.pillar}
                        </span>
                      ))}
                    </li>
                  );
                })}
              </ol>
              <CsButton size="sm" className="self-start sm:hidden" aria-expanded={allDays} onClick={() => setAllDays((v) => !v)}>
                {allDays ? 'Show the first week' : 'Show all 30 days'}
              </CsButton>
              <p className={cn('text-xs', tone.soft)}>Dashed days have nothing written yet. The posts inside show what the plan would add.</p>
              <ul className="flex flex-wrap gap-3" aria-label="Pillar key">
                {draft.pillars.map((p) => (
                  <li key={p.id} className={cn('inline-flex items-center gap-1.5 text-xs', tone.soft)}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} aria-hidden />
                    {p.name} {p.weight}%
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
