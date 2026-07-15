'use client';
import React, { useState, useEffect } from 'react';
import { Wallet, Plus, X, Loader2 } from 'lucide-react';
import { useCreditsBalance, useStripeCheckout } from '@lad/frontend-features/billing';
import { logger } from '@/lib/logger';
import { safeStorage } from '@lad/shared/storage';  

export const CreditsSettings: React.FC = () => {
  const [showAddCreditsModal, setShowAddCreditsModal] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');

  // SDK hooks for wallet and payment
  const { data: creditsData, isLoading: isLoadingBalance } = useCreditsBalance();
  const { mutate: createCheckout, isPending: isProcessing } = useStripeCheckout();

  const presetAmounts = [
    { value: 99, credits: 1000, label: 'Starter' },
    { value: 199, credits: 3000, label: 'Professional' },
    { value: 499, credits: 12000, label: 'Business' },
    { value: 999, credits: 12000, label: 'Enterprise' },
  ];

  // Extract balance from SDK response  
  const balance = creditsData?.availableBalance ?? creditsData?.currentBalance ?? 0;
  const lastUpdated = 'Just now';

  const handleProceedToPayment = async () => {
    const amount = customAmount ? parseFloat(customAmount) : selectedAmount;
    if (!amount || amount <= 0) {
      alert('Please select or enter a valid amount');
      return;
    }

    try {
      const token = safeStorage.getItem('token');
      if (!token) {
        alert('Please log in to proceed with payment');
        return;
      }

      // Call SDK hook to create Stripe checkout session
      createCheckout({
        amount,
        successUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/settings?tab=credits&payment=success`,
        cancelUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/settings?tab=credits&payment=cancelled`,
        metadata: {
          credits: amount,
        },
      });
    } catch (error) {
      logger.error('Error processing payment', { error: error instanceof Error ? error.message : 'Unknown error' });
      alert(`Failed to process payment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSelectAmount = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount(''); // Clear custom amount when preset is selected
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    setSelectedAmount(null); // Clear preset selection when custom amount is entered
  };

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
      {/* Wallet Balance Card */}
      <div className="bg-gradient-to-br from-primary to-primary/80 text-[#ffffff] p-6 rounded-xl shadow-lg dark:from-[#051139] dark:to-[#02081e] dark:border dark:border-blue-950/50">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <Wallet className="h-5 w-5 mr-2 text-[#ffffff] dark:text-blue-400" />
            <h3 className="text-lg font-bold text-[#ffffff]">Wallet Balance</h3>
          </div>
          <button
            onClick={() => setShowAddCreditsModal(true)}
            className="bg-white/10 hover:bg-white/20 text-[#ffffff] px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center dark:bg-blue-600 dark:hover:bg-blue-700"
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
            ) : (
              <p className="text-4xl font-bold dark:text-white">{balance.toLocaleString()}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-blue-100 dark:text-gray-500 text-xs">Last updated</p>
            <p className="text-white dark:text-gray-300 text-sm font-medium">{lastUpdated}</p>
          </div>
        </div>
      </div>

      {/* Add Credits Modal */}
      {showAddCreditsModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50" onClick={() => setShowAddCreditsModal(false)}>
          <div className="bg-white dark:bg-[#030a21] rounded-lg p-6 max-w-md w-full mx-4 border border-transparent dark:border-blue-950/50 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Add Credits</h3>
              <button
                onClick={() => setShowAddCreditsModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {presetAmounts.map((preset) => (
                  <button
                    key={preset.value}
                    onClick={() => handleSelectAmount(preset.value)}
                    className={`p-4 border-2 rounded-lg transition-colors text-center ${
                      selectedAmount === preset.value
                        ? 'border-blue-600 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30'
                        : 'border-gray-200 dark:border-blue-950/40 bg-transparent hover:border-blue-400 dark:hover:border-blue-900/60'
                    }`}
                  >
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{preset.credits.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">credits</p>
                    <p className="text-sm text-gray-700 dark:text-white mt-1 font-medium">${preset.value}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{preset.label}</p>
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Custom Amount</label>
                <input
                  type="number"
                  placeholder="Enter amount"
                  value={customAmount}
                  onChange={(e) => handleCustomAmountChange(e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 dark:focus:ring-blue-500 dark:bg-[#061033]/70 dark:text-white dark:placeholder-gray-600 ${
                    customAmount ? 'border-blue-600 dark:border-blue-500' : 'border-gray-300 dark:border-blue-950/60'
                  }`}
                  min="1"
                />
              </div>
              {(selectedAmount || customAmount) && (
                <div className="p-3 bg-blue-50 border border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/40 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-400">
                    <span className="font-semibold">You&apos;ll receive: </span>
                    {(() => {
                      const amount = parseFloat(customAmount) || selectedAmount || 0;
                      if (!amount || amount <= 0) return 'Select an amount';
                      const preset = presetAmounts.find(p => p.value === amount);
                      const credits = preset ? preset.credits : Math.round(amount * 10.1); // Approximate for custom amounts
                      return `${credits.toLocaleString()} credits for $${amount}`;
                    })()}
                  </p>
                </div>
              )}
              <div className="pt-4">
                <button
                  onClick={handleProceedToPayment}
                  disabled={(!selectedAmount && !customAmount) || isProcessing}
                  className={`w-full px-4 py-2.5 rounded-lg transition-colors flex items-center justify-center font-medium ${
                    (selectedAmount || customAmount) && !isProcessing
                      ? 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700'
                      : 'bg-gray-300 text-gray-500 dark:bg-blue-950/40 dark:text-gray-600 cursor-not-allowed'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Proceed to Payment'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
              <h4 className="font-medium text-gray-900 dark:text-white mb-1">Use for Services</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Credits are automatically deducted when you use services like voice calls, SMS messages, and lead generation.
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
                Monitor your credit usage and remaining balance in real-time from your wallet dashboard.
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
              <span className="font-medium text-gray-900 dark:text-white">Voice Calls (Cartesia)</span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold">3 cr/min</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Per minute (includes analytics)</p>
          </div>
          <div className="p-4 border border-gray-200 dark:border-blue-950/40 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900 dark:text-white">Premium Voice (ElevenLabs)</span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold">4 cr/min</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Higher quality voice + analytics</p>
          </div>
          <div className="p-4 border border-gray-200 dark:border-blue-950/40 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900 dark:text-white">Email + Linkedin URL</span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold">2 credits</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Per lead with email address and Linkedin Profile URL</p>
          </div>
          <div className="p-4 border border-gray-200 dark:border-blue-950/40 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900 dark:text-white">Phone Reveal</span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold">10 credits</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Per phone number revealed</p>
          </div>
          <div className="p-4 border border-gray-200 dark:border-blue-950/40 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900 dark:text-white">Profile Summary</span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold">5 credits</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">AI-generated profile summary</p>
          </div>
          <div className="p-4 border border-gray-200 dark:border-blue-950/40 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900 dark:text-white">LinkedIn Connection</span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold">50 cr/mo</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Monthly connection fee</p>
          </div>
          <div className="p-4 border border-gray-200 dark:border-blue-950/40 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900 dark:text-white">Google Connection</span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold">20 cr/mo</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Monthly connection fee</p>
          </div>
          <div className="p-4 border border-gray-200 dark:border-blue-950/40 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900 dark:text-white">Outlook Connection</span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold">20 cr/mo</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Monthly connection fee</p>
          </div>
        </div>
      </div>
    </div>
  );
};
