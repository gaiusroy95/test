import { Badge } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";
import { badgeVariants } from "@/components/ui/badge";

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

// Map status → badge variant
const STATUS_VARIANT: Record<string, BadgeVariant> = {
  ACTIVE:    "success",
  SUBMITTED: "info",
  APPROVED:  "success",
  REJECTED:  "destructive",
  SUSPENDED: "warning",
  BLOCKED:   "destructive",
  DRAFT:     "secondary",
  LOCKED:    "purple",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE:    "Active",
  SUBMITTED: "Submitted",
  APPROVED:  "Approved",
  REJECTED:  "Rejected",
  SUSPENDED: "Suspended",
  BLOCKED:   "Blocked",
  DRAFT:     "Draft",
  LOCKED:    "Locked",
};

const ACTION_LABEL: Record<string, string> = {
  SUSPEND:   "Suspended",
  BLOCK:     "Blocked",
  UNBLOCK:   "Unblocked",
  DELETE:    "Deleted",
  CREATE:    "Created",
  UPDATE:    "Updated",
  ACTIVATE:  "Activated",
};

const ACTION_VARIANT: Record<string, BadgeVariant> = {
  SUSPEND:  "warning",
  BLOCK:    "destructive",
  UNBLOCK:  "success",
  DELETE:   "destructive",
  CREATE:   "success",
  UPDATE:   "info",
  ACTIVATE: "success",
};

export function StatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANT[status] || ACTION_VARIANT[status] || "secondary";
  const label = STATUS_LABEL[status] || ACTION_LABEL[status] || status.replace(/_/g, " ");
  return <Badge variant={variant}>{label}</Badge>;
}

// ESG workflow status badge — dot-pill style using semantic CSS tokens
const ESG_STATUS_STYLES: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  DRAFT:     { dot: "bg-muted-foreground", bg: "bg-sunken", text: "text-muted-foreground", label: "Draft" },
  SUBMITTED: { dot: "bg-warn", bg: "bg-warn-tint", text: "text-warn", label: "Under review" },
  APPROVED:  { dot: "bg-ok", bg: "bg-ok-tint", text: "text-ok", label: "Approved" },
  REJECTED:  { dot: "bg-destructive", bg: "bg-destructive-tint", text: "text-destructive", label: "Rejected" },
};

export function EsgStatusBadge({ status }: { status: string }) {
  const s = ESG_STATUS_STYLES[status];
  if (!s) return <StatusBadge status={status} />;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm font-sans text-label font-semibold uppercase tracking-[0.05em] ${s.bg} ${s.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
      {s.label}
    </span>
  );
}

const ROLE_VARIANT: Record<string, BadgeVariant> = {
  PLATFORM_OWNER:  "warning",
  PLATFORM_ADMIN:  "info",
  COMPANY_ADMIN:   "purple",
  REVIEWER:        "info",
  LOCATION_USER:   "success",
  AUDITOR:         "warning",
};

const ROLE_LABEL: Record<string, string> = {
  PLATFORM_OWNER: "Platform Owner",
  PLATFORM_ADMIN: "Platform Admin",
  COMPANY_ADMIN:  "Company Admin",
  REVIEWER:       "Reviewer",
  LOCATION_USER:  "Location User",
  AUDITOR:        "Auditor",
};

export function RoleBadge({ role }: { role: string }) {
  const variant = ROLE_VARIANT[role] || "secondary";
  const label = ROLE_LABEL[role] || role.replace(/_/g, " ");
  return <Badge variant={variant}>{label}</Badge>;
}
