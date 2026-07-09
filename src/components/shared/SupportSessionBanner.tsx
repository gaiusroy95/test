/**
 * SupportSessionBanner — site-wide amber bar shown across the tenant portal
 * whenever Platform staff is logged in via an approved support (read-only) session.
 *
 * Behaviour:
 *   • Polls /support-access/active-session every 30s so the banner appears for the
 *     Company Admin too while a session is live (cross-tab transparency).
 *   • If THIS tab is itself the support session (auth.supportSession set), the
 *     banner gets a "viewing as support" colour and shows a Sign Out button.
 *     The non-support Company Admin sees a Revoke button instead.
 *   • Countdown updates once per second so users can see the time tick down.
 */

import { useEffect, useState } from "react";
import { ShieldAlert, Eye, X } from "lucide-react";
import { tenantApi } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { toast } from "sonner";
import { getApiError } from "@/lib/utils";

interface ActiveSession {
  request_id: string;
  requestor_name?: string | null;
  requestor_email?: string | null;
  reason: string;
  expires_at: string;
}

function formatRemaining(expiresIso: string): string {
  const ms = new Date(expiresIso).getTime() - Date.now();
  if (ms <= 0) return "expired";
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs.toString().padStart(2, "0")}s`;
  return `${secs}s`;
}

export function SupportSessionBanner() {
  const { user, supportSession, logout } = useAuthStore();
  const isInSupportTab = !!supportSession;
  const [active, setActive] = useState<ActiveSession | null>(null);
  const [, setTick] = useState(0);
  const [revoking, setRevoking] = useState(false);

  // Poll the active session for the Company Admin (so their banner shows
  // even when the platform staff is browsing).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const fetch = async () => {
      try {
        const res = await tenantApi.getActiveSupportSession();
        if (!cancelled) setActive(res.data ?? null);
      } catch { /* network blip, keep last value */ }
    };
    fetch();
    const id = setInterval(fetch, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [user]);

  // 1Hz tick for the countdown.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  if (!active) return null;

  const remaining = formatRemaining(active.expires_at);
  if (remaining === "expired") return null;

  const handleRevoke = async () => {
    if (!confirm("End this support session immediately? The platform staff will lose access right away.")) return;
    setRevoking(true);
    try {
      await tenantApi.revokeSupportAccessRequest(active.request_id, "Revoked by Company Admin from banner");
      setActive(null);
      toast.success("Support session ended.");
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to revoke session"));
    } finally {
      setRevoking(false);
    }
  };

  if (isInSupportTab) {
    // Platform staff's view — purple, calm
    return (
      <div className="bg-violet-600 text-white text-[12px] py-1.5 px-4 flex items-center gap-2 shadow-sm">
        <Eye size={14} />
        <span className="font-semibold">Read-only support session</span>
        <span className="opacity-80">·</span>
        <span>Viewing as Company Admin · expires in {remaining}</span>
        <span className="opacity-80">·</span>
        <span className="opacity-90">Write actions are hidden — you can browse, but not change anything.</span>
        <button
          onClick={() => { logout(); window.close(); }}
          className="ml-auto flex items-center gap-1 text-[11px] bg-card/15 hover:bg-card/25 rounded px-2 py-0.5 transition-colors"
          title="End session"
        >
          <X size={12} /> End session
        </button>
      </div>
    );
  }

  // Company Admin's view — amber, alarmed
  return (
    <div className="bg-warn text-white text-[12px] py-1.5 px-4 flex items-center gap-2 shadow-sm">
      <ShieldAlert size={14} />
      <span className="font-semibold">Platform support is viewing your data (read-only)</span>
      <span className="opacity-80">·</span>
      <span>{active.requestor_name ?? active.requestor_email ?? "Platform staff"}</span>
      <span className="opacity-80">·</span>
      <span title={active.reason} className="truncate max-w-[40ch]">Reason: {active.reason}</span>
      <span className="opacity-80">·</span>
      <span>Expires in {remaining}</span>
      <button
        onClick={handleRevoke}
        disabled={revoking}
        className="ml-auto flex items-center gap-1 text-[11px] bg-card/15 hover:bg-card/25 rounded px-2 py-0.5 transition-colors disabled:opacity-60"
      >
        <X size={12} /> {revoking ? "Revoking…" : "Revoke now"}
      </button>
    </div>
  );
}
