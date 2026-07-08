import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-ui font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-60 active:scale-[0.97] [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:     "bg-brand-accent text-white hover:bg-brand-accentDk shadow-[0_1px_2px_rgba(14,165,233,0.30)]",
        destructive: "bg-gradient-to-b from-red-400 to-red-500 text-white hover:from-red-500 hover:to-red-600 shadow-[0_1px_2px_rgba(239,68,68,0.35),inset_0_1px_0_rgba(255,255,255,0.12)]",
        outline:     "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-[0_1px_2px_rgba(15,23,42,0.06)]",
        secondary:   "bg-slate-100 text-brand-navy hover:bg-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.05)]",
        ghost:       "text-slate-600 hover:bg-slate-100 hover:text-brand-navy",
        link:        "text-brand-accent underline-offset-4 hover:underline",
        success:     "bg-gradient-to-b from-emerald-400 to-emerald-500 text-white hover:from-emerald-500 hover:to-emerald-600 shadow-[0_1px_2px_rgba(16,185,129,0.35),inset_0_1px_0_rgba(255,255,255,0.12)]",
        warning:     "bg-gradient-to-b from-amber-400 to-amber-500 text-white hover:from-amber-500 hover:to-amber-600 shadow-[0_1px_2px_rgba(245,158,11,0.35),inset_0_1px_0_rgba(255,255,255,0.12)]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm:      "h-8 px-3 text-xs",
        lg:      "h-10 px-6 text-sm",
        icon:    "h-9 w-9",
        "icon-sm": "h-7 w-7",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
