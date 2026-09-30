/**
 * Secure PIN vault.
 *
 * The real PIN values are never written to any document. They live encrypted
 * (AES-256-GCM) in `pin_vault`, keyed from ADMIN_TOKEN_SECRET, and every change
 * appends an immutable row to `pin_rotations`. Only a full IT Console session
 * may store, reveal or rotate a PIN; Executive HQ sessions are read-only and
 * never see a value.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type PinSurface = "master" | "it_console" | "leadhub";

export const PIN_SURFACES: { surface: PinSurface; label: string; used: string }[] = [
  {
    surface: "master",
    label: "মাস্টার পিন",
    used: "Executive HQ (শুধু দেখা) এবং আইটি কনসোল আনলক",
  },
  { surface: "it_console", label: "আইটি কনসোল পিন", used: "শুধু আইটি কনসোলের পরিবর্তন" },
  { surface: "leadhub", label: "LeadHub Nexus পিন", used: "শুধু Canonical Lead Database ও assignment" },
];

function key() {
  const secret = process.env["ADMIN_TOKEN_SECRET"];
  if (!secret) throw new Error("ADMIN_TOKEN_SECRET is not configured");
  return createHash("sha256").update(`pin-vault:${secret}`, "utf8").digest();
}

function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), body.toString("base64")].join(
    ".",
  );
}

function decrypt(payload: string): string | null {
  try {
    const [iv, tag, body] = payload.split(".");
    if (!iv || !tag || !body) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(body, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/** Masks a PIN for display: only the length and the last two characters. */
export function pinHint(pin: string): string {
  const tail = pin.slice(-2);
  return `${"•".repeat(Math.max(pin.length - 2, 0))}${tail}`;
}

/** Every PIN currently stored in the vault, plaintext, for unlock comparison only. */
export async function vaultPins(): Promise<string[]> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("pin_vault").select("secret_cipher");
    return (data ?? [])
      .map((row) => decrypt(row.secret_cipher))
      .filter((value): value is string => Boolean(value));
  } catch {
    return [];
  }
}

export async function vaultPinFor(surface: PinSurface): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("pin_vault").select("secret_cipher").eq("surface", surface).maybeSingle();
    return data?.secret_cipher ? decrypt(data.secret_cipher) : null;
  } catch {
    return null;
  }
}

export type VaultEntry = {
  surface: PinSurface;
  label: string;
  used: string;
  stored: boolean;
  hint: string | null;
  note: string | null;
  updatedAt: string | null;
  updatedByLabel: string | null;
};

export type RotationRow = {
  id: string;
  surface: string;
  hint: string;
  reason: string | null;
  note: string | null;
  actorLabel: string | null;
  rotatedAt: string;
};

/** Vault status (never the value) plus the rotation history. */
export async function vaultOverview(): Promise<{ entries: VaultEntry[]; history: RotationRow[] }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [vault, rotations] = await Promise.all([
    supabaseAdmin.from("pin_vault").select("surface, hint, note, updated_at, updated_by_label"),
    supabaseAdmin
      .from("pin_rotations")
      .select("id, surface, hint, reason, note, actor_label, rotated_at")
      .order("rotated_at", { ascending: false })
      .limit(50),
  ]);

  const bySurface = new Map((vault.data ?? []).map((row) => [row.surface, row]));
  const entries = PIN_SURFACES.map(({ surface, label, used }) => {
    const row = bySurface.get(surface);
    return {
      surface,
      label,
      used,
      stored: Boolean(row),
      hint: row?.hint ?? null,
      note: row?.note ?? null,
      updatedAt: row?.updated_at ?? null,
      updatedByLabel: row?.updated_by_label ?? null,
    };
  });

  const history = (rotations.data ?? []).map((row) => ({
    id: row.id,
    surface: row.surface,
    hint: row.hint,
    reason: row.reason,
    note: row.note,
    actorLabel: row.actor_label,
    rotatedAt: row.rotated_at,
  }));

  return { entries, history };
}

/** Reveals one stored PIN. Caller must already hold a full IT Console session. */
export async function revealVault(surface: PinSurface): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("pin_vault")
    .select("secret_cipher")
    .eq("surface", surface)
    .maybeSingle();
  return data?.secret_cipher ? decrypt(data.secret_cipher) : null;
}

/** Stores or rotates a PIN and appends the history row. Idempotent per surface. */
export async function rotateVault(input: {
  surface: PinSurface;
  pin: string;
  reason?: string | null;
  note?: string | null;
  actorLabel?: string | null;
}): Promise<VaultEntry> {
  const hint = pinHint(input.pin);
  const now = new Date().toISOString();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { error } = await supabaseAdmin.from("pin_vault").upsert(
    {
      surface: input.surface,
      secret_cipher: encrypt(input.pin),
      hint,
      note: input.note ?? null,
      updated_by_label: input.actorLabel ?? "IT Console",
      updated_at: now,
    },
    { onConflict: "surface" },
  );
  if (error) throw new Error(error.message);

  await supabaseAdmin.from("pin_rotations").insert({
    surface: input.surface,
    hint,
    reason: input.reason ?? null,
    note: input.note ?? null,
    actor_label: input.actorLabel ?? "IT Console",
    rotated_at: now,
  });

  const meta = PIN_SURFACES.find((item) => item.surface === input.surface)!;
  return {
    surface: input.surface,
    label: meta.label,
    used: meta.used,
    stored: true,
    hint,
    note: input.note ?? null,
    updatedAt: now,
    updatedByLabel: input.actorLabel ?? "IT Console",
  };
}
