interface Props {
  suggestions: string[];
  onSelect: (text: string) => void;
  disabled?: boolean;
}

export default function SuggestionChips({ suggestions, onSelect, disabled }: Props) {
  if (!suggestions.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5 w-full">
      {suggestions.map((s, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(s)}
          disabled={disabled}
          className="px-2.5 py-1.5 rounded-md text-[12px] font-medium border border-border text-foreground bg-card hover:bg-sunken hover:border-primary/40 hover:text-primary disabled:opacity-40 transition-colors text-left"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
