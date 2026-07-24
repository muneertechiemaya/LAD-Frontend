/**
 * BroadcastPerformance
 * --------------------
 * Single-row broadcast performance view with a pill-style dropdown selector
 * inside the Template column.
 *
 *   ┌─ # ─┬─ TEMPLATE ────────────┬─ DELIVERY ────────┬─ READ ─┬─ SENT ─┬─ FAIL ─┬─ RR ──┐
 *   │ 01  │ [ bni_member_…    ▾ ] │ ████▌▌▌▌▌░░░▒    │  116   │  95    │   22   │ 70.7% │
 *   │     │   127 recipients · 2d │                   │        │        │        │       │
 *   └─────┴───────────────────────┴───────────────────┴────────┴────────┴────────┴───────┘
 *
 * Colors map to the app's Tailwind theme (emerald / amber / rose / slate).
 * Pair with BroadcastPerformanceContainer for API wiring.
 */
'use client';

import React, { useEffect, useMemo, useState } from 'react';

// ─── Public data contract ────────────────────────────────────────────────────
export type Template = {
  id: string;
  name: string;
  recipients: number;
  lastSent: string;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  pending: number;
  /** Which channel this broadcast went out on. Rendered as a chip in the
   *  subtitle + prefixed in the dropdown so mixed-channel lists stay legible.
   *  For email, `read` = unique opens (tracking pixel) and `delivered` =
   *  sent-but-not-opened. */
  channel?: 'WhatsApp' | 'Gmail' | 'Outlook' | 'Email';
};

// Channel chip colors — aligned with the app's channel branding.
const CHANNEL_CHIP: Record<NonNullable<Template['channel']>, { bg: string; fg: string }> = {
  WhatsApp: { bg: '#d1fae5', fg: '#059669' },  // emerald
  Gmail:    { bg: '#fee2e2', fg: '#dc2626' },  // red
  Outlook:  { bg: '#dbeafe', fg: '#2563eb' },  // blue
  Email:    { bg: '#e2e8f0', fg: '#475569' },  // slate (custom SMTP / unknown)
};

export type BroadcastPerformanceProps = {
  templates: Template[];
  defaultTemplateId?: string;
  onSelect?: (id: string) => void;
  /**
   * When true, suppress the section header ("Broadcast Performance") and the
   * outer card frame so the component can be slotted into a host that already
   * provides chrome (e.g. the dashboard's `WidgetWrapper`). The inner table
   * still keeps its own rounded styling.
   */
  chromeless?: boolean;
};

// ─── Visual system — Tailwind-aligned palette ────────────────────────────────
// Source-of-truth hex values mirror the app's Tailwind defaults so the table
// blends in with neighbouring cards / badges. Color meaning is immutable:
// Read=emerald, Delivered=amber, Pending=slate, Failed=rose.
const C = {
  // Neutrals — now dynamic!
  ink:      'var(--lad-ink, #0f172a)',
  ink2:     'var(--lad-ink2, #334155)',
  muted:    'var(--lad-muted, #64748b)',
  hair:     'var(--lad-hair, #e2e8f0)',
  hair2:    'var(--lad-hair2, #2b7cff)',
  surface:  'var(--lad-surface, #ffffff)',
  surface2: 'var(--lad-surface2, #f8fafc)',

  // Semantic Colors
  read:        '#059669', readSoft:      'var(--lad-read-soft, #d1fae5)',
  delivered:   '#d97706', deliveredSoft: 'var(--lad-delivered-soft, #fef3c7)',
  pending:     '#94a3b8', pendingSoft:   'var(--lad-pending-soft, #e2e8f0)',
  failed:      '#e11d48', failedSoft:    'var(--lad-failed-soft, #ffe4e6)',
  okay:        '#b45309', okaySoft:      'var(--lad-okay-soft, #fef3c7)',
} as const;

const FONT_UI   = "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif";
const FONT_MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

const nf = new Intl.NumberFormat('en-US');
const pct1 = (v: number) => `${(v * 100).toFixed(1)}`;

// ─── Read-rate bands ─────────────────────────────────────────────────────────
type Band = { label: string; color: string; bg: string };
function bandFor(rate: number): Band {
  if (rate >= 0.50) return { label: 'Excellent', color: C.read,   bg: C.readSoft   };
  if (rate >= 0.35) return { label: 'Healthy',   color: C.read,   bg: C.readSoft   };
  if (rate >= 0.25) return { label: 'Okay',      color: C.okay,   bg: C.okaySoft   };
  return              { label: 'Weak',      color: C.failed, bg: C.failedSoft };
}

// ─── Scoped CSS ──────────────────────────────────────────────────────────────
const SCOPED_CSS = `
.lad-bp-wrap { font-family: ${FONT_UI}; }
.lad-bp-mono { font-family: ${FONT_MONO}; font-variant-numeric: tabular-nums; }

.lad-bp-table {
  width: 100%;
  border-collapse: collapse;
  background: ${C.surface};
  border-radius: 16px;
  overflow: hidden;
  table-layout: fixed;
}
.lad-bp-table thead th {
  text-align: left;
  font-family: ${FONT_UI};
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${C.muted};
  background: ${C.surface2};
  padding: 12px 16px;
  white-space: nowrap;
  border-bottom: 1px solid ${C.hair};
  overflow: hidden;
  text-overflow: ellipsis;
}
/* Extra bottom padding leaves room for the absolutely-positioned subtitle
   under the template dropdown without affecting the row's centerline — that
   way every other cell (bar, numbers, pill) aligns to the dropdown's middle,
   not to a synthetic midpoint between dropdown and subtitle. */
.lad-bp-table tbody td {
  padding: 16px 16px 32px;
  vertical-align: middle;
  font-family: ${FONT_UI};
  color: ${C.ink};
}

/* Column widths */
.lad-bp-col-index    { width: 48px;  color: ${C.muted}; font-family: ${FONT_MONO}; font-variant-numeric: tabular-nums; font-size: 13px; font-weight: 500; text-align: left; }
.lad-bp-col-template { width: 30%; min-width: 240px; }
.lad-bp-col-bar      { min-width: 160px; }
.lad-bp-col-num      { width: 80px;  text-align: right; font-family: ${FONT_MONO}; font-variant-numeric: tabular-nums; font-size: 15px; font-weight: 600; white-space: nowrap; }
.lad-bp-col-rate     { width: 104px; text-align: right; }

/* Template-cell dropdown — pill-shaped with prefix label, matches app's
   "Next 2 weeks ▾" filter buttons elsewhere in the product. */
.lad-bp-select-pill {
  --pill-bg: ${C.surface};
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 100%;
  max-width: 100%;
  padding: 8px 36px 8px 14px;
  border: 1px solid ${C.hair};
  border-radius: 14px;
  background: var(--pill-bg);
  box-shadow: 0 1px 0 rgba(15, 23, 42, 0.02);
  cursor: pointer;
  transition: border-color 150ms, box-shadow 150ms, background 150ms;
  min-width: 0;
}
.lad-bp-select-pill:hover { --pill-bg: ${C.surface2}; }
.lad-bp-select-pill:focus-within {
  border-color: ${C.hair2};
  box-shadow: 0 0 0 3px rgba(15, 23, 42, 0.08);
  background: var(--pill-bg);
}
.lad-bp-select-pill > select {
  appearance: none; -webkit-appearance: none; -moz-appearance: none;
  border: 0; outline: 0; padding: 0;
  font-family: ${FONT_MONO};
  font-variant-numeric: tabular-nums;
  font-size: 14px;
  font-weight: 600;
  color: ${C.ink};
  cursor: pointer;
  width: 100%;
  text-overflow: ellipsis; overflow: hidden; white-space: nowrap;
  background-color: var(--pill-bg);
  color: ${C.ink};
}
.lad-bp-select-pill > select option {
  background-color: ${C.surface};
  color: ${C.ink};
}
.lad-bp-select-pill > .chev {
  position: absolute;
  right: 12px;
  display: flex; align-items: center;
  color: ${C.muted};
  pointer-events: none;
  background: transparent;
}

/* Subtitle: floats below the dropdown without contributing to the row's
   centerline — keeps numbers/bar/pill visually aligned to the dropdown. */
.lad-bp-template-wrap { position: relative; min-width: 0; }
.lad-bp-template-sub {
  position: absolute;
  top: calc(100% + 6px);
  left: 4px;
  right: 0;
  font-size: 12px; font-weight: 500;
  color: ${C.muted};
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* Delivery bar */
.lad-bp-bar {
  display: flex; width: 100%; max-width: 240px; height: 10px;
  border-radius: 999px; overflow: hidden; background: ${C.hair};
}
.lad-bp-bar-seg { height: 100%; transition: width 500ms cubic-bezier(.4,0,.2,1); }

/* Rate pill — color/background driven by band */
.lad-bp-rate-pill {
  display: inline-flex; align-items: baseline; gap: 2px;
  padding: 6px 12px; border-radius: 999px;
  font-family: ${FONT_MONO}; font-variant-numeric: tabular-nums; font-weight: 700;
}
.lad-bp-rate-pill > .num  { font-size: 14px; }
.lad-bp-rate-pill > .unit { font-size: 10px; opacity: 0.7; }

/* Fade-swap on selection change */
.lad-bp-anim { animation: lad-bp-fade 200ms ease-out both; }
@keyframes lad-bp-fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}

@media (max-width: 880px) {
  .lad-bp-table th.lad-bp-col-index,
  .lad-bp-table td.lad-bp-col-index { display: none; }
}
@media (max-width: 830px) {
  .lad-bp-table th.lad-bp-col-bar,
  .lad-bp-table td.lad-bp-col-bar { display: none; }
}
@media (prefers-reduced-motion: reduce) {
  .lad-bp-bar-seg { transition: none !important; }
  .lad-bp-anim    { animation: none !important; }
}

.lad-bp-empty {
  padding: 28px 24px; text-align: center;
  color: ${C.muted}; font-size: 13px; font-weight: 500;
  font-family: ${FONT_UI};
  background: ${C.surface}; border: 1px solid ${C.hair}; border-radius: 16px;
}

.lad-bp-wrap {
  --lad-ink: #0f172a;
  --lad-ink2: #334155;
  --lad-muted: #64748b;
  --lad-hair: #e2e8f0;
  --lad-surface: #ffffff;
  --lad-surface2: #f8fafc;
  
  --lad-read-soft: #d1fae5;
  --lad-delivered-soft: #fef3c7;
  --lad-pending-soft: #e2e8f0;
  --lad-failed-soft: #ffe4e6;
  --lad-okay-soft: #fef3c7;
}

/* Dark Mode Overrides (matches parent background #1A2A43 / #0d1625) */
:root.dark .lad-bp-wrap,
.dark .lad-bp-wrap {
  --lad-ink: #f8fafc;        /* slate-50 — bright white/slate text */
  --lad-ink2: #cbd5e1;       /* slate-300 — readable secondary text */
  --lad-muted: #94a3b8;      /* slate-400 — muted text & icons */
  --lad-hair: rgba(43, 124, 255, 0.2); /* Matches parent border #2B7CFF/20 */
  --lad-hair2: #2b7cff;
  --lad-surface: #132035;    /* Matches container dark background mid-tone */
  --lad-surface2: #1e2f4a;   /* Header & dropdown hover state */

  /* Soft badge backgrounds with reduced opacity for dark mode */
  --lad-read-soft: rgba(5, 150, 105, 0.2);
  --lad-delivered-soft: rgba(217, 119, 6, 0.2);
  --lad-pending-soft: rgba(148, 163, 184, 0.2);
  --lad-failed-soft: rgba(225, 29, 72, 0.2);
  --lad-okay-soft: rgba(180, 83, 9, 0.2);
}
`;

// ─── Chevron (inline SVG, 14px) ──────────────────────────────────────────────
function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      <path d="M3 5.5L7 9.5L11 5.5" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── Stacked delivery bar ────────────────────────────────────────────────────
function DeliveryBar({ t }: { t: Template }) {
  const total = Math.max(1, t.sent, t.read + t.delivered + t.pending + t.failed);
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div
      className="lad-bp-bar"
      role="img"
      aria-label={
        `${nf.format(t.read)} read, ${nf.format(t.delivered)} delivered, ` +
        `${nf.format(t.pending)} pending, ${nf.format(t.failed)} failed of ` +
        `${nf.format(t.sent)} sent`
      }
    >
      {t.read      > 0 && <span className="lad-bp-bar-seg" style={{ width: pct(t.read),      background: C.read      }} title={`Read: ${nf.format(t.read)}`} />}
      {t.delivered > 0 && <span className="lad-bp-bar-seg" style={{ width: pct(t.delivered), background: C.delivered }} title={`Delivered: ${nf.format(t.delivered)}`} />}
      {t.pending   > 0 && <span className="lad-bp-bar-seg" style={{ width: pct(t.pending),   background: C.pending   }} title={`Pending: ${nf.format(t.pending)}`} />}
      {t.failed    > 0 && <span className="lad-bp-bar-seg" style={{ width: pct(t.failed),    background: C.failed    }} title={`Failed: ${nf.format(t.failed)}`} />}
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────
function EmptyState({ chromeless = false }: { chromeless?: boolean }) {
  return (
    <section className="lad-bp-wrap" aria-labelledby="lad-bp-heading">
      <style>{SCOPED_CSS}</style>
      {!chromeless && (
        <header style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: C.muted, fontWeight: 600, marginBottom: 4,
            }}
          >
            Broadcasts · Last 30 days
          </div>
          <h2
            id="lad-bp-heading"
            style={{
              margin: 0, fontSize: 20, fontWeight: 700, color: C.ink,
              letterSpacing: '-0.01em', lineHeight: 1.25,
            }}
          >
            Broadcast Performance
          </h2>
        </header>
      )}
      <div className="lad-bp-empty">No broadcasts yet.</div>
    </section>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────
export function BroadcastPerformance({
  templates, defaultTemplateId, onSelect, chromeless = false,
}: BroadcastPerformanceProps) {
  // Hooks MUST come before any early return (Rules of Hooks).
  const isEmpty = !templates || templates.length === 0;

  const initialId = useMemo(() => {
    if (isEmpty) return '';
    if (defaultTemplateId && templates.some(t => t.id === defaultTemplateId)) {
      return defaultTemplateId;
    }
    return templates[0].id;
  }, [isEmpty, defaultTemplateId, templates]);

  const [selectedId, setSelectedId] = useState<string>(initialId);
  useEffect(() => {
    if (isEmpty) return;
    if (!templates.some(t => t.id === selectedId)) setSelectedId(initialId);
  }, [isEmpty, templates, selectedId, initialId]);

  if (isEmpty) return <EmptyState chromeless={chromeless} />;

  const t = templates.find(x => x.id === selectedId) ?? templates[0];
  const idx = templates.findIndex(x => x.id === t.id);

  const readDenom = t.read + t.delivered + t.pending;
  const readRate  = readDenom > 0 ? t.read / readDenom : 0;
  const band      = bandFor(readRate);

  const handleChange: React.ChangeEventHandler<HTMLSelectElement> = (e) => {
    const id = e.target.value;
    setSelectedId(id);
    onSelect?.(id);
    e.currentTarget.focus();
  };

  return (
    <section className="lad-bp-wrap" aria-labelledby={chromeless ? undefined : 'lad-bp-heading'}>
      <style>{SCOPED_CSS}</style>

      {/* Section heading — suppressed when host provides its own chrome */}
      {!chromeless && (
        <header style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: C.muted, fontWeight: 600, marginBottom: 4,
            }}
          >
            Broadcasts · Last 30 days
          </div>
          <h2
            id="lad-bp-heading"
            style={{
              margin: 0, fontSize: 20, fontWeight: 700, color: C.ink,
              letterSpacing: '-0.01em', lineHeight: 1.25,
            }}
          >
            Broadcast Performance
          </h2>
        </header>
      )}

    <div
      style={
        chromeless
          ? { background: 'transparent', overflow: 'hidden' }
          : {
              background: C.surface,
              border: `1px solid ${C.hair}`,
              borderRadius: 16,
              boxShadow: '0 1px 0 rgba(15,23,42,0.02), 0 6px 16px rgba(15,23,42,0.04)',
              overflow: 'hidden',
            }
      }
    >
      <table className="lad-bp-table">
        <thead>
          <tr>
            <th className="lad-bp-col-index">#</th>
            <th className="lad-bp-col-template">Template</th>
            <th className="lad-bp-col-bar">Delivery breakdown</th>
            <th className="lad-bp-col-num">Read</th>
            <th className="lad-bp-col-num">Sent</th>
            <th className="lad-bp-col-num">Failed</th>
            <th className="lad-bp-col-rate">Read rate</th>
          </tr>
        </thead>
        <tbody>
          <tr aria-label={`${t.name} broadcast row`}>
            <td className="lad-bp-col-index">{String(idx + 1).padStart(2, '0')}</td>

            {/* Template — pill-shaped dropdown with subtitle floated below */}
            <td className="lad-bp-col-template">
              <label
                htmlFor="lad-bp-template-select"
                style={{
                  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
                  overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
                }}
              >
                Select template
              </label>
              <div className="lad-bp-template-wrap">
                <div className="lad-bp-select-pill">
                  <select
                    id="lad-bp-template-select"
                    value={selectedId}
                    onChange={handleChange}
                    title={t.name}
                  >
                    {templates.map(opt => (
                      <option key={opt.id} value={opt.id}>
                        {opt.channel ? `${opt.channel} · ${opt.name}` : opt.name}
                      </option>
                    ))}
                  </select>
                  <span className="chev"><Chevron /></span>
                </div>
                <div className="lad-bp-template-sub">
                  <span className="lad-bp-mono" style={{ color: C.ink2 }}>
                    {nf.format(t.recipients)}
                  </span>{' '}
                  recipients ·{' '}
                  <span className="lad-bp-mono" style={{ color: C.ink2 }}>
                    {t.lastSent}
                  </span>
                  {t.channel && (
                    <span
                      aria-label={`Channel: ${t.channel}`}
                      style={{
                        marginLeft: 8,
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: '0.02em',
                        background: CHANNEL_CHIP[t.channel].bg,
                        color: CHANNEL_CHIP[t.channel].fg,
                        verticalAlign: 'middle',
                      }}
                    >
                      {t.channel}
                    </span>
                  )}
                </div>
              </div>
            </td>

            <td className="lad-bp-col-bar">
              <div key={selectedId + '-bar'} className="lad-bp-anim">
                <DeliveryBar t={t} />
              </div>
            </td>
            <td
              className="lad-bp-col-num"
              style={{ color: t.read > 0 ? C.read : C.ink }}
              aria-label={`Read: ${nf.format(t.read)} messages`}
            >
              <span key={selectedId + '-read'} className="lad-bp-anim">{nf.format(t.read)}</span>
            </td>
            <td
              className="lad-bp-col-num"
              aria-label={`Sent: ${nf.format(t.sent)} messages`}
            >
              <span key={selectedId + '-sent'} className="lad-bp-anim">{nf.format(t.sent)}</span>
            </td>
            <td
              className="lad-bp-col-num"
              style={{ color: t.failed > 0 ? C.failed : C.muted }}
              aria-label={`Failed: ${nf.format(t.failed)} messages`}
            >
              <span key={selectedId + '-failed'} className="lad-bp-anim">{nf.format(t.failed)}</span>
            </td>
            <td className="lad-bp-col-rate">
              <span
                key={selectedId + '-rate'}
                className="lad-bp-rate-pill lad-bp-anim"
                style={{ background: band.bg, color: band.color }}
                aria-label={`Read rate: ${pct1(readRate)} percent — ${band.label}`}
                title={`${band.label} — ${pct1(readRate)}%`}
              >
                <span className="num">{pct1(readRate)}</span>
                <span className="unit">%</span>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    </section>
  );
}

export default BroadcastPerformance;
