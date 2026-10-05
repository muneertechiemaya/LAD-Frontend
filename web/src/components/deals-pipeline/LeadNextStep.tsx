'use client';

/**
 * LeadNextStep - "where is this lead in its campaign, and what happens next",
 * at the top of the Pipeline lead details.
 *
 * Reads GET /api/campaigns/lead-reports/by-lead/:leadId through useLeadReport
 * (plain SQL; the LLM only runs on POST /advance, which this never calls). It is
 * mounted inside the open dialog's Overview tab only, so a Kanban board of
 * cards doesn't fire one request per card.
 *
 * Renders nothing while loading, for a lead that isn't in a campaign, or where
 * the endpoint doesn't exist (404). Any other failure says so in one line:
 * failure is not the same as "no campaign".
 */

import Link from 'next/link';
import { Megaphone } from 'lucide-react';
import { LeadReportError, useLeadReport } from '@/hooks/useLeadReport';
import type { SequenceStep } from '@/types/leadReport';
import { formatDateTimeUnified } from '@/utils/dateTime';

const CHANNEL: Record<SequenceStep['channel'], string> = {
  linkedin: 'LinkedIn',
  email: 'Email',
  whatsapp: 'WhatsApp',
  voice: 'Phone call',
  instagram: 'Instagram',
  research: 'Research',
  report: 'Report',
  system: 'System',
};

// Only states this lead's sequence reports for sure. 'active' gets no badge: the
// sequence can't tell a live campaign from a stopped, draft or out-of-credit one.
const STATUS: Partial<Record<'active' | 'paused' | 'completed', { label: string; className: string }>> = {
  paused: { label: 'Not sending', className: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900' },
  completed: { label: 'Done for this lead', className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/10 dark:text-slate-200 dark:border-slate-700' },
};
// "Sent" only fits steps that send something.
const SENDS = new Set<SequenceStep['channel']>(['linkedin', 'email', 'whatsapp', 'instagram']);

export default function LeadNextStep({ leadId }: { leadId: string | number }) {
  const { bundle, isLoading, loadError } = useLeadReport(String(leadId));

  if (isLoading) return null;
  if (loadError) {
    if (loadError instanceof LeadReportError && loadError.status === 404) return null;
    return (
      <p className="text-sm text-gray-600 dark:text-slate-300">Couldn&apos;t load this lead&apos;s campaign progress.</p>
    );
  }
  const seq = bundle?.sequence;
  if (!bundle?.enrolled || !seq) return null;

  const steps = seq.steps || [];
  const next = steps.find((s) => s.status === 'current') || steps.find((s) => s.status === 'queued') || null;
  const lastDone = [...steps].reverse().find((s) => s.status === 'done') || null;
  const status = STATUS[seq.status];
  // Counted from the steps themselves: current_step can read "0 of 3".
  const doneCount = steps.filter((s) => s.status === 'done').length;

  return (
    <section aria-labelledby="lead-campaign-progress" className="rounded-lg border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/60 dark:bg-blue-950/30">
      <div className="flex flex-wrap items-center gap-2">
        <Megaphone className="h-4 w-4 text-blue-700 dark:text-blue-300" aria-hidden="true" />
        <h3 id="lead-campaign-progress" className="text-base font-semibold text-gray-900 dark:text-white">
          Campaign progress
        </h3>
        {status && (
          <span className={`ml-auto inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.className}`}>
            {status.label}
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-gray-900 dark:text-white">
        <span className="font-medium">{bundle.campaign_name || seq.name}</span>
        <span className="text-gray-600 dark:text-slate-300">
          {' · '}{doneCount === 0 ? 'not started yet' : `${doneCount} of ${steps.length} steps done`}
        </span>
      </p>
      {seq.status === 'completed' && (
        <p className="mt-3 text-sm text-gray-700 dark:text-slate-200">This lead has reached the end of the campaign&apos;s steps.</p>
      )}
      {seq.status === 'paused' && (
        <p className="mt-3 text-sm text-gray-700 dark:text-slate-200">Nothing is being sent to this lead right now.</p>
      )}
      <dl className="mt-3 space-y-2 text-sm">
        {seq.status !== 'completed' && next ? (
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-xs font-medium text-gray-600 dark:text-slate-300 pt-0.5">Next</dt>
            <dd className="min-w-0 text-gray-900 dark:text-white">
              {next.action}
              {next.channel !== 'system' && <span className="text-gray-600 dark:text-slate-300"> · {CHANNEL[next.channel] ?? next.channel}</span>}
              {next.stuck && (
                <span className="mt-1 block text-amber-800 dark:text-amber-300">
                  {SENDS.has(next.channel) ? 'Not sent yet' : "Hasn't happened yet"} - the last try didn&apos;t go through.
                </span>
              )}
            </dd>
          </div>
        ) : null}
        {lastDone && (
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-xs font-medium text-gray-600 dark:text-slate-300 pt-0.5">Last done</dt>
            <dd className="min-w-0 text-gray-900 dark:text-white">
              {lastDone.action}
              {lastDone.at && (
                <span className="text-gray-600 dark:text-slate-300">
                  {lastDone.outcome === 'accepted' ? ' - accepted ' : ' · '}{formatDateTimeUnified(lastDone.at)}
                </span>
              )}
            </dd>
          </div>
        )}
      </dl>
      {bundle.campaign_id && (
        <Link
          href={`/campaigns/${bundle.campaign_id}/analytics`}
          className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-blue-700 hover:underline dark:text-blue-300"
        >
          See campaign results →
        </Link>
      )}
    </section>
  );
}
