import { describe, expect, it } from "vitest";

import {
  buildHostingerServiceBillPayload,
  HOSTINGER_MAIL_API,
  SERVICE_BILL_SENDER,
} from "@/lib/email-templates/hostinger-send.server";

describe("Hostinger service-bill payload", () => {
  it("uses the Hostinger Mail API send shape and current USD fee", () => {
    expect(
      buildHostingerServiceBillPayload({ recipient: "hq@example.com", stage: "মেয়াদ শেষ" }),
    ).toEqual({
      to: ["hq@example.com"],
      displayName: "Winstone IT Team",
      subject: "Service-Bill Alert: মেয়াদ শেষ - Winstone Pulse",
      text: "WINSTONE PULSE — SERVICE BILL ALERT\n\nStatus: মেয়াদ শেষ\nAmount: $46.29 USD\n\nThis notice requires authorized human review. It does not execute or approve a payment.",
    });
  });

  it("sends only from the fixed mailbox via the official API host", () => {
    expect(SERVICE_BILL_SENDER).toBe("info@winstonebd.com");
    expect(HOSTINGER_MAIL_API).toBe("https://api.mail.hostinger.com");
  });
});
