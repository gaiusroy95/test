import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { tenantApi } from "@/api/client";
import { PageShell } from "@/components/shared/PageShell";
import { PageTabs } from "@/components/shared/PageTabs";
import { LoadingSkeleton, EmptyState } from "@/components/shared/PageComponents";
import { useIsSupportSession } from "@/components/shared/WriteOnly";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import type { Notification } from "@/types";
import { formatDateTime, getApiError } from "@/lib/utils";

const TYPE_BORDER: Record<string, string> = {
  SUBMITTED: "border-l-info",
  APPROVED:  "border-l-ok",
  REJECTED:  "border-l-destructive",
  LOCKED:    "border-l-muted-foreground",
  EDITED:    "border-l-warn",
  REMINDER:  "border-l-primary",
};

const TYPE_BADGE_VARIANT: Record<string, string> = {
  SUBMITTED: "bg-info-tint text-info",
  APPROVED:  "bg-ok-tint text-ok",
  REJECTED:  "bg-destructive-tint text-destructive",
  LOCKED:    "bg-sunken text-muted-foreground",
  EDITED:    "bg-warn-tint text-warn",
  REMINDER:  "bg-accent text-accent-foreground",
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
      navigate(n.record_id ? `/app/review/${n.record_id}` : "/app/review");
    } else if (n.type === "LOCKED" || n.type === "EDITED" || n.type === "REMINDER" || n.record_id) {
      navigate("/app/esg-input");
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <PageShell
      title="Notifications"
      description={unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
      breadcrumb={[{ label: "Company Portal", href: "/app" }, { label: "Notifications" }]}
      fullWidth
      actions={
        unreadCount > 0 && !isSupport ? (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck size={14} /> Mark All Read
          </Button>
        ) : undefined
      }
      toolbar={
        <PageTabs
          tabs={[
            { key: "all", label: "All" },
            { key: "unread", label: "Unread", count: unreadCount > 0 ? unreadCount : undefined },
            { key: "read", label: "Read" },
          ]}
          value={tab}
          onChange={(k) => { setTab(k as typeof tab); setPage(1); }}
        />
      }
    >
      <div className="surface overflow-hidden max-w-[900px]">
        {loading ? (
          <div className="p-6"><LoadingSkeleton rows={6} cols={1} /></div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={tab === "unread" ? "All caught up!" : "No notifications"}
            description={tab === "unread" ? "You have no unread notifications" : "Notifications will appear here when actions occur"}
          />
        ) : (
          <>
            {notifications.map((n) => (
              <div
                key={n.notification_id}
                onClick={() => handleClick(n)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && handleClick(n)}
                className={`flex items-start gap-3 px-5 py-3 border-b border-[hsl(var(--border-hairline))] last:border-b-0 cursor-pointer transition-colors border-l-[3px] ${TYPE_BORDER[n.type] || "border-l-border"} ${!n.is_read ? "bg-accent/30" : "hover:bg-sunken"}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-2xs font-bold px-2 py-0.5 rounded-full ${TYPE_BADGE_VARIANT[n.type] || TYPE_BADGE_VARIANT.REMINDER}`}>
                      {n.type}
                    </span>
                    {!n.is_read && <div className="w-2 h-2 rounded-full bg-primary" aria-label="Unread" />}
                  </div>
                  <div className="text-ui font-semibold text-foreground">{n.title}</div>
                  {n.message && <div className="text-xs text-muted-foreground mt-0.5 truncate">{n.message}</div>}
                  <div className="text-label text-muted-foreground mt-1">{formatDateTime(n.created_at)}</div>
                </div>
                <ExternalLink size={14} className="text-muted-foreground/40 mt-1 flex-shrink-0" aria-hidden="true" />
              </div>
            ))}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-[hsl(var(--border-hairline))]">
                <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
