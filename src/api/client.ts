import axios from "axios";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";
import { getDemoResponse } from "@/lib/demoData";

const API = import.meta.env.VITE_API_URL || "/api/v1";
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

const api = axios.create({ baseURL: API, headers: { "Content-Type": "application/json" } });

api.interceptors.request.use((config) => {
  if (DEMO_MODE) {
    const resp = getDemoResponse(config.url, config.method?.toUpperCase());
    const fakeResponse = {
      // If demo helper already returns an object with `data`, unwrap it so
      // callers receive the same shape as a real axios response.
      data: resp && typeof resp === "object" && "data" in resp ? (resp as any).data : resp,
      status: 200,
      statusText: "OK",
      headers: {},
      config,
    };
    return Promise.reject({
      __demo: true,
      config,
      response: fakeResponse,
    });
  }
  return config;
});

// Methods that mutate state — anything outside this set is a read.
const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// ── Request interceptor: attach token + block writes in support sessions ──
//
// The backend already returns 403 for any non-GET in support mode, but doing
// the check client-side too is defence-in-depth: it stops the request before
// it leaves the browser, surfaces a clear toast immediately, and — critically —
// makes new pages safe by default. A dev who builds a new page and forgets
// to gate writes with !useIsSupportSession() / <WriteOnly> still cannot leak
// a write in support mode; the worst-case UX is a button that toasts on
// click instead of mutating data.
api.interceptors.request.use((config) => {
  const { accessToken, supportSession } = useAuthStore.getState();
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;

  if (supportSession) {
    const method = (config.method || "get").toUpperCase();
    if (!READ_METHODS.has(method)) {
      toast.error("Read-only support session — write actions are not allowed.");
      // Throwing here makes axios reject the request without sending it.
      return Promise.reject(
        new axios.Cancel("Blocked: write attempted inside read-only support session."),
      );
    }
  }
  return config;
});

// ── Response interceptor: auto-refresh on 401 ──
let refreshing = false;
let queue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    // Cancelled requests (e.g. write blocked in support session) — propagate
    // silently so callers' catch blocks can no-op via axios.isCancel(err).
    if (axios.isCancel(error)) return Promise.reject(error);
    if (error?.__demo) return Promise.resolve(error.response);

    // Normalize FastAPI/Pydantic 422 errors: flatten array detail → string
    if (error.response?.data?.detail && Array.isArray(error.response.data.detail)) {
      error.response.data.detail = error.response.data.detail
        .map((e: any) => e?.msg ?? JSON.stringify(e))
        .join("; ");
    }

    const orig = error.config;
    if (error.response?.status !== 401 || orig._retry) {
      return Promise.reject(error);
    }
    // Don't intercept login endpoint errors — let the login page handle them directly
    if (orig.url?.includes("/auth/login")) return Promise.reject(error);

    const { refreshToken, userType, logout, updateTokens } = useAuthStore.getState();
    if (!refreshToken) { logout(); window.location.href = "/login"; return Promise.reject(error); }

    if (refreshing) {
      return new Promise((resolve, reject) => {
        queue.push({
          resolve: (token) => { orig.headers.Authorization = `Bearer ${token}`; resolve(api(orig)); },
          reject,
        });
      });
    }

    orig._retry = true;
    refreshing = true;
    try {
      const endpoint = userType === "platform" ? "/platform/auth/refresh" : "/auth/refresh";
      const { data } = await axios.post(`${API}${endpoint}`, { refresh_token: refreshToken });
      updateTokens(data.access_token, data.refresh_token);
      queue.forEach((p) => p.resolve(data.access_token));
      queue = [];
      orig.headers.Authorization = `Bearer ${data.access_token}`;
      return api(orig);
    } catch (err) {
      queue.forEach((p) => p.reject(err));
      queue = [];
      logout();
      window.location.href = "/login";
      return Promise.reject(err);
    } finally {
      refreshing = false;
    }
  }
);

export default api;

// ═══════════════════════════════════════════════════════════════════════
// AUTH API
// ═══════════════════════════════════════════════════════════════════════
export const authApi = {
  // Tenant
  tenantLogin:   (email: string, password: string) => api.post("/auth/login", { email, password }),
  tenantRefresh: (refresh_token: string) => api.post("/auth/refresh", { refresh_token }),
  tenantMe:      () => api.get("/auth/me"),
  changePassword: (current_password: string, new_password: string) =>
    api.post("/auth/change-password", { current_password, new_password }),
  tenantLogout: (refresh_token?: string) =>
    api.post("/auth/logout", refresh_token ? { refresh_token } : {}),
  // GDPR
  recordConsent: (version: string) => api.post("/auth/consent", { version }),
  getMyData:     () => api.get("/auth/my-data"),
  // Platform
  platformLogin:   (email: string, password: string) => api.post("/platform/auth/login", { email, password }),
  platformRefresh: (refresh_token: string) => api.post("/platform/auth/refresh", { refresh_token }),
  platformMe:      () => api.get("/platform/auth/me"),
  platformLogout: (refresh_token?: string) =>
    api.post("/platform/auth/logout", refresh_token ? { refresh_token } : {}),
};

// ═══════════════════════════════════════════════════════════════════════
// PLATFORM API
// ═══════════════════════════════════════════════════════════════════════
export const platformApi = {
  // Companies
  listCompanies:  (params?: Record<string, unknown>) => api.get("/platform/companies", { params }),
  getCompany:     (id: string) => api.get(`/platform/companies/${id}`),
  createCompany:  (data: Record<string, unknown>) => api.post("/platform/companies", data),
  updateCompany:  (id: string, data: Record<string, unknown>) => api.patch(`/platform/companies/${id}`, data),
  suspendCompany: (id: string, reason?: string) => api.post(`/platform/companies/${id}/suspend`, { reason }),
  blockCompany:   (id: string, reason?: string) => api.post(`/platform/companies/${id}/block`, { reason }),
  unblockCompany: (id: string, reason?: string) => api.post(`/platform/companies/${id}/unblock`, { reason }),
  deleteCompany:  (id: string) => api.delete(`/platform/companies/${id}`),
  changePlan:        (id: string, new_plan_id: number) => api.post(`/platform/companies/${id}/change-plan`, { new_plan_id }),
  setQueryEngine:    (id: string, engine: string) => api.post(`/platform/companies/${id}/set-query-engine`, { engine }),
  createCompanyAdmin: (id: string, data: Record<string, unknown>) => api.post(`/platform/companies/${id}/create-admin`, data),

  // Plans
  listPlans:   () => api.get("/platform/plans"),
  createPlan:  (data: Record<string, unknown>) => api.post("/platform/plans", data),
  updatePlan:  (id: number, data: Record<string, unknown>) => api.patch(`/platform/plans/${id}`, data),

  // Admins
  listAdmins:   () => api.get("/platform/admins"),
  createAdmin:  (data: Record<string, unknown>) => api.post("/platform/admins", data),
  getAdmin:     (id: string) => api.get(`/platform/admins/${id}`),
  updateAdmin:  (id: string, data: Record<string, unknown>) => api.patch(`/platform/admins/${id}`, data),
  blockAdmin:   (id: string, reason?: string) => api.post(`/platform/admins/${id}/block`, { reason }),
  unblockAdmin: (id: string, reason?: string) => api.post(`/platform/admins/${id}/unblock`, { reason }),

  // System Config
  listModules:     () => api.get("/platform/system/modules"),
  createModule:    (data: Record<string, unknown>) => api.post("/platform/system/modules", data),
  updateModule:    (id: number, data: Record<string, unknown>) => api.patch(`/platform/system/modules/${id}`, data),
  deleteModule:    (id: number) => api.delete(`/platform/system/modules/${id}`),
  listFYs:         () => api.get("/platform/system/financial-years"),
  createFY:        (data: Record<string, unknown>) => api.post("/platform/system/financial-years", data),
  updateFY:        (id: number, data: Record<string, unknown>) => api.patch(`/platform/system/financial-years/${id}`, data),
  listMonths:      () => api.get("/platform/system/months"),
  listSystemIndicators: (params?: Record<string, unknown>) => api.get("/platform/system/indicators", { params }),
  createSystemIndicator: (data: Record<string, unknown>) => api.post("/platform/system/indicators", data),
  updateSystemIndicator: (id: number, data: Record<string, unknown>) => api.patch(`/platform/system/indicators/${id}`, data),

  // Company Module Assignment
  listCompanyModuleAssignments: (companyId: string) => api.get(`/platform/system/companies/${companyId}/modules`),
  setCompanyModule: (companyId: string, moduleId: number, isActive: boolean) =>
    api.put(`/platform/system/companies/${companyId}/modules/${moduleId}`, null, { params: { is_active: isActive } }),
  changeModuleLifecycle: (moduleId: number, lifecycle_status: string, reason?: string) =>
    api.post(`/platform/system/modules/${moduleId}/lifecycle`, { lifecycle_status, reason }),
  bulkRevokeModule: (moduleId: number, reason?: string) =>
    api.post(`/platform/system/modules/${moduleId}/bulk-revoke`, { reason }),

  // App Features (bespoke capabilities)
  listAppFeatures:    () => api.get("/platform/system/features"),
  updateAppFeature:   (id: number, data: Record<string, unknown>) => api.patch(`/platform/system/features/${id}`, data),
  changeFeatureLifecycle: (featureId: number, lifecycle_status: string, reason?: string) =>
    api.post(`/platform/system/features/${featureId}/lifecycle`, { lifecycle_status, reason }),
  bulkRevokeFeature:  (featureId: number, reason?: string) =>
    api.post(`/platform/system/features/${featureId}/bulk-revoke`, { reason }),
  listCompanyFeatureAssignments: (companyId: string) => api.get(`/platform/system/companies/${companyId}/features`),
  setCompanyFeature:  (companyId: string, featureId: number, isActive: boolean) =>
    api.put(`/platform/system/companies/${companyId}/features/${featureId}`, null, { params: { is_active: isActive } }),

  // Plan Capabilities (modules + features per plan)
  listPlanModules:        (planId: number) => api.get(`/platform/plans/${planId}/modules`),
  listPlanAppFeatures:    (planId: number) => api.get(`/platform/plans/${planId}/app-features`),
  setPlanCapabilities:    (planId: number, module_ids: number[], feature_ids: number[]) =>
    api.put(`/platform/plans/${planId}/capabilities`, { module_ids, feature_ids }),

  // Audit Log
  listAuditLog: (params?: Record<string, unknown>) => api.get("/platform/audit-log", { params }),

  // Scope 3 factor management (Platform Owner only)
  listPlatformScope3Categories: () => api.get("/platform/scope3/categories"),
  listPlatformScope3FactorSets: () => api.get("/platform/scope3/factor-sets"),
  createPlatformScope3FactorSet: (data: Record<string, unknown>) => api.post("/platform/scope3/factor-sets", data),
  updatePlatformScope3FactorSet: (id: string, data: Record<string, unknown>) => api.patch(`/platform/scope3/factor-sets/${id}`, data),
  listPlatformScope3FactorItems: (factorSetId: string, ghgCategoryId?: number) =>
    api.get(`/platform/scope3/factor-sets/${factorSetId}/items`, { params: ghgCategoryId ? { ghg_category_id: ghgCategoryId } : {} }),
  importPlatformScope3FactorItems: (factorSetId: string, ghgCategoryId: number, file: File) => {
    const fd = new FormData(); fd.append("file", file);
    return api.post(`/platform/scope3/factor-sets/${factorSetId}/items/import`, fd, {
      params: { ghg_category_id: ghgCategoryId },
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  downloadFactorItemTemplate: (factorSetId: string) =>
    api.get(`/platform/scope3/factor-sets/${factorSetId}/items/template`, { responseType: "blob" }),
  createPlatformScope3FactorItem: (factorSetId: string, data: Record<string, unknown>) =>
    api.post(`/platform/scope3/factor-sets/${factorSetId}/items`, data),
  updatePlatformScope3FactorItem: (factorSetId: string, itemId: string, data: Record<string, unknown>) =>
    api.patch(`/platform/scope3/factor-sets/${factorSetId}/items/${itemId}`, data),
  deletePlatformScope3FactorItem: (factorSetId: string, itemId: string) =>
    api.delete(`/platform/scope3/factor-sets/${factorSetId}/items/${itemId}`),

  // UOM Master
  listUOMs:   (category?: string) => api.get("/platform/system/uoms", { params: category ? { category } : {} }),
  createUOM:  (data: Record<string, unknown>) => api.post("/platform/system/uoms", data),
  updateUOM:  (id: number, data: Record<string, unknown>) => api.patch(`/platform/system/uoms/${id}`, data),

  // Plan Features (Phase 3 — generic plan_features junction)
  listFeatureKeys:    () => api.get("/platform/plans/feature-keys"),
  listPlanFeatures:   (planId: number) => api.get(`/platform/plans/${planId}/features`),
  upsertPlanFeatures: (planId: number, rows: { feature_key: string; quota: number }[]) =>
    api.put(`/platform/plans/${planId}/features`, rows),

  // Vocabularies (Platform Owner CRUD)
  listDisposalMethods:   () => api.get("/platform/vocab/disposal-methods"),
  createDisposalMethod:  (data: Record<string, unknown>) => api.post("/platform/vocab/disposal-methods", data),
  updateDisposalMethod:  (id: number, data: Record<string, unknown>) => api.patch(`/platform/vocab/disposal-methods/${id}`, data),
  listInputTypes:        () => api.get("/platform/vocab/input-types"),
  createInputType:       (data: Record<string, unknown>) => api.post("/platform/vocab/input-types", data),
  updateInputType:       (id: number, data: Record<string, unknown>) => api.patch(`/platform/vocab/input-types/${id}`, data),
  listEmissionScopes:    () => api.get("/platform/vocab/emission-scopes"),
  createEmissionScope:   (data: Record<string, unknown>) => api.post("/platform/vocab/emission-scopes", data),
  updateEmissionScope:   (scopeNum: number, data: Record<string, unknown>) => api.patch(`/platform/vocab/emission-scopes/${scopeNum}`, data),

  // Platform Catalog — master KPIs + conversion factors for tenant pull
  listCatalogKPIs:     (params?: Record<string, unknown>) => api.get("/platform/catalog/kpis", { params }),
  createCatalogKPI:    (data: Record<string, unknown>) => api.post("/platform/catalog/kpis", data),
  updateCatalogKPI:    (id: string, data: Record<string, unknown>) => api.patch(`/platform/catalog/kpis/${id}`, data),
  listCatalogFactors:  (kpiId: string) => api.get(`/platform/catalog/kpis/${kpiId}/factors`),
  addCatalogFactor:    (kpiId: string, data: Record<string, unknown>) => api.post(`/platform/catalog/kpis/${kpiId}/factors`, data),
  updateCatalogFactor: (factorId: number, data: Record<string, unknown>) => api.patch(`/platform/catalog/factors/${factorId}`, data),

  // Support Access (read-only tenant impersonation with explicit consent)
  createSupportAccessRequest: (data: { company_id: string; reason: string; duration_hours?: number }) =>
    api.post("/platform/support-access", data),
  listSupportAccessRequests: (status?: string) =>
    api.get("/platform/support-access", { params: status ? { status } : {} }),
  activateSupportAccess: (requestId: string) =>
    api.post(`/platform/support-access/${requestId}/activate`),
  cancelSupportAccess: (requestId: string, revoke_reason?: string) =>
    api.post(`/platform/support-access/${requestId}/revoke`, { revoke_reason }),

  // Support Tickets (in-app helpdesk — platform inbox)
  listPlatformTickets: (params?: { status?: string; company_id?: string }) =>
    api.get("/platform/support-tickets", { params }),
  pendingPlatformTicketCount: () => api.get("/platform/support-tickets/pending-count"),
  getPlatformTicket:   (id: string) => api.get(`/platform/support-tickets/${id}`),
  replyPlatformTicket: (id: string, body: string) =>
    api.post(`/platform/support-tickets/${id}/reply`, { body }),
  closePlatformTicket: (id: string) => api.post(`/platform/support-tickets/${id}/close`),
};

// ═══════════════════════════════════════════════════════════════════════
// TENANT API
// ═══════════════════════════════════════════════════════════════════════
export const tenantApi = {
  // Users
  listUsers:    (params?: Record<string, unknown>) => api.get("/users", { params }),
  getUser:      (id: string) => api.get(`/users/${id}`),
  createUser:   (data: Record<string, unknown>) => api.post("/users", data),
  updateUser:   (id: string, data: Record<string, unknown>) => api.patch(`/users/${id}`, data),
  deleteUser:   (id: string) => api.delete(`/users/${id}`),
  eraseUser:    (id: string) => api.post(`/users/${id}/erase`),
  assignUserModules: (userId: string, moduleIds: number[]) =>
    api.put(`/users/${userId}/modules`, { module_ids: moduleIds }),
  assignUserLocations: (userId: string, locationIds: string[]) =>
    api.put(`/users/${userId}/locations`, { location_ids: locationIds }),

  // Compliance / Audit log
  listTenantAuditLog: (params?: Record<string, unknown>) => api.get("/compliance/audit-log", { params }),

  // Modules (company-assigned, metadata-driven)
  listCompanyModules: () => api.get("/modules"),
  // Features (bespoke capabilities — Scope 3, BRSR, Targets, etc.)
  listCompanyFeatures: () => api.get("/features"),

  // Locations
  listLocations:  (params?: Record<string, unknown>) => api.get("/locations", { params }),
  getLocation:    (id: string) => api.get(`/locations/${id}`),
  createLocation: (data: Record<string, unknown>) => api.post("/locations", data),
  updateLocation: (id: string, data: Record<string, unknown>) => api.patch(`/locations/${id}`, data),
  deleteLocation: (id: string) => api.delete(`/locations/${id}`),

  // Location LB Factors
  listLocationLbFactors:  (locationId: string) => api.get(`/locations/${locationId}/lb-factors`),
  listScopedKpis:         (locationId: string) => api.get(`/locations/${locationId}/scoped-kpis`),
  addLocationLbFactor:    (locationId: string, data: Record<string, unknown>) => api.post(`/locations/${locationId}/lb-factors`, data),
  updateLocationLbFactor: (lbFactorId: number, data: Record<string, unknown>) => api.patch(`/locations/lb-factors/${lbFactorId}`, data),
  deleteLocationLbFactor: (lbFactorId: number) => api.delete(`/locations/lb-factors/${lbFactorId}`),
  recalculateLbForLocation: (locationId: string) => api.post(`/locations/${locationId}/lb-factors/recalculate`),

  // Indicators
  listIndicators:  (params?: Record<string, unknown>) => api.get("/indicators", { params }),
  createIndicator:  (data: Record<string, unknown>) => api.post("/indicators", data),
  updateIndicator:  (id: number, data: Record<string, unknown>) => api.patch(`/indicators/${id}`, data),

  // KPIs
  listKPIs:          (params?: Record<string, unknown>) => api.get("/kpis", { params }),
  getKPI:            (id: string) => api.get(`/kpis/${id}`),
  createKPI:         (data: Record<string, unknown>) => api.post("/kpis", data),
  updateKPI:         (id: string, data: Record<string, unknown>) => api.patch(`/kpis/${id}`, data),
  deleteKPI:         (id: string) => api.delete(`/kpis/${id}`),
  listFactors:       (kpiId: string) => api.get(`/kpis/${kpiId}/conversion-factors`),
  addFactor:         (kpiId: string, data: Record<string, unknown>) => api.post(`/kpis/${kpiId}/conversion-factors`, data),
  updateFactor:      (factorId: number, data: Record<string, unknown>) => api.patch(`/kpis/conversion-factors/${factorId}`, data),
  getFactorAffectedCount: (factorId: number) => api.get(`/kpis/conversion-factors/${factorId}/affected-count`),
  recalculateFactor: (factorId: number) => api.post(`/kpis/conversion-factors/${factorId}/recalculate`),

  // Reporting Years
  listReportingYears: () => api.get("/reporting-years"),
  listAvailableFYs: () => api.get("/reporting-years/financial-years"),
  assignReportingYear: (data: Record<string, unknown>) => api.post("/reporting-years", data),
  getPeriods:          (yearId: number) => api.get(`/reporting-years/${yearId}/periods`),
  lockPeriod:          (yearId: number, monthId: number) => api.post(`/reporting-years/${yearId}/periods/${monthId}/lock`),
  unlockPeriod:        (yearId: number, monthId: number) => api.post(`/reporting-years/${yearId}/periods/${monthId}/unlock`),

  // ESG Input (read-only — writes go through submissions)
  listESGInputs:     (params?: Record<string, unknown>) => api.get("/esg-input", { params }),
  getESGInput:       (id: string) => api.get(`/esg-input/${id}`),
  copyPreviousYear:  (year_id: number, location_id: string) =>
    api.get("/esg-input/copy-previous-year", { params: { year_id, location_id } }),
  downloadBrsrReport: (year_id: number) =>
    api.get("/reports/brsr", { params: { year_id }, responseType: "blob" }),

  // Submissions
  getOrCreateSubmission: (locationId: string, yearId: number, monthId: number) =>
    api.post("/submissions", { location_id: locationId, year_id: yearId, month_id: monthId }),
  listSubmissions: (params?: Record<string, unknown>) => api.get("/submissions", { params }),
  getSubmission: (id: string) => api.get(`/submissions/${id}`),
  getPreviousValues: (id: string) => api.get(`/submissions/${id}/previous-values`),
  getPreviousValuesByPeriod: (locationId: string, yearId: number, monthId: number) =>
    api.get(`/submissions/previous-values`, { params: { location_id: locationId, year_id: yearId, month_id: monthId } }),
  saveKPIValues: (id: string, kpiValues: Array<{ kpi_id?: string; indicator_id?: number; quantity: number | null; text_value?: string | null; notes?: string | null }>) =>
    api.post(`/submissions/${id}/save`, { kpi_values: kpiValues }),
  submitForReview: (id: string) => api.post(`/submissions/${id}/submit`),
  approveSubmission: (id: string, notes?: string) => api.post(`/submissions/${id}/approve`, { notes }),
  rejectSubmission: (id: string, notes: string) => api.post(`/submissions/${id}/reject`, { notes }),
  listLocationSubmissions: (locationId: string, yearId?: number) =>
    api.get(`/submissions/by-location/${locationId}`, { params: yearId ? { year_id: yearId } : {} }),

  // Legacy review (comment history only)
  getComments:  (id: string) => api.get(`/review/${id}/comments`),

  // Financial years and months (for submission period selector)
  listYears: () => api.get("/reporting-years/financial-years"),
  listMonths: () => api.get("/reporting-years/months"),

  // Documents (updated to use submission_id)
  uploadDocument: (submissionId: string, file: File) => {
    const fd = new FormData(); fd.append("file", file);
    return api.post(`/documents/submissions/${submissionId}/documents`, fd, { headers: { "Content-Type": "multipart/form-data" } });
  },
  listDocuments:    (submissionId: string) => api.get(`/documents/submissions/${submissionId}/documents`),
  downloadDocument: (docId: string) => api.get(`/documents/${docId}/download`, { responseType: "blob" }),
  deleteDocument:   (docId: string) => api.delete(`/documents/${docId}`),
  uploadRecordDocument: (recordId: string, file: File) => {
    const fd = new FormData(); fd.append("file", file);
    return api.post(`/documents/records/${recordId}/documents`, fd, { headers: { "Content-Type": "multipart/form-data" } });
  },
  listRecordDocuments: (recordId: string) => api.get(`/documents/records/${recordId}/documents`),

  // Document Explorer
  exploreDocuments: (params?: Record<string, unknown>) =>
    api.get("/documents/explorer", { params }),
  bulkDownloadDocuments: (documentIds: string[]) =>
    api.post("/documents/explorer/bulk-download", { document_ids: documentIds }, { responseType: "blob" }),

  // Query Engine
  askQuery: (question: string, context?: string) => api.post("/query", { question, context: context || "" }),
  getQuerySuggestions: () => api.get("/query/suggestions"),
  getQueryEngineInfo: () => api.get("/query/engine-info"),

  // Notifications
  listNotifications: (params?: Record<string, unknown>) => api.get("/notifications", { params }),
  unreadCount:       () => api.get("/notifications/unread-count"),
  markRead:          (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead:       () => api.post("/notifications/mark-all-read"),

  // Settings
  listSettings:  () => api.get("/settings"),
  getSetting:    (key: string) => api.get(`/settings/${key}`),
  upsertSetting: (key: string, setting_value: string) => api.put(`/settings/${key}`, { setting_value }),
  deleteSetting: (key: string) => api.delete(`/settings/${key}`),

  // Derived Metrics
  listDerivedMetrics:   ()                              => api.get("/derived-metrics"),
  createDerivedMetric:  (body: Record<string, unknown>) => api.post("/derived-metrics", body),
  getDerivedMetric:     (id: string)                    => api.get(`/derived-metrics/${id}`),
  updateDerivedMetric:  (id: string, body: Record<string, unknown>) => api.patch(`/derived-metrics/${id}`, body),
  deleteDerivedMetric:  (id: string)                    => api.delete(`/derived-metrics/${id}`),

  // Waste Disposal Breakdown
  getWasteDisposalBySubmission: (submissionId: string) =>
    api.get(`/waste-disposal/submission/${submissionId}`),
  listWasteDisposals: (params?: Record<string, unknown>) =>
    api.get("/waste-disposal", { params }),
  upsertWasteDisposal: (recordId: string, items: { method: string; quantity: number; notes?: string | null }[]) =>
    api.put(`/waste-disposal/${recordId}`, items),

  // Scope 3 — Categories & Factor Sets
  listScope3Categories: () => api.get("/scope3/categories"),
  listScope3LibrarySets: () => api.get("/scope3/factor-sets/library"),
  listScope3CompanySets: () => api.get("/scope3/factor-sets/company"),
  pullScope3FactorSet: (body: { source_set_id: string; set_name?: string }) =>
    api.post("/scope3/factor-sets/pull", body),
  listScope3FactorItems: (factorSetId: string, params?: Record<string, unknown>) =>
    api.get(`/scope3/factor-sets/${factorSetId}/items`, { params }),
  createScope3CompanyFactorSet: (data: Record<string, unknown>) => api.post("/scope3/factor-sets", data),
  updateScope3CompanyFactorSet: (id: string, data: Record<string, unknown>) => api.patch(`/scope3/factor-sets/${id}`, data),
  createScope3FactorItem: (factorSetId: string, data: Record<string, unknown>) =>
    api.post(`/scope3/factor-sets/${factorSetId}/items`, data),
  updateScope3FactorItem: (factorSetId: string, itemId: string, data: Record<string, unknown>) =>
    api.patch(`/scope3/factor-sets/${factorSetId}/items/${itemId}`, data),
  deleteScope3FactorItem: (factorSetId: string, itemId: string) =>
    api.delete(`/scope3/factor-sets/${factorSetId}/items/${itemId}`),

  // Scope 3 — Assignments
  listScope3Assignments: () => api.get("/scope3/assignments"),
  createScope3Assignment: (data: Record<string, unknown>) => api.post("/scope3/assignments", data),
  updateScope3Assignment: (id: string, data: Record<string, unknown>) => api.patch(`/scope3/assignments/${id}`, data),
  deleteScope3Assignment: (id: string) => api.delete(`/scope3/assignments/${id}`),

  // Scope 3 — Dashboard
  scope3Dashboard: (reportingYear: number) =>
    api.get("/scope3/dashboard", { params: { reporting_year: reportingYear } }),
  downloadScope3Template: (params?: { factor_set_id?: string; ghg_category_id?: number }) =>
    api.get("/scope3/template", { params, responseType: "blob" }),

  // Scope 3 — Batches
  createScope3Batch: (body: Record<string, unknown>) => api.post("/scope3/batches", body),
  getOrCreateScope3Batch: (body: Record<string, unknown>) => api.post("/scope3/batches/by-period", body),
  listScope3Batches: (params?: Record<string, unknown>) => api.get("/scope3/batches", { params }),
  getScope3Batch: (batchId: string) => api.get(`/scope3/batches/${batchId}`),
  deleteScope3Batch: (batchId: string) => api.delete(`/scope3/batches/${batchId}`),
  uploadScope3CSV: (batchId: string, file: File) => {
    const fd = new FormData(); fd.append("file", file);
    return api.post(`/scope3/batches/${batchId}/upload`, fd, { headers: { "Content-Type": "multipart/form-data" } });
  },

  // Scope 3 — Entries (form-based + list)
  addScope3Entry: (batchId: string, body: Record<string, unknown>) =>
    api.post(`/scope3/batches/${batchId}/entries`, body),
  bulkUpsertScope3Entries: (batchId: string, entries: Record<string, unknown>[]) =>
    api.put(`/scope3/batches/${batchId}/entries/bulk`, entries),
  deleteScope3Entry: (batchId: string, entryId: string) =>
    api.delete(`/scope3/batches/${batchId}/entries/${entryId}`),
  listScope3Entries: (batchId: string, params?: Record<string, unknown>) =>
    api.get(`/scope3/batches/${batchId}/entries`, { params }),

  // Scope 3 — Category 3 auto-compute from Scope 1/2 approved data
  autoComputeC3: (batchId: string, replace_existing = true) =>
    api.post(`/scope3/batches/${batchId}/auto-compute-c3`, null, { params: { replace_existing } }),

  // Scope 3 — Workflow
  submitScope3Batch: (batchId: string) => api.post(`/scope3/batches/${batchId}/submit`),
  reviewScope3Batch: (batchId: string, body: { action: string; rejection_reason?: string }) =>
    api.post(`/scope3/batches/${batchId}/review`, body),

  // Scope 3 — Supporting Documents
  uploadScope3BatchDocument: (batchId: string, file: File) => {
    const fd = new FormData(); fd.append("file", file);
    return api.post(`/scope3/batches/${batchId}/documents`, fd, { headers: { "Content-Type": "multipart/form-data" } });
  },
  listScope3BatchDocuments: (batchId: string) => api.get(`/scope3/batches/${batchId}/documents`),
  uploadScope3EntryDocument: (entryId: string, file: File) => {
    const fd = new FormData(); fd.append("file", file);
    return api.post(`/scope3/entries/${entryId}/documents`, fd, { headers: { "Content-Type": "multipart/form-data" } });
  },
  listScope3EntryDocuments: (entryId: string) => api.get(`/scope3/entries/${entryId}/documents`),

  // ── Suppliers ────────────────────────────────────────────────────────────
  listSuppliers: (params?: Record<string, unknown>) => api.get("/suppliers", { params }),
  getSupplier: (id: string) => api.get(`/suppliers/${id}`),
  createSupplier: (data: Record<string, unknown>) => api.post("/suppliers", data),
  updateSupplier: (id: string, data: Record<string, unknown>) => api.patch(`/suppliers/${id}`, data),
  deleteSupplier: (id: string) => api.delete(`/suppliers/${id}`),
  supplierScorecardSummary: (reportingYear: number) =>
    api.get("/suppliers/scorecard/summary", { params: { reporting_year: reportingYear } }),
  supplierScorecardDetail: (supplierId: string, reportingYear: number) =>
    api.get(`/suppliers/scorecard/${supplierId}`, { params: { reporting_year: reportingYear } }),
  linkUnlinkedSuppliers: () => api.post("/suppliers/link-unlinked"),

  // ── Supplier Emission Factors ─────────────────────────────────────────────
  listSupplierFactors: (supplierId: string, params?: Record<string, unknown>) =>
    api.get(`/suppliers/${supplierId}/factors`, { params }),
  createSupplierFactor: (supplierId: string, data: Record<string, unknown>) =>
    api.post(`/suppliers/${supplierId}/factors`, data),
  updateSupplierFactor: (factorId: string, data: Record<string, unknown>) =>
    api.patch(`/suppliers/factors/${factorId}`, data),
  deleteSupplierFactor: (factorId: string) =>
    api.delete(`/suppliers/factors/${factorId}`),

  // UOM Master (read-only for tenants)
  listUOMs: (category?: string) => api.get("/uoms", { params: category ? { category } : {} }),

  // ── KPI Targets ──────────────────────────────────────────────────────────
  listTargets:   (params?: Record<string, unknown>) => api.get("/targets", { params }),
  getTarget:     (id: string) => api.get(`/targets/${id}`),
  createTarget:  (data: Record<string, unknown>) => api.post("/targets", data),
  updateTarget:  (id: string, data: Record<string, unknown>) => api.patch(`/targets/${id}`, data),
  deleteTarget:  (id: string) => api.delete(`/targets/${id}`),
  targetProgress: (yearId?: number) =>
    api.get("/targets/progress", { params: yearId ? { year_id: yearId } : {} }),

  // ── Auditor Remarks ──────────────────────────────────────────────────────
  listRemarks:   (params?: Record<string, unknown>) => api.get("/auditor-remarks", { params }),
  getRemark:     (id: string) => api.get(`/auditor-remarks/${id}`),
  createRemark:  (data: Record<string, unknown>) => api.post("/auditor-remarks", data),
  updateRemark:  (id: string, data: Record<string, unknown>) => api.patch(`/auditor-remarks/${id}`, data),
  deleteRemark:  (id: string) => api.delete(`/auditor-remarks/${id}`),
  remarkSummary: () => api.get("/auditor-remarks/summary"),
  addRemarkResponse: (remarkId: string, response_text: string) =>
    api.post(`/auditor-remarks/${remarkId}/responses`, { response_text }),

  // ── ESG Library — browse catalog + pull into tenant rows ─────────────────
  browseCatalog:        (moduleId?: number) => api.get("/library/catalog", { params: moduleId ? { module_id: moduleId } : {} }),
  browseCatalogFactors: (moduleId?: number) => api.get("/library/factors",  { params: moduleId ? { module_id: moduleId } : {} }),
  listPulledCatalog:    () => api.get("/library/pulled"),
  pullFromCatalog:      (indicatorIds: number[]) => api.post("/library/pull", { indicator_ids: indicatorIds }),

  // ── Vocabularies (read-only lookup tables) ───────────────────────────────
  listDisposalMethods: () => api.get("/vocab/disposal-methods"),
  listInputTypes:      () => api.get("/vocab/input-types"),
  listEmissionScopes:  () => api.get("/vocab/emission-scopes"),

  // ── Support Access (Company Admin approve/deny + active session banner) ──
  getActiveSupportSession:    () => api.get("/support-access/active-session"),
  listSupportAccessRequests:  (status?: string) =>
    api.get("/support-access/requests", { params: status ? { status } : {} }),
  decideSupportAccessRequest: (requestId: string, decision: "APPROVED" | "DENIED", decision_reason?: string) =>
    api.post(`/support-access/requests/${requestId}/decide`, { decision, decision_reason }),
  revokeSupportAccessRequest: (requestId: string, revoke_reason?: string) =>
    api.post(`/support-access/requests/${requestId}/revoke`, { revoke_reason }),

  // ── Support Tickets (in-app helpdesk, tenant side) ───────────────────────
  listMyTickets:        (status?: string) =>
    api.get("/support-tickets", { params: status ? { status } : {} }),
  pendingTicketCount:   () => api.get("/support-tickets/pending-count"),
  getTicket:            (id: string) => api.get(`/support-tickets/${id}`),
  createTicket:         (data: { subject: string; body: string; priority?: "LOW" | "NORMAL" | "HIGH" }) =>
    api.post("/support-tickets", data),
  replyTicket:          (id: string, body: string) =>
    api.post(`/support-tickets/${id}/reply`, { body }),
  closeTicket:          (id: string) => api.post(`/support-tickets/${id}/close`),
};
