import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "staff-photos";
const MAX_BYTES = 1_500_000;

/** A signed-in staff member uploads their own current photo (square JPEG). */
export const uploadMyPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ dataUrl: z.string().startsWith("data:image/jpeg;base64,").max(2_200_000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const bytes = Buffer.from(data.dataUrl.slice("data:image/jpeg;base64,".length), "base64");
    if (bytes.length < 8_000) throw new Error("ছবিটি খুব ছোট বা অস্পষ্ট — পরিষ্কার ছবি দিন");
    if (bytes.length > MAX_BYTES) throw new Error("ছবিটি ১.৫ MB-এর বেশি");
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error("শুধু ছবি (JPEG) দেওয়া যাবে");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: me } = await supabaseAdmin.from("profiles").select("id").eq("user_id", context.userId).maybeSingle();
    if (!me) throw new Error("প্রোফাইল পাওয়া যায়নি");
    const path = `${me.id}/${Date.now()}.jpg`;
    const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, { contentType: "image/jpeg", upsert: false });
    if (upErr) throw new Error(upErr.message);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ photo_path: path, photo_updated_at: new Date().toISOString() })
      .eq("id", me.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Short-lived links for staff photos. Signed-in staff only; profile ids only. */
export const staffPhotoUrls = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ adminToken: z.string().nullable().optional(), profileIds: z.array(z.string().uuid()).max(300) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope === "none" || !data.profileIds.length) return {} as Record<string, string>;
    // Agents may only load their own photo; HQ / IT authority may load any staff photo.
    const ids = caller.scope === "authority" ? data.profileIds : data.profileIds.filter((id) => id === caller.profile?.id);
    if (!ids.length) return {} as Record<string, string>;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin.from("profiles").select("id, photo_path").in("id", ids).not("photo_path", "is", null);
    const paths = (rows ?? []).map((r) => r.photo_path!);
    if (!paths.length) return {} as Record<string, string>;
    const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrls(paths, 120);
    const byPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    const out: Record<string, string> = {};
    for (const r of rows ?? []) {
      const u = byPath.get(r.photo_path!);
      if (u) out[r.id] = u;
    }
    return out;
  });
