import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:     "bg-brand-accent text-white",
        secondary:   "bg-slate-100 text-slate-700",
        destructive: "bg-red-100 text-red-700",
        outline:     "border border-slate-200 text-slate-600 bg-transparent",
        success:     "bg-emerald-100 text-emerald-700",
        warning:     "bg-amber-100 text-amber-700",
        info:        "bg-sky-100 text-sky-700",
        purple:      "bg-purple-100 text-purple-700",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
