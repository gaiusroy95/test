import { useEffect, useMemo, useState } from "react";
import { Target, Plus, Pencil, Trash2, TrendingDown, TrendingUp, Activity, CheckCircle2, AlertCircle, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { tenantApi } from "@/api/client";
import { getApiError, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/shared/PageShell";
import { useIsSupportSession } from "@/components/shared/WriteOnly";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { useAuthStore } from "@/store/auth";
import { useModulesStore } from "@/store/modules";
import type {
  KPITarget, TargetProgress, TargetProgressSummary, TargetType, TargetAggField,
  KPI, Indicator, FinancialYear,
} from "@/types";

type Tab = "progress" | "manage";

const AGG_FIELD_LABEL: Record<TargetAggField, string> = {
  quantity:       "Quantity",
  mj_value:       "Energy (MJ)",
  emission_value: "Emissions (tCO₂e)",
};

export default function TargetsPage() {
  const user = useAuthStore((s) => s.user);
  const isSupport = useIsSupportSession();
  const isAdmin = user?.role === "COMPANY_ADMIN" && !isSupport;
  const modules = useModulesStore((s) => s.modules);

  const [tab, setTab] = useState<Tab>("progress");

  // Progress state
  const [progress, setProgress] = useState<TargetProgressSummary | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);

  // Manage state
  const [targets, setTargets] = useState<KPITarget[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<KPITarget | null>(null);

  // Reference data for form
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [fys, setFys] = useState<FinancialYear[]>([]);

  const fetchProgress = async () => {
    setLoadingProgress(true);
    try {
      const { data } = await tenantApi.targetProgress();
      setProgress(data);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to load target progress"));
    } finally {
      setLoadingProgress(false);
    }
  };

  const fetchTargets = async () => {
    setLoadingTargets(true);
    try {
      const { data } = await tenantApi.listTargets();
      setTargets(data);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to load targets"));
    } finally {
      setLoadingTargets(false);
    }
  };

  const fetchReferenceData = async () => {
    try {
      const [kRes, iRes, fRes] = await Promise.all([
        tenantApi.listKPIs({ size: 500 }),
        tenantApi.listIndicators(),
        tenantApi.listAvailableFYs(),
      ]);
      setKpis(kRes.data?.items ?? kRes.data ?? []);
      setIndicators(iRes.data);
      setFys(fRes.data);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to load reference data"));
    }
  };

  useEffect(() => { fetchProgress(); }, []);
  useEffect(() => { if (tab === "manage") { fetchTargets(); fetchReferenceData(); } }, [tab]);

  const handleDelete = async (t: KPITarget) => {
    if (!confirm(`Delete target for ${t.kpi_name || t.indicator_name}?`)) return;
    try {
      await tenantApi.deleteTarget(t.target_id);
      toast.success("Target deleted");
      fetchTargets();
      fetchProgress();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to delete target"));
    }
  };

  const tabBar = (
    <div className="flex items-end justify-between border-b border-border -mb-px">
      <div className="flex">
        {([
          { key: "progress" as Tab, label: "Progress", icon: Activity },
          { key: "manage" as Tab,   label: "Manage Targets", icon: Target },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors
              ${tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground/90 hover:border-border"}`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <PageShell
      title="Targets & Goals"
      description="Set reduction / improvement targets and track progress against APPROVED data"
      breadcrumb={[{ label: "Home", href: "/app" }, { label: "Targets" }]}
      toolbar={tabBar}
      actions={isAdmin && tab === "manage" ? (
        <Button size="sm" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus size={14} /> Add Target
        </Button>
      ) : undefined}
    >

      {tab === "progress" && <ProgressTab loading={loadingProgress} data={progress} />}
      {tab === "manage" && (
        <ManageTab
          targets={targets}
          loading={loadingTargets}
          isAdmin={isAdmin}
          onEdit={(t) => { setEditing(t); setShowForm(true); }}
          onDelete={handleDelete}
        />
      )}

      {showForm && (
        <TargetForm
          open={showForm}
          editing={editing}
          modules={modules}
          kpis={kpis}
          indicators={indicators}
          fys={fys}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); fetchTargets(); fetchProgress(); }}
        />
      )}
    </PageShell>
  );
}


/* ══════════════════════════════════════════════════════════════════════════
   PROGRESS TAB
   ══════════════════════════════════════════════════════════════════════════ */

function ProgressTab({ loading, data }: { loading: boolean; data: TargetProgressSummary | null }) {
  if (loading) {
    return <div className="animate-pulse space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-sunken rounded" />)}</div>;
  }
  if (!data || data.total_targets === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <Target size={32} className="mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-[13px] text-muted-foreground">No targets defined yet. Add targets on the Manage tab.</p>
      </div>
    );
  }

  const stats = [
    { label: "Active Targets", value: data.total_targets, icon: Target, color: "text-info bg-info-tint" },
    { label: "On Track",       value: data.on_track_count, icon: CheckCircle2, color: "text-ok bg-ok-tint" },
    { label: "At Risk",        value: data.at_risk_count, icon: AlertCircle, color: data.at_risk_count > 0 ? "text-warn bg-warn-tint" : "text-muted-foreground bg-sunken" },
    { label: "Current FY",     value: data.current_fy_label || "—", icon: BarChart3, color: "text-accent-foreground bg-accent" },
  ];

  // Chart data: actual vs target per item
  const chartData = data.items.map((it) => ({
    name: it.label.length > 18 ? it.label.slice(0, 16) + "…" : it.label,
    baseline: it.baseline_value,
    current:  it.current_value,
    target:   it.target_value,
    onTrack:  it.on_track,
  }));

  return (
    <div>
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {stats.map((c, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${c.color.split(" ")[1]}`}>
                <c.icon size={18} className={c.color.split(" ")[0]} />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground font-medium">{c.label}</p>
                <p className="text-[18px] font-bold text-foreground">{c.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Comparison chart */}
      {chartData.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4 mb-6">
          <h3 className="text-[13px] font-semibold text-foreground mb-3">Baseline vs Current vs Target</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="baseline" fill="#94a3b8" name="Baseline" radius={[3, 3, 0, 0]} />
              <Bar dataKey="current"  name="Current">
                {chartData.map((d, i) => <Cell key={i} fill={d.onTrack ? "#10b981" : "#f59e0b"} />)}
              </Bar>
              <Bar dataKey="target"   fill="#0ea5e9" name="Target"   radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Detail rows */}
      <div className="rounded-lg border border-border bg-card">
        <div className="px-4 py-3 border-b border-[hsl(var(--border-hairline))]">
          <h3 className="text-[13px] font-semibold text-foreground">Progress Detail</h3>
        </div>
        <div className="divide-y divide-border/60">
          {data.items.map((it) => <ProgressRow key={it.target_id} item={it} />)}
        </div>
      </div>
    </div>
  );
}

function ProgressRow({ item }: { item: TargetProgress }) {
  const pct = Math.max(0, Math.min(100, item.progress_pct));
  const TrendIcon = item.direction === "DECREASE" ? TrendingDown : TrendingUp;
  const goodDelta = (item.direction === "DECREASE" && item.delta_from_baseline < 0) ||
                    (item.direction === "INCREASE" && item.delta_from_baseline > 0);

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.module_color }}
            />
            <span className="text-[13px] font-semibold text-foreground truncate">{item.label}</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sunken text-muted-foreground">
              {item.module_name}
            </span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sunken text-muted-foreground">
              {item.target_type}
            </span>
            {item.on_track ? (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-ok-tint text-ok">ON TRACK</span>
            ) : (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-warn-tint text-warn">AT RISK</span>
            )}
          </div>

          <div className="flex items-center gap-5 text-[11px] text-muted-foreground mb-2">
            <span>Baseline <span className="text-foreground/90 font-mono">{item.baseline_value.toLocaleString()}</span> {item.unit} ({item.baseline_fy_label})</span>
            <span>Current <span className="text-foreground/90 font-mono">{item.current_value.toLocaleString()}</span> {item.unit} ({item.current_fy_label})</span>
            <span>Target <span className="text-foreground/90 font-mono">{item.target_value.toLocaleString()}</span> {item.unit} ({item.target_fy_label})</span>
            <span className={`flex items-center gap-1 ${goodDelta ? "text-ok" : "text-warn"}`}>
              <TrendIcon size={12} /> {item.delta_pct > 0 ? "+" : ""}{item.delta_pct.toFixed(1)}% vs baseline
            </span>
          </div>

          <div className="h-2 bg-sunken rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${item.on_track ? "bg-ok" : "bg-warn"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="text-right flex-shrink-0 w-24">
          <p className="text-[20px] font-bold text-foreground leading-tight">{item.progress_pct.toFixed(0)}%</p>
          <p className="text-[10px] text-muted-foreground">progress</p>
        </div>
      </div>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════════════
   MANAGE TAB
   ══════════════════════════════════════════════════════════════════════════ */

function ManageTab({
  targets, loading, isAdmin, onEdit, onDelete,
}: {
  targets: KPITarget[];
  loading: boolean;
  isAdmin: boolean;
  onEdit: (t: KPITarget) => void;
  onDelete: (t: KPITarget) => void;
}) {
  if (loading) {
    return <div className="animate-pulse space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-sunken rounded" />)}</div>;
  }
  if (targets.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <Target size={32} className="mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-[13px] text-muted-foreground">No targets yet. {isAdmin ? "Click \"Add Target\" to create your first one." : "Ask your Company Admin to define targets."}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>KPI / Indicator</TableHead>
            <TableHead>Module</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Field</TableHead>
            <TableHead className="text-right">Baseline</TableHead>
            <TableHead className="text-right">Target</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Created</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {targets.map((t) => (
            <TableRow key={t.target_id}>
              <TableCell>
                <span className="font-semibold text-foreground text-[13px]">
                  {t.kpi_name || t.indicator_name || "—"}
                </span>
                {t.description && <span className="block text-[11px] text-muted-foreground truncate max-w-xs">{t.description}</span>}
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: (t.module_color || "#64748b") + "22", color: t.module_color || "#64748b" }}>
                  {t.module_name}
                </span>
              </TableCell>
              <TableCell className="text-[12px] text-muted-foreground">{t.target_type}</TableCell>
              <TableCell className="text-[12px] text-muted-foreground">{AGG_FIELD_LABEL[t.agg_field]}</TableCell>
              <TableCell className="text-right font-mono text-[13px]">
                {t.baseline_value.toLocaleString()}
                <span className="block text-[10px] text-muted-foreground">{t.baseline_fy_label}</span>
              </TableCell>
              <TableCell className="text-right font-mono text-[13px]">
                {t.target_value.toLocaleString()}
                <span className="block text-[10px] text-muted-foreground">{t.target_fy_label}</span>
              </TableCell>
              <TableCell className="text-[12px] text-muted-foreground">{t.target_unit || "—"}</TableCell>
              <TableCell className="text-[11px] text-muted-foreground">{formatDate(t.created_at)}</TableCell>
              <TableCell>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => onEdit(t)} className="p-1 rounded hover:bg-sunken" title="Edit">
                      <Pencil size={13} className="text-muted-foreground" />
                    </button>
                    <button onClick={() => onDelete(t)} className="p-1 rounded hover:bg-destructive-tint" title="Delete">
                      <Trash2 size={13} className="text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════════════
   TARGET FORM DIALOG
   ══════════════════════════════════════════════════════════════════════════ */

function TargetForm({
  open, editing, modules, kpis, indicators, fys, onClose, onSaved,
}: {
  open: boolean;
  editing: KPITarget | null;
  modules: { module_id: number; module_name: string }[];
  kpis: KPI[];
  indicators: Indicator[];
  fys: FinancialYear[];
  onClose: () => void;
  onSaved: () => void;
}) {
  // Default module to first if not editing
  const initialModule = editing?.module_id ?? (modules[0]?.module_id ?? 0);
  const [moduleId, setModuleId] = useState<number>(initialModule);
  const [entryKind, setEntryKind] = useState<"kpi" | "indicator">(
    editing?.indicator_id ? "indicator" : "kpi",
  );
  const [kpiId, setKpiId] = useState<string>(editing?.kpi_id ?? "");
  const [indicatorId, setIndicatorId] = useState<string>(editing?.indicator_id ? String(editing.indicator_id) : "");
  const [targetType, setTargetType] = useState<TargetType>(editing?.target_type ?? "ABSOLUTE");
  const [aggField, setAggField] = useState<TargetAggField>(editing?.agg_field ?? "quantity");
  const [baselineYearId, setBaselineYearId] = useState<string>(editing?.baseline_year_id ? String(editing.baseline_year_id) : "");
  const [baselineValue, setBaselineValue] = useState<string>(editing ? String(editing.baseline_value) : "");
  const [targetYearId, setTargetYearId] = useState<string>(editing?.target_year_id ? String(editing.target_year_id) : "");
  const [targetValue, setTargetValue] = useState<string>(editing ? String(editing.target_value) : "");
  const [targetUnit, setTargetUnit] = useState<string>(editing?.target_unit ?? "");
  const [denom, setDenom] = useState<string>(editing?.intensity_denominator ?? "");
  const [description, setDescription] = useState<string>(editing?.description ?? "");
  const [saving, setSaving] = useState(false);

  const moduleKpis = useMemo(() => kpis.filter((k) => k.module_id === moduleId && k.is_active), [kpis, moduleId]);
  const moduleInds = useMemo(() => indicators.filter((i) => i.module_id === moduleId && i.is_active), [indicators, moduleId]);

  // Auto-fill target_unit from KPI/indicator unit when selected
  useEffect(() => {
    if (entryKind === "kpi" && kpiId && !targetUnit) {
      const k = kpis.find((x) => x.kpi_id === kpiId);
      if (k) setTargetUnit(k.unit);
    }
    if (entryKind === "indicator" && indicatorId && !targetUnit) {
      const i = indicators.find((x) => x.indicator_id === Number(indicatorId));
      if (i?.unit) setTargetUnit(i.unit);
    }
  }, [kpiId, indicatorId, entryKind]);

  const handleSave = async () => {
    if (entryKind === "kpi" && !kpiId) { toast.error("Select a KPI"); return; }
    if (entryKind === "indicator" && !indicatorId) { toast.error("Select an indicator"); return; }
    if (!baselineYearId || !targetYearId) { toast.error("Select baseline and target FY"); return; }
    if (!baselineValue || !targetValue)   { toast.error("Enter baseline and target values"); return; }

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        module_id:             moduleId,
        target_type:           targetType,
        agg_field:             aggField,
        baseline_year_id:      Number(baselineYearId),
        baseline_value:        Number(baselineValue),
        target_year_id:        Number(targetYearId),
        target_value:          Number(targetValue),
        target_unit:           targetUnit || null,
        intensity_denominator: targetType === "INTENSITY" ? (denom || null) : null,
        description:           description || null,
      };
      if (entryKind === "kpi")       { payload.kpi_id = kpiId;       payload.indicator_id = null; }
      else                            { payload.indicator_id = Number(indicatorId); payload.kpi_id = null; }

      if (editing) {
        await tenantApi.updateTarget(editing.target_id, payload);
        toast.success("Target updated");
      } else {
        await tenantApi.createTarget(payload);
        toast.success("Target created");
      }
      onSaved();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to save target"));
    } finally {
      setSaving(false);
    }
  };

  const inputCls  = "w-full py-1.5 px-3 text-[13px] text-foreground border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary bg-card";
  const labelCls  = "block text-[11px] text-muted-foreground mb-0.5 font-medium";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Target" : "Add Target"}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Module <span className="text-destructive">*</span></label>
              <select className={inputCls} value={moduleId} onChange={(e) => { setModuleId(Number(e.target.value)); setKpiId(""); setIndicatorId(""); }} disabled={!!editing}>
                {modules.map((m) => <option key={m.module_id} value={m.module_id}>{m.module_name}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Target On <span className="text-destructive">*</span></label>
              <select className={inputCls} value={entryKind} onChange={(e) => { setEntryKind(e.target.value as any); setKpiId(""); setIndicatorId(""); }} disabled={!!editing}>
                <option value="kpi">KPI</option>
                <option value="indicator">Indicator</option>
              </select>
            </div>

            {entryKind === "kpi" ? (
              <div className="col-span-2">
                <label className={labelCls}>KPI <span className="text-destructive">*</span></label>
                <select className={inputCls} value={kpiId} onChange={(e) => setKpiId(e.target.value)} disabled={!!editing}>
                  <option value="">-- Select --</option>
                  {moduleKpis.map((k) => <option key={k.kpi_id} value={k.kpi_id}>{k.kpi_name} ({k.unit})</option>)}
                </select>
              </div>
            ) : (
              <div className="col-span-2">
                <label className={labelCls}>Indicator <span className="text-destructive">*</span></label>
                <select className={inputCls} value={indicatorId} onChange={(e) => setIndicatorId(e.target.value)} disabled={!!editing}>
                  <option value="">-- Select --</option>
                  {moduleInds.map((i) => <option key={i.indicator_id} value={i.indicator_id}>{i.indicator_name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className={labelCls}>Target Type <span className="text-destructive">*</span></label>
              <select className={inputCls} value={targetType} onChange={(e) => setTargetType(e.target.value as TargetType)}>
                <option value="ABSOLUTE">Absolute</option>
                <option value="INTENSITY">Intensity</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Measure Field <span className="text-destructive">*</span></label>
              <select className={inputCls} value={aggField} onChange={(e) => setAggField(e.target.value as TargetAggField)}>
                <option value="quantity">Quantity</option>
                <option value="mj_value">Energy (MJ)</option>
                <option value="emission_value">Emissions (tCO₂e)</option>
              </select>
            </div>

            {targetType === "INTENSITY" && (
              <div className="col-span-2">
                <label className={labelCls}>Intensity Denominator</label>
                <input className={inputCls} placeholder="e.g. per crore revenue, per employee" value={denom} onChange={(e) => setDenom(e.target.value)} />
              </div>
            )}

            <div>
              <label className={labelCls}>Baseline FY <span className="text-destructive">*</span></label>
              <select className={inputCls} value={baselineYearId} onChange={(e) => setBaselineYearId(e.target.value)}>
                <option value="">-- Select --</option>
                {fys.map((fy) => <option key={fy.year_id} value={fy.year_id}>{fy.fy_label}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Baseline Value <span className="text-destructive">*</span></label>
              <input className={inputCls} type="number" step="any" value={baselineValue} onChange={(e) => setBaselineValue(e.target.value)} />
            </div>

            <div>
              <label className={labelCls}>Target FY <span className="text-destructive">*</span></label>
              <select className={inputCls} value={targetYearId} onChange={(e) => setTargetYearId(e.target.value)}>
                <option value="">-- Select --</option>
                {fys.map((fy) => <option key={fy.year_id} value={fy.year_id}>{fy.fy_label}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Target Value <span className="text-destructive">*</span></label>
              <input className={inputCls} type="number" step="any" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
            </div>

            <div className="col-span-2">
              <label className={labelCls}>Unit</label>
              <input className={inputCls} placeholder="e.g. kL, tCO₂e, MJ" value={targetUnit} onChange={(e) => setTargetUnit(e.target.value)} />
            </div>

            <div className="col-span-2">
              <label className={labelCls}>Description / Notes</label>
              <textarea className={inputCls + " resize-none"} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editing ? "Update" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
