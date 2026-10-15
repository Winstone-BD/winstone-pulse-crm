// Push flow after the switch from the umbrella `firebase` package to
// @firebase/app + @firebase/messaging. Browser APIs and Firebase are mocked;
// real delivery is covered by docs/push-notification-test-plan.md.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getToken = vi.fn();
const isSupported = vi.fn();
const initializeApp = vi.fn((cfg: unknown) => ({ cfg }));
vi.mock("@firebase/app", () => ({ initializeApp }));
vi.mock("@firebase/messaging", () => ({
  getMessaging: vi.fn(() => ({})),
  getToken,
  isSupported,
}));

const ENV = {
  VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY: "web-key",
  VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID: "proj",
  VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID: "1:12345:web:abc",
  VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY: "vapid",
};

function stubBrowser(permission: string, framed = false) {
  const register = vi.fn(async () => ({ scope: "/" }));
  const win: Record<string, unknown> = { Notification: {} };
  win["top"] = framed ? {} : win;
  win["self"] = win;
  vi.stubGlobal("window", win);
  vi.stubGlobal("Notification", {
    permission: "default",
    requestPermission: vi.fn(async () => permission),
  });
  vi.stubGlobal("navigator", { serviceWorker: { register } });
  return register;
}

async function loadClient(env: Record<string, string> = ENV) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import("@/lib/web-push");
}

describe("web push registration (@firebase/* modular packages)", () => {
  beforeEach(() => {
    getToken.mockReset();
    isSupported.mockReset().mockResolvedValue(true);
    initializeApp.mockClear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("reports not-configured without touching Firebase", async () => {
    const { requestWebPushToken } = await loadClient({
      ...ENV,
      VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY: "",
    });
    expect(await requestWebPushToken()).toEqual({ status: "not-configured" });
    expect(initializeApp).not.toHaveBeenCalled();
  });

  it("asks to open a new tab inside the preview frame", async () => {
    stubBrowser("granted", true);
    const { requestWebPushToken } = await loadClient();
    expect((await requestWebPushToken()).status).toBe("open-in-new-tab");
  });

  it("reports unsupported browsers", async () => {
    stubBrowser("granted");
    isSupported.mockResolvedValue(false);
    const { requestWebPushToken } = await loadClient();
    expect((await requestWebPushToken()).status).toBe("unsupported");
  });

  it("reports denied permission and never registers the worker", async () => {
    const register = stubBrowser("denied");
    const { requestWebPushToken } = await loadClient();
    expect((await requestWebPushToken()).status).toBe("denied");
    expect(register).not.toHaveBeenCalled();
  });

  it("registers the worker with full config incl. messagingSenderId and returns the token", async () => {
    const register = stubBrowser("granted");
    getToken.mockResolvedValue("device-token");
    const { requestWebPushToken, PUSH_MESSAGES } = await loadClient();
    expect(await requestWebPushToken()).toEqual({ status: "registered", token: "device-token" });
    const url = new URL(String(register.mock.calls[0]![0]), "https://x");
    expect(url.pathname).toBe("/firebase-messaging-sw.js");
    expect(url.searchParams.get("messagingSenderId")).toBe("12345");
    expect(initializeApp.mock.calls[0]![0]).toMatchObject({ messagingSenderId: "12345", projectId: "proj" });
    expect(getToken.mock.calls[0]![1]).toMatchObject({ vapidKey: "vapid" });
    for (const s of ["registered", "not-configured", "unsupported", "open-in-new-tab", "denied"] as const)
      expect(PUSH_MESSAGES[s]).toBeTruthy();
  });
});

// ---- server send path ----
type Row = Record<string, unknown>;
const db = { deliveries: [] as Row[], tokens: [] as Row[], updates: [] as Row[] };

function fakeAdmin() {
  return {
    from(table: string) {
      return {
        insert: async (row: Row) => {
          if (db.deliveries.some((d) => d["event_key"] === row["event_key"]))
            return { error: { message: "duplicate" } };
          db.deliveries.push(row);
          return { error: null };
        },
        update: (patch: Row) => ({
          eq: async (_c: string, v: unknown) => {
            db.updates.push({ table, patch, v });
            if (table === "push_tokens") db.tokens.forEach((t) => t["token"] === v && Object.assign(t, patch));
            return { error: null };
          },
        }),
        select: () => ({
          in: () => ({ is: async () => ({ data: db.tokens.filter((t) => !t["revoked_at"]) }) }),
        }),
      };
    },
  };
}
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: fakeAdmin() }));

describe("server push send", () => {
  const send = (eventKey: string) =>
    import("@/lib/push.server").then((m) =>
      m.sendPush({ eventKey, kind: "support", profileIds: ["p1"], payload: { title: "T", body: "B" } }),
    );

  beforeEach(() => {
    db.deliveries = [];
    db.updates = [];
    db.tokens = [{ token: "good", platform: "web", profile_id: "p1" }, { token: "stale", platform: "android", profile_id: "p1" }];
    process.env["LOVABLE_API_KEY"] = "lk";
    process.env["FIREBASE_MESSAGING_API_KEY"] = "ck";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("skips quietly when Firebase is not connected", async () => {
    delete process.env["FIREBASE_MESSAGING_API_KEY"];
    expect(await send("e0")).toMatchObject({ skipped: "firebase_not_connected" });
  });

  it("sends through the gateway, revokes stale tokens, and is idempotent", async () => {
    const fetchMock = vi.fn(async (_u: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      return body.message.token === "stale"
        ? new Response(JSON.stringify({ error: { code: 404, status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] } }), { status: 404 })
        : new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    expect(await send("e1")).toEqual({ sent: 1, failed: 1 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://connector-gateway.lovable.dev/firebase_messaging/v1/projects/_/messages:send");
    expect((init.headers as Record<string, string>)["X-Connection-Api-Key"]).toBe("ck");
    expect(JSON.parse(String(init.body)).message.data).toMatchObject({ kind: "support", path: "/desk" });
    expect(db.tokens.find((t) => t["token"] === "stale")!["revoked_at"]).toBeTruthy();

    expect(await send("e1")).toMatchObject({ skipped: "already_sent" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
