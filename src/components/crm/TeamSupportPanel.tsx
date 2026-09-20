import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LifeBuoy, Loader2, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  SUPPORT_CATEGORIES,
  categoryLabel,
  type SupportPriority,
  type SupportStatus,
} from "@/lib/team-support-shared";
import {
  mySupportRequests,
  replyToSupportTicket,
  submitSupportRequest,
} from "@/lib/team-support.functions";

/**
 * The agent's own "Team Support" desk: send a problem to the Sales Team Admin
 * and follow it until it is resolved. No personal phone number needed — the
 * request goes to the role.
 */
export function TeamSupportPanel() {
  const queryClient = useQueryClient();
  const load = useServerFn(mySupportRequests);
  const send = useServerFn(submitSupportRequest);
  const reply = useServerFn(replyToSupportTicket);

  const [category, setCategory] = useState<string>(SUPPORT_CATEGORIES[0].key);
  const [priority, setPriority] = useState<SupportPriority>("normal");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const query = useQuery({
    queryKey: ["team-support-mine"],
    queryFn: () => load({ data: { adminToken: null } }),
    refetchInterval: 20_000,
  });

  const tickets = query.data?.tickets ?? [];
  const replies = query.data?.replies ?? [];
  const grouped = useMemo(() => {
    const open = tickets.filter((t) => t.status === "open" || t.status === "acknowledged");
    const working = tickets.filter((t) => t.status === "in_progress");
    const done = tickets.filter((t) => t.status === "resolved" || t.status === "closed");
    return { open, working, done };
  }, [tickets]);

  const submit = useMutation({
    mutationFn: () => send({ data: { category, subject, message, priority } }),
    onSuccess: (result) => {
      toast.success(`অনুরোধ Sales Team Admin-কে পাঠানো হয়েছে · ${result.ref}`);
      setSubject("");
      setMessage("");
      void queryClient.invalidateQueries({ queryKey: ["team-support-mine"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sendReply = useMutation({
    mutationFn: (ticketId: string) =>
      reply({ data: { adminToken: null, ticketId, body: replyText } }),
    onSuccess: () => {
      setReplyText("");
      toast.success("বার্তা পাঠানো হয়েছে");
      void queryClient.invalidateQueries({ queryKey: ["team-support-mine"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-4">
      <section className="card-elevated space-y-3 p-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
            <LifeBuoy className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">নতুন অনুরোধ পাঠান</h2>
            <p className="text-xs text-muted-foreground">
              CRM, অ্যাপ, কল, লিড বা যেকোনো কাজের সমস্যা — সরাসরি Sales Team Admin-এর কাছে যাবে।
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="ধরন" />
            </SelectTrigger>
            <SelectContent>
              {SUPPORT_CATEGORIES.map((item) => (
                <SelectItem key={item.key} value={item.key}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={(value) => setPriority(value as SupportPriority)}>
            <SelectTrigger>
              <SelectValue placeholder="গুরুত্ব" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PRIORITY_LABELS) as SupportPriority[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {PRIORITY_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="বিষয় (সংক্ষেপে)"
          maxLength={160}
        />
        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="বিস্তারিত লিখুন — কী সমস্যা, কখন হয়েছে, কোন লিড/কল"
          rows={4}
          maxLength={4000}
        />
        <Button
          className="w-full sm:w-auto"
          disabled={submit.isPending || subject.trim().length < 3 || message.trim().length < 3}
          onClick={() => submit.mutate()}
        >
          {submit.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          অনুরোধ পাঠান
        </Button>
      </section>

      <section className="card-elevated p-4">
        <h2 className="text-sm font-semibold">আমার অনুরোধ</h2>
        {query.isPending ? (
          <div className="mt-3 space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/50" />
            ))}
          </div>
        ) : tickets.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">এখনো কোনো অনুরোধ পাঠানো হয়নি।</p>
        ) : (
          <div className="mt-3 space-y-4">
            {[
              { label: "চলমান", rows: [...grouped.open, ...grouped.working] },
              { label: "সমাধান হয়েছে", rows: grouped.done },
            ]
              .filter((group) => group.rows.length > 0)
              .map((group) => (
                <div key={group.label} className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">{group.label}</p>
                  {group.rows.map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => setOpenId(openId === ticket.id ? null : ticket.id)}
                      className="w-full rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{ticket.subject}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {ticket.ref} · {categoryLabel(ticket.category)} ·{" "}
                            {new Date(ticket.created_at).toLocaleString("en-GB")}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {STATUS_LABELS[ticket.status as SupportStatus] ?? ticket.status}
                        </Badge>
                      </div>
                      {openId === ticket.id ? (
                        <div className="mt-3 space-y-2 border-t border-border pt-3">
                          <p className="whitespace-pre-wrap text-sm">{ticket.message}</p>
                          {replies
                            .filter((r) => r.ticket_id === ticket.id)
                            .map((r) => (
                              <p
                                key={r.id}
                                className={`rounded-md p-2 text-sm ${
                                  r.author_kind === "agent"
                                    ? "bg-muted/40"
                                    : "bg-primary/10 text-foreground"
                                }`}
                              >
                                <span className="text-xs text-muted-foreground">
                                  {r.author_label ?? (r.author_kind === "agent" ? "আমি" : "Team Admin")}
                                </span>
                                <br />
                                {r.body}
                              </p>
                            ))}
                          {ticket.resolution_note ? (
                            <p className="rounded-md bg-primary/10 p-2 text-sm">
                              সমাধান: {ticket.resolution_note}
                            </p>
                          ) : null}
                          <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
                            <Input
                              value={replyText}
                              onChange={(event) => setReplyText(event.target.value)}
                              placeholder="আরও কিছু লিখুন"
                            />
                            <Button
                              size="sm"
                              disabled={sendReply.isPending || replyText.trim().length === 0}
                              onClick={() => sendReply.mutate(ticket.id)}
                            >
                              পাঠান
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </button>
                  ))}
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
