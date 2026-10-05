'use client';
/**
 * Library › Images and video: the ONE place for a client's media.
 *
 *   Your images            uploads (posts attach these); each can also be used
 *                          by the image maker ("Mr LAD can use this…")
 *   Other reference images what the image maker already draws on that didn't
 *                          come from here: the Drive folder, and images added
 *                          on the old Media screen
 *   Made by Media          everything Media generated; its links expire, so
 *                          "Keep in library" copies one into Your images
 *
 * This replaced three separate places (Library uploads, Media › Reference
 * images, Media › Gallery). Media's tiles now open this view.
 */
import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { Download, Trash2, Upload } from 'lucide-react';
import type { MediaItem } from '@lad/frontend-features/content-studio';
import { useDeleteMedia, useImportGeneratedMedia, useMedia, useSetMediaReference, useUploadMedia } from '@lad/frontend-features/content-studio';
import { useMediaGallery, useReferences, useToggleReference } from '@lad/frontend-features/media-hub';
import { useToast } from '@/components/ui/app-toaster';
import { Card, CsButton, ErrorNote, SectionTitle, tone } from './ui';
import { cn } from '@/lib/utils';

const isVideo = (url: string, mime?: string) => (mime ? mime.startsWith('video/') : /\.(mp4|webm|mov)(\?|$)/i.test(url));

function Thumb({ url, mime, alt }: { url: string; mime?: string; alt: string }) {
  return isVideo(url, mime) ? (
    <video src={url} className="aspect-square w-full rounded-lg bg-black object-cover" muted playsInline aria-label={alt} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} className="aspect-square w-full rounded-lg object-cover" loading="lazy" />
  );
}

function UseForImages({ checked, busy, onChange, label }: { checked: boolean; busy?: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className={cn('flex min-h-11 cursor-pointer items-center gap-2 text-xs', tone.ink, busy && 'opacity-60')}>
      <input type="checkbox" className="h-5 w-5 shrink-0 accent-[#0B1957]" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      Mr LAD can use this when making images
    </label>
  );
}

export function MediaLibrary() {
  const media = useMedia();
  const upload = useUploadMedia();
  const del = useDeleteMedia();
  const setRef = useSetMediaReference();
  const refs = useReferences();
  const toggle = useToggleReference();
  const gallery = useMediaGallery();
  const keep = useImportGeneratedMedia();
  const { push } = useToast();
  const input = useRef<HTMLInputElement>(null);
  // Switches flip at once and roll back if the save fails.
  const [want, setWant] = useState<Record<string, boolean>>({});
  const settle = (id: string) => setWant((w) => {
    const next = { ...w };
    delete next[id];
    return next;
  });

  const mine: MediaItem[] = media.data || [];
  const linked = new Set(mine.map((m) => m.referenceAssetId).filter(Boolean) as string[]);
  const others = (refs.data?.assets || []).filter((a) => !linked.has(a.id));
  const made = [
    ...(gallery.data?.images || []).flatMap((g) => g.urls.map((url) => ({ url, video: false }))),
    ...(gallery.data?.videos || []).map((v) => ({ url: v.url, video: true })),
  ];

  const switchRef = async (m: MediaItem, use: boolean) => {
    setWant((w) => ({ ...w, [m.id]: use }));
    try {
      await setRef.mutateAsync({ id: m.id, use });
      push({ variant: 'success', title: use ? 'Mr LAD can use it now' : 'Mr LAD stopped using it', description: m.filename });
    } catch {
      /* shown below */
    } finally {
      settle(m.id);
    }
  };
  const switchOther = async (id: string, enabled: boolean) => {
    setWant((w) => ({ ...w, [id]: enabled }));
    try {
      await toggle.mutateAsync({ id, enabled });
    } catch {
      /* shown below */
    } finally {
      settle(id);
    }
  };

  return (
    <section className="flex min-w-0 flex-col gap-6" aria-label="Images and video">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>Your images</SectionTitle>
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label="Upload an image"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                await upload.mutateAsync(f);
                push({ variant: 'success', title: 'Uploaded', description: f.name });
              } catch {
                /* shown below */
              }
            }}
          />
          <CsButton variant="primary" busy={upload.isPending} onClick={() => input.current?.click()}>
            <Upload className="h-4 w-4" aria-hidden />
            Upload image
          </CsButton>
        </div>
        <p className={cn('text-xs', tone.soft)}>
          PNG, JPEG or WebP up to 10 MB. Attach them to posts from the composer. Switch one on and Mr LAD can also use it as a reference when making images, like your logo or product photos.
        </p>
        <ErrorNote error={media.error || upload.error || del.error || setRef.error} />
        {media.isLoading ? (
          <p className={cn('text-sm', tone.soft)}>Loading your images…</p>
        ) : mine.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {mine.map((m) => (
              <li key={m.id}>
                <Card className="flex flex-col gap-1 p-2">
                  <Thumb url={m.url} mime={m.mimeType} alt={m.filename} />
                  <span className={cn('truncate text-xs', tone.ink)}>{m.filename}</span>
                  {!isVideo(m.url, m.mimeType) ? (
                    <UseForImages
                      checked={want[m.id] ?? !!m.usedForImages}
                      busy={setRef.isPending && setRef.variables?.id === m.id}
                      onChange={(v) => switchRef(m, v)}
                      label={`Mr LAD can use ${m.filename} when making images`}
                    />
                  ) : null}
                  <CsButton size="sm" variant="ghost" aria-label={`Delete ${m.filename}`} onClick={() => del.mutate(m.id)}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Delete
                  </CsButton>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <Card className="p-5">
            <p className={cn('text-sm', tone.soft)}>Nothing uploaded yet.</p>
          </Card>
        )}
      </div>

      {others.length || refs.data?.drive_connected ? (
        <div className="flex flex-col gap-3" aria-label="Other reference images">
          <SectionTitle as="h3">Other reference images</SectionTitle>
          <p className={cn('text-xs', tone.soft)}>
            Images Mr LAD already draws on from your Drive folder or earlier uploads.{' '}
            <Link href="/content-studio?tab=media" className="inline-flex min-h-11 items-center font-semibold underline">
              Manage the Drive folder
            </Link>
          </p>
          <ErrorNote error={refs.error || toggle.error} />
          {others.length ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {others.map((a) => (
                <li key={a.id}>
                  <Card className="flex flex-col gap-1 p-2">
                    {a.preview_url ? <Thumb url={a.preview_url} alt={a.filename} /> : <div className="aspect-square w-full rounded-lg bg-[#ECEEF3] dark:bg-[#24305A]" aria-hidden />}
                    <span className={cn('truncate text-xs', tone.ink)}>{a.filename}</span>
                    <span className={cn('text-xs', tone.soft)}>{a.source === 'drive' ? 'From Drive' : 'Earlier upload'}</span>
                    <UseForImages
                      checked={want[a.id] ?? a.enabled}
                      busy={toggle.isPending && toggle.variables?.id === a.id}
                      onChange={(v) => switchOther(a.id, v)}
                      label={`Mr LAD can use ${a.filename} when making images`}
                    />
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <p className={cn('text-sm', tone.soft)}>Your Drive folder is connected but has no images yet.</p>
          )}
        </div>
      ) : null}

      <div className="flex flex-col gap-3" aria-label="Made by Media">
        <SectionTitle as="h3">Made by Media</SectionTitle>
        <p className={cn('text-xs', tone.soft)}>Everything Media made for you in the last 90 days. These links last about a week, so keep the ones you want.</p>
        <ErrorNote error={gallery.error || keep.error} />
        {gallery.isLoading ? (
          <p className={cn('text-sm', tone.soft)}>Loading your gallery…</p>
        ) : made.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {made.map((g, i) => (
              <li key={g.url}>
                <Card className="flex flex-col gap-1 p-2">
                  <Thumb url={g.url} mime={g.video ? 'video/mp4' : undefined} alt={`Made by Media ${i + 1}`} />
                  <CsButton
                    size="sm"
                    busy={keep.isPending && keep.variables?.sourceUrl === g.url}
                    onClick={async () => {
                      try {
                        await keep.mutateAsync({ sourceUrl: g.url, mediaType: g.video ? 'video' : 'image' });
                        push({ variant: 'success', title: 'Kept in your images' });
                      } catch {
                        /* shown above */
                      }
                    }}
                  >
                    Keep in library
                  </CsButton>
                  <a
                    href={g.url}
                    download
                    className={cn('inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] text-[13px] font-semibold', tone.ink)}
                    aria-label={`Download made by Media ${i + 1}`}
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    Download
                  </a>
                </Card>
              </li>
            ))}
          </ul>
        ) : (
          <p className={cn('text-sm', tone.soft)}>Nothing made yet. Use Make an image in the composer, or the Media tab.</p>
        )}
      </div>
    </section>
  );
}
