'use client';
import React, { useState } from 'react';
import { BillingDashboard } from '../BillingDashboard';
import { TransactionHistory } from '../billing/TransactionHistory';
import { CreditUsageAnalytics } from '../CreditUsageAnalytics';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, TrendingUp, Receipt } from 'lucide-react';

export const BillingSettings: React.FC = () => {
  // In a real application, you would get the customer ID from your authentication system
  // For now, we'll use a mock customer ID
  const customerId = 'cus_mock_customer_id';
  const [activeTab, setActiveTab] = useState('overview');

  return (
      <div className="space-y-8">
        {/* Main Billing Dashboard */}
        <div>
          <BillingDashboard customerId={customerId} />
        </div>

        {/* Tabs for detailed views */}
        <div className="bg-white dark:bg-[#030a21]/60 rounded-lg shadow-md p-6 border border-transparent dark:border-blue-950/40">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6 dark:bg-[#061033]/70 dark:border dark:border-blue-950/40">
              <TabsTrigger value="overview" className="flex items-center gap-2 dark:text-gray-400 dark:data-[state=active]:bg-blue-600 dark:data-[state=active]:text-white">
                <Wallet className="h-4 w-4" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger value="transactions" className="flex items-center gap-2 dark:text-gray-400 dark:data-[state=active]:bg-blue-600 dark:data-[state=active]:text-white">
                <Receipt className="h-4 w-4" />
                <span className="hidden sm:inline">Transactions</span>
              </TabsTrigger>
              <TabsTrigger value="usage" className="flex items-center gap-2 dark:text-gray-400 dark:data-[state=active]:bg-blue-600 dark:data-[state=active]:text-white">
                <TrendingUp className="h-4 w-4" />
                <span className="hidden sm:inline">Usage Analytics</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">Account Overview</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-[#061033]/80 dark:to-[#061033]/40 rounded-lg p-6 border border-transparent dark:border-blue-950/40">
                  <h3 className="font-medium text-gray-700 dark:text-white mb-2">Quick Stats</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    View your current balance, recent transactions, and usage summary.
                  </p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-[#061033]/80 dark:to-[#061033]/40 rounded-lg p-6 border border-transparent dark:border-blue-950/40">
                  <h3 className="font-medium text-gray-700 dark:text-white mb-2">Payment Methods</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Manage your payment methods and billing preferences.
                  </p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="transactions" className="space-y-4">
              <div className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Transaction History & Details
              </div>
              <TransactionHistory />
            </TabsContent>

            <TabsContent value="usage" className="space-y-4">
              <div className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Credit Usage Analytics
              </div>
              <CreditUsageAnalytics />
            </TabsContent>
          </Tabs>
        </div>
      </div>
  );
};