import { Badge } from "@/components/ui/badge";

// Map status → badge variant
const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "secondary" | "info" | "purple" | "default"> = {
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

// Audit log action labels
const ACTION_LABEL: Record<string, string> = {
  SUSPEND:   "Suspended",
  BLOCK:     "Blocked",
  UNBLOCK:   "Unblocked",
  DELETE:    "Deleted",
  CREATE:    "Created",
  UPDATE:    "Updated",
  ACTIVATE:  "Activated",
};

const ACTION_VARIANT: Record<string, "warning" | "destructive" | "success" | "info" | "secondary"> = {
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
  DRAFT:     { dot: 'bg-[hsl(var(--muted-foreground))]',  bg: 'bg-[hsl(var(--surface-sunken))]',  text: 'text-[hsl(var(--muted-foreground))]',  label: 'Draft' },
  SUBMITTED: { dot: 'bg-[hsl(var(--warn))]',              bg: 'bg-[hsl(var(--warn-tint))]',        text: 'text-[hsl(var(--warn))]',              label: 'Under review' },
  APPROVED:  { dot: 'bg-[hsl(var(--ok))]',                bg: 'bg-[hsl(var(--ok-tint))]',          text: 'text-[hsl(var(--ok))]',                label: 'Approved' },
  REJECTED:  { dot: 'bg-[hsl(var(--destructive))]',       bg: 'bg-[hsl(var(--destructive-tint))]', text: 'text-[hsl(var(--destructive))]',        label: 'Rejected' },
};

export function EsgStatusBadge({ status }: { status: string }) {
  const s = ESG_STATUS_STYLES[status];
  if (!s) return <StatusBadge status={status} />;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm font-sans text-[11px] font-semibold uppercase tracking-[0.05em] ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// Map role → variant
const ROLE_VARIANT: Record<string, "warning" | "info" | "purple" | "success" | "default"> = {
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
