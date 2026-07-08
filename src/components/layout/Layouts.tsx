import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { ConsentDialog } from "@/components/shared/ConsentDialog";
import { SupportSessionBanner } from "@/components/shared/SupportSessionBanner";
import { useModulesStore } from "@/store/modules";
import { useFeaturesStore } from "@/store/features";
import { useVocabulariesStore } from "@/store/vocabularies";
import { useAuthStore } from "@/store/auth";

export function PlatformLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar portalType="platform" collapsed={collapsed} setCollapsed={setCollapsed} />
      <main className="flex-1 overflow-y-auto">
        <div key={pathname} className="animate-page-in h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function TenantLayout() {
  const [collapsed, setCollapsed] = useState(false);
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
    <div className="flex h-screen overflow-hidden bg-slate-50 flex-col">
      <SupportSessionBanner />
      <div className="flex flex-1 overflow-hidden">
        {!isSupportTab && <ConsentDialog />}
        <Sidebar portalType="tenant" collapsed={collapsed} setCollapsed={setCollapsed} />
        <main className="flex-1 overflow-y-auto">
          {/*
            In a support tab, wrap content in a non-interactive shell so writes
            cannot fire even if a button is missed. Backend is the source of truth
            (returns 403 for any non-GET) — this is just defence-in-depth UX.
            We allow the banner controls and any element marked data-support-allow
            to remain interactive.
          */}
          <div
            key={pathname}
            className={`animate-page-in h-full ${isSupportTab ? "support-readonly" : ""}`}
            aria-readonly={isSupportTab || undefined}
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
