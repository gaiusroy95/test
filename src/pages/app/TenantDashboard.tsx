import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { tenantApi } from "@/api/client";
import { getModuleIcon } from "@/lib/constants";
import { useModulesStore } from "@/store/modules";
import { StatCard, LoadingSkeleton } from "@/components/shared/PageComponents";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MapPin, BarChart3, Database, UserCheck, Plus, ClipboardCheck,
  FileText, ChevronRight, ArrowRight, Sparkles, CheckCircle2, Circle,
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
  const [reportingYears, setReportingYears] = useState<any[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>("");

  useEffect(() => {
    if (modules.length === 0) return;
    async function load() {
      try {
        const safe = async (fn: () => Promise<any>, fallback: any): Promise<any> => {
          try { return await fn(); } catch { return fallback; }
        };

        const yearsRes = await safe(() => tenantApi.listReportingYears(), { data: [] });
        const yearsData = (yearsRes as any).data;
        const years: any[] = Array.isArray(yearsData) ? yearsData : (yearsData?.items ?? []);
        const sorted = [...years].sort((a: any, b: any) => b.year_id - a.year_id);
        setReportingYears(sorted);
        const fyId = selectedYearId || String(sorted[0]?.year_id ?? "");
        if (!selectedYearId && fyId) setSelectedYearId(fyId);
        const currentYearId: number | undefined = fyId ? Number(fyId) : undefined;

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
  }, [modules, selectedYearId]);

  const selectedFyLabel = reportingYears.find((y) => String(y.year_id) === selectedYearId)?.financial_year?.fy_label
    ?? reportingYears.find((y) => String(y.year_id) === selectedYearId)?.fy_label
    ?? "Current FY";

  const onboardingSteps = [
    { label: "Add locations", done: stats.locations > 0, path: "/app/locations" },
    { label: "Configure KPIs", done: stats.metrics > 0, path: "/app/kpi-setup" },
    { label: "Invite users", done: false, path: "/app/users" },
    { label: "First submission", done: stats.entries > 0, path: "/app/esg-input" },
  ];
  const showOnboarding = stats.locations === 0 || stats.metrics === 0 || stats.entries === 0;

  const maxModuleCount = Math.max(...modules.map((m) => moduleProgress[m.module_id] ?? 0), 1);

  const quickActions = [
    { label: "Submit ESG Data", icon: Plus, desc: "Enter environmental data", path: "/app/esg-input", gradient: "from-info to-primary" },
    { label: "Review Submissions", icon: ClipboardCheck, desc: "Approve or reject entries", path: "/app/review", gradient: "from-teal to-ok" },
    { label: "Manage Locations", icon: MapPin, desc: "Sites and facilities", path: "/app/locations", gradient: "from-warn to-warn" },
    { label: "View Reports", icon: FileText, desc: "Analytics and charts", path: "/app/reports", gradient: "from-muted-foreground to-foreground" },
  ];

  return (
    <div className="page-root">
      {/* Hero welcome band */}
      <div className="dashboard-hero">
        <div className="pl-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-label font-semibold text-primary mb-1">
              <Sparkles size={13} />
              ESG Command Centre
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Welcome back, {user?.first_name || "there"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {user?.company_name || "Your company"} · {(user?.role || "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {reportingYears.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-label font-semibold text-muted-foreground">FY</span>
                <Select value={selectedYearId} onValueChange={setSelectedYearId}>
                  <SelectTrigger className="h-9 w-[140px] text-ui bg-card">
                    <SelectValue placeholder="Select FY" />
                  </SelectTrigger>
                  <SelectContent>
                    {reportingYears.map((y) => (
                      <SelectItem key={y.year_id} value={String(y.year_id)}>
                        {y.financial_year?.fy_label || y.fy_label || `FY ${y.year_id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {stats.pending > 0 && (
              <Button onClick={() => navigate("/app/review")} className="shrink-0 shadow-primary">
                <UserCheck size={16} />
                {stats.pending} pending review{stats.pending !== 1 ? "s" : ""}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <StatCard icon={MapPin}     label="Locations"      value={stats.locations} subtitle="Manage sites →"        to="/app/locations" />
        <StatCard icon={BarChart3}  label="KPIs"           value={stats.metrics}   subtitle="Configure tracking →"  accent="hsl(var(--teal))" to="/app/kpi-setup" />
        <StatCard icon={Database}   label="Submissions"    value={stats.entries}   subtitle={selectedFyLabel}              accent="hsl(var(--info))" to="/app/esg-input" />
        <StatCard icon={UserCheck}  label="Pending Review" value={stats.pending}   subtitle="Awaiting approval"     accent="hsl(var(--destructive))" to="/app/review" />
      </div>

      {/* Actions required */}
      {(stats.pending > 0 || notifications.some((n) => !n.is_read)) && (
        <div className="surface-elevated p-4 mb-6">
          <h2 className="text-sm font-bold text-foreground mb-3">Actions Required</h2>
          <div className="flex flex-col gap-2">
            {stats.pending > 0 && (
              <button onClick={() => navigate("/app/review")} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-sunken transition-colors text-left">
                <span className="text-ui font-semibold text-foreground">{stats.pending} submission{stats.pending !== 1 ? "s" : ""} awaiting review</span>
                <ChevronRight size={16} className="text-muted-foreground" />
              </button>
            )}
            {notifications.filter((n) => !n.is_read).slice(0, 2).map((n) => (
              <button
                key={n.notification_id}
                onClick={() => {
                  if (n.type === "SUBMITTED" || n.type === "APPROVED" || n.type === "REJECTED") {
                    navigate(n.record_id ? `/app/review/${n.record_id}` : "/app/review");
                  } else {
                    navigate("/app/esg-input");
                  }
                }}
                className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-sunken transition-colors text-left"
              >
                <span className="text-ui text-foreground truncate">{n.title}</span>
                <ChevronRight size={16} className="text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {showOnboarding && (
        <div className="surface-elevated p-4 mb-6">
          <h2 className="text-sm font-bold text-foreground mb-3">Getting Started</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {onboardingSteps.map((step) => (
              <button
                key={step.label}
                onClick={() => navigate(step.path)}
                className="flex items-center gap-2.5 p-3 rounded-lg border border-border hover:bg-sunken transition-colors text-left"
              >
                {step.done ? (
                  <CheckCircle2 size={16} className="text-ok shrink-0" />
                ) : (
                  <Circle size={16} className="text-muted-foreground shrink-0" />
                )}
                <span className={`text-ui font-medium ${step.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {step.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="mb-6">
        <h2 className="text-sm font-bold text-foreground mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {quickActions.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.label}
                onClick={() => navigate(a.path)}
                className="group surface-elevated p-4 flex items-center gap-3 text-left cursor-pointer hover:shadow-elevated hover:border-primary/20 transition-all duration-200"
              >
                <div className={`w-10 h-10 rounded-xl brand-gradient flex items-center justify-center flex-shrink-0 shadow-primary group-hover:scale-105 transition-transform`}>
                  <Icon size={18} className="text-white" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{a.label}</div>
                  <div className="text-label text-muted-foreground">{a.desc}</div>
                </div>
                <ArrowRight size={15} className="text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Module progress */}
        <div className="lg:col-span-3 surface-elevated p-6">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h3 className="text-base font-bold text-foreground">Module Progress</h3>
              <p className="text-label text-muted-foreground mt-0.5">Approved entries this financial year</p>
            </div>
          </div>
          {loading ? (
            <LoadingSkeleton rows={4} cols={1} />
          ) : (
            <div className="flex flex-col gap-4">
              {modules.map((m) => {
                const Icon = getModuleIcon(m.icon_name);
                const count = moduleProgress[m.module_id] ?? 0;
                const pct = Math.round((count / maxModuleCount) * 100);
                return (
                  <div key={m.key} className="flex items-center gap-4 p-3 rounded-lg hover:bg-sunken/60 transition-colors">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-surface" style={{ background: m.bg_color }}>
                      <Icon size={18} style={{ color: m.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-sm font-semibold text-foreground">{m.module_name}</span>
                        <span className="text-label font-bold text-foreground tabular-nums">{count} approved</span>
                      </div>
                      <Progress
                        value={pct}
                        className="h-2 bg-sunken"
                        indicatorClassName="transition-all duration-700 rounded-full"
                        indicatorStyle={{ background: m.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className="lg:col-span-2 surface-elevated p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Recent Activity</h3>
              <p className="text-label text-muted-foreground mt-0.5">Latest notifications</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/app/notifications")} className="text-primary text-label h-7 px-2">
              View all <ChevronRight size={13} className="ml-0.5" />
            </Button>
          </div>
          {loading ? (
            <LoadingSkeleton rows={5} cols={1} />
          ) : notifications.length === 0 ? (
            <div className="text-sm text-muted-foreground py-10 text-center">No recent activity</div>
          ) : (
            <div className="flex flex-col divide-y divide-border/60">
              {notifications.map((n) => (
                <div
                  key={n.notification_id}
                  className={`py-3 cursor-pointer hover:bg-accent/50 rounded-lg px-2 -mx-2 transition-colors ${!n.is_read ? "bg-accent/30" : ""}`}
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
                    <div className="text-sm font-semibold text-foreground leading-snug">{n.title}</div>
                    <Badge variant={notifBadgeVariant[n.type] || "secondary"} className="text-2xs flex-shrink-0">
                      {n.type}
                    </Badge>
                  </div>
                  {n.message && <div className="text-label text-muted-foreground truncate">{n.message}</div>}
                  <div className="text-2xs text-muted-foreground mt-1">{formatDateTime(n.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
