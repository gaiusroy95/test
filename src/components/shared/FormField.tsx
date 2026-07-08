import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  id?: string;
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * FormField — label + control + hint + inline error.
 * Wrap any Input / Select / Textarea with this for consistent form layout.
 */
export function FormField({
  id,
  label,
  required,
  hint,
  error,
  className,
  children,
}: FormFieldProps) {
  const childId = id || (React.isValidElement(children) ? (children.props as { id?: string }).id : undefined);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <Label htmlFor={childId}>
          {label}
          {required && <span className="text-destructive ml-0.5" aria-hidden="true">*</span>}
        </Label>
      )}
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement, {
            id: childId,
            "aria-invalid": error ? true : undefined,
            "aria-describedby": error ? `${childId}-error` : hint ? `${childId}-hint` : undefined,
          })
        : children}
      {hint && !error && (
        <p id={childId ? `${childId}-hint` : undefined} className="text-label text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={childId ? `${childId}-error` : undefined} className="text-label text-destructive font-medium" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
