'use client';

/**
 * ReengageTopicsWidget — "Re-engage by Topic".
 *
 * Surfaces the segments of customers who ASKED ABOUT a topic (e.g. Pilates,
 * Pricing) but did NOT convert, and lets the tenant fire a WhatsApp broadcast
 * to exactly that segment in one click. Each topic's contacts are handed to the
 * existing MessageTemplateSender (template picker + send) as `allMembers`, so
 * "Send to all" targets precisely that segment.
 *
 * Data: LAD-Master-Agent via useConversationAnalytics (shared with the funnel
 * widget — one fetch).
 */
import React, { useMemo, useState } from 'react';
import { Megaphone, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';

import MessageTemplateSender from '@/features/community-roi/components/MessageTemplateSender';
import { WidgetWrapper } from '../WidgetWrapper';
import { useConversationAnalytics, TopicSegment } from '../useConversationAnalytics';

const WINDOW_DAYS = 30;

// Map a topic's contacts → the member shape MessageTemplateSender expects.
// We pass ONLY this segment as `allMembers`, so its "Send to all" = this segment.
function toMembers(topic: TopicSegment) {
  return topic.contacts
    .filter((c) => (c.phone || '').trim())
    .map((c) => ({
      id: c.wa_contact_id || c.conversation_id,
      name: c.contact_name || c.phone || 'Customer',
      phone: c.phone,
      whatsapp_phone: c.phone,
    }));
}

export const ReengageTopicsWidget: React.FC<{ id: string }> = ({ id }) => {
  // Topics need the LLM round-trip — fetched separately from the funnel so the
  // funnel stays instant; this widget shows its own skeleton while labels resolve.
  const { data, loading, error, refresh } = useConversationAnalytics(WINDOW_DAYS, true);
  const [active, setActive] = useState<TopicSegment | null>(null);
  const [sent, setSent] = useState<{ topic: string; total: number } | null>(null);

  const activeMembers = useMemo(() => (active ? toMembers(active) : []), [active]);

  const header = (
    <button
      onClick={refresh}
      title="Refresh"
      className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-muted-foreground dark:text-[#E0E0E0]"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
    </button>
  );

  const topics = data?.unconverted_topics ?? [];

  return (
    <WidgetWrapper
      id={id}
      title="Re-engage by Topic"
      icon={<Megaphone className="h-4 w-4" />}
      headerActions={header}
    >
      {sent && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Broadcasting to {sent.total} {sent.topic} contact{sent.total === 1 ? '' : 's'}…</span>
        </div>
      )}

      {error && !data ? (
        <div className="h-full flex flex-col items-center justify-center text-center gap-1 py-6">
          <p className="text-sm text-muted-foreground">Couldn’t load segments</p>
          <p className="text-[11px] text-muted-foreground/70 max-w-[240px]">{error}</p>
          <button onClick={refresh} className="mt-2 text-xs text-blue-600 hover:underline">Try again</button>
        </div>
      ) : loading && !data ? (
        <TopicsSkeleton />
      ) : topics.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center gap-1 py-6">
          <Sparkles className="h-5 w-5 text-muted-foreground/60" />
          <p className="text-sm font-medium dark:text-[#E0E0E0]">No re-engagement segments</p>
          <p className="text-[11px] text-muted-foreground max-w-[250px]">
            When customers ask about something specific but don’t book, they’ll be grouped here so you can win them back.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-muted-foreground">
            Asked but didn’t book — message them a tailored offer.
          </p>
          {topics.map((t) => {
            const reachable = toMembers(t).length;
            return (
              <div
                key={t.topic}
                className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 dark:border-white/5 bg-white/60 dark:bg-white/[0.03] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate dark:text-[#E0E0E0]">{t.topic}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {t.count} didn’t book
                    {reachable < t.count && <span> · {reachable} on WhatsApp</span>}
                  </p>
                </div>
                <button
                  onClick={() => setActive(t)}
                  disabled={reachable === 0}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Megaphone className="h-3.5 w-3.5" />
                  Broadcast
                </button>
              </div>
            );
          })}
        </div>
      )}

      {active && (
        <MessageTemplateSender
          memberName=""
          noInteractionCount={0}
          recommendations={[]}
          allMembers={activeMembers}
          onClose={() => setActive(null)}
          onSuccess={(result: { broadcasting?: boolean; total?: number }) => {
            if (result?.broadcasting) {
              setSent({ topic: active.topic, total: result.total ?? activeMembers.length });
              setTimeout(() => setSent(null), 8000);
            }
          }}
        />
      )}
    </WidgetWrapper>
  );
};

const TopicsSkeleton: React.FC = () => (
  <div className="flex flex-col gap-2 animate-pulse">
    {[0, 1, 2, 3].map((i) => (
      <div key={i} className="h-12 w-full rounded-lg bg-gray-200 dark:bg-white/10" />
    ))}
  </div>
);
