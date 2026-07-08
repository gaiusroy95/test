import { useEffect, useState, useCallback } from "react";
import { tenantApi } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { PageShell } from "@/components/shared/PageShell";
import { DataTable } from "@/components/shared/DataTable";
import { LoadingSkeleton, EmptyState } from "@/components/shared/PageComponents";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { FormDialog, type FormField } from "@/components/shared/FormDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useIsSupportSession } from "@/components/shared/WriteOnly";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, MapPin, LayoutGrid, List, AlertTriangle, Pencil, Trash2,
  Gauge, RefreshCw,
} from "lucide-react";
import type { Location, LocationLbFactor, KPI, UOM } from "@/types";
import { getApiError, formatDate } from "@/lib/utils";

export default function LocationsPage() {
  const { user } = useAuthStore();
  const [locations, setLocations] = useState<Location[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"grid" | "table">(() => (localStorage.getItem("loc_view") as any) || "table");
  const [createOpen, setCreateOpen] = useState(false);
  const [editData, setEditData] = useState<Location | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const pageSize = 20;

  // UOM master
  const [emissionUOMs, setEmissionUOMs] = useState<UOM[]>([]);

  // LB Factors panel
  const [lbLocation, setLbLocation] = useState<Location | null>(null);
  const [lbFactors, setLbFactors] = useState<LocationLbFactor[]>([]);
  const [lbLoading, setLbLoading] = useState(false);
  const [scopedKpis, setScopedKpis] = useState<KPI[]>([]);
  const [addLbOpen, setAddLbOpen] = useState(false);
  const [editLb, setEditLb] = useState<LocationLbFactor | null>(null);
  const [deleteLb, setDeleteLb] = useState<LocationLbFactor | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await tenantApi.listLocations({ page, size: pageSize });
      setLocations(data.items || data || []);
      setTotal(data.total ?? 0);
    } catch { toast.error("Failed to load locations"); }
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    tenantApi.listUOMs("emission").then(({ data }) => {
      setEmissionUOMs(Array.isArray(data) ? data : []);
    }).catch(() => {});
  }, []);

  const toggleView = (v: "grid" | "table") => { setView(v); localStorage.setItem("loc_view", v); };

  const handleCreate = async (formData: Record<string, any>) => {
    setActionLoading(true);
    try {
      await tenantApi.createLocation(formData);
      toast.success("Location created");
      setCreateOpen(false);
      fetch();
    } catch (err: any) { toast.error(getApiError(err, "Failed to create location")); }
    finally { setActionLoading(false); }
  };

  const handleEdit = async (formData: Record<string, any>) => {
    if (!editData) return;
    setActionLoading(true);
    try {
      await tenantApi.updateLocation(editData.location_id, formData);
      toast.success("Location updated");
      setEditData(null);
      fetch();
    } catch (err: any) { toast.error(getApiError(err, "Failed to update")); }
    finally { setActionLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await tenantApi.deleteLocation(deleteTarget.location_id);
      toast.success("Location deleted");
      setDeleteTarget(null);
      fetch();
    } catch (err: any) { toast.error(getApiError(err, "Failed to delete")); }
    finally { setActionLoading(false); }
  };

  // ── LB Factor handlers ────────────────────────────────────────────────────

  const openLbPanel = async (loc: Location) => {
    setLbLocation(loc);
    setLbLoading(true);
    try {
      const [factorsRes, kpisRes] = await Promise.all([
        tenantApi.listLocationLbFactors(loc.location_id),
        tenantApi.listScopedKpis(loc.location_id),
      ]);
      setLbFactors(factorsRes.data || []);
      setScopedKpis(kpisRes.data || []);
    } catch { toast.error("Failed to load LB factors"); }
    finally { setLbLoading(false); }
  };

  const closeLbPanel = () => {
    setLbLocation(null);
    setLbFactors([]);
    setScopedKpis([]);
  };

  const reloadLb = async () => {
    if (!lbLocation) return;
    const { data } = await tenantApi.listLocationLbFactors(lbLocation.location_id);
    setLbFactors(data || []);
  };

  const handleAddLb = async (formData: Record<string, any>) => {
    if (!lbLocation) return;
    setActionLoading(true);
    const toISO = (d: string) => {
      if (!d) return d;
      const m = d.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      return m ? `${m[3]}-${m[2]}-${m[1]}` : d;
    };
    const payload = {
      ...formData,
      kpi_id: formData.kpi_id,
      lb_factor: parseFloat(formData.lb_factor),
      valid_from: toISO(formData.valid_from),
      valid_to: formData.valid_to ? toISO(formData.valid_to) : null,
    };
    try {
      await tenantApi.addLocationLbFactor(lbLocation.location_id, payload);
      toast.success("LB factor added");
      setAddLbOpen(false);
      reloadLb();
    } catch (err: any) { toast.error(getApiError(err, "Failed to add LB factor")); }
    finally { setActionLoading(false); }
  };

  const handleEditLb = async (formData: Record<string, any>) => {
    if (!editLb) return;
    setActionLoading(true);
    try {
      await tenantApi.updateLocationLbFactor(editLb.lb_factor_id, {
        lb_factor: parseFloat(formData.lb_factor),
        emission_uom: formData.emission_uom,
        grid_zone_name: formData.grid_zone_name || null,
        source: formData.source || null,
        valid_to: formData.valid_to || null,
      });
      toast.success("LB factor updated");
      setEditLb(null);
      reloadLb();
    } catch (err: any) { toast.error(getApiError(err, "Failed to update LB factor")); }
    finally { setActionLoading(false); }
  };

  const handleDeleteLb = async () => {
    if (!deleteLb) return;
    setActionLoading(true);
    try {
      await tenantApi.deleteLocationLbFactor(deleteLb.lb_factor_id);
      toast.success("LB factor deleted");
      setDeleteLb(null);
      reloadLb();
    } catch (err: any) { toast.error(getApiError(err, "Failed to delete")); }
    finally { setActionLoading(false); }
  };

  const handleRecalculateLb = async () => {
    if (!lbLocation) return;
    setActionLoading(true);
    try {
      const { data } = await tenantApi.recalculateLbForLocation(lbLocation.location_id);
      toast.success(data.message || "LB emissions recalculated");
    } catch (err: any) { toast.error(getApiError(err, "Recalculation failed")); }
    finally { setActionLoading(false); }
  };

  const fields: FormField[] = [
    { key: "location_name", label: "Location Name", required: true },
    { key: "address", label: "Address", type: "textarea" },
    { key: "city", label: "City" },
    { key: "state", label: "State" },
    { key: "country", label: "Country", defaultValue: "India" },
    { key: "is_high_risk_location", label: "Water Stress Zone (HRL)", type: "toggle", helpText: "Mark if this location is in a BRSR-identified water stress area" },
  ];

  const lbAddFields: FormField[] = [
    {
      key: "kpi_id", label: "KPI", type: "select", required: true,
      options: scopedKpis.map(k => ({
        value: k.kpi_id,
        label: `${k.kpi_name} (${k.unit}) — Scope ${k.scope_number}`,
      })),
    },
    { key: "lb_factor", label: "LB Emission Factor", type: "number", required: true, placeholder: "0.95", helpText: "Multiply quantity × this to get location-based emission" },
    { key: "emission_uom", label: "Emission UOM", type: "select", required: true, defaultValue: emissionUOMs[0]?.symbol ?? "tCO2e", options: emissionUOMs.map((u) => ({ value: u.symbol, label: `${u.symbol} — ${u.display_name}` })) },
    { key: "grid_zone_name", label: "Grid Zone Name", placeholder: "e.g. Maharashtra Western Grid" },
    { key: "valid_from", label: "Valid From", type: "date", required: true },
    { key: "valid_to", label: "Valid To", type: "date", helpText: "Leave empty for current/ongoing" },
    { key: "source", label: "Source", placeholder: "CEA 2024, IPCC" },
  ];

  const lbEditFields: FormField[] = [
    { key: "lb_factor", label: "LB Emission Factor", type: "number", required: true },
    { key: "emission_uom", label: "Emission UOM", type: "select", required: true, options: emissionUOMs.map((u) => ({ value: u.symbol, label: `${u.symbol} — ${u.display_name}` })) },
    { key: "grid_zone_name", label: "Grid Zone Name" },
    { key: "valid_to", label: "Valid To", type: "date", helpText: "Leave empty for current/ongoing" },
    { key: "source", label: "Source" },
  ];

  const isSupport = useIsSupportSession();
  const isAdmin = user?.role === "COMPANY_ADMIN" && !isSupport;

  return (
    <PageShell
      title="Locations"
      description={`${total} location${total !== 1 ? "s" : ""} registered`}
      breadcrumb={[{ label: "Company Portal", href: "/app" }, { label: "Locations" }]}
      actions={
        <div className="flex items-center gap-2">
          <div className="flex rounded-sm border border-border overflow-hidden bg-card" role="group" aria-label="View mode">
            <button
              onClick={() => toggleView("table")}
              aria-pressed={view === "table"}
              aria-label="Table view"
              className={`p-2 transition-colors ${view === "table" ? "bg-sunken text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <List size={15} />
            </button>
            <button
              onClick={() => toggleView("grid")}
              aria-pressed={view === "grid"}
              aria-label="Grid view"
              className={`p-2 transition-colors ${view === "grid" ? "bg-sunken text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <LayoutGrid size={15} />
            </button>
          </div>
          {isAdmin && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus size={16} /> Add Location
            </Button>
          )}
        </div>
      }
    >

      {loading ? (
        <div className="surface p-6"><LoadingSkeleton rows={6} cols={6} /></div>
      ) : locations.length === 0 ? (
        <div className="surface">
          <EmptyState icon={MapPin} title="No locations yet" description="Add your first plant, office, or facility to start tracking ESG data.">
            {isAdmin && (
              <Button onClick={() => setCreateOpen(true)}><Plus size={14} /> Add Location</Button>
            )}
          </EmptyState>
        </div>
      ) : view === "grid" ? (
        /* ── Grid View ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {locations.map((loc) => (
            <div key={loc.location_id} className="surface p-5 hover:shadow-sm transition-all duration-200 group">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-sm bg-accent flex items-center justify-center flex-shrink-0">
                    <MapPin size={20} className="text-primary" />
                  </div>
                  <div>
                    <div className="text-ui font-bold text-foreground leading-snug">{loc.location_name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {[loc.city, loc.state, loc.country].filter(Boolean).join(", ") || "No address"}
                    </div>
                  </div>
                </div>
                {(loc as any).is_high_risk_location && (
                  <Badge variant="warning" className="text-2xs flex-shrink-0">
                    <AlertTriangle size={10} className="mr-1" /> HRL
                  </Badge>
                )}
              </div>
              {loc.address && <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{loc.address}</p>}
              <div className="flex justify-between items-center pt-2 border-t border-[hsl(var(--border-hairline))]">
                <StatusBadge status={loc.is_active ? "ACTIVE" : "BLOCKED"} />
                {isAdmin && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => openLbPanel(loc)} title="LB Factors" className="text-brand-teal hover:bg-accent">
                      <Gauge size={13} />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setEditData(loc)} title="Edit">
                      <Pencil size={13} />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(loc)} title="Delete" className="hover:bg-destructive-tint hover:text-destructive">
                      <Trash2 size={13} />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <DataTable
          loading={loading}
          pagination={{ page, pageSize, total, onPageChange: setPage }}
          skeletonCols={7}
        >
          <Table>
            <TableHeader>
              <TableRow>
                {["Name", "City", "State", "Country", "HRL", "Status", ...(isAdmin ? [""] : [])].map((h, i) => (
                  <TableHead key={i}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((loc) => (
                <TableRow key={loc.location_id}>
                  <TableCell className="font-semibold text-foreground">{loc.location_name}</TableCell>
                  <TableCell className="text-muted-foreground">{loc.city || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{loc.state || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{loc.country || "—"}</TableCell>
                  <TableCell>
                    {(loc as any).is_high_risk_location ? (
                      <Badge variant="warning" className="text-2xs">
                        <AlertTriangle size={10} className="mr-1" /> Water Stress
                      </Badge>
                    ) : <span className="text-muted-foreground/40">—</span>}
                  </TableCell>
                  <TableCell><StatusBadge status={loc.is_active ? "ACTIVE" : "BLOCKED"} /></TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon-sm" onClick={() => openLbPanel(loc)} title="LB Factors" className="text-brand-teal hover:bg-accent">
                          <Gauge size={13} />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setEditData(loc)} title="Edit"><Pencil size={13} /></Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(loc)} title="Delete" className="hover:bg-destructive-tint hover:text-destructive"><Trash2 size={13} /></Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataTable>
      )}

      {/* ── LB Factors Dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!lbLocation} onOpenChange={(v) => { if (!v) closeLbPanel(); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gauge size={16} className="text-brand-teal" /> LB Emission Factors
            </DialogTitle>
            <DialogDescription>{lbLocation?.location_name} — Location-based factors used alongside Market-Based factors for dual Scope 2 emissions. Company Admin is responsible for accuracy.</DialogDescription>
          </DialogHeader>

          <DialogBody>
            {lbLoading ? (
              <LoadingSkeleton rows={4} cols={5} />
            ) : lbFactors.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Gauge size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-ui font-semibold">No LB factors set</p>
                <p className="text-label mt-1">Add LB factors for KPIs that have a scope assigned.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    {["KPI", "Scope", "LB Factor", "Grid Zone", "Valid From", "Valid To", "Status", ...(isAdmin ? [""] : [])].map((h, i) => (
                      <TableHead key={i}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lbFactors.map((f) => {
                    const today = new Date().toISOString().slice(0, 10);
                    const isActive = f.valid_from <= today && (!f.valid_to || f.valid_to >= today);
                    return (
                      <TableRow key={f.lb_factor_id}>
                        <TableCell className="font-semibold text-foreground">{f.kpi_name}</TableCell>
                        <TableCell>
                          {f.scope_number ? (
                            <Badge variant="warning" className="text-2xs">Scope {f.scope_number}</Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="font-semibold text-foreground">{f.lb_factor} <span className="text-muted-foreground font-normal">{f.emission_uom}</span></TableCell>
                        <TableCell className="text-muted-foreground">{f.grid_zone_name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(f.valid_from)}</TableCell>
                        <TableCell className="text-muted-foreground">{f.valid_to ? formatDate(f.valid_to) : <span className="text-muted-foreground">Ongoing</span>}</TableCell>
                        <TableCell>
                          {isActive
                            ? <Badge variant="success" className="text-2xs">Active</Badge>
                            : <span className="text-2xs text-muted-foreground">Expired</span>}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon-sm" onClick={() => setEditLb(f)} title="Edit"><Pencil size={12} /></Button>
                              <Button variant="ghost" size="icon-sm" onClick={() => setDeleteLb(f)} title="Delete" className="hover:bg-destructive-tint hover:text-destructive"><Trash2 size={12} /></Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </DialogBody>

          {isAdmin && (
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={handleRecalculateLb} disabled={actionLoading}>
                <RefreshCw size={13} /> Recalculate
              </Button>
              <Button size="sm" onClick={() => setAddLbOpen(true)}>
                <Plus size={13} /> Add LB Factor
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}
      <FormDialog open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={handleCreate} title="Add Location" description="Register a new plant, office, or facility" fields={fields} submitLabel="Add Location" loading={actionLoading} />
      <FormDialog open={!!editData} onClose={() => setEditData(null)} onSubmit={handleEdit} title="Edit Location" fields={fields} submitLabel="Save Changes" loading={actionLoading} initialData={editData || undefined} />
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Location" message={`Delete "${deleteTarget?.location_name}"? Data entries will be preserved but this location will be deactivated.`} confirmLabel="Delete" variant="destructive" loading={actionLoading} />

      {/* LB Factor dialogs */}
      <FormDialog open={addLbOpen} onClose={() => setAddLbOpen(false)} onSubmit={handleAddLb} title="Add LB Emission Factor" description="Set a location-based emission factor for a KPI" fields={lbAddFields} submitLabel="Add LB Factor" loading={actionLoading} />
      <FormDialog
        open={!!editLb}
        onClose={() => setEditLb(null)}
        onSubmit={handleEditLb}
        title="Edit LB Factor"
        description={editLb?.kpi_name || ""}
        fields={lbEditFields}
        submitLabel="Save Changes"
        loading={actionLoading}
        initialData={editLb ? {
          lb_factor: String(editLb.lb_factor),
          emission_uom: editLb.emission_uom,
          grid_zone_name: editLb.grid_zone_name || "",
          valid_to: editLb.valid_to || "",
          source: editLb.source || "",
        } : undefined}
      />
      <ConfirmDialog open={!!deleteLb} onClose={() => setDeleteLb(null)} onConfirm={handleDeleteLb} title="Delete LB Factor" message={`Delete the LB factor for "${deleteLb?.kpi_name}"? This will stop location-based calculation for future submissions.`} confirmLabel="Delete" variant="destructive" loading={actionLoading} />
    </PageShell>
  );
}
