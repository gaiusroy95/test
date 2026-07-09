/** Design-token chart palette for Recharts */

export const CHART_COLORS = [
  "hsl(230 85% 55%)",   // primary
  "hsl(172 66% 40%)",   // teal
  "hsl(158 64% 38%)",   // ok
  "hsl(32 95% 44%)",    // warn
  "hsl(199 89% 48%)",   // info
  "hsl(0 72% 51%)",     // destructive
  "hsl(262 52% 55%)",   // violet
  "hsl(215 16% 47%)",   // muted
] as const;

export const CHART_SCOPE_COLORS: Record<string, string> = {
  "Scope 1": "hsl(230 85% 55%)",
  "Scope 2": "hsl(172 66% 40%)",
  "Scope 3": "hsl(32 95% 44%)",
};

export const CHART_GRID = "hsl(var(--border))";
export const CHART_AXIS = "hsl(var(--muted-foreground))";
export const CHART_TOOLTIP_BG = "hsl(var(--card))";
export const CHART_TOOLTIP_BORDER = "hsl(var(--border))";

export const chartTooltipStyle = {
  backgroundColor: CHART_TOOLTIP_BG,
  border: `1px solid ${CHART_TOOLTIP_BORDER}`,
  borderRadius: "8px",
  fontSize: "12px",
  color: "hsl(var(--foreground))",
  boxShadow: "0 4px 12px hsl(var(--foreground) / 0.12)",
};
