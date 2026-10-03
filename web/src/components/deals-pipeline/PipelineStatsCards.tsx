'use client';
import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { BookUser, Link2, BadgeCheck, Send } from 'lucide-react';

const SkeletonCard = () => (
  <div className="w-[calc(50%-8px)] md:w-[calc(25%-12px)]">
    <div className="bg-white dark:bg-[#000724] rounded-[20px] border border-slate-200 dark:border-[#262831] shadow-sm w-full flex flex-col h-full min-h-[120px]">
      <div className="flex-1 flex flex-col p-4">
        <div className="flex flex-col h-full">
          <div className="flex justify-end mb-2">
            <div className="w-8 h-8 bg-gray-200 dark:bg-slate-800 dark:bg-[#253456] rounded-full animate-pulse"></div>
          </div>
          <div className="flex-1 flex flex-col justify-end">
            <div className="h-4 bg-gray-200 dark:bg-slate-800 dark:bg-[#253456] rounded animate-pulse mb-2 w-3/4"></div>
            <div className="h-8 bg-gray-200 dark:bg-slate-800 dark:bg-[#253456] rounded animate-pulse w-1/2"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// The final number, straight away. A count-up made people read a half-way
// value (544 of 4,370) as the real total, and froze mid-count in a background tab.
const nf = new Intl.NumberFormat();

interface StatCardProps {
  title: string;
  /** What the number counts, in plain words. */
  hint: string;
  icon: React.ReactNode;
  bgColor: string;
  renderValue: () => React.ReactNode;
  onClick?: () => void;
  isSelected?: boolean;
}

const StatCard = ({ title, hint, icon, bgColor, renderValue, onClick, isSelected }: StatCardProps) => (
  <div className="w-[calc(50%-8px)] md:w-[calc(25%-12px)]">
    <div
      className={`bg-white dark:bg-[#000724] rounded-[20px] border-2 w-full flex flex-col h-full min-h-[120px] transition-all duration-300 ease-out
        ${onClick ? 'cursor-pointer hover:shadow-xl hover:shadow-primary-500/20 hover:scale-[1.05] hover:-translate-y-1 hover:border-primary-300 active:scale-[0.98]' : ''}
        ${isSelected ? 'border-primary-400 shadow-lg shadow-primary-500/30 ring-2 ring-primary-400/50' : 'border-slate-200 dark:border-[#262831]'}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
    >
      <div className="flex-1 flex flex-col p-4">
        <div className="flex flex-col h-full">
          <div className="flex justify-end mb-2">
            <Avatar className={`${bgColor} w-12 h-12 rounded-full`}>
              <AvatarFallback className={bgColor}>{icon}</AvatarFallback>
            </Avatar>
          </div>
          <div className="flex-1 flex flex-col justify-end">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
              {title}
            </p>
            <h5 className="text-2xl font-bold text-slate-800 dark:text-white">{renderValue()}</h5>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{hint}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

interface PipelineStatsCardsProps {
  totalLeads: number;
  connectionSentCount: number;
  contacted: number;
  messageSentCount: number;
  loading?: boolean;
  /** The stats request failed: show "—", not a 0 that reads as an empty pipeline. */
  failed?: boolean;
  onCardClick?: (cardKey: string) => void;
  selectedCard?: string | null;
}

export default function PipelineStatsCards({
  totalLeads,
  connectionSentCount,
  contacted,
  messageSentCount,
  loading = false,
  failed = false,
  onCardClick,
  selectedCard,
}: PipelineStatsCardsProps) {
  if (loading) {
    return (
      <div className="flex gap-4 mb-4 flex-wrap items-stretch">
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    );
  }

  const value = (n: number) => (failed ? <span aria-label="Not available">—</span> : nf.format(n || 0));

  return (
    <div className="flex gap-4 mb-4 flex-wrap items-stretch">
      <StatCard
        title="All leads"
        hint="Everyone in your pipeline"
        renderValue={() => value(totalLeads)}
        icon={<BookUser className="w-6 h-6 text-blue-700" />}
        bgColor="bg-blue-100"
        onClick={onCardClick ? () => onCardClick('total') : undefined}
        isSelected={selectedCard === 'total'}
      />

      <StatCard
        title="Reached on LinkedIn"
        hint="Leads a campaign sent a LinkedIn invite or message"
        renderValue={() => value(connectionSentCount)}
        icon={<Link2 className="w-6 h-6 text-black-600" />}
        bgColor="bg-slate-100"
        onClick={onCardClick ? () => onCardClick('connection_sent') : undefined}
        isSelected={selectedCard === 'connection_sent'}
      />

      <StatCard
        title="Contacted"
        hint="Leads in any stage after New, Profile visited and Connection sent"
        renderValue={() => value(contacted)}
        icon={<BadgeCheck className="w-6 h-6 text-green-600" />}
        bgColor="bg-green-100"
        onClick={onCardClick ? () => onCardClick('contacted') : undefined}
        isSelected={selectedCard === 'contacted'}
      />

      <StatCard
        title="Messages sent"
        hint="People messaged by a campaign, any channel"
        renderValue={() => value(messageSentCount)}
        icon={<Send className="w-6 h-6 text-purple-600" />}
        bgColor="bg-purple-100"
        onClick={onCardClick ? () => onCardClick('message_sent') : undefined}
        isSelected={selectedCard === 'message_sent'}
      />
    </div>
  );
}
