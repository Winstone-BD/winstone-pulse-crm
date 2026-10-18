import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { Database } from "@/integrations/supabase/types";
import { createFailureLimiter, requestSourceKey } from "@/lib/rate-limit";

// Only failed attempts count: a whole sales floor shares one office IP, so
// successful sign-ins must never consume the budget.
const loginLimiter = createFailureLimiter(10, 5 * 60_000);

/**
 * Sign-in for the Winstone Connect Android app.
 *
 * POST /api/public/agent/login  { email, password }
 * Header: x-ingest-secret
 *
 * Same credentials as the web CRM: the agent types the email + password of
 * their Winstone Connect account, the server verifies it with Auth and returns
 * the desk identity (employee id / agent id / name) the app posts afterwards.
 */
const Body = z.object({
  email: z.string().trim().min(3).max(160),
  password: z.string().min(6).max(200),
  device_label: z.string().trim().max(120).nullable().optional(),
  app_version: z.string().trim().max(40).nullable().optional(),
  /** The SIM the phone actually calls from; bound to this desk on first login. */
  sim_number: z.string().trim().max(25).nullable().optional(),
});

function phoneKey(value: string): string | null {
  const digits = value.replace(/\D+/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

/** Phone number or Employee ID → the email of that desk account. */
async function resolveLoginEmail(raw: string): Promise<string | null> {
  if (raw.includes("@")) return raw;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows } = await supabaseAdmin
    .from("profiles")
    .select("email, phone, employee_id")
    .not("email", "is", null)
    .limit(500);
  const wantId = raw.toUpperCase().replace(/\s+/g, "");
  const wantPhone = phoneKey(raw);

  // Employee ID is unique, so it wins over a phone two desks may share.
  const byId = (rows ?? []).find(
    (row) => (row.employee_id ?? "").toUpperCase().replace(/\s+/g, "") === wantId,
  );
  if (byId?.email) return byId.email;

  const byPhone = (rows ?? []).filter(
    (row) => wantPhone !== null && row.phone !== null && phoneKey(row.phone) === wantPhone,
  );
  if (byPhone.length !== 1) return null;
  return byPhone[0]?.email ?? null;
}

/** Audit a failed / locked-out sign-in. Never stores the password. */
async function recordLoginFailure(
  sourceKey: string,
  request: Request,
  identifier: string | null,
  reason: "unknown_account" | "wrong_password" | "locked",
) {
  const { logAudit } = await import("@/lib/audit.server");
  await logAudit({
    action: reason === "locked" ? "agent_login_locked" : "agent_login_failed",
    entityType: "agent_login",
    actorLabel: "Android sign-in",
    metadata: {
      reason,
      identifier: identifier ? identifier.slice(0, 80) : null,
      source: sourceKey,
      device: request.headers.get("x-device-id")?.slice(0, 80) ?? null,
      user_agent: request.headers.get("user-agent")?.slice(0, 120) ?? null,
    },
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/**
 * Which desks a CRM role may open in the Android app.
 * Agents are limited to their own desk: Executive HQ and IT Console are never
 * offered to them, on the server side, so a tampered APK gains nothing.
 */
function allowedRolesFor(role: string | null): string[] {
  if (role === "admin") return ["agent", "coordinator", "executive", "it_console"];
  if (role === "team_leader") return ["agent", "coordinator"];
  return ["agent"];
}

function isNewKey(value: string) {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

export const Route = createFileRoute("/api/public/agent/login")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const sourceKey = requestSourceKey(request);
        if (!loginLimiter.check(sourceKey)) {
          void recordLoginFailure(sourceKey, request, null, "locked");
          return json({ error: "অনেকবার চেষ্টা হয়েছে — কিছুক্ষণ পরে আবার চেষ্টা করুন" }, 429);
        }
        // Bootstrap endpoint: the only credential is the agent's own CRM
        // email + password. Nothing privileged is shipped inside the APK.
        const raw = await request.json().catch(() => null);
        const parsed = Body.safeParse(raw);
        if (!parsed.success) return json({ error: "ইমেইল ও পাসওয়ার্ড দিন" }, 400);

        const url = process.env["SUPABASE_URL"];
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"];
        if (!url || !key) return json({ error: "Auth not configured" }, 500);

        const auth = createClient<Database>(url, key, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const headers = new Headers(init?.headers);
              if (isNewKey(key) && headers.get("Authorization") === `Bearer ${key}`) {
                headers.delete("Authorization");
              }
              headers.set("apikey", key);
              return fetch(input, { ...init, headers });
            },
          },
        });

        const loginEmail = await resolveLoginEmail(parsed.data.email);
        if (!loginEmail) {
          loginLimiter.record(sourceKey);
          void recordLoginFailure(sourceKey, request, parsed.data.email, "unknown_account");
          return json({ error: "এই ফোন নম্বর বা Employee ID পাওয়া যায়নি" }, 401);
        }

        const { data: session, error } = await auth.auth.signInWithPassword({
          email: loginEmail,
          password: parsed.data.password,
        });
        if (error || !session.user) {
          loginLimiter.record(sourceKey);
          void recordLoginFailure(sourceKey, request, parsed.data.email, "wrong_password");
          return json({ error: "লগইন তথ্য মিলছে না" }, 401);
        }

        // A reset link or IT-set password flags the account: the agent must
        // choose their own password on the web before the phone can sign in.
        if ((session.user.app_metadata as Record<string, unknown> | undefined)?.["must_change_password"] === true) {
          void auth.auth.signOut().catch(() => {});
          return json(
            {
              error:
                "নতুন পাসওয়ার্ড সেট করা বাকি — IT-এর দেওয়া একবারের লিংক খুলে পাসওয়ার্ড সেট করুন, তারপর অ্যাপে লগইন করুন",
              code: "must_change_password",
            },
            403,
          );
        }


        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id, name, employee_id, phone, sim_number, role, is_active, approval_status")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (!profile) {
          return json(
            { error: "এই অ্যাকাউন্টের ডেস্ক প্রোফাইল তৈরি হয়নি — CRM এ একবার সাইন ইন করুন" },
            403,
          );
        }
        if (profile.approval_status !== "approved" || !profile.is_active) {
          return json({ error: "অ্যাকাউন্ট এখনও অনুমোদনের অপেক্ষায় আছে" }, 403);
        }

        // The phone posts every call/WhatsApp log with an employee id, so make
        // sure an approved desk always has one.
        let employeeId = profile.employee_id;
        if (!employeeId) {
          employeeId = `WIN${String(Date.now()).slice(-6)}`;
          await supabaseAdmin
            .from("profiles")
            .update({ employee_id: employeeId })
            .eq("id", profile.id);
        }

        // A SIM already bound to another desk is refused before any token is
        // issued, so SIM calls can never sync under the wrong agent.
        const { bindAgentSim } = await import("@/lib/agent-sim.server");
        const simCandidate = parsed.data.sim_number ?? profile.sim_number ?? profile.phone;
        const preCheck = await bindAgentSim({ profileId: profile.id, sim: simCandidate });
        if (preCheck.status === "conflict") {
          return json(
            { error: `এই সিম নম্বরটি ${preCheck.ownerName}-এর অ্যাকাউন্টে যুক্ত আছে` },
            409,
          );
        }

        // Every phone gets its own token, bound to this profile. The APK stores
        // the token; the server only ever keeps its SHA-256 hash.
        const { issueDeviceToken } = await import("@/lib/device-auth.server");
        const device = await issueDeviceToken({
          profileId: profile.id,
          deviceLabel: parsed.data.device_label ?? null,
          appVersion: parsed.data.app_version ?? null,
          phoneNumber: "sim" in preCheck ? preCheck.sim : null,
        });
        if ("sim" in preCheck && preCheck.sim) {
          await bindAgentSim({
            profileId: profile.id,
            sim: preCheck.sim,
            deviceId: device.deviceId,
          });
        }

        return json({
          ok: true,
          device_token: device.token,
          device_id: device.deviceId,
          agent: {
            id: profile.id,
            name: profile.name,
            employee_id: employeeId,
            phone: profile.phone,
            sim_number: "sim" in preCheck ? preCheck.sim : profile.sim_number,
            role: profile.role,
            // Least privilege: the phone only ever shows the desks this role
            // owns. A plain agent gets exactly one — never HQ or IT Console.
            allowed_roles: allowedRolesFor(profile.role),
          },
        });
      },
    },
  },
});
