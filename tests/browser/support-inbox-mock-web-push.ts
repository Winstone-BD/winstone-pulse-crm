// Mock of @/lib/web-push for the support-inbox browser test.
export const PUSH_MESSAGES: Record<string, string> = {
  registered: "registered",
  denied: "denied",
  unsupported: "unsupported",
};

export async function requestWebPushToken(): Promise<{ status: string; token?: string }> {
  return { status: "unsupported" };
}
