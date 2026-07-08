import { useEffect, useState, useCallback } from "react";
import { tenantApi } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import { Breadcrumb, LoadingSkeleton, EmptyState } from "@/components/shared/PageComponents";
import { RoleBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useIsSupportSession } from "@/components/shared/WriteOnly";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog as ShadDialog, DialogContent, DialogHeader as ShadDialogHeader,
  DialogTitle, DialogBody, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Users, Search, Pencil, UserX, UserCheck, ChevronLeft, ChevronRight, MapPin, Trash2 } from "lucide-react";
import type { User, Location } from "@/types";
import { formatDate, getApiError } from "@/lib/utils";
import { getModuleIcon } from "@/lib/constants";
import { useModulesStore } from "@/store/modules";

// ── Module selector ───────────────────────────────────────────────────────────

function ModuleSelector({ selectedIds, onChange }: { selectedIds: number[]; onChange: (ids: number[]) => void }) {
  const modules = useModulesStore((s) => s.modules);
  const toggle = (id: number) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };
  return (
    <div>
      <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Assigned Modules</Label>
      <div className="flex flex-wrap gap-2 mt-2">
        {modules.map((m) => {
          const Icon = getModuleIcon(m.icon_name);
          const checked = selectedIds.includes(m.module_id);
          return (
            <button
              key={m.module_id}
              type="button"
              onClick={() => toggle(m.module_id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold border-2 transition-all ${
                checked ? "text-white border-transparent" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
              }`}
              style={checked ? { background: m.color, borderColor: m.color } : {}}
            >
              <Icon size={13} /> {m.module_name}
            </button>
          );
        })}
      </div>
      {selectedIds.length === 0 && (
        <p className="text-[11px] text-amber-600 mt-1.5">No modules assigned — this user will see nothing when they log in.</p>
      )}
    </div>
  );
}

// ── Module pills (table cell) ─────────────────────────────────────────────────

function ModulePills({ moduleIds, role }: { moduleIds: number[]; role: string }) {
  const modules = useModulesStore((s) => s.modules);
  if (role !== "LOCATION_USER") return <span className="text-[11px] font-semibold text-slate-400">All</span>;
  if (moduleIds.length === 0) return <span className="text-[11px] text-slate-300 italic">None</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {moduleIds.map((id) => {
        const mod = modules.find((m) => m.module_id === id);
        if (!mod) return null;
        const Icon = getModuleIcon(mod.icon_name);
        return (
          <span key={id} className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold text-white" style={{ background: mod.color }}>
            <Icon size={10} /> {mod.module_name}
          </span>
        );
      })}
    </div>
  );
}

// ── Location selector ─────────────────────────────────────────────────────────

function LocationSelector({ selectedIds, locations, onChange }: { selectedIds: string[]; locations: Location[]; onChange: (ids: string[]) => void }) {
  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
  };
  return (
    <div>
      <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Assigned Locations</Label>
      <div className="flex flex-wrap gap-2 mt-2">
        {locations.map(loc => {
          const checked = selectedIds.includes(loc.location_id);
          return (
            <button
              key={loc.location_id}
              type="button"
              onClick={() => toggle(loc.location_id)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border-2 transition-all flex items-center gap-1.5
                ${checked ? "bg-brand-navy text-white border-brand-navy" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}
            >
              <MapPin size={12} /> {loc.location_name}
            </button>
          );
        })}
        {locations.length === 0 && <p className="text-[11px] text-slate-400">No locations configured yet.</p>}
      </div>
      {selectedIds.length === 0 && locations.length > 0 && (
        <p className="text-[11px] text-amber-500 mt-1.5">No locations assigned — user won't see any data</p>
      )}
    </div>
  );
}

// ── Form state types ──────────────────────────────────────────────────────────

interface CreateForm {
  first_name: string; last_name: string; email: string; password: string;
  role: string; module_ids: number[]; location_ids: string[];
}

const defaultCreate: CreateForm = { first_name: "", last_name: "", email: "", password: "", role: "", module_ids: [], location_ids: [] };

interface EditForm {
  first_name: string; last_name: string; email: string;
  role: string; module_ids: number[]; location_ids: string[];
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UserManagementPage() {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(defaultCreate);

  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ first_name: "", last_name: "", email: "", role: "", module_ids: [], location_ids: [] });

  const [deactivateTarget, setDeactivateTarget] = useState<User | null>(null);
  const [reactivateTarget, setReactivateTarget] = useState<User | null>(null);
  const [eraseTarget, setEraseTarget] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const pageSize = 20;
  const isSupport = useIsSupportSession();
  const isAdmin = currentUser?.role === "COMPANY_ADMIN" && !isSupport;

  useEffect(() => {
    tenantApi.listLocations({ size: 500 })
      .then(r => { const d = r.data; setLocations(Array.isArray(d) ? d : d?.items || []); })
      .catch(() => {});
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, size: pageSize };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      const { data } = await tenantApi.listUsers(params);
      setUsers(data.items || data || []);
      setTotal(data.total ?? 0);
    } catch { toast.error("Failed to load users"); }
    finally { setLoading(false); }
  }, [page, search, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  useEffect(() => { const t = setTimeout(() => { setPage(1); fetchUsers(); }, 300); return () => clearTimeout(t); }, [search]);

  const openCreate = () => { setCreateForm(defaultCreate); setCreateOpen(true); };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.first_name || !createForm.last_name || !createForm.email || !createForm.password || !createForm.role) {
      toast.error("Please fill in all required fields"); return;
    }
    setActionLoading(true);
    try {
      const payload: Record<string, any> = {
        first_name: createForm.first_name, last_name: createForm.last_name,
        email: createForm.email, password: createForm.password, role: createForm.role,
      };
      if (createForm.role === "LOCATION_USER") {
        payload.module_ids = createForm.module_ids;
        payload.location_ids = createForm.location_ids;
      }
      await tenantApi.createUser(payload);
      toast.success("User created");
      setCreateOpen(false);
      fetchUsers();
    } catch (err: any) { toast.error(getApiError(err, "Failed to create user")); }
    finally { setActionLoading(false); }
  };

  const openEdit = (u: User) => {
    setEditUser(u);
    setEditForm({ first_name: u.first_name, last_name: u.last_name, email: u.email, role: u.role, module_ids: u.assigned_module_ids ?? [], location_ids: u.assigned_location_ids ?? [] });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setActionLoading(true);
    try {
      const payload: Record<string, any> = { first_name: editForm.first_name, last_name: editForm.last_name, email: editForm.email, role: editForm.role };
      if (editForm.role === "LOCATION_USER") {
        payload.module_ids = editForm.module_ids;
        payload.location_ids = editForm.location_ids;
      }
      await tenantApi.updateUser(editUser.user_id, payload);
      if (editForm.role === "LOCATION_USER") {
        await tenantApi.assignUserLocations(editUser.user_id, editForm.location_ids);
      }
      toast.success("User updated");
      setEditUser(null);
      fetchUsers();
    } catch (err: any) { toast.error(getApiError(err, "Failed to update")); }
    finally { setActionLoading(false); }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setActionLoading(true);
    try {
      await tenantApi.deleteUser(deactivateTarget.user_id);
      toast.success("User deactivated");
      setDeactivateTarget(null);
      fetchUsers();
    } catch (err: any) { toast.error(getApiError(err, "Failed")); }
    finally { setActionLoading(false); }
  };

  const handleReactivate = async () => {
    if (!reactivateTarget) return;
    setActionLoading(true);
    try {
      await tenantApi.updateUser(reactivateTarget.user_id, { is_active: true });
      toast.success("User reactivated");
      setReactivateTarget(null);
      fetchUsers();
    } catch (err: any) { toast.error(getApiError(err, "Failed to reactivate")); }
    finally { setActionLoading(false); }
  };

  const handleErase = async () => {
    if (!eraseTarget) return;
    setActionLoading(true);
    try {
      await tenantApi.eraseUser(eraseTarget.user_id);
      toast.success("Personal data permanently erased (GDPR Art. 17)");
      setEraseTarget(null);
      fetchUsers();
    } catch (err: any) { toast.error(getApiError(err, "Failed to erase user data")); }
    finally { setActionLoading(false); }
  };

  const totalPages = Math.ceil(total / pageSize);

  // Reusable input class
  const inputCls = "w-full h-9 px-3 py-2 rounded-lg border border-slate-200 text-[13px] text-brand-navy outline-none focus:border-brand-accent transition-colors bg-white focus:ring-2 focus:ring-brand-accent/20";

  return (
    <div className="page-root">
      {/* Compact toolbar: title + filters + action in one row */}
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <Breadcrumb items={[{ label: "Company Portal", href: "/app" }, { label: "User Management" }]} />
          <h1 className="text-[18px] font-bold text-brand-navy tracking-tight">User Management</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">{total} user{total !== 1 ? "s" : ""} in your organization</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email…" className="pl-8 w-[220px] h-8 text-[12px]" />
          </div>
          <Select value={roleFilter || "__all__"} onValueChange={(v) => { setRoleFilter(v === "__all__" ? "" : v); setPage(1); }}>
            <SelectTrigger className="w-[140px] h-8 text-[12px]">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Roles</SelectItem>
              <SelectItem value="COMPANY_ADMIN">Company Admin</SelectItem>
              <SelectItem value="REVIEWER">Reviewer</SelectItem>
              <SelectItem value="LOCATION_USER">Location User</SelectItem>
              <SelectItem value="AUDITOR">Auditor</SelectItem>
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button onClick={openCreate} className="h-8 text-[12px] px-3">
              <Plus size={14} /> Add User
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="surface">
        {loading ? (
          <div className="p-6"><LoadingSkeleton rows={8} cols={7} /></div>
        ) : users.length === 0 ? (
          <EmptyState icon={Users} title="No users found" description={search || roleFilter ? "Try adjusting your filters" : "Add your first team member"}>
            {isAdmin && !search && !roleFilter && (
              <Button onClick={openCreate}><Plus size={14} /> Add User</Button>
            )}
          </EmptyState>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  {["Name", "Email", "Role", "Modules", "Locations", "Status", "Last Login", "Created", ...(isAdmin ? [""] : [])].map((h, i) => (
                    <TableHead key={i}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-accent to-brand-teal flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                          {u.first_name[0]}{u.last_name[0]}
                        </div>
                        <span className="font-semibold text-brand-navy">{u.first_name} {u.last_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-500">{u.email}</TableCell>
                    <TableCell><RoleBadge role={u.role} /></TableCell>
                    <TableCell><ModulePills moduleIds={u.assigned_module_ids ?? []} role={u.role} /></TableCell>
                    <TableCell>
                      {u.role !== "LOCATION_USER" ? (
                        <span className="text-[11px] font-semibold text-slate-400">All</span>
                      ) : (u.assigned_location_ids ?? []).length === 0 ? (
                        <Badge variant="warning" className="text-[10px]">None</Badge>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {(u.assigned_location_ids ?? []).slice(0, 2).map(lid => {
                            const loc = locations.find(l => l.location_id === lid);
                            return loc ? (
                              <span key={lid} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                                <MapPin size={9} /> {loc.location_name}
                              </span>
                            ) : null;
                          })}
                          {(u.assigned_location_ids ?? []).length > 2 && (
                            <span className="text-[10px] text-slate-400 self-center">+{(u.assigned_location_ids ?? []).length - 2}</span>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.anonymised_at ? "destructive" : u.is_active ? "success" : "secondary"} className="text-[10px]">
                        {u.anonymised_at ? "Erased" : u.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-400 text-[12px]">{u.last_login_at ? formatDate(u.last_login_at) : "Never"}</TableCell>
                    <TableCell className="text-slate-400 text-[12px]">{formatDate(u.created_at)}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(u)} title="Edit">
                            <Pencil size={14} />
                          </Button>
                          {u.is_active ? (
                            u.user_id !== currentUser?.id && (
                              <Button variant="ghost" size="icon-sm" onClick={() => setDeactivateTarget(u)} title="Deactivate" className="hover:bg-red-50 hover:text-red-500">
                                <UserX size={14} />
                              </Button>
                            )
                          ) : (
                            <>
                              <Button variant="ghost" size="icon-sm" onClick={() => setReactivateTarget(u)} title="Reactivate" className="hover:bg-green-50 hover:text-green-600">
                                <UserCheck size={14} />
                              </Button>
                              {!u.anonymised_at && (
                                <Button variant="ghost" size="icon-sm" onClick={() => setEraseTarget(u)} title="Erase personal data (GDPR)" className="hover:bg-red-50 hover:text-red-600">
                                  <Trash2 size={14} />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
                <span className="text-[12px] text-slate-500">Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={15} /></Button>
                  <span className="px-3 text-[12px] font-semibold text-brand-navy">{page} / {totalPages}</span>
                  <Button variant="outline" size="icon-sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight size={15} /></Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Create User Dialog ── */}
      <ShadDialog open={createOpen} onOpenChange={(v) => { if (!v) setCreateOpen(false); }}>
        <DialogContent className="max-w-lg">
          <ShadDialogHeader>
            <DialogTitle>Add User</DialogTitle>
          </ShadDialogHeader>
          <DialogBody>
            <form id="create-user-form" onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">First Name <span className="text-red-500">*</span></Label>
                  <input value={createForm.first_name} onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })} className={inputCls} placeholder="Priya" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Last Name <span className="text-red-500">*</span></Label>
                  <input value={createForm.last_name} onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })} className={inputCls} placeholder="Mehta" required />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Email <span className="text-red-500">*</span></Label>
                <input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} className={inputCls} placeholder="priya@company.com" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Password <span className="text-red-500">*</span></Label>
                <input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} className={inputCls} placeholder="Min 8 characters" required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Role <span className="text-red-500">*</span></Label>
                <select value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value, module_ids: [] })} className={inputCls} required>
                  <option value="">Select role…</option>
                  <option value="COMPANY_ADMIN">Company Admin</option>
                  <option value="REVIEWER">Reviewer</option>
                  <option value="LOCATION_USER">Location User</option>
                  <option value="AUDITOR">Auditor</option>
                </select>
              </div>
              {createForm.role === "LOCATION_USER" && (
                <>
                  <ModuleSelector selectedIds={createForm.module_ids} onChange={(ids) => setCreateForm({ ...createForm, module_ids: ids })} />
                  <LocationSelector selectedIds={createForm.location_ids} locations={locations} onChange={(ids) => setCreateForm({ ...createForm, location_ids: ids })} />
                </>
              )}
            </form>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={actionLoading}>Cancel</Button>
            <Button type="submit" form="create-user-form" disabled={actionLoading}>
              {actionLoading ? "Creating…" : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </ShadDialog>

      {/* ── Edit User Dialog ── */}
      <ShadDialog open={!!editUser} onOpenChange={(v) => { if (!v) setEditUser(null); }}>
        <DialogContent className="max-w-lg">
          <ShadDialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </ShadDialogHeader>
          <DialogBody>
            <form id="edit-user-form" onSubmit={handleEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">First Name <span className="text-red-500">*</span></Label>
                  <input value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} className={inputCls} required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Last Name <span className="text-red-500">*</span></Label>
                  <input value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} className={inputCls} required />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Email <span className="text-red-500">*</span></Label>
                <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className={inputCls} required />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Role <span className="text-red-500">*</span></Label>
                <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value, module_ids: [] })} className={inputCls} required>
                  <option value="COMPANY_ADMIN">Company Admin</option>
                  <option value="REVIEWER">Reviewer</option>
                  <option value="LOCATION_USER">Location User</option>
                  <option value="AUDITOR">Auditor</option>
                </select>
              </div>
              {editForm.role === "LOCATION_USER" && (
                <>
                  <ModuleSelector selectedIds={editForm.module_ids} onChange={(ids) => setEditForm({ ...editForm, module_ids: ids })} />
                  <LocationSelector selectedIds={editForm.location_ids} locations={locations} onChange={(ids) => setEditForm({ ...editForm, location_ids: ids })} />
                </>
              )}
            </form>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)} disabled={actionLoading}>Cancel</Button>
            <Button type="submit" form="edit-user-form" disabled={actionLoading}>
              {actionLoading ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </ShadDialog>

      <ConfirmDialog open={!!deactivateTarget} onClose={() => setDeactivateTarget(null)} onConfirm={handleDeactivate} title="Deactivate User" message={`Deactivate "${deactivateTarget?.first_name} ${deactivateTarget?.last_name}"? They will lose access immediately.`} confirmLabel="Deactivate" variant="destructive" loading={actionLoading} />
      <ConfirmDialog open={!!reactivateTarget} onClose={() => setReactivateTarget(null)} onConfirm={handleReactivate} title="Reactivate User" message={`Reactivate "${reactivateTarget?.first_name} ${reactivateTarget?.last_name}"? They will regain access immediately.`} confirmLabel="Reactivate" variant="default" loading={actionLoading} />
      <ConfirmDialog
        open={!!eraseTarget}
        onClose={() => setEraseTarget(null)}
        onConfirm={handleErase}
        title="Permanently Erase Personal Data"
        message={`This will irreversibly erase all personal data (name, email, password) for this user under GDPR Art. 17 / DPDP Act. The account will be anonymised and cannot be restored. Are you sure?`}
        confirmLabel="Erase Permanently"
        variant="destructive"
        loading={actionLoading}
      />
    </div>
  );
}
