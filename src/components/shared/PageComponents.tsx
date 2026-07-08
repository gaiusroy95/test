import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Inbox } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Re-export PageShell pieces so existing imports keep working
export { Breadcrumb, PageHeader, PageShell } from "@/components/shared/PageShell";
export type { BreadcrumbItem } from "@/components/shared/PageShell";

// ═══ STAT CARD (clickable) ═══
export function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  change,
  changeType,
  accent,
  to,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtitle?: string;
  change?: string;
  changeType?: "up" | "down";
  /** CSS color or hsl — defaults to primary token */
  accent?: string;
  to?: string;
}) {
  const navigate = useNavigate();
  const accentColor = accent || "hsl(var(--primary))";

  return (
    <div
      role={to ? "link" : undefined}
      tabIndex={to ? 0 : undefined}
      onKeyDown={(e) => {
        if (to && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          navigate(to);
        }
      }}
      className={cn(
        "bg-card rounded-md p-5 border border-border flex flex-col gap-3 group relative overflow-hidden transition-all duration-200 shadow-surface",
        to && "cursor-pointer hover:shadow-elevated hover:-translate-y-px"
      )}
      onClick={() => to && navigate(to)}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-md opacity-80"
        style={{ background: accentColor }}
        aria-hidden="true"
      />
      <div className="flex justify-between items-start pl-2">
        <div
          className="w-9 h-9 rounded-sm flex items-center justify-center transition-transform group-hover:scale-105 duration-200"
          style={{ background: `${accentColor}18` }}
        >
          <Icon size={18} style={{ color: accentColor }} aria-hidden="true" />
        </div>
        {change && (
          <span
            className={cn(
              "text-label font-bold flex items-center gap-1 px-2 py-0.5 rounded-full",
              changeType === "up" && "text-ok bg-ok-tint",
              changeType === "down" && "text-destructive bg-destructive-tint",
              !changeType && "text-muted-foreground bg-sunken"
            )}
          >
            {changeType === "up" && <TrendingUp size={11} aria-hidden="true" />}
            {changeType === "down" && <TrendingDown size={11} aria-hidden="true" />}
            {change}
          </span>
        )}
      </div>
      <div className="pl-2">
        <div className="text-2xl font-bold text-foreground leading-none tracking-tight tabular-nums">
          {value}
        </div>
        <div className="text-xs font-medium text-muted-foreground mt-1">{label}</div>
        {subtitle && <div className="text-label text-muted-foreground mt-0.5">{subtitle}</div>}
      </div>
    </div>
  );
}

// ═══ EMPTY STATE ═══
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
      <div className="w-11 h-11 rounded-md bg-sunken flex items-center justify-center mb-3 ring-1 ring-border">
        <Icon size={22} className="text-muted-foreground" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-bold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">{description}</p>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

// ═══ LOADING SKELETON ═══
export function LoadingSkeleton({
  rows = 5,
  cols = 4,
  variant = "table",
}: {
  rows?: number;
  cols?: number;
  variant?: "table" | "cards";
}) {
  if (variant === "cards") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="surface p-5 space-y-3">
            <Skeleton className="h-9 w-9 rounded-sm" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-4 mb-2">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-3.5 flex-1 opacity-70" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Page content loading skeleton used during route transitions */
export function PageLoadingSkeleton() {
  return (
    <div className="page-root" aria-busy="true" aria-label="Loading page">
      <div className="mb-5 pb-4 border-b border-[hsl(var(--border-hairline))] space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-3 w-72" />
      </div>
      <LoadingSkeleton variant="cards" cols={4} />
      <div className="mt-5 surface p-6">
        <LoadingSkeleton rows={6} cols={4} />
      </div>
    </div>
  );
}
