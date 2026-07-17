import { useEffect, useState, useCallback, useRef, useMemo, type MouseEvent as ReactMouseEvent } from "react";
import {
  Plus, MessageSquare, AlertTriangle, AlertCircle, Info,
  CheckCircle2, Clock, Send, Trash2, Pencil, Calendar, MapPin, ClipboardCheck,
} from "lucide-react";
import * as XLSX from "xlsx";
import { tenantApi } from "@/api/client";
import { getApiError, formatDateTime, cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/shared/PageShell";
import { StatCard } from "@/components/shared/PageComponents";
import { useIsSupportSession } from "@/components/shared/WriteOnly";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { useAuthStore } from "@/store/auth";
import { useModulesStore } from "@/store/modules";
import type {
  AuditorRemark, RemarkSeverity, RemarkStatus, RemarkSummary, SubmissionListItem,
  Location, ReportingYear, KPI,
} from "@/types";
import {
  AuditQueuePanel,
  AuditResizeHandle,
  ChartMaximizeDialog,
  InsightsPanel,
  RecordsTable,
  StickyWorkspaceTabs,
  LEFT_PCT_MIN,
  LEFT_PCT_MAX,
  type InsightsView,
  type WorkspaceTab,
} from "@/components/remarks/AuditorRemarksWorkspace";

const SEVERITY_CFG: Record<RemarkSeverity, { label: string; color: string; bg: string; border: string; rail: string; icon: typeof Info }> = {
  OBSERVATION:     { label: "Observation",     color: "text-info",        bg: "bg-info-tint",        border: "border-info/30",        rail: "bg-info",        icon: Info },
  FINDING:         { label: "Finding",         color: "text-warn",        bg: "bg-warn-tint",        border: "border-warn/30",        rail: "bg-warn",        icon: AlertCircle },
  NON_CONFORMITY:  { label: "Non-Conformity",  color: "text-amber-800 dark:text-amber-200", bg: "bg-amber-500/15", border: "border-amber-800/40 dark:border-amber-500/40", rail: "bg-amber-700 dark:bg-amber-500", icon: AlertTriangle },
};

const STATUS_CFG: Record<RemarkStatus, { label: string; color: string; bg: string; border: string; icon: typeof Clock }> = {
  OPEN:       { label: "Open",       color: "text-warn",   bg: "bg-warn-tint",    border: "border-warn/30",   icon: Clock },
  RESPONDED:  { label: "Responded",  color: "text-info",   bg: "bg-info-tint",    border: "border-info/30",   icon: MessageSquare },
  CLOSED:     { label: "Closed",     color: "text-ok",     bg: "bg-ok-tint",      border: "border-ok/30",     icon: CheckCircle2 },
};

type StatusFilter = "" | RemarkStatus;
type SeverityFilter = "" | RemarkSeverity;

const LEFT_PCT_DEFAULT = 38;

const MONTH_ORDER = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function AuditorRemarksPage() {
  const user = useAuthStore((s) => s.user);
  const modules = useModulesStore((s) => s.modules);
  const isAuditor = user?.role === "AUDITOR";
  const canCreate = isAuditor;

  const [remarks, setRemarks] = useState<AuditorRemark[]>([]);
  const [summary, setSummary] = useState<RemarkSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("");
  const [selLocation, setSelLocation] = useState("");
  const [selYear, setSelYear] = useState("");
  const [selModule, setSelModule] = useState("");

  const [locations, setLocations] = useState<Location[]>([]);
  const [reportingYears, setReportingYears] = useState<ReportingYear[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<AuditorRemark | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AuditorRemark | null>(null);

  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("detail");
  const [insightsView, setInsightsView] = useState<InsightsView>("chart");
  const [chartMaximized, setChartMaximized] = useState(false);

  const [leftPct, setLeftPct] = useState(LEFT_PCT_DEFAULT);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    Promise.allSettled([
      tenantApi.listLocations({ size: 500 }),
      tenantApi.listReportingYears(),
      tenantApi.listKPIs({ size: 500 }),
    ]).then(([locR, yrR, kpiR]) => {
      if (locR.status === "fulfilled") {
        const d = locR.value.data;
        setLocations(Array.isArray(d) ? d : d?.items || []);
      }
      if (yrR.status === "fulfilled") {
        const d = yrR.value.data;
        setReportingYears(Array.isArray(d) ? d : d?.items || []);
      }
      if (kpiR.status === "fulfilled") {
        const d = kpiR.value.data;
        setKpis(Array.isArray(d) ? d : d?.items || []);
      }
    });
  }, []);

  const fetchList = useCallback(async () => {
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
  }, [statusFilter, severityFilter]);

  useEffect(() => { fetchList(); }, [fetchList]);

  const moduleKpiNames = useMemo(() => {
    if (!selModule) return null;
    return new Set(kpis.filter((k) => k.module_id === Number(selModule)).map((k) => k.kpi_name));
  }, [kpis, selModule]);

  const filteredRemarks = useMemo(() => {
    return remarks.filter((r) => {
      if (selLocation) {
        const loc = locations.find((l) => l.location_id === selLocation);
        if (loc && r.location_name !== loc.location_name) return false;
      }
      if (selYear) {
        const ry = reportingYears.find((y) => String(y.year_id) === selYear);
        const label = String(ry?.financial_year?.fy_label || selYear);
        const a = r.fy_label?.match(/\d{4}/)?.[0];
        const b = label.match(/\d{4}/)?.[0];
        if (a && b && a !== b) return false;
        if (r.fy_label && !a && r.fy_label !== label && r.fy_label !== `FY ${label}`) return false;
      }
      if (moduleKpiNames && (!r.kpi_name || !moduleKpiNames.has(r.kpi_name))) return false;
      return true;
    });
  }, [remarks, selLocation, selYear, moduleKpiNames, locations, reportingYears]);

  const listForTab = useMemo(() => {
    if (workspaceTab === "responded") return filteredRemarks.filter((r) => r.status === "RESPONDED");
    return filteredRemarks;
  }, [filteredRemarks, workspaceTab]);

  const chartData = useMemo(() => {
    const byMonth: Record<string, { month: string; Open: number; Findings: number; "Non-Conformities": number; Observations: number }> = {};
    for (const r of filteredRemarks) {
      const key = r.month_name || "Unknown";
      if (!byMonth[key]) byMonth[key] = { month: key, Open: 0, Findings: 0, "Non-Conformities": 0, Observations: 0 };
      if (r.status === "OPEN") byMonth[key].Open += 1;
      if (r.severity === "FINDING") byMonth[key].Findings += 1;
      if (r.severity === "NON_CONFORMITY") byMonth[key]["Non-Conformities"] += 1;
      if (r.severity === "OBSERVATION") byMonth[key].Observations += 1;
    }
    return Object.values(byMonth).sort((a, b) => {
      const ia = MONTH_ORDER.indexOf(a.month);
      const ib = MONTH_ORDER.indexOf(b.month);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [filteredRemarks]);

  const loadDetail = async (id: string) => {
    if (selectedId === id) {
      setSelectedId(null);
      setSelected(null);
      return;
    }
    setSelectedId(id);
    setSelected(null);
    setWorkspaceTab("detail");
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

  const onResizeStart = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current || !workspaceRef.current) return;
      const rect = workspaceRef.current.getBoundingClientRect();
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(LEFT_PCT_MAX, Math.max(LEFT_PCT_MIN, pct)));
    };
    const onUp = () => {
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  const exportExcel = () => {
    const rows = filteredRemarks.map((r) => ({
      Severity: SEVERITY_CFG[r.severity]?.label || r.severity,
      Status: STATUS_CFG[r.status]?.label || r.status,
      Location: r.location_name || "",
      Period: `${r.month_name || ""} ${r.fy_label || ""}`.trim(),
      KPI: r.kpi_name || "",
      Remark: r.remark_text,
      Auditor: r.auditor_name || "",
      Responses: r.response_count,
      Created: r.created_at,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Auditor Remarks");
    XLSX.writeFile(wb, "auditor-remarks.xlsx");
    toast.success("Exported to Excel");
  };

  const hasScopeFilters = !!(selLocation || selYear || selModule);

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
        <div role="tablist" className="config-tabs" aria-label="Remark status">
          {([
            { key: "" as StatusFilter, label: "All", count: summary?.total },
            { key: "OPEN" as StatusFilter, label: "Open", count: summary?.by_status?.OPEN },
            { key: "RESPONDED" as StatusFilter, label: "Responded", count: summary?.by_status?.RESPONDED },
            { key: "CLOSED" as StatusFilter, label: "Closed", count: summary?.by_status?.CLOSED },
          ]).map((tab) => (
            <button
              key={tab.key || "all"}
              type="button"
              role="tab"
              aria-selected={statusFilter === tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn("config-tab", statusFilter === tab.key && "config-tab-active")}
            >
              {tab.label}
              {typeof tab.count === "number" && (
                <span className="text-2xs font-bold px-1.5 py-0.5 rounded-full bg-sunken text-muted-foreground tabular-nums">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      }
    >
      {summary && (
        <div className="card-grid mb-3">
          <StatCard label="Total" value={summary.total} color="muted" icon={MessageSquare} />
          <StatCard label="Open" value={summary.open_count} color="amber" icon={Clock} />
          <StatCard label="Findings" value={summary.by_severity?.FINDING ?? 0} color="amber" icon={AlertCircle} />
          <StatCard label="Non-Conformities" value={summary.by_severity?.NON_CONFORMITY ?? 0} color="amber" icon={AlertTriangle} emphasize={(summary.by_severity?.NON_CONFORMITY ?? 0) > 0} />
        </div>
      )}

      <div
        ref={workspaceRef}
        className="flex items-stretch min-h-[520px] h-[min(70vh,720px)] rounded-md border border-border bg-sunken/40 overflow-hidden"
      >
        <aside
          className="flex flex-col min-w-0 min-h-0 bg-card flex-shrink-0"
          style={{ width: `${leftPct}%` }}
        >
          <AuditQueuePanel
            filteredRemarks={filteredRemarks}
            loading={loading}
            selectedId={selectedId}
            severityFilter={severityFilter || "all"}
            onSeverityChange={(v) => setSeverityFilter(v === "all" ? "" : (v as SeverityFilter))}
            selLocation={selLocation}
            selYear={selYear}
            selModule={selModule}
            locations={locations}
            reportingYears={reportingYears}
            modules={modules}
            onLocation={setSelLocation}
            onYear={setSelYear}
            onModule={setSelModule}
            onClearFilters={() => { setSelLocation(""); setSelYear(""); setSelModule(""); }}
            hasScopeFilters={hasScopeFilters}
            isAuditor={isAuditor}
            hasAnyFilters={!!(statusFilter || severityFilter || hasScopeFilters)}
            onSelectRemark={(id) => { void loadDetail(id); }}
          />
        </aside>

        <AuditResizeHandle
          leftPct={leftPct}
          onResizeStart={onResizeStart}
          onNudge={(delta) => setLeftPct((p) => Math.min(LEFT_PCT_MAX, Math.max(LEFT_PCT_MIN, p + delta)))}
          label="Resize audit panels"
        />

        <StickyWorkspaceTabs
          workspaceTab={workspaceTab}
          onTabChange={setWorkspaceTab}
          canCreate={canCreate}
          onAction={() => { setEditing(null); setShowCreate(true); }}
        >
          {workspaceTab === "detail" && (
            !selectedId ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[360px] text-muted-foreground px-6">
                <ClipboardCheck size={36} className="mb-3 text-primary/40" />
                <p className="text-[13px] font-semibold field-label">Select a remark</p>
                <p className="text-[12px] mt-1 text-center">Click any item on the left to view validation details</p>
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
              />
            )
          )}

          {workspaceTab === "insights" && (
            <InsightsPanel
              chartData={chartData}
              remarks={filteredRemarks}
              insightsView={insightsView}
              onViewChange={setInsightsView}
              onMaximize={() => setChartMaximized(true)}
              onExport={exportExcel}
            />
          )}

          {(workspaceTab === "responded" || workspaceTab === "all") && (
            <RecordsTable
              remarks={listForTab}
              selectedId={selectedId}
              onSelect={(id) => { void loadDetail(id); }}
              onExport={exportExcel}
            />
          )}
        </StickyWorkspaceTabs>
      </div>

      <ChartMaximizeDialog
        open={chartMaximized}
        onOpenChange={setChartMaximized}
        chartData={chartData}
        onExport={exportExcel}
      />

      {showCreate && (
        <RemarkForm
          remark={editing}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSaved={() => {
            setShowCreate(false);
            setEditing(null);
            fetchList();
            if (selectedId) {
              tenantApi.getRemark(selectedId).then((r) => setSelected(r.data)).catch(() => {});
            }
          }}
        />
      )}
    </PageShell>
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
