'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Users, MessageSquare, TrendingUp, Network } from 'lucide-react'
import { useNetworkStats } from '@lad/frontend-features/community-roi'

export default function NetworkStatsPanel() {
  const { data: stats, isLoading } = useNetworkStats()
  const [autoRefresh, setAutoRefresh] = useState(true)

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      // This will trigger a refetch through React Query
    }, 30000) // 30 seconds
    return () => clearInterval(interval)
  }, [autoRefresh])

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Members</p>
                <p className="text-3xl font-bold text-blue-600">{stats?.connectivityAnalysis.memberCount || 0}</p>
              </div>
              <Users className="w-12 h-12 text-blue-300" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Total Referrals</p>
                <p className="text-3xl font-bold text-green-600">{stats?.networkBreakdown.referrals || 0}</p>
              </div>
              <Network className="w-12 h-12 text-green-300" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Interactions Logged</p>
                <p className="text-3xl font-bold text-purple-600">{stats?.networkBreakdown.totalInteractions || 0}</p>
              </div>
              <MessageSquare className="w-12 h-12 text-purple-300" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">Avg Strength</p>
                <p className="text-3xl font-bold text-orange-600">{stats?.relationshipStrength.avgStrengthScore?.toFixed(1) || 0}</p>
              </div>
              <TrendingUp className="w-12 h-12 text-orange-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Network Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Network Breakdown</CardTitle>
            <CardDescription>Interaction statistics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Total Interactions</span>
                <Badge variant="outline">{stats?.networkBreakdown.totalInteractions || 0}</Badge>
              </div>
              <p className="text-xs text-slate-600">Meetings + Referrals combined</p>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Referrals</span>
                <Badge variant="outline" className="bg-blue-100">{stats?.networkBreakdown.referrals || 0}</Badge>
              </div>
              <p className="text-xs text-slate-600">Referrals made between members</p>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Total Business Value</span>
                <Badge variant="outline" className="bg-purple-100">
                  AED {stats?.businessValue.totalBusinessValue?.toFixed(2) || 0}
                </Badge>
              </div>
              <p className="text-xs text-slate-600">Sum of all referral values</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Relationship Strength</CardTitle>
            <CardDescription>Average network connectivity</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Avg Strength Score</span>
                <Badge variant="outline" className="bg-orange-100">
                  {stats?.relationshipStrength.avgStrengthScore?.toFixed(1) || 0}/100
                </Badge>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                <div
                  className="bg-gradient-to-r from-orange-400 to-red-500 h-2 rounded-full"
                  style={{ width: `${Math.min(((stats?.relationshipStrength.avgStrengthScore || 0) / 100) * 100, 100)}%` }}
                />
              </div>
            </div>

            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Max Engagement Score</span>
                <Badge variant="outline" className="bg-emerald-100">
                  {stats?.relationshipStrength.maxEngagementScore?.toFixed(1) || 0}/100
                </Badge>
              </div>
              <p className="text-xs text-slate-600">Highest engagement in network</p>
            </div>

            <div className="p-4 bg-cyan-50 rounded-lg border border-cyan-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Min Engagement Score</span>
                <Badge variant="outline" className="bg-cyan-100">
                  {stats?.relationshipStrength.minEngagementScore?.toFixed(1) || 0}/100
                </Badge>
              </div>
              <p className="text-xs text-slate-600">Lowest engagement in network</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connectivity Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Connectivity Analysis</CardTitle>
          <CardDescription>Network connectivity metrics</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg text-center">
            <p className="text-sm text-slate-600 mb-2">Average Connections per Member</p>
            <p className="text-3xl font-bold text-slate-900">
              {stats?.connectivityAnalysis.avgConnectionsPerMember?.toFixed(2) || 0}
            </p>
          </div>
          <div className="p-4 border rounded-lg text-center">
            <p className="text-sm text-slate-600 mb-2">Average Relationship Score</p>
            <p className="text-3xl font-bold text-slate-900">
              {stats?.connectivityAnalysis.avgRelationshipScore?.toFixed(1) || 0}
              <span className="text-lg text-slate-500">/10</span>
            </p>
          </div>
          <div className="p-4 border rounded-lg text-center">
            <p className="text-sm text-slate-600 mb-2">Network Density</p>
            <p className="text-3xl font-bold text-slate-900">
              {stats?.connectivityAnalysis.networkDensity?.toFixed(1) || 0}
              <span className="text-lg text-slate-500">%</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
