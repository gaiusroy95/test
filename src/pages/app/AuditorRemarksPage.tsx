import { useEffect, useMemo, useState } from "react";
import {
  Plus, MessageSquare, AlertTriangle, AlertCircle, Info,
  CheckCircle2, Clock, Send, Trash2, Pencil, X as XIcon, Calendar, MapPin, ClipboardCheck,
} from "lucide-react";
import { tenantApi } from "@/api/client";
import { getApiError, formatDate, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/shared/PageComponents";
import { useIsSupportSession } from "@/components/shared/WriteOnly";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { useAuthStore } from "@/store/auth";
import type {
  AuditorRemark, RemarkSeverity, RemarkStatus, RemarkSummary, SubmissionListItem,
} from "@/types";

const SEVERITY_CFG: Record<RemarkSeverity, { label: string; color: string; bg: string; border: string; icon: typeof Info }> = {
  OBSERVATION:     { label: "Observation",     color: "text-sky-700",     bg: "bg-sky-50",    border: "border-sky-200",    icon: Info },
  FINDING:         { label: "Finding",         color: "text-amber-700",   bg: "bg-amber-50",  border: "border-amber-200",  icon: AlertCircle },
  NON_CONFORMITY:  { label: "Non-Conformity",  color: "text-red-700",     bg: "bg-red-50",    border: "border-red-200",    icon: AlertTriangle },
};

const STATUS_CFG: Record<RemarkStatus, { label: string; color: string; bg: string; border: string; icon: typeof Clock }> = {
  OPEN:       { label: "Open",       color: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200",   icon: Clock },
  RESPONDED:  { label: "Responded",  color: "text-sky-700",     bg: "bg-sky-50",      border: "border-sky-200",     icon: MessageSquare },
  CLOSED:     { label: "Closed",     color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200", icon: CheckCircle2 },
};

type StatusFilter = "" | RemarkStatus;
type SeverityFilter = "" | RemarkSeverity;

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

  return (
    <div className="page-root">
      <Breadcrumb items={[{ label: "Company Portal", href: "/app" }, { label: "Auditor Remarks" }]} />

      {/* Row 1: title + action */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h1 className="text-[18px] font-bold text-brand-navy tracking-tight">Auditor Remarks</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {isAuditor
              ? "Raise observations, findings, and non-conformities on submitted data"
              : "Observations, findings, and non-conformities raised by the auditor"}
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => { setEditing(null); setShowCreate(true); }}>
            <Plus size={15} /> New Remark
          </Button>
        )}
      </div>

      {/* Row 2: filters */}
      <div className="flex items-end justify-between border-b border-slate-200 mb-4">
        <div className="flex">
          <FilterTab
            active={statusFilter === ""}
            label="All"
            count={summary?.total}
            onClick={() => setStatusFilter("")}
          />
          <FilterTab
            active={statusFilter === "OPEN"}
            label="Open"
            count={summary?.by_status?.OPEN}
            onClick={() => setStatusFilter("OPEN")}
          />
          <FilterTab
            active={statusFilter === "RESPONDED"}
            label="Responded"
            count={summary?.by_status?.RESPONDED}
            onClick={() => setStatusFilter("RESPONDED")}
          />
          <FilterTab
            active={statusFilter === "CLOSED"}
            label="Closed"
            count={summary?.by_status?.CLOSED}
            onClick={() => setStatusFilter("CLOSED")}
          />
        </div>
        <div className="pb-2 flex items-center gap-2">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
            className="py-1.5 px-3 text-[13px] border border-slate-200 rounded-lg text-brand-navy outline-none focus:border-brand-accent"
          >
            <option value="">All Severities</option>
            <option value="OBSERVATION">Observations</option>
            <option value="FINDING">Findings</option>
            <option value="NON_CONFORMITY">Non-Conformities</option>
          </select>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-3 mb-4">
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

      {/* Split view */}
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4">
        {/* List */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-200 bg-slate-50/50">
            <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              {remarks.length} Remark{remarks.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="max-h-[65vh] overflow-y-auto">
            {loading ? (
              <div className="text-center py-12 text-[13px] text-slate-400 animate-pulse">Loading…</div>
            ) : remarks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <MessageSquare size={32} className="mb-3 text-slate-300" />
                <p className="text-[13px] font-semibold text-slate-500">No remarks found</p>
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
                    className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${isSelected ? "bg-sky-50/60 border-l-2 border-l-brand-accent" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${sev.color} ${sev.bg} border ${sev.border}`}>
                        <SevIcon size={10} /> {sev.label}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${stat.color} ${stat.bg} border ${stat.border}`}>
                        <StatIcon size={10} /> {stat.label}
                      </span>
                    </div>
                    <p className="text-[12px] text-brand-navy line-clamp-2 mb-1.5">{r.remark_text}</p>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPin size={10} className="text-slate-400" />
                        {r.location_name || "—"}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="flex items-center gap-1">
                        <Calendar size={10} className="text-slate-400" />
                        {r.month_name} {r.fy_label}
                      </span>
                      {r.response_count > 0 && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="flex items-center gap-1 text-brand-accent font-semibold">
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

        {/* Detail */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center h-[65vh] text-slate-400">
              <ClipboardCheck size={32} className="mb-3 text-slate-300" />
              <p className="text-[13px] font-semibold text-slate-500">Select a remark</p>
              <p className="text-[12px] mt-1">Click any item on the left to view details</p>
            </div>
          ) : !selected ? (
            <div className="text-center py-12 text-[13px] text-slate-400 animate-pulse">Loading…</div>
          ) : (
            <RemarkDetail
              remark={selected}
              isAuditor={isAuditor}
              onEdit={() => { setEditing(selected); setShowCreate(true); }}
              onDelete={() => handleDelete(selected.remark_id)}
              onClose={() => handleCloseRemark(selected.remark_id)}
              onCloseDetail={() => { setSelectedId(null); setSelected(null); }}
            />
          )}
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
    </div>
  );
}

function FilterTab({ active, label, count, onClick }: { active: boolean; label: string; count?: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors
        ${active ? "border-brand-accent text-brand-accent" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"}`}
    >
      {label}
      {count != null && count > 0 && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? "bg-brand-accent/10 text-brand-accent" : "bg-slate-100 text-slate-500"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function SummaryCard({ label, value, tone, icon: Icon }: { label: string; value: number; tone: "slate" | "amber" | "red" | "emerald"; icon: typeof Info }) {
  const toneCfg = {
    slate:   { bg: "bg-slate-50",   color: "text-slate-600",   border: "border-slate-200" },
    amber:   { bg: "bg-amber-50",   color: "text-amber-600",   border: "border-amber-200" },
    red:     { bg: "bg-red-50",     color: "text-red-600",     border: "border-red-200" },
    emerald: { bg: "bg-emerald-50", color: "text-emerald-600", border: "border-emerald-200" },
  }[tone];
  return (
    <div className={`rounded-xl border ${toneCfg.border} ${toneCfg.bg} px-4 py-3 flex items-center gap-3`}>
      <div className={`w-9 h-9 rounded-lg bg-white/70 flex items-center justify-center ${toneCfg.color}`}>
        <Icon size={16} />
      </div>
      <div>
        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <p className={`text-[20px] font-bold ${toneCfg.color}`}>{value}</p>
      </div>
    </div>
  );
}

// ── Remark detail (shared with side panel) ─────────────────────────────────
function RemarkDetail({
  remark, isAuditor, onEdit, onDelete, onClose, onCloseDetail,
}: {
  remark: AuditorRemark;
  isAuditor: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  onCloseDetail: () => void;
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
    <div className="flex flex-col h-full max-h-[65vh]">
      <div className="px-5 py-3 border-b border-slate-200 flex items-start justify-between gap-3 flex-shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${sev.color} ${sev.bg} border ${sev.border}`}>
              <sev.icon size={10} /> {sev.label}
            </span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${stat.color} ${stat.bg} border ${stat.border}`}>
              <stat.icon size={10} /> {stat.label}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
            <span className="flex items-center gap-1">
              <MapPin size={10} className="text-slate-400" />
              {remark.location_name || "—"}
            </span>
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-1">
              <Calendar size={10} className="text-slate-400" />
              {remark.month_name} {remark.fy_label}
            </span>
            {remark.kpi_name && (
              <>
                <span className="text-slate-300">·</span>
                <span>KPI: {remark.kpi_name}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {canEditOwn && (
            <button onClick={onEdit} title="Edit" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-brand-accent">
              <Pencil size={14} />
            </button>
          )}
          {canEditOwn && (
            <button onClick={onDelete} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
              <Trash2 size={14} />
            </button>
          )}
          <button onClick={onCloseDetail} title="Close" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <XIcon size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Remark body */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[12px] font-semibold text-brand-navy">{remark.auditor_name || "Auditor"}</span>
            <span className="text-[10px] text-slate-400">{formatDateTime(remark.created_at)}</span>
          </div>
          <p className="text-[13px] text-brand-navy whitespace-pre-wrap leading-relaxed">{remark.remark_text}</p>
        </div>

        {/* Response thread */}
        {remark.responses.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Responses</p>
            {remark.responses.map((resp) => (
              <div key={resp.response_id} className="bg-sky-50/40 border border-sky-100 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[12px] font-semibold text-brand-navy">{resp.responder_name || "User"}</span>
                  {resp.responder_role && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">{resp.responder_role}</span>
                  )}
                  <span className="text-[10px] text-slate-400">{formatDateTime(resp.created_at)}</span>
                </div>
                <p className="text-[13px] text-brand-navy whitespace-pre-wrap leading-relaxed">{resp.response_text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer actions */}
      {remark.status !== "CLOSED" && (
        <div className="border-t border-slate-200 p-4 flex-shrink-0 bg-white">
          {canRespond && (
            <div className="flex items-end gap-2">
              <textarea
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                rows={2}
                placeholder="Write a response…"
                className="flex-1 py-1.5 px-3 rounded-lg border border-slate-200 text-[13px] text-brand-navy outline-none resize-none focus:border-brand-accent"
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
                className="text-[12px] font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
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
              <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Submission</label>
              <select
                value={submissionId}
                onChange={(e) => setSubmissionId(e.target.value)}
                disabled={loadingSubs}
                className="w-full py-1.5 px-3 text-[13px] border border-slate-200 rounded-lg text-brand-navy outline-none focus:border-brand-accent"
              >
                <option value="">{loadingSubs ? "Loading…" : "Select submission…"}</option>
                {submissions.map((s) => (
                  <option key={s.submission_id} value={s.submission_id}>
                    {s.location_name} · {s.month_name} {s.year_label} · {s.status}
                  </option>
                ))}
              </select>
              {!loadingSubs && submissions.length === 0 && (
                <p className="text-[11px] text-slate-400 mt-1">No reviewable submissions available</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Severity</label>
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
                      ${active ? `${cfg.bg} ${cfg.color} ${cfg.border.replace("border-", "border-")}` : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                  >
                    <Icon size={13} /> {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Remark</label>
            <textarea
              value={remarkText}
              onChange={(e) => setRemarkText(e.target.value)}
              rows={6}
              placeholder="Describe the observation, finding, or non-conformity…"
              className="w-full py-2 px-3 rounded-lg border border-slate-200 text-[13px] text-brand-navy outline-none resize-none focus:border-brand-accent"
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
