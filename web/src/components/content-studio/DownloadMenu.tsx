'use client';
import React, { useState } from 'react';
import { Download } from 'lucide-react';
import type { ContentPost } from '@lad/frontend-features/content-studio';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/app-toaster';
import {
  downloadCaptionTxt,
  downloadScriptTxt,
  downloadSlidesPdf,
  downloadSlidesPng,
  type BrandLook,
} from '@/lib/content-studio/exports';
import { useBrandLook } from '@/lib/content-studio/brand';
import { CsButton } from './ui';
import { cn } from '@/lib/utils';

export interface ExtraDownload {
  label: string;
  detail?: string;
  run: () => Promise<string | string[]> | string | string[];
}

/**
 * Download menu for one post: 2 taps from any card (open, pick a format).
 * Items depend on the format, so a text post never offers "slides".
 */
export function DownloadMenu({
  post,
  brand: brandProp,
  extra = [],
  label = 'Download',
  size = 'sm',
  className,
}: {
  post: ContentPost;
  brand?: BrandLook;
  extra?: ExtraDownload[];
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  // Slides and calendars are drawn in the Media brand's colours when there is one.
  const mediaBrand = useBrandLook();
  const brand = brandProp || mediaBrand;
  const slides = post.slides?.length || 0;

  const items: ExtraDownload[] = [];
  if (post.format === 'carousel' && slides) {
    items.push({ label: 'Slides as PNG', detail: `${slides} file${slides === 1 ? '' : 's'} · 1080 × 1080`, run: () => downloadSlidesPng(post, brand) });
    items.push({ label: 'Slides as one PDF', detail: `${slides} page${slides === 1 ? '' : 's'}`, run: () => downloadSlidesPdf(post, brand) });
  }
  if (post.format === 'video_script') {
    items.push({ label: 'Video script as TXT', detail: 'Hook, timed scenes, CTA', run: () => downloadScriptTxt(post) });
  }
  items.push({ label: 'Caption as TXT', detail: 'Hook, body, CTA, hashtags', run: () => downloadCaptionTxt(post) });
  if (post.format === 'post' || post.format === 'thread') {
    items.push({
      label: 'Quote image as PNG',
      detail: '1 file · 1080 × 1080',
      run: () => downloadSlidesPng({ ...post, slides: [{ heading: post.hook, text: '' }] }, brand),
    });
  }
  items.push(...extra);

  const run = async (item: ExtraDownload) => {
    setBusy(true);
    try {
      const out = await item.run();
      const files = Array.isArray(out) ? out : [out];
      push({
        variant: 'success',
        title: files.length > 1 ? `Downloaded ${files.length} files` : 'Downloaded',
        description: files.length > 1 ? `${files[0]} and ${files.length - 1} more` : files[0],
      });
    } catch (e) {
      push({ variant: 'error', title: 'Download failed', description: e instanceof Error ? e.message : 'Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <CsButton size={size} busy={busy} className={className} aria-label={`${label}: ${post.title || post.hook}`}>
          {!busy && <Download className="h-4 w-4" aria-hidden />}
          {label}
        </CsButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-1">
        {items.map((it) => (
          <DropdownMenuItem
            key={it.label}
            onSelect={() => run(it)}
            className={cn('flex min-h-11 cursor-pointer flex-col items-start justify-center gap-0.5 px-3 py-2')}
          >
            <span className="text-sm font-semibold">{it.label}</span>
            {it.detail ? <span className="text-xs text-[#4A5470] dark:text-[#A9B3CC]">{it.detail}</span> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
