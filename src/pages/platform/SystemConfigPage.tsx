import { useEffect, useState } from "react";
import { platformApi } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { LoadingSkeleton } from "@/components/shared/PageComponents";
import { PageShell } from "@/components/shared/PageShell";
import { PageTabs } from "@/components/shared/PageTabs";
import { FormField as WorkspaceField } from "@/components/shared/FormField";
import { FormRow, FormSection } from "@/components/shared/FormWorkspace";
import { FormDialog, type FormField } from "@/components/shared/FormDialog";
import IconPicker from "@/components/shared/IconPicker";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Lock, Gauge, X, Check } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import type { Module, Indicator, FinancialYear, SubscriptionPlan, UOM, KPI, ConversionFactor } from "@/types";
import { formatDate, getApiError } from "@/lib/utils";
import { getModuleIcon, MODULE_COLOR_PRESETS } from "@/lib/constants";
import VocabulariesManager from "@/components/platform/VocabulariesManager";

const MODULE_RENDER_TYPES = [
  { value: "standard_input",       label: "Standard Input",    desc: "Quantity entry with unit — Energy, Water style" },
  { value: "auto_computed",        label: "Emissions Style",   desc: "Auto-computed from source KPIs; split by emission type" },
  { value: "input_with_disposal",  label: "Waste Input",       desc: "Quantity + 7-method disposal breakdown — Waste style" },
];

type Tab = "modules" | "indicators" | "fys" | "plans" | "uoms" | "catalog" | "vocab";

const UOM_CATEGORIES = [
  { value: "energy",   label: "Energy" },
  { value: "emission", label: "Emission" },
  { value: "volume",   label: "Volume" },
  { value: "mass",     label: "Mass" },
  { value: "distance", label: "Distance / Activity" },
  { value: "currency", label: "Currency" },
  { value: "other",    label: "Other" },
];
const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(UOM_CATEGORIES.map((c) => [c.value, c.label]));
const NONE_VALUE = "__none__";


export default function SystemConfigPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>("modules");
  const isOwner = user?.role === "PLATFORM_OWNER";

  // Module state
  const [modules, setModules] = useState<Module[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [fys, setFYs] = useState<FinancialYear[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [uoms, setUOMs] = useState<UOM[]>([]);
  const [loading, setLoading] = useState(true);
  const [catModuleFilter, setCatModuleFilter] = useState<number | null>(null);
  const [uomCategoryFilter, setUomCategoryFilter] = useState<string>("");

  // Generic create sheets
  const [createType, setCreateType] = useState<Exclude<Tab, "modules" | "catalog" | "vocab"> | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Module create/edit — custom dialog with IconPicker + color swatches
  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [moduleDialogTarget, setModuleDialogTarget] = useState<Module | null>(null);
  const [moduleForm, setModuleForm] = useState<Record<string, any>>({});
  const setModuleField = (k: string, v: any) => setModuleForm((p) => ({ ...p, [k]: v }));
  const [deleteModuleTarget, setDeleteModuleTarget] = useState<Module | null>(null);

  const [editIndicatorData, setEditIndicatorData] = useState<Indicator | null>(null);
  const [editFYData, setEditFYData] = useState<FinancialYear | null>(null);
  const [editUOMData, setEditUOMData] = useState<UOM | null>(null);

  // Catalog KPIs tab state
  const [catalogKPIs, setCatalogKPIs] = useState<KPI[]>([]);
  const [catalogModuleFilter, setCatalogModuleFilter] = useState<number | null>(null);
  const [catalogIndicatorFilter, setCatalogIndicatorFilter] = useState<number | null>(null);
  const [editCatalogKPIData, setEditCatalogKPIData] = useState<KPI | null>(null);
  const [factorDrawerKPI, setFactorDrawerKPI] = useState<KPI | null>(null);
  const [factorDrawerFactors, setFactorDrawerFactors] = useState<ConversionFactor[]>([]);
  const [factorDrawerLoading, setFactorDrawerLoading] = useState(false);
  const [addFactorOpen, setAddFactorOpen] = useState(false);
  const [editCatalogFactorData, setEditCatalogFactorData] = useState<ConversionFactor | null>(null);
  const [indicatorEditForm, setIndicatorEditForm] = useState<Record<string, any>>({});
  const [fyEditForm, setFyEditForm] = useState<Record<string, any>>({});
  const [catalogKpiEditForm, setCatalogKpiEditForm] = useState<Record<string, any>>({});
  const [catalogFactorForm, setCatalogFactorForm] = useState<Record<string, any>>({});
  const [catalogFactorEditForm, setCatalogFactorEditForm] = useState<Record<string, any>>({});
  const [uomEditForm, setUomEditForm] = useState<Record<string, any>>({});
  const [indicatorCreateForm, setIndicatorCreateForm] = useState<Record<string, any>>({});
  const [fyCreateForm, setFyCreateForm] = useState<Record<string, any>>({});
  const [planCreateForm, setPlanCreateForm] = useState<Record<string, any>>({});
  const [uomCreateForm, setUomCreateForm] = useState<Record<string, any>>({});

  // Add Catalog KPI custom dialog
  const [addCatalogOpen, setAddCatalogOpen] = useState(false);
  const [addCatalogLoading, setAddCatalogLoading] = useState(false);
  const [catKpiForm, setCatKpiForm] = useState<Record<string, any>>({});
  const setCatKpiField = (k: string, v: any) => setCatKpiForm((p) => ({ ...p, [k]: v }));

  // Plan capabilities dialog (limits + modules + features)
  const [capPlan, setCapPlan] = useState<SubscriptionPlan | null>(null);
  const [capModules, setCapModules] = useState<any[]>([]);
  const [capFeatures, setCapFeatures] = useState<any[]>([]);
  const [capFeatureKeys, setCapFeatureKeys] = useState<any[]>([]);
  const [capQuotas, setCapQuotas] = useState<Record<string, number>>({});
  const [capPlanName, setCapPlanName] = useState("");
  const [capLoading, setCapLoading] = useState(false);
  const [capSaving, setCapSaving] = useState(false);
  const [capModuleIds, setCapModuleIds] = useState<Set<number>>(new Set());
  const [capFeatureIds, setCapFeatureIds] = useState<Set<number>>(new Set());
  // plan_id → { modules, features } for card summary
  const [planCapSummary, setPlanCapSummary] = useState<Record<number, { modules: string[]; features: string[] }>>({});


  useEffect(() => {
    setLoading(true);
    const safe = async (fn: () => Promise<any>) => { try { return await fn(); } catch { return { data: [] }; } };
    Promise.all([
      safe(() => platformApi.listModules()),
      safe(() => platformApi.listSystemIndicators()),
      safe(() => platformApi.listFYs()),
      safe(() => platformApi.listPlans()),
      safe(() => platformApi.listUOMs()),
      safe(() => platformApi.listCatalogKPIs()),
    ]).then(([mRes, cRes, fRes, pRes, uRes, kRes]) => {
      setModules(Array.isArray(mRes.data) ? mRes.data : mRes.data?.items || []);
      setIndicators(Array.isArray(cRes.data) ? cRes.data : cRes.data?.items || []);
      setFYs(Array.isArray(fRes.data) ? fRes.data : fRes.data?.items || []);
      const planList: SubscriptionPlan[] = Array.isArray(pRes.data) ? pRes.data : pRes.data?.items || [];
      setPlans(planList);
      setUOMs(Array.isArray(uRes.data) ? uRes.data : []);
      setCatalogKPIs(Array.isArray(kRes.data) ? kRes.data : []);
      setLoading(false);
      // load capability summaries for all plans in the background
      Promise.all(planList.map(async (p) => {
        try {
          const [mRes2, fRes2] = await Promise.all([
            platformApi.listPlanModules(p.plan_id),
            platformApi.listPlanAppFeatures(p.plan_id),
          ]);
          const mods = (mRes2.data ?? mRes2) as any[];
          const feats = (fRes2.data ?? fRes2) as any[];
          return { plan_id: p.plan_id, modules: mods.filter((m: any) => m.included).map((m: any) => m.module_name), features: feats.filter((f: any) => f.included).map((f: any) => f.feature_name) };
        } catch { return { plan_id: p.plan_id, modules: [], features: [] }; }
      })).then((results) => {
        const summary: Record<number, { modules: string[]; features: string[] }> = {};
        results.forEach((r) => { summary[r.plan_id] = { modules: r.modules, features: r.features }; });
        setPlanCapSummary(summary);
      });
    });
  }, []);

  const refreshTab = async () => {
    const safe = async (fn: () => Promise<any>) => { try { return (await fn()).data; } catch { return []; } };
    if (tab === "modules") setModules(await safe(() => platformApi.listModules()).then((d: any) => Array.isArray(d) ? d : d?.items || []));
    if (tab === "indicators") setIndicators(await safe(() => platformApi.listSystemIndicators()).then((d: any) => Array.isArray(d) ? d : d?.items || []));
    if (tab === "fys") setFYs(await safe(() => platformApi.listFYs()).then((d: any) => Array.isArray(d) ? d : d?.items || []));
    if (tab === "plans") setPlans(await safe(() => platformApi.listPlans()).then((d: any) => Array.isArray(d) ? d : d?.items || []));
    if (tab === "uoms") setUOMs(await safe(() => platformApi.listUOMs()).then((d: any) => Array.isArray(d) ? d : []));
    if (tab === "catalog") setCatalogKPIs(await safe(() => platformApi.listCatalogKPIs()).then((d: any) => Array.isArray(d) ? d : []));
  };

  const slugify = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

  const openModuleCreate = () => {
    const defaultColor = MODULE_COLOR_PRESETS[0];
    setModuleForm({ module_name: "", key: "", description: "", icon_name: "Zap", color: defaultColor.color, bg_color: defaultColor.bg, render_type: "standard_input", display_order: modules.length + 1 });
    setModuleDialogTarget(null);
    setModuleDialogOpen(true);
  };

  const openModuleEdit = (m: Module) => {
    setModuleForm({ module_name: m.module_name, key: m.key || "", description: m.description || "", icon_name: m.icon_name || "BarChart3", color: m.color || "#64748b", bg_color: m.bg_color || "#f8fafc", render_type: m.render_type || "standard_input", display_order: m.display_order, is_active: m.is_active });
    setModuleDialogTarget(m);
    setModuleDialogOpen(true);
  };

  const openCapabilities = async (plan: SubscriptionPlan) => {
    setCapPlan(plan);
    setCapPlanName(plan.plan_name);
    setCapLoading(true);
    try {
      const [mods, feats, keys, quotaRows] = await Promise.all([
        platformApi.listPlanModules(plan.plan_id).then((r: any) => r.data ?? r),
        platformApi.listPlanAppFeatures(plan.plan_id).then((r: any) => r.data ?? r),
        platformApi.listFeatureKeys().then((r: any) => r.data ?? r),
        platformApi.listPlanFeatures(plan.plan_id).then((r: any) => r.data ?? r),
      ]);
      setCapModules(mods);
      setCapFeatures(feats);
      setCapFeatureKeys(keys);
      setCapModuleIds(new Set(mods.filter((m: any) => m.included).map((m: any) => m.module_id)));
      setCapFeatureIds(new Set(feats.filter((f: any) => f.included).map((f: any) => f.feature_id)));
      // build quota map: prefer existing plan rows, fall back to feature_key default
      const qmap: Record<string, number> = {};
      for (const k of keys) {
        const existing = quotaRows.find((r: any) => r.feature_key === k.feature_key);
        qmap[k.feature_key] = existing ? existing.quota : (k.default_quota ?? 0);
      }
      setCapQuotas(qmap);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to load plan capabilities"));
      setCapPlan(null);
    } finally {
      setCapLoading(false);
    }
  };

  const saveCapabilities = async () => {
    if (!capPlan) return;
    if (!capPlanName.trim()) { toast.error("Plan name is required"); return; }
    setCapSaving(true);
    try {
      const quotaBody = capFeatureKeys.map((k: any) => ({
        feature_key: k.feature_key,
        quota: Number(capQuotas[k.feature_key] ?? 0),
      }));
      await Promise.all([
        platformApi.updatePlan(capPlan.plan_id, { plan_name: capPlanName.trim() }),
        platformApi.setPlanCapabilities(capPlan.plan_id, [...capModuleIds], [...capFeatureIds]),
        ...(quotaBody.length > 0 ? [platformApi.upsertPlanFeatures(capPlan.plan_id, quotaBody)] : []),
      ]);
      toast.success("Plan saved");
      // refresh plan list so card names/limits stay in sync
      const updated = await platformApi.listPlans();
      setPlans(Array.isArray(updated.data) ? updated.data : updated.data?.items || []);
      // update card capability summary
      const includedMods = capModules.filter((m: any) => capModuleIds.has(m.module_id)).map((m: any) => m.module_name);
      const includedFeats = capFeatures.filter((f: any) => capFeatureIds.has(f.feature_id)).map((f: any) => f.feature_name);
      setPlanCapSummary((prev) => ({ ...prev, [capPlan.plan_id]: { modules: includedMods, features: includedFeats } }));
      setCapPlan(null);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to save plan"));
    } finally {
      setCapSaving(false);
    }
  };

  const handleModuleSubmit = async () => {
    if (!moduleForm.module_name?.trim()) { toast.error("Module name is required"); return; }
    if (!moduleForm.key?.trim()) { toast.error("Module key is required"); return; }
    if (!/^[a-z0-9_]+$/.test(moduleForm.key)) { toast.error("Key must be lowercase letters, numbers, and underscores only"); return; }
    setActionLoading(true);
    try {
      if (moduleDialogTarget) {
        await platformApi.updateModule(moduleDialogTarget.module_id, moduleForm);
        toast.success("Module updated");
      } else {
        await platformApi.createModule(moduleForm);
        toast.success("Module created");
      }
      setModuleDialogOpen(false);
      refreshTab();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to save module"));
    } finally { setActionLoading(false); }
  };

  const handleDeleteModule = async () => {
    if (!deleteModuleTarget) return;
    setActionLoading(true);
    try {
      await platformApi.deleteModule(deleteModuleTarget.module_id);
      toast.success(`"${deleteModuleTarget.module_name}" deleted`);
      setDeleteModuleTarget(null);
      refreshTab();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to delete module"));
    } finally { setActionLoading(false); }
  };

  const loadDrawerFactors = async (kpiId: string) => {
    setFactorDrawerLoading(true);
    try {
      const { data } = await platformApi.listCatalogFactors(kpiId);
      setFactorDrawerFactors(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to load factors"));
    } finally {
      setFactorDrawerLoading(false);
    }
  };

  const openFactorDrawer = (kpi: KPI) => {
    setFactorDrawerKPI(kpi);
    setFactorDrawerFactors([]);
    loadDrawerFactors(kpi.kpi_id);
  };

  const openCreate = (type: Exclude<Tab, "modules" | "catalog" | "vocab">) => {
    setCreateType(type);
    if (type === "indicators") {
      setIndicatorCreateForm({
        module_id: "",
        indicator_name: "",
        description: "",
        input_type: "numeric",
        unit: "",
        show_when_indicator_id: NONE_VALUE,
        show_when_equals: "",
        display_order: 1,
      });
    }
    if (type === "fys") {
      setFyCreateForm({ fy_label: "", start_date: "", end_date: "" });
    }
    if (type === "plans") {
      setPlanCreateForm({ plan_name: "", max_users: "", max_locations: "", max_kpis: "" });
    }
    if (type === "uoms") {
      setUomCreateForm({ symbol: "", display_name: "", category: "" });
    }
  };

  const handleOpenAddCatalog = () => { setCatKpiForm({ input_type: "numeric" }); setAddCatalogOpen(true); };

  const handleAddCatalogKPI = async () => {
    const isNumeric = (catKpiForm.input_type ?? "numeric") === "numeric";
    if (!catKpiForm.module_id || !catKpiForm.kpi_name || (isNumeric && !catKpiForm.unit)) {
      toast.error(isNumeric ? "Module, KPI Name, and Unit are required" : "Module and KPI Name are required"); return;
    }
    setAddCatalogLoading(true);
    try {
      const payload: Record<string, any> = {
        module_id: Number(catKpiForm.module_id),
        kpi_name: catKpiForm.kpi_name,
        unit: catKpiForm.unit || "—",
        input_type: catKpiForm.input_type || "numeric",
        description: catKpiForm.description || null,
        is_emission_source: !!catKpiForm.is_emission_source,
      };
      if (catKpiForm.indicator_id) payload.indicator_id = Number(catKpiForm.indicator_id);
      if (catKpiForm.scope_number) payload.scope_number = Number(catKpiForm.scope_number);
      if (catKpiForm.energy_type) payload.energy_type = catKpiForm.energy_type;
      await platformApi.createCatalogKPI(payload);
      toast.success("Catalog KPI created");
      setAddCatalogOpen(false);
      refreshTab();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to create catalog KPI"));
    } finally {
      setAddCatalogLoading(false);
    }
  };

  const handleCreateIndicator = async () => {
    setActionLoading(true);
    try {
      const { show_when_indicator_id, show_when_equals, ...rest } = indicatorCreateForm;
      const resolvedId = show_when_indicator_id === NONE_VALUE ? "" : show_when_indicator_id;
      const show_when = resolvedId ? { indicator_id: Number(resolvedId), equals: show_when_equals ?? "" } : null;
      await platformApi.createSystemIndicator({ ...rest, module_id: Number(rest.module_id), display_order: Number(rest.display_order), show_when });
      toast.success("Indicator created");
      setCreateType(null);
      refreshTab();
    } catch (err: any) {
      const detail = err.response?.data?.detail ?? err.message ?? "Failed";
      toast.error(Array.isArray(detail) ? detail.map((e: any) => e.msg).join("; ") : String(detail));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateFY = async () => {
    setActionLoading(true);
    try {
      const existing = fys.find((f) => f.start_date === fyCreateForm.start_date || f.end_date === fyCreateForm.end_date);
      if (existing) throw new Error(`Dates overlap with existing FY "${existing.fy_label}"`);
      await platformApi.createFY(fyCreateForm);
      toast.success("Financial year added");
      setCreateType(null);
      refreshTab();
    } catch (err: any) {
      const detail = err.response?.data?.detail ?? err.message ?? "Failed";
      toast.error(Array.isArray(detail) ? detail.map((e: any) => e.msg).join("; ") : String(detail));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreatePlan = async () => {
    setActionLoading(true);
    try {
      await platformApi.createPlan({
        plan_name: planCreateForm.plan_name,
        max_users: Number(planCreateForm.max_users),
        max_locations: Number(planCreateForm.max_locations),
        max_kpis: Number(planCreateForm.max_kpis),
      });
      toast.success("Plan created");
      setCreateType(null);
      refreshTab();
    } catch (err: any) {
      const detail = err.response?.data?.detail ?? err.message ?? "Failed";
      toast.error(Array.isArray(detail) ? detail.map((e: any) => e.msg).join("; ") : String(detail));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateUOM = async () => {
    setActionLoading(true);
    try {
      await platformApi.createUOM(uomCreateForm);
      toast.success("UOM created");
      setCreateType(null);
      refreshTab();
    } catch (err: any) {
      const detail = err.response?.data?.detail ?? err.message ?? "Failed";
      toast.error(Array.isArray(detail) ? detail.map((e: any) => e.msg).join("; ") : String(detail));
    } finally {
      setActionLoading(false);
    }
  };


  const handleEditIndicator = async (data: Record<string, any>) => {
    if (!editIndicatorData) return;
    setActionLoading(true);
    try {
      const { show_when_indicator_id, show_when_equals, ...rest } = data;
      const resolvedId = show_when_indicator_id === "__none__" ? "" : show_when_indicator_id;
      const payload = {
        ...rest,
        // Empty dict {} signals the backend to clear the condition; populated dict sets it.
        show_when: resolvedId
          ? { indicator_id: Number(resolvedId), equals: show_when_equals ?? "" }
          : {},
      };
      await platformApi.updateSystemIndicator(editIndicatorData.indicator_id, payload);
      toast.success("Indicator updated");
      setEditIndicatorData(null);
      refreshTab();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to update indicator"));
    } finally { setActionLoading(false); }
  };

  const handleEditFY = async (data: Record<string, any>) => {
    if (!editFYData) return;
    setActionLoading(true);
    try {
      await platformApi.updateFY(editFYData.year_id, { fy_label: data.fy_label });
      toast.success("Financial year updated");
      setEditFYData(null);
      refreshTab();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to update financial year"));
    } finally { setActionLoading(false); }
  };


  const handleEditCatalogKPI = async (data: Record<string, any>) => {
    if (!editCatalogKPIData) return;
    setActionLoading(true);
    try {
      const payload: Record<string, any> = {
        kpi_name: data.kpi_name,
        unit: data.unit,
        input_type: data.input_type,
        description: data.description || null,
        is_emission_source: !!data.is_emission_source,
        indicator_id: data.indicator_id && data.indicator_id !== "__none__" ? Number(data.indicator_id) : null,
        scope_number: data.scope_number && data.scope_number !== "__none__" ? Number(data.scope_number) : null,
        energy_type:  data.energy_type  && data.energy_type  !== "__none__" ? data.energy_type : null,
        is_active: !!data.is_active,
      };
      await platformApi.updateCatalogKPI(editCatalogKPIData.kpi_id, payload);
      toast.success("Catalog KPI updated");
      setEditCatalogKPIData(null);
      refreshTab();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to update catalog KPI"));
    } finally { setActionLoading(false); }
  };

  const handleAddCatalogFactor = async (data: Record<string, any>) => {
    if (!factorDrawerKPI) return;
    setActionLoading(true);
    try {
      await platformApi.addCatalogFactor(factorDrawerKPI.kpi_id, {
        energy_factor: Number(data.energy_factor),
        energy_factor_uom: data.energy_factor_uom,
        emission_factor: Number(data.emission_factor),
        emission_factor_uom: data.emission_factor_uom,
        valid_from: data.valid_from,
        valid_to: data.valid_to || null,
        source: data.source || null,
      });
      toast.success("Catalog factor added");
      setAddFactorOpen(false);
      loadDrawerFactors(factorDrawerKPI.kpi_id);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to add factor"));
    } finally { setActionLoading(false); }
  };

  const handleEditCatalogFactor = async (data: Record<string, any>) => {
    if (!editCatalogFactorData || !factorDrawerKPI) return;
    setActionLoading(true);
    try {
      await platformApi.updateCatalogFactor(editCatalogFactorData.factor_id, {
        energy_factor: Number(data.energy_factor),
        energy_factor_uom: data.energy_factor_uom,
        emission_factor: Number(data.emission_factor),
        emission_factor_uom: data.emission_factor_uom,
        valid_to: data.valid_to || null,
        source: data.source || null,
      });
      toast.success("Catalog factor updated");
      setEditCatalogFactorData(null);
      loadDrawerFactors(factorDrawerKPI.kpi_id);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to update factor"));
    } finally { setActionLoading(false); }
  };

  const handleEditUOM = async (data: Record<string, any>) => {
    if (!editUOMData) return;
    setActionLoading(true);
    try {
      await platformApi.updateUOM(editUOMData.uom_id, {
        display_name: data.display_name,
        category: data.category,
        is_active: data.is_active,
      });
      toast.success("UOM updated");
      setEditUOMData(null);
      refreshTab();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to update UOM"));
    } finally { setActionLoading(false); }
  };


  const filteredIndicators = catModuleFilter ? indicators.filter((c) => c.module_id === catModuleFilter) : indicators;

  const tabs: { key: Tab; label: string }[] = [
    { key: "modules", label: "Modules" },
    { key: "indicators", label: "Indicators" },
    { key: "catalog", label: "Catalog KPIs" },
    { key: "fys", label: "Financial Years" },
    { key: "plans", label: "Plans" },
    { key: "uoms", label: "Units of Measure" },
    { key: "vocab", label: "Vocabularies" },
  ];

  // Catalog tab — derived data + UOM options
  const energyUOMs    = uoms.filter((u) => u.category === "energy");
  const emissionUOMs  = uoms.filter((u) => u.category === "emission");
  const kpiUnitUOMs   = uoms.filter((u) => u.category !== "emission");
  const defaultEnergyUOM   = energyUOMs[0]?.symbol   ?? "MJ";
  const defaultEmissionUOM = emissionUOMs[0]?.symbol ?? "tCO2e";

  const filteredCatalogKPIs = catalogKPIs.filter((k) =>
    (!catalogModuleFilter    || k.module_id === catalogModuleFilter) &&
    (!catalogIndicatorFilter || k.indicator_id === catalogIndicatorFilter)
  );
  const indicatorsForCatalogModule = catalogModuleFilter
    ? indicators.filter((i) => i.is_system && i.module_id === catalogModuleFilter)
    : indicators.filter((i) => i.is_system);

  const addCatalogFactorFields: FormField[] = [
    { key: "energy_factor", label: "Energy Factor", type: "number", required: true, placeholder: "3.6" },
    { key: "energy_factor_uom", label: "Energy UOM", type: "select", required: true, defaultValue: defaultEnergyUOM, options: energyUOMs.map((u) => ({ value: u.symbol, label: `${u.symbol} — ${u.display_name}` })) },
    { key: "emission_factor", label: "Emission Factor", type: "number", required: true, placeholder: "0.82" },
    { key: "emission_factor_uom", label: "Emission UOM", type: "select", required: true, defaultValue: defaultEmissionUOM, options: emissionUOMs.map((u) => ({ value: u.symbol, label: `${u.symbol} — ${u.display_name}` })) },
    { key: "valid_from", label: "Valid From", type: "date", required: true },
    { key: "valid_to", label: "Valid To", type: "date", helpText: "Leave empty for current / ongoing" },
    { key: "source", label: "Source", placeholder: "IPCC 2024, CEA Grid Factor" },
  ];

  useEffect(() => {
    if (!editIndicatorData) return;
    setIndicatorEditForm({
      indicator_name: editIndicatorData.indicator_name,
      description: editIndicatorData.description || "",
      input_type: editIndicatorData.input_type || "numeric",
      unit: editIndicatorData.unit || "",
      show_when_indicator_id: editIndicatorData.show_when?.indicator_id ? String(editIndicatorData.show_when.indicator_id) : NONE_VALUE,
      show_when_equals: String(editIndicatorData.show_when?.equals ?? ""),
      display_order: editIndicatorData.display_order,
      is_active: editIndicatorData.is_active,
    });
  }, [editIndicatorData]);

  useEffect(() => {
    if (!editFYData) return;
    setFyEditForm({
      fy_label: editFYData.fy_label,
      start_date: editFYData.start_date,
      end_date: editFYData.end_date,
    });
  }, [editFYData]);

  useEffect(() => {
    if (!editCatalogKPIData) return;
    setCatalogKpiEditForm({
      kpi_name: editCatalogKPIData.kpi_name,
      indicator_id: editCatalogKPIData.indicator_id ? String(editCatalogKPIData.indicator_id) : NONE_VALUE,
      unit: editCatalogKPIData.unit ?? "—",
      input_type: editCatalogKPIData.input_type ?? "numeric",
      description: editCatalogKPIData.description ?? "",
      is_emission_source: !!editCatalogKPIData.is_emission_source,
      scope_number: editCatalogKPIData.scope_number ? String(editCatalogKPIData.scope_number) : NONE_VALUE,
      energy_type: editCatalogKPIData.energy_type ?? NONE_VALUE,
      is_active: editCatalogKPIData.is_active,
    });
  }, [editCatalogKPIData]);

  useEffect(() => {
    if (!addFactorOpen) return;
    setCatalogFactorForm({
      energy_factor: "",
      energy_factor_uom: defaultEnergyUOM,
      emission_factor: "",
      emission_factor_uom: defaultEmissionUOM,
      valid_from: "",
      valid_to: "",
      source: "",
    });
  }, [addFactorOpen, defaultEnergyUOM, defaultEmissionUOM]);

  useEffect(() => {
    if (!editCatalogFactorData) return;
    setCatalogFactorEditForm({
      energy_factor: editCatalogFactorData.energy_factor,
      energy_factor_uom: editCatalogFactorData.energy_factor_uom,
      emission_factor: editCatalogFactorData.emission_factor,
      emission_factor_uom: editCatalogFactorData.emission_factor_uom,
      valid_to: editCatalogFactorData.valid_to ?? "",
      source: editCatalogFactorData.source ?? "",
    });
  }, [editCatalogFactorData]);

  useEffect(() => {
    if (!editUOMData) return;
    setUomEditForm({
      display_name: editUOMData.display_name,
      category: editUOMData.category,
      is_active: editUOMData.is_active !== false,
    });
  }, [editUOMData]);

  return (
    <PageShell
      title="System Configuration"
      description="Manage platform-wide ESG modules, indicators, catalog KPIs and factors, financial years, and plans."
      breadcrumb={[{ label: "Platform Admin", href: "/platform" }, { label: "System Configuration" }]}
    >
      <PageTabs tabs={tabs} value={tab} onChange={(key) => setTab(key as Tab)} className="mb-4" />

      {loading ? <div className="surface p-6"><LoadingSkeleton rows={6} cols={4} /></div> : (
        <>
          {/* MODULES TAB */}
          {tab === "modules" && (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {isOwner && (
                <div className="px-5 py-3 border-b border-[hsl(var(--border-hairline))] flex justify-end">
                  <Button size="sm" onClick={openModuleCreate}><Plus size={14} /> Add Module</Button>
                </div>
              )}
              <table className="w-full text-[13px]">
                <thead><tr className="border-b-2 border-[hsl(var(--border-hairline))] bg-sunken/60">
                  {["Icon", "Module", "Data Entry Style", "Order", "Status", ...(isOwner ? [""] : [])].map((h) => <th key={h} className="text-left px-4 py-3 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">{h}</th>)}
                </tr></thead>
                <tbody>
                  {modules.map((m) => {
                    const Icon = getModuleIcon(m.icon_name);
                    const rtLabel = MODULE_RENDER_TYPES.find((r) => r.value === m.render_type)?.label ?? m.render_type ?? "—";
                    return (
                      <tr key={m.module_id} className="border-b border-[hsl(var(--border-hairline))] hover:bg-sunken/60">
                        <td className="px-4 py-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: m.bg_color || "#f8fafc" }}>
                            <Icon size={16} style={{ color: m.color || "#64748b" }} />
                          </div>
                        </td>
                        <td className="px-4 py-2 font-semibold text-foreground">{m.module_name}</td>
                        <td className="px-4 py-2 text-muted-foreground text-[12px]">{rtLabel}</td>
                        <td className="px-4 py-2 text-muted-foreground">{m.display_order}</td>
                        <td className="px-4 py-2"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                              m.lifecycle_status === "PUBLISHED" ? "bg-ok-tint text-ok" :
                              m.lifecycle_status === "DEPRECATED" ? "bg-warn-tint text-warn" :
                              m.lifecycle_status === "ARCHIVED" ? "bg-red-100 text-destructive" :
                              "bg-sunken text-muted-foreground"
                            }`}>{m.lifecycle_status === "PUBLISHED" ? "Published" : m.lifecycle_status === "DEPRECATED" ? "Deprecated" : m.lifecycle_status === "ARCHIVED" ? "Archived" : "Draft"}</span></td>
                        {isOwner && (
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1">
                              <button onClick={() => openModuleEdit(m)} className="p-1.5 rounded-md hover:bg-sunken text-muted-foreground hover:text-muted-foreground transition-colors"><Pencil size={14} /></button>
                              {m.lifecycle_status === "DRAFT" && (
                                <button onClick={() => setDeleteModuleTarget(m)} className="p-1.5 rounded-md hover:bg-destructive-tint text-muted-foreground/40 hover:text-destructive transition-colors"><Trash2 size={14} /></button>
                              )}
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

          {/* INDICATORS TAB */}
          {tab === "indicators" && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Select
                  value={catModuleFilter ? String(catModuleFilter) : "__all__"}
                  onValueChange={(v) => setCatModuleFilter(v === "__all__" ? null : Number(v))}
                >
                  <SelectTrigger className="h-9 w-[180px] text-ui">
                    <SelectValue placeholder="All Modules" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Modules</SelectItem>
                    {modules.map((m) => (
                      <SelectItem key={m.module_id} value={String(m.module_id)}>{m.module_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isOwner && <Button size="sm" onClick={() => openCreate("indicators")}><Plus size={14} /> Add Indicator</Button>}
              </div>
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead><tr className="border-b-2 border-[hsl(var(--border-hairline))] bg-sunken/60">
                    {["Indicator", "Module", "Input", "Order", "Type", "Status", ...(isOwner ? [""] : [])].map((h) => <th key={h} className="text-left px-4 py-3 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {filteredIndicators.map((c) => {
                      const mod = modules.find((m) => m.module_id === c.module_id);
                      const inputLabel = c.input_type === "boolean" ? "Yes / No" : c.input_type === "text" ? "Text" : "Numeric";
                      return (
                        <tr key={c.indicator_id} className="border-b border-[hsl(var(--border-hairline))] hover:bg-sunken/60">
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-foreground">{c.indicator_name}</span>
                              {c.has_data && <Lock size={11} className="text-muted-foreground/40 flex-shrink-0" aria-label="Data submitted — name is locked" />}
                            </div>
                            {c.description && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{c.description}</p>}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground text-[12px]">{mod?.module_name || "—"}</td>
                          <td className="px-4 py-2">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.input_type === "text" ? "bg-info-tint text-info" : c.input_type === "boolean" ? "bg-warn-tint text-warn" : "bg-sunken text-muted-foreground"}`}>
                              {inputLabel}{c.unit ? ` (${c.unit})` : ""}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">{c.display_order}</td>
                          <td className="px-4 py-2">
                            <span className={`flex items-center gap-1 w-fit text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.is_system ? "bg-sunken text-muted-foreground" : "bg-info-tint text-info"}`}>
                              {c.is_system && <Lock size={9} />} {c.is_system ? "System" : "Custom"}
                            </span>
                          </td>
                          <td className="px-4 py-2"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.is_active ? "bg-ok-tint text-ok" : "bg-sunken text-muted-foreground"}`}>{c.is_active ? "Active" : "Inactive"}</span></td>
                          {isOwner && (
                            <td className="px-4 py-2">
                              <button onClick={() => setEditIndicatorData(c)} className="p-1.5 rounded-md hover:bg-sunken text-muted-foreground hover:text-muted-foreground transition-colors"><Pencil size={14} /></button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* FYs TAB */}
          {tab === "fys" && (
            <div>
              {isOwner && (
                <div className="mb-4"><Button size="sm" onClick={() => openCreate("fys")}><Plus size={14} /> Add Financial Year</Button></div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {fys.map((fy) => (
                  <div key={fy.year_id} className="relative bg-card rounded-xl border border-border p-4 text-center hover:border-border transition-colors group">
                    <div className="text-[16px] font-bold text-foreground mb-1">{fy.fy_label}</div>
                    <div className="text-[11px] text-muted-foreground">{formatDate(fy.start_date)} → {formatDate(fy.end_date)}</div>
                    {isOwner && (
                      <button
                        onClick={() => setEditFYData(fy)}
                        className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-sunken text-muted-foreground hover:text-muted-foreground transition-all"
                      >
                        <Pencil size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PLANS TAB */}
          {tab === "plans" && (
            <div>
              {isOwner && (
                <div className="mb-4"><Button size="sm" onClick={() => openCreate("plans")}><Plus size={14} /> Add Plan</Button></div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {plans.map((p) => (
                  <div key={p.plan_id} className="relative bg-card rounded-xl border-2 border-border p-6 text-center hover:border-primary/50 transition-colors group">
                    <div className="text-[20px] font-bold text-foreground mb-4">{p.plan_name}</div>
                    <div className="flex flex-col gap-2 text-[13px]">
                      <div className="flex justify-between py-2 border-b border-[hsl(var(--border-hairline))]"><span className="text-muted-foreground">Users</span><span className="font-bold text-foreground">{p.max_users === -1 ? "Unlimited" : p.max_users}</span></div>
                      <div className="flex justify-between py-2 border-b border-[hsl(var(--border-hairline))]"><span className="text-muted-foreground">Locations</span><span className="font-bold text-foreground">{p.max_locations === -1 ? "Unlimited" : p.max_locations}</span></div>
                      <div className="flex justify-between py-2"><span className="text-muted-foreground">KPIs</span><span className="font-bold text-foreground">{p.max_kpis === -1 ? "Unlimited" : p.max_kpis}</span></div>
                    </div>
                    {/* One-line capability summary */}
                    {planCapSummary[p.plan_id] && (
                      <div className="mt-3 pt-3 border-t border-[hsl(var(--border-hairline))]">
                        <p className="text-[11px] text-muted-foreground">
                          {planCapSummary[p.plan_id].modules.length} Module{planCapSummary[p.plan_id].modules.length !== 1 ? "s" : ""}
                          {planCapSummary[p.plan_id].features.length > 0 && ` · ${planCapSummary[p.plan_id].features.length} Feature${planCapSummary[p.plan_id].features.length !== 1 ? "s" : ""}`}
                        </p>
                      </div>
                    )}
                    {isOwner && (
                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={() => openCapabilities(p)}
                          className="p-1.5 rounded-md hover:bg-sunken text-muted-foreground hover:text-muted-foreground"
                          title="Edit plan"
                        >
                          <Pencil size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Plan Capabilities Dialog */}
          {capPlan && (
            <Sheet open={!!capPlan} onOpenChange={(open) => { if (!open) setCapPlan(null); }}>
              <SheetContent size="wide">
                <SheetHeader>
                  <SheetTitle>Manage Capabilities</SheetTitle>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    {capPlan.plan_name} — choose which modules, features, and limits are included.
                  </p>
                </SheetHeader>

                <SheetBody>
                  {capLoading ? (
                    <div className="flex items-center justify-center py-12 text-muted-foreground text-[13px]">Loading…</div>
                  ) : (
                    <>
                      {/* Plan name */}
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Plan Name</p>
                      <input
                        type="text"
                        value={capPlanName}
                        onChange={(e) => setCapPlanName(e.target.value)}
                        className="w-full py-[9px] px-3 rounded-lg border border-border text-[13px] text-foreground outline-none focus:border-primary transition-colors mb-5"
                      />

                      {/* Limits section */}
                      {capFeatureKeys.length > 0 && (
                        <>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Limits</p>
                          <div className="flex flex-col gap-2 mb-5">
                            {capFeatureKeys.map((k: any) => (
                              <div key={k.feature_key} className="flex items-center justify-between gap-4 px-3 py-2.5 rounded-lg border border-border bg-card">
                                <div className="min-w-0">
                                  <div className="text-[13px] font-semibold text-foreground">{k.label}</div>
                                  {k.description && <div className="text-[11px] text-muted-foreground mt-0.5">{k.description}</div>}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <input
                                    type="number"
                                    value={capQuotas[k.feature_key] ?? 0}
                                    onChange={(e) => setCapQuotas((prev) => ({ ...prev, [k.feature_key]: Number(e.target.value) }))}
                                    className="w-20 py-1.5 px-2 rounded-lg border border-border text-[13px] text-foreground text-right outline-none focus:border-primary transition-colors"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setCapQuotas((prev) => ({ ...prev, [k.feature_key]: -1 }))}
                                    className="text-[12px] text-muted-foreground hover:text-primary transition-colors"
                                    title="Set unlimited"
                                  >∞</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {/* Modules section */}
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Modules</p>
                      {capModules.length === 0 && (
                        <p className="text-[12px] text-muted-foreground mb-4">No modules defined yet.</p>
                      )}
                      <div className="flex flex-col gap-1 mb-5">
                        {capModules.map((m: any) => {
                          const Icon = getModuleIcon(m.icon_name);
                          const included = capModuleIds.has(m.module_id);
                          const disabled = m.lifecycle_status === "ARCHIVED";
                          return (
                            <button
                              key={m.module_id}
                              type="button"
                              disabled={disabled}
                              onClick={() => {
                                setCapModuleIds((prev) => {
                                  const next = new Set(prev);
                                  included ? next.delete(m.module_id) : next.add(m.module_id);
                                  return next;
                                });
                              }}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all
                                ${included ? "border-primary bg-primary/5" : "border-border hover:border-border bg-card"}
                                ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                            >
                              <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: m.color ? `${m.color}20` : "#f1f5f9" }}>
                                <Icon size={14} style={{ color: m.color || "#64748b" }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={`text-[13px] font-semibold ${included ? "text-primary" : "text-foreground"}`}>{m.module_name}</div>
                                {m.lifecycle_status !== "PUBLISHED" && (
                                  <div className="text-[10px] text-muted-foreground font-medium mt-0.5 uppercase tracking-wide">{m.lifecycle_status}</div>
                                )}
                              </div>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
                                ${included ? "bg-primary border-primary" : "border-border"}`}>
                                {included && <Check size={11} className="text-white" strokeWidth={3} />}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Features section */}
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Features</p>
                      {capFeatures.length === 0 && (
                        <p className="text-[12px] text-muted-foreground">No features defined yet.</p>
                      )}
                      <div className="flex flex-col gap-1">
                        {capFeatures.map((f: any) => {
                          const Icon = getModuleIcon(f.icon_name);
                          const included = capFeatureIds.has(f.feature_id);
                          const disabled = f.lifecycle_status === "ARCHIVED";
                          return (
                            <button
                              key={f.feature_id}
                              type="button"
                              disabled={disabled}
                              onClick={() => {
                                setCapFeatureIds((prev) => {
                                  const next = new Set(prev);
                                  included ? next.delete(f.feature_id) : next.add(f.feature_id);
                                  return next;
                                });
                              }}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all
                                ${included ? "border-primary bg-primary/5" : "border-border hover:border-border bg-card"}
                                ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                            >
                              <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: f.color ? `${f.color}20` : "#f1f5f9" }}>
                                <Icon size={14} style={{ color: f.color || "#64748b" }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={`text-[13px] font-semibold ${included ? "text-primary" : "text-foreground"}`}>{f.feature_name}</div>
                                {f.lifecycle_status !== "PUBLISHED" && (
                                  <div className="text-[10px] text-muted-foreground font-medium mt-0.5 uppercase tracking-wide">{f.lifecycle_status}</div>
                                )}
                              </div>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
                                ${included ? "bg-primary border-primary" : "border-border"}`}>
                                {included && <Check size={11} className="text-white" strokeWidth={3} />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </SheetBody>

                <SheetFooter>
                  <button onClick={() => setCapPlan(null)} className="px-4 py-2 rounded-lg text-[13px] font-semibold text-muted-foreground hover:bg-sunken transition-colors">Cancel</button>
                  <button
                    onClick={saveCapabilities}
                    disabled={capSaving || capLoading}
                    className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-primary text-white hover:bg-primaryDk transition-colors disabled:opacity-60"
                  >
                    {capSaving ? "Saving…" : "Save"}
                  </button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          )}

          {/* CATALOG KPIs TAB */}
          {tab === "catalog" && (
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <Select
                  value={catalogModuleFilter ? String(catalogModuleFilter) : "__all__"}
                  onValueChange={(v) => {
                    setCatalogModuleFilter(v === "__all__" ? null : Number(v));
                    setCatalogIndicatorFilter(null);
                  }}
                >
                  <SelectTrigger className="h-9 w-[180px] text-ui">
                    <SelectValue placeholder="All Modules" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Modules</SelectItem>
                    {modules.map((m) => (
                      <SelectItem key={m.module_id} value={String(m.module_id)}>{m.module_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={catalogIndicatorFilter ? String(catalogIndicatorFilter) : "__all__"}
                  onValueChange={(v) => setCatalogIndicatorFilter(v === "__all__" ? null : Number(v))}
                >
                  <SelectTrigger className="h-9 w-[200px] text-ui">
                    <SelectValue placeholder="All Indicators" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Indicators</SelectItem>
                    {indicatorsForCatalogModule.map((i) => (
                      <SelectItem key={i.indicator_id} value={String(i.indicator_id)}>{i.indicator_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isOwner && (
                  <Button size="sm" onClick={handleOpenAddCatalog}>
                    <Plus size={14} /> Add Catalog KPI
                  </Button>
                )}
                <span className="text-[11px] text-muted-foreground ml-auto">{filteredCatalogKPIs.length} KPI{filteredCatalogKPIs.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b-2 border-[hsl(var(--border-hairline))] bg-sunken/60">
                      {["KPI", "Module", "Indicator", "Unit", "Input", "Scope", "Emission", "Status", ...(isOwner ? [""] : [])].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCatalogKPIs.length === 0 && (
                      <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground text-[13px]">No catalog KPIs yet. Click "Add Catalog KPI" to create one.</td></tr>
                    )}
                    {filteredCatalogKPIs.map((k) => {
                      const mod = modules.find((m) => m.module_id === k.module_id);
                      const ind = k.indicator_id ? indicators.find((i) => i.indicator_id === k.indicator_id) : null;
                      const inputLabel = k.input_type === "boolean" ? "Yes / No" : k.input_type === "text" ? "Text" : "Numeric";
                      return (
                        <tr key={k.kpi_id} className="border-b border-[hsl(var(--border-hairline))] hover:bg-sunken/60">
                          <td className="px-4 py-2">
                            <div className="font-semibold text-foreground">{k.kpi_name}</div>
                            {k.description && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{k.description}</p>}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground text-[12px]">{mod?.module_name || "—"}</td>
                          <td className="px-4 py-2 text-muted-foreground text-[12px]">{ind?.indicator_name || "—"}</td>
                          <td className="px-4 py-2 text-muted-foreground">{k.unit || "—"}</td>
                          <td className="px-4 py-2">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sunken text-muted-foreground">{inputLabel}</span>
                          </td>
                          <td className="px-4 py-2">
                            {k.scope_number ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-info-tint text-info">Scope {k.scope_number}</span> : <span className="text-muted-foreground/40 text-[11px]">—</span>}
                          </td>
                          <td className="px-4 py-2">
                            {k.is_emission_source ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-destructive-tint text-destructive">Auto-Computed</span> : <span className="text-muted-foreground/40 text-[11px]">—</span>}
                          </td>
                          <td className="px-4 py-2"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${k.is_active ? "bg-ok-tint text-ok" : "bg-sunken text-muted-foreground"}`}>{k.is_active ? "Active" : "Inactive"}</span></td>
                          {isOwner && (
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-1">
                                <button onClick={() => openFactorDrawer(k)} title="Manage conversion factors" className="p-1.5 rounded-md hover:bg-sunken text-muted-foreground hover:text-primary transition-colors"><Gauge size={14} /></button>
                                <button onClick={() => setEditCatalogKPIData(k)} title="Edit KPI" className="p-1.5 rounded-md hover:bg-sunken text-muted-foreground hover:text-muted-foreground transition-colors"><Pencil size={14} /></button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* UOMs TAB */}
          {tab === "uoms" && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Select
                  value={uomCategoryFilter || "__all__"}
                  onValueChange={(v) => setUomCategoryFilter(v === "__all__" ? "" : v)}
                >
                  <SelectTrigger className="h-9 w-[180px] text-ui">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Categories</SelectItem>
                    {UOM_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isOwner && (
                  <Button size="sm" onClick={() => openCreate("uoms")}>
                    <Plus size={14} /> Add UOM
                  </Button>
                )}
              </div>
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b-2 border-[hsl(var(--border-hairline))] bg-sunken/60">
                      {["Symbol", "Display Name", "Category", "Status", ...(isOwner ? [""] : [])].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {uoms
                      .filter((u) => !uomCategoryFilter || u.category === uomCategoryFilter)
                      .map((u) => (
                        <tr key={u.uom_id} className="border-b border-[hsl(var(--border-hairline))] hover:bg-sunken/60">
                          <td className="px-4 py-2 font-mono font-semibold text-foreground">{u.symbol}</td>
                          <td className="px-4 py-2 text-muted-foreground">{u.display_name}</td>
                          <td className="px-4 py-2">
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sunken text-muted-foreground">
                              {CATEGORY_LABEL[u.category] ?? u.category}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${u.is_active !== false ? "bg-ok-tint text-ok" : "bg-sunken text-muted-foreground"}`}>
                              {u.is_active !== false ? "Active" : "Inactive"}
                            </span>
                          </td>
                          {isOwner && (
                            <td className="px-4 py-2">
                              <button onClick={() => setEditUOMData(u)} className="p-1.5 rounded-md hover:bg-sunken text-muted-foreground hover:text-muted-foreground transition-colors">
                                <Pencil size={14} />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VOCABULARIES TAB */}
          {tab === "vocab" && <VocabulariesManager isOwner={isOwner} />}
        </>
      )}

      <Sheet open={createType === "indicators"} onOpenChange={(open) => { if (!open) setCreateType(null); }}>
        <SheetContent size="wide">
          <SheetHeader>
            <SheetTitle>Add System Indicator</SheetTitle>
          </SheetHeader>
          <SheetBody className="space-y-5">
            <FormSection title="Indicator Details" description="Define system indicator behavior and visibility">
              <FormRow cols={2}>
                <WorkspaceField label="Module" required>
                  <Select value={String(indicatorCreateForm.module_id ?? "")} onValueChange={(value) => setIndicatorCreateForm((prev) => ({ ...prev, module_id: value }))}>
                    <SelectTrigger><SelectValue placeholder="Select module" /></SelectTrigger>
                    <SelectContent>
                      {modules.map((m) => <SelectItem key={m.module_id} value={String(m.module_id)}>{m.module_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </WorkspaceField>
                <WorkspaceField label="Indicator Name" required>
                  <input value={indicatorCreateForm.indicator_name ?? ""} onChange={(e) => setIndicatorCreateForm((prev) => ({ ...prev, indicator_name: e.target.value }))} placeholder="e.g. Anti-corruption policy coverage" className="field-input" />
                </WorkspaceField>
              </FormRow>
              <WorkspaceField label="Help Text" className="mt-4">
                <textarea value={indicatorCreateForm.description ?? ""} onChange={(e) => setIndicatorCreateForm((prev) => ({ ...prev, description: e.target.value }))} rows={3} className="field-input h-auto min-h-[88px] resize-none" />
              </WorkspaceField>
              <FormRow cols={2} className="mt-4">
                <WorkspaceField label="Input Type" required>
                  <Select value={String(indicatorCreateForm.input_type ?? "numeric")} onValueChange={(value) => setIndicatorCreateForm((prev) => ({ ...prev, input_type: value }))}>
                    <SelectTrigger><SelectValue placeholder="Select input type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="numeric">Numeric</SelectItem>
                      <SelectItem value="boolean">Yes / No</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                    </SelectContent>
                  </Select>
                </WorkspaceField>
                <WorkspaceField label="Unit">
                  <input value={indicatorCreateForm.unit ?? ""} onChange={(e) => setIndicatorCreateForm((prev) => ({ ...prev, unit: e.target.value }))} placeholder="e.g. %, tonnes" className="field-input" />
                </WorkspaceField>
              </FormRow>
              <FormRow cols={2} className="mt-4">
                <WorkspaceField label="Depends on" hint="Optional. Show this indicator only when another answer matches.">
                  <Select value={String(indicatorCreateForm.show_when_indicator_id ?? NONE_VALUE)} onValueChange={(value) => setIndicatorCreateForm((prev) => ({ ...prev, show_when_indicator_id: value }))}>
                    <SelectTrigger><SelectValue placeholder="Always show" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>Always show</SelectItem>
                      {indicators.filter((i) => i.input_type === "boolean" || i.input_type === "text").map((i) => (
                        <SelectItem key={i.indicator_id} value={String(i.indicator_id)}>{i.indicator_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </WorkspaceField>
                <WorkspaceField label="Equals" hint="Value that must match on the selected indicator.">
                  <input value={indicatorCreateForm.show_when_equals ?? ""} onChange={(e) => setIndicatorCreateForm((prev) => ({ ...prev, show_when_equals: e.target.value }))} placeholder="e.g. Y or N" className="field-input" />
                </WorkspaceField>
              </FormRow>
              <WorkspaceField label="Display Order" className="mt-4">
                <input type="number" value={indicatorCreateForm.display_order ?? 1} onChange={(e) => setIndicatorCreateForm((prev) => ({ ...prev, display_order: Number(e.target.value) }))} className="field-input" />
              </WorkspaceField>
            </FormSection>
          </SheetBody>
          <SheetFooter>
            <button onClick={() => setCreateType(null)} className="px-4 py-2.5 rounded-lg border border-border text-[13px] font-semibold text-muted-foreground hover:bg-sunken transition-colors">Cancel</button>
            <button onClick={handleCreateIndicator} disabled={actionLoading} className="px-5 py-2.5 rounded-lg bg-primary text-[13px] font-semibold text-white hover:bg-primaryDk transition-colors disabled:opacity-60">{actionLoading ? "Creating…" : "Create"}</button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={createType === "fys"} onOpenChange={(open) => { if (!open) setCreateType(null); }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add Financial Year</SheetTitle>
          </SheetHeader>
          <SheetBody className="space-y-5">
            <FormSection title="Financial Year" description="Create a new reporting period">
              <WorkspaceField label="FY Label" required>
                <input value={fyCreateForm.fy_label ?? ""} onChange={(e) => setFyCreateForm((prev) => ({ ...prev, fy_label: e.target.value }))} placeholder="e.g. 2026-27" className="field-input" />
              </WorkspaceField>
              <FormRow cols={2} className="mt-4">
                <WorkspaceField label="Start Date" required>
                  <input type="date" value={fyCreateForm.start_date ?? ""} onChange={(e) => setFyCreateForm((prev) => ({ ...prev, start_date: e.target.value }))} className="field-input" />
                </WorkspaceField>
                <WorkspaceField label="End Date" required>
                  <input type="date" value={fyCreateForm.end_date ?? ""} onChange={(e) => setFyCreateForm((prev) => ({ ...prev, end_date: e.target.value }))} className="field-input" />
                </WorkspaceField>
              </FormRow>
            </FormSection>
          </SheetBody>
          <SheetFooter>
            <button onClick={() => setCreateType(null)} className="px-4 py-2.5 rounded-lg border border-border text-[13px] font-semibold text-muted-foreground hover:bg-sunken transition-colors">Cancel</button>
            <button onClick={handleCreateFY} disabled={actionLoading} className="px-5 py-2.5 rounded-lg bg-primary text-[13px] font-semibold text-white hover:bg-primaryDk transition-colors disabled:opacity-60">{actionLoading ? "Creating…" : "Create"}</button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={createType === "plans"} onOpenChange={(open) => { if (!open) setCreateType(null); }}>
        <SheetContent size="wide">
          <SheetHeader>
            <SheetTitle>Add Plan</SheetTitle>
          </SheetHeader>
          <SheetBody className="space-y-5">
            <FormSection title="Plan Limits" description="Define included quota ceilings for the subscription plan">
              <WorkspaceField label="Plan Name" required>
                <input value={planCreateForm.plan_name ?? ""} onChange={(e) => setPlanCreateForm((prev) => ({ ...prev, plan_name: e.target.value }))} placeholder="Business" className="field-input" />
              </WorkspaceField>
              <FormRow cols={3} className="mt-4">
                <WorkspaceField label="Max Users" required hint="Use -1 for unlimited">
                  <input type="number" value={planCreateForm.max_users ?? ""} onChange={(e) => setPlanCreateForm((prev) => ({ ...prev, max_users: e.target.value }))} className="field-input" />
                </WorkspaceField>
                <WorkspaceField label="Max Locations" required>
                  <input type="number" value={planCreateForm.max_locations ?? ""} onChange={(e) => setPlanCreateForm((prev) => ({ ...prev, max_locations: e.target.value }))} className="field-input" />
                </WorkspaceField>
                <WorkspaceField label="Max KPIs" required>
                  <input type="number" value={planCreateForm.max_kpis ?? ""} onChange={(e) => setPlanCreateForm((prev) => ({ ...prev, max_kpis: e.target.value }))} className="field-input" />
                </WorkspaceField>
              </FormRow>
            </FormSection>
          </SheetBody>
          <SheetFooter>
            <button onClick={() => setCreateType(null)} className="px-4 py-2.5 rounded-lg border border-border text-[13px] font-semibold text-muted-foreground hover:bg-sunken transition-colors">Cancel</button>
            <button onClick={handleCreatePlan} disabled={actionLoading} className="px-5 py-2.5 rounded-lg bg-primary text-[13px] font-semibold text-white hover:bg-primaryDk transition-colors disabled:opacity-60">{actionLoading ? "Creating…" : "Create"}</button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={createType === "uoms"} onOpenChange={(open) => { if (!open) setCreateType(null); }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add Unit of Measure</SheetTitle>
          </SheetHeader>
          <SheetBody className="space-y-5">
            <FormSection title="Unit Definition" description="Create a reusable unit for KPI and factor configuration">
              <WorkspaceField label="Symbol" required>
                <input value={uomCreateForm.symbol ?? ""} onChange={(e) => setUomCreateForm((prev) => ({ ...prev, symbol: e.target.value }))} placeholder="e.g. GJ, tonne-km, INR" className="field-input font-mono" />
              </WorkspaceField>
              <WorkspaceField label="Display Name" required className="mt-4">
                <input value={uomCreateForm.display_name ?? ""} onChange={(e) => setUomCreateForm((prev) => ({ ...prev, display_name: e.target.value }))} placeholder="e.g. Gigajoules" className="field-input" />
              </WorkspaceField>
              <WorkspaceField label="Category" required className="mt-4">
                <Select value={String(uomCreateForm.category ?? "")} onValueChange={(value) => setUomCreateForm((prev) => ({ ...prev, category: value }))}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {UOM_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </WorkspaceField>
            </FormSection>
          </SheetBody>
          <SheetFooter>
            <button onClick={() => setCreateType(null)} className="px-4 py-2.5 rounded-lg border border-border text-[13px] font-semibold text-muted-foreground hover:bg-sunken transition-colors">Cancel</button>
            <button onClick={handleCreateUOM} disabled={actionLoading} className="px-5 py-2.5 rounded-lg bg-primary text-[13px] font-semibold text-white hover:bg-primaryDk transition-colors disabled:opacity-60">{actionLoading ? "Creating…" : "Create"}</button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Delete Module confirm (DRAFT only) ── */}
      <ConfirmDialog
        open={!!deleteModuleTarget}
        onClose={() => setDeleteModuleTarget(null)}
        onConfirm={handleDeleteModule}
        title="Delete Module"
        message={`Permanently delete "${deleteModuleTarget?.module_name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={actionLoading}
      />

      {/* ── Add / Edit Module — custom dialog with icon picker + color swatches ── */}
      {moduleDialogOpen && (
        <Sheet open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
          <SheetContent size="wide">
            <SheetHeader>
              <SheetTitle>{moduleDialogTarget ? "Edit Module" : "Add Module"}</SheetTitle>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                {moduleDialogTarget ? "Update module settings and appearance." : "Create a new ESG module for the platform."}
              </p>
            </SheetHeader>

            <SheetBody className="flex flex-col gap-4">
              {/* Module Name */}
              <div>
                <label className="block text-[12px] font-semibold text-foreground mb-1.5">Module Name <span className="text-destructive">*</span></label>
                <input type="text" value={moduleForm.module_name || ""} onChange={(e) => {
                  const name = e.target.value;
                  setModuleField("module_name", name);
                  if (!moduleDialogTarget) setModuleField("key", slugify(name));
                }}
                  placeholder="e.g. Biodiversity" autoFocus
                  className="w-full py-[9px] px-3 rounded-lg border border-border text-[13px] text-foreground outline-none focus:border-primary transition-colors" />
              </div>

              {/* Key */}
              <div>
                <label className="block text-[12px] font-semibold text-foreground mb-1.5">
                  Key <span className="text-destructive">*</span>
                  <span className="ml-2 text-[11px] font-normal text-muted-foreground">Stable slug — lowercase, underscores only. Cannot change once data exists.</span>
                </label>
                <input type="text" value={moduleForm.key || ""} onChange={(e) => setModuleField("key", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="e.g. biodiversity"
                  className="w-full py-[9px] px-3 rounded-lg border border-border text-[13px] text-foreground outline-none focus:border-primary transition-colors font-mono" />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[12px] font-semibold text-foreground mb-1.5">Description</label>
                <textarea value={moduleForm.description || ""} onChange={(e) => setModuleField("description", e.target.value)}
                  rows={2} placeholder="Describe this ESG module"
                  className="w-full px-3 py-2 rounded-lg border border-border text-[13px] text-foreground outline-none focus:border-primary resize-none transition-colors" />
              </div>

              {/* Color swatches */}
              <div>
                <label className="block text-[12px] font-semibold text-foreground mb-2">Color</label>
                <div className="flex flex-wrap gap-2.5">
                  {MODULE_COLOR_PRESETS.map((p) => (
                    <button key={p.color} type="button" title={p.label}
                      onClick={() => { setModuleField("color", p.color); setModuleField("bg_color", p.bg); }}
                      className={`w-7 h-7 rounded-full transition-all hover:scale-110 ${moduleForm.color === p.color ? "ring-2 ring-offset-2 ring-slate-400 scale-110" : ""}`}
                      style={{ background: p.color }}
                    />
                  ))}
                </div>
              </div>

              {/* Icon picker */}
              <div>
                <label className="block text-[12px] font-semibold text-foreground mb-1.5">Icon</label>
                <IconPicker
                  value={moduleForm.icon_name || "BarChart3"}
                  onChange={(name) => setModuleField("icon_name", name)}
                  accentColor={moduleForm.color}
                />
              </div>

              {/* Data Entry Style */}
              <div>
                <label className="block text-[12px] font-semibold text-foreground mb-1.5">Data Entry Style</label>
                <div className="flex flex-col gap-2">
                  {MODULE_RENDER_TYPES.map((rt) => (
                    <button key={rt.value} type="button"
                      onClick={() => setModuleField("render_type", rt.value)}
                      className={`text-left px-3 py-2.5 rounded-lg border text-[12px] transition-all ${moduleForm.render_type === rt.value ? "border-primary bg-primary/5" : "border-border hover:border-border"}`}>
                      <div className={`font-semibold ${moduleForm.render_type === rt.value ? "text-primary" : "text-foreground"}`}>{rt.label}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{rt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Display Order */}
              <div>
                <label className="block text-[12px] font-semibold text-foreground mb-1.5">Display Order</label>
                <input type="number" value={moduleForm.display_order ?? ""} onChange={(e) => setModuleField("display_order", Number(e.target.value))}
                  className="w-28 py-[9px] px-3 rounded-lg border border-border text-[13px] text-foreground outline-none focus:border-primary transition-colors" />
              </div>

            </SheetBody>

            <SheetFooter>
              <button onClick={() => setModuleDialogOpen(false)} className="px-4 py-2.5 rounded-lg border border-border text-[13px] font-semibold text-muted-foreground hover:bg-sunken transition-colors">Cancel</button>
              <button onClick={handleModuleSubmit} disabled={actionLoading}
                className="px-5 py-2.5 rounded-lg bg-primary text-[13px] font-semibold text-white hover:bg-primaryDk transition-colors disabled:opacity-60">
                {actionLoading ? "Saving…" : moduleDialogTarget ? "Save Changes" : "Create Module"}
              </button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      )}

      {/* Edit Indicator */}
      <Sheet open={!!editIndicatorData} onOpenChange={(open) => { if (!open) setEditIndicatorData(null); }}>
        <SheetContent size="wide">
          <SheetHeader>
            <SheetTitle>Edit Indicator</SheetTitle>
            {editIndicatorData?.has_data && (
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Name is locked because data has already been submitted against this indicator.
              </p>
            )}
          </SheetHeader>
          <SheetBody className="space-y-5">
            <FormSection title="Indicator Details" description="Manage label, input behavior, and display rules">
              <FormRow cols={2}>
                <WorkspaceField
                  label="Indicator Name"
                  required
                  hint={editIndicatorData?.has_data ? "Locked: data has been submitted against this indicator" : undefined}
                >
                  <input
                    value={indicatorEditForm.indicator_name ?? ""}
                    onChange={(e) => setIndicatorEditForm((prev) => ({ ...prev, indicator_name: e.target.value }))}
                    className="field-input"
                    disabled={!!editIndicatorData?.has_data}
                  />
                </WorkspaceField>
                <WorkspaceField label="Input Type" required>
                  <Select
                    value={String(indicatorEditForm.input_type ?? "numeric")}
                    onValueChange={(value) => setIndicatorEditForm((prev) => ({ ...prev, input_type: value }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select input type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="numeric">Numeric</SelectItem>
                      <SelectItem value="boolean">Yes / No</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                    </SelectContent>
                  </Select>
                </WorkspaceField>
              </FormRow>
              <WorkspaceField label="Help Text" className="mt-4">
                <textarea
                  value={indicatorEditForm.description ?? ""}
                  onChange={(e) => setIndicatorEditForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="field-input h-auto min-h-[88px] resize-none"
                />
              </WorkspaceField>
              <FormRow cols={2} className="mt-4">
                <WorkspaceField label="Unit">
                  <input
                    value={indicatorEditForm.unit ?? ""}
                    onChange={(e) => setIndicatorEditForm((prev) => ({ ...prev, unit: e.target.value }))}
                    placeholder="e.g. %, tonnes"
                    className="field-input"
                  />
                </WorkspaceField>
                <WorkspaceField label="Display Order" required>
                  <input
                    type="number"
                    value={indicatorEditForm.display_order ?? ""}
                    onChange={(e) => setIndicatorEditForm((prev) => ({ ...prev, display_order: Number(e.target.value) }))}
                    className="field-input"
                  />
                </WorkspaceField>
              </FormRow>
            </FormSection>
            <FormSection title="Conditional Visibility" description="Only show this indicator when another answer matches">
              <FormRow cols={2}>
                <WorkspaceField label="Depends on" hint="Optional. Show this indicator only when another answer matches.">
                  <Select
                    value={String(indicatorEditForm.show_when_indicator_id ?? NONE_VALUE)}
                    onValueChange={(value) => setIndicatorEditForm((prev) => ({ ...prev, show_when_indicator_id: value }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Always show" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>Always show</SelectItem>
                      {indicators
                        .filter((i) => (i.input_type === "boolean" || i.input_type === "text") && i.indicator_id !== editIndicatorData?.indicator_id)
                        .map((i) => (
                          <SelectItem key={i.indicator_id} value={String(i.indicator_id)}>{i.indicator_name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </WorkspaceField>
                <WorkspaceField label="Equals" hint="Value that must match on the selected indicator.">
                  <input
                    value={indicatorEditForm.show_when_equals ?? ""}
                    onChange={(e) => setIndicatorEditForm((prev) => ({ ...prev, show_when_equals: e.target.value }))}
                    placeholder="e.g. Y or N"
                    className="field-input"
                  />
                </WorkspaceField>
              </FormRow>
              <div className="mt-4 flex items-center gap-3">
                <Switch
                  checked={!!indicatorEditForm.is_active}
                  onCheckedChange={(value) => setIndicatorEditForm((prev) => ({ ...prev, is_active: value }))}
                />
                <span className="text-[13px] text-muted-foreground">{indicatorEditForm.is_active ? "Active" : "Inactive"}</span>
              </div>
            </FormSection>
          </SheetBody>
          <SheetFooter>
            <button onClick={() => setEditIndicatorData(null)} className="px-4 py-2.5 rounded-lg border border-border text-[13px] font-semibold text-muted-foreground hover:bg-sunken transition-colors">Cancel</button>
            <button
              onClick={() => handleEditIndicator(indicatorEditForm)}
              disabled={actionLoading}
              className="px-5 py-2.5 rounded-lg bg-primary text-[13px] font-semibold text-white hover:bg-primaryDk transition-colors disabled:opacity-60"
            >
              {actionLoading ? "Saving…" : "Save Changes"}
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Edit Financial Year */}
      <Sheet open={!!editFYData} onOpenChange={(open) => { if (!open) setEditFYData(null); }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit Financial Year</SheetTitle>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Only the display label can be changed. Start and end dates are locked after creation.
            </p>
          </SheetHeader>
          <SheetBody className="space-y-5">
            <FormSection title="Financial Year" description="Update the display label used across the platform">
              <WorkspaceField label="FY Label" required>
                <input
                  value={fyEditForm.fy_label ?? ""}
                  onChange={(e) => setFyEditForm((prev) => ({ ...prev, fy_label: e.target.value }))}
                  placeholder="e.g. FY 2026-27"
                  className="field-input"
                />
              </WorkspaceField>
              <FormRow cols={2} className="mt-4">
                <WorkspaceField label="Start Date">
                  <input value={fyEditForm.start_date ?? ""} disabled className="field-input" />
                </WorkspaceField>
                <WorkspaceField label="End Date">
                  <input value={fyEditForm.end_date ?? ""} disabled className="field-input" />
                </WorkspaceField>
              </FormRow>
            </FormSection>
          </SheetBody>
          <SheetFooter>
            <button onClick={() => setEditFYData(null)} className="px-4 py-2.5 rounded-lg border border-border text-[13px] font-semibold text-muted-foreground hover:bg-sunken transition-colors">Cancel</button>
            <button
              onClick={() => handleEditFY(fyEditForm)}
              disabled={actionLoading}
              className="px-5 py-2.5 rounded-lg bg-primary text-[13px] font-semibold text-white hover:bg-primaryDk transition-colors disabled:opacity-60"
            >
              {actionLoading ? "Saving…" : "Save Label"}
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Edit Catalog KPI */}
      <Sheet open={!!editCatalogKPIData} onOpenChange={(open) => { if (!open) setEditCatalogKPIData(null); }}>
        <SheetContent size="wide">
          <SheetHeader>
            <SheetTitle>Edit Catalog KPI</SheetTitle>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Changes here only affect the master catalog. Tenants who already pulled this KPI keep their own copy.
            </p>
          </SheetHeader>
          <SheetBody className="space-y-5">
            <FormSection title="KPI Definition" description="Core metadata and input behavior">
              <FormRow cols={2}>
                <WorkspaceField label="KPI Name" required>
                  <input
                    value={catalogKpiEditForm.kpi_name ?? ""}
                    onChange={(e) => setCatalogKpiEditForm((prev) => ({ ...prev, kpi_name: e.target.value }))}
                    className="field-input"
                  />
                </WorkspaceField>
                <WorkspaceField label="Indicator">
                  <Select
                    value={String(catalogKpiEditForm.indicator_id ?? NONE_VALUE)}
                    onValueChange={(value) => setCatalogKpiEditForm((prev) => ({ ...prev, indicator_id: value }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select indicator" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>None</SelectItem>
                      {indicators
                        .filter((i) => i.is_system && i.module_id === editCatalogKPIData?.module_id)
                        .map((i) => (
                          <SelectItem key={i.indicator_id} value={String(i.indicator_id)}>{i.indicator_name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </WorkspaceField>
              </FormRow>
              <FormRow cols={2} className="mt-4">
                <WorkspaceField label="Unit" required>
                  <Select
                    value={String(catalogKpiEditForm.unit ?? "—")}
                    onValueChange={(value) => setCatalogKpiEditForm((prev) => ({ ...prev, unit: value }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="—">No unit</SelectItem>
                      {kpiUnitUOMs.map((u) => (
                        <SelectItem key={u.uom_id} value={u.symbol}>{u.symbol} — {u.display_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </WorkspaceField>
                <WorkspaceField label="Input Type" required>
                  <Select
                    value={String(catalogKpiEditForm.input_type ?? "numeric")}
                    onValueChange={(value) => setCatalogKpiEditForm((prev) => ({ ...prev, input_type: value }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select input type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="numeric">Numeric</SelectItem>
                      <SelectItem value="boolean">Yes / No</SelectItem>
                      <SelectItem value="text">Text</SelectItem>
                    </SelectContent>
                  </Select>
                </WorkspaceField>
              </FormRow>
              <WorkspaceField label="Description" className="mt-4">
                <textarea
                  value={catalogKpiEditForm.description ?? ""}
                  onChange={(e) => setCatalogKpiEditForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="field-input h-auto min-h-[88px] resize-none"
                />
              </WorkspaceField>
            </FormSection>
            <FormSection title="Emissions Logic" description="Scope and energy metadata for computed usage">
              <FormRow cols={2}>
                <WorkspaceField label="Scope">
                  <Select
                    value={String(catalogKpiEditForm.scope_number ?? NONE_VALUE)}
                    onValueChange={(value) => setCatalogKpiEditForm((prev) => ({ ...prev, scope_number: value }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select scope" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>None</SelectItem>
                      <SelectItem value="1">Scope 1</SelectItem>
                      <SelectItem value="2">Scope 2</SelectItem>
                      <SelectItem value="3">Scope 3</SelectItem>
                    </SelectContent>
                  </Select>
                </WorkspaceField>
                <WorkspaceField label="Energy Type">
                  <Select
                    value={String(catalogKpiEditForm.energy_type ?? NONE_VALUE)}
                    onValueChange={(value) => setCatalogKpiEditForm((prev) => ({ ...prev, energy_type: value }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select energy type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE_VALUE}>None</SelectItem>
                      <SelectItem value="RENEWABLE">Renewable</SelectItem>
                      <SelectItem value="NON_RENEWABLE">Non-Renewable</SelectItem>
                      <SelectItem value="NOT_APPLICABLE">N/A</SelectItem>
                    </SelectContent>
                  </Select>
                </WorkspaceField>
              </FormRow>
              <div className="mt-4 flex items-center gap-3">
                <Switch
                  checked={!!catalogKpiEditForm.is_emission_source}
                  onCheckedChange={(value) => setCatalogKpiEditForm((prev) => ({ ...prev, is_emission_source: value }))}
                />
                <span className="text-[13px] text-muted-foreground">Feeds Scope 1/2 emissions (auto-computed)</span>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <Switch
                  checked={!!catalogKpiEditForm.is_active}
                  onCheckedChange={(value) => setCatalogKpiEditForm((prev) => ({ ...prev, is_active: value }))}
                />
                <span className="text-[13px] text-muted-foreground">{catalogKpiEditForm.is_active ? "Active" : "Inactive"}</span>
              </div>
            </FormSection>
          </SheetBody>
          <SheetFooter>
            <button onClick={() => setEditCatalogKPIData(null)} className="px-4 py-2.5 rounded-lg border border-border text-[13px] font-semibold text-muted-foreground hover:bg-sunken transition-colors">Cancel</button>
            <button
              onClick={() => handleEditCatalogKPI(catalogKpiEditForm)}
              disabled={actionLoading}
              className="px-5 py-2.5 rounded-lg bg-primary text-[13px] font-semibold text-white hover:bg-primaryDk transition-colors disabled:opacity-60"
            >
              {actionLoading ? "Saving…" : "Save Changes"}
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Add Catalog KPI custom dialog ── */}
      {addCatalogOpen && (
        <Sheet open={addCatalogOpen} onOpenChange={setAddCatalogOpen}>
          <SheetContent size="wide">
            <SheetHeader>
              <SheetTitle>Add Catalog KPI</SheetTitle>
              <p className="text-[12px] text-muted-foreground mt-0.5">Add a new KPI to the platform master catalog.</p>
            </SheetHeader>
            <SheetBody className="flex flex-col gap-4">
              {/* Module */}
              <div>
                <label className="block text-[12px] font-semibold text-foreground mb-1.5">Module <span className="text-destructive">*</span></label>
                <div className="flex flex-wrap gap-2">
                  {modules.map((m) => {
                    const Icon = getModuleIcon(m.icon_name);
                    const sel = catKpiForm.module_id === m.module_id;
                    return (
                      <button key={m.module_id} type="button"
                        onClick={() => { setCatKpiField("module_id", m.module_id); setCatKpiField("scope_number", undefined); setCatKpiField("energy_type", undefined); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-all ${sel ? "text-white border-transparent" : "bg-card text-muted-foreground border-border hover:border-border"}`}
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
                <label className="block text-[12px] font-semibold text-foreground mb-1.5">Indicator <span className="text-[11px] font-normal text-muted-foreground">(Optional)</span></label>
                <Select
                  value={catKpiForm.indicator_id ? String(catKpiForm.indicator_id) : "__none__"}
                  onValueChange={(v) => setCatKpiField("indicator_id", v === "__none__" ? undefined : Number(v))}
                >
                  <SelectTrigger className="h-9 text-ui">
                    <SelectValue placeholder="Select Indicator (optional)..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select Indicator (optional)...</SelectItem>
                    {indicators
                      .filter((i) => i.is_system && (!catKpiForm.module_id || i.module_id === catKpiForm.module_id))
                      .map((i) => (
                        <SelectItem key={i.indicator_id} value={String(i.indicator_id)}>{i.indicator_name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              {/* KPI Name */}
              <div>
                <label className="block text-[12px] font-semibold text-foreground mb-1.5">KPI Name <span className="text-destructive">*</span></label>
                <input type="text" value={catKpiForm.kpi_name || ""} onChange={(e) => setCatKpiField("kpi_name", e.target.value)}
                  placeholder="e.g. Coal Consumption"
                  className="w-full py-[9px] px-3 rounded-lg border border-border text-[13px] outline-none focus:border-primary transition-colors" />
              </div>
              {/* Input Type */}
              <div>
                <label className="block text-[12px] font-semibold text-foreground mb-1.5">Input Type</label>
                <div className="flex gap-2">
                  {[{ v: "numeric", l: "Numeric" }, { v: "boolean", l: "Yes / No" }, { v: "text", l: "Text" }].map(({ v, l }) => (
                    <button key={v} type="button"
                      onClick={() => setCatKpiField("input_type", v)}
                      className={`flex-1 py-2 rounded-lg border text-[12px] font-semibold transition-all ${(catKpiForm.input_type ?? "numeric") === v ? "bg-primary text-white border-primary" : "bg-card text-muted-foreground border-border hover:border-border"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {/* Unit — only for numeric */}
              {(catKpiForm.input_type ?? "numeric") === "numeric" && (
                <div>
                  <label className="block text-[12px] font-semibold text-foreground mb-1.5">Unit <span className="text-destructive">*</span></label>
                  <Select value={catKpiForm.unit || "__none__"} onValueChange={(v) => setCatKpiField("unit", v === "__none__" ? "" : v)}>
                    <SelectTrigger className="h-9 text-ui">
                      <SelectValue placeholder="— Select unit —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Select unit —</SelectItem>
                      {uoms.filter((u) => u.category !== "emission").map((u) => (
                        <SelectItem key={u.uom_id} value={u.symbol}>{u.symbol} — {u.display_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground mt-1">Unit in which this KPI is measured</p>
                </div>
              )}
              {/* Description */}
              <div>
                <label className="block text-[12px] font-semibold text-foreground mb-1.5">Description</label>
                <textarea value={catKpiForm.description || ""} onChange={(e) => setCatKpiField("description", e.target.value)}
                  rows={2} className="w-full px-3 py-2 rounded-lg border border-border text-[13px] outline-none focus:border-primary resize-none transition-colors" />
              </div>
              {/* GHG Scope — energy + emissions modules, numeric only */}
              {(catKpiForm.input_type ?? "numeric") === "numeric" && (() => {
                const selMod = modules.find((m) => m.module_id === catKpiForm.module_id);
                if (!selMod || (selMod.key !== "energy" && selMod.render_type !== "auto_computed")) return null;
                return (
                  <div>
                    <label className="block text-[12px] font-semibold text-foreground mb-1.5">GHG Scope</label>
                    <Select
                      value={catKpiForm.scope_number ? String(catKpiForm.scope_number) : "__none__"}
                      onValueChange={(v) => setCatKpiField("scope_number", v === "__none__" ? undefined : Number(v))}
                    >
                      <SelectTrigger className="h-9 text-ui">
                        <SelectValue placeholder="Select scope..." />
                      </SelectTrigger>
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
              {/* Energy Type — energy module + numeric only */}
              {(catKpiForm.input_type ?? "numeric") === "numeric" && modules.find((m) => m.module_id === catKpiForm.module_id)?.key === "energy" && (
                <div>
                  <label className="block text-[12px] font-semibold text-foreground mb-1.5">Energy Type</label>
                  <Select
                    value={catKpiForm.energy_type || "__none__"}
                    onValueChange={(v) => setCatKpiField("energy_type", v === "__none__" ? undefined : v)}
                  >
                    <SelectTrigger className="h-9 text-ui">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select type...</SelectItem>
                      <SelectItem value="RENEWABLE">Renewable</SelectItem>
                      <SelectItem value="NON_RENEWABLE">Non-Renewable</SelectItem>
                      <SelectItem value="NOT_APPLICABLE">Not Applicable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {/* Is Emission Source toggle */}
              {(catKpiForm.input_type ?? "numeric") === "numeric" && (
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setCatKpiField("is_emission_source", !catKpiForm.is_emission_source)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${catKpiForm.is_emission_source ? "bg-primary" : "bg-border"}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-card shadow transition-transform ${catKpiForm.is_emission_source ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                  <label className="text-[12px] text-muted-foreground">Feeds Scope 1/2 emissions (auto-computed)</label>
                </div>
              )}
            </SheetBody>
            <SheetFooter>
              <button onClick={() => setAddCatalogOpen(false)} className="px-4 py-2.5 rounded-lg border border-border text-[13px] font-semibold text-muted-foreground hover:bg-sunken transition-colors">Cancel</button>
              <button onClick={handleAddCatalogKPI} disabled={addCatalogLoading} className="px-5 py-2.5 rounded-lg bg-primary text-[13px] font-semibold text-white hover:bg-primaryDk transition-colors disabled:opacity-60">
                {addCatalogLoading ? "Creating..." : "Create"}
              </button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      )}

      {/* Factor drawer */}
      {factorDrawerKPI && (
        <Sheet open={!!factorDrawerKPI} onOpenChange={(open) => { if (!open) setFactorDrawerKPI(null); }}>
          <SheetContent>
            <SheetHeader>
              <div>
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Catalog Conversion Factors</div>
                <h3 className="text-[15px] font-bold text-foreground mt-0.5">{factorDrawerKPI.kpi_name}</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Unit: {factorDrawerKPI.unit || "—"}</p>
              </div>
            </SheetHeader>
            <div className="px-5 py-3 border-b border-[hsl(var(--border-hairline))] flex justify-end">
              <Button size="sm" onClick={() => setAddFactorOpen(true)}>
                <Plus size={14} /> Add Factor
              </Button>
            </div>
            <SheetBody className="space-y-3">
              {factorDrawerLoading && <div className="text-[12px] text-muted-foreground">Loading…</div>}
              {!factorDrawerLoading && factorDrawerFactors.length === 0 && (
                <div className="text-[12px] text-muted-foreground text-center py-8">No factors yet. Add one to make this KPI usable downstream.</div>
              )}
              {factorDrawerFactors.map((f) => (
                <div key={f.factor_id} className="border border-border rounded-lg p-3 hover:border-border">
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-[11px] text-muted-foreground">
                      {formatDate(f.valid_from)} → {f.valid_to ? formatDate(f.valid_to) : <span className="font-semibold text-green-600">current</span>}
                    </div>
                    <button onClick={() => setEditCatalogFactorData(f)} className="p-1 rounded hover:bg-sunken text-muted-foreground"><Pencil size={12} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Energy</div>
                      <div className="font-semibold text-foreground">{f.energy_factor} {f.energy_factor_uom}{factorDrawerKPI.unit ? ` / ${factorDrawerKPI.unit}` : ""}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Emission</div>
                      <div className="font-semibold text-foreground">{f.emission_factor} {f.emission_factor_uom}{factorDrawerKPI.unit ? ` / ${factorDrawerKPI.unit}` : ""}</div>
                    </div>
                  </div>
                  {f.source && <div className="text-[11px] text-muted-foreground mt-2">Source: {f.source}</div>}
                </div>
              ))}
            </SheetBody>
          </SheetContent>
        </Sheet>
      )}

      {/* Add Catalog Factor */}
      <Sheet open={addFactorOpen} onOpenChange={setAddFactorOpen}>
        <SheetContent size="wide">
          <SheetHeader>
            <SheetTitle>Add Factor — {factorDrawerKPI?.kpi_name ?? ""}</SheetTitle>
          </SheetHeader>
          <SheetBody className="space-y-5">
            <FormSection title="Conversion Factor" description="Define valid period and conversion coefficients">
              <FormRow cols={2}>
                <WorkspaceField label="Energy Factor" required>
                  <input
                    type="number"
                    value={catalogFactorForm.energy_factor ?? ""}
                    onChange={(e) => setCatalogFactorForm((prev) => ({ ...prev, energy_factor: e.target.value }))}
                    className="field-input"
                  />
                </WorkspaceField>
                <WorkspaceField label="Energy UOM" required>
                  <Select
                    value={String(catalogFactorForm.energy_factor_uom ?? defaultEnergyUOM)}
                    onValueChange={(value) => setCatalogFactorForm((prev) => ({ ...prev, energy_factor_uom: value }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select energy UOM" /></SelectTrigger>
                    <SelectContent>
                      {energyUOMs.map((u) => (
                        <SelectItem key={u.uom_id} value={u.symbol}>{u.symbol} — {u.display_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </WorkspaceField>
              </FormRow>
              <FormRow cols={2} className="mt-4">
                <WorkspaceField label="Emission Factor" required>
                  <input
                    type="number"
                    value={catalogFactorForm.emission_factor ?? ""}
                    onChange={(e) => setCatalogFactorForm((prev) => ({ ...prev, emission_factor: e.target.value }))}
                    className="field-input"
                  />
                </WorkspaceField>
                <WorkspaceField label="Emission UOM" required>
                  <Select
                    value={String(catalogFactorForm.emission_factor_uom ?? defaultEmissionUOM)}
                    onValueChange={(value) => setCatalogFactorForm((prev) => ({ ...prev, emission_factor_uom: value }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select emission UOM" /></SelectTrigger>
                    <SelectContent>
                      {emissionUOMs.map((u) => (
                        <SelectItem key={u.uom_id} value={u.symbol}>{u.symbol} — {u.display_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </WorkspaceField>
              </FormRow>
              <FormRow cols={2} className="mt-4">
                <WorkspaceField label="Valid From" required>
                  <input
                    type="date"
                    value={catalogFactorForm.valid_from ?? ""}
                    onChange={(e) => setCatalogFactorForm((prev) => ({ ...prev, valid_from: e.target.value }))}
                    className="field-input"
                  />
                </WorkspaceField>
                <WorkspaceField label="Valid To" hint="Leave empty for current / ongoing">
                  <input
                    type="date"
                    value={catalogFactorForm.valid_to ?? ""}
                    onChange={(e) => setCatalogFactorForm((prev) => ({ ...prev, valid_to: e.target.value }))}
                    className="field-input"
                  />
                </WorkspaceField>
              </FormRow>
              <WorkspaceField label="Source" className="mt-4">
                <input
                  value={catalogFactorForm.source ?? ""}
                  onChange={(e) => setCatalogFactorForm((prev) => ({ ...prev, source: e.target.value }))}
                  placeholder="IPCC 2024, CEA Grid Factor"
                  className="field-input"
                />
              </WorkspaceField>
            </FormSection>
          </SheetBody>
          <SheetFooter>
            <button onClick={() => setAddFactorOpen(false)} className="px-4 py-2.5 rounded-lg border border-border text-[13px] font-semibold text-muted-foreground hover:bg-sunken transition-colors">Cancel</button>
            <button
              onClick={() => handleAddCatalogFactor(catalogFactorForm)}
              disabled={actionLoading}
              className="px-5 py-2.5 rounded-lg bg-primary text-[13px] font-semibold text-white hover:bg-primaryDk transition-colors disabled:opacity-60"
            >
              {actionLoading ? "Saving…" : "Add Factor"}
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Edit Catalog Factor */}
      <Sheet open={!!editCatalogFactorData} onOpenChange={(open) => { if (!open) setEditCatalogFactorData(null); }}>
        <SheetContent size="wide">
          <SheetHeader>
            <SheetTitle>Edit Catalog Factor</SheetTitle>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Changes only affect the master catalog. Tenants who already pulled this factor keep their own copy.
            </p>
          </SheetHeader>
          <SheetBody className="space-y-5">
            <FormSection title="Conversion Factor" description="Update factor values and validity metadata">
              <FormRow cols={2}>
                <WorkspaceField label="Energy Factor" required>
                  <input
                    type="number"
                    value={catalogFactorEditForm.energy_factor ?? ""}
                    onChange={(e) => setCatalogFactorEditForm((prev) => ({ ...prev, energy_factor: e.target.value }))}
                    className="field-input"
                  />
                </WorkspaceField>
                <WorkspaceField label="Energy UOM" required>
                  <Select
                    value={String(catalogFactorEditForm.energy_factor_uom ?? defaultEnergyUOM)}
                    onValueChange={(value) => setCatalogFactorEditForm((prev) => ({ ...prev, energy_factor_uom: value }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select energy UOM" /></SelectTrigger>
                    <SelectContent>
                      {energyUOMs.map((u) => (
                        <SelectItem key={u.uom_id} value={u.symbol}>{u.symbol} — {u.display_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </WorkspaceField>
              </FormRow>
              <FormRow cols={2} className="mt-4">
                <WorkspaceField label="Emission Factor" required>
                  <input
                    type="number"
                    value={catalogFactorEditForm.emission_factor ?? ""}
                    onChange={(e) => setCatalogFactorEditForm((prev) => ({ ...prev, emission_factor: e.target.value }))}
                    className="field-input"
                  />
                </WorkspaceField>
                <WorkspaceField label="Emission UOM" required>
                  <Select
                    value={String(catalogFactorEditForm.emission_factor_uom ?? defaultEmissionUOM)}
                    onValueChange={(value) => setCatalogFactorEditForm((prev) => ({ ...prev, emission_factor_uom: value }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select emission UOM" /></SelectTrigger>
                    <SelectContent>
                      {emissionUOMs.map((u) => (
                        <SelectItem key={u.uom_id} value={u.symbol}>{u.symbol} — {u.display_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </WorkspaceField>
              </FormRow>
              <FormRow cols={2} className="mt-4">
                <WorkspaceField label="Valid To" hint="Leave empty for current / ongoing">
                  <input
                    type="date"
                    value={catalogFactorEditForm.valid_to ?? ""}
                    onChange={(e) => setCatalogFactorEditForm((prev) => ({ ...prev, valid_to: e.target.value }))}
                    className="field-input"
                  />
                </WorkspaceField>
                <WorkspaceField label="Source">
                  <input
                    value={catalogFactorEditForm.source ?? ""}
                    onChange={(e) => setCatalogFactorEditForm((prev) => ({ ...prev, source: e.target.value }))}
                    className="field-input"
                  />
                </WorkspaceField>
              </FormRow>
            </FormSection>
          </SheetBody>
          <SheetFooter>
            <button onClick={() => setEditCatalogFactorData(null)} className="px-4 py-2.5 rounded-lg border border-border text-[13px] font-semibold text-muted-foreground hover:bg-sunken transition-colors">Cancel</button>
            <button
              onClick={() => handleEditCatalogFactor(catalogFactorEditForm)}
              disabled={actionLoading}
              className="px-5 py-2.5 rounded-lg bg-primary text-[13px] font-semibold text-white hover:bg-primaryDk transition-colors disabled:opacity-60"
            >
              {actionLoading ? "Saving…" : "Save Changes"}
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Edit UOM */}
      <Sheet open={!!editUOMData} onOpenChange={(open) => { if (!open) setEditUOMData(null); }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit UOM — {editUOMData?.symbol || ""}</SheetTitle>
            <p className="text-[12px] text-muted-foreground mt-0.5">
              Symbol is immutable once created. You can change the display name, category, or active status.
            </p>
          </SheetHeader>
          <SheetBody className="space-y-5">
            <FormSection title="Unit of Measure" description="Maintain display metadata for this UOM">
              <WorkspaceField label="Display Name" required>
                <input
                  value={uomEditForm.display_name ?? ""}
                  onChange={(e) => setUomEditForm((prev) => ({ ...prev, display_name: e.target.value }))}
                  className="field-input"
                />
              </WorkspaceField>
              <WorkspaceField label="Category" required className="mt-4">
                <Select
                  value={String(uomEditForm.category ?? "")}
                  onValueChange={(value) => setUomEditForm((prev) => ({ ...prev, category: value }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {UOM_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </WorkspaceField>
              <div className="mt-4 flex items-center gap-3">
                <Switch
                  checked={!!uomEditForm.is_active}
                  onCheckedChange={(value) => setUomEditForm((prev) => ({ ...prev, is_active: value }))}
                />
                <span className="text-[13px] text-muted-foreground">{uomEditForm.is_active ? "Active" : "Inactive"}</span>
              </div>
            </FormSection>
          </SheetBody>
          <SheetFooter>
            <button onClick={() => setEditUOMData(null)} className="px-4 py-2.5 rounded-lg border border-border text-[13px] font-semibold text-muted-foreground hover:bg-sunken transition-colors">Cancel</button>
            <button
              onClick={() => handleEditUOM(uomEditForm)}
              disabled={actionLoading}
              className="px-5 py-2.5 rounded-lg bg-primary text-[13px] font-semibold text-white hover:bg-primaryDk transition-colors disabled:opacity-60"
            >
              {actionLoading ? "Saving…" : "Save Changes"}
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}
