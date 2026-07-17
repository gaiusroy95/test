import { useEffect, useState, useMemo, type ReactNode } from "react";
import * as XLSX from "xlsx";
import { tenantApi } from "@/api/client";
import { useModulesStore } from "@/store/modules";
import { useVocabulariesStore } from "@/store/vocabularies";
import { LoadingSkeleton } from "@/components/shared/PageComponents";
import { PageShell } from "@/components/shared/PageShell";
import { FilterBar, FilterSelect } from "@/components/shared/FilterBar";
import { CHART_COLORS, CHART_AXIS, CHART_GRID, chartTooltipStyle } from "@/components/shared/ChartTheme";
import { useAuthStore } from "@/store/auth";
import { toast } from "sonner";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Database, Zap, Wind, Droplets, Trash2, FileText, FileSpreadsheet, Package2, FileDown, Maximize2, Minimize2 } from "lucide-react";
import { getApiError, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ESGInput, KPI, ReportingYear, Location, Indicator, DerivedMetric, WasteDisposalBreakdown, AppModule } from "@/types";
import { evaluateFormula } from "@/lib/formulaEvaluator";

const MONTH_NAMES = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
// Scope colors and disposal method labels are loaded from useVocabulariesStore
// (platform-managed lookup tables) — no longer hardcoded here.

type ReportTab = "analytics" | "annexure";

type AnalyticsChartFocus =
  | "all"
  | "monthly"
  | "scopePie"
  | "topLocations"
  | "scopeBreakdown"
  | "energyMix"
  | "mjVsEmission"
  | "scope3Category";

const CHART_FOCUS_OPTIONS: { value: AnalyticsChartFocus; label: string }[] = [
  { value: "all", label: "All Charts" },
  { value: "monthly", label: "Monthly Emissions / Energy" },
  { value: "scopePie", label: "Emissions by Scope" },
  { value: "topLocations", label: "Top Emitters by Location" },
  { value: "scopeBreakdown", label: "GHG Scope Breakdown" },
  { value: "energyMix", label: "Energy Mix" },
  { value: "mjVsEmission", label: "Energy vs Emissions Trend" },
  { value: "scope3Category", label: "Scope 3 by GHG Category" },
];

// Column definition for the Report pivot table
interface ReportCol {
  colId: string;
  label: string;          // display header (includes unit/field suffix)
  unit: string;           // raw unit string for reference
  field: "quantity" | "mj_value" | "emission_value" | "emission_value_lb";  // which data field to read
  moduleId: number;
  moduleLabel: string;
  moduleColor: string;
  moduleBg: string;
  indicatorId: number | null;
  indicatorLabel: string | null; // parent indicator name for row-2 grouping
}

// Row definition for the Report pivot table
interface ReportRow {
  locationId: string;
  locationName: string;
  fyLabel: string;
  yearId: number;
  monthId: number;
  monthName: string;
  values: Map<string, number>;
}

export default function ReportsPage() {
  const { user } = useAuthStore();
  const modules = useModulesStore((s) => s.modules);
  const emissionScopes  = useVocabulariesStore((s) => s.emissionScopes);
  const disposalMethods = useVocabulariesStore((s) => s.disposalMethods);
  const isLocationUser = user?.role === "LOCATION_USER";
  const assignedLocationIds = (user as any)?.assigned_location_ids as string[] | undefined;

  const [tab, setTab] = useState<ReportTab>("analytics");
  const [brsrLoading, setBrsrLoading] = useState(false);
  const [entries, setEntries] = useState<ESGInput[]>([]);
  const [metrics, setMetrics] = useState<KPI[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [reportingYears, setReportingYears] = useState<ReportingYear[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [derivedMetrics, setDerivedMetrics] = useState<DerivedMetric[]>([]);        // ALL (including intermediates) — for computation
  const [reportDerivedMetrics, setReportDerivedMetrics] = useState<DerivedMetric[]>([]); // show_in_report=true only — for columns
  const [wasteDisposals, setWasteDisposals] = useState<WasteDisposalBreakdown[]>([]); // record_id → breakdown rows
  const [selectedFY, setSelectedFY] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [scope3Batches, setScope3Batches] = useState<any[]>([]);
  const [scopeView, setScopeView] = useState<"chart" | "table">("chart");
  const [chartFocus, setChartFocus] = useState<AnalyticsChartFocus>("all");

  useEffect(() => {
    let anyError = false;
    const safe = async (fn: () => Promise<any>, label?: string) => {
      try { return await fn(); }
      catch {
        if (label && !anyError) { anyError = true; toast.error(`Failed to load ${label} — some data may be missing`); }
        return { data: [] };
      }
    };
    Promise.all([
      safe(() => tenantApi.listESGInputs({ size: 1000 }), "ESG entries"),
      safe(() => tenantApi.listKPIs({ size: 500 }), "KPIs"),
      safe(() => tenantApi.listReportingYears(), "reporting years"),
      safe(() => tenantApi.listLocations({ size: 200 }), "locations"),
      safe(() => tenantApi.listIndicators({ size: 500 }), "indicators"),
      safe(() => tenantApi.listDerivedMetrics(), "derived metrics"),
      safe(() => tenantApi.listWasteDisposals(), "waste disposal"),
      safe(() => tenantApi.listScope3Batches({ status: "APPROVED", size: 500 }), "Scope 3 batches"),
    ]).then(([dRes, mRes, ryRes, locRes, indRes, dmRes, wdRes, s3Res]) => {
      setEntries(dRes.data?.items || dRes.data || []);
      setMetrics(mRes.data?.items || mRes.data || []);
      const rys = Array.isArray(ryRes.data) ? ryRes.data : ryRes.data?.items || [];
      setReportingYears(rys);
      if (rys.length > 0) setSelectedFY(String(rys[rys.length - 1]?.year_id || ""));
      const locs: Location[] = locRes.data?.items || locRes.data || [];
      setLocations(locs);
      setIndicators(Array.isArray(indRes.data) ? indRes.data : indRes.data?.items || []);
      const allDm: DerivedMetric[] = Array.isArray(dmRes.data) ? dmRes.data : [];
      setDerivedMetrics(allDm);                                          // all — needed for intermediate computation
      setReportDerivedMetrics(allDm.filter(d => d.show_in_report));     // visible columns only
      setWasteDisposals(Array.isArray(wdRes.data) ? wdRes.data : []);
      setScope3Batches(Array.isArray(s3Res.data) ? s3Res.data : s3Res.data?.items || []);
      // Auto-set location for Location User
      if (isLocationUser) {
        const assigned = (assignedLocationIds?.length)
          ? locs.find(l => assignedLocationIds.includes(l.location_id))
          : locs.length === 1 ? locs[0] : null;
        if (assigned) setSelectedLocation(assigned.location_id);
      }
      setLoading(false);
    });
  }, []);

  // ── Filters ──
  const filtered = entries.filter((e) => {
    if (selectedFY && String(e.year_id) !== selectedFY) return false;
    if (selectedLocation && e.location_id !== selectedLocation) return false;
    if (selectedMonth && String(e.month_id) !== selectedMonth) return false;
    return true;
  });

  // ── FY label ──
  const annexFY = reportingYears.find((r) => String(r.year_id) === selectedFY);
  const fyLabel = annexFY?.financial_year?.fy_label || (selectedFY ? `FY ${selectedFY}` : "All FYs");

  // ── Scope 3 analytics ──
  // Derive calendar year from FY start_date (e.g. FY 2024-25 start = "2024-04-01" → year 2024)
  const scope3Year = annexFY?.financial_year?.start_date
    ? parseInt(annexFY.financial_year.start_date.slice(0, 4), 10)
    : null;
  const filteredScope3 = scope3Batches.filter(b =>
    scope3Year == null || b.reporting_year === scope3Year
  );
  const scope3TotalEmissions = filteredScope3.reduce((s: number, b: any) => s + (Number(b.total_emissions) || 0), 0);
  // Group by GHG category for chart
  const scope3ByCategoryMap = new Map<string, { name: string; value: number; code: string }>();
  for (const b of filteredScope3) {
    const key = b.ghg_category_id ?? "unknown";
    const existing = scope3ByCategoryMap.get(key);
    const name = b.ghg_category_name ?? `Cat ${b.ghg_category_id}`;
    const code = `C${String(b.ghg_category_id ?? 0).padStart(2, "0")}`;
    if (existing) { existing.value += Number(b.total_emissions) || 0; }
    else scope3ByCategoryMap.set(key, { name: `${code} ${name}`, value: Number(b.total_emissions) || 0, code });
  }
  const scope3ByCategory = [...scope3ByCategoryMap.values()]
    .sort((a, b) => a.code.localeCompare(b.code))
    .filter(x => x.value > 0);

  // ── Module lookup helpers (used in analytics + column building) ──
  const emissionsModDef = modules.find((m) => m.key === "emissions");
  const emissionsModuleKpiIds = new Set(
    metrics.filter((m) => m.module_id === emissionsModDef?.module_id).map((m) => m.kpi_id)
  );

  // ── Analytics helpers ──
  // Total emissions = calculated emission_value (from Energy KPIs via factors)
  //                 + quantity entered directly for Emissions-module KPIs (user enters tCO₂e)
  const totalEmissions = filtered.reduce((s, e) => {
    if (Number(e.emission_value) > 0) return s + Number(e.emission_value);
    // Direct emission entry: quantity IS the tCO₂e (Emissions module KPI, no factor applied)
    if (e.kpi_id && emissionsModuleKpiIds.has(e.kpi_id)) return s + (Number(e.quantity) || 0);
    return s;
  }, 0);
  const hasEmissionData = totalEmissions > 0;

  const renewMetricIds = new Set(metrics.filter((m) => m.energy_type === "RENEWABLE").map((m) => m.kpi_id));
  const nonRenewMetricIds = new Set(metrics.filter((m) => m.energy_type === "NON_RENEWABLE").map((m) => m.kpi_id));

  const energyMod = modules.find((m) => m.key === "energy");
  const waterMod = modules.find((m) => m.key === "water");
  const wasteMod = modules.find((m) => m.key === "waste");
  // KPI IDs per module
  const modMetricIds = (mod: AppModule | undefined) =>
    new Set(metrics.filter((m) => m.module_id === mod?.module_id).map((m) => m.kpi_id));
  // Indicator IDs per module (for direct indicator entries where kpi_id = null)
  const modIndicatorIds = (mod: AppModule | undefined) =>
    new Set(indicators.filter((i) => i.module_id === mod?.module_id).map((i) => String(i.indicator_id)));

  // Returns true if an entry belongs to the given module — checks kpi_id first, falls back to indicator_id
  const inModule = (e: ESGInput, kpiIds: Set<string>, indIds: Set<string>) =>
    e.kpi_id ? kpiIds.has(e.kpi_id) : indIds.has(String((e as any).indicator_id ?? ""));

  // Sum a numeric field for entries belonging to a module (KPI entries OR direct indicator entries)
  const sumField = (kpiIds: Set<string>, indIds: Set<string>, field: "mj_value" | "emission_value" | "quantity") =>
    filtered
      .filter((e) => inModule(e, kpiIds, indIds))
      .reduce((s, e) => s + (Number((e as any)[field]) || 0), 0);

  const energyIds = modMetricIds(energyMod);
  const waterIds = modMetricIds(waterMod);
  const wasteIds = modMetricIds(wasteMod);
  const energyIndIds = modIndicatorIds(energyMod);
  const waterIndIds = modIndicatorIds(waterMod);
  const wasteIndIds = modIndicatorIds(wasteMod);

  // Stat card values — energy shown in GJ when MJ available
  const energyMJ = sumField(energyIds, energyIndIds, "mj_value");
  const energyQty = sumField(energyIds, energyIndIds, "quantity");
  const energyStatValue = energyMJ > 0 ? energyMJ / 1000 : energyQty;
  const energyStatLabel = energyMJ > 0 ? "Total Energy (GJ)" : "Total Energy (Qty)";
  const waterTotal = sumField(waterIds, waterIndIds, "quantity");
  const wasteTotal = sumField(wasteIds, wasteIndIds, "quantity");

  // Chart 1: Monthly bar (emissions if available, else energy qty)
  const monthlyEmissions = MONTH_NAMES.map((name, i) => {
    const me = filtered.filter((e) => e.month_id === i + 1);
    if (hasEmissionData) {
      // Sum calculated emission_value + direct emission entries (Emissions-module KPI quantity)
      const val = me.reduce((s, e) => {
        if (Number(e.emission_value) > 0) return s + Number(e.emission_value);
        if (e.kpi_id && emissionsModuleKpiIds.has(e.kpi_id)) return s + (Number(e.quantity) || 0);
        return s;
      }, 0);
      return { month: name, value: val };
    }
    return { month: name, value: me.filter((e) => inModule(e, energyIds, energyIndIds)).reduce((s, e) => s + (Number(e.quantity) || 0), 0) };
  });

  const monthlyTarget = useMemo(() => {
    const vals = monthlyEmissions.map((m) => m.value).filter((v) => v > 0);
    if (vals.length === 0) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [monthlyEmissions]);

  const exportMonthlyChart = () => {
    const rows = monthlyEmissions.map((m) => ({
      Month: m.month,
      [hasEmissionData ? "Emissions (tCO2e)" : "Energy (Qty)"]: m.value,
      "Period average": monthlyTarget || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Monthly");
    XLSX.writeFile(wb, `monthly-${hasEmissionData ? "emissions" : "energy"}-${fyLabel}.xlsx`);
    toast.success("Chart data exported");
  };

  // Chart 2: Emissions by Scope pie — data-driven (works even if scope_number not set on KPI)
  const scopeTotalsForPie = emissionScopes.map((sd) => {
    const scope = sd.scope_number;
    let sum = 0;
    filtered.forEach((e) => {
      if (!e.kpi_id) return;
      const kpi = metrics.find(m => m.kpi_id === e.kpi_id);
      if (!kpi) return;
      // Calculated emissions from any module where scope matches
      if (Number(e.emission_value) > 0 && kpi.scope_number === scope) {
        sum += Number(e.emission_value);
      }
      // Direct entry in Emissions module KPI with this scope
      if (kpi.module_id === emissionsModDef?.module_id && kpi.scope_number === scope) {
        sum += Number(e.quantity) || 0;
      }
    });
    return { name: sd.label, value: Math.round(sum * 100) / 100, color: sd.color };
  }).filter((x) => x.value > 0);

  // Chart 3: Location comparison
  const locMap = new Map<string, { name: string; value: number }>();
  filtered.forEach((e) => {
    const loc = locations.find(l => l.location_id === e.location_id);
    const n = loc?.location_name || e.location?.location_name || "Unknown";
    const p = locMap.get(n) || { name: n, value: 0 };
    p.value += Number(e.emission_value) || 0;
    locMap.set(n, p);
  });
  const locationComparison = [...locMap.values()].sort((a, b) => b.value - a.value).slice(0, 8);

  // Chart 4: Scope breakdown — scope_number is a KPI attribute only, so KPI match is correct here
  const scopedKpiIds = new Set(metrics.filter(m => m.scope_number).map(m => m.kpi_id));
  const scopeTotals = [
    ...emissionScopes.map((sd) => {
      const scope = sd.scope_number;
      const ids = new Set(metrics.filter((m) => m.scope_number === scope).map((m) => m.kpi_id));
      const sum = filtered.filter((e) => e.kpi_id && ids.has(e.kpi_id)).reduce((s, e) => s + (Number(e.emission_value) || 0), 0);
      return { name: sd.label, value: Math.round(sum * 100) / 100, color: sd.color };
    }),
    // Unscoped: KPIs with emission_value but no scope_number set
    (() => {
      const sum = filtered.filter(e => e.kpi_id && !scopedKpiIds.has(e.kpi_id)).reduce((s, e) => s + (Number(e.emission_value) || 0), 0);
      return { name: "Unscoped", value: Math.round(sum * 100) / 100, color: "#94a3b8" };
    })(),
  ].filter((x) => x.value > 0);

  // Chart 5: Energy mix — renewable/non-renewable is a KPI attribute; indicator entries go to "other energy"
  const hasMJData = filtered.some((e) => inModule(e, energyIds, energyIndIds) && Number(e.mj_value) > 0);
  const energyField: "mj_value" | "quantity" = hasMJData ? "mj_value" : "quantity";
  const energyMix = MONTH_NAMES.map((name, i) => {
    const me = filtered.filter((e) => e.month_id === i + 1);
    return {
      month: name,
      renewable: me.filter((e) => e.kpi_id && renewMetricIds.has(e.kpi_id)).reduce((s, e) => s + (Number((e as any)[energyField]) || 0), 0),
      nonRenewable: me.filter((e) => e.kpi_id && nonRenewMetricIds.has(e.kpi_id)).reduce((s, e) => s + (Number((e as any)[energyField]) || 0), 0),
    };
  });

  // Chart 6: Energy vs emission trend — energy covers both KPI and direct indicator entries
  const mjVsEmission = MONTH_NAMES.map((name, i) => {
    const me = filtered.filter((e) => e.month_id === i + 1);
    const ee = me.filter((e) => inModule(e, energyIds, energyIndIds));
    return {
      month: name,
      mj: hasMJData ? ee.reduce((s, e) => s + (Number(e.mj_value) || 0), 0) : ee.reduce((s, e) => s + (Number(e.quantity) || 0), 0),
      emission: me.reduce((s, e) => s + (Number(e.emission_value) || 0), 0),
    };
  });

  // ── Report tab: pivot table columns ──
  // Column order: Energy → Emissions (tCO₂e by scope) → Water → Waste
  const activeKpiIds = new Set(filtered.filter(e => e.kpi_id).map(e => e.kpi_id!));
  const activeIndIds = new Set(filtered.filter(e => e.indicator_id && !e.kpi_id).map(e => e.indicator_id!));
  // KPI IDs that have non-zero emission_value in approved data (data-driven, no flag dependency)
  const kpisWithCalcEmissions = new Set(
    filtered.filter(e => e.kpi_id && Number(e.emission_value) > 0).map(e => e.kpi_id!)
  );
  // KPI IDs that have non-zero emission_value_lb (location-based) in approved data
  const kpisWithLbEmissions = new Set(
    filtered.filter(e => e.kpi_id && Number(e.emission_value_lb) > 0).map(e => e.kpi_id!)
  );

  const reportColumns: ReportCol[] = [];

  // Reusable: build KPI columns for one module (quantity + MJ for energy KPIs)
  const addModuleKpiCols = (mod: AppModule) => {
    const modKpis = metrics.filter(m => m.module_id === mod.module_id && activeKpiIds.has(m.kpi_id));
    const byInd = new Map<number | null, typeof modKpis>();
    for (const kpi of modKpis) {
      const k = kpi.indicator_id ?? null;
      if (!byInd.has(k)) byInd.set(k, []);
      byInd.get(k)!.push(kpi);
    }
    const sortedIndKeys = [...byInd.keys()].sort((a, b) => {
      if (a === null && b === null) return 0;
      if (a === null) return 1; if (b === null) return -1;
      const dA = indicators.find(i => i.indicator_id === a)?.display_order ?? 999;
      const dB = indicators.find(i => i.indicator_id === b)?.display_order ?? 999;
      return dA - dB;
    });
    for (const indId of sortedIndKeys) {
      const ind = indId != null ? indicators.find(i => i.indicator_id === indId) ?? null : null;
      for (const kpi of (byInd.get(indId) ?? []).sort((a, b) => a.kpi_name.localeCompare(b.kpi_name))) {
        const base = { moduleId: mod.module_id, moduleLabel: mod.module_name, moduleColor: mod.color, moduleBg: mod.bg_color, indicatorId: indId, indicatorLabel: ind?.indicator_name ?? null };
        reportColumns.push({ ...base, colId: kpi.kpi_id, label: `${kpi.kpi_name} (${kpi.unit})`, unit: kpi.unit, field: "quantity" });
        if (kpi.energy_type === "RENEWABLE" || kpi.energy_type === "NON_RENEWABLE")
          reportColumns.push({ ...base, colId: `${kpi.kpi_id}_mj`, label: `${kpi.kpi_name} (MJ)`, unit: "MJ", field: "mj_value" });
      }
    }
    // Direct indicator entries (no KPI) — quantity only
    for (const ind of indicators.filter(i => i.module_id === mod.module_id && activeIndIds.has(i.indicator_id)).sort((a, b) => a.display_order - b.display_order)) {
      reportColumns.push({ colId: `ind_${ind.indicator_id}`, label: ind.indicator_name, unit: "", field: "quantity", moduleId: mod.module_id, moduleLabel: mod.module_name, moduleColor: mod.color, moduleBg: mod.bg_color, indicatorId: ind.indicator_id, indicatorLabel: null });
    }
  };

  // Reusable: build Emissions tCO₂e columns (scope-grouped, data-driven)
  const addEmissionCols = () => {
    const em = emissionsModDef;
    if (!em) return;
    const emBase = { moduleId: em.module_id, moduleLabel: em.module_name, moduleColor: em.color, moduleBg: em.bg_color };
    for (const scope of [1, 2, 3, 0] as const) {
      const vIndId = scope > 0 ? -scope : -99;
      const sl = scope > 0 ? `Scope ${scope}` : "Other Emissions";
      const scopeMatch = (kpi: KPI) => scope > 0 ? kpi.scope_number === scope : !kpi.scope_number;
      // (A) Calculated emissions from Energy/other module KPIs (emission_value in data)
      for (const kpi of metrics.filter(m => m.module_id !== em.module_id && kpisWithCalcEmissions.has(m.kpi_id) && scopeMatch(m)).sort((a, b) => a.kpi_name.localeCompare(b.kpi_name))) {
        reportColumns.push({ ...emBase, colId: `${kpi.kpi_id}_co2e`, label: `${kpi.kpi_name} (tCO₂e)`, unit: "tCO₂e", field: "emission_value", indicatorId: vIndId, indicatorLabel: sl });
        // Add LB column immediately after MB column, only if LB data exists
        if (kpisWithLbEmissions.has(kpi.kpi_id)) {
          reportColumns.push({ ...emBase, colId: `${kpi.kpi_id}_co2e_lb`, label: `${kpi.kpi_name} (tCO₂e LB)`, unit: "tCO₂e", field: "emission_value_lb", indicatorId: vIndId, indicatorLabel: sl });
        }
      }
      // (B) Direct emission entry KPIs (Emissions module, user enters tCO₂e as quantity)
      for (const kpi of metrics.filter(m => m.module_id === em.module_id && activeKpiIds.has(m.kpi_id) && scopeMatch(m)).sort((a, b) => a.kpi_name.localeCompare(b.kpi_name))) {
        reportColumns.push({ ...emBase, colId: kpi.kpi_id, label: `${kpi.kpi_name} (${kpi.unit})`, unit: kpi.unit, field: "quantity", indicatorId: vIndId, indicatorLabel: sl });
      }
    }
  };

  // Build lookup: record_id → disposal breakdown rows (for row population below)
  const disposalByRecord = new Map<string, WasteDisposalBreakdown[]>();
  for (const wd of wasteDisposals) {
    if (!disposalByRecord.has(wd.record_id)) disposalByRecord.set(wd.record_id, []);
    disposalByRecord.get(wd.record_id)!.push(wd);
  }
  // Identify which waste entry+method combos have actual data (to avoid empty columns)
  // Works for both KPI entries and direct indicator entries in waste module
  const wasteModId = modules.find(m => m.key === "waste")?.module_id;
  const wasteKpiIds = new Set(metrics.filter(m => wasteModId != null && m.module_id === wasteModId).map(m => m.kpi_id));
  const wasteDirectIndIds = new Set(
    indicators
      .filter(i => wasteModId != null && i.module_id === wasteModId && metrics.filter(m => m.indicator_id === i.indicator_id).length === 0)
      .map(i => i.indicator_id)
  );
  const disposalMethodsWithData = new Set<string>(); // `${colId}_bd_${method}`
  for (const e of filtered) {
    const colId = e.kpi_id && wasteKpiIds.has(e.kpi_id)
      ? e.kpi_id
      : !e.kpi_id && e.indicator_id && wasteDirectIndIds.has(e.indicator_id)
      ? `ind_${e.indicator_id}`
      : null;
    if (!colId) continue;
    const rows = disposalByRecord.get(e.record_id) || [];
    for (const wd of rows) disposalMethodsWithData.add(`${colId}_bd_${wd.method}`);
  }

  // Build in BRSR order: Energy → Emissions → Water → Waste → Derived Metrics
  if (energyMod) addModuleKpiCols(energyMod);
  addEmissionCols();
  if (waterMod) addModuleKpiCols(waterMod);
  // Waste: quantity columns from addModuleKpiCols, then inject disposal sub-columns after each waste KPI
  if (wasteMod) addModuleKpiCols(wasteMod);
  // After building waste cols, splice in disposal sub-columns for each waste entry that has breakdown data
  // Covers both KPI columns (colId = kpi_id) and direct indicator columns (colId = ind_${id})
  for (let ci = reportColumns.length - 1; ci >= 0; ci--) {
    const col = reportColumns[ci];
    if (col.moduleId !== wasteModId || col.field !== "quantity") continue;
    const subCols = disposalMethods
      .filter((dm) => disposalMethodsWithData.has(`${col.colId}_bd_${dm.key}`))
      .map((dm) => ({
        colId: `${col.colId}_bd_${dm.key}`,
        label: `↳ ${dm.label}`,
        unit: col.unit,
        field: "quantity" as const,
        moduleId: col.moduleId,
        moduleLabel: col.moduleLabel,
        moduleColor: col.moduleColor,
        moduleBg: col.moduleBg,
        indicatorId: col.indicatorId,
        indicatorLabel: col.indicatorLabel,
      }));
    if (subCols.length > 0) reportColumns.splice(ci + 1, 0, ...subCols);
  }

  // Derived metrics columns — only show_in_report=true ones appear as columns
  // Intermediate steps are computed (in derivedMetrics loop below) but never shown as columns
  const DERIVED_MODULE_ID = -1;
  const derivedModLabel = "Derived Metrics";
  const derivedModColor = "#7c3aed";
  const derivedModBg    = "#f3e8ff";
  for (const dm of reportDerivedMetrics) {
    const mod = dm.module_id ? modules.find(m => m.module_id === dm.module_id) : null;
    reportColumns.push({
      colId:          `dm_${dm.metric_id}`,
      label:          `${dm.name} (${dm.unit})`,
      unit:           dm.unit,
      field:          "quantity",           // placeholder — value resolved specially per row below
      moduleId:       mod?.module_id ?? DERIVED_MODULE_ID,
      moduleLabel:    mod?.module_name ?? derivedModLabel,
      moduleColor:    mod?.color ?? derivedModColor,
      moduleBg:       mod?.bg_color ?? derivedModBg,
      indicatorId:    dm.indicator_id ?? null,
      indicatorLabel: null,
    });
  }

  // ── Report tab: pivot table rows ──
  const rowKeyMap = new Map<string, ReportRow>();
  for (const e of filtered) {
    const rk = `${e.location_id}__${e.year_id}__${e.month_id}`;
    if (!rowKeyMap.has(rk)) {
      const loc = locations.find(l => l.location_id === e.location_id);
      const ry = reportingYears.find(r => r.year_id === e.year_id);
      rowKeyMap.set(rk, {
        locationId: e.location_id,
        locationName: loc?.location_name || e.location?.location_name || "Unknown",
        fyLabel: ry?.financial_year?.fy_label || `FY ${e.year_id}`,
        yearId: e.year_id,
        monthId: e.month_id,
        monthName: MONTH_NAMES[e.month_id - 1] || `M${e.month_id}`,
        values: new Map(),
      });
    }
    if (!e.kpi_id && !e.indicator_id) continue;
    const row = rowKeyMap.get(rk)!;
    if (e.kpi_id) {
      // Quantity
      row.values.set(e.kpi_id, (row.values.get(e.kpi_id) ?? 0) + (Number(e.quantity) || 0));
      // MJ (energy)
      const mjKey = `${e.kpi_id}_mj`;
      row.values.set(mjKey, (row.values.get(mjKey) ?? 0) + (Number(e.mj_value) || 0));
      // Waste disposal breakdown sub-values (KPI entries)
      if (wasteKpiIds.has(e.kpi_id) && e.record_id) {
        const dispRows = disposalByRecord.get(e.record_id) || [];
        for (const wd of dispRows) {
          const bdKey = `${e.kpi_id}_bd_${wd.method}`;
          row.values.set(bdKey, (row.values.get(bdKey) ?? 0) + (Number(wd.quantity) || 0));
        }
      }
      // tCO2e MB (market-based emission)
      const co2Key = `${e.kpi_id}_co2e`;
      row.values.set(co2Key, (row.values.get(co2Key) ?? 0) + (Number(e.emission_value) || 0));
      // tCO2e LB (location-based emission)
      if (e.emission_value_lb != null) {
        const lbKey = `${e.kpi_id}_co2e_lb`;
        row.values.set(lbKey, (row.values.get(lbKey) ?? 0) + (Number(e.emission_value_lb) || 0));
      }
    } else {
      // Direct indicator entry — quantity only
      const ck = `ind_${e.indicator_id}`;
      row.values.set(ck, (row.values.get(ck) ?? 0) + (Number(e.quantity) || 0));
      // Waste disposal breakdown sub-values (direct indicator entries)
      if (e.indicator_id && wasteDirectIndIds.has(e.indicator_id) && e.record_id) {
        const dispRows = disposalByRecord.get(e.record_id) || [];
        for (const wd of dispRows) {
          const bdKey = `${ck}_bd_${wd.method}`;
          row.values.set(bdKey, (row.values.get(bdKey) ?? 0) + (Number(wd.quantity) || 0));
        }
      }
    }
  }
  // ── Compute derived metric values per row ──────────────────────────────────
  // derivedMetrics is already sorted by display_order (from backend), so intermediate
  // steps are computed before final steps that reference them.
  const resolveOperand = (
    type: string,
    kpiId: string | undefined,
    field: string | undefined,
    constant: number | undefined,
    indicatorId: number | undefined,
    derivedId: string | undefined,
    rowVals: Map<string, number>,
  ): number | null => {
    if (type === "constant")        return constant ?? null;
    if (type === "kpi_field") {
      if (!kpiId || !field) return null;
      const key = field === "mj_value" ? `${kpiId}_mj` : field === "emission_value" ? `${kpiId}_co2e` : kpiId;
      const v = rowVals.get(key);
      return v !== undefined ? v : null;
    }
    if (type === "indicator_field") {
      if (!indicatorId) return null;
      const v = rowVals.get(`ind_${indicatorId}`);
      return v !== undefined ? v : null;
    }
    if (type === "derived") {
      if (!derivedId) return null;
      const v = rowVals.get(`dm_${derivedId}`);
      return v !== undefined ? v : null;    // only available if that step was computed earlier (lower display_order)
    }
    return null;
  };

  for (const row of rowKeyMap.values()) {
    for (const dm of derivedMetrics) {
      let result: number | null = null;

      if (dm.formula) {
        // Formula mode — use recursive descent evaluator
        result = evaluateFormula(dm.formula, row.values);
      } else if (dm.lhs_type && dm.rhs_type) {
        // Legacy LHS/operator/RHS mode
        const lhs = resolveOperand(dm.lhs_type, dm.lhs_kpi_id, dm.lhs_field, dm.lhs_constant, dm.lhs_indicator_id, dm.lhs_derived_id, row.values);
        const rhs = resolveOperand(dm.rhs_type, dm.rhs_kpi_id, dm.rhs_field, dm.rhs_constant, dm.rhs_indicator_id, dm.rhs_derived_id, row.values);
        if (lhs === null || rhs === null) continue;
        if (dm.operator === "+") result = lhs + rhs;
        else if (dm.operator === "-") result = lhs - rhs;
        else if (dm.operator === "*") result = lhs * rhs;
        else if (dm.operator === "/" && rhs !== 0) result = lhs / rhs;
        else if (dm.operator === "%" && rhs !== 0) result = (lhs / rhs) * 100;
      }

      if (result !== null && isFinite(result)) row.values.set(`dm_${dm.metric_id}`, result);
    }
  }

  const reportRows: ReportRow[] = [...rowKeyMap.values()].sort((a, b) =>
    a.yearId !== b.yearId ? a.yearId - b.yearId :
    a.monthId !== b.monthId ? a.monthId - b.monthId :
    a.locationName.localeCompare(b.locationName)
  );

  // ── Report header groups ──
  // Module groups (row 1 colspan) — derived from actual column order, not MODULES array order
  const moduleGroups: { moduleId: number; label: string; color: string; bg: string; count: number }[] = [];
  for (const col of reportColumns) {
    const last = moduleGroups[moduleGroups.length - 1];
    if (last && last.moduleId === col.moduleId) { last.count++; }
    else moduleGroups.push({ moduleId: col.moduleId, label: col.moduleLabel, color: col.moduleColor, bg: col.moduleBg, count: 1 });
  }

  // Indicator groups (row 2 colspan) — group consecutive columns with same moduleId+indicatorId
  const indicatorGroups: { label: string; count: number; moduleColor: string; moduleBg: string }[] = [];
  let prevGrpKey = "";
  for (const col of reportColumns) {
    const gk = `${col.moduleId}_${col.indicatorId ?? "_"}`;
    if (gk !== prevGrpKey) {
      indicatorGroups.push({ label: col.indicatorLabel ?? "", count: 1, moduleColor: col.moduleColor, moduleBg: col.moduleBg });
      prevGrpKey = gk;
    } else {
      indicatorGroups[indicatorGroups.length - 1].count++;
    }
  }

  // ── Location display label (smart: derives from data for location users) ──
  const locationDisplayLabel = (() => {
    if (selectedLocation) {
      return locations.find(l => l.location_id === selectedLocation)?.location_name || "Selected Location";
    }
    if (isLocationUser && reportRows.length > 0) {
      const names = [...new Set(reportRows.map(r => r.locationName))];
      return names.join(" & ");
    }
    if (isLocationUser && assignedLocationIds?.length) {
      const loc = locations.find(l => assignedLocationIds.includes(l.location_id));
      if (loc) return loc.location_name;
    }
    return "All Locations";
  })();

  // Same logic for Analytics tab location display
  const analyticsLocationLabel = (() => {
    if (selectedLocation) return locations.find(l => l.location_id === selectedLocation)?.location_name || "Selected Location";
    if (isLocationUser) {
      if (assignedLocationIds?.length) {
        const loc = locations.find(l => assignedLocationIds.includes(l.location_id));
        if (loc) return loc.location_name;
      }
      const uniqueLocs = [...new Set(filtered.map(e => e.location?.location_name).filter(Boolean))];
      if (uniqueLocs.length) return uniqueLocs.join(" & ");
    }
    return "All Locations";
  })();

  // ── Generate BRSR workbook (MCA-style) ──
  const downloadBrsr = async () => {
    if (!selectedFY) {
      toast.error("Select a Financial Year first.");
      return;
    }
    setBrsrLoading(true);
    try {
      toast.info("Generating BRSR report…");
      const res = await tenantApi.downloadBrsrReport(Number(selectedFY));
      const disposition = (res.headers?.["content-disposition"] as string) || "";
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const filename = match ? match[1] : `BRSR_${selectedFY}.xlsx`;
      const blob = new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("BRSR report downloaded");
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to generate BRSR report"));
    } finally {
      setBrsrLoading(false);
    }
  };

  // ── Export Report as Excel (.xlsx) ──
  const exportXLSX = () => {
    if (reportColumns.length === 0 || reportRows.length === 0) {
      toast.error("No data to export"); return;
    }
    const NUM_FIXED = 3; // Location, FY, Month

    // Build array of arrays (header rows + data rows)
    const row1: (string | number)[] = ["Location", "Financial Year", "Month", ...reportColumns.map(c => c.moduleLabel)];
    const row2: (string | number)[] = ["", "", "", ...reportColumns.map(c => c.indicatorLabel ?? "")];
    const row3: (string | number)[] = ["", "", "", ...reportColumns.map(c => c.label)];
    const dataRows = reportRows.map(row => [
      row.locationName,
      row.fyLabel,
      row.monthName,
      ...reportColumns.map(col => {
        const v = row.values.get(col.colId);
        return v != null ? v : "";
      }),
    ]);

    const wsData = [row1, row2, row3, ...dataRows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Merges: Location/FY/Month → rowspan 3; module groups; indicator groups
    const merges: XLSX.Range[] = [];
    for (let c = 0; c < NUM_FIXED; c++) merges.push({ s: { r: 0, c }, e: { r: 2, c } });
    let colOff = NUM_FIXED;
    for (const mg of moduleGroups) {
      if (mg.count > 1) merges.push({ s: { r: 0, c: colOff }, e: { r: 0, c: colOff + mg.count - 1 } });
      colOff += mg.count;
    }
    colOff = NUM_FIXED;
    for (const ig of indicatorGroups) {
      if (ig.count > 1) merges.push({ s: { r: 1, c: colOff }, e: { r: 1, c: colOff + ig.count - 1 } });
      colOff += ig.count;
    }
    ws["!merges"] = merges;

    // Column widths
    ws["!cols"] = [
      { wch: 22 }, { wch: 12 }, { wch: 8 },
      ...reportColumns.map(() => ({ wch: 16 })),
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ESG Report");
    XLSX.writeFile(wb, `esmos-report-${fyLabel}.xlsx`);
    toast.success("Report exported as Excel");
  };

  if (loading) {
    return (
      <PageShell title="Reports & Analytics" breadcrumb={[{ label: "Company Portal", href: "/app" }, { label: "Reports" }]} fullWidth>
        <LoadingSkeleton rows={6} cols={3} />
      </PageShell>
    );
  }

  const hasFilters = !!(selectedFY || (!isLocationUser && selectedLocation) || selectedMonth);

  const chartVisible = (id: Exclude<AnalyticsChartFocus, "all">) =>
    chartFocus === "all" || chartFocus === id;

  const metricTiles = [
    { icon: Zap, label: energyStatLabel, value: energyStatValue.toLocaleString(undefined, { maximumFractionDigits: 1 }), tint: "bg-warn-tint/50" },
    { icon: Wind, label: "Total Emissions (tCO₂e)", value: totalEmissions.toLocaleString(undefined, { maximumFractionDigits: 2 }), tint: "bg-ok-tint/50" },
    { icon: Droplets, label: "Total Water (kL)", value: waterTotal.toLocaleString(undefined, { maximumFractionDigits: 0 }), tint: "bg-info-tint/50" },
    { icon: Trash2, label: "Total Waste (MT)", value: wasteTotal.toLocaleString(undefined, { maximumFractionDigits: 2 }), tint: "bg-sunken" },
    { icon: Package2, label: "Scope 3 Emissions (tCO₂e)", value: scope3TotalEmissions.toLocaleString(undefined, { maximumFractionDigits: 2 }), tint: "bg-accent/60" },
  ];

  return (
    <PageShell
      title="Reports & Analytics"
      description="Approved data only"
      breadcrumb={[{ label: "Company Portal", href: "/app" }, { label: "Reports & Analytics" }]}
      fullWidth
      className="pt-3 pb-4 [&_.page-header]:mb-0"
      actions={
        <div className="flex items-center gap-2">
          {tab === "annexure" && (
            <Button variant="outline" size="sm" onClick={exportXLSX}>
              <FileSpreadsheet size={13} className="text-ok" /> Export Excel
            </Button>
          )}
          <Button
            size="sm"
            onClick={downloadBrsr}
            disabled={!selectedFY || brsrLoading}
            title={selectedFY ? "Download BRSR workbook" : "Select a Financial Year to enable"}
          >
            <FileDown size={13} /> {brsrLoading ? "Generating…" : "Generate BRSR"}
          </Button>
        </div>
      }
    >
      {/* Sticky sub-tab + filter chrome */}
      <div className="sticky top-0 z-30 -mx-1 px-1 mb-3 bg-background/95 backdrop-blur-sm border-b border-border pb-2">
        <div role="tablist" className="config-tabs mb-2" aria-label="Reports views">
          {([
            { key: "analytics" as ReportTab, label: "Analytics", icon: Database },
            { key: "annexure" as ReportTab, label: "Report", icon: FileText },
          ]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn("config-tab", tab === key && "config-tab-active")}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
        <FilterBar
          showClear={hasFilters}
          onClear={() => { setSelectedFY(""); setSelectedMonth(""); if (!isLocationUser) setSelectedLocation(""); }}
        >
          <FilterSelect
            label="FY"
            value={selectedFY}
            onChange={setSelectedFY}
            placeholder="All FY"
            options={reportingYears.map((r) => ({
              value: String(r.year_id),
              label: r.financial_year?.fy_label || `FY ${r.year_id}`,
            }))}
            minWidth={150}
          />
          {!isLocationUser && (
            <FilterSelect
              label="Location"
              value={selectedLocation}
              onChange={setSelectedLocation}
              placeholder="All Locations"
              options={locations.map((l) => ({ value: l.location_id, label: l.location_name }))}
              minWidth={160}
            />
          )}
          {tab === "analytics" && (
            <FilterSelect
              label="Month"
              value={selectedMonth}
              onChange={setSelectedMonth}
              placeholder="All Months"
              options={MONTH_NAMES.map((name, i) => ({ value: String(i + 1), label: name }))}
              minWidth={130}
            />
          )}
        </FilterBar>
      </div>

      {/* ══════ ANALYTICS TAB ══════ */}
      {tab === "analytics" && (
        <>
          {filtered.length === 0 && (
            <p className="text-[12px] text-amber-500 mb-2">No entries found for the selected filters</p>
          )}

          {/* Metric summary — tonal strip, no hard card outlines */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-0 mb-4 rounded-md overflow-hidden bg-sunken/40">
            {metricTiles.map((m) => (
              <div key={m.label} className={cn("px-4 py-3.5 flex items-start gap-3", m.tint)}>
                <div className="w-8 h-8 rounded-md bg-card/80 flex items-center justify-center shrink-0 text-foreground/70">
                  <m.icon size={16} />
                </div>
                <div className="min-w-0">
                  <div className="metric-value text-[20px]">{m.value}</div>
                  <div className="text-[11px] font-semibold field-label mt-1 leading-snug">{m.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2 mb-3">
            <label htmlFor="reports-chart-focus" className="text-[12px] font-semibold text-muted-foreground">
              Show:
            </label>
            <select
              id="reports-chart-focus"
              className="h-8 rounded-md border border-border bg-card px-2.5 text-[12px] text-foreground outline-none focus:border-primary"
              value={chartFocus}
              onChange={(e) => setChartFocus(e.target.value as AnalyticsChartFocus)}
            >
              {CHART_FOCUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className={cn("grid gap-3 mb-3", chartFocus === "all" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1")}>
            {/* Monthly emissions — dashed target + Excel export */}
            {chartVisible("monthly") && (
            <AnalyticsPanel
              title={hasEmissionData ? "Monthly Emissions (tCO₂e)" : "Monthly Energy Consumption (Qty)"}
              focused={chartFocus === "monthly"}
              onToggleFocus={() => setChartFocus((f) => (f === "monthly" ? "all" : "monthly"))}
              actions={
                <button
                  type="button"
                  title="Export Excel"
                  onClick={exportMonthlyChart}
                  className="p-1.5 rounded-md text-ok hover:bg-ok-tint"
                >
                  <FileSpreadsheet size={14} />
                </button>
              }
            >
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyEmissions}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: CHART_AXIS }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: CHART_AXIS }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  {monthlyTarget > 0 && (
                    <ReferenceLine
                      y={monthlyTarget}
                      stroke="hsl(var(--destructive))"
                      strokeDasharray="6 4"
                      strokeWidth={1.5}
                      label={{ value: "Target", position: "insideTopRight", fill: "hsl(var(--destructive))", fontSize: 10 }}
                    />
                  )}
                  <Bar dataKey="value" name={hasEmissionData ? "Emissions (tCO₂e)" : "Quantity"} fill={CHART_COLORS[4]} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </AnalyticsPanel>
            )}

            {/* Emissions by Scope — Chart | Data Table toggle */}
            {chartVisible("scopePie") && (
            <AnalyticsPanel
              title="Emissions by Scope"
              focused={chartFocus === "scopePie"}
              onToggleFocus={() => setChartFocus((f) => (f === "scopePie" ? "all" : "scopePie"))}
              actions={
                <div className="inline-flex rounded-md border border-border/60 p-0.5 bg-card/60">
                  <button
                    type="button"
                    onClick={() => setScopeView("chart")}
                    className={cn(
                      "px-2.5 py-1 rounded text-[11px] font-semibold transition-colors",
                      scopeView === "chart" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                    )}
                  >
                    Chart
                  </button>
                  <button
                    type="button"
                    onClick={() => setScopeView("table")}
                    className={cn(
                      "px-2.5 py-1 rounded text-[11px] font-semibold transition-colors",
                      scopeView === "table" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
                    )}
                  >
                    Data Table
                  </button>
                </div>
              }
            >
              {scopeTotalsForPie.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-16">No emission data</p>
              ) : scopeView === "chart" ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="55%" height={220}>
                    <PieChart>
                      <Pie data={scopeTotalsForPie} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                        {scopeTotalsForPie.map((_e, i) => <Cell key={i} fill={scopeTotalsForPie[i].color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v.toLocaleString()} tCO₂e`, ""]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 flex flex-col gap-2">
                    {scopeTotalsForPie.map((m, i) => (
                      <div key={i} className="flex items-center justify-between text-[12px]">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />
                          <span className="text-muted-foreground">{m.name}</span>
                        </div>
                        <span className="font-bold text-foreground tabular-nums">{m.value.toLocaleString()} tCO₂e</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-[hsl(var(--border-hairline))]">
                      <th className="py-2 font-semibold">Scope</th>
                      <th className="py-2 font-semibold text-right">tCO₂e</th>
                      <th className="py-2 font-semibold text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scopeTotalsForPie.map((m, i) => {
                      const total = scopeTotalsForPie.reduce((a, b) => a + b.value, 0) || 1;
                      return (
                        <tr key={i} className="border-b border-[hsl(var(--border-hairline))]">
                          <td className="py-2 text-[12px]">
                            <span className="inline-flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ background: m.color }} />
                              {m.name}
                            </span>
                          </td>
                          <td className="py-2 text-[12px] text-right tabular-nums font-semibold">{m.value.toLocaleString()}</td>
                          <td className="py-2 text-[12px] text-right tabular-nums text-muted-foreground">
                            {((m.value / total) * 100).toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </AnalyticsPanel>
            )}

            {chartVisible("topLocations") && (
            <AnalyticsPanel
              title="Top Emitters by Location"
              focused={chartFocus === "topLocations"}
              onToggleFocus={() => setChartFocus((f) => (f === "topLocations" ? "all" : "topLocations"))}
            >
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={locationComparison} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#0f172a" }} width={120} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" fill="#14b8a6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </AnalyticsPanel>
            )}

            {chartVisible("scopeBreakdown") && (
            <AnalyticsPanel
              title="GHG Scope Breakdown"
              focused={chartFocus === "scopeBreakdown"}
              onToggleFocus={() => setChartFocus((f) => (f === "scopeBreakdown" ? "all" : "scopeBreakdown"))}
            >
              {scopeTotals.length === 0 ? <p className="text-center text-muted-foreground text-sm py-16">No scope data</p> : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="55%" height={220}>
                    <PieChart>
                      <Pie data={scopeTotals} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                        {scopeTotals.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 flex flex-col gap-3">
                    {scopeTotals.map((s, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-[12px] mb-0.5">
                          <span className="text-muted-foreground">{s.name}</span>
                          <span className="font-bold text-foreground tabular-nums">{s.value.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-card/80">
                          <div className="h-full rounded-full" style={{ background: s.color, width: `${(s.value / scopeTotals.reduce((a, b) => a + b.value, 0)) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </AnalyticsPanel>
            )}

            {chartVisible("energyMix") && (
            <AnalyticsPanel
              title={`Energy Mix — Renewable vs Non-Renewable (${hasMJData ? "MJ" : "Qty"})`}
              focused={chartFocus === "energyMix"}
              onToggleFocus={() => setChartFocus((f) => (f === "energyMix" ? "all" : "energyMix"))}
            >
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={energyMix} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="renewable" stackId="a" fill="#14b8a6" name="Renewable" />
                  <Bar dataKey="nonRenewable" stackId="a" fill="#f59e0b" name="Non-Renewable" radius={[4, 4, 0, 0]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            </AnalyticsPanel>
            )}

            {chartVisible("mjVsEmission") && (
            <AnalyticsPanel
              title={`Energy (${hasMJData ? "MJ" : "Qty"}) vs Emissions (tCO₂e) Trend`}
              focused={chartFocus === "mjVsEmission"}
              onToggleFocus={() => setChartFocus((f) => (f === "mjVsEmission" ? "all" : "mjVsEmission"))}
            >
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={mjVsEmission}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#f59e0b" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Line yAxisId="left" type="monotone" dataKey="mj" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name={hasMJData ? "Energy (MJ)" : "Energy (Qty)"} />
                  <Line yAxisId="right" type="monotone" dataKey="emission" stroke="#64748b" strokeWidth={2} dot={{ r: 3 }} name="Emissions (tCO₂e)" />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </LineChart>
              </ResponsiveContainer>
            </AnalyticsPanel>
            )}
          </div>

          {scope3ByCategory.length > 0 && chartVisible("scope3Category") && (
            <AnalyticsPanel
              title="Scope 3 Emissions by GHG Category (tCO₂e)"
              focused={chartFocus === "scope3Category"}
              onToggleFocus={() => setChartFocus((f) => (f === "scope3Category" ? "all" : "scope3Category"))}
            >
              <ResponsiveContainer width="100%" height={Math.max(220, scope3ByCategory.length * 36)}>
                <BarChart data={scope3ByCategory} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v) => v.toLocaleString()} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#0f172a" }} width={200} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${v.toLocaleString(undefined, { maximumFractionDigits: 2 })} tCO₂e`, "Emissions"]} />
                  <Bar dataKey="value" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </AnalyticsPanel>
          )}
        </>
      )}

      {/* ══════ REPORT TAB (Pivot Table) ══════ */}
      {tab === "annexure" && (
        <div className="flex flex-col gap-4">
          {/* Header bar */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[12px] text-muted-foreground">
                <strong>{fyLabel}</strong> · {locationDisplayLabel}
                {reportColumns.length > 0 && <span className="ml-2 text-muted-foreground">— {reportColumns.length} indicators/KPIs · {reportRows.length} row{reportRows.length !== 1 ? "s" : ""}</span>}
              </p>
            </div>
            {/* Module legend */}
            <div className="flex items-center gap-3">
              {moduleGroups.map(mod => (
                <div key={mod.moduleId} className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: mod.color }}>
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: mod.color }} />
                  {mod.label}
                </div>
              ))}
            </div>
          </div>

          {reportColumns.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-16 text-center">
              <p className="text-muted-foreground text-[14px]">No data available for selected filters.</p>
              <p className="text-muted-foreground/40 text-[12px] mt-1">Enter ESG data or adjust the filters above.</p>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="text-[12px] border-collapse" style={{ minWidth: "100%" }}>
                  <thead>
                    {/* Row 1: Fixed columns (rowSpan=3) + Module group headers */}
                    <tr>
                      {["Location", "Financial Year", "Month"].map(h => (
                        <th key={h} rowSpan={3}
                          className="border border-border px-3 py-2.5 bg-sunken text-foreground font-bold text-[11px] uppercase whitespace-nowrap text-left align-bottom"
                          style={{ minWidth: h === "Location" ? 140 : 100 }}>
                          {h}
                        </th>
                      ))}
                      {moduleGroups.map(mod => (
                        <th key={mod.moduleId} colSpan={mod.count}
                          className="border border-border px-3 py-2 font-bold text-[11px] uppercase tracking-wide text-center"
                          style={{ background: mod.bg, color: mod.color }}>
                          {mod.label}
                        </th>
                      ))}
                    </tr>

                    {/* Row 2: Indicator group headers */}
                    <tr>
                      {indicatorGroups.map((ig, i) => (
                        <th key={i} colSpan={ig.count}
                          className="border border-border px-3 py-1.5 text-[11px] font-semibold text-center whitespace-nowrap"
                          style={{ color: ig.moduleColor, background: ig.moduleBg }}>
                          {ig.label || <span className="text-muted-foreground/40">—</span>}
                        </th>
                      ))}
                    </tr>

                    {/* Row 3: KPI name + unit */}
                    <tr>
                      {reportColumns.map(col => (
                        <th key={col.colId}
                          className="border border-border px-3 py-2 text-center font-semibold whitespace-nowrap"
                          style={{ color: col.moduleColor, background: `${col.moduleColor}10`, minWidth: 100 }}>
                          <div>{col.label}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {reportRows.map((row, ri) => (
                      <tr key={`${row.locationId}_${row.yearId}_${row.monthId}`}
                        className={`hover:bg-sunken/60 transition-colors ${ri % 2 === 0 ? "bg-card" : "bg-sunken/30"}`}>
                        <td className="border border-[hsl(var(--border-hairline))] px-3 py-2 font-semibold text-foreground whitespace-nowrap">{row.locationName}</td>
                        <td className="border border-[hsl(var(--border-hairline))] px-3 py-2 text-muted-foreground whitespace-nowrap">{row.fyLabel}</td>
                        <td className="border border-[hsl(var(--border-hairline))] px-3 py-2 text-muted-foreground whitespace-nowrap">{row.monthName}</td>
                        {reportColumns.map(col => {
                          const val = row.values.get(col.colId);
                          const isDerived = col.colId.startsWith("dm_");
                          // For derived cols: only hide when no result (null). For others: also hide calculated-zero.
                          const isEmpty = val == null || (!isDerived && col.field !== "quantity" && val === 0);
                          return (
                            <td key={col.colId} className="border border-[hsl(var(--border-hairline))] px-3 py-2 text-right font-mono text-[12px]">
                              {!isEmpty
                                ? <span style={{ color: col.moduleColor }} className="font-semibold">{val!.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                                : <span className="text-border">—</span>
                              }
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {reportRows.length === 0 && (
                      <tr>
                        <td colSpan={3 + reportColumns.length} className="py-10 text-center text-muted-foreground text-[13px]">
                          No entries found for selected filters
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Scope 3 Summary — approved batches for selected FY */}
          {filteredScope3.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-3">
                <Package2 size={15} className="text-accent-foreground" />
                <h3 className="text-[14px] font-bold text-foreground">Scope 3 Emissions Summary</h3>
                <span className="text-[11px] text-muted-foreground">Approved batches only</span>
              </div>
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <table className="w-full text-[12px] border-collapse">
                  <thead>
                    <tr className="bg-accent">
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-accent-foreground border-b border-border">Category</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-accent-foreground border-b border-border">Entry Type</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-accent-foreground border-b border-border">Year</th>
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-accent-foreground border-b border-border">Month</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-accent-foreground border-b border-border">Rows</th>
                      <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-accent-foreground border-b border-border">tCO₂e</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredScope3.map((b: any, i: number) => (
                      <tr key={b.batch_id || i} className={i % 2 === 0 ? "bg-card" : "bg-sunken/30"}>
                        <td className="px-4 py-2 text-foreground font-medium border-b border-[hsl(var(--border-hairline))]">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-accent text-accent-foreground mr-1.5">
                            C{String(b.ghg_category_id ?? 0).padStart(2, "0")}
                          </span>
                          {b.ghg_category_name ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground border-b border-[hsl(var(--border-hairline))]">{b.entry_type ?? "—"}</td>
                        <td className="px-4 py-2 text-muted-foreground border-b border-[hsl(var(--border-hairline))]">{b.reporting_year ?? "—"}</td>
                        <td className="px-4 py-2 text-muted-foreground border-b border-[hsl(var(--border-hairline))]">{b.reporting_month ? MONTH_NAMES[(b.reporting_month - 1) % 12] : "Annual"}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground border-b border-[hsl(var(--border-hairline))]">{b.valid_rows ?? b.total_rows ?? "—"}</td>
                        <td className="px-4 py-2 text-right font-bold text-accent-foreground border-b border-[hsl(var(--border-hairline))] font-mono">
                          {(b.total_emissions != null) ? Number(b.total_emissions).toLocaleString(undefined, { maximumFractionDigits: 4 }) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-accent/60">
                      <td colSpan={5} className="px-4 py-2.5 text-right text-[12px] font-bold text-accent-foreground border-t border-border">Total Scope 3</td>
                      <td className="px-4 py-2.5 text-right text-[13px] font-bold text-accent-foreground border-t border-border font-mono">
                        {scope3TotalEmissions.toLocaleString(undefined, { maximumFractionDigits: 4 })} tCO₂e
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}

/** Borderless tonal chart panel — reduces hard white card outlines */
function AnalyticsPanel({
  title,
  actions,
  children,
  focused,
  onToggleFocus,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
  focused?: boolean;
  onToggleFocus?: () => void;
}) {
  return (
    <div className={cn("rounded-md bg-sunken/35 overflow-hidden", focused && "ring-1 ring-primary/25")}>
      <div className="px-4 py-2.5 flex items-center justify-between gap-2">
        <h3 className="section-title">{title}</h3>
        <div className="flex items-center gap-1 shrink-0">
          {actions}
          {onToggleFocus && (
            <button
              type="button"
              title={focused ? "Show all charts" : "Expand chart full width"}
              onClick={onToggleFocus}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-sunken hover:text-foreground"
            >
              {focused ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          )}
        </div>
      </div>
      <div className={cn("px-4 pb-4", focused && "min-h-[320px]")}>{children}</div>
    </div>
  );
}
