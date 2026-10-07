'use client';
// View switcher pill - sits below the stats cards and lets the user jump
// directly between Board / All / Prospects / Leads / Clients without going
// through the stat cards.

import * as React from 'react';
import { Kanban, Users, Sparkles, TrendingUp, BadgeCheck, type LucideIcon } from 'lucide-react';
import type { CrmView } from './stats-cards';

interface PillDef {
  k: CrmView;
  label: string;
  Icon: LucideIcon;
}

const PILLS: PillDef[] = [
  { k: 'board',     label: 'Board',     Icon: Kanban },
  { k: 'all',       label: 'All',       Icon: Users },
  { k: 'prospects', label: 'Prospects', Icon: Sparkles },
  { k: 'leads',     label: 'Leads',     Icon: TrendingUp },
  { k: 'clients',   label: 'Clients',   Icon: BadgeCheck },
];

export interface ViewPillsProps {
  view: CrmView;
  onChange: (next: CrmView) => void;
}

export default function ViewPills({ view, onChange }: ViewPillsProps) {
  return (
    <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
      <div className="flex min-w-0 max-w-full items-center gap-2">
        <span className="max-md:hidden text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-300">
          View
        </span>
        <div className="no-scrollbar flex max-w-full items-center gap-1 overflow-x-auto rounded-full p-0.5 border border-slate-200 dark:border-[#262831] bg-white dark:bg-[#000724]">
          {PILLS.map((v) => {
            const Icon = v.Icon;
            const active = view === v.k;
            return (
              <button
                key={v.k}
                onClick={() => onChange(v.k)}
                aria-pressed={active}
                className={`h-7 max-lg:h-11 max-lg:min-w-11 shrink-0 px-2.5 max-md:px-3 rounded-full text-xs max-md:text-[13px] font-medium inline-flex items-center gap-1 transition-colors ${
                  active
                    ? 'text-white bg-[#0B1957] dark:bg-[#2563eb]'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#0e1d4d]'
                }`}
              >
                <Icon className="w-3 h-3 max-md:hidden" aria-hidden="true" /> {v.label}
              </button>
            );
          })}
        </div>
      </div>
      <p className="max-md:hidden text-[12px] text-slate-500 dark:text-slate-300">
        Click any row to open the contact&apos;s profile
      </p>
    </div>
  );
}
