import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Inbox, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  categoryLabel,
  type SupportPriority,
  type SupportStatus,
} from "@/lib/team-support-shared";
import {
  openSupportTicket,
  registerWebPushToken,
  replyToSupportTicket,
  setSupportTicketPriority,
  setSupportTicketStatus,
  supportInbox,
} from "@/lib/team-support.functions";
import { getAdminToken } from "@/lib/local-session";
import { PUSH_MESSAGES, requestWebPushToken } from "@/lib/web-push";

type Filter = "unread" | "open" | "high" | "critical" | "resolved" | "all";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "unread", label: "না-পড়া" },
  { key: "open", label: "চলমান" },
  { key: "high", label: "জরুরি" },
  { key: "critical", label: "অতি জরুরি" },
  { key: "resolved", label: "সমাধান" },
  { key: "all", label: "সব" },
];

/** Sales Team Admin inbox: agent complaints from web and Android in one list. */
export function TeamSupportInbox() {
  const queryClient = useQueryClient();
  const load = useServerFn(supportInbox);
  const setStatus = useServerFn(setSupportTicketStatus);
  const markRead = useServerFn(openSupportTicket);
  const reply = useServerFn(replyToSupportTicket);
  const setPriority = useServerFn(setSupportTicketPriority);
  const saveToken = useServerFn(registerWebPushToken);

  const [filter, setFilter] = useState<Filter>("unread");
  const [openId, setOpenId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const query = useQuery({
    queryKey: ["team-support-inbox"],
    // A temporary failure throws so the last good tickets stay on screen
    // while the next 15s poll retries.
    queryFn: async () => {
      const res = await load({ data: { adminToken: getAdminToken() } });
      if (res.error === "unavailable") throw new Error("unavailable");
      return res;
    },
    refetchInterval: 15_000,
    retry: 1,
  });
  const staleNotice = query.isError && !!query.data;

  const tickets = query.data?.tickets ?? [];
  const replies = query.data?.replies ?? [];
  const unread = tickets.filter((t) => t.unread_for_admin).length;

  const rows = useMemo(() => {
    switch (filter) {
      case "unread":
        return tickets.filter((t) => t.unread_for_admin);
      case "open":
        return tickets.filter((t) => !["resolved", "closed"].includes(t.status));
      case "high":
        return tickets.filter((t) => t.priority === "high");
      case "critical":
        return tickets.filter((t) => t.priority === "critical");
      case "resolved":
        return tickets.filter((t) => ["resolved", "closed"].includes(t.status));
      default:
        return tickets;
    }
  }, [filter, tickets]);

  const changeStatus = useMutation({
    mutationFn: (input: { ticketId: string; status: SupportStatus }) =>
      setStatus({ data: { adminToken: getAdminToken(), ...input } }),
    onSuccess: () => {
      toast.success("অবস্থা আপডেট হয়েছে");
      void queryClient.invalidateQueries({ queryKey: ["team-support-inbox"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const changePriority = useMutation({
    mutationFn: (input: { ticketId: string; priority: SupportPriority }) =>
      setPriority({ data: { adminToken: getAdminToken(), ...input } }),
    onSuccess: () => {
      toast.success("গুরুত্ব বদলানো হয়েছে — সংশ্লিষ্টদের কাছে অ্যালার্ট গেছে");
      void queryClient.invalidateQueries({ queryKey: ["team-support-inbox"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  // One click turns on browser alerts for new or escalated requests.
  const enableAlerts = useMutation({
    mutationFn: async () => {
      const result = await requestWebPushToken();
      if (result.status === "registered" && result.token) {
        await saveToken({ data: { adminToken: getAdminToken(), token: result.token, label: null } });
      }
      return result.status;
    },
    onSuccess: (status) =>
      status === "registered"
        ? toast.success(PUSH_MESSAGES[status])
        : toast.info(PUSH_MESSAGES[status]),
    onError: (error: Error) => toast.error(error.message),
  });

  const sendReply = useMutation({
    mutationFn: (ticketId: string) =>
      reply({ data: { adminToken: getAdminToken(), ticketId, body: replyText } }),
    onSuccess: () => {
      setReplyText("");
      toast.success("উত্তর পাঠানো হয়েছে");
      void queryClient.invalidateQueries({ queryKey: ["team-support-inbox"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function open(ticketId: string, wasUnread: boolean) {
    setOpenId(openId === ticketId ? null : ticketId);
    if (wasUnread) {
      void markRead({ data: { adminToken: getAdminToken(), ticketId } }).then(() =>
        queryClient.invalidateQueries({ queryKey: ["team-support-inbox"] }),
      );
    }
  }

  if (query.data && !query.data.allowed) return null;

  return (
    <section className="card-elevated space-y-3 p-4">
      {staleNotice && (
        <p role="status" className="rounded-md border border-border bg-muted px-3 py-1.5 text-xs text-muted-foreground">
          Connection hiccup — showing the last loaded tickets, retrying automatically.
        </p>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
            <Inbox className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">টিম সাপোর্ট ইনবক্স</h2>
            <p className="truncate text-xs text-muted-foreground">
              এজেন্টদের সমস্যা ও অভিযোগ — ওয়েব ও অ্যান্ড্রয়েড একসাথে
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {unread > 0 ? (
            <Badge className="bg-destructive text-destructive-foreground">{unread} না-পড়া</Badge>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            disabled={enableAlerts.isPending}
            onClick={() => enableAlerts.mutate()}
          >
            {enableAlerts.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Bell className="size-4" />
            )}
            <span className="hidden sm:inline">অ্যালার্ট চালু</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setFilter(item.key)}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              filter === item.key
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:bg-muted/40"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {query.isPending ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted/50" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">এই তালিকায় এখনো কিছু নেই।</p>
      ) : (
        <div className="space-y-2">
          {rows.map((ticket) => (
            <div
              key={ticket.id}
              className={`rounded-lg border p-3 ${
                ticket.unread_for_admin ? "border-primary/40 bg-primary/[0.06]" : "border-border"
              }`}
            >
              <button
                type="button"
                onClick={() => open(ticket.id, ticket.unread_for_admin)}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-2 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{ticket.subject}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {ticket.agent_name} · {categoryLabel(ticket.category)} ·{" "}
                    {ticket.platform === "android" ? "অ্যান্ড্রয়েড" : "ওয়েব"} ·{" "}
                    {new Date(ticket.created_at).toLocaleString("en-GB")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant="outline">
                    {PRIORITY_LABELS[ticket.priority as SupportPriority] ?? ticket.priority}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {STATUS_LABELS[ticket.status as SupportStatus] ?? ticket.status}
                  </span>
                </div>
              </button>

              {openId === ticket.id ? (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  <p className="whitespace-pre-wrap text-sm">{ticket.message}</p>
                  {replies
                    .filter((r) => r.ticket_id === ticket.id)
                    .map((r) => (
                      <p
                        key={r.id}
                        className={`rounded-md p-2 text-sm ${
                          r.author_kind === "agent" ? "bg-muted/40" : "bg-primary/10"
                        }`}
                      >
                        <span className="text-xs text-muted-foreground">
                          {r.author_label ?? r.author_kind}
                        </span>
                        <br />
                        {r.body}
                      </p>
                    ))}
                  <div className="flex gap-2">
                    <Input
                      value={replyText}
                      onChange={(event) => setReplyText(event.target.value)}
                      placeholder="উত্তর লিখুন"
                    />
                    <Button
                      size="sm"
                      disabled={sendReply.isPending || replyText.trim().length === 0}
                      onClick={() => sendReply.mutate(ticket.id)}
                    >
                      {sendReply.isPending ? <Loader2 className="size-4 animate-spin" /> : "পাঠান"}
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(["acknowledged", "in_progress", "resolved", "closed"] as SupportStatus[]).map(
                      (status) => (
                        <Button
                          key={status}
                          size="sm"
                          variant="outline"
                          disabled={changeStatus.isPending || ticket.status === status}
                          onClick={() => changeStatus.mutate({ ticketId: ticket.id, status })}
                        >
                          {STATUS_LABELS[status]}
                        </Button>
                      ),
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">গুরুত্ব:</span>
                    {(["low", "normal", "high", "critical"] as SupportPriority[]).map((priority) => (
                      <Button
                        key={priority}
                        size="sm"
                        variant={ticket.priority === priority ? "default" : "outline"}
                        disabled={changePriority.isPending || ticket.priority === priority}
                        onClick={() => changePriority.mutate({ ticketId: ticket.id, priority })}
                      >
                        {PRIORITY_LABELS[priority]}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
