import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { RequirePlatform, RequireTenant } from "@/components/shared/RequireAuth";
import { PlatformLayout, TenantLayout } from "@/components/layout/Layouts";

// Auth — small, load eagerly
import LoginPage from "@/pages/auth/LoginPage";

// Platform pages — lazy loaded
const PlatformDashboard    = lazy(() => import("@/pages/platform/PlatformDashboard"));
const CompanyManagement    = lazy(() => import("@/pages/platform/CompanyManagement"));
const SystemConfigPage     = lazy(() => import("@/pages/platform/SystemConfigPage"));
const AdminManagementPage  = lazy(() => import("@/pages/platform/AdminManagementPage"));
const AuditLogPage         = lazy(() => import("@/pages/platform/AuditLogPage"));
const PlatformScope3Page   = lazy(() => import("@/pages/platform/PlatformScope3Page"));
const CapabilityCatalogPage = lazy(() => import("@/pages/platform/CapabilityCatalogPage"));
const PlatformSupportTicketsPage = lazy(() => import("@/pages/platform/PlatformSupportTicketsPage"));

// Tenant pages — lazy loaded
const TenantDashboard       = lazy(() => import("@/pages/app/TenantDashboard"));
const UserManagementPage    = lazy(() => import("@/pages/app/UserManagementPage"));
const LocationsPage         = lazy(() => import("@/pages/app/LocationsPage"));
const KPISetupPage          = lazy(() => import("@/pages/app/KPISetupPage"));
const IndicatorsPage        = lazy(() => import("@/pages/app/IndicatorsPage"));
const ReportingPage         = lazy(() => import("@/pages/app/ReportingPage"));
const ESGInputPage          = lazy(() => import("@/pages/app/ESGInputPage"));
const ReviewPage            = lazy(() => import("@/pages/app/ReviewPage"));
const DocumentExplorerPage  = lazy(() => import("@/pages/app/DocumentExplorerPage"));
const ReportsPage           = lazy(() => import("@/pages/app/ReportsPage"));
const QueryPage             = lazy(() => import("@/pages/app/QueryPage"));
const NotificationsPage     = lazy(() => import("@/pages/app/NotificationsPage"));
const SettingsPage          = lazy(() => import("@/pages/app/SettingsPage"));
const SupplierScorecardPage = lazy(() => import("@/pages/app/SupplierScorecardPage"));
const TargetsPage           = lazy(() => import("@/pages/app/TargetsPage"));
const AuditorRemarksPage    = lazy(() => import("@/pages/app/AuditorRemarksPage"));
const ESGLibraryPage        = lazy(() => import("@/pages/app/ESGLibraryPage"));
const HelpAndSupportPage    = lazy(() => import("@/pages/app/HelpAndSupportPage"));

// Minimal fallback shown during chunk load — just a blank white flash, no spinner
function PageLoading() {
  return <div className="flex-1 bg-white" />;
}

export default function App() {
  const { isAuthenticated, userType, user } = useAuthStore();

  const homeRedirect = () => {
    if (!isAuthenticated || !user) return "/login";
    const isPlatform = userType === "platform" || ["PLATFORM_OWNER", "PLATFORM_ADMIN"].includes(user.role);
    return isPlatform ? "/platform" : "/app";
  };

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to={homeRedirect()} replace /> : <LoginPage />} />

      {/* ═══ Platform Portal ═══ */}
      <Route element={<RequirePlatform />}>
        <Route element={<PlatformLayout />}>
          <Route path="/platform"            element={<Suspense fallback={<PageLoading />}><PlatformDashboard /></Suspense>} />
          <Route path="/platform/companies"  element={<Suspense fallback={<PageLoading />}><CompanyManagement /></Suspense>} />
          <Route path="/platform/scope3"     element={<Suspense fallback={<PageLoading />}><PlatformScope3Page /></Suspense>} />
          <Route path="/platform/system"     element={<Suspense fallback={<PageLoading />}><SystemConfigPage /></Suspense>} />
          <Route path="/platform/catalog"    element={<Suspense fallback={<PageLoading />}><CapabilityCatalogPage /></Suspense>} />
          <Route path="/platform/admins"     element={<Suspense fallback={<PageLoading />}><AdminManagementPage /></Suspense>} />
          <Route path="/platform/audit-log"  element={<Suspense fallback={<PageLoading />}><AuditLogPage /></Suspense>} />
          <Route path="/platform/tickets"    element={<Suspense fallback={<PageLoading />}><PlatformSupportTicketsPage /></Suspense>} />
        </Route>
      </Route>

      {/* ═══ Tenant Portal ═══ */}
      <Route element={<RequireTenant />}>
        <Route element={<TenantLayout />}>
          <Route path="/app"               element={<Suspense fallback={<PageLoading />}><TenantDashboard /></Suspense>} />
          <Route path="/app/users"         element={<Suspense fallback={<PageLoading />}><UserManagementPage /></Suspense>} />
          <Route path="/app/locations"     element={<Suspense fallback={<PageLoading />}><LocationsPage /></Suspense>} />
          <Route path="/app/kpi-setup"     element={<Suspense fallback={<PageLoading />}><KPISetupPage /></Suspense>} />
          <Route path="/app/indicators"    element={<Suspense fallback={<PageLoading />}><IndicatorsPage /></Suspense>} />
          <Route path="/app/library"       element={<Suspense fallback={<PageLoading />}><ESGLibraryPage /></Suspense>} />
          <Route path="/app/reporting"     element={<Suspense fallback={<PageLoading />}><ReportingPage /></Suspense>} />
          <Route path="/app/esg-input"     element={<Suspense fallback={<PageLoading />}><ESGInputPage /></Suspense>} />
          <Route path="/app/review"        element={<Suspense fallback={<PageLoading />}><ReviewPage /></Suspense>} />
          <Route path="/app/documents"     element={<Suspense fallback={<PageLoading />}><DocumentExplorerPage /></Suspense>} />
          <Route path="/app/reports"       element={<Suspense fallback={<PageLoading />}><ReportsPage /></Suspense>} />
          <Route path="/app/query"         element={<Suspense fallback={<PageLoading />}><QueryPage /></Suspense>} />
          <Route path="/app/notifications" element={<Suspense fallback={<PageLoading />}><NotificationsPage /></Suspense>} />
          <Route path="/app/settings"      element={<Suspense fallback={<PageLoading />}><SettingsPage /></Suspense>} />
          <Route path="/app/suppliers"     element={<Suspense fallback={<PageLoading />}><SupplierScorecardPage /></Suspense>} />
          <Route path="/app/targets"       element={<Suspense fallback={<PageLoading />}><TargetsPage /></Suspense>} />
          <Route path="/app/auditor-remarks" element={<Suspense fallback={<PageLoading />}><AuditorRemarksPage /></Suspense>} />
          <Route path="/app/help"          element={<Suspense fallback={<PageLoading />}><HelpAndSupportPage /></Suspense>} />
          <Route path="/app/scope3/setup"  element={<Navigate to="/app/kpi-setup" replace />} />
          <Route path="/app/scope3"        element={<Navigate to="/app/kpi-setup" replace />} />
          <Route path="/app/scope3/data"   element={<Navigate to="/app/esg-input" replace />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={homeRedirect()} replace />} />
    </Routes>
  );
}
