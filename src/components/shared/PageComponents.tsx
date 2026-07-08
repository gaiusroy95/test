import { Fragment } from "react";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown, Inbox, ChevronRight } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

// ═══ BREADCRUMB ═══
export function Breadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav className="flex items-center gap-1 mb-1" aria-label="Breadcrumb">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <Fragment key={i}>
            {i > 0 && <ChevronRight size={11} className="text-slate-300 flex-shrink-0" />}
            {item.href && !isLast ? (
              <Link
                to={item.href}
                className="text-label text-slate-400 hover:text-slate-600 transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={`text-label ${isLast ? "text-slate-500 font-medium" : "text-slate-400"}`}>
                {item.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

// ═══ PAGE HEADER ═══
export function PageHeader({
  title,
  description,
  breadcrumb,
  children,
}: {
  title: string;
  description?: string;
  breadcrumb?: Array<{ label: string; href?: string }>;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5 pb-4 border-b border-slate-100">
      {breadcrumb && <Breadcrumb items={breadcrumb} />}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[18px] font-bold text-brand-navy tracking-tight">{title}</h1>
          {description && <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>}
        </div>
        {children && <div className="flex items-center gap-2 flex-shrink-0">{children}</div>}
      </div>
    </div>
  );
}

// ═══ STAT CARD (clickable) ═══
export function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  change,
  changeType,
  accent = "#0ea5e9",
  to,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  subtitle?: string;
  change?: string;
  changeType?: "up" | "down";
  accent?: string;
  to?: string;
}) {
  const navigate = useNavigate();
  return (
    <div
      className={`bg-white rounded-xl p-5 border border-slate-200/80 flex flex-col gap-3 group relative overflow-hidden transition-all duration-200
        shadow-[0_1px_3px_rgba(15,23,42,0.06),0_0_0_1px_rgba(15,23,42,0.03)]
        ${to ? "cursor-pointer hover:shadow-[0_6px_20px_rgba(15,23,42,0.10),0_0_0_1px_rgba(15,23,42,0.05)] hover:-translate-y-px" : ""}`}
      onClick={() => to && navigate(to)}
    >
      {/* subtle gradient accent bar on the left */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl opacity-80"
        style={{ background: accent }}
      />
      <div className="flex justify-between items-start pl-2">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 duration-200"
          style={{ background: `${accent}18` }}
        >
          <Icon size={18} style={{ color: accent }} />
        </div>
        {change && (
          <span className={`text-[11px] font-bold flex items-center gap-1 px-2 py-0.5 rounded-full ${
            changeType === "up" ? "text-green-700 bg-green-50" :
            changeType === "down" ? "text-red-600 bg-red-50" :
            "text-slate-500 bg-slate-100"
          }`}>
            {changeType === "up" && <TrendingUp size={11} />}
            {changeType === "down" && <TrendingDown size={11} />}
            {change}
          </span>
        )}
      </div>
      <div className="pl-2">
        <div className="text-[24px] font-bold text-brand-navy leading-none tracking-tight tabular-nums">{value}</div>
        <div className="text-[12px] font-medium text-slate-500 mt-1">{label}</div>
        {subtitle && <div className="text-[11px] text-slate-500 mt-0.5">{subtitle}</div>}
      </div>
    </div>
  );
}

// ═══ EMPTY STATE ═══
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center px-4">
      <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center mb-3 ring-1 ring-slate-200">
        <Icon size={22} className="text-slate-400" />
      </div>
      <h3 className="text-[14px] font-bold text-brand-navy mb-1">{title}</h3>
      {description && <p className="text-[12px] text-slate-500 max-w-sm leading-relaxed">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

// ═══ LOADING SKELETON ═══
export function LoadingSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="flex gap-4 mb-2">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-[14px] flex-1 opacity-70" />
          ))}
        </div>
      ))}
    </div>
  );
}
