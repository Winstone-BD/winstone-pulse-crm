/**
 * Call-mode keyboard shortcuts. Pure helpers so the guards are unit-tested;
 * components wire them to the SAME handlers the visible buttons use.
 *
 *  Ctrl/⌘ + Enter      → submit the open call report (only when complete)
 *  Alt + Shift + N     → open the next eligible lead (only when no dialog/report is open)
 */
export type CallShortcut = "save" | "next";

type KeyLike = Pick<
  KeyboardEvent,
  "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "repeat" | "isComposing"
> & { keyCode?: number; target: EventTarget | null };

const TEXT_INPUT_TYPES = new Set([
  "text", "search", "email", "tel", "url", "password", "number", "date",
  "datetime-local", "time", "month", "week", "",
]);

/** True while the user is typing (text fields, textareas, contenteditable, selects). */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as (HTMLElement & { type?: string; isContentEditable?: boolean }) | null;
  if (!el || typeof el.tagName !== "string") return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "textarea" || tag === "select") return true;
  if (tag === "input") return TEXT_INPUT_TYPES.has(String(el.type ?? "").toLowerCase());
  return Boolean(el.isContentEditable);
}

/** Map a keydown to a call shortcut, or null. Ignores IME composition, key repeat and typing. */
export function matchCallShortcut(e: KeyLike): CallShortcut | null {
  if (e.isComposing || e.keyCode === 229) return null;
  if (e.repeat) return null;
  if (isTypingTarget(e.target)) return null;
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) return "save";
  // code (not key) so Mac Option-N dead keys still match; ctrl/meta excluded (AltGr = Ctrl+Alt).
  if (e.code === "KeyN" && e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey) return "next";
  return null;
}

/** Save is allowed only when the same conditions that enable the button hold. */
export function canSaveReport(s: { missing: string | null; pending: boolean; open: boolean }): boolean {
  return s.open && !s.missing && !s.pending;
}

/** Next eligible lead: same rule as auto-advance after a saved report. */
export function pickNextEligible<T extends { id: string; status?: string | null; work_state?: string | null }>(
  rows: T[],
  skip: Iterable<string>,
  currentId?: string | null,
): T | null {
  const s = new Set(skip);
  if (currentId) s.add(currentId);
  return rows.find((l) => !s.has(l.id) && l.status !== "closed" && l.work_state !== "completed") ?? null;
}

export const SHORTCUT_LABELS = {
  save: { bn: "Ctrl/⌘ + Enter — রিপোর্ট জমা (সব ঘর পূরণ হলে)", en: "Ctrl/⌘ + Enter — submit report (when complete)" },
  next: { bn: "Alt + Shift + N — পরের যোগ্য লিড", en: "Alt + Shift + N — next eligible lead" },
};

/**
 * Single-flight latch for the save shortcut: a second Ctrl/⌘+Enter before the
 * first request settles is ignored, even before React re-renders isPending.
 * `run` must be the same submit the button uses; `release` is called when it settles.
 */
export function createSaveLatch() {
  let inFlight = false;
  return {
    get busy() {
      return inFlight;
    },
    try(state: { missing: string | null; pending: boolean; open: boolean }, run: () => void): "ran" | "blocked" | "busy" {
      if (inFlight || state.pending) return "busy";
      if (!canSaveReport(state)) return "blocked";
      inFlight = true;
      run();
      return "ran";
    },
    release() {
      inFlight = false;
    },
  };
}
