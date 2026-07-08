import { Fragment, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { authApi, tenantApi, platformApi } from "@/api/client";
import { APP_NAME, APP_TAGLINE, PLATFORM_NAV, TENANT_NAV } from "@/lib/constants";
import { toast } from "sonner";
import {
  Leaf, LogOut, PanelLeftClose, PanelLeft, KeyRound, Eye, EyeOff, ChevronUp, Download, LifeBuoy,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogBody, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UserType, Role } from "@/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  const { user, logout } = useAuthStore();
  const isSupport = useAuthStore((s) => !!s.supportSession);

  // Notification count (tenant only)
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    if (portalType !== "tenant") return;
    const fetch = () => tenantApi.unreadCount().then(r => setUnreadCount(r.data?.unread_count ?? 0)).catch(() => {});
    fetch();
    const t = setInterval(fetch, 60_000);
    return () => clearInterval(t);
  }, [portalType]);

  // Pending support-access request count — only loaded for COMPANY_ADMIN (the only
  // role that can decide them). Surfaces a dot on the Settings nav so admins
  // notice without having to navigate.
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

  // Pending ticket count for the user's company (tickets awaiting a tenant reply).
  // Drives the small dot on the "Help & Support" dropdown menu item so users
  // notice when platform support has replied without having to open the page.
  const [pendingTicketCount, setPendingTicketCount] = useState(0);
  useEffect(() => {
    if (portalType !== "tenant") return;
    const fetch = () =>
      tenantApi.pendingTicketCount()
        .then(r => setPendingTicketCount(r.data?.count ?? 0))
        .catch(() => {});
    fetch();
    const t = setInterval(fetch, 60_000);
    return () => clearInterval(t);
  }, [portalType]);

  // Platform-side: how many tickets are awaiting a platform reply, across all tenants.
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

  // Change password dialog state
  const [pwdOpen, setPwdOpen] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  if (!user) return null;

  // Guard against missing user fields (demo mode or partial data). Provide
  // sensible fallbacks so the sidebar doesn't crash when a name or role is
  // undefined.
  const safeFirst = (user.first_name || user.first_name || "").toString();
  const safeLast = (user.last_name || user.last_name || "").toString();
  const initials = `${(safeFirst[0] || (user.email && user.email[0]) || "").toUpperCase()}${(safeLast[0] || "").toUpperCase()}`;
  const roleForNav = (user.role as Role) || (user.role as any) || (user as any).role || ("COMPANY_ADMIN" as Role);
  const nav = getVisibleNav(portalType, roleForNav);

  const handleLogout = () => { logout(); navigate("/login"); };

  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd || !confirmPwd) { toast.error("All fields are required"); return; }
    if (newPwd.length < 8) { toast.error("New password must be at least 8 characters"); return; }
    if (newPwd !== confirmPwd) { toast.error("New passwords do not match"); return; }
    setPwdLoading(true);
    try {
      await authApi.changePassword(currentPwd, newPwd);
      toast.success("Password changed successfully");
      setPwdOpen(false);
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Failed to change password");
    } finally { setPwdLoading(false); }
  };

  const closePwdDialog = () => {
    setPwdOpen(false); setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
  };

  const handleDownloadMyData = async () => {
    try {
      const { data } = await authApi.getMyData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download your data");
    }
  };

  const isActive = (path: string) => {
    if (path === "/platform" || path === "/app") return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className="flex flex-col h-screen bg-gradient-to-b from-[#0c1525] to-[#0f172a] border-r border-white/[0.06] transition-[width] duration-200 ease-in-out relative z-50 flex-shrink-0"
        style={{ width: collapsed ? 68 : 260 }}
      >
        {/* ── Logo + collapse toggle ── */}
        <div className={`flex items-center border-b border-white/10 ${collapsed ? "flex-col gap-3 px-3 py-4" : "px-4 py-4 gap-3"}`}>
          <div className="w-[36px] h-[36px] rounded-[10px] bg-gradient-to-br from-brand-teal to-brand-accent flex items-center justify-center flex-shrink-0">
            <Leaf size={19} className="text-white" />
          </div>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <div className="text-[15px] font-bold text-white tracking-tight">{APP_NAME}</div>
              <div className="text-[10px] text-slate-400 tracking-[1px] uppercase">{APP_TAGLINE}</div>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-200 hover:bg-white/10 transition-colors flex-shrink-0"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* ── Portal label ── */}
        {!collapsed && (
          <div className="px-4 py-1.5">
            <span className={`text-[10px] font-semibold uppercase tracking-widest ${portalType === "platform" ? "text-amber-400" : "text-brand-teal"}`}>
              {portalType === "platform" ? "Platform Admin" : "Company Portal"}
            </span>
          </div>
        )}

        {/* ── Nav items ── */}
        <nav className="flex-1 flex flex-col gap-0.5 px-2 py-1 overflow-y-auto">
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
                  className={`flex items-center gap-3 rounded-lg border-none cursor-pointer w-full text-left transition-all duration-150
                    ${collapsed ? "px-[14px] py-[9px] justify-center" : "px-4 py-[9px]"}
                    ${active ? "bg-brand-accent/[0.14] text-brand-accent font-semibold" : "bg-transparent text-slate-400 font-medium hover:bg-white/[0.06] hover:text-slate-200"}
                  `}
                  style={{ fontSize: 13.5 }}
                >
                  <div className="relative flex-shrink-0">
                    <Icon size={18} />
                    {isNotif && unreadCount > 0 && (
                      <div className="absolute -top-1 -right-1 w-[7px] h-[7px] rounded-full bg-red-500 border border-brand-navy" />
                    )}
                    {showSupportBadge && (
                      <div className="absolute -top-1 -right-1 w-[7px] h-[7px] rounded-full bg-amber-400 border border-brand-navy" />
                    )}
                    {showTicketBadge && (
                      <div className="absolute -top-1 -right-1 w-[7px] h-[7px] rounded-full bg-amber-400 border border-brand-navy" />
                    )}
                  </div>
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.label}</span>
                      {isNotif && unreadCount > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 tabular-nums">
                          {unreadCount}
                        </span>
                      )}
                      {showSupportBadge && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 tabular-nums" title="Pending support-access requests">
                          {pendingSupportCount}
                        </span>
                      )}
                      {showTicketBadge && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 tabular-nums" title="Tickets awaiting platform reply">
                          {platformPendingTickets}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );

              const header = showGroupHeader ? (
                collapsed
                  ? <div key={`sep-${item.key}`} className="my-2 mx-3 border-t border-white/10" />
                  : <div key={`sep-${item.key}`} className="px-4 pt-4 pb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{(item as any).group}</span>
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

        {/* ── User card with popup (Claude-style) ── */}
        <div className={`border-t border-white/10 ${collapsed ? "p-2" : "p-3"}`}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="w-full flex justify-center py-2 rounded-lg hover:bg-white/10 transition-colors outline-none">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-accent to-brand-teal flex items-center justify-center text-white text-[11px] font-bold">
                        {initials}
                      </div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{user.first_name} {user.last_name}</TooltipContent>
                </Tooltip>
              ) : (
                <button className="w-full flex items-center gap-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer p-2 outline-none group">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-accent to-brand-teal flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-[13px] font-semibold text-white leading-tight truncate">{safeFirst} {safeLast}</div>
                    <div className="text-[11px] text-slate-400 truncate">{(user.role || roleForNav)?.replace(/_/g, " ")}</div>
                  </div>
                  <ChevronUp size={13} className="text-slate-500 group-hover:text-slate-300 flex-shrink-0 transition-colors" />
                </button>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" sideOffset={8} className="w-[220px]">
              <div className="px-3 py-2.5 border-b border-slate-100 mb-1">
                <div className="text-[13px] font-bold text-brand-navy truncate">{safeFirst} {safeLast}</div>
                <div className="text-[11px] text-slate-500 truncate">{user.email || "(no email)"}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{(user.role || roleForNav)?.replace(/_/g, " ")}</div>
              </div>
              {!isSupport && (
                <DropdownMenuItem onClick={() => setPwdOpen(true)}>
                  <KeyRound size={14} /> Change Password
                </DropdownMenuItem>
              )}
              {portalType === "tenant" && !isSupport && (
                <DropdownMenuItem onClick={() => navigate("/app/help")}>
                  <span className="relative inline-flex">
                    <LifeBuoy size={14} />
                    {pendingTicketCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 ring-1 ring-white" />
                    )}
                  </span>
                  <span className="flex-1">Help & Support</span>
                  {pendingTicketCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 tabular-nums">
                      {pendingTicketCount}
                    </span>
                  )}
                </DropdownMenuItem>
              )}
              {portalType === "tenant" && !isSupport && (
                <DropdownMenuItem onClick={handleDownloadMyData}>
                  <Download size={14} /> Download My Data
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onClick={handleLogout}>
                <LogOut size={14} /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Change Password Dialog (moved from Topbar) ── */}
      <Dialog open={pwdOpen} onOpenChange={(v) => { if (!v) closePwdDialog(); }}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Update your account password</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-[12px] font-semibold text-brand-navy">Current Password</Label>
                <div className="relative">
                  <Input type={showCurrent ? "text" : "password"} value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} className="pr-10" />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[12px] font-semibold text-brand-navy">New Password</Label>
                <div className="relative">
                  <Input type={showNew ? "text" : "password"} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} className="pr-10" />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[12px] font-semibold text-brand-navy">Confirm New Password</Label>
                <Input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleChangePassword()} />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={closePwdDialog} disabled={pwdLoading}>Cancel</Button>
            <Button onClick={handleChangePassword} disabled={pwdLoading}>{pwdLoading ? "Saving..." : "Update Password"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
