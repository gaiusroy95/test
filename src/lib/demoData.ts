import type { UserInfo, UserType } from "@/types";

export const DEMO_TENANT_USER: UserInfo = {
  id: "demo-tenant-001",
  first_name: "Aarav",
  last_name: "Sharma",
  email: "demo@esmos.com",
  role: "COMPANY_ADMIN",
  user_type: "tenant",
  company_id: "cmp_demo_01",
  company_name: "GreenPeak Industries",
  company_code: "GPIND",
  access_status: "ACTIVE",
  assigned_module_ids: [1, 2, 3, 4],
  assigned_location_ids: ["loc_1", "loc_2"],
};

export const DEMO_PLATFORM_USER: UserInfo = {
  id: "demo-platform-001",
  first_name: "Nina",
  last_name: "Patel",
  email: "platform-demo@esmos.com",
  role: "PLATFORM_OWNER",
  user_type: "platform",
  company_id: "platform",
  company_name: "ESMOS Platform",
  company_code: "ESMOS",
  access_status: "ACTIVE",
};

const makePaginated = <T,>(items: T[]) => ({
  items,
  data: items,
  total: items.length,
  page: 1,
  pages: 1,
  size: items.length,
});

export const demoModules = [
  {
    module_id: 1,
    module_name: "Energy",
    key: "energy",
    description: "Track fuel, grid, and renewable energy consumption.",
    color: "#f59e0b",
    bg_color: "rgba(245,158,11,0.12)",
    icon_name: "Zap",
    render_type: "standard_input",
    display_order: 1,
    lifecycle_status: "PUBLISHED",
    is_active: true,
  },
  {
    module_id: 2,
    module_name: "Emissions",
    key: "emissions",
    description: "Manage scope 1, 2, and 3 emissions workflows.",
    color: "#94a3b8",
    bg_color: "rgba(148,163,184,0.12)",
    icon_name: "Wind",
    render_type: "auto_computed",
    display_order: 2,
    lifecycle_status: "PUBLISHED",
    is_active: true,
  },
  {
    module_id: 3,
    module_name: "Water",
    key: "water",
    description: "Monitor water withdrawal, reuse, and discharge.",
    color: "#38bdf8",
    bg_color: "rgba(56,189,248,0.12)",
    icon_name: "Droplets",
    render_type: "standard_input",
    display_order: 3,
    lifecycle_status: "PUBLISHED",
    is_active: true,
  },
  {
    module_id: 4,
    module_name: "Waste",
    key: "waste",
    description: "Track waste handling and disposal data.",
    color: "#4ade80",
    bg_color: "rgba(74,222,128,0.12)",
    icon_name: "Trash2",
    render_type: "input_with_disposal",
    display_order: 4,
    lifecycle_status: "PUBLISHED",
    is_active: true,
  },
];

export const demoFeatures = [
  {
    feature_id: 101,
    feature_name: "Scope 3 Hub",
    key: "scope3",
    description: "Review supplier and value-chain emissions inputs.",
    color: "#8b5cf6",
    bg_color: "rgba(139,92,246,0.12)",
    icon_name: "Layers3",
    route_key: "scope3",
    display_order: 1,
    lifecycle_status: "PUBLISHED",
    is_active: true,
  },
  {
    feature_id: 102,
    feature_name: "Targets",
    key: "targets",
    description: "Track annual emissions reduction targets.",
    color: "#0ea5e9",
    bg_color: "rgba(14,165,233,0.12)",
    icon_name: "Target",
    route_key: "targets",
    display_order: 2,
    lifecycle_status: "PUBLISHED",
    is_active: true,
  },
];

export const demoLocations = [
  {
    location_id: "loc_1",
    company_id: "cmp_demo_01",
    location_name: "Mumbai Plant",
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    is_high_risk_location: false,
    is_active: true,
    created_at: "2025-01-10T00:00:00Z",
  },
  {
    location_id: "loc_2",
    company_id: "cmp_demo_01",
    location_name: "Pune Office",
    city: "Pune",
    state: "Maharashtra",
    country: "India",
    is_high_risk_location: true,
    is_active: true,
    created_at: "2025-02-12T00:00:00Z",
  },
];

export const demoUsers = [
  {
    user_id: "usr_1",
    company_id: "cmp_demo_01",
    first_name: "Priya",
    last_name: "Mehta",
    email: "priya@greenpeak.com",
    role: "LOCATION_USER",
    is_active: true,
    is_verified: true,
    last_login_at: "2026-07-07T10:00:00Z",
    created_at: "2025-01-22T00:00:00Z",
    assigned_module_ids: [1, 3],
    assigned_location_ids: ["loc_1"],
  },
  {
    user_id: "usr_2",
    company_id: "cmp_demo_01",
    first_name: "Rohan",
    last_name: "Bhatia",
    email: "rohan@greenpeak.com",
    role: "REVIEWER",
    is_active: true,
    is_verified: true,
    last_login_at: "2026-07-06T14:30:00Z",
    created_at: "2025-02-04T00:00:00Z",
    assigned_module_ids: [2, 4],
    assigned_location_ids: ["loc_2"],
  },
];

export const demoCompany = {
  company_id: "cmp_demo_01",
  company_name: "GreenPeak Industries",
  company_code: "GPIND",
  industry: "Manufacturing",
  country: "India",
  timezone: "Asia/Kolkata",
  access_status: "ACTIVE",
  query_engine: "RULE_BASED",
  is_active: true,
  created_at: "2024-12-01T00:00:00Z",
  user_count: 2,
  location_count: 2,
  kpi_count: 18,
};

export const demoFinancialYears = [
  { year_id: 1, fy_label: "FY 2025-26", start_date: "2025-04-01", end_date: "2026-03-31", start_month_name: "April" },
  { year_id: 2, fy_label: "FY 2026-27", start_date: "2026-04-01", end_date: "2027-03-31", start_month_name: "April" },
];

export const demoMonths = [
  { month_id: 1, month_name: "April", calendar_month: 4, fy_order: 1 },
  { month_id: 2, month_name: "May", calendar_month: 5, fy_order: 2 },
  { month_id: 3, month_name: "June", calendar_month: 6, fy_order: 3 },
  { month_id: 4, month_name: "July", calendar_month: 7, fy_order: 4 },
  { month_id: 5, month_name: "August", calendar_month: 8, fy_order: 5 },
  { month_id: 6, month_name: "September", calendar_month: 9, fy_order: 6 },
  { month_id: 7, month_name: "October", calendar_month: 10, fy_order: 7 },
  { month_id: 8, month_name: "November", calendar_month: 11, fy_order: 8 },
  { month_id: 9, month_name: "December", calendar_month: 12, fy_order: 9 },
  { month_id: 10, month_name: "January", calendar_month: 1, fy_order: 10 },
  { month_id: 11, month_name: "February", calendar_month: 2, fy_order: 11 },
  { month_id: 12, month_name: "March", calendar_month: 3, fy_order: 12 },
];

export const demoIndicators = [
  {
    indicator_id: 1,
    module_id: 1,
    indicator_name: "Grid Electricity",
    description: "Monthly electricity consumption from grid",
    unit: "kWh",
    display_order: 1,
  },
  {
    indicator_id: 2,
    module_id: 2,
    indicator_name: "Scope 1 Emissions",
    description: "Direct emissions from operations",
    unit: "tCO2e",
    display_order: 2,
  },
];

export const demoAuditLog = [
  { id: "log_1", actioned_by: "Nina Patel", action: "Approved submission", target_company_id: "cmp_demo_01", actioned_at: "2026-07-07T09:15:00Z" },
  { id: "log_2", actioned_by: "Aarav Sharma", action: "Updated targets", target_company_id: "cmp_demo_01", actioned_at: "2026-07-06T16:40:00Z" },
];

export const demoSupportTickets = [
  {
    ticket_id: "ticket_1",
    subject: "Need help with Scope 3 upload",
    priority: "HIGH",
    status: "OPEN",
    created_at: "2026-07-07T08:10:00Z",
    updated_at: "2026-07-07T09:00:00Z",
    company_id: "cmp_demo_01",
    company_name: "GreenPeak Industries",
    created_by_name: "Aarav Sharma",
    messages: [
      { message_id: "msg_1", body: "Two rows in our freight upload are not matching a factor.", sender_type: "TENANT", sender_name: "Aarav Sharma", created_at: "2026-07-07T08:10:00Z" },
      { message_id: "msg_2", body: "Please verify the activity unit is tonne-km. The demo file has an example.", sender_type: "PLATFORM", sender_name: "Nina Patel", created_at: "2026-07-07T09:00:00Z" },
    ],
  },
];

export const demoNotifications = [
  { id: "notif_1", type: "REMINDER", title: "Data entry due tomorrow", body: "Please submit June values in ESG Input.", is_read: false, created_at: "2026-07-07T10:30:00Z" },
];

export const demoReports = [
  { id: "report_1", title: "June ESG Summary", status: "READY", created_at: "2026-07-07T11:00:00Z" },
  { id: "report_2", title: "BRSR Disclosure Draft", status: "DRAFT", created_at: "2026-07-06T14:30:00Z" },
];

export const demoQuery = {
  answer: "GreenPeak Industries has reduced energy intensity by 8% year-on-year based on the demo data.",
  suggestions: ["Show June emissions trend", "Summarize water usage", "Explain BRSR status"],
};

export const demoPlatformAdmins = [
  { id: "admin_1", first_name: "Nina", last_name: "Patel", email: "nina@esmos.com", role: "PLATFORM_OWNER", is_active: true, created_at: "2024-01-10T00:00:00Z" },
];

export const demoPlans = [
  { plan_id: 1, plan_name: "Growth", max_users: 50, max_locations: 20, max_kpis: 100, is_active: true },
  { plan_id: 2, plan_name: "Enterprise", max_users: 200, max_locations: 100, max_kpis: 500, is_active: true },
];

export const demoDashboardCards = [
  { label: "Submitted", value: "92%", change: "+4.2%", tone: "positive" },
  { label: "Pending Review", value: "6", change: "2 due today", tone: "neutral" },
  { label: "Targets On Track", value: "14/18", change: "78%", tone: "positive" },
];

const demoReportingYears = demoFinancialYears.map((financialYear) => ({
  id: `ry_${financialYear.year_id}`,
  company_id: "cmp_demo_01",
  year_id: financialYear.year_id,
  fy_start_month: 4,
  is_active: true,
  financial_year: financialYear,
}));

const demoKpis = [
  { kpi_id: "kpi_energy_1", company_id: "cmp_demo_01", module_id: 1, indicator_id: 1, kpi_name: "Grid electricity consumed", unit: "kWh", input_type: "numeric", is_emission_source: true, scope_number: 2, energy_type: "NON_RENEWABLE", is_active: true, created_at: "2025-01-10T00:00:00Z" },
  { kpi_id: "kpi_energy_2", company_id: "cmp_demo_01", module_id: 1, indicator_id: 1, kpi_name: "Renewable electricity generated", unit: "kWh", input_type: "numeric", is_emission_source: false, energy_type: "RENEWABLE", is_active: true, created_at: "2025-01-10T00:00:00Z" },
  { kpi_id: "kpi_diesel", company_id: "cmp_demo_01", module_id: 1, indicator_id: 1, kpi_name: "Diesel consumed", unit: "L", input_type: "numeric", is_emission_source: true, scope_number: 1, energy_type: "NON_RENEWABLE", is_active: true, created_at: "2025-01-10T00:00:00Z" },
  { kpi_id: "kpi_scope1", company_id: "cmp_demo_01", module_id: 2, indicator_id: 2, kpi_name: "Scope 1 emissions", unit: "tCO2e", input_type: "numeric", is_emission_source: false, scope_number: 1, is_active: true, created_at: "2025-01-10T00:00:00Z" },
  { kpi_id: "kpi_water", company_id: "cmp_demo_01", module_id: 3, indicator_id: 3, kpi_name: "Water withdrawn", unit: "kL", input_type: "numeric", is_emission_source: false, is_active: true, created_at: "2025-01-10T00:00:00Z" },
  { kpi_id: "kpi_recycled", company_id: "cmp_demo_01", module_id: 4, indicator_id: 4, kpi_name: "Waste recycled", unit: "tonne", input_type: "numeric", is_emission_source: false, is_active: true, created_at: "2025-01-10T00:00:00Z" },
];

demoIndicators.push(
  { indicator_id: 3, module_id: 3, indicator_name: "Water Withdrawal", description: "Water withdrawn by source", unit: "kL", display_order: 1 },
  { indicator_id: 4, module_id: 4, indicator_name: "Waste Generated", description: "Waste generated and diverted", unit: "tonne", display_order: 1 },
);

const demoSubmissionItems = [
  { submission_id: "sub_001", location_id: "loc_1", location_name: "Mumbai Plant", year_id: 2, year_label: "FY 2026-27", month_id: 3, month_name: "June", status: "SUBMITTED", kpi_count: 6, filled_count: 6, submitted_by_name: "Priya Mehta", submitted_at: "2026-07-06T11:20:00Z", updated_at: "2026-07-06T11:20:00Z" },
  { submission_id: "sub_002", location_id: "loc_2", location_name: "Pune Office", year_id: 2, year_label: "FY 2026-27", month_id: 2, month_name: "May", status: "APPROVED", kpi_count: 6, filled_count: 6, submitted_by_name: "Priya Mehta", submitted_at: "2026-06-05T09:15:00Z", reviewed_by_name: "Rohan Bhatia", updated_at: "2026-06-06T10:00:00Z" },
  { submission_id: "sub_003", location_id: "loc_1", location_name: "Mumbai Plant", year_id: 2, year_label: "FY 2026-27", month_id: 2, month_name: "May", status: "REJECTED", kpi_count: 6, filled_count: 5, submitted_by_name: "Priya Mehta", submitted_at: "2026-06-04T12:30:00Z", reviewer_notes: "Please attach the electricity invoice.", updated_at: "2026-06-05T08:45:00Z" },
];

const makeSubmissionDetail = (item = demoSubmissionItems[0]) => ({
  ...item,
  company_id: "cmp_demo_01",
  created_by: "usr_1",
  created_at: item.updated_at,
  kpi_values: demoKpis.map((kpi, index) => ({
    record_id: `${item.submission_id}_record_${index + 1}`,
    kpi_id: kpi.kpi_id,
    indicator_id: kpi.indicator_id,
    quantity: [184200, 32400, 4100, 11.2, 2860, 18.4][index],
    emission_value: index < 3 ? [131.5, 0, 11.0][index] : undefined,
    notes: index === 0 ? "Meter reading reconciled with utility invoice." : "",
    updated_at: item.updated_at,
  })),
});

const demoRemarks = [
  { remark_id: "remark_1", company_id: "cmp_demo_01", submission_id: "sub_001", auditor_user_id: "auditor_1", remark_text: "Please provide the June utility invoice and meter reconciliation.", severity: "NON_CONFORMITY", status: "OPEN", auditor_name: "Anita Rao", location_name: "Mumbai Plant", fy_label: "FY 2026-27", month_name: "June", response_count: 0, created_at: "2026-07-07T09:00:00Z", updated_at: "2026-07-07T09:00:00Z", responses: [] },
  { remark_id: "remark_2", company_id: "cmp_demo_01", submission_id: "sub_002", auditor_user_id: "auditor_1", remark_text: "Confirm whether tanker water is included in third-party water.", severity: "FINDING", status: "RESPONDED", auditor_name: "Anita Rao", location_name: "Pune Office", fy_label: "FY 2026-27", month_name: "May", response_count: 1, created_at: "2026-06-12T10:30:00Z", updated_at: "2026-06-13T08:15:00Z", responses: [{ response_id: "resp_1", remark_id: "remark_2", responder_user_id: "demo-tenant-001", response_text: "Confirmed and updated in the source notes.", responder_name: "Aarav Sharma", responder_role: "COMPANY_ADMIN", created_at: "2026-06-13T08:15:00Z" }] },
];

const demoScope3Categories = [
  { category_id: 1, code: "C1", name: "Purchased goods and services", description: "Upstream purchased goods", scope3_type: "UPSTREAM", typical_unit: "INR", display_order: 1, is_active: true },
  { category_id: 4, code: "C4", name: "Upstream transportation", description: "Inbound freight and distribution", scope3_type: "UPSTREAM", typical_unit: "tonne-km", display_order: 4, is_active: true },
  { category_id: 6, code: "C6", name: "Business travel", description: "Employee business travel", scope3_type: "UPSTREAM", typical_unit: "km", display_order: 6, is_active: true },
  { category_id: 9, code: "C9", name: "Downstream transportation", description: "Outbound freight and distribution", scope3_type: "DOWNSTREAM", typical_unit: "tonne-km", display_order: 9, is_active: true },
];

const demoScope3Sets = [
  { factor_set_id: "fs_defra", company_id: null, set_name: "DEFRA 2026", source_name: "UK DEFRA", dataset_year: 2026, currency_code: "INR", methodology: "GHG Protocol", version: "2026.1", is_system: true, is_active: true, source_set_id: null, item_count: 48, created_at: "2026-01-15T00:00:00Z" },
  { factor_set_id: "fs_company", company_id: "cmp_demo_01", set_name: "GreenPeak Supplier Factors", source_name: "Supplier disclosures", dataset_year: 2026, currency_code: "INR", methodology: "Supplier specific", version: "1.0", is_system: false, is_active: true, source_set_id: null, item_count: 12, created_at: "2026-04-01T00:00:00Z" },
];

const demoScope3Batches = [
  { batch_id: "batch_1", company_id: "cmp_demo_01", ghg_category_id: 1, ghg_category_name: "Purchased goods and services", location_id: "loc_1", location_name: "Mumbai Plant", reporting_year: 2026, reporting_month: 6, factor_set_id: "fs_company", factor_set_name: "GreenPeak Supplier Factors", status: "SUBMITTED", total_rows: 42, valid_rows: 40, error_rows: 2, total_emissions: 824.6, notes: null, rejection_reason: null, uploader_name: "Priya Mehta", uploaded_by: "usr_1", created_at: "2026-07-05T08:00:00Z", updated_at: "2026-07-05T08:00:00Z" },
  { batch_id: "batch_2", company_id: "cmp_demo_01", ghg_category_id: 4, ghg_category_name: "Upstream transportation", location_id: "loc_1", location_name: "Mumbai Plant", reporting_year: 2026, reporting_month: 5, factor_set_id: "fs_defra", factor_set_name: "DEFRA 2026", status: "APPROVED", total_rows: 18, valid_rows: 18, error_rows: 0, total_emissions: 216.3, notes: null, rejection_reason: null, uploader_name: "Priya Mehta", uploaded_by: "usr_1", created_at: "2026-06-05T08:00:00Z", updated_at: "2026-06-06T08:00:00Z" },
];

const demoSuppliers = [
  { supplier_id: "supplier_1", company_id: "cmp_demo_01", supplier_name: "Atlas Steel Works", supplier_code: "SUP-001", sector_code: "STEEL", sector_name: "Metals", risk_tier: "HIGH", is_critical: true, contact_name: "Neha Kapoor", contact_email: "neha@atlas.example", is_active: true, created_at: "2026-01-10T00:00:00Z", updated_at: "2026-01-10T00:00:00Z" },
  { supplier_id: "supplier_2", company_id: "cmp_demo_01", supplier_name: "BlueRoute Logistics", supplier_code: "SUP-002", sector_code: "LOG", sector_name: "Logistics", risk_tier: "MEDIUM", is_critical: false, contact_name: "Vikram Sen", contact_email: "vikram@blueroute.example", is_active: true, created_at: "2026-02-12T00:00:00Z", updated_at: "2026-02-12T00:00:00Z" },
];

const demoTargets = [
  { target_id: "target_1", company_id: "cmp_demo_01", kpi_id: "kpi_scope1", kpi_name: "Scope 1 emissions", module_id: 2, target_type: "ABSOLUTE", agg_field: "emission_value", baseline_year_id: 1, baseline_value: 1680, target_year_id: 2, target_value: 1428, direction: "DECREASE", is_active: true },
  { target_id: "target_2", company_id: "cmp_demo_01", kpi_id: "kpi_water", kpi_name: "Water withdrawn", module_id: 3, target_type: "INTENSITY", agg_field: "quantity", baseline_year_id: 1, baseline_value: 4.2, target_year_id: 2, target_value: 3.7, direction: "DECREASE", is_active: true },
];

const demoUoms = [
  { uom_id: 1, symbol: "kWh", display_name: "Kilowatt hour", category: "energy", is_active: true },
  { uom_id: 2, symbol: "MJ", display_name: "Megajoule", category: "energy", is_active: true },
  { uom_id: 3, symbol: "tCO2e", display_name: "Tonnes CO₂ equivalent", category: "emission", is_active: true },
  { uom_id: 4, symbol: "kgCO2e", display_name: "Kilograms CO₂ equivalent", category: "emission", is_active: true },
  { uom_id: 5, symbol: "kL", display_name: "Kilolitre", category: "volume", is_active: true },
  { uom_id: 6, symbol: "tonne", display_name: "Metric tonne", category: "mass", is_active: true },
];

type DemoRequest = {
  url?: string;
  method?: string;
  params?: Record<string, unknown>;
  data?: unknown;
};

function parseBody(data: unknown): Record<string, any> {
  if (!data) return {};
  if (typeof data === "string") {
    try { return JSON.parse(data); } catch { return {}; }
  }
  return typeof data === "object" ? data as Record<string, any> : {};
}

function paginate<T>(items: T[], params: Record<string, unknown> = {}) {
  const page = Number(params.page || 1);
  const size = Number(params.size || Math.max(items.length, 20));
  const start = (page - 1) * size;
  return { items: items.slice(start, start + size), total: items.length, page, pages: Math.max(1, Math.ceil(items.length / size)), size };
}

export function getDemoResponse(request: DemoRequest) {
  const path = `/${(request.url || "").split("?")[0].replace(/^\/+/, "")}`;
  const method = (request.method || "GET").toUpperCase();
  const params = request.params || {};
  const body = parseBody(request.data);
  const isRead = method === "GET" || method === "HEAD" || method === "OPTIONS";

  // Authentication remains wired through the same auth API surface.
  if (path === "/platform/auth/login") return { access_token: "demo-platform-token", refresh_token: "demo-platform-refresh", token_type: "bearer", user: DEMO_PLATFORM_USER };
  if (path === "/auth/login") return { access_token: "demo-access-token", refresh_token: "demo-refresh-token", token_type: "bearer", user: DEMO_TENANT_USER };
  if (path === "/platform/auth/me") return { user: DEMO_PLATFORM_USER };
  if (path === "/auth/me") return { user: DEMO_TENANT_USER };
  if (path.endsWith("/auth/refresh")) return { access_token: "demo-access-token", refresh_token: "demo-refresh-token", token_type: "bearer" };

  // Platform portal.
  if (path === "/platform/companies") return paginate([demoCompany], params);
  if (/^\/platform\/companies\/[^/]+$/.test(path)) return demoCompany;
  if (path === "/platform/plans") return demoPlans;
  if (path === "/platform/admins") return demoPlatformAdmins;
  if (/^\/platform\/admins\/[^/]+$/.test(path)) return demoPlatformAdmins[0];
  if (path === "/platform/system/modules") return demoModules;
  if (path === "/platform/system/features") return demoFeatures;
  if (path === "/platform/system/financial-years") return demoFinancialYears;
  if (path === "/platform/system/months") return demoMonths;
  if (path === "/platform/system/indicators") return paginate(demoIndicators, params);
  if (path === "/platform/system/uoms") return demoUoms;
  if (path === "/platform/catalog/kpis") return demoKpis;
  if (/^\/platform\/catalog\/kpis\/[^/]+\/factors$/.test(path)) return [];
  if (path === "/platform/audit-log") return paginate(demoAuditLog, params);
  if (path === "/platform/support-tickets/pending-count") return { count: 1 };
  if (path === "/platform/support-tickets") return paginate(demoSupportTickets, params);
  if (/^\/platform\/support-tickets\/[^/]+$/.test(path)) return demoSupportTickets[0];
  if (/^\/platform\/system\/companies\/[^/]+\/modules$/.test(path)) return demoModules.map((item) => ({ ...item, is_assigned: true }));
  if (/^\/platform\/system\/companies\/[^/]+\/features$/.test(path)) return demoFeatures.map((item) => ({ ...item, is_assigned: true }));
  if (/^\/platform\/plans\/\d+\/modules$/.test(path)) return demoModules;
  if (/^\/platform\/plans\/\d+\/app-features$/.test(path)) return demoFeatures;
  if (/^\/platform\/plans\/\d+\/features$/.test(path)) return [];
  if (path === "/platform/plans/feature-keys") return [];
  if (path === "/platform/scope3/categories") return demoScope3Categories;
  if (path === "/platform/scope3/factor-sets") return demoScope3Sets;
  if (/^\/platform\/scope3\/factor-sets\/[^/]+\/items$/.test(path)) return [];

  // Tenant reference data.
  if (path === "/modules") return demoModules;
  if (path === "/features") return demoFeatures;
  if (path === "/reporting-years/financial-years") return demoFinancialYears;
  if (path === "/reporting-years/months") return demoMonths;
  if (path === "/reporting-years") return demoReportingYears;
  if (/^\/reporting-years\/\d+\/periods$/.test(path)) {
    return Array.from({ length: 12 }, (_, index) => ({
      id: `period_${index + 1}`, company_id: "cmp_demo_01", year_id: Number(path.split("/")[2]),
      month_id: index + 1, is_locked: index < 2,
      month: { month_id: index + 1, month_name: new Date(2026, index + 3, 1).toLocaleString("en", { month: "long" }), calendar_month: ((index + 3) % 12) + 1, fy_order: index + 1 },
    }));
  }
  if (path === "/uoms") return params.category ? demoUoms.filter((u) => u.category === params.category) : demoUoms;
  if (path === "/indicators") return params.module_id ? demoIndicators.filter((i) => i.module_id === Number(params.module_id)) : demoIndicators;
  if (path === "/kpis") {
    const rows = params.module_id ? demoKpis.filter((k) => k.module_id === Number(params.module_id)) : demoKpis;
    return paginate(rows, params);
  }
  if (/^\/kpis\/[^/]+$/.test(path) && method === "GET") return demoKpis.find((k) => k.kpi_id === path.split("/")[2]) || demoKpis[0];
  if (/^\/kpis\/[^/]+\/conversion-factors$/.test(path)) return [];
  if (/^\/kpis\/conversion-factors\/\d+\/affected-count$/.test(path)) return { affected_count: 3 };

  // Locations and users, including useful in-memory CRUD for UI testing.
  if (path === "/locations" && method === "GET") return paginate(demoLocations, params);
  if (path === "/locations" && method === "POST") {
    const created = { ...body, location_id: `loc_demo_${Date.now()}`, company_id: "cmp_demo_01", is_active: true, created_at: new Date().toISOString() };
    demoLocations.push(created as typeof demoLocations[number]);
    return created;
  }
  const locationMatch = path.match(/^\/locations\/([^/]+)$/);
  if (locationMatch && method === "GET") return demoLocations.find((l) => l.location_id === locationMatch[1]) || demoLocations[0];
  if (locationMatch && method === "PATCH") {
    const index = demoLocations.findIndex((l) => l.location_id === locationMatch[1]);
    if (index >= 0) Object.assign(demoLocations[index], body);
    return demoLocations[index];
  }
  if (locationMatch && method === "DELETE") {
    const index = demoLocations.findIndex((l) => l.location_id === locationMatch[1]);
    if (index >= 0) demoLocations.splice(index, 1);
    return { ok: true };
  }
  if (/^\/locations\/[^/]+\/lb-factors$/.test(path)) return [];
  if (/^\/locations\/[^/]+\/scoped-kpis$/.test(path)) return demoKpis.filter((k) => k.scope_number);
  if (path === "/users") return paginate(demoUsers, params);
  if (/^\/users\/[^/]+$/.test(path) && method === "GET") return demoUsers.find((u) => u.user_id === path.split("/")[2]) || demoUsers[0];

  // Submissions, review and dashboard counts.
  if (path === "/submissions" && method === "GET") {
    let rows = [...demoSubmissionItems];
    if (params.status) rows = rows.filter((row) => row.status === params.status);
    if (params.year_id) rows = rows.filter((row) => row.year_id === Number(params.year_id));
    return paginate(rows, params);
  }
  if (path === "/submissions" && method === "POST") {
    const existing = demoSubmissionItems.find((row) => row.location_id === body.location_id && row.year_id === body.year_id && row.month_id === body.month_id);
    return makeSubmissionDetail(existing || demoSubmissionItems[0]);
  }
  if (path === "/submissions/previous-values") return {};
  if (/^\/submissions\/by-location\/[^/]+$/.test(path)) return demoSubmissionItems.filter((row) => row.location_id === path.split("/")[3]);
  const submissionAction = path.match(/^\/submissions\/([^/]+)\/(approve|reject|submit|save)$/);
  if (submissionAction) {
    const row = demoSubmissionItems.find((item) => item.submission_id === submissionAction[1]) || demoSubmissionItems[0];
    if (submissionAction[2] === "approve") row.status = "APPROVED";
    if (submissionAction[2] === "reject") row.status = "REJECTED";
    if (submissionAction[2] === "submit") row.status = "SUBMITTED";
    return makeSubmissionDetail(row);
  }
  const submissionMatch = path.match(/^\/submissions\/([^/]+)$/);
  if (submissionMatch) return makeSubmissionDetail(demoSubmissionItems.find((item) => item.submission_id === submissionMatch[1]));
  if (path === "/esg-input") return paginate(makeSubmissionDetail().kpi_values.map((value) => ({ ...value, company_id: "cmp_demo_01", location_id: "loc_1", submission_id: "sub_001", year_id: 2, month_id: 3, created_by: "usr_1", created_at: value.updated_at })), params);
  if (/^\/esg-input\/copy-previous-year$/.test(path)) return { copied_count: 6, message: "Previous year values loaded." };

  // Notifications, remarks and settings.
  if (path === "/notifications/unread-count") return { unread_count: demoNotifications.filter((n: any) => !n.is_read).length };
  if (path === "/notifications/mark-all-read" && method === "POST") {
    demoNotifications.forEach((notification) => { notification.is_read = true; });
    return { ok: true };
  }
  if (/^\/notifications\/[^/]+\/read$/.test(path) && method === "PATCH") {
    const id = path.split("/")[2];
    const notification = demoNotifications.find((item) => item.id === id);
    if (notification) notification.is_read = true;
    return notification || { ok: true };
  }
  if (path === "/notifications") {
    let rows = demoNotifications.map((n: any, index) => ({ notification_id: n.notification_id || n.id, user_id: "demo-tenant-001", type: n.type, title: n.title, message: n.message || n.body, record_id: index === 0 ? "sub_001" : undefined, is_read: n.is_read ?? false, created_at: n.created_at }));
    if (params.is_read !== undefined) rows = rows.filter((notification) => notification.is_read === params.is_read);
    return paginate(rows, params);
  }
  if (path === "/auditor-remarks/summary") return {
    total: demoRemarks.length,
    open_count: demoRemarks.filter((r) => r.status === "OPEN").length,
    by_status: {
      OPEN: demoRemarks.filter((r) => r.status === "OPEN").length,
      RESPONDED: demoRemarks.filter((r) => r.status === "RESPONDED").length,
      CLOSED: demoRemarks.filter((r) => r.status === "CLOSED").length,
    },
    by_severity: {
      OBSERVATION: demoRemarks.filter((r) => r.severity === "OBSERVATION").length,
      FINDING: demoRemarks.filter((r) => r.severity === "FINDING").length,
      NON_CONFORMITY: demoRemarks.filter((r) => r.severity === "NON_CONFORMITY").length,
    },
  };
  if (path === "/auditor-remarks") {
    return demoRemarks.filter((r) => (!params.status || r.status === params.status) && (!params.severity || r.severity === params.severity) && (!params.submission_id || r.submission_id === params.submission_id));
  }
  if (/^\/auditor-remarks\/[^/]+$/.test(path)) return demoRemarks.find((r) => r.remark_id === path.split("/")[2]) || demoRemarks[0];
  if (path === "/settings") return [
    { id: "setting_1", company_id: "cmp_demo_01", setting_key: "company_name", setting_value: "GreenPeak Industries", updated_at: "2026-07-01T00:00:00Z" },
    { id: "setting_2", company_id: "cmp_demo_01", setting_key: "reporting_currency", setting_value: "INR", updated_at: "2026-07-01T00:00:00Z" },
  ];
  if (path === "/compliance/audit-log") return paginate(demoAuditLog, params);

  // Targets and derived metrics.
  if (path === "/targets/progress") return {
    current_fy_id: 2, current_fy_label: "FY 2026-27", total_targets: 2, on_track_count: 1, at_risk_count: 1,
    items: [
      { target_id: "target_1", label: "Scope 1 emissions", module_name: "Emissions", module_color: "#94a3b8", target_type: "ABSOLUTE", agg_field: "emission_value", unit: "tCO2e", baseline_value: 1680, baseline_fy_label: "FY 2025-26", target_value: 1428, target_fy_label: "FY 2026-27", current_value: 1495, current_fy_label: "FY 2026-27", delta_from_baseline: -185, delta_pct: -11.0, progress_pct: 73, on_track: true, direction: "DECREASE" },
      { target_id: "target_2", label: "Water withdrawn", module_name: "Water", module_color: "#38bdf8", target_type: "INTENSITY", agg_field: "quantity", unit: "kL/unit", baseline_value: 4.2, baseline_fy_label: "FY 2025-26", target_value: 3.7, target_fy_label: "FY 2026-27", current_value: 4.05, current_fy_label: "FY 2026-27", delta_from_baseline: -0.15, delta_pct: -3.6, progress_pct: 30, on_track: false, direction: "DECREASE" },
    ],
  };
  if (path === "/targets") return demoTargets;
  if (path === "/derived-metrics") return [
    { metric_id: "dm_1", company_id: "cmp_demo_01", name: "Renewable energy share", unit: "%", description: "Renewable electricity as a share of total electricity", module_id: 1, formula: "(KPI:kpi_energy_2 / KPI:kpi_energy_1) * 100", show_in_report: true, display_order: 1, is_active: true },
  ];

  // Scope 3.
  if (path === "/scope3/dashboard") return { reporting_year: Number(params.reporting_year || 2026), total_emissions: 1040.9, upstream_emissions: 1040.9, downstream_emissions: 0, approved_batch_count: 1, pending_batch_count: 1, by_category: [{ category_id: 1, category_code: "C1", category_name: "Purchased goods and services", scope3_type: "UPSTREAM", emissions: 824.6 }, { category_id: 4, category_code: "C4", category_name: "Upstream transportation", scope3_type: "UPSTREAM", emissions: 216.3 }] };
  if (path === "/scope3/categories") return demoScope3Categories;
  if (path === "/scope3/factor-sets/library") return demoScope3Sets.filter((set) => set.is_system);
  if (path === "/scope3/factor-sets/company") return demoScope3Sets.filter((set) => !set.is_system);
  if (/^\/scope3\/factor-sets\/[^/]+\/items$/.test(path)) return [];
  if (path === "/scope3/assignments") return [];
  if (path === "/scope3/batches") {
    let rows = [...demoScope3Batches];
    if (params.status) rows = rows.filter((row) => row.status === params.status);
    return paginate(rows, params);
  }
  if (/^\/scope3\/batches\/[^/]+$/.test(path)) return demoScope3Batches.find((b) => b.batch_id === path.split("/")[3]) || demoScope3Batches[0];
  if (/^\/scope3\/batches\/[^/]+\/entries$/.test(path)) return paginate([], params);

  // Suppliers.
  if (path === "/suppliers/scorecard/summary") return { reporting_year: Number(params.reporting_year || 2026), total_emissions: 1040.9, supplier_count: 2, unlinked_count: 3, top_suppliers: [{ supplier_id: "supplier_1", supplier_name: "Atlas Steel Works", supplier_code: "SUP-001", sector_name: "Metals", risk_tier: "HIGH", is_critical: true, total_emissions: 824.6, total_spend: 12500000, entry_count: 28, category_count: 2, pct_of_total: 79.2 }, { supplier_id: "supplier_2", supplier_name: "BlueRoute Logistics", supplier_code: "SUP-002", sector_name: "Logistics", risk_tier: "MEDIUM", is_critical: false, total_emissions: 216.3, total_spend: 4200000, entry_count: 14, category_count: 1, pct_of_total: 20.8 }] };
  if (/^\/suppliers\/scorecard\/[^/]+$/.test(path)) {
    const supplier = demoSuppliers.find((s) => s.supplier_id === path.split("/")[3]) || demoSuppliers[0];
    return { supplier, total_emissions: 824.6, total_spend: 12500000, entry_count: 28, by_category: [{ category_id: 1, category_code: "C1", category_name: "Purchased goods and services", emissions: 720.4, spend: 11000000, entry_count: 22 }, { category_id: 4, category_code: "C4", category_name: "Upstream transportation", emissions: 104.2, spend: 1500000, entry_count: 6 }], trend: [{ month: 4, emissions: 248, spend: 3800000 }, { month: 5, emissions: 271, spend: 4100000 }, { month: 6, emissions: 305.6, spend: 4600000 }] };
  }
  if (path === "/suppliers") return demoSuppliers;
  if (/^\/suppliers\/[^/]+\/factors$/.test(path)) return [];
  if (/^\/suppliers\/[^/]+$/.test(path) && method === "GET") return demoSuppliers.find((s) => s.supplier_id === path.split("/")[2]) || demoSuppliers[0];
  if (path === "/suppliers/link-unlinked") return { linked_count: 3, message: "3 demo entries linked." };

  // Query, documents, support and lookup endpoints.
  if (path === "/query/suggestions") return demoQuery.suggestions;
  if (path === "/query/engine-info") return { engine: "RULE_BASED" };
  if (path === "/query") return { answer: demoQuery.answer, sources: [{ title: "FY 2026-27 approved ESG records", confidence: 0.94 }] };
  if (path === "/documents/explorer") return [];
  if (path.includes("/documents")) return [];
  if (path === "/support-tickets/pending-count") return { count: 1 };
  if (path === "/support-tickets") return demoSupportTickets;
  if (/^\/support-tickets\/[^/]+$/.test(path)) return demoSupportTickets[0];
  if (path === "/support-access/active-session") return null;
  if (path === "/support-access/requests") return [];
  if (path === "/vocab/disposal-methods") return [{ method_id: 1, key: "RECYCLED", label: "Recycled", display_order: 1, is_active: true }, { method_id: 2, key: "LANDFILL", label: "Landfill", display_order: 2, is_active: true }];
  if (path === "/vocab/input-types") return [{ input_type_id: 1, key: "numeric", label: "Numeric", widget_component: "number", has_uom: true, display_order: 1, is_active: true }];
  if (path === "/vocab/emission-scopes") return [1, 2, 3].map((scope) => ({ scope_number: scope, label: `Scope ${scope}`, color: scope === 1 ? "#ef4444" : scope === 2 ? "#f59e0b" : "#8b5cf6", display_order: scope, is_active: true }));
  if (path === "/library/catalog") {
    return demoIndicators.map((ind) => ({
      ...ind,
      input_type: "numeric" as const,
      kpis: demoKpis
        .filter((k) => k.indicator_id === ind.indicator_id)
        .map((k) => ({
          kpi_id: k.kpi_id,
          kpi_name: k.kpi_name,
          unit: k.unit,
          scope_number: k.scope_number,
          factor_count: 1,
        })),
    }));
  }
  if (path === "/library/factors") return [];
  if (path === "/library/pulled") return { indicator_ids: [], kpi_ids: [] };

  // Unmodelled writes still succeed locally; unmodelled reads return an empty
  // collection so every screen can render without contacting a backend.
  if (!isRead) return { ok: true, message: "Demo change saved for this session.", ...body };
  return [];
}
