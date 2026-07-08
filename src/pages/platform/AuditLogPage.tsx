import { useEffect, useState, useCallback } from "react";
import { platformApi } from "@/api/client";
import { Breadcrumb, LoadingSkeleton, EmptyState } from "@/components/shared/PageComponents";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { toast } from "sonner";
import { FileText, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { AuditLogEntry } from "@/types";
import { formatDateTime } from "@/lib/utils";

type NameMap = Record<string, string>;

const ACTIONS = [
  "COMPANY_CREATED", "COMPANY_SUSPENDED", "COMPANY_BLOCKED",
  "COMPANY_UNBLOCKED", "PLAN_CHANGED", "ADMIN_BLOCKED",
  "ADMIN_UNBLOCKED", "COMPANY_DELETED",
];

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [companyMap, setCompanyMap] = useState<NameMap>({});
  const [adminMap, setAdminMap] = useState<NameMap>({});
  const pageSize = 20;

  useEffect(() => {
    platformApi.listCompanies({ size: 200 }).then(({ data }) => {
      const items = data?.items || data || [];
      const map: NameMap = {};
      items.forEach((c: any) => { map[c.company_id] = c.company_name; });
      setCompanyMap(map);
    }).catch(() => {});
    platformApi.listAdmins().then(({ data }) => {
      const items = Array.isArray(data) ? data : data?.items || [];
      const map: NameMap = {};
      items.forEach((a: any) => { map[a.id] = `${a.first_name} ${a.last_name}`; });
      setAdminMap(map);
    }).catch(() => {});
  }, []);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, size: pageSize };
      if (actionFilter) params.action = actionFilter;
      const { data } = await platformApi.listAuditLog(params);
      setEntries(data.items || data || []);
      setTotal(data.total ?? 0);
    } catch { toast.error("Failed to load audit log"); }
    finally { setLoading(false); }
  }, [page, actionFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-6 max-w-[1400px]">
      {/* Compact toolbar: title + filter in one row */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <Breadcrumb items={[{ label: "Platform Admin", href: "/platform" }, { label: "Audit Log" }]} />
          <h1 className="text-[18px] font-bold text-brand-navy tracking-tight">Audit Log</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">{total} platform actions recorded</p>
        </div>
        <select value={actionFilter} onChange={(e) => { setActionFilter(e.target.value); setPage(1); }} className="py-1.5 px-3 rounded-lg border border-slate-200 text-[12px] bg-white outline-none text-brand-navy">
          <option value="">All Actions</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{a.replace(/_/g, " ")}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-6"><LoadingSkeleton rows={10} cols={5} /></div> : entries.length === 0 ? (
          <EmptyState icon={FileText} title="No audit entries" description={actionFilter ? "No entries match this filter" : "Platform actions will be logged here automatically"} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead><tr className="border-b-2 border-slate-100 bg-slate-50/60">
                  {["Action", "Target Company", "Target Admin", "Reason", "Date/Time", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {entries.map((e) => (
                    <>
                      <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors cursor-pointer" onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}>
                        <td className="px-4 py-2">
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
                            {e.action.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-slate-600 text-[12px]">{e.target_company_id ? (companyMap[e.target_company_id] || e.target_company_id.slice(0, 8)) : "—"}</td>
                        <td className="px-4 py-2 text-slate-600 text-[12px]">{e.target_platform_user_id ? (adminMap[e.target_platform_user_id] || e.target_platform_user_id.slice(0, 8)) : "—"}</td>
                        <td className="px-4 py-2 text-slate-500 text-[12px] truncate max-w-[250px]">{e.reason || "—"}</td>
                        <td className="px-4 py-2 text-slate-400 text-[12px] whitespace-nowrap">{formatDateTime(e.actioned_at)}</td>
                        <td className="px-4 py-2">
                          {e.metadata && (
                            <ChevronDown size={14} className={`text-slate-400 transition-transform ${expandedId === e.id ? "rotate-180" : ""}`} />
                          )}
                        </td>
                      </tr>
                      {expandedId === e.id && e.metadata && (
                        <tr key={`${e.id}-detail`}>
                          <td colSpan={6} className="px-6 py-4 bg-slate-50/80 border-b border-slate-100">
                            <div className="text-[11px] font-semibold text-slate-500 mb-2 uppercase tracking-wider">Metadata</div>
                            <pre className="text-[11px] text-slate-600 bg-white p-3 rounded-lg border border-slate-100 overflow-x-auto font-mono">
                              {JSON.stringify(e.metadata, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <span className="text-[12px] text-slate-500">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
                <div className="flex items-center gap-1">
                  <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"><ChevronLeft size={16} className="text-slate-500" /></button>
                  <span className="px-3 text-[12px] font-semibold text-brand-navy">{page} / {totalPages}</span>
                  <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"><ChevronRight size={16} className="text-slate-500" /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
