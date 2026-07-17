import * as XLSX from "xlsx";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import type { QueryTable } from "@/types";

const MAX_ROWS = 20;

export default function ResultTable({ table }: { table: QueryTable }) {
  const { columns, rows } = table;
  const truncated = rows.length > MAX_ROWS;
  const displayRows = truncated ? rows.slice(0, MAX_ROWS) : rows;

  const exportExcel = () => {
    if (rows.length === 0) {
      toast.error("No data to export");
      return;
    }
    const sheetRows = rows.map((row) => {
      const obj: Record<string, string | number | null> = {};
      columns.forEach((col, i) => {
        obj[col] = row[i] ?? null;
      });
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Query Result");
    XLSX.writeFile(wb, "ask-esmos-table.xlsx");
    toast.success("Exported to Excel");
  };

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-border">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-sunken border-b border-border">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          Data table
        </span>
        <button
          type="button"
          title="Export Excel"
          onClick={exportExcel}
          className="p-1 rounded-md text-ok hover:bg-ok-tint transition-colors"
        >
          <FileSpreadsheet size={14} />
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-card">
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={`px-3 py-2 font-semibold text-muted-foreground border-b border-border whitespace-nowrap ${
                    i > 0 ? "text-right" : "text-left"
                  }`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? "tone-b" : "tone-a"}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`px-3 py-1.5 text-foreground/90 border-b border-[hsl(var(--border-hairline))] whitespace-nowrap ${
                      ci > 0 ? "text-right font-mono" : "text-left"
                    }`}
                  >
                    {cell ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {truncated && (
        <div className="px-3 py-1.5 text-[11px] text-muted-foreground bg-sunken border-t border-border">
          ... and {rows.length - MAX_ROWS} more row(s)
        </div>
      )}
    </div>
  );
}
