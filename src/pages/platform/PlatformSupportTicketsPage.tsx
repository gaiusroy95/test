/**
 * Platform Support Tickets — inbox across all tenants.
 *
 * Layout mirrors the tenant Help page (master-detail), but the list is
 * cross-company and the reply flow plus a "Request Support Access" shortcut
 * are platform-only.
 *
 * The "Request Support Access" shortcut inside a thread:
 *   1. Pre-fills the SupportAccessDialog's reason with `Ticket #<id> — <subject>`
 *      so the tenant Admin sees the ticket the platform is acting on.
 *   2. Posts that reason as the inbox click handler reads via local state.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { LifeBuoy, Send, Check, MessageSquare, Clock, RefreshCw, ShieldAlert } from "lucide-react";
import { platformApi } from "@/api/client";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageComponents";
import { formatDateTime, getApiError } from "@/lib/utils";
import { toast } from "sonner";
import { SupportAccessDialog } from "@/components/platform/SupportAccessDialog";

type TicketStatus = "OPEN" | "PENDING_TENANT" | "PENDING_PLATFORM" | "CLOSED";
type Priority = "LOW" | "NORMAL" | "HIGH";

interface TicketSummary {
  ticket_id: string;
  company_id: string;
  company_name?: string | null;
  opened_by_name?: string | null;
  subject: string;
  status: TicketStatus;
  priority: Priority;
  created_at: string;
  updated_at: string;
  closed_at?: string | null;
  closed_by_kind?: "tenant" | "platform" | null;
  message_count: number;
  last_message_preview?: string | null;
  last_author_kind?: "tenant" | "platform" | null;
}

interface TicketMessage {
  message_id: string;
  author_kind: "tenant" | "platform";
  author_name?: string | null;
  author_email?: string | null;
  body: string;
  created_at: string;
}

interface TicketDetail extends TicketSummary {
  messages: TicketMessage[];
}

const STATUS_BADGE: Record<TicketStatus, string> = {
  OPEN:              "bg-amber-50 text-amber-700 border-amber-200",
  PENDING_PLATFORM:  "bg-amber-50 text-amber-700 border-amber-200",
  PENDING_TENANT:    "bg-sky-50 text-sky-700 border-sky-200",
  CLOSED:            "bg-slate-50 text-slate-500 border-slate-200",
};
const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN:              "Awaiting Reply",
  PENDING_PLATFORM:  "Awaiting Reply",
  PENDING_TENANT:    "Sent to Tenant",
  CLOSED:            "Closed",
};

export default function PlatformSupportTicketsPage() {
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"" | TicketStatus | "AWAITING">("AWAITING");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [supportDialogCompany, setSupportDialogCompany] = useState<{ id: string; name: string } | null>(null);

  const refreshList = async () => {
    setLoadingList(true);
    try {
      const res = await platformApi.listPlatformTickets();
      setTickets(res.data ?? []);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to load tickets"));
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { refreshList(); }, []);

  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    let cancelled = false;
    setLoadingDetail(true);
    platformApi.getPlatformTicket(selectedId)
      .then((res) => { if (!cancelled) setDetail(res.data); })
      .catch((err: any) => toast.error(getApiError(err, "Failed to load ticket")))
      .finally(() => { if (!cancelled) setLoadingDetail(false); });
    return () => { cancelled = true; };
  }, [selectedId]);

  const filtered = useMemo(() => {
    if (!statusFilter) return tickets;
    if (statusFilter === "AWAITING") return tickets.filter((t) => t.status === "OPEN" || t.status === "PENDING_PLATFORM");
    return tickets.filter((t) => t.status === statusFilter);
  }, [tickets, statusFilter]);

  return (
    <div className="p-6 max-w-[1600px]">
      <PageHeader
        title="Support Tickets"
        description="In-app helpdesk inbox — replies route back into the tenant's portal automatically."
        breadcrumb={[{ label: "Platform Admin", href: "/platform" }, { label: "Support Tickets" }]}
      >
        <Button onClick={refreshList} variant="outline" className="text-[13px] h-8 px-3 inline-flex items-center gap-1.5">
          <RefreshCw size={14} /> Refresh
        </Button>
      </PageHeader>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-5 lg:col-span-4">
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            {([
              { v: "AWAITING",       l: "Awaiting Us" },
              { v: "PENDING_TENANT", l: "Sent to Tenant" },
              { v: "CLOSED",         l: "Closed" },
              { v: "",               l: "All" },
            ] as { v: typeof statusFilter; l: string }[]).map(({ v, l }) => (
              <button
                key={v || "all"}
                onClick={() => setStatusFilter(v)}
                className={`text-[11px] px-2 py-1 rounded border transition-colors ${
                  statusFilter === v
                    ? "border-brand-accent bg-brand-accent/10 text-brand-accent font-semibold"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          <div className="border border-slate-200 rounded-lg bg-white max-h-[calc(100vh-220px)] overflow-y-auto">
            {loadingList ? (
              <div className="text-[12px] text-slate-400 text-center py-10">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 px-4">
                <LifeBuoy size={28} className="mx-auto text-slate-300 mb-2" />
                <p className="text-[13px] text-slate-500">No tickets in this view.</p>
              </div>
            ) : (
              filtered.map((t) => {
                const isActive = t.ticket_id === selectedId;
                return (
                  <button
                    key={t.ticket_id}
                    onClick={() => setSelectedId(t.ticket_id)}
                    className={`block w-full text-left px-3 py-2.5 border-b border-slate-100 transition-colors ${
                      isActive ? "bg-brand-accent/5" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_BADGE[t.status]}`}>
                        {STATUS_LABEL[t.status]}
                      </span>
                      {t.priority === "HIGH" && (
                        <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">High</span>
                      )}
                      <span className="text-[10px] text-slate-500 truncate">{t.company_name ?? "—"}</span>
                    </div>
                    <p className="text-[13px] font-semibold text-brand-navy truncate">{t.subject}</p>
                    {t.last_message_preview && (
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {t.last_author_kind === "platform" ? "You: " : ""}{t.last_message_preview}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1 inline-flex items-center gap-1">
                      <Clock size={10} /> {formatDateTime(t.updated_at)} · <MessageSquare size={10} /> {t.message_count}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="col-span-7 lg:col-span-8">
          {detail ? (
            <PlatformThreadView
              ticket={detail}
              loading={loadingDetail}
              onReplied={(t) => { setDetail(t); refreshList(); }}
              onClosed={(t) => { setDetail(t); refreshList(); }}
              onRequestSupportAccess={(t) =>
                setSupportDialogCompany({ id: t.company_id, name: t.company_name ?? "this tenant" })
              }
            />
          ) : (
            <div className="border border-dashed border-slate-200 rounded-lg py-20 text-center">
              <LifeBuoy size={36} className="mx-auto text-slate-300 mb-3" />
              <p className="text-[13px] text-slate-500">Select a ticket to view the conversation.</p>
            </div>
          )}
        </div>
      </div>

      {supportDialogCompany && (
        <SupportAccessDialog
          open
          onClose={() => setSupportDialogCompany(null)}
          companyId={supportDialogCompany.id}
          companyName={supportDialogCompany.name}
          presetReason={detail ? `Investigating Ticket #${detail.ticket_id.slice(0, 8)} — ${detail.subject}` : undefined}
        />
      )}
    </div>
  );
}


function PlatformThreadView({
  ticket, loading, onReplied, onClosed, onRequestSupportAccess,
}: {
  ticket: TicketDetail;
  loading: boolean;
  onReplied: (t: TicketDetail) => void;
  onClosed: (t: TicketDetail) => void;
  onRequestSupportAccess: (t: TicketDetail) => void;
}) {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket.messages.length]);

  const isClosed = ticket.status === "CLOSED";

  const handleReply = async () => {
    if (reply.trim().length < 1) return;
    setSending(true);
    try {
      const res = await platformApi.replyPlatformTicket(ticket.ticket_id, reply.trim());
      setReply("");
      onReplied(res.data);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to send reply"));
    } finally { setSending(false); }
  };

  const handleClose = async () => {
    if (!confirm("Close this ticket? The tenant can reopen it by sending another reply.")) return;
    setClosing(true);
    try {
      const res = await platformApi.closePlatformTicket(ticket.ticket_id);
      onClosed(res.data);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to close ticket"));
    } finally { setClosing(false); }
  };

  return (
    <div className="border border-slate-200 rounded-lg bg-white flex flex-col max-h-[calc(100vh-180px)]">
      <div className="px-5 py-3 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_BADGE[ticket.status]}`}>
                {STATUS_LABEL[ticket.status]}
              </span>
              {ticket.priority === "HIGH" && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200">High</span>
              )}
              <span className="text-[11px] text-slate-400">#{ticket.ticket_id.slice(0, 8)}</span>
            </div>
            <h2 className="text-[15px] font-semibold text-brand-navy">{ticket.subject}</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              <span className="font-medium">{ticket.company_name}</span> · opened by {ticket.opened_by_name ?? "—"} · {formatDateTime(ticket.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={() => onRequestSupportAccess(ticket)}
              className="text-[12px] h-7 px-3 inline-flex items-center gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50"
              title="Open the Support Access flow with this ticket pre-filled as the reason"
            >
              <ShieldAlert size={12} /> Request Support Access
            </Button>
            {!isClosed && (
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={closing}
                className="text-[12px] h-7 px-3 inline-flex items-center gap-1.5"
              >
                <Check size={12} /> {closing ? "Closing…" : "Close"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {loading ? (
          <div className="text-[12px] text-slate-400 text-center py-10">Loading…</div>
        ) : ticket.messages.length === 0 ? (
          <div className="text-[12px] text-slate-400 text-center py-10">No messages.</div>
        ) : (
          ticket.messages.map((m) => <MessageBubble key={m.message_id} m={m} />)
        )}
        {isClosed && (
          <div className="text-center py-3">
            <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
              <Check size={12} /> Closed by {ticket.closed_by_kind === "platform" ? "you" : "tenant"} · {ticket.closed_at ? formatDateTime(ticket.closed_at) : ""}
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-slate-100 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={2}
            placeholder={isClosed ? "Replying will reopen this ticket…" : "Type your reply to the tenant…"}
            maxLength={5000}
            className="flex-1 py-2 px-3 text-[13px] text-brand-navy border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-accent resize-none"
          />
          <Button
            onClick={handleReply}
            disabled={sending || reply.trim().length === 0}
            className="bg-brand-accent hover:bg-brand-accentDk text-white text-[13px] h-9 px-4 inline-flex items-center gap-1.5"
          >
            <Send size={14} /> {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}


function MessageBubble({ m }: { m: TicketMessage }) {
  const isMe = m.author_kind === "platform";
  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-lg px-3.5 py-2 ${
        isMe ? "bg-violet-50 border border-violet-200" : "bg-brand-accent/10 border border-brand-accent/20"
      }`}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[11px] font-semibold ${isMe ? "text-violet-800" : "text-brand-navy"}`}>
            {m.author_name ?? m.author_email ?? (isMe ? "You" : "Tenant")}
          </span>
          {!isMe && (
            <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">Tenant</span>
          )}
          <span className="text-[10px] text-slate-400">{formatDateTime(m.created_at)}</span>
        </div>
        <p className="text-[12.5px] text-slate-700 whitespace-pre-wrap break-words">{m.body}</p>
      </div>
    </div>
  );
}
