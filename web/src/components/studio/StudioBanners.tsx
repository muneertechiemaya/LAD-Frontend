'use client';

/**
 * StudioBanners — the nudges above the training plan.
 *
 * Green, once: the tenant just went live. Blue: a first campaign is drafted
 * and waiting (Step 7) — one tap to review and send. Both key on fields the
 * backend reports; absence renders nothing (not reported ≠ none).
 */
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Send, X } from 'lucide-react';
import type { StudioState } from '@lad/frontend-features/tenant-studio';
import { BANNER, BANNER_AI_RAIL, CARD, LINK, TINT } from './studio-theme';

/**
 * Green, once: the tenant just went live — back from the builder, or (curated)
 * the server switched their first pipeline on, in which case `pipelineName`
 * names it and the link goes to the Pipelines room.
 */
export function LiveBanner({ onDismiss, pipelineName = null }: { onDismiss: () => void; pipelineName?: string | null }) {
  return (
    <div className={`flex items-start gap-2 ${BANNER.base} ${BANNER.ready}`} data-testid="live-banner" role="status">
      <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${TINT.ready}`} aria-hidden />
      <span className="flex-1">
        <span className="font-medium">You&rsquo;re live.</span>{' '}
        {pipelineName
          ? <>{pipelineName} is switched on and running on WhatsApp. You&rsquo;ll get a daily summary, and it hands over to you the moment someone is interested.{' '}<Link href="/studio?room=pipelines" className={LINK}>See your pipelines →</Link></>
          : <>Your first campaign is sending. You&rsquo;ll get a daily summary, and it hands over to you the moment someone is interested.{' '}<Link href="/campaigns" className={LINK}>Watch it →</Link></>}
      </span>
      <button type="button" onClick={onDismiss} className="shrink-0 rounded-md p-0.5 max-lg:p-[14px] max-lg:-m-[12px] transition-colors duration-150 hover:bg-emerald-100 dark:hover:bg-emerald-500/20" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/**
 * Blue: a first campaign is drafted and waiting. A sequence draft goes to the
 * builder (`href`); a pipeline draft has nothing to review there, so when
 * `onReview` is given the action opens Go live instead.
 */
export function FirstCampaignBanner({ state, href, onReview }: { state: StudioState; href: string; onReview?: () => void }) {
  const fc = state.firstCampaign;
  if (!fc || !fc.drafted || fc.status === 'launched' || fc.launchedCampaignId || fc.launchedPipelineKey) return null;
  const pipeline = fc.kind === 'pipeline';
  return (
    <div className={`relative flex flex-col gap-2 overflow-hidden ${CARD} ${BANNER_AI_RAIL} px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between`} data-testid="first-campaign-banner" role="status">
      <span className="flex items-start gap-2">
        <Send className="mt-0.5 h-4 w-4 shrink-0 text-[#7C5CFF] dark:text-[#B69CFF]" aria-hidden />
        <span>
          {pipeline
            ? <>{fc.offering ?? 'Your first pipeline'} is picked and waiting. Go live to switch it on (1 min).</>
            : <>Your first campaign is drafted and waiting. Review and send (2 min).</>}
        </span>
      </span>
      {pipeline && onReview ? (
        <button type="button" onClick={onReview} className={`inline-flex shrink-0 items-center gap-1 ${LINK}`}>
          Go live<ArrowRight className="h-3.5 w-3.5" />
        </button>
      ) : !pipeline ? (
        <Link href={href} className={`inline-flex shrink-0 items-center gap-1 ${LINK}`}>
          Review and send<ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    </div>
  );
}
