import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";
export type DensityMode = "compact" | "comfortable" | "spacious";

export interface AppearanceState {
  theme: ThemeMode;
  density: DensityMode;
  tablePageSize: number;
  setTheme: (theme: ThemeMode) => void;
  setDensity: (density: DensityMode) => void;
  setTablePageSize: (size: number) => void;
}

const DENSITY_VARS: Record<DensityMode, { row: string; padX: string; padY: string }> = {
  compact:     { row: "1.75rem", padX: "0.5rem",  padY: "0.25rem" },
  comfortable: { row: "2rem",    padX: "0.75rem", padY: "0.375rem" },
  spacious:    { row: "2.5rem",  padX: "1rem",    padY: "0.625rem" },
};

function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

/** Resolved light/dark for UI that reflects system preference when theme is "system". */
export function getResolvedTheme(mode: ThemeMode): "light" | "dark" {
  return resolveTheme(mode);
}

export function applyAppearance(theme: ThemeMode, density: DensityMode) {
  const root = document.documentElement;
  const resolved = resolveTheme(theme);

  root.classList.remove("light", "dark");
  root.classList.add(resolved);

  root.classList.remove("density-compact", "density-comfortable", "density-spacious");
  root.classList.add(`density-${density}`);

  const vars = DENSITY_VARS[density];
  root.style.setProperty("--density-row", vars.row);
  root.style.setProperty("--density-pad-x", vars.padX);
  root.style.setProperty("--density-pad-y", vars.padY);
}

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set, get) => ({
      theme: "light",
      density: "comfortable",
      tablePageSize: 20,
      setTheme: (theme) => {
        set({ theme });
        applyAppearance(theme, get().density);
      },
      setDensity: (density) => {
        set({ density });
        applyAppearance(get().theme, density);
      },
      setTablePageSize: (tablePageSize) => set({ tablePageSize }),
    }),
    {
      name: "esmos-appearance",
      onRehydrateStorage: () => (state) => {
        if (state) applyAppearance(state.theme, state.density);
      },
    }
  )
);

/** Call once on app boot (before paint if possible). */
export function initAppearance() {
  const { theme, density } = useAppearanceStore.getState();
  applyAppearance(theme, density);

  if (theme === "system") {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyAppearance("system", useAppearanceStore.getState().density);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }
}
