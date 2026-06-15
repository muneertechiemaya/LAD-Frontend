'use client';
// Shared CRM tokens, helpers, and primitives used across the four CRM views and
// the prospect detail. Keeps colors in one place so the four tables, the kanban
// board, and the prospect rail can stay visually consistent.

import * as React from 'react';
import {
  BriefcaseBusiness, MessageCircle, Mail, Phone, Camera, Radio, Settings2,
  BadgeCheck,
  type LucideIcon,
} from 'lucide-react';
import { type ChannelKey } from './data';

// LAD brand tokens — kept in sync with globals.css / tailwind config.
export const T = {
  primary:     '#0B1957',
  primaryHead: '#172560',
  badgeBg:     '#e8ebf7',
  badgeBgDk:   '#253456',
  linkedin:    '#0a66c2',
  whatsapp:    '#22c55e',
  gmail:       '#ea4335',
  voice:       '#7c3aed',
  success:     '#22c55e',
  warning:     '#eab308',
  danger:      '#ef4444',
  info:        '#0ea5e9',
};

export interface ChannelMeta {
  label: string;
  color: string;
  Icon: LucideIcon;
}

export const CH: Record<string, ChannelMeta> = {
  linkedin:  { label: 'LinkedIn',  color: T.linkedin, Icon: BriefcaseBusiness },
  whatsapp:  { label: 'WhatsApp',  color: T.whatsapp, Icon: MessageCircle },
  wapa:      { label: 'WAPA', color: T.whatsapp, Icon: MessageCircle },
  email:     { label: 'Email',     color: T.gmail,    Icon: Mail },
  voice:     { label: 'Voice',     color: T.voice,    Icon: Phone },
  instagram: { label: 'Instagram', color: '#ec4899',  Icon: Camera },
  intent:    { label: 'Signal',    color: T.primary,  Icon: Radio },
  system:    { label: 'System',    color: '#64748b',  Icon: Settings2 },
};

export const STAGE_META: Record<string, { label: string; color: string }> = {
  new:       { label: 'New',         color: '#64748b' },
  engaged:   { label: 'Engaged',     color: T.info },
  qualified: { label: 'Qualified',   color: T.primary },
  sah:       { label: 'Handed off',  color: T.success },
  won:       { label: 'Won',         color: '#16a34a' },
  lost:      { label: 'Lost',        color: T.danger },
  archived:  { label: 'Archived',    color: '#78716c' },
  contacted: { label: 'Contacted',   color: T.info },
};

// ── Relative time helpers ────────────────────────────────────────────────
export function rel(from?: string | null, now: Date = new Date()): string {
  if (!from) return '—';
  const s = Math.max(1, Math.round((now.getTime() - new Date(from).getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60); if (m < 60) return `${m}m`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h`;
  const d = Math.round(h / 24); if (d < 14) return `${d}d`;
  return `${Math.round(d / 7)}w`;
}

export function fmtDate(s?: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' });
}

export function fmtCurrency(n: number, ccy = 'AED'): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${ccy} ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${ccy} ${(n / 1_000).toFixed(1)}K`;
  return `${ccy} ${n}`;
}

export function initialsOf(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

// ── Shared primitives ────────────────────────────────────────────────────
export function LadCard({
  children, className = '', id, padded = true,
}: { children: React.ReactNode; className?: string; id?: string; padded?: boolean }) {
  return (
    <section
      id={id}
      className={`bg-white dark:bg-[#000724] rounded-[20px] border border-slate-200 dark:border-[#262831] ${
        padded ? 'p-5 sm:p-6' : ''
      } ${className}`}
    >
      {children}
    </section>
  );
}

export function LadCardHeader({
  title, subtitle, action,
}: { title: React.ReactNode; subtitle?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h3
          className="text-[15px] font-semibold tracking-tight text-[#172560] dark:text-white"
          style={{ fontFamily: '"Space Grotesk", system-ui' }}
        >
          {title}
        </h3>
        {subtitle && (
          <p className="text-[12.5px] text-slate-500 dark:text-[#7a8ba3] mt-0.5">{subtitle}</p>
        )}
      </div>
      {action}
    </header>
  );
}

export function CrmAvatar({
  name, initials, tone, size = 28,
}: { name?: string; initials?: string; tone?: string; size?: number }) {
  const display = initials ?? (name ? initialsOf(name) : '');
  return (
    <div
      className="rounded-full grid place-items-center text-white font-semibold shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: tone || 'linear-gradient(135deg,#0B1957,#172560)',
        fontFamily: '"Space Grotesk", system-ui',
      }}
    >
      {display}
    </div>
  );
}

export function ChannelChips({ channels }: { channels?: ChannelKey[] }) {
  if (!channels?.length) return <span className="text-[11.5px] text-slate-400">—</span>;
  return (
    <div className="flex items-center gap-1">
      {channels.map((ch) => {
        const m = CH[ch];
        if (!m) return null;
        const Icon = m.Icon;
        return (
          <span
            key={ch}
            className="w-5 h-5 rounded-full grid place-items-center"
            style={{ background: `${m.color}1a` }}
            title={m.label}
          >
            <Icon className="w-3 h-3" style={{ color: m.color }} />
          </span>
        );
      })}
    </div>
  );
}

export function VerifiedTag({ verified }: { verified?: boolean }) {
  return verified ? (
    <BadgeCheck className="w-3.5 h-3.5 shrink-0" style={{ color: T.success }} />
  ) : (
    <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400 shrink-0">unverified</span>
  );
}
