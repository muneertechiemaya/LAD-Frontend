'use client';
import React, { useState, useMemo } from 'react';
import { ArrowUpRight, ArrowDownLeft, Calendar, Eye, Cpu, AlertCircle } from 'lucide-react';
import { useTransactions } from '@lad/frontend-features/billing';
import { formatCredits as formatCreditAmount, billingLabel } from '@/lib/credits-format';
import { LoadingSpinner } from '../LoadingSpinner';
import { TransactionDetailModal } from './TransactionDetailModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type TransactionType = 'credit' | 'debit' | 'all';
type TimeRange = '7d' | '30d' | '90d' | 'all';

export const TransactionHistory: React.FC = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [transactionType, setTransactionType] = useState<TransactionType>('all');
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Calculate date range
  const { startDate, endDate } = useMemo(() => {
    if (timeRange === 'all') return { startDate: undefined, endDate: undefined };
    const now = new Date();
    const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
    const days = daysMap[timeRange as '7d' | '30d' | '90d'];
    const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return { startDate: start.toISOString(), endDate: now.toISOString() };
  }, [timeRange]);

  // Fetch transactions
  const { data: txData, isLoading, refetch, isFetching } = useTransactions({
    type: transactionType !== 'all' ? transactionType : undefined,
    from: startDate,
    to: endDate,
    limit: 200,
  });

  // Credits-per-dollar from server (plan-aware)
  const creditsPerDollar: number = (txData as any)?.creditsPerDollar ?? (1000 / 99);
  const planTier: string | undefined = (txData as any)?.planTier;
  const hasRate = (txData as any)?.creditsPerDollar != null;

  // Normalize
  const normalizeTransaction = (tx: any) => ({
    ...tx,
    type: tx.type || (tx.transaction_type === 'topup' || tx.transaction_type === 'credit' ? 'credit' : 'debit'),
  });

  // Filter
  const filteredTransactions = useMemo(() => {
    if (!txData?.transactions) return [];
    const normalized = txData.transactions.map(normalizeTransaction);
    if (!searchTerm) return normalized;
    const s = searchTerm.toLowerCase();
    return normalized.filter((tx: any) =>
      tx.description?.toLowerCase().includes(s) ||
      tx.reference_type?.toLowerCase().includes(s) ||
      tx.reference_id?.toLowerCase().includes(s) ||
      (tx.type || tx.transaction_type)?.toLowerCase().includes(s)
    );
  }, [txData, searchTerm]);

  // Summary stats in credits
  const stats = useMemo(() => {
    if (!filteredTransactions.length) return { credits: 0, debits: 0, net: 0 };
    const added = filteredTransactions
      .filter((tx: any) => tx.type === 'credit')
      .reduce((sum: number, tx: any) => sum + (tx.credits_amount ?? Math.abs(parseFloat(tx.amount))), 0);
    const used = filteredTransactions
      .filter((tx: any) => tx.type === 'debit')
      .reduce((sum: number, tx: any) => sum + (tx.credits_amount ?? Math.abs(parseFloat(tx.amount))), 0);
    return { credits: added, debits: used, net: added - used };
  }, [filteredTransactions, creditsPerDollar]);

  // Formatters
  const formatCredits = (val: number) => formatCreditAmount(val) + ' credits';

  const formatDate = (date: string) =>
    new Date(date).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const getTypeColor = (type: string) =>
    type === 'credit' ? 'bg-green-100 text-green-800 dark:!bg-transparent dark:!border-transparent dark:!px-0 dark:!py-0 dark:!rounded-none dark:!font-extrabold dark:!text-emerald-400' : 'bg-red-100 text-red-800 dark:!bg-transparent dark:!border-transparent dark:!px-0 dark:!py-0 dark:!rounded-none dark:!font-extrabold dark:!text-rose-400';

  const getTypeIcon = (type: string) =>
    type === 'credit' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />;

  // Ledger types are accounting words; a client thinks in "added" and "used".
  const typeLabel = (type: string) => (type === 'credit' ? 'Added' : 'Used');

  const openDetails = (tx: any) => { setSelectedTransaction(tx); setIsDetailModalOpen(true); };

  const isLLMUsage = (tx: any) => tx.source === 'llm_usage' || tx.reference_type === 'llm_usage';

  const getCreditsAmount = (tx: any): number =>
    tx.credits_amount ?? Math.abs(parseFloat(tx.amount || '0'));

  const getCreditsBalance = (tx: any): number | null =>
    tx.credits_balance_after ?? (tx.balance_after != null ? parseFloat(tx.balance_after) : null);

  if (isLoading) return <LoadingSpinner size="md" message="Loading transaction history..." />;

  // A failed load is not "No transactions found" - say so and offer a retry.
  if (txData === undefined) {
    return (
      <div className="flex items-start gap-3 py-2">
        <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
        <div>
          <p className="font-medium text-gray-900 dark:text-white">We couldn&apos;t load your transactions.</p>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="mt-2 inline-flex min-h-11 items-center px-1 text-sm font-medium text-blue-600 underline disabled:opacity-60 dark:text-blue-300"
          >
            {isFetching ? 'Trying again…' : 'Try again'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Transactions</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Every credit added to and used from your account</p>
        </div>
        <div className="sm:text-right">
          <div className="text-sm text-gray-600 dark:text-gray-400">Net change</div>
          <div className={`text-2xl font-bold ${stats.net >= 0 ? 'text-green-600 dark:text-emerald-400' : 'text-red-600 dark:text-rose-400'}`}>
            {stats.net >= 0 ? '+' : '-'}
            {formatCredits(Math.abs(stats.net))}
          </div>
          {hasRate && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {planTier ? `${planTier.charAt(0).toUpperCase()}${planTier.slice(1)} plan · ` : ''}
              {creditsPerDollar.toFixed(1)} credits per $1
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#030a21]/60 rounded-lg shadow-md p-6 border border-transparent dark:border-blue-950/40 border-l-4 border-l-green-600 dark:border-l-emerald-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">Added</span>
            <ArrowUpRight className="h-5 w-5 text-green-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatCredits(stats.credits)}</div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Top-ups and refunds</p>
        </div>
        <div className="bg-white dark:bg-[#030a21]/60 rounded-lg shadow-md p-6 border border-transparent dark:border-blue-950/40 border-l-4 border-l-red-600 dark:border-l-rose-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">Used</span>
            <ArrowDownLeft className="h-5 w-5 text-red-600 dark:text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatCredits(stats.debits)}</div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Messages, AI and subscriptions</p>
        </div>
        <div className="bg-white dark:bg-[#030a21]/60 rounded-lg shadow-md p-6 border border-transparent dark:border-blue-950/40 border-l-4 border-l-blue-600 dark:border-l-blue-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">Transactions</span>
            <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{filteredTransactions.length}</div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">In selected period</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-[#030a21]/60 rounded-lg shadow-md p-6 border border-transparent dark:border-blue-950/40">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Time Range</label>

            <Select
              value={timeRange}
              onValueChange={(value) => setTimeRange(value as TimeRange)}
            >
              <SelectTrigger className="w-full h-auto flex-1 border border-gray-300 dark:border-blue-950/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-transparent px-3 text-left min-h-11">
                <SelectValue placeholder="Select time range" />
              </SelectTrigger>

              <SelectContent className="bg-white dark:bg-[#000724] border-slate-200 dark:border-[#262831]">
                <SelectItem
                  value="7d"
                  className="pl-3 pr-6 text-xs justify-start transition-colors cursor-pointer text-slate-800 dark:text-white dark:focus:bg-[#2563eb] dark:focus:text-white dark:data-[state=checked]:focus:bg-[#2563eb] dark:data-[state=checked]:focus:text-white">
                  Last 7 days
                </SelectItem>
                <SelectItem
                  value="30d"
                  className="pl-3 pr-6 text-xs justify-start transition-colors cursor-pointer text-slate-800 dark:text-white dark:focus:bg-[#2563eb] dark:focus:text-white dark:data-[state=checked]:focus:bg-[#2563eb] dark:data-[state=checked]:focus:text-white">
                  Last 30 days
                </SelectItem>
                <SelectItem
                  value="90d"
                  className="pl-3 pr-6 text-xs justify-start transition-colors cursor-pointer text-slate-800 dark:text-white dark:focus:bg-[#2563eb] dark:focus:text-white dark:data-[state=checked]:focus:bg-[#2563eb] dark:data-[state=checked]:focus:text-white">
                  Last 90 days
                </SelectItem>
                <SelectItem
                  value="all"
                  className="pl-3 pr-6 text-xs justify-start transition-colors cursor-pointer text-slate-800 dark:text-white dark:focus:bg-[#2563eb] dark:focus:text-white dark:data-[state=checked]:focus:bg-[#2563eb] dark:data-[state=checked]:focus:text-white">
                  All time
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</label>
            <Select
              value={transactionType}
              onValueChange={(value) => setTransactionType(value as TransactionType)}
            >
              <SelectTrigger className="w-full h-auto flex-1 border border-gray-300 dark:border-blue-950/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-transparent px-3 text-left min-h-11">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>

              <SelectContent className="bg-white dark:bg-[#000724] border-slate-200 dark:border-[#262831]">
                <SelectItem
                  value="all"
                  className="pl-3 pr-6 text-xs justify-start transition-colors cursor-pointer text-slate-800 dark:text-white dark:focus:bg-[#2563eb] dark:focus:text-white dark:data-[state=checked]:focus:bg-[#2563eb] dark:data-[state=checked]:focus:text-white">
                  All
                </SelectItem>
                <SelectItem
                  value="credit"
                  className="pl-3 pr-6 text-xs justify-start transition-colors cursor-pointer text-slate-800 dark:text-white dark:focus:bg-[#2563eb] dark:focus:text-white dark:data-[state=checked]:focus:bg-[#2563eb] dark:data-[state=checked]:focus:text-white">
                  Added
                </SelectItem>
                <SelectItem
                  value="debit"
                  className="pl-3 pr-6 text-xs justify-start transition-colors cursor-pointer text-slate-800 dark:text-white dark:focus:bg-[#2563eb] dark:focus:text-white dark:data-[state=checked]:focus:bg-[#2563eb] dark:data-[state=checked]:focus:text-white">
                  Used
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search descriptions"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-blue-950/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-[#061033]/70 dark:text-white dark:placeholder-gray-600 min-h-11"
            />
          </div>
        </div>
      </div>

      {/* Phones: one tappable row per transaction instead of a 7-column table
          scrolled sideways inside a 320px box. */}
      <div className="sm:hidden bg-white dark:bg-[#030a21]/60 rounded-lg shadow-md border border-transparent dark:border-blue-950/40">
        {filteredTransactions.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Calendar className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-600 mb-3" />
            <p className="text-gray-600 dark:text-gray-400">No transactions in this period</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200 dark:divide-blue-950/30">
            {filteredTransactions.map((transaction: any) => {
              const creditsBal = getCreditsBalance(transaction);
              const isCredit = transaction.type === 'credit';
              return (
                <li key={transaction.id}>
                  <button
                    type="button"
                    onClick={() => openDetails(transaction)}
                    className="flex w-full min-h-11 items-start justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-[#061033]/40"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                        {transaction.description || (transaction.reference_type ? billingLabel(transaction.reference_type) : typeLabel(transaction.type))}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {formatDate(transaction.created_at)}
                        {isLLMUsage(transaction) ? ' · AI' : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-sm font-semibold ${isCredit ? 'text-green-600 dark:text-emerald-400' : 'text-red-600 dark:text-rose-400'}`}>
                        {isCredit ? '+' : '-'}{formatCreditAmount(getCreditsAmount(transaction))}
                      </p>
                      {creditsBal != null && (
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Balance {formatCreditAmount(creditsBal)}</p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Transactions Table */}
      <div className="hidden sm:block bg-white dark:bg-[#030a21]/60 rounded-lg shadow-md overflow-hidden border border-transparent dark:border-blue-950/40">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-blue-950/40">
            <thead className="bg-gray-50 dark:bg-[#051139]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Related to</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Credits</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Balance After</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"><span className="sr-only">Details</span></th>
            </tr>
            </thead>
            <tbody className="bg-white dark:bg-transparent divide-y divide-gray-200 dark:divide-blue-950/30">
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  <Calendar className="h-16 w-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">No transactions in this period</p>
                </td>
              </tr>
            ) : (
              filteredTransactions.map((transaction: any) => {
                const creditsAmt = getCreditsAmount(transaction);
                const creditsBal = getCreditsBalance(transaction);
                const isAI = isLLMUsage(transaction);
                return (
                  <tr key={transaction.id} className="hover:bg-gray-50 dark:hover:bg-[#061033]/40 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(transaction.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeColor(transaction.type)}`}>
                            {getTypeIcon(transaction.type)}
                            {typeLabel(transaction.type)}
                          </span>
                        {isAI && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:!bg-transparent dark:!border-transparent dark:!px-0 dark:!py-0 dark:!rounded-none dark:!font-extrabold dark:!text-sky-400">
                              <Cpu className="h-3 w-3" />
                              AI
                            </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-xs truncate">
                      {transaction.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {/* No link button: it had no target, so it did nothing when clicked. */}
                      {transaction.reference_type ? (
                        <span>{billingLabel(transaction.reference_type)}</span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                        <span className={transaction.type === 'credit' ? 'text-green-600 dark:text-emerald-400' : 'text-red-600 dark:text-rose-400'}>
                          {transaction.type === 'credit' ? '+' : '-'}
                          {formatCredits(creditsAmt)}
                        </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                      {creditsBal != null ? formatCredits(creditsBal) : <span className="text-gray-400 dark:text-gray-600">-</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => openDetails(transaction)}
                        aria-label="View transaction details"
                        className="inline-flex min-h-11 items-center gap-1 px-3 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                        title="View transaction details"
                      >
                        <Eye className="h-4 w-4" />
                        <span className="text-xs font-medium hidden sm:inline">View</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        transaction={selectedTransaction}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
      />
    </div>
  );
};
