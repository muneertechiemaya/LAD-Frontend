'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import type { ContentPost } from '@lad/frontend-features/content-studio';
import { useRepurpose } from '@lad/frontend-features/content-studio';
import { apiErrorCode } from '@lad/shared/apiError';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { FORMAT_LABEL, PLATFORM_META, postTitle } from '@/lib/content-studio/meta';
import { CsButton, ErrorNote, Field, PlatformBadge, inputCls, textareaCls, tone } from './ui';
import { cn } from '@/lib/utils';

const MIN_CHARS = 600;

/**
 * One long piece in, a week of posts out: 3 LinkedIn posts, 5 X threads and
 * 2 short-video scripts, each opened with a tested hook and graded. A thin
 * source returns fewer strong posts rather than padding.
 */
export function RepurposeDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (posts: ContentPost[]) => void;
}) {
  const run = useRepurpose();
  const [source, setSource] = useState('');
  const [title, setTitle] = useState('');
  const created = run.data?.posts || [];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          run.reset();
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <div className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto p-5 sm:p-6">
          <DialogTitle className="pr-10 text-xl">Turn a long piece into posts</DialogTitle>
          <DialogDescription className={tone.soft}>
            Paste a blog post, newsletter, script or video transcript. You get up to 3 LinkedIn posts, 5 X threads and 2 short-video scripts as drafts.
          </DialogDescription>
          {created.length ? (
            <div className="flex flex-col gap-3">
              <p className={cn('text-sm font-semibold', tone.ink)}>{created.length} drafts are in your Library.</p>
              <ul className="flex flex-col gap-2">
                {created.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/content-studio?tab=create&post=${p.id}`}
                      onClick={onClose}
                      className={cn('flex min-h-11 items-center gap-2 rounded-[10px] border px-3 py-2', tone.line, tone.ink)}
                    >
                      <PlatformBadge platform={p.platform} />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{postTitle(p)}</span>
                      <span className={cn('text-xs', tone.soft)}>
                        {FORMAT_LABEL[p.format]}
                        {p.score != null ? ` · ${p.score}` : ''}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="flex justify-end">
                <CsButton
                  variant="primary"
                  onClick={() => {
                    onDone(created);
                    onClose();
                  }}
                >
                  Open the first one
                </CsButton>
              </div>
            </div>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (source.trim().length >= MIN_CHARS) run.mutate({ source, title: title || undefined });
              }}
            >
              <Field label="Name it (optional)" htmlFor="rp-title">
                <input id="rp-title" className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="October newsletter" />
              </Field>
              <Field label="The long piece" hint={`At least ${MIN_CHARS} characters. ${source.length.toLocaleString()} so far.`} htmlFor="rp-source">
                <textarea id="rp-source" rows={10} className={textareaCls} value={source} onChange={(e) => setSource(e.target.value)} />
              </Field>
              <ErrorNote error={run.error && apiErrorCode(run.error) === 'BRIEF_REQUIRED' ? new Error('Add your brand brief first so posts sound like your business.') : run.error} />
              <div className="flex justify-end">
                <CsButton variant="primary" type="submit" busy={run.isPending} disabled={source.trim().length < MIN_CHARS}>
                  Make the posts
                </CsButton>
              </div>
              {run.isPending ? (
                <p className={cn('text-sm', tone.soft)} aria-live="polite">
                  Finding the main ideas and writing each post for its platform. This takes about a minute.
                </p>
              ) : null}
              <p className={cn('text-xs', tone.soft)}>
                {PLATFORM_META.linkedin.label} posts, {PLATFORM_META.x.label} threads and short-video scripts are written separately for each platform, never copied across.
              </p>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
