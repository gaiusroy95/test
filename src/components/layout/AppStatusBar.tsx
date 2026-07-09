import { Link, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import { APP_NAME, APP_VERSION } from "@/lib/constants";
import { getNavPageLabel } from "@/lib/nav-utils";
import type { UserType } from "@/types";
import { cn } from "@/lib/utils";

interface AppStatusBarProps {
  portalType: UserType;
}

export function AppStatusBar({ portalType }: AppStatusBarProps) {
  const { pathname } = useLocation();
  const user = useAuthStore((s) => s.user);

  const portalLabel = portalType === "platform" ? "Platform Admin" : "Company Portal";
  const companyName = portalType === "tenant" ? user?.company_name : undefined;
  const pageLabel = getNavPageLabel(pathname, portalType);
  const year = new Date().getFullYear();

  return (
    <footer
      className="flex items-center gap-4 h-9 px-5 border-t border-border/80 bg-card/90 backdrop-blur-sm flex-shrink-0 z-10"
      aria-label="Application status"
    >
      <div className="flex items-center gap-1.5 min-w-0 flex-1 text-2xs text-muted-foreground">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-ok shrink-0" aria-hidden="true" />
        <span className="font-semibold text-foreground/80 shrink-0">{portalLabel}</span>
        {companyName && (
          <>
            <span className="text-border shrink-0" aria-hidden="true">·</span>
            <span className="truncate">{companyName}</span>
          </>
        )}
      </div>

      {pageLabel && (
        <div className="hidden lg:flex items-center gap-1.5 text-2xs text-muted-foreground truncate max-w-[280px]">
          <span className="text-border" aria-hidden="true">/</span>
          <span className="font-medium text-foreground/70 truncate">{pageLabel}</span>
        </div>
      )}

      <div className="flex items-center gap-3 shrink-0 text-2xs text-muted-foreground">
        {portalType === "tenant" && (
          <Link to="/app/help" className="hover:text-primary transition-colors whitespace-nowrap font-medium">
            Help
          </Link>
        )}
        <span className="hidden sm:inline whitespace-nowrap tabular-nums font-mono text-[10px]">
          {APP_NAME} v{APP_VERSION}
        </span>
        <span className="hidden md:inline text-border" aria-hidden="true">·</span>
        <span className="hidden md:inline whitespace-nowrap">© {year}</span>
      </div>
    </footer>
  );
}

export function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={cn(
        "flex-shrink-0 border-t border-sidebar-border bg-sunken/50",
        collapsed ? "px-2 py-2" : "px-4 py-2.5"
      )}
      aria-label="Sidebar footer"
    >
      {collapsed ? (
        <div className="text-center text-[9px] font-mono text-muted-foreground tabular-nums" title={`${APP_NAME} v${APP_VERSION}`}>
          v{APP_VERSION.split(".")[0]}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 min-w-0">
          <span className="text-2xs font-semibold text-muted-foreground tracking-wide truncate">
            {APP_NAME}
          </span>
          <span className="text-2xs font-mono text-muted-foreground/70 tabular-nums shrink-0">
            v{APP_VERSION}
          </span>
        </div>
      )}
    </div>
  );
}
