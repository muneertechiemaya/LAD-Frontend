'use client';
import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import type { ScriptBeat, Slide, VideoScript } from '@lad/frontend-features/content-studio';
import { Card, CsButton, Field, Label, SectionTitle, Segmented, inputCls, textareaCls, tone } from './ui';
import { cn } from '@/lib/utils';
import { useBrandLook } from '@/lib/content-studio/brand';

function move<T>(arr: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <CsButton size="sm" variant="ghost" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="px-0">
      {children}
    </CsButton>
  );
}

// ── carousel ───────────────────────────────────────────────────────────────
export function CarouselEditor({ slides, onChange }: { slides: Slide[]; onChange: (s: Slide[]) => void }) {
  const brand = useBrandLook();
  const set = (i: number, patch: Partial<Slide>) => onChange(slides.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle as="h3">Carousel · {slides.length} {slides.length === 1 ? 'slide' : 'slides'}</SectionTitle>
        <CsButton size="sm" onClick={() => onChange([...slides, { heading: '', text: '' }])} disabled={slides.length >= 10}>
          <Plus className="h-4 w-4" aria-hidden />
          Slide
        </CsButton>
      </div>
      <p className={cn('text-xs', tone.soft)}>Slide 1 is the cover. Each slide downloads as a 1080 × 1080 PNG; 5 to 8 slides read best.</p>
      <ol className="flex flex-col gap-3">
        {slides.map((s, i) => (
          <li key={i} className={cn('grid grid-cols-1 gap-3 rounded-[12px] border p-3 sm:grid-cols-[120px_minmax(0,1fr)]', tone.line)}>
            <div
              aria-hidden
              className={cn(
                'flex aspect-square w-full max-w-[120px] flex-col justify-between rounded-lg p-2 text-[10px] leading-tight',
                i === 0 ? 'bg-[#0B1957] text-white' : 'border border-[#E3E7F0] bg-white text-[#0E1530]'
              )}
              style={i === 0 ? { backgroundColor: brand.primary } : undefined}
            >
              <span className="font-bold">
                {i + 1} / {slides.length}
              </span>
              <span className="line-clamp-4 font-semibold">{s.heading || 'Heading'}</span>
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <Field label={`Slide ${i + 1} heading`} htmlFor={`slide-h-${i}`}>
                <textarea
                  id={`slide-h-${i}`}
                  rows={2}
                  className={cn(textareaCls, 'resize-none field-sizing-content')}
                  value={s.heading}
                  onChange={(e) => set(i, { heading: e.target.value.replace(/\n+/g, ' ') })}
                />
              </Field>
              <Field label="Supporting line" htmlFor={`slide-t-${i}`}>
                <textarea id={`slide-t-${i}`} rows={2} className={textareaCls} value={s.text} onChange={(e) => set(i, { text: e.target.value })} />
              </Field>
              <div className="flex gap-1">
                <IconBtn label={`Move slide ${i + 1} up`} onClick={() => onChange(move(slides, i, -1))} disabled={i === 0}>
                  <ArrowUp className="h-4 w-4" />
                </IconBtn>
                <IconBtn label={`Move slide ${i + 1} down`} onClick={() => onChange(move(slides, i, 1))} disabled={i === slides.length - 1}>
                  <ArrowDown className="h-4 w-4" />
                </IconBtn>
                <IconBtn label={`Delete slide ${i + 1}`} onClick={() => onChange(slides.filter((_, k) => k !== i))} disabled={slides.length <= 1}>
                  <Trash2 className="h-4 w-4" />
                </IconBtn>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

// ── video script + storyboard ─────────────────────────────────────────────
const EMPTY_SCRIPT: VideoScript = {
  durationSeconds: 30,
  hook: { spoken: '', onScreen: '', seconds: 2 },
  scenes: [{ seconds: 8, spoken: '', onScreen: '', visual: '' }],
  cta: { spoken: '', onScreen: '', seconds: 3 },
};

export function ScriptEditor({ script, onChange }: { script: VideoScript | null; onChange: (s: VideoScript) => void }) {
  const s = script || EMPTY_SCRIPT;
  const [view, setView] = useState<'script' | 'storyboard'>('script');
  const total = (s.hook.seconds || 0) + s.scenes.reduce((a, b) => a + (b.seconds || 0), 0) + (s.cta.seconds || 0);
  const commit = (next: VideoScript) => {
    const t = (next.hook.seconds || 0) + next.scenes.reduce((a, b) => a + (b.seconds || 0), 0) + (next.cta.seconds || 0);
    onChange({ ...next, durationSeconds: t });
  };
  const setScene = (i: number, patch: Partial<ScriptBeat>) => commit({ ...s, scenes: s.scenes.map((b, k) => (k === i ? { ...b, ...patch } : b)) });

  let clock = 0;
  const frames = [
    { label: 'Hook', spoken: s.hook.spoken, onScreen: s.hook.onScreen, visual: '', seconds: s.hook.seconds },
    ...s.scenes.map((b, i) => ({ label: `Scene ${i + 1}`, spoken: b.spoken, onScreen: b.onScreen, visual: b.visual || '', seconds: b.seconds })),
    { label: 'CTA', spoken: s.cta.spoken, onScreen: s.cta.onScreen, visual: '', seconds: s.cta.seconds },
  ].map((f) => {
    const from = clock;
    clock += f.seconds || 0;
    return { ...f, from, to: clock };
  });

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionTitle as="h3">Short video · {total}s</SectionTitle>
        <Segmented
          label="Script view"
          value={view}
          onChange={setView}
          options={[
            { value: 'script', label: 'Script' },
            { value: 'storyboard', label: 'Storyboard' },
          ]}
        />
      </div>
      {total > 45 ? <p className="text-xs font-semibold text-[#A1202B] dark:text-[#FFB3B9]">Over 45 seconds. Short videos hold attention best under 45.</p> : null}
      {view === 'storyboard' ? (
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {frames.map((f, i) => (
            <li key={i} className={cn('flex flex-col gap-2 rounded-[12px] border p-3', tone.line)}>
              <div className="flex aspect-[9/16] max-h-56 w-full flex-col justify-end rounded-lg bg-[#14171A] p-3 text-white">
                <span className="text-sm font-bold leading-snug">{f.onScreen || ' '}</span>
              </div>
              <div className="flex items-center justify-between">
                <Label>{f.label}</Label>
                <span className={cn('text-xs tabular-nums', tone.soft)}>
                  {f.from}s to {f.to}s
                </span>
              </div>
              <p className={cn('text-[13px]', tone.ink)}>“{f.spoken}”</p>
              {f.visual ? <p className={cn('text-xs', tone.soft)}>Show: {f.visual}</p> : null}
            </li>
          ))}
        </ol>
      ) : (
        <div className="flex flex-col gap-4">
          <fieldset className={cn('flex flex-col gap-2 rounded-[12px] border p-3', tone.line)}>
            <legend className={cn('px-1 text-sm font-semibold', tone.ink)}>Hook · first 2 seconds</legend>
            <Field label="Say" htmlFor="hook-spoken">
              <textarea id="hook-spoken" rows={2} className={cn(textareaCls, 'resize-none field-sizing-content')} value={s.hook.spoken} onChange={(e) => commit({ ...s, hook: { ...s.hook, spoken: e.target.value } })} />
            </Field>
            <Field label="On screen" htmlFor="hook-screen">
              <textarea id="hook-screen" rows={2} className={cn(textareaCls, 'resize-none field-sizing-content')} value={s.hook.onScreen} onChange={(e) => commit({ ...s, hook: { ...s.hook, onScreen: e.target.value } })} />
            </Field>
          </fieldset>
          {s.scenes.map((b, i) => (
            <fieldset key={i} className={cn('flex flex-col gap-2 rounded-[12px] border p-3', tone.line)}>
              <legend className={cn('px-1 text-sm font-semibold', tone.ink)}>Scene {i + 1}</legend>
              <Field label="Say" htmlFor={`scene-s-${i}`}>
                <textarea id={`scene-s-${i}`} rows={2} className={textareaCls} value={b.spoken} onChange={(e) => setScene(i, { spoken: e.target.value })} />
              </Field>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Field label="On screen" htmlFor={`scene-o-${i}`}>
                  <textarea id={`scene-o-${i}`} rows={2} className={cn(textareaCls, 'resize-none field-sizing-content')} value={b.onScreen} onChange={(e) => setScene(i, { onScreen: e.target.value })} />
                </Field>
                <Field label="Show" htmlFor={`scene-v-${i}`}>
                  <textarea id={`scene-v-${i}`} rows={2} className={cn(textareaCls, 'resize-none field-sizing-content')} value={b.visual || ''} onChange={(e) => setScene(i, { visual: e.target.value })} />
                </Field>
              </div>
              <div className="flex items-center gap-1">
                <label htmlFor={`scene-n-${i}`} className={cn('mr-1 text-sm font-semibold', tone.ink)}>
                  Seconds
                </label>
                <input
                  id={`scene-n-${i}`}
                  type="number"
                  min={1}
                  max={30}
                  className={cn(inputCls, 'w-[72px]')}
                  value={b.seconds}
                  onChange={(e) => setScene(i, { seconds: Math.max(1, Math.min(30, Number(e.target.value) || 1)) })}
                />
                <span className="flex-1" />
                <IconBtn label={`Move scene ${i + 1} up`} onClick={() => commit({ ...s, scenes: move(s.scenes, i, -1) })} disabled={i === 0}>
                  <ArrowUp className="h-4 w-4" />
                </IconBtn>
                <IconBtn label={`Move scene ${i + 1} down`} onClick={() => commit({ ...s, scenes: move(s.scenes, i, 1) })} disabled={i === s.scenes.length - 1}>
                  <ArrowDown className="h-4 w-4" />
                </IconBtn>
                <IconBtn label={`Delete scene ${i + 1}`} onClick={() => commit({ ...s, scenes: s.scenes.filter((_, k) => k !== i) })} disabled={s.scenes.length <= 1}>
                  <Trash2 className="h-4 w-4" />
                </IconBtn>
              </div>
            </fieldset>
          ))}
          <CsButton size="sm" className="self-start" onClick={() => commit({ ...s, scenes: [...s.scenes, { seconds: 6, spoken: '', onScreen: '', visual: '' }] })}>
            <Plus className="h-4 w-4" aria-hidden />
            Scene
          </CsButton>
          <fieldset className={cn('flex flex-col gap-2 rounded-[12px] border p-3', tone.line)}>
            <legend className={cn('px-1 text-sm font-semibold', tone.ink)}>Call to action · last 3 seconds</legend>
            <Field label="Say" htmlFor="cta-spoken">
              <textarea id="cta-spoken" rows={2} className={cn(textareaCls, 'resize-none field-sizing-content')} value={s.cta.spoken} onChange={(e) => commit({ ...s, cta: { ...s.cta, spoken: e.target.value } })} />
            </Field>
            <Field label="On screen" htmlFor="cta-screen">
              <textarea id="cta-screen" rows={2} className={cn(textareaCls, 'resize-none field-sizing-content')} value={s.cta.onScreen} onChange={(e) => commit({ ...s, cta: { ...s.cta, onScreen: e.target.value } })} />
            </Field>
          </fieldset>
        </div>
      )}
    </Card>
  );
}

// ── X thread ───────────────────────────────────────────────────────────────
export function ThreadEditor({ hook, parts, onChange }: { hook: string; parts: string[]; onChange: (p: string[]) => void }) {
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <SectionTitle as="h3">Thread · {parts.length + 1} posts</SectionTitle>
        <CsButton size="sm" onClick={() => onChange([...parts, ''])} disabled={parts.length >= 9}>
          <Plus className="h-4 w-4" aria-hidden />
          Post
        </CsButton>
      </div>
      <p className={cn('text-xs', tone.soft)}>1/ is your hook. One idea per post, each under 280 characters.</p>
      <p className={cn('rounded-[10px] border p-3 text-sm', tone.line, tone.ink)}>1/ {hook || 'Write the hook above'}</p>
      {parts.map((t, i) => (
        <div key={i} className="flex flex-col gap-1">
          <label htmlFor={`thread-${i}`} className={cn('text-sm font-semibold', tone.ink)}>
            {i + 2}/
          </label>
          <textarea id={`thread-${i}`} rows={3} className={textareaCls} value={t} onChange={(e) => onChange(parts.map((p, k) => (k === i ? e.target.value : p)))} />
          <div className="flex items-center justify-between">
            <span className={cn('text-xs tabular-nums', t.length > 280 ? 'font-semibold text-[#A1202B] dark:text-[#FFB3B9]' : tone.soft)}>{t.length} / 280</span>
            <IconBtn label={`Delete post ${i + 2}`} onClick={() => onChange(parts.filter((_, k) => k !== i))}>
              <Trash2 className="h-4 w-4" />
            </IconBtn>
          </div>
        </div>
      ))}
    </Card>
  );
}
