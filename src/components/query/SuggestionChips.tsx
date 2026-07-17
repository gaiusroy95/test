import { cn } from "@/lib/utils";

interface Props {
  suggestions: string[];
  onSelect: (text: string) => void;
  disabled?: boolean;
}

/** Vertical clear-pill list with alternating soft tones (no outlines). */
export default function SuggestionChips({ suggestions, onSelect, disabled }: Props) {
  if (!suggestions.length) return null;

  return (
    <div className="flex flex-col w-full max-w-[560px] rounded-md overflow-hidden" role="list">
      {suggestions.map((s, i) => (
        <button
          key={i}
          type="button"
          role="listitem"
          onClick={() => onSelect(s)}
          disabled={disabled}
          className={cn(
            "w-full px-3.5 py-2.5 text-left text-[13px] font-medium text-foreground",
            "transition-colors disabled:opacity-40",
            "hover:bg-primary/5 hover:text-primary",
            i % 2 === 0 ? "bg-[#F8F9FA]" : "bg-white",
          )}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
