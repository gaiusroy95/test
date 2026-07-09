import {
  Zap, Wind, Droplets, Trash2, Home, Building2, Layers, Shield, Settings,
  MapPin, BarChart3, Database, UserCheck, FileText, Users, Calendar,
  Bell, FolderTree, FileSearch, MessageSquare, LifeBuoy,
  Leaf, Recycle, Factory, FlaskConical, Truck, Globe, Heart, Scale,
  Package2, Target, ClipboardCheck, BookOpen,
  // Extended icon set for module icon picker
  Flame, Sun, Waves, TreePine, Thermometer, CloudRain, Gauge,
  Activity, TrendingUp, Network, Cpu,
  GraduationCap, Briefcase, HeartHandshake, UserCog,
  Award, Flag, Lock, Eye, FileCheck, Landmark,
  type LucideIcon,
} from "lucide-react";

// ── Branding (change these two lines to rebrand the entire app) ──
export const APP_NAME = "ESMOS";
export const APP_TAGLINE = "ESG Management & Oversight System";
export const APP_VERSION = "1.0.0";

// ── Icon map: icon_name (string from DB) → Lucide React component ──────────
// Extend this map (and add the import above) to expose new icons to the picker.
// No code deploy needed for new modules — DB stores the string, frontend maps it.
export const MODULE_ICON_MAP: Record<string, LucideIcon> = {
  // Environment & Energy
  Zap, Flame, Sun, Wind, Waves, Droplets, Leaf, Thermometer, Recycle, Factory, TreePine, CloudRain,
  // Operations & Supply Chain
  Truck, Globe, Package2, Network, BarChart3, Gauge, Activity, TrendingUp, Building2, FlaskConical, Cpu, Database,
  // People & Social
  Users, UserCheck, Heart, GraduationCap, Briefcase, HeartHandshake, Scale, UserCog,
  // Governance & Compliance
  Shield, Target, ClipboardCheck, BookOpen, FileText, Award, Flag, Lock, Eye, FileCheck, Landmark,
  // Legacy names kept so existing DB data never breaks
  Trash2, Settings, Layers,
};

export function getModuleIcon(iconName?: string): LucideIcon {
  return (iconName && MODULE_ICON_MAP[iconName]) || BarChart3;
}

// ── Module color presets (color = accent hex, bg = light background hex) ──
export const MODULE_COLOR_PRESETS: { color: string; bg: string; label: string }[] = [
  { color: "#f59e0b", bg: "#fef9c3", label: "Amber"   },
  { color: "#0ea5e9", bg: "#e0f2fe", label: "Sky"     },
  { color: "#22c55e", bg: "#dcfce7", label: "Green"   },
  { color: "#7c3aed", bg: "#f5f3ff", label: "Violet"  },
  { color: "#ef4444", bg: "#fee2e2", label: "Red"     },
  { color: "#f97316", bg: "#fff7ed", label: "Orange"  },
  { color: "#14b8a6", bg: "#ccfbf1", label: "Teal"    },
  { color: "#8b5cf6", bg: "#ede9fe", label: "Purple"  },
  { color: "#ec4899", bg: "#fce7f3", label: "Pink"    },
  { color: "#64748b", bg: "#f8fafc", label: "Slate"   },
  { color: "#16a34a", bg: "#f0fdf4", label: "Emerald" },
  { color: "#0f172a", bg: "#f1f5f9", label: "Navy"    },
];

// ── Status badges ──
export const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  ACTIVE:    { bg: "#dcfce7", color: "#16a34a", label: "Active" },
  SUSPENDED: { bg: "#fef3c7", color: "#d97706", label: "Suspended" },
  BLOCKED:   { bg: "#fee2e2", color: "#dc2626", label: "Blocked" },
  DRAFT:     { bg: "#f1f5f9", color: "#64748b", label: "Draft" },
  SUBMITTED: { bg: "#e0f2fe", color: "#0284c7", label: "Submitted" },
  APPROVED:  { bg: "#dcfce7", color: "#16a34a", label: "Approved" },
  REJECTED:  { bg: "#fee2e2", color: "#dc2626", label: "Rejected" },
  LOCKED:    { bg: "#f3e8ff", color: "#7c3aed", label: "Locked" },
};

// ── Role badges ──
export const ROLE_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  PLATFORM_OWNER:  { bg: "#fef3c7", color: "#d97706", label: "Platform Owner" },
  PLATFORM_ADMIN:  { bg: "#e0f2fe", color: "#0284c7", label: "Platform Admin" },
  COMPANY_ADMIN:   { bg: "#f3e8ff", color: "#7c3aed", label: "Company Admin" },
  REVIEWER:        { bg: "#e0f2fe", color: "#0284c7", label: "Reviewer" },
  LOCATION_USER:   { bg: "#dcfce7", color: "#16a34a", label: "Location User" },
  AUDITOR:         { bg: "#fef3c7", color: "#d97706", label: "Auditor" },
};

// ── Navigation: Platform portal ──
export const PLATFORM_NAV = [
  { key: "dashboard", label: "Dashboard",      icon: Home,      path: "/platform" },
  { key: "companies", label: "Companies",      icon: Building2, path: "/platform/companies" },
  { key: "tickets",   label: "Support Tickets",icon: LifeBuoy,  path: "/platform/tickets" },
  { key: "scope3",    label: "Scope 3 Factors",icon: Package2,  path: "/platform/scope3" },
  { key: "catalog",   label: "Capability Catalog", icon: BookOpen, path: "/platform/catalog" },
  { key: "system",    label: "System Config",  icon: Layers,    path: "/platform/system" },
  { key: "admins",    label: "Admin Users",    icon: Shield,    path: "/platform/admins" },
  { key: "audit",     label: "Audit Log",      icon: FileText,  path: "/platform/audit-log" },
];

// ── Navigation: Tenant portal ──
export const TENANT_NAV = [
  { key: "dashboard",      label: "Dashboard",          icon: Home,          path: "/app" },
  // ── Configuration group ──
  { key: "library",        label: "Template Catalog",   icon: BookOpen,      path: "/app/library",          group: "Configuration" },
  { key: "indicators",     label: "Indicators",         icon: FolderTree,    path: "/app/indicators",       group: "Configuration" },
  { key: "kpisetup",       label: "KPI Setup",          icon: BarChart3,     path: "/app/kpi-setup",        group: "Configuration" },
  { key: "locations",      label: "Locations",          icon: MapPin,        path: "/app/locations",        group: "Configuration" },
  { key: "users",          label: "User Management",    icon: Users,         path: "/app/users",            group: "Configuration" },
  { key: "reporting",      label: "Reporting Years",    icon: Calendar,      path: "/app/reporting",        group: "Configuration" },
  { key: "settings",       label: "Company Config",     icon: Settings,      path: "/app/settings",         group: "Configuration" },
  // ── Data group ──
  { key: "esginput",       label: "ESG Input",          icon: Database,      path: "/app/esg-input",        group: "Data" },
  { key: "review",         label: "Review",             icon: UserCheck,     path: "/app/review",           group: "Data" },
  { key: "documents",      label: "Document Explorer",  icon: FileSearch,    path: "/app/documents",        group: "Data" },
  { key: "auditorremarks", label: "Auditor Remarks",    icon: ClipboardCheck,path: "/app/auditor-remarks",  group: "Data" },
  // ── Insights group ──
  { key: "reports",        label: "Reports",            icon: FileText,      path: "/app/reports",          group: "Insights" },
  { key: "targets",        label: "Targets",            icon: Target,        path: "/app/targets",          group: "Insights" },
  { key: "suppliers",      label: "Supplier Scorecard", icon: Building2,     path: "/app/suppliers",        group: "Insights" },
  { key: "query",          label: "Ask ESMOS",          icon: MessageSquare, path: "/app/query",            group: "Insights" },
  // ── Standalone ──
  { key: "notifications",  label: "Notifications",      icon: Bell,          path: "/app/notifications" },
];
