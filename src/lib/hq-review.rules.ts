export function requireReviewAction(readOnly: boolean, action: string) {
  if (readOnly && action !== "noted") throw new Error("Executive HQ may add review comments only; IT Console manages remediation status");
}