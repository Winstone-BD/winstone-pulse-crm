/**
 * Shared AI gateway helper. One model switch for every CRM AI feature:
 * HQ picks OpenAI or Gemini once (app_config row id "ai") and every feature
 * follows it. The key stays server-side.
 */
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type AiModelChoice = "openai" | "gemini";

export const AI_MODEL_IDS: Record<AiModelChoice, string> = {
  openai: "openai/gpt-6-astra",
  gemini: "google/gemini-3.8-flash",
};

export async function getAiModelChoice(): Promise<AiModelChoice> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_config")
    .select("data")
    .eq("id", "ai")
    .maybeSingle();
  const value = (data?.data as { model?: string } | null)?.model;
  return value === "gemini" ? "gemini" : "openai";
}

export async function setAiModelChoice(model: AiModelChoice): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("app_config")
    .upsert({ id: "ai", data: { model }, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

/** One JSON-mode chat call through the Lovable AI Gateway. Throws a safe message on failure. */
export async function aiChatJson<T>(args: { system: string; user: string }): Promise<T> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI service is not configured");

  const choice = await getAiModelChoice();
  const body: Record<string, unknown> = {
    model: AI_MODEL_IDS[choice],
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
    response_format: { type: "json_object" },
  };
  // gpt-6-astra requires an explicit reasoning effort and rejects temperature.
  if (choice === "openai") body["reasoning_effort"] = "low";

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("ai gateway error", res.status, detail);
    if (res.status === 402 || res.status === 403)
      throw new Error("AI credits are exhausted — please try again later");
    if (res.status === 429) throw new Error("AI is busy right now — try again in a moment");
    throw new Error("The AI service is unavailable right now");
  }
  const payload = (await res.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  const text = payload.choices?.[0]?.message?.content ?? "";
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("The AI returned an unreadable answer — please retry");
  }
}
