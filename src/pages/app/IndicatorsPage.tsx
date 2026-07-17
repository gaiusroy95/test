import { useEffect, useState, useCallback, useMemo } from "react";
import { tenantApi } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { getModuleIcon } from "@/lib/constants";
import { useModulesStore } from "@/store/modules";
import { PageShell } from "@/components/shared/PageShell";
import { LoadingSkeleton, EmptyState } from "@/components/shared/PageComponents";
import { FormDialog, type FormField } from "@/components/shared/FormDialog";
import { useIsSupportSession } from "@/components/shared/WriteOnly";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus, FolderTree, Lock, Pencil, ChevronDown, ChevronRight, BarChart3 } from "lucide-react";
import type { Indicator, KPI } from "@/types";
import { getApiError, cn } from "@/lib/utils";

export default function IndicatorsPage() {
  const { user } = useAuthStore();
  const modules = useModulesStore((s) => s.modules);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [metrics, setMetrics] = useState<KPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [editIndicator, setEditIndicator] = useState<Indicator | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const isSupport = useIsSupportSession();
  const isAdmin = user?.role === "COMPANY_ADMIN" && !isSupport;

  const fetch = useCallback(async () => {
    setLoading(true);
    const params: Record<string, any> = {};
    if (moduleFilter) params.module_id = moduleFilter;

    const [indResult, metResult] = await Promise.allSettled([
      tenantApi.listIndicators(params),
      tenantApi.listKPIs({ size: 500 }),
    ]);

    if (indResult.status === "fulfilled") {
      const d = indResult.value.data;
      setIndicators(Array.isArray(d) ? d : d?.items || []);
    } else {
      toast.error(getApiError(indResult.reason, "Failed to load indicators"));
    }

    if (metResult.status === "fulfilled") {
      const d = metResult.value.data;
      setMetrics(Array.isArray(d) ? d : d?.items || []);
    }

    setLoading(false);
  }, [moduleFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  const handleCreate = async (formData: Record<string, any>) => {
    setActionLoading(true);
    try {
      const { show_when_indicator_id, show_when_equals, ...rest } = formData;
      const resolvedId = show_when_indicator_id === "__none__" ? "" : show_when_indicator_id;
      const show_when = resolvedId
        ? { indicator_id: Number(resolvedId), equals: show_when_equals ?? "" }
        : null;
      await tenantApi.createIndicator({ ...rest, show_when });
      toast.success("Indicator created");
      setCreateOpen(false);
      fetch();
    } catch (err: any) { toast.error(getApiError(err, "Failed to create indicator")); }
    finally { setActionLoading(false); }
  };

  const handleEdit = async (formData: Record<string, any>) => {
    if (!editIndicator) return;
    setActionLoading(true);
    try {
      const { show_when_indicator_id, show_when_equals, ...rest } = formData;
      const resolvedId = show_when_indicator_id === "__none__" ? "" : show_when_indicator_id;
      const payload = {
        ...rest,
        show_when: resolvedId
          ? { indicator_id: Number(resolvedId), equals: show_when_equals ?? "" }
          : {},
      };
      await tenantApi.updateIndicator(editIndicator.indicator_id, payload);
      toast.success("Indicator updated");
      setEditIndicator(null);
      fetch();
    } catch (err: any) { toast.error(getApiError(err, "Failed to update")); }
    finally { setActionLoading(false); }
  };

  const INPUT_TYPE_OPTIONS = [
    { value: "numeric", label: "Numeric — quantity input" },
    { value: "boolean", label: "Boolean — Yes / No" },
    { value: "text",    label: "Text — free-text answer" },
  ];

  const showWhenOptions = [
    { value: "__none__", label: "Always show" },
    ...indicators
      .filter((i) => i.input_type === "boolean" || i.input_type === "text")
      .map((i) => ({ value: i.indicator_id, label: i.indicator_name })),
  ];

  const createFields: FormField[] = [
    { key: "module_id",             label: "Module",           type: "select",   required: true, options: modules.map((m) => ({ value: m.module_id, label: m.module_name })) },
    { key: "indicator_name",        label: "Indicator Name",   required: true,   placeholder: "e.g., Solar Energy, Process Emissions" },
    { key: "description",           label: "Help Text",        type: "textarea", placeholder: "Explanation shown to the user when filling this indicator" },
    { key: "input_type",            label: "Input Type",       type: "select",   defaultValue: "numeric", options: INPUT_TYPE_OPTIONS },
    { key: "unit",                  label: "Unit of Measure",  placeholder: "e.g., kWh, m³, MT (leave blank for boolean/text)" },
    { key: "show_when_indicator_id", label: "Depends on", type: "select", options: showWhenOptions, placeholder: "Always show", helpText: "Optional. Show this indicator only when another answer matches." },
    { key: "show_when_equals",      label: "Equals", placeholder: "e.g. Y or N", helpText: "Value that must match on the selected indicator." },
    { key: "display_order",         label: "Display Order",    type: "number",   defaultValue: 1, placeholder: "1" },
  ];

  const editFields: FormField[] = (editIndicator ? [
    { key: "indicator_name", label: "Indicator Name", required: true },
    { key: "description",    label: "Help Text",      type: "textarea", placeholder: "Explanation shown to the user" },
    { key: "input_type",     label: "Input Type",     type: "select",   options: INPUT_TYPE_OPTIONS },
    { key: "unit",           label: "Unit of Measure", placeholder: "e.g., kWh, m³, MT" },
    { key: "show_when_indicator_id", label: "Depends on", type: "select", options: [
      { value: "__none__", label: "Always show" },
      ...indicators
        .filter((i) => (i.input_type === "boolean" || i.input_type === "text") && i.indicator_id !== editIndicator.indicator_id)
        .map((i) => ({ value: i.indicator_id, label: i.indicator_name })),
    ], placeholder: "Always show", helpText: "Optional. Show this indicator only when another answer matches." },
    { key: "show_when_equals", label: "Equals", placeholder: "e.g. Y or N", helpText: "Value that must match on the selected indicator." },
    { key: "display_order",  label: "Display Order",  type: "number" },
  ] : []) as FormField[];

  const emissionsModId = modules.find(m => m.key === "emissions")?.module_id;

  const moduleOrder = useMemo(
    () => new Map(modules.map((m, idx) => [m.module_id, idx])),
    [modules],
  );

  const flatIndicators = useMemo(() => {
    let list = [...indicators];
    if (moduleFilter) list = list.filter((c) => c.module_id === moduleFilter);
    list.sort((a, b) => {
      const mo =
        (moduleOrder.get(a.module_id) ?? 0) - (moduleOrder.get(b.module_id) ?? 0);
      if (mo !== 0) return mo;
      return a.display_order - b.display_order;
    });
    return list;
  }, [indicators, moduleFilter, moduleOrder]);

  const unassignedKpis = useMemo(() => {
    let list = metrics.filter((m) => !m.indicator_id);
    if (moduleFilter) list = list.filter((m) => m.module_id === moduleFilter);
    return list;
  }, [metrics, moduleFilter]);

  // Detect GHG scope number from an indicator's name (for cross-module linking)
  const detectScope = (name: string): number | null => {
    const n = name.toLowerCase();
    if (n.includes("scope 1") || n.includes("direct")) return 1;
    if (n.includes("scope 2") || n.includes("indirect")) return 2;
    if (n.includes("scope 3") || n.includes("value chain")) return 3;
    return null;
  };

  // For Emission indicators: show KPIs by indicator_id PLUS cross-module KPIs linked via scope_number
  const getKpisForIndicator = (indicator: Indicator): KPI[] => {
    const byIndicator = metrics.filter((m) => m.indicator_id === indicator.indicator_id);
    if (indicator.module_id !== emissionsModId) return byIndicator; // Only Emissions needs cross-module linking
    const scope = detectScope(indicator.indicator_name);
    if (!scope) return byIndicator;
    // Include KPIs from other modules that have this scope assigned
    const crossModule = metrics.filter(
      (m) => m.scope_number === scope && m.module_id !== emissionsModId && m.indicator_id !== indicator.indicator_id
    );
    const seen = new Set(byIndicator.map((m) => m.kpi_id));
    return [...byIndicator, ...crossModule.filter((m) => !seen.has(m.kpi_id))];
  };

  const scopeLabel: Record<number, string> = { 1: "Scope 1", 2: "Scope 2", 3: "Scope 3" };
  const energyLabel: Record<string, string> = { RENEWABLE: "Renewable", NON_RENEWABLE: "Non-Renewable", NOT_APPLICABLE: "N/A" };

  const moduleTabs = (
    <div className="flex border-b border-border -mb-px">
      <button onClick={() => setModuleFilter(null)}
        className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${!moduleFilter ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground/90 hover:border-border"}`}>
        All
      </button>
      {modules.map((m) => {
        const Icon = getModuleIcon(m.icon_name);
        return (
          <button key={m.module_id} onClick={() => setModuleFilter(m.module_id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${moduleFilter === m.module_id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground/90 hover:border-border"}`}>
            <Icon size={14} style={{ color: moduleFilter === m.module_id ? undefined : m.color }} /> {m.module_name}
          </button>
        );
      })}
    </div>
  );

  return (
    <PageShell
      title="Indicators"
      description="System indicators are read-only. Custom indicators can be added by admins."
      breadcrumb={[{ label: "Company Portal", href: "/app" }, { label: "Indicators" }]}
      toolbar={moduleTabs}
      actions={isAdmin ? (
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> Add Custom Indicator
        </Button>
      ) : undefined}
    >

      {loading ? <LoadingSkeleton rows={8} cols={4} /> : indicators.length === 0 ? (
        <div className="surface-elevated overflow-hidden">
          <EmptyState icon={FolderTree} title="No indicators found" description="Indicators are pre-loaded by the platform. Custom indicators can be added by admins." />
        </div>
      ) : (
        <div className="surface-elevated overflow-hidden">
          {flatIndicators.map((indicator, rowIndex) => {
            const kpis = getKpisForIndicator(indicator);
            const isExpanded = expanded.has(indicator.indicator_id);
            const mod = modules.find((m) => m.module_id === indicator.module_id);
            const rowTone = rowIndex % 2 === 0 ? "tone-a" : "tone-b";

            return (
              <div
                key={indicator.indicator_id}
                className={cn("border-b border-[hsl(var(--border-hairline))] last:border-b-0", rowTone)}
              >
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    <button
                      type="button"
                      onClick={() => toggleExpand(indicator.indicator_id)}
                      className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>
                    {!moduleFilter && mod && (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                        style={{ background: mod.bg_color, color: mod.color }}
                      >
                        {mod.module_name}
                      </span>
                    )}
                    <span className="text-[13px] font-semibold text-foreground">{indicator.indicator_name}</span>
                    {indicator.is_system ? (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-black/[0.05] px-2 py-0.5 rounded-full">
                        <Lock size={10} /> System
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold text-primary bg-info-tint px-2 py-0.5 rounded-full">Custom</span>
                    )}
                    {indicator.input_type && indicator.input_type !== "numeric" && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${indicator.input_type === "boolean" ? "bg-accent text-accent-foreground" : "bg-warn-tint text-warn"}`}>
                        {indicator.input_type === "boolean" ? "Yes/No" : "Text"}
                      </span>
                    )}
                    {indicator.unit && (
                      <span className="text-[11px] text-muted-foreground font-mono">{indicator.unit}</span>
                    )}
                    <span className="text-[11px] text-muted-foreground">{kpis.length} KPI{kpis.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] text-muted-foreground hidden sm:inline">Order: {indicator.display_order}</span>
                    {isAdmin && !indicator.is_system && (
                      <button type="button" onClick={() => setEditIndicator(indicator)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                        <Pencil size={13} />
                      </button>
                    )}
                    {indicator.is_system && isAdmin && (
                      <span className="text-[10px] text-muted-foreground italic">Read-only</span>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-[hsl(var(--border-hairline))]/80 px-4 pb-2 pl-11">
                    {kpis.length === 0 ? (
                      <div className="py-2 text-[12px] text-muted-foreground flex items-center gap-2">
                        <BarChart3 size={13} className="text-muted-foreground/40" /> No KPIs assigned to this indicator yet
                      </div>
                    ) : (
                      kpis.map((kpi) => {
                        const isCrossModule = kpi.module_id !== indicator.module_id;
                        return (
                          <div key={kpi.kpi_id} className="flex items-center gap-3 py-1.5 border-t border-[hsl(var(--border-hairline))]/50 first:border-t-0">
                            <BarChart3 size={13} className="text-muted-foreground/40 flex-shrink-0" />
                            <span className="text-[13px] font-medium text-foreground">{kpi.kpi_name}</span>
                            <span className="text-[11px] text-muted-foreground font-mono">{isCrossModule ? "tCO₂e" : kpi.unit}</span>
                            {kpi.energy_type && kpi.energy_type !== "NOT_APPLICABLE" && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-warn-tint text-warn">{energyLabel[kpi.energy_type]}</span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {unassignedKpis.length > 0 && (
            <div className="border-t border-dashed border-border bg-sunken/30">
              <div className="flex items-center gap-2 px-4 py-2">
                <BarChart3 size={13} className="text-muted-foreground" />
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Unassigned KPIs ({unassignedKpis.length})
                </span>
                <span className="text-[10px] text-muted-foreground italic hidden sm:inline">— not linked to any indicator. Edit in KPI Setup to assign.</span>
              </div>
              {unassignedKpis.map((kpi, idx) => {
                const kpiMod = modules.find((x) => x.module_id === kpi.module_id);
                const rowTone = idx % 2 === 0 ? "tone-a" : "tone-b";
                return (
                  <div
                    key={kpi.kpi_id}
                    className={cn("flex items-center gap-3 px-4 py-2 border-t border-[hsl(var(--border-hairline))]/60", rowTone)}
                  >
                    <BarChart3 size={13} className="text-muted-foreground/40 flex-shrink-0" />
                    {!moduleFilter && kpiMod && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: kpiMod.bg_color, color: kpiMod.color }}>
                        {kpiMod.module_name}
                      </span>
                    )}
                    <span className="text-[13px] font-medium text-foreground">{kpi.kpi_name}</span>
                    <span className="text-[11px] text-muted-foreground font-mono">{kpi.unit}</span>
                    {kpi.scope_number && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-black/[0.05] text-muted-foreground">{scopeLabel[kpi.scope_number]}</span>
                    )}
                    {kpi.energy_type && kpi.energy_type !== "NOT_APPLICABLE" && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-warn-tint text-warn">{energyLabel[kpi.energy_type]}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <FormDialog open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={handleCreate} title="Add Custom Indicator" description="Create a company-specific indicator under a module" fields={createFields} submitLabel="Create Indicator" loading={actionLoading} />
      <FormDialog open={!!editIndicator} onClose={() => setEditIndicator(null)} onSubmit={handleEdit} title="Edit Indicator" fields={editFields} submitLabel="Save" loading={actionLoading} initialData={editIndicator ? { indicator_name: editIndicator.indicator_name, description: editIndicator.description ?? "", input_type: editIndicator.input_type ?? "numeric", unit: editIndicator.unit ?? "", show_when_indicator_id: editIndicator.show_when?.indicator_id ?? "__none__", show_when_equals: String(editIndicator.show_when?.equals ?? ""), display_order: editIndicator.display_order } : undefined} />
    </PageShell>
  );
}
