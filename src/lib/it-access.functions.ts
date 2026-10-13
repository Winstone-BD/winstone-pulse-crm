import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const completeItAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ challenge: z.string().min(1).max(1000) }).parse(input))
  .handler(async ({ data, context }) => {
    const gate = await import("@/lib/admin-gate.server");
    if (!gate.itChallengeValid(data.challenge)) throw new Error("IT PIN expired — enter it again");
    const { data: allowed, error } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (error || !allowed) throw new Error("This account is not authorized for IT Console");
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(null, { skipMaintenance: true });
    if (caller.approval !== "approved" || !caller.profile || caller.readOnly || caller.scope !== "authority") throw new Error("An active approved IT account is required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: auditError } = await supabaseAdmin.from("audit_logs").insert({
      action: "it_account_signed_in", entity_type: "it_session", actor_profile_id: caller.profile.id,
      actor_label: caller.profile.name, metadata: { user_id: context.userId, expires_in_hours: 8 },
    });
    if (auditError) throw new Error("Unable to record IT session — please retry");
    return { token: gate.mintItAccountToken(context.userId) };
  });