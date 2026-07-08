import { useEffect, useState, useCallback } from "react";
import { platformApi } from "@/api/client";
import { PageHeader } from "@/components/shared/PageComponents";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { toast } from "sonner";
import { CheckCircle2, Archive, AlertCircle, Edit3, Send, MinusCircle } from "lucide-react";
import { getModuleIcon } from "@/lib/constants";
import { getApiError } from "@/lib/utils";
import type { AppModule, AppFeature, LifecycleStatus, SubscriptionPlan } from "@/types";

type TabKey = "modules" | "features";
type CapabilityKind = "module" | "feature";

const LIFECYCLE_STYLES: Record<LifecycleStatus, { bg: string; text: string; label: string }> = {
  DRAFT:      { bg: "bg-amber-50",  text: "text-amber-700",  label: "Draft" },
  PUBLISHED:  { bg: "bg-green-50",  text: "text-green-700",  label: "Published" },
  DEPRECATED: { bg: "bg-orange-50", text: "text-orange-700", label: "Deprecated" },
  ARCHIVED:   { bg: "bg-slate-100", text: "text-slate-600",  label: "Archived" },
};

interface PlanRow {
  plan_id: number;
  plan_name: string;
  included: boolean;
}

export default function CapabilityCatalogPage() {
  const [tab, setTab] = useState<TabKey>("modules");
  const [modules, setModules] = useState<AppModule[]>([]);
  const [features, setFeatures] = useState<AppFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Lifecycle change dialog
  const [lifecycleTarget, setLifecycleTarget] = useState<{ kind: CapabilityKind; id: number; name: string; current: LifecycleStatus; next: LifecycleStatus } | null>(null);

  // Publish-with-plans dialog
  const [publishTarget, setPublishTarget] = useState<{ kind: CapabilityKind; id: number; name: string } | null>(null);
  const [publishPlans, setPublishPlans] = useState<PlanRow[]>([]);
  const [publishPlansLoading, setPublishPlansLoading] = useState(false);

  // Bulk revoke confirm
  const [bulkRevokeTarget, setBulkRevokeTarget] = useState<{ kind: CapabilityKind; id: number; name: string } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, fRes] = await Promise.all([
        platformApi.listModules(),
        platformApi.listAppFeatures(),
      ]);
      setModules(Array.isArray(mRes.data) ? mRes.data : []);
      setFeatures(Array.isArray(fRes.data) ? fRes.data : []);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to load catalog"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Lifecycle transition ────────────────────────────────────────────────
  const confirmLifecycleChange = async (reason?: string) => {
    if (!lifecycleTarget) return;
    setActionLoading(true);
    try {
      if (lifecycleTarget.kind === "module") {
        await platformApi.changeModuleLifecycle(lifecycleTarget.id, lifecycleTarget.next, reason);
      } else {
        await platformApi.changeFeatureLifecycle(lifecycleTarget.id, lifecycleTarget.next, reason);
      }
      toast.success(`${lifecycleTarget.name} → ${LIFECYCLE_STYLES[lifecycleTarget.next].label}`);
      setLifecycleTarget(null);
      fetchAll();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to change lifecycle"));
    } finally { setActionLoading(false); }
  };

  // ── Publish (DRAFT → PUBLISHED with plan inclusion) ─────────────────────
  const openPublishDialog = async (kind: CapabilityKind, id: number, name: string) => {
    setPublishTarget({ kind, id, name });
    setPublishPlansLoading(true);
    try {
      const { data: plansData } = await platformApi.listPlans();
      const allPlans: SubscriptionPlan[] = Array.isArray(plansData) ? plansData : [];
      // Fetch plan-current capability includes
      const includesByPlan = await Promise.all(
        allPlans.map(async (p) => {
          const res = kind === "module"
            ? await platformApi.listPlanModules(p.plan_id)
            : await platformApi.listPlanAppFeatures(p.plan_id);
          const rows: any[] = Array.isArray(res.data) ? res.data : [];
          const idField = kind === "module" ? "module_id" : "feature_id";
          const isIncluded = rows.some((r: any) => r[idField] === id && r.included);
          return { plan_id: p.plan_id, plan_name: p.plan_name, included: isIncluded };
        })
      );
      setPublishPlans(includesByPlan);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to load plans"));
      setPublishTarget(null);
    } finally { setPublishPlansLoading(false); }
  };

  const togglePublishPlan = (planId: number) => {
    setPublishPlans(prev => prev.map(p => p.plan_id === planId ? { ...p, included: !p.included } : p));
  };

  const confirmPublish = async () => {
    if (!publishTarget) return;
    setActionLoading(true);
    try {
      // 1. Publish the capability
      if (publishTarget.kind === "module") {
        await platformApi.changeModuleLifecycle(publishTarget.id, "PUBLISHED");
      } else {
        await platformApi.changeFeatureLifecycle(publishTarget.id, "PUBLISHED");
      }
      // 2. Update plan inclusion for each plan that changed
      for (const p of publishPlans) {
        const planCapsRes = publishTarget.kind === "module"
          ? await platformApi.listPlanModules(p.plan_id)
          : await platformApi.listPlanAppFeatures(p.plan_id);
        const rows: any[] = Array.isArray(planCapsRes.data) ? planCapsRes.data : [];
        const idField = publishTarget.kind === "module" ? "module_id" : "feature_id";
        const currentIds = rows.filter(r => r.included).map(r => r[idField]);
        const targetSet = new Set(currentIds);
        if (p.included) targetSet.add(publishTarget.id);
        else            targetSet.delete(publishTarget.id);
        // Get also other-kind ids from plan to preserve
        const otherKindRes = publishTarget.kind === "module"
          ? await platformApi.listPlanAppFeatures(p.plan_id)
          : await platformApi.listPlanModules(p.plan_id);
        const otherRows: any[] = Array.isArray(otherKindRes.data) ? otherKindRes.data : [];
        const otherIdField = publishTarget.kind === "module" ? "feature_id" : "module_id";
        const otherIds = otherRows.filter(r => r.included).map(r => r[otherIdField]);

        const moduleIds = publishTarget.kind === "module" ? Array.from(targetSet) : otherIds;
        const featureIds = publishTarget.kind === "module" ? otherIds : Array.from(targetSet);
        await platformApi.setPlanCapabilities(p.plan_id, moduleIds, featureIds);
      }
      toast.success(`${publishTarget.name} published`);
      setPublishTarget(null);
      fetchAll();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to publish"));
    } finally { setActionLoading(false); }
  };

  // ── Bulk revoke ─────────────────────────────────────────────────────────
  const confirmBulkRevoke = async (reason?: string) => {
    if (!bulkRevokeTarget) return;
    setActionLoading(true);
    try {
      const res = bulkRevokeTarget.kind === "module"
        ? await platformApi.bulkRevokeModule(bulkRevokeTarget.id, reason)
        : await platformApi.bulkRevokeFeature(bulkRevokeTarget.id, reason);
      const affected = res.data?.affected_companies ?? 0;
      toast.success(`Revoked from ${affected} compan${affected === 1 ? "y" : "ies"}`);
      setBulkRevokeTarget(null);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to revoke"));
    } finally { setActionLoading(false); }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  const rows: Array<{ kind: CapabilityKind; id: number; name: string; key: string; iconName: string; color: string; lifecycle: LifecycleStatus }> = tab === "modules"
    ? modules.map(m => ({ kind: "module" as const, id: m.module_id, name: m.module_name, key: m.key, iconName: m.icon_name, color: m.color, lifecycle: m.lifecycle_status }))
    : features.map(f => ({ kind: "feature" as const, id: f.feature_id, name: f.feature_name, key: f.key, iconName: f.icon_name, color: f.color, lifecycle: f.lifecycle_status }));

  return (
    <div className="p-6 max-w-[1600px]">
      <PageHeader
        title="Capability Catalog"
        description="Manage modules, features, and which subscription plans include them"
        breadcrumb={[{ label: "Platform" }, { label: "Catalog" }]}
      />

      {/* Tab bar */}
      <div className="flex items-end justify-between border-b border-slate-200 mb-4">
        <div className="flex">
          <button
            onClick={() => setTab("modules")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors
              ${tab === "modules" ? "border-brand-accent text-brand-accent" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"}`}
          >
            Modules <span className="text-[11px] text-slate-400">({modules.length})</span>
          </button>
          <button
            onClick={() => setTab("features")}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors
              ${tab === "features" ? "border-brand-accent text-brand-accent" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"}`}
          >
            Features <span className="text-[11px] text-slate-400">({features.length})</span>
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Capability</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Lifecycle</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} className="text-center text-slate-400 py-8">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center text-slate-400 py-8">No {tab} yet</TableCell></TableRow>
            ) : rows.map(r => {
              const Icon = getModuleIcon(r.iconName);
              const lcStyle = LIFECYCLE_STYLES[r.lifecycle];
              return (
                <TableRow key={`${r.kind}-${r.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: r.color + "22" }}>
                        <Icon size={14} style={{ color: r.color }} />
                      </div>
                      <span className="font-semibold text-brand-navy">{r.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-[12px] text-slate-500 font-mono">{r.key}</TableCell>
                  <TableCell>
                    <Badge className={`${lcStyle.bg} ${lcStyle.text}`}>{lcStyle.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      {r.lifecycle === "DRAFT" && (
                        <Button size="sm" variant="default" className="gap-1" onClick={() => openPublishDialog(r.kind, r.id, r.name)}>
                          <Send size={12} /> Publish
                        </Button>
                      )}
                      {r.lifecycle === "PUBLISHED" && (
                        <>
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => setLifecycleTarget({ kind: r.kind, id: r.id, name: r.name, current: r.lifecycle, next: "DEPRECATED" })}>
                            <AlertCircle size={12} /> Deprecate
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => setBulkRevokeTarget({ kind: r.kind, id: r.id, name: r.name })}>
                            <MinusCircle size={12} /> Bulk Revoke
                          </Button>
                        </>
                      )}
                      {r.lifecycle === "DEPRECATED" && (
                        <>
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => setLifecycleTarget({ kind: r.kind, id: r.id, name: r.name, current: r.lifecycle, next: "PUBLISHED" })}>
                            <CheckCircle2 size={12} /> Re-publish
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => setLifecycleTarget({ kind: r.kind, id: r.id, name: r.name, current: r.lifecycle, next: "ARCHIVED" })}>
                            <Archive size={12} /> Archive
                          </Button>
                        </>
                      )}
                      {r.lifecycle === "ARCHIVED" && (
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => setLifecycleTarget({ kind: r.kind, id: r.id, name: r.name, current: r.lifecycle, next: "DRAFT" })}>
                          <Edit3 size={12} /> Restore to Draft
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Lifecycle change confirm */}
      <ConfirmDialog
        open={!!lifecycleTarget}
        onClose={() => setLifecycleTarget(null)}
        onConfirm={confirmLifecycleChange}
        title={`Change lifecycle: ${lifecycleTarget?.name}`}
        message={`Move "${lifecycleTarget?.name}" from ${lifecycleTarget && LIFECYCLE_STYLES[lifecycleTarget.current].label} to ${lifecycleTarget && LIFECYCLE_STYLES[lifecycleTarget.next].label}?`}
        showReason
        loading={actionLoading}
      />

      {/* Bulk revoke confirm */}
      <ConfirmDialog
        open={!!bulkRevokeTarget}
        onClose={() => setBulkRevokeTarget(null)}
        onConfirm={confirmBulkRevoke}
        title={`Bulk revoke: ${bulkRevokeTarget?.name}`}
        message={`This will disable "${bulkRevokeTarget?.name}" for ALL companies. They will no longer see it in their portal. Each company's row will be marked as override so they don't get re-added by plan inheritance.`}
        variant="destructive"
        showReason
        loading={actionLoading}
      />

      {/* Publish dialog */}
      <Dialog open={!!publishTarget} onOpenChange={(v) => { if (!v) setPublishTarget(null); }}>
        <DialogContent className="max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Publish: {publishTarget?.name}</DialogTitle>
            <DialogDescription>
              Choose which subscription plans include this capability. All companies on the selected plans will gain access immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {publishPlansLoading ? (
              <div className="text-[13px] text-slate-400 py-4 text-center animate-pulse">Loading plans…</div>
            ) : (
              <div className="flex flex-col gap-2">
                {publishPlans.map(p => (
                  <label key={p.plan_id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={p.included}
                      onChange={() => togglePublishPlan(p.plan_id)}
                      className="w-4 h-4 accent-brand-accent"
                    />
                    <span className="text-[13px] font-semibold text-brand-navy">{p.plan_name}</span>
                  </label>
                ))}
                {publishPlans.length === 0 && (
                  <div className="text-[12px] text-slate-400 py-2 text-center">No plans found</div>
                )}
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishTarget(null)} disabled={actionLoading}>Cancel</Button>
            <Button onClick={confirmPublish} disabled={actionLoading || publishPlansLoading}>
              {actionLoading ? "Publishing…" : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
