'use client';

/**
 * Broadcast balance — WhatsApp message spend, separate from AI credits.
 *
 * WHY IT IS A SECOND BALANCE AND NOT MORE CREDITS
 * A credit's value depends on the plan (10.1 / 15.08 / 24 per dollar). Meta's
 * price does not depend on anything of ours, so the same message costs an
 * enterprise tenant 2.4x less real money than a starter tenant — correct for a
 * marked-up service, incoherent for a pass-through one. And one rate cannot
 * express the spread: in India, marketing is 8.5x utility, and
 * authentication-international is 22x ordinary authentication.
 *
 * So this balance is MONEY, in the WABA's billing currency, at Meta's published
 * rate plus 20%.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Megaphone, Plus, Loader2, Info, AlertTriangle } from 'lucide-react';
import { getWalletBalances, topUpCredits } from '@lad/frontend-features/billing';

import type { TenantWalletBalance as Balance } from '@lad/frontend-features/billing';

/** Currencies Meta's rate card is loaded for. Others have no rates yet, so a
 *  top-up in one would create a balance nothing can price against. */
const FUNDABLE_CURRENCIES = ['AED', 'INR', 'USD'] as const;

export const BroadcastCreditsCard: React.FC = () => {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<string>('AED');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const balances = await getWalletBalances();
      setBalance(balances.find((b) => b.kind === 'messages') ?? null);
      setError(null);
    } catch {
      // A balance we cannot read is not a zero balance. Saying "0" here would
      // read as "you have no funds", which is a different and alarming claim.
      setError('Could not read the broadcast balance.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    setAdding(true);
    setError(null);
    try {
      await topUpCredits({
        amount: value,
        kind: 'messages',
        // Required by the API for a messages top-up: the balance is money in
        // the WABA's billing currency, and a wallet created without it would
        // default to USD and then be fed something else.
        currency: balance?.currency ?? currency,
        idempotencyKey: `ui_topup_messages_${Date.now()}`,
        description: `Broadcast balance top-up (${value} ${balance?.currency ?? currency})`,
      });
      setOpen(false);
      setAmount('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Top-up failed.');
    } finally {
      setAdding(false);
    }
  };

  const unit = balance?.currency || currency;

  return (
    <div className="bg-white dark:bg-[#000c3b] border border-[#E2E8F0] dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-[#E2E8F0] dark:border-gray-800 bg-[#F8F9FE] dark:bg-[#000c3b] flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Megaphone className="h-5 w-5 text-[#0b1957] dark:text-blue-400 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[#1E293B] dark:text-white">Broadcast balance</h3>
            <p className="text-xs text-[#64748B] dark:text-gray-400">
              WhatsApp message spend, billed at Meta&apos;s rate plus 20%
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setOpen((v) => !v); setError(null); }}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0b1957] text-white hover:bg-[#0a1540] dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Add funds
        </button>
      </div>

      <div className="p-6 space-y-4">
        <div>
          <p className="text-xs text-[#64748B] dark:text-gray-400 mb-1">Available</p>
          {loading ? (
            <Loader2 className="h-7 w-7 animate-spin text-[#0b1957] dark:text-blue-400" />
          ) : error && !balance ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : (
            <p className="text-3xl font-bold text-[#1E293B] dark:text-white tabular-nums">
              {balance?.uninitialised || !balance
                ? `0.00 ${unit}`
                : `${balance.balance.toFixed(2)} ${balance.currency ?? ''}`}
            </p>
          )}
        </div>

        {/* The thing a tenant would otherwise assume wrongly. Until the debit
            ships, broadcasts still draw the AI credit wallet — showing a
            balance without saying so would be the misleading part. */}
        <div className="flex gap-2 p-3 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            <strong>Not yet in use.</strong> Broadcasts are still charged to your AI credits
            at the old flat rate. This balance starts being spent when per-message
            billing is switched on — nothing you add here is lost in the meantime.
          </p>
        </div>

        <div className="flex gap-2 text-xs text-[#64748B] dark:text-gray-400">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Priced per message by destination and category, from Meta&apos;s published card.
            A marketing message to India is a different price from an authentication one,
            and an authentication message sent abroad is different again.
          </p>
        </div>

        {open && (
          <div className="pt-2 border-t border-[#E2E8F0] dark:border-gray-800 space-y-3">
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div>
                <label htmlFor="bc-amount" className="block text-xs font-medium text-[#1E293B] dark:text-white mb-1">
                  Amount
                </label>
                <input
                  id="bc-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="100.00"
                  className="w-full px-3 py-2 border border-[#E2E8F0] dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-[#000724] text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0b1957]/20 focus:border-[#0b1957]"
                />
              </div>
              <div>
                <label htmlFor="bc-currency" className="block text-xs font-medium text-[#1E293B] dark:text-white mb-1">
                  Currency
                </label>
                <select
                  id="bc-currency"
                  value={balance?.currency ?? currency}
                  disabled={Boolean(balance?.currency)}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="px-3 py-2 border border-[#E2E8F0] dark:border-gray-800 rounded-lg text-sm bg-white dark:bg-[#000724] text-gray-900 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {FUNDABLE_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {balance?.currency && (
              /* A balance holds one currency. Letting someone add INR to an AED
                 wallet would make the number meaningless. */
              <p className="text-[11px] text-[#64748B] dark:text-gray-500">
                This balance is held in {balance.currency}, matching how Meta bills your
                WhatsApp number.
              </p>
            )}
            {error && (
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={submit}
                disabled={adding || !amount}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#0b1957] text-white hover:bg-[#0a1540] disabled:opacity-40 disabled:cursor-not-allowed dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors cursor-pointer"
              >
                {adding ? <><Loader2 className="h-4 w-4 animate-spin" /> Adding…</> : 'Add funds'}
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); setError(null); }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[#64748B] dark:text-gray-300 hover:bg-[#F8F9FE] dark:hover:bg-[#000724] transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
