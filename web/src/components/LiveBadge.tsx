'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff } from 'lucide-react';

type LiveBadgeProps = {
  isConnected?: boolean;
  showOffline?: boolean;
  className?: string;
};

export function LiveBadge({ isConnected = true, showOffline = false, className }: LiveBadgeProps) {
  const connected = Boolean(isConnected);

  // Not live: say so only where the caller asks ("Offline" on the activity feed);
  // otherwise show nothing. It used to fall through to "Live" for a paused campaign.
  if (!connected && !showOffline) return null;
  if (!connected) {
  return (
    <Badge
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-red-500/30 bg-red-500/10 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400 ${className}`}
    >
      <WifiOff className="w-3 h-3" />
      Offline
    </Badge>
  );
}

return (
  <Badge
    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400 ${className}`}
  >
    <Wifi className="w-3 h-3" />
    Live
  </Badge>
);
}
