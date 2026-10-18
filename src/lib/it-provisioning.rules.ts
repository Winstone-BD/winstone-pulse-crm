export function requireItProvisioning(input: { userId: string | null; tokenUserId: string | null; architectUserId: string | null; authority: boolean; readOnly: boolean }) {
  if (!input.userId || input.tokenUserId !== input.userId || input.architectUserId !== input.userId || !input.authority || input.readOnly) throw new Error("Sign in as the Architect and complete the IT PIN step before managing IT officers");
}
