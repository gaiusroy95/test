import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";

interface AppTopBarContextProps {
  portalType: "platform" | "tenant";
  className?: string;
}

/**
 * App header context only — company / portal.
 * Page titles live in PageShell (avoid duplicating the name here).
 */
export function AppTopBarContext({ portalType, className }: AppTopBarContextProps) {
  const user = useAuthStore((s) => s.user);

  const label =
    portalType === "platform"
      ? "Platform Admin"
      : user?.company_name || "Company Portal";

  const roleLabel =
    portalType === "platform"
      ? "ESMOS Platform"
      : (user?.role || "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) || "Workspace";

  return (
    <div className={cn("flex-1 min-w-0 flex items-center gap-3", className)}>
      <div className="min-w-0">
        <p className="text-ui font-semibold text-foreground truncate leading-tight">{label}</p>
        <p className="text-2xs text-muted-foreground truncate leading-tight mt-0.5">{roleLabel}</p>
      </div>
    </div>
  );
}
