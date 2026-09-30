import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, TicketCheck } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/crm/AppShell";
import { ConversationWorkspace } from "@/components/support/ConversationWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminToken } from "@/lib/local-session";
import { listSupportTickets } from "@/lib/support-staff.functions";
import {
  PRIORITIES,
  PRIORITY_LABEL,
  TICKET_STATUSES,
  TICKET_STATUS_LABEL,
  relativeTime,
  type Priority,
  type TicketStatus,
} from "@/lib/support-shared";

export const Route = createFileRoute("/tickets")({
  head: () => ({
    meta: [
      { title: "Support Tickets — Winstone Support Desk" },
      {
        name: "description",
        content:
          "Track every escalated support ticket: reference, priority, owner, status and the conversation that created it.",
      },
      { property: "og:title", content: "Support Tickets — Winstone Support Desk" },
      {
        property: "og:description",
        content: "Escalated support work with full history from first message to resolution.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <AppShell>
      <p className="text-sm text-destructive">Tickets could not be loaded.</p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <p className="text-sm text-muted-foreground">Not found.</p>
    </AppShell>
  ),
  component: TicketsPage,
});

function TicketsPage() {
  const adminToken = useAdminToken();
  const [status, setStatus] = useState<"all" | TicketStatus>("open");
  const [priority, setPriority] = useState<"all" | Priority>("all");
  const [search, setSearch] = useState("");
  const [openConversation, setOpenConversation] = useState<string | null>(null);

  const tickets = useQuery({
    queryKey: ["support", "tickets", status, priority, search, adminToken],
    queryFn: () =>
      listSupportTickets({
        data: { adminToken, status, priority, search: search.trim() || undefined },
      }),
    refetchInterval: 30000,
  });

  const rows = tickets.data?.tickets ?? [];

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <TicketCheck className="size-5 text-primary" /> Support tickets
          </h1>
          <p className="text-xs text-muted-foreground">
            {rows.length} ticket{rows.length === 1 ? "" : "s"} in this view
          </p>
        </div>
        <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search ref or title"
            className="h-9 w-full sm:w-48"
            aria-label="Search tickets"
          />
          <select
            aria-label="Filter by status"
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
            value={status}
            onChange={(event) => setStatus(event.target.value as "all" | TicketStatus)}
          >
            <option value="all">All statuses</option>
            {TICKET_STATUSES.map((value) => (
              <option key={value} value={value}>
                {TICKET_STATUS_LABEL[value]}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by priority"
            className="h-9 rounded-md border border-border bg-background px-2 text-xs"
            value={priority}
            onChange={(event) => setPriority(event.target.value as "all" | Priority)}
          >
            <option value="all">All priorities</option>
            {PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {PRIORITY_LABEL[value]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card md:hidden">
        {tickets.isLoading ? <p className="p-6 text-center text-xs text-muted-foreground"><Loader2 className="inline size-3.5 animate-spin" /> Loading…</p> : null}
        {!tickets.isLoading && rows.length === 0 ? <p className="p-6 text-center text-xs text-muted-foreground">No tickets in this view.</p> : null}
        <ul className="divide-y divide-border">
          {rows.map((ticket) => (
            <li key={ticket.id} className="space-y-2 p-3">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <div className="min-w-0"><p className="truncate font-semibold">{ticket.title}</p><p className="font-mono text-xs text-muted-foreground">{ticket.ref}</p></div>
                <span className="text-xs font-medium">{PRIORITY_LABEL[ticket.priority as Priority]}</span>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div><dt className="text-muted-foreground">Customer</dt><dd className="truncate">{ticket.customer?.name ?? ticket.customer?.email ?? "—"}</dd></div>
                <div><dt className="text-muted-foreground">Status</dt><dd>{TICKET_STATUS_LABEL[ticket.status as TicketStatus]}</dd></div>
                <div><dt className="text-muted-foreground">Opened by</dt><dd className="capitalize">{ticket.created_by_kind}</dd></div>
                <div><dt className="text-muted-foreground">Created</dt><dd>{relativeTime(ticket.created_at)}</dd></div>
              </dl>
              {ticket.conversation_id ? <Button size="sm" variant="outline" className="w-full" onClick={() => setOpenConversation(ticket.conversation_id)}>Open thread</Button> : null}
            </li>
          ))}
        </ul>
      </div>
      <div className="table-scroll hidden rounded-xl border border-border bg-card md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2/60 text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Ref</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Priority</th>
              <th className="px-3 py-2">Opened by</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {tickets.isLoading && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  <Loader2 className="inline size-3.5 animate-spin" /> Loading…
                </td>
              </tr>
            )}
            {!tickets.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No tickets in this view.
                </td>
              </tr>
            )}
            {rows.map((ticket) => (
              <tr key={ticket.id} className="border-t border-border/70">
                <td className="px-3 py-2 font-mono text-xs">{ticket.ref}</td>
                <td className="max-w-[280px] truncate px-3 py-2">{ticket.title}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {ticket.customer?.name ?? ticket.customer?.email ?? "—"}
                </td>
                <td className="px-3 py-2 text-xs">
                  {TICKET_STATUS_LABEL[ticket.status as TicketStatus]}
                </td>
                <td className="px-3 py-2 text-xs">
                  {PRIORITY_LABEL[ticket.priority as Priority]}
                </td>
                <td className="px-3 py-2 text-xs capitalize text-muted-foreground">
                  {ticket.created_by_kind}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {relativeTime(ticket.created_at)}
                </td>
                <td className="px-3 py-2 text-right">
                  {ticket.conversation_id && (
                    <Button size="sm" variant="ghost" onClick={() => setOpenConversation(ticket.conversation_id)}>Open thread</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openConversation && (
        <section className="mt-4 h-[70vh] overflow-hidden rounded-xl border border-border bg-surface-2/40">
          <ConversationWorkspace conversationId={openConversation} />
        </section>
      )}
    </AppShell>
  );
}
