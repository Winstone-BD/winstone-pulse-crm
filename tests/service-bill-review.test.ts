import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { missingServiceBillEmailSecrets, serviceBillPayload } from "@/lib/service-bill-review";

describe("review-only service bill", () => {
  const bill = serviceBillPayload(
    {
      id: "11111111-1111-4111-8111-111111111111",
      created_at: "2026-10-01T00:00:00.000Z",
      due_date: "2026-10-13T18:00:00.000Z",
      review_status: "pending_review",
      reviewed_by: null,
      reviewed_at: null,
    },
    "reviewer@example.com",
  );

  it("returns the exact safe JSON contract in USD", () => {
    expect(bill).toEqual({
      bill_id: "11111111-1111-4111-8111-111111111111",
      service_name: "Winstone Pulse IT Service & Maintenance",
      amount: 35.29,
      currency: "USD",
      status: "Pending Review",
      issuer: "Winstone IT Team",
      recipient: "reviewer@example.com",
      created_at: "2026-10-01T00:00:00.000Z",
      due_at: "2026-10-13T18:00:00.000Z",
      review_status: "pending_review",
      reviewed_by: null,
      reviewed_at: null,
    });
  });

  it("reports missing secret names without values", () => {
    expect(missingServiceBillEmailSecrets({ NOTIFY_EMAIL_API_KEY: "token" })).toEqual([
      "SERVICE_BILL_APPROVER_EMAIL",
    ]);
  });

  it("contains no payment execution or financial approval action", () => {
    const files = [
      "src/lib/service-bill-review.functions.ts",
      "src/lib/service-bill-review.server.ts",
      "src/routes/service-bill-unlock.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(
        /verifyMaintenancePayment|verifyPayment\(|paddle|transferFunds|approvePayment/,
      );
    }
  });

  it("never places service-bill secrets in route components", () => {
    for (const file of [
      "src/routes/service-bill-alert.tsx",
      "src/routes/service-bill-unlock.tsx",
    ]) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(
        /SERVICE_BILL_UNLOCK_PIN|SERVICE_BILL_APPROVER_EMAIL|process\.env|localStorage|sessionStorage/,
      );
    }
  });
});
