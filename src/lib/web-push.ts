/**
 * Browser-side registration for support alerts.
 *
 * Reads the public Firebase web-push settings that the connection supplies. If
 * they are missing, or the browser refuses (preview iframe, denied permission),
 * we say so plainly instead of failing — the in-app unread badge always works.
 */

export type PushResult =
  | { status: "registered" }
  | { status: "not-configured" | "unsupported" | "open-in-new-tab" | "denied" };

const env = import.meta.env;
const appId = env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID"] as string | undefined;
const vapidKey = env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY"] as string | undefined;

const config = {
  apiKey: env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY"] as string | undefined,
  projectId: env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID"] as string | undefined,
  appId,
  messagingSenderId: appId?.split(":")[1] ?? "",
};

export function pushConfigured() {
  return Boolean(config.apiKey && config.projectId && appId && vapidKey && config.messagingSenderId);
}

/** Must be called from a click handler; returns the token to store server-side. */
export async function requestWebPushToken(): Promise<PushResult & { token?: string }> {
  if (!pushConfigured()) return { status: "not-configured" };
  if (typeof window === "undefined" || !("Notification" in window)) return { status: "unsupported" };
  if (window.top !== window.self) return { status: "open-in-new-tab" };

  const resolved = {
    apiKey: config.apiKey!,
    projectId: config.projectId!,
    appId: appId!,
    messagingSenderId: config.messagingSenderId,
  };
  const { initializeApp } = await import("firebase/app");
  const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
  if (!(await isSupported())) return { status: "unsupported" };

  const permission =
    Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return { status: "denied" };

  const query = new URLSearchParams(resolved).toString();
  const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${query}`);
  const messaging = getMessaging(initializeApp(resolved));
  const token = await getToken(messaging, {
    vapidKey: vapidKey!,
    serviceWorkerRegistration: registration,
  });
  return token ? { status: "registered", token } : { status: "denied" };
}

export const PUSH_MESSAGES: Record<PushResult["status"], string> = {
  registered: "এই ব্রাউজারে সাপোর্ট অ্যালার্ট চালু হয়েছে",
  "not-configured": "পুশ সার্ভিস এখনো সংযুক্ত নয় — ইনবক্স ব্যাজ কাজ করছে",
  unsupported: "এই ব্রাউজারে পুশ নোটিফিকেশন সমর্থিত নয়",
  "open-in-new-tab": "নতুন ট্যাবে অ্যাপটি খুলে আবার চেষ্টা করুন",
  denied: "ব্রাউজার সেটিংস থেকে নোটিফিকেশন অনুমতি দিন",
};
