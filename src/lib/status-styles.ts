/**
 * Semantic status styles — use design tokens so light/dark modes stay consistent.
 */
export const WORKFLOW_STATUS = {
  DRAFT: {
    label: "Draft",
    pill: "bg-sunken text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
  SUBMITTED: {
    label: "Pending",
    pill: "bg-warn-tint text-warn border-warn/25",
    dot: "bg-warn",
  },
  APPROVED: {
    label: "Approved",
    pill: "bg-ok-tint text-ok border-ok/25",
    dot: "bg-ok",
  },
  REJECTED: {
    label: "Rejected",
    pill: "bg-destructive-tint text-destructive border-destructive/25",
    dot: "bg-destructive",
  },
} as const;

export type WorkflowStatus = keyof typeof WORKFLOW_STATUS;

export function workflowStatusPill(status: string): string {
  const s = WORKFLOW_STATUS[status as WorkflowStatus];
  return s?.pill ?? "bg-sunken text-muted-foreground border-border";
}

export function workflowStatusLabel(status: string): string {
  const s = WORKFLOW_STATUS[status as WorkflowStatus];
  return s?.label ?? status;
}

/** Scope badge colors (GHG scopes) */
export const SCOPE_BADGE: Record<number, string> = {
  1: "bg-destructive-tint text-destructive",
  2: "bg-warn-tint text-warn",
  3: "bg-info-tint text-info",
};
