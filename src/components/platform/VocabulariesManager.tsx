/**
 * VocabulariesManager — Platform Owner CRUD for the 3 vocabulary lookup tables
 * (disposal_methods, input_types, emission_scopes). Embedded as a tab inside
 * SystemConfigPage. The data here drives how disposal breakdowns, input
 * widgets, and emission scope charts render across the tenant UI.
 */

import { useEffect, useState } from "react";
import { platformApi } from "@/api/client";
import { FormDialog, type FormField } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { getApiError } from "@/lib/utils";
import type { DisposalMethod, InputTypeDef, EmissionScopeDef } from "@/types";

type SubTab = "disposal" | "inputs" | "scopes";

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: "disposal", label: "Disposal Methods" },
  { key: "inputs",   label: "Input Types" },
  { key: "scopes",   label: "Emission Scopes" },
];

export default function VocabulariesManager({ isOwner }: { isOwner: boolean }) {
  const [sub, setSub] = useState<SubTab>("disposal");

  const [disposal, setDisposal] = useState<DisposalMethod[]>([]);
  const [inputs,   setInputs]   = useState<InputTypeDef[]>([]);
  const [scopes,   setScopes]   = useState<EmissionScopeDef[]>([]);
  const [loading,  setLoading]  = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [editDispRow, setEditDispRow] = useState<DisposalMethod | null>(null);
  const [editInpRow,  setEditInpRow]  = useState<InputTypeDef    | null>(null);
  const [editScpRow,  setEditScpRow]  = useState<EmissionScopeDef | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [d, i, s] = await Promise.all([
        platformApi.listDisposalMethods(),
        platformApi.listInputTypes(),
        platformApi.listEmissionScopes(),
      ]);
      setDisposal(d.data);
      setInputs(i.data);
      setScopes(s.data);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to load vocabularies"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  // ── Add handlers ────────────────────────────────────────────────────────
  const handleCreate = async (data: Record<string, any>) => {
    setActionLoading(true);
    try {
      if (sub === "disposal") {
        await platformApi.createDisposalMethod({
          key: data.key, label: data.label, display_order: Number(data.display_order ?? 1),
        });
      } else if (sub === "inputs") {
        await platformApi.createInputType({
          key: data.key, label: data.label,
          widget_component: data.widget_component,
          has_uom: !!data.has_uom,
          display_order: Number(data.display_order ?? 1),
        });
      } else {
        await platformApi.createEmissionScope({
          scope_number: Number(data.scope_number),
          label: data.label,
          color: data.color || "#64748b",
          description: data.description || null,
          display_order: Number(data.display_order ?? 1),
        });
      }
      toast.success("Created");
      setCreateOpen(false);
      refresh();
    } catch (err: any) {
      toast.error(getApiError(err, "Create failed"));
    } finally { setActionLoading(false); }
  };

  // ── Edit handlers ───────────────────────────────────────────────────────
  const handleEditDisp = async (data: Record<string, any>) => {
    if (!editDispRow) return;
    setActionLoading(true);
    try {
      await platformApi.updateDisposalMethod(editDispRow.method_id, {
        label: data.label,
        display_order: Number(data.display_order),
        is_active: !!data.is_active,
      });
      toast.success("Updated");
      setEditDispRow(null);
      refresh();
    } catch (err: any) { toast.error(getApiError(err, "Update failed")); }
    finally { setActionLoading(false); }
  };

  const handleEditInp = async (data: Record<string, any>) => {
    if (!editInpRow) return;
    setActionLoading(true);
    try {
      await platformApi.updateInputType(editInpRow.input_type_id, {
        label: data.label,
        widget_component: data.widget_component,
        has_uom: !!data.has_uom,
        display_order: Number(data.display_order),
        is_active: !!data.is_active,
      });
      toast.success("Updated");
      setEditInpRow(null);
      refresh();
    } catch (err: any) { toast.error(getApiError(err, "Update failed")); }
    finally { setActionLoading(false); }
  };

  const handleEditScp = async (data: Record<string, any>) => {
    if (!editScpRow) return;
    setActionLoading(true);
    try {
      await platformApi.updateEmissionScope(editScpRow.scope_number, {
        label: data.label,
        color: data.color,
        description: data.description || null,
        display_order: Number(data.display_order),
        is_active: !!data.is_active,
      });
      toast.success("Updated");
      setEditScpRow(null);
      refresh();
    } catch (err: any) { toast.error(getApiError(err, "Update failed")); }
    finally { setActionLoading(false); }
  };

  // ── Form fields per sub-tab ─────────────────────────────────────────────
  const createFields: FormField[] =
    sub === "disposal" ? [
      { key: "key",   label: "Key",   required: true, placeholder: "e.g. COMPOSTING (UPPER_SNAKE_CASE)", helpText: "Stable code referenced by data rows. Cannot be changed later." },
      { key: "label", label: "Label", required: true, placeholder: "e.g. Composting" },
      { key: "display_order", label: "Display Order", type: "number", defaultValue: 1 },
    ] : sub === "inputs" ? [
      { key: "key",   label: "Key", required: true, placeholder: "e.g. percentage", helpText: "Stable code stored on KPI/Indicator.input_type" },
      { key: "label", label: "Label", required: true, placeholder: "e.g. Percentage" },
      { key: "widget_component", label: "Widget Component", required: true, placeholder: "e.g. PercentageInput", helpText: "Frontend widget registry key" },
      { key: "has_uom", label: "Has UOM dropdown", type: "toggle" },
      { key: "display_order", label: "Display Order", type: "number", defaultValue: 1 },
    ] : [
      { key: "scope_number", label: "Scope Number", type: "number", required: true, placeholder: "e.g. 4" },
      { key: "label", label: "Label", required: true, placeholder: "e.g. Scope 4" },
      { key: "color", label: "Color (hex)", required: true, placeholder: "#64748b", defaultValue: "#64748b" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "display_order", label: "Display Order", type: "number", defaultValue: 4 },
    ];

  return (
    <div>
      {/* Sub-tab strip + Add button */}
      <div className="flex items-center justify-between mb-4">
        <div className="inline-flex bg-sunken rounded-lg p-1">
          {SUB_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setSub(t.key)}
              className={`px-3 py-1.5 text-[12px] font-semibold rounded-md transition-colors ${
                sub === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground/90"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {isOwner && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> Add {SUB_TABS.find(t => t.key === sub)?.label.replace(/s$/, "")}
          </Button>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-6 text-[12px] text-muted-foreground">Loading…</div>
        ) : sub === "disposal" ? (
          <table className="w-full text-[13px]">
            <thead><tr className="border-b-2 border-[hsl(var(--border-hairline))] bg-sunken/60">
              {["Key", "Label", "Order", "Status", ...(isOwner ? [""] : [])].map((h) =>
                <th key={h} className="text-left px-4 py-3 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">{h}</th>
              )}
            </tr></thead>
            <tbody>
              {disposal.map((r) => (
                <tr key={r.method_id} className="border-b border-[hsl(var(--border-hairline))] hover:bg-sunken/60">
                  <td className="px-4 py-2 font-mono text-[12px] text-muted-foreground">{r.key}</td>
                  <td className="px-4 py-2 font-semibold text-foreground">{r.label}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.display_order}</td>
                  <td className="px-4 py-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${r.is_active !== false ? "bg-ok-tint text-ok" : "bg-sunken text-muted-foreground"}`}>
                      {r.is_active !== false ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {isOwner && (
                    <td className="px-4 py-2">
                      <button onClick={() => setEditDispRow(r)} className="p-1.5 rounded-md hover:bg-sunken text-muted-foreground hover:text-muted-foreground"><Pencil size={14} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        ) : sub === "inputs" ? (
          <table className="w-full text-[13px]">
            <thead><tr className="border-b-2 border-[hsl(var(--border-hairline))] bg-sunken/60">
              {["Key", "Label", "Widget", "Has UOM", "Order", "Status", ...(isOwner ? [""] : [])].map((h) =>
                <th key={h} className="text-left px-4 py-3 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">{h}</th>
              )}
            </tr></thead>
            <tbody>
              {inputs.map((r) => (
                <tr key={r.input_type_id} className="border-b border-[hsl(var(--border-hairline))] hover:bg-sunken/60">
                  <td className="px-4 py-2 font-mono text-[12px] text-muted-foreground">{r.key}</td>
                  <td className="px-4 py-2 font-semibold text-foreground">{r.label}</td>
                  <td className="px-4 py-2 text-muted-foreground font-mono text-[12px]">{r.widget_component}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.has_uom ? "Yes" : "No"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.display_order}</td>
                  <td className="px-4 py-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${r.is_active !== false ? "bg-ok-tint text-ok" : "bg-sunken text-muted-foreground"}`}>
                      {r.is_active !== false ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {isOwner && (
                    <td className="px-4 py-2">
                      <button onClick={() => setEditInpRow(r)} className="p-1.5 rounded-md hover:bg-sunken text-muted-foreground hover:text-muted-foreground"><Pencil size={14} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-[13px]">
            <thead><tr className="border-b-2 border-[hsl(var(--border-hairline))] bg-sunken/60">
              {["Scope", "Label", "Color", "Description", "Order", "Status", ...(isOwner ? [""] : [])].map((h) =>
                <th key={h} className="text-left px-4 py-3 text-muted-foreground font-semibold text-[11px] uppercase tracking-wider">{h}</th>
              )}
            </tr></thead>
            <tbody>
              {scopes.map((r) => (
                <tr key={r.scope_number} className="border-b border-[hsl(var(--border-hairline))] hover:bg-sunken/60">
                  <td className="px-4 py-2 font-semibold text-foreground">{r.scope_number}</td>
                  <td className="px-4 py-2 font-semibold text-foreground">{r.label}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded border border-border" style={{ background: r.color }} />
                      <span className="font-mono text-[11px] text-muted-foreground">{r.color}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground text-[12px] line-clamp-2">{r.description || "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{r.display_order}</td>
                  <td className="px-4 py-2">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${r.is_active !== false ? "bg-ok-tint text-ok" : "bg-sunken text-muted-foreground"}`}>
                      {r.is_active !== false ? "Active" : "Inactive"}
                    </span>
                  </td>
                  {isOwner && (
                    <td className="px-4 py-2">
                      <button onClick={() => setEditScpRow(r)} className="p-1.5 rounded-md hover:bg-sunken text-muted-foreground hover:text-muted-foreground"><Pencil size={14} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create dialog */}
      <FormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        title={`Add ${SUB_TABS.find(t => t.key === sub)?.label.replace(/s$/, "")}`}
        fields={createFields}
        submitLabel="Create"
        loading={actionLoading}
      />

      {/* Edit dialogs */}
      <FormDialog
        open={!!editDispRow}
        onClose={() => setEditDispRow(null)}
        onSubmit={handleEditDisp}
        title={`Edit Disposal Method — ${editDispRow?.key ?? ""}`}
        description="Key is immutable once created."
        fields={[
          { key: "label", label: "Label", required: true },
          { key: "display_order", label: "Display Order", type: "number" },
          { key: "is_active", label: "Active", type: "toggle" },
        ]}
        submitLabel="Save Changes"
        loading={actionLoading}
        initialData={editDispRow ? { label: editDispRow.label, display_order: editDispRow.display_order, is_active: editDispRow.is_active !== false } : undefined}
      />

      <FormDialog
        open={!!editInpRow}
        onClose={() => setEditInpRow(null)}
        onSubmit={handleEditInp}
        title={`Edit Input Type — ${editInpRow?.key ?? ""}`}
        description="Key is immutable once created."
        fields={[
          { key: "label", label: "Label", required: true },
          { key: "widget_component", label: "Widget Component", required: true },
          { key: "has_uom", label: "Has UOM dropdown", type: "toggle" },
          { key: "display_order", label: "Display Order", type: "number" },
          { key: "is_active", label: "Active", type: "toggle" },
        ]}
        submitLabel="Save Changes"
        loading={actionLoading}
        initialData={editInpRow ? {
          label: editInpRow.label,
          widget_component: editInpRow.widget_component,
          has_uom: editInpRow.has_uom,
          display_order: editInpRow.display_order,
          is_active: editInpRow.is_active !== false,
        } : undefined}
      />

      <FormDialog
        open={!!editScpRow}
        onClose={() => setEditScpRow(null)}
        onSubmit={handleEditScp}
        title={`Edit Emission Scope — Scope ${editScpRow?.scope_number ?? ""}`}
        description="Scope number is immutable once created."
        fields={[
          { key: "label", label: "Label", required: true },
          { key: "color", label: "Color (hex)", required: true },
          { key: "description", label: "Description", type: "textarea" },
          { key: "display_order", label: "Display Order", type: "number" },
          { key: "is_active", label: "Active", type: "toggle" },
        ]}
        submitLabel="Save Changes"
        loading={actionLoading}
        initialData={editScpRow ? {
          label: editScpRow.label,
          color: editScpRow.color,
          description: editScpRow.description ?? "",
          display_order: editScpRow.display_order,
          is_active: editScpRow.is_active !== false,
        } : undefined}
      />
    </div>
  );
}
