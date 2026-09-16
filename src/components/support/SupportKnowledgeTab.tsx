import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAdminToken } from "@/lib/local-session";
import {
  deleteKbArticle,
  listKbArticles,
  saveKbArticle,
  saveKbCategory,
} from "@/lib/support-admin.functions";
import { ARTICLE_STATUSES, type ArticleStatus } from "@/lib/support-shared";

export function SupportKnowledgeTab() {
  const adminToken = useAdminToken();
  const queryClient = useQueryClient();
  const kb = useQuery({
    queryKey: ["support", "kb", "admin", adminToken],
    queryFn: () => listKbArticles({ data: { adminToken } }),
  });

  const empty = {
    id: undefined as string | undefined,
    title: "",
    summary: "",
    bodyMarkdown: "",
    status: "draft" as ArticleStatus,
    categoryId: "" as string,
  };
  const [form, setForm] = useState(empty);
  const [categoryName, setCategoryName] = useState("");

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["support", "kb"] });
  };

  const save = useMutation({
    mutationFn: () =>
      saveKbArticle({
        data: {
          adminToken,
          ...(form.id ? { id: form.id } : {}),
          title: form.title.trim(),
          summary: form.summary.trim() || undefined,
          bodyMarkdown: form.bodyMarkdown.trim(),
          status: form.status,
          categoryId: form.categoryId || null,
          tags: [],
        },
      }),
    onSuccess: () => {
      toast.success("Article saved");
      setForm(empty);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const archive = useMutation({
    mutationFn: (id: string) => deleteKbArticle({ data: { adminToken, id } }),
    onSuccess: () => {
      toast.success("Article archived");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addCategory = useMutation({
    mutationFn: () => saveKbCategory({ data: { adminToken, name: categoryName.trim() } }),
    onSuccess: () => {
      setCategoryName("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (kb.isLoading) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Loading…
      </p>
    );
  }
  if (kb.isError) {
    return (
      <p className="text-sm text-destructive">
        {kb.error instanceof Error ? kb.error.message : "Unavailable"}
      </p>
    );
  }

  const data = kb.data!;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-3">
        <p className="text-sm font-semibold">Articles ({data.articles.length})</p>
        <p className="text-[11px] text-muted-foreground">
          The assistant answers only from published articles — every published article widens what it
          can safely say.
        </p>
        <ul className="space-y-2">
          {data.articles.map((article) => (
            <li key={article.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{article.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {article.status} · {article.view_count} views
                  </p>
                </div>
                {data.canEdit && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() =>
                        setForm({
                          id: article.id,
                          title: article.title,
                          summary: article.summary ?? "",
                          bodyMarkdown: article.body_markdown,
                          status: article.status as ArticleStatus,
                          categoryId: article.category_id ?? "",
                        })
                      }
                    >
                      Edit
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label={`Archive ${article.title}`}
                      onClick={() => archive.mutate(article.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
          {data.articles.length === 0 && (
            <li className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
              No articles yet. Add your first one to give the assistant something to answer from.
            </li>
          )}
        </ul>

        {data.canEdit && (
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs font-semibold">Categories</p>
            <div className="mt-2 flex gap-2">
              <Input
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder="New category name"
                className="h-8 text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={categoryName.trim().length < 2 || addCategory.isPending}
                onClick={() => addCategory.mutate()}
              >
                Add
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {data.categories.map((category) => category.name).join(" · ") || "None yet"}
            </p>
          </div>
        )}
      </div>

      {data.canEdit ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">{form.id ? "Edit article" : "New article"}</p>
          <div className="space-y-1">
            <Label htmlFor="kb-title" className="text-xs">
              Title
            </Label>
            <Input
              id="kb-title"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="kb-summary" className="text-xs">
              Summary
            </Label>
            <Input
              id="kb-summary"
              value={form.summary}
              onChange={(event) => setForm({ ...form, summary: event.target.value })}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="kb-status" className="text-xs">
                Status
              </Label>
              <select
                id="kb-status"
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs"
                value={form.status}
                onChange={(event) =>
                  setForm({ ...form, status: event.target.value as ArticleStatus })
                }
              >
                {ARTICLE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="kb-category" className="text-xs">
                Category
              </Label>
              <select
                id="kb-category"
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs"
                value={form.categoryId}
                onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
              >
                <option value="">Uncategorised</option>
                {data.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="kb-body" className="text-xs">
              Body (markdown)
            </Label>
            <Textarea
              id="kb-body"
              rows={12}
              value={form.bodyMarkdown}
              onChange={(event) => setForm({ ...form, bodyMarkdown: event.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={save.isPending || form.title.trim().length < 3 || form.bodyMarkdown.trim().length < 10}
              onClick={() => save.mutate()}
            >
              {save.isPending && <Loader2 className="mr-1 size-3.5 animate-spin" />}
              Save article
            </Button>
            {form.id && (
              <Button size="sm" variant="ghost" onClick={() => setForm(empty)}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
          You can read the knowledge base here. Publishing needs a support lead account.
        </p>
      )}
    </div>
  );
}
