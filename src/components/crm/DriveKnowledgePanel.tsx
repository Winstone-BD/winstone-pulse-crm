import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FolderOpen, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { driveKnowledge, refreshDriveKnowledge } from "@/lib/drive-knowledge.functions";
import { useAdminToken } from "@/lib/local-session";

/**
 * IT Console: approved Google Drive folders indexed as document knowledge.
 * Drive stays read-only and supplementary — live CRM data and the verified
 * website always answer first.
 */
export function DriveKnowledgePanel() {
  const adminToken = useAdminToken();
  const fetchStatus = useServerFn(driveKnowledge);
  const refresh = useServerFn(refreshDriveKnowledge);

  const status = useQuery({
    queryKey: ["drive-knowledge", adminToken ? "pin" : "session"],
    queryFn: () => fetchStatus({ data: { adminToken } }),
    retry: false,
  });

  const run = useMutation({
    mutationFn: () => refresh({ data: { adminToken } }),
    onSuccess: (result) => {
      toast.success(`${result.stored} টি ডকুমেন্ট পড়া হয়েছে`);
      void status.refetch();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FolderOpen className="size-5 text-primary" />
          <div>
            <h2 className="text-sm font-semibold">অনুমোদিত ডকুমেন্ট তথ্যভাণ্ডার</h2>
            <p className="text-xs text-muted-foreground">
              শুধু অনুমোদিত Google Drive ফোল্ডারের লেখা পড়া হয় — রেকর্ডিং বা কাঁচা ডেটা নয়।
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
            সংযোগ:{" "}
            <span className="font-medium text-foreground">
              {status.data.connected ? "সক্রিয়" : "কনফিগার করা হয়নি"}
            </span>{" "}
            · {status.data.documents} টি ডকুমেন্ট ·{" "}
            {status.data.lastIndexedAt
              ? new Date(status.data.lastIndexedAt).toLocaleString("bn-BD", {
                  timeZone: "Asia/Dhaka",
                })
              : "এখনো পড়া হয়নি"}
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {status.data.folders.map((folder) => (
              <li key={folder.id} className="truncate">
                অনুমোদিত ফোল্ডার: <span className="text-foreground">{folder.name}</span>
              </li>
            ))}
          </ul>
          <ul className="space-y-1">
            {status.data.recent.map((doc) => (
              <li key={doc.fileId} className="truncate text-xs">
                {doc.webViewLink ? (
                  <a
                    href={doc.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    {doc.name}
                  </a>
                ) : (
                  doc.name
                )}
                {doc.folderName ? (
                  <span className="text-muted-foreground"> · {doc.folderName}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">লোড হচ্ছে…</p>
      )}
    </section>
  );
}
