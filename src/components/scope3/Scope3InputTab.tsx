/**
 * Scope3InputTab — Scope 3 data entry for ESGInputPage.
 *
 * GHG Protocol aligned redesign:
 *  - ONE batch per GHG category + reporting period (not one per entry type)
 *  - Calculation method is selected PER ROW (not per batch)
 *  - Unified table handles all four methods: Supplier-specific, Average-data,
 *    Spend-based, Direct estimate
 *  - All 15 GHG Protocol categories use the same form layout
 *  - Batch-level + row-level supporting document upload
 */
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Package2, Plus, Save, Send, Info, Download,
  Paperclip, FileText, Trash2, Upload, HelpCircle, Sliders,
} from "lucide-react";
import { tenantApi } from "@/api/client";
import { getApiError } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import Scope3EntryForm, { EntryTableHeaders, type LocalEntry, CALC_METHODS } from "./Scope3EntryForm";
import Scope3CSVImport from "./Scope3CSVImport";
import type {
  Month, Location, Supplier,
  Scope3GHGCategory, Scope3Assignment, Scope3Batch,
  Scope3Entry, Scope3FactorItem, Scope3CalcMethod,
} from "@/types";

/* ── Props ─────────────────────────────────────────────────────────────────── */

interface Props {
  selYear: number;
  selMonth: number | "";
  months: Month[];
  isLocked: boolean;
  canEdit: boolean;
}

/* ── Helpers ───────────────────────────────────────────────────────────────── */

let _keySeq = 0;
const nextKey = () => `new_${++_keySeq}`;

/** Parse allowed methods from assignment.entry_type (comma-separated) */
function parseAllowedMethods(entryType: string | undefined): Scope3CalcMethod[] {
  if (!entryType) return ["SUPPLIER_SPECIFIC", "AVERAGE_DATA", "SPEND_BASED", "DIRECT_ESTIMATE"];
  const all: Scope3CalcMethod[] = ["SUPPLIER_SPECIFIC", "AVERAGE_DATA", "SPEND_BASED", "DIRECT_ESTIMATE"];
  const parts = entryType.split(",").map((s) => s.trim()).filter(Boolean);
  // Filter to only valid method values
  return parts.filter((p): p is Scope3CalcMethod => all.includes(p as Scope3CalcMethod));
}

function serverEntryToLocal(e: Scope3Entry): LocalEntry {
  return {
    _key:                e.entry_id,
    entry_id:            e.entry_id,
    calculation_method:  e.calculation_method || "AVERAGE_DATA",
    activity_label:      e.activity_label,
    supplier_id:         e.supplier_id,
    supplier_name:       e.supplier_name,
    quantity:            e.quantity ?? "",
    quantity_unit:       e.quantity_unit,
    manual_emission_factor: e.manual_emission_factor ?? "",
    manual_ef_unit:      e.manual_ef_unit || "kgCO2e",
    factor_item_id:      e.factor_item_id,
    amount:              e.amount ?? "",
    currency_code:       e.currency_code,
    source_reference:    e.source_reference ?? e.methodology,
    emission_value:      e.emission_value ?? "",
    notes:               e.notes,
    validation_status:   e.validation_status,
    error_message:       e.error_message,
    // Phase 2: category-specific fields
    computation_mode:    (e as any).computation_mode || "SIMPLE",
    data_source:         (e as any).data_source,
    assumptions:         (e as any).assumptions,
    distance_km:         (e as any).distance_km ?? "",
    mass_tonnes:         (e as any).mass_tonnes ?? "",
    transport_mode:      (e as any).transport_mode,
    vehicle_type:        (e as any).vehicle_type,
    hotel_nights:        (e as any).hotel_nights ?? "",
    num_passengers:      (e as any).num_passengers ?? "",
    num_employees:       (e as any).num_employees ?? "",
    pct_mode:            (e as any).pct_mode ?? "",
    working_days:        (e as any).working_days ?? "",
    floor_area_m2:       (e as any).floor_area_m2 ?? "",
    total_area_m2:       (e as any).total_area_m2 ?? "",
    refrigerant_kg:      (e as any).refrigerant_kg ?? "",
    refrigerant_gwp:     (e as any).refrigerant_gwp ?? "",
    units_sold:          (e as any).units_sold ?? "",
    lifetime_uses:       (e as any).lifetime_uses ?? "",
    energy_per_use:      (e as any).energy_per_use ?? "",
    equity_share_pct:    (e as any).equity_share_pct ?? "",
    investee_revenue:    (e as any).investee_revenue ?? "",
    waste_method:        (e as any).waste_method,
    waste_type:          (e as any).waste_type,
    parent_entry_id:     (e as any).parent_entry_id,
    component_type:      (e as any).component_type,
  };
}

function emptyRow(defaultMethod: Scope3CalcMethod): LocalEntry {
  return {
    _key: nextKey(),
    calculation_method: defaultMethod,
    currency_code: "INR",
    manual_ef_unit: "kgCO2e",
    validation_status: "VALID",
  };
}

type CatFilter = "all" | "upstream" | "downstream";

/* ── Batch-level document panel ──────────────────────────────────────────────── */

function BatchDocPanel({ batchId, readOnly }: { batchId: string; readOnly: boolean }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    tenantApi.listScope3BatchDocuments(batchId)
      .then((r) => setDocs(r.data || []))
      .catch(() => {});
  }, [batchId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await tenantApi.uploadScope3BatchDocument(batchId, file);
      setDocs((prev) => [res.data, ...prev]);
      toast.success("Document uploaded");
    } catch (err: any) {
      toast.error(getApiError(err, "Upload failed"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      await tenantApi.deleteDocument(docId);
      setDocs((prev) => prev.filter((d) => d.document_id !== docId));
      toast.success("Removed");
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to remove"));
    }
  };

  const handleDownload = async (docId: string, fileName: string) => {
    try {
      const res = await tenantApi.downloadDocument(docId);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error("Download failed"); }
  };

  return (
    <div className="mt-4 border border-border rounded-lg overflow-hidden bg-card">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[hsl(var(--border-hairline))] bg-sunken/60">
        <div className="flex items-center gap-2">
          <Paperclip size={13} className="text-muted-foreground" />
          <span className="text-[12px] font-bold text-foreground">Supporting Documents</span>
          <span className="text-[11px] text-muted-foreground">
            {docs.length} file{docs.length !== 1 ? "s" : ""} — batch level
          </span>
        </div>
        {!readOnly && (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 text-[11px] text-accent-foreground hover:text-accent-foreground font-medium"
          >
            <Upload size={12} />
            {uploading ? "Uploading..." : "Upload"}
          </button>
        )}
        <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
      </div>
      {docs.length === 0 ? (
        <div className="px-5 py-4 text-center text-[12px] text-muted-foreground">
          No documents. Upload invoices, reports, or LCA studies here.
        </div>
      ) : (
        <div className="divide-y divide-border/60">
          {docs.map((doc: any) => (
            <div key={doc.document_id} className="flex items-center gap-3 px-4 py-2.5">
              <FileText size={13} className="text-muted-foreground flex-shrink-0" />
              <button
                onClick={() => handleDownload(doc.document_id, doc.file_name)}
                className="flex-1 text-[12px] font-medium text-primary hover:underline truncate text-left"
              >
                {doc.file_name}
              </button>
              {doc.file_size_bytes && (
                <span className="text-[10px] text-muted-foreground">
                  {(doc.file_size_bytes / 1024).toFixed(1)} KB
                </span>
              )}
              {!readOnly && (
                <button
                  onClick={() => handleDelete(doc.document_id)}
                  className="p-1 rounded hover:bg-destructive-tint text-muted-foreground/40 hover:text-destructive transition-colors"
                >
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

/* ── Method legend tooltip ───────────────────────────────────────────────────── */

function MethodLegend({ allowedMethods }: { allowedMethods: Scope3CalcMethod[] }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setShow((s) => !s)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-muted-foreground"
      >
        <HelpCircle size={12} />
        Method guide
      </button>
      {show && (
        <div className="absolute right-0 top-6 z-20 w-72 bg-card border border-border rounded-lg shadow-lg p-3">
          <p className="text-[11px] font-bold text-foreground mb-2">GHG Protocol Calculation Methods</p>
          <div className="space-y-2">
            {CALC_METHODS.filter((m) => allowedMethods.includes(m.value)).map((m) => (
              <div key={m.value}>
                <p className="text-[11px] font-semibold text-foreground/90">{m.label}</p>
                <p className="text-[11px] text-muted-foreground">{m.hint}</p>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShow(false)}
            className="mt-2 text-[10px] text-muted-foreground hover:text-muted-foreground"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════ */

export default function Scope3InputTab({ selYear, selMonth, months, isLocked, canEdit }: Props) {
  /* ── Metadata ── */
  const [categories, setCategories]   = useState<Scope3GHGCategory[]>([]);
  const [assignments, setAssignments] = useState<Scope3Assignment[]>([]);
  const [suppliers, setSuppliers]     = useState<Supplier[]>([]);
  const [catFilter, setCatFilter]     = useState<CatFilter>("all");
  const [activeCatId, setActiveCatId] = useState<number | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);

  /* ── Batch + entries ── */
  const [batch, setBatch]           = useState<Scope3Batch | null>(null);
  const [localRows, setLocalRows]   = useState<LocalEntry[]>([]);
  const [factorItems, setFactorItems] = useState<Scope3FactorItem[]>([]);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dirty, setDirty]           = useState(false);

  /* ── Per-entry doc panels ── */
  const [docPanelOpen, setDocPanelOpen] = useState<Set<string>>(new Set());
  const toggleDocPanel = (key: string) =>
    setDocPanelOpen((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  /* ── Per-entry category detail panels ── */
  const [catPanelOpen, setCatPanelOpen] = useState<Set<string>>(new Set());
  const toggleCatPanel = (key: string) =>
    setCatPanelOpen((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  /* ── Derived ── */
  const calendarMonth = selMonth !== ""
    ? months.find((m) => m.month_id === selMonth)?.calendar_month ?? null
    : null;

  const activeAssignment = assignments.find(
    (a) => a.ghg_category_id === activeCatId && a.is_active
  );

  const allowedMethods = parseAllowedMethods(activeAssignment?.entry_type);

  const readOnly = !canEdit || isLocked ||
    !!(batch && batch.status !== "DRAFT" && batch.status !== "REJECTED");

  /* ── Filter visible categories ── */
  const assignedCatIds = new Set(
    assignments.filter((a) => a.is_active).map((a) => a.ghg_category_id)
  );
  const visibleCategories = categories
    .filter((c) => assignedCatIds.has(c.category_id))
    .filter((c) => catFilter === "all" || c.scope3_type === catFilter);

  /* ── Load categories + assignments + suppliers ── */
  useEffect(() => {
    let cancelled = false;
    setLoadingMeta(true);
    Promise.all([
      tenantApi.listScope3Categories(),
      tenantApi.listScope3Assignments(),
    ]).then(([catRes, asnRes]) => {
      if (cancelled) return;
      setCategories(catRes.data || []);
      setAssignments(asnRes.data || []);
      setLoadingMeta(false);
    }).catch(() => { if (!cancelled) setLoadingMeta(false); });
    return () => { cancelled = true; };
  }, [selYear]);

  useEffect(() => {
    let cancelled = false;
    tenantApi.listSuppliers()
      .then((r) => { if (!cancelled) setSuppliers(r.data || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  /* ── Auto-select first visible category ── */
  useEffect(() => {
    if (
      visibleCategories.length > 0 &&
      !visibleCategories.find((c) => c.category_id === activeCatId)
    ) {
      setActiveCatId(visibleCategories[0].category_id);
    }
  }, [visibleCategories, activeCatId]);

  /* ── Load batch when category or period changes ── */
  const loadBatch = useCallback(async () => {
    if (!activeCatId || selMonth === "" || calendarMonth === null) return;

    setLoadingBatch(true);
    setBatch(null);
    setLocalRows([]);
    setDirty(false);
    setDocPanelOpen(new Set());

    try {
      const batchRes = await tenantApi.getOrCreateScope3Batch({
        ghg_category_id: activeCatId,
        reporting_year: selYear,
        reporting_month: calendarMonth,
        factor_set_id: activeAssignment?.factor_set_id || undefined,
        location_id: activeAssignment?.location_id || undefined,
      });
      const b = batchRes.data as Scope3Batch;
      setBatch(b);

      if (b.total_rows > 0) {
        const entryRes = await tenantApi.listScope3Entries(b.batch_id, { size: 500 });
        setLocalRows((entryRes.data.items || []).map(serverEntryToLocal));
      }

      if (b.factor_set_id) {
        const fiRes = await tenantApi.listScope3FactorItems(b.factor_set_id, {
          ghg_category_id: activeCatId,
        });
        setFactorItems(fiRes.data || []);
      } else {
        setFactorItems([]);
      }
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to load Scope 3 batch"));
    } finally {
      setLoadingBatch(false);
    }
  }, [activeCatId, selYear, calendarMonth, activeAssignment]);

  useEffect(() => { loadBatch(); }, [loadBatch]);

  /* ── Row operations ── */
  const handleRowChange = (key: string, field: string, value: any) => {
    setLocalRows((prev) => prev.map((r) => (r._key === key ? { ...r, [field]: value } : r)));
    setDirty(true);
  };

  const handleRowDelete = (key: string) => {
    const row = localRows.find((r) => r._key === key);
    if (row?.entry_id && batch) {
      tenantApi.deleteScope3Entry(batch.batch_id, row.entry_id).catch((err: any) => {
        toast.error(getApiError(err, "Failed to delete entry"));
      });
    }
    setLocalRows((prev) => prev.filter((r) => r._key !== key));
    setDirty(true);
  };

  const handleAddRow = () => {
    // Default new rows to the first allowed method
    const defaultMethod = allowedMethods[0] || "AVERAGE_DATA";
    setLocalRows((prev) => [...prev, emptyRow(defaultMethod)]);
    setDirty(true);
  };

  /** Phase 3B: Add a child sub-component under a Hybrid parent row. */
  const handleAddHybridChild = (parentKey: string) => {
    const parent = localRows.find((r) => r._key === parentKey);
    if (!parent) return;
    const defaultMethod = allowedMethods[0] || "AVERAGE_DATA";
    const child: LocalEntry = {
      ...emptyRow(defaultMethod),
      parent_key: parentKey,
      parent_entry_id: parent.entry_id,  // set only when parent is already saved
      component_type: "material",
    };
    // Insert directly after the parent (or after its existing children)
    setLocalRows((prev) => {
      const idx = prev.findIndex((r) => r._key === parentKey);
      if (idx < 0) return [...prev, child];
      // Find insertion point: after parent and any existing siblings of this parent
      let insertAt = idx + 1;
      while (
        insertAt < prev.length &&
        (prev[insertAt].parent_key === parentKey || prev[insertAt].parent_entry_id === parent.entry_id)
      ) insertAt++;
      return [...prev.slice(0, insertAt), child, ...prev.slice(insertAt)];
    });
    setDirty(true);
  };

  /* ── Save (bulk upsert) ── */
  const handleSave = async () => {
    if (!batch) return;
    setSaving(true);
    try {
      const payload = localRows.map((r) => {
        const e: Record<string, unknown> = {
          calculation_method: r.calculation_method,
          activity_label: r.activity_label || null,
          supplier_id: r.supplier_id || null,
          supplier_name: r.supplier_name || null,
          notes: r.notes || null,
        };
        if (r.entry_id) e.entry_id = r.entry_id;

        if (r.calculation_method === "SUPPLIER_SPECIFIC") {
          e.quantity               = r.quantity === "" ? null : r.quantity;
          e.quantity_unit          = r.quantity_unit || null;
          e.manual_emission_factor = r.manual_emission_factor === "" ? null : r.manual_emission_factor;
          e.manual_ef_unit         = r.manual_ef_unit || "kgCO2e";

        } else if (r.calculation_method === "AVERAGE_DATA") {
          e.quantity       = r.quantity === "" ? null : r.quantity;
          e.quantity_unit  = r.quantity_unit || null;
          e.factor_item_id = r.factor_item_id || null;

        } else if (r.calculation_method === "SPEND_BASED") {
          e.amount         = r.amount === "" ? null : r.amount;
          e.currency_code  = r.currency_code || "INR";
          e.factor_item_id = r.factor_item_id || null;

        } else {
          // DIRECT_ESTIMATE
          e.source_reference = r.source_reference || null;
          e.emission_value   = r.emission_value === "" ? null : r.emission_value;
        }

        // Phase 2: category-specific fields (Appendix D)
        const catFields = [
          "computation_mode", "data_source", "assumptions",
          "distance_km", "mass_tonnes", "transport_mode", "vehicle_type",
          "hotel_nights", "num_passengers",
          "num_employees", "pct_mode", "working_days",
          "floor_area_m2", "total_area_m2", "refrigerant_kg", "refrigerant_gwp",
          "units_sold", "lifetime_uses", "energy_per_use",
          "equity_share_pct", "investee_revenue",
          "waste_method", "waste_type",
          "component_type",
        ] as const;
        for (const f of catFields) {
          const v = (r as any)[f];
          if (v !== undefined) e[f] = v === "" ? null : v;
        }

        // Hybrid parent/child wiring
        e.tmp_key = r._key;
        if (r.parent_entry_id) {
          e.parent_entry_id = r.parent_entry_id;
        } else if (r.parent_key) {
          e.parent_tmp_key = r.parent_key;
        }

        return e;
      });

      const res = await tenantApi.bulkUpsertScope3Entries(batch.batch_id, payload);
      setBatch(res.data as Scope3Batch);
      const entryRes = await tenantApi.listScope3Entries(batch.batch_id, { size: 500 });
      setLocalRows((entryRes.data.items || []).map(serverEntryToLocal));
      setDirty(false);
      toast.success("Scope 3 draft saved");
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to save"));
    } finally {
      setSaving(false);
    }
  };

  /* ── Category 3 auto-compute from Scope 1/2 approved data ── */
  const [autoComputing, setAutoComputing] = useState(false);
  const handleAutoComputeC3 = async () => {
    if (!batch || batch.ghg_category_id !== 3) return;
    if (dirty) {
      toast.info("Save draft before auto-computing");
      return;
    }
    if (!window.confirm(
      "Auto-compute will replace any existing auto-generated rows in this batch with aggregated data from approved Scope 1/2 entries. Manually entered rows are preserved. Continue?"
    )) return;
    setAutoComputing(true);
    try {
      const res = await tenantApi.autoComputeC3(batch.batch_id, true);
      setBatch(res.data as Scope3Batch);
      const entryRes = await tenantApi.listScope3Entries(batch.batch_id, { size: 500 });
      setLocalRows((entryRes.data.items || []).map(serverEntryToLocal));
      toast.success("Auto-computed Category 3 entries from approved Scope 1/2 data");
    } catch (err: any) {
      toast.error(getApiError(err, "Auto-compute failed"));
    } finally {
      setAutoComputing(false);
    }
  };

  /* ── Submit for review ── */
  const handleSubmit = async () => {
    if (!batch) return;
    setSubmitting(true);
    try {
      if (dirty) await handleSave();
      await tenantApi.submitScope3Batch(batch.batch_id);
      setBatch((prev) => prev ? { ...prev, status: "SUBMITTED" } : prev);
      toast.success("Submitted for review");
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to submit"));
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Totals ── */
  const totalEmissions = localRows.reduce((sum, r) => {
    const v = typeof r.emission_value === "number" ? r.emission_value : 0;
    return sum + v;
  }, 0);

  /* ── Template download ── */
  const handleDownloadTemplate = async () => {
    try {
      const params = batch?.factor_set_id
        ? { factor_set_id: batch.factor_set_id, ghg_category_id: activeCatId ?? undefined }
        : undefined;
      const res = await tenantApi.downloadScope3Template(params);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = "scope3_unified_template.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to download template"));
    }
  };

  /* ═══ Render ══════════════════════════════════════════════════════════════ */

  if (loadingMeta) {
    return (
      <div className="p-8 text-center text-[13px] text-muted-foreground animate-pulse">
        Loading Scope 3 categories...
      </div>
    );
  }

  if (assignedCatIds.size === 0) {
    return (
      <div className="p-8 text-center">
        <Package2 size={32} className="mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-[13px] text-muted-foreground">No Scope 3 categories assigned yet.</p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Company Admin can assign categories in Scope 3 Setup.
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 max-w-[1400px]">
      {/* ── Filter + Sub-tabs row ──────────────────────────────────────── */}
      <div className="mb-4">
        {/* Upstream / Downstream filter pills */}
        <div className="flex items-center gap-2 mb-2">
          {(["all", "upstream", "downstream"] as CatFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setCatFilter(f)}
              className={`px-3 py-1 text-[11px] font-semibold rounded-full transition-colors ${
                catFilter === f
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-muted-foreground hover:bg-sunken"
              }`}
            >
              {f === "all" ? "All" : f === "upstream" ? "Upstream (C1–C8)" : "Downstream (C9–C15)"}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-muted-foreground flex items-center gap-1">
            <Info size={11} /> Company-level
          </span>
        </div>

        {/* Category sub-tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {visibleCategories.map((cat) => (
            <button
              key={cat.category_id}
              onClick={() => setActiveCatId(cat.category_id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all whitespace-nowrap ${
                activeCatId === cat.category_id
                  ? "bg-violet-600 text-white"
                  : "text-muted-foreground hover:bg-sunken hover:text-foreground/90"
              }`}
            >
              {cat.code}: {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* ── Batch content area ──────────────────────────────────────────── */}
      {!activeCatId ? (
        <div className="text-[13px] text-muted-foreground text-center py-8">Select a category above</div>
      ) : selMonth === "" ? (
        <div className="text-[13px] text-muted-foreground text-center py-8">
          Select a month to enter Scope 3 data
        </div>
      ) : loadingBatch ? (
        <div className="text-[13px] text-muted-foreground text-center py-8 animate-pulse">
          Loading batch...
        </div>
      ) : (
        <>
          {/* Batch info bar */}
          {batch && (
            <div className="flex items-center gap-3 mb-3 text-[12px]">
              <StatusBadge status={batch.status} />
              {batch.factor_set_name && (
                <span className="text-muted-foreground">
                  Factor set: <span className="font-semibold text-foreground">{batch.factor_set_name}</span>
                </span>
              )}
              {isLocked && (
                <span className="text-warn font-semibold">Period locked</span>
              )}
              {batch.status === "REJECTED" && batch.rejection_reason && (
                <span className="text-destructive text-[11px]">
                  Rejected: {batch.rejection_reason}
                </span>
              )}
              <div className="ml-auto">
                <MethodLegend allowedMethods={allowedMethods} />
              </div>
            </div>
          )}

          {/* Mini-spreadsheet */}
          <div className="border border-border rounded-lg overflow-hidden bg-card">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-sunken border-b border-border">
                  <EntryTableHeaders allowedMethods={allowedMethods} />
                </thead>
                <tbody>
                  {localRows.map((row) => (
                    <Scope3EntryForm
                      key={row._key}
                      entry={row}
                      allowedMethods={allowedMethods}
                      factorItems={factorItems}
                      suppliers={suppliers}
                      ghgCategoryId={activeCatId ?? undefined}
                      readOnly={readOnly}
                      docOpen={docPanelOpen.has(row._key)}
                      catOpen={catPanelOpen.has(row._key)}
                      isChild={!!(row.parent_key || row.parent_entry_id)}
                      onToggleDoc={() => toggleDocPanel(row._key)}
                      onToggleCat={() => toggleCatPanel(row._key)}
                      onChange={handleRowChange}
                      onDelete={handleRowDelete}
                      onAddHybridChild={handleAddHybridChild}
                    />
                  ))}
                  {localRows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-[12px] text-muted-foreground">
                        No entries yet.{" "}
                        {!readOnly && 'Click "Add Row" to enter data or use "Import CSV".'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {!readOnly && (
              <div className="border-t border-[hsl(var(--border-hairline))] px-3 py-2">
                <button
                  onClick={handleAddRow}
                  className="flex items-center gap-1.5 text-[12px] text-accent-foreground hover:text-accent-foreground font-medium"
                >
                  <Plus size={13} /> Add Row
                </button>
              </div>
            )}
          </div>

          {/* Totals footer */}
          <div className="flex items-center justify-between mt-3 text-[12px]">
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">
                Rows: <span className="font-semibold text-foreground">{localRows.length}</span>
              </span>
              <span className="text-muted-foreground">
                Total: <span className="font-semibold text-foreground">{totalEmissions.toFixed(4)} tCO₂e</span>
              </span>
              {batch && batch.error_rows > 0 && (
                <span className="text-destructive text-[11px]">
                  {batch.error_rows} row{batch.error_rows > 1 ? "s" : ""} with errors
                </span>
              )}
            </div>
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-muted-foreground"
            >
              <Download size={12} /> Template
            </button>
          </div>

          {/* CSV import */}
          {!readOnly && batch && (
            <Scope3CSVImport
              batchId={batch.batch_id}
              onUploaded={loadBatch}
              disabled={readOnly}
            />
          )}

          {/* Batch-level supporting documents */}
          {batch && (
            <BatchDocPanel batchId={batch.batch_id} readOnly={readOnly} />
          )}

          {/* Action bar */}
          {canEdit && batch && (
            <div className="flex items-center justify-end gap-3 mt-4 pt-4 border-t border-border">
              {batch.ghg_category_id === 3 && (
                <Button
                  variant="outline" size="sm"
                  onClick={handleAutoComputeC3}
                  disabled={autoComputing || readOnly}
                  className="text-[12px] gap-1.5 text-info border-info/30 hover:bg-info-tint"
                  title="Populate this batch from approved Scope 1/2 energy data"
                >
                  <Sliders size={13} />
                  {autoComputing ? "Computing..." : "Auto-compute from Scope 1/2"}
                </Button>
              )}
              <Button
                variant="outline" size="sm"
                onClick={handleSave}
                disabled={saving || readOnly || localRows.length === 0}
                className="text-[12px] gap-1.5"
              >
                <Save size={13} />
                {saving ? "Saving..." : "Save Draft"}
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={
                  submitting || readOnly || localRows.length === 0 ||
                  batch.status === "SUBMITTED" || batch.status === "APPROVED"
                }
                className="text-[12px] gap-1.5 bg-violet-600 hover:bg-violet-700"
              >
                <Send size={13} />
                {submitting ? "Submitting..." : "Submit for Review"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
