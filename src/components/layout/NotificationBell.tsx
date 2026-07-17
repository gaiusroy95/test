import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { tenantApi } from "@/api/client";
import { cn } from "@/lib/utils";

export const NOTIFICATIONS_CHANGED_EVENT = "esmos:notifications-changed";

export function notifyNotificationCountChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

export function NotificationBell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshCount = useCallback(async () => {
    try {
      const { data } = await tenantApi.unreadCount();
      setUnreadCount(Math.max(0, Number(data?.unread_count) || 0));
    } catch {
      // Keep the last known count during a temporary network failure.
    }
  }, []);

  useEffect(() => {
    void refreshCount();
    const interval = window.setInterval(refreshCount, 15_000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refreshCount();
    };
    const handleChanged = () => void refreshCount();

    window.addEventListener("focus", handleChanged);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handleChanged);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleChanged);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handleChanged);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refreshCount]);

  const active = location.pathname.startsWith("/app/notifications");
  const countLabel = unreadCount > 99 ? "99+" : String(unreadCount);

  return (
    <button
      type="button"
      onClick={() => navigate("/app/notifications")}
      className={cn(
        "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-sunken hover:text-foreground",
      )}
      aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
      aria-current={active ? "page" : undefined}
      title="Notifications"
    >
      <Bell size={18} strokeWidth={2} aria-hidden="true" />
      {unreadCount > 0 && (
        <span
          className="absolute -right-0.5 -top-0.5 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white ring-2 ring-card tabular-nums"
          aria-live="polite"
        >
          {countLabel}
        </span>
      )}
    </button>
  );
}
