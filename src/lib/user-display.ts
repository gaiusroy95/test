import type { UserInfo } from "@/types";

export function getUserDisplayName(user: UserInfo | null | undefined): string {
  if (!user) return "Account";
  const first = (user.first_name || "").toString().trim();
  const last = (user.last_name || "").toString().trim();
  const full = [first, last].filter(Boolean).join(" ");
  if (full) return full;
  if (user.email) return user.email.split("@")[0];
  return "Account";
}

export function getUserInitials(user: UserInfo | null | undefined): string {
  if (!user) return "??";
  const first = (user.first_name || "").toString().trim();
  const last = (user.last_name || "").toString().trim();
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  const name = getUserDisplayName(user);
  return name.slice(0, 2).toUpperCase();
}

export function getUserRoleLabel(role?: string): string {
  if (!role) return "User";
  return role
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
