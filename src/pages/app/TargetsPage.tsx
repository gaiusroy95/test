import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import {
  Target, Plus, Pencil, Trash2, TrendingDown, TrendingUp, Activity,
  CheckCircle2, AlertCircle, BarChart3, FileSpreadsheet, ArrowUp,
} from "lucide-react";
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, ComposedChart, Line, Legend,
} from "recharts";
import { tenantApi } from "@/api/client";
import { cn, getApiError, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/shared/PageShell";
import { StatCard } from "@/components/shared/PageComponents";
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
type ChartView = "chart" | "table";

const AGG_FIELD_LABEL: Record<TargetAggField, string> = {
  quantity:       "Quantity",
  mj_value:       "Energy (MJ)",
  emission_value: "Emissions (tCO₂e)",
};

const ZONE_A = "#F8F9FA";
const ZONE_B = "#FFFFFF";

function exportRows(filename: string, sheet: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    toast.error("No data to export");
    return;
  }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  XLSX.writeFile(wb, filename);
  toast.success("Exported to Excel");
}

function ExcelExportButton({ onClick, title = "Export Excel" }: { onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="p-1.5 rounded-md text-ok hover:bg-ok-tint transition-colors shrink-0"
    >
      <FileSpreadsheet size={14} />
    </button>
  );
}

function ViewToggle({ value, onChange }: { value: ChartView; onChange: (v: ChartView) => void }) {
  return (
    <div className="inline-flex rounded-md border border-border/60 p-0.5 bg-card/60">
      {([
        { key: "chart" as ChartView, label: "Chart" },
        { key: "table" as ChartView, label: "Data Table" },
      ]).map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn(
            "px-2.5 py-1 rounded text-[11px] font-semibold transition-colors",
            value === o.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Borderless tonal zone — #F8F9FA / white instead of card outlines */
function TonePanel({
  title,
  actions,
  children,
  tone = "a",
  className,
}: {
  title?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  tone?: "a" | "b";
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-md overflow-hidden", className)}
      style={{ backgroundColor: tone === "a" ? ZONE_A : ZONE_B }}
    >
      {(title || actions) && (
        <div className="px-4 py-2.5 flex items-center justify-between gap-2">
          {title ? <h3 className="section-title">{title}</h3> : <span />}
          {actions}
        </div>
      )}
      <div className={cn(title || actions ? "px-4 pb-4" : undefined)}>{children}</div>
    </div>
  );
}

export default function TargetsPage() {
  const user = useAuthStore((s) => s.user);
  const isSupport = useIsSupportSession();
  const isAdmin = user?.role === "COMPANY_ADMIN" && !isSupport;
  const modules = useModulesStore((s) => s.modules);

  const [tab, setTab] = useState<Tab>("progress");
  const [showScrollTop, setShowScrollTop] = useState(false);

  const [progress, setProgress] = useState<TargetProgressSummary | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);

  const [targets, setTargets] = useState<KPITarget[]>([]);
  const [loadingTargets, setLoadingTargets] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<KPITarget | null>(null);

  const [kpis, setKpis] = useState<KPI[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [fys, setFys] = useState<FinancialYear[]>([]);

  const fetchProgress = async () => {
    setLoadingProgress(true);
    try {
      const { data } = await tenantApi.targetProgress();
      setProgress(data);
    } catch (err: unknown) {
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
    } catch (err: unknown) {
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
    } catch (err: unknown) {
      toast.error(getApiError(err, "Failed to load reference data"));
    }
  };

  useEffect(() => { fetchProgress(); }, []);
  useEffect(() => {
    if (tab === "manage") fetchTargets();
  }, [tab]);
  useEffect(() => {
    if (showForm) fetchReferenceData();
  }, [showForm]);

  useEffect(() => {
    const main = document.getElementById("main-content");
    if (!main) return;
    const onScroll = () => {
      setShowScrollTop(main.scrollTop > main.clientHeight * 0.85);
    };
    main.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => main.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = useCallback(() => {
    document.getElementById("main-content")?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const openAdd = () => { setEditing(null); setShowForm(true); };

  const handleDelete = async (t: KPITarget) => {
    if (!confirm(`Delete target for ${t.kpi_name || t.indicator_name}?`)) return;
    try {
      await tenantApi.deleteTarget(t.target_id);
      toast.success("Target deleted");
      fetchTargets();
      fetchProgress();
    } catch (err: unknown) {
      toast.error(getApiError(err, "Failed to delete target"));
    }
  };

  return (
    <PageShell
      title="Targets & Goals"
      description="Set reduction / improvement targets and track progress against APPROVED data"
      breadcrumb={[{ label: "Home", href: "/app" }, { label: "Targets" }]}
      className="relative"
      actions={isAdmin ? (
        <Button size="sm" onClick={openAdd}>
          <Plus size={14} /> Add Target
        </Button>
      ) : undefined}
    >
      {/* Sticky sub-tab bar */}
      <div className="sticky top-0 z-30 -mx-1 px-1 mb-4 bg-background/95 backdrop-blur-sm border-b border-border pb-2">
        <div role="tablist" className="config-tabs" aria-label="Targets views">
          {([
            { key: "progress" as Tab, label: "Progress", icon: Activity },
            { key: "manage" as Tab, label: "Manage Targets", icon: Target },
          ]).map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn("config-tab", tab === t.key && "config-tab-active")}
            >
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "progress" && (
        <ProgressTab
          loading={loadingProgress}
          data={progress}
          isAdmin={isAdmin}
          onAdd={openAdd}
          onGoManage={() => setTab("manage")}
        />
      )}
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

      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          title="Scroll to top"
          aria-label="Scroll to top"
          className="fixed bottom-16 right-6 z-40 w-10 h-10 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-foreground hover:bg-sunken transition-colors"
        >
          <ArrowUp size={18} />
        </button>
      )}
    </PageShell>
  );
}


/* ══════════════════════════════════════════════════════════════════════════
   PROGRESS TAB
   ══════════════════════════════════════════════════════════════════════════ */

function ProgressTab({
  loading, data, isAdmin, onAdd, onGoManage,
}: {
  loading: boolean;
  data: TargetProgressSummary | null;
  isAdmin: boolean;
  onAdd: () => void;
  onGoManage: () => void;
}) {
  const [view, setView] = useState<ChartView>("chart");

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-md animate-pulse" style={{ backgroundColor: i % 2 === 0 ? ZONE_A : ZONE_B }} />
        ))}
      </div>
    );
  }

  if (!data || data.total_targets === 0) {
    return (
      <div className="rounded-md px-6 py-12 text-center" style={{ backgroundColor: ZONE_A }}>
        <Target size={32} className="mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-[13px] text-muted-foreground">
          No targets defined yet.{" "}
          {isAdmin ? (
            <button type="button" onClick={onAdd} className="text-primary font-semibold hover:underline">
              Add a target
            </button>
          ) : (
            <button type="button" onClick={onGoManage} className="text-primary font-semibold hover:underline">
              Open Manage Targets
            </button>
          )}
          {" "}to start tracking progress.
        </p>
      </div>
    );
  }

  const stats = [
    { label: "Active Targets", value: data.total_targets, icon: Target, color: "sky" as const },
    { label: "On Track", value: data.on_track_count, icon: CheckCircle2, color: "green" as const },
    { label: "At Risk", value: data.at_risk_count, icon: AlertCircle, color: data.at_risk_count > 0 ? "amber" as const : "muted" as const },
    { label: "Current FY", value: data.current_fy_label || "—", icon: BarChart3, color: "violet" as const },
  ];

  const chartData = data.items.map((it) => ({
    name: it.label.length > 18 ? it.label.slice(0, 16) + "…" : it.label,
    fullName: it.label,
    baseline: it.baseline_value,
    current: it.current_value,
    target: it.target_value,
    onTrack: it.on_track,
    unit: it.unit,
    progress: it.progress_pct,
    module: it.module_name,
  }));

  const avgTarget =
    chartData.length > 0
      ? chartData.reduce((s, d) => s + d.target, 0) / chartData.length
      : 0;

  const exportChart = () => exportRows(
    "targets-progress.xlsx",
    "Progress",
    data.items.map((it) => ({
      Label: it.label,
      Module: it.module_name,
      Type: it.target_type,
      Baseline: it.baseline_value,
      Current: it.current_value,
      Target: it.target_value,
      Unit: it.unit,
      "Progress %": Number(it.progress_pct.toFixed(1)),
      Status: it.on_track ? "On Track" : "At Risk",
    })),
  );

  return (
    <div className="space-y-3">
      {/* Uniform 4×1 / 2×2 KPI strip */}
      <div className="card-grid">
        {stats.map((c) => (
          <StatCard
            key={c.label}
            icon={c.icon}
            label={c.label}
            value={c.value}
            color={c.color}
            className="min-h-[104px]"
          />
        ))}
      </div>

      {/* Balanced chart + summary split */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-3 items-stretch">
        <TonePanel
          tone="a"
          className="xl:col-span-3 flex flex-col min-h-[320px]"
          title="Baseline vs Current vs Target"
          actions={
            <div className="flex items-center gap-2">
              <ViewToggle value={view} onChange={setView} />
              <ExcelExportButton onClick={exportChart} />
            </div>
          }
        >
          {view === "chart" ? (
            <div className="aspect-[16/9] min-h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="baseline" fill="#94a3b8" name="Baseline" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="current" name="Current" radius={[3, 3, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.onTrack ? "#10b981" : "#f59e0b"} />
                    ))}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="target"
                    name="Target"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={{ r: 3, fill: "#0ea5e9" }}
                  />
                  {avgTarget > 0 && (
                    <ReferenceLine
                      y={avgTarget}
                      stroke="hsl(var(--destructive))"
                      strokeDasharray="6 4"
                      strokeWidth={1.5}
                      label={{
                        value: "Avg target",
                        position: "insideTopRight",
                        fill: "hsl(var(--destructive))",
                        fontSize: 10,
                      }}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
                    <th className="py-2 font-semibold">Target</th>
                    <th className="py-2 font-semibold text-right">Baseline</th>
                    <th className="py-2 font-semibold text-right">Current</th>
                    <th className="py-2 font-semibold text-right">Target</th>
                    <th className="py-2 font-semibold text-right">Progress</th>
                    <th className="py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((d, i) => (
                    <tr
                      key={i}
                      style={{ backgroundColor: i % 2 === 0 ? ZONE_B : ZONE_A }}
                    >
                      <td className="py-2 text-[12px] font-medium text-foreground">{d.fullName}</td>
                      <td className="py-2 text-[12px] text-right font-mono tabular-nums">{d.baseline.toLocaleString()}</td>
                      <td className="py-2 text-[12px] text-right font-mono tabular-nums">{d.current.toLocaleString()}</td>
                      <td className="py-2 text-[12px] text-right font-mono tabular-nums">{d.target.toLocaleString()}</td>
                      <td className="py-2 text-[12px] text-right font-mono tabular-nums">{d.progress.toFixed(0)}%</td>
                      <td className="py-2 text-[11px]">
                        <span className={cn(
                          "font-semibold px-1.5 py-0.5 rounded",
                          d.onTrack ? "bg-ok-tint text-ok" : "bg-warn-tint text-warn",
                        )}>
                          {d.onTrack ? "ON TRACK" : "AT RISK"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TonePanel>

        <TonePanel
          tone="b"
          className="xl:col-span-2 flex flex-col min-h-[320px]"
          title="Status mix"
          actions={<ExcelExportButton onClick={exportChart} />}
        >
          <div className="flex-1 flex flex-col justify-center gap-4 py-2">
            {[{
              label: "On track",
              count: data.on_track_count,
              color: "bg-ok",
              tint: "bg-ok-tint text-ok",
            }, {
              label: "At risk",
              count: data.at_risk_count,
              color: "bg-warn",
              tint: "bg-warn-tint text-warn",
            }].map((row) => {
              const pct = data.total_targets ? Math.round((row.count / data.total_targets) * 100) : 0;
              return (
                <div key={row.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={cn("text-[12px] font-semibold px-1.5 py-0.5 rounded", row.tint)}>{row.label}</span>
                    <span className="font-mono text-[13px] font-bold tabular-nums">{row.count} · {pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-border/40 overflow-hidden">
                    <div className={cn("h-full rounded-full", row.color)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            <p className="text-label text-muted-foreground mt-2">
              Tracking against approved data for {data.current_fy_label || "current FY"}.
            </p>
          </div>
        </TonePanel>
      </div>

      {/* Borderless progress detail rows */}
      <TonePanel
        tone="a"
        title="Progress detail"
        actions={<ExcelExportButton onClick={exportChart} />}
      >
        <div className="-mx-4">
          {data.items.map((it, i) => (
            <ProgressRow key={it.target_id} item={it} index={i} />
          ))}
        </div>
      </TonePanel>
    </div>
  );
}

function ProgressRow({ item, index }: { item: TargetProgress; index: number }) {
  const pct = Math.max(0, Math.min(100, item.progress_pct));
  const TrendIcon = item.direction === "DECREASE" ? TrendingDown : TrendingUp;
  const goodDelta = (item.direction === "DECREASE" && item.delta_from_baseline < 0) ||
                    (item.direction === "INCREASE" && item.delta_from_baseline > 0);

  return (
    <div
      className="px-4 py-3"
      style={{ backgroundColor: index % 2 === 0 ? ZONE_B : ZONE_A }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.module_color }}
            />
            <span className="text-[13px] font-semibold text-foreground truncate">{item.label}</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: ZONE_A }}>
              {item.module_name}
            </span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: ZONE_A }}>
              {item.target_type}
            </span>
            {item.on_track ? (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-ok-tint text-ok">ON TRACK</span>
            ) : (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-warn-tint text-warn">AT RISK</span>
            )}
          </div>

          <div className="flex items-center gap-5 text-[11px] text-muted-foreground mb-2 flex-wrap">
            <span>Baseline <span className="text-foreground/90 font-mono">{item.baseline_value.toLocaleString()}</span> {item.unit} ({item.baseline_fy_label})</span>
            <span>Current <span className="text-foreground/90 font-mono">{item.current_value.toLocaleString()}</span> {item.unit} ({item.current_fy_label})</span>
            <span>Target <span className="text-foreground/90 font-mono">{item.target_value.toLocaleString()}</span> {item.unit} ({item.target_fy_label})</span>
            <span className={`flex items-center gap-1 ${goodDelta ? "text-ok" : "text-warn"}`}>
              <TrendIcon size={12} /> {item.delta_pct > 0 ? "+" : ""}{item.delta_pct.toFixed(1)}% vs baseline
            </span>
          </div>

          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: index % 2 === 0 ? ZONE_A : "#EEF0F2" }}>
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
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 rounded-md animate-pulse" style={{ backgroundColor: i % 2 === 0 ? ZONE_A : ZONE_B }} />
        ))}
      </div>
    );
  }

  if (targets.length === 0) {
    return (
      <div className="rounded-md px-6 py-12 text-center" style={{ backgroundColor: ZONE_A }}>
        <Target size={32} className="mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-[13px] text-muted-foreground">
          No targets yet.{" "}
          {isAdmin
            ? "Use Add Target in the top-right to create your first one."
            : "Ask your Company Admin to define targets."}
        </p>
      </div>
    );
  }

  const exportTargets = () => exportRows(
    "targets-directory.xlsx",
    "Targets",
    targets.map((t) => ({
      Name: t.kpi_name || t.indicator_name || "",
      Module: t.module_name || "",
      Type: t.target_type,
      Field: AGG_FIELD_LABEL[t.agg_field],
      Baseline: t.baseline_value,
      "Baseline FY": t.baseline_fy_label || "",
      Target: t.target_value,
      "Target FY": t.target_fy_label || "",
      Unit: t.target_unit || "",
      Description: t.description || "",
      Created: t.created_at,
    })),
  );

  return (
    <TonePanel
      tone="a"
      title="Target directory"
      actions={<ExcelExportButton onClick={exportTargets} />}
    >
      <div className="-mx-4 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40 hover:bg-transparent">
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
            {targets.map((t, i) => (
              <TableRow
                key={t.target_id}
                className="border-border/30"
                style={{ backgroundColor: i % 2 === 0 ? ZONE_B : ZONE_A }}
              >
                <TableCell>
                  <span className="font-semibold text-foreground text-[13px]">
                    {t.kpi_name || t.indicator_name || "—"}
                  </span>
                  {t.description && <span className="block text-[11px] text-muted-foreground truncate max-w-xs">{t.description}</span>}
                </TableCell>
                <TableCell>
                  <span
                    className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: (t.module_color || "#64748b") + "22", color: t.module_color || "#64748b" }}
                  >
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
                      <button type="button" onClick={() => onEdit(t)} className="p-1 rounded hover:bg-sunken" title="Edit">
                        <Pencil size={13} className="text-muted-foreground" />
                      </button>
                      <button type="button" onClick={() => onDelete(t)} className="p-1 rounded hover:bg-destructive-tint" title="Delete">
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
    </TonePanel>
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
    if (!baselineValue || !targetValue) { toast.error("Enter baseline and target values"); return; }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
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
      if (entryKind === "kpi") {
        payload.kpi_id = kpiId;
        payload.indicator_id = null;
      } else {
        payload.indicator_id = Number(indicatorId);
        payload.kpi_id = null;
      }

      if (editing) {
        await tenantApi.updateTarget(editing.target_id, payload);
        toast.success("Target updated");
      } else {
        await tenantApi.createTarget(payload);
        toast.success("Target created");
      }
      onSaved();
    } catch (err: unknown) {
      toast.error(getApiError(err, "Failed to save target"));
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full py-1.5 px-3 text-[13px] text-foreground border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary bg-card";
  const labelCls = "block text-[11px] text-muted-foreground mb-0.5 font-medium";

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
              <select className={inputCls} value={entryKind} onChange={(e) => { setEntryKind(e.target.value as "kpi" | "indicator"); setKpiId(""); setIndicatorId(""); }} disabled={!!editing}>
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
