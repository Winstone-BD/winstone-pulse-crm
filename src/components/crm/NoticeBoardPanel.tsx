import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Megaphone, MessageSquareReply, Send } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAdminToken } from "@/lib/local-session";
import {
  listNoticeBoard,
  listNoticeRecipients,
  markNoticeRead,
  publishNotice,
  replyToNotice,
} from "@/lib/notice-board.functions";

const SEVERITY_LABEL: Record<string, string> = { info: "তথ্য", important: "গুরুত্বপূর্ণ", urgent: "জরুরি" };

function dhakaTime(iso: string) {
  return new Date(iso).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" });
}

export function NoticeBoardPanel({ composer = false, compact = false }: { composer?: boolean; compact?: boolean }) {
  const adminToken = useAdminToken();
  const queryClient = useQueryClient();
  const load = useServerFn(listNoticeBoard);
  const loadRecipients = useServerFn(listNoticeRecipients);
  const publishFn = useServerFn(publishNotice);
  const readFn = useServerFn(markNoticeRead);
  const replyFn = useServerFn(replyToNotice);
  const [title, setTitle] = useState("");
  const requestId = useRef<string | null>(null);
  const [expiry, setExpiry] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [unread, setUnread] = useState(false);
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<"info" | "important" | "urgent">("info");
  const [audienceType, setAudienceType] = useState<"all" | "role" | "accounts">("all");
  const [audienceRole, setAudienceRole] = useState<"agent" | "team_leader" | "admin">("agent");
  const [selected, setSelected] = useState<string[]>([]);
  const [reply, setReply] = useState<Record<string, string>>({});

  const board = useQuery({
    queryKey: ["it-notice-board", adminToken ? "pin" : "session"],
    queryFn: () => load({ data: { adminToken } }),
    retry: false,
    refetchInterval: 60_000,
  });
  const recipients = useQuery({
    queryKey: ["it-notice-recipients", adminToken],
    queryFn: () => loadRecipients({ data: { adminToken } }),
    enabled: composer && Boolean(board.data?.canPublish),
  });

  const publish = useMutation({
    mutationFn: () => publishFn({ data: { adminToken, requestId: requestId.current ?? crypto.randomUUID(), expiresAt: expiry ? new Date(`${expiry}:00+06:00`).toISOString() : null, title, body, severity, audienceType, audienceRole: audienceType === "role" ? audienceRole : null, profileIds: selected } }),
    onSuccess: (result) => {
      toast.success(`${result.recipients}টি অ্যাকাউন্টে নোটিশ পাঠানো হয়েছে`);
      setTitle(""); setBody(""); setSelected([]); requestId.current=null; setExpiry("");
      void queryClient.invalidateQueries({ queryKey: ["it-notice-board"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const markRead = useMutation({
    mutationFn: (noticeId: string) => readFn({ data: { adminToken, noticeId } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["it-notice-board"] }),
  });
  const sendReply = useMutation({
    mutationFn: ({ noticeId, text }: { noticeId: string; text: string }) => replyFn({ data: { adminToken, noticeId, body: text } }),
    onSuccess: (_, input) => {
      setReply((old) => ({ ...old, [input.noticeId]: "" }));
      void queryClient.invalidateQueries({ queryKey: ["it-notice-board"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const notices = (board.data?.notices ?? []).filter(n => (!unread || !n.read) && (!dateFilter || new Date(Date.parse(n.published_at)+21600000).toISOString().slice(0,10) === dateFilter) && (!agentFilter || n.receipts.some(r=>r.profile_id===agentFilter)));
  return (
    <section className={compact ? "space-y-3" : "rounded-2xl border border-border bg-card p-4 sm:p-5"}>
      <header className="mb-3 flex items-start gap-2">
        <Megaphone className="mt-0.5 size-5 text-primary" />
        <div>
          <h2 className="font-semibold">HQ / IT বার্তা বোর্ড</h2>
          <p className="text-xs text-muted-foreground">লক্ষ্যভিত্তিক নোটিশ, read receipt এবং নিরাপদ reply thread</p>
        </div>
      </header>

      {composer && board.data?.canPublish ? (
        <div className="mb-5 space-y-3 rounded-xl border bg-background/70 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label>শিরোনাম</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
            <div className="space-y-1"><Label>গুরুত্ব</Label><Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="info">তথ্য</SelectItem><SelectItem value="important">গুরুত্বপূর্ণ</SelectItem><SelectItem value="urgent">জরুরি</SelectItem></SelectContent></Select></div>
          </div>
          <div className="space-y-1"><Label>বার্তা</Label><Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1"><Label>প্রাপক</Label><Select value={audienceType} onValueChange={(v) => { setAudienceType(v as typeof audienceType); setSelected([]); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সব সক্রিয় অ্যাকাউন্ট</SelectItem><SelectItem value="role">Role অনুযায়ী</SelectItem><SelectItem value="accounts">নির্দিষ্ট অ্যাকাউন্ট</SelectItem></SelectContent></Select></div>
            {audienceType === "role" ? <div className="space-y-1"><Label>Role</Label><Select value={audienceRole} onValueChange={(v) => setAudienceRole(v as typeof audienceRole)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="agent">Agent</SelectItem><SelectItem value="team_leader">Team Leader</SelectItem><SelectItem value="admin">Admin / IT</SelectItem></SelectContent></Select></div> : null}
          </div>
          {audienceType === "accounts" ? (
            <div className="max-h-44 space-y-2 overflow-y-auto rounded-lg border p-3">
              {(recipients.data ?? []).map((profile) => (
                <label key={profile.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={selected.includes(profile.id)} onCheckedChange={(checked) => setSelected((old) => checked ? [...old, profile.id] : old.filter((id) => id !== profile.id))} />
                  <span>{profile.name} <span className="text-xs text-muted-foreground">{profile.employee_id ?? profile.role}</span></span>
                </label>
              ))}
            </div>
          ) : null}
          <Label>মেয়াদ (ঐচ্ছিক, ঢাকা)</Label><Input type="datetime-local" value={expiry} onChange={e=>setExpiry(e.target.value)}/>
          <Button disabled={publish.isPending || title.trim().length < 2 || body.trim().length < 2} onClick={() => { if (window.confirm("এই বার্তা পাঠাবেন? পাঠানোর পর পরিবর্তন করা যাবে না।")) { requestId.current ??= crypto.randomUUID(); publish.mutate(); } }}>
            {publish.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} নোটিশ পাঠান
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2"><Input type="date" aria-label="বার্তার তারিখ" value={dateFilter} onChange={e=>setDateFilter(e.target.value)}/><label className="flex items-center gap-2"><Checkbox checked={unread} onCheckedChange={v=>setUnread(v===true)}/>অপঠিত</label>{composer?<Select value={agentFilter||"all"} onValueChange={v=>setAgentFilter(v==='all'?'':v)}><SelectTrigger><SelectValue placeholder="এজেন্ট"/></SelectTrigger><SelectContent><SelectItem value="all">সব প্রাপক</SelectItem>{recipients.data?.map(p=><SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>:null}</div>
      {board.error ? <p role="alert" className="text-destructive">{board.error.message}</p> : null}
      {board.isLoading ? <p className="text-xs text-muted-foreground">নোটিশ লোড হচ্ছে…</p> : notices.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">এখন কোনো নোটিশ নেই।</p> : (
        <div className={compact ? "max-h-[65vh] space-y-3 overflow-y-auto" : "space-y-3"}>
          {notices.map((notice) => (
            <article key={notice.id} className={`rounded-xl border p-3 ${notice.severity === "urgent" ? "border-destructive/40 bg-destructive/5" : "bg-background/60"}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><h3 className="text-sm font-semibold">{notice.title}</h3><p className="text-[11px] text-muted-foreground">{notice.author_label} · {dhakaTime(notice.published_at)}</p></div>
                <Badge variant={notice.severity === "urgent" ? "destructive" : "secondary"}>{SEVERITY_LABEL[notice.severity] ?? notice.severity}</Badge>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{notice.body}</p>
              {board.data?.canPublish ? <p className="mt-2 text-[11px] text-muted-foreground">পৌঁছেছে {notice.recipientCount} · পড়েছেন {notice.readCount}</p> : !notice.read ? <Button className="mt-2" size="sm" variant="outline" onClick={() => markRead.mutate(notice.id)}>পড়েছি</Button> : <p className="mt-2 text-[11px] text-primary">পড়া হয়েছে</p>}
              {notice.replies.length > 0 ? <div className="mt-3 space-y-1 border-l-2 border-primary/20 pl-3">{notice.replies.map((item) => <div key={item.id} className="text-xs"><strong>{item.author_label}</strong>: {item.body}<span className="ml-1 text-[10px] text-muted-foreground">{dhakaTime(item.created_at)}</span></div>)}</div> : null}
              <div className="mt-3 flex gap-2"><Input aria-label="নোটিশের উত্তর" placeholder="উত্তর লিখুন…" value={reply[notice.id] ?? ""} onChange={(e) => setReply((old) => ({ ...old, [notice.id]: e.target.value }))} /><Button size="icon" variant="outline" aria-label="উত্তর পাঠান" disabled={!reply[notice.id]?.trim() || sendReply.isPending} onClick={() => sendReply.mutate({ noticeId: notice.id, text: reply[notice.id] ?? "" })}><MessageSquareReply className="size-4" /></Button></div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}