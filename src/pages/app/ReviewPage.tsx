import { useEffect, useState, useCallback, useRef, useMemo, type MouseEvent as ReactMouseEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  Package2, MessageSquare, Filter,
} from "lucide-react";
import type { Submission, SubmissionListItem, KPI, Indicator, Scope3Batch } from "@/types";
import { formatDate, getApiError, cn } from "@/lib/utils";
import Scope3ReviewDetail from "@/components/scope3/Scope3ReviewDetail";
import SubmissionRemarksPanel from "@/components/remarks/SubmissionRemarksPanel";
import { AuditResizeHandle } from "@/components/remarks/AuditorRemarksWorkspace";
import { Input } from "@/components/ui/input";

// ── Layout ─────────────────────────────────────────────────────────────
const LEFT_PCT_DEFAULT = 40;
const LEFT_PCT_MIN = 22;
const LEFT_PCT_MAX = 55;

// Shared data-grid column template: text | unit (center) | qty | mj | emission | docs
const GRID_COLS = "grid-cols-[minmax(0,1fr)_72px_104px_110px_110px_32px]";

// ── Status config ──────────────────────────────────────────────────────
const STATUS_CONFIG = {
  DRAFT:     { label: "Draft",        color: "text-muted-foreground",   bg: "bg-sunken",   border: "border-border", icon: Clock },
  SUBMITTED: { label: "Pending",      color: "text-warn",   bg: "bg-warn-tint",    border: "border-warn/30", icon: Clock },
  APPROVED:  { label: "Approved",     color: "text-ok", bg: "bg-ok-tint",  border: "border-ok/30", icon: CheckCircle2 },
  REJECTED:  { label: "Rejected",     color: "text-destructive",     bg: "bg-destructive-tint",      border: "border-destructive/30", icon: XCircle },
};

const FILTER_TABS = [
  { key: "", label: "All" },
  { key: "SUBMITTED", label: "Pending" },
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

/** Compact color-coded status for the left directory (saves horizontal space). */
function StatusDot({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
  const dot =
    status === "APPROVED" ? "bg-ok"
    : status === "REJECTED" ? "bg-destructive"
    : status === "SUBMITTED" ? "bg-warn"
    : "bg-muted-foreground/60";
  return (
    <span
      className={cn("inline-block w-2 h-2 rounded-full shrink-0", dot)}
      title={cfg?.label ?? status}
      aria-label={cfg?.label ?? status}
    />
  );
}

const filterSelectCls =
  "h-8 rounded-sm border border-input bg-card px-2 text-[12px] text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function ReviewFiltersPanel({
  dateFrom,
  dateTo,
  periodYearId,
  periodMonthId,
  years,
  months,
  hasFilters,
  onDateFrom,
  onDateTo,
  onYear,
  onMonth,
  onClear,
  onApply,
  compact,
}: {
  dateFrom: string;
  dateTo: string;
  periodYearId: string;
  periodMonthId: string;
  years: { year_id: number; fy_label: string }[];
  months: { month_id: number; month_name: string }[];
  hasFilters: boolean;
  onDateFrom: (v: string) => void;
  onDateTo: (v: string) => void;
  onYear: (v: string) => void;
  onMonth: (v: string) => void;
  onClear: () => void;
  onApply?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("space-y-3", compact && "p-0")}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 min-w-0">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Date from</span>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFrom(e.target.value)}
            className="h-8 text-[12px] px-2"
          />
        </label>

        <label className="flex flex-col gap-1 min-w-0">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Date to</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => onDateTo(e.target.value)}
            className="h-8 text-[12px] px-2"
          />
        </label>

        <label className="flex flex-col gap-1 min-w-0">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Reporting year</span>
          <select
            value={periodYearId}
            onChange={(e) => onYear(e.target.value)}
            className={filterSelectCls}
          >
            <option value="">All years</option>
            {years.map((y) => (
              <option key={y.year_id} value={String(y.year_id)}>{y.fy_label}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 min-w-0">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Period</span>
          <select
            value={periodMonthId}
            onChange={(e) => onMonth(e.target.value)}
            className={filterSelectCls}
          >
            <option value="">All periods</option>
            {months.map((m) => (
              <option key={m.month_id} value={String(m.month_id)}>{m.month_name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-end gap-2 pt-1 border-t border-[hsl(var(--border-hairline))]">
        {hasFilters && (
          <button
            type="button"
            onClick={onClear}
            className="h-8 px-2.5 rounded-sm text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:bg-sunken border border-transparent hover:border-border transition-colors"
          >
            Clear
          </button>
        )}
        {onApply && (
          <button
            type="button"
            onClick={onApply}
            className="h-8 px-3 rounded-sm text-[12px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Apply
          </button>
        )}
      </div>
    </div>
  );
}

function ReviewFiltersDropdown({
  applied,
  years,
  months,
  hasApplied,
  onApply,
  onClear,
}: {
  applied: {
    dateFrom: string;
    dateTo: string;
    periodYearId: string;
    periodMonthId: string;
  };
  years: { year_id: number; fy_label: string }[];
  months: { month_id: number; month_name: string }[];
  hasApplied: boolean;
  onApply: (v: typeof applied) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(applied);

  useEffect(() => {
    if (open) setDraft(applied);
  }, [open, applied]);

  const draftHas = !!(draft.dateFrom || draft.dateTo || draft.periodYearId || draft.periodMonthId);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-[12px] font-semibold transition-colors",
          hasApplied
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-sunken",
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Filter size={13} />
        Filters
        {hasApplied && (
          <span className="w-1.5 h-1.5 rounded-full bg-primary" aria-label="Filters active" />
        )}
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close filters"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Review filters"
            className="absolute right-0 top-full z-50 mt-1.5 w-[min(360px,calc(100vw-2rem))] rounded-md border border-border bg-card shadow-lg p-4"
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-3">Filter submissions</p>
            <ReviewFiltersPanel
              dateFrom={draft.dateFrom}
              dateTo={draft.dateTo}
              periodYearId={draft.periodYearId}
              periodMonthId={draft.periodMonthId}
              years={years}
              months={months}
              hasFilters={draftHas}
              onDateFrom={(v) => setDraft((d) => ({ ...d, dateFrom: v }))}
              onDateTo={(v) => setDraft((d) => ({ ...d, dateTo: v }))}
              onYear={(v) => setDraft((d) => ({ ...d, periodYearId: v }))}
              onMonth={(v) => setDraft((d) => ({ ...d, periodMonthId: v }))}
              onClear={() => {
                onClear();
                setDraft({ dateFrom: "", dateTo: "", periodYearId: "", periodMonthId: "" });
                setOpen(false);
              }}
              onApply={() => {
                onApply(draft);
                setOpen(false);
              }}
              compact
            />
          </div>
        </>
      )}
    </div>
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

  // Detail panel — seed from route so deep links don't flash full-width list first
  const [selectedId, setSelectedId] = useState<string | null>(routeId ?? null);
  const [selectedMeta, setSelectedMeta] = useState<SubmissionListItem | null>(null);
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

  // 40/60 workspace + drag resize
  const [leftPct, setLeftPct] = useState(LEFT_PCT_DEFAULT);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  // Panel filters (date range + reporting period) — filter the directory list
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [periodYearId, setPeriodYearId] = useState("");
  const [periodMonthId, setPeriodMonthId] = useState("");
  const [years, setYears] = useState<{ year_id: number; fy_label: string }[]>([]);
  const [months, setMonths] = useState<{ month_id: number; month_name: string }[]>([]);

  // Load KPI structure for grouping
  useEffect(() => {
    Promise.allSettled([
      tenantApi.listKPIs({ size: 500 }),
      tenantApi.listIndicators({ size: 500 }),
      tenantApi.listReportingYears(),
      tenantApi.listMonths(),
    ]).then(([kpiR, indR, yearR, monR]) => {
      if (kpiR.status === "fulfilled") {
        const d = kpiR.value.data;
        setKpis(Array.isArray(d) ? d : d?.items || []);
      }
      if (indR.status === "fulfilled") {
        const d = indR.value.data;
        setIndicators(Array.isArray(d) ? d : d?.items || []);
      }
      if (yearR.status === "fulfilled") {
        const d = yearR.value.data;
        const arr: any[] = Array.isArray(d) ? d : d?.items || [];
        setYears(
          arr
            .map((y: any) => ({
              year_id: y.year_id,
              fy_label: y.financial_year?.fy_label || y.fy_label || String(y.year_id),
            }))
            .sort((a, b) => a.year_id - b.year_id),
        );
      }
      if (monR.status === "fulfilled") {
        const d = monR.value.data;
        const monthArr = Array.isArray(d) ? d : d?.items || [];
        setMonths(monthArr);
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

  // Deep link: /app/review/:id — load without toggling closed
  useEffect(() => {
    if (!routeId) return;
    if (selectedId === routeId && detail?.submission_id === routeId) return;
    void openDetail(routeId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  const selectSubmission = (sub: SubmissionListItem) => {
    if (selectedId === sub.submission_id) {
      clearSelection();
      return;
    }
    setSelectedMeta(sub);
    navigate(`/app/review/${sub.submission_id}`, { replace: true });
    void openDetail(sub.submission_id);
  };

  const clearSelection = () => {
    navigate("/app/review", { replace: true });
    setSelectedId(null);
    setSelectedMeta(null);
    setDetail(null);
    setSelectedScope3(null);
  };

  const loadScope3Detail = (batch: Scope3Batch) => {
    if (selectedScope3?.batch_id === batch.batch_id) {
      setSelectedScope3(null);
      return;
    }
    setSelectedId(null);
    setSelectedMeta(null);
    setDetail(null);
    setSelectedScope3(batch);
  };

  const openDetail = async (id: string) => {
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

  const onResizeStart = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
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

  const clearPanelFilters = () => {
    setDateFrom("");
    setDateTo("");
    setPeriodYearId("");
    setPeriodMonthId("");
  };

  const applyPanelFilters = (v: {
    dateFrom: string;
    dateTo: string;
    periodYearId: string;
    periodMonthId: string;
  }) => {
    setDateFrom(v.dateFrom);
    setDateTo(v.dateTo);
    setPeriodYearId(v.periodYearId);
    setPeriodMonthId(v.periodMonthId);
  };

  const hasPanelFilters = !!(dateFrom || dateTo || periodYearId || periodMonthId);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      if (periodYearId && String(sub.year_id) !== periodYearId) return false;
      if (periodMonthId && String(sub.month_id) !== periodMonthId) return false;
      if (dateFrom || dateTo) {
        if (!sub.submitted_at) return false;
        const day = sub.submitted_at.slice(0, 10);
        if (dateFrom && day < dateFrom) return false;
        if (dateTo && day > dateTo) return false;
      }
      return true;
    });
  }, [submissions, dateFrom, dateTo, periodYearId, periodMonthId]);

  const filteredScope3Batches = useMemo(() => {
    return scope3Batches.filter((b) => {
      if (periodYearId) {
        const y = years.find((yr) => String(yr.year_id) === periodYearId);
        const fyStart = y?.fy_label?.match(/\d{4}/)?.[0];
        const matchYear = fyStart ? Number(fyStart) : Number(periodYearId);
        if (b.reporting_year !== matchYear) return false;
      }
      if (periodMonthId) {
        if (b.reporting_month == null) return false;
        const m = months.find((mo) => String(mo.month_id) === periodMonthId) as { calendar_month?: number } | undefined;
        const cal = m?.calendar_month ?? Number(periodMonthId);
        if (b.reporting_month !== cal && b.reporting_month !== Number(periodMonthId)) return false;
      }
      if (dateFrom || dateTo) {
        const ts = (b as { submitted_at?: string; updated_at?: string }).submitted_at
          || (b as { updated_at?: string }).updated_at;
        if (!ts) return false;
        const day = String(ts).slice(0, 10);
        if (dateFrom && day < dateFrom) return false;
        if (dateTo && day > dateTo) return false;
      }
      return true;
    });
  }, [scope3Batches, dateFrom, dateTo, periodYearId, periodMonthId, years, months]);

  // Build lookup maps from detail kpi_values
  const kpiValueMap = detail
    ? Object.fromEntries(detail.kpi_values.filter(v => v.kpi_id).map(v => [v.kpi_id!, v]))
    : {};
  const indValueMap = detail
    ? Object.fromEntries(detail.kpi_values.filter(v => v.indicator_id && !v.kpi_id).map(v => [v.indicator_id!, v]))
    : {};

  const detailStatusCfg = detail ? STATUS_CONFIG[detail.status as keyof typeof STATUS_CONFIG] : null;
  const selectedSubmission =
    selectedMeta?.submission_id === selectedId
      ? selectedMeta
      : submissions.find(s => s.submission_id === selectedId) ?? selectedMeta;

  return (
    <div ref={workspaceRef} className="flex h-full min-h-0 w-full bg-sunken overflow-hidden">

      {/* ── LEFT PANEL: Submissions list (40% baseline) ── */}
      <div
        className="flex flex-col bg-card border-r border-border min-h-0 min-w-0 flex-shrink-0"
        style={{ width: `${leftPct}%` }}
      >
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-border flex-shrink-0 min-w-0">
          <div className="min-w-0 mb-2">
            <div className="flex items-center gap-x-2 gap-y-0.5 flex-wrap">
              <h1 className="page-title">Review & Approvals</h1>
              <span className="text-muted-foreground/40 text-label hidden sm:inline" aria-hidden="true">·</span>
              <p className="text-label text-muted-foreground">{total + scope3Batches.length} submission{(total + scope3Batches.length) !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <div className="-mx-4 px-4 min-w-0">
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
          <div className="flex justify-end mt-2">
            <ReviewFiltersDropdown
              applied={{ dateFrom, dateTo, periodYearId, periodMonthId }}
              years={years}
              months={months}
              hasApplied={hasPanelFilters}
              onApply={applyPanelFilters}
              onClear={clearPanelFilters}
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-[13px] text-muted-foreground animate-pulse">Loading…</div>
          ) : filteredSubmissions.length === 0 && filteredScope3Batches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ClipboardCheck size={32} className="mb-3 text-muted-foreground/40" />
              <p className="text-[13px] font-semibold">No submissions found</p>
              <p className="text-[12px] mt-1">
                {hasPanelFilters
                  ? "No submissions match the current filters"
                  : activeFilter
                    ? `No ${activeFilter.toLowerCase()} submissions`
                    : "No submissions yet"}
              </p>
            </div>
          ) : filteredSubmissions.map((sub) => {
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
                onClick={() => selectSubmission(sub)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-[hsl(var(--border-hairline))] border-l-[3px] hover:bg-sunken/70 transition-colors",
                  isSelected
                    ? "border-l-primary bg-primary/[0.07]"
                    : "border-l-transparent",
                )}
              >
                <div className="flex items-center gap-2 min-w-0 mb-1.5">
                  <StatusDot status={sub.status} />
                  <MapPin size={13} className="text-muted-foreground flex-shrink-0" />
                  <span className="text-[13px] font-bold text-foreground truncate">{sub.location_name}</span>
                </div>
                <div className="flex items-center gap-3 text-[12px] text-muted-foreground mb-2 pl-[18px]">
                  <span className="flex items-center gap-1">
                    <Calendar size={11} className="text-muted-foreground" />
                    {sub.month_name} · {sub.year_label}
                  </span>
                  <span className="text-muted-foreground/40">|</span>
                  <span><span className="font-semibold text-foreground">{sub.filled_count}</span>/{sub.kpi_count} KPIs</span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 bg-sunken rounded-full overflow-hidden mb-2 pl-0 ml-[18px]">
                  <div
                    className={`h-full rounded-full transition-all ${sub.status === "APPROVED" ? "bg-ok" : sub.status === "REJECTED" ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: `${completeness}%` }}
                  />
                </div>
                {sub.submitted_by_name && (
                  <p className="text-[11px] text-muted-foreground pl-[18px]">
                    Submitted by <span className="font-medium text-muted-foreground">{sub.submitted_by_name}</span>
                    {relativeDate && ` · ${relativeDate}`}
                  </p>
                )}
                {sub.reviewer_notes && sub.status === "REJECTED" && (
                  <p className="text-[11px] text-destructive mt-1 truncate pl-[18px]">Reason: {sub.reviewer_notes}</p>
                )}
              </button>
            );
          })}

          {/* ── Scope 3 Batches ── */}
          {filteredScope3Batches.length > 0 && (
            <>
              <div className="px-5 py-2 bg-sunken border-b border-[hsl(var(--border-hairline))] flex items-center gap-2">
                <Package2 size={12} className="text-primary" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Scope 3 Batches</span>
              </div>
              {filteredScope3Batches.map((b) => {
                const isSelected = selectedScope3?.batch_id === b.batch_id;
                const monthLabel = b.reporting_month
                  ? ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][b.reporting_month]
                  : "Annual";
                return (
                  <button
                    key={b.batch_id}
                    onClick={() => loadScope3Detail(b)}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-[hsl(var(--border-hairline))] border-l-[3px] hover:bg-sunken/70 transition-colors",
                      isSelected
                        ? "border-l-primary bg-primary/[0.07]"
                        : "border-l-transparent",
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 mb-1.5">
                      <StatusDot status={b.status} />
                      <Package2 size={13} className="text-primary flex-shrink-0" />
                      <span className="text-[13px] font-bold text-foreground truncate">{b.ghg_category_name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[12px] text-muted-foreground mb-1.5 pl-[18px]">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} className="text-muted-foreground" />
                        {monthLabel} {b.reporting_year}
                      </span>
                      <span className="text-muted-foreground/40">|</span>
                      <span>{b.total_rows} entries</span>
                      <span className="text-muted-foreground/40">|</span>
                      <span className="font-semibold text-foreground tabular-nums">{(b.total_emissions ?? 0).toFixed(2)} tCO2e</span>
                    </div>
                    {b.uploader_name && (
                      <p className="text-[11px] text-muted-foreground pl-[18px]">
                        By <span className="font-medium text-muted-foreground">{b.uploader_name}</span>
                      </p>
                    )}
                    {b.rejection_reason && b.status === "REJECTED" && (
                      <p className="text-[11px] text-destructive mt-1 truncate pl-[18px]">Reason: {b.rejection_reason}</p>
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* ── Drag handle (resize) ── */}
      <AuditResizeHandle
        leftPct={leftPct}
        onResizeStart={onResizeStart}
        onNudge={(delta) => setLeftPct((p) => Math.min(LEFT_PCT_MAX, Math.max(LEFT_PCT_MIN, p + delta)))}
        valuemin={LEFT_PCT_MIN}
        valuemax={LEFT_PCT_MAX}
        label="Resize review panels"
      />

      {/* ── RIGHT PANEL: Scope 3 detail ── */}
      {selectedScope3 && (
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
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
        </div>
      )}

      {/* ── RIGHT PANEL: Submission detail + remarks side panel ── */}
      {selectedId && !selectedScope3 && (
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden border-l-0">
        <div className="flex-1 flex min-w-0 min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-card">
          {detailLoading ? (
            <div className="flex-1 flex items-center justify-center text-[13px] text-muted-foreground animate-pulse">
              Loading submission…
            </div>
          ) : detail ? (
            <>
              {/* Detail header — compact, no dead space */}
              <div className="bg-card border-b border-border px-4 py-2.5 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-[15px] font-bold text-foreground truncate">
                        {selectedSubmission?.location_name || "Submission"}
                      </h2>
                      {detailStatusCfg && <StatusPill status={detail.status} />}
                    </div>
                    <div className="flex items-center gap-2 text-[12px] text-muted-foreground mt-0.5 flex-wrap">
                      {(selectedSubmission?.month_name || selectedSubmission?.year_label) && (
                        <span className="flex items-center gap-1">
                          <Calendar size={12} className="text-muted-foreground" />
                          {selectedSubmission?.month_name} · {selectedSubmission?.year_label}
                        </span>
                      )}
                      <span className="text-muted-foreground/40">·</span>
                      <span>{detail.kpi_values.length} value{detail.kpi_values.length !== 1 ? "s" : ""} filled</span>
                      {detail.status === "APPROVED" && detail.reviewed_at && (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="text-ok font-medium">Approved {formatDate(detail.reviewed_at)}</span>
                        </>
                      )}
                      {detail.status === "REJECTED" && detail.reviewed_at && (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="text-destructive font-medium">Rejected {formatDate(detail.reviewed_at)}</span>
                        </>
                      )}
                    </div>
                    {detail.status === "REJECTED" && detail.reviewer_notes && (
                      <div className="mt-1.5 flex items-start gap-2 bg-destructive-tint border border-destructive/30 rounded-md px-2.5 py-1.5">
                        <AlertCircle size={13} className="text-destructive flex-shrink-0 mt-0.5" />
                        <span className="text-[12px] text-destructive">{detail.reviewer_notes}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 self-start">
                    <button
                      onClick={() => setShowRemarksPanel((v) => !v)}
                      className={`relative flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-semibold transition-colors ${showRemarksPanel ? "bg-primary text-white" : "border border-border text-muted-foreground hover:bg-sunken"}`}
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
                      className="p-1.5 rounded-md hover:bg-sunken text-muted-foreground"
                      title="Close detail"
                    >
                      <XIcon size={16} />
                    </button>
                  </div>
                </div>

                {/* Module tabs for detail view */}
                <div className="flex gap-1 mt-2 overflow-x-auto">
                  <button
                    onClick={() => setActiveDetailModule(null)}
                    className={`px-2.5 py-0.5 rounded-md text-[12px] font-semibold whitespace-nowrap transition-all ${activeDetailModule === null ? "bg-primary text-white" : "text-muted-foreground hover:bg-sunken"}`}
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
                        className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[12px] font-semibold whitespace-nowrap transition-all ${activeDetailModule === m.module_id ? "text-white" : "text-muted-foreground hover:bg-sunken"}`}
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
              <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-8">
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
                    <div key={mod.module_id} className="bg-card rounded-md border border-border overflow-hidden">
                      {/* Module header */}
                      <div className="flex items-center gap-3 px-5 py-3 border-b border-[hsl(var(--border-hairline))]" style={{ background: mod.bg_color }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: mod.color + "22" }}>
                          <Icon size={14} style={{ color: mod.color }} />
                        </div>
                        <span className="text-[13px] font-bold text-foreground">{mod.module_name}</span>
                        <span className="text-[11px] text-muted-foreground">{filledModKpis.length + directInds.length} values</span>
                      </div>

                      {/* Column headers */}
                      <div className={`grid ${GRID_COLS} gap-2 px-5 py-2 bg-sunken/60 border-b border-[hsl(var(--border-hairline))] text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.07em]`}>
                        <span className="text-left">KPI / Indicator</span>
                        <span className="text-center">Unit</span>
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
                            <div className={`grid ${GRID_COLS} gap-2 items-center px-5 py-2.5 hover:bg-sunken/30`}>
                              <div className="flex items-center gap-2 min-w-0 text-left">
                                <BarChart3 size={12} className="text-primary/50 flex-shrink-0" />
                                <span className="text-[12px] text-foreground truncate">{ind.indicator_name}</span>
                                <span className="text-[10px] bg-info-tint text-info border border-info/30 px-1 rounded font-semibold flex-shrink-0">Direct</span>
                              </div>
                              <span className="text-center text-[11px] text-muted-foreground font-mono">—</span>
                              <span className="text-right text-[13px] font-mono font-semibold text-foreground tabular-nums">
                                {Number(v.quantity).toLocaleString()}
                              </span>
                              <span className="text-right text-[12px] font-mono text-muted-foreground tabular-nums">—</span>
                              <span className="text-right text-[12px] font-mono text-muted-foreground tabular-nums">—</span>
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
                                  <div className={`grid ${GRID_COLS} gap-2 items-center px-5 py-2.5 hover:bg-sunken/30`}>
                                    <div className="flex items-center gap-2 min-w-0 text-left">
                                      {isAutoEmission ? <Lock size={11} className="text-muted-foreground/40 flex-shrink-0" /> : <BarChart3 size={12} className="text-muted-foreground/40 flex-shrink-0" />}
                                      <span className="text-[12px] text-foreground truncate">{kpi.kpi_name}</span>
                                    </div>
                                    <span className="text-center text-[11px] text-muted-foreground font-mono">{kpi.unit}</span>
                                    <span className="text-right text-[13px] font-mono font-semibold text-foreground tabular-nums">
                                      {Number(v.quantity).toLocaleString()}
                                    </span>
                                    <div className="relative group text-right">
                                      <span className={`text-[12px] font-mono text-muted-foreground tabular-nums ${v.mj_value != null ? "cursor-help" : ""}`}>
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
                                      <span className={`text-[12px] font-mono text-muted-foreground tabular-nums ${v.emission_value != null ? "cursor-help" : ""}`}>
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
                            <div className={`grid ${GRID_COLS} gap-2 items-center px-5 py-2.5 hover:bg-sunken/30`}>
                              <div className="flex items-center gap-2 min-w-0 text-left">
                                <BarChart3 size={12} className="text-muted-foreground/40 flex-shrink-0" />
                                <span className="text-[12px] text-foreground truncate">{kpi.kpi_name}</span>
                              </div>
                              <span className="text-center text-[11px] text-muted-foreground font-mono">{kpi.unit}</span>
                              <span className="text-right text-[13px] font-mono font-semibold text-foreground tabular-nums">
                                {Number(v.quantity).toLocaleString()}
                              </span>
                              <div className="relative group text-right">
                                <span className={`text-[12px] font-mono text-muted-foreground tabular-nums ${v.mj_value != null ? "cursor-help" : ""}`}>
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
                                <span className={`text-[12px] font-mono text-muted-foreground tabular-nums ${v.emission_value != null ? "cursor-help" : ""}`}>
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
                  <div className="bg-card rounded-md border border-border overflow-hidden">
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

                {/* Reviewer notes for approved (rejected notes shown in header) */}
                {detail.status === "APPROVED" && detail.reviewer_notes && (
                  <div className="rounded-md border border-ok/30 bg-ok-tint p-3 text-[12px]">
                    <p className="font-semibold text-ok mb-0.5">Reviewer notes</p>
                    <p className="text-ok">{detail.reviewer_notes}</p>
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
        </div>
      )}

      {/* Empty right panel prompt when nothing selected */}
      {!selectedId && !selectedScope3 && (
        <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-sunken overflow-hidden">
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <ClipboardCheck size={40} className="mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-[14px] font-semibold text-muted-foreground">Select a submission to review</p>
              <p className="text-[12px] mt-1">Click any item on the left to view details</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
