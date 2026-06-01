'use client';
// The four CRM-grade table views: All Contacts, Prospects, Leads, Clients.
// Each is a CrmTable instance with view-specific columns + filters.

import * as React from 'react';
import { useMemo, useState } from 'react';
import {
  Search, Download, Plus, MoreVertical, ChevronsUpDown, ChevronLeft, ChevronRight,
  ChevronDown, Inbox, Radio, Route, BadgeCheck, Trash2,
} from 'lucide-react';
import {
  CrmAvatar, ChannelChips, LadCard, T, fmtCurrency, fmtDate, rel,
  VerifiedTag,
} from './shared';
import { CRM_OWNERS, NOW, type CrmContact } from './data';

// ── Building blocks ──────────────────────────────────────────────────────
function TypePill({ type }: { type: CrmContact['type'] }) {
  const map: Record<CrmContact['type'], { label: string; color: string; bg: string }> = {
    prospect: { label: 'Prospect', color: '#0B1957', bg: '#e8ebf7' },
    lead:     { label: 'Lead',     color: '#0ea5e9', bg: '#e0f2fe' },
    client:   { label: 'Client',   color: '#16a34a', bg: '#dcfce7' },
    imported: { label: 'Imported', color: '#64748b', bg: '#f1f5f9' },
    inbound:  { label: 'Inbound',  color: '#a16207', bg: '#fef3c7' },
  };
  const m = map[type] ?? map.imported;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ color: m.color, background: m.bg }}
    >
      {m.label}
    </span>
  );
}

function StagePill({ stage }: { stage?: string }) {
  if (!stage) return <span className="text-[11.5px] text-slate-400">—</span>;
  const m = ({
    new:       { label: 'New',         color: '#64748b', bg: '#f1f5f9' },
    contacted: { label: 'Contacted',   color: '#0ea5e9', bg: '#e0f2fe' },
    engaged:   { label: 'Engaged',     color: '#3b82f6', bg: '#dbeafe' },
    qualified: { label: 'Qualified',   color: '#0B1957', bg: '#e8ebf7' },
    sah:       { label: 'Handed off',  color: '#16a34a', bg: '#dcfce7' },
    won:       { label: 'Won',         color: '#15803d', bg: '#bbf7d0' },
    lost:      { label: 'Lost',        color: '#dc2626', bg: '#fee2e2' },
  } as Record<string, { label: string; color: string; bg: string }>)[stage] ?? {
    label: stage,
    color: '#64748b',
    bg: '#f1f5f9',
  };
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ color: m.color, background: m.bg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }}></span>
      {m.label}
    </span>
  );
}

function ScoreBar({ value, color = T.primary }: { value: number; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 min-w-[64px]">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: T.badgeBg }}>
        <div className="h-full" style={{ width: `${value * 100}%`, background: color }}></div>
      </div>
      <span className="text-[11px] tabular-nums font-semibold text-[#172560] dark:text-white w-7 text-right">
        {Math.round(value * 100)}
      </span>
    </div>
  );
}

function EmailCell({ email, verified }: { email?: string | null; verified?: boolean }) {
  if (!email) return <span className="text-[11.5px] text-slate-400">—</span>;
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-[12px] text-[#172560] dark:text-white truncate">{email}</span>
      <VerifiedTag verified={verified} />
    </div>
  );
}

function PhoneCell({ phone, verified }: { phone?: string | null; verified?: boolean }) {
  if (!phone) return <span className="text-[11.5px] text-slate-400">—</span>;
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-[12px] tabular-nums text-[#172560] dark:text-white truncate">{phone}</span>
      <VerifiedTag verified={verified} />
    </div>
  );
}

function OwnerCell({ ownerId }: { ownerId?: string }) {
  if (!ownerId) return <span className="text-[11.5px] text-slate-400">—</span>;
  const o = CRM_OWNERS[ownerId];
  if (!o) return <span className="text-[11.5px] text-slate-400">—</span>;
  return (
    <div className="flex items-center gap-2">
      <CrmAvatar name={o.name} initials={o.initials} tone={o.tone} size={22} />
      <span className="text-[12px] text-[#172560] dark:text-white">{o.name}</span>
    </div>
  );
}

function RowActions({ onRemove }: { onRemove?: () => void }) {
  return (
    <div className="inline-flex items-center gap-1 justify-end">
      {onRemove && (
        <button
          className="w-7 h-7 grid place-items-center rounded-md text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-600 dark:hover:text-rose-300"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          aria-label="Remove — not a fit"
          title="Remove — not a fit"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
      <button
        className="w-7 h-7 grid place-items-center rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1a2a43] hover:text-[#172560]"
        onClick={(e) => e.stopPropagation()}
        aria-label="Row actions"
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Generic table shell ──────────────────────────────────────────────────
interface Column<R> {
  label: string;
  align?: 'left' | 'right';
  nowrap?: boolean;
  sortable?: boolean;
  render: (row: R) => React.ReactNode;
}

interface FilterDef<R extends CrmContact = CrmContact> {
  key: keyof R;
  label: string;
  options: { value: string; label: string }[];
}

interface CrmTableProps<R extends CrmContact> {
  title: string;
  subtitle?: React.ReactNode;
  count: number;
  columns: Column<R>[];
  rows: R[];
  filters?: FilterDef<R>[];
  onRowClick?: (row: R) => void;
  onRemove?: (row: R) => void;
}

function CrmTable<R extends CrmContact>({
  title, subtitle, count, columns, rows, filters, onRowClick, onRemove,
}: CrmTableProps<R>) {
  const [q, setQ] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string | null>>({});

  const filtered = useMemo(() => {
    let out = rows;
    if (q.trim()) {
      const term = q.toLowerCase();
      out = out.filter((r) =>
        Object.values(r).some((v) => typeof v === 'string' && v.toLowerCase().includes(term))
      );
    }
    for (const [k, v] of Object.entries(activeFilters)) {
      if (v != null) out = out.filter((r) => (r as Record<string, unknown>)[k] === v);
    }
    return out;
  }, [q, activeFilters, rows]);

  return (
    <section className="bg-white dark:bg-[#000724] rounded-[20px] border border-slate-200 dark:border-[#262831] overflow-hidden">
      <header className="px-5 py-4 border-b border-slate-100 dark:border-[#262831] flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h3
              className="text-[15px] font-semibold text-[#172560] dark:text-white"
              style={{ fontFamily: '"Space Grotesk", system-ui' }}
            >
              {title}
            </h3>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums"
              style={{ background: T.badgeBg, color: T.primaryHead }}
            >
              {filtered.length}{filtered.length !== count ? ` / ${count}` : ''}
            </span>
          </div>
          {subtitle && (
            <p className="text-[12px] text-slate-500 dark:text-[#7a8ba3] mt-0.5">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="h-9 pl-8 pr-3 rounded-lg text-[12.5px] border border-slate-200 dark:border-[#262831] bg-white dark:bg-[#000724] text-[#172560] dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0B1957]/30 w-48"
            />
          </div>
          {filters?.map((f) => (
            <FilterDropdown
              key={String(f.key)}
              label={f.label}
              value={activeFilters[String(f.key)] ?? null}
              options={f.options}
              onChange={(v) => setActiveFilters((prev) => ({ ...prev, [String(f.key)]: v }))}
            />
          ))}
          <button className="h-9 px-3 rounded-lg text-[12.5px] font-medium border border-slate-200 dark:border-[#262831] text-[#172560] dark:text-white hover:bg-slate-50 dark:hover:bg-[#1a2a43] inline-flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button
            className="h-9 px-3.5 rounded-lg text-[12.5px] font-semibold text-white inline-flex items-center gap-1.5"
            style={{ background: T.primary }}
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>
        </div>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/70 dark:bg-[#0e1a3a] border-b border-slate-100 dark:border-[#262831]">
              <th className="w-9 px-3 py-2.5">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 dark:border-[#262831] focus:ring-[#0B1957]/30"
                  aria-label="Select all rows"
                />
              </th>
              {columns.map((c, i) => (
                <th
                  key={i}
                  className={`px-3 py-2.5 text-[10.5px] uppercase tracking-wider font-semibold text-slate-500 dark:text-[#7a8ba3] whitespace-nowrap ${
                    c.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    {c.sortable && <ChevronsUpDown className="w-3 h-3 opacity-50" />}
                  </span>
                </th>
              ))}
              <th className="w-12 px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.id}
                onClick={() => onRowClick?.(r)}
                className="border-b border-slate-100 dark:border-[#262831] hover:bg-[#f5f7fd] dark:hover:bg-[#0e1a3a] cursor-pointer transition"
              >
                <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 dark:border-[#262831] focus:ring-[#0B1957]/30"
                    aria-label={`Select ${r.name}`}
                  />
                </td>
                {columns.map((c, j) => (
                  <td
                    key={j}
                    className={`px-3 py-3 align-middle ${c.align === 'right' ? 'text-right' : ''} ${
                      c.nowrap ? 'whitespace-nowrap' : ''
                    }`}
                  >
                    {c.render(r)}
                  </td>
                ))}
                <td className="px-3 py-3 text-right">
                  <RowActions onRemove={onRemove ? () => onRemove(r) : undefined} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 2}
                  className="text-center py-14 text-[12.5px] text-slate-500 dark:text-[#7a8ba3]"
                >
                  <Inbox className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  No matches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className="px-5 py-3 border-t border-slate-100 dark:border-[#262831] flex items-center justify-between text-[12px] text-slate-500 dark:text-[#7a8ba3]">
        <span>
          Showing <span className="font-semibold text-[#172560] dark:text-white">{filtered.length}</span> of {count}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            className="h-8 px-2.5 rounded-md hover:bg-slate-100 dark:hover:bg-[#1a2a43] disabled:opacity-40"
            disabled
            aria-label="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-[12px] text-[#172560] dark:text-white font-medium">Page 1 of 1</span>
          <button
            className="h-8 px-2.5 rounded-md hover:bg-slate-100 dark:hover:bg-[#1a2a43] disabled:opacity-40"
            disabled
            aria-label="Next page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </footer>
    </section>
  );
}

function FilterDropdown({
  label, value, options, onChange,
}: {
  label: string;
  value: string | null;
  options: { value: string; label: string }[];
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-9 pl-3 pr-8 rounded-lg text-[12.5px] border border-slate-200 dark:border-[#262831] bg-white dark:bg-[#000724] text-[#172560] dark:text-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#0B1957]/30"
      >
        <option value="">{label}: All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {label}: {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );
}

// ── Reusable name+title row cell ────────────────────────────────────────
function NameCell({ row, withCompany = false }: { row: CrmContact; withCompany?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <CrmAvatar name={row.name} initials={row.initials} />
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold text-[#172560] dark:text-white truncate">{row.name}</p>
        <p className="text-[11px] text-slate-500 dark:text-[#7a8ba3] truncate">
          {withCompany ? `${row.title} · ${row.company}` : row.title}
        </p>
      </div>
    </div>
  );
}

// ── ALL CONTACTS ────────────────────────────────────────────────────────
export function AllContactsTable({
  rows, onSelect, onRemove,
}: { rows: CrmContact[]; onSelect: (c: CrmContact) => void; onRemove?: (c: CrmContact) => void }) {
  const columns: Column<CrmContact>[] = [
    { label: 'Contact', nowrap: true, render: (r) => <NameCell row={r} /> },
    { label: 'Type',    render: (r) => <TypePill type={r.type} /> },
    { label: 'Source',  render: (r) => <span className="text-[12px] text-slate-600 dark:text-[#7a8ba3]">{r.source}</span> },
    { label: 'Company', render: (r) => <span className="text-[12px] text-[#172560] dark:text-white">{r.company}</span> },
    { label: 'Email',   render: (r) => <EmailCell email={r.email} verified={r.emailVerified} /> },
    { label: 'Phone',   render: (r) => <PhoneCell phone={r.phone} verified={r.phoneVerified} /> },
    { label: 'Channels',render: (r) => <ChannelChips channels={r.channels} /> },
    { label: 'Owner',   nowrap: true, render: (r) => <OwnerCell ownerId={r.owner} /> },
    {
      label: 'Last activity', sortable: true, nowrap: true,
      render: (r) => (
        <span className="text-[12px] tabular-nums text-slate-600 dark:text-[#7a8ba3]" title={r.lastActivityAt ?? ''}>
          {r.lastActivityAt ? `${rel(r.lastActivityAt)} ago` : '—'}
        </span>
      ),
    },
    {
      label: 'Created', sortable: true, nowrap: true,
      render: (r) => (
        <span className="text-[12px] text-slate-500 dark:text-[#7a8ba3] tabular-nums">
          {fmtDate(r.createdAt)}
        </span>
      ),
    },
  ];
  const filters: FilterDef[] = [
    {
      key: 'type', label: 'Type',
      options: [
        { value: 'prospect', label: 'Prospects' },
        { value: 'lead',     label: 'Leads' },
        { value: 'client',   label: 'Clients' },
        { value: 'imported', label: 'Imported' },
        { value: 'inbound',  label: 'Inbound' },
      ],
    },
    {
      key: 'owner', label: 'Owner',
      options: Object.entries(CRM_OWNERS).map(([k, v]) => ({ value: k, label: v.name })),
    },
  ];
  return (
    <CrmTable
      title="All Contacts"
      subtitle="Every contact in this tenant — imported, prospected, inbound, and customer."
      count={rows.length}
      columns={columns}
      rows={rows}
      filters={filters}
      onRowClick={onSelect}
      onRemove={onRemove}
    />
  );
}

// ── PROSPECTS ───────────────────────────────────────────────────────────
export function ProspectsTable({
  rows, onSelect, onRemove,
}: { rows: CrmContact[]; onSelect: (c: CrmContact) => void; onRemove?: (c: CrmContact) => void }) {
  const columns: Column<CrmContact>[] = [
    { label: 'Prospect', nowrap: true, render: (r) => <NameCell row={r} withCompany /> },
    { label: 'Industry', render: (r) => <span className="text-[12px] text-[#172560] dark:text-white">{r.industry}</span> },
    { label: 'Geo',      render: (r) => <span className="text-[12px] text-slate-600 dark:text-[#7a8ba3]">{r.geo}</span> },
    { label: 'Fit',      sortable: true, render: (r) => (r.fit != null ? <ScoreBar value={r.fit} /> : <span className="text-[11.5px] text-slate-400">—</span>) },
    {
      label: 'Intent',
      render: (r) => (
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
          style={{
            background: (r.intentSignals ?? 0) > 0 ? '#fef3c7' : '#f1f5f9',
            color: (r.intentSignals ?? 0) > 0 ? '#a16207' : '#64748b',
          }}
        >
          <Radio className="w-3 h-3" /> {r.intentSignals ?? 0} signal
          {(r.intentSignals ?? 0) === 1 ? '' : 's'}
        </span>
      ),
    },
    {
      label: 'Warm path',
      render: (r) =>
        r.warmPath ? (
          <span
            className="inline-flex items-center gap-1 text-[12px] font-medium"
            style={{ color: T.primary }}
          >
            <Route className="w-3 h-3" />
            {r.warmPath}
          </span>
        ) : (
          <span className="text-[11.5px] text-slate-400">—</span>
        ),
    },
    { label: 'Channels', render: (r) => <ChannelChips channels={r.channels} /> },
    { label: 'Source',   render: (r) => <span className="text-[12px] text-slate-600 dark:text-[#7a8ba3]">{r.source}</span> },
    { label: 'Owner',    nowrap: true, render: (r) => <OwnerCell ownerId={r.owner} /> },
    {
      label: 'Last touch', sortable: true, nowrap: true,
      render: (r) => (
        <span className="text-[12px] tabular-nums text-slate-600 dark:text-[#7a8ba3]">
          {r.lastActivityAt ? `${rel(r.lastActivityAt)} ago` : '—'}
        </span>
      ),
    },
  ];
  const filters: FilterDef[] = [
    {
      key: 'industry', label: 'Industry',
      options: [...new Set(rows.map((r) => r.industry).filter(Boolean))].map((v) => ({
        value: v as string,
        label: v as string,
      })),
    },
    {
      key: 'owner', label: 'Owner',
      options: Object.entries(CRM_OWNERS).map(([k, v]) => ({ value: k, label: v.name })),
    },
  ];
  return (
    <CrmTable
      title="Prospects"
      subtitle="Top-of-funnel — sourced from Apollo, LinkedIn Sales Nav, imports, or referrals. Not yet qualified."
      count={rows.length}
      columns={columns}
      rows={rows}
      filters={filters}
      onRowClick={onSelect}
      onRemove={onRemove}
    />
  );
}

// ── LEADS ───────────────────────────────────────────────────────────────
export function LeadsTable({
  rows, onSelect, onRemove,
}: { rows: CrmContact[]; onSelect: (c: CrmContact) => void; onRemove?: (c: CrmContact) => void }) {
  const totalPipeline = rows.reduce((a, r) => a + (r.value || 0), 0);
  const weighted = rows.reduce((a, r) => a + (r.value || 0) * (r.probability || 0), 0);
  const columns: Column<CrmContact>[] = [
    { label: 'Lead', nowrap: true, render: (r) => <NameCell row={r} withCompany /> },
    { label: 'Stage', render: (r) => <StagePill stage={r.stage} /> },
    {
      label: 'Value', align: 'right', sortable: true, nowrap: true,
      render: (r) => (
        <span className="text-[12.5px] font-semibold tabular-nums text-[#172560] dark:text-white">
          {fmtCurrency(r.value ?? 0)}
        </span>
      ),
    },
    { label: 'Probability', sortable: true, render: (r) => <ScoreBar value={r.probability ?? 0} color="#16a34a" /> },
    {
      label: 'Weighted', align: 'right', nowrap: true,
      render: (r) => (
        <span className="text-[12px] tabular-nums text-slate-600 dark:text-[#7a8ba3]">
          {fmtCurrency((r.value ?? 0) * (r.probability ?? 0))}
        </span>
      ),
    },
    { label: 'Source',    render: (r) => <span className="text-[12px] text-slate-600 dark:text-[#7a8ba3]">{r.source}</span> },
    { label: 'Next step', render: (r) => <span className="text-[12px] text-[#172560] dark:text-white">{r.nextStep || '—'}</span> },
    {
      label: 'Expected close', sortable: true, nowrap: true,
      render: (r) => (
        <span className="text-[12px] tabular-nums text-slate-600 dark:text-[#7a8ba3]">
          {fmtDate(r.expectedClose)}
        </span>
      ),
    },
    { label: 'Owner', nowrap: true, render: (r) => <OwnerCell ownerId={r.owner} /> },
    {
      label: 'Last activity', sortable: true, nowrap: true,
      render: (r) => (
        <span className="text-[12px] tabular-nums text-slate-600 dark:text-[#7a8ba3]">
          {r.lastActivityAt ? `${rel(r.lastActivityAt)} ago` : '—'}
        </span>
      ),
    },
  ];
  const filters: FilterDef[] = [
    {
      key: 'stage', label: 'Stage',
      options: [
        { value: 'contacted', label: 'Contacted' },
        { value: 'engaged',   label: 'Engaged' },
        { value: 'qualified', label: 'Qualified' },
        { value: 'sah',       label: 'Handed off' },
      ],
    },
    {
      key: 'owner', label: 'Owner',
      options: Object.entries(CRM_OWNERS).map(([k, v]) => ({ value: k, label: v.name })),
    },
  ];
  const subtitle = (
    <>
      Pipeline: <span className="font-semibold text-[#172560] dark:text-white">{fmtCurrency(totalPipeline)}</span>
      {' · '}
      Weighted: <span className="font-semibold text-[#172560] dark:text-white">{fmtCurrency(weighted)}</span>
    </>
  );
  return (
    <CrmTable
      title="Leads"
      subtitle={subtitle}
      count={rows.length}
      columns={columns}
      rows={rows}
      filters={filters}
      onRowClick={onSelect}
      onRemove={onRemove}
    />
  );
}

// ── CLIENTS ─────────────────────────────────────────────────────────────
export function ClientsTable({
  rows, onSelect, onRemove,
}: { rows: CrmContact[]; onSelect: (c: CrmContact) => void; onRemove?: (c: CrmContact) => void }) {
  const totalMrr = rows.reduce((a, r) => a + (r.mrr || 0), 0);
  const totalArr = totalMrr * 12;
  const columns: Column<CrmContact>[] = [
    { label: 'Client', nowrap: true, render: (r) => <NameCell row={r} withCompany /> },
    {
      label: 'Plan',
      render: (r) => (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold"
          style={{
            background: r.plan === 'Enterprise' ? '#e8ebf7' : r.plan === 'Growth' ? '#dbeafe' : '#f1f5f9',
            color: r.plan === 'Enterprise' ? '#0B1957' : r.plan === 'Growth' ? '#1d4ed8' : '#475569',
          }}
        >
          {r.plan}
        </span>
      ),
    },
    {
      label: 'MRR', align: 'right', sortable: true, nowrap: true,
      render: (r) => (
        <span className="text-[12.5px] font-semibold tabular-nums text-[#172560] dark:text-white">
          {fmtCurrency(r.mrr ?? 0, 'USD')}
        </span>
      ),
    },
    {
      label: 'ARR', align: 'right', nowrap: true,
      render: (r) => (
        <span className="text-[12px] tabular-nums text-slate-600 dark:text-[#7a8ba3]">
          {fmtCurrency((r.mrr ?? 0) * 12, 'USD')}
        </span>
      ),
    },
    {
      label: 'Health', sortable: true,
      render: (r) => {
        const h = r.health ?? 0;
        return (
          <ScoreBar
            value={h / 100}
            color={h >= 75 ? '#16a34a' : h >= 50 ? '#eab308' : '#ef4444'}
          />
        );
      },
    },
    {
      label: 'NPS', align: 'right',
      render: (r) => {
        const n = r.nps ?? 0;
        return (
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
            style={{
              color: n >= 9 ? '#16a34a' : n >= 7 ? '#0ea5e9' : '#dc2626',
              background: n >= 9 ? '#dcfce7' : n >= 7 ? '#e0f2fe' : '#fee2e2',
            }}
          >
            {n}
          </span>
        );
      },
    },
    { label: 'Channels', render: (r) => <ChannelChips channels={r.channels} /> },
    { label: 'CSM', nowrap: true, render: (r) => <OwnerCell ownerId={r.csm} /> },
    {
      label: 'Renewal', sortable: true, nowrap: true,
      render: (r) => {
        if (!r.renewalDate) return <span className="text-[11.5px] text-slate-400">—</span>;
        const days = Math.round(
          (new Date(r.renewalDate).getTime() - NOW.getTime()) / (1000 * 60 * 60 * 24)
        );
        const isClose = days < 60;
        return (
          <div className="flex items-center gap-1.5">
            <span className="text-[12px] tabular-nums text-[#172560] dark:text-white">
              {fmtDate(r.renewalDate)}
            </span>
            <span
              className="text-[10.5px] font-medium"
              style={{ color: isClose ? '#dc2626' : '#64748b' }}
            >
              · {days}d
            </span>
          </div>
        );
      },
    },
    {
      label: 'Last contact', nowrap: true,
      render: (r) => (
        <span className="text-[12px] tabular-nums text-slate-600 dark:text-[#7a8ba3]">
          {r.lastActivityAt ? `${rel(r.lastActivityAt)} ago` : '—'}
        </span>
      ),
    },
  ];
  const filters: FilterDef[] = [
    {
      key: 'plan', label: 'Plan',
      options: [...new Set(rows.map((r) => r.plan).filter(Boolean))].map((v) => ({
        value: v as string,
        label: v as string,
      })),
    },
    {
      key: 'csm', label: 'CSM',
      options: Object.entries(CRM_OWNERS).map(([k, v]) => ({ value: k, label: v.name })),
    },
  ];
  const subtitle = (
    <>
      MRR: <span className="font-semibold text-[#172560] dark:text-white">{fmtCurrency(totalMrr, 'USD')}</span>
      {' · '}
      ARR: <span className="font-semibold text-[#172560] dark:text-white">{fmtCurrency(totalArr, 'USD')}</span>
    </>
  );
  return (
    <CrmTable
      title="Clients"
      subtitle={subtitle}
      count={rows.length}
      columns={columns}
      rows={rows}
      filters={filters}
      onRowClick={onSelect}
      onRemove={onRemove}
    />
  );
}

// Re-export the empty-state icon if a parent wants to render their own table-less message.
export { LadCard, BadgeCheck };
