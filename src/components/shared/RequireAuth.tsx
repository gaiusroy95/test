import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/auth";
import type { Role } from "@/types";

export function RequireAuth({ allowedRoles }: { allowedRoles?: Role[] }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const home = user.user_type === "platform" ? "/platform" : "/app";
    return <Navigate to={home} replace />;
  }
  return <Outlet />;
}

export function RequirePlatform() {
  const { isAuthenticated, userType, user } = useAuthStore();
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  // Check both userType and role as fallback
  const isPlatform = userType === "platform" || ["PLATFORM_OWNER", "PLATFORM_ADMIN"].includes(user.role);
  if (!isPlatform) return <Navigate to="/app" replace />;
  return <Outlet />;
}

export function RequireTenant() {
  const { isAuthenticated, userType, user } = useAuthStore();
  if (!isAuthenticated || !user) return <Navigate to="/login" replace />;
  // Check both userType and role as fallback
  const isPlatform = userType === "platform" || ["PLATFORM_OWNER", "PLATFORM_ADMIN"].includes(user.role);
  if (isPlatform) return <Navigate to="/platform" replace />;
  return <Outlet />;
}
