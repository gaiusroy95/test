import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav className={cn("flex items-center gap-1", className)} aria-label="Breadcrumb">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <Fragment key={i}>
            {i > 0 && <ChevronRight size={10} className="text-border flex-shrink-0" aria-hidden="true" />}
            {item.href && !isLast ? (
              <Link
                to={item.href}
                className="text-2xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className="text-2xs text-muted-foreground"
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
  title: ReactNode;
  description?: string;
  breadcrumb?: BreadcrumbItem[];
  /** Optional icon or control rendered beside the title */
  titleAddon?: ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  /** Extra content below title row (e.g. tabs / filters) */
  toolbar?: React.ReactNode;
  className?: string;
  /** When true, wraps content only — no max-width constraint on outer */
  fullWidth?: boolean;
  /** Slim header — for dashboard / home pages */
  compact?: boolean;
}

/**
 * PageShell — dense enterprise page layout.
 * Breadcrumb (small) + title + inline description on one block; optional toolbar below.
 */
export function PageShell({
  title,
  description,
  breadcrumb,
  titleAddon,
  actions,
  children,
  toolbar,
  className,
  fullWidth,
  compact,
}: PageShellProps) {
  const rootCls = cn(fullWidth ? "px-5 py-4 w-full animate-page-in" : "page-root", className);

  if (compact) {
    return (
      <div className={rootCls}>
        <header className="page-header">
          <div className="dashboard-hero">
            <div className="pl-3 flex items-center justify-between gap-4 flex-wrap">
              <h1 className="text-2xl font-extrabold text-foreground tracking-tight">{title}</h1>
              {actions && (
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">{actions}</div>
              )}
            </div>
          </div>
          {toolbar && <div className="mt-4">{toolbar}</div>}
        </header>
        {children}
      </div>
    );
  }

  return (
    <div className={rootCls}>
      <header className="page-header">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            {breadcrumb && breadcrumb.length > 0 && (
              <Breadcrumb items={breadcrumb} className="mb-1" />
            )}
            <div className="flex items-baseline gap-x-2 gap-y-0.5 flex-wrap min-w-0">
              <div className="flex items-center gap-1.5 shrink-0">
                <h1 className="text-xl font-extrabold text-foreground tracking-tight">{title}</h1>
                {titleAddon}
              </div>
              {description && (
                <>
                  <span className="text-muted-foreground/40 text-label hidden sm:inline" aria-hidden="true">·</span>
                  <p className="text-label text-muted-foreground min-w-0">{description}</p>
                </>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">{actions}</div>
          )}
        </div>
        {toolbar && <div className="mt-3">{toolbar}</div>}
      </header>
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
    <header className="page-header">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          {breadcrumb && breadcrumb.length > 0 && (
            <Breadcrumb items={breadcrumb} className="mb-1" />
          )}
          <div className="flex items-baseline gap-x-2 gap-y-0.5 flex-wrap min-w-0">
            <h1 className="text-base font-bold text-foreground tracking-tight">{title}</h1>
            {description && (
              <>
                <span className="text-muted-foreground/40 text-label hidden sm:inline" aria-hidden="true">·</span>
                <p className="text-label text-muted-foreground">{description}</p>
              </>
            )}
          </div>
        </div>
        {children && <div className="flex items-center gap-2 flex-shrink-0">{children}</div>}
      </div>
    </header>
  );
}
