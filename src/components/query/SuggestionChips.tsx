interface Props {
  suggestions: string[];
  onSelect: (text: string) => void;
  disabled?: boolean;
}

export default function SuggestionChips({ suggestions, onSelect, disabled }: Props) {
  if (!suggestions.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onSelect(s)}
          disabled={disabled}
          className="px-3 py-1.5 rounded-full text-[12px] font-medium border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 hover:border-primary/50 disabled:opacity-40 transition-colors"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
