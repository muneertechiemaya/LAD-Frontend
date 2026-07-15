'use client';
// Warm Path panel: collapsible by default; expanding reveals an interactive SVG
// graph where the prospect node toggles child visibility and the surrounding
// network nodes are draggable. Mirrors the original glance.jsx design but
// re-themed to the LAD navy palette.

import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Route, RouteOff, ChevronUp, ChevronDown, RotateCcw, Move, UsersRound, Award,
  BriefcaseBusiness,
} from 'lucide-react';
import { LadCard, LadCardHeader, T } from './shared';
import type { ProspectFixture, WarmPath } from './data';

interface ChildDef {
  id: string;
  x: number;
  y: number;
  name: string;
  sub: string;
  color: string;
  darkColor?: string; // Enhanced placeholder token to allow native overrides in dark mode environments
  badge: string;
  big?: boolean;
  label?: { conf: number; note: string };
  linkType: 'primary' | 'mutual' | 'customer' | 'employer';
}

interface Pos {
  x: number;
  y: number;
}

interface WarmPathPanelProps {
  wp: WarmPath;
  prospect: ProspectFixture;
  open: boolean;
  onToggle: () => void;
}

const W = 720;
const H = 320;
const CENTER = { x: W / 2, y: 150 };

export default function WarmPathPanel({ wp, prospect, open, onToggle }: WarmPathPanelProps) {
  const childDefs = useMemo<ChildDef[]>(() => {
    if (!wp?.top_connection) return [];
    const out: ChildDef[] = [];
    out.push({
      id: 'champion',
      x: 150, y: 150,
      name: wp.top_connection.name,
      sub: wp.top_connection.headline.split(',')[0],
      color: T.primary,
      darkColor: '#3b82f6', // Tailored dynamic light blue for pristine legibility on deep navy canvas options
      badge: wp.top_connection.name.split(' ').map((w) => w[0]).join(''),
      big: true,
      label: { conf: wp.top_connection.confidence, note: `ex-${wp.shared_employer?.company || 'colleagues'}` },
      linkType: 'primary',
    });
    const bridges = (wp.mutual_connections || []).slice(0, 3);
    bridges.forEach((m, i, arr) => {
      const angles = arr.length === 1 ? [0] : arr.length === 2 ? [-25, 25] : [-35, 0, 35];
      const ang = (angles[i] * Math.PI) / 180;
      out.push({
        id: `bridge-${i}`,
        x: CENTER.x + Math.cos(ang) * 250,
        y: CENTER.y + Math.sin(ang) * 90,
        name: m.name,
        sub: m.title,
        color: T.linkedin,
        darkColor: '#60a5fa', // Shifts mutual connection nodes up to beautiful clear sky tokens in dark mode
        badge: m.name.split(' ').map((w) => w[0]).join(''),
        linkType: 'mutual',
      });
    });
    if (wp.customer_reference) {
      out.push({
        id: 'customer',
        x: CENTER.x, y: 44,
        name: wp.customer_reference.via,
        sub: 'Mr LAD customer',
        color: T.success,
        darkColor: '#4ade80', // Radiant toxic/lime-tinted emerald for verified accounts
        badge: 'SH',
        linkType: 'customer',
      });
    }
    if (wp.shared_employer) {
      out.push({
        id: 'employer',
        x: 150, y: 260,
        name: wp.shared_employer.company,
        sub: wp.shared_employer.overlap,
        color: '#0369a1',
        darkColor: '#38bdf8', // Pure sea-blue highlights to maintain brand visibility
        badge: 'CG',
        linkType: 'employer',
      });
    }
    return out;
  }, [wp]);

  const [positions, setPositions] = useState<Record<string, Pos>>({});
  const [kidsExpanded, setKidsExpanded] = useState(true);
  const [hoverId, setHoverId] = useState<string | null>(null);

  useEffect(() => {
    setPositions({});
    setKidsExpanded(true);
  }, [childDefs]);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{
    id: string;
    rect: DOMRect;
    scaleX: number;
    scaleY: number;
    ox: number;
    oy: number;
  } | null>(null);

  if (!wp?.top_connection) {
    return (
      <LadCard>
        <LadCardHeader title="Warm Path" subtitle="Routes from your network to this prospect" />
        <div className="grid place-items-center h-32 text-[12.5px] text-slate-500 dark:text-slate-300">
          <div className="text-center">
            <RouteOff className="w-5 h-5 mx-auto mb-2 opacity-50" />
            No paths found yet.
          </div>
        </div>
      </LadCard>
    );
  }

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  const startDrag = (id: string) => (e: React.PointerEvent<SVGGElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const def = childDefs.find((d) => d.id === id);
    if (!def) return;
    const cur = positions[id] || { x: def.x, y: def.y };
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;
    dragRef.current = { id, rect, scaleX, scaleY, ox: px - cur.x, oy: py - cur.y };
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  const onMove = (e: React.PointerEvent<SVGGElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const x = (e.clientX - d.rect.left) * d.scaleX - d.ox;
    const y = (e.clientY - d.rect.top) * d.scaleY - d.oy;
    setPositions((p) => ({ ...p, [d.id]: { x: clamp(x, 36, W - 36), y: clamp(y, 36, H - 36) } }));
  };

  const endDrag = (e: React.PointerEvent<SVGGElement>) => {
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
    dragRef.current = null;
  };

  const getPos = (def: ChildDef): Pos => positions[def.id] || { x: def.x, y: def.y };
  const linkPath = (a: Pos, b: Pos) => {
    const mx = (a.x + b.x) / 2;
    return `M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x},${b.y}`;
  };
  const linkStyleFor = (t: ChildDef['linkType']) =>
    ({
      primary:  { stroke: 'url(#ladLink)',           sw: 3,   dash: '' },
      mutual:   { stroke: 'url(#ladLinkBlue)',       sw: 2,   dash: '3 3' },
      customer: { stroke: 'rgba(34,197,94,0.55)',    sw: 2,   dash: '2 4' },
      employer: { stroke: 'rgba(3,105,161,0.45)',    sw: 1.5, dash: '' },
    } as const)[t];

  return (
    <LadCard>
      <LadCardHeader
        title="Warm Path"
        subtitle={`${childDefs.length} routes through your network`}
        action={
          <div className="flex items-center gap-1.5">
            {open && Object.keys(positions).length > 0 && (
              <button
                onClick={() => setPositions({})}
                className="h-7 px-2.5 rounded-full text-[11.5px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a2a43] inline-flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
            )}
            <button
              onClick={onToggle}
              className="inline-flex items-center justify-center gap-1 whitespace-nowrap text-[11.5px] transition-all disabled:pointer-events-none disabled:opacity-50 active:scale-95 select-none h-7 px-2.5 rounded-full font-semibold shadow-sm bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700 outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              {open ? 'Collapse' : 'Open graph'}
              {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        }
      />
      {!open ? (
        <button
          onClick={onToggle}
          className="w-full text-left rounded-2xl ring-1 ring-slate-200 dark:ring-[#262831] hover:ring-[#0B1957]/40 dark:hover:ring-[#3b4b7a] transition p-4 flex items-center gap-4 bg-gradient-to-r from-[#f1f3fb] to-white dark:from-[#0b142e] dark:to-[#040a1f]"
        >
          <div className="shrink-0 w-10 h-10 rounded-xl grid place-items-center" style={{ background: T.badgeBg }}>
            <Route className="w-5 h-5" style={{ color: T.primary }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] text-[#172560] dark:text-white">
              <span className="font-semibold">{wp.top_connection.name}</span> knows{' '}
              {prospect.full_name.split(' ')[0]}
              {wp.shared_employer ? (
                <>
                  {' from '}
                  <span className="font-semibold">{wp.shared_employer.company}</span>{' '}
                  ({wp.shared_employer.overlap})
                </>
              ) : null}
              <span className="ml-1.5 text-[11.5px] font-semibold" style={{ color: T.primary }}>
                · {Math.round(wp.top_connection.confidence * 100)}%
              </span>
            </p>
            <div className="mt-1 flex items-center gap-3 text-[11.5px] text-slate-600 dark:text-slate-300">
              {wp.mutual_connections?.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <UsersRound className="w-3 h-3" /> {wp.mutual_connections.length} mutuals
                </span>
              )}
              {wp.customer_reference && (
                <span className="inline-flex items-center gap-1">
                  <Award className="w-3 h-3" /> {wp.customer_reference.via}
                </span>
              )}
              {wp.account_pipeline && (
                <span className="inline-flex items-center gap-1">
                  <BriefcaseBusiness className="w-3 h-3" /> account in pipeline
                </span>
              )}
            </div>
          </div>
        </button>
      ) : (
        <div className="relative">
          <div className="absolute top-1 right-1 z-10 text-[10.5px] text-slate-500 dark:text-slate-300 bg-white/80 dark:bg-[#000724]/80 backdrop-blur px-2 py-0.5 rounded-full ring-1 ring-slate-200/70 dark:ring-[#262831] inline-flex items-center gap-1">
            <Move className="w-3 h-3" /> drag nodes · click {prospect.full_name.split(' ')[0]} to{' '}
            {kidsExpanded ? 'collapse' : 'expand'}
          </div>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto touch-none select-none"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <linearGradient id="ladLink" x1="0" x2="1">
                <stop offset="0%" stopColor={T.primary} stopOpacity="0.7" />
                <stop offset="100%" stopColor={T.primary} stopOpacity="0.15" />
              </linearGradient>
              <linearGradient id="ladLinkBlue" x1="0" x2="1">
                <stop offset="0%" stopColor={T.linkedin} stopOpacity="0.1" />
                <stop offset="100%" stopColor={T.linkedin} stopOpacity="0.6" />
              </linearGradient>
              <radialGradient id="ladHalo" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={T.primary} stopOpacity="0.18" />
                <stop offset="100%" stopColor={T.primary} stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle
              cx={CENTER.x}
              cy={CENTER.y}
              r={kidsExpanded ? 60 : 80}
              fill="url(#ladHalo)"
              style={{ transition: 'r 200ms ease' }}
            />
            {kidsExpanded &&
              childDefs.map((def) => {
                const p = getPos(def);
                const s = linkStyleFor(def.linkType);
                return (
                  <g
                    key={`l-${def.id}`}
                    style={{ opacity: hoverId && hoverId !== def.id ? 0.35 : 1, transition: 'opacity 150ms' }}
                  >
                    <path
                      d={linkPath(p, CENTER)}
                      stroke={s.stroke}
                      strokeWidth={s.sw}
                      fill="none"
                      strokeDasharray={s.dash}
                    />
                    {def.linkType === 'primary' && def.label && (
                      <>
                        <text
                          x={(p.x + CENTER.x) / 2}
                          y={(p.y + CENTER.y) / 2 - 6}
                          textAnchor="middle"
                          className="fill-[#0B1957] dark:fill-[#60a5fa]"
                          style={{ fontSize: 11, fontWeight: 600, pointerEvents: 'none' }}
                        >
                          {Math.round(def.label.conf * 100)}%
                        </text>
                        <text
                          x={(p.x + CENTER.x) / 2}
                          y={(p.y + CENTER.y) / 2 + 8}
                          textAnchor="middle"
                          className="fill-slate-500 dark:fill-[#7a8ba3]"
                          style={{ fontSize: 10, pointerEvents: 'none' }}
                        >
                          {def.label.note}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}

            {kidsExpanded &&
              childDefs.map((def) => {
                const p = getPos(def);
                return (
                  <GraphNode
                    key={def.id}
                    x={p.x}
                    y={p.y}
                    name={def.name}
                    sub={def.sub}
                    color={def.color}
                    darkColor={def.darkColor}
                    badge={def.badge}
                    big={!!def.big}
                    draggable
                    isHover={hoverId === def.id}
                    onPointerDown={startDrag(def.id)}
                    onPointerMove={onMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onPointerEnter={() => setHoverId(def.id)}
                    onPointerLeave={() => setHoverId(null)}
                  />
                );
              })}

            <GraphNode
              x={CENTER.x}
              y={CENTER.y}
              name={prospect.full_name.split(' ')[0]}
              sub={kidsExpanded ? 'Click to collapse' : 'Click to expand'}
              color={T.primary}
              badge={prospect.full_name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('')}
              big
              isProspect
              clickable
              collapsed={!kidsExpanded}
              onClick={() => setKidsExpanded((v) => !v)}
            />
          </svg>
          <div className="px-1 pt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-300">
            <Legend color={T.primary} label="Strong route" />
            <Legend color={T.linkedin} label="Mutual" dashed />
            <Legend color={T.success} label="Customer reference" dashed />
            <Legend color="#0369a1" label="Shared employer" />
          </div>
        </div>
      )}
    </LadCard>
  );
}

function Legend({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="w-3 rounded"
        style={
          dashed
            ? {
                height: '2px',
                backgroundImage: `linear-gradient(to right, ${color} 50%, transparent 50%)`,
                backgroundSize: '4px 100%',
              }
            : { height: '2px', background: color }
        }
      ></span>
      {label}
    </span>
  );
}

interface GraphNodeProps {
  x: number;
  y: number;
  name: string;
  sub?: string;
  color: string;
  darkColor?: string;
  big?: boolean;
  isProspect?: boolean;
  badge: string;
  draggable?: boolean;
  clickable?: boolean;
  collapsed?: boolean;
  isHover?: boolean;
  onPointerDown?: (e: React.PointerEvent<SVGGElement>) => void;
  onPointerMove?: (e: React.PointerEvent<SVGGElement>) => void;
  onPointerUp?: (e: React.PointerEvent<SVGGElement>) => void;
  onPointerCancel?: (e: React.PointerEvent<SVGGElement>) => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  onClick?: () => void;
}

function GraphNode({
 x, y, name, sub, color, darkColor, big = false, isProspect = false, badge,
 draggable, clickable, collapsed, isHover,
 onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onPointerEnter, onPointerLeave, onClick,
}: GraphNodeProps) {
  const r = big ? 26 : 18;
  const cursor = draggable ? 'grab' : clickable ? 'pointer' : 'default';

  const isWhiteNode = isProspect || badge === 'AM';

  return (
    <g
      transform={`translate(${x} ${y})`}
      style={{
        cursor,
        transition: draggable && !isHover ? 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onClick={clickable ? onClick : undefined}
    >
      <circle r={r + 14} fill="transparent" />
      <circle r={r + 4} fill="white" className="dark:fill-[#000724]" />
      <circle r={r} fill={color} className="dark:!fill-[var(--node-color)]" style={{ transition: 'opacity 150ms', ['--node-color' as any]: darkColor || color}}  opacity={isHover ? 0.22 : 0.12}/>
      <circle
        r={r}
        fill="white"
        className="dark:fill-[#0e1a3a]"
        stroke={color}
        strokeWidth={isProspect ? 2.5 : isHover ? 2 : 1.5}
        style={{ transition: 'stroke-width 150ms', stroke: typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? (darkColor || color) : color}}
      />
      <text
        textAnchor="middle"
        y={4}
        className={`font-bold ${isWhiteNode ? 'fill-[#0B1957] dark:fill-white text-[#0B1957] dark:text-white' : 'fill-current'}`}
        style={{
          fontSize: big ? 13 : 10,
          pointerEvents: 'none',
          fill: isWhiteNode ? undefined : (typeof window !== 'undefined' && document.documentElement.classList.contains('dark') ? (darkColor || color) : color),
          fontFamily: '"Space Grotesk", system-ui',
        }}
      >
        {badge}
      </text>
      {isProspect && (
        <g transform={`translate(${r - 6} ${-r + 6})`} style={{ pointerEvents: 'none' }}>
          <circle r="7" fill={color} />
          <text textAnchor="middle" y="3" fill="white" style={{ fontSize: 11, fontWeight: 700 }}>
            {collapsed ? '+' : '−'}
          </text>
        </g>
      )}
      <g transform={`translate(0 ${r + 14})`} style={{ pointerEvents: 'none' }}>
        <text
          textAnchor="middle"
          style={{ fontSize: 11.5, fontWeight: 600, fontFamily: '"Space Grotesk", system-ui' }}
          className="fill-[#172560] dark:fill-white"
        >
          {name}
        </text>
        {sub && (
          <text textAnchor="middle" y={13} className="fill-slate-500 dark:fill-[#7a8ba3]" style={{ fontSize: 10 }}>
            {sub}
          </text>
        )}
      </g>
    </g>
  );
}
