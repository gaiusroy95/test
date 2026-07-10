import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { BreadcrumbItem } from "@/components/shared/PageShell";

/* ── FormWorkspace — SAP/Salesforce-style dense form layout ── */

interface FormWorkspaceProps {
  children: ReactNode;
  className?: string;
  /** When true, fills available viewport height with scrollable body */
  fullHeight?: boolean;
}

export function FormWorkspace({ children, className, fullHeight }: FormWorkspaceProps) {
  return (
    <div
      className={cn(
        "flex flex-col w-full min-h-0 animate-page-in",
        /* Fill the layout main pane — do not use 100vh (double-counts app header/status). */
        fullHeight ? "h-full" : "",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ── FormHeader ── */

interface FormHeaderProps {
  title: ReactNode;
  /** @deprecated Not rendered in form chrome. */
  description?: string;
  /** @deprecated Not rendered in form chrome. */
  breadcrumb?: BreadcrumbItem[];
  status?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function FormHeader({ title, status, actions, className }: FormHeaderProps) {
  return (
    <header className={cn("flex-shrink-0 px-5 py-2 border-b border-border bg-card", className)}>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <h1 className="page-title">{title}</h1>
          {status}
        </div>
        {actions && <div className="flex items-center gap-2 ml-auto shrink-0">{actions}</div>}
      </div>
    </header>
  );
}

/* ── FormContextBar — sticky context strip ── */

interface ContextItem {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}

interface FormContextBarProps {
  items: ContextItem[];
  className?: string;
  children?: ReactNode;
}

export function FormContextBar({ items, className, children }: FormContextBarProps) {
  return (
    <div
      className={cn(
        "flex-shrink-0 sticky top-0 z-20 flex items-center gap-3 flex-wrap",
        "px-5 py-1.5 border-b border-border bg-sunken/80 backdrop-blur-sm",
        className
      )}
    >
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5 text-ui">
          {item.icon && <span className="text-muted-foreground">{item.icon}</span>}
          <span className="text-label font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</span>
          <span className="font-semibold text-foreground">{item.value}</span>
          {i < items.length - 1 && <span className="text-border mx-1 hidden sm:inline">|</span>}
        </div>
      ))}
      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}

/* ── FormBody — scrollable main area ── */

interface FormBodyProps {
  children: ReactNode;
  className?: string;
  sidePanel?: ReactNode;
  sidePanelWidth?: string;
}

export function FormBody({ children, className, sidePanel, sidePanelWidth = "320px" }: FormBodyProps) {
  if (!sidePanel) {
    return (
      <div className={cn("flex-1 flex flex-col overflow-y-auto min-h-0 px-5 py-3", className)}>
        {children}
      </div>
    );
  }

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <div className={cn("flex-1 flex flex-col overflow-y-auto min-h-0 px-5 py-3", className)}>
        {children}
      </div>
      <aside
        className="flex-shrink-0 border-l border-border bg-card overflow-y-auto hidden lg:block"
        style={{ width: sidePanelWidth }}
      >
        {sidePanel}
      </aside>
    </div>
  );
}

/* ── FormSection ── */

interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}

export function FormSection({ title, description, children, className, actions }: FormSectionProps) {
  return (
    <section className={cn("surface-elevated overflow-hidden mb-4", className)}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[hsl(var(--border-hairline))] bg-sunken/50">
        <div>
          <h2 className="section-title">{title}</h2>
          {description && <p className="section-desc mt-0.5">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </section>
  );
}

/* ── FormRow — responsive grid ──
 * Prefer cols={1} inside narrow sheets/drawers. Viewport breakpoints (md/xl)
 * do not know the sheet width, so 2-col rows can crush fields in side panels.
 */

interface FormRowProps {
  children: ReactNode;
  cols?: 1 | 2 | 3;
  className?: string;
}

export function FormRow({ children, cols = 2, className }: FormRowProps) {
  const grid = cols === 1 ? "grid-cols-1" : cols === 3 ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1 md:grid-cols-2";
  return <div className={cn("grid gap-4", grid, className)}>{children}</div>;
}

/* ── FormSidePanel ── */

export function FormSidePanel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("p-4 space-y-4", className)}>{children}</div>;
}

/* ── FormFooter — sticky actions ── */

interface FormFooterProps {
  children: ReactNode;
  className?: string;
  hint?: ReactNode;
}

export function FormFooter({ children, className, hint }: FormFooterProps) {
  return (
    <footer
      className={cn(
        "flex-shrink-0 sticky bottom-0 z-20",
        "flex items-center justify-between gap-4",
        "px-5 py-3 border-t border-border bg-card/95 backdrop-blur-sm shadow-[0_-4px_16px_rgba(0,0,0,0.04)]",
        className
      )}
    >
      {hint && <div className="flex items-center gap-3 min-w-0">{hint}</div>}
      <div className="flex items-center gap-2 ml-auto">{children}</div>
    </footer>
  );
}

/* ── ComputedField — read-only auto-computed value ── */

export function ComputedField({ label, value, unit }: { label: string; value: ReactNode; unit?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-label font-semibold text-muted-foreground">{label}</span>
      <div className="h-9 px-3 rounded-md border border-border bg-sunken font-mono text-ui text-foreground flex items-center">
        {value}
        {unit && <span className="ml-1.5 text-muted-foreground text-label">{unit}</span>}
      </div>
    </div>
  );
}
