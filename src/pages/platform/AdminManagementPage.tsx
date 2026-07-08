import { useEffect, useState, useCallback } from "react";
import { platformApi } from "@/api/client";
import { PageShell } from "@/components/shared/PageShell";
import { DataTable } from "@/components/shared/DataTable";
import { RoleBadge } from "@/components/shared/StatusBadge";
import { FormDialog, type FormField } from "@/components/shared/FormDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Shield, ShieldOff, ShieldCheck } from "lucide-react";
import type { PlatformUser } from "@/types";
import { formatDate, getApiError } from "@/lib/utils";

export default function AdminManagementPage() {
  const [admins, setAdmins] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [blockTarget, setBlockTarget] = useState<PlatformUser | null>(null);
  const [unblockTarget, setUnblockTarget] = useState<PlatformUser | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await platformApi.listAdmins();
      setAdmins(Array.isArray(data) ? data : data?.items || []);
    } catch { toast.error("Failed to load admins"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleCreate = async (formData: Record<string, any>) => {
    setActionLoading(true);
    try {
      await platformApi.createAdmin(formData);
      toast.success("Platform admin created");
      setCreateOpen(false);
      fetch();
    } catch (err: any) { toast.error(getApiError(err, "Failed to create admin")); }
    finally { setActionLoading(false); }
  };

  const handleBlock = async (reason?: string) => {
    if (!blockTarget) return;
    setActionLoading(true);
    try {
      await platformApi.blockAdmin(blockTarget.id, reason);
      toast.success("Admin blocked");
      setBlockTarget(null);
      fetch();
    } catch (err: any) { toast.error(getApiError(err, "Failed to block")); }
    finally { setActionLoading(false); }
  };

  const handleUnblock = async () => {
    if (!unblockTarget) return;
    setActionLoading(true);
    try {
      await platformApi.unblockAdmin(unblockTarget.id);
      toast.success("Admin unblocked");
      setUnblockTarget(null);
      fetch();
    } catch (err: any) { toast.error(getApiError(err, "Failed to unblock")); }
    finally { setActionLoading(false); }
  };

  const fields: FormField[] = [
    { key: "first_name", label: "First Name", required: true, placeholder: "Admin" },
    { key: "last_name", label: "Last Name", required: true, placeholder: "User" },
    { key: "email", label: "Email", type: "email", required: true, placeholder: "admin@esmos.com" },
    { key: "password", label: "Password", type: "password", required: true, placeholder: "Strong password" },
  ];

  return (
    <PageShell
      title="Admin Management"
      description="Manage platform admin accounts (PLATFORM_OWNER only)"
      breadcrumb={[{ label: "Platform Admin", href: "/platform" }, { label: "Admin Management" }]}
      actions={
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus size={14} /> Add Admin
        </Button>
      }
    >
      <DataTable
        loading={loading}
        empty={admins.length === 0 ? {
          icon: Shield,
          title: "No platform admins",
          description: "Create your first platform admin to help manage companies.",
        } : undefined}
        skeletonCols={7}
      >
        <Table>
          <TableHeader>
            <TableRow>
              {["Name", "Email", "Role", "Status", "Last Login", "Created", "Actions"].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-semibold text-foreground">{a.first_name} {a.last_name}</TableCell>
                <TableCell className="text-muted-foreground">{a.email}</TableCell>
                <TableCell><RoleBadge role={a.role} /></TableCell>
                <TableCell>
                  <Badge variant={a.blocked_at ? "destructive" : a.is_active ? "success" : "secondary"}>
                    {a.blocked_at ? "Blocked" : a.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">{a.last_login_at ? formatDate(a.last_login_at) : "Never"}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{formatDate(a.created_at)}</TableCell>
                <TableCell>
                  {a.role !== "PLATFORM_OWNER" && (
                    a.blocked_at ? (
                      <Button variant="ghost" size="sm" onClick={() => setUnblockTarget(a)} className="text-ok hover:bg-ok-tint h-7 px-2">
                        <ShieldCheck size={13} /> Unblock
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setBlockTarget(a)} className="text-destructive hover:bg-destructive-tint h-7 px-2">
                        <ShieldOff size={13} /> Block
                      </Button>
                    )
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTable>

      <FormDialog open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={handleCreate} title="Add Platform Admin" description="This user will be able to manage companies and system config" fields={fields} submitLabel="Create Admin" loading={actionLoading} />
      <ConfirmDialog open={!!blockTarget} onClose={() => setBlockTarget(null)} onConfirm={handleBlock} title="Block Admin" message={`Block "${blockTarget?.first_name} ${blockTarget?.last_name}"? They will be locked out immediately.`} confirmLabel="Block" variant="destructive" showReason loading={actionLoading} />
      <ConfirmDialog open={!!unblockTarget} onClose={() => setUnblockTarget(null)} onConfirm={handleUnblock} title="Unblock Admin" message={`Reactivate "${unblockTarget?.first_name} ${unblockTarget?.last_name}"?`} confirmLabel="Unblock" loading={actionLoading} />
    </PageShell>
  );
}
