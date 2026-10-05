"use client";
import { useState, useEffect, useMemo } from "react";
import {
  Home,
  Phone,
  Video,
  Search,
  CircleDollarSign,
  ClipboardList,
  GitFork,
  Cable,
  DollarSign,
  Settings,
  LogOut,
  User as UserIcon,
  ChevronDown,
  SwatchBook,
  ChartNoAxesCombined,
  Menu,
  X,
  Send,
  GraduationCap,
  MessageSquare,
  Goal,
  LayoutTemplate,
  Palette,
  Pin,
  PinOff,
  Contact,
  Gauge,
  SlidersHorizontal,
  UserPlus,
  Sparkles,
  Check,
  ListTodo,
  CalendarRange,
} from 'lucide-react';
import { NavLink } from "./NavLink";
import { MobileBottomNav } from "./layout/MobileBottomNav";
import { ThemeToggle } from "./ThemeToggle";
import AgentVisualizer from "@/components/ui/AgentVisualizer";
import { useMyTasksCount } from "@lad/frontend-features/tasks";
import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { useQueryClient } from "@tanstack/react-query";
import { logout as logoutAction } from "@/store/slices/authSlice";
import authService from "@/services/authService";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useTheme } from "@/contexts/ThemeContext";
import LAD3DShowcase from "@/app/page";
import { FEATURE } from '@/lib/page-permissions';

// Internal observability console is super-admin only - gated by email, matching
// the backend `requireSuperAdmin` gate on /api/admin/monitor.
const SUPER_ADMIN_EMAIL = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL || 'admin@techiemaya.com').toLowerCase();

type RootState = {
  auth: {
    user: {
      id?: string;
      name?: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      role?: string;
      avatar?: string;
      capabilities?: string[];
      tenantFeatures?: string[];
    } | null;
  };
  settings: {
    companyName: string;
    companyLogo: string;
  };
};

/**
 * Build a display name from whatever fields the backend populated.
 * First-login users frequently have `email` + `firstName` but no `name`.
 */
function resolveDisplayName(...candidates: Array<any>): string {
  for (const c of candidates) {
    if (!c) continue;
    // 1. Prefer explicit full name
    if (typeof c.name === 'string' && c.name.trim()) return c.name.trim();
    // 2. firstName (+ lastName)
    const fn = (c.firstName || c.first_name || '').toString().trim();
    const ln = (c.lastName  || c.last_name  || '').toString().trim();
    if (fn || ln) return [fn, ln].filter(Boolean).join(' ');
    // 3. username, then email local-part
    if (typeof c.username === 'string' && c.username.trim()) return c.username.trim();
    if (typeof c.email === 'string' && c.email.includes('@')) {
      const local = c.email.split('@')[0]
        .replace(/[._-]+/g, ' ')
        .replace(/\b\w/g, (m: string) => m.toUpperCase())
        .trim();
      if (local) return local;
    }
  }
  return 'User';
}
/**
 * Menu sections, in the order a lead moves: what needs you today, getting new
 * leads, turning them into customers, results, then setup. Items with no group
 * (Home, curated Pipelines) sit above the first header.
 */
type NavGroup = 'today' | 'grow' | 'convert' | 'measure' | 'setup';
const NAV_GROUP_LABEL: Record<NavGroup, string> = {
  today: 'Today',
  grow: 'Grow',
  convert: 'Convert',
  measure: 'Measure',
  setup: 'Setup',
};
const ASK_HREF = '/onboarding/advanced-search-ai';
const TASKS_HREF = '/tasks';

type NavItem = {
  href: string;
  group?: NavGroup;
  label: string;
  icon: any;
  details: string;
  requiredCapability?: string;
  /**
   * Tenant feature(s) that unlock this item. A LIST because the same feature is
   * spelled two ways in live data — tenant_features uses underscores, the
   * feature_flags table hyphens, and these literals were written in the wrong
   * vocabulary. See lib/page-permissions.ts. Any match passes.
   */
  requiredFeature?: readonly string[];
  /**
   * Show only for a workspace on a vertical snapshot. Used instead of
   * `requiredFeature` because the snapshot's feature key is vertical-specific
   * (`wellness.snapshot`, …) and this list needs a static predicate.
   */
  requiresCuratedWorkspace?: boolean;
  children?: Omit<NavItem, 'children'>[];
};
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const { hasFeature, user: authUser, isCuratedWorkspace } = useAuth();
  const { tenant, setTenantById, tenants } = useTenant();
  const { isDark } = useTheme();
  const reduxUser = useSelector((state: RootState) => state.auth.user);
  // Merge the two user sources. AuthContext has the full /api/auth/me payload
  // (email, firstName, lastName, tenantFeatures, capabilities); Redux user is
  // populated by the login action and sometimes only has `id` + `name`. Prefer
  // AuthContext when present and overlay Redux fields as a fallback.
  const user = useMemo(() => ({ ...(reduxUser || {}), ...(authUser || {}) }), [authUser, reduxUser]);
  const companyLogo = useSelector((state: RootState) => state.settings.companyLogo);
  // Hover-expand state. Suppressed when `isPinned` is true (then we stay
  // expanded regardless of cursor position).
  const [isHovered,   setIsHovered]   = useState(false);
  // Persisted user preference - when true, the sidebar stays expanded
  // permanently and the hover behaviour is disabled.
  const [isPinned,    setIsPinned]    = useState(false);
  // Effective expanded flag the rest of the file already consumes.
  const isExpanded = isPinned || isHovered;
  const [displayName, setDisplayName] = useState("User");
  const [isHydrated, setIsHydrated] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Mobile drawer: workspace list is folded behind the profile card.
  const [isMobileTenantListOpen, setIsMobileTenantListOpen] = useState(false);
  const [activeConversationChannel, setActiveConversationChannel] = useState<string | null>(null);

  // Listen for channel changes broadcasted from ConversationsPage
  useEffect(() => {
    const handleChannelChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setActiveConversationChannel(detail?.channel ?? null);
    };
    window.addEventListener('conversations:channel-changed', handleChannelChange);
    return () => window.removeEventListener('conversations:channel-changed', handleChannelChange);
  }, []);

  const isBlackGrayChannel =
    pathname.startsWith('/conversations') &&
    activeConversationChannel !== null &&
    activeConversationChannel !== 'linkedin';

  // Load + persist pin preference (localStorage). Runs after hydration so
  // SSR HTML matches the initial client render (always unpinned on first
  // paint) and then upgrades to the saved value.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('sidebar.pinned');
      if (saved === '1') setIsPinned(true);
    } catch { /* localStorage blocked - fine, default is unpinned */ }
  }, []);
  const togglePinned = () => {
    const next = !isPinned;
    setIsPinned(next);
    // Drop the hover state when unpinning so the sidebar collapses
    // immediately rather than waiting for the mouse to leave.
    if (!next) setIsHovered(false);
    try {
      window.localStorage.setItem('sidebar.pinned', next ? '1' : '0');
    } catch { /* ignore */ }
    // Notify the layout so the main content reflows to ml-64 (pinned) vs
    // ml-16 (rail). Dispatched from the click, not inside a state updater:
    // updaters run during render, and the listener sets the layout's state.
    window.dispatchEvent(new CustomEvent('sidebar:pinned-changed', { detail: { pinned: next } }));
  };
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const [isUserPanelOpen, setIsUserPanelOpen] = useState(true);
  // Closed by default: the point of the dropdown is that the tenant list costs
  // one row until somebody wants to switch.
  const [isTenantListOpen, setIsTenantListOpen] = useState(false);
  // Education vertical context
  const isEducation = hasFeature("education_vertical");
  // Hydration check
  useEffect(() => {
    setIsHydrated(true);
  }, []);
  // Compute display name from whichever fields are populated. Falls back
  // through name → firstName+lastName → username → email local-part → "User"
  // so a freshly-logged-in user never sees the literal placeholder "User".
  useEffect(() => {
    if (!isHydrated) return;
    setDisplayName(resolveDisplayName(authUser, reduxUser));
  }, [authUser, reduxUser, isHydrated]);
  const handleLogout = async () => {
    try {
      await authService.logout();
      dispatch(logoutAction());
      queryClient.clear();
      setTimeout(() => router.push("/login"), 1200);
    } catch (e) {
      dispatch(logoutAction());
      queryClient.clear();
      setTimeout(() => router.push("/login"), 1200);
    }
    setIsMobileMenuOpen(false);
  };
  // Define all possible navigation items with their required capabilities
  const allNavItems: NavItem[] = [
    {
      href: "/overview",
      label: "Home",
      icon: Home,
      details: "See your overall dashboard and metrics.",
      requiredCapability: "view_overview",
      requiredFeature: FEATURE.OVERVIEW,
    },
    // Curated workspaces only. Sits high because for a snapshot tenant this IS
    // the home screen - it replaces the workflow builder as the place they go
    // to decide what Mr LAD is doing. Lives in the Tenant Studio's Pipelines
    // room; `/pipelines` itself now redirects there.
    {
      href: "/studio?room=pipelines",
      label: "Pipelines",
      icon: SlidersHorizontal,
      details: "Switch the pipelines built for your industry on and off.",
      requiresCuratedWorkspace: true,
    },

    // ── Today: what needs a person now ──────────────────────────────────────
    {
      href: "/tasks",
      group: "today",
      label: "My Tasks",
      icon: ListTodo,
      details: "Chats waiting for a person, conversations assigned to you, and your notifications.",
      requiredCapability: "view_conversations",
      requiredFeature: FEATURE.CONVERSATIONS,
    },
    {
      href: "/conversations",
      group: "today",
      label: "Inbox",
      icon: MessageSquare,
      details: "Replies from every channel - handled by Mr LAD or by your team.",
      requiredCapability: "view_conversations",
      requiredFeature: FEATURE.CONVERSATIONS,
    },
    {
      href: "/follow-ups",
      group: "today",
      label: "Follow-ups",
      icon: GitFork,
      details: "Track and manage your follow-up tasks and reminders.",
      requiredCapability: "view_followups",
      requiredFeature: FEATURE.FOLLOWUPS,
    },

    // ── Grow: get new leads ──────────────────────────────────────────────────
    {
      href: "/onboarding/advanced-search-ai",
      group: "grow",
      label: "Ask Mr LAD",
      icon: Search,
      details: "Find leads, build an audience and plan a campaign with Mr LAD.",
      requiredCapability: "view_ai_assistant",
      requiredFeature: FEATURE.AI_CHAT,
    },
    {
      href: "/campaigns",
      group: "grow",
      label: "Outreach",
      icon: Goal,
      details:
        "Multi-channel outreach campaigns with LinkedIn and Email automation.",
      requiredCapability: "view_campaigns",
      requiredFeature: FEATURE.CAMPAIGNS,
    },
    {
      href: "/content-studio",
      group: "grow",
      label: "Content Studio",
      icon: CalendarRange,
      details:
        "Plan, write, schedule and measure your daily social posts in one place.",
      requiredCapability: "view_content_studio",
      requiredFeature: FEATURE.CONTENT_STUDIO,
    },
    {
      href: "/make-call",
      group: "grow",
      label: "Calls",
      icon: Phone,
      details: "Place outgoing calls using your assigned numbers.",
      requiredCapability: "view_make_call",
      requiredFeature: FEATURE.VOICE_AGENT,
      children: [
        {
          href: "/call-logs",
          label: "Call history",
          icon: ChartNoAxesCombined,
          details: "Review past call history and recordings.",
          requiredCapability: "view_call_logs",
          requiredFeature: FEATURE.VOICE_AGENT,
        },
      ],
    },

    // ── Convert: the human work that moves a lead forward ───────────────────
    {
      href: "/pipeline",
      group: "convert",
      label: isEducation ? "Students" : "Pipeline",
      icon: isEducation ? GraduationCap : CircleDollarSign,
      details: isEducation
        ? "Manage student admissions and counseling."
        : "Manage your sales pipeline and deals.",
      requiredCapability: "view_pipeline",
      requiredFeature: FEATURE.DEALS_PIPELINE,
    },
    {
      href: "/crm",
      group: "convert",
      label: "Contacts",
      icon: Contact,
      details: "Unified cross-channel prospects, leads and clients from the Master Agent.",
      requiredCapability: "view_pipeline",
    },
    {
      href: "/sales-playbook",
      group: "convert",
      label: "Playbook",
      icon: ClipboardList,
      details: "Run the discovery call script, score the lead and cost the customisation.",
      requiredCapability: "view_sales_playbook",
      requiredFeature: FEATURE.SALES_PLAYBOOK,
    },

    // ── Measure ──────────────────────────────────────────────────────────────
    {
      href: "/community-roi",
      group: "measure",
      label: "Referral ROI",
      icon: ChartNoAxesCombined,
      details: "Track and analyze community engagement and ROI metrics.",
      requiredCapability: "view_community_roi",
      requiredFeature: FEATURE.COMMUNITY_ROI,
    },

    // ── Setup ────────────────────────────────────────────────────────────────
    {
      href: "/studio",
      group: "setup",
      label: "Train Mr LAD",
      icon: Sparkles,
      details: "Train the workspace on your business: interview, ICP training, rehearsal, and the Tailor.",
      // No capability is granted to members on purpose: admins and owners pass
      // the capability check automatically, everyone else stays out — the
      // same rule the backend applies to applying a customisation.
      requiredCapability: "manage_tenant_studio",
    },
    {
      // Top-level (was under Conversations): Outreach, broadcasts and the
      // Inbox all draw on the same templates.
      href: "/conversations/templates",
      group: "setup",
      label: "Templates",
      icon: LayoutTemplate,
      details: "Create and manage message templates for conversations and broadcasts.",
      requiredCapability: "view_conversations",
      requiredFeature: FEATURE.CONVERSATIONS,
    },
  ];

  // Helper: does the user have access to this nav item?
  // Tenant feature flag is the hard gate - if the tenant doesn't have the
  // feature enabled, NO user of that tenant sees it (including owner/admin).
  // Within an enabled feature, owner/admin see it automatically; other roles
  // additionally need the matching capability.
  // Items without any required* field are public (always shown).
  const hasNavAccess = (item: NavItem): boolean => {
    // Snapshot gate - checked before the early return below, because an item
    // scoped to a curated workspace may carry no capability or feature key of
    // its own and would otherwise read as public.
    if (item.requiresCuratedWorkspace && !isCuratedWorkspace) return false;

    if (!item.requiredCapability && !item.requiredFeature) return true;

    // Tenant feature gate - applies to every role, no bypass.
    if (item.requiredFeature && !item.requiredFeature.some((f) => hasFeature(f))) return false;

    const isAdminOrOwner = user?.role === 'admin' || user?.role === 'owner';
    if (isAdminOrOwner) return true;
    const caps = user?.capabilities || [];
    return !!item.requiredCapability && caps.includes(item.requiredCapability);
  };

  // Filter navigation strictly. Previously we showed every item when the
  // user had no capabilities, which leaked admin-only features (Overview,
  // Pipeline, Make a Call, …) to fresh accounts on first login. Now an
  // unassigned user sees an empty sidebar - the right signal to assign
  // them features in Settings → Team.
  const baseNav = isHydrated
    ? allNavItems.filter(hasNavAccess).map(item => ({
        ...item,
        children: item.children?.filter(hasNavAccess),
      }))
    : []; // Empty during SSR to prevent hydration mismatch

  // Super-admin-only entry to the internal observability console. Appended
  // (not part of allNavItems) so it's strictly email-gated and never leaks to
  // tenant users. The backend independently enforces the same gate.
  const isSuperAdmin =
    isHydrated && (user?.email || '').toLowerCase().trim() === SUPER_ADMIN_EMAIL;
  const nav: NavItem[] = isSuperAdmin
    ? [
        ...baseNav,
        {
          href: '/admin/monitor',
          label: 'Platform Monitor',
          icon: Gauge,
          details: 'Internal cross-tenant observability (super-admin).',
        },
        {
          href: '/tenant/signups',
          label: 'Signup Requests',
          icon: UserPlus,
          details: 'Self-serve signup applications awaiting review (super-admin).',
        },
      ]
    : baseNav;

  // Desktop keeps every page under its own group heading, in nav order. It
  // used to pull Home/Tasks/Inbox/Outreach/Ask to the top to mirror the phone
  // bar, which left "Today" heading Follow-ups alone and "Grow" heading Calls.
  const desktopNav: NavItem[] = nav;

  // Same badge as the phone bar (shares its query cache).
  const hasTasksNav = nav.some((n) => n.href === TASKS_HREF);
  const { count: taskCount, capped: taskCapped } = useMyTasksCount(isHydrated && hasTasksNav);
  const taskBadge = taskCount ? (taskCount > 99 ? '99+' : `${taskCount}${taskCapped ? '+' : ''}`) : null;

  return (
    <>
      <MobileBottomNav nav={nav} />

      {/* Mobile Top Bar */}
      <div
        className={cn(
          "md:hidden fixed top-0 left-0 right-0 h-14 z-30 backdrop-blur-2xl border-b flex items-center justify-between px-3 transition-colors duration-300",
          isBlackGrayChannel
            ? "border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900"
            : "border-sidebar-border bg-sidebar/95"
        )}
      >
        <button
          aria-label="Open menu"
          className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10 active:scale-95 transition"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <Menu className="h-6 w-6 text-sidebar-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <img
            src={isDark ? "/MrLAD-logo-dark.svg" : "/MrLAD-logo.svg"}
            alt="Company Logo"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="w-8 h-8 object-contain"
          />
          <span className="text-sm font-medium text-sidebar-foreground/90 truncate max-w-[45vw]">
            {displayName}
          </span>
        </div>
        <div className="w-11" />
      </div>
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-xs z-50"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      {/* Mobile Drawer */}
      <div
        className={cn(
          "md:hidden fixed inset-y-0 left-0 w-[80%] max-w-[300px] pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl border-r shadow-2xl z-50 flex flex-col transition-colors duration-300",
          isBlackGrayChannel
            ? "border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-[#171717]"
            : "border-sidebar-border bg-sidebar/95",
          "transition-transform duration-300 ease-out",
          isMobileMenuOpen ? "translate-x-0 pointer-events-auto" : "-translate-x-full pointer-events-none",
        )}
      >
        <div className="h-14 px-3 flex items-center justify-between border-b border-sidebar-border">
          <div className="flex items-center">
            <img
              src={isDark ? "/MrLAD-logo-dark.svg" : "/MrLAD-logo.svg"}
              alt="Company Logo"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              className="h-9 w-auto object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).src = isDark ? "/MrLAD-logo-dark.svg" : "/MrLAD-logo.svg";
              }}
            />
          </div>
          <button
            aria-label="Close menu"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10 active:scale-95 transition"
          >
            <X className="h-5 w-5 text-sidebar-foreground" />
          </button>
        </div>
        {/* Who and where: profile + current workspace. With several
            workspaces the card toggles a switcher list below it. */}
        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={() => tenants.length > 1 && setIsMobileTenantListOpen((v) => !v)}
            aria-expanded={tenants.length > 1 ? isMobileTenantListOpen : undefined}
            className={cn(
              "w-full flex items-center gap-3 rounded-2xl p-3 text-left transition",
              "bg-primary/[0.06] dark:bg-white/[0.06] ring-1 ring-inset ring-primary/10 dark:ring-white/10",
              tenants.length > 1 ? "active:scale-[0.99] hover:bg-primary/10 dark:hover:bg-white/10" : "cursor-default",
            )}
          >
            {isHydrated && user?.avatar ? (
              <img src={user.avatar} className="w-11 h-11 rounded-full object-cover flex-shrink-0" alt="" />
            ) : (
              <div className="w-11 h-11 rounded-full flex items-center justify-center bg-primary text-white font-semibold flex-shrink-0">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-sidebar-foreground">{displayName}</span>
                <span className="shrink-0 rounded-full bg-primary/10 dark:bg-white/10 px-2 py-0.5 text-[11px] font-semibold capitalize text-primary dark:text-white/80">
                  {user?.role || "admin"}
                </span>
              </span>
              {/* Workspace line, unless it just repeats the name above. */}
              {tenant?.name && tenant.name !== displayName && (
                <span className="mt-0.5 block truncate text-xs text-sidebar-foreground/70">{tenant.name}</span>
              )}
            </span>
            {tenants.length > 1 && (
              <ChevronDown
                aria-hidden="true"
                className={cn("h-4 w-4 shrink-0 text-sidebar-foreground/60 transition-transform", isMobileTenantListOpen && "rotate-180")}
              />
            )}
          </button>
          {tenants.length > 1 && isMobileTenantListOpen && (
            <div className="mt-2 space-y-1 rounded-2xl border border-sidebar-border p-1" role="list" aria-label="Switch workspace">
              {tenants.map((t) => (
                <button
                  key={t.id}
                  role="listitem"
                  onClick={() => {
                    setTenantById(t.id);
                    setIsMobileTenantListOpen(false);
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 rounded-xl px-3 min-h-11 text-sm transition",
                    tenant.id === t.id
                      ? "bg-primary/10 dark:bg-white/10 font-semibold text-primary dark:text-white"
                      : "text-sidebar-foreground/80 hover:bg-primary/5 dark:hover:bg-white/5",
                  )}
                >
                  <span className="truncate">{t.name}</span>
                  {tenant.id === t.id && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <nav className="flex-1 flex flex-col gap-0.5 px-3 pt-4 pb-2 overflow-y-auto" aria-label="Main">
          {(() => {
            // Build the set of every URL claimed as a "child" anywhere in the
            // nav tree so a top-level item never lights up when the current
            // pathname is actually owned by another section. Guards against a
            // top-level item greedily prefix-matching a child route that lives
            // under its URL space (e.g. a child at /parent/child/... should
            // highlight the child, not the /parent top-level item).
            const ownedChildHrefs = new Set<string>(
              nav.flatMap(p => p.children?.map(c => c.href) ?? [])
            );
            const pathBelongsToChild = (href: string) =>
              Array.from(ownedChildHrefs).some(c =>
                href === c || href.startsWith(c + '/')
              );
            // A deeper top-level link (Templates at /conversations/templates)
            // owns its path; the shallower one (Inbox at /conversations) must
            // not light up as well.
            const shadowedByDeeperTop = (href: string) =>
              nav.some(o => o.href !== href && o.href.startsWith(href + '/') &&
                (pathname === o.href || pathname.startsWith(o.href + '/')));
            return nav.map((n, idx) => {
              const groupStart = !!n.group && n.group !== nav[idx - 1]?.group;
              const Icon = n.icon;
              const ownChildHrefs = new Set((n.children ?? []).map(c => c.href));
              const matchesOwnRoute = pathname === n.href || pathname.startsWith(n.href + '/');
              // If the current path is claimed by a child of a DIFFERENT
              // parent, don't treat this item as self-active.
              const pathOwnedByOtherChild = pathBelongsToChild(pathname) &&
                !Array.from(ownChildHrefs).some(c =>
                  pathname === c || pathname.startsWith(c + '/')
                );
              const selfActive = matchesOwnRoute && !pathOwnedByOtherChild && !shadowedByDeeperTop(n.href);
              const hasChildren = n.children && n.children.length > 0;
              const childOnPath = hasChildren && n.children!.some(c =>
                pathname === c.href || pathname.startsWith(c.href + '/')
              );
            // `selfActive` = this row IS the current page; `childOnPath` =
            // a sub-item is current. They drive different styling now, so we
            // no longer combine them into one boolean.

            return (
              <div key={n.href}>
                {groupStart && (
                  <span className="block px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                    {NAV_GROUP_LABEL[n.group!]}
                  </span>
                )}
                <NavLink
                  href={n.href}
                  aria-current={selfActive ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-3 rounded-xl px-2 h-12 transition-colors",
                    selfActive
                      ? "bg-primary/10 dark:bg-white/10 text-primary dark:text-white font-semibold before:absolute before:left-0 before:top-2.5 before:bottom-2.5 before:w-[3px] before:rounded-full before:bg-primary dark:before:bg-blue-400"
                      : childOnPath
                        ? "text-primary dark:text-white font-semibold"
                        : "text-sidebar-foreground hover:bg-primary/5 dark:hover:bg-white/5",
                  )}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {/* Icon tile: filled when this is the current page. */}
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                      selfActive
                        ? "bg-primary text-white dark:bg-blue-500"
                        : "bg-primary/[0.06] text-sidebar-foreground/80 dark:bg-white/[0.06]",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                  </span>
                  <span className="text-[15px]">{n.label}</span>
                </NavLink>

                {hasChildren && (
                  // Sub-pages sit under the parent's label on a thin guide line.
                  <div className="ml-[27px] mt-0.5 mb-1 border-l border-sidebar-border pl-[17px] space-y-0.5">
                    {n.children!.map((child) => {
                      const ChildIcon = child.icon;
                      const childActive = pathname === child.href || pathname.startsWith(child.href + '/');
                      return (
                        <NavLink
                          key={child.href}
                          href={child.href}
                          aria-current={childActive ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-2.5 rounded-lg px-2 h-11 text-sm transition-colors",
                            childActive
                              ? "bg-primary/10 dark:bg-white/10 font-semibold text-primary dark:text-white"
                              : "text-sidebar-foreground/80 hover:bg-primary/5 dark:hover:bg-white/5",
                          )}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <ChildIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span>{child.label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          });
          })()}
        </nav>

        {/* Account actions: same row rhythm and icon tiles as the menu. */}
        <div className={cn("mt-auto border-t px-3 py-2 space-y-0.5 border-sidebar-border", isBlackGrayChannel && "dark:border-zinc-800")}>
          <NavLink
            href="/settings"
            className="flex items-center gap-3 rounded-xl px-2 h-12 text-[15px] text-sidebar-foreground hover:bg-primary/5 dark:hover:bg-white/5 transition-colors"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.06] text-sidebar-foreground/80 dark:bg-white/[0.06]">
              <Settings className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <span>Settings</span>
          </NavLink>
          <div className="flex items-center justify-between gap-3 rounded-xl px-2 h-12 text-[15px] text-sidebar-foreground">
            {/* ThemeToggle on the right is the actual control. */}
            <span className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.06] text-sidebar-foreground/80 dark:bg-white/[0.06]">
                <Palette className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <span>Theme</span>
            </span>
            <ThemeToggle />
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 rounded-xl px-2 h-12 text-[15px] text-red-600 dark:text-red-400 hover:bg-red-500/10 active:scale-[0.99] transition"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
              <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            Logout
          </button>
        </div>
      </div>
      <aside
        className={cn(
          "hidden md:flex flex-col shrink-0 h-screen border-r",
          "bg-white border-gray-200",
          isBlackGrayChannel
            ? "dark:bg-[#171717] dark:border-zinc-800"
            : "dark:bg-[#000724] dark:border-[#1a2a43]",
          "transition-all duration-500 ease-[cubic-bezier(.4,0,.2,1)]",
          "overflow-hidden fixed left-0 top-0 z-40",
          isExpanded ? "w-64 shadow-2xl" : "w-16",
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => { if (!isPinned) setIsHovered(false); }}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(.19,1,.22,1)]",
            "shrink-0", isExpanded ? "my-5" : "my-4",
          )}
        >
          <img
            src={isDark ? (isExpanded ? "/MrLAD-logo-dark.svg" : "/logo-white.svg") : (isExpanded ? "/MrLAD-logo.svg" : "/logo.svg")}
            alt="Company Logo"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className={cn(
              "object-contain transition-all duration-500 ease-[cubic-bezier(.19,1,.22,1)]",
              isExpanded ? "h-14 w-auto max-w-[180px]" : "h-10 w-10",
            )}
            onError={(e) => {
              (e.target as HTMLImageElement).src = isDark ? (isExpanded ? "/MrLAD-logo-dark.svg" : "/logo-white.svg") : (isExpanded ? "/MrLAD-logo.svg" : "/logo.svg");
            }}
          />
        </div>

        {/* Pin toggle - keeps the sidebar permanently expanded.
            Only shown when the sidebar is expanded (otherwise it would
            overflow the 16px-wide rail) and only on md+ (mobile uses the
            burger menu and doesn't need a pin). */}
        {isExpanded && (
          <button
            type="button"
            onClick={togglePinned}
            aria-label={isPinned ? "Unpin sidebar" : "Pin sidebar open"}
            title={isPinned ? "Unpin sidebar" : "Pin sidebar open"}
            className={cn(
              "absolute top-3 right-3 z-20 rounded-full p-1.5",
              "transition-all duration-200 ease-out",
              "hover:scale-110 active:scale-95",
              isPinned
                ? "bg-primary/90 text-white shadow-md hover:bg-primary"
                : "bg-white/70 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-white/10 border border-slate-200/70 dark:border-white/10",
            )}
          >
            {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </button>
        )}

        {/* Navigation */}
        {/* The page list scrolls on its own; the logo above and the profile
            block below stay put, so a long nav can't push items under them. */}
        <nav className="flex-1 min-h-0 flex flex-col px-2 space-y-1 py-2 overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-width:thin]">
          {(() => {
            // Set of every URL claimed as a child anywhere in the nav tree  - 
            // prevents a top-level item from greedily lighting up when the
            // current pathname belongs to another section's sub-item.
            const ownedChildHrefs = new Set<string>(
              nav.flatMap(p => p.children?.map(c => c.href) ?? [])
            );
            const pathBelongsToChild = (href: string) =>
              Array.from(ownedChildHrefs).some(c =>
                href === c || href.startsWith(c + '/')
              );
            // A deeper top-level link (Templates at /conversations/templates)
            // owns its path; the shallower one (Inbox at /conversations) must
            // not light up as well.
            const shadowedByDeeperTop = (href: string) =>
              nav.some(o => o.href !== href && o.href.startsWith(href + '/') &&
                (pathname === o.href || pathname.startsWith(o.href + '/')));
            return desktopNav.map((n, idx) => {
              const groupStart = !!n.group && n.group !== desktopNav[idx - 1]?.group;
              const isAsk = n.href === ASK_HREF;
              const badge = n.href === TASKS_HREF ? taskBadge : null;
              const Icon = n.icon;
              const ownChildHrefs = new Set((n.children ?? []).map(c => c.href));
              const matchesOwnRoute = pathname === n.href || pathname.startsWith(n.href + '/');
              const pathOwnedByOtherChild = pathBelongsToChild(pathname) &&
                !Array.from(ownChildHrefs).some(c =>
                  pathname === c || pathname.startsWith(c + '/')
                );
              const selfActive = matchesOwnRoute && !pathOwnedByOtherChild && !shadowedByDeeperTop(n.href);
              const hasChildren = n.children && n.children.length > 0;
              const childOnPath = hasChildren && n.children!.some(c =>
                pathname === c.href || pathname.startsWith(c.href + '/')
              );
            // `selfActive` = this row IS the current page; `childOnPath` =
            // a sub-item is current. They drive different styling now, so we
            // no longer combine them into one boolean.
            return (
              <div key={n.href}>
              {groupStart && (isExpanded ? (
                <span className="block px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {NAV_GROUP_LABEL[n.group!]}
                </span>
              ) : (
                <div aria-hidden="true" className="mx-auto my-2 h-px w-8 bg-sidebar-border" />
              ))}
              <div className="relative group">
                <NavLink
                  href={n.href}
                  // Collapsed, this renders as a bare 48px icon — the label
                  // span below is gated on isExpanded, so without these the
                  // link has NO accessible name and screen readers announce
                  // eight identical "link"s. The title also gives sighted
                  // users a hover tooltip telling them where each icon goes.
                  aria-label={badge ? `${n.label}, ${badge} waiting` : n.label}
                  title={!isExpanded ? n.label : undefined}
                  className={cn(
                    "relative flex items-center rounded-2xl overflow-visible",
                    "transition-all duration-400 ease-[cubic-bezier(.19,1,.22,1)]",
                    "hover:-translate-y-[2px] hover:scale-[1.01]",
                    isExpanded
                      ? "pl-3 pr-4 h-11 w-full shrink-0"
                      : "h-11 w-11 mx-auto justify-center shrink-0",
                  )}
                >
                  {/* Active / section-active / hover glass background */}
                  <div
                    className={cn(
                      "absolute inset-0 z-0 rounded-2xl",
                      "transition-all duration-400 ease-[cubic-bezier(.19,1,.22,1)]",
                      selfActive
                        ? "bg-primary"
                        : childOnPath
                          ? "bg-primary/10 backdrop-blur-sm"  // soft tint - works on light & dark
                          : isAsk
                            // Ask Mr LAD reads as the call to action, as on the phone bar.
                            ? "bg-gradient-to-r from-[#0b1957]/[0.06] to-[#2563eb]/[0.10] ring-1 ring-[#2563eb]/20 group-hover:to-[#2563eb]/[0.16] dark:from-blue-400/10 dark:to-blue-500/15 dark:ring-blue-400/25"
                            // white/10 on a white sidebar was no hover feedback at all.
                            : "bg-transparent group-hover:bg-slate-100 dark:group-hover:bg-white/10 group-hover:backdrop-blur-sm",
                    )}
                  />
                  {/* Icon wrapper */}
                  <div
                    className={cn(
                      "relative z-10 flex justify-center items-center flex-shrink-0",
                      "w-10 h-10 rounded-xl",
                      "transition-all duration-400 ease-[cubic-bezier(.19,1,.22,1)]",
                      // isActive
                      //   ? "bg-white/20"
                      //   : "bg-primary-light/80 group-hover:bg-primary-light/90",
                      // "group-hover:translate-x-[1px]"
                    )}
                  >
                    {isAsk ? (
                      // The same animated LAD logo as the phone bar's Ask button.
                      <AgentVisualizer state="idle" size={30} />
                    ) : (
                    <Icon
                      className={cn(
                        "h-5 w-5 transition-colors duration-300 relative z-10",
                        // Only flip to white when this row is THE active page.
                        // section-active (childOnPath) keeps the dark icon so
                        // the parent label stays legible on light themes.
                        selfActive
                          ? "text-white"
                          : "text-gray-900 dark:text-gray-300 group-hover:text-black dark:group-hover:text-white",
                      )}
                      style={
                        !selfActive ? { color: undefined } : undefined
                      }
                    />
                    )}
                    {badge && !isExpanded && (
                      <span
                        aria-hidden="true"
                        className="absolute -top-0.5 -right-1 z-20 min-w-[18px] rounded-full bg-red-600 px-1 text-center text-[10px] leading-[18px] font-bold text-white tabular-nums ring-2 ring-white dark:ring-[#000724]"
                      >
                        {badge}
                      </span>
                    )}
                  </div>
                  {/* Label */}
                  {isExpanded && (
                    <span
                      className={cn(
                        "relative z-10 text-sm font-medium whitespace-nowrap ml-3",
                        "transition-all duration-500 ease-[cubic-bezier(.4,0,.2,1)]",
                        selfActive
                          ? "text-white group-hover:text-white"
                          : "text-gray-900 dark:text-gray-300 group-hover:text-black dark:group-hover:text-white",
                      )}
                    >
                      {n.label}
                    </span>
                  )}
                  {isExpanded && badge && (
                    <span
                      aria-hidden="true"
                      className="relative z-10 ml-auto min-w-[22px] rounded-full bg-red-600 px-1.5 text-center text-xs leading-5 font-semibold text-white tabular-nums"
                    >
                      {badge}
                    </span>
                  )}
                </NavLink>
                {/* Flyout: collapsed → tooltip + children; expanded → children below */}
                {!isExpanded ? (
                  <div
                    className={cn(
                      "absolute left-full ml-3 px-3 py-2 rounded-xl border border-white/10",
                      "bg-sidebar/95 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)]",
                      "opacity-0 invisible scale-95 translate-y-[2px] pointer-events-none",
                      "group-hover:opacity-100 group-hover:visible group-hover:scale-100 group-hover:translate-y-0",
                      "transition-all duration-250 ease-[cubic-bezier(.19,1,.22,1)]",
                      "whitespace-nowrap z-[100] top-0",
                    )}
                  >
                    <span
                      className="block text-xs font-medium text-gray-900 dark:text-gray-300"
                    >
                      {n.label}
                    </span>
                    {n.details && (
                      <span className="block mt-0.5 max-w-[220px] whitespace-normal text-xs text-gray-600 dark:text-gray-400">
                        {n.details}
                      </span>
                    )}
                    {/* Child items in collapsed flyout */}
                    {hasChildren && (
                      <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                        {n.children!.map((child) => {
                          const ChildIcon = child.icon;
                          const childActive = pathname === child.href || pathname.startsWith(child.href + '/');
                          return (
                            <NavLink
                              key={child.href}
                              href={child.href}
                              className={cn(
                                "flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium pointer-events-auto",
                                childActive
                                  ? "bg-primary/90 text-white"
                                  : "hover:bg-slate-100 dark:hover:bg-white/10 text-gray-900 dark:text-gray-300",
                              )}
                            >
                              <ChildIcon className={cn("h-3.5 w-3.5 flex-shrink-0", childActive ? "text-white" : "text-gray-700 dark:text-gray-400")} />
                              {child.label}
                            </NavLink>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : hasChildren ? (
                  /* Expanded sidebar: children slide in below parent on hover.
                     If a child is the current route, force the section open so
                     the active sub-item stays visible without hovering. */
                  <div
                    className={cn(
                      "overflow-hidden transition-all duration-300 ease-in-out pr-2 mt-0.5 space-y-0.5",
                      "pl-7 ml-3 border-l-2 border-white/10",  // vertical guide rail
                      childOnPath
                        ? "max-h-40"
                        : "max-h-0 group-hover:max-h-40",
                    )}
                  >
                    {n.children!.map((child) => {
                      const ChildIcon = child.icon;
                      const childActive = pathname === child.href || pathname.startsWith(child.href + '/');
                      return (
                        <NavLink
                          key={child.href}
                          href={child.href}
                          className={cn(
                            "relative flex items-center rounded-xl h-10 px-3 ml-1",
                            "transition-all duration-200",
                            childActive
                              ? "bg-primary/90 text-white shadow-md before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:-translate-x-[18px] before:h-5 before:w-0.5 before:bg-primary before:rounded-full"
                              : "hover:bg-slate-100 dark:hover:bg-white/5 text-gray-900 dark:text-gray-300",
                          )}
                        >
                          <ChildIcon className={cn("h-4 w-4 flex-shrink-0", childActive ? "text-white" : "text-gray-700 dark:text-gray-400")} />
                          <span
                            className={cn("ml-2 text-sm font-medium whitespace-nowrap", childActive ? "text-white" : "text-gray-900 dark:text-gray-300")}
                          >
                            {child.label}
                          </span>
                        </NavLink>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              </div>
            );
          });
          })()}
        </nav>
        {/* User Profile Inline Section */}
        <div className={cn("shrink-0 border-t mt-auto border-sidebar-border", isBlackGrayChannel && "dark:border-zinc-800")}>
          {/* Avatar / profile row - click to toggle inline panel */}
          <div
            onClick={() => setIsUserPanelOpen((v) => !v)}
            className={cn(
              "flex items-center p-3 transition-all duration-500 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 select-none",
              isExpanded ? "justify-start gap-3" : "justify-center",
            )}
          >
            {/* Avatar */}
            {isHydrated && user?.avatar ? (
              <img
                src={user.avatar}
                className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                alt="avatar"
              />
            ) : (
              <div className="w-9 h-9 rounded-full flex items-center justify-center bg-primary text-white font-semibold text-sm flex-shrink-0">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            {/* User Info - shown when expanded */}
            {isExpanded && (
              <div className="flex items-center justify-between min-w-0 flex-1 gap-2">
                <div className="flex flex-col items-start justify-center min-w-0 flex-1">
                  <div className="text-sm text-gray-900 dark:text-gray-300 font-medium leading-tight truncate w-full">
                    {displayName}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 leading-tight">
                    {user?.role || "admin"}
                  </div>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground/60 flex-shrink-0 transition-transform duration-300",
                    isUserPanelOpen && "rotate-180",
                  )}
                />
              </div>
            )}
          </div>

          {/* Inline user panel - shown when isUserPanelOpen */}
          <div
            className={cn(
              "overflow-hidden transition-all duration-300 ease-in-out",
              isUserPanelOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0",
            )}
          >
            <div className="px-2 pb-2 space-y-1">
              {/* Tenant section - only if multiple tenants.
                  A dropdown rather than an inline list: this panel is capped at
                  max-h-96, so one row per tenant pushes Settings, Pricing and
                  Logout past the clip and out of reach for anyone in enough
                  workspaces. Closed, it costs one row whatever the count. */}
              {tenants.length > 1 && (
                <div className="px-2 pt-1 pb-0.5">
                  <span className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">Tenant</span>
                  <button
                    type="button"
                    onClick={() => setIsTenantListOpen((open) => !open)}
                    aria-expanded={isTenantListOpen}
                    // The current tenant is the label, so the closed state still
                    // answers "which workspace am I in?" without opening it.
                    className="mt-1 w-full flex items-center justify-between gap-2 px-2 py-1 max-lg:min-h-11 rounded-lg text-xs
                               text-foreground/90 hover:bg-slate-100 dark:hover:bg-white/5 transition active:scale-95 select-none"
                  >
                    <span className="truncate font-semibold">{tenant.name}</span>
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 flex-shrink-0 text-muted-foreground/60 transition-transform duration-200",
                        isTenantListOpen && "rotate-180",
                      )}
                    />
                  </button>
                  {isTenantListOpen && (
                    // Scrolls rather than growing without bound — the parent
                    // clips, so an unbounded list would hide its own options.
                    <div className="mt-0.5 space-y-0.5 max-h-40 overflow-y-auto">
                      {tenants.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setTenantById(t.id);
                            setIsTenantListOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-2 py-1 max-lg:min-h-11 rounded-lg text-xs transition active:scale-95 select-none",
                            tenant.id === t.id
                              ? "bg-primary/20 text-primary font-semibold"
                              : "text-gray-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/5",
                          )}
                        >
                          <span className="truncate">{t.name}</span>
                          {tenant.id === t.id && <span className="text-primary text-[10px]">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Settings */}
              <NavLink
                href="/settings"
                // Collapsed, the label span is not rendered, so the link would
                // have no accessible name at all — see the nav items above.
                aria-label="Settings"
                title={!isExpanded ? "Settings" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 h-10 max-lg:h-11 text-sm font-medium transition-all",
                  "text-gray-700 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-white/10 active:scale-95 select-none",
                  isExpanded ? "w-full" : "w-10 max-lg:w-11 mx-auto justify-center",
                )}
              >
                <Settings className="h-4 w-4 flex-shrink-0" />
                {isExpanded && <span>Settings</span>}
              </NavLink>

              {/* Theme */}
              <div
                className={cn(
                  "flex items-center rounded-xl px-3 h-10 text-sm font-medium",
                  "text-gray-700 dark:text-gray-300",
                  isExpanded ? "justify-between w-full" : "justify-center w-10 mx-auto",
                )}
              >
                {/* Group the leading icon + label together so the layout
                    mirrors the Settings row above and the Logout row below.
                    When the sidebar collapses, only the ThemeToggle remains
                    visible (centered) - the leading Palette icon hides to
                    avoid two icons in a 40px-wide column. */}
                {isExpanded && (
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 flex-shrink-0" />
                    <span>Theme</span>
                  </div>
                )}
                <ThemeToggle />
              </div>

              {/* Logout */}
              <button
                onClick={handleLogout}
                aria-label="Logout"
                title="Logout"
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 h-10 max-lg:h-11 text-sm font-medium transition-all w-full",
                  "text-red-600 dark:text-red-400 hover:bg-red-500/10 active:scale-95 select-none",
                  !isExpanded && "justify-center",
                )}
              >
                <LogOut className="h-4 w-4 flex-shrink-0" />
                {isExpanded && <span>Logout</span>}
              </button>
            </div>
          </div>

          {/* Version Number */}
          <div className="h-10 flex items-center justify-center border-t border-sidebar-border/50">
            {isExpanded && (
              <span className="text-xs tracking-wide text-gray-500 dark:text-gray-400 transition-opacity duration-500">
                v1.0.0
              </span>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
