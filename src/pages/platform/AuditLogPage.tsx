import { Fragment, useEffect, useState, useCallback } from "react";
import { platformApi } from "@/api/client";
import { PageShell } from "@/components/shared/PageShell";
import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { FileText, ChevronDown } from "lucide-react";
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

  return (
    <PageShell
      title="Audit Log"
      description={`${total} platform actions recorded`}
      breadcrumb={[{ label: "Platform Admin", href: "/platform" }, { label: "Audit Log" }]}
      actions={
        <Select value={actionFilter || "__all__"} onValueChange={(v) => { setActionFilter(v === "__all__" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Actions</SelectItem>
            {ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>{a.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <DataTable
        loading={loading}
        empty={entries.length === 0 ? {
          icon: FileText,
          title: "No audit entries",
          description: actionFilter ? "No entries match this filter" : "Platform actions will be logged here automatically",
        } : undefined}
        pagination={{ page, pageSize, total, onPageChange: setPage }}
        skeletonCols={6}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-ui">
            <thead>
              <tr className="border-b border-border bg-sunken">
                {["Action", "Target Company", "Target Admin", "Reason", "Date/Time", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-label font-semibold uppercase tracking-wider text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <Fragment key={e.id}>
                  <tr
                    className="border-b border-[hsl(var(--border-hairline))] hover:bg-sunken transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                  >
                    <td className="px-4 py-2">
                      <span className="text-2xs font-bold px-2.5 py-1 rounded-full bg-sunken text-muted-foreground whitespace-nowrap">
                        {e.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">
                      {e.target_company_id ? (companyMap[e.target_company_id] || e.target_company_id.slice(0, 8)) : "—"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">
                      {e.target_platform_user_id ? (adminMap[e.target_platform_user_id] || e.target_platform_user_id.slice(0, 8)) : "—"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs truncate max-w-[250px]">{e.reason || "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground text-xs whitespace-nowrap">{formatDateTime(e.actioned_at)}</td>
                    <td className="px-4 py-2">
                      {e.metadata && (
                        <ChevronDown size={14} className={`text-muted-foreground transition-transform ${expandedId === e.id ? "rotate-180" : ""}`} aria-hidden="true" />
                      )}
                    </td>
                  </tr>
                  {expandedId === e.id && e.metadata && (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 bg-sunken border-b border-[hsl(var(--border-hairline))]">
                        <div className="text-label font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Metadata</div>
                        <pre className="text-label text-muted-foreground bg-card p-3 rounded-sm border border-border overflow-x-auto font-mono">
                          {JSON.stringify(e.metadata, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </DataTable>
    </PageShell>
  );
}
