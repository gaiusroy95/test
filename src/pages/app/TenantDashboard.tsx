import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { tenantApi } from "@/api/client";
import { getModuleIcon } from "@/lib/constants";
import { useModulesStore } from "@/store/modules";
import { StatCard, LoadingSkeleton, PageShell } from "@/components/shared/PageComponents";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin, BarChart3, Database, UserCheck, Plus, ClipboardCheck,
  FileText, ChevronRight, ArrowRight,
} from "lucide-react";
import type { Notification } from "@/types";
import { formatDateTime } from "@/lib/utils";

const notifBadgeVariant: Record<string, "info" | "success" | "destructive" | "secondary" | "warning"> = {
  SUBMITTED: "info",
  APPROVED:  "success",
  REJECTED:  "destructive",
  LOCKED:    "secondary",
  EDITED:    "warning",
  REMINDER:  "warning",
};

export default function TenantDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const modules = useModulesStore((s) => s.modules);
  const [stats, setStats] = useState({ locations: 0, metrics: 0, entries: 0, pending: 0 });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [moduleProgress, setModuleProgress] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (modules.length === 0) return; // Wait for modules to load from store
    async function load() {
      try {
        const safe = async (fn: () => Promise<any>, fallback: any): Promise<any> => {
          try { return await fn(); } catch { return fallback; }
        };

        const yearsRes = await safe(() => tenantApi.listReportingYears(), { data: [] });
        const yearsData = (yearsRes as any).data;
        const years: any[] = Array.isArray(yearsData) ? yearsData : (yearsData?.items ?? []);
        const currentYearId: number | undefined = years.sort((a: any, b: any) => b.year_id - a.year_id)[0]?.year_id;

        const [locRes, metRes, dataRes, pendRes, notifRes, ...modResults] = await Promise.all([
          safe(() => tenantApi.listLocations({ size: 1 }), { data: { total: 0 } }),
          safe(() => tenantApi.listKPIs({ size: 1 }), { data: { total: 0 } }),
          safe(() => tenantApi.listSubmissions({ ...(currentYearId ? { year_id: currentYearId } : {}), size: 1 }), { data: { total: 0 } }),
          safe(() => tenantApi.listSubmissions({ status: "SUBMITTED", ...(currentYearId ? { year_id: currentYearId } : {}), size: 1 }), { data: { total: 0 } }),
          safe(() => tenantApi.listNotifications({ size: 5 }), { data: { items: [] } }),
          ...modules.map((m) =>
            safe(() => tenantApi.listESGInputs({ module_id: m.module_id, ...(currentYearId ? { year_id: currentYearId } : {}), size: 1 }), { data: { total: 0 } })
          ),
        ]);

        setStats({
          locations: (locRes as any).data?.total ?? 0,
          metrics: (metRes as any).data?.total ?? 0,
          entries: (dataRes as any).data?.total ?? 0,
          pending: (pendRes as any).data?.total ?? 0,
        });

        const notifData = (notifRes as any).data;
        setNotifications(notifData?.items || (Array.isArray(notifData) ? notifData : []));

        const progress: Record<number, number> = {};
        modules.forEach((m, i) => {
          progress[m.module_id] = (modResults[i] as any).data?.total ?? 0;
        });
        setModuleProgress(progress);
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [modules]);

  const maxModuleCount = Math.max(...modules.map((m) => moduleProgress[m.module_id] ?? 0), 1);

  const quickActions = [
    { label: "Submit ESG Data", icon: Plus, desc: "Submit new ESG data", path: "/app/esg-input", color: "#0ea5e9" },
    { label: "Review Submissions", icon: ClipboardCheck, desc: "Approve or reject entries", path: "/app/review", color: "#14b8a6" },
    { label: "Manage Locations", icon: MapPin, desc: "Add or edit sites", path: "/app/locations", color: "#f59e0b" },
    { label: "View Reports", icon: FileText, desc: "Analytics & charts", path: "/app/reports", color: "#64748b" },
  ];

  return (
    <PageShell
      title={`Welcome back, ${user?.first_name || ""}`}
      description={`${user?.company_name || ""} · ${(user?.role || "").replace(/_/g, " ")}`}
      breadcrumb={[{ label: "Company Portal" }]}
    >
      {/* Stat Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard icon={MapPin}     label="Locations"      value={stats.locations} subtitle="Manage sites →"        to="/app/locations" />
        <StatCard icon={BarChart3}  label="KPIs"           value={stats.metrics}   subtitle="Configure tracking →"  accent="hsl(var(--teal))" to="/app/kpi-setup" />
        <StatCard icon={Database}   label="Submissions"    value={stats.entries}   subtitle="This financial year"   accent="hsl(var(--warn))" to="/app/esg-input" />
        <StatCard icon={UserCheck}  label="Pending Review" value={stats.pending}   subtitle="Awaiting approval"     accent="hsl(var(--destructive))" to="/app/review" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {quickActions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              onClick={() => navigate(a.path)}
              className="bg-card rounded-md p-5 border border-border flex items-start gap-4 text-left cursor-pointer hover:border-border hover:shadow-elevated transition-all duration-200 group"
            >
              <div className="w-10 h-10 rounded-sm flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-200" style={{ background: `${a.color}15` }}>
                <Icon size={20} style={{ color: a.color }} aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-ui font-bold text-foreground group-hover:text-primary transition-colors">{a.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{a.desc}</div>
              </div>
              <ArrowRight size={15} className="text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-0.5 flex-shrink-0" aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Module Progress */}
        <div className="lg:col-span-3 surface p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-[15px] font-bold text-brand-navy">Module Progress</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Approved entries this financial year</p>
            </div>
          </div>
          {loading ? (
            <LoadingSkeleton rows={4} cols={1} />
          ) : (
            <div className="flex flex-col gap-5">
              {modules.map((m) => {
                const Icon = getModuleIcon(m.icon_name);
                const count = moduleProgress[m.module_id] ?? 0;
                const pct = Math.round((count / maxModuleCount) * 100);
                return (
                  <div key={m.key} className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-[9px] flex items-center justify-center flex-shrink-0" style={{ background: m.bg_color }}>
                      <Icon size={18} style={{ color: m.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[13px] font-semibold text-brand-navy">{m.module_name}</span>
                        <span className="text-[12px] font-bold text-brand-navy tabular-nums">{count} approved</span>
                      </div>
                      <Progress
                        value={pct}
                        className="h-[6px] bg-slate-100"
                        indicatorClassName="transition-all duration-700"
                        indicatorStyle={{ background: m.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 surface p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-[15px] font-bold text-brand-navy">Recent Activity</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Latest notifications</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/app/notifications")} className="text-brand-accent text-[12px] h-7 px-2">
              View all <ChevronRight size={13} className="ml-0.5" />
            </Button>
          </div>
          {loading ? (
            <LoadingSkeleton rows={5} cols={1} />
          ) : notifications.length === 0 ? (
            <div className="text-[13px] text-slate-400 py-10 text-center">No recent activity</div>
          ) : (
            <div className="flex flex-col divide-y divide-slate-100">
              {notifications.map((n) => (
                <div
                  key={n.notification_id}
                  className={`py-3 cursor-pointer hover:bg-slate-50 rounded-lg px-2 transition-colors ${!n.is_read ? "bg-sky-50/40" : ""}`}
                  onClick={() => {
                    if (!n.record_id) return;
                    if (n.type === "SUBMITTED" || n.type === "APPROVED" || n.type === "REJECTED") {
                      navigate("/app/review");
                    } else {
                      navigate("/app/esg-input");
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-0.5">
                    <div className="text-[13px] font-semibold text-brand-navy leading-snug">{n.title}</div>
                    <Badge variant={notifBadgeVariant[n.type] || "secondary"} className="text-[10px] flex-shrink-0 mt-0.5">
                      {n.type}
                    </Badge>
                  </div>
                  {n.message && <div className="text-[12px] text-slate-500 truncate">{n.message}</div>}
                  <div className="text-[11px] text-slate-400 mt-1">{formatDateTime(n.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
