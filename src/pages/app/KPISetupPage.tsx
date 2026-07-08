import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { tenantApi } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { getModuleIcon } from "@/lib/constants";
import { useModulesStore } from "@/store/modules";
import { Breadcrumb, LoadingSkeleton, EmptyState } from "@/components/shared/PageComponents";
import { FormDialog, type FormField } from "@/components/shared/FormDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useIsSupportSession } from "@/components/shared/WriteOnly";
import { toast } from "sonner";
import {
  Plus, BarChart3, ChevronRight, ChevronLeft, X, Pencil, Trash2,
  FlaskConical, Eye, EyeOff, Package2,
} from "lucide-react";

const Scope3SetupPage = lazy(() => import("@/pages/app/Scope3SetupPage"));
import type { KPI, ConversionFactor, Indicator, DerivedMetric, OperandType, OperandField, DerivedOperator, UOM } from "@/types";
import { formatDate, getApiError } from "@/lib/utils";
import { displayFormula, extractTokens } from "@/lib/formulaEvaluator";

type PageTab = "kpis" | "derived" | "scope3";

// ── Operand field label helper ──────────────────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
  quantity: "Quantity (raw input)",
  mj_value: "MJ Value (energy)",
  emission_value: "Emission (tCO₂e)",
};
const OP_LABELS: Record<string, string> = { "+": "Add (+)", "-": "Subtract (−)", "*": "Multiply (×)", "/": "Divide (÷)", "%": "Percentage (%)" };

// ── Empty derived metric form ────────────────────────────────────────────────
const emptyDmForm = () => ({
  name: "", unit: "", description: "",
  module_id: "" as string | number,
  indicator_id: "" as string | number,
  // intermediate step flag — inverted UI: true = hide from report
  is_intermediate: false,
  display_order: 0,
  // Formula mode (new)
  formulaMode: false,
  formula: "",
  // LHS (legacy mode)
  lhs_type: "kpi_field" as OperandType,
  lhs_kpi_id: "", lhs_field: "quantity" as OperandField, lhs_constant: "",
  lhs_indicator_id: "" as string | number,
  lhs_derived_id: "",
  // Operator
  operator: "/" as DerivedOperator,
  // RHS
  rhs_type: "kpi_field" as OperandType,
  rhs_kpi_id: "", rhs_field: "quantity" as OperandField, rhs_constant: "",
  rhs_indicator_id: "" as string | number,
  rhs_derived_id: "",
});

export default function KPISetupPage() {
  const { user } = useAuthStore();
  const modules = useModulesStore((s) => s.modules);
  const [pageTab, setPageTab] = useState<PageTab>("kpis");
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeModule, setActiveModule] = useState<number | null>(null);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editKPI, setEditKPI] = useState<KPI | null>(null);
  const [kpiForm, setKpiForm] = useState<Record<string, any>>({});
  const setKpiField = (k: string, v: any) => setKpiForm((p) => ({ ...p, [k]: v }));
  const [actionLoading, setActionLoading] = useState(false);

  // Conversion factors panel
  const [factorKPI, setFactorKPI] = useState<KPI | null>(null);
  const [factors, setFactors] = useState<ConversionFactor[]>([]);
  const [factorsLoading, setFactorsLoading] = useState(false);
  const [addFactorOpen, setAddFactorOpen] = useState(false);
  const [editFactorId, setEditFactorId] = useState<number | null>(null);
  const [editFactorForm, setEditFactorForm] = useState<{ energy_factor: string; energy_factor_uom: string; emission_factor: string; emission_factor_uom: string }>({ energy_factor: "", energy_factor_uom: "MJ", emission_factor: "", emission_factor_uom: "tCO2e" });
  const [recalcConfirm, setRecalcConfirm] = useState<{ factorId: number; count: number; ef: number; efUom: string; em: number; emUom: string } | null>(null);

  // Derived metrics state
  const [derivedMetrics, setDerivedMetrics] = useState<DerivedMetric[]>([]);
  const [dmLoading, setDmLoading] = useState(false);
  const [dmForm, setDmForm] = useState<ReturnType<typeof emptyDmForm>>(emptyDmForm());
  const setDmField = (k: string, v: any) => setDmForm((p) => ({ ...p, [k]: v }));
  const [editDm, setEditDm] = useState<DerivedMetric | null>(null);
  const [dmCreateOpen, setDmCreateOpen] = useState(false);
  const [allKpis, setAllKpis] = useState<KPI[]>([]);
  // UOM master
  const [uoms, setUOMs] = useState<UOM[]>([]);

  // formulaRef removed — formula is built via button clicks only

  const isSupport = useIsSupportSession();
  const isAdmin = user?.role === "COMPANY_ADMIN" && !isSupport;
  const pageSize = 20;

  const fetchKPIs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, size: pageSize };
      if (activeModule) params.module_id = activeModule;
      const { data } = await tenantApi.listKPIs(params);
      setKpis(data.items || data || []);
      setTotal(data.total ?? 0);
    } catch { toast.error("Failed to load KPIs"); }
    finally { setLoading(false); }
  }, [page, activeModule]);

  useEffect(() => { fetchKPIs(); }, [fetchKPIs]);

  useEffect(() => {
    tenantApi.listIndicators().then(({ data }) => {
      setIndicators(Array.isArray(data) ? data : data?.items || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    tenantApi.listUOMs().then(({ data }) => {
      setUOMs(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, []);

  const fetchDerivedMetrics = useCallback(async () => {
    setDmLoading(true);
    try {
      const { data } = await tenantApi.listDerivedMetrics();
      setDerivedMetrics(Array.isArray(data) ? data : []);
    } catch { toast.error("Failed to load derived metrics"); }
    finally { setDmLoading(false); }
  }, []);

  useEffect(() => { if (pageTab === "derived") fetchDerivedMetrics(); }, [pageTab, fetchDerivedMetrics]);

  // Load all KPIs for formula builder field list
  useEffect(() => {
    if (dmCreateOpen && allKpis.length === 0) {
      tenantApi.listKPIs({ page: 1, size: 999 }).then(({ data }) => {
        setAllKpis(Array.isArray(data) ? data : data?.items || []);
      }).catch(() => {});
    }
  }, [dmCreateOpen, allKpis.length]);

  const insertFormulaToken = (token: string) => {
    setDmField("formula", dmForm.formula + token);
  };

  const openDmCreate = () => { setDmForm(emptyDmForm()); setEditDm(null); setDmCreateOpen(true); };
  const openDmEdit = (dm: DerivedMetric) => {
    const isFormulaMode = !!dm.formula;
    setDmForm({
      name: dm.name, unit: dm.unit, description: dm.description || "",
      module_id: dm.module_id ?? "",
      indicator_id: dm.indicator_id ?? "",
      is_intermediate: !dm.show_in_report,
      display_order: dm.display_order,
      formulaMode: isFormulaMode,
      formula: dm.formula || "",
      lhs_type: dm.lhs_type || "kpi_field",
      lhs_kpi_id: dm.lhs_kpi_id || "",
      lhs_field: (dm.lhs_field as any) || "quantity",
      lhs_constant: dm.lhs_constant != null ? String(dm.lhs_constant) : "",
      lhs_indicator_id: dm.lhs_indicator_id ?? "",
      lhs_derived_id: dm.lhs_derived_id || "",
      operator: dm.operator || "/",
      rhs_type: dm.rhs_type || "kpi_field",
      rhs_kpi_id: dm.rhs_kpi_id || "",
      rhs_field: (dm.rhs_field as any) || "quantity",
      rhs_constant: dm.rhs_constant != null ? String(dm.rhs_constant) : "",
      rhs_indicator_id: dm.rhs_indicator_id ?? "",
      rhs_derived_id: dm.rhs_derived_id || "",
    });
    setEditDm(dm);
    setDmCreateOpen(true);
  };

  const buildDmPayload = () => {
    const f = dmForm;
    if (!f.name || !f.unit) { toast.error("Name and Unit are required"); return null; }

    const base = {
      name: f.name, unit: f.unit, description: f.description || null,
      module_id:    f.module_id    ? Number(f.module_id)    : null,
      indicator_id: f.indicator_id ? Number(f.indicator_id) : null,
      show_in_report: !f.is_intermediate,
      display_order: Number(f.display_order) || 0,
    };

    if (f.formulaMode) {
      // Formula mode
      if (!f.formula.trim()) { toast.error("Formula is required"); return null; }
      try {
        const tokens = extractTokens(f.formula);
        if (tokens.length === 0) { toast.error("Formula must reference at least one KPI, Indicator, or Derived Metric"); return null; }
      } catch { toast.error("Invalid formula syntax"); return null; }
      return {
        ...base, formula: f.formula,
        lhs_type: null, lhs_kpi_id: null, lhs_field: null, lhs_indicator_id: null, lhs_derived_id: null, lhs_constant: null,
        operator: null,
        rhs_type: null, rhs_kpi_id: null, rhs_field: null, rhs_indicator_id: null, rhs_derived_id: null, rhs_constant: null,
      };
    }

    // Legacy LHS/RHS mode
    if (f.lhs_type === "kpi_field"       && !f.lhs_kpi_id)       { toast.error("Select a KPI for the left operand"); return null; }
    if (f.lhs_type === "indicator_field" && !f.lhs_indicator_id) { toast.error("Select an Indicator for the left operand"); return null; }
    if (f.lhs_type === "derived"         && !f.lhs_derived_id)   { toast.error("Select a Derived Metric for the left operand"); return null; }
    if (f.lhs_type === "constant"        && f.lhs_constant === "") { toast.error("Enter a constant for the left operand"); return null; }
    if (f.rhs_type === "kpi_field"       && !f.rhs_kpi_id)       { toast.error("Select a KPI for the right operand"); return null; }
    if (f.rhs_type === "indicator_field" && !f.rhs_indicator_id) { toast.error("Select an Indicator for the right operand"); return null; }
    if (f.rhs_type === "derived"         && !f.rhs_derived_id)   { toast.error("Select a Derived Metric for the right operand"); return null; }
    if (f.rhs_type === "constant"        && f.rhs_constant === "") { toast.error("Enter a constant for the right operand"); return null; }
    return {
      ...base, formula: null,
      lhs_type: f.lhs_type,
      lhs_kpi_id:       f.lhs_type === "kpi_field"       ? f.lhs_kpi_id                    : null,
      lhs_field:        f.lhs_type === "kpi_field"       ? f.lhs_field                     : null,
      lhs_indicator_id: f.lhs_type === "indicator_field" ? Number(f.lhs_indicator_id)      : null,
      lhs_derived_id:   f.lhs_type === "derived"         ? f.lhs_derived_id                : null,
      lhs_constant:     f.lhs_type === "constant"        ? Number(f.lhs_constant)          : null,
      operator: f.operator,
      rhs_type: f.rhs_type,
      rhs_kpi_id:       f.rhs_type === "kpi_field"       ? f.rhs_kpi_id                    : null,
      rhs_field:        f.rhs_type === "kpi_field"       ? f.rhs_field                     : null,
      rhs_indicator_id: f.rhs_type === "indicator_field" ? Number(f.rhs_indicator_id)      : null,
      rhs_derived_id:   f.rhs_type === "derived"         ? f.rhs_derived_id                : null,
      rhs_constant:     f.rhs_type === "constant"        ? Number(f.rhs_constant)          : null,
    };
  };

  const handleDmSave = async () => {
    const payload = buildDmPayload();
    if (!payload) return;
    setActionLoading(true);
    try {
      if (editDm) {
        await tenantApi.updateDerivedMetric(editDm.metric_id, payload);
        toast.success("Derived metric updated");
      } else {
        await tenantApi.createDerivedMetric(payload);
        toast.success("Derived metric created");
      }
      setDmCreateOpen(false);
      fetchDerivedMetrics();
    } catch (err: any) { toast.error(getApiError(err, "Failed to save derived metric")); }
    finally { setActionLoading(false); }
  };

  const handleDmDelete = async (dm: DerivedMetric) => {
    try {
      await tenantApi.deleteDerivedMetric(dm.metric_id);
      toast.success("Derived metric removed");
      fetchDerivedMetrics();
    } catch (err: any) { toast.error(getApiError(err, "Failed to remove")); }
  };

  const handleDmToggleReport = async (dm: DerivedMetric) => {
    try {
      await tenantApi.updateDerivedMetric(dm.metric_id, { show_in_report: !dm.show_in_report });
      fetchDerivedMetrics();
    } catch (err: any) { toast.error(getApiError(err, "Failed to update")); }
  };

  const loadFactors = async (kpi: KPI) => {
    setFactorKPI(kpi);
    setFactorsLoading(true);
    try {
      const { data } = await tenantApi.listFactors(kpi.kpi_id);
      setFactors(Array.isArray(data) ? data : data?.items || []);
    } catch { toast.error("Failed to load conversion factors"); }
    finally { setFactorsLoading(false); }
  };

  const startEditFactor = (f: ConversionFactor) => {
    setEditFactorId(f.factor_id);
    setEditFactorForm({
      energy_factor: String(f.energy_factor),
      energy_factor_uom: f.energy_factor_uom || "MJ",
      emission_factor: String(f.emission_factor),
      emission_factor_uom: f.emission_factor_uom || "tCO2e",
    });
  };

  const handleSaveFactorEdit = async () => {
    if (!editFactorId || !factorKPI) return;
    const ef = parseFloat(editFactorForm.energy_factor);
    const em = parseFloat(editFactorForm.emission_factor);
    if (isNaN(ef) || isNaN(em)) { toast.error("Enter valid numbers"); return; }
    setActionLoading(true);
    try {
      // Check affected count BEFORE saving
      const { data } = await tenantApi.getFactorAffectedCount(editFactorId);
      if (data.count > 0) {
        // Records exist — ask for confirmation before saving anything
        setRecalcConfirm({ factorId: editFactorId, count: data.count, ef, efUom: editFactorForm.energy_factor_uom, em, emUom: editFactorForm.emission_factor_uom });
      } else {
        // No records affected — save factor directly
        await tenantApi.updateFactor(editFactorId, { energy_factor: ef, energy_factor_uom: editFactorForm.energy_factor_uom, emission_factor: em, emission_factor_uom: editFactorForm.emission_factor_uom });
        toast.success("Factor updated");
        setEditFactorId(null);
        loadFactors(factorKPI);
      }
    } catch (err: any) { toast.error(getApiError(err, "Failed to update factor")); }
    finally { setActionLoading(false); }
  };

  const handleRecalculate = async () => {
    if (!recalcConfirm || !factorKPI) return;
    setActionLoading(true);
    try {
      // Save factor + recalculate atomically
      await tenantApi.updateFactor(recalcConfirm.factorId, { energy_factor: recalcConfirm.ef, energy_factor_uom: recalcConfirm.efUom, emission_factor: recalcConfirm.em, emission_factor_uom: recalcConfirm.emUom });
      const { data } = await tenantApi.recalculateFactor(recalcConfirm.factorId);
      toast.success(`Factor updated and ${data.updated} records recalculated`);
      setRecalcConfirm(null);
      setEditFactorId(null);
      loadFactors(factorKPI);
    } catch (err: any) { toast.error(getApiError(err, "Recalculation failed")); }
    finally { setActionLoading(false); }
  };

  const openCreate = () => { setKpiForm({}); setCreateOpen(true); };

  const handleCreate = async () => {
    const isNumeric = (kpiForm.input_type ?? "numeric") === "numeric";
    if (!kpiForm.module_id || !kpiForm.kpi_name || (isNumeric && !kpiForm.unit)) {
      toast.error(isNumeric ? "Module, KPI Name, and Unit are required" : "Module and KPI Name are required"); return;
    }
    setActionLoading(true);
    try {
      await tenantApi.createKPI({ ...kpiForm, unit: kpiForm.unit || "—" });
      toast.success("KPI created");
      setCreateOpen(false);
      fetchKPIs();
    } catch (err: any) { toast.error(getApiError(err, "Failed to create KPI")); }
    finally { setActionLoading(false); }
  };

  const openEdit = (m: KPI) => {
    setKpiForm({
      module_id: m.module_id,
      indicator_id: m.indicator_id ?? "",
      kpi_name: m.kpi_name,
      unit: m.unit,
      input_type: m.input_type ?? "numeric",
      description: m.description ?? "",
      scope_number: m.scope_number ?? "",
      energy_type: m.energy_type ?? "",
    });
    setEditKPI(m);
  };

  const handleEdit = async () => {
    if (!editKPI) return;
    if (!kpiForm.kpi_name || !kpiForm.unit) {
      toast.error("KPI Name and Unit are required"); return;
    }
    setActionLoading(true);
    try {
      const payload: Record<string, any> = {
        kpi_name: kpiForm.kpi_name,
        unit: kpiForm.unit || "—",
        input_type: kpiForm.input_type || "numeric",
        description: kpiForm.description || null,
        indicator_id: kpiForm.indicator_id ? Number(kpiForm.indicator_id) : null,
        scope_number: kpiForm.scope_number ? Number(kpiForm.scope_number) : null,
        energy_type: kpiForm.energy_type || null,
      };
      await tenantApi.updateKPI(editKPI.kpi_id, payload);
      toast.success("KPI updated");
      setEditKPI(null);
      fetchKPIs();
    } catch (err: any) { toast.error(getApiError(err, "Failed to update KPI")); }
    finally { setActionLoading(false); }
  };

  const handleAddFactor = async (formData: Record<string, any>) => {
    if (!factorKPI) return;
    setActionLoading(true);
    // Convert DD-MM-YYYY → YYYY-MM-DD for backend compatibility
    const toISO = (d: string) => {
      if (!d) return d;
      const ddmmyyyy = d.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      return ddmmyyyy ? `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}` : d;
    };
    const payload = {
      ...formData,
      valid_from: toISO(formData.valid_from),
      valid_to: formData.valid_to ? toISO(formData.valid_to) : null,
    };
    try {
      await tenantApi.addFactor(factorKPI.kpi_id, payload);
      toast.success("Conversion factor added");
      setAddFactorOpen(false);
      loadFactors(factorKPI);
    } catch (err: any) { toast.error(getApiError(err, "Failed to add factor")); }
    finally { setActionLoading(false); }
  };

  const handleDeactivate = async (kpi: KPI) => {
    try {
      await tenantApi.deleteKPI(kpi.kpi_id);
      toast.success("KPI deactivated");
      fetchKPIs();
    } catch (err: any) { toast.error(getApiError(err, "Failed to deactivate")); }
  };

  const scopeColors: Record<number, string> = { 1: "bg-red-50 text-red-600", 2: "bg-amber-50 text-amber-600", 3: "bg-blue-50 text-blue-600" };
  const energyLabel: Record<string, string> = { RENEWABLE: "Renewable", NON_RENEWABLE: "Non-Renewable", NOT_APPLICABLE: "N/A" };
  const totalPages = Math.ceil(total / pageSize);

  // UOM selects — derived from the platform-managed master
  const energyUOMs = uoms.filter((u) => u.category === "energy");
  const emissionUOMs = uoms.filter((u) => u.category === "emission");
  const kpiUnitOptions = uoms.filter((u) => u.category !== "emission");

  const defaultEnergyUOM = energyUOMs[0]?.symbol ?? "MJ";
  const defaultEmissionUOM = emissionUOMs[0]?.symbol ?? "tCO2e";

  const factorFields: FormField[] = [
    { key: "energy_factor", label: "Energy Factor", type: "number", required: true, placeholder: "3.6", helpText: "Multiply quantity × this to get energy value" },
    { key: "energy_factor_uom", label: "Energy UOM", type: "select", required: true, defaultValue: defaultEnergyUOM, options: energyUOMs.map(u => ({ value: u.symbol, label: `${u.symbol} — ${u.display_name}` })) },
    { key: "emission_factor", label: "Emission Factor", type: "number", required: true, placeholder: "0.82", helpText: `Result = quantity × factor (e.g. 0.82 tCO2e per ${factorKPI?.unit ?? "unit"})` },
    { key: "emission_factor_uom", label: "Emission UOM", type: "select", required: true, defaultValue: defaultEmissionUOM, options: emissionUOMs.map(u => ({ value: u.symbol, label: `${u.symbol} — ${u.display_name}` })) },
    { key: "valid_from", label: "Valid From", type: "date", required: true },
    { key: "valid_to", label: "Valid To", type: "date", helpText: "Leave empty for current/ongoing" },
    { key: "source", label: "Source", placeholder: "IPCC 2024, CEA Grid Factor" },
  ];

  // ── Operand selector component (reused for LHS and RHS) ──────────────────
  const OperandSelector = ({
    prefix, label,
  }: { prefix: "lhs" | "rhs"; label: string }) => {
    const typeKey   = `${prefix}_type`;
    const kpiKey    = `${prefix}_kpi_id`;
    const fieldKey  = `${prefix}_field`;
    const constKey  = `${prefix}_constant`;
    const indKey    = `${prefix}_indicator_id`;
    const derKey    = `${prefix}_derived_id`;
    const currentType = (dmForm as any)[typeKey] as OperandType;

    const TYPE_BTNS: { type: OperandType; label: string }[] = [
      { type: "kpi_field",       label: "KPI" },
      { type: "indicator_field", label: "Indicator" },
      { type: "derived",         label: "Derived Metric" },
      { type: "constant",        label: "Constant" },
    ];

    return (
      <div className="flex-1 min-w-0">
        <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">{label}</label>
        {/* Type selector buttons */}
        <div className="flex flex-wrap gap-1 mb-2">
          {TYPE_BTNS.map(({ type, label: lbl }) => (
            <button key={type} type="button"
              onClick={() => setDmField(typeKey, type)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all ${currentType === type ? "bg-brand-navy text-white border-brand-navy" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}
            >{lbl}</button>
          ))}
        </div>

        {/* KPI + field */}
        {currentType === "kpi_field" && (
          <div className="flex gap-2">
            <select value={(dmForm as any)[kpiKey] || ""} onChange={(e) => setDmField(kpiKey, e.target.value)}
              className="flex-1 py-[8px] px-2.5 rounded-lg border border-slate-200 text-[12px] outline-none bg-white focus:border-brand-accent">
              <option value="">Select KPI...</option>
              {kpis.map((k) => <option key={k.kpi_id} value={k.kpi_id}>{k.kpi_name} ({k.unit})</option>)}
            </select>
            <select value={(dmForm as any)[fieldKey] || "quantity"} onChange={(e) => setDmField(fieldKey, e.target.value as OperandField)}
              className="w-[150px] py-[8px] px-2.5 rounded-lg border border-slate-200 text-[12px] outline-none bg-white focus:border-brand-accent">
              {(["quantity", "mj_value", "emission_value"] as OperandField[]).map((f) => (
                <option key={f} value={f}>{FIELD_LABELS[f]}</option>
              ))}
            </select>
          </div>
        )}

        {/* Indicator (quantity only — indicators have no factor-calculated fields) */}
        {currentType === "indicator_field" && (
          <div className="flex gap-2 items-center">
            <select value={(dmForm as any)[indKey] || ""} onChange={(e) => setDmField(indKey, e.target.value)}
              className="flex-1 py-[8px] px-2.5 rounded-lg border border-slate-200 text-[12px] outline-none bg-white focus:border-brand-accent">
              <option value="">Select Indicator...</option>
              {indicators.map((i) => <option key={i.indicator_id} value={i.indicator_id}>{i.indicator_name}</option>)}
            </select>
            <span className="text-[11px] text-slate-400 whitespace-nowrap">Quantity only</span>
          </div>
        )}

        {/* Derived metric (another step's result) */}
        {currentType === "derived" && (
          <select value={(dmForm as any)[derKey] || ""} onChange={(e) => setDmField(derKey, e.target.value)}
            className="w-full py-[8px] px-2.5 rounded-lg border border-slate-200 text-[12px] outline-none bg-white focus:border-brand-accent">
            <option value="">Select Derived Metric (Step)...</option>
            {derivedMetrics
              .filter((d) => !editDm || d.metric_id !== editDm.metric_id) // prevent self-reference
              .map((d) => <option key={d.metric_id} value={d.metric_id}>{d.name} ({d.unit})</option>)}
          </select>
        )}

        {/* Constant number */}
        {currentType === "constant" && (
          <input type="number" step="any" value={(dmForm as any)[constKey] || ""} onChange={(e) => setDmField(constKey, e.target.value)}
            placeholder="Enter a fixed number..."
            className="w-full py-[8px] px-2.5 rounded-lg border border-slate-200 text-[12px] outline-none focus:border-brand-accent" />
        )}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-[1400px]">
      {/* Row 1: Title + action button */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <Breadcrumb items={[{ label: "Company Portal", href: "/app" }, { label: "KPI Setup" }]} />
          <h1 className="text-[18px] font-bold text-brand-navy tracking-tight">KPI Setup</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {pageTab === "kpis"
              ? `${total} KPI${total !== 1 ? "s" : ""} — Define what your company tracks`
              : pageTab === "derived"
              ? `${derivedMetrics.length} derived metric${derivedMetrics.length !== 1 ? "s" : ""} — Computed from KPI data`
              : "Scope 3 emission factors and activity assignments"}
          </p>
        </div>
        <div>
          {isAdmin && pageTab === "kpis" && (
            <button onClick={openCreate} className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-brand-accent text-[12px] font-semibold text-white hover:bg-brand-accentDk transition-colors">
              <Plus size={14} /> Add KPI
            </button>
          )}
          {isAdmin && pageTab === "derived" && (
            <button onClick={openDmCreate} className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-brand-accent text-[12px] font-semibold text-white hover:bg-brand-accentDk transition-colors">
              <Plus size={14} /> Add Derived Metric
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Underline tabs */}
      <div className="flex border-b border-slate-200 mb-4">
        <button onClick={() => setPageTab("kpis")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${pageTab === "kpis" ? "border-brand-accent text-brand-accent" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"}`}>
          <BarChart3 size={14} /> KPIs
        </button>
        <button onClick={() => setPageTab("derived")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${pageTab === "derived" ? "border-brand-accent text-brand-accent" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"}`}>
          <FlaskConical size={14} /> Derived Metrics
        </button>
        <button onClick={() => setPageTab("scope3")}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${pageTab === "scope3" ? "border-brand-accent text-brand-accent" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"}`}>
          <Package2 size={14} /> Scope 3 Setup
        </button>
      </div>

      {/* ── SCOPE 3 SETUP SECTION ── */}
      {pageTab === "scope3" && (
        <Suspense fallback={<div className="bg-white rounded-xl border border-slate-200 p-6"><LoadingSkeleton rows={6} cols={3} /></div>}>
          <Scope3SetupPage embedded />
        </Suspense>
      )}

      {/* ── DERIVED METRICS SECTION ── */}
      {pageTab === "derived" && (
        <div>
          {dmLoading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6"><LoadingSkeleton rows={5} cols={4} /></div>
          ) : derivedMetrics.length === 0 ? (
            <EmptyState icon={FlaskConical} title="No derived metrics yet"
              description="Create calculated KPIs from existing data for advanced reporting">
              {isAdmin && (
                <button onClick={openDmCreate} className="mt-2 px-4 py-2 rounded-lg bg-brand-accent text-white text-[13px] font-semibold">
                  <Plus size={14} className="inline mr-1" /> Add Derived Metric
                </button>
              )}
            </EmptyState>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-[13px] border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-100 bg-slate-50/60">
                    {["Name", "Formula", "Unit", "Module", "In Report", ...(isAdmin ? ["Actions"] : [])].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {derivedMetrics.map((dm) => {
                    const mod = modules.find((m) => m.module_id === dm.module_id);
                    const ModIcon = mod ? getModuleIcon(mod.icon_name) : null;

                    const operandLabel = (type: string, kpi: DerivedMetric["lhs_kpi"], field?: string, constant?: number) => {
                      if (type === "constant") return String(constant ?? "");
                      if (!kpi) return "?";
                      return `${kpi.kpi_name} · ${FIELD_LABELS[field || ""] || field}`;
                    };
                    const opSymbol: Record<string, string> = { "+": "+", "-": "−", "*": "×", "/": "÷" };

                    return (
                      <tr key={dm.metric_id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-2">
                          <div className="font-semibold text-brand-navy">{dm.name}</div>
                          {dm.description && <div className="text-[11px] text-slate-400 truncate max-w-[180px]">{dm.description}</div>}
                        </td>
                        <td className="px-4 py-2 text-[11px] text-slate-600 font-mono max-w-[280px]">
                          {dm.formula ? (
                            <span className="text-slate-500">{displayFormula(dm.formula, kpis, indicators, derivedMetrics)}</span>
                          ) : (
                            <>
                              <span className="text-slate-500">{operandLabel(dm.lhs_type || "", dm.lhs_kpi, dm.lhs_field, dm.lhs_constant)}</span>
                              <span className="mx-1.5 font-bold text-brand-navy">{opSymbol[dm.operator || ""]}</span>
                              <span className="text-slate-500">{operandLabel(dm.rhs_type || "", dm.rhs_kpi, dm.rhs_field, dm.rhs_constant)}</span>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-2 text-slate-500 font-mono text-[12px]">{dm.unit}</td>
                        <td className="px-4 py-2">
                          {ModIcon && mod ? (
                            <span className="flex items-center gap-1.5 text-[12px] text-slate-500">
                              <ModIcon size={14} style={{ color: mod.color }} /> {mod.module_name}
                            </span>
                          ) : <span className="text-slate-300 text-[12px]">—</span>}
                        </td>
                        <td className="px-4 py-2">
                          {isAdmin ? (
                            <button onClick={() => handleDmToggleReport(dm)} title="Toggle visibility"
                              className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${dm.show_in_report ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>
                              {dm.show_in_report ? <><Eye size={11} /> In Report</> : <><EyeOff size={11} /> Intermediate</>}
                            </button>
                          ) : (
                            <span className={`text-[11px] font-semibold ${dm.show_in_report ? "text-emerald-600" : "text-amber-600"}`}>
                              {dm.show_in_report ? "In Report" : "Intermediate"}
                            </span>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1">
                              <button onClick={() => openDmEdit(dm)} title="Edit" className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-brand-navy transition-colors">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => handleDmDelete(dm)} title="Remove" className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Create / Edit Derived Metric Modal ── */}
          {dmCreateOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDmCreateOpen(false)} />
              <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col z-10">
                <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-[17px] font-bold text-brand-navy">{editDm ? "Edit Derived Metric" : "Add Derived Metric"}</h3>
                    <p className="text-[12px] text-slate-500 mt-0.5">Define a calculated column from existing KPI, Indicator, or prior step data</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Prominent intermediate step toggle — at the top where it can't be missed */}
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div
                        onClick={() => setDmField("is_intermediate", !dmForm.is_intermediate)}
                        className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${dmForm.is_intermediate ? "bg-amber-400" : "bg-emerald-500"}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${dmForm.is_intermediate ? "translate-x-0.5" : "translate-x-5"}`} />
                      </div>
                      <span className={`text-[12px] font-semibold ${dmForm.is_intermediate ? "text-amber-600" : "text-emerald-600"}`}>
                        {dmForm.is_intermediate ? "Intermediate (hidden from report)" : "Visible in report"}
                      </span>
                    </label>
                    <button onClick={() => setDmCreateOpen(false)} className="text-slate-400 hover:text-slate-600 p-1"><X size={17} /></button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
                  {/* Name + Unit */}
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Name <span className="text-red-400">*</span></label>
                      <input value={dmForm.name} onChange={(e) => setDmField("name", e.target.value)}
                        placeholder="e.g. Emission Intensity"
                        className="w-full py-[9px] px-3 rounded-lg border border-slate-200 text-[13px] outline-none focus:border-brand-accent transition-colors" />
                    </div>
                    <div className="w-[120px]">
                      <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Unit <span className="text-red-400">*</span></label>
                      <input value={dmForm.unit} onChange={(e) => setDmField("unit", e.target.value)}
                        placeholder="tCO₂e/kL"
                        className="w-full py-[9px] px-3 rounded-lg border border-slate-200 text-[13px] outline-none focus:border-brand-accent transition-colors" />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Description</label>
                    <input value={dmForm.description} onChange={(e) => setDmField("description", e.target.value)}
                      placeholder="Optional — explain what this metric represents"
                      className="w-full py-[9px] px-3 rounded-lg border border-slate-200 text-[13px] outline-none focus:border-brand-accent transition-colors" />
                  </div>

                  {/* Module + Indicator grouping */}
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Group under Module</label>
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => setDmField("module_id", "")}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all ${!dmForm.module_id ? "bg-brand-navy text-white border-brand-navy" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}>
                          None
                        </button>
                        {modules.map((m) => {
                          const Icon = getModuleIcon(m.icon_name);
                          const sel = dmForm.module_id === m.module_id;
                          return (
                            <button key={m.module_id} type="button" onClick={() => setDmField("module_id", m.module_id)}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all ${sel ? "text-white border-transparent" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}
                              style={sel ? { background: m.color, borderColor: m.color } : {}}>
                              <Icon size={11} style={{ color: sel ? "#fff" : m.color }} /> {m.module_name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="w-[200px]">
                      <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Link to Indicator</label>
                      <select value={dmForm.indicator_id || ""} onChange={(e) => setDmField("indicator_id", e.target.value)}
                        className="w-full py-[8px] px-2.5 rounded-lg border border-slate-200 text-[12px] outline-none bg-white focus:border-brand-accent">
                        <option value="">None</option>
                        {indicators
                          .filter((i) => !dmForm.module_id || i.module_id === Number(dmForm.module_id))
                          .map((i) => <option key={i.indicator_id} value={i.indicator_id}>{i.indicator_name}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Formula builder — mode toggle */}
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-[12px] font-bold text-brand-navy">Formula Builder</div>
                      <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                        <button type="button" onClick={() => setDmField("formulaMode", false)}
                          className={`px-3 py-1 text-[11px] font-semibold transition-colors ${!dmForm.formulaMode ? "bg-brand-accent text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                          Simple
                        </button>
                        <button type="button" onClick={() => setDmField("formulaMode", true)}
                          className={`px-3 py-1 text-[11px] font-semibold transition-colors ${dmForm.formulaMode ? "bg-brand-accent text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                          Formula
                        </button>
                      </div>
                    </div>

                    {!dmForm.formulaMode ? (
                      <>
                        {/* Legacy: LHS operator RHS */}
                        <div className="flex items-start gap-3">
                          <OperandSelector prefix="lhs" label="Left Operand" />
                          <div className="flex-shrink-0 pt-7">
                            <select value={dmForm.operator} onChange={(e) => setDmField("operator", e.target.value as DerivedOperator)}
                              className="py-[8px] px-2.5 rounded-lg border border-slate-200 text-[13px] font-bold text-brand-navy outline-none bg-white focus:border-brand-accent w-[120px]">
                              {Object.entries(OP_LABELS).map(([op, lbl]) => (
                                <option key={op} value={op}>{lbl}</option>
                              ))}
                            </select>
                          </div>
                          <OperandSelector prefix="rhs" label="Right Operand" />
                        </div>
                        {/* Live preview */}
                        {(() => {
                          const opSym: Record<string, string> = { "+": "+", "-": "−", "*": "×", "/": "÷", "%": "%" };
                          const operandLabel = (type: string, kpiId: string, field: string, constant: string | number, indId: string | number, derId: string) => {
                            if (type === "kpi_field")       return (kpis.find(k => k.kpi_id === kpiId)?.kpi_name || "KPI") + ` [${FIELD_LABELS[field] || field}]`;
                            if (type === "indicator_field") return indicators.find(i => String(i.indicator_id) === String(indId))?.indicator_name || "Indicator";
                            if (type === "derived")         return derivedMetrics.find(d => d.metric_id === derId)?.name || "Derived Step";
                            return String(constant || "0");
                          };
                          return (
                            <div className="mt-3 px-3 py-2 bg-white rounded-lg border border-slate-100 text-[11px] text-slate-600 font-mono">
                              <span className="text-[10px] text-slate-400 uppercase tracking-wider mr-2">Preview:</span>
                              {operandLabel(dmForm.lhs_type, dmForm.lhs_kpi_id, dmForm.lhs_field, dmForm.lhs_constant, dmForm.lhs_indicator_id, dmForm.lhs_derived_id)}
                              <span className="mx-2 font-bold text-brand-navy">{opSym[dmForm.operator] || dmForm.operator}</span>
                              {operandLabel(dmForm.rhs_type, dmForm.rhs_kpi_id, dmForm.rhs_field, dmForm.rhs_constant, dmForm.rhs_indicator_id, dmForm.rhs_derived_id)}
                            </div>
                          );
                        })()}
                      </>
                    ) : (
                      <>
                        {/* Formula mode */}
                        <div className="flex gap-3">
                          {/* Formula display + operator buttons */}
                          <div className="flex-1 flex flex-col gap-2">
                            {/* Human-readable formula display */}
                            <div className="w-full min-h-[60px] px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-[13px] font-medium text-brand-navy">
                              {dmForm.formula.trim() ? (
                                displayFormula(dmForm.formula, allKpis.length > 0 ? allKpis : kpis, indicators, derivedMetrics)
                              ) : (
                                <span className="text-slate-300 text-[12px]">Click fields from the right panel and operators below to build your formula...</span>
                              )}
                            </div>
                            {/* Operator + control buttons */}
                            <div className="flex gap-1.5 flex-wrap items-center">
                              {["+", "-", "*", "/", "(", ")", "100"].map((op) => (
                                <button key={op} type="button" onClick={() => insertFormulaToken(op === "100" ? " * 100" : ` ${op} `)}
                                  className="px-2.5 py-1 rounded border border-slate-200 text-[12px] font-mono font-bold text-brand-navy bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors">
                                  {op === "100" ? "×100" : op}
                                </button>
                              ))}
                              <div className="w-px h-5 bg-slate-200 mx-1" />
                              <button type="button" onClick={() => {
                                // Remove last token or character
                                const f = dmForm.formula;
                                const tokenMatch = f.match(/\[[^\]]+\]$/);
                                if (tokenMatch) {
                                  setDmField("formula", f.slice(0, f.length - tokenMatch[0].length).trimEnd());
                                } else {
                                  setDmField("formula", f.trimEnd().slice(0, -1).trimEnd());
                                }
                              }}
                                className="px-2.5 py-1 rounded border border-slate-200 text-[11px] font-semibold text-amber-600 bg-white hover:bg-amber-50 hover:border-amber-300 transition-colors"
                                title="Remove last item">⌫ Undo</button>
                              <button type="button" onClick={() => setDmField("formula", "")}
                                className="px-2.5 py-1 rounded border border-slate-200 text-[11px] font-semibold text-red-500 bg-white hover:bg-red-50 hover:border-red-300 transition-colors"
                                title="Clear entire formula">Clear</button>
                            </div>
                          </div>

                          {/* Fields panel */}
                          <div className="w-[220px] flex-shrink-0 bg-white rounded-lg border border-slate-200 max-h-[280px] overflow-y-auto">
                            <div className="px-3 py-2 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider sticky top-0 bg-white">
                              Available Fields
                            </div>
                            {modules.map((mod) => {
                              const modInds = indicators.filter((i) => i.module_id === mod.module_id);
                              const fKpis = (allKpis.length > 0 ? allKpis : kpis).filter((k) => k.module_id === mod.module_id);
                              if (fKpis.length === 0 && modInds.length === 0) return null;
                              const ModIcon = getModuleIcon(mod.icon_name);
                              return (
                                <div key={mod.module_id}>
                                  <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5 border-b border-slate-100">
                                    <ModIcon size={11} style={{ color: mod.color }} />{mod.module_name}
                                  </div>
                                  {modInds.map((ind) => {
                                    const indKpis = fKpis.filter((k) => k.indicator_id === ind.indicator_id);
                                    const isDirect = indKpis.length === 0;
                                    return (
                                      <div key={ind.indicator_id}>
                                        {isDirect ? (
                                          <button type="button" onClick={() => insertFormulaToken(`[ind:${ind.indicator_id}]`)}
                                            className="w-full text-left px-3 py-1.5 text-[11px] text-brand-navy hover:bg-sky-50 transition-colors flex items-center gap-1.5 border-b border-slate-50">
                                            <span className="text-sky-500 text-[9px] font-bold">IND</span>
                                            <span className="truncate">{ind.indicator_name}</span>
                                          </button>
                                        ) : (
                                          <>
                                            <div className="px-3 py-1 text-[10px] text-slate-400 font-semibold border-b border-slate-50">{ind.indicator_name}</div>
                                            {indKpis.map((k) => (
                                              <div key={k.kpi_id} className="flex border-b border-slate-50">
                                                <button type="button" onClick={() => insertFormulaToken(`[kpi:${k.kpi_id}:quantity]`)}
                                                  className="flex-1 text-left pl-5 pr-1 py-1.5 text-[11px] text-brand-navy hover:bg-sky-50 transition-colors truncate">
                                                  {k.kpi_name}
                                                </button>
                                                <button type="button" onClick={() => insertFormulaToken(`[kpi:${k.kpi_id}:mj_value]`)} title="MJ value"
                                                  className="px-1.5 py-1.5 text-[9px] font-bold text-amber-500 hover:bg-amber-50 transition-colors">MJ</button>
                                                <button type="button" onClick={() => insertFormulaToken(`[kpi:${k.kpi_id}:emission_value]`)} title="Emission value"
                                                  className="px-1.5 py-1.5 text-[9px] font-bold text-red-400 hover:bg-red-50 transition-colors">CO₂</button>
                                              </div>
                                            ))}
                                          </>
                                        )}
                                      </div>
                                    );
                                  })}
                                  {/* KPIs not under any indicator */}
                                  {fKpis.filter((k) => !k.indicator_id).map((k) => (
                                    <div key={k.kpi_id} className="flex border-b border-slate-50">
                                      <button type="button" onClick={() => insertFormulaToken(`[kpi:${k.kpi_id}:quantity]`)}
                                        className="flex-1 text-left px-3 py-1.5 text-[11px] text-brand-navy hover:bg-sky-50 transition-colors truncate">
                                        {k.kpi_name}
                                      </button>
                                      <button type="button" onClick={() => insertFormulaToken(`[kpi:${k.kpi_id}:mj_value]`)} title="MJ value"
                                        className="px-1.5 py-1.5 text-[9px] font-bold text-amber-500 hover:bg-amber-50 transition-colors">MJ</button>
                                      <button type="button" onClick={() => insertFormulaToken(`[kpi:${k.kpi_id}:emission_value]`)} title="Emission value"
                                        className="px-1.5 py-1.5 text-[9px] font-bold text-red-400 hover:bg-red-50 transition-colors">CO₂</button>
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                            {/* Existing derived metrics */}
                            {derivedMetrics.filter((d) => d.metric_id !== editDm?.metric_id).length > 0 && (
                              <>
                                <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase border-b border-slate-100 border-t">
                                  Derived Metrics
                                </div>
                                {derivedMetrics.filter((d) => d.metric_id !== editDm?.metric_id).map((d) => (
                                  <button key={d.metric_id} type="button" onClick={() => insertFormulaToken(`[dm:${d.metric_id}]`)}
                                    className="w-full text-left px-3 py-1.5 text-[11px] text-purple-700 hover:bg-purple-50 transition-colors border-b border-slate-50 truncate">
                                    {d.name} ({d.unit})
                                  </button>
                                ))}
                              </>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Step order — used to ensure intermediate steps compute before final steps */}
                  <div className="flex items-center gap-3">
                    <label className="text-[12px] font-semibold text-slate-600">Step / Display Order</label>
                    <input type="number" min={0} value={dmForm.display_order}
                      onChange={(e) => setDmField("display_order", e.target.value)}
                      className="w-[60px] py-1.5 px-2 rounded-lg border border-slate-200 text-[12px] outline-none focus:border-brand-accent text-center" />
                    <span className="text-[11px] text-slate-400">Lower = computed first. Intermediate steps must have lower order than final steps that reference them.</span>
                  </div>
                </div>

                <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
                  <button onClick={() => setDmCreateOpen(false)} className="px-4 py-2.5 rounded-lg border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
                  <button onClick={handleDmSave} disabled={actionLoading} className="px-5 py-2.5 rounded-lg bg-brand-accent text-[13px] font-semibold text-white hover:bg-brand-accentDk transition-colors disabled:opacity-60">
                    {actionLoading ? "Saving..." : editDm ? "Update" : "Create"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── KPI SECTION (only when pageTab === "kpis") ── */}
      {pageTab === "kpis" && <>

      {/* Module Tabs */}
      <div className="flex gap-1 mb-5 bg-slate-100 rounded-lg p-1 w-fit">
        <button onClick={() => { setActiveModule(null); setPage(1); }} className={`px-4 py-2 rounded-md text-[13px] font-semibold transition-all ${!activeModule ? "bg-white text-brand-navy shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
          All
        </button>
        {modules.map((m) => {
          const Icon = getModuleIcon(m.icon_name);
          return (
            <button key={m.module_id} onClick={() => { setActiveModule(m.module_id); setPage(1); }} className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-semibold transition-all ${activeModule === m.module_id ? "bg-white text-brand-navy shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
              <Icon size={14} style={{ color: m.color }} /> {m.module_name}
            </button>
          );
        })}
      </div>

      <div className="flex gap-5">
        {/* KPIs table */}
        <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${factorKPI ? "flex-1" : "w-full"} transition-all`}>
          {loading ? (
            <div className="p-6"><LoadingSkeleton rows={8} cols={6} /></div>
          ) : kpis.length === 0 ? (
            <EmptyState icon={BarChart3} title="No KPIs found" description={activeModule ? "No KPIs in this module yet" : "Define your first ESG KPI to start tracking"}>
              {isAdmin && <button onClick={openCreate} className="mt-2 px-4 py-2 rounded-lg bg-brand-accent text-white text-[13px] font-semibold"><Plus size={14} className="inline mr-1" /> Add KPI</button>}
            </EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-100 bg-slate-50/60">
                    {["KPI", "Unit", "Module", "Scope", "Energy Type", "Factors", ...(isAdmin ? ["Actions"] : [])].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {kpis.map((m) => {
                    const mod = modules.find((x) => x.module_id === m.module_id);
                    const ModIcon = mod ? getModuleIcon(mod.icon_name) : null;
                    return (
                      <tr key={m.kpi_id} className={`border-b border-slate-100 hover:bg-slate-50/60 transition-colors ${factorKPI?.kpi_id === m.kpi_id ? "bg-sky-50/40" : ""}`}>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-brand-navy">{m.kpi_name}</span>
                            {m.input_type && m.input_type !== "numeric" && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${m.input_type === "boolean" ? "bg-violet-50 text-violet-600" : "bg-amber-50 text-amber-600"}`}>
                                {m.input_type === "boolean" ? "Yes/No" : "Text"}
                              </span>
                            )}
                          </div>
                          {m.description && <div className="text-[11px] text-slate-400 truncate max-w-[200px]">{m.description}</div>}
                        </td>
                        <td className="px-4 py-2 text-slate-500 font-mono text-[12px]">{m.input_type === "numeric" || !m.input_type ? m.unit : "—"}</td>
                        <td className="px-4 py-2">
                          {ModIcon && mod && (
                            <span className="flex items-center gap-1.5 text-[12px] text-slate-500">
                              <ModIcon size={14} style={{ color: mod.color }} /> {mod.module_name}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {m.scope_number ? (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${scopeColors[m.scope_number]}`}>
                              Scope {m.scope_number}
                            </span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-2 text-[12px] text-slate-500">{m.energy_type ? energyLabel[m.energy_type] : "—"}</td>
                        <td className="px-4 py-2">
                          <button onClick={() => loadFactors(m)} className="flex items-center gap-1 text-[12px] font-semibold text-brand-accent hover:underline">
                            View <ChevronRight size={12} />
                          </button>
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1">
                              <button onClick={() => openEdit(m)} title="Edit KPI" className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-brand-navy transition-colors">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => handleDeactivate(m)} title="Deactivate" className="p-1.5 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <span className="text-[12px] text-slate-500">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
              <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"><ChevronLeft size={16} className="text-slate-500" /></button>
                <span className="px-3 text-[12px] font-semibold text-brand-navy">{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"><ChevronRight size={16} className="text-slate-500" /></button>
              </div>
            </div>
          )}
        </div>

        {/* Conversion Factors Panel (slide-over) */}
        {factorKPI && (
          <div className="w-[400px] bg-white rounded-xl border border-slate-200 flex flex-col animate-slide-in-right flex-shrink-0">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <div className="text-[14px] font-bold text-brand-navy">Conversion Factors</div>
                <div className="text-[12px] text-slate-400">{factorKPI.kpi_name} ({factorKPI.unit})</div>
              </div>
              <div className="flex items-center gap-1">
                {isAdmin && (
                  <button onClick={() => setAddFactorOpen(true)} className="p-1.5 rounded-md bg-brand-accent/10 text-brand-accent hover:bg-brand-accent/20 transition-colors">
                    <Plus size={16} />
                  </button>
                )}
                <button onClick={() => setFactorKPI(null)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {factorsLoading ? (
                <LoadingSkeleton rows={3} cols={2} />
              ) : factors.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[13px] text-slate-400 mb-3">No conversion factors yet</p>
                  {isAdmin && (
                    <button onClick={() => setAddFactorOpen(true)} className="text-[12px] font-semibold text-brand-accent hover:underline">
                      + Add first factor
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {factors.map((f) => {
                    const today = new Date().toISOString().slice(0, 10);
                    const isActive = f.valid_from <= today && (!f.valid_to || f.valid_to >= today);
                    const isEditing = editFactorId === f.factor_id;
                    return (
                      <div key={f.factor_id} className={`p-3.5 rounded-lg border ${isActive ? "border-brand-accent/40 bg-sky-50/40" : "border-slate-100 bg-slate-50/40"}`}>
                        <div className="flex items-center justify-between mb-2">
                          {isEditing ? (
                            <div className="grid grid-cols-2 gap-2 text-[12px] flex-1">
                              <div className="flex flex-col gap-1">
                                <span className="text-slate-400 text-[11px]">Energy Factor</span>
                                <div className="flex gap-1">
                                  <input type="number" step="any" value={editFactorForm.energy_factor}
                                    onChange={e => setEditFactorForm(p => ({ ...p, energy_factor: e.target.value }))}
                                    className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-200 text-[12px] font-mono text-brand-navy focus:border-brand-accent outline-none" />
                                  <select value={editFactorForm.energy_factor_uom}
                                    onChange={e => setEditFactorForm(p => ({ ...p, energy_factor_uom: e.target.value }))}
                                    className="w-20 px-1 py-1 rounded border border-slate-200 text-[11px] text-brand-navy focus:border-brand-accent outline-none bg-white">
                                    {energyUOMs.map(u => <option key={u.symbol} value={u.symbol}>{u.symbol}</option>)}
                                  </select>
                                </div>
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-slate-400 text-[11px]">Emission Factor</span>
                                <div className="flex gap-1">
                                  <input type="number" step="any" value={editFactorForm.emission_factor}
                                    onChange={e => setEditFactorForm(p => ({ ...p, emission_factor: e.target.value }))}
                                    className="flex-1 min-w-0 px-2 py-1 rounded border border-slate-200 text-[12px] font-mono text-brand-navy focus:border-brand-accent outline-none" />
                                  <select value={editFactorForm.emission_factor_uom}
                                    onChange={e => setEditFactorForm(p => ({ ...p, emission_factor_uom: e.target.value }))}
                                    className="w-20 px-1 py-1 rounded border border-slate-200 text-[11px] text-brand-navy focus:border-brand-accent outline-none bg-white">
                                    {emissionUOMs.map(u => <option key={u.symbol} value={u.symbol}>{u.symbol}</option>)}
                                  </select>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2 text-[12px] flex-1">
                              <div>
                                <span className="text-slate-400">Energy:</span>
                                <span className="font-bold text-brand-navy ml-1">
                                  {f.energy_factor} {f.energy_factor_uom}{factorKPI?.unit ? ` / ${factorKPI.unit}` : ""}
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-400">Emission:</span>
                                <span className="font-bold text-brand-navy ml-1">
                                  {f.emission_factor} {f.emission_factor_uom}{factorKPI?.unit ? ` / ${factorKPI.unit}` : ""}
                                </span>
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                            {isActive && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-accent text-white">
                                Active
                              </span>
                            )}
                            {isAdmin && !isEditing && (
                              <button onClick={() => startEditFactor(f)} title="Edit factor"
                                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                                <Pencil size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                        {isEditing && (
                          <div className="flex gap-2 mb-2">
                            <button onClick={handleSaveFactorEdit} disabled={actionLoading}
                              className="px-3 py-1 text-[11px] font-semibold rounded-md bg-brand-accent text-white hover:bg-brand-accent/90 transition-colors disabled:opacity-50">
                              {actionLoading ? "Saving..." : "Save"}
                            </button>
                            <button onClick={() => setEditFactorId(null)}
                              className="px-3 py-1 text-[11px] font-semibold rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                              Cancel
                            </button>
                          </div>
                        )}
                        <div className="text-[11px] text-slate-400">
                          {formatDate(f.valid_from)}{f.valid_to ? ` → ${formatDate(f.valid_to)}` : " → Present"}
                          {f.source && <span className="ml-2 text-slate-300">· {f.source}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Custom Add KPI Modal ── */}
      {createOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCreateOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col z-10">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-[17px] font-bold text-brand-navy">Add KPI</h3>
                <p className="text-[12px] text-slate-500 mt-0.5">Define a new ESG KPI for your company</p>
              </div>
              <button onClick={() => setCreateOpen(false)} className="text-slate-400 hover:text-slate-600 p-1"><X size={17} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
              {/* Module */}
              <div>
                <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Module <span className="text-red-400">*</span></label>
                <div className="flex flex-wrap gap-2">
                  {modules.map((m) => {
                    const Icon = getModuleIcon(m.icon_name);
                    const sel = kpiForm.module_id === m.module_id;
                    return (
                      <button key={m.module_id} type="button"
                        onClick={() => { setKpiField("module_id", m.module_id); setKpiField("energy_type", undefined); setKpiField("scope_number", undefined); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${sel ? "text-white border-transparent" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}
                        style={sel ? { background: m.color, borderColor: m.color } : {}}
                      >
                        <Icon size={13} style={{ color: sel ? "#fff" : m.color }} /> {m.module_name}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Indicator */}
              <div>
                <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Indicator</label>
                <select value={kpiForm.indicator_id || ""} onChange={(e) => setKpiField("indicator_id", e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full py-[9px] px-3 rounded-lg border border-slate-200 text-[13px] outline-none bg-white focus:border-brand-accent transition-colors">
                  <option value="">Select Indicator (optional)...</option>
                  {indicators
                    .filter((c) => !kpiForm.module_id || c.module_id === kpiForm.module_id)
                    .map((c) => <option key={c.indicator_id} value={c.indicator_id}>{c.indicator_name}</option>)}
                </select>
              </div>
              {/* KPI Name */}
              <div>
                <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">KPI Name <span className="text-red-400">*</span></label>
                <input type="text" value={kpiForm.kpi_name || ""} onChange={(e) => setKpiField("kpi_name", e.target.value)}
                  className="w-full py-[9px] px-3 rounded-lg border border-slate-200 text-[13px] outline-none focus:border-brand-accent transition-colors" />
              </div>
              {/* Input Type */}
              <div>
                <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Input Type</label>
                <div className="flex gap-2">
                  {[{ v: "numeric", l: "Numeric" }, { v: "boolean", l: "Yes / No" }, { v: "text", l: "Text" }].map(({ v, l }) => (
                    <button key={v} type="button"
                      onClick={() => setKpiField("input_type", v)}
                      className={`flex-1 py-2 rounded-lg border text-[12px] font-semibold transition-all ${(kpiForm.input_type ?? "numeric") === v ? "bg-brand-navy text-white border-brand-navy" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {/* Unit — only required for numeric */}
              {(kpiForm.input_type ?? "numeric") === "numeric" && (
                <div>
                  <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Unit <span className="text-red-400">*</span></label>
                  <select value={kpiForm.unit || ""} onChange={(e) => setKpiField("unit", e.target.value)}
                    className="w-full py-[9px] px-3 rounded-lg border border-slate-200 text-[13px] outline-none focus:border-brand-accent transition-colors bg-white text-brand-navy">
                    <option value="">— Select unit —</option>
                    {kpiUnitOptions.map((u) => (
                      <option key={u.uom_id} value={u.symbol}>{u.symbol} — {u.display_name}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">Unit in which this KPI is measured</p>
                </div>
              )}
              {/* Description */}
              <div>
                <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Description</label>
                <textarea value={kpiForm.description || ""} onChange={(e) => setKpiField("description", e.target.value)}
                  rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[13px] outline-none focus:border-brand-accent resize-none transition-colors" />
              </div>
              {/* GHG Scope — for Energy (combustion → emissions) and Emissions modules; numeric only */}
              {(kpiForm.input_type ?? "numeric") === "numeric" && (() => {
                const selMod = modules.find(m => m.module_id === kpiForm.module_id);
                const isEnergy = selMod?.key === "energy";
                const isEmissions = selMod?.render_type === "auto_computed";
                if (!isEnergy && !isEmissions) return null;
                return (
                  <div>
                    <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">
                      GHG Scope
                      {isEnergy && (
                        <span className="ml-2 text-[10px] font-normal text-slate-400">Combustion of this fuel will contribute to this scope's emissions total</span>
                      )}
                    </label>
                    <select value={kpiForm.scope_number || ""} onChange={(e) => setKpiField("scope_number", e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full py-[9px] px-3 rounded-lg border border-slate-200 text-[13px] outline-none bg-white focus:border-brand-accent transition-colors">
                      <option value="">Select scope...</option>
                      <option value={1}>Scope 1 — Direct (e.g. diesel, coal combustion)</option>
                      <option value={2}>Scope 2 — Indirect (e.g. grid electricity)</option>
                      <option value={3}>Scope 3 — Value Chain</option>
                    </select>
                  </div>
                );
              })()}
              {/* Energy Type — only for Energy module + numeric KPIs */}
              {(kpiForm.input_type ?? "numeric") === "numeric" && modules.find(m => m.module_id === kpiForm.module_id)?.key === "energy" && (
                <div>
                  <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Energy Type</label>
                  <select value={kpiForm.energy_type || ""} onChange={(e) => setKpiField("energy_type", e.target.value || undefined)}
                    className="w-full py-[9px] px-3 rounded-lg border border-slate-200 text-[13px] outline-none bg-white focus:border-brand-accent transition-colors">
                    <option value="">Select type...</option>
                    <option value="RENEWABLE">Renewable</option>
                    <option value="NON_RENEWABLE">Non-Renewable</option>
                    <option value="NOT_APPLICABLE">Not Applicable</option>
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setCreateOpen(false)} className="px-4 py-2.5 rounded-lg border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={actionLoading} className="px-5 py-2.5 rounded-lg bg-brand-accent text-[13px] font-semibold text-white hover:bg-brand-accentDk transition-colors disabled:opacity-60">
                {actionLoading ? "Saving..." : "Add KPI"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <FormDialog open={addFactorOpen} onClose={() => setAddFactorOpen(false)} onSubmit={handleAddFactor} title={`Add Factor — ${factorKPI?.kpi_name || ""}`} description="Set energy and emission conversion rates" fields={factorFields} submitLabel="Add Factor" loading={actionLoading} />

      <ConfirmDialog
        open={recalcConfirm !== null}
        onClose={() => setRecalcConfirm(null)}
        onConfirm={handleRecalculate}
        title="Update Factor & Recalculate?"
        message={`${recalcConfirm?.count ?? 0} data record(s) use this factor. Updating will change the factor and recalculate MJ and emission values for all affected records. Cancel to keep the existing factor unchanged.`}
        confirmLabel="Update & Recalculate"
        loading={actionLoading}
      />

      {/* ── Edit KPI Modal ── */}
      {editKPI && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setEditKPI(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col z-10">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-[17px] font-bold text-brand-navy">Edit KPI</h3>
                <p className="text-[12px] text-slate-500 mt-0.5">{editKPI.kpi_name}</p>
              </div>
              <button onClick={() => setEditKPI(null)} className="text-slate-400 hover:text-slate-600 p-1"><X size={17} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
              {/* Module — read-only in edit (changing module would mismatch indicator_id) */}
              <div>
                <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Module</label>
                {(() => {
                  const mod = modules.find((m) => m.module_id === kpiForm.module_id);
                  const Icon = mod ? getModuleIcon(mod.icon_name) : null;
                  return mod ? (
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 w-fit text-[12px] font-semibold text-slate-600">
                      {Icon && <Icon size={13} style={{ color: mod.color }} />}
                      {mod.module_name}
                      <span className="ml-1 text-[10px] text-slate-400 font-normal">(cannot be changed)</span>
                    </div>
                  ) : null;
                })()}
              </div>
              {/* Indicator */}
              <div>
                <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Indicator</label>
                <select value={kpiForm.indicator_id || ""} onChange={(e) => setKpiField("indicator_id", e.target.value)}
                  className="w-full py-[9px] px-3 rounded-lg border border-slate-200 text-[13px] outline-none bg-white focus:border-brand-accent transition-colors">
                  <option value="">No Indicator (unassigned)</option>
                  {indicators
                    .filter((c) => !kpiForm.module_id || c.module_id === kpiForm.module_id)
                    .map((c) => <option key={c.indicator_id} value={c.indicator_id}>{c.indicator_name}</option>)}
                </select>
              </div>
              {/* KPI Name */}
              <div>
                <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">KPI Name <span className="text-red-400">*</span></label>
                <input type="text" value={kpiForm.kpi_name || ""} onChange={(e) => setKpiField("kpi_name", e.target.value)}
                  className="w-full py-[9px] px-3 rounded-lg border border-slate-200 text-[13px] outline-none focus:border-brand-accent transition-colors" />
              </div>
              {/* Input Type */}
              <div>
                <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Input Type</label>
                <div className="flex gap-2">
                  {[{ v: "numeric", l: "Numeric" }, { v: "boolean", l: "Yes / No" }, { v: "text", l: "Text" }].map(({ v, l }) => (
                    <button key={v} type="button"
                      onClick={() => setKpiField("input_type", v)}
                      className={`flex-1 py-2 rounded-lg border text-[12px] font-semibold transition-all ${(kpiForm.input_type ?? "numeric") === v ? "bg-brand-navy text-white border-brand-navy" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {/* Unit — only for numeric */}
              {(kpiForm.input_type ?? "numeric") === "numeric" && (
                <div>
                  <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Unit <span className="text-red-400">*</span></label>
                  <select value={kpiForm.unit || ""} onChange={(e) => setKpiField("unit", e.target.value)}
                    className="w-full py-[9px] px-3 rounded-lg border border-slate-200 text-[13px] outline-none focus:border-brand-accent transition-colors bg-white text-brand-navy">
                    <option value="">— Select unit —</option>
                    {kpiUnitOptions.map((u) => (
                      <option key={u.uom_id} value={u.symbol}>{u.symbol} — {u.display_name}</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Description */}
              <div>
                <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Description</label>
                <textarea value={kpiForm.description || ""} onChange={(e) => setKpiField("description", e.target.value)}
                  rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[13px] outline-none focus:border-brand-accent resize-none transition-colors" />
              </div>
              {/* GHG Scope — for Energy and Emissions modules; numeric only */}
              {(kpiForm.input_type ?? "numeric") === "numeric" && (() => {
                const selMod = modules.find(m => m.module_id === kpiForm.module_id);
                const isEnergy = selMod?.key === "energy";
                const isEmissions = selMod?.render_type === "auto_computed";
                if (!isEnergy && !isEmissions) return null;
                return (
                  <div>
                    <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">
                      GHG Scope
                      {isEnergy && <span className="ml-2 text-[10px] font-normal text-slate-400">Combustion of this fuel contributes to this scope's emissions</span>}
                    </label>
                    <select value={kpiForm.scope_number || ""} onChange={(e) => setKpiField("scope_number", e.target.value)}
                      className="w-full py-[9px] px-3 rounded-lg border border-slate-200 text-[13px] outline-none bg-white focus:border-brand-accent transition-colors">
                      <option value="">No scope</option>
                      <option value={1}>Scope 1 — Direct (e.g. diesel, coal combustion)</option>
                      <option value={2}>Scope 2 — Indirect (e.g. grid electricity)</option>
                      <option value={3}>Scope 3 — Value Chain</option>
                    </select>
                  </div>
                );
              })()}
              {/* Energy Type — only for Energy module + numeric KPIs */}
              {(kpiForm.input_type ?? "numeric") === "numeric" && modules.find(m => m.module_id === kpiForm.module_id)?.key === "energy" && (
                <div>
                  <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Energy Type</label>
                  <select value={kpiForm.energy_type || ""} onChange={(e) => setKpiField("energy_type", e.target.value)}
                    className="w-full py-[9px] px-3 rounded-lg border border-slate-200 text-[13px] outline-none bg-white focus:border-brand-accent transition-colors">
                    <option value="">Select type...</option>
                    <option value="RENEWABLE">Renewable</option>
                    <option value="NON_RENEWABLE">Non-Renewable</option>
                    <option value="NOT_APPLICABLE">Not Applicable</option>
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setEditKPI(null)} className="px-4 py-2.5 rounded-lg border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleEdit} disabled={actionLoading} className="px-5 py-2.5 rounded-lg bg-brand-accent text-[13px] font-semibold text-white hover:bg-brand-accentDk transition-colors disabled:opacity-60">
                {actionLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
      </> /* end KPI section */}
    </div>
  );
}
