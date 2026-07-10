import { Fragment, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { tenantApi, platformApi } from "@/api/client";
import { APP_TAGLINE, PLATFORM_NAV, TENANT_NAV } from "@/lib/constants";
import { SidebarFooter } from "@/components/layout/AppStatusBar";
import { BrandLockup } from "@/components/shared/BrandMark";
import { PanelLeftClose, PanelLeft, Building2, Shield } from "lucide-react";
import type { UserType, Role } from "@/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Props {
  portalType: UserType;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

function getVisibleNav(portalType: UserType, role: Role) {
  if (portalType === "platform") {
    if (role === "PLATFORM_ADMIN") return PLATFORM_NAV.filter((n) => n.key !== "admins");
    return PLATFORM_NAV;
  }
  const hidden: Record<string, string[]> = {
    LOCATION_USER: ["users", "locations", "kpisetup", "indicators", "reporting", "review", "documents", "query", "settings", "suppliers", "targets", "auditorremarks", "library"],
    AUDITOR:       ["users", "indicators", "reporting", "settings", "targets", "library", "suppliers"],
    REVIEWER:      ["settings", "library"],
  };
  return TENANT_NAV.filter((n) => !(hidden[role] || []).includes(n.key));
}

export function Sidebar({ portalType, collapsed, setCollapsed }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    if (portalType !== "tenant") return;
    const fetch = () => tenantApi.unreadCount().then(r => setUnreadCount(r.data?.unread_count ?? 0)).catch(() => {});
    fetch();
    const t = setInterval(fetch, 60_000);
    return () => clearInterval(t);
  }, [portalType]);

  const [pendingSupportCount, setPendingSupportCount] = useState(0);
  useEffect(() => {
    if (portalType !== "tenant" || user?.role !== "COMPANY_ADMIN") return;
    const fetch = () =>
      tenantApi.listSupportAccessRequests("PENDING")
        .then(r => setPendingSupportCount(Array.isArray(r.data) ? r.data.length : 0))
        .catch(() => {});
    fetch();
    const t = setInterval(fetch, 60_000);
    return () => clearInterval(t);
  }, [portalType, user?.role]);

  const [platformPendingTickets, setPlatformPendingTickets] = useState(0);
  useEffect(() => {
    if (portalType !== "platform") return;
    const fetch = () =>
      platformApi.pendingPlatformTicketCount()
        .then(r => setPlatformPendingTickets(r.data?.count ?? 0))
        .catch(() => {});
    fetch();
    const t = setInterval(fetch, 60_000);
    return () => clearInterval(t);
  }, [portalType]);

  if (!user) return null;

  const roleForNav = (user.role as Role) || ("COMPANY_ADMIN" as Role);
  const nav = getVisibleNav(portalType, roleForNav);

  const isActive = (path: string) => {
    if (path === "/platform" || path === "/app") return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const PortalIcon = portalType === "platform" ? Shield : Building2;

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className="flex flex-col h-full min-h-0 bg-sidebar border-r border-sidebar-border shadow-sidebar transition-[width] duration-200 ease-in-out relative z-50 flex-shrink-0"
        style={{ width: collapsed ? 72 : 264 }}
      >
        {/* Brand accent strip */}
        <div className="h-px w-full bg-border flex-shrink-0" aria-hidden="true" />

        {/* Logo header */}
        <div className={cn(
          "flex items-center border-b border-sidebar-border flex-shrink-0",
          collapsed ? "flex-col gap-2 px-2 py-3" : "px-3.5 py-3 gap-2"
        )}>
          <BrandLockup collapsed={collapsed} inverted tagline={collapsed ? undefined : APP_TAGLINE} className="flex-1" />
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors flex-shrink-0"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* Portal context */}
        {!collapsed && (
          <div className="px-3.5 py-2 border-b border-sidebar-border">
            <div className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-2xs font-semibold",
              portalType === "platform"
                ? "bg-amber-500/15 text-amber-200"
                : "bg-sidebar-accent text-sidebar-foreground/80 border border-sidebar-border"
            )}>
              <PortalIcon size={11} />
              {portalType === "platform" ? "Platform Admin" : "Company Portal"}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-0.5 px-2 py-2 overflow-y-auto">
          {(() => {
            let lastGroup: string | undefined;
            return nav.map((item) => {
              const showGroupHeader = (item as any).group && (item as any).group !== lastGroup;
              if ((item as any).group) lastGroup = (item as any).group;
              const active = isActive(item.path);
              const Icon = item.icon;
              const isNotif = item.key === "notifications";
              const isSettings = item.key === "settings";
              const showSupportBadge = isSettings && pendingSupportCount > 0;
              const isPlatformTickets = item.key === "tickets";
              const showTicketBadge = isPlatformTickets && platformPendingTickets > 0;

              const btn = (
                <button
                  key={item.key}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-md border-none cursor-pointer w-full text-left transition-colors duration-150 text-ui",
                    collapsed ? "px-2.5 py-2.5 justify-center" : "px-3 py-2",
                    active
                      ? "bg-sidebar-accent text-sidebar-foreground font-semibold"
                      : "bg-transparent text-sidebar-foreground/55 font-medium hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-sidebar-primary" aria-hidden />
                  )}
                  <div className="relative flex-shrink-0">
                    <Icon size={17} strokeWidth={active ? 2.25 : 2} className={active ? "text-sidebar-primary" : undefined} />
                    {isNotif && unreadCount > 0 && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-destructive ring-2 ring-sidebar" />
                    )}
                    {showSupportBadge && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-warn ring-2 ring-sidebar" />
                    )}
                    {showTicketBadge && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-warn ring-2 ring-sidebar" />
                    )}
                  </div>
                  {!collapsed && (
                    <>
                      <span className="flex-1 truncate">{item.label}</span>
                      {isNotif && unreadCount > 0 && (
                        <span className="text-2xs font-bold px-1.5 py-0.5 rounded-md tabular-nums bg-destructive/20 text-red-300">
                          {unreadCount}
                        </span>
                      )}
                      {showSupportBadge && (
                        <span className="text-2xs font-bold px-1.5 py-0.5 rounded-md tabular-nums bg-amber-500/20 text-amber-200" title="Pending support-access requests">
                          {pendingSupportCount}
                        </span>
                      )}
                      {showTicketBadge && (
                        <span className="text-2xs font-bold px-1.5 py-0.5 rounded-md tabular-nums bg-amber-500/20 text-amber-200" title="Tickets awaiting platform reply">
                          {platformPendingTickets}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );

              const header = showGroupHeader ? (
                collapsed
                  ? <div key={`sep-${item.key}`} className="my-2 mx-2 border-t border-sidebar-border" />
                  : <div key={`sep-${item.key}`} className="px-3 pt-4 pb-1">
                      <span className="text-2xs font-bold uppercase tracking-[0.12em] text-sidebar-foreground/35">{(item as any).group}</span>
                    </div>
              ) : null;

              if (collapsed) {
                return (
                  <Fragment key={item.key}>
                    {header}
                    <Tooltip>
                      <TooltipTrigger asChild>{btn}</TooltipTrigger>
                      <TooltipContent side="right">{item.label}{isNotif && unreadCount > 0 ? ` (${unreadCount})` : ""}</TooltipContent>
                    </Tooltip>
                  </Fragment>
                );
              }
              return <Fragment key={item.key}>{header}{btn}</Fragment>;
            });
          })()}
        </nav>

        <SidebarFooter collapsed={collapsed} />
      </div>
    </TooltipProvider>
  );
}
