import { User, Bot, Sparkles, Cpu } from "lucide-react";
import type { ChatMessage as ChatMessageType } from "@/types";
import ResultTable from "./ResultTable";
import QueryChart from "./QueryChart";
import SuggestionChips from "./SuggestionChips";

interface Props {
  message: ChatMessageType;
  onSuggestionClick: (text: string) => void;
  loading?: boolean;
}

export default function ChatMessage({ message, onSuggestionClick, loading }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${
          isUser
            ? "bg-primary text-white"
            : "bg-sunken text-muted-foreground border border-border"
        }`}
      >
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[min(100%,42rem)] min-w-0 ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-md px-3 py-2 text-[13px] leading-relaxed ${
            isUser
              ? "bg-primary text-white"
              : "bg-card border border-border text-foreground"
          }`}
        >
          {/* Engine badge (system messages only) */}
          {!isUser && message.engine_used && (
            <div className="flex items-center gap-1 mb-1.5">
              {message.engine_used === "LLM" ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-accent text-accent-foreground">
                  <Sparkles size={9} /> AI Powered
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-sunken text-muted-foreground">
                  <Cpu size={9} /> Standard
                </span>
              )}
            </div>
          )}

          {/* Answer text — support newlines */}
          <div className="whitespace-pre-line">{message.content}</div>

          {/* Chart */}
          {message.chart && <QueryChart chart={message.chart} />}

          {/* Table */}
          {message.table && <ResultTable table={message.table} />}
        </div>

        {/* Suggestion chips (only for system messages) */}
        {!isUser && message.suggestions && message.suggestions.length > 0 && (
          <div className="mt-2">
            <SuggestionChips
              suggestions={message.suggestions}
              onSelect={onSuggestionClick}
              disabled={loading}
            />
          </div>
        )}

        {/* Timestamp */}
        <div className={`text-[10px] text-muted-foreground mt-1 ${isUser ? "text-right" : "text-left"}`}>
          {message.timestamp.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}
