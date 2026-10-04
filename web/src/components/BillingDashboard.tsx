'use client';
import React, { useState, useEffect } from 'react';
import { Wallet, TrendingUp, Calendar, DownloadCloud, Receipt, CreditCard } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';
import { CreditUsageAnalytics } from './CreditUsageAnalytics';
import Link from 'next/link';
import { getCreditsBalance, getCreditsBalanceLegacy, useWalletUsageAnalytics } from '@lad/frontend-features/billing';
import { formatCredits, creditsLabel } from '@/lib/credits-format';
interface CreditBalance {
  credits: number;
  lastRecharge: {
    amount: number;
    credits: number;
    date: string;
  } | null;
}
interface BillingDashboardProps {
  customerId?: string;
}
/**
 * Every credit-purchase CTA on this dashboard points here. CreditsSettings
 * reads action=add on mount, opens its Add Credits modal, then strips the
 * param back to ?tab=credits. Same target the pricing page CTA uses.
 */
const ADD_CREDITS_HREF = '/settings?tab=credits&action=add';
/** Days the balance lasts at the last-30-day pace, as words. */
const formatRunway = (days: number) => {
  if (days < 2) return 'about a day';
  if (days < 45) return `about ${Math.round(days)} days`;
  if (days < 365) return `about ${Math.round(days / 30)} months`;
  return 'over a year';
};
export const BillingDashboard: React.FC<BillingDashboardProps> = () => {
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Usage comes from the wallet ledger (credits) - the same source as the usage
  // card below, so "Used" here and "Total credits used" there always agree.
  const usageQuery = useWalletUsageAnalytics('30d');
  const used30 = usageQuery.data?.totalCreditsUsed;
  const usageFailed = usageQuery.data === undefined && !usageQuery.isLoading;
  useEffect(() => {
    fetchCreditBalance();
  }, []);
  const fetchCreditBalance = async () => {
    try {
      const walletData = await getCreditsBalance();

      setBalance({
        credits: walletData.availableBalance || walletData.currentBalance || 0,
        lastRecharge: null,
      });

    } catch (err) {
      // Fallback to legacy endpoint
      try {
        const legacyData = await getCreditsBalanceLegacy();
        setBalance({
          credits: legacyData.credits || legacyData.balance || 0,
          lastRecharge: legacyData.lastRecharge || null,
        });
      } catch (legacyErr) {
        console.error('Error fetching credit balance:', legacyErr);
        // A failed read is not a zero balance - say so instead of showing 0.
        setError("We couldn't load your balance. Please refresh the page to try again.");
      }
    } finally {
      setLoading(false);
    }
  };
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };
  if (loading) {
    return (
      <LoadingSpinner size="md" message="Loading billing information..." />
    );
  }
  if (error) {
    return (
      <div className="bg-card text-card-foreground p-6 rounded-3xl shadow-lg border border-border dark:bg-[#071131] dark:text-slate-100 dark:border-blue-950/40">
        <div className="text-center text-destructive mb-4">
          <Wallet className="h-8 w-8 mx-auto mb-2" />
          <span className="text-lg font-medium">Unable to Load Billing Information</span>
        </div>
        <p className="text-muted-foreground text-center dark:text-slate-300">{error}</p>
      </div>
    );
  }
  if (!balance) {
    return (
      <div className="bg-card text-card-foreground p-6 rounded-3xl shadow-lg border border-border dark:bg-[#071131] dark:text-slate-100 dark:border-blue-950/40">
        <div className="text-center">
          <Wallet className="h-12 w-12 mx-auto text-muted-foreground dark:text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-foreground dark:text-slate-100 mb-2">No Credit Balance</h3>
          <p className="text-muted-foreground dark:text-slate-300 mb-6">You don&apos;t have any credits yet.</p>
          <Link
            href={ADD_CREDITS_HREF}
            className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition-colors duration-200 dark:bg-blue-950 dark:text-white dark:hover:bg-blue-900"
          >
            <Wallet className="h-4 w-4 mr-2" />
            Add Credits
          </Link>
        </div>
      </div>
    );
  }
  // How long the balance lasts at the last-30-day pace (null = no usage to go on).
  const runwayDays = used30 && used30 > 0 ? balance.credits / (used30 / 30) : null;
  // "Low" means it will run out soon at the current pace - not a fixed number,
  // which used to warn a tenant with ~3 months of credits left.
  const isLow =
    balance.credits <= 0 ||
    (runwayDays !== null && runwayDays < 14) ||
    (usageFailed && balance.credits < 100);
  const isHighUsage = (used30 ?? 0) > 3000;
  const isAllSet = !isLow && runwayDays !== null && runwayDays >= 60 && balance.credits > 5000;
  return (
    <div className="space-y-6">
      {/* Credit Balance Summary */}
      <div className="bg-gradient-to-br from-primary to-primary/80 text-white p-6 rounded-3xl shadow-lg border border-border dark:from-blue-950 dark:via-[#071131] dark:to-[#071131] dark:border-blue-950/40">
        {/* Self-serve credit top-up is not offered here — no Add Credits action. */}
        <div className="flex items-center mb-6">
          <CreditCard className="h-5 w-5 mr-2 text-white" />
          <h3 className="text-lg font-bold">Billing Summary</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-6">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center mb-1 text-white">
              <Wallet className="h-4 w-4 mr-2 opacity-80" />
              <span className="text-xs font-medium opacity-80 uppercase tracking-wider">Current Balance</span>
            </div>
            <p className="text-3xl md:text-3xl font-bold">{formatCredits(balance.credits)}</p>
            <p className="text-xs opacity-80">credits available</p>
          </div>

          <div>
            <div className="flex items-center mb-1 text-white">
              <TrendingUp className="h-4 w-4 mr-2 opacity-80" />
              <span className="text-xs font-medium opacity-80 uppercase tracking-wider">Used</span>
            </div>
            <p className="text-xl md:text-2xl font-semibold">
              {used30 !== undefined ? formatCredits(used30) : '—'}
            </p>
            <p className="text-xs opacity-80">
              {usageQuery.isLoading ? 'loading…' : usageFailed ? "couldn't load usage" : 'credits, last 30 days'}
            </p>
          </div>

          <div className="text-right md:text-left">
            <div className="flex items-center justify-end md:justify-start mb-1 text-white">
              <Calendar className="h-4 w-4 mr-2 opacity-80" />
              <span className="text-xs font-medium opacity-80 uppercase tracking-wider">Lasts</span>
            </div>
            <p className="text-lg md:text-2xl font-semibold">
              {runwayDays !== null ? formatRunway(runwayDays) : '—'}
            </p>
            <p className="text-xs opacity-80">
              {runwayDays !== null
                ? 'at your current pace'
                : usageQuery.isLoading
                  ? 'loading…'
                  : usageFailed
                    ? "couldn't load usage"
                    : 'no usage in 30 days'}
            </p>
          </div>
        </div>

        {balance.lastRecharge && (
          <div className="mt-5 pt-4 border-t border-white/10">
            <p className="text-xs opacity-80 leading-relaxed">
              Last top-up: <span className="font-semibold">{creditsLabel(balance.lastRecharge.credits)}</span> on{' '}
              {formatDate(balance.lastRecharge.date)}
            </p>
          </div>
        )}
      </div>
      {/* Quick Actions - two cards since the Add Credits tile was removed. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/pricing"
          className="bg-card text-card-foreground p-6 rounded-3xl shadow-md transition-all duration-200 border border-border hover:border-primary dark:bg-[#071131] dark:text-slate-100 dark:border-blue-950/40 dark:hover:border-blue-500"
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">View Pricing</h3>
            <Receipt className="h-6 w-6 text-primary dark:text-blue-300" />
          </div>
          <p className="text-sm text-muted-foreground dark:text-slate-300">See what each feature costs in credits</p>
        </Link>
        <button
          className="bg-card text-card-foreground p-6 rounded-3xl shadow-md transition-all duration-200 border border-border hover:border-primary text-left dark:bg-[#071131] dark:text-slate-100 dark:border-blue-950/40 dark:hover:border-blue-500"
          onClick={() => window.print()}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">Save as PDF</h3>
            <DownloadCloud className="h-6 w-6 text-primary dark:text-blue-300" />
          </div>
          <p className="text-sm text-muted-foreground dark:text-slate-300">Print this page or save it as a PDF</p>
        </button>
      </div>
      {/* Credit Usage Analytics */}
      <CreditUsageAnalytics timeRange="30d" />
      {/* Credit Package Recommendations - only when there is something to say. */}
      {(isLow || isHighUsage || isAllSet) && (
      <div className="bg-card text-card-foreground p-6 rounded-3xl shadow-md border border-border dark:bg-[#071131] dark:text-slate-100 dark:border-blue-950/40">
        <h3 className="text-xl font-bold mb-4">Recommendations</h3>
        <div className="space-y-4">
          {isLow && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg dark:bg-yellow-950/20 dark:border-yellow-900/30">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400 dark:text-yellow-300" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                  <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
                    {balance.credits <= 0 ? "You're out of credits" : 'Credits running low'}
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-400">
                    <p>
                      {runwayDays !== null && balance.credits > 0
                        ? `At your current pace your credits last ${formatRunway(runwayDays)}. `
                        : ''}
                      Add credits so your campaigns and replies keep running.
                    </p>
                  </div>
                  <div className="mt-4">
                    <Link
                      href={ADD_CREDITS_HREF}
                      className="inline-flex min-h-11 items-center text-sm font-medium text-yellow-800 hover:text-yellow-900 dark:text-yellow-300 dark:hover:text-yellow-100 underline"
                    >
                      Add credits &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
          {isHighUsage && (
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg dark:bg-blue-950/20 dark:border-blue-900/40">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <TrendingUp className="h-5 w-5 text-blue-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">High usage</h3>
                  <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                    <p>
                      You used {creditsLabel(used30)} in the last 30 days. Larger credit packs cost less per credit.
                    </p>
                  </div>
                  <div className="mt-4">
                    <Link
                      href="/pricing"
                      className="inline-flex min-h-11 items-center text-sm font-medium text-blue-800 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-100 underline"
                    >
                      Compare packs &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
          {isAllSet && runwayDays !== null && (
            <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg dark:bg-emerald-950/20 dark:border-emerald-900/40">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800 dark:text-emerald-300">You&apos;re all set</h3>
                  <div className="mt-2 text-sm text-green-700 dark:text-emerald-400">
                    <p>
                      Your {creditsLabel(balance.credits)} should last {formatRunway(runwayDays)} at your current pace.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
};
