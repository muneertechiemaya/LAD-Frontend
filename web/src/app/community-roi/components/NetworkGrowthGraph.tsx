'use client'

import { useState, useMemo, useEffect } from 'react'
import { X, Users, Handshake, DollarSign, ArrowUpRight, Loader2, Zap } from 'lucide-react'
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
} from 'recharts'
import { format } from 'date-fns'

// ─── Types ─────────────────────────────────────────────────────────────────────

interface MonthRow {
  month: string           // 'YYYY-MM'
  weekLabel: string       // display label for axis
  uniqueMeetings: number
  uniqueReferrals: number
  upgrades: number        // relationships that improved vs prior snapshot
  tyfcbAed: number
}

/** Raw row shape as returned by the network-growth API (before normalisation) */
interface RawMonthRow {
  month: string           // 'YYYY-MM'
  uniqueMeetings?: number | string | null
  uniqueReferrals?: number | string | null
  upgrades?: number | string | null
  tyfcbAed?: number | string | null
}

// ─── Custom tooltip ────────────────────────────────────────────────────────────

interface TooltipEntry { dataKey: string; name: string; color: string; value: number }
interface TooltipProps { active?: boolean; payload?: TooltipEntry[]; label?: string }

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-4 text-xs">
      <p className="font-bold text-slate-700 mb-2">{label?.replace('\n', ' · ')}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-500">{entry.name}:</span>
          <span className="font-semibold text-slate-800">
            {entry.dataKey === 'tyfcbAed'
              ? `AED ${Number(entry.value).toLocaleString()}`
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode
  label: string
  value: string
  growth: string
  color: string
}
const KpiCard = ({ icon, label, value, growth, color }: KpiCardProps) => (
  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3">
    <div className="flex items-center justify-between">
      <div className={`p-2 rounded-xl ${color}`}>{icon}</div>
      <span className="flex items-center gap-1 text-emerald-600 text-xs font-bold">
        <ArrowUpRight className="w-3 h-3" /> {growth}
      </span>
    </div>
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
    </div>
  </div>
)

// ─── Main component ────────────────────────────────────────────────────────────

interface NetworkGrowthGraphProps {
  onClose: () => void
}

export function NetworkGrowthGraph({ onClose }: NetworkGrowthGraphProps) {
  const [mode, setMode] = useState<'monthly' | 'cumulative'>('monthly')
  const [rawData, setRawData] = useState<MonthRow[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [isLive, setIsLive] = useState(false)

  // ── Fetch live data ──────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    fetch('/api/community-roi/analytics/network-growth', { credentials: 'include' })
      .then(r => r.json())
      .then(json => {
        if (json?.success && Array.isArray(json.data) && json.data.length > 0) {
          const rows: MonthRow[] = json.data.map((r: RawMonthRow) => ({
            month:          r.month,
            // Format 'YYYY-MM' → 'May 2026' for axis label
            weekLabel: (() => {
              try {
                const [y, m] = r.month.split('-')
                return format(new Date(Number(y), Number(m) - 1, 1), 'MMM yyyy')
              } catch { return r.month }
            })(),
            uniqueMeetings:  Number(r.uniqueMeetings  || 0),
            uniqueReferrals: Number(r.uniqueReferrals || 0),
            upgrades:        Number(r.upgrades        || 0),
            tyfcbAed:        Number(r.tyfcbAed        || 0),
          }))
          setRawData(rows)
          setIsLive(true)
        } else {
          // No data yet — fall back to mock so the graph is never blank
          setRawData(null)
          setIsLive(false)
        }
      })
      .catch(() => { setRawData(null); setIsLive(false) })
      .finally(() => setLoading(false))
  }, [])

  // ── Chart data (live or mock) ────────────────────────────────────────────────
  const baseData: MonthRow[] = rawData ?? MOCK_DATA

  const chartData = useMemo(() => {
    if (mode === 'monthly') return baseData
    let cumMeetings = 0, cumReferrals = 0, cumUpgrades = 0, cumTyfcb = 0
    return baseData.map(w => {
      cumMeetings  += w.uniqueMeetings
      cumReferrals += w.uniqueReferrals
      cumUpgrades  += w.upgrades
      cumTyfcb     += w.tyfcbAed
      return { ...w, uniqueMeetings: cumMeetings, uniqueReferrals: cumReferrals, upgrades: cumUpgrades, tyfcbAed: cumTyfcb }
    })
  }, [baseData, mode])

  // ── Summary KPIs ─────────────────────────────────────────────────────────────
  const first = baseData[0]
  const last  = baseData[baseData.length - 1]
  const totalMeetings   = baseData.reduce((s, w) => s + w.uniqueMeetings,  0)
  const totalReferrals  = baseData.reduce((s, w) => s + w.uniqueReferrals, 0)
  const totalUpgrades   = baseData.reduce((s, w) => s + w.upgrades,        0)
  const totalTyfcb      = baseData.reduce((s, w) => s + w.tyfcbAed,        0)
  const pctGrowth = (a: number, b: number) =>
    b === 0 ? '—' : `+${Math.round(((a - b) / b) * 100)}%`
  const meetingGrowth  = pctGrowth(last.uniqueMeetings,  first.uniqueMeetings)
  const referralGrowth = pctGrowth(last.uniqueReferrals, first.uniqueReferrals)
  const tyfcbGrowth    = pctGrowth(last.tyfcbAed,        first.tyfcbAed)

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto bg-slate-50 rounded-t-3xl md:rounded-3xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-8 py-5 flex items-center justify-between rounded-t-3xl">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Network Growth Graph</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {loading
                ? 'Loading…'
                : isLive
                  ? 'Month-by-month improvement in meetings, referrals & business generated'
                  : 'Month-by-month improvement in meetings, referrals & business generated (illustrative)'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Monthly / Cumulative toggle */}
            <div className="flex bg-slate-100 rounded-xl p-1 text-xs font-semibold">
              <button
                onClick={() => setMode('monthly')}
                className={`px-4 py-1.5 rounded-lg transition-all ${
                  mode === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setMode('cumulative')}
                className={`px-4 py-1.5 rounded-lg transition-all ${
                  mode === 'cumulative' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                Cumulative
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-8 space-y-8">
          {loading ? (
            <div className="flex items-center justify-center py-24 gap-3 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">Loading growth data…</span>
            </div>
          ) : (
            <>
              {/* KPI summary row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard
                  icon={<Users className="w-4 h-4 text-blue-600" />}
                  label="Total Unique Meetings"
                  value={totalMeetings.toString()}
                  growth={meetingGrowth}
                  color="bg-blue-50"
                />
                <KpiCard
                  icon={<Handshake className="w-4 h-4 text-orange-500" />}
                  label="Total Unique Referrals"
                  value={totalReferrals.toString()}
                  growth={referralGrowth}
                  color="bg-orange-50"
                />
                <KpiCard
                  icon={<Zap className="w-4 h-4 text-violet-600" />}
                  label="Relationship Upgrades"
                  value={totalUpgrades.toString()}
                  growth={isLive ? `${totalUpgrades} total` : '—'}
                  color="bg-violet-50"
                />
                <KpiCard
                  icon={<DollarSign className="w-4 h-4 text-emerald-600" />}
                  label="Total TYFCB (AED)"
                  value={totalTyfcb >= 1000 ? `${(totalTyfcb / 1000).toFixed(0)}K` : totalTyfcb.toString()}
                  growth={tyfcbGrowth}
                  color="bg-emerald-50"
                />
              </div>

              {/* Main chart */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">
                      {mode === 'monthly' ? 'Monthly' : 'Cumulative'} Growth Trend
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isLive ? `${baseData.length} month${baseData.length !== 1 ? 's' : ''} of data` : 'Illustrative — upload meeting reports to see real data'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-500">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-sm bg-blue-500" />
                      Unique Meetings
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-sm bg-orange-400" />
                      Unique Referrals
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-full bg-violet-500" />
                      Upgrades
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" />
                      TYFCB (AED)
                    </span>
                  </div>
                </div>

                <div className="h-[380px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 60, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradMeetings" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradReferrals" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#f97316" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                      </defs>

                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />

                      <XAxis
                        dataKey="weekLabel"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        interval={0}
                      />

                      {/* Left Y — counts */}
                      <YAxis
                        yAxisId="count"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        width={32}
                      />

                      {/* Right Y — AED */}
                      <YAxis
                        yAxisId="aed"
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                        tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
                        width={44}
                      />

                      <Tooltip content={<CustomTooltip />} />

                      {/* TYFCB bars (drawn first = behind) */}
                      <Bar
                        yAxisId="aed"
                        dataKey="tyfcbAed"
                        name="TYFCB (AED)"
                        fill="#10b981"
                        opacity={0.18}
                        radius={[4, 4, 0, 0]}
                        barSize={28}
                      />

                      {/* Meetings area */}
                      <Area
                        yAxisId="count"
                        type="monotone"
                        dataKey="uniqueMeetings"
                        name="Unique Meetings"
                        stroke="#3b82f6"
                        strokeWidth={2.5}
                        fill="url(#gradMeetings)"
                        dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: '#3b82f6' }}
                      />

                      {/* Referrals area */}
                      <Area
                        yAxisId="count"
                        type="monotone"
                        dataKey="uniqueReferrals"
                        name="Unique Referrals"
                        stroke="#f97316"
                        strokeWidth={2.5}
                        fill="url(#gradReferrals)"
                        dot={{ r: 3, fill: '#f97316', strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: '#f97316' }}
                      />

                      {/* Upgrades line — dashed violet, shows relationship improvements */}
                      <Line
                        yAxisId="count"
                        type="monotone"
                        dataKey="upgrades"
                        name="Upgrades"
                        stroke="#7c3aed"
                        strokeWidth={2}
                        strokeDasharray="5 3"
                        dot={{ r: 4, fill: '#7c3aed', strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: '#7c3aed' }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Month-by-month table */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800">Monthly Breakdown</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Month</th>
                        <th className="text-right px-4 py-3 text-[10px] font-bold text-blue-400 uppercase tracking-wider">Unique Meetings</th>
                        <th className="text-right px-4 py-3 text-[10px] font-bold text-orange-400 uppercase tracking-wider">Unique Referrals</th>
                        <th className="text-right px-4 py-3 text-[10px] font-bold text-violet-500 uppercase tracking-wider">Upgrades</th>
                        <th className="text-right px-4 py-3 text-[10px] font-bold text-emerald-500 uppercase tracking-wider">TYFCB (AED)</th>
                        <th className="text-right px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">MoM Growth</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {baseData.map((w, i) => {
                        const prev = baseData[i - 1]
                        const momTyfcb = prev && prev.tyfcbAed > 0
                          ? Math.round(((w.tyfcbAed - prev.tyfcbAed) / prev.tyfcbAed) * 100)
                          : null
                        return (
                          <tr key={w.month} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-3 font-semibold text-slate-700">
                              {w.weekLabel}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-blue-600">
                              {w.uniqueMeetings}
                              {prev && w.uniqueMeetings > prev.uniqueMeetings && (
                                <span className="ml-1 text-emerald-500 text-[9px]">
                                  +{w.uniqueMeetings - prev.uniqueMeetings}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-orange-500">
                              {w.uniqueReferrals}
                              {prev && w.uniqueReferrals > prev.uniqueReferrals && (
                                <span className="ml-1 text-emerald-500 text-[9px]">
                                  +{w.uniqueReferrals - prev.uniqueReferrals}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-violet-600">
                              {w.upgrades > 0 ? (
                                <span className="inline-flex items-center gap-0.5">
                                  <ArrowUpRight className="w-3 h-3" /> {w.upgrades}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-600">
                              {w.tyfcbAed.toLocaleString()}
                            </td>
                            <td className="px-6 py-3 text-right">
                              {momTyfcb !== null ? (
                                <span className="inline-flex items-center gap-0.5 text-emerald-600 font-bold">
                                  <ArrowUpRight className="w-3 h-3" /> {momTyfcb}%
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {!isLive && (
                <p className="text-center text-[10px] text-slate-300 pb-2">
                  ✦ Showing illustrative data — upload member meeting reports via Import Data to see real month-by-month growth
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Fallback mock data (shown until real uploads come in) ─────────────────────

const MOCK_DATA: MonthRow[] = [
  { month: '2026-01', weekLabel: 'Jan 2026', uniqueMeetings: 3,  uniqueReferrals: 1, upgrades: 0, tyfcbAed: 5_000   },
  { month: '2026-02', weekLabel: 'Feb 2026', uniqueMeetings: 4,  uniqueReferrals: 2, upgrades: 0, tyfcbAed: 9_500   },
  { month: '2026-03', weekLabel: 'Mar 2026', uniqueMeetings: 5,  uniqueReferrals: 2, upgrades: 0, tyfcbAed: 14_000  },
  { month: '2026-04', weekLabel: 'Apr 2026', uniqueMeetings: 6,  uniqueReferrals: 3, upgrades: 0, tyfcbAed: 20_000  },
  { month: '2026-05', weekLabel: 'May 2026', uniqueMeetings: 7,  uniqueReferrals: 3, upgrades: 0, tyfcbAed: 26_000  },
  { month: '2026-06', weekLabel: 'Jun 2026', uniqueMeetings: 8,  uniqueReferrals: 4, upgrades: 0, tyfcbAed: 34_000  },
  { month: '2026-07', weekLabel: 'Jul 2026', uniqueMeetings: 9,  uniqueReferrals: 5, upgrades: 0, tyfcbAed: 43_000  },
  { month: '2026-08', weekLabel: 'Aug 2026', uniqueMeetings: 10, uniqueReferrals: 5, upgrades: 0, tyfcbAed: 53_000  },
  { month: '2026-09', weekLabel: 'Sep 2026', uniqueMeetings: 11, uniqueReferrals: 6, upgrades: 0, tyfcbAed: 65_000  },
  { month: '2026-10', weekLabel: 'Oct 2026', uniqueMeetings: 12, uniqueReferrals: 7, upgrades: 0, tyfcbAed: 80_000  },
  { month: '2026-11', weekLabel: 'Nov 2026', uniqueMeetings: 13, uniqueReferrals: 8, upgrades: 0, tyfcbAed: 96_000  },
  { month: '2026-12', weekLabel: 'Dec 2026', uniqueMeetings: 15, uniqueReferrals: 9, upgrades: 0, tyfcbAed: 115_000 },
]
