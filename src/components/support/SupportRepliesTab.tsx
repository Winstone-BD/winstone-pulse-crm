import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAdminToken } from "@/lib/local-session";
import { deleteCannedReply, listCannedReplies, saveCannedReply } from "@/lib/support-admin.functions";

export function SupportRepliesTab() {
  const adminToken = useAdminToken();
  const queryClient = useQueryClient();
  const replies = useQuery({
    queryKey: ["support", "canned", adminToken],
    queryFn: () => listCannedReplies({ data: { adminToken } }),
  });
  const [form, setForm] = useState({ shortcut: "/", title: "", body: "" });

  const save = useMutation({
    mutationFn: () =>
      saveCannedReply({
        data: {
          adminToken,
          shortcut: form.shortcut.trim(),
          title: form.title.trim(),
          body: form.body.trim(),
        },
      }),
    onSuccess: () => {
      setForm({ shortcut: "/", title: "", body: "" });
      toast.success("Saved reply added");
      void queryClient.invalidateQueries({ queryKey: ["support", "canned"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCannedReply({ data: { adminToken, id } }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["support", "canned"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ul className="space-y-2">
        {(replies.data ?? []).map((reply) => (
          <li key={reply.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-primary">{reply.shortcut}</span>
              <span className="text-sm font-medium">{reply.title}</span>
              <Button
                size="icon"
                variant="ghost"
                className="ml-auto size-7"
                aria-label={`Delete ${reply.shortcut}`}
                onClick={() => remove.mutate(reply.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{reply.body}</p>
          </li>
        ))}
        {(replies.data ?? []).length === 0 && !replies.isLoading && (
          <li className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
            No saved replies yet.
          </li>
        )}
      </ul>

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold">New saved reply</p>
        <Input
          value={form.shortcut}
          onChange={(event) => setForm({ ...form, shortcut: event.target.value })}
          placeholder="/refund"
          aria-label="Shortcut"
        />
        <Input
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          placeholder="Refund policy"
          aria-label="Title"
        />
        <Textarea
          rows={5}
          value={form.body}
          onChange={(event) => setForm({ ...form, body: event.target.value })}
          placeholder="Reply text agents can insert"
          aria-label="Body"
        />
        <Button
          size="sm"
          disabled={save.isPending || form.title.trim().length < 2 || form.body.trim().length < 2}
          onClick={() => save.mutate()}
        >
          Save reply
        </Button>
      </div>
    </div>
  );
}
