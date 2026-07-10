import { useEffect, useRef, useState } from "react";
import {
  Library, Plus, Pencil, Trash2, ChevronRight, ChevronDown,
  Upload, X, Check, AlertCircle,
} from "lucide-react";
import { platformApi } from "@/api/client";
import { getApiError, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageShell } from "@/components/shared/PageShell";
import { PageTabs } from "@/components/shared/PageTabs";
import { FormField as WorkspaceField } from "@/components/shared/FormField";
import { FormRow as WorkspaceRow, FormSection } from "@/components/shared/FormWorkspace";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthStore } from "@/store/auth";
import type { Scope3GHGCategory, Scope3FactorSet, Scope3FactorItem } from "@/types";

/* ── helpers ─────────────────────────────────────────────────────────── */

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = "";
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { result.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    result.push(cur.trim());
    return result;
  };
  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const rows = lines.slice(1).map((l) => {
    const vals = parseLine(l);
    return headers.reduce<Record<string, string>>((acc, h, i) => { acc[h] = vals[i] ?? ""; return acc; }, {});
  });
  return { headers, rows };
}

/* ── types ─────────────────────────────────────────────────────────── */

interface EditingSet { factor_set_id?: string; set_name: string; source_name: string; dataset_year: string; currency_code: string; methodology: string; version: string; is_system: boolean; }
interface EditingItem { factor_item_id?: string; ghg_category_id: string; sector_code: string; sector_name: string; emission_factor: string; factor_unit: string; }
interface CSVPreviewRow { sector_code: string; sector_name: string; emission_factor: string; factor_unit: string; _valid: boolean; _error: string; }

const EMPTY_SET: EditingSet = { set_name: "", source_name: "", dataset_year: "", currency_code: "INR", methodology: "", version: "", is_system: true };
const EMPTY_ITEM: EditingItem = { ghg_category_id: "", sector_code: "", sector_name: "", emission_factor: "", factor_unit: "" };

/* ═══════════════════════════════════════════════════════════════════════ */
/* Main Component                                                         */
/* ═══════════════════════════════════════════════════════════════════════ */

export default function PlatformScope3Page() {
  const { user } = useAuthStore();
  const isOwner = user?.role === "PLATFORM_OWNER";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Scope3GHGCategory[]>([]);
  const [factorSets, setFactorSets] = useState<Scope3FactorSet[]>([]);
  const [loading, setLoading] = useState(true);

  /* expanded set state */
  const [expandedSetId, setExpandedSetId] = useState<string | null>(null);
  const [setItems, setSetItems] = useState<Record<string, Scope3FactorItem[]>>({});
  const [loadingItems, setLoadingItems] = useState<string | null>(null);

  /* set CRUD */
  const [setForm, setSetForm] = useState<EditingSet | null>(null);
  const [setFormMode, setSetFormMode] = useState<"create" | "edit">("create");
  const [savingSet, setSavingSet] = useState(false);
  const [deleteSetId, setDeleteSetId] = useState<string | null>(null);

  /* item CRUD */
  const [itemForm, setItemForm] = useState<{ setId: string; item: EditingItem } | null>(null);
  const [itemFormMode, setItemFormMode] = useState<"create" | "edit">("create");
  const [savingItem, setSavingItem] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{ setId: string; itemId: string } | null>(null);
  const [csvImportSetId, setCsvImportSetId] = useState<string | null>(null);
  const [csvCategoryId, setCsvCategoryId] = useState(0);

  /* CSV preview */
  const [csvPreview, setCsvPreview] = useState<{ setId: string; categoryId: number; rows: CSVPreviewRow[]; file: File } | null>(null);
  const [importing, setImporting] = useState(false);

  /* ── Data fetch ── */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [catRes, setsRes] = await Promise.all([
          platformApi.listPlatformScope3Categories(),
          platformApi.listPlatformScope3FactorSets(),
        ]);
        setCategories(catRes.data);
        setFactorSets(setsRes.data);
      } catch (err: any) {
        toast.error(getApiError(err, "Failed to load Scope 3 data"));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refreshSets = async () => {
    const res = await platformApi.listPlatformScope3FactorSets();
    setFactorSets(res.data);
  };

  /* ── Set expand/items ── */
  const toggleExpand = async (setId: string) => {
    if (expandedSetId === setId) { setExpandedSetId(null); return; }
    setExpandedSetId(setId);
    if (!setItems[setId]) {
      setLoadingItems(setId);
      try {
        const res = await platformApi.listPlatformScope3FactorItems(setId);
        setSetItems((prev) => ({ ...prev, [setId]: res.data }));
      } catch (err: any) {
        toast.error(getApiError(err, "Failed to load items"));
      } finally {
        setLoadingItems(null);
      }
    }
  };

  const refreshItems = async (setId: string) => {
    const res = await platformApi.listPlatformScope3FactorItems(setId);
    setSetItems((prev) => ({ ...prev, [setId]: res.data }));
    refreshSets();
  };

  /* ── Factor Set CRUD ── */
  const openCreateSet = () => {
    setSetForm({ ...EMPTY_SET, is_system: true });
    setSetFormMode("create");
  };

  const openEditSet = (fs: Scope3FactorSet) => {
    setSetForm({
      factor_set_id: fs.factor_set_id as string,
      set_name: fs.set_name,
      source_name: fs.source_name ?? "",
      dataset_year: fs.dataset_year ? String(fs.dataset_year) : "",
      currency_code: fs.currency_code ?? "INR",
      methodology: fs.methodology ?? "",
      version: fs.version ?? "",
      is_system: fs.is_system,
    });
    setSetFormMode("edit");
  };

  const saveSet = async () => {
    if (!setForm?.set_name.trim()) { toast.error("Set name is required"); return; }
    setSavingSet(true);
    try {
      const payload = {
        set_name: setForm.set_name.trim(),
        source_name: setForm.source_name || null,
        dataset_year: setForm.dataset_year ? Number(setForm.dataset_year) : null,
        currency_code: setForm.currency_code || null,
        methodology: setForm.methodology || null,
        version: setForm.version || null,
        is_system: setForm.is_system,
      };
      if (setFormMode === "create") {
        await platformApi.createPlatformScope3FactorSet(payload);
        toast.success("Factor set created");
      } else {
        await platformApi.updatePlatformScope3FactorSet(setForm.factor_set_id!, payload);
        toast.success("Factor set updated");
      }
      setSetForm(null);
      await refreshSets();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to save factor set"));
    } finally {
      setSavingSet(false);
    }
  };

  /* ── Factor Item CRUD ── */
  const openCreateItem = (setId: string) => {
    setItemForm({ setId, item: { ...EMPTY_ITEM } });
    setItemFormMode("create");
  };

  const openEditItem = (setId: string, fi: Scope3FactorItem) => {
    setItemForm({
      setId,
      item: {
        factor_item_id: fi.factor_item_id as string,
        ghg_category_id: String(fi.ghg_category_id),
        sector_code: fi.sector_code ?? "",
        sector_name: fi.sector_name,
        emission_factor: String(fi.emission_factor),
        factor_unit: fi.factor_unit ?? "",
      },
    });
    setItemFormMode("edit");
  };

  const saveItem = async () => {
    if (!itemForm) return;
    const { setId, item } = itemForm;
    if (!item.sector_name.trim()) { toast.error("Sector name is required"); return; }
    if (!item.emission_factor || isNaN(Number(item.emission_factor))) { toast.error("Valid emission factor is required"); return; }
    if (!item.ghg_category_id) { toast.error("GHG category is required"); return; }
    setSavingItem(true);
    try {
      const payload = {
        ghg_category_id: Number(item.ghg_category_id),
        sector_code: item.sector_code || null,
        sector_name: item.sector_name.trim(),
        emission_factor: Number(item.emission_factor),
        factor_unit: item.factor_unit || null,
      };
      if (itemFormMode === "create") {
        await platformApi.createPlatformScope3FactorItem(setId, payload);
        toast.success("Factor item added");
      } else {
        await platformApi.updatePlatformScope3FactorItem(setId, item.factor_item_id!, payload);
        toast.success("Factor item updated");
      }
      setItemForm(null);
      await refreshItems(setId);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to save item"));
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteItem) return;
    try {
      await platformApi.deletePlatformScope3FactorItem(deleteItem.setId, deleteItem.itemId);
      toast.success("Item deleted");
      setDeleteItem(null);
      await refreshItems(deleteItem.setId);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to delete"));
    }
  };

  /* ── CSV import with preview ── */
  const handleFileSelect = (setId: string, file: File) => {
    const catId = csvCategoryId || categories[0]?.category_id;
    if (!catId) { toast.error("No GHG category selected"); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { rows } = parseCSV(text);
      const preview: CSVPreviewRow[] = rows.map((r) => {
        const sectorName = r["sector_name"] || r["sector name"] || "";
        const rawFactor = r["emission_factor"] || r["emission factor"] || "";
        const isValid = sectorName.trim() !== "" && rawFactor.trim() !== "" && !isNaN(Number(rawFactor));
        return {
          sector_code: r["sector_code"] || r["sector code"] || "",
          sector_name: sectorName,
          emission_factor: rawFactor,
          factor_unit: r["factor_unit"] || r["factor unit"] || "",
          _valid: isValid,
          _error: isValid ? "" : (!sectorName ? "Missing sector_name" : "Invalid emission_factor"),
        };
      });
      setCsvPreview({ setId, categoryId: catId, rows: preview, file });
    };
    reader.readAsText(file);
  };

  const confirmImport = async () => {
    if (!csvPreview) return;
    setImporting(true);
    try {
      const res = await platformApi.importPlatformScope3FactorItems(csvPreview.setId, csvPreview.categoryId, csvPreview.file);
      toast.success(`${res.data.imported} items imported${res.data.errors?.length ? ` (${res.data.errors.length} errors)` : ""}`);
      setCsvPreview(null);
      setCsvImportSetId(null);
      await refreshItems(csvPreview.setId);
    } catch (err: any) {
      toast.error(getApiError(err, "Import failed"));
    } finally {
      setImporting(false);
    }
  };

  /* ── Derived ──
     Platform Owner sees System Library only. Company-owned sets are managed by
     Company Admin in the tenant Scope 3 Setup page (tenant-data isolation). */
  const displayedSets = factorSets.filter((fs) => fs.is_system);

  const catById = (id: number) => categories.find((c) => c.category_id === id);

  /* ═══ RENDER ═══════════════════════════════════════════════════════════ */
  return (
    <PageShell
      title="Scope 3 Factor Management"
      description="Manage system library emission factor datasets for Scope 3 calculations."
      breadcrumb={[{ label: "Platform Admin", href: "/platform" }, { label: "Scope 3 Factor Management" }]}
      actions={isOwner ? (
        <Button size="sm" onClick={openCreateSet}>
          <Plus size={14} /> New Factor Set
        </Button>
      ) : undefined}
    >
      <PageTabs
        tabs={[{ key: "library", label: "System Library", icon: <Library size={14} />, count: displayedSets.length }]}
        value="library"
        onChange={() => {}}
        className="mb-4"
      />

      {/* ── Content ── */}
      {loading ? (
        <div className="text-[13px] text-muted-foreground text-center py-16">Loading…</div>
      ) : displayedSets.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-border rounded-lg">
          <Library size={32} className="mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-[13px] text-muted-foreground mb-1">No library factor sets yet</p>
          {isOwner && <p className="text-[11px] text-muted-foreground">Click "New Factor Set" to create one.</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {displayedSets.map((fs) => (
            <FactorSetBlock
              key={fs.factor_set_id as string}
              fs={fs}
              expanded={expandedSetId === fs.factor_set_id}
              items={setItems[fs.factor_set_id as string]}
              loadingItems={loadingItems === fs.factor_set_id}
              isOwner={isOwner}
              categories={categories}
              catById={catById}
              csvCategoryId={csvCategoryId}
              setCsvCategoryId={setCsvCategoryId}
              csvImportSetId={csvImportSetId}
              setCsvImportSetId={setCsvImportSetId}
              fileInputRef={fileInputRef}
              onToggle={() => toggleExpand(fs.factor_set_id as string)}
              onEdit={() => openEditSet(fs)}
              onAddItem={() => openCreateItem(fs.factor_set_id as string)}
              onEditItem={(fi) => openEditItem(fs.factor_set_id as string, fi)}
              onDeleteItem={(itemId) => setDeleteItem({ setId: fs.factor_set_id as string, itemId })}
              onFileSelect={(file) => handleFileSelect(fs.factor_set_id as string, file)}
            />
          ))}
        </div>
      )}

      {/* ── Factor Set Form ── */}
      {setForm && (
        <FactorSetFormModal
          form={setForm}
          mode={setFormMode}
          saving={savingSet}
          onChange={(patch) => setSetForm((prev) => prev ? { ...prev, ...patch } : prev)}
          onSave={saveSet}
          onClose={() => setSetForm(null)}
        />
      )}

      {/* ── Factor Item Form ── */}
      {itemForm && (
        <FactorItemFormModal
          form={itemForm.item}
          mode={itemFormMode}
          categories={categories}
          saving={savingItem}
          onChange={(patch) => setItemForm((prev) => prev ? { ...prev, item: { ...prev.item, ...patch } } : prev)}
          onSave={saveItem}
          onClose={() => setItemForm(null)}
        />
      )}

      {/* ── CSV Preview Modal ── */}
      {csvPreview && (
        <CSVPreviewModal
          rows={csvPreview.rows}
          categoryName={catById(csvPreview.categoryId)?.name ?? ""}
          importing={importing}
          onConfirm={confirmImport}
          onClose={() => setCsvPreview(null)}
        />
      )}

      {/* ── Confirm delete item ── */}
      <ConfirmDialog
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleDeleteItem}
        title="Delete Factor Item"
        message="Delete this factor item? Any existing Scope 3 entries that used it will retain the previously calculated emission value."
        variant="destructive"
      />
    </PageShell>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* FactorSetBlock                                                          */
/* ═══════════════════════════════════════════════════════════════════════ */

function FactorSetBlock({
  fs, expanded, items, loadingItems, isOwner, categories, catById,
  csvCategoryId, setCsvCategoryId, csvImportSetId, setCsvImportSetId,
  fileInputRef, onToggle, onEdit, onAddItem, onEditItem, onDeleteItem, onFileSelect,
}: {
  fs: Scope3FactorSet; expanded: boolean; items?: Scope3FactorItem[]; loadingItems: boolean;
  isOwner: boolean; categories: Scope3GHGCategory[];
  catById: (id: number) => Scope3GHGCategory | undefined;
  csvCategoryId: number; setCsvCategoryId: (v: number) => void;
  csvImportSetId: string | null; setCsvImportSetId: (v: string | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onToggle: () => void; onEdit: () => void; onAddItem: () => void;
  onEditItem: (fi: Scope3FactorItem) => void;
  onDeleteItem: (itemId: string) => void;
  onFileSelect: (file: File) => void;
}) {
  const setId = fs.factor_set_id as string;
  const isImportOpen = csvImportSetId === setId;

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-sunken/60">
        <button onClick={onToggle} className="text-muted-foreground hover:text-muted-foreground shrink-0">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-foreground">{fs.set_name}</span>
            <span className="text-[10px] bg-accent text-accent-foreground px-1.5 py-0.5 rounded font-medium">Library</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-3 flex-wrap">
            {fs.source_name && <span>{fs.source_name}</span>}
            {fs.dataset_year && <span>{fs.dataset_year}</span>}
            {fs.currency_code && <span>{fs.currency_code}</span>}
            {fs.methodology && <span>{fs.methodology}</span>}
            {fs.version && <span>v{fs.version}</span>}
            <span className="font-medium">{fs.item_count ?? 0} items</span>
            <span>Created {formatDate(fs.created_at)}</span>
          </div>
        </div>
        {isOwner && (
          <button onClick={onEdit} className="text-muted-foreground hover:text-primary transition-colors">
            <Pencil size={14} />
          </button>
        )}
      </div>

      {/* Expanded items section */}
      {expanded && (
        <div className="border-t border-[hsl(var(--border-hairline))]">
          {/* Item action bar */}
          {isOwner && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-sunken/50 border-b border-[hsl(var(--border-hairline))]">
              <button
                onClick={onAddItem}
                className="flex items-center gap-1.5 text-[12px] font-medium text-primary hover:text-primaryDk transition-colors"
              >
                <Plus size={13} /> Add Item Manually
              </button>
              <span className="text-muted-foreground/40">|</span>
              <button
                onClick={() => { setCsvImportSetId(isImportOpen ? null : setId); }}
                className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <Upload size={13} /> Bulk Import CSV
              </button>
            </div>
          )}

          {/* CSV import controls (only shown when open for this set) */}
          {isOwner && isImportOpen && (
            <div className="px-4 py-3 bg-warn-tint/40 border-b border-warn/30 flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-[12px] text-muted-foreground font-medium">GHG Category:</label>
                <Select
                  value={csvCategoryId ? String(csvCategoryId) : "__none__"}
                  onValueChange={(value) => setCsvCategoryId(value === "__none__" ? 0 : Number(value))}
                >
                  <SelectTrigger className="h-8 min-w-[220px] text-[12px]">
                    <SelectValue placeholder="Select category…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select category…</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.category_id} value={String(c.category_id)}>{c.code} · {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                disabled={!csvCategoryId}
                onClick={() => fileInputRef.current?.click()}
                className="text-[12px] h-7 px-2.5 flex items-center gap-1"
              >
                <Upload size={12} /> Select CSV File
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) { onFileSelect(e.target.files[0]); e.target.value = ""; } }}
              />
              <span className="text-[11px] text-muted-foreground">Required columns: sector_name, emission_factor. Optional: sector_code, factor_unit</span>
            </div>
          )}

          {/* Items table */}
          {loadingItems ? (
            <div className="text-[12px] text-muted-foreground text-center py-6">Loading items…</div>
          ) : !items || items.length === 0 ? (
            <div className="text-[12px] text-muted-foreground text-center py-6">
              No items yet. {isOwner ? 'Use "Add Item Manually" or "Bulk Import CSV" above.' : "Items will appear here once added."}
            </div>
          ) : (
            <div className="overflow-auto max-h-[360px]">
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 bg-card border-b border-[hsl(var(--border-hairline))]">
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    <th className="text-left py-2 px-4">Sector Code</th>
                    <th className="text-left py-2 px-4">Sector Name</th>
                    <th className="text-left py-2 px-4">GHG Category</th>
                    <th className="text-right py-2 px-4">Factor</th>
                    <th className="text-left py-2 px-4">Unit</th>
                    {isOwner && <th className="text-right py-2 px-4">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((fi) => (
                    <tr key={fi.factor_item_id as string} className="border-b border-[hsl(var(--border-hairline))] hover:bg-sunken">
                      <td className="py-1.5 px-4 font-mono text-muted-foreground">{fi.sector_code || "—"}</td>
                      <td className="py-1.5 px-4 text-foreground">{fi.sector_name}</td>
                      <td className="py-1.5 px-4 text-muted-foreground">{catById(fi.ghg_category_id)?.code ?? fi.ghg_category_id}</td>
                      <td className="py-1.5 px-4 text-right font-medium">{fi.emission_factor}</td>
                      <td className="py-1.5 px-4 text-muted-foreground">{fi.factor_unit || "—"}</td>
                      {isOwner && (
                        <td className="py-1.5 px-4 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <button onClick={() => onEditItem(fi)} className="text-muted-foreground hover:text-primary transition-colors"><Pencil size={13} /></button>
                            <button onClick={() => onDeleteItem(fi.factor_item_id as string)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      )}
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
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* FactorSetFormModal                                                      */
/* ═══════════════════════════════════════════════════════════════════════ */

function FactorSetFormModal({ form, mode, saving, onChange, onSave, onClose }: {
  form: EditingSet; mode: "create" | "edit"; saving: boolean;
  onChange: (patch: Partial<EditingSet>) => void; onSave: () => void; onClose: () => void;
}) {
  return (
    <Sheet open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent size="wide">
        <SheetHeader>
          <SheetTitle>{mode === "create" ? "New Factor Set" : "Edit Factor Set"}</SheetTitle>
        </SheetHeader>
        <SheetBody className="space-y-5">
          <FormSection title="Dataset Metadata" description="Configure the source, year, and methodology for this library set">
            <WorkspaceField label="Set Name" required>
              <input value={form.set_name} onChange={(e) => onChange({ set_name: e.target.value })} className={inputCls} placeholder="e.g., USEEIO v2.0 India 2023" />
            </WorkspaceField>
            <WorkspaceRow cols={2} className="mt-4">
              <WorkspaceField label="Source Name">
                <input value={form.source_name} onChange={(e) => onChange({ source_name: e.target.value })} className={inputCls} placeholder="e.g., US EPA USEEIO" />
              </WorkspaceField>
              <WorkspaceField label="Dataset Year">
                <input type="number" value={form.dataset_year} onChange={(e) => onChange({ dataset_year: e.target.value })} className={inputCls} placeholder="e.g., 2023" />
              </WorkspaceField>
            </WorkspaceRow>
            <WorkspaceRow cols={2} className="mt-4">
              <WorkspaceField label="Currency Code">
                <input value={form.currency_code} onChange={(e) => onChange({ currency_code: e.target.value })} className={inputCls} placeholder="INR" />
              </WorkspaceField>
              <WorkspaceField label="Version">
                <input value={form.version} onChange={(e) => onChange({ version: e.target.value })} className={inputCls} placeholder="e.g., 1.1" />
              </WorkspaceField>
            </WorkspaceRow>
            <WorkspaceField label="Methodology" className="mt-4">
              <input value={form.methodology} onChange={(e) => onChange({ methodology: e.target.value })} className={inputCls} placeholder="e.g., EEIO spend-based" />
            </WorkspaceField>
            <p className="mt-4 text-[11px] text-muted-foreground bg-accent/50 border border-accent-foreground/20 rounded px-3 py-2">
              Library sets are visible to all companies. Company-specific datasets are managed by the Company Admin in their portal.
            </p>
          </FormSection>
        </SheetBody>
        <SheetFooter>
          <Button variant="outline" onClick={onClose} className="text-[13px] h-8 px-3">Cancel</Button>
          <Button onClick={onSave} disabled={saving} className="bg-primary hover:bg-primaryDk text-white text-[13px] h-8 px-4">
            {saving ? "Saving…" : mode === "create" ? "Create" : "Save Changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* FactorItemFormModal                                                     */
/* ═══════════════════════════════════════════════════════════════════════ */

function FactorItemFormModal({ form, mode, categories, saving, onChange, onSave, onClose }: {
  form: EditingItem; mode: "create" | "edit"; categories: Scope3GHGCategory[]; saving: boolean;
  onChange: (patch: Partial<EditingItem>) => void; onSave: () => void; onClose: () => void;
}) {
  const factor = Number(form.emission_factor);
  const preview = form.emission_factor && !isNaN(factor)
    ? `1 unit × ${factor} = ${factor} tCO₂e${form.factor_unit ? ` per ${form.factor_unit}` : ""}`
    : null;

  return (
    <Sheet open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent size="wide">
        <SheetHeader>
          <SheetTitle>{mode === "create" ? "Add Factor Item" : "Edit Factor Item"}</SheetTitle>
        </SheetHeader>
        <SheetBody className="space-y-5">
          <FormSection title="Factor Item" description="Map sector activity to a GHG category and factor value">
            <WorkspaceField label="GHG Category" required>
              <Select value={form.ghg_category_id || "__none__"} onValueChange={(value) => onChange({ ghg_category_id: value === "__none__" ? "" : value })}>
                <SelectTrigger><SelectValue placeholder="Select GHG category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select GHG category…</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.category_id} value={String(c.category_id)}>{c.code} · {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </WorkspaceField>
            <WorkspaceRow cols={2} className="mt-4">
              <WorkspaceField label="Sector Code">
                <input value={form.sector_code} onChange={(e) => onChange({ sector_code: e.target.value })} className={inputCls} placeholder="e.g., NIC-241" />
              </WorkspaceField>
              <WorkspaceField label="Sector Name" required>
                <input value={form.sector_name} onChange={(e) => onChange({ sector_name: e.target.value })} className={inputCls} placeholder="e.g., Iron and Steel" />
              </WorkspaceField>
            </WorkspaceRow>
            <WorkspaceRow cols={2} className="mt-4">
              <WorkspaceField label="Emission Factor" required>
                <input type="number" step="any" value={form.emission_factor} onChange={(e) => onChange({ emission_factor: e.target.value })} className={inputCls} placeholder="e.g., 2.89" />
              </WorkspaceField>
              <WorkspaceField label="Factor Unit">
                <input value={form.factor_unit} onChange={(e) => onChange({ factor_unit: e.target.value })} className={inputCls} placeholder="e.g., tCO2e/INR_Lakh" />
              </WorkspaceField>
            </WorkspaceRow>
            {preview && (
              <div className="mt-4 text-[11px] text-muted-foreground bg-accent/50 border border-accent-foreground/20 rounded px-3 py-2">
                Preview: {preview}
              </div>
            )}
          </FormSection>
        </SheetBody>
        <SheetFooter>
          <Button variant="outline" onClick={onClose} className="text-[13px] h-8 px-3">Cancel</Button>
          <Button onClick={onSave} disabled={saving} className="bg-primary hover:bg-primaryDk text-white text-[13px] h-8 px-4">
            {saving ? "Saving…" : mode === "create" ? "Add Item" : "Save Changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
/* CSVPreviewModal                                                         */
/* ═══════════════════════════════════════════════════════════════════════ */

function CSVPreviewModal({ rows, categoryName, importing, onConfirm, onClose }: {
  rows: CSVPreviewRow[]; categoryName: string; importing: boolean;
  onConfirm: () => void; onClose: () => void;
}) {
  const validCount = rows.filter((r) => r._valid).length;
  const errorCount = rows.length - validCount;

  return (
    <Sheet open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent size="xl">
        <SheetHeader>
          <SheetTitle>Preview CSV Import</SheetTitle>
          <p className="text-[11px] text-muted-foreground mt-0.5">Category: {categoryName} · {rows.length} rows · {validCount} valid{errorCount > 0 ? ` · ${errorCount} errors` : ""}</p>
        </SheetHeader>
        <SheetBody className="overflow-auto px-1">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-sunken border-b border-border">
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                <th className="text-center py-2 px-3 w-8"></th>
                <th className="text-left py-2 px-3">Sector Code</th>
                <th className="text-left py-2 px-3">Sector Name</th>
                <th className="text-right py-2 px-3">Emission Factor</th>
                <th className="text-left py-2 px-3">Unit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={`border-b border-[hsl(var(--border-hairline))] ${!row._valid ? "bg-destructive-tint/60" : "hover:bg-sunken"}`}>
                  <td className="py-1.5 px-3 text-center">
                    {row._valid
                      ? <Check size={13} className="text-green-500 mx-auto" />
                      : <AlertCircle size={13} className="text-destructive mx-auto" aria-label={row._error} />}
                  </td>
                  <td className="py-1.5 px-3 font-mono text-muted-foreground">{row.sector_code || "—"}</td>
                  <td className="py-1.5 px-3 text-foreground">{row.sector_name || <span className="text-destructive italic">missing</span>}</td>
                  <td className="py-1.5 px-3 text-right font-medium">{row.emission_factor || <span className="text-destructive italic">missing</span>}</td>
                  <td className="py-1.5 px-3 text-muted-foreground">{row.factor_unit || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SheetBody>
        <SheetFooter className="justify-between">
          <p className="text-[11px] text-muted-foreground">
            {errorCount > 0
              ? `${errorCount} row(s) with errors will be skipped during import.`
              : "All rows look valid. Ready to import."}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="text-[13px] h-8 px-3">Cancel</Button>
            <Button onClick={onConfirm} disabled={importing || validCount === 0} className="bg-primary hover:bg-primaryDk text-white text-[13px] h-8 px-4">
              {importing ? "Importing…" : `Import ${validCount} Items`}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ── Small helpers ── */
const inputCls = "w-full py-1.5 px-3 text-[13px] text-foreground border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary";

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}
