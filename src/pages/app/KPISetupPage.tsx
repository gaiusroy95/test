import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { tenantApi } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { getModuleIcon } from "@/lib/constants";
import { useModulesStore } from "@/store/modules";
import { LoadingSkeleton, EmptyState } from "@/components/shared/PageComponents";
import { PageShell } from "@/components/shared/PageShell";
import { PageTabs } from "@/components/shared/PageTabs";
import { FormDialog, type FormField } from "@/components/shared/FormDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormField as WorkspaceField } from "@/components/shared/FormField";
import { FormSection, FormRow } from "@/components/shared/FormWorkspace";
import { useIsSupportSession } from "@/components/shared/WriteOnly";
import { toast } from "sonner";
import {
  Plus, BarChart3, ChevronRight, ChevronLeft, Pencil, Trash2,
  FlaskConical, Eye, EyeOff, Package2,
} from "lucide-react";
import {
  Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  SelectGroup, SelectLabel,
} from "@/components/ui/select";

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

  const scopeColors: Record<number, string> = { 1: "bg-destructive-tint text-destructive", 2: "bg-warn-tint text-warn", 3: "bg-info-tint text-info" };
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
        <label className="block text-[12px] font-semibold text-foreground mb-1.5">{label}</label>
        {/* Type selector buttons */}
        <div className="flex flex-wrap gap-1 mb-2">
          {TYPE_BTNS.map(({ type, label: lbl }) => (
            <button key={type} type="button"
              onClick={() => setDmField(typeKey, type)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all ${currentType === type ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground border-border hover:border-border"}`}
            >{lbl}</button>
          ))}
        </div>

        {/* KPI + field */}
        {currentType === "kpi_field" && (
          <div className="flex gap-2">
            <Select value={String((dmForm as any)[kpiKey] || "__none__")} onValueChange={(value) => setDmField(kpiKey, value === "__none__" ? "" : value)}>
              <SelectTrigger className="flex-1 h-[36px] text-[12px]">
                <SelectValue placeholder="Select KPI..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select KPI...</SelectItem>
                {kpis.map((k) => <SelectItem key={k.kpi_id} value={String(k.kpi_id)}>{k.kpi_name} ({k.unit})</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String((dmForm as any)[fieldKey] || "quantity")} onValueChange={(value) => setDmField(fieldKey, value as OperandField)}>
              <SelectTrigger className="w-[150px] h-[36px] text-[12px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["quantity", "mj_value", "emission_value"] as OperandField[]).map((f) => (
                  <SelectItem key={f} value={f}>{FIELD_LABELS[f]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Indicator (quantity only — indicators have no factor-calculated fields) */}
        {currentType === "indicator_field" && (
          <div className="flex gap-2 items-center">
            <Select value={String((dmForm as any)[indKey] || "__none__")} onValueChange={(value) => setDmField(indKey, value === "__none__" ? "" : value)}>
              <SelectTrigger className="flex-1 h-[36px] text-[12px]">
                <SelectValue placeholder="Select Indicator..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select Indicator...</SelectItem>
                {indicators.map((i) => <SelectItem key={i.indicator_id} value={String(i.indicator_id)}>{i.indicator_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-[11px] text-muted-foreground whitespace-nowrap">Quantity only</span>
          </div>
        )}

        {/* Derived metric (another step's result) */}
        {currentType === "derived" && (
          <Select value={String((dmForm as any)[derKey] || "__none__")} onValueChange={(value) => setDmField(derKey, value === "__none__" ? "" : value)}>
            <SelectTrigger className="h-[36px] text-[12px]">
              <SelectValue placeholder="Select Derived Metric (Step)..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Select Derived Metric (Step)...</SelectItem>
              {derivedMetrics
                .filter((d) => !editDm || d.metric_id !== editDm.metric_id)
                .map((d) => <SelectItem key={d.metric_id} value={String(d.metric_id)}>{d.name} ({d.unit})</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {/* Constant number */}
        {currentType === "constant" && (
          <input type="number" step="any" value={(dmForm as any)[constKey] || ""} onChange={(e) => setDmField(constKey, e.target.value)}
            placeholder="Enter a fixed number..."
            className="w-full py-[8px] px-2.5 rounded-lg border border-border text-[12px] outline-none focus:border-primary" />
        )}
      </div>
    );
  };

  const kpiSubtitle = pageTab === "kpis"
    ? `${total} KPI${total !== 1 ? "s" : ""} — Define what your company tracks`
    : pageTab === "derived"
      ? `${derivedMetrics.length} derived metric${derivedMetrics.length !== 1 ? "s" : ""} — Computed from KPI data`
      : "Scope 3 emission factors and activity assignments";

  const pageActions = isAdmin ? (
    pageTab === "kpis" ? (
      <button onClick={openCreate} className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-primary text-[12px] font-semibold text-white hover:bg-primaryDk transition-colors">
        <Plus size={14} /> Add KPI
      </button>
    ) : pageTab === "derived" ? (
      <button onClick={openDmCreate} className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-primary text-[12px] font-semibold text-white hover:bg-primaryDk transition-colors">
        <Plus size={14} /> Add Derived Metric
      </button>
    ) : null
  ) : null;

  return (
    <PageShell
      title="KPI Setup"
      description={kpiSubtitle}
      breadcrumb={[{ label: "Company Portal", href: "/app" }, { label: "KPI Setup" }]}
      className="max-w-[1400px]"
      actions={pageActions}
      toolbar={
        <PageTabs
          value={pageTab}
          onChange={(key) => setPageTab(key as PageTab)}
          tabs={[
            { key: "kpis", label: "KPIs", icon: <BarChart3 size={14} /> },
            { key: "derived", label: "Derived Metrics", icon: <FlaskConical size={14} /> },
            { key: "scope3", label: "Scope 3 Setup", icon: <Package2 size={14} /> },
          ]}
        />
      }
    >

      {/* ── SCOPE 3 SETUP SECTION ── */}
      {pageTab === "scope3" && (
        <Suspense fallback={<div className="bg-card rounded-xl border border-border p-6"><LoadingSkeleton rows={6} cols={3} /></div>}>
          <Scope3SetupPage embedded />
        </Suspense>
      )}

      {/* ── DERIVED METRICS SECTION ── */}
      {pageTab === "derived" && (
        <div>
          {dmLoading ? (
            <div className="bg-card rounded-xl border border-border p-6"><LoadingSkeleton rows={5} cols={4} /></div>
          ) : derivedMetrics.length === 0 ? (
            <EmptyState icon={FlaskConical} title="No derived metrics yet"
              description="Create calculated KPIs from existing data for advanced reporting">
              {isAdmin && (
                <button onClick={openDmCreate} className="mt-2 px-4 py-2 rounded-lg bg-primary text-white text-[13px] font-semibold">
                  <Plus size={14} className="inline mr-1" /> Add Derived Metric
                </button>
              )}
            </EmptyState>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <table className="w-full text-[13px] border-collapse">
                <thead>
                  <tr className="border-b-2 border-[hsl(var(--border-hairline))] bg-sunken/60">
                    {["Name", "Formula", "Unit", "Module", "In Report", ...(isAdmin ? ["Actions"] : [])].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">{h}</th>
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
                      <tr key={dm.metric_id} className="border-b border-[hsl(var(--border-hairline))] hover:bg-sunken/50 transition-colors">
                        <td className="px-4 py-2">
                          <div className="font-semibold text-foreground">{dm.name}</div>
                          {dm.description && <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">{dm.description}</div>}
                        </td>
                        <td className="px-4 py-2 text-[11px] text-muted-foreground font-mono max-w-[280px]">
                          {dm.formula ? (
                            <span className="text-muted-foreground">{displayFormula(dm.formula, kpis, indicators, derivedMetrics)}</span>
                          ) : (
                            <>
                              <span className="text-muted-foreground">{operandLabel(dm.lhs_type || "", dm.lhs_kpi, dm.lhs_field, dm.lhs_constant)}</span>
                              <span className="mx-1.5 font-bold text-foreground">{opSymbol[dm.operator || ""]}</span>
                              <span className="text-muted-foreground">{operandLabel(dm.rhs_type || "", dm.rhs_kpi, dm.rhs_field, dm.rhs_constant)}</span>
                            </>
                          )}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground font-mono text-[12px]">{dm.unit}</td>
                        <td className="px-4 py-2">
                          {ModIcon && mod ? (
                            <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                              <ModIcon size={14} style={{ color: mod.color }} /> {mod.module_name}
                            </span>
                          ) : <span className="text-muted-foreground/40 text-[12px]">—</span>}
                        </td>
                        <td className="px-4 py-2">
                          {isAdmin ? (
                            <button onClick={() => handleDmToggleReport(dm)} title="Toggle visibility"
                              className={`flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${dm.show_in_report ? "bg-ok-tint text-ok" : "bg-warn-tint text-warn"}`}>
                              {dm.show_in_report ? <><Eye size={11} /> In Report</> : <><EyeOff size={11} /> Intermediate</>}
                            </button>
                          ) : (
                            <span className={`text-[11px] font-semibold ${dm.show_in_report ? "text-ok" : "text-warn"}`}>
                              {dm.show_in_report ? "In Report" : "Intermediate"}
                            </span>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1">
                              <button onClick={() => openDmEdit(dm)} title="Edit" className="p-1.5 rounded-md hover:bg-sunken text-muted-foreground hover:text-foreground transition-colors">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => handleDmDelete(dm)} title="Remove" className="p-1.5 rounded-md hover:bg-destructive-tint text-muted-foreground hover:text-destructive transition-colors">
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

          {/* ── Create / Edit Derived Metric ── */}
          <Sheet open={dmCreateOpen} onOpenChange={(open) => { if (!open) setDmCreateOpen(false); }}>
            <SheetContent className="max-w-[920px]">
              <SheetHeader>
                <div className="flex items-start justify-between gap-3 pr-8">
                  <div>
                    <SheetTitle>{editDm ? "Edit Derived Metric" : "Add Derived Metric"}</SheetTitle>
                    <p className="text-[12px] text-muted-foreground mt-0.5">Define a calculated column from existing KPI, Indicator, or prior step data</p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer group shrink-0">
                    <div
                      onClick={() => setDmField("is_intermediate", !dmForm.is_intermediate)}
                      className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${dmForm.is_intermediate ? "bg-amber-400" : "bg-ok"}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${dmForm.is_intermediate ? "translate-x-0.5" : "translate-x-5"}`} />
                    </div>
                    <span className={`text-[12px] font-semibold ${dmForm.is_intermediate ? "text-warn" : "text-ok"}`}>
                      {dmForm.is_intermediate ? "Intermediate" : "In report"}
                    </span>
                  </label>
                </div>
              </SheetHeader>

              <SheetBody className="flex flex-col gap-4">
                  {/* Name + Unit */}
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-[12px] font-semibold text-foreground mb-1.5">Name <span className="text-destructive">*</span></label>
                      <input value={dmForm.name} onChange={(e) => setDmField("name", e.target.value)}
                        placeholder="e.g. Emission Intensity"
                        className="w-full py-[9px] px-3 rounded-lg border border-border text-[13px] outline-none focus:border-primary transition-colors" />
                    </div>
                    <div className="w-[120px]">
                      <label className="block text-[12px] font-semibold text-foreground mb-1.5">Unit <span className="text-destructive">*</span></label>
                      <input value={dmForm.unit} onChange={(e) => setDmField("unit", e.target.value)}
                        placeholder="tCO₂e/kL"
                        className="w-full py-[9px] px-3 rounded-lg border border-border text-[13px] outline-none focus:border-primary transition-colors" />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-[12px] font-semibold text-foreground mb-1.5">Description</label>
                    <input value={dmForm.description} onChange={(e) => setDmField("description", e.target.value)}
                      placeholder="Optional — explain what this metric represents"
                      className="w-full py-[9px] px-3 rounded-lg border border-border text-[13px] outline-none focus:border-primary transition-colors" />
                  </div>

                  {/* Module + Indicator grouping */}
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-[12px] font-semibold text-foreground mb-1.5">Group under Module</label>
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => setDmField("module_id", "")}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all ${!dmForm.module_id ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground border-border hover:border-border"}`}>
                          None
                        </button>
                        {modules.map((m) => {
                          const Icon = getModuleIcon(m.icon_name);
                          const sel = dmForm.module_id === m.module_id;
                          return (
                            <button key={m.module_id} type="button" onClick={() => setDmField("module_id", m.module_id)}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all ${sel ? "text-white border-transparent" : "bg-card text-muted-foreground border-border hover:border-border"}`}
                              style={sel ? { background: m.color, borderColor: m.color } : {}}>
                              <Icon size={11} style={{ color: sel ? "#fff" : m.color }} /> {m.module_name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="w-[200px]">
                      <label className="block text-[12px] font-semibold text-foreground mb-1.5">Link to Indicator</label>
                      <Select value={String(dmForm.indicator_id || "__none__")} onValueChange={(value) => setDmField("indicator_id", value === "__none__" ? "" : value)}>
                        <SelectTrigger className="h-[36px] text-[12px]">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {indicators
                            .filter((i) => !dmForm.module_id || i.module_id === Number(dmForm.module_id))
                            .map((i) => <SelectItem key={i.indicator_id} value={String(i.indicator_id)}>{i.indicator_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Formula builder — mode toggle */}
                  <div className="bg-sunken rounded-xl p-4 border border-border">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-[12px] font-bold text-foreground">Formula Builder</div>
                      <div className="flex rounded-lg border border-border overflow-hidden">
                        <button type="button" onClick={() => setDmField("formulaMode", false)}
                          className={`px-3 py-1 text-[11px] font-semibold transition-colors ${!dmForm.formulaMode ? "bg-primary text-white" : "bg-card text-muted-foreground hover:bg-sunken"}`}>
                          Simple
                        </button>
                        <button type="button" onClick={() => setDmField("formulaMode", true)}
                          className={`px-3 py-1 text-[11px] font-semibold transition-colors ${dmForm.formulaMode ? "bg-primary text-white" : "bg-card text-muted-foreground hover:bg-sunken"}`}>
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
                            <Select value={dmForm.operator} onValueChange={(value) => setDmField("operator", value as DerivedOperator)}>
                              <SelectTrigger className="w-[140px] h-[36px] text-[13px] font-bold">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(OP_LABELS).map(([op, lbl]) => (
                                  <SelectItem key={op} value={op}>{lbl}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
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
                            <div className="mt-3 px-3 py-2 bg-card rounded-lg border border-[hsl(var(--border-hairline))] text-[11px] text-muted-foreground font-mono">
                              <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-2">Preview:</span>
                              {operandLabel(dmForm.lhs_type, dmForm.lhs_kpi_id, dmForm.lhs_field, dmForm.lhs_constant, dmForm.lhs_indicator_id, dmForm.lhs_derived_id)}
                              <span className="mx-2 font-bold text-foreground">{opSym[dmForm.operator] || dmForm.operator}</span>
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
                            <div className="w-full min-h-[60px] px-3 py-2.5 rounded-lg border border-border bg-card text-[13px] font-medium text-foreground">
                              {dmForm.formula.trim() ? (
                                displayFormula(dmForm.formula, allKpis.length > 0 ? allKpis : kpis, indicators, derivedMetrics)
                              ) : (
                                <span className="text-muted-foreground/40 text-[12px]">Click fields from the right panel and operators below to build your formula...</span>
                              )}
                            </div>
                            {/* Operator + control buttons */}
                            <div className="flex gap-1.5 flex-wrap items-center">
                              {["+", "-", "*", "/", "(", ")", "100"].map((op) => (
                                <button key={op} type="button" onClick={() => insertFormulaToken(op === "100" ? " * 100" : ` ${op} `)}
                                  className="px-2.5 py-1 rounded border border-border text-[12px] font-mono font-bold text-foreground bg-card hover:bg-sunken hover:border-border transition-colors">
                                  {op === "100" ? "×100" : op}
                                </button>
                              ))}
                              <div className="w-px h-5 bg-border mx-1" />
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
                                className="px-2.5 py-1 rounded border border-border text-[11px] font-semibold text-warn bg-card hover:bg-warn-tint hover:border-warn/40 transition-colors"
                                title="Remove last item">⌫ Undo</button>
                              <button type="button" onClick={() => setDmField("formula", "")}
                                className="px-2.5 py-1 rounded border border-border text-[11px] font-semibold text-destructive bg-card hover:bg-destructive-tint hover:border-destructive/40 transition-colors"
                                title="Clear entire formula">Clear</button>
                            </div>
                          </div>

                          {/* Fields panel */}
                          <div className="w-[220px] flex-shrink-0 bg-card rounded-lg border border-border max-h-[280px] overflow-y-auto">
                            <div className="px-3 py-2 border-b border-[hsl(var(--border-hairline))] text-[10px] font-bold text-muted-foreground uppercase tracking-wider sticky top-0 bg-card">
                              Available Fields
                            </div>
                            {modules.map((mod) => {
                              const modInds = indicators.filter((i) => i.module_id === mod.module_id);
                              const fKpis = (allKpis.length > 0 ? allKpis : kpis).filter((k) => k.module_id === mod.module_id);
                              if (fKpis.length === 0 && modInds.length === 0) return null;
                              const ModIcon = getModuleIcon(mod.icon_name);
                              return (
                                <div key={mod.module_id}>
                                  <div className="px-3 py-1.5 bg-sunken text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5 border-b border-[hsl(var(--border-hairline))]">
                                    <ModIcon size={11} style={{ color: mod.color }} />{mod.module_name}
                                  </div>
                                  {modInds.map((ind) => {
                                    const indKpis = fKpis.filter((k) => k.indicator_id === ind.indicator_id);
                                    const isDirect = indKpis.length === 0;
                                    return (
                                      <div key={ind.indicator_id}>
                                        {isDirect ? (
                                          <button type="button" onClick={() => insertFormulaToken(`[ind:${ind.indicator_id}]`)}
                                            className="w-full text-left px-3 py-1.5 text-[11px] text-foreground hover:bg-info-tint transition-colors flex items-center gap-1.5 border-b border-[hsl(var(--border-hairline))]">
                                            <span className="text-sky-500 text-[9px] font-bold">IND</span>
                                            <span className="truncate">{ind.indicator_name}</span>
                                          </button>
                                        ) : (
                                          <>
                                            <div className="px-3 py-1 text-[10px] text-muted-foreground font-semibold border-b border-[hsl(var(--border-hairline))]">{ind.indicator_name}</div>
                                            {indKpis.map((k) => (
                                              <div key={k.kpi_id} className="flex border-b border-[hsl(var(--border-hairline))]">
                                                <button type="button" onClick={() => insertFormulaToken(`[kpi:${k.kpi_id}:quantity]`)}
                                                  className="flex-1 text-left pl-5 pr-1 py-1.5 text-[11px] text-foreground hover:bg-info-tint transition-colors truncate">
                                                  {k.kpi_name}
                                                </button>
                                                <button type="button" onClick={() => insertFormulaToken(`[kpi:${k.kpi_id}:mj_value]`)} title="MJ value"
                                                  className="px-1.5 py-1.5 text-[9px] font-bold text-amber-500 hover:bg-warn-tint transition-colors">MJ</button>
                                                <button type="button" onClick={() => insertFormulaToken(`[kpi:${k.kpi_id}:emission_value]`)} title="Emission value"
                                                  className="px-1.5 py-1.5 text-[9px] font-bold text-destructive hover:bg-destructive-tint transition-colors">CO₂</button>
                                              </div>
                                            ))}
                                          </>
                                        )}
                                      </div>
                                    );
                                  })}
                                  {/* KPIs not under any indicator */}
                                  {fKpis.filter((k) => !k.indicator_id).map((k) => (
                                    <div key={k.kpi_id} className="flex border-b border-[hsl(var(--border-hairline))]">
                                      <button type="button" onClick={() => insertFormulaToken(`[kpi:${k.kpi_id}:quantity]`)}
                                        className="flex-1 text-left px-3 py-1.5 text-[11px] text-foreground hover:bg-info-tint transition-colors truncate">
                                        {k.kpi_name}
                                      </button>
                                      <button type="button" onClick={() => insertFormulaToken(`[kpi:${k.kpi_id}:mj_value]`)} title="MJ value"
                                        className="px-1.5 py-1.5 text-[9px] font-bold text-amber-500 hover:bg-warn-tint transition-colors">MJ</button>
                                      <button type="button" onClick={() => insertFormulaToken(`[kpi:${k.kpi_id}:emission_value]`)} title="Emission value"
                                        className="px-1.5 py-1.5 text-[9px] font-bold text-destructive hover:bg-destructive-tint transition-colors">CO₂</button>
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                            {/* Existing derived metrics */}
                            {derivedMetrics.filter((d) => d.metric_id !== editDm?.metric_id).length > 0 && (
                              <>
                                <div className="px-3 py-1.5 bg-sunken text-[10px] font-bold text-muted-foreground uppercase border-b border-[hsl(var(--border-hairline))] border-t">
                                  Derived Metrics
                                </div>
                                {derivedMetrics.filter((d) => d.metric_id !== editDm?.metric_id).map((d) => (
                                  <button key={d.metric_id} type="button" onClick={() => insertFormulaToken(`[dm:${d.metric_id}]`)}
                                    className="w-full text-left px-3 py-1.5 text-[11px] text-purple-700 hover:bg-purple-50 transition-colors border-b border-[hsl(var(--border-hairline))] truncate">
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
                    <label className="text-[12px] font-semibold text-muted-foreground">Step / Display Order</label>
                    <input type="number" min={0} value={dmForm.display_order}
                      onChange={(e) => setDmField("display_order", e.target.value)}
                      className="w-[60px] py-1.5 px-2 rounded-lg border border-border text-[12px] outline-none focus:border-primary text-center" />
                    <span className="text-[11px] text-muted-foreground">Lower = computed first. Intermediate steps must have lower order than final steps that reference them.</span>
                  </div>
              </SheetBody>

              <SheetFooter>
                <button onClick={() => setDmCreateOpen(false)} className="px-4 py-2.5 rounded-lg border border-border text-[13px] font-semibold text-muted-foreground hover:bg-sunken transition-colors">Cancel</button>
                <button onClick={handleDmSave} disabled={actionLoading} className="px-5 py-2.5 rounded-lg bg-primary text-[13px] font-semibold text-white hover:bg-primaryDk transition-colors disabled:opacity-60">
                  {actionLoading ? "Saving..." : editDm ? "Update" : "Create"}
                </button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      )}

      {/* ── KPI SECTION (only when pageTab === "kpis") ── */}
      {pageTab === "kpis" && <>

      {/* Module Tabs */}
      <div className="flex gap-1 mb-5 bg-sunken rounded-lg p-1 w-fit">
        <button onClick={() => { setActiveModule(null); setPage(1); }} className={`px-4 py-2 rounded-md text-[13px] font-semibold transition-all ${!activeModule ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground/90"}`}>
          All
        </button>
        {modules.map((m) => {
          const Icon = getModuleIcon(m.icon_name);
          return (
            <button key={m.module_id} onClick={() => { setActiveModule(m.module_id); setPage(1); }} className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-[13px] font-semibold transition-all ${activeModule === m.module_id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground/90"}`}>
              <Icon size={14} style={{ color: m.color }} /> {m.module_name}
            </button>
          );
        })}
      </div>

      <div className="flex gap-5">
        {/* KPIs table */}
        <div className="bg-card rounded-xl border border-border overflow-hidden w-full transition-all">
          {loading ? (
            <div className="p-6"><LoadingSkeleton rows={8} cols={6} /></div>
          ) : kpis.length === 0 ? (
            <EmptyState icon={BarChart3} title="No KPIs found" description={activeModule ? "No KPIs in this module yet" : "Define your first ESG KPI to start tracking"}>
              {isAdmin && <button onClick={openCreate} className="mt-2 px-4 py-2 rounded-lg bg-primary text-white text-[13px] font-semibold"><Plus size={14} className="inline mr-1" /> Add KPI</button>}
            </EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] border-collapse">
                <thead>
                  <tr className="border-b-2 border-[hsl(var(--border-hairline))] bg-sunken/60">
                    {["KPI", "Unit", "Module", "Scope", "Energy Type", "Factors", ...(isAdmin ? ["Actions"] : [])].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {kpis.map((m) => {
                    const mod = modules.find((x) => x.module_id === m.module_id);
                    const ModIcon = mod ? getModuleIcon(mod.icon_name) : null;
                    return (
                      <tr key={m.kpi_id} className={`border-b border-[hsl(var(--border-hairline))] hover:bg-sunken/60 transition-colors ${factorKPI?.kpi_id === m.kpi_id ? "bg-info-tint/40" : ""}`}>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{m.kpi_name}</span>
                            {m.input_type && m.input_type !== "numeric" && (
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${m.input_type === "boolean" ? "bg-accent text-accent-foreground" : "bg-warn-tint text-warn"}`}>
                                {m.input_type === "boolean" ? "Yes/No" : "Text"}
                              </span>
                            )}
                          </div>
                          {m.description && <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">{m.description}</div>}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground font-mono text-[12px]">{m.input_type === "numeric" || !m.input_type ? m.unit : "—"}</td>
                        <td className="px-4 py-2">
                          {ModIcon && mod && (
                            <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                              <ModIcon size={14} style={{ color: mod.color }} /> {mod.module_name}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {m.scope_number ? (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${scopeColors[m.scope_number]}`}>
                              Scope {m.scope_number}
                            </span>
                          ) : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-4 py-2 text-[12px] text-muted-foreground">{m.energy_type ? energyLabel[m.energy_type] : "—"}</td>
                        <td className="px-4 py-2">
                          <button onClick={() => loadFactors(m)} className="flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline">
                            View <ChevronRight size={12} />
                          </button>
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1">
                              <button onClick={() => openEdit(m)} title="Edit KPI" className="p-1.5 rounded-md hover:bg-sunken text-muted-foreground hover:text-foreground transition-colors">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => handleDeactivate(m)} title="Deactivate" className="p-1.5 rounded-md hover:bg-destructive-tint text-muted-foreground hover:text-destructive transition-colors">
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
            <div className="flex items-center justify-between px-4 py-3 border-t border-[hsl(var(--border-hairline))]">
              <span className="text-[12px] text-muted-foreground">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
              <div className="flex items-center gap-1">
                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-sunken"><ChevronLeft size={16} className="text-muted-foreground" /></button>
                <span className="px-3 text-[12px] font-semibold text-foreground">{page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="p-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-sunken"><ChevronRight size={16} className="text-muted-foreground" /></button>
              </div>
            </div>
          )}
        </div>

        {/* Conversion Factors Panel (slide-over) */}
        <Sheet open={!!factorKPI} onOpenChange={(open) => { if (!open) setFactorKPI(null); }}>
          <SheetContent className="max-w-[420px]">
            <SheetHeader>
              <SheetTitle>Conversion Factors</SheetTitle>
              <p className="text-[12px] text-muted-foreground">{factorKPI?.kpi_name} {factorKPI ? `(${factorKPI.unit})` : ""}</p>
            </SheetHeader>
            <SheetBody className="p-4">
              {factorsLoading ? (
                <LoadingSkeleton rows={3} cols={2} />
              ) : factors.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[13px] text-muted-foreground mb-3">No conversion factors yet</p>
                  {isAdmin && (
                    <button onClick={() => setAddFactorOpen(true)} className="text-[12px] font-semibold text-primary hover:underline">
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
                      <div key={f.factor_id} className={`p-3.5 rounded-lg border ${isActive ? "border-primary/40 bg-info-tint/40" : "border-[hsl(var(--border-hairline))] bg-sunken/40"}`}>
                        <div className="flex items-center justify-between mb-2">
                          {isEditing ? (
                            <div className="grid grid-cols-2 gap-2 text-[12px] flex-1">
                              <div className="flex flex-col gap-1">
                                <span className="text-muted-foreground text-[11px]">Energy Factor</span>
                                <div className="flex gap-1">
                                  <input type="number" step="any" value={editFactorForm.energy_factor}
                                    onChange={e => setEditFactorForm(p => ({ ...p, energy_factor: e.target.value }))}
                                    className="flex-1 min-w-0 px-2 py-1 rounded border border-border text-[12px] font-mono text-foreground focus:border-primary outline-none" />
                                  <Select value={editFactorForm.energy_factor_uom} onValueChange={(value) => setEditFactorForm(p => ({ ...p, energy_factor_uom: value }))}>
                                    <SelectTrigger className="w-24 h-8 px-2 text-[11px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {energyUOMs.map((u) => <SelectItem key={u.symbol} value={u.symbol}>{u.symbol}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-muted-foreground text-[11px]">Emission Factor</span>
                                <div className="flex gap-1">
                                  <input type="number" step="any" value={editFactorForm.emission_factor}
                                    onChange={e => setEditFactorForm(p => ({ ...p, emission_factor: e.target.value }))}
                                    className="flex-1 min-w-0 px-2 py-1 rounded border border-border text-[12px] font-mono text-foreground focus:border-primary outline-none" />
                                  <Select value={editFactorForm.emission_factor_uom} onValueChange={(value) => setEditFactorForm(p => ({ ...p, emission_factor_uom: value }))}>
                                    <SelectTrigger className="w-24 h-8 px-2 text-[11px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {emissionUOMs.map((u) => <SelectItem key={u.symbol} value={u.symbol}>{u.symbol}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2 text-[12px] flex-1">
                              <div>
                                <span className="text-muted-foreground">Energy:</span>
                                <span className="font-bold text-foreground ml-1">
                                  {f.energy_factor} {f.energy_factor_uom}{factorKPI?.unit ? ` / ${factorKPI.unit}` : ""}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Emission:</span>
                                <span className="font-bold text-foreground ml-1">
                                  {f.emission_factor} {f.emission_factor_uom}{factorKPI?.unit ? ` / ${factorKPI.unit}` : ""}
                                </span>
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                            {isActive && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-white">
                                Active
                              </span>
                            )}
                            {isAdmin && !isEditing && (
                              <button onClick={() => startEditFactor(f)} title="Edit factor"
                                className="p-1 rounded hover:bg-sunken text-muted-foreground hover:text-muted-foreground transition-colors">
                                <Pencil size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                        {isEditing && (
                          <div className="flex gap-2 mb-2">
                            <button onClick={handleSaveFactorEdit} disabled={actionLoading}
                              className="px-3 py-1 text-[11px] font-semibold rounded-md bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50">
                              {actionLoading ? "Saving..." : "Save"}
                            </button>
                            <button onClick={() => setEditFactorId(null)}
                              className="px-3 py-1 text-[11px] font-semibold rounded-md border border-border text-muted-foreground hover:bg-sunken transition-colors">
                              Cancel
                            </button>
                          </div>
                        )}
                        <div className="text-[11px] text-muted-foreground">
                          {formatDate(f.valid_from)}{f.valid_to ? ` → ${formatDate(f.valid_to)}` : " → Present"}
                          {f.source && <span className="ml-2 text-muted-foreground/40">· {f.source}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SheetBody>
            {isAdmin && (
              <SheetFooter>
                <button onClick={() => setAddFactorOpen(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-[13px] font-semibold hover:bg-primaryDk transition-colors">
                  <Plus size={14} /> Add Factor
                </button>
              </SheetFooter>
            )}
          </SheetContent>
        </Sheet>
      </div>

      {/* ── Custom Add KPI Modal ── */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent className="max-w-2xl">
          <SheetHeader>
            <SheetTitle>Add KPI</SheetTitle>
            <p className="text-[12px] text-muted-foreground">Define a new ESG KPI for your company</p>
          </SheetHeader>
          <SheetBody className="space-y-5">
            <FormSection title="KPI Definition" description="Basic identity, grouping, and input behavior">
              {/* Module */}
              <div>
                <label className="block text-[12px] font-semibold text-foreground mb-1.5">Module <span className="text-destructive">*</span></label>
                <div className="flex flex-wrap gap-2">
                  {modules.map((m) => {
                    const Icon = getModuleIcon(m.icon_name);
                    const sel = kpiForm.module_id === m.module_id;
                    return (
                      <button key={m.module_id} type="button"
                        onClick={() => { setKpiField("module_id", m.module_id); setKpiField("energy_type", undefined); setKpiField("scope_number", undefined); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${sel ? "text-white border-transparent" : "bg-card text-muted-foreground border-border hover:border-border"}`}
                        style={sel ? { background: m.color, borderColor: m.color } : {}}
                      >
                        <Icon size={13} style={{ color: sel ? "#fff" : m.color }} /> {m.module_name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <FormRow cols={2}>
                <WorkspaceField label="Indicator">
                  <Select value={String(kpiForm.indicator_id || "__none__")} onValueChange={(value) => setKpiField("indicator_id", value === "__none__" ? undefined : Number(value))}>
                    <SelectTrigger><SelectValue placeholder="Select Indicator (optional)..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select Indicator (optional)...</SelectItem>
                      {indicators
                        .filter((c) => !kpiForm.module_id || c.module_id === kpiForm.module_id)
                        .map((c) => <SelectItem key={c.indicator_id} value={String(c.indicator_id)}>{c.indicator_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </WorkspaceField>
                <WorkspaceField label="KPI Name" required>
                  <input type="text" value={kpiForm.kpi_name || ""} onChange={(e) => setKpiField("kpi_name", e.target.value)}
                    className="field-input" />
                </WorkspaceField>
              </FormRow>
              {/* Input Type */}
              <div>
                <label className="block text-[12px] font-semibold text-foreground mb-1.5">Input Type</label>
                <div className="flex gap-2">
                  {[{ v: "numeric", l: "Numeric" }, { v: "boolean", l: "Yes / No" }, { v: "text", l: "Text" }].map(({ v, l }) => (
                    <button key={v} type="button"
                      onClick={() => setKpiField("input_type", v)}
                      className={`flex-1 py-2 rounded-lg border text-[12px] font-semibold transition-all ${(kpiForm.input_type ?? "numeric") === v ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground border-border hover:border-border"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {/* Unit — only required for numeric */}
              {(kpiForm.input_type ?? "numeric") === "numeric" && (
                <WorkspaceField label="Unit" required hint="Unit in which this KPI is measured">
                  <Select value={kpiForm.unit || "__none__"} onValueChange={(value) => setKpiField("unit", value === "__none__" ? "" : value)}>
                    <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Select unit —</SelectItem>
                      {kpiUnitOptions.map((u) => (
                        <SelectItem key={u.uom_id} value={u.symbol}>{u.symbol} — {u.display_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </WorkspaceField>
              )}
              {/* Description */}
              <WorkspaceField label="Description">
                <textarea value={kpiForm.description || ""} onChange={(e) => setKpiField("description", e.target.value)}
                  rows={2} className="field-input h-auto min-h-[72px] resize-none" />
              </WorkspaceField>
              {/* GHG Scope — for Energy (combustion → emissions) and Emissions modules; numeric only */}
              {(kpiForm.input_type ?? "numeric") === "numeric" && (() => {
                const selMod = modules.find(m => m.module_id === kpiForm.module_id);
                const isEnergy = selMod?.key === "energy";
                const isEmissions = selMod?.render_type === "auto_computed";
                if (!isEnergy && !isEmissions) return null;
                return (
                  <div>
                    <label className="block text-[12px] font-semibold text-foreground mb-1.5">
                      GHG Scope
                      {isEnergy && (
                        <span className="ml-2 text-[10px] font-normal text-muted-foreground">Combustion of this fuel will contribute to this scope's emissions total</span>
                      )}
                    </label>
                    <Select value={String(kpiForm.scope_number || "__none__")} onValueChange={(value) => setKpiField("scope_number", value === "__none__" ? undefined : Number(value))}>
                      <SelectTrigger><SelectValue placeholder="Select scope..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Select scope...</SelectItem>
                        <SelectItem value="1">Scope 1 — Direct (e.g. diesel, coal combustion)</SelectItem>
                        <SelectItem value="2">Scope 2 — Indirect (e.g. grid electricity)</SelectItem>
                        <SelectItem value="3">Scope 3 — Value Chain</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                );
              })()}
              {/* Energy Type — only for Energy module + numeric KPIs */}
              {(kpiForm.input_type ?? "numeric") === "numeric" && modules.find(m => m.module_id === kpiForm.module_id)?.key === "energy" && (
                <div>
                  <label className="block text-[12px] font-semibold text-foreground mb-1.5">Energy Type</label>
                  <Select value={kpiForm.energy_type || "__none__"} onValueChange={(value) => setKpiField("energy_type", value === "__none__" ? undefined : value)}>
                    <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select type...</SelectItem>
                      <SelectItem value="RENEWABLE">Renewable</SelectItem>
                      <SelectItem value="NON_RENEWABLE">Non-Renewable</SelectItem>
                      <SelectItem value="NOT_APPLICABLE">Not Applicable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </FormSection>
          </SheetBody>
          <SheetFooter>
            <button onClick={() => setCreateOpen(false)} className="px-4 py-2.5 rounded-lg border border-border text-[13px] font-semibold text-muted-foreground hover:bg-sunken transition-colors">Cancel</button>
            <button onClick={handleCreate} disabled={actionLoading} className="px-5 py-2.5 rounded-lg bg-primary text-[13px] font-semibold text-white hover:bg-primaryDk transition-colors disabled:opacity-60">
              {actionLoading ? "Saving..." : "Add KPI"}
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

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
      <Sheet open={!!editKPI} onOpenChange={(open) => { if (!open) setEditKPI(null); }}>
        <SheetContent className="max-w-2xl">
          <SheetHeader>
            <SheetTitle>Edit KPI</SheetTitle>
            <p className="text-[12px] text-muted-foreground">{editKPI?.kpi_name}</p>
          </SheetHeader>
          <SheetBody className="space-y-5">
            <FormSection title="KPI Details" description="Update grouping, unit, and calculation metadata">
              {/* Module — read-only in edit (changing module would mismatch indicator_id) */}
              <div>
                <label className="block text-[12px] font-semibold text-foreground mb-1.5">Module</label>
                {(() => {
                  const mod = modules.find((m) => m.module_id === kpiForm.module_id);
                  const Icon = mod ? getModuleIcon(mod.icon_name) : null;
                  return mod ? (
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-sunken w-fit text-[12px] font-semibold text-muted-foreground">
                      {Icon && <Icon size={13} style={{ color: mod.color }} />}
                      {mod.module_name}
                      <span className="ml-1 text-[10px] text-muted-foreground font-normal">(cannot be changed)</span>
                    </div>
                  ) : null;
                })()}
              </div>
              {/* Indicator */}
              <WorkspaceField label="Indicator">
                <Select value={String(kpiForm.indicator_id || "__none__")} onValueChange={(value) => setKpiField("indicator_id", value === "__none__" ? "" : value)}>
                  <SelectTrigger><SelectValue placeholder="No Indicator (unassigned)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No Indicator (unassigned)</SelectItem>
                    {indicators
                      .filter((c) => !kpiForm.module_id || c.module_id === kpiForm.module_id)
                      .map((c) => <SelectItem key={c.indicator_id} value={String(c.indicator_id)}>{c.indicator_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </WorkspaceField>
              {/* KPI Name */}
              <WorkspaceField label="KPI Name" required>
                <input type="text" value={kpiForm.kpi_name || ""} onChange={(e) => setKpiField("kpi_name", e.target.value)}
                  className="field-input" />
              </WorkspaceField>
              {/* Input Type */}
              <div>
                <label className="block text-[12px] font-semibold text-foreground mb-1.5">Input Type</label>
                <div className="flex gap-2">
                  {[{ v: "numeric", l: "Numeric" }, { v: "boolean", l: "Yes / No" }, { v: "text", l: "Text" }].map(({ v, l }) => (
                    <button key={v} type="button"
                      onClick={() => setKpiField("input_type", v)}
                      className={`flex-1 py-2 rounded-lg border text-[12px] font-semibold transition-all ${(kpiForm.input_type ?? "numeric") === v ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground border-border hover:border-border"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {/* Unit — only for numeric */}
              {(kpiForm.input_type ?? "numeric") === "numeric" && (
                <WorkspaceField label="Unit" required>
                  <Select value={kpiForm.unit || "__none__"} onValueChange={(value) => setKpiField("unit", value === "__none__" ? "" : value)}>
                    <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Select unit —</SelectItem>
                      {kpiUnitOptions.map((u) => (
                        <SelectItem key={u.uom_id} value={u.symbol}>{u.symbol} — {u.display_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </WorkspaceField>
              )}
              {/* Description */}
              <WorkspaceField label="Description">
                <textarea value={kpiForm.description || ""} onChange={(e) => setKpiField("description", e.target.value)}
                  rows={2} className="field-input h-auto min-h-[72px] resize-none" />
              </WorkspaceField>
              {/* GHG Scope — for Energy and Emissions modules; numeric only */}
              {(kpiForm.input_type ?? "numeric") === "numeric" && (() => {
                const selMod = modules.find(m => m.module_id === kpiForm.module_id);
                const isEnergy = selMod?.key === "energy";
                const isEmissions = selMod?.render_type === "auto_computed";
                if (!isEnergy && !isEmissions) return null;
                return (
                  <div>
                    <label className="block text-[12px] font-semibold text-foreground mb-1.5">
                      GHG Scope
                      {isEnergy && <span className="ml-2 text-[10px] font-normal text-muted-foreground">Combustion of this fuel contributes to this scope's emissions</span>}
                    </label>
                    <Select value={String(kpiForm.scope_number || "__none__")} onValueChange={(value) => setKpiField("scope_number", value === "__none__" ? "" : value)}>
                      <SelectTrigger><SelectValue placeholder="No scope" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No scope</SelectItem>
                        <SelectItem value="1">Scope 1 — Direct (e.g. diesel, coal combustion)</SelectItem>
                        <SelectItem value="2">Scope 2 — Indirect (e.g. grid electricity)</SelectItem>
                        <SelectItem value="3">Scope 3 — Value Chain</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                );
              })()}
              {/* Energy Type — only for Energy module + numeric KPIs */}
              {(kpiForm.input_type ?? "numeric") === "numeric" && modules.find(m => m.module_id === kpiForm.module_id)?.key === "energy" && (
                <div>
                  <label className="block text-[12px] font-semibold text-foreground mb-1.5">Energy Type</label>
                  <Select value={kpiForm.energy_type || "__none__"} onValueChange={(value) => setKpiField("energy_type", value === "__none__" ? "" : value)}>
                    <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select type...</SelectItem>
                      <SelectItem value="RENEWABLE">Renewable</SelectItem>
                      <SelectItem value="NON_RENEWABLE">Non-Renewable</SelectItem>
                      <SelectItem value="NOT_APPLICABLE">Not Applicable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </FormSection>
          </SheetBody>
          <SheetFooter>
            <button onClick={() => setEditKPI(null)} className="px-4 py-2.5 rounded-lg border border-border text-[13px] font-semibold text-muted-foreground hover:bg-sunken transition-colors">Cancel</button>
            <button onClick={handleEdit} disabled={actionLoading} className="px-5 py-2.5 rounded-lg bg-primary text-[13px] font-semibold text-white hover:bg-primaryDk transition-colors disabled:opacity-60">
              {actionLoading ? "Saving..." : "Save Changes"}
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      </> /* end KPI section */}
    </PageShell>
  );
}
