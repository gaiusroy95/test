import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/** @deprecated Prefer page title only — breadcrumbs are no longer rendered in page chrome. */
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
  /** @deprecated Not rendered in page chrome — use empty states / field help instead. */
  description?: string;
  /** @deprecated Not rendered in page chrome — sidebar provides navigation context. */
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
 * Title + primary actions sit together on the left (+ optional toolbar).
 */
export function PageShell({
  title,
  titleAddon,
  actions,
  children,
  toolbar,
  className,
  fullWidth,
  compact,
}: PageShellProps) {
  const rootCls = cn(fullWidth ? "px-5 pt-4 pb-5 w-full animate-page-in" : "page-root", className);

  if (compact) {
    return (
      <div className={rootCls}>
        <header className="page-header">
          <div className="dashboard-hero">
            <div className="pl-3 flex items-center gap-2.5 flex-wrap">
              <h1 className="page-title">{title}</h1>
              {actions && (
                <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>
              )}
            </div>
          </div>
          {toolbar && <div className="mt-2">{toolbar}</div>}
        </header>
        {children}
      </div>
    );
  }

  return (
    <div className={rootCls}>
      <header className="page-header">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 min-w-0">
            <h1 className="page-title">{title}</h1>
            {titleAddon}
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>
          )}
        </div>
        {toolbar && <div className="mt-2">{toolbar}</div>}
      </header>
      {children}
    </div>
  );
}

/** @deprecated Use PageShell — kept for backward compatibility during migration */
export function PageHeader({
  title,
  children,
}: {
  title: string;
  description?: string;
  breadcrumb?: BreadcrumbItem[];
  children?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="flex items-center gap-2.5 flex-wrap">
        <h1 className="page-title">{title}</h1>
        {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
      </div>
    </header>
  );
}
