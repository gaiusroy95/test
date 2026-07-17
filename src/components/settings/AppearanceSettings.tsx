import { Monitor, Moon, Sun, LayoutGrid, Rows3, Rows4 } from "lucide-react";
import {
  useAppearanceStore,
  type ColorPalette,
  type DensityMode,
  type ThemeMode,
} from "@/store/appearance";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light",  label: "Light",  icon: Sun },
  { value: "dark",   label: "Dark",   icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const PALETTE_OPTIONS: {
  value: ColorPalette;
  label: string;
  desc: string;
  swatches: [string, string, string];
}[] = [
  {
    value: "blue",
    label: "White & Blue",
    desc: "Bright canvas with minimal blue accents",
    swatches: ["#ffffff", "#eff6ff", "#2563eb"],
  },
  {
    value: "slate",
    label: "Soft Slate",
    desc: "Neutral gray with quiet contrast",
    swatches: ["#f8fafc", "#e2e8f0", "#334155"],
  },
  {
    value: "teal",
    label: "Ink & Teal",
    desc: "Dark sidebar with teal primary",
    swatches: ["#f4faf8", "#0f2924", "#0d9488"],
  },
];

const DENSITY_OPTIONS: { value: DensityMode; label: string; desc: string; icon: typeof Rows3 }[] = [
  { value: "compact",     label: "Compact",     desc: "Maximum data density", icon: Rows4 },
  { value: "comfortable", label: "Comfortable", desc: "Balanced spacing",     icon: Rows3 },
  { value: "spacious",    label: "Spacious",    desc: "More breathing room",  icon: LayoutGrid },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export function AppearanceSettings() {
  const {
    theme,
    palette,
    density,
    tablePageSize,
    setTheme,
    setPalette,
    setDensity,
    setTablePageSize,
  } = useAppearanceStore();

  const handleSave = () => {
    toast.success("Appearance preferences saved");
  };

  return (
    <div className="space-y-4 w-full">
      <section className="surface-elevated overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[hsl(var(--border-hairline))] bg-sunken/60">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Theme</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">Light, dark, or follow your system</p>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-md border transition-colors",
                theme === value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon size={20} />
              <span className="text-xs font-semibold">{label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="surface-elevated overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[hsl(var(--border-hairline))] bg-sunken/60">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Color palette</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Pick a look for better on-screen visibility — works with light and dark
          </p>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PALETTE_OPTIONS.map(({ value, label, desc, swatches }) => (
            <button
              key={value}
              type="button"
              onClick={() => setPalette(value)}
              className={cn(
                "flex flex-col gap-2.5 p-3 rounded-md border text-left transition-colors",
                palette === value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40 hover:bg-sunken/40",
              )}
            >
              <div className="flex h-8 overflow-hidden rounded border border-border/80">
                {swatches.map((color) => (
                  <span
                    key={color}
                    className="flex-1"
                    style={{ backgroundColor: color }}
                    aria-hidden
                  />
                ))}
              </div>
              <div>
                <div className={cn("text-xs font-semibold", palette === value ? "text-primary" : "text-foreground")}>
                  {label}
                </div>
                <div className="text-[12px] text-muted-foreground mt-0.5">{desc}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="surface-elevated overflow-hidden">
        <div className="px-4 py-2.5 border-b border-[hsl(var(--border-hairline))] bg-sunken/60">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Interface Density</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">Controls row height and padding across tables, forms, and navigation</p>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {DENSITY_OPTIONS.map(({ value, label, desc, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setDensity(value)}
              className={cn(
                "flex items-start gap-3 p-3 rounded-md border transition-colors text-left",
                density === value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-sunken",
              )}
            >
              <Icon size={18} className={cn("mt-0.5 shrink-0", density === value ? "text-primary" : "text-muted-foreground")} />
              <div>
                <div className="text-xs font-semibold text-foreground">{label}</div>
                <div className="text-[12px] text-muted-foreground mt-0.5">{desc}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="form-panel">
        <div className="form-panel-header">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Table Preferences</h3>
        </div>
        <div className="form-stack">
          <div className="form-field">
            <div className="field-label">Default rows per page</div>
            <p className="form-field-desc">Applied to list pages across the portal</p>
            <div className="flex gap-1 flex-wrap">
              {PAGE_SIZE_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setTablePageSize(n)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-semibold border transition-colors",
                    tablePageSize === n
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-sunken",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Button size="sm" onClick={handleSave}>
        Save Preferences
      </Button>
    </div>
  );
}
