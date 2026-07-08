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
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser
            ? "bg-brand-accent text-white"
            : "bg-slate-100 text-slate-500"
        }`}
      >
        {isUser ? <User size={15} /> : <Bot size={15} />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
            isUser
              ? "bg-brand-accent text-white rounded-tr-md"
              : "bg-white border border-slate-200 text-brand-navy rounded-tl-md shadow-sm"
          }`}
        >
          {/* Engine badge (system messages only) */}
          {!isUser && message.engine_used && (
            <div className="flex items-center gap-1 mb-2">
              {message.engine_used === "LLM" ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                  <Sparkles size={9} /> AI Powered
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
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
          <SuggestionChips
            suggestions={message.suggestions}
            onSelect={onSuggestionClick}
            disabled={loading}
          />
        )}

        {/* Timestamp */}
        <div className={`text-[10px] text-slate-400 mt-1 ${isUser ? "text-right" : "text-left"}`}>
          {message.timestamp.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}
