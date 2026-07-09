import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
    <div className={cn("surface-elevated p-3 flex items-end gap-3 flex-wrap", className)}>
      {children}
      {showClear && onClear && (
        <Button variant="ghost" size="sm" onClick={onClear} className="text-primary h-8 px-2 ml-auto">
          Clear
        </Button>
      )}
    </div>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  minWidth?: number;
}

export function FilterSelect({
  label, value, onChange, options, placeholder = "All", className, minWidth = 140,
}: FilterSelectProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)} style={{ minWidth }}>
      <Label className="text-label font-semibold text-muted-foreground">{label}</Label>
      <Select value={value || "__all__"} onValueChange={(v) => onChange(v === "__all__" ? "" : v)}>
        <SelectTrigger className="h-9 text-ui">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">{placeholder}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
