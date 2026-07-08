import type { ReactNode } from "react";
import { useAuthStore } from "@/store/auth";

/**
 * Returns true when the current tab is operating inside a support
 * (read-only) session impersonating a tenant. Use this to HIDE write
 * controls — Add, Save, Submit, Delete, Edit, Approve, Reject, toggles —
 * so the support-mode user sees a clean read-only view instead of greyed
 * dead buttons.
 *
 * Backend remains the source of truth (rejects non-GET with 403); this
 * is the UX layer that matches Salesforce/Workday behaviour.
 */
export function useIsSupportSession(): boolean {
  return useAuthStore((s) => !!s.supportSession);
}

interface WriteOnlyProps {
  children: ReactNode;
  /** Optional fallback to render in support mode (rare — usually omit). */
  fallback?: ReactNode;
}

/**
 * Renders children only when NOT in a support session. In a support tab
 * the children are removed from the DOM entirely, so write-capable UI
 * (Save / Submit / Delete / Add buttons) simply does not appear.
 *
 * Usage:
 *   <WriteOnly><Button onClick={handleSave}>Save</Button></WriteOnly>
 */
export function WriteOnly({ children, fallback = null }: WriteOnlyProps) {
  const isSupport = useIsSupportSession();
  if (isSupport) return <>{fallback}</>;
  return <>{children}</>;
}
