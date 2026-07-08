import { useState, useRef } from "react";
import { Send } from "lucide-react";

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    inputRef.current?.focus();
  };

  return (
    <div className="flex items-center gap-2 p-3 border-t border-slate-200 bg-white">
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
        placeholder="Ask about your ESG data..."
        maxLength={500}
        disabled={disabled}
        className="flex-1 h-10 px-4 rounded-lg border border-slate-200 bg-slate-50 text-[13px] text-brand-navy placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-accent/30 focus:border-brand-accent disabled:opacity-50 transition-colors"
      />
      <button
        onClick={handleSubmit}
        disabled={disabled || !text.trim()}
        className="w-10 h-10 rounded-lg bg-brand-accent text-white flex items-center justify-center hover:bg-brand-accent/90 disabled:opacity-40 transition-colors flex-shrink-0"
      >
        <Send size={16} />
      </button>
    </div>
  );
}
