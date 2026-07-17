import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import {
  MessageSquare, AlertTriangle, AlertCircle, Info,
  CheckCircle2, Clock, MapPin, Calendar, ClipboardCheck,
  Maximize2, FileSpreadsheet, Filter,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  AuditorRemark, RemarkSeverity, RemarkStatus, Location, ReportingYear,
} from "@/types";
import type { LucideIcon } from "lucide-react";

export type WorkspaceTab = "detail" | "insights" | "responded" | "all";
export type InsightsView = "chart" | "table";

export const LEFT_PCT_MIN = 30;
export const LEFT_PCT_MAX = 50;

export const WORKSPACE_TABS: { key: WorkspaceTab; label: string }[] = [
  { key: "detail", label: "Detail" },
  { key: "insights", label: "Insights" },
  { key: "responded", label: "Responded" },
  { key: "all", label: "All Records" },
];

type SevCfg = {
  label: string; color: string; bg: string; border: string; rail: string; icon: LucideIcon;
};
type StatCfg = { label: string; color: string; bg: string; border: string; icon: LucideIcon };

export const SEVERITY_RAIL: Record<RemarkSeverity, SevCfg> = {
  OBSERVATION:     { label: "Observation",     color: "text-info",        bg: "bg-info-tint",        border: "border-info/30",        rail: "bg-info",        icon: Info },
  FINDING:         { label: "Finding",         color: "text-warn",        bg: "bg-warn-tint",        border: "border-warn/30",        rail: "bg-warn",        icon: AlertCircle },
  NON_CONFORMITY:  { label: "Non-Conformity",  color: "text-destructive", bg: "bg-destructive-tint", border: "border-destructive/30", rail: "bg-destructive", icon: AlertTriangle },
};

export const STATUS_META: Record<RemarkStatus, StatCfg> = {
  OPEN:       { label: "Open",       color: "text-warn", bg: "bg-warn-tint", border: "border-warn/30", icon: Clock },
  RESPONDED:  { label: "Responded",  color: "text-info", bg: "bg-info-tint", border: "border-info/30", icon: MessageSquare },
  CLOSED:     { label: "Closed",     color: "text-ok",   bg: "bg-ok-tint",   border: "border-ok/30",   icon: CheckCircle2 },
};

export type ChartRow = {
  month: string;
  Open: number;
  Findings: number;
  "Non-Conformities": number;
  Observations: number;
};

function ScopeSelect({
  label, value, onChange, options, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0">{label}</span>
      <Select value={value || "__all__"} onValueChange={(v) => onChange(v === "__all__" ? "" : v)}>
        <SelectTrigger className="h-7 text-[11px] w-[120px] max-w-[140px]">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">{placeholder}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function StatusDot({ status }: { status: RemarkStatus }) {
  const dot =
    status === "CLOSED" ? "bg-ok"
    : status === "RESPONDED" ? "bg-info"
    : status === "OPEN" ? "bg-warn"
    : "bg-muted-foreground/50";
  return <span className={cn("inline-block w-1.5 h-1.5 rounded-full shrink-0", dot)} aria-hidden />;
}

export function AuditEmptyState({
  selLocation, locations, onLocationChange, isAuditor, hasFilters,
}: {
  selLocation: string;
  locations: Location[];
  onLocationChange: (id: string) => void;
  isAuditor: boolean;
  hasFilters: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="w-14 h-14 rounded-full bg-ok-tint border border-ok/30 flex items-center justify-center mb-4">
        <ClipboardCheck size={28} className="text-ok" />
      </div>
      <p className="text-[14px] font-bold field-label">No Audits Logged for This Period</p>
      <p className="text-[12px] text-muted-foreground mt-1.5 max-w-[260px] leading-relaxed">
        {hasFilters
          ? "Try another location or clear filters to widen the audit queue."
          : isAuditor
            ? "Raise a remark when you find an observation, finding, or non-conformity."
            : "No auditor remarks have been raised for the selected scope."}
      </p>
      <div className="mt-5 flex items-center gap-2 rounded-md border border-border bg-sunken/50 px-3 py-2">
        <MapPin size={13} className="text-muted-foreground shrink-0" />
        <span className="text-[11px] font-semibold field-label">Location</span>
        <Select value={selLocation || "__all__"} onValueChange={(v) => onLocationChange(v === "__all__" ? "" : v)}>
          <SelectTrigger className="h-7 text-[12px] w-[160px] border-0 bg-card shadow-sm">
            <SelectValue placeholder="All Locations" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Locations</SelectItem>
            {locations.map((l) => (
              <SelectItem key={l.location_id} value={l.location_id}>{l.location_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function RemarksChart({ data }: { data: ChartRow[] }) {
  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[13px] text-muted-foreground">
        No chart data for the current filters
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="Open" fill="#f59e0b" radius={[3, 3, 0, 0]} />
        <Bar dataKey="Findings" fill="#eab308" radius={[3, 3, 0, 0]} />
        <Bar dataKey="Non-Conformities" fill="#ef4444" radius={[3, 3, 0, 0]} />
        <Bar dataKey="Observations" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function InsightsPanel({
  chartData, remarks, insightsView, onViewChange, onMaximize, onExport,
}: {
  chartData: ChartRow[];
  remarks: AuditorRemark[];
  insightsView: InsightsView;
  onViewChange: (v: InsightsView) => void;
  onMaximize: () => void;
  onExport: () => void;
}) {
  return (
    <div className="flex flex-col h-full min-h-[360px]">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[hsl(var(--border-hairline))] flex-shrink-0">
        <div className="inline-flex rounded-md border border-border p-0.5 bg-sunken/50">
          <button
            type="button"
            onClick={() => onViewChange("chart")}
            className={cn(
              "px-2.5 py-1 rounded text-[11px] font-semibold transition-colors",
              insightsView === "chart" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            Chart
          </button>
          <button
            type="button"
            onClick={() => onViewChange("table")}
            className={cn(
              "px-2.5 py-1 rounded text-[11px] font-semibold transition-colors",
              insightsView === "table" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
            )}
          >
            Data Table
          </button>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" title="Maximize chart" onClick={onMaximize} className="p-1.5 rounded-md text-muted-foreground hover:bg-sunken hover:text-foreground">
            <Maximize2 size={14} />
          </button>
          <button type="button" title="Export Excel" onClick={onExport} className="p-1.5 rounded-md text-ok hover:bg-ok-tint">
            <FileSpreadsheet size={14} />
          </button>
        </div>
      </div>

      {insightsView === "chart" ? (
        <div className="flex-1 p-4 min-h-[280px]">
          <RemarksChart data={chartData} />
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-3">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-2 py-2 font-semibold">Month</th>
                <th className="px-2 py-2 font-semibold text-right">Open</th>
                <th className="px-2 py-2 font-semibold text-right">Findings</th>
                <th className="px-2 py-2 font-semibold text-right">NCs</th>
                <th className="px-2 py-2 font-semibold text-right">Obs</th>
              </tr>
            </thead>
            <tbody>
              {chartData.length === 0 ? (
                <tr><td colSpan={5} className="px-2 py-8 text-center text-[12px] text-muted-foreground">No rows</td></tr>
              ) : chartData.map((row) => (
                <tr key={row.month} className="border-b border-[hsl(var(--border-hairline))]">
                  <td className="px-2 py-2 text-[12px] text-foreground">{row.month}</td>
                  <td className="px-2 py-2 text-[12px] text-right tabular-nums">{row.Open}</td>
                  <td className="px-2 py-2 text-[12px] text-right tabular-nums">{row.Findings}</td>
                  <td className="px-2 py-2 text-[12px] text-right tabular-nums">{row["Non-Conformities"]}</td>
                  <td className="px-2 py-2 text-[12px] text-right tabular-nums">{row.Observations}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-muted-foreground mt-3 px-2">{remarks.length} remark(s) in scope</p>
        </div>
      )}
    </div>
  );
}

export function RecordsTable({
  remarks, selectedId, onSelect, onExport,
}: {
  remarks: AuditorRemark[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onExport: () => void;
}) {
  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {remarks.length} record{remarks.length !== 1 ? "s" : ""}
        </span>
        <button type="button" onClick={onExport} className="p-1.5 rounded-md text-ok hover:bg-ok-tint" title="Export Excel">
          <FileSpreadsheet size={14} />
        </button>
      </div>
      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-sunken">
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 font-semibold">Severity</th>
              <th className="px-3 py-2 font-semibold">Status</th>
              <th className="px-3 py-2 font-semibold">Location</th>
              <th className="px-3 py-2 font-semibold">Period</th>
              <th className="px-3 py-2 font-semibold">Remark</th>
            </tr>
          </thead>
          <tbody>
            {remarks.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-10 text-center text-[12px] text-muted-foreground">No records</td></tr>
            ) : remarks.map((r) => (
              <tr
                key={r.remark_id}
                onClick={() => onSelect(r.remark_id)}
                className={cn(
                  "border-t border-[hsl(var(--border-hairline))] cursor-pointer hover:bg-sunken/50",
                  selectedId === r.remark_id && "bg-primary/[0.06]",
                )}
              >
                <td className="px-3 py-2 text-[12px]">{SEVERITY_RAIL[r.severity]?.label}</td>
                <td className="px-3 py-2 text-[12px]">{STATUS_META[r.status]?.label}</td>
                <td className="px-3 py-2 text-[12px]">{r.location_name || "—"}</td>
                <td className="px-3 py-2 text-[12px] whitespace-nowrap">{r.month_name} {r.fy_label}</td>
                <td className="px-3 py-2 text-[12px] text-muted-foreground max-w-[240px] truncate">{r.remark_text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AuditResizeHandle({
  leftPct, onResizeStart, onNudge,
}: {
  leftPct: number;
  onResizeStart: (e: ReactMouseEvent) => void;
  onNudge: (delta: number) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize audit panels"
      aria-valuenow={Math.round(leftPct)}
      aria-valuemin={LEFT_PCT_MIN}
      aria-valuemax={LEFT_PCT_MAX}
      tabIndex={0}
      onMouseDown={onResizeStart}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") onNudge(-2);
        if (e.key === "ArrowRight") onNudge(2);
      }}
      className="group relative w-2.5 flex-shrink-0 cursor-col-resize flex items-stretch justify-center bg-[repeating-linear-gradient(180deg,hsl(var(--border))_0_2px,transparent_2px_5px)] hover:bg-primary/20 active:bg-primary/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <span className="pointer-events-none absolute inset-y-0 -left-1 -right-1" />
      <span className="my-auto h-10 w-1 rounded-sm bg-muted-foreground/35 group-hover:bg-primary shadow-sm" />
    </div>
  );
}

export function AuditQueuePanel({
  filteredRemarks,
  loading,
  selectedId,
  severityFilter,
  onSeverityChange,
  selLocation,
  selYear,
  selModule,
  locations,
  reportingYears,
  modules,
  onLocation,
  onYear,
  onModule,
  onClearFilters,
  hasScopeFilters,
  isAuditor,
  hasAnyFilters,
  onSelectRemark,
}: {
  filteredRemarks: AuditorRemark[];
  loading: boolean;
  selectedId: string | null;
  severityFilter: string;
  onSeverityChange: (v: string) => void;
  selLocation: string;
  selYear: string;
  selModule: string;
  locations: Location[];
  reportingYears: ReportingYear[];
  modules: { module_id: number; module_name: string }[];
  onLocation: (v: string) => void;
  onYear: (v: string) => void;
  onModule: (v: string) => void;
  onClearFilters: () => void;
  hasScopeFilters: boolean;
  isAuditor: boolean;
  hasAnyFilters: boolean;
  onSelectRemark: (id: string) => void;
}) {
  return (
    <>
      <div className="flex-shrink-0 border-b border-border bg-card">
        <div className="px-3 py-2 flex items-center gap-2 flex-wrap border-b border-[hsl(var(--border-hairline))]">
          <span className="text-[11px] uppercase tracking-wider font-bold field-label shrink-0">Audit Queue</span>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {filteredRemarks.length} remark{filteredRemarks.length !== 1 ? "s" : ""}
          </span>
          <div className="ml-auto">
            <Select value={severityFilter || "all"} onValueChange={onSeverityChange}>
              <SelectTrigger className="w-[140px] h-7 text-[11px]">
                <Filter size={12} className="mr-1 text-muted-foreground" />
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="OBSERVATION">Observations</SelectItem>
                <SelectItem value="FINDING">Findings</SelectItem>
                <SelectItem value="NON_CONFORMITY">Non-Conformities</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="px-3 py-2 flex items-center gap-2 flex-wrap bg-sunken/40">
          <ScopeSelect
            label="Location"
            value={selLocation}
            onChange={onLocation}
            placeholder="All"
            options={locations.map((l) => ({ value: l.location_id, label: l.location_name }))}
          />
          <ScopeSelect
            label="Financial Year"
            value={selYear}
            onChange={onYear}
            placeholder="All FY"
            options={reportingYears.map((ry) => ({
              value: String(ry.year_id),
              label: `FY ${ry.financial_year?.fy_label || ry.year_id}`,
            }))}
          />
          <ScopeSelect
            label="Module"
            value={selModule}
            onChange={onModule}
            placeholder="All"
            options={modules.map((m) => ({ value: String(m.module_id), label: m.module_name }))}
          />
          {hasScopeFilters && (
            <button type="button" onClick={onClearFilters} className="text-[11px] font-semibold text-primary hover:underline ml-auto">
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="text-center py-12 text-[13px] text-muted-foreground animate-pulse">Loading…</div>
        ) : filteredRemarks.length === 0 ? (
          <AuditEmptyState
            selLocation={selLocation}
            locations={locations}
            onLocationChange={onLocation}
            isAuditor={isAuditor}
            hasFilters={hasAnyFilters}
          />
        ) : (
          filteredRemarks.map((r) => {
            const sev = SEVERITY_RAIL[r.severity];
            const isSelected = selectedId === r.remark_id;
            return (
              <button
                key={r.remark_id}
                type="button"
                onClick={() => onSelectRemark(r.remark_id)}
                className={cn(
                  "relative w-full text-left pl-4 pr-3 py-3 border-b border-[hsl(var(--border-hairline))] transition-colors",
                  isSelected ? "bg-primary/[0.07]" : "hover:bg-sunken/60",
                )}
              >
                <span className={cn("absolute left-0 top-0 bottom-0 w-[3px]", sev.rail)} aria-hidden />
                <div className="flex items-center gap-2 mb-1 min-w-0">
                  <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold", sev.color, sev.bg)}>
                    <sev.icon size={10} /> {sev.label}
                  </span>
                  <StatusDot status={r.status} />
                  <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                    {STATUS_META[r.status]?.label}
                  </span>
                </div>
                <p className="text-[12px] text-foreground line-clamp-2 mb-1.5 leading-snug">{r.remark_text}</p>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><MapPin size={10} /> {r.location_name || "—"}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="flex items-center gap-1"><Calendar size={10} /> {r.month_name} {r.fy_label}</span>
                  {r.response_count > 0 && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="flex items-center gap-1 text-primary font-semibold">
                        <MessageSquare size={10} /> {r.response_count}
                      </span>
                    </>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}

export function StickyWorkspaceTabs({
  workspaceTab, onTabChange, canCreate, onAction, children,
}: {
  workspaceTab: WorkspaceTab;
  onTabChange: (t: WorkspaceTab) => void;
  canCreate: boolean;
  onAction: () => void;
  children: ReactNode;
}) {
  return (
    <section className="flex-1 flex flex-col min-w-0 min-h-0 bg-card overflow-hidden">
      <div className="sticky top-0 z-20 flex-shrink-0 flex items-center gap-1 px-3 py-2 border-b border-border bg-card/95 backdrop-blur-sm">
        <div role="tablist" className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto">
          {WORKSPACE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={workspaceTab === tab.key}
              onClick={() => onTabChange(tab.key)}
              className={cn(
                "px-3 py-1.5 rounded-md text-[12px] font-semibold whitespace-nowrap transition-colors",
                workspaceTab === tab.key
                  ? "bg-primary/10 text-primary ring-1 ring-primary/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-sunken",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {canCreate && (
          <Button size="sm" className="h-7 shrink-0" onClick={onAction}>
            + Action
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
    </section>
  );
}

export function ChartMaximizeDialog({
  open, onOpenChange, chartData, onExport,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  chartData: ChartRow[];
  onExport: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[960px]">
        <DialogHeader>
          <DialogTitle>Audit insights — remarks by period</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="h-[420px]">
            <RemarksChart data={chartData} />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button variant="outline" onClick={onExport}>
            <FileSpreadsheet size={14} /> Export Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
