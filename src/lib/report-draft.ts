/**
 * Device-local autosave for an in-progress post-call report.
 * A draft only refills the form after a reload/module recovery — it is never
 * submitted by itself; the agent still presses Submit and the server re-checks.
 */
const PREFIX = "winstone.report-draft:";
const MAX_AGE_MS = 7 * 24 * 3_600_000;

export type ReportDraft = Record<string, unknown> & { savedAt: number };

export function loadReportDraft(reportId: string): ReportDraft | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + reportId);
    if (!raw) return null;
    const draft = JSON.parse(raw) as ReportDraft;
    if (!draft || typeof draft.savedAt !== "number" || Date.now() - draft.savedAt > MAX_AGE_MS) {
      window.localStorage.removeItem(PREFIX + reportId);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

export function saveReportDraft(reportId: string, fields: Record<string, unknown>) {
  try {
    window.localStorage.setItem(PREFIX + reportId, JSON.stringify({ ...fields, savedAt: Date.now() }));
  } catch {
    /* storage full or blocked — autosave is best-effort */
  }
}

export function clearReportDraft(reportId: string) {
  try {
    window.localStorage.removeItem(PREFIX + reportId);
  } catch {
    /* ignore */
  }
}
