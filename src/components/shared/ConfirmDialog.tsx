import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: "default" | "destructive";
  showReason?: boolean;
  loading?: boolean;
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, message,
  confirmLabel = "Confirm", variant = "default", showReason = false, loading = false,
}: Props) {
  const [reason, setReason] = useState("");

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md" hideClose>
        <DialogBody className="pt-6">
          <div className="flex items-start gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              variant === "destructive" ? "bg-destructive-tint" : "bg-warn-tint"
            }`}>
              <AlertTriangle size={20} className={variant === "destructive" ? "text-destructive" : "text-amber-500"} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[16px] font-bold text-foreground mb-1">{title}</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">{message}</p>
            </div>
          </div>

          {showReason && (
            <div className="mt-5 flex flex-col gap-1.5">
              <Label className="text-[12px] font-semibold text-foreground">Reason (optional)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter a reason..."
                rows={2}
                className="resize-none"
              />
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={() => { onConfirm(reason || undefined); setReason(""); }}
            disabled={loading}
          >
            {loading ? "Processing..." : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
