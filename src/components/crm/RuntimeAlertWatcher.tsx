import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { getAdminToken } from "@/lib/local-session";
import { runtimeAlertSummary } from "@/lib/runtime-errors.functions";

/**
 * HQ/IT only: polls open runtime issues and alerts when a new one (or a
 * reopened one) appears — in-app toast plus a browser notification if allowed.
 */
export function RuntimeAlertWatcher() {
  const fn = useServerFn(runtimeAlertSummary);
  const q = useQuery({
    queryKey: ["runtime-alerts"],
    queryFn: () => fn({ data: { adminToken: getAdminToken() } }),
    refetchInterval: 60_000,
    retry: false,
  });
  const seen = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    const rows = q.data;
    if (!rows) return;
    if (seen.current === null) {
      seen.current = new Map(rows.map((r) => [r.id, r.last_seen]));
      return;
    }
    for (const r of rows) {
      if (seen.current.has(r.id)) continue;
      seen.current.set(r.id, r.last_seen);
      const title = r.source === "health-check" ? "লাইভ সাইট লোড হচ্ছে না" : "নতুন রানটাইম এরর";
      toast.error(title, {
        description: r.message.slice(0, 140),
        duration: 15_000,
        action: { label: "দেখুন", onClick: () => window.location.assign("/runtime-errors") },
      });
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification(`Winstone CRM — ${title}`, { body: r.message.slice(0, 140), tag: r.id });
        }
      } catch {
        /* notifications unsupported */
      }
    }
  }, [q.data]);

  return null;
}
