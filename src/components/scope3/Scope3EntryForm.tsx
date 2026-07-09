/**
 * Scope3EntryForm — Unified entry row for Scope 3 data.
 *
 * GHG Protocol aligned: all four calculation methods in one table.
 *   SUPPLIER_SPECIFIC — qty × manual EF from supplier
 *   AVERAGE_DATA      — qty × EF from process LCA database
 *   SPEND_BASED       — monetary value × EEIO EF
 *   DIRECT_ESTIMATE   — user enters tCO2e directly
 *
 * Columns: Description | Supplier | Method | Qty/Amt | Unit/Curr | Factor/Source | tCO₂e | Notes | ⋮
 * Cells for inapplicable fields render as greyed "—" so the table stays scannable.
 *
 * GHG Protocol alignment fixes:
 *   Fix 1 — Auto-fill + lock unit from factor item when selected
 *   Fix 2 — Emission unit dropdown for Supplier-specific method
 *   Fix 3 — Richer factor dropdown labels (EF value + unit + activity_type)
 *   Fix 4 — Show resolved EF value and calculation breakdown in entry row
 *   Fix 6 — Show WTT factor in factor display when non-zero
 */
import { Fragment, useEffect, useRef, useState } from "react";
import { Trash2, AlertCircle, Paperclip, FileText, Upload, Download, ChevronDown, Sliders, Plus, GitBranch } from "lucide-react";
import { tenantApi } from "@/api/client";
import { getApiError } from "@/lib/utils";
import { toast } from "sonner";
import type { Scope3CalcMethod, Scope3FactorItem, Location, Supplier, SupplierEmissionFactor } from "@/types";

/* ── Types ───────────────────────────────────────────────────────────────────── */

export interface LocalEntry {
  _key: string;                     // client-side key for React
  entry_id?: string;                // undefined = new unsaved row
  calculation_method: Scope3CalcMethod;

  // Common
  activity_label?: string;          // description for all methods
  supplier_id?: string;
  supplier_name?: string;
  notes?: string;

  // SUPPLIER_SPECIFIC + AVERAGE_DATA
  quantity?: number | "";
  quantity_unit?: string;
  supplier_factor_id?: string;          // SUPPLIER_SPECIFIC: selected from supplier's factor list
  manual_emission_factor?: number | ""; // SUPPLIER_SPECIFIC: filled from factor or entered manually
  manual_ef_unit?: string;              // SUPPLIER_SPECIFIC: "kgCO2e" | "tCO2e"

  // AVERAGE_DATA + SPEND_BASED
  factor_item_id?: string;          // DB factor lookup

  // SPEND_BASED
  amount?: number | "";
  currency_code?: string;

  // DIRECT_ESTIMATE
  source_reference?: string;        // methodology / source text
  emission_value?: number | "";     // manual tCO2e (DIRECT_ESTIMATE) or computed (others)

  // Phase 2: category-specific fields (Appendix D formulas)
  computation_mode?: "SIMPLE" | "CATEGORY" | "AUTO" | "ALLOCATION" | "HYBRID";
  data_source?: string;
  assumptions?: string;
  // Transport
  distance_km?: number | "";
  mass_tonnes?: number | "";
  transport_mode?: string;
  vehicle_type?: string;
  // Business travel
  hotel_nights?: number | "";
  num_passengers?: number | "";
  // Commuting
  num_employees?: number | "";
  pct_mode?: number | "";
  working_days?: number | "";
  // Leased assets + refrigerant
  floor_area_m2?: number | "";
  total_area_m2?: number | "";
  refrigerant_kg?: number | "";
  refrigerant_gwp?: number | "";
  // Use of sold products
  units_sold?: number | "";
  lifetime_uses?: number | "";
  energy_per_use?: number | "";
  // Investments
  equity_share_pct?: number | "";
  investee_revenue?: number | "";
  // Waste
  waste_method?: string;
  waste_type?: string;

  // Hybrid (Phase 3B)
  parent_entry_id?: string;
  parent_key?: string;              // client-side parent _key for unsaved parents
  component_type?: "supplier_direct" | "material" | "transport" | "waste" | "other";

  // State
  validation_status?: string;
  error_message?: string;
}

/** Which ghg_category_ids benefit from a category-specific detail panel. */
export const CATEGORY_DETAIL_SUPPORTED = new Set<number>([4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 15]);

/** Categories that support ALLOCATION mode (floor-area allocation from a total). */
export const ALLOCATION_SUPPORTED = new Set<number>([8, 13, 14]);

/* ── Constants ───────────────────────────────────────────────────────────────── */

export const CALC_METHODS: { value: Scope3CalcMethod; label: string; hint: string }[] = [
  {
    value: "SUPPLIER_SPECIFIC",
    label: "Supplier-specific",
    hint: "Qty × emission factor provided by your supplier",
  },
  {
    value: "AVERAGE_DATA",
    label: "Average-data",
    hint: "Qty × cradle-to-gate EF from process LCA database",
  },
  {
    value: "SPEND_BASED",
    label: "Spend-based",
    hint: "Monetary value × EEIO emission factor",
  },
  {
    value: "DIRECT_ESTIMATE",
    label: "Direct estimate",
    hint: "Enter tCO₂e directly (attach source document)",
  },
];

const METHOD_COLORS: Record<Scope3CalcMethod, string> = {
  SUPPLIER_SPECIFIC: "text-ok bg-ok-tint border-ok/30",
  AVERAGE_DATA:      "text-info bg-info-tint border-info/30",
  SPEND_BASED:       "text-warn bg-warn-tint border-warn/30",
  DIRECT_ESTIMATE:   "text-muted-foreground bg-sunken border-border",
};

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

/** Build a rich label for a factor item: "Sector · Activity · Sub · EF unit" (Fix 3) */
function factorLabel(fi: Scope3FactorItem): string {
  const parts: string[] = [fi.sector_name];
  if (fi.activity_type) parts.push(fi.activity_type);
  if (fi.sub_type) parts.push(fi.sub_type);
  const efStr = `${fi.emission_factor} ${fi.emission_unit || "kgCO2e"}/${fi.activity_unit || "unit"}`;
  parts.push(efStr);
  return parts.join(" \u00b7 "); // middle dot separator
}

/** Build a short resolved EF summary for display below the dropdown (Fix 4 + Fix 6) */
function factorSummary(fi: Scope3FactorItem): string {
  const ef = fi.emission_factor;
  const wtt = fi.wtt_factor || 0;
  const unit = fi.emission_unit || "kgCO2e";
  const aUnit = fi.activity_unit || "unit";
  if (wtt > 0) {
    return `${ef} + ${wtt} WTT = ${(ef + wtt).toFixed(4)} ${unit}/${aUnit}`;
  }
  return `${ef} ${unit}/${aUnit}`;
}

/* ── Styles ──────────────────────────────────────────────────────────────────── */

const inputCls =
  "w-full py-1 px-2 text-[12px] text-foreground border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary bg-card";
const selectCls =
  "w-full py-1 px-2 text-[12px] text-foreground border border-border rounded bg-card focus:outline-none focus:ring-1 focus:ring-primary";
const disabledCellCls =
  "w-full py-1 px-2 text-[12px] text-muted-foreground/40 text-center select-none";

/* ── Per-entry doc panel ─────────────────────────────────────────────────────── */

function EntryDocPanel({
  entryId, readOnly, colSpan,
}: { entryId: string; readOnly: boolean; colSpan: number }) {
  const [docs, setDocs] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    tenantApi.listScope3EntryDocuments(entryId)
      .then((r) => setDocs(r.data || []))
      .catch(() => {});
  }, [entryId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await tenantApi.uploadScope3EntryDocument(entryId, file);
      setDocs((prev) => [res.data, ...prev]);
      toast.success("Document attached");
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
    <tr className="bg-accent/40 border-b border-[hsl(var(--border-hairline))]">
      <td colSpan={colSpan} className="px-4 py-2">
        <div className="flex items-center gap-3 flex-wrap">
          {docs.map((doc: any) => (
            <div key={doc.document_id} className="flex items-center gap-1.5 bg-card border border-border rounded px-2 py-1">
              <FileText size={11} className="text-muted-foreground flex-shrink-0" />
              <button
                onClick={() => handleDownload(doc.document_id, doc.file_name)}
                className="text-[11px] text-primary hover:underline max-w-[160px] truncate"
              >
                {doc.file_name}
              </button>
              {!readOnly && (
                <button onClick={() => handleDelete(doc.document_id)} className="text-muted-foreground/40 hover:text-destructive">
                  <Trash2 size={10} />
                </button>
              )}
            </div>
          ))}
          {docs.length === 0 && (
            <span className="text-[11px] text-muted-foreground">No documents attached.</span>
          )}
          {!readOnly && (
            <>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1 text-[11px] text-accent-foreground hover:text-accent-foreground font-medium"
              >
                <Upload size={11} />
                {uploading ? "Uploading..." : "Attach file"}
              </button>
              <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

/* ── Category-specific detail panel (Appendix D inputs) ─────────────────────── */

function CategoryDetailPanel({
  entry, ghgCategoryId, readOnly, colSpan, onChange,
}: {
  entry: LocalEntry;
  ghgCategoryId: number;
  readOnly: boolean;
  colSpan: number;
  onChange: (key: string, field: string, value: any) => void;
}) {
  const k = entry._key;
  const mode = entry.computation_mode || "SIMPLE";

  const NumField = ({ field, label, placeholder }: { field: keyof LocalEntry; label: string; placeholder?: string }) => (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
      <input
        className={inputCls}
        type="number" step="any"
        placeholder={placeholder || "0"}
        value={(entry[field] as any) ?? ""}
        onChange={(e) => onChange(k, field as string, e.target.value === "" ? "" : Number(e.target.value))}
        disabled={readOnly}
      />
    </label>
  );
  const TxtField = ({ field, label, placeholder }: { field: keyof LocalEntry; label: string; placeholder?: string }) => (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
      <input
        className={inputCls}
        placeholder={placeholder}
        value={(entry[field] as any) || ""}
        onChange={(e) => onChange(k, field as string, e.target.value)}
        disabled={readOnly}
      />
    </label>
  );

  const fields = (() => {
    switch (ghgCategoryId) {
      case 4:  // Upstream T&D
      case 9:  // Downstream T&D
        return (
          <>
            <NumField field="distance_km" label="Distance (km)" />
            <NumField field="mass_tonnes" label="Mass (tonnes)" />
            <TxtField field="transport_mode" label="Mode" placeholder="road/rail/air/sea" />
            <TxtField field="vehicle_type" label="Vehicle type" placeholder="HGV rigid / 40t artic" />
          </>
        );
      case 6:  // Business Travel
        return (
          <>
            <NumField field="distance_km" label="Distance (km)" />
            <NumField field="num_passengers" label="# Passengers" />
            <NumField field="hotel_nights" label="Hotel nights" />
            <TxtField field="transport_mode" label="Mode" placeholder="air / rail / car" />
          </>
        );
      case 7:  // Employee Commuting
        return (
          <>
            <NumField field="num_employees" label="# Employees" />
            <NumField field="pct_mode" label="% using mode (0-1)" placeholder="0.45" />
            <NumField field="distance_km" label="Round-trip km" />
            <NumField field="working_days" label="Working days" />
            <TxtField field="transport_mode" label="Mode" placeholder="car / bus / metro" />
          </>
        );
      case 8:  // Upstream Leased Assets
      case 13: // Downstream Leased Assets
      case 14: // Franchises
        return (
          <>
            <NumField field="floor_area_m2" label="Leased/franchise area (m²)" />
            <NumField field="total_area_m2" label="Total building area (m²)" />
            <NumField field="refrigerant_kg" label="Refrigerant leaked (kg)" />
            <NumField field="refrigerant_gwp" label="Refrigerant GWP" />
          </>
        );
      case 11: // Use of Sold Products
        return (
          <>
            <NumField field="units_sold" label="Units sold" />
            <NumField field="lifetime_uses" label="Lifetime uses/unit" />
            <NumField field="energy_per_use" label="Energy per use (kWh/MJ)" />
          </>
        );
      case 5:  // Waste generated in operations
      case 12: // End-of-life treatment of sold products
        return (
          <>
            <TxtField field="waste_type" label="Waste type" placeholder="mixed MSW / plastics / metal" />
            <TxtField field="waste_method" label="Treatment" placeholder="landfill / incineration / recycled" />
            <NumField field="mass_tonnes" label="Mass (tonnes)" />
          </>
        );
      case 15: // Investments
        return (
          <>
            <NumField field="investee_revenue" label="Investee revenue" placeholder="INR/USD" />
            <NumField field="equity_share_pct" label="Equity share (0-1)" placeholder="0.25" />
          </>
        );
      default:
        return null;
    }
  })();

  const canAllocate = ALLOCATION_SUPPORTED.has(ghgCategoryId);

  return (
    <tr className="bg-info-tint/40 border-b border-[hsl(var(--border-hairline))]">
      <td colSpan={colSpan} className="px-4 py-3">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Sliders size={12} className="text-info" />
            <span className="text-[11px] font-semibold text-info">Category-specific inputs (Appendix D)</span>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <input
                type="radio"
                name={`mode-${k}`}
                checked={mode === "SIMPLE" || mode === undefined}
                onChange={() => onChange(k, "computation_mode", "SIMPLE")}
                disabled={readOnly}
                className="accent-sky-600"
              />
              Direct entry
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <input
                type="radio"
                name={`mode-${k}`}
                checked={mode === "CATEGORY"}
                onChange={() => onChange(k, "computation_mode", "CATEGORY")}
                disabled={readOnly}
                className="accent-sky-600"
              />
              Compute from these fields
            </label>
            {canAllocate && (
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <input
                  type="radio"
                  name={`mode-${k}`}
                  checked={mode === "ALLOCATION"}
                  onChange={() => onChange(k, "computation_mode", "ALLOCATION")}
                  disabled={readOnly}
                  className="accent-sky-600"
                />
                Allocate from total (area ratio)
              </label>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {fields}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <TxtField field="data_source" label="Data source" placeholder="e.g. DEFRA 2024 / Supplier survey" />
          <TxtField field="assumptions" label="Assumptions" placeholder="Any assumptions for audit trail" />
        </div>
      </td>
    </tr>
  );
}

/* ── Props ───────────────────────────────────────────────────────────────────── */

interface Props {
  entry: LocalEntry;
  allowedMethods: Scope3CalcMethod[];
  factorItems: Scope3FactorItem[];
  suppliers: Supplier[];
  ghgCategoryId?: number;
  readOnly: boolean;
  docOpen: boolean;
  catOpen: boolean;
  isChild?: boolean;
  onToggleDoc: () => void;
  onToggleCat: () => void;
  onChange: (key: string, field: string, value: any) => void;
  onDelete: (key: string) => void;
  onAddHybridChild?: (parentKey: string) => void;
}

/* ══════════════════════════════════════════════════════════════════════════════ */

export default function Scope3EntryForm({
  entry, allowedMethods, factorItems, suppliers, ghgCategoryId, readOnly,
  docOpen, catOpen, isChild, onToggleDoc, onToggleCat, onChange, onDelete, onAddHybridChild,
}: Props) {
  const k = entry._key;
  const method = entry.calculation_method;
  const hasError = entry.validation_status === "ERROR";
  const isSaved = !!entry.entry_id;
  const colSpan = 10; // total columns in unified table
  const hasCategoryDetails = !!ghgCategoryId && CATEGORY_DETAIL_SUPPORTED.has(ghgCategoryId);
  const isHybridParent = entry.computation_mode === "HYBRID" && !isChild;

  const isQtyBased   = method === "SUPPLIER_SPECIFIC" || method === "AVERAGE_DATA";
  const isSpend      = method === "SPEND_BASED";
  const isDirect     = method === "DIRECT_ESTIMATE";
  const needsDBFactor = method === "AVERAGE_DATA" || method === "SPEND_BASED";

  /* ── Supplier-specific: load this supplier's factors when supplier changes ── */
  const [supplierFactors, setSupplierFactors] = useState<SupplierEmissionFactor[]>([]);
  useEffect(() => {
    if (method !== "SUPPLIER_SPECIFIC" || !entry.supplier_id) {
      setSupplierFactors([]);
      return;
    }
    tenantApi.listSupplierFactors(entry.supplier_id)
      .then((r) => setSupplierFactors(r.data || []))
      .catch(() => setSupplierFactors([]));
  }, [entry.supplier_id, method]);

  /* ── Filter factor items by entry's calc method (LCA vs EEIO) ── */
  const methodFactorItems = needsDBFactor
    ? factorItems.filter((fi) => fi.calc_method === method)
    : factorItems;

  /* ── Resolved factor item (for Fix 4 display) ── */
  const selectedFI = needsDBFactor && entry.factor_item_id
    ? factorItems.find((fi) => fi.factor_item_id === entry.factor_item_id) ?? null
    : null;

  /* ── Computed tCO2e (read-only display for all except DIRECT_ESTIMATE) ── */
  const computedTco2e = (() => {
    if (isDirect) return null; // shown as editable input
    const v = entry.emission_value;
    if (v === undefined || v === "" || v === null) return null;
    return Number(v);
  })();

  /* ── Handlers ── */
  const handleSupplierChange = (supplierId: string) => {
    onChange(k, "supplier_id", supplierId);
    const sup = suppliers.find((s) => s.supplier_id === supplierId);
    onChange(k, "supplier_name", sup?.supplier_name || "");
    // Clear any previously selected supplier factor when supplier changes
    onChange(k, "supplier_factor_id", "");
  };

  /** When a supplier factor is picked from the dropdown, auto-fill EF + unit */
  const handleSupplierFactorChange = (factorId: string) => {
    onChange(k, "supplier_factor_id", factorId);
    if (factorId) {
      const sf = supplierFactors.find((f) => f.factor_id === factorId);
      if (sf) {
        onChange(k, "manual_emission_factor", sf.emission_factor);
        onChange(k, "manual_ef_unit", sf.emission_uom);
      }
    }
  };

  /** Fix 1: When user selects a factor from dropdown, auto-fill the unit field */
  const handleFactorChange = (factorItemId: string) => {
    onChange(k, "factor_item_id", factorItemId);
    if (factorItemId) {
      const fi = factorItems.find((f) => f.factor_item_id === factorItemId);
      if (fi?.activity_unit) {
        onChange(k, "quantity_unit", fi.activity_unit);
      }
    }
  };

  const handlePaperclip = () => {
    if (!isSaved) { toast.info("Save Draft first, then attach row-level documents"); return; }
    onToggleDoc();
  };

  /* ── Unit field locked when factor is selected (Fix 1) ── */
  const unitLockedByFactor = needsDBFactor && !!selectedFI?.activity_unit;

  /* ── Action buttons ── */
  const actionCell = (
    <td className="px-1 py-1.5 w-[72px]">
      <div className="flex items-center gap-0.5">
        {isHybridParent && onAddHybridChild && !readOnly && (
          <button
            onClick={() => onAddHybridChild(k)}
            title="Add sub-component to this hybrid row"
            className="flex items-center justify-center w-6 h-6 rounded text-ok hover:bg-ok-tint"
          >
            <Plus size={13} />
          </button>
        )}
        {hasCategoryDetails && (
          <button
            onClick={onToggleCat}
            title="Category-specific details (Appendix D inputs)"
            className={`flex items-center justify-center w-6 h-6 rounded transition-colors
              ${catOpen
                ? "bg-sky-100 text-info"
                : entry.computation_mode === "CATEGORY"
                  ? "text-sky-500 hover:bg-info-tint"
                  : "text-muted-foreground hover:text-sky-500 hover:bg-info-tint"}`}
          >
            <Sliders size={12} />
          </button>
        )}
        <button
          onClick={handlePaperclip}
          title={isSaved ? "Attach documents" : "Save Draft first to attach documents"}
          className={`flex items-center justify-center w-6 h-6 rounded transition-colors
            ${docOpen
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-violet-500 hover:bg-accent"}`}
        >
          <Paperclip size={12} />
        </button>
        {!readOnly && (
          <button onClick={() => onDelete(k)} className="text-muted-foreground hover:text-destructive p-0.5">
            <Trash2 size={13} />
          </button>
        )}
        {hasError && (
          <span title={entry.error_message || "Error"} className="text-destructive">
            <AlertCircle size={13} />
          </span>
        )}
      </div>
    </td>
  );

  const rowBg = hasError
    ? "bg-destructive-tint/50"
    : isHybridParent
      ? "bg-ok-tint/50"
      : isChild
        ? "bg-sunken/60"
        : "hover:bg-sunken/40";

  return (
    <Fragment>
      <tr className={`border-b border-[hsl(var(--border-hairline))] ${rowBg}`}>

        {/* 1. Description — activity_label for all methods */}
        <td className={`px-2 py-1.5 min-w-[160px] ${isChild ? "pl-8" : ""}`}>
          <div className="flex items-center gap-1">
            {isChild && <GitBranch size={11} className="text-muted-foreground flex-shrink-0" />}
            <input
              className={inputCls}
              placeholder={
                isChild
                  ? "Sub-component (material / transport / waste)"
                  : isSpend
                    ? "Item / service description"
                    : "Description of activity / good"
              }
              value={entry.activity_label || ""}
              onChange={(e) => onChange(k, "activity_label", e.target.value)}
              disabled={readOnly}
            />
          </div>
        </td>

        {/* 2. Supplier — dropdown, optional for all methods */}
        <td className="px-2 py-1.5 w-[140px]">
          <select
            className={selectCls}
            value={entry.supplier_id || ""}
            onChange={(e) => handleSupplierChange(e.target.value)}
            disabled={readOnly}
          >
            <option value="">— optional —</option>
            {suppliers.map((s) => (
              <option key={s.supplier_id} value={s.supplier_id}>
                {s.supplier_name}{s.supplier_code ? ` (${s.supplier_code})` : ""}
              </option>
            ))}
          </select>
        </td>

        {/* 3. Calculation Method (+ Hybrid parent toggle) */}
        <td className="px-2 py-1.5 w-[135px]">
          <div className="flex items-center gap-1">
            <select
              className={`${selectCls} text-[11px] font-semibold flex-1`}
              value={method}
              onChange={(e) => {
                onChange(k, "calculation_method", e.target.value as Scope3CalcMethod);
                // Clear factor selection when switching method — factor may be incompatible
                onChange(k, "factor_item_id", "");
              }}
              disabled={readOnly || allowedMethods.length <= 1 || isHybridParent}
            >
              {CALC_METHODS
                .filter((m) => allowedMethods.includes(m.value))
                .map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
            </select>
            {!isChild && (
              <button
                onClick={() =>
                  onChange(
                    k,
                    "computation_mode",
                    entry.computation_mode === "HYBRID" ? "SIMPLE" : "HYBRID",
                  )
                }
                disabled={readOnly}
                title="Toggle Hybrid mode: this row becomes a parent; emissions sum from its sub-components"
                className={`flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold flex-shrink-0 border
                  ${isHybridParent
                    ? "bg-emerald-600 text-white border-emerald-600"
                    : "text-ok border-ok/30 hover:bg-ok-tint"}`}
              >
                H
              </button>
            )}
          </div>
        </td>

        {/* 4. Qty / Amount */}
        <td className="px-2 py-1.5 w-[90px]">
          {isQtyBased ? (
            <input
              className={inputCls}
              type="number" step="any" placeholder="0"
              value={entry.quantity ?? ""}
              onChange={(e) => onChange(k, "quantity", e.target.value === "" ? "" : Number(e.target.value))}
              disabled={readOnly}
            />
          ) : isSpend ? (
            <input
              className={inputCls}
              type="number" step="any" placeholder="0.00"
              value={entry.amount ?? ""}
              onChange={(e) => onChange(k, "amount", e.target.value === "" ? "" : Number(e.target.value))}
              disabled={readOnly}
            />
          ) : (
            <span className={disabledCellCls}>—</span>
          )}
        </td>

        {/* 5. Unit / Currency
             Fix 1: When a factor is selected (AVERAGE_DATA/SPEND_BASED), auto-fill and lock unit
        */}
        <td className="px-2 py-1.5 w-[70px]">
          {isQtyBased ? (
            <input
              className={`${inputCls} ${unitLockedByFactor ? "bg-sunken text-muted-foreground" : ""}`}
              placeholder="unit"
              value={entry.quantity_unit || ""}
              onChange={(e) => onChange(k, "quantity_unit", e.target.value)}
              disabled={readOnly || unitLockedByFactor}
              title={unitLockedByFactor ? `Auto-filled from factor (${selectedFI?.activity_unit})` : ""}
            />
          ) : isSpend ? (
            <input
              className={inputCls}
              placeholder="INR"
              value={entry.currency_code || "INR"}
              onChange={(e) => onChange(k, "currency_code", e.target.value)}
              disabled={readOnly}
            />
          ) : (
            <span className={disabledCellCls}>—</span>
          )}
        </td>

        {/* 6. Factor / Source
              SUPPLIER_SPECIFIC → manual EF input + unit dropdown (Fix 2)
              AVERAGE_DATA / SPEND_BASED → rich dropdown from factor set DB (Fix 3) + resolved EF (Fix 4)
              DIRECT_ESTIMATE → source reference text
        */}
        <td className="px-2 py-1.5 min-w-[150px]">
          {method === "SUPPLIER_SPECIFIC" ? (
            <div className="flex flex-col gap-1">
              {/* Factor dropdown — only shown when supplier is selected */}
              {entry.supplier_id && (
                <div>
                  <select
                    className={selectCls}
                    value={entry.supplier_factor_id || ""}
                    onChange={(e) => handleSupplierFactorChange(e.target.value)}
                    disabled={readOnly}
                    title="Select a factor from this supplier's factor list (auto-fills EF below)"
                  >
                    <option value="">— select supplier factor —</option>
                    {supplierFactors.map((sf) => (
                      <option key={sf.factor_id} value={sf.factor_id}>
                        {sf.product_category} · {sf.emission_factor} {sf.emission_uom}{sf.unit_basis ? ` / ${sf.unit_basis}` : ""}
                      </option>
                    ))}
                  </select>
                  {supplierFactors.length === 0 && (
                    <span className="block text-[10px] text-amber-500 mt-0.5">No factors on file — enter manually below</span>
                  )}
                </div>
              )}
              {/* Manual EF input + unit — always shown for SUPPLIER_SPECIFIC */}
              <div className="flex gap-1">
                <input
                  className={`${inputCls} flex-1`}
                  type="number" step="any" placeholder="EF value"
                  title="Emission factor value from your supplier"
                  value={entry.manual_emission_factor ?? ""}
                  onChange={(e) => onChange(k, "manual_emission_factor", e.target.value === "" ? "" : Number(e.target.value))}
                  disabled={readOnly}
                />
                <select
                  className="py-1 px-1 text-[10px] text-foreground border border-border rounded bg-card focus:outline-none focus:ring-1 focus:ring-primary w-[72px] flex-shrink-0"
                  value={entry.manual_ef_unit || "kgCO2e"}
                  onChange={(e) => onChange(k, "manual_ef_unit", e.target.value)}
                  disabled={readOnly}
                  title="Emission factor unit"
                >
                  <option value="kgCO2e">kgCO₂e</option>
                  <option value="tCO2e">tCO₂e</option>
                </select>
              </div>
            </div>
          ) : needsDBFactor ? (
            <div>
              {/* Fix 3: Richer factor dropdown labels — filtered by calc_method */}
              <select
                className={selectCls}
                value={entry.factor_item_id || ""}
                onChange={(e) => handleFactorChange(e.target.value)}
                disabled={readOnly}
              >
                <option value="">— select factor —</option>
                {methodFactorItems.map((fi) => (
                  <option key={fi.factor_item_id} value={fi.factor_item_id}>
                    {factorLabel(fi)}
                  </option>
                ))}
              </select>
              {/* Fix 4 + Fix 6: Show resolved EF value + WTT below dropdown */}
              {selectedFI && (
                <span className="block mt-0.5 text-[10px] text-muted-foreground truncate" title={factorSummary(selectedFI)}>
                  {factorSummary(selectedFI)}
                </span>
              )}
            </div>
          ) : isDirect ? (
            <input
              className={inputCls}
              placeholder="Methodology / source"
              title="Describe the methodology or source of your estimate"
              value={entry.source_reference || ""}
              onChange={(e) => onChange(k, "source_reference", e.target.value)}
              disabled={readOnly}
            />
          ) : null}
        </td>

        {/* 7. tCO₂e — read-only (computed) or editable (DIRECT_ESTIMATE) */}
        <td className="px-2 py-1.5 w-[90px]">
          {isDirect ? (
            <input
              className={`${inputCls} font-mono`}
              type="number" step="any" placeholder="0.0000"
              value={entry.emission_value ?? ""}
              onChange={(e) => onChange(k, "emission_value", e.target.value === "" ? "" : Number(e.target.value))}
              disabled={readOnly}
            />
          ) : (
            <span className={`block text-right text-[12px] font-mono px-2 py-1
              ${computedTco2e !== null ? "text-foreground font-semibold" : "text-muted-foreground/40"}`}>
              {computedTco2e !== null ? computedTco2e.toFixed(4) : "—"}
            </span>
          )}
        </td>

        {/* 8. Notes */}
        <td className="px-2 py-1.5 min-w-[100px]">
          <input
            className={inputCls}
            placeholder="Notes"
            value={entry.notes || ""}
            onChange={(e) => onChange(k, "notes", e.target.value)}
            disabled={readOnly}
          />
        </td>

        {/* 9. Actions */}
        {actionCell}
      </tr>

      {/* Category-specific detail panel */}
      {catOpen && hasCategoryDetails && ghgCategoryId !== undefined && (
        <CategoryDetailPanel
          entry={entry}
          ghgCategoryId={ghgCategoryId}
          readOnly={readOnly}
          colSpan={colSpan}
          onChange={onChange}
        />
      )}

      {/* Per-entry doc panel (expands below this row) */}
      {docOpen && entry.entry_id && (
        <EntryDocPanel entryId={entry.entry_id} readOnly={readOnly} colSpan={colSpan} />
      )}
    </Fragment>
  );
}

/* ── Unified table headers ───────────────────────────────────────────────────── */

export function EntryTableHeaders({ allowedMethods }: { allowedMethods: Scope3CalcMethod[] }) {
  const hdrCls = "px-2 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-left";

  const factorLabel = (() => {
    if (allowedMethods.includes("SUPPLIER_SPECIFIC") && allowedMethods.length === 1)
      return "Emission Factor";
    if (allowedMethods.every((m) => m === "SPEND_BASED" || m === "AVERAGE_DATA"))
      return "DB Factor";
    return "Factor / Source";
  })();

  const qtyLabel = allowedMethods.includes("SPEND_BASED") && !allowedMethods.some((m) => m === "SUPPLIER_SPECIFIC" || m === "AVERAGE_DATA")
    ? "Amount" : "Qty / Amount";

  const unitLabel = allowedMethods.includes("SPEND_BASED") && !allowedMethods.some((m) => m === "SUPPLIER_SPECIFIC" || m === "AVERAGE_DATA")
    ? "Currency" : "Unit / Curr";

  return (
    <tr className="border-b border-border">
      <th className={hdrCls} style={{ minWidth: 160 }}>Description</th>
      <th className={hdrCls} style={{ width: 140 }}>Supplier</th>
      <th className={hdrCls} style={{ width: 135 }}>Method</th>
      <th className={hdrCls} style={{ width: 90 }}>{qtyLabel}</th>
      <th className={hdrCls} style={{ width: 70 }}>{unitLabel}</th>
      <th className={hdrCls} style={{ minWidth: 150 }}>{factorLabel}</th>
      <th className={`${hdrCls} text-right`} style={{ width: 90 }}>tCO₂e</th>
      <th className={hdrCls} style={{ minWidth: 100 }}>Notes</th>
      <th className={hdrCls} style={{ width: 72 }} />
    </tr>
  );
}
