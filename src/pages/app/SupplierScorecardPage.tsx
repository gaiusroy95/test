import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Building2, AlertTriangle, Link2, Search, Plus, Pencil,
  TrendingUp, ChevronDown, ChevronRight, Shield, ShieldAlert, ShieldCheck,
  Package2, X, Gauge, Trash2, FileSpreadsheet,
} from "lucide-react";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line,
  Legend, ReferenceLine,
} from "recharts";
import { tenantApi } from "@/api/client";
import { getApiError, cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/shared/PageShell";
import { StatCard } from "@/components/shared/PageComponents";
import { FormDialog } from "@/components/shared/FormDialog";
import { useIsSupportSession } from "@/components/shared/WriteOnly";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { useAuthStore } from "@/store/auth";
import type {
  Supplier, SupplierScorecard, SupplierScorecardSummary,
  SupplierScorecardDetail, SupplierCategorySplit, SupplierTrend,
  SupplierEmissionFactor,
} from "@/types";

/* ── Constants ─────────────────────────────────────────────────────────── */

const currentYear = new Date().getFullYear();
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PARETO_COLORS = [
  "#7c3aed", "#8b5cf6", "#a78bfa", "#6d28d9", "#5b21b6",
  "#4c1d95", "#c084fc", "#ddd6fe", "#7c3aed", "#8b5cf6",
];
const RISK_COLOR: Record<string, string> = {
  HIGH: "text-destructive bg-destructive-tint",
  MEDIUM: "text-warn bg-warn-tint",
  LOW: "text-ok bg-ok-tint",
};
const RISK_ICON: Record<string, typeof Shield> = {
  HIGH: ShieldAlert, MEDIUM: Shield, LOW: ShieldCheck,
};

type Tab = "scorecard" | "directory";
type FactorPanelState = { supplier: Supplier } | null;
type ChartFocus = "all" | "pareto" | "risk";

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

function ExcelExportButton({
  title = "Export Excel",
  onClick,
}: {
  title?: string;
  onClick: () => void;
}) {
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

function ChartPanel({
  title,
  onExport,
  children,
  className,
}: {
  title: string;
  onExport?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("summary-panel", className)}>
      <div className="summary-panel-header">
        <h3 className="section-title">{title}</h3>
        {onExport && <ExcelExportButton onClick={onExport} />}
      </div>
      <div className="summary-panel-body">{children}</div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────── */

export default function SupplierScorecardPage() {
  const user = useAuthStore((s) => s.user);
  const isSupport = useIsSupportSession();
  const isAdmin = user?.role === "COMPANY_ADMIN" && !isSupport;

  const [tab, setTab] = useState<Tab>("scorecard");
  const [reportingYear, setReportingYear] = useState(currentYear);

  // Scorecard state
  const [summary, setSummary] = useState<SupplierScorecardSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
  const [detail, setDetail] = useState<SupplierScorecardDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Directory state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingDir, setLoadingDir] = useState(false);
  const [searchDir, setSearchDir] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [factorPanel, setFactorPanel] = useState<FactorPanelState>(null);

  /* ── Data fetching ──────────────────────────────────────────────────── */

  const fetchSummary = async () => {
    setLoadingSummary(true);
    try {
      const { data } = await tenantApi.supplierScorecardSummary(reportingYear);
      setSummary(data);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to load scorecard"));
    } finally {
      setLoadingSummary(false);
    }
  };

  const fetchDetail = async (supplierId: string) => {
    setLoadingDetail(true);
    try {
      const { data } = await tenantApi.supplierScorecardDetail(supplierId, reportingYear);
      setDetail(data);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to load supplier detail"));
    } finally {
      setLoadingDetail(false);
    }
  };

  const fetchDirectory = async () => {
    setLoadingDir(true);
    try {
      const { data } = await tenantApi.listSuppliers(searchDir ? { search: searchDir } : {});
      setSuppliers(data);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to load suppliers"));
    } finally {
      setLoadingDir(false);
    }
  };

  useEffect(() => { fetchSummary(); }, [reportingYear]);
  useEffect(() => { if (tab === "directory") fetchDirectory(); }, [tab, searchDir]);
  useEffect(() => {
    if (selectedSupplier) fetchDetail(selectedSupplier);
  }, [selectedSupplier, reportingYear]);

  const handleLinkUnlinked = async () => {
    try {
      const { data } = await tenantApi.linkUnlinkedSuppliers();
      toast.success(data.message);
      fetchSummary();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to link entries"));
    }
  };

  /* ── Supplier CRUD ──────────────────────────────────────────────────── */

  const supplierFormFields = [
    { key: "supplier_name", label: "Supplier Name", required: true },
    { key: "supplier_code", label: "Supplier Code (internal)" },
    { key: "gstin",         label: "GSTIN (15 chars)" },
    { key: "pan",           label: "PAN (10 chars)" },
    { key: "vendor_code",   label: "Vendor Code (ERP)" },
    { key: "sector_code",   label: "Sector Code" },
    { key: "sector_name",   label: "Sector Name" },
    { key: "risk_tier",     label: "Risk Tier", type: "select" as const,
      options: [{ value: "__none__", label: "Not Set" }, { value: "HIGH", label: "High" }, { value: "MEDIUM", label: "Medium" }, { value: "LOW", label: "Low" }] },
    { key: "is_critical",   label: "Critical Supplier (BRSR)", type: "toggle" as const },
    { key: "contact_name",  label: "Contact Name" },
    { key: "contact_email", label: "Contact Email" },
    { key: "notes",         label: "Notes", type: "textarea" as const },
  ];

  const handleSaveSupplier = async (vals: Record<string, any>) => {
    const payload = { ...vals, risk_tier: vals.risk_tier === "__none__" ? null : vals.risk_tier };
    try {
      if (editingSupplier) {
        await tenantApi.updateSupplier(editingSupplier.supplier_id, payload);
        toast.success("Supplier updated");
      } else {
        await tenantApi.createSupplier(payload);
        toast.success("Supplier created");
      }
      setShowForm(false);
      setEditingSupplier(null);
      fetchDirectory();
      if (tab === "scorecard") fetchSummary();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to save supplier"));
    }
  };

  const handleDeactivate = async (s: Supplier) => {
    try {
      await tenantApi.deleteSupplier(s.supplier_id);
      toast.success("Supplier deactivated");
      fetchDirectory();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to deactivate supplier"));
    }
  };

  /* ── Pareto data ────────────────────────────────────────────────────── */

  const paretoData = (summary?.top_suppliers || []).slice(0, 10);
  let cumPct = 0;
  const paretoWithCum = paretoData.map((s) => {
    cumPct += s.pct_of_total;
    return { ...s, name: s.supplier_name.length > 18 ? s.supplier_name.slice(0, 16) + "..." : s.supplier_name, cumPct: Math.round(cumPct * 10) / 10 };
  });

  /* ── Render ─────────────────────────────────────────────────────────── */

  return (
    <PageShell
      title="Supplier Scorecard"
      description="Scope 3 supplier emissions, spend analysis, and risk classification"
      breadcrumb={[{ label: "Home", href: "/app" }, { label: "Supplier Scorecard" }]}
      className="[&_.page-header]:mb-2"
      actions={
        isAdmin ? (
          <Button size="sm" onClick={() => { setEditingSupplier(null); setShowForm(true); }}>
            <Plus size={14} /> Add Supplier
          </Button>
        ) : undefined
      }
    >
      {/* Sticky quick-jump tabs */}
      <div className="sticky top-0 z-30 -mx-1 px-1 mb-4 bg-background/95 backdrop-blur-sm border-b border-border pb-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div role="tablist" className="config-tabs" aria-label="Supplier views">
            {([
              { key: "scorecard" as Tab, label: "Scorecard", icon: TrendingUp },
              { key: "directory" as Tab, label: "Supplier Directory", icon: Building2 },
            ]).map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => { setTab(t.key); setSelectedSupplier(null); setDetail(null); }}
                className={cn("config-tab", tab === t.key && "config-tab-active")}
              >
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {tab === "scorecard" && (
              <select
                className="border border-border rounded-md px-3 py-1.5 text-[13px] text-foreground bg-card h-8"
                value={reportingYear}
                onChange={(e) => setReportingYear(Number(e.target.value))}
              >
                {Array.from({ length: 5 }, (_, i) => currentYear - i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}
            {tab === "directory" && (
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="border border-border rounded-md pl-8 pr-3 py-1.5 text-[13px] text-foreground w-52 h-8 bg-card"
                  placeholder="Search suppliers..."
                  value={searchDir}
                  onChange={(e) => setSearchDir(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tab content */}
      {tab === "scorecard" && (
        selectedSupplier && detail ? (
          <SupplierDetailPanel
            detail={detail}
            loading={loadingDetail}
            onClose={() => { setSelectedSupplier(null); setDetail(null); }}
          />
        ) : (
          <ScorecardDashboard
            summary={summary}
            loading={loadingSummary}
            paretoData={paretoWithCum}
            isAdmin={isAdmin}
            onLinkUnlinked={handleLinkUnlinked}
            onSelectSupplier={(id) => setSelectedSupplier(id)}
          />
        )
      )}

      {tab === "directory" && (
        <DirectoryTab
          suppliers={suppliers}
          loading={loadingDir}
          isAdmin={isAdmin}
          onEdit={(s) => { setEditingSupplier(s); setShowForm(true); }}
          onDeactivate={handleDeactivate}
          onViewScorecard={(id) => { setTab("scorecard"); setSelectedSupplier(id); }}
          onManageFactors={(s) => setFactorPanel({ supplier: s })}
        />
      )}

      {/* Supplier Factors Side Panel */}
      {factorPanel && (
        <SupplierFactorsPanel
          supplier={factorPanel.supplier}
          isAdmin={isAdmin}
          onClose={() => setFactorPanel(null)}
        />
      )}

      {/* Add/Edit Supplier Dialog */}
      <FormDialog
        open={showForm}
        onClose={() => { setShowForm(false); setEditingSupplier(null); }}
        title={editingSupplier ? "Edit Supplier" : "Add Supplier"}
        fields={supplierFormFields}
        initialData={editingSupplier ? {
          supplier_name: editingSupplier.supplier_name,
          supplier_code: editingSupplier.supplier_code || "",
          gstin:         editingSupplier.gstin || "",
          pan:           editingSupplier.pan || "",
          vendor_code:   editingSupplier.vendor_code || "",
          sector_code:   editingSupplier.sector_code || "",
          sector_name:   editingSupplier.sector_name || "",
          risk_tier:     editingSupplier.risk_tier || "__none__",
          is_critical:   editingSupplier.is_critical,
          contact_name:  editingSupplier.contact_name || "",
          contact_email: editingSupplier.contact_email || "",
          notes:         editingSupplier.notes || "",
        } : {}}
        onSubmit={handleSaveSupplier}
      />
    </PageShell>
  );
}


/* ══════════════════════════════════════════════════════════════════════════
   SCORECARD DASHBOARD
   ══════════════════════════════════════════════════════════════════════════ */

function ScorecardDashboard({
  summary, loading, paretoData, isAdmin, onLinkUnlinked, onSelectSupplier,
}: {
  summary: SupplierScorecardSummary | null;
  loading: boolean;
  paretoData: (SupplierScorecard & { name: string; cumPct: number })[];
  isAdmin: boolean;
  onLinkUnlinked: () => void;
  onSelectSupplier: (id: string) => void;
}) {
  const [chartFocus, setChartFocus] = useState<ChartFocus>("all");

  if (loading) {
    return (
      <div className="card-grid mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-md border border-border bg-card p-3 h-[96px] animate-pulse" />
        ))}
      </div>
    );
  }

  if (!summary) return null;

  const statCards = [
    { label: "Total Scope 3 Emissions", value: `${summary.total_emissions.toLocaleString()} tCO\u2082e`, icon: Package2, color: "violet" as const },
    { label: "Linked Suppliers", value: summary.supplier_count, icon: Building2, color: "sky" as const },
    { label: "Unlinked Entries", value: summary.unlinked_count, icon: AlertTriangle, color: summary.unlinked_count > 0 ? "amber" as const : "green" as const },
    { label: "Top Supplier Share", value: paretoData.length > 0 ? `${paretoData[0].pct_of_total}%` : "—", icon: TrendingUp, color: "violet" as const },
  ];

  // Pareto 80% benchmark + emissions average for dashed target lines
  const emissionsTarget = paretoData.length > 0
    ? paretoData.reduce((s, r) => s + r.total_emissions, 0) / paretoData.length
    : 0;

  const exportPareto = () => exportRows(
    `supplier-pareto-${summary.reporting_year}.xlsx`,
    "Pareto",
    paretoData.map((s, i) => ({
      Rank: i + 1,
      Supplier: s.supplier_name,
      "Emissions (tCO2e)": s.total_emissions,
      "Share %": s.pct_of_total,
      "Cumulative %": s.cumPct,
      Risk: s.risk_tier || "",
    })),
  );

  const exportRisk = () => {
    const tiers = ["HIGH", "MEDIUM", "LOW"] as const;
    const rows = tiers.map((tier) => {
      const group = summary.top_suppliers.filter((s) => s.risk_tier === tier);
      return {
        "Risk Tier": tier,
        Suppliers: group.length,
        "Emissions (tCO2e)": group.reduce((a, b) => a + b.total_emissions, 0),
      };
    }).filter((r) => r.Suppliers > 0);
    exportRows(`supplier-risk-${summary.reporting_year}.xlsx`, "Risk", rows);
  };

  const exportRanking = () => exportRows(
    `supplier-ranking-${summary.reporting_year}.xlsx`,
    "Ranking",
    summary.top_suppliers.map((s, i) => ({
      Rank: i + 1,
      Supplier: s.supplier_name,
      Code: s.supplier_code || "",
      Sector: s.sector_name || "",
      Risk: s.risk_tier || "",
      Critical: s.is_critical ? "Yes" : "No",
      "Emissions (tCO2e)": s.total_emissions,
      Spend: s.total_spend,
      "Share %": s.pct_of_total,
      Categories: s.category_count,
    })),
  );

  const showPareto = chartFocus === "all" || chartFocus === "pareto";
  const showRisk = chartFocus === "all" || chartFocus === "risk";

  return (
    <div>
      {/* Uniform metric card grid */}
      <div className="card-grid mb-4">
        {statCards.map((c) => (
          <StatCard
            key={c.label}
            icon={c.icon}
            label={c.label}
            value={c.value}
            color={c.color}
            className="min-h-[96px]"
          />
        ))}
      </div>

      {summary.unlinked_count > 0 && isAdmin && (
        <div className="flex items-center gap-3 rounded-md border border-warn/30 bg-warn-tint px-4 py-3 mb-4">
          <AlertTriangle size={16} className="text-warn flex-shrink-0" />
          <span className="text-[13px] text-amber-800 flex-1">
            {summary.unlinked_count} entries have supplier names but aren't linked to the supplier directory.
          </span>
          <Button size="sm" variant="outline" onClick={onLinkUnlinked}>
            <Link2 size={14} className="mr-1" /> Auto-Link
          </Button>
        </div>
      )}

      {paretoData.length > 0 ? (
        <>
          {/* Focus mode */}
          <div className="flex items-center justify-end gap-2 mb-3">
            <label className="text-[12px] font-semibold text-muted-foreground">Show:</label>
            <select
              className="h-8 rounded-md border border-border bg-card px-2.5 text-[12px] text-foreground outline-none focus:border-primary"
              value={chartFocus}
              onChange={(e) => setChartFocus(e.target.value as ChartFocus)}
            >
              <option value="all">All Charts</option>
              <option value="pareto">Pareto Emissions</option>
              <option value="risk">Risk Tier</option>
            </select>
          </div>

          <div className={cn("mb-4", chartFocus === "all" ? "card-grid-2" : "grid grid-cols-1")}>
            {showPareto && (
              <ChartPanel title="Top Suppliers by Emissions (Pareto)" onExport={exportPareto}>
                <ResponsiveContainer width="100%" height={chartFocus === "pareto" ? 360 : 280}>
                  <BarChart data={paretoData} margin={{ top: 8, right: 40, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: "tCO₂e", angle: -90, position: "insideLeft", fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} domain={[0, 100]} label={{ value: "Cum %", angle: 90, position: "insideRight", fontSize: 11 }} />
                    <Tooltip formatter={(v: number, name: string) => [name === "cumPct" ? `${v}%` : `${v.toLocaleString()} tCO₂e`, name === "cumPct" ? "Cumulative %" : "Emissions"]} />
                    {emissionsTarget > 0 && (
                      <ReferenceLine
                        yAxisId="left"
                        y={emissionsTarget}
                        stroke="hsl(var(--destructive))"
                        strokeDasharray="6 4"
                        strokeWidth={1.5}
                        label={{ value: "Avg target", position: "insideTopRight", fill: "hsl(var(--destructive))", fontSize: 10 }}
                      />
                    )}
                    <ReferenceLine
                      yAxisId="right"
                      y={80}
                      stroke="#f59e0b"
                      strokeDasharray="6 4"
                      strokeWidth={1.5}
                      label={{ value: "80%", position: "insideTopLeft", fill: "#f59e0b", fontSize: 10 }}
                    />
                    <Bar yAxisId="left" dataKey="total_emissions" radius={[4, 4, 0, 0]}>
                      {paretoData.map((_, i) => <Cell key={i} fill={PARETO_COLORS[i % PARETO_COLORS.length]} />)}
                    </Bar>
                    <Line yAxisId="right" type="monotone" dataKey="cumPct" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>
            )}

            {showRisk && (
              <ChartPanel title="Emissions by Risk Tier" onExport={exportRisk}>
                <div className={chartFocus === "risk" ? "min-h-[320px]" : undefined}>
                  <RiskPieChart suppliers={summary.top_suppliers} />
                </div>
              </ChartPanel>
            )}
          </div>
        </>
      ) : (
        <div className="summary-panel mb-4">
          <div className="summary-panel-body text-center py-8">
            <Building2 size={32} className="mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-ui text-muted-foreground">No supplier data for {summary.reporting_year} yet. Add suppliers and link them to Scope 3 entries.</p>
          </div>
        </div>
      )}

      {summary.top_suppliers.length > 0 && (
        <div className="summary-panel">
          <div className="summary-panel-header">
            <h3 className="section-title">All Suppliers — Emissions Ranking</h3>
            <ExcelExportButton onClick={exportRanking} />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead className="text-right">Emissions (tCO₂e)</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right">% of Total</TableHead>
                <TableHead className="text-right">Categories</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.top_suppliers.map((s, i) => (
                <TableRow key={s.supplier_id} className="cursor-pointer" onClick={() => onSelectSupplier(s.supplier_id)}>
                  <TableCell className="text-muted-foreground font-mono text-[12px]">{i + 1}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-[13px]">{s.supplier_name}</span>
                      {s.is_critical && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-destructive-tint text-destructive">CRITICAL</span>
                      )}
                    </div>
                    {s.supplier_code && <span className="text-[11px] text-muted-foreground">{s.supplier_code}</span>}
                  </TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">{s.sector_name || "—"}</TableCell>
                  <TableCell>
                    {s.risk_tier ? <RiskBadge tier={s.risk_tier} /> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right font-mono text-[13px] text-foreground tabular-nums">{s.total_emissions.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono text-[13px] text-muted-foreground tabular-nums">{s.total_spend > 0 ? `₹${s.total_spend.toLocaleString()}` : "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-sunken rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full" style={{ width: `${Math.min(s.pct_of_total, 100)}%` }} />
                      </div>
                      <span className="text-[12px] text-muted-foreground w-12 text-right tabular-nums">{s.pct_of_total}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-[12px] text-muted-foreground">{s.category_count}</TableCell>
                  <TableCell>
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════════════
   SUPPLIER DETAIL PANEL
   ══════════════════════════════════════════════════════════════════════════ */

function SupplierDetailPanel({
  detail, loading, onClose,
}: {
  detail: SupplierScorecardDetail;
  loading: boolean;
  onClose: () => void;
}) {
  if (loading) {
    return <div className="animate-pulse space-y-4">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 bg-sunken rounded-lg" />)}</div>;
  }

  const s = detail.supplier;
  const trendData = MONTH_NAMES.map((name, i) => {
    const t = detail.trend.find((tr) => tr.month === i + 1);
    return { month: name, emissions: t?.emissions || 0, spend: t?.spend || 0 };
  });
  const trendTarget = (() => {
    const vals = trendData.map((d) => d.emissions).filter((v) => v > 0);
    if (vals.length === 0) return 0;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  })();

  const exportTrend = () => exportRows(
    `supplier-trend-${s.supplier_name.replace(/\s+/g, "-")}.xlsx`,
    "Trend",
    trendData.map((d) => ({ Month: d.month, "Emissions (tCO2e)": d.emissions, Spend: d.spend })),
  );

  const exportCategories = () => exportRows(
    `supplier-categories-${s.supplier_name.replace(/\s+/g, "-")}.xlsx`,
    "Categories",
    detail.by_category.map((c) => ({
      Code: c.category_code,
      Category: c.category_name,
      "Emissions (tCO2e)": c.emissions,
      Spend: c.spend,
      Entries: c.entry_count,
    })),
  );

  return (
    <div>
      <button onClick={onClose} className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-primary mb-3 transition-colors">
        <ChevronDown size={14} className="rotate-90" /> Back to overview
      </button>

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-md p-2.5 bg-accent">
            <Building2 size={20} className="text-accent-foreground" />
          </div>
          <div>
            <h2 className="text-[16px] font-bold text-foreground flex items-center gap-2">
              {s.supplier_name}
              {s.is_critical && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-destructive-tint text-destructive">CRITICAL</span>}
            </h2>
            <div className="flex items-center gap-3 text-[12px] text-muted-foreground mt-0.5">
              {s.supplier_code && <span>Code: {s.supplier_code}</span>}
              {s.sector_name && <span>Sector: {s.sector_name}</span>}
              {s.risk_tier && <RiskBadge tier={s.risk_tier} />}
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-sunken transition-colors">
          <X size={16} className="text-muted-foreground" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {[
          { label: "Total Emissions", value: `${detail.total_emissions.toLocaleString()} tCO₂e`, icon: Package2, color: "violet" as const },
          { label: "Total Spend", value: detail.total_spend > 0 ? `₹${detail.total_spend.toLocaleString()}` : "—", icon: TrendingUp, color: "sky" as const },
          { label: "Data Entries", value: detail.entry_count, icon: Gauge, color: "muted" as const },
        ].map((k) => (
          <StatCard key={k.label} icon={k.icon} label={k.label} value={k.value} color={k.color} className="min-h-[96px]" />
        ))}
      </div>

      <div className="card-grid-2 mb-4">
        <ChartPanel title="Monthly Emissions Trend" onExport={exportTrend}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`${v.toLocaleString()} tCO₂e`, "Emissions"]} />
              {trendTarget > 0 && (
                <ReferenceLine
                  y={trendTarget}
                  stroke="hsl(var(--destructive))"
                  strokeDasharray="6 4"
                  strokeWidth={1.5}
                  label={{ value: "Target", position: "insideTopRight", fill: "hsl(var(--destructive))", fontSize: 10 }}
                />
              )}
              <Line type="monotone" dataKey="emissions" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3, fill: "#7c3aed" }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Emissions by GHG Category" onExport={detail.by_category.length > 0 ? exportCategories : undefined}>
          {detail.by_category.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={detail.by_category}
                  dataKey="emissions"
                  nameKey="category_name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ category_code, percent }: any) => `${category_code} ${(percent * 100).toFixed(0)}%`}
                >
                  {detail.by_category.map((_, i) => <Cell key={i} fill={PARETO_COLORS[i % PARETO_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v.toLocaleString()} tCO₂e`, "Emissions"]} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-[13px] text-muted-foreground text-center py-8">No category data</p>
          )}
        </ChartPanel>
      </div>

      {detail.by_category.length > 0 && (
        <div className="summary-panel">
          <div className="summary-panel-header">
            <h3 className="section-title">Category Breakdown</h3>
            <ExcelExportButton onClick={exportCategories} />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Emissions (tCO₂e)</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead className="text-right">Entries</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.by_category.map((c) => (
                <TableRow key={c.category_id}>
                  <TableCell>
                    <span className="font-mono text-[11px] text-accent-foreground mr-2">{c.category_code}</span>
                    <span className="text-[13px] text-foreground">{c.category_name}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-[13px] tabular-nums">{c.emissions.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono text-[13px] text-muted-foreground tabular-nums">{c.spend > 0 ? `₹${c.spend.toLocaleString()}` : "—"}</TableCell>
                  <TableCell className="text-right text-[13px] text-muted-foreground">{c.entry_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════════════
   DIRECTORY TAB
   ══════════════════════════════════════════════════════════════════════════ */

function DirectoryTab({
  suppliers, loading, isAdmin, onEdit, onDeactivate, onViewScorecard, onManageFactors,
}: {
  suppliers: Supplier[];
  loading: boolean;
  isAdmin: boolean;
  onEdit: (s: Supplier) => void;
  onDeactivate: (s: Supplier) => void;
  onViewScorecard: (id: string) => void;
  onManageFactors: (s: Supplier) => void;
}) {
  if (loading) {
    return <div className="animate-pulse space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 bg-sunken rounded" />)}</div>;
  }

  if (suppliers.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <Building2 size={32} className="mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-[13px] text-muted-foreground">No suppliers found. Add your first supplier to start tracking.</p>
      </div>
    );
  }

  return (
    <div className="summary-panel">
      <div className="summary-panel-header">
        <h3 className="section-title">Supplier Directory</h3>
        <ExcelExportButton
          onClick={() => exportRows(
            "supplier-directory.xlsx",
            "Suppliers",
            suppliers.map((s) => ({
              Name: s.supplier_name,
              Code: s.supplier_code || "",
              GSTIN: s.gstin || "",
              Sector: s.sector_name || "",
              Risk: s.risk_tier || "",
              Critical: s.is_critical ? "Yes" : "No",
              Contact: s.contact_name || "",
              Email: s.contact_email || "",
              Status: s.is_active === false ? "Inactive" : "Active",
            })),
          )}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Supplier</TableHead>
            <TableHead>GSTIN / Code</TableHead>
            <TableHead>Sector</TableHead>
            <TableHead>Risk</TableHead>
            <TableHead>Critical</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.map((s) => (
            <TableRow key={s.supplier_id}>
              <TableCell>
                <button onClick={() => onViewScorecard(s.supplier_id)} className="text-[13px] font-semibold text-foreground hover:text-primary transition-colors text-left">
                  {s.supplier_name}
                </button>
                {s.pan && <span className="block text-[11px] text-muted-foreground">PAN: {s.pan}</span>}
              </TableCell>
              <TableCell className="text-[12px] text-muted-foreground font-mono">
                {s.gstin || s.supplier_code || s.vendor_code || "—"}
              </TableCell>
              <TableCell className="text-[12px] text-muted-foreground">{s.sector_name || s.sector_code || "—"}</TableCell>
              <TableCell>{s.risk_tier ? <RiskBadge tier={s.risk_tier} /> : <span className="text-muted-foreground text-[12px]">—</span>}</TableCell>
              <TableCell>
                {s.is_critical ? (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-destructive-tint text-destructive">YES</span>
                ) : (
                  <span className="text-muted-foreground text-[12px]">No</span>
                )}
              </TableCell>
              <TableCell className="text-[12px] text-muted-foreground">
                {s.contact_name || s.contact_email || "—"}
              </TableCell>
              <TableCell>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${s.is_active ? "bg-ok-tint text-ok" : "bg-sunken text-muted-foreground"}`}>
                  {s.is_active ? "Active" : "Inactive"}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <button onClick={() => onManageFactors(s)} className="p-1 rounded hover:bg-ok-tint" title="Manage emission factors">
                    <Gauge size={13} className="text-ok" />
                  </button>
                  {isAdmin && (
                    <>
                      <button onClick={() => onEdit(s)} className="p-1 rounded hover:bg-sunken" title="Edit">
                        <Pencil size={13} className="text-muted-foreground" />
                      </button>
                      {s.is_active && (
                        <button onClick={() => onDeactivate(s)} className="p-1 rounded hover:bg-sunken" title="Deactivate">
                          <X size={13} className="text-muted-foreground" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}


/* ══════════════════════════════════════════════════════════════════════════
   SHARED COMPONENTS
   ══════════════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════════════
   SUPPLIER FACTORS SIDE PANEL
   Same UX pattern as LB Factors on LocationsPage.
   ══════════════════════════════════════════════════════════════════════════ */

function SupplierFactorsPanel({
  supplier, isAdmin, onClose,
}: {
  supplier: Supplier;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const [factors, setFactors] = useState<SupplierEmissionFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<SupplierEmissionFactor | null>(null);

  // Add/edit form state
  const emptyForm = { product_category: "", emission_factor: "", emission_uom: "kgCO2e", unit_basis: "", valid_from: "", valid_to: "", source_note: "" };
  const [form, setForm] = useState<Record<string, any>>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await tenantApi.listSupplierFactors(supplier.supplier_id);
      setFactors(data);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to load factors"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [supplier.supplier_id]);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowAdd(true); };
  const openEdit = (f: SupplierEmissionFactor) => {
    setEditing(f);
    setForm({
      product_category: f.product_category,
      emission_factor:  String(f.emission_factor),
      emission_uom:     f.emission_uom,
      unit_basis:       f.unit_basis || "",
      valid_from:       f.valid_from || "",
      valid_to:         f.valid_to || "",
      source_note:      f.source_note || "",
    });
    setShowAdd(true);
  };

  const handleSave = async () => {
    if (!form.product_category || !form.emission_factor) {
      toast.error("Product category and emission factor are required");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        product_category: form.product_category,
        emission_factor:  Number(form.emission_factor),
        emission_uom:     form.emission_uom || "kgCO2e",
        unit_basis:       form.unit_basis || null,
        valid_from:       form.valid_from || null,
        valid_to:         form.valid_to || null,
        source_note:      form.source_note || null,
      };
      if (editing) {
        await tenantApi.updateSupplierFactor(editing.factor_id, payload);
        toast.success("Factor updated");
      } else {
        await tenantApi.createSupplierFactor(supplier.supplier_id, payload);
        toast.success("Factor added");
      }
      setShowAdd(false);
      load();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to save factor"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (f: SupplierEmissionFactor) => {
    try {
      await tenantApi.deleteSupplierFactor(f.factor_id);
      toast.success("Factor removed");
      load();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to remove factor"));
    }
  };

  const inputCls = "w-full py-1.5 px-3 text-[13px] text-foreground border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary bg-card";
  const selectCls = "w-full py-1.5 px-3 text-[13px] text-foreground border border-border rounded bg-card focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-[480px] h-full bg-card shadow-2xl border-l border-border flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-[15px] font-bold text-foreground flex items-center gap-2">
              <Gauge size={16} className="text-ok" /> Emission Factors
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{supplier.supplier_name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-sunken">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="border-b border-border px-5 py-4 bg-sunken">
            <p className="text-[12px] font-semibold text-foreground mb-3">{editing ? "Edit Factor" : "Add Factor"}</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="col-span-2">
                <label className="block text-[11px] text-muted-foreground mb-0.5">Product / Material Category <span className="text-destructive">*</span></label>
                <input className={inputCls} placeholder="e.g. Hot-Rolled Steel" value={form.product_category}
                  onChange={(e) => setForm((f) => ({ ...f, product_category: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-0.5">Emission Factor <span className="text-destructive">*</span></label>
                <input className={inputCls} type="number" step="any" placeholder="0.0" value={form.emission_factor}
                  onChange={(e) => setForm((f) => ({ ...f, emission_factor: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-0.5">Unit</label>
                <select className={selectCls} value={form.emission_uom}
                  onChange={(e) => setForm((f) => ({ ...f, emission_uom: e.target.value }))}>
                  <option value="kgCO2e">kgCO₂e</option>
                  <option value="tCO2e">tCO₂e</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] text-muted-foreground mb-0.5">Per (unit basis)</label>
                <input className={inputCls} placeholder="e.g. per kg, per unit, per INR spent" value={form.unit_basis}
                  onChange={(e) => setForm((f) => ({ ...f, unit_basis: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-0.5">Valid From</label>
                <input className={inputCls} type="date" value={form.valid_from}
                  onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground mb-0.5">Valid To</label>
                <input className={inputCls} type="date" value={form.valid_to}
                  onChange={(e) => setForm((f) => ({ ...f, valid_to: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] text-muted-foreground mb-0.5">Source / Notes</label>
                <input className={inputCls} placeholder="e.g. Supplier EPD report, 2025" value={form.source_note}
                  onChange={(e) => setForm((f) => ({ ...f, source_note: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-[12px] text-muted-foreground border border-border rounded hover:bg-sunken">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-3 py-1.5 text-[12px] font-semibold text-white bg-primary hover:bg-primaryDk rounded disabled:opacity-60">
                {saving ? "Saving…" : editing ? "Update" : "Add Factor"}
              </button>
            </div>
          </div>
        )}

        {/* Factor list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {isAdmin && !showAdd && (
            <button onClick={openAdd}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-ok hover:text-emerald-800 mb-3">
              <Plus size={13} /> Add Factor
            </button>
          )}
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-sunken rounded animate-pulse" />)}</div>
          ) : factors.length === 0 ? (
            <div className="text-center py-10">
              <Gauge size={28} className="mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-[13px] text-muted-foreground">No emission factors yet.</p>
              {isAdmin && <p className="text-[11px] text-muted-foreground mt-1">Click "Add Factor" to add the first one.</p>}
            </div>
          ) : (
            <div className="space-y-2">
              {factors.map((f) => (
                <div key={f.factor_id} className="rounded-lg border border-border bg-card px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground">{f.product_category}</p>
                      <p className="text-[12px] text-ok font-mono mt-0.5">
                        {f.emission_factor} {f.emission_uom}{f.unit_basis ? ` / ${f.unit_basis}` : ""}
                      </p>
                      {(f.valid_from || f.valid_to) && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {f.valid_from || "—"} → {f.valid_to || "open"}
                        </p>
                      )}
                      {f.source_note && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate" title={f.source_note}>{f.source_note}</p>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => openEdit(f)} className="p-1 rounded hover:bg-sunken" title="Edit">
                          <Pencil size={12} className="text-muted-foreground" />
                        </button>
                        <button onClick={() => handleDelete(f)} className="p-1 rounded hover:bg-destructive-tint" title="Remove">
                          <Trash2 size={12} className="text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


function RiskBadge({ tier }: { tier: string }) {
  const Icon = RISK_ICON[tier] || Shield;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${RISK_COLOR[tier] || "text-muted-foreground bg-sunken"}`}>
      <Icon size={10} /> {tier}
    </span>
  );
}

function RiskPieChart({ suppliers }: { suppliers: SupplierScorecard[] }) {
  const byRisk: Record<string, number> = {};
  for (const s of suppliers) {
    const tier = s.risk_tier || "UNSET";
    byRisk[tier] = (byRisk[tier] || 0) + s.total_emissions;
  }
  const data = Object.entries(byRisk).map(([tier, emissions]) => ({ tier, emissions: Math.round(emissions * 100) / 100 }));
  if (data.length === 0) {
    return <p className="text-[13px] text-muted-foreground text-center py-8">No data</p>;
  }
  const RISK_FILL: Record<string, string> = { HIGH: "#dc2626", MEDIUM: "#f59e0b", LOW: "#10b981", UNSET: "#94a3b8" };

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="emissions"
          nameKey="tier"
          cx="50%"
          cy="50%"
          outerRadius={90}
          innerRadius={50}
          label={({ tier, percent }: any) => `${tier} ${(percent * 100).toFixed(0)}%`}
        >
          {data.map((d, i) => <Cell key={i} fill={RISK_FILL[d.tier] || "#94a3b8"} />)}
        </Pie>
        <Tooltip formatter={(v: number) => [`${v.toLocaleString()} tCO₂e`, "Emissions"]} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
