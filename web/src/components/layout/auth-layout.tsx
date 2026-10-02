"use client";
import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";
import Footer from "./Footer";
import { Sidebar } from "../sidebar";
import { HeaderLoader } from "./HeaderLoader";
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Pinned open, the sidebar is 256px wide instead of the 64px rail, so the
  // page has to move over with it rather than sit underneath. The sidebar
  // saves the preference and announces changes with `sidebar:pinned-changed`.
  const [sidebarPinned, setSidebarPinned] = useState(false);
  useEffect(() => {
    try {
      setSidebarPinned(window.localStorage.getItem('sidebar.pinned') === '1');
    } catch { /* localStorage blocked - stay on the rail margin */ }
    const onChange = (e: Event) => setSidebarPinned(!!(e as CustomEvent).detail?.pinned);
    window.addEventListener('sidebar:pinned-changed', onChange);
    return () => window.removeEventListener('sidebar:pinned-changed', onChange);
  }, []);

  // Public pages (landing, login, pricing, etc.) get full width layout
  return (
    // h-dvh, not h-screen: on iOS Safari 100vh includes the area under the
    // browser toolbar, so the bottom of every scrolling page sat behind it.
    // Desktop browsers have no dynamic toolbar, so dvh === vh there.
    <div className="flex h-dvh bg-background dark:bg-[#000724]">
      <Sidebar />
      <HeaderLoader />
      {/* --bottom-nav-h is set by MobileBottomNav only while it is showing. */}
      <main
        className={`flex-1 overflow-y-auto overflow-x-hidden ml-0 pt-14 md:pt-0 max-md:pb-[var(--bottom-nav-h,0px)] md:transition-[margin] md:duration-500 ${
          sidebarPinned ? "md:ml-64" : "md:ml-16"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
