import { Monitor, Moon, Sun, LayoutGrid, Rows3, Rows4 } from "lucide-react";
import { useAppearanceStore, type DensityMode, type ThemeMode } from "@/store/appearance";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light",  label: "Light",  icon: Sun },
  { value: "dark",   label: "Dark",   icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const DENSITY_OPTIONS: { value: DensityMode; label: string; desc: string; icon: typeof Rows3 }[] = [
  { value: "compact",     label: "Compact",     desc: "Maximum data density", icon: Rows4 },
  { value: "comfortable", label: "Comfortable", desc: "Balanced spacing",     icon: Rows3 },
  { value: "spacious",    label: "Spacious",    desc: "More breathing room",  icon: LayoutGrid },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export function AppearanceSettings() {
  const { theme, density, tablePageSize, setTheme, setDensity, setTablePageSize } = useAppearanceStore();

  const handleSave = () => {
    toast.success("Appearance preferences saved");
  };

  return (
    <div className="max-w-[720px] space-y-5">
      <section className="surface-elevated overflow-hidden">
        <div className="px-5 py-3 border-b border-[hsl(var(--border-hairline))] bg-sunken/60">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Theme</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">Choose how ESMOS looks on your screen</p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                theme === value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border hover:border-primary/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon size={22} />
              <span className="text-[13px] font-semibold">{label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="surface-elevated overflow-hidden">
        <div className="px-5 py-3 border-b border-[hsl(var(--border-hairline))] bg-sunken/60">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Interface Density</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">Controls row height and padding across tables, forms, and navigation</p>
        </div>
        <div className="p-5 space-y-2">
          {DENSITY_OPTIONS.map(({ value, label, desc, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setDensity(value)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                density === value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-sunken"
              }`}
            >
              <Icon size={18} className={density === value ? "text-primary" : "text-muted-foreground"} />
              <div>
                <div className="text-[13px] font-semibold text-foreground">{label}</div>
                <div className="text-[12px] text-muted-foreground">{desc}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="surface-elevated overflow-hidden">
        <div className="px-5 py-3 border-b border-[hsl(var(--border-hairline))] bg-sunken/60">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Table Preferences</h3>
        </div>
        <div className="px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-[13px] font-semibold text-foreground">Default rows per page</div>
            <div className="text-[12px] text-muted-foreground">Applied to list pages across the portal</div>
          </div>
          <div className="flex gap-1">
            {PAGE_SIZE_OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setTablePageSize(n)}
                className={`px-3 py-1.5 rounded-md text-[12px] font-semibold border transition-colors ${
                  tablePageSize === n
                    ? "bg-primary text-white border-primary"
                    : "border-border text-muted-foreground hover:bg-sunken"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </section>

      <Button onClick={handleSave} className="bg-primary hover:bg-primaryDk text-white">
        Save Preferences
      </Button>
    </div>
  );
}
