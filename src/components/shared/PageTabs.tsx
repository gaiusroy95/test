import { cn } from "@/lib/utils";

export interface PageTab {
  key: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

interface PageTabsProps {
  tabs: PageTab[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}

/**
 * PageTabs — underline-style tabs for multi-view pages (Reports, Settings, KPI Setup).
 */
export function PageTabs({ tabs, value, onChange, className }: PageTabsProps) {
  return (
    <div
      role="tablist"
      className={cn("flex border-b border-border -mb-px", className)}
    >
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 text-ui font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            {tab.icon}
            {tab.label}
            {typeof tab.count === "number" && (
              <span
                className={cn(
                  "text-2xs font-bold px-1.5 py-0.5 rounded-full tabular-nums",
                  active ? "bg-accent text-accent-foreground" : "bg-sunken text-muted-foreground"
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
