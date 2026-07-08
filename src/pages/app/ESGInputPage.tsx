import { useEffect, useState, useCallback, useRef } from "react";
import { tenantApi } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { useModulesStore } from "@/store/modules";
import { useFeaturesStore } from "@/store/features";
import { useVocabulariesStore } from "@/store/vocabularies";
import { getModuleIcon } from "@/lib/constants";
import { toast } from "sonner";
import type { Submission, SubmissionListItem, KPI, Indicator, Location, WasteDisposalBreakdown } from "@/types";
import { formatDate, getApiError } from "@/lib/utils";
import {
  ChevronDown, ChevronRight, CheckCircle2, Clock, XCircle,
  Upload, FileText, Trash2, Send, Save,
  MapPin, Calendar, BarChart3, Paperclip,
  AlertTriangle, Download,
} from "lucide-react";
import Scope3InputTab from "@/components/scope3/Scope3InputTab";
import RichTextEditor from "@/components/shared/RichTextEditor";
import { useIsSupportSession } from "@/components/shared/WriteOnly";

// ── Render type helpers (replace all hardcoded moduleId checks) ─────────
const isAutoComputed      = (renderType?: string) => renderType === "auto_computed";
const isInputWithDisposal = (renderType?: string) => renderType === "input_with_disposal";

/** Evaluate show_when: returns true if the indicator should be visible. */
function passesShowWhen(ind: Indicator, formValues: Record<string, string>): boolean {
  const cond = ind.show_when;
  if (!cond || !cond.indicator_id) return true;
  const answer = formValues[`ind_${cond.indicator_id}`] ?? "";
  const expected = String(cond.equals ?? "");
  return String(answer) === expected;
}

// Disposal methods are loaded from the platform-managed `disposal_methods`
// lookup table via useVocabulariesStore — no longer hardcoded here.

// ── Status config ──────────────────────────────────────────────────────
const STATUS_CONFIG = {
  DRAFT:     { label: "Draft",        color: "text-slate-500",   bg: "bg-slate-100",   icon: Clock },
  SUBMITTED: { label: "Under Review", color: "text-amber-600",   bg: "bg-amber-50",    icon: Clock },
  APPROVED:  { label: "Approved",     color: "text-emerald-600", bg: "bg-emerald-50",  icon: CheckCircle2 },
  REJECTED:  { label: "Rejected",     color: "text-red-600",     bg: "bg-red-50",      icon: XCircle },
};

// ── Month strip chip ───────────────────────────────────────────────────
function MonthChip({
  month, historyItem, isActive, isCurrent, isLocked, onClick
}: {
  month: any;
  historyItem?: SubmissionListItem;
  isActive: boolean;
  isCurrent: boolean;
  isLocked: boolean;
  onClick: () => void;
}) {
  let dot = "—";
  let dotColor = "text-[hsl(var(--placeholder))]";
  let statusBg = "";

  if (isLocked) {
    dot = "🔒"; dotColor = "text-[hsl(var(--muted-foreground))]"; statusBg = "bg-[hsl(var(--surface-sunken))]";
  } else if (historyItem) {
    if (historyItem.status === "APPROVED")  { dot = "✓"; dotColor = "text-[hsl(var(--ok))]"; statusBg = "bg-[hsl(var(--ok-tint))]"; }
    else if (historyItem.status === "SUBMITTED") { dot = "⏳"; dotColor = "text-[hsl(var(--warn))]"; statusBg = "bg-[hsl(var(--warn-tint))]"; }
    else if (historyItem.status === "REJECTED") { dot = "✗"; dotColor = "text-[hsl(var(--destructive))]"; statusBg = "bg-[hsl(var(--destructive-tint))]"; }
    else { dot = "●"; dotColor = "text-[hsl(var(--muted-foreground))]"; statusBg = "bg-[hsl(var(--surface-sunken))]"; }
  }

  const lockTitle = isLocked ? " — Locked (no edits allowed)" : "";
  return (
    <button
      onClick={onClick}
      title={`${month.month_name}${historyItem ? ` — ${historyItem.status}` : " — No data"}${lockTitle}`}
      className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap
        ${isActive
          ? "bg-[hsl(var(--primary))] text-white border-2 border-[hsl(var(--primary))] shadow-sm"
          : isCurrent
          ? "border-2 border-[hsl(var(--primary))] text-[hsl(var(--foreground))] bg-white"
          : `border ${isLocked ? "border-[hsl(var(--border))]" : "border-[hsl(var(--border-hairline))]"} text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--border))] hover:bg-[hsl(var(--surface-sunken))] ${statusBg}`
        }`}
    >
      <span className={isActive ? "text-white" : dotColor}>{dot}</span>
      <span className={isActive ? "text-white/90 text-[10px]" : "text-[10px] text-[hsl(var(--muted-foreground))]"}>{month.month_name.slice(0, 3)}</span>
    </button>
  );
}

// ── Per-KPI document panel ─────────────────────────────────────────────
function DocPanel({
  recordId, isEditable, companyId
}: { recordId: string | null; isEditable: boolean; companyId?: string }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!recordId) { setDocs([]); return; }
    tenantApi.listRecordDocuments(recordId)
      .then(r => setDocs(r.data || []))
      .catch(() => {});
  }, [recordId]);

  if (!recordId) {
    return (
      <div className="px-5 py-3 bg-slate-50/60 border-t border-slate-100 text-[12px] text-slate-400 italic">
        Save a value first to attach documents
      </div>
    );
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !recordId) return;
    setUploading(true);
    try {
      await tenantApi.uploadRecordDocument(recordId, e.target.files[0]);
      const r = await tenantApi.listRecordDocuments(recordId);
      setDocs(r.data || []);
      toast.success("File attached");
    } catch (err: any) {
      toast.error(getApiError(err, "Upload failed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDownload = async (docId: string, fileName: string) => {
    try {
      const res = await tenantApi.downloadDocument(docId);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Download failed"); }
  };

  const handleDelete = async (docId: string) => {
    try {
      await tenantApi.deleteDocument(docId);
      setDocs(prev => prev.filter((d: any) => d.document_id !== docId));
      toast.success("Removed");
    } catch { toast.error("Failed to remove"); }
  };

  return (
    <div className="bg-slate-50/60 border-t border-slate-100 px-5 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
          Attachments ({docs.length})
        </span>
        {isEditable && (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 px-2 py-1 rounded bg-brand-accent/10 text-brand-accent text-[11px] font-semibold hover:bg-brand-accent/20 transition-colors disabled:opacity-50"
          >
            <Upload size={11} /> {uploading ? "…" : "Attach"}
          </button>
        )}
        <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
      </div>
      {docs.length === 0 ? (
        <p className="text-[11px] text-slate-400">No files attached yet.</p>
      ) : (
        <div className="space-y-1">
          {docs.map((doc: any) => (
            <div key={doc.document_id} className="flex items-center gap-2">
              <FileText size={11} className="text-slate-400 flex-shrink-0" />
              <span className="text-[12px] text-brand-navy flex-1 truncate">{doc.file_name}</span>
              {doc.file_size_bytes && (
                <span className="text-[10px] text-slate-400">{(doc.file_size_bytes / 1024).toFixed(1)}KB</span>
              )}
              <button onClick={() => handleDownload(doc.document_id, doc.file_name)} className="p-1 rounded hover:bg-sky-50 text-slate-400 hover:text-brand-accent transition-colors">
                <Download size={11} />
              </button>
              {isEditable && (
                <button onClick={() => handleDelete(doc.document_id)} className="p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors">
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────
export default function ESGInputPage() {
  const { user } = useAuthStore();
  const modules = useModulesStore((s) => s.modules);
  const features = useFeaturesStore((s) => s.features);
  const hasFeature = useFeaturesStore((s) => s.hasFeature);
  const DISPOSAL_METHODS = useVocabulariesStore((s) => s.disposalMethods);
  const isSupport = useIsSupportSession();
  const isAdmin = user?.role === "COMPANY_ADMIN" && !isSupport;
  const isLocationUser = user?.role === "LOCATION_USER";
  const canEdit = (isAdmin || isLocationUser) && !isSupport;

  // Selectors
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [years, setYears] = useState<any[]>([]);
  const [months, setMonths] = useState<any[]>([]);
  const [selLocation, setSelLocation] = useState("");
  const [selYear, setSelYear] = useState<number | "">("");
  const [selMonth, setSelMonth] = useState<number | "">("");

  // KPI structure
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);

  // Submission state
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [prevValues, setPrevValues] = useState<Record<string, number>>({});
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [formNotes, setFormNotes] = useState<Record<string, string>>({});
  const [computedEmissions, setComputedEmissions] = useState<Record<string, number>>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Monthly history strip
  const [monthHistory, setMonthHistory] = useState<SubmissionListItem[]>([]);
  const [lockedMonthIds, setLockedMonthIds] = useState<Set<number>>(new Set());
  const [todayMonth, setTodayMonth] = useState<number | null>(null);
  const [periodSelected, setPeriodSelected] = useState(false);

  // Documents
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Expanded indicators + doc panels
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [docPanelOpen, setDocPanelOpen] = useState<Set<string>>(new Set());
  const [activeModule, setActiveModule] = useState<number | string | null>(null);

  // Waste disposal breakdown: kpi_id → { method → quantity string }
  const [breakdownValues, setBreakdownValues] = useState<Record<string, Record<string, string>>>({});
  const [breakdownOpen, setBreakdownOpen] = useState<Set<string>>(new Set());

  // (auto-save disabled — data only saved on explicit "Save Draft" click)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks the location:year key for which auto-selection has already run.
  // Prevents loadSubmission's setMonthHistory from re-triggering auto-select and
  // overriding the user's manual month click.
  const autoSelectedPeriodRef = useRef<string>("");

  // Filtered locations for LOCATION_USER
  const assignedLocationIds = user?.assigned_location_ids;
  const visibleLocations = isLocationUser && assignedLocationIds?.length
    ? allLocations.filter(l => assignedLocationIds!.includes(l.location_id))
    : allLocations;

  // Auto-select if only 1 location (all roles — admin with 1 site shouldn't have to pick)
  useEffect(() => {
    if (visibleLocations.length === 1 && !selLocation) {
      setSelLocation(visibleLocations[0].location_id);
    }
  }, [visibleLocations, selLocation]);

  // Load selector data
  useEffect(() => {
    Promise.allSettled([
      tenantApi.listLocations({ size: 500 }),
      tenantApi.listReportingYears(),
      tenantApi.listMonths(),
      tenantApi.listKPIs({ size: 500 }),
      tenantApi.listIndicators({ size: 500 }),
    ]).then(([locR, yearR, monR, kpiR, indR]) => {
      if (locR.status === "fulfilled") {
        const d = locR.value.data;
        setAllLocations(Array.isArray(d) ? d : d?.items || []);
      }
      if (yearR.status === "fulfilled") {
        const d = yearR.value.data;
        const arr: any[] = Array.isArray(d) ? d : d?.items || [];
        // Normalize: flatten financial_year.fy_label onto the object for easy rendering
        setYears(arr.map((y: any) => ({ ...y, fy_label: y.financial_year?.fy_label || y.fy_label }))
                    .sort((a: any, b: any) => a.year_id - b.year_id));
      }
      if (monR.status === "fulfilled") {
        const d = monR.value.data;
        const monthArr = Array.isArray(d) ? d : d?.items || [];
        setMonths(monthArr);
        // Determine current calendar month to auto-highlight
        const calendarMonth = new Date().getMonth() + 1; // 1-12
        const matched = monthArr.find((m: any) => m.calendar_month === calendarMonth);
        if (matched) setTodayMonth(matched.month_id);
      }
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

  // Auto-select the next month that needs attention when history first loads for a location+year.
  // Uses a ref key to run exactly ONCE per location+year — never when loadSubmission refreshes
  // monthHistory after the user manually picks a month (which caused all months to show
  // August's previous values instead of their own preceding month's values).
  useEffect(() => {
    if (!selLocation || !selYear || !months.length) return;
    const key = `${selLocation}:${selYear}`;
    if (autoSelectedPeriodRef.current === key) return; // already done for this period

    const sorted = [...months].sort((a: any, b: any) => a.fy_order - b.fy_order);
    const statusMap: Record<number, string> = {};
    for (const h of monthHistory) statusMap[h.month_id] = h.status;

    const nextToFill = sorted.find((m: any) => {
      if (lockedMonthIds.has(m.month_id)) return false;
      const s = statusMap[m.month_id];
      return s !== "APPROVED" && s !== "SUBMITTED";
    });

    const toSelect = nextToFill?.month_id ?? todayMonth ?? sorted[sorted.length - 1]?.month_id;
    if (toSelect !== undefined && toSelect !== null) {
      autoSelectedPeriodRef.current = key; // mark BEFORE setState to block re-entry
      setSelMonth(toSelect);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthHistory, lockedMonthIds]);

  // Auto-select most recent year (last in the list — sorted ascending by year_id)
  useEffect(() => {
    if (years.length > 0 && !selYear) {
      setSelYear(years[years.length - 1].year_id);
    }
  }, [years, selYear]);

  // Load month history + period lock status when location+year changes
  useEffect(() => {
    if (!selLocation || !selYear) {
      setMonthHistory([]);
      setLockedMonthIds(new Set());
      return;
    }
    // Reset so auto-select runs fresh for this new location+year
    autoSelectedPeriodRef.current = "";
    setSelMonth("");
    tenantApi.listLocationSubmissions(selLocation, selYear as number)
      .then(r => {
        const items = r.data?.items || r.data || [];
        setMonthHistory(items);
      })
      .catch(() => toast.error("Failed to load month history"));

    // Find the reporting year record to get its year_id for period lookup
    tenantApi.listReportingYears().then(r => {
      const rys: any[] = Array.isArray(r.data) ? r.data : r.data?.items || [];
      const ry = rys.find((y: any) => y.year_id === selYear);
      if (!ry) return;
      tenantApi.getPeriods(ry.year_id).then(pr => {
        const periods: any[] = Array.isArray(pr.data) ? pr.data : pr.data?.items || [];
        setLockedMonthIds(new Set(periods.filter((p: any) => p.is_locked).map((p: any) => p.month_id)));
      }).catch(() => {});
    }).catch(() => {});
  }, [selLocation, selYear]);

  // Load submission when period selected — auto-trigger
  useEffect(() => {
    if (!selLocation || !selYear || !selMonth) {
      setPeriodSelected(false);
      setSubmission(null);
      setFormValues({});
      setFormNotes({});
      setPrevValues({});
      setDocuments([]);
      setComputedEmissions({});
      setBreakdownValues({});
      setBreakdownOpen(new Set());
      return;
    }
    setPeriodSelected(true);
    loadSubmission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selLocation, selYear, selMonth]);

  const loadSubmission = async () => {
    if (!selLocation || !selYear || !selMonth) return;
    setLoading(true);
    setSubmission(null);
    setFormValues({});
    setFormNotes({});
    setPrevValues({});
    setDocuments([]);
    setComputedEmissions({});
    setBreakdownValues({});
    setBreakdownOpen(new Set());
    try {
      // Fetch history to check if a submission already exists — do NOT create one
      const histRes = await tenantApi.listLocationSubmissions(selLocation, selYear as number);
      const history: SubmissionListItem[] = histRes.data?.items || histRes.data || [];
      setMonthHistory(history);

      // Always fetch previous month's values (works even with no submission yet)
      tenantApi.getPreviousValuesByPeriod(selLocation, selYear as number, selMonth as number)
        .then(r => setPrevValues(r.data || {}))
        .catch(() => {});

      const existing = history.find((h: SubmissionListItem) => h.month_id === selMonth);
      if (existing) {
        const res = await tenantApi.getSubmission(existing.submission_id);
        const sub: Submission = res.data;
        applySubmission(sub);

        const docRes = await tenantApi.listDocuments(sub.submission_id).catch(() => null);
        if (docRes) setDocuments(docRes.data || []);

        // Load existing waste disposal breakdown
        tenantApi.getWasteDisposalBySubmission(sub.submission_id)
          .then(bdRes => {
            const rows: WasteDisposalBreakdown[] = bdRes.data || [];
            if (rows.length === 0) return;
            const bdVals: Record<string, Record<string, string>> = {};
            for (const row of rows) {
              // Map record_id back to kpi_id or ind_${id} via kpi_values
              const kv = sub.kpi_values.find(v => v.record_id === row.record_id);
              const bdKey = kv?.kpi_id
                ? kv.kpi_id
                : kv?.indicator_id
                ? `ind_${kv.indicator_id}`
                : null;
              if (!bdKey) continue;
              if (!bdVals[bdKey]) bdVals[bdKey] = {};
              bdVals[bdKey][row.method] = String(row.quantity);
            }
            setBreakdownValues(bdVals);
          })
          .catch(() => {});
      }
      // If no existing submission, form shows empty — submission created on Save Draft

      // Expand all indicators by default
      const allIds = new Set(indicators.map((i: Indicator) => i.indicator_id));
      setExpanded(allIds);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to load form"));
    } finally {
      setLoading(false);
    }
  };

  const applySubmission = (sub: Submission) => {
    setSubmission(sub);
    const vals: Record<string, string> = {};
    const notes: Record<string, string> = {};
    const emissions: Record<string, number> = {};

    sub.kpi_values.forEach(v => {
      if (v.kpi_id) {
        const kpi = kpis.find((k: KPI) => k.kpi_id === v.kpi_id);
        const inputType = kpi?.input_type ?? "numeric";
        if (inputType === "text") {
          vals[`kpi_${v.kpi_id}`] = v.text_value ?? "";
        } else if (inputType === "boolean") {
          vals[`kpi_${v.kpi_id}`] = v.text_value ?? (v.quantity === 1 ? "Y" : v.quantity === 0 ? "N" : "");
        } else {
          vals[`kpi_${v.kpi_id}`] = String(v.quantity);
        }
        if (v.notes) notes[`kpi_${v.kpi_id}`] = v.notes;
        if (v.emission_value) emissions[v.kpi_id] = v.emission_value;
      } else if (v.indicator_id) {
        const ind = indicators.find((i: Indicator) => i.indicator_id === v.indicator_id);
        const inputType = ind?.input_type ?? "numeric";
        if (inputType === "text") {
          vals[`ind_${v.indicator_id}`] = v.text_value ?? "";
        } else if (inputType === "boolean") {
          vals[`ind_${v.indicator_id}`] = v.text_value ?? (v.quantity === 1 ? "Y" : v.quantity === 0 ? "N" : "");
        } else {
          vals[`ind_${v.indicator_id}`] = String(v.quantity);
        }
        if (v.notes) notes[`ind_${v.indicator_id}`] = v.notes;
      }
    });
    setFormValues(vals);
    setFormNotes(notes);
    setComputedEmissions(emissions);
  };

  // Editable when: no submission yet (new period) OR status is DRAFT/REJECTED
  const isEditable = canEdit && (!submission || submission.status === "DRAFT" || submission.status === "REJECTED");

  // Get record_id for a kpi or indicator
  const getRecordId = (key: string): string | null => {
    if (!submission) return null;
    if (key.startsWith("kpi_")) {
      const kpiId = key.slice(4);
      const v = submission.kpi_values.find(x => x.kpi_id === kpiId);
      return v?.record_id || null;
    } else if (key.startsWith("ind_")) {
      const indId = parseInt(key.slice(4));
      const v = submission.kpi_values.find(x => x.indicator_id === indId);
      return v?.record_id || null;
    }
    return null;
  };

  const handleValueChange = (key: string, value: string) => {
    if (!isEditable) return;
    const newValues = { ...formValues, [key]: value };
    setFormValues(newValues);
    setSaveStatus("idle");
    // No auto-save — user must explicitly click "Save Draft"
  };

  const handleNotesChange = (key: string, value: string) => {
    if (!isEditable) return;
    setFormNotes(prev => ({ ...prev, [key]: value }));
  };

  /** Copy APPROVED text/boolean answers from the previous FY. Only overwrites empty cells. */
  const copyPreviousYearText = async (indicatorIds: number[]) => {
    if (!isEditable || !selLocation || !selYear) return;
    try {
      const res = await tenantApi.copyPreviousYear(Number(selYear), selLocation);
      const payload = res.data as { prev_fy_label?: string; values?: Record<string, { text_value: string | null; quantity: number | null }> };
      if (!payload?.values || Object.keys(payload.values).length === 0) {
        toast.info("No approved data found in the previous FY.");
        return;
      }
      const next = { ...formValues };
      let copied = 0;
      for (const id of indicatorIds) {
        const key = `ind_${id}`;
        if (next[key]) continue; // don't overwrite existing input
        const v = payload.values[String(id)];
        if (!v) continue;
        if (v.text_value != null && v.text_value !== "") {
          next[key] = v.text_value;
          copied++;
        }
      }
      if (copied === 0) {
        toast.info("No new text/boolean answers to copy.");
        return;
      }
      setFormValues(next);
      setSaveStatus("idle");
      toast.success(`Copied ${copied} answer${copied === 1 ? "" : "s"} from ${payload.prev_fy_label}.`);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to copy previous year"));
    }
  };

  const buildSavePayload = (values: Record<string, string>, notes: Record<string, string>) => {
    const payload: Array<{ kpi_id?: string; indicator_id?: number; quantity: number | null; text_value?: string | null; notes?: string | null }> = [];

    const toItem = (inputType: string, val: string) => {
      if (inputType === "boolean") return { quantity: val === "Y" ? 1 : 0, text_value: val };
      if (inputType === "text")    return { quantity: 0, text_value: val };
      return { quantity: parseFloat(val), text_value: null };
    };

    // KPI entries
    kpis.forEach(k => {
      const key = `kpi_${k.kpi_id}`;
      if (values[key] !== undefined && values[key] !== "") {
        const { quantity, text_value } = toItem(k.input_type ?? "numeric", values[key]);
        payload.push({ kpi_id: k.kpi_id, quantity, text_value, notes: notes[key] || null });
      }
    });

    // Indicator direct-entry (indicators with no KPIs)
    indicators.forEach(ind => {
      const indKpis = kpis.filter(k => k.indicator_id === ind.indicator_id);
      if (indKpis.length > 0) return; // has KPIs, skip
      const key = `ind_${ind.indicator_id}`;
      if (values[key] !== undefined && values[key] !== "") {
        const { quantity, text_value } = toItem(ind.input_type ?? "numeric", values[key]);
        payload.push({ indicator_id: ind.indicator_id, quantity, text_value, notes: notes[key] || null });
      }
    });

    return payload;
  };


  const handleManualSave = async () => {
    if (!isEditable || !selLocation || !selYear || !selMonth) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    try {
      // Create submission now if this is the first save
      let sub = submission;
      if (!sub) {
        const res = await tenantApi.getOrCreateSubmission(selLocation, selYear as number, selMonth as number);
        sub = res.data;
        setSubmission(sub);
      }
      const payload = buildSavePayload(formValues, formNotes);
      const res = await tenantApi.saveKPIValues(sub!.submission_id, payload);
      applySubmission(res.data);

      // Save waste disposal breakdown for waste KPI and direct indicator entries
      const wasteModuleIds = new Set(modules.filter(m => isInputWithDisposal(m.render_type)).map(m => m.module_id));
      const wasteKpiIds = new Set(kpis.filter(k => wasteModuleIds.has(k.module_id)).map(k => k.kpi_id));
      const wasteIndIds = new Set(
        indicators
          .filter(i => wasteModuleIds.has(i.module_id) && kpis.filter(k => k.indicator_id === i.indicator_id).length === 0)
          .map(i => `ind_${i.indicator_id}`)
      );
      const savedKpiValues = (res.data as Submission).kpi_values;
      const breakdownSaves: Promise<any>[] = [];
      for (const [bdKey, methods] of Object.entries(breakdownValues)) {
        let recordId: string | null = null;
        if (wasteKpiIds.has(bdKey)) {
          // KPI entry
          recordId = savedKpiValues.find((v: any) => v.kpi_id === bdKey)?.record_id ?? null;
        } else if (wasteIndIds.has(bdKey)) {
          // Direct indicator entry
          const indId = parseInt(bdKey.slice(4));
          recordId = savedKpiValues.find((v: any) => v.indicator_id === indId)?.record_id ?? null;
        }
        if (!recordId) continue;
        const items = Object.entries(methods)
          .filter(([, qty]) => qty !== "" && !isNaN(parseFloat(qty)) && parseFloat(qty) > 0)
          .map(([method, qty]) => ({ method, quantity: parseFloat(qty), notes: null }));
        breakdownSaves.push(tenantApi.upsertWasteDisposal(recordId, items));
      }
      if (breakdownSaves.length > 0) await Promise.all(breakdownSaves);

      setSaveStatus("saved");
      toast.success("Draft saved");
      // Refresh history strip to show dot
      tenantApi.listLocationSubmissions(selLocation, selYear as number)
        .then(r => setMonthHistory(r.data?.items || r.data || []))
        .catch(() => {});
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err: any) {
      setSaveStatus("idle");
      toast.error(getApiError(err, "Save failed"));
    }
  };

  const handleSubmit = async () => {
    if (!isEditable || !selLocation || !selYear || !selMonth) return;
    const filledCount = Object.values(formValues).filter(v => v !== "").length;
    if (filledCount === 0) {
      toast.error("Please enter at least one value before submitting");
      return;
    }
    // Anomaly check
    const anomalyCount = getAnomalies().length;
    if (anomalyCount > 0) {
      if (!window.confirm(`${anomalyCount} anomal${anomalyCount === 1 ? "y" : "ies"} detected (values differ >50% from previous). Are you sure you want to submit?`)) return;
    }
    setSubmitting(true);
    try {
      // Create submission now if this is the first save
      let sub = submission;
      if (!sub) {
        const createRes = await tenantApi.getOrCreateSubmission(selLocation, selYear as number, selMonth as number);
        sub = createRes.data;
        setSubmission(sub);
      }
      const savePayload = buildSavePayload(formValues, formNotes);
      if (savePayload.length > 0) {
        await tenantApi.saveKPIValues(sub!.submission_id, savePayload);
      }
      const res = await tenantApi.submitForReview(sub!.submission_id);
      applySubmission(res.data);
      // Refresh month history
      if (selLocation && selYear) {
        tenantApi.listLocationSubmissions(selLocation, selYear as number)
          .then(r => setMonthHistory(r.data?.items || r.data || []))
          .catch(() => {});
      }
      toast.success("Submitted for review successfully");
    } catch (err: any) {
      toast.error(getApiError(err, "Submit failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!submission || !e.target.files?.[0]) return;
    setUploading(true);
    try {
      await tenantApi.uploadDocument(submission.submission_id, e.target.files[0]);
      const docRes = await tenantApi.listDocuments(submission.submission_id);
      setDocuments(docRes.data || []);
      toast.success("File uploaded");
    } catch (err: any) {
      toast.error(getApiError(err, "Upload failed"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    try {
      await tenantApi.deleteDocument(docId);
      setDocuments(prev => prev.filter((d: any) => d.document_id !== docId));
      toast.success("File removed");
    } catch { toast.error("Failed to remove file"); }
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

  const toggleIndicator = (indicatorId: number) => {
    setExpanded(prev => {
      const s = new Set(prev);
      s.has(indicatorId) ? s.delete(indicatorId) : s.add(indicatorId);
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

  const toggleBreakdown = (kpiId: string) => {
    setBreakdownOpen(prev => {
      const s = new Set(prev);
      s.has(kpiId) ? s.delete(kpiId) : s.add(kpiId);
      return s;
    });
  };

  const getBreakdownTotal = (kpiId: string): number => {
    const methods = breakdownValues[kpiId];
    if (!methods) return 0;
    return Object.values(methods).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  };

  const setBreakdownMethod = (kpiId: string, method: string, value: string) => {
    setBreakdownValues(prev => ({
      ...prev,
      [kpiId]: { ...(prev[kpiId] || {}), [method]: value },
    }));
  };

  // Anomaly detection: >50% difference from previous
  const getAnomalies = () => {
    const anomalies: string[] = [];
    Object.entries(formValues).forEach(([key, val]) => {
      if (!val) return;
      const prev = prevValues[key];
      if (prev === undefined || prev === 0) return;
      const curr = parseFloat(val);
      if (Math.abs(curr - prev) / Math.abs(prev) > 0.5) anomalies.push(key);
    });
    return anomalies;
  };

  const anomalies = getAnomalies();

  // Build visible modules — backend already scopes data; only show tabs that have content
  const visibleModules = modules.filter(m =>
    (kpis.some((k: KPI) => k.module_id === m.module_id) ||
     indicators.some((i: Indicator) => i.module_id === m.module_id && kpis.filter(k => k.indicator_id === i.indicator_id).length === 0)) &&
    (activeModule === null || m.module_id === activeModule)
  );

  // Progress
  const filledKpiKeys = Object.entries(formValues).filter(([, v]) => v !== "").map(([k]) => k);
  const filledCount = filledKpiKeys.length;
  // Total fillable = sum of per-module counts (same logic as module tabs)
  const totalKpiCount = modules.reduce((sum, m) => {
    const mKpis = kpis.filter((k: KPI) => k.module_id === m.module_id && !(isAutoComputed(m.render_type) && k.is_emission_source));
    const mInds = isAutoComputed(m.render_type) ? [] : indicators.filter(i =>
      i.module_id === m.module_id &&
      kpis.filter(k => k.indicator_id === i.indicator_id).length === 0
    );
    return sum + mKpis.length + mInds.length;
  }, 0);

  const statusCfg = submission ? STATUS_CONFIG[submission.status as keyof typeof STATUS_CONFIG] : null;
  const currentLocationName = visibleLocations.find(l => l.location_id === selLocation)?.location_name;

  // ── Input widget helper — renders numeric/boolean/text based on input_type ──
  const renderInputWidget = (
    inputType: string | undefined,
    key: string,
    val: string,
    editable: boolean,
    isFilled: boolean,
    isAnomaly: boolean,
  ) => {
    const type = inputType ?? "numeric";
    if (type === "boolean") {
      return (
        <div className="flex gap-1.5">
          {(["Y", "N"] as const).map(v => (
            <button key={v} type="button"
              disabled={!editable}
              onClick={() => editable && handleValueChange(key, val === v ? "" : v)}
              className={`flex-1 py-1.5 rounded-[var(--radius)] border text-[12px] font-semibold transition-all
                ${!editable ? "opacity-50 cursor-not-allowed" :
                val === v
                  ? v === "Y" ? "bg-[hsl(var(--ok-tint))] border-[hsl(var(--ok))] text-[hsl(var(--ok))]"
                               : "bg-[hsl(var(--destructive-tint))] border-[hsl(var(--destructive))] text-[hsl(var(--destructive))]"
                  : "bg-white border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--foreground)/30%)]"}`}>
              {v === "Y" ? "Yes" : "No"}
            </button>
          ))}
        </div>
      );
    }
    if (type === "text") {
      return (
        <RichTextEditor
          value={val}
          onChange={(html) => handleValueChange(key, html)}
          editable={editable}
          isFilled={isFilled}
        />
      );
    }
    // numeric (default)
    return (
      <input type="number" step="any" value={val}
        onChange={e => handleValueChange(key, e.target.value)}
        disabled={!editable}
        placeholder="Enter value"
        className={`w-full px-3 py-1.5 border text-[13px] font-mono tabular-nums outline-none transition-all
          rounded-[var(--radius)]
          ${!editable
            ? 'bg-[hsl(var(--surface-sunken))] text-[hsl(var(--placeholder))] border-[hsl(var(--border-hairline))] cursor-not-allowed'
            : isAnomaly
            ? 'border-[hsl(var(--warn))] bg-[hsl(var(--warn-tint))] text-[hsl(var(--foreground))] focus:ring-2 focus:ring-[hsl(var(--warn)/30%)] focus:outline-none'
            : isFilled
            ? 'border-[hsl(var(--ok-tint))] bg-white text-[hsl(var(--foreground))] focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--accent))] focus:outline-none'
            : 'border-[hsl(var(--border))] bg-white text-[hsl(var(--foreground))] focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--accent))] focus:outline-none'
          }`} />
    );
  };

  // ── Question-card layout for text / boolean inputs (KPIs and indicators) ──
  // Breaks out of the rigid 5-column grid: full-width Tiptap editor, no
  // meaningless Unit / Previous columns, "Text Response" or "Yes / No" badge
  // for clarity. Used for both direct-entry indicators and KPIs with
  // input_type = "text" | "boolean".
  const renderQuestionCard = (cfg: {
    reactKey: string | number;
    name: string;
    description?: string;
    inputType: "text" | "boolean";
    fieldKey: string;
    val: string;
    isFilled: boolean;
    prev: number | undefined;
    isEditable: boolean;
    indented?: boolean;
  }) => {
    const { reactKey, name, description, inputType, fieldKey, val, isFilled, prev, isEditable, indented } = cfg;
    const isBoolean = inputType === "boolean";
    const prevBoolAnswer = prev === 1 ? "Yes" : prev === 0 ? "No" : null;
    const recordId = getRecordId(fieldKey);
    const docOpen = docPanelOpen.has(fieldKey);

    return (
      <div key={reactKey} className="border-b border-slate-100 last:border-b-0">
        <div className={`pt-4 pb-4 bg-white border-l-2 border-l-slate-200 hover:border-l-brand-accent/40 transition-colors ${indented ? "pl-10 pr-5" : "px-5"}`}>
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[13px] font-semibold text-brand-navy">{name}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${isBoolean ? "bg-violet-50 text-violet-600" : "bg-amber-50 text-amber-600"}`}>
                  {isBoolean ? "Yes / No" : "Text Response"}
                </span>
                {isFilled && <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />}
              </div>
              {description && (
                <p className="text-[12px] text-slate-500 leading-relaxed">{description}</p>
              )}
              {!isFilled && isBoolean && prevBoolAnswer && (
                <p className="text-[11px] text-slate-400 mt-0.5">Last answer: {prevBoolAnswer}</p>
              )}
              {!isFilled && !isBoolean && prev !== undefined && (
                <p className="text-[11px] text-slate-400 mt-0.5">Previously answered</p>
              )}
            </div>
            <button
              onClick={() => toggleDocPanel(fieldKey)}
              title="Attach document"
              className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border transition-all
                ${docOpen ? "bg-brand-accent/10 border-brand-accent/30 text-brand-accent" : "border-slate-200 text-slate-400 hover:border-slate-300"}`}
            >
              <Paperclip size={12} />
            </button>
          </div>
          {isBoolean ? (
            <div className="flex gap-2 max-w-[220px]">
              {(["Y", "N"] as const).map(v => (
                <button key={v} type="button"
                  disabled={!isEditable}
                  onClick={() => isEditable && handleValueChange(fieldKey, val === v ? "" : v)}
                  className={`flex-1 py-2 rounded-[var(--radius)] border text-[13px] font-semibold transition-all
                    ${!isEditable ? "opacity-50 cursor-not-allowed" :
                    val === v
                      ? v === "Y" ? "bg-[hsl(var(--ok-tint))] border-[hsl(var(--ok))] text-[hsl(var(--ok))]"
                                   : "bg-[hsl(var(--destructive-tint))] border-[hsl(var(--destructive))] text-[hsl(var(--destructive))]"
                      : "bg-white border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--foreground)/30%)]"}`}>
                  {v === "Y" ? "Yes" : "No"}
                </button>
              ))}
            </div>
          ) : (
            <RichTextEditor
              value={val}
              onChange={(html) => handleValueChange(fieldKey, html)}
              editable={isEditable}
              isFilled={isFilled}
            />
          )}
        </div>
        {docOpen && <DocPanel recordId={recordId} isEditable={isEditable} />}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">

      {/* ── STICKY HEADER ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex-shrink-0 shadow-sm">
        {/* Row 1: Location + Year + Status + Save */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Location */}
            <div className="flex items-center gap-2">
              <MapPin size={15} className="text-slate-400" />
              {isLocationUser && visibleLocations.length === 1 ? (
                <span className="text-[13px] font-bold text-brand-navy">{currentLocationName}</span>
              ) : (
                <select
                  value={selLocation}
                  onChange={e => setSelLocation(e.target.value)}
                  className="text-[13px] font-semibold text-brand-navy border border-slate-200 rounded-lg px-3 py-1.5 bg-white outline-none focus:border-brand-accent min-w-[180px]"
                >
                  <option value="">Select Location</option>
                  {visibleLocations.map((l: Location) => (
                    <option key={l.location_id} value={l.location_id}>{l.location_name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Year */}
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-slate-400" />
              <select
                value={selYear}
                onChange={e => { setSelYear(Number(e.target.value) || ""); setSelMonth(""); }}
                className="text-[13px] font-semibold text-brand-navy border border-slate-200 rounded-lg px-3 py-1.5 bg-white outline-none focus:border-brand-accent"
              >
                <option value="">Year</option>
                {years.map((y: any) => <option key={y.year_id} value={y.year_id}>{y.fy_label}</option>)}
              </select>
            </div>

            {/* Status + filled count */}
            {statusCfg && (
              <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-bold ${statusCfg.color} ${statusCfg.bg}`}>
                <statusCfg.icon size={12} /> {statusCfg.label}
              </span>
            )}
            {submission && (
              <span className="text-[12px] text-slate-400">
                <span className="font-semibold text-brand-navy">{filledCount}</span>/{totalKpiCount} filled
              </span>
            )}
          </div>

          {/* Save indicator */}
          <div className="flex items-center gap-2">
            {saveStatus === "saving" && <span className="text-[12px] text-slate-400 animate-pulse">Saving…</span>}
            {saveStatus === "saved" && <span className="text-[12px] text-emerald-500 font-semibold">✓ Saved</span>}
            {anomalies.length > 0 && submission && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm font-sans text-[11px] font-semibold bg-[hsl(var(--warn-tint))] text-[hsl(var(--warn))]">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--warn))]" />
                {anomalies.length} anomal{anomalies.length === 1 ? "y" : "ies"}
              </span>
            )}
          </div>
        </div>

        {/* Row 2: Monthly history strip */}
        {selLocation && selYear && months.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto py-1.5 mt-1 border-t border-slate-100">
            {months.map((m: any) => {
              const histItem = monthHistory.find(h => h.month_id === m.month_id);
              return (
                <MonthChip
                  key={m.month_id}
                  month={m}
                  historyItem={histItem}
                  isActive={selMonth === m.month_id}
                  isCurrent={m.month_id === todayMonth}
                  isLocked={lockedMonthIds.has(m.month_id)}
                  onClick={() => setSelMonth(m.month_id)}
                />
              );
            })}
          </div>
        )}

        {/* Rejection banner */}
        {submission?.status === "REJECTED" && submission.reviewer_notes && (
          <div className="mt-2 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            <XCircle size={13} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-[12px] font-semibold text-red-700">Rejected: </span>
              <span className="text-[12px] text-red-600">{submission.reviewer_notes}</span>
            </div>
          </div>
        )}
      </div>

      {/* Empty state — only when no period is selected yet */}
      {!periodSelected && !loading && (
        <div className="flex-1 flex items-center justify-center text-slate-400">
          <div className="text-center">
            <BarChart3 size={40} className="mx-auto mb-3 text-slate-300" />
            <p className="text-[14px] font-semibold text-slate-500">Select a period to begin</p>
            <p className="text-[12px] mt-1">Choose a month from the strip above to load the form</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[13px] text-slate-400 animate-pulse">Loading form…</div>
        </div>
      )}

      {periodSelected && !loading && (
        <div className="flex-1 overflow-y-auto">

          {/* Module tabs */}
          <div className="bg-white border-b border-slate-200 px-6 flex gap-1 py-2 sticky top-0 z-10 overflow-x-auto">
            <button
              onClick={() => setActiveModule(null)}
              className={`px-4 py-1.5 rounded-md text-[12px] font-semibold transition-all whitespace-nowrap
                ${activeModule === null
                  ? "bg-[hsl(var(--accent))] text-[hsl(var(--primary))] border border-[hsl(var(--primary)/30%)]"
                  : "bg-transparent text-[hsl(var(--muted-foreground))] border border-transparent hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-sunken))]"}`}
            >
              All
            </button>
            {modules.map(m => {
              const Icon = getModuleIcon(m.icon_name);
              const modKpis = kpis.filter((k: KPI) => k.module_id === m.module_id && !(isAutoComputed(m.render_type) && k.is_emission_source));
              const modDirectInds = isAutoComputed(m.render_type) ? [] : indicators.filter(i =>
                i.module_id === m.module_id &&
                kpis.filter(k => k.indicator_id === i.indicator_id).length === 0
              );
              const total = modKpis.length + modDirectInds.length;
              if (total === 0) return null;
              const modFilled = [
                ...modKpis.map(k => `kpi_${k.kpi_id}`),
                ...modDirectInds.map(i => `ind_${i.indicator_id}`),
              ].filter(key => formValues[key] !== undefined && formValues[key] !== "").length;

              return (
                <button
                  key={m.module_id}
                  onClick={() => setActiveModule(m.module_id === activeModule ? null : m.module_id)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[12px] font-semibold transition-all whitespace-nowrap
                    ${activeModule === m.module_id
                      ? "bg-[hsl(var(--accent))] text-[hsl(var(--primary))] border border-[hsl(var(--primary)/30%)]"
                      : "bg-transparent text-[hsl(var(--muted-foreground))] border border-transparent hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-sunken))]"}`}
                >
                  <Icon size={13} />
                  {m.module_name}
                  <span className={`text-[10px] ${activeModule === m.module_id ? "text-[hsl(var(--primary)/75%)]" : "text-[hsl(var(--placeholder))]"}`}>
                    {modFilled}/{total}
                  </span>
                </button>
              );
            })}
            {/* Bespoke features (Scope 3, BRSR, etc.) — only rendered if assigned to this company */}
            {features.filter(f => f.is_active && hasFeature(f.key)).map(f => {
              const FIcon = getModuleIcon(f.icon_name);
              const featKey = `feat:${f.key}`;
              return (
                <button
                  key={`feature-${f.feature_id}`}
                  onClick={() => setActiveModule(activeModule === featKey ? null : featKey)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[12px] font-semibold transition-all whitespace-nowrap
                    ${activeModule === featKey
                      ? "bg-[hsl(var(--accent))] text-[hsl(var(--primary))] border border-[hsl(var(--primary)/30%)]"
                      : "bg-transparent text-[hsl(var(--muted-foreground))] border border-transparent hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--surface-sunken))]"}`}
                >
                  <FIcon size={13} />
                  {f.feature_name}
                </button>
              );
            })}
          </div>

          {/* Form body */}
          {activeModule === "feat:scope3" ? (
            <Scope3InputTab
              selYear={selYear as number}
              selMonth={selMonth}
              months={months}
              isLocked={lockedMonthIds.has(selMonth as number)}
              canEdit={canEdit}
            />
          ) : (
          <div className="p-5 space-y-4 max-w-[1200px]">
            {visibleModules.map(mod => {
              const Icon = getModuleIcon(mod.icon_name);
              const modIndicators = indicators
                .filter((i: Indicator) => i.module_id === mod.module_id)
                .filter((i: Indicator) => passesShowWhen(i, formValues));
              const modKpis = kpis.filter((k: KPI) => k.module_id === mod.module_id);
              const directEntryIndicators = modIndicators.filter(i =>
                kpis.filter(k => k.indicator_id === i.indicator_id).length === 0
              );
              const isEmissionsModule = isAutoComputed(mod.render_type);

              if (modKpis.length === 0 && directEntryIndicators.length === 0 && !isEmissionsModule) return null;

              return (
                <div key={mod.module_id} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  {/* Module header */}
                  <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[hsl(var(--border-hairline))] bg-transparent">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: mod.color + "22" }}>
                      <Icon size={17} style={{ color: mod.color }} />
                    </div>
                    <span className="text-[14px] font-bold text-brand-navy">{mod.module_name}</span>
                    <span className="text-[11px] text-slate-400">
                      {(() => {
                        const fillable = modKpis.filter(k => !(isEmissionsModule && k.is_emission_source));
                        const fillableInds = isEmissionsModule ? [] : directEntryIndicators;
                        const filled = [
                          ...fillable.map(k => `kpi_${k.kpi_id}`),
                          ...fillableInds.map(i => `ind_${i.indicator_id}`),
                        ].filter(key => formValues[key] !== undefined && formValues[key] !== "").length;
                        return `${filled} of ${fillable.length + fillableInds.length} filled`;
                      })()}
                    </span>
                    {(() => {
                      const textIds = directEntryIndicators
                        .filter(i => i.input_type === "text" || i.input_type === "boolean")
                        .map(i => i.indicator_id);
                      if (!isEditable || textIds.length === 0) return null;
                      return (
                        <button
                          type="button"
                          onClick={() => copyPreviousYearText(textIds)}
                          className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-slate-200 bg-white/70 hover:bg-white text-[11px] font-semibold text-slate-600 hover:text-brand-accent hover:border-brand-accent/40 transition-colors"
                          title="Copy approved text/boolean answers from the previous FY (won't overwrite existing answers)"
                        >
                          <Download size={12} /> Copy from previous FY
                        </button>
                      );
                    })()}
                  </div>

                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_70px_110px_180px_36px] gap-3 px-5 py-2 bg-slate-50/60 border-b border-slate-100 text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                    <span>KPI / Indicator</span>
                    <span>Unit</span>
                    <span className="text-right">Previous</span>
                    <span>{isEmissionsModule ? "Emission Value" : "Current Value"}</span>
                    <span></span>
                  </div>

                  {/* Emissions module — computed rows */}
                  {isEmissionsModule && (
                    <>
                      {kpis.filter(k => k.is_emission_source).map(kpi => {
                        const emVal = computedEmissions[kpi.kpi_id];
                        return (
                          <div key={kpi.kpi_id} className="grid grid-cols-[1fr_70px_110px_180px_36px] gap-3 items-center px-5 py-1.5 border-t border-slate-100/70 bg-slate-50/20 hover:bg-slate-50/40">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[13px] text-brand-navy font-medium truncate">{kpi.kpi_name}</span>
                            </div>
                            <span className="font-mono text-[12px] tabular-nums text-[hsl(var(--muted-foreground))]">tCO₂e</span>
                            <div className="text-right">
                              <span className="font-mono text-[12px] tabular-nums text-[hsl(var(--placeholder))]">—</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {emVal != null ? (
                                <span className="text-[13px] font-mono text-brand-navy font-semibold">
                                  {emVal.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                                </span>
                              ) : (
                                <span className="text-[12px] text-slate-300" title="Set conversion factor in KPI Setup">
                                  — <span className="text-[10px] text-amber-500">No factor</span>
                                </span>
                              )}
                            </div>
                            <div />
                          </div>
                        );
                      })}
                      {/* Direct emissions KPIs (not auto-computed) */}
                      {modKpis.filter(k => !k.is_emission_source).map(kpi => {
                        const key = `kpi_${kpi.kpi_id}`;
                        const prev = prevValues[key];
                        const val = formValues[key] ?? "";
                        const isFilled = val !== "";
                        const isNumericKpi = (kpi.input_type ?? "numeric") === "numeric";

                        if (!isNumericKpi) {
                          return renderQuestionCard({
                            reactKey: kpi.kpi_id,
                            name: kpi.kpi_name,
                            description: kpi.description,
                            inputType: kpi.input_type as "text" | "boolean",
                            fieldKey: key,
                            val,
                            isFilled,
                            prev,
                            isEditable,
                          });
                        }

                        const currentNum = parseFloat(val);
                        const isAnomaly = isNumericKpi && isFilled && prev !== undefined && prev !== 0 &&
                          Math.abs(currentNum - prev) / Math.abs(prev) > 0.5;
                        const recordId = getRecordId(key);
                        const docOpen = docPanelOpen.has(key);

                        return (
                          <div key={kpi.kpi_id} className="border-t border-slate-100/70">
                            <div className="grid grid-cols-[1fr_70px_110px_180px_36px] gap-3 items-center px-5 py-1.5 bg-white hover:bg-slate-50/50">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-[13px] text-brand-navy font-medium truncate">{kpi.kpi_name}</span>
                                {isFilled && <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />}
                                {isAnomaly && (
                                  <span title="Value differs >50% from previous" className="text-amber-500 flex-shrink-0">
                                    <AlertTriangle size={12} />
                                  </span>
                                )}
                              </div>
                              <span className="text-[12px] text-slate-400 font-mono">{isNumericKpi ? kpi.unit : "—"}</span>
                              <div className="text-right">
                                {isNumericKpi && prev !== undefined
                                  ? <span className="font-mono text-[12px] tabular-nums text-[hsl(var(--muted-foreground))]">{prev.toLocaleString()}</span>
                                  : <span className="font-mono text-[12px] tabular-nums text-[hsl(var(--placeholder))]">—</span>}
                              </div>
                              <div className="relative">
                                {renderInputWidget(kpi.input_type, key, val, isEditable, isFilled, isAnomaly)}
                              </div>
                              <button
                                onClick={() => toggleDocPanel(key)}
                                title="Attach document"
                                className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all text-[11px] font-bold
                                  ${docOpen ? "bg-brand-accent/10 border-brand-accent/30 text-brand-accent" : "border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500"}`}
                              >
                                <Paperclip size={12} />
                              </button>
                            </div>
                            {docOpen && <DocPanel recordId={recordId} isEditable={isEditable} />}
                          </div>
                        );
                      })}
                      {modKpis.length === 0 && kpis.filter(k => k.is_emission_source).length === 0 && (
                        <div className="px-5 py-4 text-[12px] text-slate-400 text-center">
                          No emission KPIs found. Set up KPIs with emission sources in KPI Setup.
                        </div>
                      )}
                    </>
                  )}

                  {/* Normal modules: Indicators with KPIs */}
                  {!isEmissionsModule && modIndicators.map((ind: Indicator) => {
                    const indKpis = kpis.filter((k: KPI) => k.indicator_id === ind.indicator_id);
                    const isDirectEntry = indKpis.length === 0;
                    const isExp = expanded.has(ind.indicator_id);

                    if (isDirectEntry) {
                      const key = `ind_${ind.indicator_id}`;
                      const prev = prevValues[key];
                      const val = formValues[key] ?? "";
                      const isFilled = val !== "";
                      const isNumericInd = (ind.input_type ?? "numeric") === "numeric";
                      const currentNum = parseFloat(val);
                      const isAnomaly = isNumericInd && isFilled && prev !== undefined && prev !== 0 &&
                        Math.abs(currentNum - prev) / Math.abs(prev) > 0.5;
                      const recordId = getRecordId(key);
                      const docOpen = docPanelOpen.has(key);
                      const isWaste = isInputWithDisposal(mod.render_type);
                      const bdOpen = isWaste && isNumericInd && breakdownOpen.has(key);
                      const bdTotal = isWaste && isNumericInd ? getBreakdownTotal(key) : 0;
                      const totalQty = parseFloat(val) || 0;
                      const bdStatus = !isFilled || bdTotal === 0 ? "none"
                        : bdTotal === totalQty ? "full"
                        : bdTotal > totalQty ? "over"
                        : "partial";

                      // ── Question-card layout for text / boolean indicators ──────────────
                      if (!isNumericInd) {
                        return renderQuestionCard({
                          reactKey: ind.indicator_id,
                          name: ind.indicator_name,
                          description: ind.description,
                          inputType: ind.input_type as "text" | "boolean",
                          fieldKey: key,
                          val,
                          isFilled,
                          prev,
                          isEditable,
                        });
                      }

                      // ── Compact table row for numeric direct-entry indicators ────────────
                      return (
                        <div key={ind.indicator_id} className="border-b border-slate-100 last:border-b-0">
                          <div className={`grid gap-3 items-center px-5 py-1.5 bg-white hover:bg-slate-50/40 border-t border-slate-100/70 ${isWaste && isNumericInd ? "grid-cols-[1fr_70px_110px_180px_76px]" : "grid-cols-[1fr_70px_110px_180px_36px]"}`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[13px] text-brand-navy font-medium truncate">{ind.indicator_name}</span>
                              {isFilled && <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />}
                              {isAnomaly && (
                                <span title="Value differs >50% from previous" className="text-amber-500 flex-shrink-0">
                                  <AlertTriangle size={12} />
                                </span>
                              )}
                            </div>
                            <span className="text-[12px] text-slate-400 font-mono">{ind.unit || "—"}</span>
                            <div className="text-right">
                              {prev !== undefined
                                ? <span className="text-[13px] text-slate-400 font-mono">{prev.toLocaleString()}</span>
                                : <span className="text-[12px] text-slate-300">—</span>}
                            </div>
                            <div className="relative">
                              {renderInputWidget(ind.input_type, key, val, isEditable, isFilled, isAnomaly)}
                            </div>
                            <div className="flex gap-1">
                              {isWaste && (
                                <button
                                  onClick={() => toggleBreakdown(key)}
                                  title="Disposal breakdown"
                                  className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all text-[10px] font-bold
                                    ${bdStatus === "full"    ? "bg-emerald-50 border-emerald-300 text-emerald-600" :
                                      bdStatus === "over"    ? "bg-red-50 border-red-300 text-red-600" :
                                      bdStatus === "partial" ? "bg-amber-50 border-amber-300 text-amber-600" :
                                      bdOpen ? "bg-slate-100 border-slate-300 text-slate-600" :
                                      "border-slate-200 text-slate-400 hover:border-slate-300"}`}
                                >
                                  ♻
                                </button>
                              )}
                              <button
                                onClick={() => toggleDocPanel(key)}
                                title="Attach document"
                                className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all
                                  ${docOpen ? "bg-brand-accent/10 border-brand-accent/30 text-brand-accent" : "border-slate-200 text-slate-400 hover:border-slate-300"}`}
                              >
                                <Paperclip size={12} />
                              </button>
                            </div>
                          </div>
                          {docOpen && <DocPanel recordId={recordId} isEditable={isEditable} />}
                          {isWaste && bdOpen && (
                            <div className="px-5 py-3 bg-emerald-50/40 border-t border-emerald-100">
                              <div className="grid grid-cols-3 gap-2 mb-2">
                                {DISPOSAL_METHODS.map(({ key: method, label }) => (
                                  <div key={method} className="flex items-center gap-1.5">
                                    <label className="text-[11px] text-slate-500 w-[90px] flex-shrink-0">{label}</label>
                                    <input
                                      type="number" step="any" min="0"
                                      value={breakdownValues[key]?.[method] ?? ""}
                                      onChange={e => setBreakdownMethod(key, method, e.target.value)}
                                      disabled={!isEditable}
                                      placeholder="0"
                                      className={`w-full px-2 py-1.5 rounded border text-[12px] font-mono outline-none transition-all
                                        ${!isEditable ? "bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed" : "bg-white border-slate-200 text-brand-navy focus:border-emerald-400"}`}
                                    />
                                  </div>
                                ))}
                              </div>
                              <div className={`text-[11px] font-semibold ${bdStatus === "full" ? "text-emerald-600" : bdStatus === "over" ? "text-red-500" : "text-amber-600"}`}>
                                Allocated: {bdTotal.toLocaleString()} / {totalQty.toLocaleString()}
                                {bdStatus === "full" && " ✓"}
                                {bdStatus === "over" && " — exceeds total"}
                                {bdStatus === "partial" && " — partial"}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }

                    // Indicator with KPIs — collapsible
                    return (
                      <div key={ind.indicator_id} className="border-b border-slate-100 last:border-b-0">
                        {/* Indicator header */}
                        <button
                          onClick={() => toggleIndicator(ind.indicator_id)}
                          className="w-full flex items-center gap-2 px-5 py-2.5 bg-slate-50/40 hover:bg-slate-50 transition-colors text-left"
                        >
                          {isExp ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                          <span className="text-[13px] font-semibold text-brand-navy">{ind.indicator_name}</span>
                          <span className="text-[11px] text-slate-400 ml-auto">
                            {indKpis.filter(k => formValues[`kpi_${k.kpi_id}`] !== undefined && formValues[`kpi_${k.kpi_id}`] !== "").length}/{indKpis.length} KPI{indKpis.length !== 1 ? "s" : ""}
                          </span>
                        </button>

                        {/* KPI rows */}
                        {isExp && indKpis.map((kpi: KPI) => {
                          const key = `kpi_${kpi.kpi_id}`;
                          const prev = prevValues[key];
                          const val = formValues[key] ?? "";
                          const isFilled = val !== "";
                          const isNumericKpi = (kpi.input_type ?? "numeric") === "numeric";

                          if (!isNumericKpi) {
                            return renderQuestionCard({
                              reactKey: kpi.kpi_id,
                              name: kpi.kpi_name,
                              description: kpi.description,
                              inputType: kpi.input_type as "text" | "boolean",
                              fieldKey: key,
                              val,
                              isFilled,
                              prev,
                              isEditable,
                              indented: true,
                            });
                          }

                          const currentNum = parseFloat(val);
                          const isAnomaly = isNumericKpi && isFilled && prev !== undefined && prev !== 0 &&
                            Math.abs(currentNum - prev) / Math.abs(prev) > 0.5;
                          const recordId = getRecordId(key);
                          const docOpen = docPanelOpen.has(key);
                          const isWaste = isInputWithDisposal(mod.render_type);
                          const bdOpen = isWaste && isNumericKpi && breakdownOpen.has(kpi.kpi_id);
                          const bdTotal = isWaste && isNumericKpi ? getBreakdownTotal(kpi.kpi_id) : 0;
                          const totalQty = parseFloat(val) || 0;
                          const bdStatus = !isFilled || bdTotal === 0 ? "none"
                            : bdTotal === totalQty ? "full"
                            : bdTotal > totalQty ? "over"
                            : "partial";

                          return (
                            <div key={kpi.kpi_id} className="border-t border-slate-100/70">
                              <div className={`grid gap-3 items-center px-5 py-1.5 bg-white hover:bg-slate-50/50 transition-colors pl-10 ${isWaste && isNumericKpi ? "grid-cols-[1fr_70px_110px_180px_76px]" : "grid-cols-[1fr_70px_110px_180px_36px]"}`}>
                                {/* KPI name */}
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-[13px] text-brand-navy font-medium truncate">{kpi.kpi_name}</span>
                                  {isFilled && <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />}
                                  {isAnomaly && (
                                    <span title="Value differs >50% from previous" className="text-amber-500 flex-shrink-0">
                                      <AlertTriangle size={12} />
                                    </span>
                                  )}
                                </div>
                                {/* Unit */}
                                <span className="text-[12px] text-slate-400 font-mono">{isNumericKpi ? kpi.unit : ""}</span>
                                {/* Previous */}
                                <div className="text-right">
                                  {isNumericKpi && prev !== undefined
                                    ? <span className="text-[13px] text-slate-400 font-mono">{prev.toLocaleString()}</span>
                                    : <span className="text-[12px] text-slate-300">—</span>}
                                </div>
                                {/* Input */}
                                <div className="relative">
                                  {renderInputWidget(kpi.input_type, key, val, isEditable, isFilled, isAnomaly)}
                                </div>
                                {/* Action buttons */}
                                <div className="flex gap-1">
                                  {isWaste && isNumericKpi && (
                                    <button
                                      onClick={() => toggleBreakdown(kpi.kpi_id)}
                                      title="Disposal breakdown"
                                      className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all text-[10px] font-bold
                                        ${bdStatus === "full"    ? "bg-emerald-50 border-emerald-300 text-emerald-600" :
                                          bdStatus === "over"    ? "bg-red-50 border-red-300 text-red-600" :
                                          bdStatus === "partial" ? "bg-amber-50 border-amber-300 text-amber-600" :
                                          bdOpen ? "bg-slate-100 border-slate-300 text-slate-600" :
                                          "border-slate-200 text-slate-400 hover:border-slate-300"}`}
                                    >
                                      ♻
                                    </button>
                                  )}
                                  <button
                                    onClick={() => toggleDocPanel(key)}
                                    title="Attach document"
                                    className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all
                                      ${docOpen ? "bg-brand-accent/10 border-brand-accent/30 text-brand-accent" : "border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-500"}`}
                                  >
                                    <Paperclip size={12} />
                                  </button>
                                </div>
                              </div>
                              {docOpen && <DocPanel recordId={recordId} isEditable={isEditable} />}
                              {/* Waste disposal breakdown panel */}
                              {isWaste && bdOpen && (
                                <div className="px-10 py-3 bg-emerald-50/40 border-t border-emerald-100">
                                  <div className="grid grid-cols-3 gap-2 mb-2">
                                    {DISPOSAL_METHODS.map(({ key: method, label }) => (
                                      <div key={method} className="flex items-center gap-1.5">
                                        <label className="text-[11px] text-slate-500 w-[90px] flex-shrink-0">{label}</label>
                                        <input
                                          type="number" step="any" min="0"
                                          value={breakdownValues[kpi.kpi_id]?.[method] ?? ""}
                                          onChange={e => setBreakdownMethod(kpi.kpi_id, method, e.target.value)}
                                          disabled={!isEditable}
                                          placeholder="0"
                                          className={`w-full px-2 py-1.5 rounded border text-[12px] font-mono outline-none transition-all
                                            ${!isEditable ? "bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed" : "bg-white border-slate-200 text-brand-navy focus:border-emerald-400"}`}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                  <div className={`text-[11px] font-semibold ${bdStatus === "full" ? "text-emerald-600" : bdStatus === "over" ? "text-red-500" : "text-amber-600"}`}>
                                    Allocated: {bdTotal.toLocaleString()} / {totalQty.toLocaleString()} {kpi.unit}
                                    {bdStatus === "full" && " ✓"}
                                    {bdStatus === "over" && " — exceeds total"}
                                    {bdStatus === "partial" && " — partial"}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}

                  {/* KPIs without indicators (non-emissions modules) */}
                  {!isEmissionsModule && modKpis.filter((k: KPI) => !k.indicator_id).map((kpi: KPI) => {
                    const key = `kpi_${kpi.kpi_id}`;
                    const prev = prevValues[key];
                    const val = formValues[key] ?? "";
                    const isFilled = val !== "";
                    const isNumericKpi = (kpi.input_type ?? "numeric") === "numeric";

                    if (!isNumericKpi) {
                      return renderQuestionCard({
                        reactKey: kpi.kpi_id,
                        name: kpi.kpi_name,
                        description: kpi.description,
                        inputType: kpi.input_type as "text" | "boolean",
                        fieldKey: key,
                        val,
                        isFilled,
                        prev,
                        isEditable,
                      });
                    }

                    const currentNum = parseFloat(val);
                    const isAnomaly = isNumericKpi && isFilled && prev !== undefined && prev !== 0 &&
                      Math.abs(currentNum - prev) / Math.abs(prev) > 0.5;
                    const recordId = getRecordId(key);
                    const docOpen = docPanelOpen.has(key);
                    const isWaste = isInputWithDisposal(mod.render_type);
                    const bdOpen = isWaste && isNumericKpi && breakdownOpen.has(kpi.kpi_id);
                    const bdTotal = isWaste && isNumericKpi ? getBreakdownTotal(kpi.kpi_id) : 0;
                    const totalQty = parseFloat(val) || 0;
                    const bdStatus = !isFilled || bdTotal === 0 ? "none"
                      : bdTotal === totalQty ? "full"
                      : bdTotal > totalQty ? "over"
                      : "partial";

                    return (
                      <div key={kpi.kpi_id} className="border-t border-slate-100/70">
                        <div className={`grid gap-3 items-center px-5 py-1.5 bg-white hover:bg-slate-50/50 ${isWaste && isNumericKpi ? "grid-cols-[1fr_70px_110px_180px_76px]" : "grid-cols-[1fr_70px_110px_180px_36px]"}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[13px] text-brand-navy font-medium truncate">{kpi.kpi_name}</span>
                            {isFilled && <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />}
                            {isAnomaly && (
                              <span title="Value differs >50% from previous" className="text-amber-500 flex-shrink-0">
                                <AlertTriangle size={12} />
                              </span>
                            )}
                          </div>
                          <span className="text-[12px] text-slate-400 font-mono">{isNumericKpi ? kpi.unit : ""}</span>
                          <div className="text-right">
                            {isNumericKpi && prev !== undefined
                              ? <span className="text-[13px] text-slate-400 font-mono">{prev.toLocaleString()}</span>
                              : <span className="text-[12px] text-slate-300">—</span>}
                          </div>
                          {renderInputWidget(kpi.input_type, key, val, isEditable, isFilled, isAnomaly)}
                          <div className="flex gap-1">
                            {isWaste && isNumericKpi && (
                              <button
                                onClick={() => toggleBreakdown(kpi.kpi_id)}
                                title="Disposal breakdown"
                                className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all text-[10px] font-bold
                                  ${bdStatus === "full"    ? "bg-emerald-50 border-emerald-300 text-emerald-600" :
                                    bdStatus === "over"    ? "bg-red-50 border-red-300 text-red-600" :
                                    bdStatus === "partial" ? "bg-amber-50 border-amber-300 text-amber-600" :
                                    bdOpen ? "bg-slate-100 border-slate-300 text-slate-600" :
                                    "border-slate-200 text-slate-400 hover:border-slate-300"}`}
                              >
                                ♻
                              </button>
                            )}
                            <button
                              onClick={() => toggleDocPanel(key)}
                              title="Attach document"
                              className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all
                                ${docOpen ? "bg-brand-accent/10 border-brand-accent/30 text-brand-accent" : "border-slate-200 text-slate-400 hover:border-slate-300"}`}
                            >
                              <Paperclip size={12} />
                            </button>
                          </div>
                        </div>
                        {docOpen && <DocPanel recordId={recordId} isEditable={isEditable} />}
                        {/* Waste disposal breakdown panel */}
                        {isWaste && bdOpen && (
                          <div className="px-5 py-3 bg-emerald-50/40 border-t border-emerald-100">
                            <div className="grid grid-cols-3 gap-2 mb-2">
                              {DISPOSAL_METHODS.map(({ key: method, label }) => (
                                <div key={method} className="flex items-center gap-1.5">
                                  <label className="text-[11px] text-slate-500 w-[90px] flex-shrink-0">{label}</label>
                                  <input
                                    type="number" step="any" min="0"
                                    value={breakdownValues[kpi.kpi_id]?.[method] ?? ""}
                                    onChange={e => setBreakdownMethod(kpi.kpi_id, method, e.target.value)}
                                    disabled={!isEditable}
                                    placeholder="0"
                                    className={`w-full px-2 py-1.5 rounded border text-[12px] font-mono outline-none transition-all
                                      ${!isEditable ? "bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed" : "bg-white border-slate-200 text-brand-navy focus:border-emerald-400"}`}
                                  />
                                </div>
                              ))}
                            </div>
                            <div className={`text-[11px] font-semibold ${bdStatus === "full" ? "text-emerald-600" : bdStatus === "over" ? "text-red-500" : "text-amber-600"}`}>
                              Allocated: {bdTotal.toLocaleString()} / {totalQty.toLocaleString()} {kpi.unit}
                              {bdStatus === "full" && " ✓"}
                              {bdStatus === "over" && " — exceeds total"}
                              {bdStatus === "partial" && " — partial"}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* ── Submission-level Supporting Documents ── */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
                <div className="flex items-center gap-2">
                  <Paperclip size={15} className="text-slate-400" />
                  <span className="text-[13px] font-bold text-brand-navy">Supporting Documents</span>
                  <span className="text-[11px] text-slate-400">{documents.length} file{documents.length !== 1 ? "s" : ""} — submission level</span>
                </div>
                {isEditable && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-accent text-white text-[12px] font-semibold hover:bg-brand-accentDk transition-colors disabled:opacity-50"
                  >
                    <Upload size={13} /> {uploading ? "Uploading…" : "Upload File"}
                  </button>
                )}
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
              </div>
              {documents.length === 0 ? (
                <div className="px-5 py-6 text-center text-[12px] text-slate-400">
                  No submission-level documents. Upload general supporting evidence here. Use the 📎 icon on each KPI row to attach KPI-specific files.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {documents.map((doc: any) => (
                    <div key={doc.document_id} className="flex items-center gap-3 px-5 py-3">
                      <FileText size={14} className="text-slate-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <button onClick={() => handleDownloadDoc(doc.document_id, doc.file_name)} className="text-[13px] font-medium text-brand-accent hover:underline truncate block text-left">
                          {doc.file_name}
                        </button>
                        <span className="text-[11px] text-slate-400">
                          {doc.file_size_bytes ? `${(doc.file_size_bytes / 1024).toFixed(1)} KB · ` : ""}
                          {formatDate(doc.uploaded_at)}
                        </span>
                      </div>
                      {isEditable && (
                        <button onClick={() => handleDeleteDoc(doc.document_id)} className="p-1.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          )}

        </div>
      )}

      {/* ── Bottom action bar — always visible at bottom of page (hidden when a bespoke feature is active) ── */}
      {canEdit && periodSelected && !loading && !(typeof activeModule === "string" && activeModule.startsWith("feat:")) && (
        <div className="flex-shrink-0 bg-white border-t border-slate-200 px-6 py-3.5 flex items-center justify-between shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
          {/* Progress */}
          <div className="flex items-center gap-3">
            <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-accent rounded-full transition-all duration-500"
                style={{ width: `${totalKpiCount > 0 ? (filledCount / totalKpiCount) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[12px] text-slate-400">
              <span className="font-semibold text-brand-navy">{filledCount}</span> / {totalKpiCount} filled
            </span>
            {anomalies.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm font-sans text-[11px] font-semibold bg-[hsl(var(--warn-tint))] text-[hsl(var(--warn))]">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--warn))]" />
                {anomalies.length} anomal{anomalies.length === 1 ? "y" : "ies"}
              </span>
            )}
          </div>
          {/* Buttons / status */}
          <div className="flex items-center gap-3">
            {isEditable && (
              <>
                <button
                  onClick={handleManualSave}
                  disabled={saveStatus === "saving"}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-[var(--radius)] border border-[hsl(var(--border))] text-[13px] font-semibold text-[hsl(var(--foreground))] bg-white hover:bg-[hsl(var(--surface-sunken))] transition-colors disabled:opacity-50"
                >
                  <Save size={15} /> Save Draft
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || filledCount === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-[var(--radius)] bg-[hsl(var(--primary))] text-white text-[13px] font-semibold hover:bg-[hsl(240_53%_40%)] transition-colors disabled:opacity-50"
                >
                  <Send size={15} /> {submitting ? "Submitting…" : "Submit for Review"}
                </button>
              </>
            )}
            {!isEditable && submission && (
              <span className="text-[12px] text-slate-400 italic">
                {submission.status === "SUBMITTED" ? "Pending review — editing locked" :
                 submission.status === "APPROVED" ? "Approved — read only" : ""}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
