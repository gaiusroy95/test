import type { ReactNode } from "react";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  empty?: boolean;
  emptyMessage?: string;
  height?: number;
}

export function ChartCard({
  title,
  description,
  children,
  className,
  empty,
  emptyMessage = "No data available for the selected filters",
  height = 280,
}: ChartCardProps) {
  return (
    <div className={cn("surface-elevated overflow-hidden", className)}>
      <div className="px-4 py-2.5 border-b border-[hsl(var(--border-hairline))]">
        <h3 className="section-title">{title}</h3>
        {description && <p className="section-desc mt-0.5">{description}</p>}
      </div>
      <div className="p-4" style={{ minHeight: height }}>
        {empty ? (
          <div className="flex flex-col items-center justify-center h-full py-10 text-center">
            <BarChart3 size={28} className="text-muted-foreground/30 mb-2" />
            <p className="text-ui text-muted-foreground max-w-[200px]">{emptyMessage}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
