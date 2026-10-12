/** Display-only browser flags for billing notices. Never read by enforcement. */
export const amberDismissed = (period: string) => window.localStorage.getItem(`billing-amber-dismissed:${period}`) === "1";
export const dismissAmber = (period: string) => window.localStorage.setItem(`billing-amber-dismissed:${period}`, "1");
/** True the first time per browser session per period (red modal shows once). */
export function firstRedModalThisSession(period: string): boolean {
  const k = `billing-red-modal:${period}`;
  if (window.sessionStorage.getItem(k) === "1") return false;
  window.sessionStorage.setItem(k, "1");
  return true;
}
