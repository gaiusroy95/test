import { useState, useRef } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <div className="flex items-center gap-2 px-4 py-2.5 sm:px-6">
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
        placeholder="Ask about your ESG data…"
        maxLength={500}
        disabled={disabled}
        className="flex-1 h-9 px-3 rounded-md border border-border bg-background text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 transition-colors"
      />
      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={disabled || !text.trim()}
        className="h-9 w-9 p-0 shrink-0"
        aria-label="Send"
      >
        <Send size={15} />
      </Button>
    </div>
  );
}
