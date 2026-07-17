import { useEffect, useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { tenantApi } from "@/api/client";
import { PageShell } from "@/components/shared/PageShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Bot, Loader2, Cpu, Sparkles, FileDown, FileSpreadsheet, ArrowUp, MessageSquare, Lightbulb,
} from "lucide-react";
import type { ChatMessage as ChatMessageType, QueryResponse, ReportingYear } from "@/types";
import ChatMessage from "@/components/query/ChatMessage";
import ChatInput from "@/components/query/ChatInput";
import SuggestionChips from "@/components/query/SuggestionChips";
import { cn, getApiError } from "@/lib/utils";

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

type WorkspaceTab = "ask" | "suggested";

export default function QueryPage() {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialSuggestions, setInitialSuggestions] = useState<string[]>([]);
  const [lastUserQuestion, setLastUserQuestion] = useState<string>("");
  const [engineTier, setEngineTier] = useState<"RULE_BASED" | "LLM">("RULE_BASED");
  const [tab, setTab] = useState<WorkspaceTab>("ask");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [brsrLoading, setBrsrLoading] = useState(false);
  const [reportingYears, setReportingYears] = useState<ReportingYear[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    tenantApi.getQuerySuggestions().then((r) => setInitialSuggestions(r.data)).catch(() => {});
    tenantApi.getQueryEngineInfo().then((r) => setEngineTier(r.data.engine)).catch(() => {});
    tenantApi.listReportingYears().then((r) => setReportingYears(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === "ask" && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, tab]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // First fold ≈ viewport height of the scroll container
    setShowScrollTop(el.scrollTop > el.clientHeight * 0.85);
  }, []);

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const latestYearId = reportingYears.length
    ? reportingYears[reportingYears.length - 1]?.year_id
    : undefined;

  const downloadBrsr = async () => {
    if (!latestYearId) {
      toast.error("No reporting year available for BRSR.");
      return;
    }
    setBrsrLoading(true);
    try {
      toast.info("Generating BRSR report…");
      const res = await tenantApi.downloadBrsrReport(Number(latestYearId));
      const disposition = (res.headers?.["content-disposition"] as string) || "";
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const filename = match ? match[1] : `BRSR_${latestYearId}.xlsx`;
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("BRSR report downloaded");
    } catch (err: unknown) {
      toast.error(getApiError(err, "Failed to generate BRSR report"));
    } finally {
      setBrsrLoading(false);
    }
  };

  const exportConversation = () => {
    if (messages.length === 0) {
      toast.error("No conversation to export");
      return;
    }
    const rows: Record<string, unknown>[] = [];
    for (const msg of messages) {
      rows.push({
        Role: msg.role === "user" ? "You" : "ESMOS",
        Content: msg.content,
        Time: msg.timestamp.toISOString(),
      });
      if (msg.table?.rows?.length) {
        msg.table.rows.forEach((row, ri) => {
          const obj: Record<string, unknown> = {
            Role: "Table",
            Content: `Row ${ri + 1}`,
            Time: "",
          };
          msg.table!.columns.forEach((col, ci) => {
            obj[col] = row[ci] ?? "";
          });
          rows.push(obj);
        });
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Conversation");
    XLSX.writeFile(wb, "ask-esmos-conversation.xlsx");
    toast.success("Exported to Excel");
  };

  const handleSend = useCallback(
    async (question: string) => {
      setTab("ask");
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
      } catch (err: unknown) {
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
        <div className="flex items-center gap-2">
          {isLLM ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-accent text-accent-foreground border border-border">
              <Sparkles size={12} />
              AI Powered
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-sunken text-muted-foreground border border-border">
              <Cpu size={12} />
              Standard
            </span>
          )}
          <Button
            size="sm"
            onClick={downloadBrsr}
            disabled={brsrLoading || !latestYearId}
            title={latestYearId ? "Download BRSR workbook" : "No reporting year available"}
          >
            <FileDown size={13} />
            {brsrLoading ? "Generating…" : "Generate BRSR"}
          </Button>
          <button
            type="button"
            title="Export conversation Excel"
            onClick={exportConversation}
            disabled={messages.length === 0}
            className="p-1.5 rounded-md text-ok hover:bg-ok-tint transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            <FileSpreadsheet size={14} />
          </button>
        </div>
      }
    >
      <div className="flex-1 flex flex-col min-h-0 relative">
        {/* Sticky sub-tab bar */}
        <div className="sticky top-0 z-30 -mx-1 px-1 mb-3 bg-background/95 backdrop-blur-sm border-b border-border pb-2">
          <div role="tablist" className="config-tabs" aria-label="Ask ESMOS views">
            {([
              { key: "ask" as WorkspaceTab, label: "Ask", icon: MessageSquare },
              { key: "suggested" as WorkspaceTab, label: "Suggested", icon: Lightbulb },
            ]).map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={cn("config-tab", tab === t.key && "config-tab-active")}
              >
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto min-h-0 px-1"
        >
          <div className="w-full max-w-[560px] mx-auto space-y-4 pb-4">
            {tab === "suggested" && (
              <div className="space-y-3 pt-1">
                <div>
                  <h3 className="text-[15px] font-bold text-foreground">Suggested queries</h3>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    Tap a prompt to run it instantly. Only approved data is included.
                  </p>
                </div>
                <SuggestionChips
                  suggestions={initialSuggestions}
                  onSelect={handleSend}
                  disabled={loading}
                />
              </div>
            )}

            {tab === "ask" && (
              <>
                {isEmpty && (
                  <div className="flex flex-col items-start text-left space-y-4 pt-1">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${isLLM ? "bg-accent" : "bg-primary/10"}`}>
                        {isLLM ? <Sparkles size={18} className="text-accent-foreground" /> : <Bot size={18} className="text-primary" />}
                      </div>
                      <div>
                        <h3 className="text-[15px] font-bold text-foreground">What would you like to know?</h3>
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                          Ask about totals, rankings, trends, comparisons, or breakdowns.
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
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${isLLM ? "bg-accent" : "bg-[#F8F9FA]"}`}>
                      {isLLM ? <Sparkles size={15} className="text-accent-foreground" /> : <Bot size={15} className="text-muted-foreground" />}
                    </div>
                    <div className="rounded-lg px-3 py-2.5 bg-[#F8F9FA]">
                      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                        <Loader2 size={14} className="animate-spin" />
                        {isLLM ? "AI is analyzing your question…" : "Analyzing your data…"}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Constrained continuous input strip */}
        <div className="flex-shrink-0 border-t border-border/60 bg-background/90 backdrop-blur-sm">
          <div className="w-full max-w-[560px] mx-auto px-1 py-3">
            <ChatInput onSend={handleSend} disabled={loading} />
          </div>
        </div>

        {/* Scroll to top — after first fold */}
        {showScrollTop && (
          <button
            type="button"
            onClick={scrollToTop}
            title="Scroll to top"
            aria-label="Scroll to top"
            className="absolute bottom-24 right-4 z-40 w-10 h-10 rounded-full bg-card border border-border shadow-md flex items-center justify-center text-foreground hover:bg-sunken transition-colors"
          >
            <ArrowUp size={18} />
          </button>
        )}
      </div>
    </PageShell>
  );
}
