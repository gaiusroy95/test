import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";

const ACTIVITY_KEY = "esmos:last-activity";
const LOGOUT_KEY = "esmos:idle-logout";
const IDLE_NOTICE_KEY = "esmos:idle-expired";
const MIN_TIMEOUT_MINUTES = 5;
const MAX_TIMEOUT_MINUTES = 10;

function getTimeoutMs() {
  const configured = Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES ?? MAX_TIMEOUT_MINUTES);
  const minutes = Number.isFinite(configured)
    ? Math.min(MAX_TIMEOUT_MINUTES, Math.max(MIN_TIMEOUT_MINUTES, configured))
    : MAX_TIMEOUT_MINUTES;
  return minutes * 60_000;
}

export function IdleSessionGuard() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    const timeoutMs = getTimeoutMs();
    let lastActivity = Date.now();
    let lastRecordedAt = 0;
    let timer: number | undefined;
    let expired = false;

    const expireSession = (broadcast = true) => {
      if (expired) return;
      expired = true;
      if (timer) window.clearTimeout(timer);
      localStorage.removeItem(ACTIVITY_KEY);
      if (broadcast) localStorage.setItem(LOGOUT_KEY, String(Date.now()));
      sessionStorage.setItem(IDLE_NOTICE_KEY, "true");
      logout();
      toast.error("Session expired due to inactivity. Please sign in again.");
      navigate("/login", { replace: true });
    };

    const scheduleExpiration = () => {
      if (expired) return;
      if (timer) window.clearTimeout(timer);
      const remaining = timeoutMs - (Date.now() - lastActivity);
      if (remaining <= 0) {
        expireSession();
        return;
      }
      timer = window.setTimeout(() => expireSession(), remaining);
    };

    const recordActivity = () => {
      if (expired) return;
      const now = Date.now();
      // Pointer movement and scrolling can fire rapidly; one update per second
      // is enough to maintain a strict minute-level inactivity deadline.
      if (now - lastRecordedAt < 1_000) return;
      lastRecordedAt = now;
      lastActivity = now;
      localStorage.setItem(ACTIVITY_KEY, String(now));
      scheduleExpiration();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LOGOUT_KEY && event.newValue) {
        expireSession(false);
        return;
      }
      if (event.key === ACTIVITY_KEY && event.newValue) {
        const activityAt = Number(event.newValue);
        if (Number.isFinite(activityAt) && activityAt > lastActivity) {
          lastActivity = activityAt;
          scheduleExpiration();
        }
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") scheduleExpiration();
    };

    const activityEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "pointermove",
      "keydown",
      "scroll",
      "touchstart",
    ];

    localStorage.setItem(ACTIVITY_KEY, String(lastActivity));
    activityEvents.forEach((event) =>
      window.addEventListener(event, recordActivity, { passive: true }),
    );
    window.addEventListener("focus", recordActivity);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibility);
    scheduleExpiration();

    return () => {
      if (timer) window.clearTimeout(timer);
      activityEvents.forEach((event) => window.removeEventListener(event, recordActivity));
      window.removeEventListener("focus", recordActivity);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [logout, navigate]);

  return null;
}
