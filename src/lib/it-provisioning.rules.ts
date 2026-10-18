export function requireItProvisioning(input: { userId: string | null; tokenUserId: string | null; architectUserId: string | null; authority: boolean; readOnly: boolean }) {
  if (!input.userId || input.tokenUserId !== input.userId || input.architectUserId !== input.userId || !input.authority || input.readOnly) throw new Error("Sign in as the Architect and complete the IT PIN step before managing IT officers");
}

export function requireItOnboardingStep(status: string, action: "approve" | "assign_role", emailVerified: boolean) {
  if (!emailVerified) throw new Error("Verified email required");
  if (action === "approve" && status !== "password_set") throw new Error("Password setup required before approval");
  if (action === "assign_role" && status !== "approved") throw new Error("Approval required before IT role assignment");
}
