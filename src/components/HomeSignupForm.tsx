import { useNavigate } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSignupDraft } from "@/lib/session";

const Schema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{8,20}$/, "Enter a valid phone number"),
});

export function HomeSignupForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = Schema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }
    setError(null);
    saveSignupDraft({ ...parsed.data, requestedRole: "agent" });
    void navigate({ to: "/auth", search: { role: "agent", mode: "signup" } });
  };

  const field = (key: keyof typeof form) => ({
    id: `home-signup-${key}`,
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <section
      aria-labelledby="home-signup-title"
      className="mx-auto mt-10 w-full max-w-xl rounded-xl border border-border bg-card p-5 sm:p-6"
    >
      <h2 id="home-signup-title" className="text-lg font-semibold">
        New sales agent? Join Winstone Pulse
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter your details, then set a password on the next page. IT Console approves new accounts.
      </p>
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2" noValidate>
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor="home-signup-name">Full name</Label>
          <Input {...field("name")} autoComplete="name" maxLength={100} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="home-signup-email">Email</Label>
          <Input {...field("email")} type="email" autoComplete="email" maxLength={255} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="home-signup-phone">Phone</Label>
          <Input {...field("phone")} type="tel" autoComplete="tel" maxLength={20} placeholder="+8801…" />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive sm:col-span-2">
            {error}
          </p>
        )}
        <Button type="submit" className="sm:col-span-2">
          <UserPlus className="size-4" /> Continue to sign-up
        </Button>
      </form>
    </section>
  );
}
