import { useEffect, useState, useCallback } from "react";
import { tenantApi } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { PageShell } from "@/components/shared/PageShell";
import { LoadingSkeleton, EmptyState } from "@/components/shared/PageComponents";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormDialog, type FormField } from "@/components/shared/FormDialog";
import { useIsSupportSession } from "@/components/shared/WriteOnly";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Calendar, Lock, Unlock, ChevronRight, LockKeyhole, UnlockKeyhole } from "lucide-react";
import type { ReportingYear, PeriodStatus, FinancialYear } from "@/types";
import { getApiError } from "@/lib/utils";

export default function ReportingPage() {
  const { user } = useAuthStore();
  const [reportingYears, setReportingYears] = useState<ReportingYear[]>([]);
  const [allFYs, setAllFYs] = useState<FinancialYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<ReportingYear | null>(null);
  const [periods, setPeriods] = useState<PeriodStatus[]>([]);
  const [periodsLoading, setPeriodsLoading] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [confirmLock, setConfirmLock] = useState<{ period: PeriodStatus; action: "lock" | "unlock" } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isSupport = useIsSupportSession();
  const isAdmin = user?.role === "COMPANY_ADMIN" && !isSupport;

  const fetchYears = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await tenantApi.listReportingYears();
      const items = Array.isArray(data) ? data : data?.items || [];
      setReportingYears(items);
      if (items.length > 0 && !selectedYear) {
        const last = items[items.length - 1];
        setSelectedYear(last);
        loadPeriods(last.year_id);
      }
    } catch { toast.error("Failed to load reporting years"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchYears(); }, [fetchYears]);

  useEffect(() => {
    tenantApi.listAvailableFYs().then(({ data }) => {
      setAllFYs(Array.isArray(data) ? data : data?.items || []);
    }).catch(() => {});
  }, []);

  const loadPeriods = async (yearId: number) => {
    setPeriodsLoading(true);
    try {
      const { data } = await tenantApi.getPeriods(yearId);
      setPeriods(Array.isArray(data) ? data : data?.items || []);
    } catch { toast.error("Failed to load periods"); }
    finally { setPeriodsLoading(false); }
  };

  const selectYear = (ry: ReportingYear) => {
    setSelectedYear(ry);
    loadPeriods(ry.year_id);
  };

  const handleAssign = async (formData: Record<string, any>) => {
    setActionLoading(true);
    try {
      await tenantApi.assignReportingYear({ year_id: Number(formData.year_id), fy_start_month: Number(formData.fy_start_month) || 4 });
      toast.success("Financial year assigned — 12 period records created");
      setAssignOpen(false);
      fetchYears();
    } catch (err: any) { toast.error(getApiError(err, "Failed to assign FY")); }
    finally { setActionLoading(false); }
  };

  const handleLockUnlock = async () => {
    if (!confirmLock || !selectedYear) return;
    setActionLoading(true);
    try {
      if (confirmLock.action === "lock") {
        await tenantApi.lockPeriod(selectedYear.year_id, confirmLock.period.month_id);
      } else {
        await tenantApi.unlockPeriod(selectedYear.year_id, confirmLock.period.month_id);
      }
      toast.success(`Period ${confirmLock.action}ed`);
      setConfirmLock(null);
      loadPeriods(selectedYear.year_id);
    } catch (err: any) { toast.error(getApiError(err, "Failed")); }
    finally { setActionLoading(false); }
  };

  const handleBulkLock = async () => {
    if (!selectedYear) return;
    const unlocked = periods.filter((p) => !p.is_locked);
    if (unlocked.length === 0) { toast.info("All periods already locked"); return; }
    setActionLoading(true);
    let ok = 0;
    for (const p of unlocked) {
      try { await tenantApi.lockPeriod(selectedYear.year_id, p.month_id); ok++; } catch {}
    }
    toast.success(`${ok} periods locked`);
    setActionLoading(false);
    loadPeriods(selectedYear.year_id);
  };

  const assignedYearIds = new Set(reportingYears.map((r) => r.year_id));
  const availableFYs = allFYs.filter((fy) => !assignedYearIds.has(fy.year_id));

  const assignFields: FormField[] = [
    { key: "year_id", label: "Financial Year", type: "select", required: true,
      options: availableFYs.map((fy) => ({ value: fy.year_id, label: fy.fy_label }))
    },
    { key: "fy_start_month", label: "FY Start Month", type: "select", required: true,
      defaultValue: 4,
      helpText: "Month from which the financial year begins (default: April)",
      options: [
        { value: 1, label: "January" }, { value: 2, label: "February" },
        { value: 3, label: "March" }, { value: 4, label: "April (default)" },
        { value: 5, label: "May" }, { value: 6, label: "June" },
        { value: 7, label: "July" }, { value: 8, label: "August" },
        { value: 9, label: "September" }, { value: 10, label: "October" },
        { value: 11, label: "November" }, { value: 12, label: "December" },
      ],
    },
  ];

  const lockedCount = periods.filter((p) => p.is_locked).length;
  const unlockedCount = periods.filter((p) => !p.is_locked).length;

  return (
    <PageShell
      title="Reporting Years"
      description="Assign financial years and manage monthly period locks"
      breadcrumb={[{ label: "Company Portal", href: "/app" }, { label: "Reporting Years" }]}
      actions={
        <div className="flex items-center gap-2">
          {!loading && reportingYears.length > 1 && selectedYear && (
            <div className="flex items-center gap-2">
              <span className="text-label font-semibold text-muted-foreground">Jump to FY</span>
              <Select
                value={String(selectedYear.year_id)}
                onValueChange={(v) => {
                  const ry = reportingYears.find((r) => r.year_id === Number(v));
                  if (ry) selectYear(ry);
                }}
              >
                <SelectTrigger className="h-8 w-[140px] text-ui">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reportingYears.map((r) => (
                    <SelectItem key={r.year_id} value={String(r.year_id)}>
                      {r.financial_year?.fy_label || `FY ${r.year_id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {isAdmin && (
            <button onClick={() => setAssignOpen(true)} className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-primary text-[12px] font-semibold text-white hover:bg-primaryDk transition-colors">
              <Plus size={14} /> Assign FY
            </button>
          )}
        </div>
      }
    >
      {loading ? <LoadingSkeleton rows={3} cols={3} /> : reportingYears.length === 0 ? (
        <div className="bg-card rounded-xl border border-border">
          <EmptyState icon={Calendar} title="No financial years assigned" description="Assign a financial year to start tracking ESG data by period.">
            {isAdmin && <button onClick={() => setAssignOpen(true)} className="mt-2 px-4 py-2 rounded-lg bg-primary text-white text-[13px] font-semibold"><Plus size={14} className="inline mr-1" /> Assign FY</button>}
          </EmptyState>
        </div>
      ) : (
        <>
          {/* FY Cards */}
          <div className="flex flex-wrap gap-3 mb-7">
            {reportingYears.map((ry) => (
              <button
                key={ry.id}
                onClick={() => selectYear(ry)}
                className={`px-5 py-3.5 rounded-xl border-2 text-left transition-all ${
                  selectedYear?.year_id === ry.year_id
                    ? "border-primary bg-info-tint/50 shadow-sm"
                    : "border-border bg-card hover:border-border"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Calendar size={16} className={selectedYear?.year_id === ry.year_id ? "text-primary" : "text-muted-foreground"} />
                  <span className="text-[15px] font-bold text-foreground">{ry.financial_year?.fy_label || `FY ${ry.year_id}`}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  Start month: {ry.financial_year?.start_month_name || `Month ${ry.fy_start_month || 4}`}
                </div>
              </button>
            ))}
          </div>

          {/* Period Status Grid */}
          {selectedYear && (
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-[16px] font-bold text-foreground">
                    {selectedYear.financial_year?.fy_label || "Selected FY"} — Period Status
                  </h3>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    {lockedCount} locked · {unlockedCount} open
                  </p>
                </div>
                {isAdmin && unlockedCount > 0 && (
                  <button onClick={handleBulkLock} disabled={actionLoading} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-[13px] font-semibold text-muted-foreground hover:bg-sunken disabled:opacity-60">
                    <LockKeyhole size={15} /> Lock All
                  </button>
                )}
              </div>

              {periodsLoading ? <LoadingSkeleton rows={3} cols={4} /> : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {periods.sort((a, b) => a.month_id - b.month_id).map((p) => {
                    const monthName = p.month?.month_name || `Month ${p.month_id}`;
                    return (
                      <div
                        key={p.id || p.month_id}
                        className={`rounded-xl border-2 p-4 text-center transition-all ${
                          p.is_locked
                            ? "border-border bg-sunken"
                            : "border-green-200 bg-green-50/50"
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center ${
                          p.is_locked ? "bg-border" : "bg-ok-tint"
                        }`}>
                          {p.is_locked ? <Lock size={18} className="text-muted-foreground" /> : <Unlock size={18} className="text-green-600" />}
                        </div>
                        <div className="text-[13px] font-bold text-foreground mb-0.5">{monthName}</div>
                        <div className={`text-[11px] font-semibold mb-3 ${p.is_locked ? "text-muted-foreground" : "text-green-600"}`}>
                          {p.is_locked ? "Locked" : "Open"}
                        </div>
                        {isAdmin && (
                          <button
                            onClick={() => setConfirmLock({ period: p, action: p.is_locked ? "unlock" : "lock" })}
                            className={`w-full py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                              p.is_locked
                                ? "border border-border text-muted-foreground hover:bg-card"
                                : "border border-warn/30 text-warn hover:bg-warn-tint"
                            }`}
                          >
                            {p.is_locked ? "Unlock" : "Lock Period"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Dialogs */}
      <FormDialog open={assignOpen} onClose={() => setAssignOpen(false)} onSubmit={handleAssign} title="Assign Financial Year" description="This will create 12 monthly period records" fields={assignFields} submitLabel="Assign" loading={actionLoading} />
      <ConfirmDialog
        open={!!confirmLock}
        onClose={() => setConfirmLock(null)}
        onConfirm={handleLockUnlock}
        title={confirmLock?.action === "lock" ? "Lock Period" : "Unlock Period"}
        message={confirmLock?.action === "lock"
          ? `Lock ${confirmLock?.period?.month?.month_name || "this month"}? This will prevent any data edits for this period.`
          : `Unlock ${confirmLock?.period?.month?.month_name || "this month"}? Data editing will be allowed again.`
        }
        confirmLabel={confirmLock?.action === "lock" ? "Lock Period" : "Unlock Period"}
        variant={confirmLock?.action === "lock" ? "default" : "default"}
        loading={actionLoading}
      />
    </PageShell>
  );
}
