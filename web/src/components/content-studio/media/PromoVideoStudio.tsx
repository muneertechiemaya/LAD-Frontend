'use client';
/**
 * Promo video studio: a brief and a few screenshots in, a branded promo video out.
 *
 * Template mode (LAD-MAGe /api/v1/media/promo-videos). The tenant picks which
 * model writes the storyboard; fixed templates animate it with the brand from
 * their Business DNA profile; the render lands in the Media Hub gallery. A video
 * takes a few minutes, so this shows the job's stages as it goes, and remembers
 * the job across a closed modal (per browser, best effort).
 *
 * Talks to the service only through the SDK feature `promo-video`.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Film,
  ImagePlus,
  Loader2,
  RotateCcw,
  X,
} from 'lucide-react';
import {
  PROMO_STAGES,
  usePromoOptions,
  usePromoVideo,
  useStartPromoVideo,
  type PromoFormat,
  type PromoSeconds,
  type PromoScene,
  type PromoStage,
  type PromoStyle,
} from '@lad/frontend-features/promo-video';

const STYLE_HINT: Partial<Record<PromoStyle, string>> = {
  classic: 'Clean, calm motion that lets your screens speak.',
  showreel: 'Showreel-grade: 3D, kinetic type, counters and cinematic transitions, directed scene by scene.',
};

const STAGE_LABEL: Record<PromoStage, string> = {
  writing: 'Writing the storyboard',
  narrating: 'Recording the narration',
  composing: 'Animating the scenes',
  rendering: 'Rendering the video',
  collecting: 'Saving it to your gallery',
};

/** Storyboard scene kinds in words - they were shown raw ("hook", "stat", "cta"). */
const SCENE_LABEL: Record<PromoScene['kind'], string> = {
  hook: 'Opening',
  feature: 'Feature',
  stat: 'Proof point',
  quote: 'Quote',
  cta: 'Call to action',
};

/**
 * A video takes a few minutes. Past this, a job still "processing" has stopped
 * (MAGe treats it as orphaned and will start a new one), but its status never
 * changes - so without this the panel spun on "a few minutes" for days and
 * offered no way to make another video.
 */
const STUCK_AFTER_MS = 30 * 60 * 1000;

const JOB_KEY = 'lad.promoVideo.jobId';
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ['image/png', 'image/jpeg', 'image/webp'];

interface Shot {
  id: string;
  file: File;
  preview: string;
  caption: string;
}

function readJob(): string | null {
  try {
    return window.localStorage.getItem(JOB_KEY);
  } catch {
    return null;
  }
}

function writeJob(jobId: string | null): void {
  try {
    if (jobId) window.localStorage.setItem(JOB_KEY, jobId);
    else window.localStorage.removeItem(JOB_KEY);
  } catch {
    /* storage blocked: the job simply is not remembered */
  }
}

const field =
  'w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0b1638] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40';
const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1';

export interface PromoBriefStart {
  product?: string;
  goal?: string;
  audience?: string;
  tone?: string;
  ctaLabel?: string;
  format?: PromoFormat;
  seconds?: PromoSeconds;
}

/**
 * `initial` prefills the brief (Content Studio passes a video script's hook and
 * call to action). `onUse` adds an "Attach to this post" action to a finished
 * video; without it the studio behaves exactly as on the Media tab.
 */
export const PromoVideoStudio: React.FC<{ initial?: PromoBriefStart; onUse?: (videoUrl: string) => Promise<void> | void; useLabel?: string }> = ({
  initial,
  onUse,
  useLabel = 'Attach to this post',
}) => {
  const options = usePromoOptions();
  const start = useStartPromoVideo();
  const [jobId, setJobId] = useState<string | null>(null);
  const job = usePromoVideo(jobId);
  const [using, setUsing] = useState(false);

  const [product, setProduct] = useState(initial?.product || '');
  const [goal, setGoal] = useState(initial?.goal || '');
  const [audience, setAudience] = useState(initial?.audience || '');
  const [tone, setTone] = useState(initial?.tone || '');
  const [format, setFormat] = useState<PromoFormat>(initial?.format || '16:9');
  const [seconds, setSeconds] = useState<PromoSeconds>(initial?.seconds || 45);
  const [ctaLabel, setCtaLabel] = useState(initial?.ctaLabel || 'Book a demo');
  const [ctaUrl, setCtaUrl] = useState('');
  const [writer, setWriter] = useState('');
  const [style, setStyle] = useState<PromoStyle>('classic');
  const [narration, setNarration] = useState(true);
  const [shots, setShots] = useState<Shot[]>([]);
  const [fileError, setFileError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Resume a video started before the modal was closed.
  useEffect(() => {
    setJobId(readJob());
  }, []);

  // Release the thumbnails' object URLs when they go.
  const shotsRef = useRef(shots);
  shotsRef.current = shots;
  useEffect(() => () => shotsRef.current.forEach((s) => URL.revokeObjectURL(s.preview)), []);

  const opts = options.data;
  useEffect(() => {
    if (!opts || writer) return;
    const preferred = opts.writers.find((w) => w.id === opts.default_writer && w.available)
      ?? opts.writers.find((w) => w.available);
    if (preferred) setWriter(preferred.id);
    if (!opts.voice.available) setNarration(false);
    if (opts.default_style) setStyle(opts.default_style);
  }, [opts, writer]);

  const maxShots = opts?.max_screenshots ?? 6;
  // What still stands between the tenant and "Create video", in the order the
  // form asks for it. The button is enabled exactly when this is empty, so the
  // hint beside it can never disagree with it.
  // Server-side blockers are not something the tenant can add; the banners above
  // explain them, and the hint just says the server is not ready.
  const serverReady = !!opts?.rendering_available && !!writer;
  const missing: string[] = [];
  if (!product.trim()) missing.push('a description of what you are promoting');
  if (shots.length === 0) missing.push('at least one screenshot');
  const canSubmit = serverReady && missing.length === 0 && !start.isPending;

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    setFileError('');
    const next: Shot[] = [];
    for (const file of Array.from(files)) {
      if (!ACCEPT.includes(file.type)) {
        setFileError(`${file.name} is not a PNG, JPEG or WebP image.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setFileError(`${file.name} is over 10 MB.`);
        continue;
      }
      next.push({ id: `${file.name}-${file.size}-${file.lastModified}`, file, preview: URL.createObjectURL(file), caption: '' });
    }
    setShots((current) => {
      const merged = [...current, ...next.filter((n) => !current.some((c) => c.id === n.id))];
      if (merged.length > maxShots) {
        setFileError(`Up to ${maxShots} screenshots.`);
        merged.slice(maxShots).forEach((s) => URL.revokeObjectURL(s.preview));
      }
      return merged.slice(0, maxShots);
    });
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeShot = (id: string) => {
    setShots((current) => {
      const gone = current.find((s) => s.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return current.filter((s) => s.id !== id);
    });
  };

  const submit = () => {
    if (!canSubmit) return;
    start.mutate(
      {
        product: product.trim(), goal: goal.trim(), audience: audience.trim(), tone: tone.trim(), format, seconds,
        ctaLabel: ctaLabel.trim() || undefined, ctaUrl: ctaUrl.trim() || undefined, writer, narration,
        style: opts?.styles?.length ? style : undefined,
        screenshots: shots.map((s) => ({ file: s.file, caption: s.caption.trim() })),
      },
      {
        onSuccess: (res) => {
          setJobId(res.job_id);
          writeJob(res.job_id);
        },
      },
    );
  };

  const reset = () => {
    setJobId(null);
    writeJob(null);
    start.reset();
  };

  // ---- options not loaded -------------------------------------------------
  if (opts === undefined) {
    if (options.isError) {
      return (
        <Banner tone="error">
          Could not load the promo video options: {(options.error as Error)?.message}.{' '}
          <button className="underline" onClick={() => options.refetch()}>Try again</button>
        </Banner>
      );
    }
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 py-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    );
  }

  // ---- a job ----------------------------------------------------------------
  if (jobId) {
    const data = job.data;
    if (data === undefined) {
      return job.isError ? (
        <div className="space-y-3">
          <Banner tone="error">Could not read this video&apos;s status: {(job.error as Error)?.message}</Banner>
          <button onClick={reset} className={secondaryBtn}>Start a new video</button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Checking on your video…
        </div>
      );
    }
    if (data.status === 'completed' && data.video_url) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4" /> Your video is ready. It is also in your Gallery.
          </div>
          <video
            src={data.video_url}
            controls
            playsInline
            className="w-full max-h-[70vh] object-contain rounded-lg bg-black"
          />
          <div className="flex flex-wrap gap-2">
            {onUse ? (
              <button
                type="button"
                className={primaryBtn}
                disabled={using}
                onClick={async () => {
                  setUsing(true);
                  try {
                    await onUse(data.video_url as string);
                  } finally {
                    setUsing(false);
                  }
                }}
              >
                {using ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} {useLabel}
              </button>
            ) : null}
            <a href={data.video_url} download className={primaryBtn}>
              <Download className="w-4 h-4" /> Download
            </a>
            <button onClick={reset} className={secondaryBtn}>
              <RotateCcw className="w-4 h-4" /> Make another
            </button>
          </div>
        </div>
      );
    }
    if (data.status === 'failed' || data.status === 'cancelled') {
      return (
        <div className="space-y-3">
          <Banner tone="error">{data.error || 'The video could not be made.'}</Banner>
          <button onClick={reset} className={secondaryBtn}>
            <RotateCcw className="w-4 h-4" /> Edit the brief and try again
          </button>
        </div>
      );
    }
    const current = PROMO_STAGES.indexOf(data.stage);
    // created_at is epoch seconds (time.time() in MAGe).
    const startedMs = data.created_at ? data.created_at * 1000 : null;
    const stuck = startedMs !== null && Date.now() - startedMs > STUCK_AFTER_MS;
    if (stuck) {
      return (
        <div className="space-y-3">
          <Banner tone="warn">
            This video stopped while {STAGE_LABEL[data.stage]?.toLowerCase() ?? 'being made'} (started{' '}
            {new Date(startedMs).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            ). It should have taken a few minutes. Start a new one; if it happens again, contact support.
          </Banner>
          <button onClick={reset} className={secondaryBtn}>
            <RotateCcw className="w-4 h-4" /> Start a new video
          </button>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <ol className="space-y-2" aria-label="Progress">
          {PROMO_STAGES.map((stage, i) => (
            <li key={stage} className="flex items-center gap-2 text-sm">
              {i < current ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : i === current ? (
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              ) : (
                <span className="w-4 h-4 rounded-full border border-gray-300 dark:border-gray-600" />
              )}
              <span className={i === current ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-500'}>
                {STAGE_LABEL[stage]}
              </span>
            </li>
          ))}
        </ol>
        {data.scenes && data.scenes.length > 0 && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
            {data.scenes.map((scene, i) => (
              <div key={i} className="px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{SCENE_LABEL[scene.kind] ?? scene.kind}</div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{scene.headline.replace(/\*/g, '')}</div>
                <div className="text-xs text-gray-500">{scene.narration}</div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-500">
          This takes a few minutes. You can close this window; the video will appear in your Gallery.
        </p>
        {job.isError && (
          <Banner tone="warn">Lost touch with the server for a moment; still checking.</Banner>
        )}
      </div>
    );
  }

  // ---- the brief -------------------------------------------------------------
  const unavailableWriter = opts.writers.every((w) => !w.available);
  return (
    <div className="space-y-4">
      {!opts.rendering_available && (
        <Banner tone="warn">Promo videos are not set up on this server yet.</Banner>
      )}
      {unavailableWriter && opts.rendering_available && (
        <Banner tone="warn">No storyboard writer is set up on this server yet.</Banner>
      )}

      <div>
        <label className={labelCls} htmlFor="promo-product">What are you promoting?</label>
        <textarea
          id="promo-product"
          className={field}
          rows={3}
          maxLength={2000}
          value={product}
          onChange={(e) => setProduct(e.target.value)}
          placeholder="e.g. A booking assistant for pilates studios that answers enquiries on WhatsApp and fills classes"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls} htmlFor="promo-goal">Goal</label>
          <input id="promo-goal" className={field} maxLength={500} value={goal} onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Book demos with studio owners" />
        </div>
        <div>
          <label className={labelCls} htmlFor="promo-audience">Audience</label>
          <input id="promo-audience" className={field} maxLength={1000} value={audience}
            onChange={(e) => setAudience(e.target.value)} placeholder="e.g. Owners of small fitness studios" />
        </div>
        <div>
          <label className={labelCls} htmlFor="promo-cta">Button text</label>
          <input id="promo-cta" className={field} maxLength={24} value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
        </div>
        <div>
          <label className={labelCls} htmlFor="promo-url">Website shown at the end</label>
          <input id="promo-url" className={field} maxLength={60} value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)}
            placeholder="e.g. yourstudio.com" />
        </div>
      </div>

      <div>
        <label className={labelCls} htmlFor="promo-tone">Tone (optional)</label>
        <input id="promo-tone" className={field} maxLength={200} value={tone} onChange={(e) => setTone(e.target.value)}
          placeholder="e.g. Warm and confident" />
      </div>

      {!!opts.styles?.length && (
        <div>
          <span className={labelCls}>Motion style</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Motion style">
            {opts.styles.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={style === s.id}
                onClick={() => setStyle(s.id)}
                className={`text-left rounded-lg border px-3 py-2.5 ${style === s.id
                  ? 'border-blue-600 ring-1 ring-blue-600 bg-blue-50 dark:bg-blue-950/40'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0b1638]'}`}
              >
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{s.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {STYLE_HINT[s.id] ?? ''}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <span className={labelCls}>Shape</span>
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden" role="radiogroup">
            {(opts.formats ?? ['16:9', '9:16']).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={format === f}
                onClick={() => setFormat(f)}
                className={`flex-1 px-2 py-2 text-xs font-medium ${format === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-[#0b1638] text-gray-700 dark:text-gray-200'}`}
              >
                {f === '16:9' ? 'Landscape 16:9' : 'Vertical 9:16'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls} htmlFor="promo-length">Length</label>
          <select id="promo-length" className={field} value={seconds}
            onChange={(e) => setSeconds(Number(e.target.value) as PromoSeconds)}>
            {(opts.lengths ?? [30, 45, 60, 90]).map((s) => <option key={s} value={s}>About {s} seconds</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="promo-writer">Storyboard written by</label>
          <select id="promo-writer" className={field} value={writer} onChange={(e) => setWriter(e.target.value)}>
            {opts.writers.map((w) => (
              <option key={w.id} value={w.id} disabled={!w.available}>
                {w.label}{w.id === opts.default_writer ? ' (default)' : ''}{w.available ? '' : ' (not set up)'}
              </option>
            ))}
          </select>
        </div>
      </div>

      <label className={`flex items-center gap-2 text-sm ${opts.voice.available ? '' : 'opacity-60'}`}>
        <input type="checkbox" checked={narration} disabled={!opts.voice.available}
          onChange={(e) => setNarration(e.target.checked)} />
        Voice-over narration
        {!opts.voice.available && <span className="text-xs text-gray-500">(not set up on this server)</span>}
      </label>

      <div>
        <span className={labelCls}>Screenshots of your product ({shots.length}/{maxShots})</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {shots.map((shot) => (
            <div key={shot.id} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL preview */}
                <img src={shot.preview} alt={shot.file.name} className="w-full h-24 object-cover object-top" />
                <button type="button" onClick={() => removeShot(shot.id)} title="Remove"
                  className="absolute top-1 right-1 rounded-full bg-black/60 text-white p-1">
                  <X className="w-3 h-3" />
                </button>
              </div>
              <input
                className="w-full px-2 py-1 text-xs bg-transparent text-gray-900 dark:text-gray-100 focus:outline-none"
                placeholder="What it shows (optional)"
                maxLength={200}
                value={shot.caption}
                onChange={(e) => setShots((cur) => cur.map((s) => (s.id === shot.id ? { ...s, caption: e.target.value } : s)))}
              />
            </div>
          ))}
          {shots.length < maxShots && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="h-[7.75rem] rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center gap-1 text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600"
            >
              <ImagePlus className="w-5 h-5" /> Add screenshots
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept={ACCEPT.join(',')} multiple className="hidden"
          onChange={(e) => addFiles(e.target.files)} />
        {fileError && <p className="mt-1 text-xs text-red-600">{fileError}</p>}
      </div>

      {start.isError && <Banner tone="error">{start.error?.message}</Banner>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className={primaryBtn}
          title={!serverReady ? 'Promo videos are not set up on this server yet'
            : missing.length ? `Add ${missing.join(' and ')}` : undefined}
          aria-describedby="promo-create-hint"
        >
          {start.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Film className="w-4 h-4" />}
          Create video
        </button>
        {!serverReady ? (
          <span id="promo-create-hint" className="text-xs text-amber-700 dark:text-amber-400">
            Promo videos are not set up on this server yet.
          </span>
        ) : missing.length > 0 ? (
          <span id="promo-create-hint" className="text-xs text-amber-700 dark:text-amber-400">
            Add {missing.join(' and ')} to create the video.
          </span>
        ) : (
          <span id="promo-create-hint" className="text-xs text-gray-500">
            Uses credits for the storyboard, narration and render.
          </span>
        )}
      </div>
    </div>
  );
};

const primaryBtn =
  'inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 max-lg:min-h-11 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed';
const secondaryBtn =
  'inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 max-lg:min-h-11 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800';

const Banner: React.FC<{ tone: 'error' | 'warn'; children: React.ReactNode }> = ({ tone, children }) => (
  <div
    className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${tone === 'error'
      ? 'border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300'
      : 'border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300'}`}
    role={tone === 'error' ? 'alert' : 'status'}
  >
    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
    <span className="flex-1">{children}</span>
  </div>
);

export default PromoVideoStudio;
