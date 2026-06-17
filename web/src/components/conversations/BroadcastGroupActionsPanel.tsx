'use client';

import { useEffect, useState, useCallback } from 'react';
import { Megaphone, Plus, Loader2, Check } from 'lucide-react';
import { fetchWithTenant } from '@/lib/fetch-with-tenant';

interface BroadcastList {
  id: string;
  name: string;
  member_group_ids: string[];
}

interface BroadcastGroupActionsPanelProps {
  groupIds: string[];
  channel: 'personal' | 'waba';
}

/**
 * Right-pane panel shown while groups are multi-selected in the Broadcast Groups
 * panel: create a new broadcast group from the selection, or add it to an existing
 * one. (Compose/schedule a message to the selection from the left panel instead.)
 */
export function BroadcastGroupActionsPanel({ groupIds, channel }: BroadcastGroupActionsPanelProps) {
  const [lists, setLists] = useState<BroadcastList[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const loadLists = useCallback(() => {
    setLoading(true);
    fetchWithTenant(`/api/whatsapp-conversations/chat-groups?channel=${channel}`)
      .then((r) => r.json())
      .then((data) => {
        const rows: any[] = Array.isArray(data?.data) ? data.data : [];
        setLists(
          rows
            .filter((g: any) => (g.metadata as any)?.is_broadcast_list)
            .map((g: any) => ({
              id: String(g.id),
              name: g.name,
              member_group_ids: Array.isArray((g.metadata as any)?.member_group_ids)
                ? (g.metadata as any).member_group_ids.map(String)
                : [],
            })),
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [channel]);

  useEffect(() => { loadLists(); }, [loadLists]);

  const createNew = useCallback(async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true); setNote(null);
    try {
      const res = await fetchWithTenant(`/api/whatsapp-conversations/chat-groups/broadcast-lists?channel=${channel}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, group_ids: groupIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setNote({ ok: true, text: `Created "${name}" with ${groupIds.length} group${groupIds.length === 1 ? '' : 's'}.` });
      setNewName('');
      loadLists();
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : 'Failed to create' });
    } finally {
      setBusy(false);
    }
  }, [newName, busy, channel, groupIds, loadLists]);

  const addToExisting = useCallback(async (list: BroadcastList) => {
    if (busy) return;
    setBusy(true); setNote(null);
    try {
      const res = await fetchWithTenant(`/api/whatsapp-conversations/chat-groups/broadcast-lists?channel=${channel}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ list_id: list.id, group_ids: groupIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      // Update the count from the backend's returned group (authoritative) rather
      // than a re-fetch that can race or be cached — this is what showed "same count".
      const updatedIds = Array.isArray(data?.group?.metadata?.member_group_ids)
        ? data.group.metadata.member_group_ids.map(String)
        : [...new Set([...list.member_group_ids, ...groupIds.map(String)])];
      setLists((prev) => prev.map((l) => (l.id === list.id ? { ...l, member_group_ids: updatedIds } : l)));
      setNote({ ok: true, text: `Added to "${list.name}" — now ${updatedIds.length} group${updatedIds.length === 1 ? '' : 's'}.` });
      loadLists();
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : 'Failed to add' });
    } finally {
      setBusy(false);
    }
  }, [busy, channel, groupIds, loadLists]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-muted/20">
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-emerald-600" />
          <h2 className="text-base font-semibold">
            {groupIds.length} group{groupIds.length === 1 ? '' : 's'} selected
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Organize the selected groups into a broadcast group — or compose a message on the left to broadcast to them.
        </p>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Create new broadcast group</label>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') createNew(); }}
              placeholder="Broadcast group name"
              className="flex-1 text-sm rounded-md border border-border bg-background px-3 py-2"
            />
            <button
              type="button"
              onClick={createNew}
              disabled={busy || !newName.trim()}
              className="flex items-center gap-1 text-sm px-3 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white font-medium disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Create
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add to existing broadcast group</label>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : lists.length === 0 ? (
            <p className="text-sm text-muted-foreground">No broadcast groups yet — create one above.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {lists.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => addToExisting(list)}
                  disabled={busy}
                  className="w-full flex items-center justify-between text-sm px-3 py-2 rounded-md border border-border hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <span className="truncate">{list.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{list.member_group_ids.length} groups</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {note && (
          <p className={`text-sm flex items-center gap-1 ${note.ok ? 'text-emerald-600' : 'text-red-500'}`}>
            {note.ok && <Check className="h-4 w-4" />} {note.text}
          </p>
        )}
      </div>
    </div>
  );
}
