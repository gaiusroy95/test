import { useEffect, useState } from "react";
import {
  MessageSquare, X as XIcon, Plus, Send, CheckCircle2, Clock,
  AlertCircle, AlertTriangle, Info, ChevronDown, ChevronRight,
} from "lucide-react";
import { tenantApi } from "@/api/client";
import { getApiError, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";
import type { AuditorRemark, RemarkSeverity, RemarkStatus } from "@/types";

const SEVERITY_CFG: Record<RemarkSeverity, { label: string; color: string; bg: string; border: string; icon: typeof Info }> = {
  OBSERVATION:     { label: "Observation",     color: "text-info",     bg: "bg-info-tint",    border: "border-info/30",    icon: Info },
  FINDING:         { label: "Finding",         color: "text-warn",   bg: "bg-warn-tint",  border: "border-warn/30",  icon: AlertCircle },
  NON_CONFORMITY:  { label: "Non-Conformity",  color: "text-destructive",     bg: "bg-destructive-tint",    border: "border-destructive/30",    icon: AlertTriangle },
};

const STATUS_CFG: Record<RemarkStatus, { label: string; color: string; bg: string; border: string; icon: typeof Clock }> = {
  OPEN:       { label: "Open",       color: "text-warn",   bg: "bg-warn-tint",    border: "border-warn/30",   icon: Clock },
  RESPONDED:  { label: "Responded",  color: "text-info",     bg: "bg-info-tint",      border: "border-info/30",     icon: MessageSquare },
  CLOSED:     { label: "Closed",     color: "text-ok", bg: "bg-ok-tint",  border: "border-ok/30", icon: CheckCircle2 },
};

interface Props {
  submissionId: string;
  submissionStatus: string;
  onClose: () => void;
}

export default function SubmissionRemarksPanel({ submissionId, submissionStatus, onClose }: Props) {
  const user = useAuthStore((s) => s.user);
  const isAuditor = user?.role === "AUDITOR";
  const canRespond = user?.role === "COMPANY_ADMIN" || user?.role === "REVIEWER";
  const canCreate = isAuditor && (submissionStatus === "SUBMITTED" || submissionStatus === "APPROVED");

  const [remarks, setRemarks] = useState<AuditorRemark[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [newText, setNewText] = useState("");
  const [newSeverity, setNewSeverity] = useState<RemarkSeverity>("OBSERVATION");
  const [saving, setSaving] = useState(false);

  const fetchRemarks = async () => {
    setLoading(true);
    try {
      const { data } = await tenantApi.listRemarks({ submission_id: submissionId });
      setRemarks(data || []);
      // Auto-expand OPEN and RESPONDED remarks
      setExpanded(new Set((data || []).filter((r: AuditorRemark) => r.status !== "CLOSED").map((r: AuditorRemark) => r.remark_id)));
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to load remarks"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRemarks(); }, [submissionId]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const handleCreate = async () => {
    if (!newText.trim()) { toast.error("Remark text is required"); return; }
    setSaving(true);
    try {
      await tenantApi.createRemark({
        submission_id: submissionId,
        remark_text: newText.trim(),
        severity: newSeverity,
      });
      toast.success("Remark raised");
      setNewText("");
      setNewSeverity("OBSERVATION");
      setShowCreate(false);
      fetchRemarks();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to raise remark"));
    } finally {
      setSaving(false);
    }
  };

  const handleCloseRemark = async (id: string) => {
    try {
      await tenantApi.updateRemark(id, { status: "CLOSED" });
      toast.success("Remark closed");
      fetchRemarks();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to close remark"));
    }
  };

  const openCount = remarks.filter((r) => r.status !== "CLOSED").length;

  return (
    <div className="w-[480px] flex-shrink-0 bg-card border-l border-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
        <div>
          <h3 className="text-[14px] font-bold text-foreground flex items-center gap-2">
            <MessageSquare size={14} className="text-primary" />
            Auditor Remarks
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {remarks.length} total · {openCount} open
          </p>
        </div>
        <div className="flex items-center gap-1">
          {canCreate && !showCreate && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={13} /> Raise
            </Button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-sunken text-muted-foreground">
            <XIcon size={14} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Create form inline */}
        {showCreate && canCreate && (
          <div className="p-4 border-b border-border bg-warn-tint/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold text-foreground">New Remark</span>
              <button
                onClick={() => { setShowCreate(false); setNewText(""); }}
                className="p-1 rounded hover:bg-sunken text-muted-foreground"
              >
                <XIcon size={12} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {(["OBSERVATION", "FINDING", "NON_CONFORMITY"] as RemarkSeverity[]).map((s) => {
                const cfg = SEVERITY_CFG[s];
                const Icon = cfg.icon;
                const active = newSeverity === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setNewSeverity(s)}
                    className={`flex items-center justify-center gap-1 py-1.5 rounded-md border text-[11px] font-semibold transition-colors
                      ${active ? `${cfg.bg} ${cfg.color} ${cfg.border}` : "bg-card border-border text-muted-foreground hover:bg-sunken"}`}
                  >
                    <Icon size={11} /> {cfg.label}
                  </button>
                );
              })}
            </div>
            <textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              rows={4}
              placeholder="Describe the observation, finding, or non-conformity…"
              className="w-full py-1.5 px-3 rounded-lg border border-border text-[13px] text-foreground outline-none resize-none focus:border-primary mb-2"
            />
            <div className="flex justify-end">
              <Button onClick={handleCreate} disabled={saving || !newText.trim()} size="sm">
                {saving ? "Saving…" : "Raise Remark"}
              </Button>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-10 text-[13px] text-muted-foreground animate-pulse">Loading…</div>
        ) : remarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground px-6">
            <MessageSquare size={28} className="mb-2 text-muted-foreground/40" />
            <p className="text-[13px] font-semibold text-muted-foreground">No remarks</p>
            <p className="text-[11px] text-center mt-1">
              {canCreate ? "Click 'Raise' to add a remark" : "No remarks on this submission"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {remarks.map((r) => (
              <RemarkCard
                key={r.remark_id}
                remark={r}
                expanded={expanded.has(r.remark_id)}
                onToggle={() => toggle(r.remark_id)}
                onChanged={fetchRemarks}
                onClose={() => handleCloseRemark(r.remark_id)}
                canRespond={canRespond}
                isAuditor={isAuditor}
                currentUserId={user?.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RemarkCard({
  remark, expanded, onToggle, onChanged, onClose, canRespond, isAuditor, currentUserId,
}: {
  remark: AuditorRemark;
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
  onClose: () => void;
  canRespond: boolean;
  isAuditor: boolean;
  currentUserId?: string;
}) {
  const sev = SEVERITY_CFG[remark.severity];
  const stat = STATUS_CFG[remark.status];
  const SevIcon = sev.icon;
  const StatIcon = stat.icon;

  const canCloseOwn = isAuditor && remark.auditor_user_id === currentUserId && remark.status !== "CLOSED";

  const [reply, setReply] = useState("");
  const [posting, setPosting] = useState(false);

  const handleReply = async () => {
    if (!reply.trim()) return;
    setPosting(true);
    try {
      await tenantApi.addRemarkResponse(remark.remark_id, reply.trim());
      toast.success("Response posted");
      setReply("");
      onChanged();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to post response"));
    } finally {
      setPosting(false);
    }
  };

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 hover:bg-sunken transition-colors"
      >
        <div className="flex items-start gap-2">
          {expanded
            ? <ChevronDown size={13} className="text-muted-foreground flex-shrink-0 mt-0.5" />
            : <ChevronRight size={13} className="text-muted-foreground flex-shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${sev.color} ${sev.bg} border ${sev.border}`}>
                <SevIcon size={9} /> {sev.label}
              </span>
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${stat.color} ${stat.bg} border ${stat.border}`}>
                <StatIcon size={9} /> {stat.label}
              </span>
              {remark.response_count > 0 && (
                <span className="text-[10px] text-primary font-semibold flex items-center gap-0.5">
                  <MessageSquare size={9} /> {remark.response_count}
                </span>
              )}
            </div>
            <p className={`text-[12px] text-foreground ${expanded ? "" : "line-clamp-2"}`}>{remark.remark_text}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {remark.auditor_name || "Auditor"} · {formatDateTime(remark.created_at)}
            </p>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pl-9 space-y-2">
          {/* Responses */}
          {remark.responses.map((resp) => (
            <div key={resp.response_id} className="bg-info-tint/40 border border-sky-100 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span className="text-[11px] font-semibold text-foreground">{resp.responder_name || "User"}</span>
                {resp.responder_role && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-sunken text-muted-foreground font-semibold">{resp.responder_role}</span>
                )}
                <span className="text-[9px] text-muted-foreground">{formatDateTime(resp.created_at)}</span>
              </div>
              <p className="text-[12px] text-foreground whitespace-pre-wrap leading-relaxed">{resp.response_text}</p>
            </div>
          ))}

          {/* Reply input */}
          {canRespond && remark.status !== "CLOSED" && (
            <div className="flex items-end gap-1.5 mt-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                rows={2}
                placeholder="Reply…"
                className="flex-1 py-1.5 px-2.5 rounded-lg border border-border text-[12px] text-foreground outline-none resize-none focus:border-primary"
              />
              <button
                onClick={handleReply}
                disabled={posting || !reply.trim()}
                className="p-2 rounded-lg bg-primary text-white hover:bg-primaryDk disabled:opacity-40 transition-colors"
                title="Post reply"
              >
                <Send size={12} />
              </button>
            </div>
          )}

          {canCloseOwn && (
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="text-[11px] font-semibold text-ok hover:text-ok flex items-center gap-1"
              >
                <CheckCircle2 size={11} /> Mark as Closed
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
