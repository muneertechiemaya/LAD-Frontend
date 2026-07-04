'use client';

/**
 * useConnectedChannels — which conversation channels does this tenant have
 * integrated right now?
 *
 * Used by Chat Settings to show settings only for connected channels (hidden
 * channels reappear automatically when the tenant reconnects, because
 * visibility is derived from live status on every mount — nothing is deleted).
 *
 * Probes mirror IntegrationsSettings.refreshStatuses, but with one deliberate
 * difference: FAIL-OPEN semantics. There, a probe error just shows a "Connect"
 * card (harmless); here it would HIDE a tenant's settings (harmful). So only a
 * successful response that positively shows no active account yields
 * 'disconnected' — network errors, 4xx/5xx, and in-flight probes all stay
 * 'unknown', and callers treat 'unknown' as visible.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchWithTenant } from '@/lib/fetch-with-tenant';

export type ChannelId = 'waba' | 'personal_whatsapp' | 'linkedin' | 'gmail' | 'instagram';
export type ChannelStatus = 'connected' | 'disconnected' | 'unknown';

const INITIAL: Record<ChannelId, ChannelStatus> = {
  waba: 'unknown',
  personal_whatsapp: 'unknown',
  linkedin: 'unknown',
  gmail: 'unknown',
  instagram: 'unknown',
};

/** Shared helper: fetch JSON, or null on any failure (fail-open). */
async function tryJson(path: string, init?: RequestInit): Promise<any | null> {
  try {
    const res = await fetchWithTenant(path, init);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function probePersonalWhatsapp(): Promise<ChannelStatus> {
  const data = await tryJson('/api/personal-whatsapp/accounts');
  if (!data) return 'unknown';
  const accounts = Array.isArray(data?.accounts) ? data.accounts : [];
  return accounts.some((a: any) => a.status === 'connected') ? 'connected' : 'disconnected';
}

async function probeWaba(): Promise<ChannelStatus> {
  const data = await tryJson('/api/whatsapp-conversations/admin/whatsapp-accounts');
  if (!data) return 'unknown';
  const accounts = Array.isArray(data) ? data : (Array.isArray(data?.accounts) ? data.accounts : []);
  return accounts.some((a: any) => a.status === 'active' || a.status === 'connected')
    ? 'connected'
    : 'disconnected';
}

async function probeLinkedin(): Promise<ChannelStatus> {
  const data = await tryJson('/api/campaigns/linkedin/accounts');
  if (!data) return 'unknown';
  const accounts = Array.isArray(data) ? data : (Array.isArray(data?.accounts) ? data.accounts : []);
  return accounts.some((a: any) => a.status === 'connected' || a.status === 'active')
    ? 'connected'
    : 'disconnected';
}

/**
 * The "Gmail" prompts channel drives email-agent replies for whichever email
 * provider is connected, so it counts as connected when EITHER Google or
 * Microsoft is. Fail-open: if one probe fails and the other says disconnected,
 * we can't be sure → 'unknown'.
 */
async function probeEmail(): Promise<ChannelStatus> {
  const [google, microsoft] = await Promise.all([
    tryJson('/api/social-integration/email/google/status', { method: 'POST' }),
    tryJson('/api/social-integration/email/microsoft/status', { method: 'POST' }),
  ]);
  if (google?.connected || microsoft?.connected) return 'connected';
  if (google && microsoft) return 'disconnected';
  return 'unknown';
}

async function probeInstagram(): Promise<ChannelStatus> {
  const data = await tryJson('/api/instagram-conversations/accounts');
  if (!data) return 'unknown';
  const accounts = Array.isArray(data?.accounts) ? data.accounts : [];
  const connected = accounts.some(
    (a: any) => (a.status ?? 'active') !== 'inactive' && !a.is_deleted,
  );
  return connected ? 'connected' : 'disconnected';
}

export function useConnectedChannels() {
  const [statuses, setStatuses] = useState<Record<ChannelId, ChannelStatus>>(INITIAL);
  const [loaded, setLoaded] = useState(false);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const [waba, personal, linkedin, gmail, instagram] = await Promise.all([
        probeWaba(),
        probePersonalWhatsapp(),
        probeLinkedin(),
        probeEmail(),
        probeInstagram(),
      ]);
      setStatuses({
        waba,
        personal_whatsapp: personal,
        linkedin,
        gmail,
        instagram,
      });
      setLoaded(true);
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Visible unless positively disconnected — loading/unknown stay visible. */
  const isVisible = useCallback(
    (id: ChannelId) => statuses[id] !== 'disconnected',
    [statuses],
  );

  return { statuses, loaded, refresh, isVisible };
}
