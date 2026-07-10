import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { platformApi } from "@/api/client";
import { LoadingSkeleton, EmptyState } from "@/components/shared/PageComponents";
import { PageShell } from "@/components/shared/PageShell";
import { DataTable } from "@/components/shared/DataTable";
import { FormField as WorkspaceField } from "@/components/shared/FormField";
import { FormRow, FormSection } from "@/components/shared/FormWorkspace";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormDialog, type FormField } from "@/components/shared/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Plus, Search, MoreHorizontal, UserPlus,
  Ban, ShieldOff, ShieldCheck, Trash2, CreditCard, Building2,
  ChevronLeft, ChevronRight, Sparkles, Cpu, Layers,
  Eye, Users, MapPin, BarChart2, Mail, Globe, FileText, FileSpreadsheet,
  ShieldAlert,
} from "lucide-react";
import { SupportAccessDialog } from "@/components/platform/SupportAccessDialog";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import type { Company, SubscriptionPlan } from "@/types";
import { formatDate, getApiError } from "@/lib/utils";
import { getModuleIcon } from "@/lib/constants";
import * as XLSX from "xlsx";

type CompanyFormState = {
  company_name: string;
  company_code: string;
  plan_id: string;
  industry: string;
  country: string;
  timezone: string;
  gstin: string;
  pan: string;
  registered_address: string;
  billing_email: string;
};

type AdminFormState = {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
};

const emptyCompanyForm = (): CompanyFormState => ({
  company_name: "",
  company_code: "",
  plan_id: "",
  industry: "",
  country: "India",
  timezone: "Asia/Kolkata",
  gstin: "",
  pan: "",
  registered_address: "",
  billing_email: "",
});

const emptyAdminForm = (): AdminFormState => ({
  first_name: "",
  last_name: "",
  email: "",
  password: "",
});

const COUNTRY_OPTIONS = [
  { value: "India", label: "India" },
  { value: "United States", label: "United States" },
  { value: "United Kingdom", label: "United Kingdom" },
  { value: "United Arab Emirates", label: "United Arab Emirates" },
  { value: "Singapore", label: "Singapore" },
  { value: "Australia", label: "Australia" },
  { value: "Canada", label: "Canada" },
  { value: "Germany", label: "Germany" },
  { value: "France", label: "France" },
  { value: "Japan", label: "Japan" },
  { value: "Other", label: "Other" },
];

function UsageBar({ used, max, label }: { used: number; max: number; label: string }) {
  const pct = max <= 0 ? 0 : Math.min(100, (used / max) * 100);
  const isOver = used > max && max > 0;
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-semibold ${isOver ? "text-destructive" : "text-muted-foreground"}`}>
          {used} / {max === -1 ? "∞" : max}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-sunken">
        <div
          className={`h-1.5 rounded-full transition-all ${isOver ? "bg-destructive" : pct > 80 ? "bg-amber-400" : "bg-primary"}`}
          style={{ width: max === -1 ? "20%" : `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function CompanyManagement() {
  const [searchParams] = useSearchParams();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [actionLoading, setActionLoading] = useState(false);
  const [companyForm, setCompanyForm] = useState<CompanyFormState>(emptyCompanyForm());
  const [adminForm, setAdminForm] = useState<AdminFormState>(emptyAdminForm());

  const [createOpen, setCreateOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; message: string; action: (reason?: string) => void; variant?: "default" | "destructive"; showReason?: boolean }>({ title: "", message: "", action: () => {} });
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [detailCompany, setDetailCompany] = useState<Company | null>(null);
  const [changePlanCompany, setChangePlanCompany] = useState<Company | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [engineCompany, setEngineCompany] = useState<Company | null>(null);
  const [selectedEngine, setSelectedEngine] = useState<string>("");
  const [moduleCompany, setModuleCompany] = useState<Company | null>(null);
  const [companyModules, setCompanyModules] = useState<Array<{ module_id: number; module_name: string; icon_name: string; color: string; lifecycle_status: string; is_active: boolean; source: string }>>([]);
  const [companyFeatures, setCompanyFeatures] = useState<Array<{ feature_id: number; feature_name: string; key: string; icon_name: string; color: string; lifecycle_status: string; is_active: boolean; source: string }>>([]);
  const [moduleLoading, setModuleLoading] = useState(false);
  const [supportCompany, setSupportCompany] = useState<Company | null>(null);

  const pageSize = 20;

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, size: pageSize };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const { data } = await platformApi.listCompanies(params);
      setCompanies(data.items || data || []);
      setTotal(data.total ?? 0);
    } catch {
      toast.error("Failed to load companies");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  useEffect(() => {
    platformApi.listPlans().then(({ data }) => {
      setPlans(Array.isArray(data) ? data : data?.items || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchCompanies(); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const totalPages = Math.ceil(total / pageSize);

  const setCompanyField = <K extends keyof CompanyFormState>(key: K, value: CompanyFormState[K]) => {
    setCompanyForm((prev) => ({ ...prev, [key]: value }));
  };

  const setAdminField = <K extends keyof AdminFormState>(key: K, value: AdminFormState[K]) => {
    setAdminForm((prev) => ({ ...prev, [key]: value }));
  };

  // Resolve plan — prefer nested plan object, fall back to local plans state; null-safe
  const resolvePlan = (c: Company | null | undefined): SubscriptionPlan | undefined => {
    if (!c) return undefined;
    return c.plan || plans.find((p) => p.plan_id === c.plan_id);
  };

  const handleCreate = async (formData: Record<string, any>) => {
    setActionLoading(true);
    try {
      await platformApi.createCompany(formData);
      toast.success("Company created successfully");
      setCreateOpen(false);
      fetchCompanies();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to create company"));
    } finally {
      setActionLoading(false);
    }
  };

  // Platform creates the initial COMPANY_ADMIN only — other roles are managed by the company admin
  const handleCreateAdmin = async (formData: Record<string, any>) => {
    if (!selectedCompany) return;
    setActionLoading(true);
    try {
      await platformApi.createCompanyAdmin(selectedCompany.company_id, { ...formData, role: "COMPANY_ADMIN" });
      toast.success(`Admin created for ${selectedCompany.company_name}`);
      setAdminOpen(false);
      setSelectedCompany(null);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to create admin"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetEngine = async () => {
    if (!engineCompany || !selectedEngine) { toast.error("Please select an engine"); return; }
    setActionLoading(true);
    try {
      await platformApi.setQueryEngine(engineCompany.company_id, selectedEngine);
      toast.success(`Query engine updated for ${engineCompany.company_name}`);
      setEngineCompany(null);
      setSelectedEngine("");
      fetchCompanies();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to update query engine"));
    } finally {
      setActionLoading(false);
    }
  };

  const openModuleManager = async (company: Company) => {
    setModuleCompany(company);
    setModuleLoading(true);
    try {
      const [modRes, featRes] = await Promise.all([
        platformApi.listCompanyModuleAssignments(company.company_id),
        platformApi.listCompanyFeatureAssignments(company.company_id),
      ]);
      setCompanyModules(Array.isArray(modRes.data) ? modRes.data : []);
      setCompanyFeatures(Array.isArray(featRes.data) ? featRes.data : []);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to load capabilities"));
    } finally {
      setModuleLoading(false);
    }
  };

  const handleToggleModule = async (moduleId: number, currentActive: boolean) => {
    if (!moduleCompany) return;
    try {
      await platformApi.setCompanyModule(moduleCompany.company_id, moduleId, !currentActive);
      setCompanyModules(prev => prev.map(m => m.module_id === moduleId ? { ...m, is_active: !currentActive, source: "override" } : m));
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to update module"));
    }
  };

  const handleToggleFeature = async (featureId: number, currentActive: boolean) => {
    if (!moduleCompany) return;
    try {
      await platformApi.setCompanyFeature(moduleCompany.company_id, featureId, !currentActive);
      setCompanyFeatures(prev => prev.map(f => f.feature_id === featureId ? { ...f, is_active: !currentActive, source: "override" } : f));
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to update feature"));
    }
  };

  const handleChangePlan = async () => {
    if (!changePlanCompany || !selectedPlanId) { toast.error("Please select a plan"); return; }
    setActionLoading(true);
    try {
      await platformApi.changePlan(changePlanCompany.company_id, Number(selectedPlanId));
      toast.success(`Plan updated for ${changePlanCompany.company_name}`);
      setChangePlanCompany(null);
      setSelectedPlanId("");
      fetchCompanies();
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to change plan"));
    } finally {
      setActionLoading(false);
    }
  };

  const doAction = async (action: string, company: Company, reason?: string) => {
    setActionLoading(true);
    try {
      switch (action) {
        case "suspend": await platformApi.suspendCompany(company.company_id, reason); break;
        case "block":   await platformApi.blockCompany(company.company_id, reason); break;
        case "unblock": await platformApi.unblockCompany(company.company_id, reason); break;
        case "delete":  await platformApi.deleteCompany(company.company_id); break;
      }
      toast.success(`Company ${action}ed successfully`);
      setConfirmOpen(false);
      fetchCompanies();
    } catch (err: any) {
      toast.error(getApiError(err, `Failed to ${action} company`));
    } finally {
      setActionLoading(false);
    }
  };

  const openConfirm = (action: string, company: Company) => {
    const configs: Record<string, any> = {
      suspend: { title: "Suspend Company", message: `Suspend "${company.company_name}"? Users can still login but write access will be restricted.`, variant: "default", showReason: true },
      block:   { title: "Block Company",   message: `Block "${company.company_name}"? All users will be locked out immediately.`, variant: "destructive", showReason: true },
      unblock: { title: "Unblock Company", message: `Reactivate "${company.company_name}"? All users will regain access.`, variant: "default", showReason: true },
      delete:  { title: "Delete Company",  message: `Permanently delete "${company.company_name}"? This is a soft delete — data will be preserved but company will be deactivated.`, variant: "destructive", showReason: false },
    };
    const cfg = configs[action];
    setConfirmConfig({ ...cfg, action: (reason?: string) => doAction(action, company, reason) });
    setConfirmOpen(true);
  };

  const handleExport = () => {
    const rows = companies.map((c) => {
      const plan = resolvePlan(c);
      return {
        "Company Name": c.company_name,
        "Code": c.company_code,
        "Industry": c.industry || "",
        "Country": c.country || "",
        "Plan": plan?.plan_name || "",
        "Status": c.access_status,
        "AI Engine": c.query_engine === "LLM" ? "AI Powered" : "Standard",
        "Users": c.user_count ?? "",
        "Max Users": plan?.max_users === -1 ? "∞" : (plan?.max_users ?? ""),
        "Locations": c.location_count ?? "",
        "Max Locations": plan?.max_locations === -1 ? "∞" : (plan?.max_locations ?? ""),
        "KPIs": c.kpi_count ?? "",
        "Max KPIs": plan?.max_kpis === -1 ? "∞" : (plan?.max_kpis ?? ""),
        "GSTIN": c.gstin || "",
        "PAN": c.pan || "",
        "Billing Email": c.billing_email || "",
        "Registered Address": c.registered_address || "",
        "Created": formatDate(c.created_at),
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Companies");
    XLSX.writeFile(wb, `ESMOS_Companies_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const openCreateCompany = () => {
    setCompanyForm(emptyCompanyForm());
    setCreateOpen(true);
  };

  const openCreateAdmin = (company: Company) => {
    setSelectedCompany(company);
    setAdminForm(emptyAdminForm());
    setAdminOpen(true);
  };

  const submitCreateCompany = async () => {
    if (!companyForm.company_name.trim() || !companyForm.company_code.trim() || !companyForm.plan_id) {
      toast.error("Company Name, Company Code, and Subscription Plan are required");
      return;
    }
    await handleCreate({
      ...companyForm,
      plan_id: Number(companyForm.plan_id),
    });
  };

  const submitCreateAdmin = async () => {
    if (!adminForm.first_name.trim() || !adminForm.last_name.trim() || !adminForm.email.trim() || !adminForm.password.trim()) {
      toast.error("All admin fields are required");
      return;
    }
    await handleCreateAdmin(adminForm);
  };

  const createFields: FormField[] = [
    { key: "company_name", label: "Company Name", required: true },
    { key: "company_code", label: "Company Code", required: true, helpText: "Unique short code — used in URLs and references" },
    { key: "plan_id", label: "Subscription Plan", type: "select", required: true, options: plans.map((p) => ({ value: p.plan_id, label: `${p.plan_name} (${p.max_users === -1 ? "∞" : p.max_users} users, ${p.max_locations === -1 ? "∞" : p.max_locations} sites)` })) },
    { key: "industry", label: "Industry" },
    { key: "country", label: "Country", type: "select", options: COUNTRY_OPTIONS },
    { key: "timezone", label: "Timezone", defaultValue: "Asia/Kolkata" },
    { key: "gstin", label: "GSTIN", helpText: "15-character GST Identification Number" },
    { key: "pan", label: "PAN", helpText: "10-character Permanent Account Number" },
    { key: "registered_address", label: "Registered Address", type: "textarea" },
    { key: "billing_email", label: "Billing Email", type: "email" },
  ];

  // Platform creates only the initial Company Admin — all other roles are managed within the company portal
  const adminFields: FormField[] = [
    { key: "first_name", label: "First Name", required: true },
    { key: "last_name",  label: "Last Name",  required: true },
    { key: "email",      label: "Email",      type: "email",    required: true },
    { key: "password",   label: "Password",   type: "password", required: true },
  ];

  return (
    <PageShell
      title="Company Management"
      description="Onboard and manage tenant companies"
      breadcrumb={[{ label: "Platform Admin", href: "/platform" }, { label: "Company Management" }]}
    >
      <DataTable
        search={{ value: search, onChange: setSearch, placeholder: "Search name or code…" }}
        filters={
          <Select value={statusFilter || "__all__"} onValueChange={(v) => { setStatusFilter(v === "__all__" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[140px] h-8 text-[12px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
              <SelectItem value="BLOCKED">Blocked</SelectItem>
            </SelectContent>
          </Select>
        }
        actions={
          <>
            <button
              onClick={handleExport}
              disabled={companies.length === 0}
              className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-card text-xs font-semibold text-muted-foreground hover:bg-sunken hover:border-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileSpreadsheet size={14} className="text-ok" /> Export Excel
            </button>
            <Button size="sm" onClick={openCreateCompany}>
              <Plus size={14} /> New Company
            </Button>
          </>
        }
        loading={loading}
        empty={companies.length === 0 ? {
          icon: Building2,
          title: "No companies found",
          description: search || statusFilter ? "Try adjusting your filters" : "Get started by onboarding your first company",
          children: !search && !statusFilter ? <Button size="sm" onClick={openCreateCompany}><Plus size={14} /> New Company</Button> : undefined,
        } : undefined}
        pagination={{ page, pageSize, total, onPageChange: setPage }}
        skeletonCols={7}
      >
        <Table>
              <TableHeader>
                <TableRow>
                  {["Company Name", "Code", "Plan", "AI Engine", "Status", "Created", ""].map((h, i) => (
                    <TableHead key={i}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((c) => {
                  const plan = resolvePlan(c);
                  return (
                    <TableRow key={c.company_id} className="cursor-pointer" onClick={() => setDetailCompany(c)}>
                      <TableCell>
                        <div className="font-semibold text-foreground">{c.company_name}</div>
                        <div className="text-[11px] text-muted-foreground">{c.industry || ""}{c.country ? (c.industry ? ` · ${c.country}` : c.country) : ""}</div>
                      </TableCell>
                      <TableCell className="font-mono text-[12px] text-muted-foreground">{c.company_code}</TableCell>
                      <TableCell>
                        {plan ? (
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-default">
                                  <Badge variant="info" className="text-[10px]">{plan.plan_name}</Badge>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent
                                side="right"
                                className="bg-card border border-border shadow-lg p-3 w-52 text-inherit rounded-xl"
                              >
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{plan.plan_name} — Usage</p>
                                <div className="flex flex-col gap-2">
                                  <UsageBar used={c.user_count ?? 0} max={plan.max_users} label="Users" />
                                  <UsageBar used={c.location_count ?? 0} max={plan.max_locations} label="Locations" />
                                  <UsageBar used={c.kpi_count ?? 0} max={plan.max_kpis} label="KPIs" />
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="text-muted-foreground/40 text-[12px]">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {c.query_engine === "LLM" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                            <Sparkles size={9} /> AI Powered
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sunken text-muted-foreground">
                            <Cpu size={9} /> Standard
                          </span>
                        )}
                      </TableCell>
                      <TableCell><StatusBadge status={c.access_status} /></TableCell>
                      <TableCell className="text-muted-foreground text-[12px]">{formatDate(c.created_at)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm">
                              <MoreHorizontal size={15} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetailCompany(c)}>
                              <Eye size={14} /> View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openCreateAdmin(c)}>
                              <UserPlus size={14} /> Create Admin
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setChangePlanCompany(c); setSelectedPlanId(String(c.plan?.plan_id || "")); }}>
                              <CreditCard size={14} /> Change Plan
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setEngineCompany(c); setSelectedEngine(c.query_engine || "RULE_BASED"); }}>
                              <Sparkles size={14} /> Set Query Engine
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openModuleManager(c)}>
                              <Layers size={14} /> Manage Capabilities
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSupportCompany(c)}>
                              <ShieldAlert size={14} className="text-warn" />
                              <span>Support Access…</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {c.access_status === "ACTIVE" && (
                              <DropdownMenuItem onClick={() => openConfirm("suspend", c)}>
                                <Ban size={14} className="text-warn" />
                                <span className="text-warn">Suspend</span>
                              </DropdownMenuItem>
                            )}
                            {c.access_status !== "BLOCKED" && (
                              <DropdownMenuItem onClick={() => openConfirm("block", c)} destructive>
                                <ShieldOff size={14} /> Block
                              </DropdownMenuItem>
                            )}
                            {(c.access_status === "SUSPENDED" || c.access_status === "BLOCKED") && (
                              <DropdownMenuItem onClick={() => openConfirm("unblock", c)}>
                                <ShieldCheck size={14} className="text-green-600" />
                                <span className="text-green-600">Unblock → Active</span>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openConfirm("delete", c)} destructive>
                              <Trash2 size={14} /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
      </DataTable>

      {/* ── Company Detail Drawer ── */}
      <Sheet open={!!detailCompany} onOpenChange={(v) => { if (!v) setDetailCompany(null); }}>
        <SheetContent size="wide">
          {detailCompany && (() => {
            const plan = resolvePlan(detailCompany);
            return (
              <>
                <SheetHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <SheetTitle className="text-[18px]">{detailCompany.company_name}</SheetTitle>
                      <p className="font-mono text-[12px] mt-0.5 text-muted-foreground">{detailCompany.company_code}</p>
                    </div>
                    <StatusBadge status={detailCompany.access_status} />
                  </div>
                </SheetHeader>
                <SheetBody className="flex flex-col gap-5">

                  {/* Plan & Usage */}
                  <div>
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Plan & Usage</div>
                    <div className="bg-sunken rounded-lg p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold text-foreground">{plan?.plan_name || "No plan assigned"}</span>
                        {detailCompany.query_engine === "LLM" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                            <Sparkles size={9} /> AI Powered
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sunken text-muted-foreground">
                            <Cpu size={9} /> Standard
                          </span>
                        )}
                      </div>
                      {plan && (
                        <div className="flex flex-col gap-2.5">
                          <UsageBar used={detailCompany.user_count ?? 0} max={plan.max_users} label="Users" />
                          <UsageBar used={detailCompany.location_count ?? 0} max={plan.max_locations} label="Locations" />
                          <UsageBar used={detailCompany.kpi_count ?? 0} max={plan.max_kpis} label="KPIs" />
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-3 pt-1">
                        {[
                          { icon: Users, label: "Users", value: detailCompany.user_count ?? 0 },
                          { icon: MapPin, label: "Locations", value: detailCompany.location_count ?? 0 },
                          { icon: BarChart2, label: "KPIs", value: detailCompany.kpi_count ?? 0 },
                        ].map(({ icon: Icon, label, value }) => (
                          <div key={label} className="bg-card rounded-lg border border-border p-3 text-center">
                            <Icon size={14} className="text-primary mx-auto mb-1" />
                            <div className="text-[18px] font-bold text-foreground">{value}</div>
                            <div className="text-[10px] text-muted-foreground">{label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Business Details */}
                  <div>
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Business Details</div>
                    <div className="flex flex-col gap-2">
                      {[
                        { label: "Industry", value: detailCompany.industry, icon: Building2 },
                        { label: "Country", value: detailCompany.country, icon: Globe },
                        { label: "Timezone", value: detailCompany.timezone, icon: Globe },
                        { label: "GSTIN", value: detailCompany.gstin, icon: FileText },
                        { label: "PAN", value: detailCompany.pan, icon: FileText },
                        { label: "Billing Email", value: detailCompany.billing_email, icon: Mail },
                        { label: "Registered Address", value: detailCompany.registered_address, icon: MapPin },
                      ].map(({ label, value, icon: Icon }) => (
                        value ? (
                          <div key={label} className="flex items-start gap-2.5 py-1.5 border-b border-[hsl(var(--border-hairline))] last:border-0">
                            <Icon size={13} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
                              <div className="text-[13px] text-foreground break-words">{value}</div>
                            </div>
                          </div>
                        ) : null
                      ))}
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="flex gap-4 text-[12px] text-muted-foreground pt-1 border-t border-[hsl(var(--border-hairline))]">
                    <span>Created: <span className="font-medium text-muted-foreground">{formatDate(detailCompany.created_at)}</span></span>
                    {detailCompany.updated_at && (
                      <span>Updated: <span className="font-medium text-muted-foreground">{formatDate(detailCompany.updated_at)}</span></span>
                    )}
                  </div>
                </SheetBody>
                <SheetFooter>
                  <Button variant="outline" onClick={() => setDetailCompany(null)}>Close</Button>
                  <Button onClick={() => { setDetailCompany(null); openCreateAdmin(detailCompany); }}>
                    <UserPlus size={14} /> Create Admin
                  </Button>
                </SheetFooter>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* ── Create Company Drawer ── */}
      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent size="wide">
          <SheetHeader>
            <SheetTitle>New Company</SheetTitle>
            <p className="text-[12px] text-muted-foreground">Onboard a new tenant company.</p>
          </SheetHeader>
          <SheetBody className="space-y-5">
            <FormSection title="Company Identity" description="Core account and subscription information">
              <FormRow cols={2}>
                <WorkspaceField label="Company Name" required>
                  <input value={companyForm.company_name} onChange={(e) => setCompanyField("company_name", e.target.value)} className="field-input" />
                </WorkspaceField>
                <WorkspaceField label="Company Code" required hint="Unique short code used in references">
                  <input value={companyForm.company_code} onChange={(e) => setCompanyField("company_code", e.target.value)} className="field-input" />
                </WorkspaceField>
              </FormRow>
              <FormRow cols={2} className="mt-4">
                <WorkspaceField label="Subscription Plan" required>
                  <Select value={companyForm.plan_id || "__none__"} onValueChange={(v) => setCompanyField("plan_id", v === "__none__" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Select a plan" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select a plan</SelectItem>
                      {plans.map((p) => (
                        <SelectItem key={p.plan_id} value={String(p.plan_id)}>
                          {p.plan_name} ({p.max_users === -1 ? "∞" : p.max_users} users, {p.max_locations === -1 ? "∞" : p.max_locations} sites)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </WorkspaceField>
                <WorkspaceField label="Industry">
                  <input value={companyForm.industry} onChange={(e) => setCompanyField("industry", e.target.value)} className="field-input" />
                </WorkspaceField>
              </FormRow>
            </FormSection>
            <FormSection title="Business Details" description="Regional, tax, and billing metadata">
              <FormRow cols={2}>
                <WorkspaceField label="Country">
                  <Select value={companyForm.country || "__none__"} onValueChange={(v) => setCompanyField("country", v === "__none__" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Select country</SelectItem>
                      {COUNTRY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </WorkspaceField>
                <WorkspaceField label="Timezone">
                  <input value={companyForm.timezone} onChange={(e) => setCompanyField("timezone", e.target.value)} className="field-input" />
                </WorkspaceField>
              </FormRow>
              <FormRow cols={2} className="mt-4">
                <WorkspaceField label="GSTIN" hint="15-character GST Identification Number">
                  <input value={companyForm.gstin} onChange={(e) => setCompanyField("gstin", e.target.value)} className="field-input" />
                </WorkspaceField>
                <WorkspaceField label="PAN" hint="10-character Permanent Account Number">
                  <input value={companyForm.pan} onChange={(e) => setCompanyField("pan", e.target.value)} className="field-input" />
                </WorkspaceField>
              </FormRow>
              <WorkspaceField label="Billing Email" className="mt-4">
                <input type="email" value={companyForm.billing_email} onChange={(e) => setCompanyField("billing_email", e.target.value)} className="field-input" />
              </WorkspaceField>
              <WorkspaceField label="Registered Address" className="mt-4">
                <textarea value={companyForm.registered_address} onChange={(e) => setCompanyField("registered_address", e.target.value)} rows={3} className="field-input h-auto min-h-[88px] resize-none" />
              </WorkspaceField>
            </FormSection>
          </SheetBody>
          <SheetFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={actionLoading}>Cancel</Button>
            <Button onClick={submitCreateCompany} disabled={actionLoading}>
              {actionLoading ? "Creating..." : "Create Company"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Create Company Admin Drawer ── */}
      <Sheet open={adminOpen} onOpenChange={(open) => { if (!open) { setAdminOpen(false); setSelectedCompany(null); } }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Create Admin — {selectedCompany?.company_name || ""}</SheetTitle>
            <p className="text-[12px] text-muted-foreground">Creates the initial Company Admin account for this tenant.</p>
          </SheetHeader>
          <SheetBody className="space-y-5">
            <FormSection title="Admin Identity" description="This account will manage all other tenant-side users">
              <FormRow cols={2}>
                <WorkspaceField label="First Name" required>
                  <input value={adminForm.first_name} onChange={(e) => setAdminField("first_name", e.target.value)} className="field-input" />
                </WorkspaceField>
                <WorkspaceField label="Last Name" required>
                  <input value={adminForm.last_name} onChange={(e) => setAdminField("last_name", e.target.value)} className="field-input" />
                </WorkspaceField>
              </FormRow>
              <WorkspaceField label="Email" required className="mt-4">
                <input type="email" value={adminForm.email} onChange={(e) => setAdminField("email", e.target.value)} className="field-input" />
              </WorkspaceField>
              <WorkspaceField label="Password" required className="mt-4">
                <input type="password" value={adminForm.password} onChange={(e) => setAdminField("password", e.target.value)} className="field-input" />
              </WorkspaceField>
            </FormSection>
          </SheetBody>
          <SheetFooter>
            <Button variant="outline" onClick={() => { setAdminOpen(false); setSelectedCompany(null); }} disabled={actionLoading}>Cancel</Button>
            <Button onClick={submitCreateAdmin} disabled={actionLoading}>
              {actionLoading ? "Creating..." : "Create Admin"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={(reason) => confirmConfig.action(reason)}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmLabel={confirmConfig.title}
        variant={confirmConfig.variant}
        showReason={confirmConfig.showReason}
        loading={actionLoading}
      />

      {/* Set Query Engine Dialog */}
      <Dialog open={!!engineCompany} onOpenChange={(v) => { if (!v) { setEngineCompany(null); setSelectedEngine(""); } }}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Set Query Engine</DialogTitle>
            <DialogDescription>
              Choose the AI chatbot tier for{" "}
              <span className="font-semibold text-foreground">{engineCompany?.company_name}</span>
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-3">
              {[
                { value: "RULE_BASED", label: "Standard", desc: "Rule-based engine. Fast, deterministic, no GPU required. Best for basic plans.", icon: Cpu },
                { value: "LLM", label: "AI Powered", desc: "Local LLM engine (Ollama/Llama). Handles any question phrasing. For premium clients.", icon: Sparkles },
              ].map(({ value, label, desc, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setSelectedEngine(value)}
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all cursor-pointer w-full bg-transparent
                    ${selectedEngine === value ? "border-primary bg-primary/5" : "border-border hover:border-border"}`}
                >
                  <div className={`mt-0.5 p-1.5 rounded-md ${selectedEngine === value ? "bg-primary/10 text-primary" : "bg-sunken text-muted-foreground"}`}>
                    <Icon size={14} />
                  </div>
                  <div>
                    <div className="text-[13px] font-semibold text-foreground">{label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEngineCompany(null); setSelectedEngine(""); }} disabled={actionLoading}>
              Cancel
            </Button>
            <Button onClick={handleSetEngine} disabled={actionLoading || !selectedEngine || selectedEngine === engineCompany?.query_engine}>
              {actionLoading ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Capabilities Dialog (Modules + Features) */}
      <Dialog open={!!moduleCompany} onOpenChange={(v) => { if (!v) setModuleCompany(null); }}>
        <DialogContent className="max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Manage Capabilities</DialogTitle>
            <DialogDescription>
              Enable or disable modules and features for{" "}
              <span className="font-semibold text-foreground">{moduleCompany?.company_name}</span>.
              <span className="block text-[11px] text-muted-foreground mt-1">
                Plan-inherited rows reflect this company's subscription plan. Manual changes are tagged "override" and survive plan changes.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            {moduleLoading ? (
              <div className="text-[13px] text-muted-foreground py-4 text-center animate-pulse">Loading capabilities…</div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Modules section */}
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Modules</div>
                  <div className="flex flex-col gap-2">
                    {companyModules.map((m) => {
                      const Icon = getModuleIcon(m.icon_name);
                      const isDeprecated = m.lifecycle_status === "DEPRECATED";
                      return (
                        <div key={m.module_id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border hover:bg-sunken transition-colors">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: m.color + "22" }}>
                              <Icon size={14} style={{ color: m.color }} />
                            </div>
                            <span className="text-[13px] font-semibold text-foreground truncate">{m.module_name}</span>
                            {isDeprecated && (
                              <Badge className="bg-warn-tint text-warn text-[10px]">Deprecated</Badge>
                            )}
                            <Badge className={`text-[10px] ${m.source === "override" ? "bg-accent text-accent-foreground" : "bg-sunken text-muted-foreground"}`}>
                              {m.source === "override" ? "Override" : "Plan"}
                            </Badge>
                          </div>
                          <Switch
                            checked={m.is_active}
                            onCheckedChange={() => handleToggleModule(m.module_id, m.is_active)}
                            aria-label={`Toggle ${m.module_name}`}
                          />
                        </div>
                      );
                    })}
                    {companyModules.length === 0 && (
                      <div className="text-[12px] text-muted-foreground py-2 text-center">No modules available</div>
                    )}
                  </div>
                </div>

                {/* Features section */}
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Features</div>
                  <div className="flex flex-col gap-2">
                    {companyFeatures.map((f) => {
                      const Icon = getModuleIcon(f.icon_name);
                      const isDeprecated = f.lifecycle_status === "DEPRECATED";
                      return (
                        <div key={f.feature_id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-border hover:bg-sunken transition-colors">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: f.color + "22" }}>
                              <Icon size={14} style={{ color: f.color }} />
                            </div>
                            <span className="text-[13px] font-semibold text-foreground truncate">{f.feature_name}</span>
                            {isDeprecated && (
                              <Badge className="bg-warn-tint text-warn text-[10px]">Deprecated</Badge>
                            )}
                            <Badge className={`text-[10px] ${f.source === "override" ? "bg-accent text-accent-foreground" : "bg-sunken text-muted-foreground"}`}>
                              {f.source === "override" ? "Override" : "Plan"}
                            </Badge>
                          </div>
                          <Switch
                            checked={f.is_active}
                            onCheckedChange={() => handleToggleFeature(f.feature_id, f.is_active)}
                            aria-label={`Toggle ${f.feature_name}`}
                          />
                        </div>
                      );
                    })}
                    {companyFeatures.length === 0 && (
                      <div className="text-[12px] text-muted-foreground py-2 text-center">No features available</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModuleCompany(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Plan Dialog */}
      <Dialog open={!!changePlanCompany} onOpenChange={(v) => { if (!v) { setChangePlanCompany(null); setSelectedPlanId(""); } }}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Change Subscription Plan</DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">{changePlanCompany?.company_name}</span>
              {" "}— currently on{" "}
              <span className="font-semibold text-foreground">{resolvePlan(changePlanCompany)?.plan_name || "—"}</span>
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col gap-1.5">
              <Label className="text-[12px] font-semibold text-foreground">Select New Plan</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="— Select plan —" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.plan_id} value={String(p.plan_id)}>
                      {p.plan_name} ({p.max_users === -1 ? "∞" : p.max_users} users, {p.max_locations === -1 ? "∞" : p.max_locations} locations)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setChangePlanCompany(null); setSelectedPlanId(""); }} disabled={actionLoading}>
              Cancel
            </Button>
            <Button onClick={handleChangePlan} disabled={actionLoading || !selectedPlanId}>
              {actionLoading ? "Saving..." : "Confirm Change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {supportCompany && (
        <SupportAccessDialog
          open={!!supportCompany}
          onClose={() => setSupportCompany(null)}
          companyId={supportCompany.company_id as unknown as string}
          companyName={supportCompany.company_name}
        />
      )}
    </PageShell>
  );
}
