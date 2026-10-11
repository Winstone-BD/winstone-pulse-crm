// Shared retry/safe-result policy for every refreshing board and widget.
// A failed background refresh must never blank the page: we retry transient
// failures with backoff and keep showing the last good result meanwhile.
import { keepPreviousData } from "@tanstack/react-query";

const PERMANENT = /(unauthori[sz]ed|forbidden|401|403|404|not found|invalid input|validation)/i;

/** Retry transient failures (network, 5xx, restarts) up to 3 times; never retry auth/validation errors. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  if (PERMANENT.test(msg)) return false;
  return failureCount < 3;
}

/** 1s, 2s, 4s … capped at 15s, with a little jitter so many widgets don't retry at once. */
export function retryDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 15_000) + Math.floor(Math.random() * 300);
}

export const resilientQueryDefaults = {
  staleTime: 30_000,
  refetchOnWindowFocus: false,
  retry: shouldRetry,
  retryDelay,
  // Keep the previous good result visible while a refetch (or key change) is in flight / failing.
  placeholderData: keepPreviousData,
  // A failed background refetch keeps cached data; never throw it into the page.
  throwOnError: false,
} as const;
