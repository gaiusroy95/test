/**
 * Template Catalog — Company Admin browses the platform catalog:
 *   • Indicators Catalog: pull indicator sets (→ KPIs + factors) into the tenant
 *   • Factor Library: browse emission/energy factors published by Platform Owner
 * Pull is idempotent: already-pulled items show a ✓ Pulled badge.
 */

import { useEffect, useMemo, useState } from "react";
import { tenantApi } from "@/api/client";
import { useModulesStore } from "@/store/modules";
import { PageShell } from "@/components/shared/PageShell";
import { LoadingSkeleton } from "@/components/shared/PageComponents";
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
    <PageShell
      title="Template Catalog"
      description="Import system templates to your workspace"
      breadcrumb={[{ label: "Company Portal", href: "/app" }, { label: "Template Catalog" }]}
      titleAddon={
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="About Template Catalog">
                <Info size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[280px] p-3 text-ui leading-relaxed">
              Browse platform-published templates and factors. Pull indicators into your company — they become editable copies with their KPIs and conversion factors.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      }
      actions={
        <div className="inline-flex items-center p-0.5 bg-sunken rounded-md border border-border">
          {([
            { key: "indicators", label: "Indicators", icon: BookOpen },
            { key: "factors",    label: "Factors",    icon: FlaskConical },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setCatalogTab(key)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-ui font-semibold transition-all
                ${catalogTab === key
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground border border-transparent"}
              `}
            >
              <Icon size={14} className={catalogTab === key ? "text-primary" : "opacity-70"} />
              {label}
            </button>
          ))}
        </div>
      }
    >
      <div className="surface overflow-hidden">
        
        {/* Card Header (Module Tabs + Search/Stats) */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between px-2 pt-1 border-b border-[hsl(var(--border-hairline))] bg-sunken/50">
          <div className="flex flex-wrap px-2">
            {modules.map((m) => {
              const Icon = getModuleIcon(m.icon_name);
              const active = m.module_id === activeModuleId;
              return (
                <button
                  key={m.module_id}
                  onClick={() => setActiveModuleId(m.module_id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-ui font-semibold border-b-2 transition-colors ${
                    active
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  }`}
                >
                  <Icon size={14} className={active ? "text-primary" : ""} />
                  {m.module_name}
                </button>
              );
            })}
          </div>

          <div className="px-3 pb-2 flex items-center gap-3">
            {catalogTab === "factors" ? (
              <input
                type="text"
                placeholder="Search factor…"
                value={factorSearch}
                onChange={(e) => setFactorSearch(e.target.value)}
                className="w-[180px] px-3 py-1.5 rounded-md border border-border text-[12px] bg-card outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/10 transition-all"
              />
            ) : (
              !loading && indicators.length > 0 && (
                <div className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground bg-card px-3 py-1.5 rounded-md border border-border shadow-sm">
                  <span className="text-foreground">{indicators.length}</span> indicators
                  <div className="w-px h-3 bg-border mx-1" />
                  <span className="text-green-600 flex items-center gap-1"><Check size={14}/> {pulledCount} pulled</span>
                </div>
              )
            )}
          </div>
        </div>

        {/* ── Factor Library View ── */}
        {catalogTab === "factors" && (
          <div className="bg-card">
            {factorsLoading ? (
              <div className="p-6"><LoadingSkeleton rows={6} cols={5} /></div>
            ) : factors.length === 0 ? (
              <div className="p-16 text-center">
                <FlaskConical size={32} className="text-muted-foreground/40 mx-auto mb-4" />
                <p className="text-[14px] font-medium text-muted-foreground">
                  No catalog factors for {activeModule?.module_name} yet.
                </p>
                <p className="text-[12px] text-muted-foreground mt-1.5 max-w-[300px] mx-auto leading-relaxed">
                  Pull an indicator to bring along its factors, or wait for the platform team to publish more.
                </p>
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[hsl(var(--border-hairline))] bg-card">
                    {["KPI", "Scope", "Factors", "Validity"].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-muted-foreground font-semibold text-[11px] uppercase tracking-[0.05em]">{h}</th>
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
                      <tr key={f.factor_id} className="border-b border-[hsl(var(--border-hairline))] hover:bg-sunken/50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="font-semibold text-foreground">{f.kpi_name}</div>
                          <div className="text-[11.5px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                            {f.kpi_unit && <span className="bg-sunken px-1.5 py-0.5 rounded font-medium">{f.kpi_unit}</span>}
                            <span>{f.source || "System Default"}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          {f.scope_number ? (
                            <span className="text-[11px] font-semibold px-2 py-1 rounded-md bg-info-tint text-info border border-sky-100">
                              Scope {f.scope_number}
                            </span>
                          ) : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-5 py-3 font-mono text-[12.5px] text-muted-foreground">
                          {f.energy_factor != null && <div><span className="text-muted-foreground text-[10px] uppercase tracking-wider font-sans mr-2">EN</span>{f.energy_factor} {f.energy_factor_uom}</div>}
                          {f.emission_factor != null && <div><span className="text-muted-foreground text-[10px] uppercase tracking-wider font-sans mr-2">EM</span>{f.emission_factor} {f.emission_factor_uom}</div>}
                        </td>
                        <td className="px-5 py-3 text-[12px] text-muted-foreground font-medium">
                          {f.valid_from || "—"}
                          <span className="mx-1.5 text-muted-foreground/40">→</span>
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
          <div className="bg-sunken/30 p-3">
            {loading ? (
              <div className="bg-card rounded-lg border border-border p-6"><LoadingSkeleton rows={5} cols={3} /></div>
            ) : indicators.length === 0 ? (
              <div className="bg-card rounded-lg border border-border p-16 text-center shadow-sm">
                <BookOpen size={32} className="text-muted-foreground/40 mx-auto mb-4" />
                <p className="text-[14px] font-medium text-muted-foreground">
                  No catalog indicators for {activeModule?.module_name} yet.
                </p>
                <p className="text-[12px] text-muted-foreground mt-1">The platform team will add them soon.</p>
              </div>
            ) : (
              <>
                {/* Bulk-select bar */}
                {pullableIndicators.length > 0 && (
                  <div className="flex items-center justify-between bg-card border border-border rounded-sm px-3 py-2 mb-2">
                    <label className="flex items-center gap-2 text-ui font-medium text-foreground cursor-pointer hover:text-primary transition-colors">
                      <input
                        type="checkbox"
                        checked={selected.size === pullableIndicators.length && pullableIndicators.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                      Select all {pullableIndicators.length} indicators
                    </label>
                  </div>
                )}

                {/* Indicator list */}
                <div className="space-y-1">
                  {indicators.map((ind) => {
                    const isPulled    = pulledIndIds.has(ind.indicator_id);
                    const isExpanded  = expanded.has(ind.indicator_id);
                    const isSelected  = selected.has(ind.indicator_id);
                    const factorTotal = ind.kpis.reduce((s, k) => s + k.factor_count, 0);
                    
                    return (
                      <div
                        key={ind.indicator_id}
                        className={`bg-card border rounded-sm transition-all ${
                          isSelected ? "border-primary shadow-sm ring-1 ring-primary/10" : "border-border hover:border-border hover:shadow-sm"
                        }`}
                      >
                        <div className="flex items-start gap-2.5 px-3 py-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={isPulled}
                            onChange={() => toggleSelect(ind.indicator_id)}
                            className="mt-1 w-4 h-4 rounded border-border text-primary focus:ring-primary disabled:opacity-30 cursor-pointer"
                          />
                          <button
                            onClick={() => toggleExpanded(ind.indicator_id)}
                            className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left group min-h-[var(--density-row)]"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <div className="text-muted-foreground group-hover:text-primary transition-colors shrink-0">
                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              </div>
                              <div className="min-w-0">
                                <div className="text-ui font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                                  {ind.indicator_name}
                                </div>
                                {ind.description && (
                                  <p className="text-label text-muted-foreground mt-0.5 line-clamp-1">
                                    {ind.description}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 pl-7 sm:pl-0 shrink-0">
                              <span className="text-2xs font-semibold px-1.5 py-0.5 rounded-sm bg-sunken text-muted-foreground border border-border">
                                {ind.kpis.length} KPI{ind.kpis.length !== 1 ? "s" : ""}
                              </span>
                              <span className="text-2xs font-semibold px-1.5 py-0.5 rounded-sm bg-sunken text-muted-foreground border border-border">
                                {factorTotal} Factor{factorTotal !== 1 ? "s" : ""}
                              </span>
                              {isPulled && (
                                <span className="flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-sm bg-ok-tint text-ok border border-ok/20">
                                  <Check size={11} strokeWidth={3} /> Pulled
                                </span>
                              )}
                            </div>
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-[hsl(var(--border-hairline))] bg-sunken/50 p-2 rounded-b-sm">
                            {ind.kpis.length === 0 ? (
                              <p className="text-[12px] text-muted-foreground italic">No KPIs found under this indicator.</p>
                            ) : (
                              <div className="bg-card border border-border rounded-sm overflow-hidden">
                                <table className="w-full text-ui">
                                  <thead>
                                    <tr className="bg-sunken border-b border-[hsl(var(--border-hairline))] text-2xs uppercase tracking-wider text-muted-foreground font-semibold">
                                      <th className="text-left px-3 py-1.5">KPI Name</th>
                                      <th className="text-left px-3 py-1.5">Unit</th>
                                      <th className="text-left px-3 py-1.5">Scope</th>
                                      <th className="text-left px-3 py-1.5">Factors</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {ind.kpis.map((k, idx) => (
                                      <tr key={k.kpi_id} className={idx !== ind.kpis.length - 1 ? "border-b border-[hsl(var(--border-hairline))]" : ""}>
                                        <td className="px-3 py-1.5 font-medium text-foreground">{k.kpi_name}</td>
                                        <td className="px-3 py-1.5 text-muted-foreground font-mono text-label">{k.unit || "—"}</td>
                                        <td className="px-3 py-1.5">
                                          {k.scope_number ? (
                                            <span className="text-2xs font-bold px-1.5 py-0.5 rounded-sm bg-info-tint text-info">S{k.scope_number}</span>
                                          ) : <span className="text-muted-foreground/40">—</span>}
                                        </td>
                                        <td className="px-3 py-1.5 text-muted-foreground font-medium">
                                          {k.factor_count > 0 ? k.factor_count : <span className="text-muted-foreground/40">—</span>}
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
          <div className="flex items-center gap-4 bg-foreground/95 backdrop-blur-xl border border-white/10 text-white rounded-full shadow-[0_8px_30px_rgba(15,23,42,0.3)] px-6 py-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[11px] font-bold text-primary">
                {selected.size}
              </div>
              <span className="text-[13.5px] font-medium text-muted-foreground">
                indicator{selected.size !== 1 ? "s" : ""} selected
              </span>
            </div>
            
            <div className="w-px h-4 bg-border mx-1" />
            
            <button
              onClick={() => setSelected(new Set())}
              disabled={pulling}
              className="text-[12.5px] font-medium text-muted-foreground hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handlePull}
              disabled={pulling}
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-teal hover:brightness-110 text-white text-[13px] font-bold px-5 py-2 rounded-full transition-all disabled:opacity-60 shadow-md shadow-primary/20"
            >
              {pulling ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {pulling ? "Pulling…" : "Pull Templates"}
            </button>
          </div>
        </div>
      )}
    </PageShell>
  );
}
