// Mock of @/lib/team-support.functions for the support-inbox browser test.
// Every server function rejects while window.__fail is set and returns a valid
// empty inbox payload otherwise.
declare global {
  interface Window {
    __fail: boolean;
  }
}

function respond(): Promise<unknown> {
  if (window.__fail) return Promise.reject(new Error("unavailable"));
  return Promise.resolve({ allowed: true, tickets: [], replies: [] });
}

export const supportInbox = () => respond();
export const openSupportTicket = () => respond();
export const replyToSupportTicket = () => respond();
export const setSupportTicketStatus = () => respond();
export const setSupportTicketPriority = () => respond();
export const registerWebPushToken = () => respond();
