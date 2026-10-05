import { describe, expect, it } from "vitest";
import { checkEmailEvent } from "@/lib/email-events";

const secret = "test-webhook-secret-1234567890";
const body = JSON.stringify({ event: "message.received", data: { messageId: "m-1", mailbox: "info@winstonebd.com" } });

describe("Hostinger email-events receiver", () => {
  it("503 when not configured", async () => {
    expect(await checkEmailEvent({ secret: undefined, authorization: `Bearer ${secret}`, rawBody: body }))
      .toMatchObject({ ok: false, status: 503 });
  });
  it("401 on missing / wrong bearer", async () => {
    expect(await checkEmailEvent({ secret, authorization: null, rawBody: body })).toMatchObject({ status: 401 });
    expect(await checkEmailEvent({ secret, authorization: "Bearer nope", rawBody: body })).toMatchObject({ status: 401 });
  });
  it("rejects malformed and unsupported payloads", async () => {
    const auth = `Bearer ${secret}`;
    expect(await checkEmailEvent({ secret, authorization: auth, rawBody: "{bad" })).toMatchObject({ status: 400 });
    expect(await checkEmailEvent({ secret, authorization: auth, rawBody: '{"event":"x"}' })).toMatchObject({ status: 422 });
  });
  it("accepts a valid event with a stable duplicate key", async () => {
    const a = await checkEmailEvent({ secret, authorization: `Bearer ${secret}`, rawBody: body });
    const b = await checkEmailEvent({ secret, authorization: `Bearer ${secret}`, rawBody: body });
    expect(a.ok && b.ok && a.eventKey === b.eventKey).toBe(true);
    expect(a.ok && a.eventKey).toBe("hostinger:message.received:m-1");
  });
});
