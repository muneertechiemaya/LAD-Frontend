'use client';

import React from 'react';
import { useNetworkStats } from '@lad/frontend-features/community-roi';

/**
 * Simple Analytics Cards - can be embedded anywhere
 */
export default function SimpleAnalyticsCards() {
  const { data, isLoading, error } = useNetworkStats(true);

  if (isLoading) {
    return (
      <div className="text-center p-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderBottomColor: '#172461' }}></div>
        <p className="text-gray-600 mt-2 dark:text-slate-300">Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 bg-red-50 border border-red-200 rounded-lg dark:bg-red-500/10">
        <p className="text-red-700 font-semibold dark:text-red-300">Unable to load analytics data</p>
        <p className="text-red-700 text-sm mt-2 dark:text-red-300">{String(error)}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center p-8 bg-orange-50 border border-orange-200 rounded-lg dark:bg-orange-500/10">
        <p className="text-orange-700 font-semibold dark:text-orange-300">No numbers yet</p>
        <p className="text-orange-700 text-sm mt-2 dark:text-orange-300">
          Add your members with Onboard New Member or Import Data, then log 1-to-1 meetings and referrals. Your community&apos;s results appear here.
        </p>
      </div>
    );
  }

  // Extract values from nested data structure
  const members = data.connectivityAnalysis?.memberCount || 0;
  const meetings = data.networkBreakdown?.meetings || 0;
  const referrals = data.networkBreakdown?.referrals || 0;
  const density = data.connectivityAnalysis?.networkDensity || 0;

  // New KPIs
  const avgConnectionsPerMember = data.connectivityAnalysis?.avgConnectionsPerMember || 0;
  const avgRelationshipScore = data.relationshipStrength?.avgStrengthScore || 0;
  const totalBusinessValue = data.businessValue?.totalBusinessValue || 0;
  const avgReferralValue = data.businessValue?.avgReferralValue || 0;
  
  // Last refresh date
  const refreshedAt = data.calculatedAt ? new Date(data.calculatedAt).toLocaleString() : 'Unknown';

  return (
    <div className="space-y-4">
      {/* Header with Last Refreshed */}
      <div className="px-4 pt-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-slate-100">Network Analytics</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400">Last refreshed: {refreshedAt}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4">
        {/* Members - REAL DATA with custom blue #172461 */}
        <div className="rounded-lg p-6 text-center bg-[#f0f2ff] border-2 border-[#172461] dark:bg-indigo-500/10 dark:border-indigo-400/50">
          <div className="text-5xl font-bold text-[#172461] dark:text-indigo-100">{members}</div>
          <div className="text-sm mt-2 font-medium text-[#172461] dark:text-indigo-200">Members</div>
          <div className="text-xs mt-1 text-[#172461]/80 dark:text-indigo-200/90">Active community members</div>
        </div>

        {/* Meetings - REAL DATA */}
        <div className="bg-green-100 border-2 border-green-300 rounded-lg p-6 text-center dark:bg-green-500/10 dark:border-green-700/60">
          <div className="text-5xl font-bold text-green-900 dark:text-green-100">{meetings.toLocaleString()}</div>
          <div className="text-sm text-green-700 mt-2 font-medium dark:text-green-300">Meetings</div>
          <div className="text-xs text-green-700 mt-1 dark:text-green-300">One-to-one interactions</div>
        </div>

        {/* Referrals - REAL DATA */}
        <div className="bg-purple-100 border-2 border-purple-300 rounded-lg p-6 text-center dark:bg-purple-500/10 dark:border-purple-700/60">
          <div className="text-5xl font-bold text-purple-900 dark:text-purple-100">{referrals.toLocaleString()}</div>
          <div className="text-sm text-purple-700 mt-2 font-medium dark:text-purple-300">Referrals</div>
          <div className="text-xs text-purple-700 mt-1 dark:text-purple-300">Business referrals exchanged</div>
        </div>

        {/* Total Business Value */}
        <div className="bg-indigo-100 border-2 border-indigo-300 rounded-lg p-6 text-center dark:bg-indigo-500/10 dark:border-indigo-700/60">
          <div className="text-5xl font-bold text-indigo-900 dark:text-indigo-100">${totalBusinessValue.toLocaleString()}</div>
          <div className="text-sm text-indigo-700 mt-2 font-medium dark:text-indigo-300">Business Value</div>
          <div className="text-xs text-indigo-700 mt-1 dark:text-indigo-300">Total value generated</div>
        </div>

        {/* Avg Connections Per Member */}
        <div className="bg-blue-100 border-2 border-blue-300 rounded-lg p-6 text-center dark:bg-blue-500/10 dark:border-blue-700/60">
          <div className="text-5xl font-bold text-blue-900 dark:text-blue-100">{avgConnectionsPerMember.toFixed(1)}</div>
          <div className="text-sm text-blue-700 mt-2 font-medium dark:text-blue-300">Contacts per member</div>
          <div className="text-xs text-blue-700 mt-1 dark:text-blue-300">Average people each member has met</div>
        </div>

        {/* Avg Relationship Score */}
        <div className="bg-teal-100 border-2 border-teal-300 rounded-lg p-6 text-center dark:bg-teal-500/10 dark:border-teal-700/60">
          <div className="text-5xl font-bold text-teal-900 dark:text-teal-100">{avgRelationshipScore.toFixed(2)}</div>
          <div className="text-sm text-teal-700 mt-2 font-medium dark:text-teal-300">Relationship Score</div>
          <div className="text-xs text-teal-700 mt-1 dark:text-teal-300">Average strength between members</div>
        </div>

        {/* Density - REAL DATA */}
        <div className="bg-orange-100 border-2 border-orange-300 rounded-lg p-6 text-center dark:bg-orange-500/10 dark:border-orange-700/60">
          <div className="text-5xl font-bold text-orange-900 dark:text-orange-100">{density.toFixed(1)}%</div>
          <div className="text-sm text-orange-700 mt-2 font-medium dark:text-orange-300">Members who have met</div>
          <div className="text-xs text-orange-700 mt-1 dark:text-orange-300">Share of member pairs with a 1-to-1</div>
        </div>

        {/* Avg Referral Value */}
        <div className="bg-rose-100 border-2 border-rose-300 rounded-lg p-6 text-center dark:bg-rose-500/10 dark:border-rose-700/60">
          <div className="text-5xl font-bold text-rose-900 dark:text-rose-100">${avgReferralValue.toLocaleString()}</div>
          <div className="text-sm text-rose-700 mt-2 font-medium dark:text-rose-300">Value per referral</div>
          <div className="text-xs text-rose-700 mt-1 dark:text-rose-300">Per referral average</div>
        </div>
      </div>
    </div>
  );
}

