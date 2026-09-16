import { createServerFn } from "@tanstack/react-start";

/**
 * Homepage "best performer of the day" board.
 *
 * Public on purpose — the entry hall is shown before sign-in — so it returns
 * only floor-level aggregates and agent display names, never phone numbers,
 * lead data or anything customer-identifying.
 */
export const topPerformerToday = createServerFn({ method: "GET" }).handler(async () => {
  const { dailyTopPerformer } = await import("@/lib/top-performer.server");
  return dailyTopPerformer();
});
