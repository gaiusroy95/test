import { useEffect, useState, useCallback } from "react";
import { platformApi } from "@/api/client";
import { Breadcrumb, LoadingSkeleton, EmptyState } from "@/components/shared/PageComponents";
import { RoleBadge } from "@/components/shared/StatusBadge";
import { FormDialog, type FormField } from "@/components/shared/FormDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
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
    <div className="p-6 max-w-[1200px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <Breadcrumb items={[{ label: "Platform Admin", href: "/platform" }, { label: "Admin Management" }]} />
          <h1 className="text-[18px] font-bold text-brand-navy tracking-tight">Admin Management</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">Manage platform admin accounts (PLATFORM_OWNER only)</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-brand-accent text-[12px] font-semibold text-white hover:bg-brand-accentDk transition-colors">
          <Plus size={14} /> Add Admin
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-6"><LoadingSkeleton rows={5} cols={6} /></div> : admins.length === 0 ? (
          <EmptyState icon={Shield} title="No platform admins" description="Create your first platform admin to help manage companies." />
        ) : (
          <table className="w-full text-[13px]">
            <thead><tr className="border-b-2 border-slate-100 bg-slate-50/60">
              {["Name", "Email", "Role", "Status", "Last Login", "Created", "Actions"].map((h) => (
                <th key={h} className="text-left px-4 py-2 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-2 font-semibold text-brand-navy">{a.first_name} {a.last_name}</td>
                  <td className="px-4 py-2 text-slate-500">{a.email}</td>
                  <td className="px-4 py-2"><RoleBadge role={a.role} /></td>
                  <td className="px-4 py-2">
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${a.blocked_at ? "bg-red-100 text-red-700" : a.is_active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {a.blocked_at ? "Blocked" : a.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-400 text-[12px]">{a.last_login_at ? formatDate(a.last_login_at) : "Never"}</td>
                  <td className="px-4 py-2 text-slate-400 text-[12px]">{formatDate(a.created_at)}</td>
                  <td className="px-4 py-2">
                    {a.role !== "PLATFORM_OWNER" && (
                      a.blocked_at ? (
                        <button onClick={() => setUnblockTarget(a)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold text-green-600 hover:bg-green-50 transition-colors">
                          <ShieldCheck size={13} /> Unblock
                        </button>
                      ) : (
                        <button onClick={() => setBlockTarget(a)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold text-red-500 hover:bg-red-50 transition-colors">
                          <ShieldOff size={13} /> Block
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <FormDialog open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={handleCreate} title="Add Platform Admin" description="This user will be able to manage companies and system config" fields={fields} submitLabel="Create Admin" loading={actionLoading} />
      <ConfirmDialog open={!!blockTarget} onClose={() => setBlockTarget(null)} onConfirm={handleBlock} title="Block Admin" message={`Block "${blockTarget?.first_name} ${blockTarget?.last_name}"? They will be locked out immediately.`} confirmLabel="Block" variant="destructive" showReason loading={actionLoading} />
      <ConfirmDialog open={!!unblockTarget} onClose={() => setUnblockTarget(null)} onConfirm={handleUnblock} title="Unblock Admin" message={`Reactivate "${unblockTarget?.first_name} ${unblockTarget?.last_name}"?`} confirmLabel="Unblock" loading={actionLoading} />
    </div>
  );
}
