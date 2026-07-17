import { useEffect, useState, useCallback } from "react";
import { tenantApi } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { PageShell } from "@/components/shared/PageShell";
import { LoadingSkeleton, EmptyState } from "@/components/shared/PageComponents";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormDialog, type FormField } from "@/components/shared/FormDialog";
import { useIsSupportSession } from "@/components/shared/WriteOnly";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Plus, Calendar, Lock, Unlock, LockKeyhole } from "lucide-react";
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

  const fyToolbar = !loading && reportingYears.length > 0 ? (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex gap-1 bg-sunken rounded-lg p-1 w-fit flex-wrap">
        {reportingYears.map((ry) => {
          const active = selectedYear?.year_id === ry.year_id;
          const label = ry.financial_year?.fy_label || `FY ${ry.year_id}`;
          return (
            <button
              key={ry.id}
              type="button"
              onClick={() => selectYear(ry)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                active ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground/90"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {isAdmin && (
        <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)} className="h-7 shrink-0">
          <Plus size={14} /> Assign FY
        </Button>
      )}
      {selectedYear && (
        <span className="text-label text-muted-foreground">
          Starts {selectedYear.financial_year?.start_month_name || `month ${selectedYear.fy_start_month || 4}`}
        </span>
      )}
    </div>
  ) : undefined;

  return (
    <PageShell
      title="Reporting Years"
      description="Assign financial years and manage monthly period locks"
      breadcrumb={[{ label: "Company Portal", href: "/app" }, { label: "Reporting Years" }]}
      toolbar={fyToolbar}
    >
      {loading ? <LoadingSkeleton rows={3} cols={3} /> : reportingYears.length === 0 ? (
        <div className="bg-card rounded-xl border border-border">
          <EmptyState icon={Calendar} title="No financial years assigned" description="Assign a financial year to start tracking ESG data by period.">
            {isAdmin && (
              <Button size="sm" onClick={() => setAssignOpen(true)} className="mt-2">
                <Plus size={14} /> Assign FY
              </Button>
            )}
          </EmptyState>
        </div>
      ) : selectedYear && (
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <div className="flex items-center gap-x-2 gap-y-0.5 flex-wrap min-w-0">
              <h3 className="text-sm font-bold text-foreground">
                {selectedYear.financial_year?.fy_label || "Selected FY"}
              </h3>
              <span className="text-muted-foreground/40 text-label" aria-hidden="true">·</span>
              <p className="text-label text-muted-foreground">
                {lockedCount} locked · {unlockedCount} open
              </p>
            </div>
            {isAdmin && unlockedCount > 0 && (
              <Button size="sm" variant="outline" onClick={handleBulkLock} disabled={actionLoading} className="ml-auto shrink-0">
                <LockKeyhole size={14} /> Lock All
              </Button>
            )}
          </div>

          {periodsLoading ? <LoadingSkeleton rows={3} cols={4} /> : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {periods.sort((a, b) => a.month_id - b.month_id).map((p) => {
                const monthName = p.month?.month_name || `Month ${p.month_id}`;
                const isOpen = !p.is_locked;
                return (
                  <div
                    key={p.id || p.month_id}
                    className={`relative rounded-md border px-2.5 py-3 pr-8 text-center transition-colors ${
                      isOpen
                        ? "border-ok/40 bg-ok-tint"
                        : "border-border bg-sunken/60"
                    }`}
                  >
                    {isAdmin ? (
                      <button
                        type="button"
                        title={isOpen ? "Lock period" : "Unlock period"}
                        aria-label={isOpen ? `Lock ${monthName}` : `Unlock ${monthName}`}
                        aria-pressed={!isOpen}
                        onClick={() => setConfirmLock({ period: p, action: isOpen ? "lock" : "unlock" })}
                        className={`absolute top-1.5 right-1.5 p-1 rounded-md transition-colors ${
                          isOpen
                            ? "text-ok hover:bg-ok/15"
                            : "text-muted-foreground hover:bg-card hover:text-foreground"
                        }`}
                      >
                        {isOpen ? <Unlock size={14} strokeWidth={2.25} /> : <Lock size={14} strokeWidth={2.25} />}
                      </button>
                    ) : (
                      <span
                        className={`absolute top-1.5 right-1.5 p-1 ${
                          isOpen ? "text-ok" : "text-muted-foreground"
                        }`}
                        aria-hidden
                      >
                        {isOpen ? <Unlock size={14} /> : <Lock size={14} />}
                      </span>
                    )}
                    <div className={`text-xs font-bold ${isOpen ? "text-foreground" : "text-muted-foreground"}`}>
                      {monthName}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
