'use client';
// /crm — Pipeline + Prospect list/board, wired to the Master Agent.
//
// Live data: prospect_state via @lad/frontend-features/prospects. Clicking a row
// navigates to /crm/[id] (full detail page). The dummy data in ./data is no
// longer used for values — only its types + STAGES + the adapter.

import * as React from 'react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp } from 'lucide-react';

import { useProspects, useDeleteProspect } from '@lad/frontend-features/prospects';

import TopBar, { type Crumb } from '@/components/crm/top-bar';
import StatsCards, { type CrmView } from '@/components/crm/stats-cards';
import ViewPills from '@/components/crm/view-pills';
import KanbanBoard from '@/components/crm/kanban-board';
import {
  AllContactsTable, ProspectsTable, LeadsTable, ClientsTable,
} from '@/components/crm/tables';
import { STAGES, type CrmContact } from '@/components/crm/data';
import { toCrmContacts, toKanbanLeads } from '@/components/crm/adapt';

export const dynamic = 'force-dynamic';

const VIEW_TITLES: Record<Exclude<CrmView, 'board'>, string> = {
  all: 'All Contacts',
  prospects: 'Prospects',
  leads: 'Leads',
  clients: 'Clients',
};

const EMPTY_BOX =
  'rounded-[20px] border border-slate-200 dark:border-[#262831] bg-white dark:bg-[#000724] p-10 text-center text-[13px] text-slate-500 dark:text-[#7a8ba3]';

export default function CrmPage() {
  const router = useRouter();
  const [view, setView] = useState<CrmView>('board');

  // ── Live data ──────────────────────────────────────────────────────────────
  const listQuery = useProspects({ limit: 200 });
  const prospects = useMemo(() => listQuery.data ?? [], [listQuery.data]);

  const contacts = useMemo(() => toCrmContacts(prospects), [prospects]);
  const kanbanLeads = useMemo(() => toKanbanLeads(prospects), [prospects]);

  const counts = useMemo(
    () => ({
      all: contacts.length,
      prospects: contacts.filter((c) => c.type === 'prospect').length,
      leads: contacts.filter((c) => c.type === 'lead').length,
      clients: contacts.filter((c) => c.type === 'client').length,
    }),
    [contacts]
  );

  // Open a contact's full detail page.
  const openDetail = (idOrContact: string | CrmContact) => {
    const id = typeof idOrContact === 'string' ? idOrContact : idOrContact.id;
    if (id) router.push(`/crm/${id}`);
  };

  // Soft-delete a prospect ("not a fit"). The list auto-refetches via cache invalidation.
  const removeMutation = useDeleteProspect();
  const handleRemove = (c: CrmContact) => {
    const ok = window.confirm(
      `Remove ${c.name} as “not a fit”? They’ll be hidden from your pipeline (an admin can restore it).`,
    );
    if (ok) removeMutation.mutate({ id: c.id, reason: 'not_a_fit' });
  };

  const crumbs: Crumb[] =
    view === 'board'
      ? [{ label: 'Deals Pipeline' }]
      : [{ label: 'Deals Pipeline', href: '/crm' }, { label: VIEW_TITLES[view] }];

  const handleStatSelect = (key: Exclude<CrmView, 'board'>) => {
    setView((prev) => (prev === key ? 'board' : key));
  };

  const filteredContacts = useMemo(() => {
    if (view === 'prospects') return contacts.filter((c) => c.type === 'prospect');
    if (view === 'leads') return contacts.filter((c) => c.type === 'lead');
    if (view === 'clients') return contacts.filter((c) => c.type === 'client');
    return contacts;
  }, [view, contacts]);

  const renderMain = () => {
    if (view === 'board')
      return (
        <KanbanBoard
          stages={STAGES}
          leads={kanbanLeads}
          selectedLeadId={null}
          onSelectLead={openDetail}
        />
      );
    if (view === 'all') return <AllContactsTable rows={filteredContacts} onSelect={openDetail} onRemove={handleRemove} />;
    if (view === 'prospects') return <ProspectsTable rows={filteredContacts} onSelect={openDetail} onRemove={handleRemove} />;
    if (view === 'leads') return <LeadsTable rows={filteredContacts} onSelect={openDetail} onRemove={handleRemove} />;
    if (view === 'clients') return <ClientsTable rows={filteredContacts} onSelect={openDetail} onRemove={handleRemove} />;
    return null;
  };

  return (
    <div className="min-h-screen bg-[#F8F9FE] dark:bg-[#000724]">
      <TopBar crumbs={crumbs} />
      <main className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6">
        <div className="mb-5">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-7 h-7 text-[#1e293b] dark:text-white" />
            <div>
              <h1
                className="text-2xl sm:text-3xl font-bold text-[#1e293b] dark:text-white"
                style={{ fontFamily: '"Space Grotesk", system-ui' }}
              >
                Deals Pipeline
              </h1>
              <p className="text-[13px] text-[#6b7280] dark:text-[#7a8ba3]">
                Live cross-channel prospects across all your channels
              </p>
            </div>
          </div>
        </div>

        {listQuery.isError && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/30 p-4 text-[13px] text-rose-700 dark:text-rose-300">
            Could not load prospects: {(listQuery.error as Error)?.message ?? 'Unknown error'}
          </div>
        )}

        <StatsCards counts={counts} selected={view} onSelect={handleStatSelect} />
        <ViewPills view={view} onChange={(v) => setView(v)} />

        {listQuery.isLoading ? (
          <div className={EMPTY_BOX}>Loading prospects…</div>
        ) : !listQuery.isError && prospects.length === 0 ? (
          <div className={EMPTY_BOX}>
            No prospects yet. As your channels engage prospects, they&apos;ll appear here.
          </div>
        ) : (
          renderMain()
        )}

        <footer className="pt-6 pb-2 text-[11.5px] text-slate-400 dark:text-[#7a8ba3]/60 flex items-center justify-between">
          <span>
            {counts.all} contacts · {counts.leads} active deals · {counts.clients} clients
          </span>
          <span>Mr LAD · Master Agent</span>
        </footer>
      </main>
    </div>
  );
}
