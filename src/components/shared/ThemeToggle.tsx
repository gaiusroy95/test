import { useEffect, useState } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { getResolvedTheme, useAppearanceStore, type ThemeMode } from "@/store/appearance";
import { cn } from "@/lib/utils";

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light",  label: "Light",  icon: Sun },
  { value: "dark",   label: "Dark",   icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/**
 * ThemeToggle — header control for Light / Dark / System themes.
 * Uses the persisted appearance store (shared across tenant and platform portals).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useAppearanceStore((s) => s.theme);
  const setTheme = useAppearanceStore((s) => s.setTheme);
  const [resolved, setResolved] = useState(() => getResolvedTheme(theme));

  useEffect(() => {
    setResolved(getResolvedTheme(theme));
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setResolved(getResolvedTheme("system"));
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const TriggerIcon = theme === "system" ? Monitor : resolved === "dark" ? Moon : Sun;
  const tooltip =
    theme === "system"
      ? `Theme: System (${resolved})`
      : `Theme: ${theme === "dark" ? "Dark" : "Light"}`;

  return (
    <TooltipProvider delayDuration={400}>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={cn("text-muted-foreground hover:text-foreground", className)}
                aria-label={`${tooltip}. Open theme menu`}
              >
                <TriggerIcon size={17} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">{tooltip}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-[168px]">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <DropdownMenuItem
              key={value}
              onClick={() => setTheme(value)}
              className="flex items-center justify-between gap-2"
            >
              <span className="flex items-center gap-2">
                <Icon size={14} />
                {label}
              </span>
              {theme === value && <Check size={14} className="text-primary shrink-0" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}
