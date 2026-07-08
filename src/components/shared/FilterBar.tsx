import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  children: React.ReactNode;
  onClear?: () => void;
  showClear?: boolean;
  className?: string;
}

/**
 * FilterBar — horizontal row of filter controls with optional Clear action.
 */
export function FilterBar({ children, onClear, showClear, className }: FilterBarProps) {
  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {children}
      {showClear && onClear && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="text-primary h-8 px-2"
        >
          Clear
        </Button>
      )}
    </div>
  );
}
