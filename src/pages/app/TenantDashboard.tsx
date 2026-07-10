import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { tenantApi } from "@/api/client";
import { getModuleIcon } from "@/lib/constants";
import { useModulesStore } from "@/store/modules";
import { LoadingSkeleton } from "@/components/shared/PageComponents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MapPin, BarChart3, Database, UserCheck, Plus, ClipboardCheck,
  FileText, ChevronRight, CheckCircle2, Circle, AlertTriangle, Clock, ArrowUpRight,
} from "lucide-react";
import type { Notification } from "@/types";
import { formatDateTime, cn } from "@/lib/utils";

const notifBadgeVariant: Record<string, "info" | "success" | "destructive" | "secondary" | "warning"> = {
  SUBMITTED: "info",
  APPROVED:  "success",
  REJECTED:  "destructive",
  LOCKED:    "secondary",
  EDITED:    "warning",
  REMINDER:  "warning",
};

type AttentionItem = {
  id: string;
  title: string;
  detail?: string;
  tone: "warn" | "info" | "ok";
  path: string;
};

export default function TenantDashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const modules = useModulesStore((s) => s.modules);
  const [stats, setStats] = useState({ locations: 0, metrics: 0, entries: 0, pending: 0, rejected: 0, openRemarks: 0 });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [moduleCounts, setModuleCounts] = useState<Record<number, number>>({});
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
        const yearParams = currentYearId ? { year_id: currentYearId } : {};

        const [locRes, metRes, dataRes, pendRes, rejRes, notifRes, remarksRes, ...modResults] = await Promise.all([
          safe(() => tenantApi.listLocations({ size: 1 }), { data: { total: 0 } }),
          safe(() => tenantApi.listKPIs({ size: 1 }), { data: { total: 0 } }),
          safe(() => tenantApi.listSubmissions({ ...yearParams, size: 1 }), { data: { total: 0 } }),
          safe(() => tenantApi.listSubmissions({ status: "SUBMITTED", ...yearParams, size: 1 }), { data: { total: 0 } }),
          safe(() => tenantApi.listSubmissions({ status: "REJECTED", ...yearParams, size: 1 }), { data: { total: 0 } }),
          safe(() => tenantApi.listNotifications({ size: 8 }), { data: { items: [] } }),
          safe(() => tenantApi.remarkSummary(), { data: { open_count: 0 } }),
          ...modules.map((m) =>
            safe(() => tenantApi.listESGInputs({ module_id: m.module_id, ...yearParams, size: 1 }), { data: { total: 0 } })
          ),
        ]);

        setStats({
          locations: (locRes as any).data?.total ?? 0,
          metrics: (metRes as any).data?.total ?? 0,
          entries: (dataRes as any).data?.total ?? 0,
          pending: (pendRes as any).data?.total ?? 0,
          rejected: (rejRes as any).data?.total ?? 0,
          openRemarks: (remarksRes as any).data?.open_count ?? 0,
        });

        const notifData = (notifRes as any).data;
        setNotifications(notifData?.items || (Array.isArray(notifData) ? notifData : []));

        const counts: Record<number, number> = {};
        modules.forEach((m, i) => {
          counts[m.module_id] = (modResults[i] as any).data?.total ?? 0;
        });
        setModuleCounts(counts);
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
    { label: "Assign reporting year", done: reportingYears.length > 0, path: "/app/reporting" },
    { label: "First submission", done: stats.entries > 0, path: "/app/esg-input" },
  ];
  const showOnboarding = stats.locations === 0 || stats.metrics === 0 || stats.entries === 0 || reportingYears.length === 0;
  const unread = notifications.filter((n) => !n.is_read);
  const setupDone = onboardingSteps.filter((s) => s.done).length;
  const setupPct = Math.round((setupDone / onboardingSteps.length) * 100);

  const attention: AttentionItem[] = [];
  if (stats.pending > 0) {
    attention.push({
      id: "pending",
      title: `${stats.pending} submission${stats.pending !== 1 ? "s" : ""} awaiting review`,
      detail: "Approve or reject before the period closes",
      tone: "warn",
      path: "/app/review",
    });
  }
  if (stats.rejected > 0) {
    attention.push({
      id: "rejected",
      title: `${stats.rejected} rejected submission${stats.rejected !== 1 ? "s" : ""}`,
      detail: "Needs correction and resubmission",
      tone: "warn",
      path: "/app/review",
    });
  }
  if (stats.openRemarks > 0) {
    attention.push({
      id: "remarks",
      title: `${stats.openRemarks} open auditor remark${stats.openRemarks !== 1 ? "s" : ""}`,
      detail: "Respond to keep the audit trail current",
      tone: "info",
      path: "/app/auditor-remarks",
    });
  }
  unread.slice(0, 3).forEach((n) => {
    attention.push({
      id: n.notification_id,
      title: n.title,
      detail: n.message || undefined,
      tone: "info",
      path:
        n.type === "SUBMITTED" || n.type === "APPROVED" || n.type === "REJECTED"
          ? (n.record_id ? `/app/review/${n.record_id}` : "/app/review")
          : "/app/esg-input",
    });
  });

  const kpis = [
    { label: "Pending review", value: stats.pending, icon: Clock, path: "/app/review", emphasize: stats.pending > 0, hint: "Needs action" },
    { label: "Submissions", value: stats.entries, icon: Database, path: "/app/esg-input", emphasize: false, hint: selectedFyLabel },
    { label: "Locations", value: stats.locations, icon: MapPin, path: "/app/locations", emphasize: false, hint: "Active sites" },
    { label: "KPIs", value: stats.metrics, icon: BarChart3, path: "/app/kpi-setup", emphasize: false, hint: "Configured" },
  ];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="page-root stagger-in">
      {/* Hero band — brand-forward composition */}
      <section className="relative overflow-hidden rounded-lg border border-border bg-card mb-4">
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden
          style={{
            background:
              "linear-gradient(135deg, hsl(168 45% 7%) 0%, hsl(168 50% 12%) 48%, hsl(172 40% 16%) 100%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.12] pointer-events-none"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(94,234,212,0.45) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="absolute -right-16 -top-20 w-72 h-72 rounded-full bg-teal-400/20 blur-3xl pointer-events-none" aria-hidden />
        <div className="absolute right-24 -bottom-24 w-56 h-56 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" aria-hidden />

        <div className="relative px-5 py-5 sm:px-6 sm:py-6 flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-200/80 mb-2">
              Operations · {selectedFyLabel}
            </p>
            <h1 className="text-[28px] sm:text-[32px] font-extrabold tracking-[-0.04em] text-white leading-[1.1]">
              {user?.first_name ? `${greeting}, ${user.first_name}` : greeting}
            </h1>
            <p className="text-ui text-teal-100/70 mt-1.5 max-w-xl">
              {user?.company_name || "Your company"} — track submissions, clear reviews, stay audit-ready.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {reportingYears.length > 0 && (
              <Select value={selectedYearId} onValueChange={setSelectedYearId}>
                <SelectTrigger className="h-9 w-[132px] text-ui bg-white/10 border-white/15 text-white hover:bg-white/15">
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
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/app/esg-input")}
              className="h-9 border-white/20 bg-white/5 text-white hover:bg-white/15 hover:text-white"
            >
              <Plus size={14} /> Enter data
            </Button>
            <Button size="sm" onClick={() => navigate("/app/review")} className="h-9 bg-teal-300 text-teal-950 hover:bg-teal-200">
              <ClipboardCheck size={14} /> Review queue
              {stats.pending > 0 && (
                <span className="ml-1 font-mono text-[11px] tabular-nums">({stats.pending})</span>
              )}
            </Button>
          </div>
        </div>
      </section>

      {/* KPI strip */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <button
              key={k.label}
              type="button"
              onClick={() => navigate(k.path)}
              className={cn(
                "group relative overflow-hidden rounded-lg border bg-card px-4 py-3.5 text-left transition-all duration-200",
                "hover:-translate-y-0.5 hover:shadow-elevated",
                k.emphasize ? "border-warn/50 ring-1 ring-warn/20" : "border-border"
              )}
            >
              <div
                className={cn(
                  "absolute left-0 top-0 bottom-0 w-1",
                  k.emphasize ? "bg-warn" : "bg-primary/80 opacity-0 group-hover:opacity-100 transition-opacity"
                )}
              />
              <div className="flex items-start justify-between gap-2 mb-3">
                <span className="text-label font-semibold text-muted-foreground uppercase tracking-wide">{k.label}</span>
                <span className={cn(
                  "w-8 h-8 rounded-md flex items-center justify-center",
                  k.emphasize ? "bg-warn-tint text-warn" : "bg-accent text-primary"
                )}>
                  <Icon size={15} />
                </span>
              </div>
              <div className="metric-value text-[26px]">{loading ? "—" : k.value.toLocaleString()}</div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-label text-muted-foreground">{k.hint}</span>
                <ArrowUpRight size={13} className="text-muted-foreground/40 group-hover:text-primary transition-colors" />
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 mb-4">
        {/* Attention — dominant column */}
        <section className="lg:col-span-7 rounded-lg border border-border bg-card overflow-hidden shadow-surface">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 bg-gradient-to-r from-warn-tint/40 to-transparent">
            <h2 className="section-title flex items-center gap-2">
              <span className="w-7 h-7 rounded-md bg-warn-tint text-warn flex items-center justify-center">
                <AlertTriangle size={14} />
              </span>
              Needs attention
            </h2>
            <span className="text-label font-semibold text-muted-foreground tabular-nums">
              {attention.length} open
            </span>
          </div>
          {loading ? (
            <div className="p-4"><LoadingSkeleton rows={3} cols={1} /></div>
          ) : attention.length === 0 ? (
            <div className="px-5 py-10 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-ok-tint text-ok flex items-center justify-center mb-3">
                <CheckCircle2 size={22} />
              </div>
              <p className="text-ui font-bold text-foreground">All clear for this FY</p>
              <p className="text-label text-muted-foreground mt-1 max-w-xs">
                No pending reviews, rejections, or open remarks. Keep entering data on schedule.
              </p>
              <Button size="sm" className="mt-4" onClick={() => navigate("/app/esg-input")}>
                <Plus size={14} /> Enter ESG data
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {attention.slice(0, 6).map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => navigate(item.path)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-sunken/70 transition-colors group"
                  >
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0 ring-4",
                        item.tone === "warn" ? "bg-warn ring-warn/15" : "bg-info ring-info/15"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-ui font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {item.title}
                      </p>
                      {item.detail && (
                        <p className="text-label text-muted-foreground truncate mt-0.5">{item.detail}</p>
                      )}
                    </div>
                    <ChevronRight size={15} className="text-muted-foreground/50 group-hover:text-primary shrink-0 transition-colors" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Setup / pulse */}
        <section className="lg:col-span-5 rounded-lg border border-border bg-card overflow-hidden shadow-surface flex flex-col">
          {showOnboarding ? (
            <>
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h2 className="section-title">Workspace setup</h2>
                  <span className="font-mono text-ui font-bold text-primary tabular-nums">{setupPct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-sunken overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-700"
                    style={{ width: `${setupPct}%` }}
                  />
                </div>
              </div>
              <div className="p-2 flex-1">
                {onboardingSteps.map((step) => (
                  <button
                    key={step.label}
                    type="button"
                    onClick={() => navigate(step.path)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-md hover:bg-sunken transition-colors text-left"
                  >
                    {step.done ? (
                      <CheckCircle2 size={16} className="text-ok shrink-0" />
                    ) : (
                      <Circle size={16} className="text-muted-foreground/50 shrink-0" />
                    )}
                    <span className={cn("text-ui font-medium", step.done ? "text-muted-foreground line-through" : "text-foreground")}>
                      {step.label}
                    </span>
                    {!step.done && <ChevronRight size={13} className="ml-auto text-muted-foreground/40" />}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h2 className="section-title">Shortcuts</h2>
              </div>
              <div className="p-3 grid grid-cols-2 gap-2 flex-1">
                {[
                  { label: "Enter data", desc: "ESG input", path: "/app/esg-input", icon: Plus },
                  { label: "Review", desc: "Approvals", path: "/app/review", icon: UserCheck },
                  { label: "Reports", desc: "Analytics", path: "/app/reports", icon: FileText },
                  { label: "Locations", desc: "Sites", path: "/app/locations", icon: MapPin },
                ].map((a) => {
                  const Icon = a.icon;
                  return (
                    <button
                      key={a.path}
                      type="button"
                      onClick={() => navigate(a.path)}
                      className="flex flex-col items-start gap-2 p-3 rounded-md border border-border hover:border-primary/30 hover:bg-accent/60 transition-all text-left group"
                    >
                      <span className="w-8 h-8 rounded-md bg-accent text-primary flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Icon size={15} />
                      </span>
                      <div>
                        <div className="text-ui font-bold text-foreground">{a.label}</div>
                        <div className="text-label text-muted-foreground">{a.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        <section className="lg:col-span-3 rounded-lg border border-border bg-card overflow-hidden shadow-surface">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="section-title">Data by module</h2>
              <p className="text-label text-muted-foreground mt-0.5">Record volume · {selectedFyLabel}</p>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-label" onClick={() => navigate("/app/reports")}>
              Open reports <ChevronRight size={12} />
            </Button>
          </div>
          <div className="p-2">
            {loading ? (
              <LoadingSkeleton rows={4} cols={1} />
            ) : modules.length === 0 ? (
              <p className="text-ui text-muted-foreground px-2 py-8 text-center">No modules configured</p>
            ) : (
              <ul>
                {modules.map((m, idx) => {
                  const Icon = getModuleIcon(m.icon_name);
                  const count = moduleCounts[m.module_id] ?? 0;
                  const max = Math.max(...modules.map((x) => moduleCounts[x.module_id] ?? 0), 1);
                  const pct = Math.round((count / max) * 100);
                  return (
                    <li
                      key={m.key}
                      className="flex items-center gap-3 px-2 py-2.5 rounded-md hover:bg-sunken/60 transition-colors"
                      style={{ animationDelay: `${idx * 40}ms` }}
                    >
                      <div
                        className="w-9 h-9 rounded-md flex items-center justify-center shrink-0 border border-border/60"
                        style={{ background: `${m.color}18` }}
                      >
                        <Icon size={16} style={{ color: m.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-ui font-semibold text-foreground truncate">{m.module_name}</span>
                          <span className="font-mono text-ui font-bold tabular-nums text-foreground">{count.toLocaleString()}</span>
                        </div>
                        <div className="h-1 rounded-full bg-sunken overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, background: m.color }}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="lg:col-span-2 rounded-lg border border-border bg-card overflow-hidden shadow-surface flex flex-col">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="section-title">Recent activity</h2>
            <Button variant="ghost" size="sm" className="h-7 text-label" onClick={() => navigate("/app/notifications")}>
              All <ChevronRight size={12} />
            </Button>
          </div>
          <div className="flex-1 min-h-0">
            {loading ? (
              <div className="p-3"><LoadingSkeleton rows={4} cols={1} /></div>
            ) : notifications.length === 0 ? (
              <p className="text-ui text-muted-foreground px-4 py-10 text-center">No recent activity</p>
            ) : (
              <ul className="divide-y divide-border">
                {notifications.slice(0, 6).map((n) => (
                  <li key={n.notification_id}>
                    <button
                      type="button"
                      className={cn(
                        "w-full text-left px-3.5 py-2.5 hover:bg-sunken/50 transition-colors",
                        !n.is_read && "bg-accent/40"
                      )}
                      onClick={() => {
                        if (n.type === "SUBMITTED" || n.type === "APPROVED" || n.type === "REJECTED") {
                          navigate("/app/review");
                        } else {
                          navigate("/app/esg-input");
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <span className="text-ui font-semibold text-foreground leading-snug line-clamp-2">{n.title}</span>
                        <Badge variant={notifBadgeVariant[n.type] || "secondary"}>{n.type}</Badge>
                      </div>
                      <div className="text-2xs text-muted-foreground">{formatDateTime(n.created_at)}</div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
