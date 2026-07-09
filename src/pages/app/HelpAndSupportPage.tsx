/**
 * Help & Support — tenant-side helpdesk inbox.
 *
 * V1 layout: master-detail. Left column lists this company's tickets;
 * right column shows the selected thread or the "New ticket" form.
 *
 * Status mechanics live in the backend service: every reply flips the status
 * (tenant reply → PENDING_PLATFORM, platform reply → PENDING_TENANT). We just
 * render the badges and refetch after writes.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { LifeBuoy, Plus, Send, Check, X, AlertCircle, MessageSquare, Clock, RefreshCw } from "lucide-react";
import { tenantApi } from "@/api/client";
import { PageShell } from "@/components/shared/PageShell";
import { Button } from "@/components/ui/button";
import { useIsSupportSession } from "@/components/shared/WriteOnly";
import { formatDateTime, getApiError } from "@/lib/utils";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";

type TicketStatus = "OPEN" | "PENDING_TENANT" | "PENDING_PLATFORM" | "CLOSED";
type Priority = "LOW" | "NORMAL" | "HIGH";

interface TicketSummary {
  ticket_id: string;
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
  opened_by_name?: string | null;
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
  OPEN:              "bg-warn-tint text-warn border-warn/30",
  PENDING_PLATFORM:  "bg-warn-tint text-warn border-warn/30",
  PENDING_TENANT:    "bg-info-tint text-info border-info/30",
  CLOSED:            "bg-sunken text-muted-foreground border-border",
};
const STATUS_LABEL: Record<TicketStatus, string> = {
  OPEN:              "Awaiting Platform",
  PENDING_PLATFORM:  "Awaiting Platform",
  PENDING_TENANT:    "Action Required",
  CLOSED:            "Closed",
};

export default function HelpAndSupportPage() {
  const { user } = useAuthStore();
  const isSupport = useIsSupportSession();
  const isReadOnly = user?.role === "AUDITOR" || isSupport;

  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"" | TicketStatus | "OPEN_ALL">("OPEN_ALL");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [composeOpen, setComposeOpen] = useState(false);

  const refreshList = async () => {
    setLoadingList(true);
    try {
      const res = await tenantApi.listMyTickets();
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
    tenantApi.getTicket(selectedId)
      .then((res) => { if (!cancelled) setDetail(res.data); })
      .catch((err: any) => toast.error(getApiError(err, "Failed to load ticket")))
      .finally(() => { if (!cancelled) setLoadingDetail(false); });
    return () => { cancelled = true; };
  }, [selectedId]);

  const filtered = useMemo(() => {
    if (!statusFilter) return tickets;
    if (statusFilter === "OPEN_ALL") return tickets.filter((t) => t.status !== "CLOSED");
    return tickets.filter((t) => t.status === statusFilter);
  }, [tickets, statusFilter]);

  const handleCreated = (t: TicketDetail) => {
    setComposeOpen(false);
    setSelectedId(t.ticket_id);
    refreshList();
  };

  const handleReplied = (t: TicketDetail) => {
    setDetail(t);
    refreshList();
  };

  return (
    <PageShell
      title="Help & Support"
      description="Open a ticket with the ESMOS support team. Conversations are recorded for your audit log."
      breadcrumb={[{ label: "Company Portal", href: "/app" }, { label: "Help & Support" }]}
      className="max-w-[1400px]"
      actions={
        <>
          <Button
            onClick={refreshList}
            variant="outline"
            className="text-[13px] h-8 px-3 inline-flex items-center gap-1.5"
          >
            <RefreshCw size={14} /> Refresh
          </Button>
          {!isReadOnly && (
            <Button
              onClick={() => { setSelectedId(null); setComposeOpen(true); }}
              className="bg-primary hover:bg-primaryDk text-white text-[13px] h-8 px-3 inline-flex items-center gap-1.5"
            >
              <Plus size={14} /> New Ticket
            </Button>
          )}
        </>
      }
    >

      <div className="grid grid-cols-12 gap-4">
        {/* ── List column ─────────────────────────────────────────────────── */}
        <div className="col-span-5 lg:col-span-4">
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            {([
              { v: "OPEN_ALL",         l: "Open" },
              { v: "PENDING_TENANT",   l: "Action Required" },
              { v: "CLOSED",           l: "Closed" },
              { v: "",                 l: "All" },
            ] as { v: typeof statusFilter; l: string }[]).map(({ v, l }) => (
              <button
                key={v || "all"}
                onClick={() => setStatusFilter(v)}
                className={`text-[11px] px-2 py-1 rounded border transition-colors ${
                  statusFilter === v
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : "border-border text-muted-foreground hover:bg-sunken"
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          <div className="border border-border rounded-lg bg-card max-h-[calc(100vh-220px)] overflow-y-auto">
            {loadingList ? (
              <div className="text-[12px] text-muted-foreground text-center py-10">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 px-4">
                <LifeBuoy size={28} className="mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-[13px] text-muted-foreground mb-1">No tickets in this view</p>
                {!isReadOnly && <p className="text-[11px] text-muted-foreground">Click "New Ticket" to ask for help.</p>}
              </div>
            ) : (
              filtered.map((t) => {
                const isActive = t.ticket_id === selectedId;
                return (
                  <button
                    key={t.ticket_id}
                    onClick={() => { setSelectedId(t.ticket_id); setComposeOpen(false); }}
                    className={`block w-full text-left px-3 py-2.5 border-b border-[hsl(var(--border-hairline))] transition-colors ${
                      isActive ? "bg-primary/5" : "hover:bg-sunken"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_BADGE[t.status]}`}>
                            {STATUS_LABEL[t.status]}
                          </span>
                          {t.priority === "HIGH" && (
                            <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-destructive-tint text-destructive border border-destructive/30">High</span>
                          )}
                        </div>
                        <p className="text-[13px] font-semibold text-foreground truncate">{t.subject}</p>
                        {t.last_message_preview && (
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {t.last_author_kind === "platform" ? "Support: " : ""}
                            {t.last_message_preview}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1 inline-flex items-center gap-1">
                          <Clock size={10} /> {formatDateTime(t.updated_at)} · <MessageSquare size={10} /> {t.message_count}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Detail / compose column ─────────────────────────────────────── */}
        <div className="col-span-7 lg:col-span-8">
          {composeOpen ? (
            <ComposeForm onCreated={handleCreated} onCancel={() => setComposeOpen(false)} />
          ) : detail ? (
            <ThreadView
              ticket={detail}
              loading={loadingDetail}
              isReadOnly={isReadOnly}
              onReplied={handleReplied}
              onClosed={(t) => { setDetail(t); refreshList(); }}
            />
          ) : (
            <div className="border border-dashed border-border rounded-lg py-20 text-center">
              <LifeBuoy size={36} className="mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-[13px] text-muted-foreground">Select a ticket to view the conversation, or open a new one.</p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}


/* ═══ Compose new ticket ═══════════════════════════════════════════════════ */

function ComposeForm({ onCreated, onCancel }: { onCreated: (t: TicketDetail) => void; onCancel: () => void }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<Priority>("NORMAL");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (subject.trim().length < 3 || body.trim().length < 5) {
      toast.error("Please add a subject and a description");
      return;
    }
    setSubmitting(true);
    try {
      const res = await tenantApi.createTicket({ subject: subject.trim(), body: body.trim(), priority });
      toast.success("Ticket opened");
      onCreated(res.data);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to create ticket"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="border border-border rounded-lg bg-card p-5">
      <h2 className="text-[14px] font-semibold text-foreground mb-4 inline-flex items-center gap-2">
        <Plus size={14} /> New Ticket
      </h2>
      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Subject *</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Short summary, e.g., 'Scope 3 batch SC3-2025-04 not appearing in reports'"
            maxLength={200}
            className="w-full py-1.5 px-3 text-[13px] text-foreground border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Description *</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            placeholder="Describe the issue, steps to reproduce, expected vs. actual result, screenshots references, etc."
            maxLength={5000}
            className="w-full py-2 px-3 text-[13px] text-foreground border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
          <p className="text-[10px] text-muted-foreground mt-1">{body.length} / 5000</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-[11px] font-semibold text-muted-foreground">Priority:</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            className="py-1.5 px-2 text-[13px] border border-border rounded text-foreground bg-card"
          >
            <option value="LOW">Low</option>
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
          </select>
          <span className="text-[10px] text-muted-foreground">(descriptive only — does not affect SLA)</span>
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-[hsl(var(--border-hairline))]">
        <Button variant="outline" onClick={onCancel} disabled={submitting}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={submitting} className="bg-primary hover:bg-primaryDk text-white">
          {submitting ? "Sending…" : "Open Ticket"}
        </Button>
      </div>
    </div>
  );
}


/* ═══ Thread view ══════════════════════════════════════════════════════════ */

function ThreadView({
  ticket, loading, isReadOnly, onReplied, onClosed,
}: {
  ticket: TicketDetail;
  loading: boolean;
  isReadOnly: boolean;
  onReplied: (t: TicketDetail) => void;
  onClosed: (t: TicketDetail) => void;
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
      const res = await tenantApi.replyTicket(ticket.ticket_id, reply.trim());
      setReply("");
      onReplied(res.data);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to send reply"));
    } finally {
      setSending(false);
    }
  };

  const handleClose = async () => {
    if (!confirm("Close this ticket? You can reopen it by sending another reply.")) return;
    setClosing(true);
    try {
      const res = await tenantApi.closeTicket(ticket.ticket_id);
      onClosed(res.data);
    } catch (err: any) {
      toast.error(getApiError(err, "Failed to close ticket"));
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="border border-border rounded-lg bg-card flex flex-col max-h-[calc(100vh-180px)]">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[hsl(var(--border-hairline))]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${STATUS_BADGE[ticket.status]}`}>
                {STATUS_LABEL[ticket.status]}
              </span>
              {ticket.priority === "HIGH" && (
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-destructive-tint text-destructive border border-destructive/30">High</span>
              )}
              <span className="text-[11px] text-muted-foreground">#{ticket.ticket_id.slice(0, 8)}</span>
            </div>
            <h2 className="text-[15px] font-semibold text-foreground">{ticket.subject}</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Opened by {ticket.opened_by_name ?? "—"} · {formatDateTime(ticket.created_at)}
            </p>
          </div>
          {!isReadOnly && !isClosed && (
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={closing}
              className="text-[12px] h-7 px-3 inline-flex items-center gap-1.5"
            >
              <Check size={12} /> {closing ? "Closing…" : "Mark Resolved"}
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {loading ? (
          <div className="text-[12px] text-muted-foreground text-center py-10">Loading…</div>
        ) : ticket.messages.length === 0 ? (
          <div className="text-[12px] text-muted-foreground text-center py-10">No messages.</div>
        ) : (
          ticket.messages.map((m) => (
            <MessageBubble key={m.message_id} m={m} />
          ))
        )}
        {isClosed && (
          <div className="text-center py-3">
            <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
              <Check size={12} /> Closed by {ticket.closed_by_kind === "platform" ? "platform support" : "you"} · {ticket.closed_at ? formatDateTime(ticket.closed_at) : ""}
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply */}
      {!isReadOnly && (
        <div className="border-t border-[hsl(var(--border-hairline))] p-3">
          <div className="flex items-end gap-2">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={2}
              placeholder={isClosed ? "Replying will reopen this ticket…" : "Type your reply…"}
              maxLength={5000}
              className="flex-1 py-2 px-3 text-[13px] text-foreground border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
            <Button
              onClick={handleReply}
              disabled={sending || reply.trim().length === 0}
              className="bg-primary hover:bg-primaryDk text-white text-[13px] h-9 px-4 inline-flex items-center gap-1.5"
            >
              <Send size={14} /> {sending ? "Sending…" : "Send"}
            </Button>
          </div>
          {isClosed && (
            <p className="text-[11px] text-warn mt-1.5 inline-flex items-center gap-1">
              <AlertCircle size={11} /> Sending a reply will reopen this ticket.
            </p>
          )}
        </div>
      )}
    </div>
  );
}


function MessageBubble({ m }: { m: TicketMessage }) {
  const isMe = m.author_kind === "tenant";
  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-lg px-3.5 py-2 ${
        isMe ? "bg-primary/10 border border-primary/20" : "bg-accent border border-accent-foreground/20"
      }`}>
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[11px] font-semibold ${isMe ? "text-foreground" : "text-accent-foreground"}`}>
            {m.author_name ?? m.author_email ?? (isMe ? "You" : "Platform Support")}
          </span>
          {!isMe && (
            <span className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded bg-accent text-accent-foreground font-semibold">Support</span>
          )}
          <span className="text-[10px] text-muted-foreground">{formatDateTime(m.created_at)}</span>
        </div>
        <p className="text-[12.5px] text-foreground/90 whitespace-pre-wrap break-words">{m.body}</p>
      </div>
    </div>
  );
}
