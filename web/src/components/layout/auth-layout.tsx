"use client";
import React from "react";
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
  // Public pages (landing, login, pricing, etc.) get full width layout
  return (
    // h-dvh, not h-screen: on iOS Safari 100vh includes the area under the
    // browser toolbar, so the bottom of every scrolling page sat behind it.
    // Desktop browsers have no dynamic toolbar, so dvh === vh there.
    <div className="flex h-dvh bg-background dark:bg-[#000724]">
      <Sidebar />
      <HeaderLoader />
      {/* --bottom-nav-h is set by MobileBottomNav only while it is showing. */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden ml-0 md:ml-16 pt-14 md:pt-0 max-md:pb-[var(--bottom-nav-h,0px)]">
        {children}
      </main>
    </div>
  );
}
