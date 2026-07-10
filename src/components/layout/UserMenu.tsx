import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { authApi, tenantApi } from "@/api/client";
import { toast } from "sonner";
import {
  LogOut, KeyRound, Eye, EyeOff, ChevronDown, Download, LifeBuoy, Palette,
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
import { getUserDisplayName, getUserInitials, getUserRoleLabel } from "@/lib/user-display";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import type { UserType } from "@/types";

interface UserMenuProps {
  portalType: UserType;
  /** Pending help-ticket count (tenant) */
  pendingTicketCount?: number;
}

export function UserMenu({ portalType, pendingTicketCount = 0 }: UserMenuProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const isSupport = useAuthStore((s) => !!s.supportSession);

  const [pwdOpen, setPwdOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);

  if (!user) return null;

  const displayName = getUserDisplayName(user);
  const initials = getUserInitials(user);
  const roleLabel = getUserRoleLabel(user.role);

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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-sunken border border-transparent hover:border-border/60 transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Account menu: ${displayName}`}
          >
            <div className="w-8 h-8 rounded-lg bg-muted text-foreground flex items-center justify-center text-label font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="hidden md:block text-left min-w-0 max-w-[160px]">
              <div className="text-xs font-semibold text-foreground leading-4 truncate">{displayName}</div>
              <div className="text-2xs text-muted-foreground leading-3 truncate">{roleLabel}</div>
            </div>
            <ChevronDown size={14} className="text-muted-foreground hidden sm:block flex-shrink-0" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={6} className="w-[220px]">
          <div className="px-3 py-2.5 border-b border-[hsl(var(--border-hairline))] mb-1">
            <div className="text-[13px] font-bold text-foreground truncate">{displayName}</div>
            <div className="text-[11px] text-muted-foreground truncate">{user.email || "(no email)"}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{roleLabel}</div>
          </div>
          {!isSupport && (
            <DropdownMenuItem onClick={() => setPwdOpen(true)}>
              <KeyRound size={14} /> Change Password
            </DropdownMenuItem>
          )}
          {portalType === "tenant" && !isSupport && (
            <DropdownMenuItem onClick={() => navigate("/app/settings?tab=appearance")}>
              <Palette size={14} /> Appearance
            </DropdownMenuItem>
          )}
          {portalType === "platform" && (
            <DropdownMenuItem onClick={() => setAppearanceOpen(true)}>
              <Palette size={14} /> Appearance
            </DropdownMenuItem>
          )}
          {portalType === "tenant" && !isSupport && (
            <DropdownMenuItem onClick={() => navigate("/app/help")}>
              <span className="relative inline-flex">
                <LifeBuoy size={14} />
                {pendingTicketCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-warn ring-1 ring-white" />
                )}
              </span>
              <span className="flex-1">Help & Support</span>
              {pendingTicketCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-warn-tint text-warn tabular-nums">
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

      <Dialog open={pwdOpen} onOpenChange={(v) => { if (!v) closePwdDialog(); }}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Update your account password</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Current Password</Label>
                <div className="relative">
                  <Input type={showCurrent ? "text" : "password"} value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} className="pr-10" />
                  <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>New Password</Label>
                <div className="relative">
                  <Input type={showNew ? "text" : "password"} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} className="pr-10" />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Confirm New Password</Label>
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

      <Dialog open={appearanceOpen} onOpenChange={setAppearanceOpen}>
        <DialogContent className="max-w-[760px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Appearance</DialogTitle>
            <DialogDescription>Theme, density, and table preferences</DialogDescription>
          </DialogHeader>
          <DialogBody className="pt-0">
            <AppearanceSettings />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Hook for pending ticket count used by AppShell */
export function usePendingTicketCount(portalType: UserType): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (portalType !== "tenant") return;
    const fetch = () =>
      tenantApi.pendingTicketCount()
        .then((r) => setCount(r.data?.count ?? 0))
        .catch(() => {});
    fetch();
    const t = setInterval(fetch, 60_000);
    return () => clearInterval(t);
  }, [portalType]);
  return count;
}
