import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Globe, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminToken } from "@/lib/local-session";
import { refreshWebsiteKnowledge, websiteKnowledge } from "@/lib/website-knowledge.functions";

/**
 * IT Console: the company website copy that agents' answers are grounded on —
 * how many pages are stored, when they were last read, and a manual refresh.
 */
export function WebsiteKnowledgePanel() {
  const adminToken = useAdminToken();
  const fetchStatus = useServerFn(websiteKnowledge);
  const refresh = useServerFn(refreshWebsiteKnowledge);
  const [baseUrl, setBaseUrl] = useState("");

  const status = useQuery({
    queryKey: ["website-knowledge", adminToken ? "pin" : "session"],
    queryFn: () => fetchStatus({ data: { adminToken } }),
    retry: false,
  });

  const run = useMutation({
    mutationFn: () =>
      refresh({
        data: { adminToken, ...(baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}) },
      }),
    onSuccess: (result) => {
      toast.success(`${result.stored} টি পেজ পড়া হয়েছে`);
      void status.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Globe className="size-5 text-primary" />
          <div>
            <h2 className="text-sm font-semibold">ওয়েবসাইট তথ্যভাণ্ডার</h2>
            <p className="text-xs text-muted-foreground">
              এজেন্টদের উত্তর এই পেজগুলো থেকেই আসে — অন্য কিছু থেকে নয়।
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => run.mutate()} disabled={run.isPending}>
          {run.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          আবার পড়ুন
        </Button>
      </header>

      {status.data === null ? (
        <p className="text-xs text-muted-foreground">দেখতে আইটি পিন দিয়ে আনলক করুন।</p>
      ) : status.data ? (
        <div className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">
            ওয়েবসাইট: <span className="font-medium text-foreground">{status.data.baseUrl}</span> ·{" "}
            {status.data.pages} টি পেজ ·{" "}
            {status.data.lastFetchedAt
              ? new Date(status.data.lastFetchedAt).toLocaleString("bn-BD", {
                  timeZone: "Asia/Dhaka",
                })
              : "এখনো পড়া হয়নি"}
          </p>
          <ul className="space-y-1">
            {status.data.titles.map((page) => (
              <li key={page.url} className="truncate text-xs">
                <a
                  href={page.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  {page.title}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="নতুন ওয়েবসাইট ঠিকানা (ইচ্ছা হলে)"
              className="h-9 max-w-xs text-sm"
            />
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">লোড হচ্ছে…</p>
      )}
    </section>
  );
}
