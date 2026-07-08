import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight, Inbox, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/PageComponents";

interface DataTablePagination {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

interface DataTableProps {
  /** Optional search */
  search?: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
  };
  /** Optional filter controls rendered next to search */
  filters?: React.ReactNode;
  /** Optional primary action (e.g. Add button) */
  actions?: React.ReactNode;
  /** Loading state — shows skeleton */
  loading?: boolean;
  /** Empty state when no rows */
  empty?: {
    icon?: LucideIcon;
    title: string;
    description?: string;
    children?: React.ReactNode;
  };
  /** Pagination footer */
  pagination?: DataTablePagination;
  /** Table / content */
  children?: React.ReactNode;
  className?: string;
  /** Number of skeleton columns when loading */
  skeletonCols?: number;
  skeletonRows?: number;
}

/**
 * DataTable — shared list-page pattern:
 * optional toolbar (search / filters / actions) + surface + table + pagination + empty/loading.
 */
export function DataTable({
  search,
  filters,
  actions,
  loading,
  empty,
  pagination,
  children,
  className,
  skeletonCols = 5,
  skeletonRows = 8,
}: DataTableProps) {
  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : 1;

  const hasToolbar = search || filters || actions;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {hasToolbar && (
        <div className="flex items-center gap-2 flex-wrap">
          {search && (
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                aria-hidden="true"
              />
              <Input
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={search.placeholder || "Search…"}
                className="pl-8 w-[220px] h-8 text-xs"
                aria-label={search.placeholder || "Search"}
              />
            </div>
          )}
          {filters}
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </div>
      )}

      <div className="surface overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            <div className="flex gap-4 mb-2">
              {Array.from({ length: skeletonCols }).map((_, i) => (
                <Skeleton key={i} className="h-4 flex-1" />
              ))}
            </div>
            {Array.from({ length: skeletonRows }).map((_, r) => (
              <div key={r} className="flex gap-4">
                {Array.from({ length: skeletonCols }).map((_, c) => (
                  <Skeleton key={c} className="h-3.5 flex-1 opacity-70" />
                ))}
              </div>
            ))}
          </div>
        ) : empty ? (
          <EmptyState
            icon={empty.icon || Inbox}
            title={empty.title}
            description={empty.description}
          >
            {empty.children}
          </EmptyState>
        ) : (
          <>
            {children}
            {pagination && pagination.total > pagination.pageSize && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-[hsl(var(--border-hairline))]">
                <span className="text-xs text-muted-foreground">
                  Showing{" "}
                  {(pagination.page - 1) * pagination.pageSize + 1}–
                  {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
                  {pagination.total}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={pagination.page <= 1}
                    onClick={() => pagination.onPageChange(pagination.page - 1)}
                    aria-label="Previous page"
                  >
                    <ChevronLeft size={15} />
                  </Button>
                  <span className="px-3 text-xs font-semibold text-foreground tabular-nums">
                    {pagination.page} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={pagination.page >= totalPages}
                    onClick={() => pagination.onPageChange(pagination.page + 1)}
                    aria-label="Next page"
                  >
                    <ChevronRight size={15} />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
