import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { floorLockAdmin, setFloorLock } from "@/lib/floor-lock.functions";
import { useAdminToken } from "@/lib/local-session";
import { REVIEW_ROWS } from "@/lib/performance-review";

/** HQ control for the review notice: who stays locked out, who is cleared. */
export function FloorLockAdminPanel() {
  const adminToken = useAdminToken();
  const queryClient = useQueryClient();
  const state = useQuery({
    queryKey: ["floor-lock-admin", adminToken],
    queryFn: () => floorLockAdmin({ data: { adminToken } }),
    enabled: Boolean(adminToken),
    refetchInterval: 60_000,
  });

  const change = useMutation({
    mutationFn: (input: { action: "approve" | "revoke" | "restrict" | "unrestrict"; employeeId: string }) =>
      setFloorLock({ data: { adminToken, ...input } }),
    onSuccess: () => {
      toast.success("হেড কোয়ার্টারের সিদ্ধান্ত সংরক্ষিত হয়েছে");
      void queryClient.invalidateQueries({ queryKey: ["floor-lock-admin"] });
      void queryClient.invalidateQueries({ queryKey: ["floor-lock"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "সংরক্ষণ হয়নি"),
  });

  if (!adminToken) return null;
  const data = state.data;

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Lock className="size-4 text-destructive" /> পারফরম্যান্স রিভিউ লক / Floor lock
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        সাড়ে ৯টা (ঢাকা) পর্যন্ত সবার ড্যাশবোর্ডে রিভিউ নোটিশ থাকবে। এরপর শুধু নিচে চিহ্নিত অ্যাকাউন্ট
        বন্ধ থাকবে — হেড কোয়ার্টার অনুমোদন দিলে খুলে যাবে।
      </p>

      <ul className="mt-3 space-y-2">
        {REVIEW_ROWS.filter((row) => row.employeeId !== "WIN2607").map((row) => {
          const restricted = data?.restricted.includes(row.employeeId) ?? false;
          const approved = data?.approved.includes(row.employeeId) ?? false;
          return (
            <li
              key={row.employeeId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface-2/50 px-3 py-2"
            >
              <span className="text-sm">
                <span className="font-semibold">{row.name}</span>{" "}
                <span className="text-xs text-muted-foreground">({row.employeeId})</span>
                {restricted && (
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      approved
                        ? "bg-live/15 text-live"
                        : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {approved ? "অনুমোদিত" : "বন্ধ — অনুমোদন দরকার"}
                  </span>
                )}
              </span>
              <span className="flex gap-2">
                {restricted ? (
                  <>
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      disabled={approved || change.isPending}
                      onClick={() =>
                        change.mutate({ action: "approve", employeeId: row.employeeId })
                      }
                    >
                      <ShieldCheck className="size-3.5" /> অনুমোদন দিন
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      disabled={change.isPending}
                      onClick={() =>
                        change.mutate({ action: "unrestrict", employeeId: row.employeeId })
                      }
                    >
                      লক তুলে নিন
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={change.isPending}
                    onClick={() => change.mutate({ action: "restrict", employeeId: row.employeeId })}
                  >
                    লক করুন
                  </Button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
