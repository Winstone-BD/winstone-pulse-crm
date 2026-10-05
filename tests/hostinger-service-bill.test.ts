import { describe, expect, it } from "vitest";

import { buildHostingerServiceBillPayload } from "@/lib/email-templates/hostinger-send.server";

describe("Hostinger service-bill payload", () => {
  it("uses the relay's standard JSON keys and current USD fee", () => {
    expect(
      buildHostingerServiceBillPayload({
        sender: "alerts@example.com",
        recipient: "hq@example.com",
        stage: "মেয়াদ শেষ",
      }),
    ).toEqual({
      sender: "alerts@example.com",
      recipient: "hq@example.com",
      subject: "Service-Bill Alert: মেয়াদ শেষ - Winstone CRM",
      body: "WINSTONE CRM — SERVICE BILL ALERT\n\nStatus: মেয়াদ শেষ\nAmount: $46.29 USD\n\nThis notice requires authorized human review. It does not execute or approve a payment.",
    });
  });
});
