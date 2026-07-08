import { Fragment } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav className={cn("flex items-center gap-1 mb-1", className)} aria-label="Breadcrumb">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <Fragment key={i}>
            {i > 0 && <ChevronRight size={11} className="text-border flex-shrink-0" aria-hidden="true" />}
            {item.href && !isLast ? (
              <Link
                to={item.href}
                className="text-label text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn("text-label", isLast ? "text-muted-foreground font-medium" : "text-muted-foreground")}
                aria-current={isLast ? "page" : undefined}
              >
                {item.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

interface PageShellProps {
  title: string;
  description?: string;
  breadcrumb?: BreadcrumbItem[];
  actions?: React.ReactNode;
  children?: React.ReactNode;
  /** Extra content below title row (e.g. tabs / filters) */
  toolbar?: React.ReactNode;
  className?: string;
  /** When true, wraps content only — no max-width constraint on outer */
  fullWidth?: boolean;
}

/**
 * PageShell — standard page layout used across the platform.
 * Breadcrumb + title + description + actions + optional toolbar + children.
 */
export function PageShell({
  title,
  description,
  breadcrumb,
  actions,
  children,
  toolbar,
  className,
  fullWidth,
}: PageShellProps) {
  return (
    <div className={cn(fullWidth ? "p-6 w-full animate-page-in" : "page-root", className)}>
      <div className="mb-5 pb-4 border-b border-[hsl(var(--border-hairline))]">
        {breadcrumb && <Breadcrumb items={breadcrumb} />}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-foreground tracking-tight">{title}</h1>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">{actions}</div>
          )}
        </div>
        {toolbar && <div className="mt-4">{toolbar}</div>}
      </div>
      {children}
    </div>
  );
}

/** @deprecated Use PageShell — kept for backward compatibility during migration */
export function PageHeader({
  title,
  description,
  breadcrumb,
  children,
}: {
  title: string;
  description?: string;
  breadcrumb?: BreadcrumbItem[];
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5 pb-4 border-b border-[hsl(var(--border-hairline))]">
      {breadcrumb && <Breadcrumb items={breadcrumb} />}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-foreground tracking-tight">{title}</h1>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {children && <div className="flex items-center gap-2 flex-shrink-0">{children}</div>}
      </div>
    </div>
  );
}
