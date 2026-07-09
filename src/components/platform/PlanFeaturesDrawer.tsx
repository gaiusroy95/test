/**
 * PlanFeaturesDrawer — Phase 3 UI: shows the (feature_key → quota) matrix
 * for a single subscription plan. Adding a new feature_key catalog row in
 * the DB makes it appear here automatically — no code change needed.
 *
 * Quota = -1 means "unlimited". Save uses bulk PUT /platform/plans/:id/features
 * which also keeps the legacy max_users/max_locations/max_kpis columns mirrored.
 */

import { useEffect, useState } from "react";
import { platformApi } from "@/api/client";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getApiError } from "@/lib/utils";
import type { SubscriptionPlan } from "@/types";

interface FeatureKey {
  feature_key: string;
  label: string;
  category: string;
  default_quota: number | null;
  description?: string | null;
  is_active: boolean;
}

interface PlanFeatureRow {
  feature_key: string;
  label: string;
  quota: number;
  category: string;
}

export default function PlanFeaturesDrawer({
  plan, onClose,
}: {
  plan: SubscriptionPlan;
  onClose: () => void;
}) {
  const [keys, setKeys]       = useState<FeatureKey[]>([]);
  const [rows, setRows]       = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [k, r] = await Promise.all([
          platformApi.listFeatureKeys(),
          platformApi.listPlanFeatures(plan.plan_id),
        ]);
        if (cancelled) return;
        const allKeys: FeatureKey[] = Array.isArray(k.data) ? k.data : [];
        const planRows: PlanFeatureRow[] = Array.isArray(r.data) ? r.data : [];
        setKeys(allKeys);
        const map: Record<string, number> = {};
        for (const fk of allKeys) {
          const existing = planRows.find((pr) => pr.feature_key === fk.feature_key);
          map[fk.feature_key] = existing ? existing.quota : (fk.default_quota ?? 0);
        }
        setRows(map);
      } catch (err: any) {
        toast.error(getApiError(err, "Failed to load plan features"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [plan.plan_id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = keys.map((k) => ({
        feature_key: k.feature_key,
        quota: Number(rows[k.feature_key] ?? 0),
      }));
      await platformApi.upsertPlanFeatures(plan.plan_id, body);
      toast.success("Features saved");
      onClose();
    } catch (err: any) {
      toast.error(getApiError(err, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-foreground/30" onClick={onClose} />
      <aside className="relative w-[520px] max-w-full h-full bg-card shadow-2xl border-l border-border flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-start justify-between">
          <div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Plan Features</div>
            <h3 className="text-[15px] font-bold text-foreground mt-0.5">{plan.plan_name}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Set quotas for each feature. <span className="font-mono">-1</span> means unlimited.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-sunken text-muted-foreground"><X size={16} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="text-[12px] text-muted-foreground">Loading…</div>
          ) : keys.length === 0 ? (
            <div className="text-[12px] text-muted-foreground text-center py-8">
              No active feature_keys defined. Insert rows into the
              <span className="font-mono"> feature_keys</span> table to extend.
            </div>
          ) : (
            <div className="space-y-3">
              {keys.map((k) => (
                <div key={k.feature_key} className="border border-border rounded-lg p-3 hover:border-border">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="text-[13px] font-semibold text-foreground">{k.label}</div>
                      <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{k.feature_key}</div>
                      {k.description && <div className="text-[11px] text-muted-foreground mt-1">{k.description}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={rows[k.feature_key] ?? 0}
                        onChange={(e) =>
                          setRows((prev) => ({ ...prev, [k.feature_key]: Number(e.target.value) }))
                        }
                        className="w-24 px-2 py-1.5 rounded border border-border text-[13px] font-mono text-right outline-none focus:border-primary"
                      />
                      <button
                        onClick={() =>
                          setRows((prev) => ({ ...prev, [k.feature_key]: -1 }))
                        }
                        className="text-[11px] text-muted-foreground hover:text-primary"
                        title="Set to unlimited"
                      >
                        ∞
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-border text-[13px] font-semibold text-muted-foreground hover:bg-sunken"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-[13px] font-semibold hover:bg-primaryDk disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </aside>
    </div>
  );
}
