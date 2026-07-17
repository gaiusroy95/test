/**
 * SupportAccessInbox — Company Admin's view of all platform-staff support
 * access requests for their company.
 *
 * Pending requests show Approve / Deny buttons (with optional reason).
 * Active sessions show Revoke. Historical rows are displayed for transparency
 * (denied / revoked / expired) so the Admin always sees who looked at what,
 * when, and why.
 */

import { useEffect, useState } from "react";
import { ShieldAlert, Clock, Check, X, Eye } from "lucide-react";
import { tenantApi } from "@/api/client";
import { Button } from "@/components/ui/button";
import { formatDateTime, getApiError } from "@/lib/utils";
import { toast } from "sonner";

interface SupportAccessRequest {
  request_id: string;
  requestor_name?: string;
  requestor_email?: string;
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
  APPROVED: "bg-ok-tint text-ok border-ok/30",
  DENIED:   "bg-destructive-tint text-destructive border-destructive/30",
  EXPIRED:  "bg-sunken text-muted-foreground border-border",
  REVOKED:  "bg-sunken text-muted-foreground border-border",
};

export function SupportAccessInbox() {
  const [requests, setRequests] = useState<SupportAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await tenantApi.listSupportAccessRequests();
      const sorted = [...(res.data as SupportAccessRequest[])].sort(
        (a, b) => +new Date(b.requested_at) - +new Date(a.requested_at),
      );
      setRequests(sorted);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to load support requests"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const handleDecide = async (req: SupportAccessRequest, decision: "APPROVED" | "DENIED") => {
    let reasonText: string | undefined;
    if (decision === "DENIED") {
      const r = window.prompt("Reason for denial (optional, shared with platform staff):");
      if (r === null) return;
      reasonText = r.trim() || undefined;
    } else {
      if (!confirm("Approve this support access request? Platform staff will be able to view your data (read-only) until the session expires.")) return;
    }
    setActingId(req.request_id);
    try {
      await tenantApi.decideSupportAccessRequest(req.request_id, decision, reasonText);
      toast.success(decision === "APPROVED" ? "Access approved" : "Request denied");
      await refresh();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to update request"));
    } finally {
      setActingId(null);
    }
  };

  const handleRevoke = async (req: SupportAccessRequest) => {
    if (!confirm("End this support session immediately? Platform staff will lose access right away.")) return;
    const r = window.prompt("Optional reason for revoking:") ?? undefined;
    setActingId(req.request_id);
    try {
      await tenantApi.revokeSupportAccessRequest(req.request_id, r?.trim() || undefined);
      toast.success("Session revoked");
      await refresh();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to revoke"));
    } finally {
      setActingId(null);
    }
  };

  if (loading) {
    return <div className="text-[13px] text-muted-foreground text-center py-10">Loading…</div>;
  }

  return (
    <div className="space-y-5">
      <div className="bg-warn-tint/40 border border-warn/30 rounded-md p-3 flex items-start gap-3">
        <ShieldAlert size={16} className="text-warn mt-0.5 shrink-0" />
        <div className="text-[12px] text-foreground/90">
          <p className="font-semibold mb-0.5">What is Support Access?</p>
          <p>
            When platform support needs to investigate an issue with your data, they must request your explicit consent here.
            All sessions are read-only — they cannot create, edit, or delete anything — and you can revoke an active session at any time.
            Every action is recorded in the audit log.
          </p>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <ShieldAlert size={28} className="mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-[13px] text-muted-foreground">No support access requests have been made for your company.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => {
            const isPending = r.status === "PENDING";
            const isActive  = r.status === "APPROVED";
            return (
              <div key={r.request_id} className="border border-border rounded-md px-4 py-3 bg-card">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_STYLES[r.status]}`}>
                        {r.status}
                      </span>
                      <span className="text-[12px] font-semibold text-foreground">
                        {r.requestor_name ?? r.requestor_email ?? "Platform staff"}
                      </span>
                      {r.requestor_email && r.requestor_name && (
                        <span className="text-[11px] text-muted-foreground">· {r.requestor_email}</span>
                      )}
                      <span className="text-[11px] text-muted-foreground">· requested {formatDateTime(r.requested_at)}</span>
                      {r.expires_at && r.status === "APPROVED" && (
                        <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                          <Clock size={10} /> expires {formatDateTime(r.expires_at)}
                        </span>
                      )}
                      {r.use_count > 0 && (
                        <span className="text-[10px] text-muted-foreground">used {r.use_count}×</span>
                      )}
                    </div>
                    <p className="text-[12.5px] text-foreground/90 mb-1">
                      <span className="text-[11px] text-muted-foreground mr-1">Reason:</span>
                      {r.reason}
                    </p>
                    {r.decided_at && r.decider_name && (
                      <p className="text-[10px] text-muted-foreground">
                        Decided by {r.decider_name} · {formatDateTime(r.decided_at)}
                      </p>
                    )}
                    {r.revoke_reason && (
                      <p className="text-[10px] text-muted-foreground italic">Revoke reason: {r.revoke_reason}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 items-stretch shrink-0">
                    {isPending && (
                      <>
                        <Button
                          onClick={() => handleDecide(r, "APPROVED")}
                          disabled={actingId === r.request_id}
                          className="bg-green-600 hover:bg-green-700 text-white text-[12px] h-7 px-3 inline-flex items-center gap-1.5"
                        >
                          <Check size={12} /> Approve
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleDecide(r, "DENIED")}
                          disabled={actingId === r.request_id}
                          className="text-[12px] h-7 px-3 inline-flex items-center gap-1.5"
                        >
                          <X size={12} /> Deny
                        </Button>
                      </>
                    )}
                    {isActive && (
                      <Button
                        variant="outline"
                        onClick={() => handleRevoke(r)}
                        disabled={actingId === r.request_id}
                        className="text-[12px] h-7 px-3 inline-flex items-center gap-1.5 border-destructive/30 text-destructive hover:bg-destructive-tint"
                      >
                        <X size={12} /> Revoke
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
