import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useAdminToken } from "@/lib/local-session";
import { listAppReleases } from "@/lib/releases.functions";

export function SystemUpdateReport() {
  const adminToken = useAdminToken();
  const { data, isLoading } = useQuery({ queryKey: ["system-update-report", adminToken], queryFn: () => listAppReleases({ data: { adminToken } }) });
  return <section className="rounded-2xl border bg-card p-4 sm:p-5"><header className="mb-3 flex items-start gap-2"><History className="mt-0.5 size-5 text-primary" /><div><h2 className="font-semibold">সিস্টেম আপডেট রিপোর্ট</h2><p className="text-xs text-muted-foreground">প্রকাশিত Android সংস্করণ ও সংরক্ষিত release notes-এর factual history</p></div></header>{isLoading ? <p className="text-xs text-muted-foreground">রিপোর্ট লোড হচ্ছে…</p> : (data?.releases.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">কোনো প্রকাশিত release record নেই।</p> : <ol className="space-y-2">{data!.releases.map((release) => <li key={release.id} className="rounded-lg border bg-background/60 p-3"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">Winstone Connect {release.version_name}</strong><span className="text-xs text-muted-foreground">code {release.version_code}</span>{release.is_mandatory ? <Badge variant="destructive">বাধ্যতামূলক</Badge> : null}</div><p className="mt-1 whitespace-pre-wrap text-sm">{release.release_notes || "এই release-এ কোনো note সংরক্ষণ করা হয়নি।"}</p><p className="mt-1 text-[11px] text-muted-foreground">{new Date(release.released_at).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })}</p></li>)}</ol>}</section>;
}