import { useEffect, useState } from "react";
import { platformApi } from "@/api/client";
import { PageHeader, StatCard, LoadingSkeleton } from "@/components/shared/PageComponents";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Building2, Users, AlertTriangle, FileText, TrendingUp } from "lucide-react";
import type { Company, AuditLogEntry, SubscriptionPlan } from "@/types";
import { formatDate, formatDateTime } from "@/lib/utils";

export default function PlatformDashboard() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [suspendedCount, setSuspendedCount] = useState(0);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const safe = async (fn: () => Promise<any>, fallback: any): Promise<any> => {
          try { return await fn(); } catch { return fallback; }
        };

        const [compRes, activeRes, suspRes, auditRes, planRes] = await Promise.all([
          safe(() => platformApi.listCompanies({ size: 5 }), { data: { items: [], total: 0 } }),
          safe(() => platformApi.listCompanies({ status: "ACTIVE", size: 1 }), { data: { total: 0 } }),
          safe(() => platformApi.listCompanies({ status: "SUSPENDED", size: 1 }), { data: { total: 0 } }),
          safe(() => platformApi.listAuditLog({ size: 5 }), { data: { items: [], total: 0 } }),
          safe(() => platformApi.listPlans(), { data: [] }),
        ]);
        setCompanies((compRes as any).data?.items || []);
        setTotalCompanies((compRes as any).data?.total ?? 0);
        setActiveCount((activeRes as any).data?.total ?? 0);
        setSuspendedCount((suspRes as any).data?.total ?? 0);
        setAuditLog((auditRes as any).data?.items || []);
        setAuditTotal((auditRes as any).data?.total ?? 0);
        const planData = (planRes as any).data;
        setPlans(Array.isArray(planData) ? planData : planData?.items || []);
      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="page-root">
      <PageHeader title="Platform Dashboard" description="Overview of all companies and platform activity" />

      {/* Stat tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <StatCard icon={Building2}    label="Total Companies"      value={totalCompanies}  subtitle="Manage companies →"    accent="#0ea5e9" to="/platform/companies" />
        <StatCard icon={Users}        label="Active Companies"     value={activeCount}     subtitle="Currently operational" accent="#14b8a6" to="/platform/companies?status=ACTIVE" />
        <StatCard icon={AlertTriangle} label="Suspended / Blocked" value={suspendedCount}  subtitle="Needs attention"       accent="#f59e0b" to="/platform/companies?status=SUSPENDED" />
        <StatCard icon={FileText}     label="Audit Actions"        value={auditTotal}      subtitle="All time"              accent="#64748b" to="/platform/audit-log" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Recent Companies */}
        <div className="lg:col-span-2 surface">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-[15px] font-bold text-brand-navy">Recent Companies</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Latest onboarded companies</p>
          </div>
          {loading ? (
            <div className="p-6"><LoadingSkeleton rows={5} cols={5} /></div>
          ) : companies.length === 0 ? (
            <p className="text-[13px] text-slate-400 py-12 text-center">No companies onboarded yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {["Company", "Code", "Plan", "Status", "Created"].map((h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((c) => (
                  <TableRow key={c.company_id}>
                    <TableCell className="font-semibold text-brand-navy">{c.company_name}</TableCell>
                    <TableCell className="font-mono text-[12px] text-slate-500">{c.company_code}</TableCell>
                    <TableCell>
                      {c.plan?.plan_name ? (
                        <Badge variant="info" className="text-[10px]">{c.plan.plan_name}</Badge>
                      ) : <span className="text-slate-300">—</span>}
                    </TableCell>
                    <TableCell><StatusBadge status={c.access_status} /></TableCell>
                    <TableCell className="text-[12px] text-slate-400">{formatDate(c.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Subscription Plans */}
        <div className="surface">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-[15px] font-bold text-brand-navy">Subscription Plans</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{plans.length} plan{plans.length !== 1 ? "s" : ""} configured</p>
          </div>
          <div className="p-4 flex flex-col gap-3">
            {plans.map((p) => (
              <div key={p.plan_id} className="p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all duration-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[14px] font-bold text-brand-navy">{p.plan_name}</div>
                  <TrendingUp size={14} className="text-slate-300" />
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { label: "Users", value: p.max_users === -1 ? "∞" : p.max_users },
                    { label: "Sites", value: p.max_locations === -1 ? "∞" : p.max_locations },
                    { label: "KPIs",  value: p.max_kpis === -1 ? "∞" : p.max_kpis },
                  ].map((item) => (
                    <div key={item.label} className="text-center p-2 rounded-lg bg-slate-50">
                      <div className="text-[14px] font-bold text-brand-navy leading-tight">{item.value}</div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-wide">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {plans.length === 0 && (
              <p className="text-[13px] text-slate-400 py-8 text-center">No plans configured</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Audit Log */}
      <div className="surface">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-[15px] font-bold text-brand-navy">Recent Audit Log</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Latest platform actions</p>
        </div>
        {loading ? (
          <div className="p-6"><LoadingSkeleton rows={5} cols={4} /></div>
        ) : auditLog.length === 0 ? (
          <p className="text-[13px] text-slate-400 py-12 text-center">No audit entries yet</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {["Action", "Target", "Reason", "Date"].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLog.map((a) => (
                <TableRow key={a.id}>
                  <TableCell><StatusBadge status={a.action} /></TableCell>
                  <TableCell className="text-[12px] text-slate-600">
                    {a.target_company_id
                      ? (companies.find((c) => c.company_id === a.target_company_id)?.company_name || a.target_company_id.slice(0, 8))
                      : "—"}
                  </TableCell>
                  <TableCell className="text-[12px] text-slate-500 max-w-[200px] truncate">{a.reason || "—"}</TableCell>
                  <TableCell className="text-[12px] text-slate-400">{formatDateTime(a.actioned_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
