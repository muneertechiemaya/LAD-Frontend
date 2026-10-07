'use client';
import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { ContentPost, Idea, Platform } from '@lad/frontend-features/content-studio';
import { useEnabledPlatforms, useGenerateDraft, useGenerateIdeas } from '@lad/frontend-features/content-studio';
import { apiErrorCode } from '@lad/shared/apiError';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ANGLE_LABEL, PLATFORM_FORMATS, PLATFORM_META } from '@/lib/content-studio/meta';
import { CsButton, ErrorNote, PlatformBadge, tone } from './ui';
import { cn } from '@/lib/utils';

/**
 * "Help me post something": the guided entry point. 3 taps to a written,
 * graded draft - open, pick an idea, write it for the suggested platform.
 */
export function CoachDialog({
  open,
  onClose,
  onNeedBrief,
  onDrafted,
}: {
  open: boolean;
  onClose: () => void;
  onNeedBrief: () => void;
  onDrafted: (p: ContentPost) => void;
}) {
  const enabledPlatforms = useEnabledPlatforms();
  const ideas = useGenerateIdeas();
  const draft = useGenerateDraft();
  const [picked, setPicked] = useState<Idea | null>(null);
  const [platform, setPlatform] = useState<Platform>('linkedin');

  const load = () => {
    setPicked(null);
    ideas.mutate(
      { count: 5 },
      {
        onError: (e) => {
          if (apiErrorCode(e) === 'BRIEF_REQUIRED') onNeedBrief();
        },
      }
    );
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (i: Idea) => {
    setPicked(i);
    setPlatform(i.platform || 'linkedin');
  };

  const write = async () => {
    if (!picked) return;
    try {
      const post = await draft.mutateAsync({
        topic: picked.title,
        platform,
        format: PLATFORM_FORMATS[platform][0],
        angle: picked.angle,
      });
      onDrafted(post);
    } catch (e) {
      if (apiErrorCode(e) === 'BRIEF_REQUIRED') onNeedBrief();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <div className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto p-5 sm:p-6">
          <DialogTitle className="pr-10 text-xl">{picked ? 'Where should it go?' : 'Pick an idea'}</DialogTitle>
          <DialogDescription className={tone.soft}>
            {picked
              ? 'Mr LAD writes it for that platform, checks the hook and grades it before you see it.'
              : '5 ideas from your brand brief. Each one says why it would get a reaction.'}
          </DialogDescription>

          {!picked ? (
            ideas.isPending ? (
              <p className={cn('text-sm', tone.soft)} aria-live="polite">
                Thinking of ideas from your brief…
              </p>
            ) : ideas.data ? (
              <ol className="flex flex-col gap-2">
                {ideas.data.ideas.map((i, n) => (
                  <li key={`${n}-${i.title}`}>
                    <button
                      type="button"
                      onClick={() => pick(i)}
                      className={cn(
                        'flex min-h-11 w-full flex-col items-start gap-1 rounded-[12px] border p-3 text-left',
                        tone.line,
                        tone.surface,
                        'hover:border-[#2156D9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2156D9]'
                      )}
                    >
                      <span className={cn('text-[15px] font-semibold', tone.ink)}>
                        {n + 1}. {i.title}
                      </span>
                      <span className={cn('text-xs font-semibold uppercase tracking-wide', tone.soft)}>{ANGLE_LABEL[i.angle]}</span>
                      <span className={cn('text-sm', tone.soft)}>{i.why}</span>
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <ErrorNote error={ideas.error} />
            )
          ) : (
            <div className="flex flex-col gap-4">
              <p className={cn('rounded-[12px] border p-3 text-[15px] font-semibold', tone.line, tone.ink)}>{picked.title}</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Platform">
                {enabledPlatforms.map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={platform === p}
                    onClick={() => setPlatform(p)}
                    className={cn(
                      'inline-flex min-h-11 items-center gap-2 rounded-[10px] border px-3 text-sm font-semibold',
                      platform === p ? 'border-[#0B1957] ring-2 ring-[#0B1957] dark:border-[#8DB4FF] dark:ring-[#8DB4FF]' : tone.line,
                      tone.surface,
                      tone.ink
                    )}
                  >
                    <PlatformBadge platform={p} />
                    {PLATFORM_META[p].label}
                  </button>
                ))}
              </div>
              <ErrorNote error={draft.error && apiErrorCode(draft.error) !== 'BRIEF_REQUIRED' ? draft.error : null} />
            </div>
          )}

          <div className="flex flex-wrap justify-between gap-2">
            {picked ? (
              <CsButton variant="ghost" onClick={() => setPicked(null)}>
                Back to ideas
              </CsButton>
            ) : (
              <CsButton variant="ghost" onClick={load} disabled={ideas.isPending}>
                <RefreshCw className="h-4 w-4" aria-hidden />
                5 more ideas
              </CsButton>
            )}
            {picked ? (
              <CsButton variant="primary" busy={draft.isPending} onClick={write}>
                Write it for {PLATFORM_META[platform].label}
              </CsButton>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
