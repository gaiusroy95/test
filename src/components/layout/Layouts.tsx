import { useState, useEffect, useCallback } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { UserMenu, usePendingTicketCount } from "./UserMenu";
import { AppStatusBar } from "./AppStatusBar";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { ConsentDialog } from "@/components/shared/ConsentDialog";
import { SupportSessionBanner } from "@/components/shared/SupportSessionBanner";
import { useModulesStore } from "@/store/modules";
import { useFeaturesStore } from "@/store/features";
import { useVocabulariesStore } from "@/store/vocabularies";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";

const LG_BREAKPOINT = 1024;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < LG_BREAKPOINT : false
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${LG_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };
    handler(mq);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isMobile;
}

interface AppShellProps {
  portalType: "platform" | "tenant";
  children?: React.ReactNode;
}

function AppShell({ portalType, children }: AppShellProps) {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  // Close mobile drawer on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobile && mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isMobile, mobileOpen]);

  const handleSetCollapsed = useCallback((v: boolean) => {
    if (isMobile) {
      setMobileOpen(!v); // on mobile, "collapsed" means closed
    } else {
      setCollapsed(v);
    }
  }, [isMobile]);

  const sidebarCollapsed = isMobile ? false : collapsed; // always expanded when shown as overlay
  const showDesktopSidebar = !isMobile;
  const showMobileDrawer = isMobile && mobileOpen;
  const pendingTicketCount = usePendingTicketCount(portalType);

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden w-full">
      {/* Skip to content */}
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      {showDesktopSidebar && (
        <Sidebar
          portalType={portalType}
          collapsed={sidebarCollapsed}
          setCollapsed={handleSetCollapsed}
        />
      )}

      {/* Mobile drawer overlay */}
      {showMobileDrawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 h-full animate-slide-in-left shadow-modal">
            <Sidebar
              portalType={portalType}
              collapsed={false}
              setCollapsed={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex items-center gap-3 h-14 px-5 glass-header flex-shrink-0 z-10">
          {isMobile && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="flex-shrink-0"
            >
              <Menu size={18} />
            </Button>
          )}
          <div className="flex-1 min-w-0" />
          <ThemeToggle />
          <UserMenu portalType={portalType} pendingTicketCount={pendingTicketCount} />
        </header>

        <main id="main-content" className="flex-1 overflow-y-auto workspace-canvas min-h-0">
          {children}
        </main>

        <AppStatusBar portalType={portalType} />
      </div>
    </div>
  );
}

export function PlatformLayout() {
  const { pathname } = useLocation();
  return (
    <div className="flex h-screen overflow-hidden bg-background flex-col">
      <div className="flex flex-1 overflow-hidden min-h-0">
        <AppShell portalType="platform">
          <div key={pathname} className="animate-page-in h-full">
            <Outlet />
          </div>
        </AppShell>
      </div>
    </div>
  );
}

export function TenantLayout() {
  const { pathname } = useLocation();
  const fetchModules = useModulesStore((s) => s.fetchModules);
  const modulesLoaded = useModulesStore((s) => s.loaded);
  const fetchFeatures = useFeaturesStore((s) => s.fetchFeatures);
  const featuresLoaded = useFeaturesStore((s) => s.loaded);
  const fetchVocabs = useVocabulariesStore((s) => s.fetchAll);
  const vocabsLoaded = useVocabulariesStore((s) => s.loaded);
  const supportSession = useAuthStore((s) => s.supportSession);
  const isSupportTab = !!supportSession;

  useEffect(() => {
    if (!modulesLoaded) fetchModules();
    if (!featuresLoaded) fetchFeatures();
    if (!vocabsLoaded) fetchVocabs();
  }, [modulesLoaded, fetchModules, featuresLoaded, fetchFeatures, vocabsLoaded, fetchVocabs]);

  return (
    <div className="flex h-screen overflow-hidden bg-background flex-col">
      <SupportSessionBanner />
      <div className="flex flex-1 overflow-hidden min-h-0">
        {!isSupportTab && <ConsentDialog />}
        <AppShell portalType="tenant">
          <div
            key={pathname}
            className={`animate-page-in h-full ${isSupportTab ? "support-readonly" : ""}`}
            aria-readonly={isSupportTab || undefined}
          >
            <Outlet />
          </div>
        </AppShell>
      </div>
    </div>
  );
}
