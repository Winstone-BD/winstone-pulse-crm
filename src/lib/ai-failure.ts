import { GatewayError } from "@lovable.dev/ai-gateway";

/** Never replay an ambiguous generation or expose provider payloads to staff. */
export function aiFailure(error: unknown): Error {
  if (!(error instanceof GatewayError)) return error instanceof Error ? error : new Error("AI service unavailable");
  console.error("AI request failed", { code: error.code, status: error.httpStatus, outcome: error.outcome, ids: error.ids });
  if (error.code === "payment_required") return new Error("AI credits are exhausted — a workspace owner must add credits. Your draft is preserved.");
  if (error.code === "permission_denied") return new Error("AI access is blocked — a workspace administrator must restore access.");
  if (error.code === "rate_limited") return new Error("AI is busy — wait before requesting another draft.");
  return new Error("AI could not finish this request. Your draft is preserved; no automatic resend was made.");
}