import { memo } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';

export interface DateSeparatorProps {
  date: Date | string | number;
  variant?: 'default' | 'linkedin' | 'whatsapp';
  className?: string;
  sticky?: boolean;
}

const variantStyles: Record<NonNullable<DateSeparatorProps['variant']>, string> = {
  default:
    'bg-slate-100/90 text-slate-600 border-slate-200/80 dark:bg-slate-800/90 dark:text-slate-200 dark:border-slate-700/60',
  linkedin:
    'bg-slate-100/90 text-slate-600 border-slate-200/80 dark:bg-[#1E293B]/90 dark:text-slate-300 dark:border-slate-700/60',
  whatsapp:
    'bg-[#f0f2f5]/95 text-[#54656f] border-[#e2e8f0]/80 dark:bg-[#1f2c34]/90 dark:text-slate-300 dark:border-slate-700/60',
};

export const DateSeparator = memo(function DateSeparator({
  date,
  variant = 'default',
  className,
  sticky = true,
}: DateSeparatorProps) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return null;

  let label: string;
  if (isToday(d)) {
    label = 'Today';
  } else if (isYesterday(d)) {
    label = 'Yesterday';
  } else {
    label = format(d, 'd MMMM yyyy');
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center my-2',
        sticky && 'sticky top-2 z-10 pointer-events-none',
        className
      )}
    >
      <div
        className={cn(
          'pointer-events-auto px-2.5 py-0.5 rounded-lg text-[10.5px] sm:text-[11px] font-medium tracking-tight border shadow-2xs backdrop-blur-xs select-none transition-colors duration-150',
          variantStyles[variant] || variantStyles.default
        )}
      >
        {label}
      </div>
    </div>
  );
});

