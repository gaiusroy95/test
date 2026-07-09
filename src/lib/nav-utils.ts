import { PLATFORM_NAV, TENANT_NAV } from "@/lib/constants";
import type { UserType } from "@/types";

/** Resolve the current page label from the URL for the status bar. */
export function getNavPageLabel(pathname: string, portalType: UserType): string {
  const nav = portalType === "platform" ? PLATFORM_NAV : TENANT_NAV;

  const exact = nav.find((n) => n.path === pathname);
  if (exact) return exact.label;

  const byPrefix = [...nav]
    .filter((n) => n.path !== "/app" && n.path !== "/platform")
    .sort((a, b) => b.path.length - a.path.length)
    .find((n) => pathname.startsWith(n.path));

  if (byPrefix) return byPrefix.label;
  if (pathname === "/app" || pathname === "/platform") return "Dashboard";
  return "";
}
