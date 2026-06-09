'use client';
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ArrowUpRight, ArrowDownLeft, Copy, ExternalLink } from 'lucide-react';

interface Transaction {
  id: string;
  amount: string;
  type: 'credit' | 'debit';
  description: string;
  reference_type?: string;
  reference_id?: string;
  balance_after?: string;
  created_at: string;
  status: 'completed' | 'pending' | 'failed';
}

interface TransactionDetailModalProps {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  isOpen,
  onClose,
}) => {
  if (!transaction) return null;

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(num);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getStatusColor = (status: string = 'completed') => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-900/50';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-blue-950/30 dark:text-gray-400 dark:border-blue-900/40';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="dark:bg-[#030a21] dark:border-blue-950/60 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 dark:text-white">
            <div
              className={`p-2 rounded-full ${
                transaction.type === 'credit'
                  ? 'bg-green-100 dark:bg-emerald-950/40'
                  : 'bg-red-100 dark:bg-rose-950/40'
              }`}
            >
              {transaction.type === 'credit' ? (
                <ArrowDownLeft className="h-5 w-5 text-green-600 dark:text-emerald-400" />
              ) : (
                <ArrowUpRight className="h-5 w-5 text-red-600 dark:text-rose-400" />
              )}
            </div>
            Transaction Details
          </DialogTitle>
          <DialogDescription className="dark:text-gray-400">
            {transaction.type === 'credit' ? 'Credit' : 'Debit'} transaction
            from {formatDate(transaction.created_at)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Transaction ID */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
              Transaction ID
            </label>
            <div className="flex items-center justify-between mt-1 p-3 bg-gray-50 dark:bg-[#061033]/70 rounded-lg border border-transparent dark:border-blue-950/40">
              <code className="text-sm font-mono text-gray-900 dark:text-gray-300">
                {transaction.id.slice(0, 20)}...
              </code>
              <button
                onClick={() => copyToClipboard(transaction.id)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-blue-950/60 rounded transition-colors"
              >
                <Copy className="h-4 w-4 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
              Amount
            </label>
            <div className="mt-1 text-2xl font-bold">
              <span
                className={
                  transaction.type === 'credit'
                    ? 'text-green-600 dark:text-emerald-400'
                    : 'text-red-600 dark:text-rose-400'
                }
              >
                {transaction.type === 'credit' ? '+' : '-'}
                {formatCurrency(transaction.amount)}
              </span>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
              Status
            </label>
            <div className="mt-1">
              <Badge variant="outline" className={getStatusColor(transaction.status)}>
                {transaction.status.charAt(0).toUpperCase() +
                  transaction.status.slice(1)}
              </Badge>
            </div>
          </div>

          {/* Description */}
          {transaction.description && (
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                Description
              </label>
              <div className="mt-1 p-3 bg-gray-50 dark:bg-[#061033]/70 rounded-lg text-sm text-gray-900 dark:text-gray-300 border border-transparent dark:border-blue-950/40">
                {transaction.description}
              </div>
            </div>
          )}

          {/* Reference */}
          {transaction.reference_type && transaction.reference_id && (
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                Reference
              </label>
              <div className="mt-1 flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900/40">
                <div className="text-sm">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {transaction.reference_type}
                  </div>
                  <div className="text-gray-600 dark:text-gray-400">
                    {transaction.reference_id}
                  </div>
                </div>
                <button className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded transition-colors">
                  <ExternalLink className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </button>
              </div>
            </div>
          )}

          {/* Balance After */}
          {transaction.balance_after && (
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                Balance After Transaction
              </label>
              <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                {formatCurrency(transaction.balance_after)}
              </div>
            </div>
          )}

          {/* Timestamp */}
          <div className="pt-2 border-t border-gray-200 dark:border-blue-950/40">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
              Date & Time
            </label>
            <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {formatDate(transaction.created_at)}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
