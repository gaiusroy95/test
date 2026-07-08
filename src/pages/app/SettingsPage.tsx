import { useEffect, useState, useCallback } from "react";
import { tenantApi } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { PageHeader, LoadingSkeleton } from "@/components/shared/PageComponents";
import { useIsSupportSession } from "@/components/shared/WriteOnly";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, ClipboardList, Settings2, ChevronLeft, ChevronRight, ShieldAlert } from "lucide-react";
import { getApiError, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SupportAccessInbox } from "@/components/tenant/SupportAccessInbox";

const MONTH_OPTIONS = [
  { value: "1", label: "January" }, { value: "2", label: "February" },
  { value: "3", label: "March" },   { value: "4", label: "April" },
  { value: "5", label: "May" },     { value: "6", label: "June" },
  { value: "7", label: "July" },    { value: "8", label: "August" },
  { value: "9", label: "September" },{ value: "10", label: "October" },
  { value: "11", label: "November" },{ value: "12", label: "December" },
];

const TIMEZONE_OPTIONS = [
  { value: "Asia/Kolkata",    label: "India Standard Time (IST, UTC+5:30)" },
  { value: "UTC",             label: "UTC" },
  { value: "Asia/Dubai",      label: "Gulf Standard Time (GST, UTC+4)" },
  { value: "Asia/Singapore",  label: "Singapore Time (SGT, UTC+8)" },
  { value: "Europe/London",   label: "Greenwich Mean Time (GMT)" },
  { value: "Europe/Paris",    label: "Central European Time (CET, UTC+1)" },
  { value: "US/Eastern",      label: "Eastern Time (ET, UTC−5)" },
  { value: "US/Pacific",      label: "Pacific Time (PT, UTC−8)" },
];

interface SettingValues {
  company_display_name: string;
  default_timezone: string;
  fy_start_month: string;
  report_footer_text: string;
  data_entry_reminder_day: string;
}

const DEFAULTS: SettingValues = {
  company_display_name: "",
  default_timezone: "Asia/Kolkata",
  fy_start_month: "4",
  report_footer_text: "",
  data_entry_reminder_day: "",
};

// ── Action badge colours ──────────────────────────────────────────────────────
const ACTION_VARIANT: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  SUBMISSION_APPROVED:  "success",
  SUBMISSION_REJECTED:  "destructive",
  SUBMISSION_SUBMITTED: "secondary",
  USER_CREATED:         "secondary",
  USER_DEACTIVATED:     "warning",
  USER_ERASED:          "destructive",
  PASSWORD_CHANGED:     "secondary",
  DATA_EXPORTED:        "secondary",
  CONSENT_RECORDED:     "success",
  PERIOD_LOCKED:        "warning",
};

function actionLabel(action: string) {
  return action.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

type Tab = "config" | "support" | "compliance";

export default function SettingsPage() {
  const { user } = useAuthStore();
  const isSupport = useIsSupportSession();
  const isAdmin = user?.role === "COMPANY_ADMIN" && !isSupport;

  const [tab, setTab] = useState<Tab>("config");

  // ── Config tab ─────────────────────────────────────────────────────────────
  const [values, setValues]   = useState<SettingValues>(DEFAULTS);
  const [saved, setSaved]     = useState<SettingValues>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await tenantApi.listSettings();
      const items: any[] = Array.isArray(data) ? data : data?.items ?? [];
      const map: Record<string, string> = {};
      items.forEach((s) => { map[s.setting_key] = s.setting_value; });
      const v: SettingValues = {
        company_display_name:    map.company_display_name    ?? "",
        default_timezone:        map.default_timezone        ?? "Asia/Kolkata",
        fy_start_month:          map.fy_start_month          ?? "4",
        report_footer_text:      map.report_footer_text      ?? "",
        data_entry_reminder_day: map.data_entry_reminder_day ?? "",
      };
      setValues(v);
      setSaved(v);
    } catch { toast.error("Failed to load settings"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  const isDirty = JSON.stringify(values) !== JSON.stringify(saved);

  const handleSave = async () => {
    setSaving(true);
    try {
      const changed = (Object.keys(values) as (keyof SettingValues)[]).filter((k) => values[k] !== saved[k]);
      await Promise.all(changed.map((k) => tenantApi.upsertSetting(k, values[k])));
      toast.success("Settings saved");
      setSaved({ ...values });
    } catch (err: any) { toast.error(getApiError(err, "Failed to save settings")); }
    finally { setSaving(false); }
  };

  const set = (key: keyof SettingValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value }));

  // ── Compliance tab ──────────────────────────────────────────────────────────
  const [auditLog, setAuditLog]     = useState<any[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage]   = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);
  const auditPageSize = 50;

  const loadAuditLog = useCallback(async (p: number) => {
    setAuditLoading(true);
    try {
      const { data } = await tenantApi.listTenantAuditLog({ page: p, size: auditPageSize });
      setAuditLog(data.items ?? []);
      setAuditTotal(data.total ?? 0);
    } catch { toast.error("Failed to load audit log"); }
    finally { setAuditLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === "compliance" && isAdmin) loadAuditLog(auditPage);
  }, [tab, auditPage, loadAuditLog, isAdmin]);

  const auditPages = Math.ceil(auditTotal / auditPageSize);

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) return <div className="p-6"><LoadingSkeleton rows={6} cols={1} /></div>;

  return (
    <div className="p-6 max-w-[1000px]">
      <PageHeader
        title="Settings"
        description="Company configuration and compliance audit trail"
        breadcrumb={[{ label: "Company Portal", href: "/app" }, { label: "Settings" }]}
      />

      {/* Tab bar */}
      <div className="flex items-end border-b border-slate-200 mb-6">
        {([
          { key: "config",     label: "Company Config",   icon: Settings2 },
          ...(isAdmin ? [{ key: "support",    label: "Support Access",         icon: ShieldAlert }] : []),
          ...(isAdmin ? [{ key: "compliance", label: "Compliance & Audit Log", icon: ClipboardList }] : []),
        ] as { key: Tab; label: string; icon: any }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${
              tab === key
                ? "border-brand-accent text-brand-accent"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── Config tab ─────────────────────────────────────────────────────── */}
      {tab === "config" && (
        <div className="max-w-[720px] space-y-5">
          <Section title="Company Identity">
            <Field label="Display Name" description="Name shown in reports and exports">
              <input value={values.company_display_name} onChange={set("company_display_name")}
                placeholder="e.g. Acme Corporation" className={inputCls} />
            </Field>
            <Field label="Default Timezone" description="Timezone used for scheduled reminders and audit timestamps">
              <select value={values.default_timezone} onChange={set("default_timezone")} className={inputCls}>
                {TIMEZONE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </Section>

          <Section title="Reporting">
            <Field label="Financial Year Start Month" description="First month of your company's financial year">
              <select value={values.fy_start_month} onChange={set("fy_start_month")} className={inputCls}>
                {MONTH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Report Footer Text" description="Text printed at the bottom of generated reports (optional)">
              <textarea value={values.report_footer_text} onChange={set("report_footer_text")}
                rows={3} placeholder="e.g. Confidential — prepared by the ESG team"
                className={`${inputCls} resize-none`} />
            </Field>
          </Section>

          <Section title="Notifications">
            <Field label="Data Entry Reminder Day" description="Day of the month (1–28) to send reminders to data entry users. Leave blank to disable.">
              <input type="number" min={1} max={28} value={values.data_entry_reminder_day}
                onChange={set("data_entry_reminder_day")} placeholder="e.g. 5" className={inputCls} />
            </Field>
          </Section>

          <div className="mt-7 flex items-center gap-3">
            <button onClick={handleSave} disabled={!isDirty || saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-accent text-white text-[13px] font-semibold hover:bg-brand-accentDk disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <Save size={15} /> {saving ? "Saving…" : "Save Changes"}
            </button>
            {isDirty && <span className="text-[12px] text-amber-500 font-medium">Unsaved changes</span>}
          </div>
        </div>
      )}

      {/* ── Support Access tab ─────────────────────────────────────────────── */}
      {tab === "support" && isAdmin && <SupportAccessInbox />}

      {/* ── Compliance tab ─────────────────────────────────────────────────── */}
      {tab === "compliance" && isAdmin && (
        <div>
          <div className="mb-4">
            <p className="text-[12px] text-slate-500">
              Append-only record of all significant actions in your organisation.
              Required for GDPR / DPDP accountability obligations.
              {auditTotal > 0 && <span className="ml-2 font-semibold text-brand-navy">{auditTotal} entries</span>}
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {auditLoading ? (
              <div className="p-6"><LoadingSkeleton rows={8} cols={4} /></div>
            ) : auditLog.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <ClipboardList size={32} className="mb-2 opacity-40" />
                <p className="text-[13px]">No audit events recorded yet</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>When</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLog.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-[12px] text-slate-500 whitespace-nowrap">
                          {row.actioned_at ? formatDateTime(row.actioned_at) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={ACTION_VARIANT[row.action] ?? "secondary"} className="text-[10px] whitespace-nowrap">
                            {actionLabel(row.action)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[12px] text-slate-600">
                          {row.actor_email ?? <span className="text-slate-300 italic">System</span>}
                        </TableCell>
                        <TableCell className="text-[12px] text-slate-500">
                          {row.target_type && (
                            <span className="capitalize">{row.target_type}</span>
                          )}
                          {row.target_id && (
                            <span className="ml-1 font-mono text-[10px] text-slate-400">
                              {row.target_id.length > 8 ? `${row.target_id.slice(0, 8)}…` : row.target_id}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-[12px] text-slate-500 max-w-[240px] truncate">
                          {row.notes ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {auditPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                    <span className="text-[12px] text-slate-500">
                      {(auditPage - 1) * auditPageSize + 1}–{Math.min(auditPage * auditPageSize, auditTotal)} of {auditTotal}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon-sm" disabled={auditPage <= 1}
                        onClick={() => setAuditPage(p => p - 1)}><ChevronLeft size={15} /></Button>
                      <span className="px-3 text-[12px] font-semibold text-brand-navy">{auditPage} / {auditPages}</span>
                      <Button variant="outline" size="icon-sm" disabled={auditPage >= auditPages}
                        onClick={() => setAuditPage(p => p + 1)}><ChevronRight size={15} /></Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const inputCls =
  "w-full py-2.5 px-3 rounded-lg border border-slate-200 text-[13px] outline-none text-brand-navy " +
  "placeholder:text-slate-400 focus:border-brand-accent transition-colors bg-white";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</h3>
      </div>
      <div className="divide-y divide-slate-100">{children}</div>
    </div>
  );
}

function Field({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 grid grid-cols-[1fr_1.4fr] gap-8 items-start">
      <div>
        <div className="text-[13px] font-semibold text-brand-navy">{label}</div>
        <div className="text-[12px] text-slate-400 mt-0.5 leading-relaxed">{description}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}
