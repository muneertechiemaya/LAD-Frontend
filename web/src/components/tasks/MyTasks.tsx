'use client';

/**
 * My Tasks — everything where a person on the team needs to act:
 *   1. WhatsApp chats Mr LAD handed to a person (context "Human"). LinkedIn
 *      conversations have no handoff state, so they appear only via assignment.
 *   2. Conversations assigned to me.
 *   3. My assignment notifications.
 *
 * Each source is its own query, so one failing service degrades only its own
 * section; a section is "failed" when it has no data after loading
 * (data === undefined), never shown as empty.
 */

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { ArrowRight, Bell, CheckCircle2, Hand, Loader2, RefreshCw, UserCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  taskKeys,
  useAssignedConversations,
  useMarkTaskNotificationRead,
  useTaskNotifications,
  useWaitingChats,
  type TaskChannel,
  type WaitingChat,
} from '@lad/frontend-features/tasks';
import { ChannelIcon } from '@/components/conversations/ChannelIcon';
import { cn } from '@/lib/utils';

const CHANNEL_ICON: Record<TaskChannel, string> = {
  waba: 'business_whatsapp',
  personal: 'personal_whatsapp',
  linkedin: 'linkedin',
};
const CHANNEL_NAME: Record<TaskChannel, string> = {
  waba: 'WhatsApp Business',
  personal: 'Personal WhatsApp',
  linkedin: 'LinkedIn',
};

const chatHref = (channel: TaskChannel | null, conversationId: string) =>
  `/conversations?channel=${channel ?? 'waba'}&conversation=${encodeURIComponent(conversationId)}`;

function ago(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : formatDistanceToNow(d, { addSuffix: true });
}

function Section({
  icon: Icon,
  title,
  count,
  hint,
  children,
}: {
  icon: typeof Hand;
  title: string;
  count?: number;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white dark:border-blue-950/40 dark:bg-[#071131]">
      <header className="flex items-start gap-3 border-b border-slate-100 px-4 py-3 dark:border-blue-950/40">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/[0.08] text-primary dark:bg-white/10 dark:text-white">
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
            {count !== undefined && count > 0 && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-white dark:bg-blue-500">{count}</span>
            )}
          </span>
          <span className="mt-0.5 block text-sm text-slate-600 dark:text-slate-300">{hint}</span>
        </span>
      </header>
      {children}
    </section>
  );
}

function Row({
  href,
  onOpen,
  channel,
  title,
  sub,
  meta,
  unread,
}: {
  href: string;
  onOpen?: () => void;
  channel: TaskChannel | null;
  title: string;
  sub?: string | null;
  meta?: string | null;
  unread?: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={onOpen}
        className={cn(
          'flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-white/5',
          unread && 'bg-primary/[0.04] dark:bg-white/[0.03]',
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-white/10" aria-hidden="true">
          {channel ? <ChannelIcon channel={CHANNEL_ICON[channel] as any} size={18} /> : <Bell className="h-[18px] w-[18px] text-slate-600 dark:text-slate-300" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={cn('truncate text-sm text-slate-900 dark:text-white', unread ? 'font-semibold' : 'font-medium')}>{title}</span>
            {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="unread" />}
          </span>
          {sub && <span className="mt-0.5 block truncate text-sm text-slate-600 dark:text-slate-300">{sub}</span>}
          {meta && <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-400">{meta}</span>}
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      </Link>
    </li>
  );
}

const Loading = () => (
  <p className="flex items-center gap-2 px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading…
  </p>
);
const Failed = ({ what }: { what: string }) => (
  <p role="alert" className="px-4 py-3 text-sm text-red-700 dark:text-red-400">Couldn&apos;t load {what}. Use refresh to try again.</p>
);
const Empty = ({ text }: { text: string }) => (
  <p className="flex items-center gap-2 px-4 py-4 text-sm text-slate-600 dark:text-slate-300">
    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" /> {text}
  </p>
);

export function MyTasks() {
  const qc = useQueryClient();
  const waba = useWaitingChats('waba');
  const personal = useWaitingChats('personal');
  const assigned = useAssignedConversations();
  const notes = useTaskNotifications();
  const markRead = useMarkTaskNotificationRead();

  const waitingQueries = [
    { channel: 'waba' as const, q: waba },
    { channel: 'personal' as const, q: personal },
  ];
  const waitingLoading = waitingQueries.some((w) => w.q.isLoading);
  const waitingFailed = waitingQueries.filter((w) => !w.q.isLoading && !w.q.isFetching && w.q.data === undefined);
  const waiting: WaitingChat[] = waitingQueries
    .flatMap((w) => w.q.data ?? [])
    .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));

  const assignedFailed = !assigned.isLoading && !assigned.isFetching && assigned.data === undefined;
  const notesFailed = !notes.isLoading && !notes.isFetching && notes.data === undefined;
  const unread = (notes.data ?? []).filter((n) => !n.isRead).length;
  const notifications = [...(notes.data ?? [])].sort((a, b) => Number(a.isRead) - Number(b.isRead));

  const refreshing = waitingQueries.some((w) => w.q.isFetching) || assigned.isFetching || notes.isFetching;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Tasks</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">What needs a person today.</p>
        </div>
        <button
          type="button"
          onClick={() => qc.invalidateQueries({ queryKey: taskKeys.all })}
          disabled={refreshing}
          aria-label="Refresh tasks"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-blue-950/40 dark:text-slate-200 dark:hover:bg-white/5"
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} aria-hidden="true" />
        </button>
      </div>

      <Section icon={Hand} title="Waiting for a person" count={waiting.length} hint="WhatsApp chats Mr LAD handed over — someone needs to reply.">
        {waitingLoading && waiting.length === 0 ? (
          <Loading />
        ) : (
          <>
            {waiting.length > 0 ? (
              <ul className="divide-y divide-slate-100 dark:divide-blue-950/40">
                {waiting.map((c) => (
                  <Row
                    key={`${c.channel}:${c.conversationId}`}
                    href={chatHref(c.channel, c.conversationId)}
                    channel={c.channel}
                    title={c.contactName}
                    sub={c.preview}
                    meta={[CHANNEL_NAME[c.channel], ago(c.at)].filter(Boolean).join(' · ')}
                  />
                ))}
              </ul>
            ) : waitingFailed.length < waitingQueries.length ? (
              <Empty text="No chats are waiting for a person." />
            ) : null}
            {waitingFailed.length > 0 && (
              <Failed what={waitingFailed.map((w) => CHANNEL_NAME[w.channel]).join(', ')} />
            )}
          </>
        )}
      </Section>

      <Section icon={UserCheck} title="Assigned to you" count={assigned.data?.length} hint="Conversations your team assigned to you.">
        {assigned.isLoading ? (
          <Loading />
        ) : assignedFailed ? (
          <Failed what="your assignments" />
        ) : assigned.data!.length === 0 ? (
          <Empty text="Nothing is assigned to you." />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-blue-950/40">
            {assigned.data!.map((a) => (
              <Row
                key={a.assignmentId}
                href={chatHref(a.channel, a.conversationId)}
                channel={a.channel}
                title={a.contactName || a.contactPhone || 'Conversation'}
                sub={a.contactName && a.contactPhone ? a.contactPhone : null}
                meta={[
                  a.messageCount != null ? `${a.messageCount} message${a.messageCount === 1 ? '' : 's'}` : null,
                  a.assignedAt ? `assigned ${ago(a.assignedAt)}` : null,
                ].filter(Boolean).join(' · ')}
              />
            ))}
          </ul>
        )}
      </Section>

      <Section icon={Bell} title="Notifications" count={unread} hint="Messages delivered to you when a chat was assigned.">
        {notes.isLoading ? (
          <Loading />
        ) : notesFailed ? (
          <Failed what="your notifications" />
        ) : notifications.length === 0 ? (
          <Empty text="No notifications." />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-blue-950/40">
            {notifications.map((n) => (
              <Row
                key={n.id}
                href={chatHref(null, n.conversationId)}
                onOpen={() => {
                  if (!n.isRead) markRead.mutate(n.id);
                }}
                channel={null}
                title={n.contactName}
                sub={n.preview}
                meta={ago(n.receivedAt)}
                unread={!n.isRead}
              />
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

export default MyTasks;
