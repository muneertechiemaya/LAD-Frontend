'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2, Download, Search, ChevronLeft, ChevronRight, Mail, Phone, Building2,
  Users, Briefcase, Contact, CheckSquare, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { fetchWithTenant } from '@/lib/fetch-with-tenant';

const ZOHO_API = '/api/social-integration/zoho';

type RecordType = 'contacts' | 'leads' | 'deals' | 'tasks';

interface ZohoStatus {
  connected: boolean;
  last_synced?: string;
  counts?: { contacts?: number; leads?: number; deals?: number; tasks?: number } | null;
  syncing?: boolean;
  sync_error?: string | Record<string, string> | null;
}

interface CRMRecord {
  id: string;
  source_id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company_name?: string | null;
  title?: string | null;
  tags?: string[];
  synced_at?: string;
  deal_name?: string | null;
  stage?: string | null;
  amount?: number | null;
  account_name?: string | null;
  contact_name?: string | null;
  subject?: string | null;
  priority?: string | null;
  due_date?: string | null;
  related_to?: string | null;
  status?: string | null;
}

const PAGE_SIZE = 50;

export const ZohoRecordsBrowser: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<ZohoStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const [recordType, setRecordType] = useState<RecordType>('contacts');
  const [records, setRecords] = useState<CRMRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [recordsLoading, setRecordsLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRef = useRef(false);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetchWithTenant(`${ZOHO_API}/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data?.data || null);
        return data?.data as ZohoStatus | null;
      }
    } catch { /* ignore */ }
    setStatus(null);
    return null;
  }, []);

  useEffect(() => {
    (async () => { await checkStatus(); setLoading(false); })();
  }, [checkStatus]);

  const loadRecords = useCallback(async (type: RecordType, p: number, q: string) => {
    setRecordsLoading(true);
    try {
      const params = new URLSearchParams({ type, page: String(p), limit: String(PAGE_SIZE) });
      if (q) params.set('search', q);
      const res = await fetchWithTenant(`${ZOHO_API}/records/local?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data?.success) {
        setRecords(data.data || []);
        setTotal(data.total || 0);
        setPage(p);
      } else {
        setRecords([]); setTotal(0);
      }
    } catch {
      setRecords([]); setTotal(0);
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status?.connected) loadRecords(recordType, 1, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.connected, recordType]);

  const formatSyncError = (e: unknown): string => {
    if (!e) return '';
    if (typeof e === 'string') return e;
    if (typeof e === 'object') return Object.entries(e as Record<string, string>).map(([k, v]) => `${k} (${v})`).join('; ');
    return String(e);
  };

  const pollSyncStatus = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    let tries = 0;
    const tick = async () => {
      tries += 1;
      try {
        const res = await fetchWithTenant(`${ZOHO_API}/status`);
        const data = await res.json();
        const d = data?.data;
        if (d && !d.syncing) {
          pollingRef.current = false;
          setSyncing(false);
          setStatus(d);
          if (d.sync_error) setError(`Some modules failed to sync: ${formatSyncError(d.sync_error)}`);
          else {
            const c = d.counts || {};
            setSuccess(`Synced ${c.contacts || 0} contacts, ${c.leads || 0} leads, ${c.deals || 0} deals, ${c.tasks || 0} tasks.`);
          }
          loadRecords(recordType, 1, search);
          return;
        }
      } catch { /* transient */ }
      if (tries < 120) setTimeout(tick, 3000);
      else { pollingRef.current = false; setSyncing(false); setError('Sync is taking longer than expected — refresh shortly.'); }
    };
    setTimeout(tick, 3000);
  }, [loadRecords, recordType, search]);

  // Resume tracking if a sync is already running when the page opens.
  useEffect(() => {
    if (status?.syncing && !pollingRef.current) { setSyncing(true); pollSyncStatus(); }
  }, [status?.syncing, pollSyncStatus]);

  const handleSync = async () => {
    setSyncing(true); setError(null); setSuccess(null);
    try {
      const res = await fetchWithTenant(`${ZOHO_API}/sync`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data?.success) {
        setSuccess('Sync started — pulling from Zoho. This can take a minute for large accounts…');
        pollSyncStatus();
      } else { setSyncing(false); setError(data?.error || 'Sync failed'); }
    } catch { setSyncing(false); setError('Sync failed'); }
  };

  const onSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => loadRecords(recordType, 1, value), 350);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading Zoho CRM…
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center space-y-2">
        <div className="text-sm font-medium text-foreground">Zoho CRM isn’t connected</div>
        <p className="text-sm text-muted-foreground">
          Connect Zoho in <a href="/settings?tab=integrations" className="underline">Settings → Integrations</a> to sync and browse your Contacts, Leads, Deals, and Tasks here.
        </p>
      </div>
    );
  }

  const c = status.counts || {};

  return (
    <div className="space-y-4">
      {/* Header: counts + sync */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="grid grid-cols-4 gap-3 flex-1 min-w-[280px]">
            {(['contacts', 'leads', 'deals', 'tasks'] as const).map((k) => (
              <div key={k} className="rounded-lg border border-border p-2.5 text-center">
                <div className="text-xl font-semibold text-foreground">{c[k] ?? '—'}</div>
                <div className="text-xs text-muted-foreground capitalize">{k}</div>
              </div>
            ))}
          </div>
          <Button onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
            {syncing ? 'Syncing…' : 'Sync from Zoho'}
          </Button>
        </div>
        {status.last_synced && (
          <p className="text-xs text-muted-foreground">Last synced {new Date(status.last_synced).toLocaleString()}</p>
        )}
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" /> {success}
          </div>
        )}
      </div>

      {/* Records browser */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div className="flex gap-1">
            {(['contacts', 'leads', 'deals', 'tasks'] as RecordType[]).map((t) => (
              <button
                key={t}
                onClick={() => { setRecordType(t); setSearch(''); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium capitalize flex items-center gap-1.5 transition-colors ${
                  recordType === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {t === 'contacts' && <Contact className="h-3.5 w-3.5" />}
                {t === 'leads' && <Users className="h-3.5 w-3.5" />}
                {t === 'deals' && <Briefcase className="h-3.5 w-3.5" />}
                {t === 'tasks' && <CheckSquare className="h-3.5 w-3.5" />}
                {t}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder={`Search ${recordType}…`} value={search} onChange={(e) => onSearchChange(e.target.value)} />
          </div>
        </div>

        {recordsLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            No {recordType} synced yet. Click “Sync from Zoho” to pull them in.
          </div>
        ) : (
          <ScrollArea className="max-h-[560px]">
            <div className="divide-y divide-border">
              {records.map((r) => (
                <div key={r.id} className="py-2.5 flex items-center justify-between gap-3">
                  {recordType === 'deals' ? (
                    <>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{r.deal_name || 'Untitled deal'}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {[r.account_name, r.contact_name].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {r.stage && <Badge variant="secondary">{r.stage}</Badge>}
                        {r.amount != null && <div className="text-sm font-medium text-foreground mt-1">{r.amount.toLocaleString()}</div>}
                      </div>
                    </>
                  ) : recordType === 'tasks' ? (
                    <>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{r.subject || 'Untitled task'}</div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                          {r.related_to && <span className="truncate">{r.related_to}</span>}
                          {r.due_date && <span>Due {new Date(r.due_date).toLocaleDateString()}</span>}
                          {r.priority && <span>{r.priority} priority</span>}
                        </div>
                      </div>
                      {r.status && <Badge variant="secondary" className="flex-shrink-0">{r.status}</Badge>}
                    </>
                  ) : (
                    <>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{r.name || '—'}</div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                          {r.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{r.email}</span>}
                          {r.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{r.phone}</span>}
                          {r.company_name && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{r.company_name}</span>}
                        </div>
                      </div>
                      {r.title && <span className="text-xs text-muted-foreground flex-shrink-0">{r.title}</span>}
                    </>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-3 mt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages} · {total.toLocaleString()} {recordType}</span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => loadRecords(recordType, page - 1, search)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => loadRecords(recordType, page + 1, search)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ZohoRecordsBrowser;
