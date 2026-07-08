import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { MODULE_ICON_MAP, getModuleIcon } from "@/lib/constants";

// Curated categories — only domain/concept icons, no action/utility icons.
// Never add Trash2, Edit, X, Check etc. — those mean "delete/edit/close" in UI context.
const CATEGORIES: { label: string; icons: string[] }[] = [
  {
    label: "Environment",
    icons: [
      "Zap", "Flame", "Sun", "Wind", "Waves", "Droplets",
      "Leaf", "Thermometer", "Recycle", "Factory", "TreePine", "CloudRain",
    ],
  },
  {
    label: "Operations",
    icons: [
      "Truck", "Globe", "Package2", "Network", "BarChart3", "Gauge",
      "Activity", "TrendingUp", "Building2", "FlaskConical", "Cpu", "Database",
    ],
  },
  {
    label: "People",
    icons: [
      "Users", "UserCheck", "Heart", "GraduationCap",
      "Briefcase", "HeartHandshake", "Scale", "UserCog",
    ],
  },
  {
    label: "Governance",
    icons: [
      "Shield", "Target", "ClipboardCheck", "BookOpen",
      "FileText", "Award", "Flag", "Lock", "Eye", "FileCheck", "Landmark",
    ],
  },
];

interface Props {
  value: string;
  onChange: (name: string) => void;
  accentColor?: string;
}

export default function IconPicker({ value, onChange, accentColor = "#0ea5e9" }: Props) {
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState(() => {
    const idx = CATEGORIES.findIndex((c) => c.icons.includes(value));
    return idx >= 0 ? idx : 0;
  });

  const CurrentIcon = getModuleIcon(value);

  return (
    <div>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-300 bg-white text-[13px] text-slate-600 transition-colors"
      >
        <CurrentIcon size={16} style={{ color: accentColor }} />
        <span className="font-medium">{value || "Choose icon"}</span>
        <ChevronDown
          size={13}
          className={`ml-1 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Inline expanding panel */}
      {open && (
        <div className="mt-2 border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
          {/* Category tabs */}
          <div className="flex border-b border-slate-100">
            {CATEGORIES.map((c, i) => (
              <button
                key={c.label}
                type="button"
                onClick={() => setCat(i)}
                className={`flex-1 py-2 text-[11px] font-semibold transition-colors border-b-2 -mb-px ${
                  cat === i
                    ? "text-brand-accent border-brand-accent"
                    : "text-slate-400 border-transparent hover:text-slate-600"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Icon grid */}
          <div className="p-3 grid grid-cols-8 gap-1">
            {CATEGORIES[cat].icons.map((name) => {
              const Icon = MODULE_ICON_MAP[name];
              if (!Icon) return null;
              const sel = value === name;
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={() => { onChange(name); setOpen(false); }}
                  className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
                    sel ? "ring-2 ring-offset-1 ring-slate-300" : "hover:bg-slate-100"
                  }`}
                  style={sel ? { background: accentColor + "18" } : {}}
                >
                  <Icon size={18} style={{ color: sel ? accentColor : "#64748b" }} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
