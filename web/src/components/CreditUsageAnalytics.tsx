'use client';
import React, { useState } from 'react';
import { TrendingUp, Search, Brain, Linkedin, BarChart3, Sparkles, MessageCircle, Zap, AlertCircle } from 'lucide-react';
import { useWalletUsageAnalytics } from '@lad/frontend-features/billing';
import { formatCredits, creditsLabel, pluralize, billingLabel } from '@/lib/credits-format';

interface FeatureUsage {
  featureName: string;
  totalCredits: number;
  usageCount: number;
  percentage: number;
  icon: string;
}
interface UsageAnalytics {
  totalCreditsUsed: number;
  topFeatures: FeatureUsage[];
  dailyUsage: Array<{
    date: string;
    credits: number;
  }>;
  monthlyTrend: {
    currentMonth: number;
    lastMonth: number;
    percentageChange: number;
  };
}
interface CreditUsageAnalyticsProps {
  timeRange?: '7d' | '30d' | '90d';
}
const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 } as const;
/**
 * The last 7 calendar days, oldest first, with 0 for days nothing was charged.
 * The API only returns days that had usage, so slicing its last 7 entries
 * showed e.g. Mon/Thu/Sat side by side as if they were consecutive.
 */
const lastSevenDays = (daily: Array<{ date: string; credits: number }>) => {
  const byDate = new Map(daily.map((d) => [d.date, d.credits]));
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (6 - i)));
    const key = day.toISOString().split('T')[0];
    return {
      key,
      // Ledger dates are UTC days; label them in UTC so they don't shift a day.
      label: day.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
      credits: byDate.get(key) ?? 0,
    };
  });
};
export const CreditUsageAnalytics: React.FC<CreditUsageAnalyticsProps> = ({
  timeRange = '30d'
}) => {
  const [selectedRange, setSelectedRange] = useState(timeRange);
  const { data, isLoading: loading, refetch, isFetching } = useWalletUsageAnalytics(selectedRange);
  const analytics = data as UsageAnalytics | undefined;
  const days = RANGE_DAYS[selectedRange];
  const getFeatureIcon = (icon: string) => {
    switch (icon) {
      case 'phone':     return <MessageCircle className="h-5 w-5" />;
      case 'search':    return <Search className="h-5 w-5" />;
      case 'linkedin':  return <Linkedin className="h-5 w-5" />;
      case 'brain':     return <Brain className="h-5 w-5" />;
      case 'zap':       return <Zap className="h-5 w-5" />;
      default:          return <BarChart3 className="h-5 w-5" />;
    }
  };
  const getFeatureColor = (icon: string) => {
    switch (icon) {
      case 'phone':     return 'bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400';
      case 'search':    return 'bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400';
      case 'linkedin':  return 'bg-green-100 text-green-600 dark:bg-green-950/40 dark:text-green-400';
      case 'brain':     return 'bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400';
      case 'zap':       return 'bg-yellow-100 text-yellow-600 dark:bg-yellow-950/40 dark:text-yellow-400';
      default:          return 'bg-muted text-muted-foreground dark:bg-blue-950/30 dark:text-slate-300';
    }
  };
  if (loading) {
    return (
      <div className="bg-card text-card-foreground dark:bg-[#071131] dark:text-slate-100 rounded-3xl shadow-md p-8 border border-border dark:border-blue-950/40">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary dark:border-blue-500"></div>
        </div>
      </div>
    );
  }
  // A failed load is not "0 credits used" - say so and offer a retry.
  if (!analytics) {
    return (
      <div className="bg-card text-card-foreground dark:bg-[#071131] dark:text-slate-100 rounded-3xl shadow-md p-6 border border-border dark:border-blue-950/40">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="font-medium">We couldn&apos;t load your credit usage.</p>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="mt-2 inline-flex min-h-11 items-center rounded-lg px-1 text-sm font-medium text-primary underline disabled:opacity-60 dark:text-blue-300"
            >
              {isFetching ? 'Trying again…' : 'Try again'}
            </button>
          </div>
        </div>
      </div>
    );
  }
  const week = lastSevenDays(analytics.dailyUsage);
  const weekMax = Math.max(...week.map((d) => d.credits));
  const top = analytics.topFeatures[0];

  return (
    <div className="bg-card text-card-foreground dark:bg-[#071131] dark:text-white rounded-3xl shadow-md border border-border dark:border-blue-950/40">
      <div className="space-y-6 p-4 md:p-6">

        {/* Header with Time Range Selector */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-foreground dark:text-white">Credit Usage Analytics</h2>
            <p className="text-muted-foreground dark:text-slate-300">Track your credit consumption across features</p>
          </div>
          <div className="flex gap-3 justify-between md:justify-end">
            {['7d', '30d', '90d'].map((range) => (
              <button
                key={range}
                onClick={() => setSelectedRange(range as '7d' | '30d' | '90d')}
                className={`flex-1 md:flex-none p-3 rounded-2xl font-medium transition-all duration-300 border-2 flex flex-col items-center justify-center min-w-[70px] md:min-w-[80px] ${selectedRange === range
                    ? 'bg-blue-950 text-white border-blue-950 shadow-xl scale-105'
                    : 'bg-card text-muted-foreground border-border dark:bg-[#030a21]/60 dark:text-slate-300 dark:border-blue-950/40 hover:border-blue-500 dark:hover:bg-blue-950/10'
                  }`}
              >
                <span className="text-xs uppercase tracking-widest opacity-80 mb-0.5">Last</span>
                <span className="text-xl font-black leading-none">
                  {range === '7d' && '7'}
                  {range === '30d' && '30'}
                  {range === '90d' && '90'}
                </span>
                <span className="text-xs uppercase tracking-widest opacity-80 mt-0.5">days</span>
              </button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Credits Used */}
          <div className="bg-card text-card-foreground dark:bg-[#030a21]/60 rounded-3xl shadow-md p-6 border border-border border-l-4 border-l-blue-500 dark:border-l-blue-500 dark:border-blue-950/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-500 dark:text-slate-300 text-sm font-medium">Total Credits Used</span>
              <BarChart3 className="h-5 w-5 text-primary dark:text-blue-400" />
            </div>
            <div className="text-3xl font-bold text-foreground dark:text-white">
              {formatCredits(analytics.totalCreditsUsed)}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              in the last {days} days
            </p>
          </div>

          {/* Monthly Trend */}
          <div className="bg-card text-card-foreground dark:bg-[#030a21]/60 rounded-3xl shadow-md p-6 border border-border border-l-4 border-l-green-500 dark:border-l-green-500 dark:border-blue-950/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-500 dark:text-slate-300 text-sm font-medium">Change</span>
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex items-baseline">
              {/* The API compares against the previous window of the same length, not a calendar month. */}
              <span className="text-3xl font-bold text-foreground dark:text-white">
                {analytics.monthlyTrend.lastMonth > 0
                  ? `${analytics.monthlyTrend.percentageChange > 0 ? '+' : ''}${analytics.monthlyTrend.percentageChange.toFixed(0)}%`
                  : '—'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {analytics.monthlyTrend.lastMonth > 0
                ? `vs the ${days} days before (${creditsLabel(analytics.monthlyTrend.lastMonth)})`
                : `nothing used in the ${days} days before`}
            </p>
          </div>

          {/* Top Feature */}
          <div className="bg-card text-card-foreground dark:bg-[#030a21]/60 rounded-3xl shadow-md p-6 border border-border border-l-4 border-l-purple-500 dark:border-l-purple-500 dark:border-blue-950/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-500 dark:text-slate-300 text-sm font-medium">Most Used Feature</span>
              <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-xl font-bold text-foreground dark:text-white">
              {top ? billingLabel(top.featureName) : 'Nothing yet'}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {top
                ? `${creditsLabel(top.totalCredits)} (${top.percentage.toFixed(0)}%)`
                : `no credits used in the last ${days} days`}
            </p>
          </div>
        </div>

        {/* Feature Breakdown */}
        <div className="bg-card text-card-foreground dark:bg-[#030a21]/60 dark:text-white rounded-3xl shadow-md p-4 sm:p-6 border border-border dark:border-blue-950/40">
          <h3 className="text-lg font-semibold mb-4">Usage by Feature</h3>
          <div className="space-y-4">
            {analytics.topFeatures.length === 0 && (
              <p className="text-sm text-muted-foreground dark:text-slate-300">No credits used in the last {days} days.</p>
            )}
            {analytics.topFeatures.map((feature, index) => (
              <div key={index}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`shrink-0 p-2 rounded-lg ${getFeatureColor(feature.icon)}`}>
                      {getFeatureIcon(feature.icon)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-foreground dark:text-white break-words">{billingLabel(feature.featureName)}</div>
                      <div className="text-sm text-muted-foreground dark:text-slate-300">
                        {pluralize(feature.usageCount, 'use')}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold text-foreground dark:text-white">
                      {creditsLabel(feature.totalCredits)}
                    </div>
                    <div className="text-sm text-muted-foreground dark:text-slate-300">{feature.percentage.toFixed(0)}%</div>
                  </div>
                </div>
                <div className="w-full bg-muted dark:bg-[#061033]/70 rounded-full h-2">
                  <div
                    className="bg-primary dark:bg-blue-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${feature.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Usage Chart */}
        <div className="bg-card text-card-foreground rounded-xl shadow-md p-4 sm:p-6 border border-border dark:bg-[#030a21]/60 dark:border-blue-950/40">
          <h3 className="text-lg font-semibold text-foreground dark:text-white">Daily Usage</h3>
          <p className="text-xs text-muted-foreground dark:text-slate-300 mb-4">Credits used each day, last 7 days</p>
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {week.map((day) => {
              // Bar height in px so the value label above it never pushes it out of the box.
              const barPx = weekMax > 0 ? Math.max((day.credits / weekMax) * 104, day.credits > 0 ? 2 : 0) : 0;
              return (
                <div key={day.key} className="min-w-0 text-center">
                  {/* Value printed above the bar - a hover tooltip never shows on a phone. */}
                  <div className="h-32 flex flex-col items-center justify-end mb-2">
                    <span className="mb-1 text-[11px] font-medium leading-none text-foreground tabular-nums dark:text-slate-200">
                      {day.credits > 0 ? formatCredits(day.credits) : ''}
                    </span>
                    <div
                      className="w-full bg-primary dark:bg-blue-500 rounded-t-lg transition-all duration-500"
                      style={{ height: barPx }}
                      title={creditsLabel(day.credits)}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground dark:text-slate-300">
                    {day.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};
