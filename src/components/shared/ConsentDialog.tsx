/**
 * ConsentDialog — GDPR / DPDP Art. 7 consent gate.
 *
 * Shown once to tenant users whose `consented_at` is null (i.e. they've never
 * accepted the Privacy Policy). Calls POST /auth/consent on acceptance and
 * updates the auth store so the dialog doesn't reappear.
 *
 * Usage: render inside TenantLayout so it appears on every protected page
 * until consent is given.
 */

import { useState } from "react";
import { useAuthStore } from "@/store/auth";
import { authApi } from "@/api/client";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogBody, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Bump this string whenever the Privacy Policy or Terms change.
// Users who consented to an older version will be re-prompted.
export const CURRENT_POLICY_VERSION = "1.0";

export function ConsentDialog() {
  const { user, login, accessToken, refreshToken } = useAuthStore();
  const [loading, setLoading] = useState(false);

  // Show only for tenant users who haven't consented yet
  const needsConsent =
    user &&
    !["PLATFORM_OWNER", "PLATFORM_ADMIN"].includes(user.role) &&
    !(user as any).consented_at;

  if (!needsConsent) return null;

  const handleAccept = async () => {
    setLoading(true);
    try {
      await authApi.recordConsent(CURRENT_POLICY_VERSION);
      // Patch the stored user object so the dialog doesn't re-appear
      const updatedUser = {
        ...(user as any),
        consented_at: new Date().toISOString(),
        consent_version: CURRENT_POLICY_VERSION,
      };
      login(updatedUser, accessToken!, refreshToken!);
      toast.success("Thank you — consent recorded.");
    } catch {
      toast.error("Failed to record consent. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open modal>
      <DialogContent
        className="max-w-[480px]"
        // Prevent closing by clicking the backdrop or pressing Escape
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-lg bg-brand-accent/10 flex items-center justify-center">
              <ShieldCheck size={18} className="text-brand-accent" />
            </div>
            <DialogTitle>Privacy &amp; Data Usage</DialogTitle>
          </div>
          <DialogDescription>
            Before you continue, please review how we handle your data.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="space-y-3 text-[13px] text-slate-600 leading-relaxed">
            <p>
              <strong className="text-brand-navy">What we collect:</strong> Your name,
              email address, role, and the ESG data you enter on behalf of your organisation.
            </p>
            <p>
              <strong className="text-brand-navy">How we use it:</strong> Solely to operate
              the ESMOS platform for your company's ESG/BRSR reporting. Your data is never
              sold or shared with third parties.
            </p>
            <p>
              <strong className="text-brand-navy">Your rights:</strong> You may request a
              copy of your personal data (Download My Data) or ask your Company Admin to
              permanently erase your account at any time.
            </p>
            <p>
              <strong className="text-brand-navy">Policy version:</strong>{" "}
              {CURRENT_POLICY_VERSION}. The full Privacy Policy is available on our website.
            </p>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button onClick={handleAccept} disabled={loading} className="w-full">
            {loading ? "Recording…" : "I understand and agree"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
