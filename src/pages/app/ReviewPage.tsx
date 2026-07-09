import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Breadcrumb } from "@/components/shared/PageShell";
import { PageTabs } from "@/components/shared/PageTabs";
import { useIsSupportSession } from "@/components/shared/WriteOnly";
import { tenantApi } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { getModuleIcon } from "@/lib/constants";
import { useModulesStore } from "@/store/modules";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight,
  FileText, ClipboardCheck, BarChart3, MapPin, Calendar,
  X as XIcon, Check, AlertCircle, Paperclip, Download, Lock,
  Package2, MessageSquare,
} from "lucide-react";
import type { Submission, SubmissionListItem, KPI, Indicator, Scope3Batch } from "@/types";
import { formatDate, getApiError } from "@/lib/utils";
import Scope3ReviewDetail from "@/components/scope3/Scope3ReviewDetail";
import SubmissionRemarksPanel from "@/components/remarks/SubmissionRemarksPanel";

// ── Status config ──────────────────────────────────────────────────────
const STATUS_CONFIG = {
  DRAFT:     { label: "Draft",        color: "text-muted-foreground",   bg: "bg-sunken",   border: "border-border", icon: Clock },
  SUBMITTED: { label: "Pending",      color: "text-warn",   bg: "bg-warn-tint",    border: "border-warn/30", icon: Clock },
  APPROVED:  { label: "Approved",     color: "text-ok", bg: "bg-ok-tint",  border: "border-ok/30", icon: CheckCircle2 },
  REJECTED:  { label: "Rejected",     color: "text-destructive",     bg: "bg-destructive-tint",      border: "border-destructive/30", icon: XCircle },
};

const FILTER_TABS = [
  { key: "", label: "All" },
  { key: "SUBMITTED", label: "Pending Review" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "DRAFT", label: "Draft" },
];

function StatusPill({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  if (!cfg) return <span className="text-[11px] text-muted-foreground">{status}</span>;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${cfg.color} ${cfg.bg} border ${cfg.border}`}>
      <Icon size={11} /> {cfg.label}
    </span>
  );
}

// ── Per-record document viewer (read-only for reviewer) ────────────────
function RecordDocViewer({ recordId }: { recordId: string | null }) {
  const [docs, setDocs] = useState<any[]>([]);

  useEffect(() => {
    if (!recordId) return;
    tenantApi.listRecordDocuments(recordId)
      .then(r => setDocs(r.data || []))
      .catch(() => {});
  }, [recordId]);

  const handleDownload = async (docId: string, fileName: string) => {
    try {
      const res = await tenantApi.downloadDocument(docId);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Download failed"); }
  };

  if (docs.length === 0) return null;
  return (
    <div className="bg-sunken/60 border-t border-[hsl(var(--border-hairline))] px-6 py-2 space-y-1">
      {docs.map((doc: any) => (
        <div key={doc.document_id} className="flex items-center gap-2">
          <FileText size={11} className="text-muted-foreground" />
          <span className="text-[12px] text-foreground flex-1 truncate">{doc.file_name}</span>
          {doc.file_size_bytes && <span className="text-[10px] text-muted-foreground">{(doc.file_size_bytes / 1024).toFixed(1)}KB</span>}
          <button onClick={() => handleDownload(doc.document_id, doc.file_name)} className="p-1 rounded hover:bg-info-tint text-muted-foreground hover:text-primary transition-colors">
            <Download size={11} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────
export default function ReviewPage() {
  const { id: routeId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const modules = useModulesStore((s) => s.modules);
  const isSupport = useIsSupportSession();
  const canReview = (user?.role === "COMPANY_ADMIN" || user?.role === "REVIEWER") && !isSupport;

  // List state
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("SUBMITTED");
  const [filterCounts, setFilterCounts] = useState<Record<string, number>>({});

  // Detail panel
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Submission | null>(null);
  const [detailDocs, setDetailDocs] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeDetailModule, setActiveDetailModule] = useState<number | null>(null);

  // KPI structure
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [expandedIndicators, setExpandedIndicators] = useState<Set<number>>(new Set());
  const [docPanelOpen, setDocPanelOpen] = useState<Set<string>>(new Set());
  const [recordDocCounts, setRecordDocCounts] = useState<Record<string, number>>({});

  // Scope 3 batches
  const [scope3Batches, setScope3Batches] = useState<Scope3Batch[]>([]);
  const [selectedScope3, setSelectedScope3] = useState<Scope3Batch | null>(null);

  // Review action
  const [reviewNotes, setReviewNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);

  // Remarks panel
  const [showRemarksPanel, setShowRemarksPanel] = useState(false);
  const [remarksCount, setRemarksCount] = useState(0);

  // Load KPI structure for grouping
  useEffect(() => {
    Promise.allSettled([
      tenantApi.listKPIs({ size: 500 }),
      tenantApi.listIndicators({ size: 500 }),
    ]).then(([kpiR, indR]) => {
      if (kpiR.status === "fulfilled") {
        const d = kpiR.value.data;
        setKpis(Array.isArray(d) ? d : d?.items || []);
      }
      if (indR.status === "fulfilled") {
        const d = indR.value.data;
        setIndicators(Array.isArray(d) ? d : d?.items || []);
      }
    });
  }, []);

  const fetchFilterCounts = useCallback(() => {
    Promise.allSettled([
      tenantApi.listSubmissions({ size: 1, status: "SUBMITTED" }),
      tenantApi.listSubmissions({ size: 1, status: "APPROVED" }),
      tenantApi.listSubmissions({ size: 1, status: "REJECTED" }),
      tenantApi.listScope3Batches({ size: 1, status: "SUBMITTED" }),
      tenantApi.listScope3Batches({ size: 1, status: "APPROVED" }),
      tenantApi.listScope3Batches({ size: 1, status: "REJECTED" }),
    ]).then(([s, a, r, s3s, s3a, s3r]) => {
      const s3Sub = s3s.status === "fulfilled" ? s3s.value.data.total ?? 0 : 0;
      const s3App = s3a.status === "fulfilled" ? s3a.value.data.total ?? 0 : 0;
      const s3Rej = s3r.status === "fulfilled" ? s3r.value.data.total ?? 0 : 0;
      setFilterCounts({
        SUBMITTED: (s.status === "fulfilled" ? s.value.data.total ?? 0 : 0) + s3Sub,
        APPROVED:  (a.status === "fulfilled" ? a.value.data.total ?? 0 : 0) + s3App,
        REJECTED:  (r.status === "fulfilled" ? r.value.data.total ?? 0 : 0) + s3Rej,
      });
    });
  }, []);

  // Fetch filter counts on mount
  useEffect(() => { fetchFilterCounts(); }, [fetchFilterCounts]);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { size: 100 };
      if (activeFilter) params.status = activeFilter;
      const [subRes, s3Res] = await Promise.allSettled([
        tenantApi.listSubmissions(params),
        tenantApi.listScope3Batches(params),
      ]);
      if (subRes.status === "fulfilled") {
        const items = subRes.value.data.items || subRes.value.data || [];
        setSubmissions(items);
        setTotal(subRes.value.data.total ?? items.length);
      }
      if (s3Res.status === "fulfilled") {
        setScope3Batches(s3Res.value.data.items || []);
      }
    } catch {
      toast.error("Failed to load submissions");
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  // Deep link: /app/review/:id
  useEffect(() => {
    if (routeId && routeId !== selectedId) {
      loadDetail(routeId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  const selectSubmission = (id: string) => {
    navigate(`/app/review/${id}`, { replace: true });
    loadDetail(id);
  };

  const clearSelection = () => {
    navigate("/app/review", { replace: true });
    setSelectedId(null);
    setDetail(null);
    setSelectedScope3(null);
  };

  const loadScope3Detail = (batch: Scope3Batch) => {
    if (selectedScope3?.batch_id === batch.batch_id) {
      setSelectedScope3(null);
      return;
    }
    setSelectedId(null);
    setDetail(null);
    setSelectedScope3(batch);
  };

  const loadDetail = async (id: string) => {
    if (selectedId === id) {
      clearSelection();
      return;
    }
    setSelectedScope3(null); // clear Scope 3 selection
    setSelectedId(id);
    setDetailLoading(true);
    setDetail(null);
    setDetailDocs([]);
    setRecordDocCounts({});
    setReviewNotes("");
    setShowRejectInput(false);
    setDocPanelOpen(new Set());
    setActiveDetailModule(null);
    setRemarksCount(0);
    setShowRemarksPanel(user?.role === "AUDITOR");
    tenantApi.listRemarks({ submission_id: id })
      .then((r) => setRemarksCount((r.data || []).length))
      .catch(() => {});
    try {
      const [subRes, docRes] = await Promise.allSettled([
        tenantApi.getSubmission(id),
        tenantApi.listDocuments(id),
      ]);
      if (subRes.status === "fulfilled") {
        const sub = subRes.value.data;
        setDetail(sub);
        // Expand all indicators
        const allIds = new Set(indicators.map((i: Indicator) => i.indicator_id));
        setExpandedIndicators(allIds);
        // Pre-fetch document counts for each KPI record in parallel
        const recordIds: string[] = (sub.kpi_values || [])
          .map((v: any) => v.record_id)
          .filter(Boolean);
        if (recordIds.length > 0) {
          Promise.allSettled(recordIds.map(rid => tenantApi.listRecordDocuments(rid)))
            .then(results => {
              const counts: Record<string, number> = {};
              recordIds.forEach((rid, i) => {
                const r = results[i];
                if (r.status === "fulfilled") counts[rid] = (r.value.data || []).length;
              });
              setRecordDocCounts(counts);
            });
        }
      }
      if (docRes.status === "fulfilled") setDetailDocs(docRes.value.data || []);
    } catch {
      toast.error("Failed to load submission details");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!detail) return;
    setActionLoading(true);
    try {
      const res = await tenantApi.approveSubmission(detail.submission_id, reviewNotes || undefined);
      toast.success("Submission approved");
      fetchSubmissions();
      fetchFilterCounts();
      setDetail(res.data);
      setReviewNotes("");
    } catch (err: any) {
      toast.error(getApiError(err, "Approval failed"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!detail) return;
    if (!reviewNotes.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    setActionLoading(true);
    try {
      const res = await tenantApi.rejectSubmission(detail.submission_id, reviewNotes);
      toast.success("Submission rejected");
      fetchSubmissions();
      fetchFilterCounts();
      setDetail(res.data);
      setReviewNotes("");
      setShowRejectInput(false);
    } catch (err: any) {
      toast.error(getApiError(err, "Rejection failed"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadDoc = async (docId: string, fileName: string) => {
    try {
      const res = await tenantApi.downloadDocument(docId);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Download failed"); }
  };

  const toggleIndicator = (id: number) => {
    setExpandedIndicators(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const toggleDocPanel = (key: string) => {
    setDocPanelOpen(prev => {
      const s = new Set(prev);
      s.has(key) ? s.delete(key) : s.add(key);
      return s;
    });
  };

  // Build lookup maps from detail kpi_values
  const kpiValueMap = detail
    ? Object.fromEntries(detail.kpi_values.filter(v => v.kpi_id).map(v => [v.kpi_id!, v]))
    : {};
  const indValueMap = detail
    ? Object.fromEntries(detail.kpi_values.filter(v => v.indicator_id && !v.kpi_id).map(v => [v.indicator_id!, v]))
    : {};

  const detailStatusCfg = detail ? STATUS_CONFIG[detail.status as keyof typeof STATUS_CONFIG] : null;
  const selectedSubmission = submissions.find(s => s.submission_id === selectedId);

  return (
    <div className="flex h-full bg-sunken overflow-hidden">

      {/* ── LEFT PANEL: Submissions list ── */}
      <div className={`flex flex-col bg-card border-r border-border transition-all duration-200 ${selectedId || selectedScope3 ? "w-[400px] flex-shrink-0" : "flex-1"}`}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div>
              <Breadcrumb items={[{ label: "Company Portal", href: "/app" }, { label: "Review & Approvals" }]} className="mb-1" />
              <h1 className="text-xl font-extrabold text-foreground tracking-tight">Review & Approvals</h1>
              <p className="text-label text-muted-foreground mt-0.5">{total + scope3Batches.length} submission{(total + scope3Batches.length) !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <PageTabs
            tabs={FILTER_TABS.map((tab) => ({
              key: tab.key,
              label: tab.label,
              count: tab.key ? filterCounts[tab.key as keyof typeof filterCounts] : undefined,
            }))}
            value={activeFilter}
            onChange={(key) => { setActiveFilter(key); clearSelection(); }}
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-[13px] text-muted-foreground animate-pulse">Loading…</div>
          ) : submissions.length === 0 && scope3Batches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ClipboardCheck size={32} className="mb-3 text-muted-foreground/40" />
              <p className="text-[13px] font-semibold">No submissions found</p>
              <p className="text-[12px] mt-1">
                {activeFilter ? `No ${activeFilter.toLowerCase()} submissions` : "No submissions yet"}
              </p>
            </div>
          ) : submissions.map((sub) => {
            const cfg = STATUS_CONFIG[sub.status as keyof typeof STATUS_CONFIG];
            const isSelected = selectedId === sub.submission_id;
            const completeness = sub.kpi_count > 0
              ? Math.round((sub.filled_count / sub.kpi_count) * 100)
              : 0;
            const relativeDate = sub.submitted_at
              ? (() => {
                  const diff = Math.floor((Date.now() - new Date(sub.submitted_at).getTime()) / 86400000);
                  return diff === 0 ? "today" : diff === 1 ? "1d ago" : `${diff}d ago`;
                })()
              : null;
            return (
              <button
                key={sub.submission_id}
                onClick={() => selectSubmission(sub.submission_id)}
                className={`w-full text-left px-5 py-3 border-b border-[hsl(var(--border-hairline))] hover:bg-sunken transition-colors
                  ${isSelected ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin size={13} className="text-muted-foreground flex-shrink-0" />
                    <span className="text-[13px] font-bold text-foreground truncate">{sub.location_name}</span>
                  </div>
                  <StatusPill status={sub.status} />
                </div>
                <div className="flex items-center gap-3 text-[12px] text-muted-foreground mb-2">
                  <span className="flex items-center gap-1">
                    <Calendar size={11} className="text-muted-foreground" />
                    {sub.month_name} · {sub.year_label}
                  </span>
                  <span className="text-muted-foreground/40">|</span>
                  <span><span className="font-semibold text-foreground">{sub.filled_count}</span>/{sub.kpi_count} KPIs</span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 bg-sunken rounded-full overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all ${sub.status === "APPROVED" ? "bg-ok" : sub.status === "REJECTED" ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: `${completeness}%` }}
                  />
                </div>
                {sub.submitted_by_name && (
                  <p className="text-[11px] text-muted-foreground">
                    Submitted by <span className="font-medium text-muted-foreground">{sub.submitted_by_name}</span>
                    {relativeDate && ` · ${relativeDate}`}
                  </p>
                )}
                {sub.reviewer_notes && sub.status === "REJECTED" && (
                  <p className="text-[11px] text-destructive mt-1 truncate">Reason: {sub.reviewer_notes}</p>
                )}
              </button>
            );
          })}

          {/* ── Scope 3 Batches ── */}
          {scope3Batches.length > 0 && (
            <>
              <div className="px-5 py-2 bg-sunken border-b border-[hsl(var(--border-hairline))] flex items-center gap-2">
                <Package2 size={12} className="text-violet-500" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Scope 3 Batches</span>
              </div>
              {scope3Batches.map((b) => {
                const isSelected = selectedScope3?.batch_id === b.batch_id;
                const monthLabel = b.reporting_month
                  ? ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][b.reporting_month]
                  : "Annual";
                return (
                  <button
                    key={b.batch_id}
                    onClick={() => loadScope3Detail(b)}
                    className={`w-full text-left px-5 py-3 border-b border-[hsl(var(--border-hairline))] hover:bg-sunken transition-colors
                      ${isSelected ? "bg-accent/60 border-l-2 border-l-violet-500" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <Package2 size={13} className="text-violet-500 flex-shrink-0" />
                        <span className="text-[13px] font-bold text-foreground truncate">{b.ghg_category_name}</span>
                      </div>
                      <StatusPill status={b.status} />
                    </div>
                    <div className="flex items-center gap-3 text-[12px] text-muted-foreground mb-1.5">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} className="text-muted-foreground" />
                        {monthLabel} {b.reporting_year}
                      </span>
                      <span className="text-muted-foreground/40">|</span>
                      <span>{b.total_rows} entries</span>
                      <span className="text-muted-foreground/40">|</span>
                      <span className="font-semibold text-foreground">{(b.total_emissions ?? 0).toFixed(2)} tCO2e</span>
                    </div>
                    {b.uploader_name && (
                      <p className="text-[11px] text-muted-foreground">
                        By <span className="font-medium text-muted-foreground">{b.uploader_name}</span>
                      </p>
                    )}
                    {b.rejection_reason && b.status === "REJECTED" && (
                      <p className="text-[11px] text-destructive mt-1 truncate">Reason: {b.rejection_reason}</p>
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL: Scope 3 detail ── */}
      {selectedScope3 && (
        <Scope3ReviewDetail
          batch={selectedScope3}
          canReview={canReview}
          onReviewed={() => {
            fetchSubmissions();
            fetchFilterCounts();
            setSelectedScope3(null);
          }}
          onClose={() => setSelectedScope3(null)}
        />
      )}

      {/* ── RIGHT PANEL: Submission detail + remarks side panel ── */}
      {selectedId && !selectedScope3 && (
        <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {detailLoading ? (
            <div className="flex-1 flex items-center justify-center text-[13px] text-muted-foreground animate-pulse">
              Loading submission…
            </div>
          ) : detail ? (
            <>
              {/* Detail header */}
              <div className="bg-card border-b border-border px-6 py-4 flex-shrink-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-[16px] font-bold text-foreground">
                        {selectedSubmission?.location_name || "Submission"}
                      </h2>
                      {detailStatusCfg && <StatusPill status={detail.status} />}
                    </div>
                    <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} className="text-muted-foreground" />
                        {selectedSubmission?.month_name} · {selectedSubmission?.year_label}
                      </span>
                      <span className="text-muted-foreground/40">|</span>
                      <span>{detail.kpi_values.length} value{detail.kpi_values.length !== 1 ? "s" : ""} filled</span>
                    </div>
                    {detail.status === "REJECTED" && detail.reviewer_notes && (
                      <div className="mt-2 flex items-start gap-2 bg-destructive-tint border border-destructive/30 rounded-lg px-3 py-2">
                        <AlertCircle size={13} className="text-destructive flex-shrink-0 mt-0.5" />
                        <span className="text-[12px] text-destructive">{detail.reviewer_notes}</span>
                      </div>
                    )}
                    {detail.status === "APPROVED" && (
                      <div className="mt-2 flex items-center gap-2 bg-ok-tint border border-ok/30 rounded-lg px-3 py-2">
                        <CheckCircle2 size={13} className="text-emerald-500" />
                        <span className="text-[12px] text-ok font-semibold">Approved{detail.reviewed_at ? ` on ${formatDate(detail.reviewed_at)}` : ""}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setShowRemarksPanel((v) => !v)}
                      className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${showRemarksPanel ? "bg-primary text-white" : "border border-border text-muted-foreground hover:bg-sunken"}`}
                      title="Auditor Remarks"
                    >
                      <MessageSquare size={13} />
                      Remarks
                      {remarksCount > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${showRemarksPanel ? "bg-primary-foreground/20 text-white" : "bg-warn-tint text-warn"}`}>
                          {remarksCount}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => { clearSelection(); setShowRemarksPanel(false); }}
                      className="p-1.5 rounded-lg hover:bg-sunken text-muted-foreground"
                    >
                      <XIcon size={16} />
                    </button>
                  </div>
                </div>

                {/* Module tabs for detail view */}
                <div className="flex gap-1 mt-3 overflow-x-auto">
                  <button
                    onClick={() => setActiveDetailModule(null)}
                    className={`px-3 py-1 rounded-md text-[12px] font-semibold whitespace-nowrap transition-all ${activeDetailModule === null ? "bg-primary text-white" : "text-muted-foreground hover:bg-sunken"}`}
                  >
                    All
                  </button>
                  {modules.map(m => {
                    const Icon = getModuleIcon(m.icon_name);
                    const modKpis = kpis.filter(k => k.module_id === m.module_id);
                    const filled = modKpis.filter(k => kpiValueMap[k.kpi_id]).length;
                    if (filled === 0) return null;
                    return (
                      <button
                        key={m.module_id}
                        onClick={() => setActiveDetailModule(m.module_id === activeDetailModule ? null : m.module_id)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[12px] font-semibold whitespace-nowrap transition-all ${activeDetailModule === m.module_id ? "text-white" : "text-muted-foreground hover:bg-sunken"}`}
                        style={activeDetailModule === m.module_id ? { background: m.color } : {}}
                      >
                        <Icon size={12} /> {m.module_name}
                        <span className={`text-[10px] ${activeDetailModule === m.module_id ? "opacity-75" : "text-muted-foreground"}`}>{filled}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scrollable detail content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 pb-32">
                {(() => {
                  const visibleModules = modules.filter(m => activeDetailModule === null || m.module_id === activeDetailModule);
                  const hasAnyData = visibleModules.some(mod => {
                    const modKpis = kpis.filter(k => k.module_id === mod.module_id);
                    const modIndicators = indicators.filter(i => i.module_id === mod.module_id);
                    return modKpis.some(k => kpiValueMap[k.kpi_id]) ||
                      modIndicators.some(i => kpis.filter(k => k.indicator_id === i.indicator_id).length === 0 && indValueMap[i.indicator_id]);
                  });
                  if (!hasAnyData && detail.kpi_values.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <BarChart3 size={32} className="mb-3 text-muted-foreground/40" />
                        <p className="text-[13px] font-semibold text-muted-foreground">No data entered</p>
                        <p className="text-[12px] mt-1">This submission has no KPI values recorded</p>
                      </div>
                    );
                  }
                  return null;
                })()}
                {modules.filter(m => activeDetailModule === null || m.module_id === activeDetailModule).map(mod => {
                  const Icon = getModuleIcon(mod.icon_name);
                  const modKpis = kpis.filter((k: KPI) => k.module_id === mod.module_id);
                  const modIndicators = indicators.filter((i: Indicator) => i.module_id === mod.module_id);

                  // Collect all relevant values for this module
                  const filledModKpis = modKpis.filter((k: KPI) => kpiValueMap[k.kpi_id]);
                  const directInds = modIndicators.filter(i =>
                    kpis.filter(k => k.indicator_id === i.indicator_id).length === 0 && indValueMap[i.indicator_id]
                  );

                  if (filledModKpis.length === 0 && directInds.length === 0) return null;

                  return (
                    <div key={mod.module_id} className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                      {/* Module header */}
                      <div className="flex items-center gap-3 px-5 py-3 border-b border-[hsl(var(--border-hairline))]" style={{ background: mod.bg_color }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: mod.color + "22" }}>
                          <Icon size={14} style={{ color: mod.color }} />
                        </div>
                        <span className="text-[13px] font-bold text-foreground">{mod.module_name}</span>
                        <span className="text-[11px] text-muted-foreground">{filledModKpis.length + directInds.length} values</span>
                      </div>

                      {/* Column headers */}
                      <div className="grid grid-cols-[1fr_65px_100px_110px_110px_30px] gap-2 px-5 py-2 bg-sunken/60 border-b border-[hsl(var(--border-hairline))] text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.07em]">
                        <span>KPI / Indicator</span>
                        <span>Unit</span>
                        <span className="text-right">Quantity</span>
                        <span className="text-right">MJ Value</span>
                        <span className="text-right">Emission</span>
                        <span></span>
                      </div>

                      {/* Direct-entry indicators */}
                      {directInds.map((ind: Indicator) => {
                        const v = indValueMap[ind.indicator_id];
                        const key = `ind_${ind.indicator_id}`;
                        const docOpen = docPanelOpen.has(key);
                        return (
                          <div key={ind.indicator_id} className="border-b border-[hsl(var(--border-hairline))] last:border-b-0">
                            <div className="grid grid-cols-[1fr_65px_100px_110px_110px_30px] gap-2 items-center px-5 py-2.5 hover:bg-sunken/30">
                              <div className="flex items-center gap-2 min-w-0">
                                <BarChart3 size={12} className="text-primary/50 flex-shrink-0" />
                                <span className="text-[12px] text-foreground truncate">{ind.indicator_name}</span>
                                <span className="text-[10px] bg-info-tint text-info border border-info/30 px-1 rounded font-semibold flex-shrink-0">Direct</span>
                              </div>
                              <span className="text-[11px] text-muted-foreground font-mono">—</span>
                              <span className="text-right text-[13px] font-mono font-semibold text-foreground">
                                {Number(v.quantity).toLocaleString()}
                              </span>
                              <span className="text-right text-[12px] font-mono text-muted-foreground">—</span>
                              <span className="text-right text-[12px] font-mono text-muted-foreground">—</span>
                              <button
                                onClick={() => toggleDocPanel(key)}
                                className={`relative flex items-center justify-center w-6 h-6 rounded transition-all ${docOpen ? "text-primary" : recordDocCounts[v.record_id] > 0 ? "text-amber-400 hover:text-amber-500" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                              >
                                <Paperclip size={11} />
                                {recordDocCounts[v.record_id] > 0 && !docOpen && (
                                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full text-[8px] text-white flex items-center justify-center font-bold leading-none">
                                    {recordDocCounts[v.record_id]}
                                  </span>
                                )}
                              </button>
                            </div>
                            {docOpen && <RecordDocViewer recordId={v.record_id} />}
                          </div>
                        );
                      })}

                      {/* Indicators with KPIs */}
                      {modIndicators.map((ind: Indicator) => {
                        const indKpis = modKpis.filter((k: KPI) => k.indicator_id === ind.indicator_id && kpiValueMap[k.kpi_id]);
                        if (indKpis.length === 0) return null;
                        const isExp = expandedIndicators.has(ind.indicator_id);
                        return (
                          <div key={ind.indicator_id} className="border-b border-[hsl(var(--border-hairline))] last:border-b-0">
                            <button
                              onClick={() => toggleIndicator(ind.indicator_id)}
                              className="w-full flex items-center gap-2 px-5 py-2 bg-sunken/40 hover:bg-sunken transition-colors text-left"
                            >
                              {isExp ? <ChevronDown size={13} className="text-muted-foreground" /> : <ChevronRight size={13} className="text-muted-foreground" />}
                              <span className="text-[12px] font-semibold text-foreground">{ind.indicator_name}</span>
                              <span className="text-[10px] text-muted-foreground ml-auto">{indKpis.length}</span>
                            </button>
                            {isExp && indKpis.map((kpi: KPI) => {
                              const v = kpiValueMap[kpi.kpi_id];
                              const key = `kpi_${kpi.kpi_id}`;
                              const docOpen = docPanelOpen.has(key);
                              const isAutoEmission = kpi.is_emission_source;
                              return (
                                <div key={kpi.kpi_id} className="border-t border-[hsl(var(--border-hairline))]/70">
                                  <div className="grid grid-cols-[1fr_65px_100px_110px_110px_30px] gap-2 items-center px-5 py-2.5 hover:bg-sunken/30">
                                    <div className="flex items-center gap-2 min-w-0">
                                      {isAutoEmission ? <Lock size={11} className="text-muted-foreground/40 flex-shrink-0" /> : <BarChart3 size={12} className="text-muted-foreground/40 flex-shrink-0" />}
                                      <span className="text-[12px] text-foreground truncate">{kpi.kpi_name}</span>
                                    </div>
                                    <span className="text-[11px] text-muted-foreground font-mono">{kpi.unit}</span>
                                    <span className="text-right text-[13px] font-mono font-semibold text-foreground">
                                      {Number(v.quantity).toLocaleString()}
                                    </span>
                                    <div className="relative group text-right">
                                      <span className={`text-[12px] font-mono text-muted-foreground ${v.mj_value != null ? "cursor-help" : ""}`}>
                                        {v.mj_value != null ? Number(v.mj_value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
                                      </span>
                                      {v.mj_value != null && Number(v.quantity) > 0 && (
                                        <div className="pointer-events-none absolute bottom-full right-0 mb-1.5 hidden group-hover:block z-20 bg-primary text-white text-[11px] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                                          <span className="text-white/60">MJ factor · </span>
                                          {(Number(v.mj_value) / Number(v.quantity)).toFixed(4)} MJ / {kpi.unit}
                                        </div>
                                      )}
                                    </div>
                                    <div className="relative group text-right">
                                      <span className={`text-[12px] font-mono text-muted-foreground ${v.emission_value != null ? "cursor-help" : ""}`}>
                                        {v.emission_value != null ? Number(v.emission_value).toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—"}
                                      </span>
                                      {v.emission_value != null && Number(v.quantity) > 0 && (
                                        <div className="pointer-events-none absolute bottom-full right-0 mb-1.5 hidden group-hover:block z-20 bg-primary text-white text-[11px] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                                          <span className="text-white/60">Emission factor · </span>
                                          {(Number(v.emission_value) / Number(v.quantity)).toFixed(4)} tCO₂e / {kpi.unit}
                                        </div>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => toggleDocPanel(key)}
                                      className={`relative flex items-center justify-center w-6 h-6 rounded transition-all ${docOpen ? "text-primary" : recordDocCounts[v.record_id] > 0 ? "text-amber-400 hover:text-amber-500" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                                    >
                                      <Paperclip size={11} />
                                      {recordDocCounts[v.record_id] > 0 && !docOpen && (
                                        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full text-[8px] text-white flex items-center justify-center font-bold leading-none">
                                          {recordDocCounts[v.record_id]}
                                        </span>
                                      )}
                                    </button>
                                  </div>
                                  {docOpen && <RecordDocViewer recordId={v.record_id} />}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}

                      {/* KPIs without indicators */}
                      {modKpis.filter((k: KPI) => !k.indicator_id && kpiValueMap[k.kpi_id]).map((kpi: KPI) => {
                        const v = kpiValueMap[kpi.kpi_id];
                        const key = `kpi_${kpi.kpi_id}`;
                        const docOpen = docPanelOpen.has(key);
                        return (
                          <div key={kpi.kpi_id} className="border-t border-[hsl(var(--border-hairline))]/70">
                            <div className="grid grid-cols-[1fr_65px_100px_110px_110px_30px] gap-2 items-center px-5 py-2.5 hover:bg-sunken/30">
                              <div className="flex items-center gap-2 min-w-0">
                                <BarChart3 size={12} className="text-muted-foreground/40 flex-shrink-0" />
                                <span className="text-[12px] text-foreground truncate">{kpi.kpi_name}</span>
                              </div>
                              <span className="text-[11px] text-muted-foreground font-mono">{kpi.unit}</span>
                              <span className="text-right text-[13px] font-mono font-semibold text-foreground">
                                {Number(v.quantity).toLocaleString()}
                              </span>
                              <div className="relative group text-right">
                                <span className={`text-[12px] font-mono text-muted-foreground ${v.mj_value != null ? "cursor-help" : ""}`}>
                                  {v.mj_value != null ? Number(v.mj_value).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
                                </span>
                                {v.mj_value != null && Number(v.quantity) > 0 && (
                                  <div className="pointer-events-none absolute bottom-full right-0 mb-1.5 hidden group-hover:block z-20 bg-primary text-white text-[11px] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                                    <span className="text-white/60">MJ factor · </span>
                                    {(Number(v.mj_value) / Number(v.quantity)).toFixed(4)} MJ / {kpi.unit}
                                  </div>
                                )}
                              </div>
                              <div className="relative group text-right">
                                <span className={`text-[12px] font-mono text-muted-foreground ${v.emission_value != null ? "cursor-help" : ""}`}>
                                  {v.emission_value != null ? Number(v.emission_value).toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—"}
                                </span>
                                {v.emission_value != null && Number(v.quantity) > 0 && (
                                  <div className="pointer-events-none absolute bottom-full right-0 mb-1.5 hidden group-hover:block z-20 bg-primary text-white text-[11px] rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                                    <span className="text-white/60">Emission factor · </span>
                                    {(Number(v.emission_value) / Number(v.quantity)).toFixed(4)} tCO₂e / {kpi.unit}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => toggleDocPanel(key)}
                                className={`relative flex items-center justify-center w-6 h-6 rounded transition-all ${docOpen ? "text-primary" : recordDocCounts[v.record_id] > 0 ? "text-amber-400 hover:text-amber-500" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                              >
                                <Paperclip size={11} />
                                {recordDocCounts[v.record_id] > 0 && !docOpen && (
                                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full text-[8px] text-white flex items-center justify-center font-bold leading-none">
                                    {recordDocCounts[v.record_id]}
                                  </span>
                                )}
                              </button>
                            </div>
                            {docOpen && <RecordDocViewer recordId={v.record_id} />}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Submission-level documents */}
                {detailDocs.length > 0 && (
                  <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
                    <div className="flex items-center gap-2 px-5 py-3 border-b border-[hsl(var(--border-hairline))] bg-sunken/60">
                      <Paperclip size={14} className="text-muted-foreground" />
                      <span className="text-[13px] font-bold text-foreground">Supporting Documents</span>
                      <span className="text-[11px] text-muted-foreground">{detailDocs.length} file{detailDocs.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="divide-y divide-border/60">
                      {detailDocs.map((doc: any) => (
                        <div key={doc.document_id} className="flex items-center gap-3 px-5 py-3">
                          <FileText size={13} className="text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-foreground truncate">{doc.file_name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {doc.file_size_bytes ? `${(doc.file_size_bytes / 1024).toFixed(1)} KB · ` : ""}
                              {formatDate(doc.uploaded_at)}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDownloadDoc(doc.document_id, doc.file_name)}
                            className="p-1.5 rounded hover:bg-info-tint text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Download size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Already reviewed info */}
                {(detail.status === "APPROVED" || detail.status === "REJECTED") && (
                  <div className={`rounded-xl border p-4 text-[12px] ${detail.status === "APPROVED" ? "bg-ok-tint border-ok/30" : "bg-destructive-tint border-destructive/30"}`}>
                    <p className={`font-semibold mb-1 ${detail.status === "APPROVED" ? "text-ok" : "text-destructive"}`}>
                      {detail.status === "APPROVED" ? "Approved" : "Rejected"}
                      {detail.reviewed_at && ` on ${formatDate(detail.reviewed_at)}`}
                    </p>
                    {detail.reviewer_notes && (
                      <p className={detail.status === "APPROVED" ? "text-ok" : "text-destructive"}>
                        {detail.reviewer_notes}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* ── Review action panel (sticky bottom) ── */}
              {canReview && detail.status === "SUBMITTED" && (
                <div className="bg-card border-t border-border px-6 py-4 flex-shrink-0 shadow-lg">
                  <p className="text-[12px] font-bold text-foreground mb-2">
                    Review Decision
                    {showRejectInput && <span className="text-destructive ml-1">— Rejection notes required</span>}
                  </p>
                  <textarea
                    value={reviewNotes}
                    onChange={e => setReviewNotes(e.target.value)}
                    rows={2}
                    placeholder={showRejectInput ? "Provide a reason for rejection (required)…" : "Optional notes for the submitter…"}
                    className={`w-full py-2 px-3 rounded-lg border text-[13px] outline-none resize-none transition-colors mb-3
                      ${showRejectInput ? "border-destructive/30 focus:border-red-400" : "border-border focus:border-primary"}`}
                  />
                  <div className="flex items-center gap-2">
                    {!showRejectInput ? (
                      <>
                        <button
                          onClick={handleApprove}
                          disabled={actionLoading}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-ok text-white text-[13px] font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-50"
                        >
                          <Check size={15} /> {actionLoading ? "Processing…" : "Approve Submission"}
                        </button>
                        <button
                          onClick={() => setShowRejectInput(true)}
                          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg border border-destructive/30 text-destructive text-[13px] font-semibold hover:bg-destructive-tint transition-colors"
                        >
                          <XIcon size={15} /> Reject
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={handleReject}
                          disabled={actionLoading || !reviewNotes.trim()}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-destructive text-white text-[13px] font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          <XCircle size={15} /> {actionLoading ? "Processing…" : "Confirm Rejection"}
                        </button>
                        <button
                          onClick={() => { setShowRejectInput(false); setReviewNotes(""); }}
                          className="px-4 py-2.5 rounded-lg border border-border text-[13px] font-semibold text-muted-foreground hover:bg-sunken transition-colors"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <p className="text-[13px]">Failed to load submission</p>
            </div>
          )}
        </div>
        {showRemarksPanel && detail && (
          <SubmissionRemarksPanel
            submissionId={detail.submission_id}
            submissionStatus={detail.status}
            onClose={() => setShowRemarksPanel(false)}
          />
        )}
        </div>
      )}

      {/* Empty right panel prompt when nothing selected */}
      {!selectedId && !selectedScope3 && (
        <div className="hidden lg:flex flex-1 items-center justify-center bg-sunken">
          <div className="text-center text-muted-foreground">
            <ClipboardCheck size={40} className="mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-[14px] font-semibold text-muted-foreground">Select a submission to review</p>
            <p className="text-[12px] mt-1">Click any item on the left to view details</p>
          </div>
        </div>
      )}
    </div>
  );
}
