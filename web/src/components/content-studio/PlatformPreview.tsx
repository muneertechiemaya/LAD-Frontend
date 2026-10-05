'use client';
import React from 'react';
import { useSelector } from 'react-redux';
import { Heart, MessageCircle, Play, Repeat2, Send, ThumbsUp } from 'lucide-react';
import type { ContentPost, Platform } from '@lad/frontend-features/content-studio';
import { selectSettings } from '@/store/slices/settingsSlice';
import { PLATFORM_META, captionOf } from '@/lib/content-studio/meta';
import { tone } from './ui';
import { cn } from '@/lib/utils';
import { useBrandLook } from '@/lib/content-studio/brand';

export function useBrandName(): string {
  const s = useSelector(selectSettings) as { companyName?: string } | undefined;
  const name = (s?.companyName || '').trim();
  // 'My Organization' is the slice's placeholder, not a real name.
  return name && name !== 'My Organization' ? name : 'Your brand';
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || 'ML';
}

function Fold({ text, at }: { text: string; at: number | null }) {
  if (!at || text.length <= at) return <span className="whitespace-pre-line">{text}</span>;
  return (
    <span className="whitespace-pre-line">
      {text.slice(0, at).replace(/\s+\S*$/, '')}
      <span className={tone.soft}> …see more</span>
    </span>
  );
}

function SlideCard({ heading, text, n, of, cover }: { heading: string; text?: string; n: number; of: number; cover?: boolean }) {
  const brand = useBrandLook();
  return (
    <div
      className={cn(
        'flex aspect-square w-full flex-col justify-between rounded-lg p-4',
        cover ? 'bg-[#0B1957] text-white' : 'border border-[#E3E7F0] bg-white text-[#0E1530]'
      )}
      style={cover ? { backgroundColor: brand.primary } : undefined}
    >
      <span className={cn('text-[11px] font-bold tabular-nums', cover ? 'text-white/85' : 'text-[#4A5470]')}>
        {n} / {of}
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="text-lg font-semibold leading-snug">{heading}</p>
        {text ? <p className={cn('text-sm leading-snug', cover ? 'text-white/85' : 'text-[#4A5470]')}>{text}</p> : null}
      </div>
    </div>
  );
}

function Media({ post }: { post: ContentPost }) {
  if (post.format === 'carousel' && post.slides?.length) {
    const s = post.slides[0];
    return <SlideCard heading={s.heading} text={s.text} n={1} of={post.slides.length} cover />;
  }
  if (post.format === 'video_script' && post.script) {
    return (
      <div className="relative flex aspect-[4/5] w-full flex-col justify-end rounded-lg bg-[#14171A] p-4 text-white">
        <Play className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 opacity-90" aria-hidden />
        <p className="text-lg font-semibold leading-snug">{post.script.hook.onScreen || post.script.hook.spoken}</p>
      </div>
    );
  }
  if (post.mediaUrls?.[0]) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={post.mediaUrls[0]} alt="" className="w-full rounded-lg object-cover" />;
  }
  return null;
}

export function PlatformPreview({ post, platform }: { post: ContentPost; platform?: Platform }) {
  const brand = useBrandName();
  const p = platform || post.platform;
  const meta = PLATFORM_META[p];
  const caption = captionOf(post);
  const avatar = (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0B1957] text-sm font-bold text-white">
      {initials(brand)}
    </span>
  );
  const frame = cn('flex flex-col gap-3 rounded-xl border bg-white p-4 text-[#0E1530] dark:bg-[#0B1433] dark:text-[#E8ECF7]', tone.line);

  if (p === 'x') {
    const parts = post.format === 'thread' ? [post.hook, ...(post.threadParts || [])] : [caption];
    return (
      <div className={frame} aria-label="X preview">
        {parts.map((t, i) => (
          <div key={i} className="flex gap-3">
            {avatar}
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <strong>{brand}</strong> <span className={tone.soft}>@{brand.toLowerCase().replace(/[^a-z0-9]/g, '')} · now</span>
              </p>
              <p className="whitespace-pre-line text-[15px] leading-snug">
                {parts.length > 1 ? `${i + 1}/ ` : ''}
                {t}
              </p>
              <p className={cn('mt-1 text-xs tabular-nums', t.length > meta.limit ? 'text-[#A1202B] dark:text-[#FFB3B9]' : tone.soft)}>
                {t.length} / {meta.limit}
              </p>
            </div>
          </div>
        ))}
        <div className={cn('flex gap-6 pl-[52px]', tone.soft)} aria-hidden>
          <MessageCircle className="h-4 w-4" />
          <Repeat2 className="h-4 w-4" />
          <Heart className="h-4 w-4" />
        </div>
      </div>
    );
  }

  if (p === 'tiktok') {
    return (
      <div className="mx-auto flex aspect-[9/16] w-full max-w-[280px] flex-col justify-between rounded-2xl bg-[#14171A] p-4 text-white" aria-label="TikTok preview">
        <span className="self-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">For You</span>
        <div className="flex flex-col gap-2">
          <p className="text-xl font-bold leading-snug">{post.script?.hook.onScreen || post.hook}</p>
          <p className="text-sm font-semibold">@{brand.toLowerCase().replace(/[^a-z0-9]/g, '')}</p>
          <p className="text-sm leading-snug text-white/90">
            <Fold text={caption} at={meta.foldAt} />
          </p>
        </div>
      </div>
    );
  }

  if (p === 'instagram') {
    return (
      <div className={frame} aria-label="Instagram preview">
        <div className="flex items-center gap-2">
          {avatar}
          <strong className="text-sm">{brand.toLowerCase().replace(/[^a-z0-9.]/g, '')}</strong>
        </div>
        <Media post={post} />
        <div className={cn('flex gap-4', tone.soft)} aria-hidden>
          <Heart className="h-5 w-5" />
          <MessageCircle className="h-5 w-5" />
          <Send className="h-5 w-5" />
        </div>
        <p className="text-sm leading-snug">
          <strong>{brand.toLowerCase().replace(/[^a-z0-9.]/g, '')}</strong> <Fold text={caption} at={meta.foldAt} />
        </p>
      </div>
    );
  }

  // LinkedIn and Facebook share the feed-post shape.
  return (
    <div className={frame} aria-label={`${meta.label} preview`}>
      <div className="flex items-center gap-3">
        {avatar}
        <div>
          <p className="text-sm font-semibold">{brand}</p>
          <p className={cn('text-xs', tone.soft)}>Now · Public</p>
        </div>
      </div>
      <p className="text-sm leading-relaxed">
        <Fold text={caption} at={meta.foldAt} />
      </p>
      <Media post={post} />
      <div className={cn('flex gap-6 border-t pt-2', tone.line, tone.soft)} aria-hidden>
        <ThumbsUp className="h-4 w-4" />
        <MessageCircle className="h-4 w-4" />
        <Repeat2 className="h-4 w-4" />
        <Send className="h-4 w-4" />
      </div>
    </div>
  );
}
