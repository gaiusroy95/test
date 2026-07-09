/**
 * SupportAccessDialog — Platform Owner/Admin requests, manages, and activates
 * read-only support sessions for one tenant company.
 *
 * Workflow:
 *   1. Lists existing requests for this company (PENDING / APPROVED / past).
 *   2. Form to create a new PENDING request (reason + duration).
 *   3. APPROVED requests show "Open Support Session" — activates and opens
 *      a new tab with the support token in the URL hash.
 *   4. PENDING/APPROVED requests show "Cancel" to revoke before use.
 */

import { useEffect, useState } from "react";
import { Eye, ShieldAlert, X, ExternalLink, Clock, Check, Ban } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogBody, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { platformApi } from "@/api/client";
import { formatDateTime, getApiError } from "@/lib/utils";
import { toast } from "sonner";

interface SupportAccessRequest {
  request_id: string;
  requested_by_platform_user_id: string;
  requestor_name?: string;
  requestor_email?: string;
  company_id: string;
  company_name?: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "DENIED" | "EXPIRED" | "REVOKED";
  requested_at: string;
  decided_at?: string;
  decider_name?: string;
  expires_at?: string;
  revoked_at?: string;
  revoke_reason?: string;
  use_count: number;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING:  "bg-warn-tint text-warn border-warn/30",
  APPROVED: "bg-green-50 text-ok border-green-200",
  DENIED:   "bg-destructive-tint text-destructive border-destructive/30",
  EXPIRED:  "bg-sunken text-muted-foreground border-border",
  REVOKED:  "bg-sunken text-muted-foreground border-border",
};

interface Props {
  open: boolean;
  onClose: () => void;
  companyId: string;
  companyName: string;
  /**
   * Optional reason text to pre-fill on open. Used by the platform tickets
   * page so the requester doesn't have to retype "Investigating Ticket #..."
   */
  presetReason?: string;
}

export function SupportAccessDialog({ open, onClose, companyId, companyName, presetReason }: Props) {
  const [requests, setRequests] = useState<SupportAccessRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState(4);
  const [submitting, setSubmitting] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await platformApi.listSupportAccessRequests();
      const filtered = (res.data as SupportAccessRequest[]).filter((r) => r.company_id === companyId);
      filtered.sort((a, b) => +new Date(b.requested_at) - +new Date(a.requested_at));
      setRequests(filtered);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to load support requests"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) refresh();
    // Reset form when dialog reopens; honour caller-provided preset reason if any.
    if (open) { setReason(presetReason ?? ""); setDuration(4); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, companyId, presetReason]);

  const handleCreate = async () => {
    if (reason.trim().length < 10) {
      toast.error("Reason must be at least 10 characters");
      return;
    }
    setSubmitting(true);
    try {
      await platformApi.createSupportAccessRequest({
        company_id: companyId,
        reason: reason.trim(),
        duration_hours: duration,
      });
      toast.success("Support access request sent. Awaiting Company Admin approval.");
      setReason("");
      setDuration(4);
      await refresh();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to create request"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivate = async (req: SupportAccessRequest) => {
    setActivatingId(req.request_id);
    try {
      const res = await platformApi.activateSupportAccess(req.request_id);
      const { support_token, expires_at, request_id, redirect_path } = res.data;
      // Open a new tab with the token in the URL hash. The new tab's auth
      // bootstrap reads the hash, stashes the token in sessionStorage (per-tab),
      // and clears the URL — so the platform session in this tab is unaffected.
      const url = `${redirect_path || "/app/dashboard"}#st=${encodeURIComponent(support_token)}&exp=${encodeURIComponent(expires_at)}&rid=${encodeURIComponent(request_id)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success("Support session opened in a new tab.");
      await refresh();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to activate session"));
    } finally {
      setActivatingId(null);
    }
  };

  const handleCancel = async (req: SupportAccessRequest) => {
    if (!confirm("Cancel this support access request?")) return;
    setCancellingId(req.request_id);
    try {
      await platformApi.cancelSupportAccess(req.request_id, "Cancelled by requester");
      toast.success("Request cancelled");
      await refresh();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to cancel"));
    } finally {
      setCancellingId(null);
    }
  };

  const activeRow = requests.find((r) => r.status === "APPROVED");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-amber-500" /> Support Access · {companyName}
          </DialogTitle>
          <DialogDescription>
            Request read-only access to this tenant's data. The Company Admin must explicitly approve.
            All write actions are blocked during the session, and every request is recorded in the audit log.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {/* New request form */}
          <div className="border border-border rounded-lg p-4 space-y-3">
            <h3 className="text-[13px] font-semibold text-foreground">New request</h3>
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Why do you need access? *</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="e.g., Investigating reported emission factor mismatch in Scope 3 batch SC3-2025-04 — Company Admin requested help via support ticket #4271"
                className="w-full py-2 px-3 text-[13px] text-foreground border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Minimum 10 characters. This text is shown to the Company Admin and stored in the audit log.</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-[11px] font-semibold text-muted-foreground">Session length:</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="py-1.5 px-2 text-[13px] border border-border rounded text-foreground bg-card"
              >
                {[1, 2, 4, 8, 12, 24].map((h) => (
                  <option key={h} value={h}>{h} hour{h > 1 ? "s" : ""}</option>
                ))}
              </select>
              <Button
                onClick={handleCreate}
                disabled={submitting || reason.trim().length < 10}
                className="ml-auto bg-primary hover:bg-primaryDk text-white text-[13px] h-8 px-4"
              >
                {submitting ? "Sending…" : "Send Request"}
              </Button>
            </div>
          </div>

          {/* Existing requests */}
          <div>
            <h3 className="text-[13px] font-semibold text-foreground mb-2">Recent requests</h3>
            {loading ? (
              <div className="text-[12px] text-muted-foreground text-center py-6">Loading…</div>
            ) : requests.length === 0 ? (
              <div className="text-[12px] text-muted-foreground text-center py-6 border border-dashed border-border rounded-lg">
                No support access requests have been made for this company.
              </div>
            ) : (
              <div className="space-y-2">
                {requests.map((r) => {
                  const isActiveable = r.status === "APPROVED";
                  const isCancellable = r.status === "PENDING" || r.status === "APPROVED";
                  return (
                    <div key={r.request_id} className="border border-border rounded-md px-3 py-2.5 bg-card">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_STYLES[r.status]}`}>
                          {r.status}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{formatDateTime(r.requested_at)}</span>
                        {r.expires_at && r.status === "APPROVED" && (
                          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                            <Clock size={10} /> expires {formatDateTime(r.expires_at)}
                          </span>
                        )}
                        {r.use_count > 0 && (
                          <span className="text-[10px] text-muted-foreground">used {r.use_count}×</span>
                        )}
                      </div>
                      <p className="text-[12px] text-foreground/90 mb-1.5 line-clamp-2">{r.reason}</p>
                      {r.decider_name && (
                        <p className="text-[10px] text-muted-foreground">
                          Decided by {r.decider_name}{r.decided_at ? ` · ${formatDateTime(r.decided_at)}` : ""}
                        </p>
                      )}
                      {r.revoke_reason && (
                        <p className="text-[10px] text-muted-foreground italic">Revoke reason: {r.revoke_reason}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {isActiveable && (
                          <Button
                            onClick={() => handleActivate(r)}
                            disabled={activatingId === r.request_id || (!!activeRow && activeRow.request_id !== r.request_id)}
                            className="bg-violet-600 hover:bg-violet-700 text-white text-[12px] h-7 px-3 inline-flex items-center gap-1.5"
                          >
                            <Eye size={12} />
                            {activatingId === r.request_id ? "Opening…" : "Open Support Session"}
                            <ExternalLink size={11} />
                          </Button>
                        )}
                        {isCancellable && (
                          <Button
                            variant="outline"
                            onClick={() => handleCancel(r)}
                            disabled={cancellingId === r.request_id}
                            className="text-[12px] h-7 px-3 inline-flex items-center gap-1.5"
                          >
                            <Ban size={12} />
                            {cancellingId === r.request_id ? "Cancelling…" : "Cancel"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
