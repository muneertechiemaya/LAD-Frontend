'use client';
import React from 'react';
import { BillingDashboard } from '../BillingDashboard';
import { TransactionHistory } from '../billing/TransactionHistory';

/**
 * Billing = summary + usage (BillingDashboard) followed by the transaction list.
 * There used to be a tab strip here: an "Overview" tab of placeholder text, a
 * "Usage Analytics" tab repeating the usage card already shown above, and
 * Transactions - icon-only on phones, so nobody could tell what they were.
 */
export const BillingSettings: React.FC = () => {
  return (
    <div className="space-y-8 min-h-screen px-2 py-6 sm:px-4 lg:px-6">
      {/* Main Billing Dashboard */}
      <div>
        <BillingDashboard />
      </div>

      <section className="dark:bg-[#071131] rounded-3xl shadow-md p-4 sm:p-6 border border-border dark:border-blue-950/40 text-slate-900 dark:text-slate-100">
        <TransactionHistory />
      </section>
    </div>
  );
};
