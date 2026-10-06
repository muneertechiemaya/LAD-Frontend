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
 *
 * HOW IT IS FUNDED
 * Through Stripe Checkout, like AI credits. This card never moves the balance
 * itself: it opens a checkout, and the backend credits the balance when Stripe
 * reports the payment completed — by the amount Stripe actually collected.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Megaphone, Plus, Loader2, Info, AlertTriangle, CheckCircle2, CreditCard } from 'lucide-react';
import { getWalletBalances, createBroadcastCheckout } from '@lad/frontend-features/billing';

import type { TenantWalletBalance as Balance } from '@lad/frontend-features/billing';

/** Currencies Meta's rate card is loaded for. Others have no rates yet, so a
 *  balance in one could be bought but never spent. Mirrors the backend. */
const FUNDABLE_CURRENCIES = ['AED', 'INR', 'USD'] as const;

/** Per-viewer note of a checkout in flight, so the return trip can tell when
 *  the webhook has landed. A convenience only — the card works without it. */
const PENDING_KEY = 'lad.broadcastCheckout.pending';
interface Pending { before: number; amount: number; currency: string; at: number }

type Return =
  | { state: 'none' }
  | { state: 'confirming' }
  | { state: 'confirmed'; amount: number; currency: string }
  | { state: 'slow' }
  | { state: 'cancelled' };

function readPending(): Pending | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as Pending) : null;
  } catch {
    return null;
  }
}
function writePending(p: Pending | null) {
  try {
    if (p) window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(p));
    else window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    /* storage unavailable — the return banner degrades to the generic message */
  }
}

/** Drop ?payment / ?wallet so a refresh does not replay the return banner. */
function clearReturnParams() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('payment');
    url.searchParams.delete('wallet');
    window.history.replaceState(null, '', url.toString());
  } catch {
    /* non-fatal */
  }
}

const available = (b: Balance | null) =>
  b && !b.uninitialised && b.balance !== null ? b.balance : 0;

export const BroadcastCreditsCard: React.FC = () => {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<string>('AED');
  const [error, setError] = useState<string | null>(null);
  const [ret, setRet] = useState<Return>({ state: 'none' });
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (): Promise<Balance | null> => {
    try {
      const balances = await getWalletBalances();
      const messages = balances.find((b) => b.kind === 'messages') ?? null;
      // The backend reports a balance it could not read as degraded rather than
      // as zero. Failure is not emptiness — rendering 0.00 here would state
      // "you have no funds", which is a different and alarming claim.
      if (messages?.degraded) {
        setBalance(null);
        setError('Could not read the broadcast balance.');
        return null;
      }
      setBalance(messages);
      setError(null);
      return messages;
    } catch {
      setError('Could not read the broadcast balance.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Returning from Stripe ────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isOurs = params.get('wallet') === 'broadcast';
    const payment = params.get('payment');

    if (!isOurs || !payment) {
      void load();
      return;
    }
    clearReturnParams();

    if (payment === 'cancelled') {
      writePending(null);
      setRet({ state: 'cancelled' });
      void load();
      return;
    }

    // payment === 'success'. Stripe redirects as soon as the card is charged;
    // the webhook that credits the balance can land a few seconds later. Poll
    // until the balance reflects it rather than showing the old number as if
    // the payment had gone nowhere.
    const pending = readPending();
    setRet({ state: 'confirming' });
    const deadline = Date.now() + 45_000;

    const tick = async () => {
      const b = await load();
      const now = available(b);
      if (pending && now >= pending.before + pending.amount - 0.005) {
        writePending(null);
        setRet({ state: 'confirmed', amount: pending.amount, currency: pending.currency });
        return;
      }
      if (Date.now() > deadline) {
        setRet({ state: 'slow' });
        return;
      }
      pollRef.current = setTimeout(tick, 2_500);
    };
    void tick();

    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [load]);

  const unit = balance?.currency || currency;

  const submit = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 1) {
      setError('Enter an amount of at least 1.');
      return;
    }
    // Tolerance, not equality: 10.1 * 100 is 1010.0000000000001 in floating point.
    if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) {
      setError('Use at most two decimal places.');
      return;
    }
    setRedirecting(true);
    setError(null);
    const cur = balance?.currency ?? currency;
    const origin = window.location.origin;
    try {
      const { url } = await createBroadcastCheckout({
        amount: value,
        currency: cur,
        successUrl: `${origin}/settings?tab=credits&payment=success&wallet=broadcast`,
        cancelUrl: `${origin}/settings?tab=credits&payment=cancelled&wallet=broadcast`,
      });
      writePending({ before: available(balance), amount: value, currency: cur, at: Date.now() });
      window.location.href = url;
    } catch (e) {
      setRedirecting(false);
      setError(e instanceof Error ? e.message : 'Could not open checkout.');
    }
  };

  return (
    <div className="bg-white dark:bg-[#000c3b] border border-[#E2E8F0] dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-[#E2E8F0] dark:border-gray-800 bg-[#F8F9FE] dark:bg-[#000c3b] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Megaphone className="h-5 w-5 text-[#0b1957] dark:text-blue-400 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-[#1E293B] dark:text-white">Broadcast balance</h3>
            <p className="text-xs text-[#64748B] dark:text-gray-400">
              WhatsApp message spend
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
        {ret.state === 'confirming' && (
          <div role="status" className="flex items-center gap-2 p-3 rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/20 text-xs text-blue-800 dark:text-blue-300">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            Payment received. Updating your balance…
          </div>
        )}
        {ret.state === 'confirmed' && (
          <div role="status" className="flex items-center gap-2 p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/20 text-xs text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {ret.currency} {ret.amount.toFixed(2)} added to your broadcast balance.
          </div>
        )}
        {ret.state === 'slow' && (
          <div role="status" className="flex items-center gap-2 p-3 rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/20 text-xs text-blue-800 dark:text-blue-300">
            <Info className="h-4 w-4 shrink-0" />
            Payment received. Your balance can take a minute to update — refresh if it hasn&apos;t.
          </div>
        )}
        {ret.state === 'cancelled' && (
          <div role="status" className="flex items-center gap-2 p-3 rounded-lg border border-[#E2E8F0] dark:border-gray-800 bg-[#F8F9FE] dark:bg-[#000724] text-xs text-[#64748B] dark:text-gray-400">
            <Info className="h-4 w-4 shrink-0" />
            Checkout cancelled. Nothing was charged.
          </div>
        )}

        <div>
          <p className="text-xs text-[#64748B] dark:text-gray-400 mb-1">Available</p>
          {loading ? (
            <Loader2 className="h-7 w-7 animate-spin text-[#0b1957] dark:text-blue-400" />
          ) : error && !balance ? (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : (
            <p className="text-3xl font-bold text-[#1E293B] dark:text-white tabular-nums">
              {available(balance).toFixed(2)} {unit}
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
                  Amount to add
                </label>
                <input
                  id="bc-amount"
                  type="number"
                  min="1"
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

            <p className="text-[11px] text-[#64748B] dark:text-gray-500 leading-relaxed">
              {balance?.currency
                ? <>This balance is held in {balance.currency}; top-ups must be in {balance.currency}. </>
                : <>Choose the currency Meta bills your WhatsApp number in — the first purchase sets it for this balance. </>}
              You&apos;ll pay by card on Stripe. 5% VAT and card processing are added at checkout,
              and the full amount above goes into the balance.
            </p>

            {error && (
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={submit}
                disabled={redirecting || !amount}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#0b1957] text-white hover:bg-[#0a1540] disabled:opacity-40 disabled:cursor-not-allowed dark:bg-blue-600 dark:hover:bg-blue-700 transition-colors cursor-pointer"
              >
                {redirecting
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Opening checkout…</>
                  : <><CreditCard className="h-4 w-4" /> Continue to payment</>}
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
