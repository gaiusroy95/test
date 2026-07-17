import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Package2, Upload, CheckCircle2, ChevronRight, ChevronDown,
  TrendingUp, TrendingDown, Globe, Library, Users,
  Copy, Plus, Pencil, Trash2, FileUp, AlertCircle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { tenantApi } from "@/api/client";
import { getApiError, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { PageShell } from "@/components/shared/PageShell";
import { StatCard } from "@/components/shared/PageComponents";
import { PageTabs } from "@/components/shared/PageTabs";
import { FormDialog } from "@/components/shared/FormDialog";
import { FormField as WorkspaceField } from "@/components/shared/FormField";
import { FormRow as WorkspaceRow, FormSection } from "@/components/shared/FormWorkspace";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useIsSupportSession } from "@/components/shared/WriteOnly";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthStore } from "@/store/auth";
import type {
  Scope3GHGCategory, Scope3FactorSet, Scope3FactorItem,
  Scope3Batch, Scope3Assignment, Scope3DashboardStats,
} from "@/types";
import type { Location, User } from "@/types";

/* ── Constants ─────────────────────────────────────────────────────────── */

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CATEGORY_COLORS = [
  "#7c3aed", "#8b5cf6", "#a78bfa", "#6d28d9", "#5b21b6",
  "#4c1d95", "#7c3aed", "#8b5cf6", "#a78bfa", "#6d28d9",
  "#5b21b6", "#4c1d95", "#7c3aed", "#8b5cf6", "#a78bfa",
];

type Tab = "overview" | "factors" | "assignments";

/* ── CSV parser ─────────────────────────────────────────────────────────── */

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(field.trim()); field = ""; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field.trim()); field = "";
        if (row.some((c) => c)) rows.push(row);
        row = [];
      } else { field += ch; }
    }
  }
  row.push(field.trim());
  if (row.some((c) => c)) rows.push(row);
  return rows;
}

type CsvPreviewRow = {
  sector_code: string;
  sector_name: string;
  emission_factor: string;
  factor_unit: string;
  ghg_category_id: string;
  valid: boolean;
  error?: string;
};

/* ═══════════════════════════════════════════════════════════════════════ */
/* Main Component                                                         */
/* ═══════════════════════════════════════════════════════════════════════ */

export default function Scope3HubPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isSupport = useIsSupportSession();
  const isAdmin = user?.role === "COMPANY_ADMIN" && !isSupport;
  const canWrite = (isAdmin || user?.role === "LOCATION_USER") && !isSupport;
  const currentYear = new Date().getFullYear();

  const [tab, setTab] = useState<Tab>("overview");

  /* ── Overview state ── */
  const [reportingYear, setReportingYear] = useState(currentYear);
  const [stats, setStats] = useState<Scope3DashboardStats | null>(null);
  const [recentBatches, setRecentBatches] = useState<Scope3Batch[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  /* ── Factor Sets state ── */
  const [librarySets, setLibrarySets] = useState<Scope3FactorSet[]>([]);
  const [companySets, setCompanySets] = useState<Scope3FactorSet[]>([]);
  const [expandedSetId, setExpandedSetId] = useState<string | null>(null);
  const [setItems, setSetItems] = useState<Record<string, Scope3FactorItem[]>>({});
  const [loadingFactors, setLoadingFactors] = useState(false);
  const [pulling, setPulling] = useState<string | null>(null);
  const [categories, setCategories] = useState<Scope3GHGCategory[]>([]);

  /* ── Factor Set form state ── */
  const [factorSetFormOpen, setFactorSetFormOpen] = useState(false);
  const [editingFactorSet, setEditingFactorSet] = useState<Scope3FactorSet | null>(null);
  const [savingFactorSet, setSavingFactorSet] = useState(false);

  /* ── Factor Item form state ── */
  const [itemFormSetId, setItemFormSetId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<Scope3FactorItem | null>(null);
  const [savingItem, setSavingItem] = useState(false);
  const [deleteItemConfirm, setDeleteItemConfirm] = useState<{ setId: string; itemId: string } | null>(null);

  /* ── CSV import state ── */
  const [csvImportSetId, setCsvImportSetId] = useState<string | null>(null);
  const [csvPreviewRows, setCsvPreviewRows] = useState<CsvPreviewRow[] | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);

  /* ── Assignments state ── */
  const [assignments, setAssignments] = useState<Scope3Assignment[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [createAssignOpen, setCreateAssignOpen] = useState(false);
  const [deleteAssignId, setDeleteAssignId] = useState<string | null>(null);

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  /* ── Data fetching ── */
  useEffect(() => { fetchOverview(); }, [reportingYear]);
  useEffect(() => {
    if (tab === "factors") fetchFactorSets();
    if (tab === "assignments") fetchAssignments();
  }, [tab]);

  const fetchOverview = async () => {
    setLoadingStats(true);
    try {
      const [statsRes, batchRes] = await Promise.all([
        tenantApi.scope3Dashboard(reportingYear),
        tenantApi.listScope3Batches({ reporting_year: reportingYear, size: 10 }),
      ]);
      setStats(statsRes.data);
      setRecentBatches(batchRes.data.items);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to load Scope 3 data"));
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchFactorSets = async () => {
    setLoadingFactors(true);
    try {
      const [libRes, compRes, catRes] = await Promise.all([
        tenantApi.listScope3LibrarySets(),
        tenantApi.listScope3CompanySets(),
        tenantApi.listScope3Categories(),
      ]);
      setLibrarySets(libRes.data);
      setCompanySets(compRes.data);
      setCategories(catRes.data);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to load factor sets"));
    } finally {
      setLoadingFactors(false);
    }
  };

  const fetchAssignments = async () => {
    try {
      const [aRes, cRes, lRes, uRes] = await Promise.all([
        tenantApi.listScope3Assignments(),
        tenantApi.listScope3Categories(),
        tenantApi.listLocations(),
        tenantApi.listUsers(),
      ]);
      setAssignments(aRes.data);
      setCategories(cRes.data);
      setLocations(lRes.data.items ?? lRes.data ?? []);
      const allUsers: User[] = uRes.data.items ?? uRes.data ?? [];
      setUsers(allUsers.filter((u: User) => u.role === "LOCATION_USER" || u.role === "COMPANY_ADMIN"));
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to load assignments"));
    }
  };

  /* ── Factor set actions ── */
  const handlePull = async (sourceSetId: string, setName: string) => {
    setPulling(sourceSetId);
    try {
      await tenantApi.pullScope3FactorSet({ source_set_id: sourceSetId, set_name: setName });
      toast.success("Factor set pulled to your company");
      fetchFactorSets();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to pull factor set"));
    } finally {
      setPulling(null);
    }
  };

  const toggleExpandSet = async (setId: string) => {
    if (expandedSetId === setId) { setExpandedSetId(null); return; }
    setExpandedSetId(setId);
    if (!setItems[setId]) {
      try {
        const res = await tenantApi.listScope3FactorItems(setId);
        setSetItems((prev) => ({ ...prev, [setId]: res.data }));
      } catch (err: any) {
        toast.error(getApiError(err, "Failed to load items"));
      }
    }
  };

  const handleSaveFactorSet = async (data: Record<string, any>) => {
    setSavingFactorSet(true);
    try {
      const payload = {
        set_name: data.set_name,
        source_name: data.source_name || null,
        dataset_year: data.dataset_year ? Number(data.dataset_year) : null,
        currency_code: data.currency_code || null,
        methodology: data.methodology || null,
        version: data.version || null,
      };
      if (editingFactorSet) {
        await tenantApi.updateScope3CompanyFactorSet(editingFactorSet.factor_set_id, payload);
        toast.success("Factor set updated");
      } else {
        await tenantApi.createScope3CompanyFactorSet(payload);
        toast.success("Factor set created");
      }
      setFactorSetFormOpen(false);
      setEditingFactorSet(null);
      fetchFactorSets();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to save factor set"));
    } finally {
      setSavingFactorSet(false);
    }
  };

  const handleSaveItem = async (data: Record<string, any>) => {
    if (!itemFormSetId) return;
    setSavingItem(true);
    const setId = itemFormSetId;
    try {
      const payload = {
        ghg_category_id: Number(data.ghg_category_id),
        sector_name: data.sector_name,
        emission_factor: Number(data.emission_factor),
        sector_code: data.sector_code || null,
        factor_unit: data.factor_unit || null,
      };
      if (editingItem) {
        await tenantApi.updateScope3FactorItem(setId, editingItem.factor_item_id, payload);
        toast.success("Item updated");
      } else {
        await tenantApi.createScope3FactorItem(setId, payload);
        toast.success("Item added");
      }
      setItemFormSetId(null);
      setEditingItem(null);
      const res = await tenantApi.listScope3FactorItems(setId);
      setSetItems((prev) => ({ ...prev, [setId]: res.data }));
      fetchFactorSets();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to save item"));
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteItemConfirm) return;
    const { setId, itemId } = deleteItemConfirm;
    try {
      await tenantApi.deleteScope3FactorItem(setId, itemId);
      toast.success("Item deleted");
      const res = await tenantApi.listScope3FactorItems(setId);
      setSetItems((prev) => ({ ...prev, [setId]: res.data }));
      fetchFactorSets();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to delete item"));
    } finally {
      setDeleteItemConfirm(null);
    }
  };

  const handleCSVFileSelect = (setId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length < 2) { toast.error("CSV has no data rows"); return; }
      const header = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, "_"));
      const codeIdx  = header.findIndex((h) => h.includes("sector_code") || h === "code");
      const nameIdx  = header.findIndex((h) => h.includes("sector_name") || h === "name");
      const factorIdx = header.findIndex((h) => h.includes("emission_factor") || h === "factor");
      const unitIdx  = header.findIndex((h) => h.includes("factor_unit") || h === "unit");
      const catIdx   = header.findIndex((h) => h.includes("ghg_category_id") || h.includes("category_id"));
      if (nameIdx < 0 || factorIdx < 0) {
        toast.error("CSV must have sector_name and emission_factor columns");
        return;
      }
      const preview: CsvPreviewRow[] = rows.slice(1).map((r) => {
        const sectorName = r[nameIdx] || "";
        const factorRaw = r[factorIdx] || "";
        const factorNum = parseFloat(factorRaw);
        const errors: string[] = [];
        if (!sectorName) errors.push("sector_name required");
        if (isNaN(factorNum) || factorNum <= 0) errors.push("emission_factor must be > 0");
        return {
          sector_code: codeIdx >= 0 ? r[codeIdx] || "" : "",
          sector_name: sectorName,
          emission_factor: factorRaw,
          factor_unit: unitIdx >= 0 ? r[unitIdx] || "" : "",
          ghg_category_id: catIdx >= 0 ? r[catIdx] || "" : "",
          valid: errors.length === 0,
          error: errors.join("; "),
        };
      });
      setCsvImportSetId(setId);
      setCsvPreviewRows(preview);
    };
    reader.readAsText(file);
  };

  const handleConfirmCSVImport = async () => {
    if (!csvImportSetId || !csvPreviewRows) return;
    const validRows = csvPreviewRows.filter((r) => r.valid);
    if (validRows.length === 0) return;
    setCsvImporting(true);
    const setId = csvImportSetId;
    let imported = 0;
    try {
      for (const r of validRows) {
        await tenantApi.createScope3FactorItem(setId, {
          ghg_category_id: r.ghg_category_id ? Number(r.ghg_category_id) : 1,
          sector_name: r.sector_name,
          emission_factor: parseFloat(r.emission_factor),
          sector_code: r.sector_code || null,
          factor_unit: r.factor_unit || null,
        });
        imported++;
      }
      toast.success(`Imported ${imported} items`);
      const res = await tenantApi.listScope3FactorItems(setId);
      setSetItems((prev) => ({ ...prev, [setId]: res.data }));
      fetchFactorSets();
      setCsvPreviewRows(null);
      setCsvImportSetId(null);
    } catch (err: any) {
      if (imported > 0) toast.success(`Imported ${imported} of ${validRows.length} items`);
      toast.error(getApiError(err, "Import stopped early"));
    } finally {
      setCsvImporting(false);
    }
  };

  /* ── Assignment actions ── */
  const handleCreateAssignment = async (data: Record<string, any>) => {
    try {
      const none = (v: any) => (!v || v === "__none__" ? null : v);
      await tenantApi.createScope3Assignment({
        ghg_category_id: Number(data.ghg_category_id),
        location_id: none(data.location_id),
        assigned_to: none(data.assigned_to),
        factor_set_id: none(data.factor_set_id),
        entry_type: data.entry_type || "ACTIVITY",
      });
      toast.success("Assignment created");
      setCreateAssignOpen(false);
      fetchAssignments();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to create assignment"));
    }
  };

  const handleDeleteAssignment = async () => {
    if (!deleteAssignId) return;
    try {
      await tenantApi.deleteScope3Assignment(deleteAssignId);
      toast.success("Assignment deleted");
      setDeleteAssignId(null);
      fetchAssignments();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to delete"));
    }
  };

  /* ── Derived data ── */
  const chartData = (stats?.by_category || [])
    .filter((c) => c.emissions > 0)
    .sort((a, b) => b.emissions - a.emissions)
    .slice(0, 10);

  const tabs: { key: Tab; label: string; icon: any; hidden?: boolean }[] = [
    { key: "overview", label: "Overview", icon: Package2 },
    { key: "factors", label: "Factor Sets", icon: Library, hidden: !isAdmin },
    { key: "assignments", label: "Assignments", icon: Users, hidden: !isAdmin },
  ];

  /* ═══ RENDER ═══════════════════════════════════════════════════════════ */
  const pageActions = (
    <div className="flex items-center gap-2">
      {tab === "overview" && (
        <Select value={String(reportingYear)} onValueChange={(value) => setReportingYear(Number(value))}>
          <SelectTrigger className="w-[120px] h-8 text-[13px]">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {yearOptions.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      {tab === "factors" && isAdmin && (
        <Button
          size="sm"
          onClick={() => { setEditingFactorSet(null); setFactorSetFormOpen(true); }}
        >
          <Plus size={14} /> Create Factor Set
        </Button>
      )}
      {canWrite && (
        <Button
          size="sm"
          onClick={() => navigate("/app/scope3/data")}
        >
          <Upload size={14} /> Enter Data
        </Button>
      )}
    </div>
  );

  return (
    <PageShell
      title="Scope 3 Emissions"
      description="GHG Protocol Scope 3 upstream and downstream value chain emissions."
      breadcrumb={[{ label: "Company Portal", href: "/app" }, { label: "Scope 3" }]}
      actions={pageActions}
      toolbar={
        <PageTabs
          value={tab}
          onChange={(key) => setTab(key as Tab)}
          tabs={tabs.filter((t) => !t.hidden).map((t) => ({ key: t.key, label: t.label, icon: <t.icon size={14} /> }))}
        />
      }
    >

      {/* ── Content ── */}
      {tab === "overview" && <OverviewTab stats={stats} chartData={chartData} recentBatches={recentBatches} loading={loadingStats} reportingYear={reportingYear} navigate={navigate} />}
      {tab === "factors" && (
        <FactorSetsTab
          librarySets={librarySets}
          companySets={companySets}
          expandedSetId={expandedSetId}
          setItems={setItems}
          loading={loadingFactors}
          pulling={pulling}
          isAdmin={isAdmin}
          companyId={user?.company_id}
          categories={categories}
          onPull={handlePull}
          onToggleExpand={toggleExpandSet}
          onEditSet={(fs) => { setEditingFactorSet(fs); setFactorSetFormOpen(true); }}
          onAddItem={(setId) => { setItemFormSetId(setId); setEditingItem(null); }}
          onEditItem={(setId, item) => { setItemFormSetId(setId); setEditingItem(item); }}
          onDeleteItem={(setId, itemId) => setDeleteItemConfirm({ setId, itemId })}
          onCSVFileSelect={handleCSVFileSelect}
        />
      )}
      {tab === "assignments" && (
        <AssignmentsTab
          assignments={assignments}
          isAdmin={isAdmin}
          onCreateOpen={() => setCreateAssignOpen(true)}
          onDelete={(id) => setDeleteAssignId(id)}
        />
      )}

      {/* ── Factor Set Form ── */}
      {factorSetFormOpen && (
        <FactorSetFormModal
          open={factorSetFormOpen}
          editing={editingFactorSet}
          saving={savingFactorSet}
          onClose={() => { setFactorSetFormOpen(false); setEditingFactorSet(null); }}
          onSave={handleSaveFactorSet}
        />
      )}

      {/* ── Factor Item Form ── */}
      {itemFormSetId && (
        <FactorItemFormModal
          open={!!itemFormSetId}
          editing={editingItem}
          saving={savingItem}
          categories={categories}
          onClose={() => { setItemFormSetId(null); setEditingItem(null); }}
          onSave={handleSaveItem}
        />
      )}

      {/* ── CSV Preview Modal ── */}
      {csvPreviewRows && (
        <CSVItemPreviewModal
          rows={csvPreviewRows}
          categories={categories}
          importing={csvImporting}
          onClose={() => { setCsvPreviewRows(null); setCsvImportSetId(null); }}
          onConfirm={handleConfirmCSVImport}
        />
      )}

      {/* ── Delete Item Confirm ── */}
      <ConfirmDialog
        open={!!deleteItemConfirm}
        onClose={() => setDeleteItemConfirm(null)}
        onConfirm={handleDeleteItem}
        title="Delete Factor Item"
        message="Are you sure you want to remove this factor item? This cannot be undone."
        variant="destructive"
      />

      {/* ── Create/Delete Assignment ── */}
      {createAssignOpen && (
        <FormDialog
          open={createAssignOpen}
          onClose={() => setCreateAssignOpen(false)}
          onSubmit={handleCreateAssignment}
          title="Assign Scope 3 Category"
          description="Assign a GHG category to a location and optionally a specific user."
          fields={[
            {
              key: "ghg_category_id", label: "GHG Category", required: true, type: "select",
              options: categories.map((c) => ({ value: String(c.category_id), label: `${c.code} · ${c.name}` })),
            },
            {
              key: "location_id", label: "Location (optional — blank = all locations)", type: "select",
              options: [{ value: "__none__", label: "All locations" }, ...locations.map((l) => ({ value: l.location_id, label: l.location_name }))],
            },
            {
              key: "assigned_to", label: "Assigned User (optional)", type: "select",
              options: [{ value: "__none__", label: "Any eligible user" }, ...users.map((u) => ({ value: u.user_id, label: `${u.first_name} ${u.last_name}` }))],
            },
            {
              key: "factor_set_id", label: "Factor Set (optional)", type: "select",
              options: [{ value: "__none__", label: "None" }, ...companySets.map((s) => ({ value: s.factor_set_id, label: s.set_name }))],
            },
            {
              key: "entry_type", label: "Default Entry Type", type: "select",
              options: [
                { value: "ACTIVITY", label: "Activity-Based" },
                { value: "SPEND", label: "Spend-Based" },
                { value: "ESTIMATE", label: "Estimate" },
              ],
            },
          ]}
          submitLabel="Assign"
        />
      )}

      <ConfirmDialog
        open={!!deleteAssignId}
        onClose={() => setDeleteAssignId(null)}
        onConfirm={handleDeleteAssignment}
        title="Delete Assignment"
        message="Are you sure you want to remove this category assignment?"
        variant="destructive"
      />
    </PageShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* Tab 1: Overview                                                        */
/* ═══════════════════════════════════════════════════════════════════════ */

function OverviewTab({ stats, chartData, recentBatches, loading, reportingYear, navigate }: {
  stats: Scope3DashboardStats | null;
  chartData: Scope3DashboardStats["by_category"];
  recentBatches: Scope3Batch[];
  loading: boolean;
  reportingYear: number;
  navigate: (path: string) => void;
}) {
  return (
    <>
      {/* KPI cards */}
      <div className="card-grid mb-4">
        <StatCard label="Total Scope 3" value={stats ? `${stats.total_emissions.toLocaleString("en-IN", { maximumFractionDigits: 2 })} tCO₂e` : "—"} icon={Globe} loading={loading} color="violet" />
        <StatCard label="Upstream" value={stats ? `${stats.upstream_emissions.toLocaleString("en-IN", { maximumFractionDigits: 2 })} tCO₂e` : "—"} icon={TrendingUp} loading={loading} color="amber" sub="C01–C08" />
        <StatCard label="Downstream" value={stats ? `${stats.downstream_emissions.toLocaleString("en-IN", { maximumFractionDigits: 2 })} tCO₂e` : "—"} icon={TrendingDown} loading={loading} color="sky" sub="C09–C15" />
        <StatCard label="Approved Batches" value={stats ? String(stats.approved_batch_count) : "—"} icon={CheckCircle2} loading={loading} color="green" sub={stats ? `${stats.pending_batch_count} pending` : undefined} />
      </div>

      <div className="card-grid-2">
        {/* Chart */}
        <div className="summary-panel">
          <div className="summary-panel-header">
            <h2 className="section-title">Emissions by Category</h2>
            <span className="card-meta">APPROVED batches · tCO₂e</span>
          </div>
          <div className="summary-panel-body">
          {loading ? (
            <div className="h-48 flex items-center justify-center text-[13px] text-muted-foreground">Loading…</div>
          ) : chartData.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-[13px] text-muted-foreground">
              <Package2 size={28} className="text-muted-foreground/40" />
              No approved data for {reportingYear} yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" tickFormatter={(v) => v.toLocaleString("en-IN")} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="category_code" width={36} tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => [`${v.toLocaleString("en-IN")} tCO₂e`, "Emissions"]}
                  labelFormatter={(label) => { const c = chartData.find((d) => d.category_code === label); return c ? `${c.category_code} · ${c.category_name}` : label; }}
                  contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #e2e8f0" }}
                />
                <Bar dataKey="emissions" radius={[0, 3, 3, 0]} maxBarSize={18}>
                  {chartData.map((_, idx) => <Cell key={idx} fill={CATEGORY_COLORS[idx % CATEGORY_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          </div>
        </div>

        {/* Recent batches */}
        <div className="summary-panel">
          <div className="summary-panel-header">
            <h2 className="section-title">Recent Batches</h2>
            <button onClick={() => navigate("/app/scope3/data")} className="text-[11px] text-primary hover:underline flex items-center gap-0.5">
              View all <ChevronRight size={12} />
            </button>
          </div>
          <div className="summary-panel-body">
          {loading ? (
            <div className="text-[13px] text-muted-foreground text-center py-8">Loading…</div>
          ) : recentBatches.length === 0 ? (
            <div className="text-[13px] text-muted-foreground text-center py-8">No batches yet. Start entering Scope 3 data.</div>
          ) : (
            <div className="space-y-2">
              {recentBatches.map((b) => (
                <button key={b.batch_id} onClick={() => navigate(`/app/scope3/data?batch=${b.batch_id}`)} className="w-full text-left p-2.5 rounded-md border border-[hsl(var(--border-hairline))] hover:border-primary/30 hover:bg-accent/30 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-semibold text-foreground truncate max-w-[180px]">{b.ghg_category_name}</span>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>{b.reporting_year}{b.reporting_month ? ` · ${MONTH_NAMES[b.reporting_month]}` : ""}</span>
                    {b.total_emissions != null && <span className="text-accent-foreground font-medium">{b.total_emissions.toLocaleString("en-IN", { maximumFractionDigits: 2 })} tCO₂e</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* Tab 2: Factor Sets                                                     */
/* ═══════════════════════════════════════════════════════════════════════ */

function FactorSetsTab({
  librarySets, companySets, expandedSetId, setItems, loading, pulling,
  isAdmin, companyId, categories,
  onPull, onToggleExpand, onEditSet, onAddItem, onEditItem, onDeleteItem, onCSVFileSelect,
}: {
  librarySets: Scope3FactorSet[];
  companySets: Scope3FactorSet[];
  expandedSetId: string | null;
  setItems: Record<string, Scope3FactorItem[]>;
  loading: boolean;
  pulling: string | null;
  isAdmin: boolean;
  companyId?: string;
  categories: Scope3GHGCategory[];
  onPull: (id: string, name: string) => void;
  onToggleExpand: (id: string) => void;
  onEditSet: (fs: Scope3FactorSet) => void;
  onAddItem: (setId: string) => void;
  onEditItem: (setId: string, item: Scope3FactorItem) => void;
  onDeleteItem: (setId: string, itemId: string) => void;
  onCSVFileSelect: (setId: string, file: File) => void;
}) {
  if (loading) return <div className="text-[13px] text-muted-foreground text-center py-12">Loading factor sets…</div>;

  return (
    <div className="space-y-6">
      {/* Platform Library */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Library size={15} className="text-accent-foreground" />
          <h2 className="text-[14px] font-semibold text-foreground">Platform Factor Library</h2>
          <span className="text-[11px] text-muted-foreground">Browse and pull standard datasets to your company</span>
        </div>
        {librarySets.length === 0 ? (
          <div className="text-[13px] text-muted-foreground py-6 text-center border border-dashed border-border rounded-lg">
            No library datasets available from platform yet.
          </div>
        ) : (
          <div className="space-y-2">
            {librarySets.map((fs) => (
              <FactorSetCard
                key={fs.factor_set_id}
                fs={fs}
                isLibrary
                expanded={expandedSetId === fs.factor_set_id}
                items={setItems[fs.factor_set_id]}
                pulling={pulling === fs.factor_set_id}
                categories={categories}
                onToggle={() => onToggleExpand(fs.factor_set_id)}
                onPull={() => onPull(fs.factor_set_id, fs.set_name)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Company's own sets */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Package2 size={15} className="text-foreground" />
          <h2 className="text-[14px] font-semibold text-foreground">My Company Factor Sets</h2>
          <span className="text-[11px] text-muted-foreground">Pulled or custom — used by your assignments</span>
        </div>
        {companySets.length === 0 ? (
          <div className="text-[13px] text-muted-foreground py-6 text-center border border-dashed border-border rounded-lg">
            No factor sets yet. Pull from the library above, or create a custom set.
          </div>
        ) : (
          <div className="space-y-2">
            {companySets.map((fs) => {
              const isOwned = !fs.is_system && fs.company_id === companyId;
              return (
                <FactorSetCard
                  key={fs.factor_set_id}
                  fs={fs}
                  expanded={expandedSetId === fs.factor_set_id}
                  items={setItems[fs.factor_set_id]}
                  canManage={isAdmin && isOwned}
                  categories={categories}
                  onToggle={() => onToggleExpand(fs.factor_set_id)}
                  onEdit={isAdmin && isOwned ? () => onEditSet(fs) : undefined}
                  onAddItem={isAdmin && isOwned ? () => onAddItem(fs.factor_set_id) : undefined}
                  onEditItem={isAdmin && isOwned ? (item) => onEditItem(fs.factor_set_id, item) : undefined}
                  onDeleteItem={isAdmin && isOwned ? (itemId) => onDeleteItem(fs.factor_set_id, itemId) : undefined}
                  onCSVFileSelect={isAdmin && isOwned ? (file) => onCSVFileSelect(fs.factor_set_id, file) : undefined}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FactorSetCard({
  fs, isLibrary, expanded, items, pulling, canManage, categories,
  onToggle, onPull, onEdit, onAddItem, onEditItem, onDeleteItem, onCSVFileSelect,
}: {
  fs: Scope3FactorSet;
  isLibrary?: boolean;
  expanded: boolean;
  items?: Scope3FactorItem[];
  pulling?: boolean;
  canManage?: boolean;
  categories: Scope3GHGCategory[];
  onToggle: () => void;
  onPull?: () => void;
  onEdit?: () => void;
  onAddItem?: () => void;
  onEditItem?: (item: Scope3FactorItem) => void;
  onDeleteItem?: (itemId: string) => void;
  onCSVFileSelect?: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getCategoryName = (catId: number) => {
    const cat = categories.find((c) => c.category_id === catId);
    return cat ? `${cat.code}` : String(catId);
  };

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={onToggle} className="text-muted-foreground hover:text-muted-foreground">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-foreground">{fs.set_name}</span>
            {isLibrary && <span className="text-[10px] bg-accent text-accent-foreground px-1.5 py-0.5 rounded font-medium">Library</span>}
            {fs.source_set_id && <span className="text-[10px] bg-sky-100 text-info px-1.5 py-0.5 rounded font-medium">Pulled</span>}
            {!isLibrary && !fs.source_set_id && !fs.is_system && <span className="text-[10px] bg-ok-tint text-ok px-1.5 py-0.5 rounded font-medium">Custom</span>}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-3">
            {fs.source_name && <span>{fs.source_name}</span>}
            {fs.dataset_year && <span>{fs.dataset_year}</span>}
            {fs.methodology && <span>{fs.methodology}</span>}
            {fs.currency_code && <span>{fs.currency_code}</span>}
            <span>{fs.item_count} items</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isLibrary && onPull && (
            <Button
              onClick={onPull}
              disabled={pulling}
              variant="outline"
              className="text-[12px] h-7 px-2.5 flex items-center gap-1"
            >
              <Copy size={12} /> {pulling ? "Pulling…" : "Pull to My Sets"}
            </Button>
          )}
          {canManage && onEdit && (
            <button onClick={onEdit} className="text-muted-foreground hover:text-muted-foreground p-1" title="Edit set details">
              <Pencil size={14} />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[hsl(var(--border-hairline))]">
          {/* Action bar for manageable sets */}
          {canManage && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-sunken/60 border-b border-[hsl(var(--border-hairline))]">
              <button
                onClick={onAddItem}
                className="flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primaryDk transition-colors"
              >
                <Plus size={13} /> Add Item Manually
              </button>
              <span className="text-muted-foreground/40 text-[11px]">·</span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <FileUp size={13} /> Bulk Import CSV
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && onCSVFileSelect) onCSVFileSelect(file);
                  e.target.value = "";
                }}
              />
            </div>
          )}

          {/* Items table */}
          <div className="px-4 py-3">
            {!items ? (
              <div className="text-[12px] text-muted-foreground py-4 text-center">Loading items…</div>
            ) : items.length === 0 ? (
              <div className="text-[12px] text-muted-foreground py-4 text-center">
                {canManage ? "No items yet. Add one manually or import via CSV." : "No items in this set."}
              </div>
            ) : (
              <div className="overflow-auto max-h-[360px]">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-[hsl(var(--border-hairline))]">
                      <th className="text-left py-1.5 px-2">Category</th>
                      <th className="text-left py-1.5 px-2">Sector Code</th>
                      <th className="text-left py-1.5 px-2">Sector Name</th>
                      <th className="text-right py-1.5 px-2">Factor</th>
                      <th className="text-left py-1.5 px-2">Unit</th>
                      {canManage && <th className="py-1.5 px-2 w-16" />}
                    </tr>
                  </thead>
                  <tbody>
                    {items.slice(0, 100).map((item) => (
                      <tr key={item.factor_item_id} className="border-b border-[hsl(var(--border-hairline))] hover:bg-sunken group">
                        <td className="py-1.5 px-2 text-accent-foreground font-medium text-[11px]">{getCategoryName(item.ghg_category_id)}</td>
                        <td className="py-1.5 px-2 text-muted-foreground font-mono">{item.sector_code || "—"}</td>
                        <td className="py-1.5 px-2 text-foreground">{item.sector_name}</td>
                        <td className="py-1.5 px-2 text-right font-medium">{item.emission_factor}</td>
                        <td className="py-1.5 px-2 text-muted-foreground">{item.factor_unit || "—"}</td>
                        {canManage && (
                          <td className="py-1.5 px-2">
                            <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => onEditItem?.(item)} className="text-muted-foreground hover:text-muted-foreground p-0.5">
                                <Pencil size={12} />
                              </button>
                              <button onClick={() => onDeleteItem?.(item.factor_item_id)} className="text-muted-foreground hover:text-destructive p-0.5">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {items.length > 100 && <div className="text-[11px] text-muted-foreground text-center py-2">Showing first 100 of {items.length} items</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* Factor Set Form Modal                                                  */
/* ═══════════════════════════════════════════════════════════════════════ */

function FactorSetFormModal({ open, editing, saving, onClose, onSave }: {
  open: boolean;
  editing: Scope3FactorSet | null;
  saving: boolean;
  onClose: () => void;
  onSave: (data: Record<string, any>) => void;
}) {
  const [form, setForm] = useState({
    set_name: editing?.set_name || "",
    source_name: editing?.source_name || "",
    dataset_year: editing?.dataset_year ? String(editing.dataset_year) : "",
    currency_code: editing?.currency_code || "",
    methodology: editing?.methodology || "",
    version: editing?.version || "",
  });

  if (!open) return null;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <Sheet open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <SheetContent size="wide">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit Factor Set" : "Create Custom Factor Set"}</SheetTitle>
          <p className="text-[11px] text-muted-foreground mt-0.5">Define your company-specific emission factor dataset</p>
        </SheetHeader>
        <SheetBody className="space-y-5">
          <FormSection title="Dataset Metadata" description="Set the source, year, and methodology for this custom factor set">
            <WorkspaceField label="Set Name" required>
              <input value={form.set_name} onChange={set("set_name")} placeholder="e.g. Company Spend Factors 2025" className="field-input" />
            </WorkspaceField>
            <WorkspaceRow cols={2} className="mt-4">
              <WorkspaceField label="Source / Publisher">
                <input value={form.source_name} onChange={set("source_name")} placeholder="e.g. EEIO, ecoinvent" className="field-input" />
              </WorkspaceField>
              <WorkspaceField label="Dataset Year">
                <input type="number" value={form.dataset_year} onChange={set("dataset_year")} placeholder="e.g. 2023" min="2000" max="2100" className="field-input" />
              </WorkspaceField>
            </WorkspaceRow>
            <WorkspaceRow cols={2} className="mt-4">
              <WorkspaceField label="Currency">
                <Select value={form.currency_code || "__none__"} onValueChange={(value) => setForm((p) => ({ ...p, currency_code: value === "__none__" ? "" : value }))}>
                  <SelectTrigger><SelectValue placeholder="Not applicable" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not applicable</SelectItem>
                    <SelectItem value="INR">INR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="SGD">SGD</SelectItem>
                  </SelectContent>
                </Select>
              </WorkspaceField>
              <WorkspaceField label="Version">
                <input value={form.version} onChange={set("version")} placeholder="e.g. v2.1" className="field-input" />
              </WorkspaceField>
            </WorkspaceRow>
            <WorkspaceField label="Methodology" className="mt-4">
              <input value={form.methodology} onChange={set("methodology")} placeholder="e.g. Spend-based, Activity-based, Hybrid" className="field-input" />
            </WorkspaceField>
          </FormSection>
        </SheetBody>
        <SheetFooter>
          <Button variant="outline" onClick={onClose} className="h-8 text-[13px]">Cancel</Button>
          <Button
            onClick={() => { if (form.set_name.trim()) onSave(form); else toast.error("Set name is required"); }}
            disabled={saving || !form.set_name.trim()}
            className="bg-primary hover:bg-primaryDk text-white h-8 text-[13px]"
          >
            {saving ? "Saving…" : editing ? "Save Changes" : "Create Set"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* Factor Item Form Modal                                                 */
/* ═══════════════════════════════════════════════════════════════════════ */

function FactorItemFormModal({ open, editing, saving, categories, onClose, onSave }: {
  open: boolean;
  editing: Scope3FactorItem | null;
  saving: boolean;
  categories: Scope3GHGCategory[];
  onClose: () => void;
  onSave: (data: Record<string, any>) => void;
}) {
  const [form, setForm] = useState({
    ghg_category_id: editing ? String(editing.ghg_category_id) : (categories[0] ? String(categories[0].category_id) : ""),
    sector_code: editing?.sector_code || "",
    sector_name: editing?.sector_name || "",
    emission_factor: editing ? String(editing.emission_factor) : "",
    factor_unit: editing?.factor_unit || "kgCO2e/INR",
  });

  if (!open) return null;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const factorNum = parseFloat(form.emission_factor);
  const valid = form.sector_name.trim() && !isNaN(factorNum) && factorNum > 0 && form.ghg_category_id;

  const selectedCat = categories.find((c) => String(c.category_id) === form.ghg_category_id);

  return (
    <Sheet open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <SheetContent size="wide">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit Factor Item" : "Add Factor Item"}</SheetTitle>
          <p className="text-[11px] text-muted-foreground mt-0.5">Define an emission factor for a sector or spend category</p>
        </SheetHeader>
        <SheetBody className="space-y-5">
          <FormSection title="Factor Details" description="Map this factor to the correct GHG category and calculation unit">
            <WorkspaceField label="GHG Category" required>
              <Select value={form.ghg_category_id} onValueChange={(value) => setForm((p) => ({ ...p, ghg_category_id: value }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.category_id} value={String(c.category_id)}>
                      {c.code} · {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCat && <p className="text-[11px] text-muted-foreground mt-1">{selectedCat.description}</p>}
            </WorkspaceField>
            <WorkspaceRow cols={2} className="mt-4">
              <WorkspaceField label="Sector Code">
                <input value={form.sector_code} onChange={set("sector_code")} placeholder="e.g. 3210, IO-42" className="field-input" />
              </WorkspaceField>
              <WorkspaceField label="Factor Unit">
                <Select value={form.factor_unit} onValueChange={(value) => setForm((p) => ({ ...p, factor_unit: value }))}>
                  <SelectTrigger><SelectValue placeholder="Select factor unit" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kgCO2e/INR">kgCO₂e / INR</SelectItem>
                    <SelectItem value="tCO2e/INR">tCO₂e / INR</SelectItem>
                    <SelectItem value="kgCO2e/USD">kgCO₂e / USD</SelectItem>
                    <SelectItem value="tCO2e/USD">tCO₂e / USD</SelectItem>
                    <SelectItem value="kgCO2e/kg">kgCO₂e / kg</SelectItem>
                    <SelectItem value="tCO2e/tonne">tCO₂e / tonne</SelectItem>
                    <SelectItem value="kgCO2e/km">kgCO₂e / km</SelectItem>
                    <SelectItem value="kgCO2e/tkm">kgCO₂e / tonne-km</SelectItem>
                    <SelectItem value="tCO2e/unit">tCO₂e / unit</SelectItem>
                  </SelectContent>
                </Select>
              </WorkspaceField>
            </WorkspaceRow>
            <WorkspaceField label="Sector / Category Name" required className="mt-4">
              <input value={form.sector_name} onChange={set("sector_name")} placeholder="e.g. Steel manufacturing, Passenger transport" className="field-input" />
            </WorkspaceField>
            <WorkspaceField label="Emission Factor" required className="mt-4">
              <input type="number" value={form.emission_factor} onChange={set("emission_factor")} placeholder="e.g. 0.00482" min="0" step="any" className="field-input" />
            </WorkspaceField>
            {!isNaN(factorNum) && factorNum > 0 && (
              <div className="mt-4 bg-accent border border-accent-foreground/20 rounded-md px-3 py-2.5">
                <p className="text-[11px] text-accent-foreground font-semibold uppercase tracking-wide mb-1">Factor Preview</p>
                <p className="text-[12px] text-accent-foreground">
                  1,000 × spend/quantity → <span className="font-bold">{(factorNum * 1000).toLocaleString("en-IN", { maximumFractionDigits: 4 })}</span> tCO₂e
                </p>
                <p className="text-[11px] text-violet-500 mt-0.5">Unit: {form.factor_unit}</p>
              </div>
            )}
          </FormSection>
        </SheetBody>
        <SheetFooter>
          <Button variant="outline" onClick={onClose} className="h-8 text-[13px]">Cancel</Button>
          <Button
            onClick={() => { if (valid) onSave(form); }}
            disabled={saving || !valid}
            className="bg-primary hover:bg-primaryDk text-white h-8 text-[13px]"
          >
            {saving ? "Saving…" : editing ? "Save Changes" : "Add Item"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* CSV Item Preview Modal                                                 */
/* ═══════════════════════════════════════════════════════════════════════ */

function CSVItemPreviewModal({ rows, categories, importing, onClose, onConfirm }: {
  rows: CsvPreviewRow[];
  categories: Scope3GHGCategory[];
  importing: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const validCount = rows.filter((r) => r.valid).length;
  const errorCount = rows.length - validCount;

  const getCatLabel = (idStr: string) => {
    if (!idStr) return "—";
    const cat = categories.find((c) => String(c.category_id) === idStr);
    return cat ? cat.code : idStr;
  };

  return (
    <Sheet open onOpenChange={(value) => { if (!value) onClose(); }}>
      <SheetContent size="xl">
        <SheetHeader>
          <SheetTitle>CSV Import Preview</SheetTitle>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            <span className="text-ok font-semibold">{validCount} valid</span>
            {errorCount > 0 && <span className="text-destructive font-semibold ml-2">{errorCount} with errors (will be skipped)</span>}
            {" "}· {rows.length} rows total
          </p>
        </SheetHeader>
        <SheetBody className="overflow-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-card">
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
                <th className="text-left py-1.5 px-2 w-8"></th>
                <th className="text-left py-1.5 px-2">Category</th>
                <th className="text-left py-1.5 px-2">Sector Code</th>
                <th className="text-left py-1.5 px-2">Sector Name</th>
                <th className="text-right py-1.5 px-2">Factor</th>
                <th className="text-left py-1.5 px-2">Unit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={idx} className={`border-b border-[hsl(var(--border-hairline))] ${r.valid ? "" : "bg-destructive-tint/40"}`}>
                  <td className="py-1.5 px-2">
                    {r.valid
                      ? <CheckCircle2 size={13} className="text-emerald-500" />
                      : <AlertCircle size={13} className="text-destructive" aria-label={r.error} />}
                  </td>
                  <td className="py-1.5 px-2 text-accent-foreground font-medium">{getCatLabel(r.ghg_category_id)}</td>
                  <td className="py-1.5 px-2 text-muted-foreground font-mono">{r.sector_code || "—"}</td>
                  <td className={`py-1.5 px-2 ${r.valid ? "text-foreground" : "text-destructive"}`}>
                    {r.sector_name || <span className="italic text-destructive">missing</span>}
                    {r.error && <span className="block text-[10px] text-destructive">{r.error}</span>}
                  </td>
                  <td className={`py-1.5 px-2 text-right font-medium ${r.valid ? "" : "text-destructive"}`}>{r.emission_factor || "—"}</td>
                  <td className="py-1.5 px-2 text-muted-foreground">{r.factor_unit || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SheetBody>
        <SheetFooter className="justify-between">
          <p className="text-[11px] text-muted-foreground mr-auto">
            {errorCount > 0 && "Rows with errors will be skipped. Only valid rows are imported."}
          </p>
          <Button variant="outline" onClick={onClose} className="h-8 text-[13px]">Discard</Button>
          <Button
            onClick={onConfirm}
            disabled={importing || validCount === 0}
            className="bg-primary hover:bg-primaryDk text-white h-8 text-[13px]"
          >
            {importing ? "Importing…" : `Import ${validCount} Items`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* Tab 3: Assignments                                                     */
/* ═══════════════════════════════════════════════════════════════════════ */

function AssignmentsTab({ assignments, isAdmin, onCreateOpen, onDelete }: {
  assignments: Scope3Assignment[];
  isAdmin: boolean;
  onCreateOpen: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-[13px] text-muted-foreground">Assign GHG categories to locations and users so they can enter Scope 3 data.</p>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={onCreateOpen}>
            <Plus size={14} /> Assign Category
          </Button>
        )}
      </div>

      {assignments.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <Users size={32} className="mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-[13px] text-muted-foreground mb-1">No category assignments yet</p>
          <p className="text-[11px] text-muted-foreground">Assign GHG categories to locations and users to enable Scope 3 data entry.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border bg-sunken/50">
                <th className="text-left py-2 px-4">Category</th>
                <th className="text-left py-2 px-4">Type</th>
                <th className="text-left py-2 px-4">Location</th>
                <th className="text-left py-2 px-4">Assigned To</th>
                <th className="text-left py-2 px-4">Factor Set</th>
                <th className="text-left py-2 px-4">Entry Type</th>
                {isAdmin && <th className="text-right py-2 px-4">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.assignment_id} className="border-b border-[hsl(var(--border-hairline))] hover:bg-sunken">
                  <td className="py-2 px-4">
                    <span className="font-semibold text-foreground">{a.ghg_category_code}</span>
                    <span className="text-muted-foreground ml-1.5">{a.ghg_category_name}</span>
                  </td>
                  <td className="py-2 px-4">
                    <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${a.scope3_type === "upstream" ? "bg-warn-tint text-warn" : "bg-info-tint text-info"}`}>
                      {a.scope3_type}
                    </span>
                  </td>
                  <td className="py-2 px-4 text-muted-foreground">{a.location_name || "All locations"}</td>
                  <td className="py-2 px-4 text-muted-foreground">{a.assigned_user_name || "Any user"}</td>
                  <td className="py-2 px-4 text-muted-foreground">{a.factor_set_name || "—"}</td>
                  <td className="py-2 px-4">
                    <span className="text-[11px] bg-sunken text-muted-foreground px-1.5 py-0.5 rounded">{a.entry_type}</span>
                  </td>
                  {isAdmin && (
                    <td className="py-2 px-4 text-right">
                      <button onClick={() => onDelete(a.assignment_id)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
