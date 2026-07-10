import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Canonical page CTA: <Button size="sm"><Plus size={14} /> Add X</Button>
 * Shape: rounded-md (box, not pill). Dense h-8. No glow/shadow on primary.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-60 active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:     "bg-primary text-primary-foreground hover:bg-primary-dark",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:     "border border-border bg-card text-foreground hover:bg-sunken hover:border-border",
        secondary:   "bg-secondary text-secondary-foreground hover:bg-sunken",
        ghost:       "text-muted-foreground hover:bg-sunken hover:text-foreground",
        link:        "text-primary underline-offset-4 hover:underline",
        success:     "bg-ok text-white hover:bg-ok/90",
        warning:     "bg-warn text-white hover:bg-warn/90",
      },
      size: {
        default: "h-8 px-3",
        sm:      "h-8 px-3",
        lg:      "h-9 px-4 text-sm",
        icon:    "h-8 w-8",
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
