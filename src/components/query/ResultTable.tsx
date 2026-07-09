import type { QueryTable } from "@/types";

const MAX_ROWS = 20;

export default function ResultTable({ table }: { table: QueryTable }) {
  const { columns, rows } = table;
  const truncated = rows.length > MAX_ROWS;
  const displayRows = truncated ? rows.slice(0, MAX_ROWS) : rows;

  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="bg-sunken">
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
            <tr key={ri} className={ri % 2 === 0 ? "bg-card" : "bg-sunken/50"}>
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
      {truncated && (
        <div className="px-3 py-1.5 text-[11px] text-muted-foreground bg-sunken border-t border-border">
          ... and {rows.length - MAX_ROWS} more row(s)
        </div>
      )}
    </div>
  );
}
