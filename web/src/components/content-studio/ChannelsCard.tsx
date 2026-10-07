'use client';
/**
 * "Where posts go out": per platform, whether Mr LAD publishes or reminds,
 * and a link to connect LinkedIn when it isn't. Lives in Plan (it was on the
 * Today tab, which moved to My Tasks).
 */
import React from 'react';
import Link from 'next/link';
import { useChannels } from '@lad/frontend-features/content-studio';
import { PLATFORM_META, sentence } from '@/lib/content-studio/meta';
import { Card, PlatformBadge, SectionTitle, tone } from './ui';
import { cn } from '@/lib/utils';

export function ChannelsCard({ tz }: { tz: string }) {
  const channels = useChannels();
  const linkedin = channels.data?.find((c) => c.platform === 'linkedin');
  return (
    <Card className="flex flex-col gap-3 p-4">
      <SectionTitle>Where posts go out</SectionTitle>
      {channels.isLoading ? (
        <p className={cn('text-sm', tone.soft)}>Checking your connected accounts…</p>
      ) : channels.data ? (
        <ul className="flex flex-col gap-2">
          {channels.data.map((c) => (
            <li key={c.platform} className={cn('flex items-start gap-2 text-sm', tone.ink)}>
              <PlatformBadge platform={c.platform} className="mt-0.5 shrink-0" />
              <span>
                <strong>
                  {PLATFORM_META[c.platform].label}: {c.mode === 'auto' ? 'automatic' : 'reminder'}.
                </strong>
                <span className={tone.soft}> {sentence(c.note)}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={cn('text-sm', tone.soft)}>Couldn&apos;t check your connected accounts. Posts still go on the calendar.</p>
      )}
      {linkedin && !linkedin.connected ? (
        <Link href="/settings?tab=integrations" className="inline-flex min-h-11 items-center self-start text-sm font-semibold text-[#13489E] underline dark:text-[#8DB4FF]">
          Connect LinkedIn
        </Link>
      ) : null}
      <p className={cn('text-xs', tone.soft)}>
        Scheduling runs on Mr LAD&apos;s own scheduler, in {tz}. {PLATFORM_META.linkedin.label} posts publish through your connected account.
      </p>
    </Card>
  );
}
