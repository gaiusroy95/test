import { useEffect, useState } from "react";
import {
  Plus, MessageSquare, AlertTriangle, AlertCircle, Info,
  CheckCircle2, Clock, Send, Trash2, Pencil, X as XIcon, Calendar, MapPin, ClipboardCheck,
} from "lucide-react";
import { tenantApi } from "@/api/client";
import { getApiError, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/shared/PageShell";
import { PageTabs } from "@/components/shared/PageTabs";
import { useIsSupportSession } from "@/components/shared/WriteOnly";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthStore } from "@/store/auth";
import type {
  AuditorRemark, RemarkSeverity, RemarkStatus, RemarkSummary, SubmissionListItem,
} from "@/types";

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

type StatusFilter = "" | RemarkStatus;
type SeverityFilter = "" | RemarkSeverity;

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "RESPONDED", label: "Responded" },
  { key: "CLOSED", label: "Closed" },
] as const;

export default function AuditorRemarksPage() {
  const user = useAuthStore((s) => s.user);
  const isAuditor = user?.role === "AUDITOR";
  const canCreate = isAuditor;

  const [remarks, setRemarks] = useState<AuditorRemark[]>([]);
  const [summary, setSummary] = useState<RemarkSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditorRemark | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AuditorRemark | null>(null);

  const fetchList = async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {};
      if (statusFilter) params.status = statusFilter;
      if (severityFilter) params.severity = severityFilter;
      const [lRes, sRes] = await Promise.all([
        tenantApi.listRemarks(params),
        tenantApi.remarkSummary(),
      ]);
      setRemarks(lRes.data || []);
      setSummary(sRes.data);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to load remarks"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchList(); }, [statusFilter, severityFilter]);

  const loadDetail = async (id: string) => {
    if (selectedId === id) {
      setSelectedId(null);
      setSelected(null);
      return;
    }
    setSelectedId(id);
    setSelected(null);
    try {
      const { data } = await tenantApi.getRemark(id);
      setSelected(data);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to load remark"));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this remark? This cannot be undone.")) return;
    try {
      await tenantApi.deleteRemark(id);
      toast.success("Remark deleted");
      setSelectedId(null);
      setSelected(null);
      fetchList();
    } catch (err: any) {
      toast.error(getApiError(err, "Delete failed"));
    }
  };

  const handleCloseRemark = async (id: string) => {
    try {
      await tenantApi.updateRemark(id, { status: "CLOSED" });
      toast.success("Remark closed");
      fetchList();
      if (selectedId === id) {
        const { data } = await tenantApi.getRemark(id);
        setSelected(data);
      }
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to close remark"));
    }
  };

  const clearDetail = () => {
    setSelectedId(null);
    setSelected(null);
  };

  return (
    <PageShell
      title="Auditor Remarks"
      description={
        isAuditor
          ? "Raise observations, findings, and non-conformities on submitted data"
          : "Observations, findings, and non-conformities raised by the auditor"
      }
      breadcrumb={[{ label: "Company Portal", href: "/app" }, { label: "Auditor Remarks" }]}
      className="[&_.page-header]:mb-2"
      actions={
        canCreate ? (
          <Button size="sm" onClick={() => { setEditing(null); setShowCreate(true); }}>
            <Plus size={14} /> New Remark
          </Button>
        ) : undefined
      }
      toolbar={
        <div className="flex items-center justify-between gap-3 border-b border-border">
          <PageTabs
            tabs={STATUS_TABS.map((tab) => ({
              key: tab.key,
              label: tab.label,
              count:
                tab.key === ""
                  ? summary?.total
                  : summary?.by_status?.[tab.key as RemarkStatus],
            }))}
            value={statusFilter}
            onChange={(key) => setStatusFilter(key as StatusFilter)}
            className="border-b-0"
          />
          <Select
            value={severityFilter || "all"}
            onValueChange={(v) => setSeverityFilter(v === "all" ? "" : (v as SeverityFilter))}
          >
            <SelectTrigger className="w-[160px] h-8 mb-1.5 shrink-0">
              <SelectValue placeholder="All Severities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="OBSERVATION">Observations</SelectItem>
              <SelectItem value="FINDING">Findings</SelectItem>
              <SelectItem value="NON_CONFORMITY">Non-Conformities</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    >

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-2 mb-3">
          <SummaryCard
            label="Total"
            value={summary.total}
            tone="slate"
            icon={MessageSquare}
          />
          <SummaryCard
            label="Open"
            value={summary.open_count}
            tone="amber"
            icon={Clock}
          />
          <SummaryCard
            label="Findings"
            value={summary.by_severity?.FINDING ?? 0}
            tone="amber"
            icon={AlertCircle}
          />
          <SummaryCard
            label="Non-Conformities"
            value={summary.by_severity?.NON_CONFORMITY ?? 0}
            tone="red"
            icon={AlertTriangle}
          />
        </div>
      )}

      {/* Split view — matching panel chrome on both sides */}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3 items-stretch">
        {/* List */}
        <div className="bg-card border border-border rounded-md overflow-hidden flex flex-col min-h-[420px]">
          <div className="px-4 py-2 border-b border-border bg-sunken/50 flex-shrink-0">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              {remarks.length} Remark{remarks.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[60vh]">
            {loading ? (
              <div className="text-center py-12 text-[13px] text-muted-foreground animate-pulse">Loading…</div>
            ) : remarks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageSquare size={32} className="mb-3 text-muted-foreground/40" />
                <p className="text-[13px] font-semibold text-muted-foreground">No remarks found</p>
                <p className="text-[12px] mt-1">
                  {statusFilter || severityFilter
                    ? "Try adjusting filters"
                    : isAuditor
                      ? "Click 'New Remark' to raise an observation"
                      : "No remarks have been raised yet"}
                </p>
              </div>
            ) : (
              remarks.map((r) => {
                const sev = SEVERITY_CFG[r.severity];
                const stat = STATUS_CFG[r.status];
                const SevIcon = sev.icon;
                const StatIcon = stat.icon;
                const isSelected = selectedId === r.remark_id;
                return (
                  <button
                    key={r.remark_id}
                    onClick={() => loadDetail(r.remark_id)}
                    className={`w-full text-left px-4 py-3 border-b border-[hsl(var(--border-hairline))] hover:bg-sunken transition-colors ${isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${sev.color} ${sev.bg} border ${sev.border}`}>
                        <SevIcon size={10} /> {sev.label}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${stat.color} ${stat.bg} border ${stat.border}`}>
                        <StatIcon size={10} /> {stat.label}
                      </span>
                    </div>
                    <p className="text-[12px] text-foreground line-clamp-2 mb-1.5">{r.remark_text}</p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPin size={10} className="text-muted-foreground" />
                        {r.location_name || "—"}
                      </span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="flex items-center gap-1">
                        <Calendar size={10} className="text-muted-foreground" />
                        {r.month_name} {r.fy_label}
                      </span>
                      {r.response_count > 0 && (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="flex items-center gap-1 text-primary font-semibold">
                            <MessageSquare size={10} /> {r.response_count}
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detail — same header chrome as list */}
        <div className="bg-card border border-border rounded-md overflow-hidden flex flex-col min-h-[420px]">
          <div className="px-4 py-2 border-b border-border bg-sunken/50 flex-shrink-0 flex items-center justify-between gap-2">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Detail
            </span>
            {selectedId && (
              <button
                onClick={clearDetail}
                title="Close"
                className="p-1 rounded-md hover:bg-card text-muted-foreground"
              >
                <XIcon size={14} />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-hidden min-h-0">
            {!selectedId ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[360px] text-muted-foreground">
                <ClipboardCheck size={32} className="mb-3 text-muted-foreground/40" />
                <p className="text-[13px] font-semibold text-muted-foreground">Select a remark</p>
                <p className="text-[12px] mt-1">Click any item on the left to view details</p>
              </div>
            ) : !selected ? (
              <div className="text-center py-12 text-[13px] text-muted-foreground animate-pulse">Loading…</div>
            ) : (
              <RemarkDetail
                remark={selected}
                isAuditor={isAuditor}
                onEdit={() => { setEditing(selected); setShowCreate(true); }}
                onDelete={() => handleDelete(selected.remark_id)}
                onClose={() => handleCloseRemark(selected.remark_id)}
                onCloseDetail={clearDetail}
              />
            )}
          </div>
        </div>
      </div>

      {showCreate && (
        <RemarkForm
          remark={editing}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSaved={() => {
            setShowCreate(false);
            setEditing(null);
            fetchList();
            if (selectedId) {
              tenantApi.getRemark(selectedId).then(r => setSelected(r.data)).catch(() => {});
            }
          }}
        />
      )}
    </PageShell>
  );
}

function SummaryCard({ label, value, tone, icon: Icon }: { label: string; value: number; tone: "slate" | "amber" | "red" | "emerald"; icon: typeof Info }) {
  const toneCfg = {
    slate:   { bg: "bg-sunken",   color: "text-muted-foreground",   border: "border-border" },
    amber:   { bg: "bg-warn-tint",   color: "text-warn",   border: "border-warn/30" },
    red:     { bg: "bg-destructive-tint",     color: "text-destructive",     border: "border-destructive/30" },
    emerald: { bg: "bg-ok-tint", color: "text-ok", border: "border-ok/30" },
  }[tone];
  return (
    <div className={`rounded-md border ${toneCfg.border} ${toneCfg.bg} px-3 py-2 flex items-center gap-2.5`}>
      <div className={`w-8 h-8 rounded-md bg-card/70 flex items-center justify-center ${toneCfg.color}`}>
        <Icon size={15} />
      </div>
      <div>
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`text-[18px] font-bold leading-tight ${toneCfg.color}`}>{value}</p>
      </div>
    </div>
  );
}

// ── Remark detail (shared with side panel) ─────────────────────────────────
function RemarkDetail({
  remark, isAuditor, onEdit, onDelete, onClose,
}: {
  remark: AuditorRemark;
  isAuditor: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  onCloseDetail?: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const isSupport = useIsSupportSession();
  const canRespond = (user?.role === "COMPANY_ADMIN" || user?.role === "REVIEWER") && !isSupport;
  const canEditOwn = isAuditor && remark.auditor_user_id === user?.id;
  const canCloseOwn = canEditOwn && remark.status !== "CLOSED";

  const [responseText, setResponseText] = useState("");
  const [posting, setPosting] = useState(false);

  const sev = SEVERITY_CFG[remark.severity];
  const stat = STATUS_CFG[remark.status];

  const handlePostResponse = async () => {
    if (!responseText.trim()) return;
    setPosting(true);
    try {
      await tenantApi.addRemarkResponse(remark.remark_id, responseText.trim());
      toast.success("Response posted");
      setResponseText("");
      // parent will refetch via onSaved pattern; we refetch local
      const { data } = await tenantApi.getRemark(remark.remark_id);
      Object.assign(remark, data);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to post response"));
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[60vh]">
      <div className="px-4 py-2.5 border-b border-border flex items-start justify-between gap-3 flex-shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${sev.color} ${sev.bg} border ${sev.border}`}>
              <sev.icon size={10} /> {sev.label}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${stat.color} ${stat.bg} border ${stat.border}`}>
              <stat.icon size={10} /> {stat.label}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1">
              <MapPin size={10} className="text-muted-foreground" />
              {remark.location_name || "—"}
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span className="flex items-center gap-1">
              <Calendar size={10} className="text-muted-foreground" />
              {remark.month_name} {remark.fy_label}
            </span>
            {remark.kpi_name && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>KPI: {remark.kpi_name}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {canEditOwn && (
            <button onClick={onEdit} title="Edit" className="p-1.5 rounded-md hover:bg-sunken text-muted-foreground hover:text-primary">
              <Pencil size={14} />
            </button>
          )}
          {canEditOwn && (
            <button onClick={onDelete} title="Delete" className="p-1.5 rounded-md hover:bg-destructive-tint text-muted-foreground hover:text-destructive">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Remark body */}
        <div className="bg-sunken border border-border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[12px] font-semibold text-foreground">{remark.auditor_name || "Auditor"}</span>
            <span className="text-[10px] text-muted-foreground">{formatDateTime(remark.created_at)}</span>
          </div>
          <p className="text-[13px] text-foreground whitespace-pre-wrap leading-relaxed">{remark.remark_text}</p>
        </div>

        {/* Response thread */}
        {remark.responses.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Responses</p>
            {remark.responses.map((resp) => (
              <div key={resp.response_id} className="bg-info-tint/40 border border-sky-100 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[12px] font-semibold text-foreground">{resp.responder_name || "User"}</span>
                  {resp.responder_role && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-sunken text-muted-foreground font-semibold">{resp.responder_role}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground">{formatDateTime(resp.created_at)}</span>
                </div>
                <p className="text-[13px] text-foreground whitespace-pre-wrap leading-relaxed">{resp.response_text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer actions */}
      {remark.status !== "CLOSED" && (
        <div className="border-t border-border p-4 flex-shrink-0 bg-card">
          {canRespond && (
            <div className="flex items-end gap-2">
              <textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                rows={2}
                placeholder="Write a response…"
                className="flex-1 py-1.5 px-3 rounded-lg border border-border text-[13px] text-foreground outline-none resize-none focus:border-primary"
              />
              <Button onClick={handlePostResponse} disabled={posting || !responseText.trim()}>
                <Send size={13} /> {posting ? "…" : "Reply"}
              </Button>
            </div>
          )}
          {canCloseOwn && (
            <div className="mt-2 flex justify-end">
              <button
                onClick={onClose}
                className="text-[12px] font-semibold text-ok hover:text-ok flex items-center gap-1"
              >
                <CheckCircle2 size={12} /> Mark as Closed
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Create/Edit Form ───────────────────────────────────────────────────────
function RemarkForm({
  remark, onClose, onSaved,
}: {
  remark: AuditorRemark | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!remark;
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  const [submissionId, setSubmissionId] = useState(remark?.submission_id || "");
  const [remarkText, setRemarkText] = useState(remark?.remark_text || "");
  const [severity, setSeverity] = useState<RemarkSeverity>(remark?.severity || "OBSERVATION");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEdit) return;
    setLoadingSubs(true);
    Promise.all([
      tenantApi.listSubmissions({ size: 200, status: "SUBMITTED" }),
      tenantApi.listSubmissions({ size: 200, status: "APPROVED" }),
    ])
      .then(([sub, app]) => {
        const subs = [...(sub.data.items || []), ...(app.data.items || [])];
        setSubmissions(subs);
      })
      .catch(() => toast.error("Failed to load submissions"))
      .finally(() => setLoadingSubs(false));
  }, [isEdit]);

  const handleSave = async () => {
    if (!isEdit && !submissionId) {
      toast.error("Select a submission");
      return;
    }
    if (!remarkText.trim()) {
      toast.error("Remark text is required");
      return;
    }
    setSaving(true);
    try {
      if (isEdit && remark) {
        await tenantApi.updateRemark(remark.remark_id, {
          remark_text: remarkText,
          severity,
        });
        toast.success("Remark updated");
      } else {
        await tenantApi.createRemark({
          submission_id: submissionId,
          remark_text: remarkText,
          severity,
        });
        toast.success("Remark raised");
      }
      onSaved();
    } catch (err: any) {
      toast.error(getApiError(err, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Remark" : "New Remark"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {!isEdit && (
            <div>
              <label className="block text-[12px] font-semibold text-foreground mb-1.5">Submission</label>
              <select
                value={submissionId}
                onChange={(e) => setSubmissionId(e.target.value)}
                disabled={loadingSubs}
                className="w-full py-1.5 px-3 text-[13px] border border-border rounded-lg text-foreground outline-none focus:border-primary"
              >
                <option value="">{loadingSubs ? "Loading…" : "Select submission…"}</option>
                {submissions.map((s) => (
                  <option key={s.submission_id} value={s.submission_id}>
                    {s.location_name} · {s.month_name} {s.year_label} · {s.status}
                  </option>
                ))}
              </select>
              {!loadingSubs && submissions.length === 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">No reviewable submissions available</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-[12px] font-semibold text-foreground mb-1.5">Severity</label>
            <div className="grid grid-cols-3 gap-2">
              {(["OBSERVATION", "FINDING", "NON_CONFORMITY"] as RemarkSeverity[]).map((s) => {
                const cfg = SEVERITY_CFG[s];
                const Icon = cfg.icon;
                const active = severity === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverity(s)}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border-2 text-[12px] font-semibold transition-colors
                      ${active ? `${cfg.bg} ${cfg.color} ${cfg.border.replace("border-", "border-")}` : "bg-card border-border text-muted-foreground hover:bg-sunken"}`}
                  >
                    <Icon size={13} /> {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-foreground mb-1.5">Remark</label>
            <textarea
              value={remarkText}
              onChange={(e) => setRemarkText(e.target.value)}
              rows={6}
              placeholder="Describe the observation, finding, or non-conformity…"
              className="w-full py-2 px-3 rounded-lg border border-border text-[13px] text-foreground outline-none resize-none focus:border-primary"
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save" : "Raise Remark"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Export the detail component so it can be reused as a side panel in ReviewPage
export { RemarkDetail as AuditorRemarkDetail, SEVERITY_CFG as REMARK_SEVERITY_CFG, STATUS_CFG as REMARK_STATUS_CFG };
