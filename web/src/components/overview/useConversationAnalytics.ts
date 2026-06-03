'use client';

/**
 * useConversationAnalytics — shared client hook for the tenant Overview's
 * conversation analytics (funnel + daily-volume spike + unconverted-topic
 * segments), served by LAD-Master-Agent via /api/analytics/overview.
 *
 * Two widgets (ConversationFunnel + ReengageTopics) read the SAME payload, so
 * this dedupes them onto ONE in-flight request and one cache entry per window,
 * with a tiny pub/sub so a refresh in one widget updates the other.
 */
import { useCallback, useEffect, useState } from 'react';

import { fetchWithTenant } from '@/lib/fetch-with-tenant';

export interface FunnelStep {
  key: string;
  label: string;
  count: number;
  pct_of_prev: number;
}
export interface Funnel {
  steps: FunnelStep[];
  conversion_rate: number;
  cancelled: number;
  escalated_to_human: number;
  total: number;
  converted: number;
}
export interface VolumePoint {
  day: string;
  count: number;
}
export interface VolumeSpike {
  latest: number;
  latest_day?: string;
  trailing_avg: number;
  pct_change: number;
  is_spike: boolean;
}
export interface TopicContact {
  conversation_id: string;
  wa_contact_id: string | null;
  contact_name: string | null;
  phone: string | null;
}
export interface TopicSegment {
  topic: string;
  count: number;
  contacts: TopicContact[];
}
export interface OverviewAnalytics {
  tenant_id: string;
  window_days: number;
  funnel: Funnel;
  daily_volume: VolumePoint[];
  volume_spike: VolumeSpike;
  unconverted_topics: TopicSegment[];
  unconverted_total: number;
}

interface State {
  data: OverviewAnalytics | null;
  loading: boolean;
  error: string | null;
}

interface Entry {
  state: State;
  listeners: Set<(s: State) => void>;
  promise: Promise<void> | null;
}

const entries = new Map<number, Entry>();

function getEntry(windowDays: number): Entry {
  let e = entries.get(windowDays);
  if (!e) {
    e = { state: { data: null, loading: false, error: null }, listeners: new Set(), promise: null };
    entries.set(windowDays, e);
  }
  return e;
}

function setState(e: Entry, next: State) {
  e.state = next;
  e.listeners.forEach((l) => l(next));
}

function load(windowDays: number, force: boolean): Promise<void> {
  const e = getEntry(windowDays);
  if (e.promise && !force) return e.promise;
  if (e.state.data && !force) return Promise.resolve();

  setState(e, { ...e.state, loading: true, error: null });

  const p = fetchWithTenant(`/api/analytics/overview?window_days=${windowDays}`, {
    method: 'GET',
    cache: 'no-store',
  })
    .then(async (r) => {
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(body?.detail || body?.error || `Request failed (${r.status})`);
      }
      return body as OverviewAnalytics;
    })
    .then((data) => {
      setState(e, { data, loading: false, error: null });
    })
    .catch((err: unknown) => {
      setState(e, {
        data: e.state.data,
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    })
    .finally(() => {
      e.promise = null;
    });

  e.promise = p;
  return p;
}

export function useConversationAnalytics(windowDays = 30) {
  const [state, setLocal] = useState<State>(() => getEntry(windowDays).state);

  useEffect(() => {
    const e = getEntry(windowDays);
    setLocal(e.state);
    const listener = (s: State) => setLocal(s);
    e.listeners.add(listener);
    void load(windowDays, false);
    return () => {
      e.listeners.delete(listener);
    };
  }, [windowDays]);

  const refresh = useCallback(() => load(windowDays, true), [windowDays]);

  return { ...state, refresh };
}
