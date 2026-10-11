import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, NotebookPen, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { fullDateTime } from "@/lib/crm-format";
import { addLeadNote, deleteLeadNote, listLeadNotes, updateLeadNote } from "@/lib/lead-notes.functions";
import { useAdminToken } from "@/lib/local-session";
import { useT } from "@/lib/i18n";

/** ব্যক্তিগত নোট — separate from call reports; author + timestamps kept. */
export function LeadNotesPanel({ leadId, compact = false }: { leadId: string; compact?: boolean }) {
  const t = useT();
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const key = ["lead-notes", leadId, adminToken ? "pin" : "session"];
  const list = useServerFn(listLeadNotes);
  const add = useServerFn(addLeadNote);
  const update = useServerFn(updateLeadNote);
  const remove = useServerFn(deleteLeadNote);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);

  const { data: notes = [], isPending, isError, refetch } = useQuery({
    queryKey: key,
    queryFn: () => list({ data: { adminToken, leadId } }),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["lead-notes", leadId] });
  const onError = (e: Error) => toast.error(e.message);

  const addM = useMutation({
    mutationFn: (body: string) => add({ data: { adminToken, leadId, body } }),
    onSuccess: () => { setDraft(""); refresh(); toast.success("নোট সংরক্ষিত"); },
    onError,
  });
  const editM = useMutation({
    mutationFn: (e: { id: string; body: string }) => update({ data: { adminToken, leadId, noteId: e.id, body: e.body } }),
    onSuccess: () => { setEditing(null); refresh(); },
    onError,
  });
  const delM = useMutation({
    mutationFn: (id: string) => remove({ data: { adminToken, leadId, noteId: id } }),
    onSuccess: refresh,
    onError,
  });

  return (
    <section className={compact ? "space-y-3" : "space-y-3 rounded-xl border bg-card p-4"}>
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <NotebookPen className="size-4 text-primary" /> ব্যক্তিগত নোট / Personal Notes
      </h3>
      <div className="space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={4000}
          aria-label={t({ bn: "লিডের ব্যক্তিগত নোট", en: "Lead personal note" })}
          placeholder="সম্পর্ক, পরিচয়, লোকেশন বা জরুরি তথ্য লিখুন…"
          className="min-h-20"
        />
        <Button size="sm" className="min-h-9" disabled={!draft.trim() || addM.isPending} onClick={() => addM.mutate(draft.trim())}>
          {addM.isPending ? <Loader2 className="size-4 animate-spin" /> : null} নোট যোগ করুন
        </Button>
      </div>
      {isError ? <div role="alert" className="text-xs text-destructive">{t({ bn: "নোট আনা যায়নি—আবার চেষ্টা করুন।", en: "Notes could not be loaded. Try again." })}<Button variant="ghost" size="sm" onClick={() => void refetch()}>{t({ bn: "আবার চেষ্টা", en: "Retry" })}</Button></div> : isPending ? (
        <p className="text-xs text-muted-foreground">নোট আনা হচ্ছে…</p>
      ) : notes.length === 0 ? (
        <p className="text-xs text-muted-foreground">এখনো কোনো ব্যক্তিগত নোট নেই।</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border bg-background p-3">
              {editing?.id === n.id ? (
                <div className="space-y-2">
                  <Textarea value={editing.body} maxLength={4000} onChange={(e) => setEditing({ id: n.id, body: e.target.value })} />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={!editing.body.trim() || editM.isPending} onClick={() => editM.mutate({ id: n.id, body: editing.body.trim() })}>সংরক্ষণ</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>বাতিল</Button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap break-words text-sm">{n.body}</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span>{n.authorName}</span>
                <span className="tabular">· {fullDateTime(n.created_at)}</span>
                {n.updated_at !== n.created_at ? <span className="tabular">· সম্পাদিত {fullDateTime(n.updated_at)}</span> : null}
                {n.mine && editing?.id !== n.id ? (
                  <span className="ml-auto flex gap-1">
                    <Button size="icon" variant="ghost" className="size-7" aria-label="নোট সম্পাদনা" onClick={() => setEditing({ id: n.id, body: n.body })}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="size-7" aria-label="নোট মুছুন" onClick={() => confirm("নোটটি মুছবেন?") && delM.mutate(n.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
