import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";

interface AppTopBarContextProps {
  portalType: "platform" | "tenant";
  className?: string;
}

/**
 * App header context — company / portal name only.
 * Role subtitles (e.g. "Company Admin") are omitted to avoid redundant meta tags.
 */
export function AppTopBarContext({ portalType, className }: AppTopBarContextProps) {
  const user = useAuthStore((s) => s.user);

  const label =
    portalType === "platform"
      ? "Platform Admin"
      : user?.company_name || "Workspace";

  return (
    <div className={cn("flex-1 min-w-0 flex items-center gap-3", className)}>
      <p className="text-ui font-semibold text-foreground truncate leading-tight">{label}</p>
    </div>
  );
}
