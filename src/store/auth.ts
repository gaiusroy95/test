import { create } from "zustand";
import type { UserInfo, UserType } from "@/types";
import { authApi } from "@/api/client";

interface SupportSessionInfo {
  request_id: string;
  expires_at: string;        // ISO
  actor_platform_user_id?: string;
}

interface AuthState {
  user: UserInfo | null;
  accessToken: string | null;
  refreshToken: string | null;
  userType: UserType | null;
  isAuthenticated: boolean;

  /** Set when this browser tab is operating inside a support (read-only) session. */
  supportSession: SupportSessionInfo | null;

  login: (user: UserInfo, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  updateTokens: (accessToken: string, refreshToken: string) => void;
}

/** Decode a JWT payload (no signature check — frontend uses it for routing only). */
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(padded));
  } catch { return null; }
}

/** Single source of truth for inferring userType from a user object */
function inferUserType(user: any): UserType {
  if (user?.user_type && user.user_type !== "unknown") return user.user_type as UserType;
  return ["PLATFORM_OWNER", "PLATFORM_ADMIN"].includes(user?.role) ? "platform" : "tenant";
}

/**
 * Bootstrap a support session from a URL hash if present.
 *
 * Platform Owner activates an approved support request and we open
 *   /app/dashboard#st=<token>&exp=<iso>&rid=<request_id>
 * in a new tab. That new tab calls bootstrapSupportSessionFromHash() during
 * module import (before the auth store is read) and stashes the token in
 * sessionStorage. sessionStorage is per-tab, so it does NOT clobber the
 * Platform Owner's localStorage session in the original tab.
 */
function bootstrapSupportSessionFromHash(): void {
  if (typeof window === "undefined") return;
  const hash = window.location.hash || "";
  if (!hash.startsWith("#st=") && !hash.includes("&st=")) return;
  const params = new URLSearchParams(hash.slice(1));
  const token = params.get("st");
  const exp = params.get("exp");
  const rid = params.get("rid");
  if (!token || !exp || !rid) return;
  const payload = decodeJwtPayload(token);
  if (!payload || !payload.is_support || payload.type !== "tenant") return;
  // Build a synthetic UserInfo using only data already inside the JWT.
  const synthetic = {
    user_id: payload.sub,
    company_id: payload.company_id,
    role: "COMPANY_ADMIN",       // impersonated identity
    user_type: "tenant" as UserType,
    first_name: "Support",
    last_name: "Session",
    email: "support@platform",
  };
  sessionStorage.setItem(
    "esmos_support",
    JSON.stringify({
      user: synthetic,
      accessToken: token,
      refreshToken: null,                    // support sessions cannot refresh
      userType: "tenant" as UserType,
      supportSession: {
        request_id: rid,
        expires_at: exp,
        actor_platform_user_id: payload.support_actor_platform_user_id,
      },
    }),
  );
  // Clean the URL so reloading doesn't re-bootstrap with a stale hash.
  const cleanUrl = window.location.pathname + window.location.search;
  window.history.replaceState({}, "", cleanUrl);
}

bootstrapSupportSessionFromHash();


function loadFromStorage(): Partial<AuthState> {
  try {
    // Per-tab support session takes priority — this tab is in support mode.
    const supportRaw = sessionStorage.getItem("esmos_support");
    if (supportRaw) {
      const data = JSON.parse(supportRaw);
      if (data.user && data.accessToken) {
        return {
          user: data.user,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken ?? null,
          userType: data.userType,
          isAuthenticated: true,
          supportSession: data.supportSession,
        };
      }
    }
    const raw = localStorage.getItem("esmos_auth");
    if (!raw) return {};
    const data = JSON.parse(raw);
    if (!data.user) return {};
    const userType = data.userType || inferUserType(data.user);
    return {
      user: { ...data.user, user_type: userType },
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      userType,
      isAuthenticated: true,
      supportSession: null,
    };
  } catch {
    localStorage.removeItem("esmos_auth");
    sessionStorage.removeItem("esmos_support");
    return {};
  }
}

function saveToStorage(state: { user: UserInfo; accessToken: string; refreshToken: string; userType: UserType }) {
  localStorage.setItem("esmos_auth", JSON.stringify(state));
}

const initial = loadFromStorage();

export const useAuthStore = create<AuthState>((set) => ({
  user: initial.user ?? null,
  accessToken: initial.accessToken ?? null,
  refreshToken: initial.refreshToken ?? null,
  userType: initial.userType ?? null,
  isAuthenticated: initial.isAuthenticated ?? false,
  supportSession: initial.supportSession ?? null,

  login: (user, accessToken, refreshToken) => {
    const userType = inferUserType(user);
    const userWithType = { ...user, user_type: userType };
    saveToStorage({ user: userWithType, accessToken, refreshToken, userType });
    set({ user: userWithType, accessToken, refreshToken, userType, isAuthenticated: true, supportSession: null });
  },

  logout: () => {
    // Fire-and-forget: tell the backend to revoke the current token.
    // We don't await — the local session is cleared regardless of network outcome.
    const state = useAuthStore.getState();
    if (state.isAuthenticated && !state.supportSession) {
      const logoutFn = state.userType === "platform" ? authApi.platformLogout : authApi.tenantLogout;
      logoutFn(state.refreshToken ?? undefined).catch(() => {/* ignore network errors on logout */});
    }
    if (state.supportSession) {
      sessionStorage.removeItem("esmos_support");
    } else {
      localStorage.removeItem("esmos_auth");
    }
    set({ user: null, accessToken: null, refreshToken: null, userType: null, isAuthenticated: false, supportSession: null });
  },

  updateTokens: (accessToken, refreshToken) => {
    const state = useAuthStore.getState();
    if (state.supportSession) {
      // Support sessions never refresh — if a 401 happens, the tab logs out.
      return;
    }
    try {
      const prev = JSON.parse(localStorage.getItem("esmos_auth") || "{}");
      saveToStorage({ ...prev, accessToken, refreshToken });
    } catch {
      localStorage.removeItem("esmos_auth");
    }
    set({ accessToken, refreshToken });
  },
}));
