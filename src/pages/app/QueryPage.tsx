import { useEffect, useState, useRef, useCallback } from "react";
import { tenantApi } from "@/api/client";
import { PageShell } from "@/components/shared/PageShell";
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
      className="flex flex-col h-[calc(100vh-var(--header-height,3.5rem))] max-w-[1000px] mx-auto !py-0"
      actions={
        isLLM ? (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-accent text-accent-foreground border border-accent-foreground/20 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800">
            <Sparkles size={12} />
            AI Powered
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-sunken text-muted-foreground border border-border">
            <Cpu size={12} />
            Standard
          </span>
        )
      }
    >
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-5 min-h-0">
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isLLM ? "bg-accent dark:bg-violet-950" : "bg-primary/10"}`}>
              {isLLM ? <Sparkles size={22} className="text-accent-foreground" /> : <Bot size={22} className="text-primary" />}
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-foreground">What would you like to know?</h3>
              <p className="text-[12px] text-muted-foreground mt-1 max-w-md">
                Ask about totals, rankings, trends, comparisons, or breakdowns of your ESG data.
                Only approved data is included in results.
              </p>
            </div>
            <SuggestionChips suggestions={initialSuggestions} onSelect={handleSend} disabled={loading} />
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} onSuggestionClick={handleSend} loading={loading} />
        ))}

        {loading && (
          <div className="flex gap-3" role="status" aria-live="polite" aria-busy="true">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isLLM ? "bg-accent" : "bg-sunken"}`}>
              {isLLM ? <Sparkles size={15} className="text-accent-foreground" /> : <Bot size={15} className="text-muted-foreground" />}
            </div>
            <div className="rounded-2xl rounded-tl-md px-4 py-3 surface-elevated">
              <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Loader2 size={14} className="animate-spin" />
                {isLLM ? "AI is analyzing your question…" : "Analyzing your data..."}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-border bg-card/80 backdrop-blur-sm">
        <ChatInput onSend={handleSend} disabled={loading} />
      </div>
    </PageShell>
  );
}
