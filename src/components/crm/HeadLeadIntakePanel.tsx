import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Database, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addHeadLead, type HeadLeadResult } from "@/lib/lead-pool.functions";
import { getAdminToken } from "@/lib/local-session";

const EMPTY = {
  name: "",
  phoneNumber: "",
  address: "",
  company: "",
  serialNo: "",
  referenceBy: "",
  notes: "",
};

const BD_MOBILE = /^(?:\+?88)?01[3-9]\d{8}$/;

/**
 * Head-database intake. The lead goes to the unassigned pool (never the
 * caller's own queue) and becomes eligible for the next daily round.
 */
export function HeadLeadIntakePanel() {
  const add = useServerFn(addHeadLead);
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<Extract<HeadLeadResult, { ok: false }> | null>(null);

  const set = (key: keyof typeof EMPTY) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = useMutation({
    mutationFn: () =>
      add({
        data: {
          adminToken: getAdminToken() ?? null,
          name: form.name,
          phoneNumber: form.phoneNumber,
          address: form.address || null,
          company: form.company || null,
          serialNo: form.serialNo || null,
          referenceBy: form.referenceBy,
          notes: form.notes || null,
        },
      }),
    onSuccess: (result) => {
      if (result.ok) {
        toast.success("লিড হেড ডেটাবেজে যোগ হয়েছে — পরের বণ্টনে যাবে");
        setForm(EMPTY);
        setDuplicate(null);
        void queryClient.invalidateQueries({ queryKey: ["lead-pool"] });
        void queryClient.invalidateQueries({ queryKey: ["deck-leads"] });
      } else if (result.reason === "duplicate") {
        setDuplicate(result);
      } else {
        setError(result.message);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setDuplicate(null);
    if (!form.name.trim()) return setError("নাম লিখুন");
    if (!BD_MOBILE.test(form.phoneNumber.replace(/[\s-]/g, "")))
      return setError("সঠিক বাংলাদেশি মোবাইল নম্বর দিন (01XXXXXXXXX)");
    if (!form.referenceBy.trim()) return setError("রেফারেন্স (কে দিয়েছেন) লিখুন");
    setError(null);
    save.mutate();
  };

  return (
    <section className="card-elevated p-4" aria-labelledby="head-intake-title">
      <div className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-md bg-primary/10 text-primary">
          <Database className="size-4" aria-hidden />
        </span>
        <div>
          <h2 id="head-intake-title" className="text-sm font-semibold">
            হেড ডেটাবেজে লিড যোগ / Add to head database
          </h2>
          <p className="text-xs text-muted-foreground">
            লিডটি কারও কিউতে যাবে না — হেড পুলে থাকবে এবং পরের দৈনিক বণ্টনে যাবে।
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2" noValidate>
        <Field id="hl-name" label="নাম *" value={form.name} onChange={set("name")} />
        <Field
          id="hl-phone"
          label="মোবাইল নম্বর *"
          value={form.phoneNumber}
          onChange={set("phoneNumber")}
          inputMode="tel"
          placeholder="01XXXXXXXXX"
        />
        <Field id="hl-address" label="ঠিকানা / এলাকা" value={form.address} onChange={set("address")} />
        <Field id="hl-company" label="প্রতিষ্ঠান" value={form.company} onChange={set("company")} />
        <Field id="hl-serial" label="সিরিয়াল (ফাঁকা = স্বয়ংক্রিয়)" value={form.serialNo} onChange={set("serialNo")} />
        <Field id="hl-ref" label="রেফারেন্স (কে দিয়েছেন) *" value={form.referenceBy} onChange={set("referenceBy")} />
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="hl-notes">নোট / উৎস</Label>
          <Textarea id="hl-notes" rows={2} value={form.notes} onChange={set("notes")} maxLength={1000} />
        </div>

        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive sm:col-span-2">
            {error}
          </p>
        ) : null}

        {duplicate ? (
          <div
            role="alert"
            className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm sm:col-span-2"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <div>
              <p className="font-semibold">{duplicate.message}</p>
              {duplicate.existing ? (
                <p className="text-xs text-muted-foreground">
                  {duplicate.existing.name} · #{duplicate.existing.serialNo ?? "—"} · রেফ:{" "}
                  {duplicate.existing.referenceBy ?? "—"} · অবস্থা: {duplicate.existing.status} ·{" "}
                  {duplicate.existing.agentName ? `এজেন্ট: ${duplicate.existing.agentName}` : "হেড পুলে"}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="sm:col-span-2">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            হেড ডেটাবেজে যোগ করুন
          </Button>
        </div>
      </form>
    </section>
  );
}

function Field(props: {
  id: string;
  label: string;
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  inputMode?: "tel" | "text";
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Input
        id={props.id}
        value={props.value}
        onChange={props.onChange}
        inputMode={props.inputMode}
        placeholder={props.placeholder}
      />
    </div>
  );
}
