import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
  PieChart, Pie, Cell,
} from "recharts";
import type { QueryChart as QueryChartType } from "@/types";

const PIE_COLORS = ["#0ea5e9", "#14b8a6", "#8b5cf6", "#f59e0b", "#ef4444", "#10b981", "#f97316"];

function fmtVal(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return v.toFixed(2);
}

function tickFmt(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toFixed(0);
}

interface Props {
  chart: QueryChartType;
}

export default function QueryChart({ chart }: Props) {
  const { type, data, unit } = chart;
  const rechartData = data.map((d) => ({ name: d.label, value: d.value }));
  const unitSuffix = unit ? ` ${unit}` : "";

  const tooltipFormatter = (v: number) => [`${fmtVal(v)}${unitSuffix}`, "Value"] as [string, string];

  if (type === "line") {
    return (
      <div className="mt-4 h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rechartData} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={tickFmt} tick={{ fontSize: 10 }} width={46} />
            <Tooltip formatter={tooltipFormatter} />
            <Line type="monotone" dataKey="value" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3, fill: "#0ea5e9" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === "bar") {
    return (
      <div className="mt-4 h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rechartData} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tickFormatter={tickFmt} tick={{ fontSize: 10 }} width={46} />
            <Tooltip formatter={tooltipFormatter} />
            <Bar dataKey="value" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === "bar_h") {
    return (
      <div className="mt-4 h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rechartData} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" tickFormatter={tickFmt} tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
            <Tooltip formatter={tooltipFormatter} />
            <Bar dataKey="value" fill="#14b8a6" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Pie / donut
  const RADIAN = Math.PI / 180;
  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    if (percent < 0.05) return null; // skip tiny slices
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={600}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="mt-4 h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={rechartData}
            dataKey="value"
            nameKey="name"
            cx="40%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            labelLine={false}
            label={renderLabel}
          >
            {rechartData.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => [`${fmtVal(v)}${unitSuffix}`]} />
          {/* Legend to the right */}
          <text x="82%" y="30%" textAnchor="middle" fontSize={10} fill="#64748b" fontWeight={600}>
            Legend
          </text>
          {rechartData.map((d, i) => (
            <g key={i}>
              <rect
                x="79%"
                y={`${35 + i * 14}%`}
                width={8}
                height={8}
                fill={PIE_COLORS[i % PIE_COLORS.length]}
                rx={2}
              />
              <text x="83%" y={`${36 + i * 14}%`} fontSize={9.5} fill="#475569" dominantBaseline="middle">
                {d.name.length > 14 ? d.name.slice(0, 13) + "…" : d.name}
              </text>
            </g>
          ))}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
