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
    id: "ticket_1",
    title: "Need help with Scope 3 upload",
    status: "OPEN",
    created_at: "2026-07-07T08:10:00Z",
    company_id: "cmp_demo_01",
  },
];

export const demoNotifications = [
  { id: "notif_1", type: "REMINDER", title: "Data entry due tomorrow", body: "Please submit June values in ESG Input.", created_at: "2026-07-07T10:30:00Z" },
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

export function getDemoResponse(url: string | undefined, method = "GET") {
  const normalized = (url || "").replace(/^\/+/, "");

  if (normalized.includes("/auth/login")) {
    return { data: { access_token: "demo-access-token", refresh_token: "demo-refresh-token", token_type: "bearer", user: DEMO_TENANT_USER } };
  }
  if (normalized.includes("/platform/auth/login")) {
    return { data: { access_token: "demo-platform-token", refresh_token: "demo-platform-refresh", token_type: "bearer", user: DEMO_PLATFORM_USER } };
  }
  if (normalized.includes("/auth/me") || normalized.includes("/platform/auth/me")) {
    return { data: { user: normalized.includes("platform") ? DEMO_PLATFORM_USER : DEMO_TENANT_USER } };
  }
  // Endpoints that return arrays directly (not paginated)
  if (normalized.includes("/modules") && !normalized.includes("/platform")) {
    return { data: demoModules };
  }
  if (normalized.includes("/features")) {
    return { data: demoFeatures };
  }
  if (normalized.includes("/system/financial-years")) {
    return { data: demoFinancialYears };
  }
  if (normalized.includes("/system/months")) {
    return { data: demoMonths };
  }

  // Endpoints that return paginated responses
  if (normalized.includes("/platform/companies") || normalized.includes("/companies")) {
    return { data: makePaginated([demoCompany]) };
  }
  if (normalized.includes("/users")) {
    return { data: makePaginated(demoUsers) };
  }
  if (normalized.includes("/locations")) {
    return { data: makePaginated(demoLocations) };
  }
  if (normalized.includes("/system/indicators")) {
    return { data: makePaginated(demoIndicators) };
  }
  if (normalized.includes("/platform/audit-log")) {
    return { data: makePaginated(demoAuditLog) };
  }
  if (normalized.includes("/platform/support-tickets")) {
    return { data: makePaginated(demoSupportTickets) };
  }
  if (normalized.includes("/notifications")) {
    return { data: makePaginated(demoNotifications) };
  }
  if (normalized.includes("/reports")) {
    return { data: makePaginated(demoReports) };
  }
  if (normalized.includes("/query")) {
    return { data: demoQuery };
  }
  if (normalized.includes("/platform/admins")) {
    return { data: makePaginated(demoPlatformAdmins) };
  }
  if (normalized.includes("/platform/plans")) {
    return { data: makePaginated(demoPlans) };
  }
  if (normalized.includes("/dashboard") || normalized.includes("/overview")) {
    return { data: makePaginated(demoDashboardCards) };
  }

  if (method !== "GET" && method !== "HEAD") {
    return { data: { ok: true, message: "Demo save succeeded." } };
  }

  return { data: [] };
}
