'use client';
import React from 'react';
import { Check, Clock, Copy, Eye, Pencil, RotateCw, Send, Wand2 } from 'lucide-react';
import type { ContentPost } from '@lad/frontend-features/content-studio';
import { useApplyFix, useApprovePost, useMarkPosted, useRetryPost } from '@lad/frontend-features/content-studio';
import { useToast } from '@/components/ui/app-toaster';
import { PLATFORM_META, captionOf, formatName, scoreSubline } from '@/lib/content-studio/meta';
import { friendlyTime } from '@/lib/content-studio/time';
import { DownloadMenu, type ExtraDownload } from './DownloadMenu';
import { AudienceLine } from './AudienceTest';
import { ApprovalChip, Card, CsButton, PlatformBadge, SampleChip, StatusChip, tone } from './ui';
import { cn } from '@/lib/utils';

export interface PostCardActions {
  onEdit: (post: ContentPost) => void;
  onPreview: (post: ContentPost) => void;
  onMoveTime: (post: ContentPost) => void;
  extraDownloads?: ExtraDownload[];
}

/**
 * A Today card. Every core action is 1 or 2 taps from here: Approve, Edit,
 * Preview and Fix are 1; Move time and Download are 2 (open, choose).
 */
export function PostCard({ post, onEdit, onPreview, onMoveTime, extraDownloads }: { post: ContentPost } & PostCardActions) {
  const approve = useApprovePost();
  const applyFix = useApplyFix();
  const markPosted = useMarkPosted();
  const retry = useRetryPost();
  const { push } = useToast();
  const meta = PLATFORM_META[post.platform];
  const tz = post.timezone;
  const pending = post.approvalState === 'pending';
  const due = post.status === 'scheduled' && post.publishMode === 'reminder' && !!post.scheduledAt && new Date(post.scheduledAt).getTime() <= Date.now();
  const topFix = post.grade?.fixes?.[0];

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      push({ variant: 'success', title: ok });
    } catch (e) {
      push({ variant: 'error', title: 'That did not work', description: e instanceof Error ? e.message : 'Please try again.' });
    }
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(captionOf(post));
      push({ variant: 'success', title: 'Caption copied', description: `Paste it into ${meta.label}.` });
    } catch {
      push({ variant: 'error', title: 'Could not copy', description: 'Open Edit and copy the caption from there.' });
    }
  };

  const statusLine = post.scheduledAt
    ? `${post.status === 'published' ? 'Posted' : post.status === 'scheduled' && !post.isSample ? 'Goes out' : 'Planned for'} ${friendlyTime(post.scheduledAt, tz)}`
    : 'No time yet';

  return (
    <Card as="article" className="flex flex-col gap-3 p-4" aria-label={`${meta.label} ${formatName(post.platform, post.format)}: ${post.title || post.hook}`}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={post.status} />
        <ApprovalChip state={post.approvalState} />
        {post.isSample ? <SampleChip label="Sample post" /> : null}
        <span className={cn('inline-flex items-center gap-1 text-[13px] tabular-nums', tone.soft)}>
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {statusLine}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-2">
          <PlatformBadge platform={post.platform} />
          <span className={cn('text-[13px] font-semibold', tone.ink)}>
            {meta.label} · {formatName(post.platform, post.format)}
          </span>
        </span>
        {post.pillar ? <span className={cn('text-[13px]', tone.soft)}>Pillar: {post.pillar}</span> : null}
      </div>
      <p className={cn('text-base font-semibold leading-snug', tone.ink)}>“{post.hook || post.title}”</p>
      {post.score != null ? (
        <p className={cn('text-[13px] tabular-nums', tone.ink)}>
          <strong>Score {post.score} / 10</strong>{' '}
          <span className={tone.soft}>· {pending && topFix ? `Top fix: ${topFix.fix}` : scoreSubline(post)}</span>
        </p>
      ) : null}
      {pending ? <AudienceLine post={post} /> : null}
      {post.status === 'failed' && post.lastError ? (
        <p className="text-[13px] text-[#A1202B] dark:text-[#FFB3B9]">{post.lastError}</p>
      ) : null}
      {due ? (
        <p className={cn('text-[13px]', tone.ink)}>
          Time to post on {meta.label}. Mr LAD has the caption and files ready.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {pending ? (
          <>
            <CsButton size="sm" variant="primary" busy={approve.isPending} onClick={() => run(() => approve.mutateAsync(post.id), 'Approved. It goes out on time.')}>
              <Check className="h-4 w-4" aria-hidden />
              Approve
            </CsButton>
            {topFix ? (
              <CsButton
                size="sm"
                busy={applyFix.isPending}
                onClick={() => run(() => applyFix.mutateAsync({ id: post.id, fixIndex: 0 }), 'Suggestion applied. A new version was saved.')}
              >
                <Wand2 className="h-4 w-4" aria-hidden />
                Fix with suggestion
              </CsButton>
            ) : null}
            <CsButton size="sm" onClick={() => onMoveTime(post)}>
              <Clock className="h-4 w-4" aria-hidden />
              Reschedule
            </CsButton>
            <CsButton size="sm" variant="ghost" onClick={() => onEdit(post)}>
              <Pencil className="h-4 w-4" aria-hidden />
              Edit
            </CsButton>
          </>
        ) : due ? (
          <>
            <CsButton size="sm" variant="primary" onClick={copyCaption}>
              <Copy className="h-4 w-4" aria-hidden />
              Copy caption
            </CsButton>
            <DownloadMenu post={post} extra={extraDownloads} />
            <CsButton size="sm" busy={markPosted.isPending} onClick={() => run(() => markPosted.mutateAsync({ id: post.id }), 'Marked as posted')}>
              <Send className="h-4 w-4" aria-hidden />
              Mark as posted
            </CsButton>
            <CsButton size="sm" variant="ghost" onClick={() => onMoveTime(post)}>
              <Clock className="h-4 w-4" aria-hidden />
              Move time
            </CsButton>
          </>
        ) : post.status === 'failed' ? (
          <>
            <CsButton size="sm" variant="primary" busy={retry.isPending} onClick={() => run(() => retry.mutateAsync(post.id), 'Retrying in a minute')}>
              <RotateCw className="h-4 w-4" aria-hidden />
              Retry
            </CsButton>
            <CsButton size="sm" onClick={() => onEdit(post)}>
              <Pencil className="h-4 w-4" aria-hidden />
              Edit
            </CsButton>
          </>
        ) : (
          <>
            <CsButton size="sm" onClick={() => onPreview(post)}>
              <Eye className="h-4 w-4" aria-hidden />
              Preview
            </CsButton>
            <CsButton size="sm" onClick={() => onEdit(post)}>
              <Pencil className="h-4 w-4" aria-hidden />
              Edit
            </CsButton>
            {post.status !== 'published' ? (
              <CsButton size="sm" onClick={() => onMoveTime(post)}>
                <Clock className="h-4 w-4" aria-hidden />
                Move time
              </CsButton>
            ) : null}
            <DownloadMenu post={post} extra={extraDownloads} />
          </>
        )}
      </div>
    </Card>
  );
}
