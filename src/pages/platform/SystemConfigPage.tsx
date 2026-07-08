import { useEffect, useState } from "react";
import { platformApi } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { Breadcrumb, LoadingSkeleton } from "@/components/shared/PageComponents";
import { FormDialog, type FormField } from "@/components/shared/FormDialog";
import IconPicker from "@/components/shared/IconPicker";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Lock, Gauge, X, Check } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
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

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [createFields, setCreateFields] = useState<FormField[]>([]);
  const [createTitle, setCreateTitle] = useState("");
  const [createSubmitLabel, setCreateSubmitLabel] = useState("");
  const [createHandler, setCreateHandler] = useState<((data: Record<string, any>) => Promise<void>) | null>(null);
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
    const configs: Record<Exclude<Tab, "modules" | "catalog" | "vocab">, { title: string; label: string; fields: FormField[]; handler: (data: Record<string, any>) => Promise<void> }> = {
      indicators: {
        title: "Add System Indicator", label: "Create", fields: [
          { key: "module_id", label: "Module", type: "select", required: true, options: modules.map((m) => ({ value: m.module_id, label: m.module_name })) },
          { key: "indicator_name", label: "Indicator Name", required: true, placeholder: "e.g., Anti-corruption policy coverage" },
          { key: "description", label: "Help Text", type: "textarea", placeholder: "Explanation shown to the user when filling this indicator" },
          { key: "input_type", label: "Input Type", type: "select", required: true, options: [
            { value: "numeric", label: "Numeric" },
            { value: "boolean", label: "Yes / No" },
            { value: "text", label: "Text" },
          ], defaultValue: "numeric" },
          { key: "unit", label: "Unit", placeholder: "e.g. %, tonnes (leave blank for text/boolean)" },
          { key: "show_when_indicator_id", label: "Show Only When (Optional)", type: "select", options: [
            { value: "__none__", label: "Always show" },
            ...indicators.filter((i) => i.input_type === "boolean" || i.input_type === "text").map((i) => ({ value: i.indicator_id, label: i.indicator_name })),
          ] },
          { key: "show_when_equals", label: "…Equals This Value", placeholder: "Y or N for Yes/No; exact text for text" },
          { key: "display_order", label: "Display Order", type: "number", defaultValue: 1 },
        ],
        handler: async (d) => {
          const { show_when_indicator_id, show_when_equals, ...rest } = d;
          const resolvedId = show_when_indicator_id === "__none__" ? "" : show_when_indicator_id;
          const show_when = resolvedId
            ? { indicator_id: Number(resolvedId), equals: show_when_equals ?? "" }
            : null;
          await platformApi.createSystemIndicator({ ...rest, show_when });
          toast.success("Indicator created");
        },
      },
      fys: {
        title: "Add Financial Year", label: "Create", fields: [
          { key: "fy_label", label: "FY Label", required: true, placeholder: "e.g. 2026-27" },
          { key: "start_date", label: "Start Date", type: "date", required: true },
          { key: "end_date", label: "End Date", type: "date", required: true },
        ],
        handler: async (d) => {
          const existing = fys.find(
            (f) => f.start_date === d.start_date || f.end_date === d.end_date
          );
          if (existing) throw new Error(`Dates overlap with existing FY "${existing.fy_label}"`);
          await platformApi.createFY(d);
          toast.success("Financial year added");
        },
      },
      plans: {
        title: "Add Plan", label: "Create", fields: [
          { key: "plan_name", label: "Plan Name", required: true, placeholder: "Business" },
          { key: "max_users", label: "Max Users", type: "number", required: true, placeholder: "50", helpText: "Use -1 for unlimited" },
          { key: "max_locations", label: "Max Locations", type: "number", required: true, placeholder: "20" },
          { key: "max_kpis", label: "Max KPIs", type: "number", required: true, placeholder: "100" },
        ],
        handler: async (d) => { await platformApi.createPlan(d); toast.success("Plan created"); },
      },
      uoms: {
        title: "Add Unit of Measure", label: "Create", fields: [
          { key: "symbol", label: "Symbol", required: true, placeholder: "e.g. GJ, tonne-km, INR" },
          { key: "display_name", label: "Display Name", required: true, placeholder: "e.g. Gigajoules" },
          { key: "category", label: "Category", type: "select", required: true, options: UOM_CATEGORIES },
        ],
        handler: async (d) => { await platformApi.createUOM(d); toast.success("UOM created"); },
      },
    };
    const cfg = configs[type];
    setCreateTitle(cfg.title);
    setCreateSubmitLabel(cfg.label);
    setCreateFields(cfg.fields);
    setCreateHandler(() => cfg.handler);
    setCreateOpen(true);
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

  const handleCreate = async (data: Record<string, any>) => {
    if (!createHandler) return;
    setActionLoading(true);
    try { await createHandler(data); setCreateOpen(false); refreshTab(); }
    catch (err: any) {
      const detail = err.response?.data?.detail ?? err.message ?? "Failed";
      const msg = Array.isArray(detail) ? detail.map((e: any) => e.msg).join("; ") : String(detail);
      toast.error(msg);
    }
    finally { setActionLoading(false); }
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

  return (
    <div className="p-6 max-w-[1400px]">
      {/* Row 1: Title */}
      <div className="mb-1">
        <Breadcrumb items={[{ label: "Platform Admin", href: "/platform" }, { label: "System Configuration" }]} />
        <h1 className="text-[18px] font-bold text-brand-navy tracking-tight">System Configuration</h1>
        <p className="text-[11px] text-slate-500 mt-0.5">Manage platform-wide ESG modules, indicators, catalog KPIs &amp; factors, financial years, and plans</p>
      </div>

      {/* Row 2: Underline tabs */}
      <div className="flex border-b border-slate-200 mb-4">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${tab === t.key ? "border-brand-accent text-brand-accent" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <div className="bg-white rounded-xl border border-slate-200 p-6"><LoadingSkeleton rows={6} cols={4} /></div> : (
        <>
          {/* MODULES TAB */}
          {tab === "modules" && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {isOwner && (
                <div className="px-5 py-3 border-b border-slate-100 flex justify-end">
                  <button onClick={openModuleCreate} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-accent text-white text-[12px] font-semibold"><Plus size={14} /> Add Module</button>
                </div>
              )}
              <table className="w-full text-[13px]">
                <thead><tr className="border-b-2 border-slate-100 bg-slate-50/60">
                  {["Icon", "Module", "Data Entry Style", "Order", "Status", ...(isOwner ? [""] : [])].map((h) => <th key={h} className="text-left px-4 py-3 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">{h}</th>)}
                </tr></thead>
                <tbody>
                  {modules.map((m) => {
                    const Icon = getModuleIcon(m.icon_name);
                    const rtLabel = MODULE_RENDER_TYPES.find((r) => r.value === m.render_type)?.label ?? m.render_type ?? "—";
                    return (
                      <tr key={m.module_id} className="border-b border-slate-100 hover:bg-slate-50/60">
                        <td className="px-4 py-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: m.bg_color || "#f8fafc" }}>
                            <Icon size={16} style={{ color: m.color || "#64748b" }} />
                          </div>
                        </td>
                        <td className="px-4 py-2 font-semibold text-brand-navy">{m.module_name}</td>
                        <td className="px-4 py-2 text-slate-500 text-[12px]">{rtLabel}</td>
                        <td className="px-4 py-2 text-slate-500">{m.display_order}</td>
                        <td className="px-4 py-2"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                              m.lifecycle_status === "PUBLISHED" ? "bg-green-100 text-green-700" :
                              m.lifecycle_status === "DEPRECATED" ? "bg-amber-100 text-amber-700" :
                              m.lifecycle_status === "ARCHIVED" ? "bg-red-100 text-red-600" :
                              "bg-slate-100 text-slate-500"
                            }`}>{m.lifecycle_status === "PUBLISHED" ? "Published" : m.lifecycle_status === "DEPRECATED" ? "Deprecated" : m.lifecycle_status === "ARCHIVED" ? "Archived" : "Draft"}</span></td>
                        {isOwner && (
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1">
                              <button onClick={() => openModuleEdit(m)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"><Pencil size={14} /></button>
                              {m.lifecycle_status === "DRAFT" && (
                                <button onClick={() => setDeleteModuleTarget(m)} className="p-1.5 rounded-md hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
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
                <select value={catModuleFilter || ""} onChange={(e) => setCatModuleFilter(e.target.value ? Number(e.target.value) : null)} className="py-2 px-3 rounded-lg border border-slate-200 text-[13px] bg-white outline-none">
                  <option value="">All Modules</option>
                  {modules.map((m) => <option key={m.module_id} value={m.module_id}>{m.module_name}</option>)}
                </select>
                {isOwner && <button onClick={() => openCreate("indicators")} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-accent text-white text-[12px] font-semibold"><Plus size={14} /> Add Indicator</button>}
              </div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead><tr className="border-b-2 border-slate-100 bg-slate-50/60">
                    {["Indicator", "Module", "Input", "Order", "Type", "Status", ...(isOwner ? [""] : [])].map((h) => <th key={h} className="text-left px-4 py-3 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {filteredIndicators.map((c) => {
                      const mod = modules.find((m) => m.module_id === c.module_id);
                      const inputLabel = c.input_type === "boolean" ? "Yes / No" : c.input_type === "text" ? "Text" : "Numeric";
                      return (
                        <tr key={c.indicator_id} className="border-b border-slate-100 hover:bg-slate-50/60">
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-brand-navy">{c.indicator_name}</span>
                              {c.has_data && <Lock size={11} className="text-slate-300 flex-shrink-0" aria-label="Data submitted — name is locked" />}
                            </div>
                            {c.description && <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{c.description}</p>}
                          </td>
                          <td className="px-4 py-2 text-slate-500 text-[12px]">{mod?.module_name || "—"}</td>
                          <td className="px-4 py-2">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.input_type === "text" ? "bg-blue-50 text-blue-600" : c.input_type === "boolean" ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-600"}`}>
                              {inputLabel}{c.unit ? ` (${c.unit})` : ""}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-slate-500">{c.display_order}</td>
                          <td className="px-4 py-2">
                            <span className={`flex items-center gap-1 w-fit text-[10px] font-semibold px-2 py-0.5 rounded-full ${c.is_system ? "bg-slate-100 text-slate-500" : "bg-sky-50 text-sky-700"}`}>
                              {c.is_system && <Lock size={9} />} {c.is_system ? "System" : "Custom"}
                            </span>
                          </td>
                          <td className="px-4 py-2"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>{c.is_active ? "Active" : "Inactive"}</span></td>
                          {isOwner && (
                            <td className="px-4 py-2">
                              <button onClick={() => setEditIndicatorData(c)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"><Pencil size={14} /></button>
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
                <div className="mb-4"><button onClick={() => openCreate("fys")} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-accent text-white text-[12px] font-semibold"><Plus size={14} /> Add Financial Year</button></div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {fys.map((fy) => (
                  <div key={fy.year_id} className="relative bg-white rounded-xl border border-slate-200 p-4 text-center hover:border-slate-300 transition-colors group">
                    <div className="text-[16px] font-bold text-brand-navy mb-1">{fy.fy_label}</div>
                    <div className="text-[11px] text-slate-400">{formatDate(fy.start_date)} → {formatDate(fy.end_date)}</div>
                    {isOwner && (
                      <button
                        onClick={() => setEditFYData(fy)}
                        className="absolute top-2 right-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
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
                <div className="mb-4"><button onClick={() => openCreate("plans")} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-accent text-white text-[12px] font-semibold"><Plus size={14} /> Add Plan</button></div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {plans.map((p) => (
                  <div key={p.plan_id} className="relative bg-white rounded-xl border-2 border-slate-200 p-6 text-center hover:border-brand-accent/50 transition-colors group">
                    <div className="text-[20px] font-bold text-brand-navy mb-4">{p.plan_name}</div>
                    <div className="flex flex-col gap-2 text-[13px]">
                      <div className="flex justify-between py-2 border-b border-slate-100"><span className="text-slate-500">Users</span><span className="font-bold text-brand-navy">{p.max_users === -1 ? "Unlimited" : p.max_users}</span></div>
                      <div className="flex justify-between py-2 border-b border-slate-100"><span className="text-slate-500">Locations</span><span className="font-bold text-brand-navy">{p.max_locations === -1 ? "Unlimited" : p.max_locations}</span></div>
                      <div className="flex justify-between py-2"><span className="text-slate-500">KPIs</span><span className="font-bold text-brand-navy">{p.max_kpis === -1 ? "Unlimited" : p.max_kpis}</span></div>
                    </div>
                    {/* One-line capability summary */}
                    {planCapSummary[p.plan_id] && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-[11px] text-slate-400">
                          {planCapSummary[p.plan_id].modules.length} Module{planCapSummary[p.plan_id].modules.length !== 1 ? "s" : ""}
                          {planCapSummary[p.plan_id].features.length > 0 && ` · ${planCapSummary[p.plan_id].features.length} Feature${planCapSummary[p.plan_id].features.length !== 1 ? "s" : ""}`}
                        </p>
                      </div>
                    )}
                    {isOwner && (
                      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={() => openCapabilities(p)}
                          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600"
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
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="flex items-start justify-between px-6 pt-5 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-[17px] font-bold text-brand-navy">Manage Capabilities</h3>
                    <p className="text-[12px] text-slate-500 mt-0.5">
                      {capPlan.plan_name} — choose which modules and features are included
                    </p>
                  </div>
                  <button onClick={() => setCapPlan(null)} className="text-slate-400 hover:text-slate-600 p-1 mt-0.5"><X size={17} /></button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  {capLoading ? (
                    <div className="flex items-center justify-center py-12 text-slate-400 text-[13px]">Loading…</div>
                  ) : (
                    <>
                      {/* Plan name */}
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Plan Name</p>
                      <input
                        type="text"
                        value={capPlanName}
                        onChange={(e) => setCapPlanName(e.target.value)}
                        className="w-full py-[9px] px-3 rounded-lg border border-slate-200 text-[13px] text-brand-navy outline-none focus:border-brand-accent transition-colors mb-5"
                      />

                      {/* Limits section */}
                      {capFeatureKeys.length > 0 && (
                        <>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Limits</p>
                          <div className="flex flex-col gap-2 mb-5">
                            {capFeatureKeys.map((k: any) => (
                              <div key={k.feature_key} className="flex items-center justify-between gap-4 px-3 py-2.5 rounded-lg border border-slate-200 bg-white">
                                <div className="min-w-0">
                                  <div className="text-[13px] font-semibold text-brand-navy">{k.label}</div>
                                  {k.description && <div className="text-[11px] text-slate-500 mt-0.5">{k.description}</div>}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <input
                                    type="number"
                                    value={capQuotas[k.feature_key] ?? 0}
                                    onChange={(e) => setCapQuotas((prev) => ({ ...prev, [k.feature_key]: Number(e.target.value) }))}
                                    className="w-20 py-1.5 px-2 rounded-lg border border-slate-200 text-[13px] text-brand-navy text-right outline-none focus:border-brand-accent transition-colors"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setCapQuotas((prev) => ({ ...prev, [k.feature_key]: -1 }))}
                                    className="text-[12px] text-slate-400 hover:text-brand-accent transition-colors"
                                    title="Set unlimited"
                                  >∞</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      {/* Modules section */}
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Modules</p>
                      {capModules.length === 0 && (
                        <p className="text-[12px] text-slate-400 mb-4">No modules defined yet.</p>
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
                                ${included ? "border-brand-accent bg-sky-50/60" : "border-slate-200 hover:border-slate-300 bg-white"}
                                ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                            >
                              <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: m.color ? `${m.color}20` : "#f1f5f9" }}>
                                <Icon size={14} style={{ color: m.color || "#64748b" }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={`text-[13px] font-semibold ${included ? "text-brand-accent" : "text-brand-navy"}`}>{m.module_name}</div>
                                {m.lifecycle_status !== "PUBLISHED" && (
                                  <div className="text-[10px] text-slate-400 font-medium mt-0.5 uppercase tracking-wide">{m.lifecycle_status}</div>
                                )}
                              </div>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
                                ${included ? "bg-brand-accent border-brand-accent" : "border-slate-300"}`}>
                                {included && <Check size={11} className="text-white" strokeWidth={3} />}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Features section */}
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Features</p>
                      {capFeatures.length === 0 && (
                        <p className="text-[12px] text-slate-400">No features defined yet.</p>
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
                                ${included ? "border-brand-accent bg-sky-50/60" : "border-slate-200 hover:border-slate-300 bg-white"}
                                ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                            >
                              <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: f.color ? `${f.color}20` : "#f1f5f9" }}>
                                <Icon size={14} style={{ color: f.color || "#64748b" }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={`text-[13px] font-semibold ${included ? "text-brand-accent" : "text-brand-navy"}`}>{f.feature_name}</div>
                                {f.lifecycle_status !== "PUBLISHED" && (
                                  <div className="text-[10px] text-slate-400 font-medium mt-0.5 uppercase tracking-wide">{f.lifecycle_status}</div>
                                )}
                              </div>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
                                ${included ? "bg-brand-accent border-brand-accent" : "border-slate-300"}`}>
                                {included && <Check size={11} className="text-white" strokeWidth={3} />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
                  <button onClick={() => setCapPlan(null)} className="px-4 py-2 rounded-lg text-[13px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors">Cancel</button>
                  <button
                    onClick={saveCapabilities}
                    disabled={capSaving || capLoading}
                    className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-brand-accent text-white hover:bg-brand-accentDk transition-colors disabled:opacity-60"
                  >
                    {capSaving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CATALOG KPIs TAB */}
          {tab === "catalog" && (
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <select
                  value={catalogModuleFilter || ""}
                  onChange={(e) => { setCatalogModuleFilter(e.target.value ? Number(e.target.value) : null); setCatalogIndicatorFilter(null); }}
                  className="py-2 px-3 rounded-lg border border-slate-200 text-[13px] bg-white outline-none">
                  <option value="">All Modules</option>
                  {modules.map((m) => <option key={m.module_id} value={m.module_id}>{m.module_name}</option>)}
                </select>
                <select
                  value={catalogIndicatorFilter || ""}
                  onChange={(e) => setCatalogIndicatorFilter(e.target.value ? Number(e.target.value) : null)}
                  className="py-2 px-3 rounded-lg border border-slate-200 text-[13px] bg-white outline-none">
                  <option value="">All Indicators</option>
                  {indicatorsForCatalogModule.map((i) => <option key={i.indicator_id} value={i.indicator_id}>{i.indicator_name}</option>)}
                </select>
                {isOwner && (
                  <button onClick={handleOpenAddCatalog} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-accent text-white text-[12px] font-semibold">
                    <Plus size={14} /> Add Catalog KPI
                  </button>
                )}
                <span className="text-[11px] text-slate-500 ml-auto">{filteredCatalogKPIs.length} KPI{filteredCatalogKPIs.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b-2 border-slate-100 bg-slate-50/60">
                      {["KPI", "Module", "Indicator", "Unit", "Input", "Scope", "Emission", "Status", ...(isOwner ? [""] : [])].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCatalogKPIs.length === 0 && (
                      <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-[13px]">No catalog KPIs yet. Click "Add Catalog KPI" to create one.</td></tr>
                    )}
                    {filteredCatalogKPIs.map((k) => {
                      const mod = modules.find((m) => m.module_id === k.module_id);
                      const ind = k.indicator_id ? indicators.find((i) => i.indicator_id === k.indicator_id) : null;
                      const inputLabel = k.input_type === "boolean" ? "Yes / No" : k.input_type === "text" ? "Text" : "Numeric";
                      return (
                        <tr key={k.kpi_id} className="border-b border-slate-100 hover:bg-slate-50/60">
                          <td className="px-4 py-2">
                            <div className="font-semibold text-brand-navy">{k.kpi_name}</div>
                            {k.description && <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{k.description}</p>}
                          </td>
                          <td className="px-4 py-2 text-slate-500 text-[12px]">{mod?.module_name || "—"}</td>
                          <td className="px-4 py-2 text-slate-500 text-[12px]">{ind?.indicator_name || "—"}</td>
                          <td className="px-4 py-2 text-slate-600">{k.unit || "—"}</td>
                          <td className="px-4 py-2">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{inputLabel}</span>
                          </td>
                          <td className="px-4 py-2">
                            {k.scope_number ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700">Scope {k.scope_number}</span> : <span className="text-slate-300 text-[11px]">—</span>}
                          </td>
                          <td className="px-4 py-2">
                            {k.is_emission_source ? <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">Auto-Computed</span> : <span className="text-slate-300 text-[11px]">—</span>}
                          </td>
                          <td className="px-4 py-2"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${k.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>{k.is_active ? "Active" : "Inactive"}</span></td>
                          {isOwner && (
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-1">
                                <button onClick={() => openFactorDrawer(k)} title="Manage conversion factors" className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-brand-accent transition-colors"><Gauge size={14} /></button>
                                <button onClick={() => setEditCatalogKPIData(k)} title="Edit KPI" className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"><Pencil size={14} /></button>
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
                <select value={uomCategoryFilter} onChange={(e) => setUomCategoryFilter(e.target.value)}
                  className="py-2 px-3 rounded-lg border border-slate-200 text-[13px] bg-white outline-none">
                  <option value="">All Categories</option>
                  {UOM_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                {isOwner && (
                  <button onClick={() => openCreate("uoms")} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-accent text-white text-[12px] font-semibold">
                    <Plus size={14} /> Add UOM
                  </button>
                )}
              </div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b-2 border-slate-100 bg-slate-50/60">
                      {["Symbol", "Display Name", "Category", "Status", ...(isOwner ? [""] : [])].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {uoms
                      .filter((u) => !uomCategoryFilter || u.category === uomCategoryFilter)
                      .map((u) => (
                        <tr key={u.uom_id} className="border-b border-slate-100 hover:bg-slate-50/60">
                          <td className="px-4 py-2 font-mono font-semibold text-brand-navy">{u.symbol}</td>
                          <td className="px-4 py-2 text-slate-600">{u.display_name}</td>
                          <td className="px-4 py-2">
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              {CATEGORY_LABEL[u.category] ?? u.category}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${u.is_active !== false ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                              {u.is_active !== false ? "Active" : "Inactive"}
                            </span>
                          </td>
                          {isOwner && (
                            <td className="px-4 py-2">
                              <button onClick={() => setEditUOMData(u)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
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

      <FormDialog open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={handleCreate} title={createTitle} fields={createFields} submitLabel={createSubmitLabel} loading={actionLoading} />

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setModuleDialogOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col z-10">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-[17px] font-bold text-brand-navy">{moduleDialogTarget ? "Edit Module" : "Add Module"}</h3>
                <p className="text-[12px] text-slate-500 mt-0.5">{moduleDialogTarget ? "Update module settings and appearance" : "Create a new ESG module for the platform"}</p>
              </div>
              <button onClick={() => setModuleDialogOpen(false)} className="text-slate-400 hover:text-slate-600 p-1"><X size={17} /></button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
              {/* Module Name */}
              <div>
                <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Module Name <span className="text-red-400">*</span></label>
                <input type="text" value={moduleForm.module_name || ""} onChange={(e) => {
                  const name = e.target.value;
                  setModuleField("module_name", name);
                  if (!moduleDialogTarget) setModuleField("key", slugify(name));
                }}
                  placeholder="e.g. Biodiversity" autoFocus
                  className="w-full py-[9px] px-3 rounded-lg border border-slate-200 text-[13px] text-brand-navy outline-none focus:border-brand-accent transition-colors" />
              </div>

              {/* Key */}
              <div>
                <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">
                  Key <span className="text-red-400">*</span>
                  <span className="ml-2 text-[11px] font-normal text-slate-400">Stable slug — lowercase, underscores only. Cannot change once data exists.</span>
                </label>
                <input type="text" value={moduleForm.key || ""} onChange={(e) => setModuleField("key", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="e.g. biodiversity"
                  className="w-full py-[9px] px-3 rounded-lg border border-slate-200 text-[13px] text-brand-navy outline-none focus:border-brand-accent transition-colors font-mono" />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Description</label>
                <textarea value={moduleForm.description || ""} onChange={(e) => setModuleField("description", e.target.value)}
                  rows={2} placeholder="Describe this ESG module"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[13px] text-brand-navy outline-none focus:border-brand-accent resize-none transition-colors" />
              </div>

              {/* Color swatches */}
              <div>
                <label className="block text-[12px] font-semibold text-brand-navy mb-2">Color</label>
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
                <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Icon</label>
                <IconPicker
                  value={moduleForm.icon_name || "BarChart3"}
                  onChange={(name) => setModuleField("icon_name", name)}
                  accentColor={moduleForm.color}
                />
              </div>

              {/* Data Entry Style */}
              <div>
                <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Data Entry Style</label>
                <div className="flex flex-col gap-2">
                  {MODULE_RENDER_TYPES.map((rt) => (
                    <button key={rt.value} type="button"
                      onClick={() => setModuleField("render_type", rt.value)}
                      className={`text-left px-3 py-2.5 rounded-lg border text-[12px] transition-all ${moduleForm.render_type === rt.value ? "border-brand-accent bg-sky-50/60" : "border-slate-200 hover:border-slate-300"}`}>
                      <div className={`font-semibold ${moduleForm.render_type === rt.value ? "text-brand-accent" : "text-brand-navy"}`}>{rt.label}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{rt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Display Order */}
              <div>
                <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Display Order</label>
                <input type="number" value={moduleForm.display_order ?? ""} onChange={(e) => setModuleField("display_order", Number(e.target.value))}
                  className="w-28 py-[9px] px-3 rounded-lg border border-slate-200 text-[13px] text-brand-navy outline-none focus:border-brand-accent transition-colors" />
              </div>

            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setModuleDialogOpen(false)} className="px-4 py-2.5 rounded-lg border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleModuleSubmit} disabled={actionLoading}
                className="px-5 py-2.5 rounded-lg bg-brand-accent text-[13px] font-semibold text-white hover:bg-brand-accentDk transition-colors disabled:opacity-60">
                {actionLoading ? "Saving…" : moduleDialogTarget ? "Save Changes" : "Create Module"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Indicator */}
      <FormDialog
        open={!!editIndicatorData}
        onClose={() => setEditIndicatorData(null)}
        onSubmit={handleEditIndicator}
        title="Edit Indicator"
        description={editIndicatorData?.has_data ? "Name is locked — data has been submitted against this indicator. You can still change other fields." : undefined}
        fields={editIndicatorData ? [
          { key: "indicator_name", label: "Indicator Name", required: true, disabled: !!editIndicatorData.has_data,
            helpText: editIndicatorData.has_data ? "Locked: data has been submitted against this indicator" : undefined },
          { key: "description", label: "Help Text", type: "textarea", placeholder: "Explanation shown to the user" },
          { key: "input_type", label: "Input Type", type: "select", required: true, options: [
            { value: "numeric", label: "Numeric" },
            { value: "boolean", label: "Yes / No" },
            { value: "text", label: "Text" },
          ] },
          { key: "unit", label: "Unit", placeholder: "e.g. %, tonnes" },
          { key: "show_when_indicator_id", label: "Show Only When (Optional)", type: "select", options: [
            { value: "__none__", label: "Always show" },
            ...indicators
              .filter((i) => (i.input_type === "boolean" || i.input_type === "text") && i.indicator_id !== editIndicatorData.indicator_id)
              .map((i) => ({ value: i.indicator_id, label: i.indicator_name })),
          ] },
          { key: "show_when_equals", label: "…Equals This Value", placeholder: "Y or N for Yes/No; exact text for text" },
          { key: "display_order", label: "Display Order", type: "number", required: true },
          { key: "is_active", label: "Active", type: "toggle" },
        ] : []}
        submitLabel="Save Changes"
        loading={actionLoading}
        initialData={editIndicatorData ? {
          indicator_name: editIndicatorData.indicator_name,
          description: editIndicatorData.description || "",
          input_type: editIndicatorData.input_type || "numeric",
          unit: editIndicatorData.unit || "",
          show_when_indicator_id: editIndicatorData.show_when?.indicator_id ?? "__none__",
          show_when_equals: String(editIndicatorData.show_when?.equals ?? ""),
          display_order: editIndicatorData.display_order,
          is_active: editIndicatorData.is_active,
        } : undefined}
      />

      {/* Edit Financial Year */}
      <FormDialog
        open={!!editFYData}
        onClose={() => setEditFYData(null)}
        onSubmit={handleEditFY}
        title="Edit Financial Year"
        description="Only the display label can be changed. Start and end dates are permanently locked after creation."
        fields={[
          { key: "fy_label", label: "FY Label", required: true, placeholder: "e.g. FY 2026-27" },
          { key: "start_date", label: "Start Date", type: "date", disabled: true },
          { key: "end_date", label: "End Date", type: "date", disabled: true },
        ]}
        submitLabel="Save Label"
        loading={actionLoading}
        initialData={editFYData ? { fy_label: editFYData.fy_label, start_date: editFYData.start_date, end_date: editFYData.end_date } : undefined}
      />


      {/* Edit Catalog KPI */}
      <FormDialog
        open={!!editCatalogKPIData}
        onClose={() => setEditCatalogKPIData(null)}
        onSubmit={handleEditCatalogKPI}
        title="Edit Catalog KPI"
        description="Changes here only affect the master catalog. Tenants who already pulled this KPI keep their own copy."
        fields={editCatalogKPIData ? [
          { key: "kpi_name", label: "KPI Name", required: true },
          { key: "indicator_id", label: "Indicator (Optional)", type: "select", options: [
            { value: "__none__", label: "— None —" },
            ...indicators.filter((i) => i.is_system && i.module_id === editCatalogKPIData.module_id).map((i) => ({ value: i.indicator_id, label: i.indicator_name })),
          ] },
          { key: "unit", label: "Unit", type: "select", required: true, options: [
            { value: "—", label: "— (no unit)" },
            ...kpiUnitUOMs.map((u) => ({ value: u.symbol, label: `${u.symbol} — ${u.display_name}` })),
          ] },
          { key: "input_type", label: "Input Type", type: "select", required: true, options: [
            { value: "numeric", label: "Numeric" },
            { value: "boolean", label: "Yes / No" },
            { value: "text", label: "Text" },
          ] },
          { key: "description", label: "Description", type: "textarea" },
          { key: "is_emission_source", label: "Feeds Scope 1/2 emissions (auto-computed)", type: "toggle" },
          { key: "scope_number", label: "Scope", type: "select", options: [
            { value: "__none__", label: "— None —" },
            { value: 1, label: "Scope 1" },
            { value: 2, label: "Scope 2" },
            { value: 3, label: "Scope 3" },
          ] },
          { key: "energy_type", label: "Energy Type", type: "select", options: [
            { value: "__none__", label: "— None —" },
            { value: "RENEWABLE",     label: "Renewable" },
            { value: "NON_RENEWABLE", label: "Non-Renewable" },
            { value: "NOT_APPLICABLE", label: "N/A" },
          ] },
          { key: "is_active", label: "Active", type: "toggle" },
        ] : []}
        submitLabel="Save Changes"
        loading={actionLoading}
        initialData={editCatalogKPIData ? {
          kpi_name: editCatalogKPIData.kpi_name,
          indicator_id: editCatalogKPIData.indicator_id ?? "__none__",
          unit: editCatalogKPIData.unit ?? "—",
          input_type: editCatalogKPIData.input_type ?? "numeric",
          description: editCatalogKPIData.description ?? "",
          is_emission_source: !!editCatalogKPIData.is_emission_source,
          scope_number: editCatalogKPIData.scope_number ?? "__none__",
          energy_type:  editCatalogKPIData.energy_type  ?? "__none__",
          is_active: editCatalogKPIData.is_active,
        } : undefined}
      />

      {/* ── Add Catalog KPI custom dialog ── */}
      {addCatalogOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setAddCatalogOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col z-10">
            <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-[17px] font-bold text-brand-navy">Add Catalog KPI</h3>
                <p className="text-[12px] text-slate-500 mt-0.5">Add a new KPI to the platform master catalog</p>
              </div>
              <button onClick={() => setAddCatalogOpen(false)} className="text-slate-400 hover:text-slate-600 p-1"><X size={17} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
              {/* Module */}
              <div>
                <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Module <span className="text-red-400">*</span></label>
                <div className="flex flex-wrap gap-2">
                  {modules.map((m) => {
                    const Icon = getModuleIcon(m.icon_name);
                    const sel = catKpiForm.module_id === m.module_id;
                    return (
                      <button key={m.module_id} type="button"
                        onClick={() => { setCatKpiField("module_id", m.module_id); setCatKpiField("scope_number", undefined); setCatKpiField("energy_type", undefined); }}
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
                <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Indicator <span className="text-[11px] font-normal text-slate-400">(Optional)</span></label>
                <select value={catKpiForm.indicator_id || ""} onChange={(e) => setCatKpiField("indicator_id", e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full py-[9px] px-3 rounded-lg border border-slate-200 text-[13px] outline-none bg-white focus:border-brand-accent transition-colors">
                  <option value="">Select Indicator (optional)...</option>
                  {indicators
                    .filter((i) => i.is_system && (!catKpiForm.module_id || i.module_id === catKpiForm.module_id))
                    .map((i) => <option key={i.indicator_id} value={i.indicator_id}>{i.indicator_name}</option>)}
                </select>
              </div>
              {/* KPI Name */}
              <div>
                <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">KPI Name <span className="text-red-400">*</span></label>
                <input type="text" value={catKpiForm.kpi_name || ""} onChange={(e) => setCatKpiField("kpi_name", e.target.value)}
                  placeholder="e.g. Coal Consumption"
                  className="w-full py-[9px] px-3 rounded-lg border border-slate-200 text-[13px] outline-none focus:border-brand-accent transition-colors" />
              </div>
              {/* Input Type */}
              <div>
                <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Input Type</label>
                <div className="flex gap-2">
                  {[{ v: "numeric", l: "Numeric" }, { v: "boolean", l: "Yes / No" }, { v: "text", l: "Text" }].map(({ v, l }) => (
                    <button key={v} type="button"
                      onClick={() => setCatKpiField("input_type", v)}
                      className={`flex-1 py-2 rounded-lg border text-[12px] font-semibold transition-all ${(catKpiForm.input_type ?? "numeric") === v ? "bg-brand-navy text-white border-brand-navy" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {/* Unit — only for numeric */}
              {(catKpiForm.input_type ?? "numeric") === "numeric" && (
                <div>
                  <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Unit <span className="text-red-400">*</span></label>
                  <select value={catKpiForm.unit || ""} onChange={(e) => setCatKpiField("unit", e.target.value)}
                    className="w-full py-[9px] px-3 rounded-lg border border-slate-200 text-[13px] outline-none focus:border-brand-accent transition-colors bg-white text-brand-navy">
                    <option value="">— Select unit —</option>
                    {uoms.filter((u) => u.category !== "emission").map((u) => (
                      <option key={u.uom_id} value={u.symbol}>{u.symbol} — {u.display_name}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1">Unit in which this KPI is measured</p>
                </div>
              )}
              {/* Description */}
              <div>
                <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Description</label>
                <textarea value={catKpiForm.description || ""} onChange={(e) => setCatKpiField("description", e.target.value)}
                  rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[13px] outline-none focus:border-brand-accent resize-none transition-colors" />
              </div>
              {/* GHG Scope — energy + emissions modules, numeric only */}
              {(catKpiForm.input_type ?? "numeric") === "numeric" && (() => {
                const selMod = modules.find((m) => m.module_id === catKpiForm.module_id);
                if (!selMod || (selMod.key !== "energy" && selMod.render_type !== "auto_computed")) return null;
                return (
                  <div>
                    <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">GHG Scope</label>
                    <select value={catKpiForm.scope_number || ""} onChange={(e) => setCatKpiField("scope_number", e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full py-[9px] px-3 rounded-lg border border-slate-200 text-[13px] outline-none bg-white focus:border-brand-accent transition-colors">
                      <option value="">Select scope...</option>
                      <option value={1}>Scope 1 — Direct (e.g. diesel, coal combustion)</option>
                      <option value={2}>Scope 2 — Indirect (e.g. grid electricity)</option>
                      <option value={3}>Scope 3 — Value Chain</option>
                    </select>
                  </div>
                );
              })()}
              {/* Energy Type — energy module + numeric only */}
              {(catKpiForm.input_type ?? "numeric") === "numeric" && modules.find((m) => m.module_id === catKpiForm.module_id)?.key === "energy" && (
                <div>
                  <label className="block text-[12px] font-semibold text-brand-navy mb-1.5">Energy Type</label>
                  <select value={catKpiForm.energy_type || ""} onChange={(e) => setCatKpiField("energy_type", e.target.value || undefined)}
                    className="w-full py-[9px] px-3 rounded-lg border border-slate-200 text-[13px] outline-none bg-white focus:border-brand-accent transition-colors">
                    <option value="">Select type...</option>
                    <option value="RENEWABLE">Renewable</option>
                    <option value="NON_RENEWABLE">Non-Renewable</option>
                    <option value="NOT_APPLICABLE">Not Applicable</option>
                  </select>
                </div>
              )}
              {/* Is Emission Source toggle */}
              {(catKpiForm.input_type ?? "numeric") === "numeric" && (
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setCatKpiField("is_emission_source", !catKpiForm.is_emission_source)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${catKpiForm.is_emission_source ? "bg-brand-accent" : "bg-slate-200"}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${catKpiForm.is_emission_source ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                  <label className="text-[12px] text-slate-600">Feeds Scope 1/2 emissions (auto-computed)</label>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setAddCatalogOpen(false)} className="px-4 py-2.5 rounded-lg border border-slate-200 text-[13px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleAddCatalogKPI} disabled={addCatalogLoading} className="px-5 py-2.5 rounded-lg bg-brand-accent text-[13px] font-semibold text-white hover:bg-brand-accentDk transition-colors disabled:opacity-60">
                {addCatalogLoading ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Factor drawer */}
      {factorDrawerKPI && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/30" onClick={() => setFactorDrawerKPI(null)} />
          <aside className="relative w-[480px] max-w-full h-full bg-white shadow-2xl border-l border-slate-200 flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between">
              <div>
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Catalog Conversion Factors</div>
                <h3 className="text-[15px] font-bold text-brand-navy mt-0.5">{factorDrawerKPI.kpi_name}</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Unit: {factorDrawerKPI.unit || "—"}</p>
              </div>
              <button onClick={() => setFactorDrawerKPI(null)} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="px-5 py-3 border-b border-slate-100 flex justify-end">
              <button onClick={() => setAddFactorOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-accent text-white text-[12px] font-semibold">
                <Plus size={14} /> Add Factor
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {factorDrawerLoading && <div className="text-[12px] text-slate-400">Loading…</div>}
              {!factorDrawerLoading && factorDrawerFactors.length === 0 && (
                <div className="text-[12px] text-slate-400 text-center py-8">No factors yet. Add one to make this KPI usable downstream.</div>
              )}
              {factorDrawerFactors.map((f) => (
                <div key={f.factor_id} className="border border-slate-200 rounded-lg p-3 hover:border-slate-300">
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-[11px] text-slate-500">
                      {formatDate(f.valid_from)} → {f.valid_to ? formatDate(f.valid_to) : <span className="font-semibold text-green-600">current</span>}
                    </div>
                    <button onClick={() => setEditCatalogFactorData(f)} className="p-1 rounded hover:bg-slate-100 text-slate-400"><Pencil size={12} /></button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400">Energy</div>
                      <div className="font-semibold text-brand-navy">{f.energy_factor} {f.energy_factor_uom}{factorDrawerKPI.unit ? ` / ${factorDrawerKPI.unit}` : ""}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400">Emission</div>
                      <div className="font-semibold text-brand-navy">{f.emission_factor} {f.emission_factor_uom}{factorDrawerKPI.unit ? ` / ${factorDrawerKPI.unit}` : ""}</div>
                    </div>
                  </div>
                  {f.source && <div className="text-[11px] text-slate-400 mt-2">Source: {f.source}</div>}
                </div>
              ))}
            </div>
          </aside>
        </div>
      )}

      {/* Add Catalog Factor */}
      <FormDialog
        open={addFactorOpen}
        onClose={() => setAddFactorOpen(false)}
        onSubmit={handleAddCatalogFactor}
        title={`Add Factor — ${factorDrawerKPI?.kpi_name ?? ""}`}
        fields={addCatalogFactorFields}
        submitLabel="Add Factor"
        loading={actionLoading}
      />

      {/* Edit Catalog Factor */}
      <FormDialog
        open={!!editCatalogFactorData}
        onClose={() => setEditCatalogFactorData(null)}
        onSubmit={handleEditCatalogFactor}
        title="Edit Catalog Factor"
        description="Changes only affect the master catalog. Tenants who already pulled this factor keep their own copy."
        fields={[
          { key: "energy_factor", label: "Energy Factor", type: "number", required: true },
          { key: "energy_factor_uom", label: "Energy UOM", type: "select", required: true, options: energyUOMs.map((u) => ({ value: u.symbol, label: `${u.symbol} — ${u.display_name}` })) },
          { key: "emission_factor", label: "Emission Factor", type: "number", required: true },
          { key: "emission_factor_uom", label: "Emission UOM", type: "select", required: true, options: emissionUOMs.map((u) => ({ value: u.symbol, label: `${u.symbol} — ${u.display_name}` })) },
          { key: "valid_to", label: "Valid To", type: "date", helpText: "Leave empty for current / ongoing" },
          { key: "source", label: "Source" },
        ]}
        submitLabel="Save Changes"
        loading={actionLoading}
        initialData={editCatalogFactorData ? {
          energy_factor: editCatalogFactorData.energy_factor,
          energy_factor_uom: editCatalogFactorData.energy_factor_uom,
          emission_factor: editCatalogFactorData.emission_factor,
          emission_factor_uom: editCatalogFactorData.emission_factor_uom,
          valid_to: editCatalogFactorData.valid_to ?? "",
          source: editCatalogFactorData.source ?? "",
        } : undefined}
      />

      {/* Edit UOM */}
      <FormDialog
        open={!!editUOMData}
        onClose={() => setEditUOMData(null)}
        onSubmit={handleEditUOM}
        title={`Edit UOM — ${editUOMData?.symbol || ""}`}
        description="Symbol is immutable once created. You can change the display name, category, or toggle active status."
        fields={[
          { key: "display_name", label: "Display Name", required: true },
          { key: "category", label: "Category", type: "select", required: true, options: UOM_CATEGORIES },
          { key: "is_active", label: "Active", type: "toggle" },
        ]}
        submitLabel="Save Changes"
        loading={actionLoading}
        initialData={editUOMData ? { display_name: editUOMData.display_name, category: editUOMData.category, is_active: editUOMData.is_active !== false } : undefined}
      />
    </div>
  );
}
