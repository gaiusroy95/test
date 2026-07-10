import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export interface FormField {
  key: string;
  label: string;
  type?: "text" | "email" | "password" | "number" | "select" | "textarea" | "toggle" | "date";
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  options?: { value: string | number; label: string }[];
  defaultValue?: string | number | boolean;
  helpText?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, any>) => void;
  title: string;
  description?: string;
  fields: FormField[];
  submitLabel?: string;
  loading?: boolean;
  initialData?: Record<string, any>;
}

export function FormDialog({
  open, onClose, onSubmit, title, description,
  fields, submitLabel = "Create", loading = false, initialData,
}: Props) {
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    if (open) {
      const defaults: Record<string, any> = {};
      fields.forEach((f) => {
        defaults[f.key] = initialData?.[f.key] ?? f.defaultValue ?? (f.type === "toggle" ? false : "");
      });
      setFormData(defaults);
    }
  }, [open, initialData]);

  const handleChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    for (const f of fields) {
      const val = formData[f.key];
      const isEmpty = val === "" || val === null || val === undefined || (typeof val !== "number" && !val);
      if (f.required && isEmpty) {
        toast.error(`"${f.label}" is required`);
        return;
      }
    }
    onSubmit(formData);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <DialogBody>
          <div className="flex flex-col gap-4">
            {fields.map((f) => (
              <div key={f.key} className="flex flex-col gap-1.5">
                <Label htmlFor={`field-${f.key}`} className="text-[13px] font-semibold text-foreground">
                  {f.label}{f.required && <span className="text-destructive ml-0.5">*</span>}
                </Label>

                {f.type === "select" ? (
                  <Select
                    value={String(formData[f.key] ?? "")}
                    onValueChange={(v) => handleChange(f.key, v)}
                  >
                    <SelectTrigger id={`field-${f.key}`}>
                      <SelectValue placeholder={f.placeholder || `Select ${f.label}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {f.options?.map((o) => (
                        <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : f.type === "textarea" ? (
                  <Textarea
                    id={`field-${f.key}`}
                    value={formData[f.key] ?? ""}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    rows={3}
                    className="resize-none"
                  />
                ) : f.type === "toggle" ? (
                  <div className="flex items-center gap-2.5 h-9">
                    <Switch
                      id={`field-${f.key}`}
                      checked={!!formData[f.key]}
                      onCheckedChange={(v) => handleChange(f.key, v)}
                    />
                    <span className="text-[13px] text-muted-foreground">{formData[f.key] ? "Enabled" : "Disabled"}</span>
                  </div>
                ) : f.disabled ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-sunken text-[13px] text-muted-foreground min-h-[36px]">
                    <span className="flex-1">{formData[f.key] ?? "—"}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/40 flex-shrink-0"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  </div>
                ) : (
                  <Input
                    id={`field-${f.key}`}
                    type={f.type || "text"}
                    value={formData[f.key] ?? ""}
                    onChange={(e) => handleChange(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)}
                    placeholder={f.placeholder}
                  />
                )}

                {f.helpText && <p className="text-[11px] text-muted-foreground">{f.helpText}</p>}
              </div>
            ))}
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
