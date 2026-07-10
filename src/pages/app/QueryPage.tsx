import { useEffect, useState, useRef, useCallback } from "react";
import { tenantApi } from "@/api/client";
import { PageShell } from "@/components/shared/PageShell";
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

  useEffect(() => {
    tenantApi.getQuerySuggestions().then((r) => setInitialSuggestions(r.data)).catch(() => {});
    tenantApi.getQueryEngineInfo().then((r) => setEngineTier(r.data.engine)).catch(() => {});
  }, []);

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
    <PageShell
      title="Ask ESMOS"
      description="Ask questions about your ESG data in plain English"
      breadcrumb={[{ label: "Company Portal", href: "/app" }, { label: "Ask ESMOS" }]}
      fullWidth
      className="flex flex-col flex-1 min-h-0 !pb-0 pt-3 [&_.page-header]:mb-2"
      actions={
        isLLM ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-accent text-accent-foreground border border-border">
            <Sparkles size={12} />
            AI Powered
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-sunken text-muted-foreground border border-border">
            <Cpu size={12} />
            Standard
          </span>
        )
      }
    >
      <div className="flex-1 flex flex-col min-h-0 border border-border rounded-md bg-card overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 px-4 py-4 sm:px-6">
          <div className="w-full max-w-3xl mx-auto space-y-4">
            {isEmpty && (
              <div className="flex flex-col items-start text-left space-y-4 pt-2">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${isLLM ? "bg-accent" : "bg-primary/10"}`}>
                    {isLLM ? <Sparkles size={18} className="text-accent-foreground" /> : <Bot size={18} className="text-primary" />}
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-foreground">What would you like to know?</h3>
                    <p className="text-[12px] text-muted-foreground mt-0.5">
                      Ask about totals, rankings, trends, comparisons, or breakdowns. Only approved data is included.
                    </p>
                  </div>
                </div>
                <SuggestionChips suggestions={initialSuggestions} onSelect={handleSend} disabled={loading} />
              </div>
            )}

            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} onSuggestionClick={handleSend} loading={loading} />
            ))}

            {loading && (
              <div className="flex gap-3" role="status" aria-live="polite" aria-busy="true">
                <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${isLLM ? "bg-accent" : "bg-sunken"}`}>
                  {isLLM ? <Sparkles size={15} className="text-accent-foreground" /> : <Bot size={15} className="text-muted-foreground" />}
                </div>
                <div className="rounded-md px-3 py-2.5 border border-border bg-sunken/40">
                  <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                    <Loader2 size={14} className="animate-spin" />
                    {isLLM ? "AI is analyzing your question…" : "Analyzing your data…"}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 border-t border-border bg-card">
          <div className="w-full max-w-3xl mx-auto">
            <ChatInput onSend={handleSend} disabled={loading} />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
