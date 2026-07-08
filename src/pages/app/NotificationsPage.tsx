import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { tenantApi } from "@/api/client";
import { Breadcrumb, LoadingSkeleton, EmptyState } from "@/components/shared/PageComponents";
import { useIsSupportSession } from "@/components/shared/WriteOnly";
import { toast } from "sonner";
import { Bell, CheckCheck, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import type { Notification } from "@/types";
import { formatDateTime, getApiError } from "@/lib/utils";

const TYPE_COLORS: Record<string, string> = {
  SUBMITTED: "border-l-sky-500", APPROVED: "border-l-green-500",
  REJECTED: "border-l-red-500", LOCKED: "border-l-slate-400",
  EDITED: "border-l-amber-500", REMINDER: "border-l-purple-500",
};
const TYPE_BADGES: Record<string, { bg: string; color: string }> = {
  SUBMITTED: { bg: "#e0f2fe", color: "#0284c7" }, APPROVED: { bg: "#dcfce7", color: "#16a34a" },
  REJECTED: { bg: "#fee2e2", color: "#dc2626" }, LOCKED: { bg: "#f1f5f9", color: "#64748b" },
  EDITED: { bg: "#fef3c7", color: "#d97706" }, REMINDER: { bg: "#f3e8ff", color: "#7c3aed" },
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const isSupport = useIsSupportSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "unread" | "read">("all");
  const pageSize = 20;

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, size: pageSize };
      if (tab === "unread") params.is_read = false;
      if (tab === "read") params.is_read = true;
      const [listRes, countRes] = await Promise.all([
        tenantApi.listNotifications(params),
        tenantApi.unreadCount().catch(() => ({ data: { unread_count: 0 } })),
      ]);
      setNotifications(listRes.data?.items || listRes.data || []);
      setTotal(listRes.data?.total ?? 0);
      setUnreadCount(countRes.data?.unread_count ?? 0);
    } catch { toast.error("Failed to load notifications"); }
    finally { setLoading(false); }
  }, [page, tab]);

  useEffect(() => { fetch(); }, [fetch]);

  const markRead = async (id: string) => {
    try { await tenantApi.markRead(id); fetch(); }
    catch {}
  };

  const markAllRead = async () => {
    try { await tenantApi.markAllRead(); toast.success("All marked as read"); fetch(); }
    catch (err: any) { toast.error(getApiError(err, "Failed")); }
  };

  const handleClick = (n: Notification) => {
    if (!n.is_read && !isSupport) markRead(n.notification_id);
    if (n.type === "SUBMITTED" || n.type === "APPROVED" || n.type === "REJECTED") {
      navigate("/app/review");
    } else if (n.type === "LOCKED" || n.type === "EDITED" || n.type === "REMINDER" || n.record_id) {
      navigate("/app/esg-input");
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-6 max-w-[900px]">
      {/* Row 1: Title + action */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <Breadcrumb items={[{ label: "Company Portal", href: "/app" }, { label: "Notifications" }]} />
          <h1 className="text-[18px] font-bold text-brand-navy tracking-tight">Notifications</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">{unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}</p>
        </div>
        {unreadCount > 0 && !isSupport && (
          <button onClick={markAllRead} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-600 hover:bg-slate-50">
            <CheckCheck size={14} /> Mark All Read
          </button>
        )}
      </div>

      {/* Row 2: Underline filter tabs */}
      <div className="flex border-b border-slate-200 mb-4">
        {(["all", "unread", "read"] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setPage(1); }}
            className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors capitalize ${tab === t ? "border-brand-accent text-brand-accent" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"}`}>
            {t}{t === "unread" && unreadCount > 0 ? ` (${unreadCount})` : ""}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-6"><LoadingSkeleton rows={6} cols={1} /></div> : notifications.length === 0 ? (
          <EmptyState icon={Bell} title={tab === "unread" ? "All caught up!" : "No notifications"} description={tab === "unread" ? "You have no unread notifications" : "Notifications will appear here when actions occur"} />
        ) : (
          <>
            {notifications.map((n) => {
              const badge = TYPE_BADGES[n.type] || TYPE_BADGES.REMINDER;
              return (
                <div
                  key={n.notification_id}
                  onClick={() => handleClick(n)}
                  className={`flex items-start gap-3 px-5 py-3 border-b border-slate-100 last:border-b-0 cursor-pointer transition-colors border-l-[3px] ${TYPE_COLORS[n.type] || "border-l-slate-300"} ${!n.is_read ? "bg-sky-50/30" : "hover:bg-slate-50/60"}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: badge.bg, color: badge.color }}>
                        {n.type}
                      </span>
                      {!n.is_read && <div className="w-2 h-2 rounded-full bg-brand-accent" />}
                    </div>
                    <div className="text-[13px] font-semibold text-brand-navy">{n.title}</div>
                    {n.message && <div className="text-[12px] text-slate-500 mt-0.5 truncate">{n.message}</div>}
                    <div className="text-[11px] text-slate-400 mt-1">{formatDateTime(n.created_at)}</div>
                  </div>
                  {(n.record_id || n.type === "SUBMITTED" || n.type === "APPROVED" || n.type === "REJECTED" || n.type === "LOCKED" || n.type === "EDITED" || n.type === "REMINDER") && (
                    <ExternalLink size={14} className="text-slate-300 mt-1 flex-shrink-0" />
                  )}
                </div>
              );
            })}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <span className="text-[12px] text-slate-500">Page {page} of {totalPages}</span>
                <div className="flex items-center gap-1">
                  <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"><ChevronLeft size={16} /></button>
                  <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"><ChevronRight size={16} /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
