import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, LogIn } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import logoAsset from "@/assets/winstone-mark.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { signInWithIdentifier } from "@/lib/accounts.functions";
import { ensureRegistered } from "@/lib/session";

const SearchSchema = z.object({
  role: z.literal("agent").catch("agent"),
  // Public self-registration is retired: IT HQ provisions every account.
  mode: z.literal("signin").catch("signin"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (search) => SearchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Sign in — Winstone Pulse" },
      {
        name: "description",
        content:
          "Sales agents sign in to their Winstone Pulse desk with the credentials IT HQ assigned.",
      },
      { property: "og:title", content: "Sign in — Winstone Pulse" },
      {
        property: "og:description",
        content: "Sales Agent access to the Winstone Pulse tele-sales floor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const ROLE_LABEL = { agent: "Sales Agent" } as const;

function AuthPage() {
  const { role, mode } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const signIn = useMutation({
    mutationFn: async () => {
      const tokens = await signInWithIdentifier({
        data: { identifier: email.trim(), password },
      });
      const { error } = await supabase.auth.setSession(tokens);
      if (error) throw new Error(error.message);
      await ensureRegistered();
    },
    onSuccess: () => {
      toast.success("Signed in");
      void navigate({ to: "/desk" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  void mode;
  const isSignup = false;
  const busy = signIn.isPending;
  const canSubmit = email.trim().length >= 4 && password.length >= 6;

  return (
    <div className="theme-light grid min-h-dvh lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-secondary p-12 lg:flex">
        <span className="text-sm font-semibold tracking-tight">WINSTONE PULSE</span>
        <div>
          <h2 className="text-5xl font-bold leading-tight tracking-tight">
            Call smarter,
            <br />
            close more homes.
          </h2>
          <p className="mt-4 max-w-md text-lg text-muted-foreground">
            The Premium Real Estate CRM for your sales floor. Find. Build. Invest.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">© 2026 Winstone Properties Ltd.</p>
      </aside>
      <div className="flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md p-2 sm:p-6">
        <Link to="/" className="flex items-center gap-3">
          <img
            src={logoAsset.url}
            alt="Winstone logo"
            className="size-11 rounded-full object-cover ring-1 ring-border"
          />
          <span>
            <span className="block text-sm font-bold tracking-tight">Winstone Pulse</span>
            <span className="block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {ROLE_LABEL[role]}
            </span>
          </span>
        </Link>

        <h1 className="mt-6 text-xl font-bold tracking-tight">
          {isSignup ? "Create your account" : "Sign in to your desk"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isSignup
            ? "IT Console approves new accounts before the floor data opens up."
            : "Use your phone number, Employee ID or email."}
        </p>

        <div className="mt-5 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">{isSignup ? "Email" : "Phone / Employee ID / Email"}</Label>
            <Input
              id="email"
              type={isSignup ? "email" : "text"}
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isSignup ? "you@winstonebd.com" : "01805049668 or WIN2601"}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSubmit && !busy) {
                  signIn.mutate();
                }
              }}
            />
          </div>

          <Button
            className="w-full"
            disabled={!canSubmit || busy}
            onClick={() => signIn.mutate()}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LogIn className="size-4" />
            )}
            {isSignup ? "Create account" : "Sign in"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            New agent accounts are created and managed by Winstone IT HQ.
          </p>
          <p className="text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:underline">
              Back to the entry hall
            </Link>
          </p>
        </div>
    </div>
    </div>
    </div>
  );
}
