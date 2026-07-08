import { useEffect, useState, useRef, useCallback } from "react";
import { tenantApi } from "@/api/client";
import { PageHeader } from "@/components/shared/PageComponents";
import { toast } from "sonner";
import { Bot, Loader2, Cpu, Sparkles } from "lucide-react";
import type { ChatMessage as ChatMessageType, QueryResponse } from "@/types";
import ChatMessage from "@/components/query/ChatMessage";
import ChatInput from "@/components/query/ChatInput";
import SuggestionChips from "@/components/query/SuggestionChips";
import { getApiError } from "@/lib/utils";


function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function QueryPage() {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialSuggestions, setInitialSuggestions] = useState<string[]>([]);
  const [lastUserQuestion, setLastUserQuestion] = useState<string>("");
  const [engineTier, setEngineTier] = useState<"RULE_BASED" | "LLM">("RULE_BASED");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load initial suggestions + engine tier
  useEffect(() => {
    tenantApi.getQuerySuggestions().then((r) => setInitialSuggestions(r.data)).catch(() => {});
    tenantApi.getQueryEngineInfo().then((r) => setEngineTier(r.data.engine)).catch(() => {});
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = useCallback(
    async (question: string) => {
      const userMsg: ChatMessageType = {
        id: uid(),
        role: "user",
        content: question,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);

      const context = lastUserQuestion;
      setLastUserQuestion(question);

      try {
        const res = await tenantApi.askQuery(question, context || undefined);
        const data: QueryResponse = res.data;

        const systemMsg: ChatMessageType = {
          id: uid(),
          role: "system",
          content: data.answer,
          table: data.table || undefined,
          chart: data.chart || undefined,
          suggestions: data.suggestions,
          engine_used: data.metadata?.engine_used,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, systemMsg]);
      } catch (err: any) {
        const systemMsg: ChatMessageType = {
          id: uid(),
          role: "system",
          content: getApiError(err, "Sorry, something went wrong. Please try again."),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, systemMsg]);
      } finally {
        setLoading(false);
      }
    },
    [lastUserQuestion],
  );

  const isEmpty = messages.length === 0;
  const isLLM = engineTier === "LLM";

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-w-[900px] mx-auto">
      {/* Header */}
      <div className="px-6 pt-6 pb-2 flex items-start justify-between">
        <PageHeader
          title="Ask ESMOS"
          description="Ask questions about your ESG data in plain English"
          breadcrumb={[{ label: "Company Portal", href: "/app" }, { label: "Ask ESMOS" }]}
        />
        {/* Engine tier badge */}
        <div className="mt-1 flex-shrink-0">
          {isLLM ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-violet-100 text-violet-700 border border-violet-200">
              <Sparkles size={12} />
              AI Powered
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
              <Cpu size={12} />
              Standard
            </span>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isLLM ? "bg-violet-100" : "bg-brand-accent/10"}`}>
              {isLLM ? <Sparkles size={22} className="text-violet-600" /> : <Bot size={22} className="text-brand-accent" />}
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-brand-navy">
                What would you like to know?
              </h3>
              <p className="text-[12px] text-slate-500 mt-1 max-w-md">
                Ask about totals, rankings, trends, comparisons, or breakdowns of your ESG data.
                Only approved data is included in results.
              </p>
              {isLLM && (
                <p className="text-[12px] text-violet-600 mt-2">
                  AI Powered — understands natural phrasing. First response may take up to 60 seconds.
                </p>
              )}
            </div>
            <SuggestionChips
              suggestions={initialSuggestions}
              onSelect={handleSend}
              disabled={loading}
            />
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            message={msg}
            onSuggestionClick={handleSend}
            loading={loading}
          />
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isLLM ? "bg-violet-100" : "bg-slate-100"}`}>
              {isLLM ? <Sparkles size={15} className="text-violet-600" /> : <Bot size={15} className="text-slate-500" />}
            </div>
            <div className="rounded-2xl rounded-tl-md px-4 py-3 bg-white border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 text-[13px] text-slate-400">
                <Loader2 size={14} className="animate-spin" />
                {isLLM ? "AI is analyzing your question…" : "Analyzing your data..."}
              </div>
              {isLLM && (
                <p className="text-[11px] text-slate-300 mt-1">
                  This may take up to 60 seconds on first query
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input bar (pinned bottom) */}
      <ChatInput onSend={handleSend} disabled={loading} />
    </div>
  );
}
