/**
 * Push notifications for web browsers and the Winstone Connect Android app.
 *
 * One path for both: a device registers its Firebase token in `push_tokens`,
 * and server code sends through the Lovable connector gateway (FCM HTTP v1).
 * When Firebase is not connected yet, sends are skipped quietly — the in-app
 * alert row and unread badge still work, so nothing depends on push being live.
 *
 * Every send is written to `push_deliveries` keyed by an event key, so the same
 * support event never notifies the same phone twice.
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function credentials() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["FIREBASE_MESSAGING_API_KEY"];
  if (!lovableKey || !connectionKey) return null;
  return { lovableKey, connectionKey };
}

export type PushPayload = {
  title: string;
  body: string;
  /** Deep-link path inside the app / Android activity route. */
  path?: string;
  data?: Record<string, string>;
};

/** Registers or refreshes one device token. Safe to call on every app start. */
export async function savePushToken(input: {
  profileId: string;
  token: string;
  platform: "web" | "android";
  deviceId?: string | null;
  label?: string | null;
}) {
  const supabaseAdmin = await admin();
  const { error } = await supabaseAdmin.from("push_tokens").upsert(
    {
      profile_id: input.profileId,
      token: input.token,
      platform: input.platform,
      device_id: input.deviceId ?? null,
      label: input.label ?? null,
      last_seen_at: new Date().toISOString(),
      revoked_at: null,
    },
    { onConflict: "token" },
  );
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function revokePushToken(token: string) {
  const supabaseAdmin = await admin();
  await supabaseAdmin
    .from("push_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("token", token);
}

async function tokensFor(profileIds: string[]) {
  if (profileIds.length === 0) return [];
  const supabaseAdmin = await admin();
  const { data } = await supabaseAdmin
    .from("push_tokens")
    .select("token, platform, profile_id")
    .in("profile_id", profileIds)
    .is("revoked_at", null);
  return data ?? [];
}

/**
 * Sends one notification to every registered device of these profiles.
 * `eventKey` makes the whole send idempotent.
 */
export async function sendPush(input: {
  eventKey: string;
  kind: string;
  entityId?: string | null;
  profileIds: string[];
  payload: PushPayload;
}): Promise<{ sent: number; failed: number; skipped?: string }> {
  const supabaseAdmin = await admin();

  // Idempotency: the ledger row is the claim. A duplicate event does nothing.
  const { error: claimError } = await supabaseAdmin.from("push_deliveries").insert({
    event_key: input.eventKey,
    kind: input.kind,
    entity_id: input.entityId ?? null,
    provider: "firebase_messaging",
  });
  if (claimError) return { sent: 0, failed: 0, skipped: "already_sent" };

  const creds = credentials();
  const tokens = await tokensFor(input.profileIds);
  await supabaseAdmin
    .from("push_deliveries")
    .update({ recipients: tokens.length })
    .eq("event_key", input.eventKey);

  if (!creds) {
    await supabaseAdmin
      .from("push_deliveries")
      .update({ error_message: "firebase_not_connected" })
      .eq("event_key", input.eventKey);
    return { sent: 0, failed: 0, skipped: "firebase_not_connected" };
  }
  if (tokens.length === 0) return { sent: 0, failed: 0, skipped: "no_devices" };

  let sent = 0;
  let failed = 0;
  let lastError: string | null = null;

  for (const row of tokens) {
    const message = {
      message: {
        token: row.token,
        notification: { title: input.payload.title, body: input.payload.body },
        data: {
          ...(input.payload.data ?? {}),
          kind: input.kind,
          path: input.payload.path ?? "/desk",
        },
      },
    };
    try {
      const response = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.lovableKey}`,
          "X-Connection-Api-Key": creds.connectionKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });
      if (response.ok) {
        sent += 1;
        continue;
      }
      const text = await response.text();
      failed += 1;
      lastError = `[${response.status}] ${text}`;
      // A dead token is dropped instead of retried forever.
      if (response.status === 404 || response.status === 400) await revokePushToken(row.token);
    } catch (error) {
      failed += 1;
      lastError = error instanceof Error ? error.message : "push failed";
    }
  }

  await supabaseAdmin
    .from("push_deliveries")
    .update({ delivered: sent, failed, error_message: lastError })
    .eq("event_key", input.eventKey);

  return { sent, failed };
}
