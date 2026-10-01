"use client";
import StudioLaunchBanner from '@/components/studio/StudioLaunchBanner';
import { HomeDashboard } from '@/components/home/HomeDashboard';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-[#F8F9FE] text-slate-900 dark:bg-[#000724] dark:text-white">
      <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6"><StudioLaunchBanner /></div>
      <HomeDashboard />
    </div>
  );
}
