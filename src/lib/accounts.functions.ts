import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RequestedRole = z.literal("agent");

/** Digits only, compared on the last 10 so 01805049668 / +8801805049668 match. */
function phoneKey(value: string): string | null {
  const digits = value.replace(/\D+/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

const SIGN_IN_FAILED = "সাইন ইন ব্যর্থ — আইডি বা পাসওয়ার্ড ভুল";

/**
 * Agents sign in with a phone number, Employee ID or email. The identifier is
 * resolved and the password checked on the server, so no account email is ever
 * returned to an unauthenticated browser. Returns session tokens only.
 */
export const signInWithIdentifier = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        identifier: z.string().trim().min(3).max(160),
        password: z.string().min(1).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const raw = data.identifier.trim();
    let email: string | null = raw.includes("@") ? raw : null;

    if (!email) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows } = await supabaseAdmin
        .from("profiles")
        .select("email, phone, employee_id")
        .not("email", "is", null)
        .limit(500);
      const wantId = raw.toUpperCase().replace(/\s+/g, "");
      const wantPhone = phoneKey(raw);
      const byId = (rows ?? []).find(
        (row) => (row.employee_id ?? "").toUpperCase().replace(/\s+/g, "") === wantId,
      );
      if (byId?.email) email = byId.email;
      else {
        const byPhone = (rows ?? []).filter(
          (row) => wantPhone !== null && row.phone !== null && phoneKey(row.phone) === wantPhone,
        );
        if (byPhone.length === 1 && byPhone[0]?.email) email = byPhone[0]?.email ?? null;
      }
    }
    if (!email) throw new Error(SIGN_IN_FAILED);

    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error(SIGN_IN_FAILED);
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
            headers.delete("Authorization");
          }
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });
    const { data: auth, error } = await client.auth.signInWithPassword({
      email,
      password: data.password,
    });
    if (error || !auth.session) throw new Error(SIGN_IN_FAILED);
    return {
      access_token: auth.session.access_token,
      refresh_token: auth.session.refresh_token,
    };
  });

/**
 * Called right after sign-up / first sign-in. Everybody — roster staff
 * included — lands in "pending" and waits for the IT Console to approve the
 * account. The roster only pre-fills the role the approval will grant.
 * Idempotent.
 */
export const registerMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(80),
        phone: z.string().trim().max(24).optional().nullable(),
        requestedRole: RequestedRole,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing) return { ok: true as const, created: false as const };

    const email = typeof context.claims["email"] === "string" ? context.claims["email"] : null;
    const { rosterRole, normalizeName } = await import("@/lib/roster.server");
    const rostered = rosterRole(data.name);

    if (rostered && email) {
      // Link this sign-up to a waiting desk profile ONLY when IT already put
      // this exact (verified) sign-in email on that profile. A matching name
      // alone is never enough — anyone can type a colleague's name.
      const { data: unclaimed } = await supabaseAdmin
        .from("profiles")
        .select("id, name, email")
        .is("user_id", null)
        .ilike("email", email)
        .limit(5);
      const match = (unclaimed ?? []).find(
        (row) =>
          (row.email ?? "").toLowerCase() === email.toLowerCase() &&
          normalizeName(row.name) === normalizeName(data.name),
      );

      if (match) {
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({
            user_id: context.userId,
            email,
            phone: data.phone || null,
            role: rostered,
            requested_role: rostered,
            approval_status: "pending",
            is_active: true,
          })
          .eq("id", match.id);
        if (error) throw new Error(error.message);
        return { ok: true as const, created: false as const };
      }
    }

    const { error } = await supabaseAdmin.from("profiles").insert({
      user_id: context.userId,
      name: data.name,
      phone: data.phone || null,
      email,
      role: rostered ?? "agent",
      requested_role: rostered ?? "agent",
      approval_status: "pending",
      is_active: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const, created: true as const };
  });

/** Who am I? Drives the role-aware shell, nav and landing redirect. */
export const getMyAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ adminToken: z.string().nullable().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { resolveCaller, deckAccess } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    return {
      scope: caller.scope,
      deck: deckAccess(caller),
      approval: caller.approval,
      signedIn: caller.userId !== null,
      itAuthenticated: Boolean(caller.userId && data.adminToken && (await import("@/lib/admin-gate.server")).itAccountTokenUser(data.adminToken) === caller.userId && caller.scope === "authority"),
      profile: caller.profile
        ? {
            id: caller.profile.id,
            name: caller.profile.name,
            phone: caller.profile.phone,
            email: caller.profile.email,
            employee_id: caller.profile.employee_id,
            avatar_hue: caller.profile.avatar_hue,
            photo_updated_at: caller.profile.photo_updated_at ?? null,
            has_photo: Boolean(caller.profile.photo_path),
            role: caller.profile.role,
            requested_role: caller.profile.requested_role,
          }
        : null,
    };
  });

/** Agents keep their own profile up to date (name, phone, avatar colour). */
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(80),
        phone: z.string().trim().max(24).optional().nullable(),
        avatarHue: z.number().int().min(0).max(360),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ name: data.name, phone: data.phone || null, avatar_hue: data.avatarHue })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Pending sign-ups, for the IT Console / HQ approval list. */
export const listAccountRequests = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ adminToken: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    requireAuthority(await resolveCaller(data.adminToken));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email, phone, requested_role, approval_status, created_at, role")
      .not("user_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { accounts: rows ?? [] };
  });

/** Approve as agent or reject. Coordinator accounts are retired. */
export const decideAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        adminToken: z.string(),
        profileId: z.string().uuid(),
        decision: z.enum(["approve_agent", "reject"]),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    {
      const decider = await resolveCaller(data.adminToken);
      requireAuthority(decider);
      const { requireWrite } = await import("@/lib/access.server");
      requireWrite(decider);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch =
      data.decision === "reject"
        ? { approval_status: "rejected", is_active: false }
        : {
            approval_status: "approved",
            is_active: true,
            role: "agent" as const,
          };

    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.profileId);
    if (error) throw new Error(error.message);

    if (data.decision !== "reject") {
      const { refreshAgentDriveFolder } = await import("@/lib/drive-agent-folders.server");
      await refreshAgentDriveFolder(data.profileId);
    }

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      action: data.decision === "reject" ? "account_rejected" : "account_approved",
      entityType: "profile",
      entityId: data.profileId,
      metadata: { decision: data.decision, role: "role" in patch ? patch.role : null },
    });
    if ("role" in patch) {
      await logAudit({
        action: "role_changed",
        entityType: "profile",
        entityId: data.profileId,
        metadata: { role: patch.role },
      });
    }
    return { ok: true };
  });

const StaffRole = z.literal("agent");

function fallbackEmail(employeeId: string | null, phone: string | null) {
  const local = (employeeId || phone || "").replace(/[^A-Za-z0-9]/g, "").toLowerCase();
  if (!local) return null;
  return `${local}@winstonebd.com`;
}

/** Staff roster for the IT Console table: name, Agent ID, phone, live status. */
export const listStaffAccounts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ adminToken: z.string().nullable().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    requireAuthority(await resolveCaller(data.adminToken ?? null));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [staffRes, leadsRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select(
          "id, user_id, name, email, phone, employee_id, role, is_active, approval_status, created_at",
        )
        .order("employee_id", { ascending: true }),
      supabaseAdmin.from("leads").select("assigned_to"),
    ]);
    if (staffRes.error) throw new Error(staffRes.error.message);
    if (leadsRes.error) throw new Error(leadsRes.error.message);

    const assigned = new Map<string, number>();
    for (const lead of leadsRes.data ?? []) {
      if (lead.assigned_to)
        assigned.set(lead.assigned_to, (assigned.get(lead.assigned_to) ?? 0) + 1);
    }
    return {
      staff: (staffRes.data ?? []).map((row) => ({
        ...row,
        assignedLeads: assigned.get(row.id) ?? 0,
      })),
    };
  });

/**
 * Opens a live desk account straight from the IT Console: creates the sign-in
 * user, then an approved active profile. The agent signs in with the phone
 * number or Agent ID plus this password.
 */
export const createStaffAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        adminToken: z.string().nullable().optional(),
        name: z.string().trim().min(2).max(80),
        employeeId: z.string().trim().min(2).max(24),
        phone: z.string().trim().min(6).max(24),
        password: z.string().min(6).max(72),
        email: z.string().trim().email().optional().nullable(),
        role: StaffRole.default("agent"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    requireAuthority(caller);
    (await import("@/lib/access.server")).requireWrite(caller);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const employeeId = data.employeeId.toUpperCase().replace(/\s+/g, "");
    const email = data.email?.trim() || fallbackEmail(employeeId, data.phone);
    if (!email) throw new Error("ইমেইল বা Agent ID দরকার");

    const { data: clash } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("employee_id", employeeId)
      .maybeSingle();
    if (clash) throw new Error("এই Agent ID আগেই আছে");

    const created = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      app_metadata: { must_change_password: true },
      user_metadata: { name: data.name, employee_id: employeeId },
    });
    if (created.error || !created.data.user) {
      throw new Error(created.error?.message ?? "সাইন-ইন অ্যাকাউন্ট তৈরি হয়নি");
    }

    const role = "agent" as const;
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .insert({
        user_id: created.data.user.id,
        name: data.name,
        phone: data.phone,
        email,
        employee_id: employeeId,
        role,
        requested_role: role,
        approval_status: "approved",
        is_active: true,
      })
      .select("id")
      .single();
    if (error) {
      await supabaseAdmin.auth.admin.deleteUser(created.data.user.id);
      throw new Error(error.message);
    }

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      action: "agent_account_created",
      entityType: "profile",
      entityId: profile.id,
      actorProfileId: caller.profile?.id ?? null,
      actorLabel: caller.profile?.name ?? "Authority PIN",
      metadata: { employeeId, role },
    });

    const { refreshAgentDriveFolder } = await import("@/lib/drive-agent-folders.server");
    await refreshAgentDriveFolder(profile.id);

    return { ok: true, profileId: profile.id, email };
  });

/** Edit name / Agent ID / phone / password, or deactivate a desk account. */
export const updateStaffAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        adminToken: z.string().nullable().optional(),
        profileId: z.string().uuid(),
        name: z.string().trim().min(2).max(80).optional(),
        employeeId: z.string().trim().min(2).max(24).optional(),
        phone: z.string().trim().min(6).max(24).optional(),
        password: z.string().min(6).max(72).optional(),
        isActive: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    requireAuthority(caller);
    (await import("@/lib/access.server")).requireWrite(caller);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile, error: readError } = await supabaseAdmin
      .from("profiles")
      .select("id, user_id")
      .eq("id", data.profileId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!profile) throw new Error("অ্যাকাউন্ট পাওয়া যায়নি");

    const patch: {
      name?: string;
      employee_id?: string;
      phone?: string;
      is_active?: boolean;
    } = {};
    if (data.name) patch["name"] = data.name;
    if (data.employeeId) patch["employee_id"] = data.employeeId.toUpperCase().replace(/\s+/g, "");
    if (data.phone) patch["phone"] = data.phone;
    if (typeof data.isActive === "boolean") patch["is_active"] = data.isActive;

    if (Object.keys(patch).length) {
      const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", profile.id);
      if (!error && ("name" in patch || "employee_id" in patch)) {
        const { refreshAgentDriveFolder } = await import("@/lib/drive-agent-folders.server");
        await refreshAgentDriveFolder(profile.id);
      }
      if (error) throw new Error(error.message);
    }

    if (data.password) {
      if (!profile.user_id) throw new Error("এই প্রোফাইলে সাইন-ইন অ্যাকাউন্ট নেই");
      const { error } = await supabaseAdmin.auth.admin.updateUserById(profile.user_id, {
        password: data.password,
        app_metadata: { must_change_password: true },
      });
      if (error) throw new Error(error.message);
    }

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      action: "agent_account_updated",
      entityType: "profile",
      entityId: profile.id,
      actorProfileId: caller.profile?.id ?? null,
      actorLabel: caller.profile?.name ?? "Authority PIN",
      metadata: {
        fields: Object.keys(patch),
        passwordChanged: Boolean(data.password),
      },
    });

    return { ok: true };
  });

/** Direct security notice to one agent (web bell + Android notices). Never contains the link. */
async function notifyAgentSecurity(profileId: string, title: string, body: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: notice, error } = await supabaseAdmin
    .from("it_notices")
    .insert({ title, body, severity: "urgent", audience_type: "accounts", author_label: "IT Security" })
    .select("id")
    .single();
  if (error || !notice) {
    console.error("security notice failed", error);
    return;
  }
  await supabaseAdmin.from("it_notice_recipients").insert({ notice_id: notice.id, profile_id: profileId });
}

/**
 * IT issues a one-time password reset link for one agent. The link is a
 * single-use recovery link from the auth service (expires automatically); it
 * is returned once to the IT screen, never stored or logged. The account is
 * flagged so the agent must set a new password before using the desk.
 */
export const issuePasswordResetLink = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        adminToken: z.string().nullable().optional(),
        profileId: z.string().uuid(),
        origin: z.string().url().max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const access = await import("@/lib/access.server");
    const caller = await access.resolveCaller(data.adminToken ?? null);
    access.requireAuthority(caller);
    access.requireWrite(caller);
    // Exact trusted hosts only — recovery tokens must never be redirected to other subdomains.
    const allowed = [
      "https://crm.winstonebd.com",
      "https://winstone-pulse-crm.lovable.app",
      "https://winstone-crm-v01.lovable.app",
      "https://id-preview--990267f3-4198-4d83-ae21-7d9c802617f4.lovable.app",
    ];
    const origin = new URL(data.origin).origin;
    const safeOrigin = allowed.includes(origin) ? origin : allowed[0]!;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, user_id, name, employee_id")
      .eq("id", data.profileId)
      .maybeSingle();
    if (!profile?.user_id) throw new Error("এই প্রোফাইলে সাইন-ইন অ্যাকাউন্ট নেই");
    const { data: authUser, error: userErr } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
    const email = authUser?.user?.email;
    if (userErr || !email) throw new Error("সাইন-ইন ইমেইল পাওয়া যায়নি");

    await supabaseAdmin.auth.admin.updateUserById(profile.user_id, {
      app_metadata: { ...(authUser.user.app_metadata ?? {}), must_change_password: true },
    });
    // The recovery link goes ONLY to the employee's own sign-in email — it is
    // never returned to the IT screen, so IT cannot take over the account.
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${safeOrigin}/reset-password`,
    });
    if (error) throw new Error("রিসেট ইমেইল পাঠানো যায়নি");

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      action: "agent_password_reset_link_issued",
      entityType: "profile",
      entityId: profile.id,
      actorProfileId: caller.profile?.id ?? null,
      actorLabel: caller.profile?.name ?? "Authority PIN",
      metadata: { employeeId: profile.employee_id },
    });
    await notifyAgentSecurity(
      profile.id,
      "পাসওয়ার্ড রিসেট লিংক তৈরি হয়েছে",
      `IT আপনার অ্যাকাউন্টের জন্য একটি পাসওয়ার্ড রিসেট লিংক তৈরি করেছে (${new Date().toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })} ঢাকা)। আপনি না চাইলে এখনই HQ/IT-কে জানান।`,
    );
    return { link: actionLink, name: profile.name };
  });

/** After the agent saves a new password, clear the must-change flag. */
export const clearMustChangePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const meta = { ...(data?.user?.app_metadata ?? {}), must_change_password: false };
    await supabaseAdmin.auth.admin.updateUserById(context.userId, { app_metadata: meta });
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (profile) {
      await notifyAgentSecurity(
        profile.id,
        "আপনার পাসওয়ার্ড বদলানো হয়েছে",
        `আপনার অ্যাকাউন্টের পাসওয়ার্ড ${new Date().toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })} (ঢাকা)-এ বদলানো হয়েছে। আপনি না করে থাকলে এখনই HQ/IT-কে জানান।`,
      );
    }
    return { ok: true };
  });
