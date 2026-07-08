/**
 * Template Catalog — Company Admin browses the platform catalog:
 *   • Indicators Catalog: pull indicator sets (→ KPIs + factors) into the tenant
 *   • Factor Library: browse emission/energy factors published by Platform Owner
 * Pull is idempotent: already-pulled items show a ✓ Pulled badge.
 */

import { useEffect, useMemo, useState } from "react";
import { tenantApi } from "@/api/client";
import { useModulesStore } from "@/store/modules";
import { Breadcrumb, LoadingSkeleton } from "@/components/shared/PageComponents";
import { getModuleIcon } from "@/lib/constants";
import { getApiError } from "@/lib/utils";
import { ChevronDown, ChevronRight, Check, Download, Loader2, BookOpen, FlaskConical, Info } from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  CatalogIndicatorNode,
  CatalogPulledIds,
  CatalogPullResult,
} from "@/types";

type CatalogTab = "indicators" | "factors";

export default function ESGLibraryPage() {
  const modules = useModulesStore((s) => s.modules);
  const loadedMods = useModulesStore((s) => s.loaded);

  const [catalogTab, setCatalogTab]         = useState<CatalogTab>("indicators");
  const [activeModuleId, setActiveModuleId] = useState<number | null>(null);
  const [indicators, setIndicators]         = useState<CatalogIndicatorNode[]>([]);
  const [pulled, setPulled]                 = useState<CatalogPulledIds>({ indicator_ids: [], kpi_ids: [] });
  const [loading, setLoading]               = useState(true);
  const [pulling, setPulling]               = useState(false);
  const [expanded, setExpanded]             = useState<Set<number>>(new Set());
  const [selected, setSelected]             = useState<Set<number>>(new Set());

  // Factor Library tab state
  const [factors, setFactors]               = useState<any[]>([]);
  const [factorsLoading, setFactorsLoading] = useState(false);
  const [factorSearch, setFactorSearch]     = useState("");

  // Pick the first active module once modules load
  useEffect(() => {
    if (loadedMods && activeModuleId === null && modules.length > 0) {
      setActiveModuleId(modules[0].module_id);
    }
  }, [loadedMods, modules, activeModuleId]);

  const refresh = async (moduleId: number) => {
    setLoading(true);
    setSelected(new Set());
    try {
      const [catRes, pulledRes] = await Promise.all([
        tenantApi.browseCatalog(moduleId),
        tenantApi.listPulledCatalog(),
      ]);
      setIndicators(Array.isArray(catRes.data) ? catRes.data : []);
      setPulled(pulledRes.data ?? { indicator_ids: [], kpi_ids: [] });
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to load catalog"));
      setIndicators([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeModuleId !== null) refresh(activeModuleId);
  }, [activeModuleId]);

  // Load factors when the Factor Library tab opens or module changes
  useEffect(() => {
    if (catalogTab !== "factors" || activeModuleId === null) return;
    let cancelled = false;
    (async () => {
      setFactorsLoading(true);
      try {
        const { data } = await tenantApi.browseCatalogFactors(activeModuleId);
        if (!cancelled) setFactors(Array.isArray(data) ? data : []);
      } catch (err: any) {
        if (!cancelled) {
          setFactors([]);
          toast.error(getApiError(err, "Failed to load factor library"));
        }
      } finally {
        if (!cancelled) setFactorsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [catalogTab, activeModuleId]);

  const pulledIndIds = useMemo(() => new Set(pulled.indicator_ids), [pulled]);
  const pulledKpiIds = useMemo(() => new Set(pulled.kpi_ids), [pulled]);

  const pullableIndicators = useMemo(
    () => indicators.filter((i) => !pulledIndIds.has(i.indicator_id)),
    [indicators, pulledIndIds]
  );

  const toggleExpanded = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === pullableIndicators.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pullableIndicators.map((i) => i.indicator_id)));
    }
  };

  const handlePull = async () => {
    if (selected.size === 0) return;
    setPulling(true);
    try {
      const { data } = await tenantApi.pullFromCatalog(Array.from(selected));
      const r = data as CatalogPullResult;
      toast.success(
        `Pulled ${r.indicators_added} indicator${r.indicators_added !== 1 ? "s" : ""}, ${r.kpis_added} KPI${r.kpis_added !== 1 ? "s" : ""}, ${r.factors_added} factor${r.factors_added !== 1 ? "s" : ""}`
      );
      if (activeModuleId !== null) await refresh(activeModuleId);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to pull from catalog"));
    } finally {
      setPulling(false);
    }
  };

  const activeModule = modules.find((m) => m.module_id === activeModuleId);
  const pulledCount = indicators.filter((i) => pulledIndIds.has(i.indicator_id)).length;

  return (
    <div className="p-6 w-full animate-in fade-in duration-500">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <Breadcrumb items={[{ label: "Company Portal", href: "/app" }, { label: "Template Catalog" }]} />
          <div className="flex items-center gap-2 mt-1">
            <h1 className="text-[20px] font-bold text-brand-navy tracking-tight">Template Catalog</h1>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-slate-400 hover:text-brand-accent transition-colors">
                    <Info size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[280px] p-3 text-[12px] leading-relaxed">
                  Browse platform-published templates and factors. Pull indicators into your company — they become editable copies with their KPIs and conversion factors.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-[13px] font-medium text-slate-500 mt-0.5">
            Import system templates to your workspace.
          </p>
        </div>

        {/* Segmented Control for Views */}
        <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200/60 shadow-sm">
          {([
            { key: "indicators", label: "Indicators", icon: BookOpen },
            { key: "factors",    label: "Factors",    icon: FlaskConical },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setCatalogTab(key)}
              className={`
                flex items-center gap-1.5 px-4 py-1.5 rounded-md text-[13px] font-semibold transition-all
                ${catalogTab === key 
                  ? "bg-white text-brand-navy shadow-sm border border-slate-200/50" 
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 border border-transparent"}
              `}
            >
              <Icon size={14} className={catalogTab === key ? "text-brand-accent" : "opacity-70"} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Content Card ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Card Header (Module Tabs + Search/Stats) */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between px-2 pt-2 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-wrap px-2">
            {modules.map((m) => {
              const Icon = getModuleIcon(m.icon_name);
              const active = m.module_id === activeModuleId;
              return (
                <button
                  key={m.module_id}
                  onClick={() => setActiveModuleId(m.module_id)}
                  className={`flex items-center gap-2 px-4 py-3 text-[13px] font-semibold border-b-2 transition-colors ${
                    active
                      ? "border-brand-accent text-brand-navy"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <Icon size={14} className={active ? "text-brand-accent" : ""} /> 
                  {m.module_name}
                </button>
              );
            })}
          </div>

          <div className="px-4 pb-2.5 flex items-center gap-3">
            {catalogTab === "factors" ? (
              <input
                type="text"
                placeholder="Search factor…"
                value={factorSearch}
                onChange={(e) => setFactorSearch(e.target.value)}
                className="w-[180px] px-3 py-1.5 rounded-md border border-slate-200 text-[12px] bg-white outline-none focus:border-brand-accent/60 focus:ring-2 focus:ring-brand-accent/10 transition-all"
              />
            ) : (
              !loading && indicators.length > 0 && (
                <div className="flex items-center gap-2 text-[12px] font-medium text-slate-500 bg-white px-3 py-1.5 rounded-md border border-slate-200 shadow-sm">
                  <span className="text-brand-navy">{indicators.length}</span> indicators
                  <div className="w-px h-3 bg-slate-300 mx-1" />
                  <span className="text-green-600 flex items-center gap-1"><Check size={14}/> {pulledCount} pulled</span>
                </div>
              )
            )}
          </div>
        </div>

        {/* ── Factor Library View ── */}
        {catalogTab === "factors" && (
          <div className="bg-white">
            {factorsLoading ? (
              <div className="p-6"><LoadingSkeleton rows={6} cols={5} /></div>
            ) : factors.length === 0 ? (
              <div className="p-16 text-center">
                <FlaskConical size={32} className="text-slate-300 mx-auto mb-4" />
                <p className="text-[14px] font-medium text-slate-600">
                  No catalog factors for {activeModule?.module_name} yet.
                </p>
                <p className="text-[12px] text-slate-400 mt-1.5 max-w-[300px] mx-auto leading-relaxed">
                  Pull an indicator to bring along its factors, or wait for the platform team to publish more.
                </p>
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-white">
                    {["KPI", "Scope", "Factors", "Validity"].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-slate-400 font-semibold text-[11px] uppercase tracking-[0.05em]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {factors
                    .filter((f) => {
                      if (!factorSearch) return true;
                      const q = factorSearch.toLowerCase();
                      return (f.kpi_name || "").toLowerCase().includes(q)
                          || (f.source   || "").toLowerCase().includes(q);
                    })
                    .map((f) => (
                      <tr key={f.factor_id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="font-semibold text-brand-navy">{f.kpi_name}</div>
                          <div className="text-[11.5px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                            {f.kpi_unit && <span className="bg-slate-100 px-1.5 py-0.5 rounded font-medium">{f.kpi_unit}</span>}
                            <span>{f.source || "System Default"}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          {f.scope_number ? (
                            <span className="text-[11px] font-semibold px-2 py-1 rounded-md bg-sky-50 text-sky-700 border border-sky-100">
                              Scope {f.scope_number}
                            </span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-5 py-3 font-mono text-[12.5px] text-slate-600">
                          {f.energy_factor != null && <div><span className="text-slate-400 text-[10px] uppercase tracking-wider font-sans mr-2">EN</span>{f.energy_factor} {f.energy_factor_uom}</div>}
                          {f.emission_factor != null && <div><span className="text-slate-400 text-[10px] uppercase tracking-wider font-sans mr-2">EM</span>{f.emission_factor} {f.emission_factor_uom}</div>}
                        </td>
                        <td className="px-5 py-3 text-[12px] text-slate-500 font-medium">
                          {f.valid_from || "—"}
                          <span className="mx-1.5 text-slate-300">→</span>
                          {f.valid_to ? f.valid_to : <span className="text-green-600 font-semibold">Current</span>}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Indicators Catalog View ── */}
        {catalogTab === "indicators" && (
          <div className="bg-slate-50/30 p-4">
            {loading ? (
              <div className="bg-white rounded-lg border border-slate-200 p-6"><LoadingSkeleton rows={5} cols={3} /></div>
            ) : indicators.length === 0 ? (
              <div className="bg-white rounded-lg border border-slate-200 p-16 text-center shadow-sm">
                <BookOpen size={32} className="text-slate-300 mx-auto mb-4" />
                <p className="text-[14px] font-medium text-slate-600">
                  No catalog indicators for {activeModule?.module_name} yet.
                </p>
                <p className="text-[12px] text-slate-400 mt-1">The platform team will add them soon.</p>
              </div>
            ) : (
              <>
                {/* Bulk-select bar */}
                {pullableIndicators.length > 0 && (
                  <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-2.5 mb-3 shadow-sm">
                    <label className="flex items-center gap-2.5 text-[13px] font-medium text-brand-navy cursor-pointer hover:text-brand-accent transition-colors">
                      <input
                        type="checkbox"
                        checked={selected.size === pullableIndicators.length && pullableIndicators.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-slate-300 text-brand-accent focus:ring-brand-accent"
                      />
                      Select all {pullableIndicators.length} indicators
                    </label>
                  </div>
                )}

                {/* Indicator list */}
                <div className="space-y-2.5">
                  {indicators.map((ind) => {
                    const isPulled    = pulledIndIds.has(ind.indicator_id);
                    const isExpanded  = expanded.has(ind.indicator_id);
                    const isSelected  = selected.has(ind.indicator_id);
                    const factorTotal = ind.kpis.reduce((s, k) => s + k.factor_count, 0);
                    
                    return (
                      <div
                        key={ind.indicator_id}
                        className={`bg-white border rounded-lg transition-all ${
                          isSelected ? "border-brand-accent shadow-sm ring-1 ring-brand-accent/10" : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                        }`}
                      >
                        <div className="flex items-start gap-3 px-4 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isPulled}
                            onChange={() => toggleSelect(ind.indicator_id)}
                            className="mt-1.5 w-4 h-4 rounded border-slate-300 text-brand-accent focus:ring-brand-accent disabled:opacity-30 cursor-pointer"
                          />
                          <button
                            onClick={() => toggleExpanded(ind.indicator_id)}
                            className="flex-1 flex flex-col sm:flex-row sm:items-start justify-between gap-4 text-left group"
                          >
                            {/* Left Side: Name & Chevron */}
                            <div className="flex items-start gap-2.5 flex-1">
                              <div className="mt-0.5 text-slate-400 group-hover:text-brand-accent transition-colors">
                                {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                              </div>
                              <div>
                                <div className="text-[14px] font-bold text-brand-navy group-hover:text-brand-accent transition-colors">
                                  {ind.indicator_name}
                                </div>
                                {ind.description && (
                                  <p className="text-[12.5px] text-slate-500 mt-1 leading-relaxed max-w-[500px]">
                                    {ind.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            
                            {/* Right Side: Badges */}
                            <div className="flex items-center gap-2 pl-9 sm:pl-0 shrink-0">
                              <span className="text-[11px] font-semibold px-2 py-1 rounded-md bg-slate-50 text-slate-500 border border-slate-100">
                                {ind.kpis.length} KPI{ind.kpis.length !== 1 ? "s" : ""}
                              </span>
                              <span className="text-[11px] font-semibold px-2 py-1 rounded-md bg-slate-50 text-slate-500 border border-slate-100">
                                {factorTotal} Factor{factorTotal !== 1 ? "s" : ""}
                              </span>
                              {isPulled && (
                                <span className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-md bg-green-50 text-green-700 border border-green-200/60 shadow-sm">
                                  <Check size={12} strokeWidth={3} /> Pulled
                                </span>
                              )}
                            </div>
                          </button>
                        </div>

                        {/* Expanded KPIs table */}
                        {isExpanded && (
                          <div className="border-t border-slate-100 bg-slate-50/50 p-4 rounded-b-lg">
                            {ind.kpis.length === 0 ? (
                              <p className="text-[12px] text-slate-500 italic">No KPIs found under this indicator.</p>
                            ) : (
                              <div className="bg-white border border-slate-100 rounded-md overflow-hidden shadow-sm">
                                <table className="w-full text-[12.5px]">
                                  <thead>
                                    <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] uppercase tracking-widest text-slate-400 font-semibold">
                                      <th className="text-left px-4 py-2">KPI Name</th>
                                      <th className="text-left px-4 py-2">Unit</th>
                                      <th className="text-left px-4 py-2">Scope</th>
                                      <th className="text-left px-4 py-2">Factors</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ind.kpis.map((k, idx) => (
                                      <tr key={k.kpi_id} className={idx !== ind.kpis.length - 1 ? "border-b border-slate-50" : ""}>
                                        <td className="px-4 py-2.5 font-medium text-brand-navy">{k.kpi_name}</td>
                                        <td className="px-4 py-2.5 text-slate-500 font-mono text-[11px]">{k.unit || "—"}</td>
                                        <td className="px-4 py-2.5">
                                          {k.scope_number ? (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700">S{k.scope_number}</span>
                                          ) : <span className="text-slate-300">—</span>}
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-500 font-medium">
                                          {k.factor_count > 0 ? k.factor_count : <span className="text-slate-300">—</span>}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Sticky Pull Bar (Glassmorphism) ── */}
      {selected.size > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-30 animate-in slide-in-from-bottom-6 duration-300">
          <div className="flex items-center gap-4 bg-brand-navy/95 backdrop-blur-xl border border-white/10 text-white rounded-full shadow-[0_8px_30px_rgba(15,23,42,0.3)] px-6 py-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-brand-accent/20 flex items-center justify-center text-[11px] font-bold text-brand-accent">
                {selected.size}
              </div>
              <span className="text-[13.5px] font-medium text-slate-100">
                indicator{selected.size !== 1 ? "s" : ""} selected
              </span>
            </div>
            
            <div className="w-px h-4 bg-slate-700 mx-1" />
            
            <button
              onClick={() => setSelected(new Set())}
              disabled={pulling}
              className="text-[12.5px] font-medium text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handlePull}
              disabled={pulling}
              className="flex items-center gap-2 bg-gradient-to-r from-brand-accent to-brand-teal hover:brightness-110 text-white text-[13px] font-bold px-5 py-2 rounded-full transition-all disabled:opacity-60 shadow-md shadow-brand-accent/20"
            >
              {pulling ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {pulling ? "Pulling…" : "Pull Templates"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
