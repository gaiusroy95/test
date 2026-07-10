import { useEffect, useState, useCallback, Fragment } from "react";
import { useSearchParams } from "react-router-dom";
import { tenantApi } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { PageShell } from "@/components/shared/PageShell";
import { LoadingSkeleton } from "@/components/shared/PageComponents";
import { useIsSupportSession } from "@/components/shared/WriteOnly";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, ClipboardList, Settings2, ChevronLeft, ChevronRight, ShieldAlert, Palette } from "lucide-react";
import { getApiError, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SupportAccessInbox } from "@/components/tenant/SupportAccessInbox";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { CURRENT_POLICY_VERSION } from "@/components/shared/ConsentDialog";

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

/** Human-readable detail line for audit rows (consent, exports, etc.). */
function auditDetail(row: Record<string, any>): string {
  if (row.notes && String(row.notes).trim()) return String(row.notes).trim();
  if (row.reason && String(row.reason).trim()) return String(row.reason).trim();

  const meta = (row.metadata && typeof row.metadata === "object") ? row.metadata as Record<string, unknown> : {};
  const version =
    row.consent_version ??
    meta.consent_version ??
    meta.version ??
    meta.policy_version ??
    null;

  if (row.action === "CONSENT_RECORDED") {
    const v = version != null ? String(version) : CURRENT_POLICY_VERSION;
    return `Accepted Privacy & Data Usage policy v${v}`;
  }

  if (meta.notes && String(meta.notes).trim()) return String(meta.notes).trim();
  if (version != null) return `Policy version ${version}`;

  return "";
}

function consentVersion(row: Record<string, any>): string {
  const meta = (row.metadata && typeof row.metadata === "object") ? row.metadata as Record<string, unknown> : {};
  return String(
    row.consent_version ?? meta.consent_version ?? meta.version ?? meta.policy_version ?? CURRENT_POLICY_VERSION
  );
}

type Tab = "config" | "appearance" | "support" | "compliance";

export default function SettingsPage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const isSupport = useIsSupportSession();
  const isAdmin = user?.role === "COMPANY_ADMIN" && !isSupport;

  const initialTab = (searchParams.get("tab") as Tab | null);
  const [tab, setTab] = useState<Tab>(
    initialTab === "appearance" || initialTab === "support" || initialTab === "compliance" || initialTab === "config"
      ? initialTab
      : "config"
  );

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
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);
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
  const tabBar = (
    <div className="flex items-end border-b border-border -mb-px">
      {([
        { key: "config" as Tab,     label: "Company Config",   icon: Settings2 },
        { key: "appearance" as Tab, label: "Appearance",      icon: Palette },
        ...(isAdmin ? [{ key: "support" as Tab,    label: "Support Access",         icon: ShieldAlert }] : []),
        ...(isAdmin ? [{ key: "compliance" as Tab, label: "Compliance & Audit Log", icon: ClipboardList }] : []),
      ]).map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => setTab(key)}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${
            tab === key
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground/90 hover:border-border"
          }`}
        >
          <Icon size={14} /> {label}
        </button>
      ))}
    </div>
  );

  if (loading) {
    return (
      <PageShell
        title="Settings"
        description="Company configuration and compliance audit trail"
        breadcrumb={[{ label: "Company Portal", href: "/app" }, { label: "Settings" }]}
      >
        <LoadingSkeleton rows={6} cols={1} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Settings"
      description="Company configuration and compliance audit trail"
      breadcrumb={[{ label: "Company Portal", href: "/app" }, { label: "Settings" }]}
      toolbar={tabBar}
    >

      {/* ── Config tab ─────────────────────────────────────────────────────── */}
      {tab === "config" && (
        <div className="space-y-4 w-full">
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

          <div className="flex items-center gap-3">
            <Button size="sm" onClick={handleSave} disabled={!isDirty || saving}>
              <Save size={14} /> {saving ? "Saving…" : "Save Changes"}
            </Button>
            {isDirty && <span className="text-[12px] text-amber-500 font-medium">Unsaved changes</span>}
          </div>
        </div>
      )}

      {tab === "appearance" && <AppearanceSettings />}

      {/* ── Support Access tab ─────────────────────────────────────────────── */}
      {tab === "support" && isAdmin && <SupportAccessInbox />}

      {/* ── Compliance tab ─────────────────────────────────────────────────── */}
      {tab === "compliance" && isAdmin && (
        <div>
          <div className="mb-4">
            <p className="text-[12px] text-muted-foreground">
              Append-only record of all significant actions in your organisation.
              Required for GDPR / DPDP accountability obligations.
              {auditTotal > 0 && <span className="ml-2 font-semibold text-foreground">{auditTotal} entries</span>}
            </p>
          </div>

          <div className="surface-elevated overflow-hidden">
            {auditLoading ? (
              <div className="p-6"><LoadingSkeleton rows={8} cols={4} /></div>
            ) : auditLog.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
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
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLog.map((row) => {
                      const detail = auditDetail(row);
                      const isConsent = row.action === "CONSENT_RECORDED";
                      const expanded = expandedAuditId === row.id;
                      return (
                        <Fragment key={row.id}>
                          <TableRow
                            className={isConsent ? "cursor-pointer" : undefined}
                            onClick={isConsent ? () => setExpandedAuditId(expanded ? null : row.id) : undefined}
                          >
                            <TableCell className="text-[12px] text-muted-foreground whitespace-nowrap">
                              {row.actioned_at ? formatDateTime(row.actioned_at) : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={ACTION_VARIANT[row.action] ?? "secondary"} className="text-[10px] whitespace-nowrap">
                                {actionLabel(row.action)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-[12px] text-muted-foreground">
                              {row.actor_email ?? <span className="text-muted-foreground/40 italic">System</span>}
                            </TableCell>
                            <TableCell className="text-[12px] text-muted-foreground">
                              {row.target_type && (
                                <span className="capitalize">{row.target_type}</span>
                              )}
                              {row.target_id && (
                                <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                                  {row.target_id.length > 8 ? `${row.target_id.slice(0, 8)}…` : row.target_id}
                                </span>
                              )}
                              {!row.target_type && !row.target_id && "—"}
                            </TableCell>
                            <TableCell className="text-[12px] text-muted-foreground max-w-[420px]">
                              {detail ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <span className="whitespace-normal">{detail}</span>
                                  {isConsent && (
                                    <ChevronRight
                                      size={14}
                                      className={`text-muted-foreground shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
                                      aria-hidden="true"
                                    />
                                  )}
                                </span>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                          </TableRow>
                          {isConsent && expanded && (
                            <TableRow>
                              <TableCell colSpan={5} className="bg-sunken/50 px-5 py-4">
                                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                  Consent recorded · Policy v{consentVersion(row)}
                                </div>
                                <div className="space-y-2 text-[13px] text-muted-foreground leading-relaxed max-w-[720px]">
                                  <p>
                                    <strong className="text-foreground">What we collect:</strong> Name, email, role,
                                    and ESG data entered on behalf of the organisation.
                                  </p>
                                  <p>
                                    <strong className="text-foreground">How we use it:</strong> Solely to operate ESMOS
                                    for the company&apos;s ESG/BRSR reporting. Data is never sold or shared with third parties.
                                  </p>
                                  <p>
                                    <strong className="text-foreground">Rights:</strong> Request a copy of personal data
                                    or ask a Company Admin to erase the account.
                                  </p>
                                  <p className="text-[12px]">
                                    Actor <span className="font-medium text-foreground">{row.actor_email || "user"}</span>{" "}
                                    confirmed &ldquo;I understand and agree&rdquo; for policy version{" "}
                                    <span className="font-mono text-foreground">{consentVersion(row)}</span>.
                                  </p>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>

                {auditPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-[hsl(var(--border-hairline))]">
                    <span className="text-[12px] text-muted-foreground">
                      {(auditPage - 1) * auditPageSize + 1}–{Math.min(auditPage * auditPageSize, auditTotal)} of {auditTotal}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon-sm" disabled={auditPage <= 1}
                        onClick={() => setAuditPage(p => p - 1)}><ChevronLeft size={15} /></Button>
                      <span className="px-3 text-[12px] font-semibold text-foreground">{auditPage} / {auditPages}</span>
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
    </PageShell>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const inputCls =
  "w-full py-2.5 px-3 rounded-lg border border-border text-[13px] outline-none text-foreground " +
  "placeholder:text-muted-foreground focus:border-primary transition-colors bg-card";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="surface-elevated overflow-hidden">
      <div className="px-5 py-3 border-b border-[hsl(var(--border-hairline))] bg-sunken/60">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      </div>
      <div className="divide-y divide-border/60">{children}</div>
    </div>
  );
}

function Field({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-[minmax(200px,280px)_1fr] gap-3 sm:gap-8 items-start">
      <div>
        <div className="text-[13px] font-semibold text-foreground">{label}</div>
        <div className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{description}</div>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
