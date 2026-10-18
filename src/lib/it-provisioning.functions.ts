import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireItProvisioning, requireItOnboardingStep } from "@/lib/it-provisioning.rules";
import { z } from "zod";

export const inviteItOfficer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ token: z.string().min(1), name: z.string().trim().min(2).max(80), email: z.string().trim().email() }).parse(input))
  .handler(async ({ data, context }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const { itAccountTokenUser } = await import("@/lib/admin-gate.server");
    const { architectFromRequest } = await import("@/lib/maintenance.server");
    const caller = await resolveCaller(data.token, { skipMaintenance: true });
    const architect = await architectFromRequest();
    requireItProvisioning({ userId: context.userId, tokenUserId: itAccountTokenUser(data.token), architectUserId: architect?.userId ?? null, authority: caller.scope === "authority", readOnly: caller.readOnly });
    const email = data.email.toLowerCase();
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: protectedAccount, error: protectedError } = await db.from("privileged_account_allowlist").select("email").eq("email", email).maybeSingle();
    if (protectedError) throw new Error("Unable to check protected identities");
    if (protectedAccount) throw new Error("This is a protected existing identity — use sign-in or password reset, not a new officer invitation");
    const { data: existing, error: lookupError } = await db.from("profiles").select("id").ilike("email", email).maybeSingle();
    if (lookupError) throw new Error("Unable to check account status");
    if (existing) throw new Error("This account already exists — do not create a duplicate");
    const reservation = await db.from("it_officer_onboarding").insert({ email, name: data.name, invited_by: context.userId }).select("id").single();
    if (reservation.error || !reservation.data) throw new Error("An invitation is already recorded or could not be reserved; review the onboarding list before retrying");
    const { error: auditError } = await db.from("audit_logs").insert({ action: "it_officer_invitation_requested", entity_type: "profile", actor_profile_id: caller.profile?.id ?? null, actor_label: caller.profile?.name ?? "Architect", metadata: { email } });
    if (auditError) throw new Error("Unable to audit invitation");
    const invited = await db.auth.admin.inviteUserByEmail(email, { redirectTo: "https://crm.winstonebd.com/reset-password", data: { name: data.name } });
    if (invited.error || !invited.data.user) throw new Error("Invitation could not be confirmed; check account status before trying again");
    const { data: profile, error: profileError } = await db.from("profiles").select("id").eq("user_id", invited.data.user.id).maybeSingle();
    if (profileError) throw new Error("Invitation sent; profile status needs review — do not resend");
    if (!profile) {
      const inserted = await db.from("profiles").insert({ user_id: invited.data.user.id, name: data.name, email, role: "agent", requested_role: "agent", approval_status: "pending", is_active: true });
      if (inserted.error) throw new Error("Invitation sent; pending profile needs review — do not resend");
    }
    const linked = await db.from("profiles").select("id").eq("user_id", invited.data.user.id).single();
    if (linked.error || !linked.data) throw new Error("Invitation sent; account linking needs review");
    const saved = await db.from("it_officer_onboarding").update({ user_id: invited.data.user.id, profile_id: linked.data.id, status: "invited" }).eq("id", reservation.data.id);
    if (saved.error) throw new Error("Invitation sent; onboarding status needs review");
    return { message: "Invitation sent. Verify the email and set a password. IT access remains pending authorized role approval." };
  });

export const listItOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ token: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    await verifyManager(data.token, context.userId);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const result = await db.from("it_officer_onboarding").select("id,name,email,status,invited_at,password_set_at,approved_at,role_assigned_at").order("invited_at", { ascending: false }).limit(100);
    if (result.error) throw new Error("Unable to read IT onboarding");
    return result.data;
  });

async function verifyManager(token: string, userId: string) {
  const { resolveCaller } = await import("@/lib/access.server");
  const { itAccountTokenUser } = await import("@/lib/admin-gate.server");
  const { architectFromRequest } = await import("@/lib/maintenance.server");
  const caller = await resolveCaller(token, { skipMaintenance: true });
  const architect = await architectFromRequest();
  requireItProvisioning({ userId, tokenUserId: itAccountTokenUser(token), architectUserId: architect?.userId ?? null, authority: caller.scope === "authority", readOnly: caller.readOnly });
}

export const decideItOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ token: z.string(), id: z.string().uuid(), action: z.enum(["approve", "assign_role"]), confirmed: z.literal(true) }).parse(input))
  .handler(async ({ data, context }) => {
    await verifyManager(data.token, context.userId);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const row = await db.from("it_officer_onboarding").select("status,user_id,email").eq("id", data.id).single();
    if (row.error || !row.data?.user_id) throw new Error("Linked invitation required");
    const user = await db.auth.admin.getUserById(row.data.user_id);
    requireItOnboardingStep(row.data.status, data.action, Boolean(user.data.user?.email_confirmed_at && user.data.user.email?.toLowerCase() === row.data.email));
    const result = await db.rpc("advance_it_officer_onboarding", { _id: data.id, _action: data.action, _actor: context.userId });
    if (result.error) throw new Error("Account state changed or approval failed; refresh before retrying");
    return { ok: true };
  });

export const setInvitedItPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ password: z.string().min(8).max(128) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const row = await db.from("it_officer_onboarding").select("id,status,email").eq("user_id", context.userId).maybeSingle();
    if (row.error) throw new Error("Unable to verify invitation");
    if (!row.data) return { handled: false };
    const user = await context.supabase.auth.getUser();
    if (!user.data.user?.email_confirmed_at || user.data.user.email?.toLowerCase() !== row.data.email) throw new Error("Verify the invitation email first");
    if (!["invited", "password_set"].includes(row.data.status)) throw new Error("IT password setup already completed");
    const updated = await context.supabase.auth.updateUser({ password: data.password });
    if (updated.error) throw new Error(updated.error.message);
    const advanced = await db.rpc("advance_it_officer_onboarding", { _id: row.data.id, _action: "password_set", _actor: context.userId });
    if (advanced.error) throw new Error("Password saved; onboarding confirmation needs review");
    return { handled: true };
  });
