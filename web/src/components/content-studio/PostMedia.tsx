'use client';
/**
 * Images and video on a post, from the composer: pick from the Media gallery or
 * your uploads, make an image for this post, or (for a video script) make a
 * promo video from it.
 *
 * Media Hub outputs are short-lived signed URLs, so anything chosen from there
 * is first copied into the post library (import-generated) and the permanent
 * URL is what the post keeps.
 */
import React, { useState } from 'react';
import { Film, ImagePlus, Images, Loader2, Trash2, Wand2 } from 'lucide-react';
import type { ContentPost, Platform, PostFormat, VideoScript } from '@lad/frontend-features/content-studio';
import { useImportGeneratedMedia, useMedia } from '@lad/frontend-features/content-studio';
import { useGenerateImage, useImageJob, useMediaGallery } from '@lad/frontend-features/media-hub';
import { useToast } from '@/components/ui/app-toaster';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { PLATFORM_META } from '@/lib/content-studio/meta';
import { PromoVideoStudio } from './media/PromoVideoStudio';
import { Card, CsButton, ErrorNote, Label, SectionTitle, textareaCls, tone } from './ui';
import { cn } from '@/lib/utils';

const isVideo = (url: string) => /\.(mp4|webm|mov)(\?|$)/i.test(url);

export function PostMedia({
  mediaUrls,
  onChange,
  platform,
  format,
  hook,
  body,
  cta,
  script,
}: {
  mediaUrls: string[];
  onChange: (urls: string[]) => void;
  platform: Platform;
  format: PostFormat;
  hook: string;
  body: string;
  cta: string;
  script: VideoScript | null;
}) {
  const [open, setOpen] = useState<null | 'gallery' | 'make' | 'promo'>(null);
  const importer = useImportGeneratedMedia();
  const { push } = useToast();

  const attach = async (sourceUrl: string, mediaType: 'image' | 'video') => {
    try {
      const item = await importer.mutateAsync({ sourceUrl, mediaType });
      onChange([...mediaUrls.filter((u) => u !== item.url), item.url]);
      push({ variant: 'success', title: mediaType === 'video' ? 'Video attached' : 'Image attached', description: 'Save the post to keep it.' });
      setOpen(null);
    } catch (e) {
      push({ variant: 'error', title: 'Could not attach it', description: e instanceof Error ? e.message : 'Please try again.' });
    }
  };
  const addOwn = (url: string) => {
    onChange([...mediaUrls.filter((u) => u !== url), url]);
    setOpen(null);
  };

  const imagePrompt = [
    `An image for a ${PLATFORM_META[platform].label} post.`,
    hook ? `The post opens: "${hook}".` : '',
    body ? `It is about: ${body.slice(0, 240)}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex flex-col gap-2">
      <Label>Images and video</Label>
      {mediaUrls.length ? (
        <ul className="flex flex-wrap gap-2" aria-label="Attached media">
          {mediaUrls.map((u, i) => (
            <li key={u} className={cn('relative overflow-hidden rounded-[10px] border', tone.line)}>
              {isVideo(u) ? (
                <video src={u} className="h-24 w-24 bg-black object-cover" muted playsInline aria-label={`Attached video ${i + 1}`} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u} alt={`Attached image ${i + 1}`} className="h-24 w-24 object-cover" />
              )}
              <CsButton
                size="sm"
                variant="ghost"
                className="absolute right-0 top-0 bg-white/90 px-0 dark:bg-[#0B1430]/90"
                aria-label={`Remove media ${i + 1}`}
                onClick={() => onChange(mediaUrls.filter((x) => x !== u))}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </CsButton>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <CsButton size="sm" onClick={() => setOpen('gallery')}>
          <Images className="h-4 w-4" aria-hidden />
          From your gallery
        </CsButton>
        <CsButton size="sm" onClick={() => setOpen('make')}>
          <ImagePlus className="h-4 w-4" aria-hidden />
          Make an image
        </CsButton>
        {format === 'video_script' ? (
          <CsButton size="sm" onClick={() => setOpen('promo')}>
            <Film className="h-4 w-4" aria-hidden />
            Make a promo video
          </CsButton>
        ) : null}
      </div>
      <p className={cn('text-xs', tone.soft)}>
        {platform === 'linkedin'
          ? 'LinkedIn posts publish with the first image. A video or extra images get a reminder with the files ready.'
          : 'Attached files are in the reminder and the downloads, ready to post.'}
      </p>

      <GalleryDialog open={open === 'gallery'} onClose={() => setOpen(null)} busy={importer.isPending} onPickGenerated={attach} onPickOwn={addOwn} />
      <MakeImageDialog open={open === 'make'} onClose={() => setOpen(null)} initialPrompt={imagePrompt} attaching={importer.isPending} onUse={(url) => attach(url, 'image')} />
      <Dialog open={open === 'promo'} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="sm:max-w-2xl">
          <div className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto p-5 sm:p-6">
            <DialogTitle className="pr-10 text-xl">Make a promo video</DialogTitle>
            <DialogDescription className={tone.soft}>
              Started from this script. Add 1 to 6 screenshots of what you&apos;re promoting; Mr LAD writes the storyboard, animates it in your brand and saves it to your Gallery. Uses credits.
            </DialogDescription>
            {open === 'promo' ? (
              <PromoVideoStudio
                initial={{
                  product: hook || '',
                  goal: script?.cta?.spoken || cta || '',
                  format: platform === 'linkedin' || platform === 'facebook' ? '16:9' : '9:16',
                  seconds: script && script.durationSeconds > 45 ? 60 : 45,
                  ctaLabel: script?.cta?.onScreen || undefined,
                }}
                onUse={(url) => attach(url, 'video')}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GalleryDialog({
  open,
  onClose,
  busy,
  onPickGenerated,
  onPickOwn,
}: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  onPickGenerated: (url: string, type: 'image' | 'video') => void;
  onPickOwn: (url: string) => void;
}) {
  const gallery = useMediaGallery(open);
  const own = useMedia(open);
  const images = (gallery.data?.images || []).flatMap((g) => g.urls.map((url) => ({ url, key: `${g.generation_id}-${url}` })));
  const videos = gallery.data?.videos || [];
  const tile = 'relative block h-24 w-full overflow-hidden rounded-[10px] border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <div className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto p-5 sm:p-6">
          <DialogTitle className="pr-10 text-xl">Add from your gallery</DialogTitle>
          <DialogDescription className={tone.soft}>Everything Media has made for you, and the files you uploaded. Tap one to attach it.</DialogDescription>
          {busy ? (
            <p className={cn('flex items-center gap-2 text-sm', tone.ink)} aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden /> Attaching…
            </p>
          ) : null}
          <section className="flex flex-col gap-2" aria-label="Made by Media">
            <SectionTitle as="h3">Made by Media</SectionTitle>
            {gallery.isLoading ? (
              <p className={cn('text-sm', tone.soft)}>Loading your gallery…</p>
            ) : gallery.error ? (
              <ErrorNote error={gallery.error} />
            ) : !images.length && !videos.length ? (
              <p className={cn('text-sm', tone.soft)}>Nothing yet. Use Make an image, or the Media tab.</p>
            ) : (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {images.map((im, i) => (
                  <li key={im.key}>
                    <button type="button" disabled={busy} className={cn(tile, tone.line)} aria-label={`Attach gallery image ${i + 1}`} onClick={() => onPickGenerated(im.url, 'image')}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={im.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  </li>
                ))}
                {videos.map((v, i) => (
                  <li key={v.url}>
                    <button type="button" disabled={busy} className={cn(tile, tone.line, 'bg-black')} aria-label={`Attach gallery video ${i + 1}`} onClick={() => onPickGenerated(v.url, 'video')}>
                      <video src={v.url} className="h-full w-full object-cover" muted playsInline />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="flex flex-col gap-2" aria-label="Your uploads">
            <SectionTitle as="h3">Your uploads</SectionTitle>
            {own.isLoading ? (
              <p className={cn('text-sm', tone.soft)}>Loading…</p>
            ) : !(own.data || []).length ? (
              <p className={cn('text-sm', tone.soft)}>No uploads yet. Add them in Library › Uploaded media.</p>
            ) : (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {(own.data || []).map((m) => (
                  <li key={m.id}>
                    <button type="button" className={cn(tile, tone.line)} aria-label={`Attach ${m.filename}`} onClick={() => onPickOwn(m.url)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MakeImageDialog({
  open,
  onClose,
  initialPrompt,
  attaching,
  onUse,
}: {
  open: boolean;
  onClose: () => void;
  initialPrompt: string;
  attaching: boolean;
  onUse: (url: string) => void;
}) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [useBrand, setUseBrand] = useState(true);
  const gen = useGenerateImage();
  const [jobId, setJobId] = useState<string | null>(null);
  const polled = useImageJob(jobId);
  const job = polled.data || gen.data;
  const done = job?.status === 'completed';
  const failed = job?.status === 'failed';
  const working = gen.isPending || (!!job && !done && !failed);
  const urls = done ? (job?.images || []).map((i) => i.url).filter(Boolean) as string[] : [];

  const make = async () => {
    setJobId(null);
    try {
      const j = await gen.mutateAsync({ prompt, useBrand });
      if (j.status !== 'completed' && j.status !== 'failed') setJobId(j.job_id);
    } catch {
      /* shown below */
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
        else setPrompt(initialPrompt);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <div className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto p-5 sm:p-6">
          <DialogTitle className="pr-10 text-xl">Make an image</DialogTitle>
          <DialogDescription className={tone.soft}>Started from this post. Edit the description if you like. Uses credits; it also lands in your Gallery.</DialogDescription>
          <label className="flex flex-col gap-1">
            <span className={cn('text-sm font-semibold', tone.ink)}>Describe the image</span>
            <textarea rows={5} className={textareaCls} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          </label>
          <label className={cn('flex min-h-11 items-center gap-3 text-sm', tone.ink)}>
            <input type="checkbox" className="h-5 w-5 accent-[#0B1957]" checked={useBrand} onChange={(e) => setUseBrand(e.target.checked)} />
            Use my brand profile (colours, logo and style)
          </label>
          <CsButton variant="primary" className="self-start" busy={working} disabled={!prompt.trim()} onClick={make}>
            <Wand2 className="h-4 w-4" aria-hidden />
            {urls.length ? 'Make another' : 'Make it'}
          </CsButton>
          {working ? (
            <p className={cn('text-sm', tone.soft)} aria-live="polite">
              Making your image. This usually takes under a minute.
            </p>
          ) : null}
          <ErrorNote error={gen.error || polled.error || (failed ? new Error(job?.error || 'The image could not be made. Try a different description.') : null)} />
          {urls.length ? (
            <ul className="grid grid-cols-2 gap-2">
              {urls.map((u, i) => (
                <li key={u} className="flex flex-col gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt={`Made image ${i + 1}`} className={cn('w-full rounded-[10px] border object-cover', tone.line)} />
                  <CsButton size="sm" busy={attaching} onClick={() => onUse(u)}>
                    Use this image
                  </CsButton>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
