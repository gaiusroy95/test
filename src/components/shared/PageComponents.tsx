import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Inbox, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export { Breadcrumb, PageHeader, PageShell } from "@/components/shared/PageShell";
export type { BreadcrumbItem } from "@/components/shared/PageShell";

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
        "group relative overflow-hidden rounded-xl border border-border/70 bg-card p-5 transition-all duration-200",
        "shadow-surface hover:shadow-elevated",
        to && "cursor-pointer hover:-translate-y-0.5 hover:border-primary/30"
      )}
      onClick={() => to && navigate(to)}
    >
      {/* Top gradient accent line */}
      <div
        className="absolute inset-x-0 top-0 h-[3px] opacity-90"
        style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)` }}
        aria-hidden="true"
      />

      <div className="flex items-start justify-between gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 duration-200"
          style={{ background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}10)` }}
        >
          <Icon size={20} style={{ color: accentColor }} aria-hidden="true" />
        </div>
        {change && (
          <span
            className={cn(
              "text-2xs font-bold flex items-center gap-1 px-2 py-0.5 rounded-full",
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
        {to && (
          <ArrowUpRight
            size={16}
            className="text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0 mt-0.5"
            aria-hidden="true"
          />
        )}
      </div>

      <div className="mt-4">
        <div className="metric-value text-foreground">{value}</div>
        <div className="text-sm font-semibold text-foreground/80 mt-1">{label}</div>
        {subtitle && (
          <div className="text-label text-muted-foreground mt-0.5 group-hover:text-primary transition-colors">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}

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
    <div className="flex flex-col items-center justify-center py-14 text-center px-4">
      <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center mb-4 ring-1 ring-primary/10">
        <Icon size={24} className="text-primary" aria-hidden="true" />
      </div>
      <h3 className="text-base font-bold text-foreground mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">{description}</p>
      )}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

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
          <div key={i} className="surface-elevated p-5 space-y-4">
            <Skeleton className="h-11 w-11 rounded-xl" />
            <Skeleton className="h-8 w-16" />
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

export function PageLoadingSkeleton() {
  return (
    <div className="page-root" aria-busy="true" aria-label="Loading page">
      <div className="dashboard-hero mb-6 space-y-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-8 w-72" />
      </div>
      <LoadingSkeleton variant="cards" cols={4} />
      <div className="mt-6 surface-elevated p-6">
        <LoadingSkeleton rows={6} cols={4} />
      </div>
    </div>
  );
}
