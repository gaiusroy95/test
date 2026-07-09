/**
 * Scope3ReviewDetail — Detail panel for reviewing a Scope 3 batch.
 * Shows batch header, unified entries table, and approve/reject actions.
 *
 * GHG Protocol aligned: each entry now has calculation_method (SUPPLIER_SPECIFIC |
 * AVERAGE_DATA | SPEND_BASED | DIRECT_ESTIMATE) — no batch-level entry_type dispatch.
 */
import { useEffect, useState } from "react";
import {
  Package2, Calendar, CheckCircle2, XCircle, AlertCircle,
  X as XIcon, Check,
} from "lucide-react";
import { tenantApi } from "@/api/client";
import { getApiError } from "@/lib/utils";
import { toast } from "sonner";
import type { Scope3Batch, Scope3Entry, Scope3CalcMethod } from "@/types";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  DRAFT:     { label: "Draft",    color: "text-muted-foreground",   bg: "bg-sunken",   border: "border-border" },
  SUBMITTED: { label: "Pending",  color: "text-warn",   bg: "bg-warn-tint",    border: "border-warn/30" },
  APPROVED:  { label: "Approved", color: "text-ok", bg: "bg-ok-tint",  border: "border-ok/30" },
  REJECTED:  { label: "Rejected", color: "text-destructive",     bg: "bg-destructive-tint",      border: "border-destructive/30" },
};

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const METHOD_BADGE: Record<Scope3CalcMethod, string> = {
  SUPPLIER_SPECIFIC: "text-ok bg-ok-tint border border-ok/30",
  AVERAGE_DATA:      "text-info bg-info-tint border border-info/30",
  SPEND_BASED:       "text-warn bg-warn-tint border border-warn/30",
  DIRECT_ESTIMATE:   "text-muted-foreground bg-sunken border border-border",
};

const METHOD_LABEL: Record<Scope3CalcMethod, string> = {
  SUPPLIER_SPECIFIC: "Supplier",
  AVERAGE_DATA:      "Avg-data",
  SPEND_BASED:       "Spend",
  DIRECT_ESTIMATE:   "Direct",
};

const hdrCls = "px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-left";

interface Props {
  batch: Scope3Batch;
  canReview: boolean;
  onReviewed: () => void;
  onClose: () => void;
}

export default function Scope3ReviewDetail({ batch, canReview, onReviewed, onClose }: Props) {
  const [entries, setEntries] = useState<Scope3Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewNotes, setReviewNotes] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    tenantApi.listScope3Entries(batch.batch_id, { size: 500 })
      .then((res) => setEntries(res.data.items || []))
      .catch(() => toast.error("Failed to load entries"))
      .finally(() => setLoading(false));
  }, [batch.batch_id]);

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await tenantApi.reviewScope3Batch(batch.batch_id, {
        action: "APPROVE",
        rejection_reason: reviewNotes || undefined,
      });
      toast.success("Scope 3 batch approved");
      onReviewed();
    } catch (err: any) {
      toast.error(getApiError(err, "Approval failed"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!reviewNotes.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    setActionLoading(true);
    try {
      await tenantApi.reviewScope3Batch(batch.batch_id, {
        action: "REJECT",
        rejection_reason: reviewNotes,
      });
      toast.success("Scope 3 batch rejected");
      onReviewed();
    } catch (err: any) {
      toast.error(getApiError(err, "Rejection failed"));
    } finally {
      setActionLoading(false);
    }
  };

  const sCfg = STATUS_CONFIG[batch.status] || STATUS_CONFIG.DRAFT;
  const monthLabel = batch.reporting_month ? MONTH_NAMES[batch.reporting_month] : "Annual";

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-card border-b border-border px-6 py-4 flex-shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Package2 size={16} className="text-violet-500" />
              <h2 className="text-[16px] font-bold text-foreground">
                {batch.ghg_category_name || "Scope 3 Batch"}
              </h2>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${sCfg.color} ${sCfg.bg} border ${sCfg.border}`}>
                {sCfg.label}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar size={12} className="text-muted-foreground" />
                {monthLabel} {batch.reporting_year}
              </span>
              <span className="text-muted-foreground/40">|</span>
              <span>{batch.total_rows} entries</span>
              <span className="text-muted-foreground/40">|</span>
              <span className="font-semibold text-foreground">
                {(batch.total_emissions ?? 0).toFixed(4)} tCO₂e
              </span>
              {batch.factor_set_name && (
                <>
                  <span className="text-muted-foreground/40">|</span>
                  <span>Factor set: <span className="font-medium text-foreground">{batch.factor_set_name}</span></span>
                </>
              )}
            </div>
            {batch.uploader_name && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Submitted by <span className="font-medium text-muted-foreground">{batch.uploader_name}</span>
              </p>
            )}
            {batch.status === "REJECTED" && batch.rejection_reason && (
              <div className="mt-2 flex items-start gap-2 bg-destructive-tint border border-destructive/30 rounded-lg px-3 py-2">
                <AlertCircle size={13} className="text-destructive flex-shrink-0 mt-0.5" />
                <span className="text-[12px] text-destructive">{batch.rejection_reason}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-sunken text-muted-foreground">
            <XIcon size={16} />
          </button>
        </div>
      </div>

      {/* Entries table */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="text-center py-8 text-[13px] text-muted-foreground animate-pulse">Loading entries...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 text-[13px] text-muted-foreground">No entries in this batch</div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-sunken border-b border-border">
                  <tr>
                    <th className={hdrCls} style={{ width: 36 }}>#</th>
                    <th className={hdrCls} style={{ width: 100 }}>Method</th>
                    <th className={hdrCls} style={{ minWidth: 160 }}>Description</th>
                    <th className={hdrCls} style={{ width: 130 }}>Supplier</th>
                    <th className={hdrCls} style={{ width: 80 }}>Qty / Amt</th>
                    <th className={hdrCls} style={{ width: 60 }}>Unit / Curr</th>
                    <th className={hdrCls} style={{ width: 120 }}>Factor / Source</th>
                    <th className={`${hdrCls} text-right`} style={{ width: 90 }}>tCO₂e</th>
                    <th className={hdrCls} style={{ width: 70 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <UnifiedEntryRow key={e.entry_id} entry={e} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Review actions */}
      {canReview && batch.status === "SUBMITTED" && (
        <div className="flex-shrink-0 bg-card border-t border-border px-6 py-4">
          {!showRejectInput ? (
            <div className="flex items-center gap-3">
              <textarea
                className="flex-1 border border-border rounded-lg px-3 py-2 text-[12px] text-foreground resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                rows={1}
                placeholder="Optional review notes..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
              />
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-ok text-white text-[12px] font-semibold hover:bg-emerald-600 disabled:opacity-50"
              >
                <Check size={14} /> Approve
              </button>
              <button
                onClick={() => setShowRejectInput(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-destructive-tint text-destructive text-[12px] font-semibold hover:bg-red-100 border border-destructive/30"
              >
                <XCircle size={14} /> Reject
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                className="w-full border border-destructive/30 rounded-lg px-3 py-2 text-[12px] text-foreground resize-none placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-red-400"
                rows={2}
                placeholder="Reason for rejection (required)..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                autoFocus
              />
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => { setShowRejectInput(false); setReviewNotes(""); }}
                  className="px-3 py-1.5 rounded text-[12px] text-muted-foreground hover:bg-sunken"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={actionLoading || !reviewNotes.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-destructive text-white text-[12px] font-semibold hover:bg-red-600 disabled:opacity-50"
                >
                  <XCircle size={13} /> Confirm Reject
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


/* ── Unified entry row ────────────────────────────────────────────────────── */

function UnifiedEntryRow({ entry: e }: { entry: Scope3Entry }) {
  const hasError = e.validation_status === "ERROR";
  const cellCls = `px-3 py-2 text-[12px] text-foreground ${hasError ? "bg-destructive-tint/50" : ""}`;
  const method = (e.calculation_method || "AVERAGE_DATA") as Scope3CalcMethod;

  /* Qty / Amount column */
  const qtyAmt = (() => {
    if (method === "SPEND_BASED") {
      return e.amount != null ? `${e.amount}` : "—";
    }
    return e.quantity != null ? `${e.quantity}` : "—";
  })();

  /* Unit / Currency column */
  const unitCurr = (() => {
    if (method === "SPEND_BASED") return e.currency_code || "—";
    return e.quantity_unit || "—";
  })();

  /* Factor / Source column */
  const factorSrc = (() => {
    if (method === "SUPPLIER_SPECIFIC") {
      return e.manual_emission_factor != null
        ? `${e.manual_emission_factor} kgCO₂e/unit`
        : "—";
    }
    if (method === "AVERAGE_DATA" || method === "SPEND_BASED") {
      return e.sector_name || "—";
    }
    // DIRECT_ESTIMATE
    return e.source_reference || e.methodology || "—";
  })();

  return (
    <tr className="border-b border-[hsl(var(--border-hairline))] hover:bg-sunken/40">
      <td className={`${cellCls} text-muted-foreground`}>{e.row_number}</td>
      <td className={cellCls}>
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${METHOD_BADGE[method]}`}>
          {METHOD_LABEL[method]}
        </span>
      </td>
      <td className={cellCls}>{e.activity_label || "—"}</td>
      <td className={`${cellCls} text-muted-foreground`}>{e.supplier_name || "—"}</td>
      <td className={`${cellCls} font-mono`}>{qtyAmt}</td>
      <td className={`${cellCls} text-muted-foreground`}>{unitCurr}</td>
      <td className={`${cellCls} text-muted-foreground text-[11px] max-w-[120px] truncate`} title={factorSrc}>{factorSrc}</td>
      <td className={`${cellCls} text-right font-mono font-semibold`}>
        {e.emission_value != null ? e.emission_value.toFixed(4) : "—"}
      </td>
      <td className={cellCls}>
        {hasError ? (
          <span className="text-destructive text-[11px]" title={e.error_message || ""}>
            <AlertCircle size={12} className="inline mr-0.5" />Error
          </span>
        ) : e.validation_status === "WARNING" ? (
          <span className="text-amber-500 text-[11px]" title={e.error_message || ""}>Warn</span>
        ) : (
          <span className="text-emerald-500 text-[11px]">
            <CheckCircle2 size={12} className="inline mr-0.5" />Valid
          </span>
        )}
      </td>
    </tr>
  );
}
