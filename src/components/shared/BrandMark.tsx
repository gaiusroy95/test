import { Leaf } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

interface BrandMarkProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  /** Light mark for dark grounds (login / ink sidebar) */
  inverted?: boolean;
}

const BOX = {
  sm: "h-7 w-7",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  xl: "h-12 w-12",
} as const;

const ICON = {
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
} as const;

/**
 * Original ESMOS mark — Leaf icon (product brand).
 */
export function BrandMark({ size = "md", className, inverted }: BrandMarkProps) {
  return (
    <div
      className={cn(
        "rounded-md flex items-center justify-center shrink-0 select-none border",
        BOX[size],
        inverted
          ? "bg-white/10 border-white/15 text-teal-200"
          : "bg-primary text-primary-foreground border-primary",
        className
      )}
      aria-hidden="true"
    >
      <Leaf size={ICON[size]} strokeWidth={2.25} />
    </div>
  );
}

interface BrandLockupProps {
  collapsed?: boolean;
  inverted?: boolean;
  tagline?: string;
  className?: string;
}

export function BrandLockup({ collapsed, inverted, tagline, className }: BrandLockupProps) {
  return (
    <div className={cn("flex items-center gap-2.5 min-w-0", className)}>
      <BrandMark size="md" inverted={inverted} />
      {!collapsed && (
        <div className="min-w-0">
          <div
            className={cn(
              "text-[15px] font-extrabold tracking-[-0.03em] leading-none truncate",
              inverted ? "text-white" : "text-sidebar-foreground"
            )}
          >
            {APP_NAME}
          </div>
          {tagline && (
            <div
              className={cn(
                "text-[10px] font-semibold tracking-[0.06em] uppercase mt-1 leading-none truncate",
                inverted ? "text-teal-200/70" : "text-muted-foreground"
              )}
            >
              {tagline.length > 28 ? "ESG Oversight" : tagline}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
