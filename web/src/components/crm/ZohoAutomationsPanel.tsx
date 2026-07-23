'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Loader2, Sparkles, Check, X, Linkedin, Mail, MessageCircle, AlertCircle,
  CheckCircle2, Ban, ChevronDown, ChevronRight, Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { fetchWithTenant } from '@/lib/fetch-with-tenant';

type SortKey = 'recent' | 'contact' | 'channel' | 'subject';
const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent', label: 'Newest first' },
  { value: 'contact', label: 'Contact A–Z' },
  { value: 'subject', label: 'Task A–Z' },
  { value: 'channel', label: 'Channel' },
];

const ZOHO_API = '/api/social-integration/zoho';

interface Automation {
  id: string;
  task_source_id: string;
  subject?: string | null;
  contact_name?: string | null;
  channel?: string | null;
  action?: string | null;
  target?: { linkedin_url?: string; phone?: string; email?: string; name?: string } | null;
  message?: string | null;
  confidence?: number | null;
  reason?: string | null;
  status: string;
  error?: string | null;
  executed_at?: string | null;
}

const channelIcon = (ch?: string | null) => {
  if (ch === 'linkedin') return <Linkedin className="h-4 w-4 text-blue-700" />;
  if (ch === 'whatsapp') return <MessageCircle className="h-4 w-4 text-green-600" />;
  if (ch === 'email') return <Mail className="h-4 w-4 text-slate-600" />;
  return <Sparkles className="h-4 w-4 text-muted-foreground" />;
};

const targetLabel = (a: Automation) =>
  a.target?.email || a.target?.phone || a.target?.linkedin_url || a.contact_name || '';

export const ZohoAutomationsPanel: React.FC = () => {
  const [items, setItems] = useState<Automation[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [queryScanning, setQueryScanning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('recent');

  const load = useCallback(async () => {
    try {
      const res = await fetchWithTenant(`${ZOHO_API}/automations`);
      const data = await res.json();
      if (res.ok && data?.success) {
        setItems(data.data || []);
        setEnabled(data.automation_enabled !== false);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleScan = async () => {
    setScanning(true); setBanner(null);
    try {
      const res = await fetchWithTenant(`${ZOHO_API}/automations/scan`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data?.success) {
        const s = data.data || {};
        const li = s.resolved_linkedin ? ` (${s.resolved_linkedin} LinkedIn profiles resolved)` : '';
        setBanner({ kind: 'ok', text: `Scanned ${s.scanned || 0} tasks — ${s.proposed || 0} proposed, ${s.skipped || 0} skipped${li}.` });
        load();
      } else {
        setBanner({ kind: 'err', text: data?.error || 'Scan failed' });
      }
    } catch { setBanner({ kind: 'err', text: 'Scan failed' }); }
    finally { setScanning(false); }
  };

  const handleQueryScan = async () => {
    const query = search.trim();
    if (!query) return;
    setQueryScanning(true); setBanner(null);
    try {
      const res = await fetchWithTenant(`${ZOHO_API}/automations/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        const s = data.data || {};
        const li = s.resolved_linkedin ? `, ${s.resolved_linkedin} LinkedIn resolved` : '';
        setBanner({ kind: 'ok', text: `Searched Zoho for "${query}" — ${s.scanned || 0} matching tasks, ${s.proposed || 0} actionable, ${s.skipped || 0} skipped${li} (see History).` });
        setShowHistory(true);
        load();
      } else {
        setBanner({ kind: 'err', text: data?.error || 'Search scan failed' });
      }
    } catch { setBanner({ kind: 'err', text: 'Search scan failed' }); }
    finally { setQueryScanning(false); }
  };

  const saveDraftIfChanged = async (a: Automation) => {
    const draft = drafts[a.id];
    if (draft != null && draft !== (a.message || '')) {
      await fetchWithTenant(`${ZOHO_API}/automations/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: draft }),
      });
    }
  };

  const handleApprove = async (a: Automation) => {
    setBusyId(a.id); setBanner(null);
    try {
      await saveDraftIfChanged(a);
      const res = await fetchWithTenant(`${ZOHO_API}/automations/${a.id}/approve`, { method: 'POST' });
      const data = await res.json();
      const st = data?.data?.status;
      if (res.ok && st === 'completed') {
        setBanner({ kind: 'ok', text: `Sent to ${a.contact_name || 'contact'} via ${a.channel} and marked the Zoho task complete.` });
      } else if (data?.data?.escalated) {
        setBanner({ kind: 'err', text: `Held by the safety supervisor: ${data?.data?.reason || 'needs review'}.` });
      } else {
        setBanner({ kind: 'err', text: data?.error || data?.data?.error || 'Could not run this automation.' });
      }
      load();
    } catch { setBanner({ kind: 'err', text: 'Could not run this automation.' }); }
    finally { setBusyId(null); }
  };

  const handleReject = async (a: Automation) => {
    setBusyId(a.id);
    try {
      await fetchWithTenant(`${ZOHO_API}/automations/${a.id}/reject`, { method: 'POST' });
      load();
    } catch { /* ignore */ } finally { setBusyId(null); }
  };

  const proposals = items.filter((a) => a.status === 'proposed' || a.status === 'failed');
  const history = items.filter((a) => ['completed', 'rejected', 'skipped'].includes(a.status));

  const matchesSearch = (a: Automation, q: string) =>
    [a.subject, a.contact_name, a.message, a.channel, a.action, a.reason, targetLabel(a)]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));

  const visibleProposals = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = q ? proposals.filter((a) => matchesSearch(a, q)) : proposals;
    const sorted = [...list];
    if (sortBy === 'contact') sorted.sort((a, b) => (a.contact_name || '').localeCompare(b.contact_name || ''));
    else if (sortBy === 'subject') sorted.sort((a, b) => (a.subject || '').localeCompare(b.subject || ''));
    else if (sortBy === 'channel') sorted.sort((a, b) => (a.channel || '').localeCompare(b.channel || ''));
    // 'recent' keeps backend order (proposed-first, created_at desc)
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposals, search, sortBy]);

  const visibleHistory = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? history.filter((a) => matchesSearch(a, q)) : history;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, search]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <div className="text-sm font-semibold text-foreground">Task Automations</div>
            <p className="text-xs text-muted-foreground">
              Turn open Zoho tasks into LinkedIn / WhatsApp / Email actions — you approve each before it sends.
            </p>
          </div>
        </div>
        <Button onClick={handleScan} disabled={scanning}>
          {scanning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {scanning ? 'Scanning…' : 'Scan open tasks'}
        </Button>
      </div>

      {!enabled && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          Automation execution is currently disabled. Proposals will still appear, but approving is blocked until an admin sets <code className="mx-1">ZOHO_TASK_AUTOMATION_ENABLED=true</code>.
        </div>
      )}
      {banner && (
        <div className={`flex items-start gap-2 rounded-lg p-3 text-sm border ${
          banner.kind === 'ok' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {banner.kind === 'ok' ? <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />}
          {banner.text}
        </div>
      )}

      {!loading && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search a task or contact (e.g. Eric)…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleQueryScan(); }}
              />
            </div>
            <Button variant="outline" size="sm" disabled={queryScanning || !search.trim()} onClick={handleQueryScan} title="Search all open Zoho tasks and interpret matches">
              {queryScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="hidden sm:inline ml-1.5">Search Zoho</span>
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Sort</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            >
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
        </div>
      ) : proposals.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          No pending automations. Click “Scan open tasks” to interpret your open Zoho tasks into proposed actions.
        </div>
      ) : visibleProposals.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm space-y-3">
          <div>No pending proposals match “{search}”.</div>
          {search.trim() && (
            <Button variant="outline" size="sm" disabled={queryScanning} onClick={handleQueryScan}>
              {queryScanning ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Search className="h-4 w-4 mr-1.5" />}
              Search all Zoho tasks for “{search.trim()}”
            </Button>
          )}
          {search.trim() && visibleHistory.length > 0 && (
            <div className="text-xs">{visibleHistory.length} matching item(s) in History below — likely skipped (e.g. no LinkedIn URL, or unsupported channel).</div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleProposals.map((a) => (
            <div key={a.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  {channelIcon(a.channel)}
                  <span className="text-sm font-medium text-foreground truncate">{a.subject || 'Task'}</span>
                  {a.action && <Badge variant="secondary" className="capitalize">{a.action.replace(/_/g, ' ')}</Badge>}
                  {a.status === 'failed' && <Badge variant="secondary" className="bg-red-100 text-red-700">retry</Badge>}
                </div>
                <span className="text-xs text-muted-foreground truncate">{a.contact_name} · {targetLabel(a)}</span>
              </div>

              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[72px]"
                value={drafts[a.id] ?? a.message ?? ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [a.id]: e.target.value }))}
              />

              {a.error && <p className="text-xs text-red-600">{a.error}</p>}

              <div className="flex items-center gap-2">
                <Button size="sm" disabled={busyId === a.id || !enabled} onClick={() => handleApprove(a)}>
                  {busyId === a.id ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Check className="h-4 w-4 mr-1.5" />}
                  Approve & send
                </Button>
                <Button size="sm" variant="ghost" disabled={busyId === a.id} onClick={() => handleReject(a)}>
                  <X className="h-4 w-4 mr-1.5" /> Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div className="pt-2 border-t border-border">
          <button onClick={() => setShowHistory((v) => !v)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            {showHistory ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            History ({search.trim() ? `${visibleHistory.length} of ${history.length}` : history.length})
          </button>
          {showHistory && (
            <div className="mt-2 space-y-1">
              {visibleHistory.length === 0 && (
                <div className="text-xs text-muted-foreground py-1">No history matches “{search}”.</div>
              )}
              {visibleHistory.slice(0, 50).map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 text-xs py-1">
                  <span className="flex items-center gap-1.5 min-w-0">
                    {a.status === 'completed' ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      : a.status === 'rejected' ? <X className="h-3.5 w-3.5 text-muted-foreground" />
                      : <Ban className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className="text-foreground truncate">{a.subject || 'Task'}</span>
                    <span className="text-muted-foreground truncate">— {a.contact_name || ''}</span>
                  </span>
                  <span className="text-muted-foreground capitalize flex-shrink-0">
                    {a.status === 'skipped' ? (a.reason || 'skipped') : a.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ZohoAutomationsPanel;
