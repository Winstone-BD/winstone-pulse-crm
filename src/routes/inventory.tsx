import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/crm/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listInventory, saveInventory } from "@/lib/inventory.functions";
import { useAdminToken } from "@/lib/local-session";

export const Route = createFileRoute("/inventory")({
  head: () => ({
    meta: [
      { title: "ইনভেন্টরি — Winstone Pulse" },
      { name: "description", content: "পোস্ট-কল রিপোর্টের Requirement তালিকা পরিচালনা করুন।" },
      { property: "og:title", content: "ইনভেন্টরি — Winstone Pulse" },
      { property: "og:description", content: "পোস্ট-কল রিপোর্টের Requirement তালিকা।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const adminToken = useAdminToken();
  const qc = useQueryClient();
  const fetchList = useServerFn(listInventory);
  const save = useServerFn(saveInventory);
  const [label, setLabel] = useState("");

  const list = useQuery({
    queryKey: ["inventory-admin", adminToken ? "pin" : "session"],
    queryFn: () => fetchList({ data: { adminToken, includeInactive: true } }),
  });
  const mutate = useMutation({
    mutationFn: (data: { id?: string; label?: string; active?: boolean; location?: string | null; totalUnits?: number | null; availableUnits?: number | null }) =>
      save({ data: { adminToken, ...data } }),
    onSuccess: () => {
      setLabel("");
      void qc.invalidateQueries({ queryKey: ["inventory-admin"] });
      void qc.invalidateQueries({ queryKey: ["inventory-requirements"] });
      toast.success("সেভ হয়েছে");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canManage = list.data?.canManage ?? false;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <div>
          <h1 className="text-xl font-bold">ইনভেন্টরি / Requirement তালিকা</h1>
          <p className="text-sm text-muted-foreground">
            এজেন্টরা পোস্ট-কল রিপোর্টে এখান থেকেই Requirement বাছাই করেন। বন্ধ করা অপশন ফরমে দেখাবে না।
          </p>
        </div>
        {canManage ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (label.trim().length >= 2) mutate.mutate({ label: label.trim() });
            }}
          >
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="যেমন: 3 Bed Ready — Bashundhara" aria-label="নতুন অপশন" />
            <Button type="submit" disabled={mutate.isPending}>
              <Plus className="size-4" /> যোগ করুন
            </Button>
          </form>
        ) : list.isSuccess ? (
          <p className="text-sm text-muted-foreground">শুধু HQ / কোঅর্ডিনেটর তালিকা বদলাতে পারেন।</p>
        ) : null}
        {list.isLoading ? <p className="text-sm text-muted-foreground">লোড হচ্ছে…</p> : null}
        {list.error ? <p className="text-sm text-destructive">{(list.error as Error).message}</p> : null}
        <ul className="divide-y rounded-xl border bg-card">
          {(list.data?.items ?? []).map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1 space-y-1">
                <span className={item.active ? "" : "text-muted-foreground line-through"}>{item.label}</span>
                {canManage ? (
                  <form
                    className="flex flex-wrap gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      const num = (k: string) => { const v = String(f.get(k) ?? "").trim(); return v === "" ? null : Number(v); };
                      mutate.mutate({ id: item.id, location: String(f.get("location") ?? "").trim() || null, totalUnits: num("total"), availableUnits: num("available") });
                    }}
                  >
                    <Input name="location" defaultValue={item.location ?? ""} placeholder="ঠিকানা" className="h-8 w-40" aria-label="ঠিকানা" />
                    <Input name="total" type="number" min={0} defaultValue={item.total_units ?? ""} placeholder="মোট ইউনিট" className="h-8 w-24" aria-label="মোট ইউনিট" />
                    <Input name="available" type="number" min={0} defaultValue={item.available_units ?? ""} placeholder="উপলভ্য" className="h-8 w-24" aria-label="উপলভ্য ইউনিট" />
                    <Button size="sm" type="submit" variant="outline" disabled={mutate.isPending}>সেভ</Button>
                  </form>
                ) : null}
              </div>
              {canManage ? (
                <Button size="sm" variant={item.active ? "secondary" : "default"} onClick={() => mutate.mutate({ id: item.id, active: !item.active })}>
                  {item.active ? "বন্ধ করুন" : "চালু করুন"}
                </Button>
              ) : null}
            </li>
          ))}
          {list.isSuccess && !list.data.items.length ? (
            <li className="px-3 py-4 text-center text-sm text-muted-foreground">এখনো কোনো অপশন নেই</li>
          ) : null}
        </ul>
      </div>
    </AppShell>
  );
}
