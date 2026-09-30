/**
 * Who may do what on the IT notice board. Pure so it can be tested without a
 * live request; notice-board.functions.ts calls it before touching data.
 */
export type NoticeCaller = {
  scope: string;
  readOnly: boolean;
  profile: { id: string } | null;
};

export type NoticeAction = "list" | "recipients" | "publish" | "read" | "reply";

/** allow = continue · empty = quietly return nothing · deny = throw this message. */
export type NoticeDecision = { kind: "allow" } | { kind: "empty" } | { kind: "deny"; message: string };

export const NOTICE_SIGN_IN = "অনুমোদিত অ্যাকাউন্ট দিয়ে সাইন ইন করুন";
export const NOTICE_AUTHORITY = "শুধু HQ / IT নোটিশ পাঠাতে পারে";
export const NOTICE_READ_ONLY = "এই সেশন শুধু দেখার জন্য";

export function noticeDecision(caller: NoticeCaller, action: NoticeAction): NoticeDecision {
  const signedOut = caller.scope === "none";
  switch (action) {
    case "list":
      // The bell polls on every page; never crash a page for a signed-out view.
      return signedOut ? { kind: "empty" } : { kind: "allow" };
    case "read":
      if (signedOut) return { kind: "deny", message: NOTICE_SIGN_IN };
      return caller.profile ? { kind: "allow" } : { kind: "empty" };
    case "reply":
      if (signedOut) return { kind: "deny", message: NOTICE_SIGN_IN };
      return caller.readOnly ? { kind: "deny", message: NOTICE_READ_ONLY } : { kind: "allow" };
    case "recipients":
    case "publish":
      if (signedOut) return { kind: "deny", message: NOTICE_SIGN_IN };
      if (caller.scope !== "authority") return { kind: "deny", message: NOTICE_AUTHORITY };
      if (action === "publish" && caller.readOnly) return { kind: "deny", message: NOTICE_READ_ONLY };
      return { kind: "allow" };
  }
}
