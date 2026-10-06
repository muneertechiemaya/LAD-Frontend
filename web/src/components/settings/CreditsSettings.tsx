'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Wallet, Plus, Loader2 } from 'lucide-react';
import { useCreditsBalance } from '@lad/frontend-features/billing';
import { AddCreditsModal } from '@/components/billing/AddCreditsModal';
import { BroadcastCreditsCard } from '@/components/settings/BroadcastCreditsCard';

/**
 * Monthly fee per connected channel. Must match CHANNEL_COST in LAD_backend
 * core/billing/services/subscriptionBillingService.js (social 50, email 30) -
 * this list used to say Google/Outlook 20 and left WhatsApp and Instagram out.
 */
const CHANNEL_FEES: Array<{ name: string; credits: number }> = [
  { name: 'LinkedIn account', credits: 50 },
  { name: 'WhatsApp Business number', credits: 50 },
  { name: 'Personal WhatsApp', credits: 50 },
  { name: 'Instagram account', credits: 50 },
  { name: 'Gmail inbox', credits: 30 },
  { name: 'Outlook inbox', credits: 30 },
];

export const CreditsSettings: React.FC = () => {
  const [showAddCreditsModal, setShowAddCreditsModal] = useState(false);

  // SDK hook for wallet balance. Package selection and checkout now live in
  // the shared AddCreditsModal, which reads packages from the backend.
  const { data: creditsData, isLoading: isLoadingBalance, dataUpdatedAt } = useCreditsBalance();

  // Extract balance from SDK response. A failed read is not a zero balance.
  const balanceFailed = creditsData === undefined && !isLoadingBalance;
  const balance = creditsData?.availableBalance ?? creditsData?.currentBalance ?? 0;
  // Was a hard-coded "Just now"; show when the balance was actually read.
  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : '—';

  // Check URL parameters to auto-open Add Credits modal
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('action') === 'add') {
        setShowAddCreditsModal(true);
        // Clean URL after opening modal
        window.history.replaceState({}, '', window.location.pathname + '?tab=credits');
      }
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Wallet Balance Card — AI, enrichment, LinkedIn. Broadcast spend is a
          SEPARATE balance below: Meta sets that price, we do not, so it cannot
          be denominated in plan-rated credits. */}
      <div className="bg-gradient-to-br from-primary to-primary/80 text-[#ffffff] p-6 rounded-xl shadow-lg dark:from-[#051139] dark:to-[#02081e] dark:border dark:border-blue-950/50">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Wallet className="h-5 w-5 mr-2 text-[#ffffff] dark:text-blue-400" />
            <h3 className="text-lg font-bold text-[#ffffff]">Wallet Balance</h3>
          </div>
          <button
            onClick={() => setShowAddCreditsModal(true)}
            className="bg-white/10 hover:bg-white/20 text-[#ffffff] px-3 py-1.5 max-lg:min-h-11 rounded-lg text-xs font-medium transition-colors flex items-center dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Credits
          </button>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 dark:text-gray-400 text-sm mb-1">Available Credits</p>
            {isLoadingBalance ? (
              <div className="flex items-center">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
              </div>
            ) : balanceFailed ? (
              <p className="text-base font-semibold dark:text-white">Couldn&apos;t load your balance. Refresh to try again.</p>
            ) : (
              <p className="text-4xl font-bold dark:text-white">
                {balance.toLocaleString('en-US', { maximumFractionDigits: 1 })}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-blue-100 dark:text-gray-400 text-xs">Updated</p>
            <p className="text-white dark:text-gray-300 text-sm font-medium">{lastUpdated}</p>
          </div>
        </div>
      </div>


      <BroadcastCreditsCard />
      {/* Add Credits Modal - shared popup used by every credit CTA. */}
      <AddCreditsModal open={showAddCreditsModal} onClose={() => setShowAddCreditsModal(false)} />

      {/* Credits Information */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 dark:bg-[#030a21]/60 dark:border-blue-950/40">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">How Credits Work</h3>
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-950 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold text-sm">
              1
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-1">Purchase Credits</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Add credits to your wallet at any time. Credits are valid for 1 month and can be used across all services.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-950 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold text-sm">
              2
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-1">Use them as you go</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Credits come off your balance as Mr LAD works: AI replies, voice calls, finding leads, and a monthly fee for each connected channel.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-950 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-semibold text-sm">
              3
            </div>
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-1">Track Usage</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                See what you used, day by day and by feature, on the{' '}
                <Link href="/settings?tab=billing" className="font-medium text-blue-600 underline dark:text-blue-400">
                  Billing tab
                </Link>
                .
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Credit Pricing Guide */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 dark:bg-[#030a21]/60 dark:border-blue-950/40">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Credit Pricing</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border border-gray-200 dark:border-blue-950/40 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900 dark:text-white">Voice calls</span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold">3 credits/min</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Per minute, includes call analytics</p>
          </div>
          <div className="p-4 border border-gray-200 dark:border-blue-950/40 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900 dark:text-white">Premium voice calls</span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold">4 credits/min</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">A more natural voice, includes call analytics</p>
          </div>
          <div className="p-4 border border-gray-200 dark:border-blue-950/40 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900 dark:text-white">Lead email and LinkedIn</span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold">2 credits</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Per lead found with an email address and LinkedIn profile</p>
          </div>
          <div className="p-4 border border-gray-200 dark:border-blue-950/40 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900 dark:text-white">Phone number</span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold">10 credits</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Per phone number found for a lead</p>
          </div>
          <div className="p-4 border border-gray-200 dark:border-blue-950/40 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900 dark:text-white">Lead profile summary</span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold">5 credits</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">An AI-written summary of a lead</p>
          </div>
          {CHANNEL_FEES.map((fee) => (
            <div key={fee.name} className="p-4 border border-gray-200 dark:border-blue-950/40 rounded-lg">
              <div className="flex items-center justify-between gap-3 mb-2">
                <span className="font-medium text-gray-900 dark:text-white">{fee.name}</span>
                <span className="shrink-0 text-blue-600 dark:text-blue-400 font-semibold">{fee.credits} credits/month</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">Monthly fee while the account is connected</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
